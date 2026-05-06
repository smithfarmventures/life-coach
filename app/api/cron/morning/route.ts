import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers } from '@/lib/db'
import { sendMessage } from '@/lib/telegram'
import {
  fetchOuraSleep,
  fetchWhoopSleep,
  saveWearableData,
  formatWearableMessage,
} from '@/lib/wearables'

// 8:00 AM America/New_York — schedule with cron-job.org using the TZ field
// Pulls sleep + recovery from Oura and Whoop and messages a summary.
export async function GET(req: NextRequest) {
  const headerOk =
    req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
  const tokenOk =
    new URL(req.url).searchParams.get('token') === process.env.CRON_SECRET
  if (!headerOk && !tokenOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await getAllUsers()
  const active = users.filter((u) => u.telegram_chat_id)

  const results = await Promise.all(
    active.map(async (u) => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: u.timezone })

      // Wearable APIs report on the prior night's sleep — query "today" since
      // both APIs treat sleep that ended this morning as today's record.
      const [oura, whoop] = await Promise.all([
        fetchOuraSleep(today),
        fetchWhoopSleep(u.id, today),
      ])

      // Persist snapshot regardless of whether we send a message
      await saveWearableData(u.id, today, oura, whoop)

      const msg = formatWearableMessage(u.name, oura, whoop)
      await sendMessage(u.telegram_chat_id!, msg)

      return { user: u.name, oura: !!oura, whoop: !!whoop }
    })
  )

  return NextResponse.json({ sent: active.length, results })
}
