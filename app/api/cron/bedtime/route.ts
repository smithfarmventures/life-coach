import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, setLastCheckin } from '@/lib/db'
import { sendMessage } from '@/lib/telegram'

// 10:00 PM America/New_York — schedule with cron-job.org using the TZ field
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await getAllUsers()
  const active = users.filter((u) => u.telegram_chat_id)

  await Promise.all(
    active.map(async (u) => {
      await setLastCheckin(u.id, 'bedtime')
      await sendMessage(u.telegram_chat_id!, `${u.name}, time to wind down. Lights out soon?`)
    })
  )

  return NextResponse.json({ sent: active.length })
}
