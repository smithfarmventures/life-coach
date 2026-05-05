import { NextRequest, NextResponse } from 'next/server'
import { setWebhook } from '@/lib/telegram'

// Call this once after deploying to register your webhook with Telegram:
// GET /api/telegram/setup?secret=<CRON_SECRET>
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL not set' }, { status: 500 })

  await setWebhook(`${appUrl}/api/telegram/webhook`)
  return NextResponse.json({ ok: true, webhook: `${appUrl}/api/telegram/webhook` })
}
