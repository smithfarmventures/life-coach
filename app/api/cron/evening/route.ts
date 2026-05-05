import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, setLastCheckin } from '@/lib/db'
import { sendMessage } from '@/lib/telegram'

// 8:00 PM America/New_York — schedule with cron-job.org using the TZ field
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await getAllUsers()
  const active = users.filter((u) => u.telegram_chat_id)

  await Promise.all(
    active.map(async (u) => {
      await setLastCheckin(u.id, 'dinner')
      await sendMessage(u.telegram_chat_id!, `Evening ${u.name}. What'd you eat for dinner?`)
    })
  )

  return NextResponse.json({ sent: active.length })
}
