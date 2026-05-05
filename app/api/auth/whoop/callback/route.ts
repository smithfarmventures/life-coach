import { NextRequest, NextResponse } from 'next/server'
import { exchangeWhoopCode, saveWhoopTokens } from '@/lib/wearables'

// GET /api/auth/whoop/callback?code=…&state=user_id:nonce
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const err = url.searchParams.get('error')

  if (err) {
    return new NextResponse(`Whoop auth error: ${err}`, { status: 400 })
  }
  if (!code || !state) {
    return new NextResponse('Missing code or state', { status: 400 })
  }

  const userId = state.split(':')[0]
  if (!userId) return new NextResponse('Bad state', { status: 400 })

  const tok = await exchangeWhoopCode(code)
  if (!tok) {
    return new NextResponse('Token exchange failed — check WHOOP_CLIENT_SECRET', {
      status: 500,
    })
  }

  await saveWhoopTokens(userId, tok)
  return new NextResponse(
    `<html><body style="font-family:system-ui;padding:40px"><h1>✅ Whoop linked</h1><p>You can close this tab. Tomorrow's 8 AM check-in will pull from Whoop.</p></body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
