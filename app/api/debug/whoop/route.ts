import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers } from '@/lib/db'
import { createClient } from '@supabase/supabase-js'

// GET /api/debug/whoop?token=CRON_SECRET
// Surfaces the raw Whoop API response so we can diagnose why fetchWhoopSleep returns null.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await getAllUsers()
  const user = users.find((u) => u.telegram_chat_id) ?? users[0]
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 404 })

  // Pull oauth row
  const supa = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: tokRow, error: tokErr } = await supa
    .from('oauth_tokens')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'whoop')
    .single()

  if (tokErr || !tokRow) {
    return NextResponse.json({
      step: 'fetch_token',
      error: tokErr?.message ?? 'no row in oauth_tokens',
    })
  }

  const expiresAt = tokRow.expires_at
    ? new Date(tokRow.expires_at).getTime()
    : 0
  const expiresInSec = Math.round((expiresAt - Date.now()) / 1000)

  // Try both v1 and v2 endpoints to figure out which works
  const today = new Date().toLocaleDateString('en-CA', { timeZone: user.timezone })
  const start = new Date(`${today}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - 1)
  const end = new Date(`${today}T23:59:59Z`)
  const range = `start=${start.toISOString()}&end=${end.toISOString()}`
  const headers = { Authorization: `Bearer ${tokRow.access_token}` }

  const probes = [
    { name: 'v1_sleep', url: `https://api.prod.whoop.com/developer/v1/activity/sleep?${range}&limit=10` },
    { name: 'v2_sleep', url: `https://api.prod.whoop.com/developer/v2/activity/sleep?${range}&limit=10` },
    { name: 'v1_recovery', url: `https://api.prod.whoop.com/developer/v1/recovery?${range}&limit=10` },
    { name: 'v2_recovery', url: `https://api.prod.whoop.com/developer/v2/recovery?${range}&limit=10` },
    { name: 'v1_profile', url: `https://api.prod.whoop.com/developer/v1/user/profile/basic` },
    { name: 'v2_profile', url: `https://api.prod.whoop.com/developer/v2/user/profile/basic` },
  ]

  const results: Record<string, { status: number; body: unknown }> = {}
  for (const p of probes) {
    try {
      const res = await fetch(p.url, { headers })
      const text = await res.text()
      let body: unknown = text
      try {
        body = JSON.parse(text)
      } catch {
        // keep as text
      }
      // Truncate large responses
      if (typeof body === 'object' && body !== null) {
        const s = JSON.stringify(body)
        if (s.length > 2000) body = s.slice(0, 2000) + '…(truncated)'
      } else if (typeof body === 'string' && body.length > 500) {
        body = body.slice(0, 500) + '…(truncated)'
      }
      results[p.name] = { status: res.status, body }
    } catch (err) {
      results[p.name] = { status: -1, body: String(err) }
    }
  }

  return NextResponse.json({
    user_id: user.id,
    today,
    range,
    token_meta: {
      has_access: !!tokRow.access_token,
      access_prefix: (tokRow.access_token as string).slice(0, 12) + '…',
      has_refresh: !!tokRow.refresh_token,
      expires_in_seconds: expiresInSec,
      expired: expiresInSec <= 0,
      scope: tokRow.scope,
      updated_at: tokRow.updated_at,
    },
    probes: results,
  })
}
