import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers } from '@/lib/db'
import { sendMessage } from '@/lib/telegram'
import { buildDailySummary } from '@/lib/progress'

// 10:30 PM ET → 02:30 UTC (EDT) / 03:30 UTC (EST)
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await getAllUsers()

  await Promise.all(
    users
      .filter((u) => u.telegram_chat_id)
      .map(async (u) => {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: u.timezone })
        const summary = await buildDailySummary(u.id, today)
        return sendMessage(u.telegram_chat_id!, summary)
      })
  )

  return NextResponse.json({ ok: true })
}
