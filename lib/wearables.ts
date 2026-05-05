/**
 * Wearable integrations: Oura (Personal Access Token) + Whoop (OAuth2).
 *
 * Required env vars (all optional — missing creds just skip that provider):
 *   OURA_API_KEY            Personal access token from https://cloud.ouraring.com/personal-access-tokens
 *   WHOOP_CLIENT_ID         From https://developer.whoop.com/dashboard
 *   WHOOP_CLIENT_SECRET     "
 *   WHOOP_REDIRECT_URI      e.g. https://mylifecoach-sfv.vercel.app/api/auth/whoop/callback
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null
function db(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabase
}

// ============================================================================
// Types
// ============================================================================
export interface OuraSleepSummary {
  total_sleep_hours: number | null
  rem_hours: number | null
  deep_hours: number | null
  efficiency: number | null         // 0–100
  sleep_score: number | null        // 0–100
  readiness_score: number | null    // 0–100
  bedtime_start: string | null      // ISO
  bedtime_end: string | null
}

export interface WhoopSleepSummary {
  total_sleep_hours: number | null
  rem_hours: number | null
  deep_hours: number | null
  efficiency: number | null         // 0–100
  performance: number | null        // 0–100
  recovery: number | null           // 0–100 — pulled from /recovery
  hrv_ms: number | null
  resting_hr: number | null
}

// ============================================================================
// Oura
// ============================================================================
export async function fetchOuraSleep(date: string): Promise<OuraSleepSummary | null> {
  const key = process.env.OURA_API_KEY
  if (!key) return null

  const headers = { Authorization: `Bearer ${key}` }
  const range = `start_date=${date}&end_date=${date}`

  try {
    const [sleepRes, scoreRes, readinessRes] = await Promise.all([
      fetch(`https://api.ouraring.com/v2/usercollection/sleep?${range}`, { headers }),
      fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep?${range}`, { headers }),
      fetch(`https://api.ouraring.com/v2/usercollection/daily_readiness?${range}`, { headers }),
    ])

    type OuraSleepRow = {
      total_sleep_duration?: number
      rem_sleep_duration?: number
      deep_sleep_duration?: number
      efficiency?: number
      bedtime_start?: string
      bedtime_end?: string
    }
    const sleepJson = sleepRes.ok ? ((await sleepRes.json()) as { data?: OuraSleepRow[] }) : null
    const scoreJson = scoreRes.ok
      ? ((await scoreRes.json()) as { data?: Array<{ score?: number }> })
      : null
    const readinessJson = readinessRes.ok
      ? ((await readinessRes.json()) as { data?: Array<{ score?: number }> })
      : null

    const s = sleepJson?.data?.[0]
    const score = scoreJson?.data?.[0]?.score ?? null
    const readiness = readinessJson?.data?.[0]?.score ?? null

    if (!s && score === null && readiness === null) return null

    return {
      total_sleep_hours: s?.total_sleep_duration ? +(s.total_sleep_duration / 3600).toFixed(2) : null,
      rem_hours: s?.rem_sleep_duration ? +(s.rem_sleep_duration / 3600).toFixed(2) : null,
      deep_hours: s?.deep_sleep_duration ? +(s.deep_sleep_duration / 3600).toFixed(2) : null,
      efficiency: s?.efficiency ?? null,
      sleep_score: score,
      readiness_score: readiness,
      bedtime_start: s?.bedtime_start ?? null,
      bedtime_end: s?.bedtime_end ?? null,
    }
  } catch (err) {
    console.error('Oura fetch error:', err)
    return null
  }
}

// ============================================================================
// Whoop (OAuth2)
// ============================================================================
const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth'
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer'

export function buildWhoopAuthUrl(state: string): string | null {
  const clientId = process.env.WHOOP_CLIENT_ID
  const redirect = process.env.WHOOP_REDIRECT_URI
  if (!clientId || !redirect) return null
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'read:recovery read:sleep read:profile offline',
    state,
  })
  return `${WHOOP_AUTH_URL}?${params.toString()}`
}

interface WhoopTokenResp {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type?: string
}

export async function exchangeWhoopCode(code: string): Promise<WhoopTokenResp | null> {
  const clientId = process.env.WHOOP_CLIENT_ID
  const clientSecret = process.env.WHOOP_CLIENT_SECRET
  const redirect = process.env.WHOOP_REDIRECT_URI
  if (!clientId || !clientSecret || !redirect) return null

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirect,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    console.error('Whoop token exchange failed:', res.status, await res.text())
    return null
  }
  return (await res.json()) as WhoopTokenResp
}

async function refreshWhoopToken(refreshToken: string): Promise<WhoopTokenResp | null> {
  const clientId = process.env.WHOOP_CLIENT_ID
  const clientSecret = process.env.WHOOP_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'offline',
  })
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    console.error('Whoop refresh failed:', res.status, await res.text())
    return null
  }
  return (await res.json()) as WhoopTokenResp
}

export async function saveWhoopTokens(
  userId: string,
  tok: WhoopTokenResp
): Promise<void> {
  await db()
    .from('oauth_tokens')
    .upsert(
      {
        user_id: userId,
        provider: 'whoop',
        access_token: tok.access_token,
        refresh_token: tok.refresh_token ?? null,
        expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
        scope: tok.scope ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' }
    )
}

async function getValidWhoopAccessToken(userId: string): Promise<string | null> {
  const { data } = await db()
    .from('oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'whoop')
    .single()

  if (!data) return null

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0
  // Refresh if <2 minutes left
  if (expiresAt - Date.now() > 2 * 60 * 1000) return data.access_token as string

  if (!data.refresh_token) return null
  const refreshed = await refreshWhoopToken(data.refresh_token as string)
  if (!refreshed) return null
  await saveWhoopTokens(userId, refreshed)
  return refreshed.access_token
}

export async function fetchWhoopSleep(
  userId: string,
  date: string
): Promise<WhoopSleepSummary | null> {
  const token = await getValidWhoopAccessToken(userId)
  if (!token) return null

  // Whoop API uses ISO timestamp ranges. Pull a 36h window around `date`.
  const start = new Date(`${date}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - 1)
  const end = new Date(`${date}T23:59:59Z`)

  const range = `start=${start.toISOString()}&end=${end.toISOString()}`
  const headers = { Authorization: `Bearer ${token}` }

  try {
    const [sleepRes, recRes] = await Promise.all([
      fetch(`${WHOOP_API_BASE}/v2/activity/sleep?${range}&limit=10`, { headers }),
      fetch(`${WHOOP_API_BASE}/v2/recovery?${range}&limit=10`, { headers }),
    ])

    type WhoopSleepRecord = {
      end?: string
      start?: string
      score?: {
        stage_summary?: {
          total_in_bed_time_milli?: number
          total_awake_time_milli?: number
          total_rem_sleep_time_milli?: number
          total_slow_wave_sleep_time_milli?: number
        }
        sleep_efficiency_percentage?: number
        sleep_performance_percentage?: number
      }
    }
    type WhoopRecoveryRecord = {
      score?: {
        recovery_score?: number
        hrv_rmssd_milli?: number
        resting_heart_rate?: number
      }
      sleep_id?: number
      created_at?: string
    }

    const sleepJson = sleepRes.ok
      ? ((await sleepRes.json()) as { records?: WhoopSleepRecord[] })
      : null
    const recJson = recRes.ok
      ? ((await recRes.json()) as { records?: WhoopRecoveryRecord[] })
      : null

    // Find the most recent sleep that ended on `date`
    const sleeps = sleepJson?.records ?? []
    const target = sleeps
      .filter((s) => s.end && s.end.startsWith(date))
      .sort((a, b) => (a.end! > b.end! ? -1 : 1))[0]

    const s = target?.score?.stage_summary
    const totalInBedMs = s?.total_in_bed_time_milli ?? 0
    const awakeMs = s?.total_awake_time_milli ?? 0
    const remMs = s?.total_rem_sleep_time_milli ?? 0
    const swsMs = s?.total_slow_wave_sleep_time_milli ?? 0
    const totalSleepMs = Math.max(0, totalInBedMs - awakeMs)

    // Recovery: pick the most recent record from the day
    const recs = recJson?.records ?? []
    const rec = recs.sort((a, b) =>
      (a.created_at ?? '') > (b.created_at ?? '') ? -1 : 1
    )[0]

    if (!target && !rec) return null

    return {
      total_sleep_hours: totalSleepMs ? +(totalSleepMs / 3600000).toFixed(2) : null,
      rem_hours: remMs ? +(remMs / 3600000).toFixed(2) : null,
      deep_hours: swsMs ? +(swsMs / 3600000).toFixed(2) : null,
      efficiency: target?.score?.sleep_efficiency_percentage ?? null,
      performance: target?.score?.sleep_performance_percentage ?? null,
      recovery: rec?.score?.recovery_score ?? null,
      hrv_ms: rec?.score?.hrv_rmssd_milli ?? null,
      resting_hr: rec?.score?.resting_heart_rate ?? null,
    }
  } catch (err) {
    console.error('Whoop fetch error:', err)
    return null
  }
}

// ============================================================================
// Save snapshot to daily_checks
// ============================================================================
export async function saveWearableData(
  userId: string,
  date: string,
  oura: OuraSleepSummary | null,
  whoop: WhoopSleepSummary | null
): Promise<void> {
  // Pick the best-of for the daily_checks.sleep_hours / sleep_quality columns
  const totalHours =
    oura?.total_sleep_hours ?? whoop?.total_sleep_hours ?? null
  const quality =
    oura?.sleep_score != null
      ? `Oura ${oura.sleep_score}`
      : whoop?.performance != null
        ? `Whoop ${whoop.performance}%`
        : null

  await db()
    .from('daily_checks')
    .upsert(
      {
        user_id: userId,
        date,
        sleep_hours: totalHours,
        sleep_quality: quality,
        oura_data: oura,
        whoop_data: whoop,
      },
      { onConflict: 'user_id,date' }
    )
}

// ============================================================================
// Format the morning summary for Telegram
// ============================================================================
export function formatWearableMessage(
  name: string,
  oura: OuraSleepSummary | null,
  whoop: WhoopSleepSummary | null
): string {
  if (!oura && !whoop) {
    return `Morning ${name} — couldn't pull wearable data this morning. How'd you sleep?`
  }

  const lines: string[] = [`Morning ${name} ☀️`]

  if (oura) {
    const parts: string[] = []
    if (oura.total_sleep_hours != null) parts.push(`${oura.total_sleep_hours}h`)
    if (oura.sleep_score != null) parts.push(`sleep ${oura.sleep_score}`)
    if (oura.readiness_score != null) parts.push(`readiness ${oura.readiness_score}`)
    if (parts.length) lines.push(`💍 Oura · ${parts.join(' · ')}`)
  }

  if (whoop) {
    const parts: string[] = []
    if (whoop.total_sleep_hours != null) parts.push(`${whoop.total_sleep_hours}h`)
    if (whoop.performance != null) parts.push(`perf ${whoop.performance}%`)
    if (whoop.recovery != null) parts.push(`recovery ${whoop.recovery}%`)
    if (whoop.hrv_ms != null) parts.push(`HRV ${Math.round(whoop.hrv_ms)}`)
    if (parts.length) lines.push(`🟢 Whoop · ${parts.join(' · ')}`)
  }

  // A short coaching tag
  const score =
    oura?.readiness_score ?? whoop?.recovery ?? oura?.sleep_score ?? null
  if (score != null) {
    if (score >= 80) lines.push(`\nGreen day — push the workout.`)
    else if (score >= 65) lines.push(`\nSolid base — moderate intensity.`)
    else lines.push(`\nLow battery — keep it light, prioritize walking + sleep tonight.`)
  }

  return lines.join('\n')
}
