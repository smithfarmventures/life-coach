import { NextRequest, NextResponse } from 'next/server'
import {
  getAllUsers,
  getFoodPreferences,
  getRecentMenuNames,
  saveWeeklyMenu,
  getNextWeekStart,
  setLastCheckin,
} from '@/lib/db'
import { sendMessage } from '@/lib/telegram'
import { generateMenuOptions, formatMenuMessage } from '@/lib/ai-generators'

// Friday 8:00 AM America/New_York — schedule via cron-job.org with TZ field
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await getAllUsers()
  const active = users.filter((u) => u.telegram_chat_id)
  const weekStart = getNextWeekStart()

  let sent = 0
  for (const user of active) {
    const prefs = await getFoodPreferences(user.id)
    if (!prefs) {
      await sendMessage(
        user.telegram_chat_id!,
        `Hey ${user.name} — I don't have your food preferences yet, so I can't generate menu options. Run the latest migration in Supabase to seed them.`
      )
      continue
    }

    const recent = await getRecentMenuNames(user.id, 4)
    const options = await generateMenuOptions(prefs, recent)
    await saveWeeklyMenu(user.id, weekStart, options)
    await setLastCheckin(user.id, 'friday-menu')
    await sendMessage(user.telegram_chat_id!, formatMenuMessage(user.name, options))
    sent++
  }

  return NextResponse.json({ sent, weekStart })
}
