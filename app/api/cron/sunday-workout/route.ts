import { NextRequest, NextResponse } from 'next/server'
import {
  getAllUsers,
  getRecentExerciseSummary,
  saveWeeklyWorkoutPlan,
  getNextWeekStart,
} from '@/lib/db'
import { sendMessage } from '@/lib/telegram'
import { generateWorkoutPlan, formatWorkoutMessage } from '@/lib/ai-generators'

// Sunday 8:00 AM America/New_York — schedule via cron-job.org with TZ field
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await getAllUsers()
  const active = users.filter((u) => u.telegram_chat_id)
  const weekStart = getNextWeekStart()

  let sent = 0
  for (const user of active) {
    const recent = await getRecentExerciseSummary(user.id, 14)
    const plan = await generateWorkoutPlan(recent)
    await saveWeeklyWorkoutPlan(user.id, weekStart, plan)
    await sendMessage(user.telegram_chat_id!, formatWorkoutMessage(user.name, plan))
    sent++
  }

  return NextResponse.json({ sent, weekStart })
}
