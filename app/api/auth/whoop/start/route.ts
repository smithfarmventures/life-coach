import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers } from '@/lib/db'
import { buildWhoopAuthUrl } from '@/lib/wearables'
import crypto from 'crypto'

// GET /api/auth/whoop/start?token=CRON_SECRET
// Redirects to Whoop's OAuth consent screen. State encodes the user_id.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await getAllUsers()
  const user = users.find((u) => u.telegram_chat_id) ?? users[0]
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 404 })

  // State = user_id + random nonce; Whoop will echo it back to the callback
  const nonce = crypto.randomBytes(16).toString('hex')
  const state = `${user.id}:${nonce}`

  const authUrl = buildWhoopAuthUrl(state)
  if (!authUrl) {
    return NextResponse.json(
      { error: 'WHOOP_CLIENT_ID or WHOOP_REDIRECT_URI not set' },
      { status: 500 }
    )
  }

  return NextResponse.redirect(authUrl)
}
