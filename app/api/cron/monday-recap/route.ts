import { NextRequest, NextResponse } from 'next/server'
import {
  getAllUsers,
  getCurrentWeekStart,
  addDays,
  getWeeklyWorkoutPlan,
  getWeeklyChecksRange,
  getWeeklyExerciseLogsCount,
  getWeeklyFishMealsCount,
} from '@/lib/db'
import { sendMessage } from '@/lib/telegram'
import { buildWeeklyRecap } from '@/lib/ai-generators'

// Monday 8:00 AM America/New_York — recap of the PREVIOUS week.
// schedule via cron-job.org with TZ field
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await getAllUsers()
  const active = users.filter((u) => u.telegram_chat_id)

  // Last week = Monday before this Monday → previous Sunday inclusive
  const thisMonday = getCurrentWeekStart()
  const lastMonday = addDays(thisMonday, -7)
  const lastSunday = addDays(thisMonday, -1)

  let sent = 0
  for (const user of active) {
    // Workouts planned (from last Sunday's generation)
    const planRow = await getWeeklyWorkoutPlan(user.id, lastMonday)
    const workoutsPlanned = planRow
      ? planRow.plan.filter((d) => d.type === 'strength' || d.type === 'cardio' || d.type === 'sport').length
      : 0

    // Workouts actually logged
    const workoutsLogged = await getWeeklyExerciseLogsCount(user.id, lastMonday, lastSunday)

    // Fish meals (ApoB target)
    const fishMealsLogged = await getWeeklyFishMealsCount(user.id, lastMonday, lastSunday)

    // Daily checks for sleep responses + wind-down
    const checks = await getWeeklyChecksRange(user.id, lastMonday, lastSunday)
    const daysWithSleepResponse = checks.filter((c) => c.sleep_response && c.sleep_response.length > 0).length
    const windDownConfirmedNights = checks.filter((c) => c.wind_down_confirmed).length

    const message = buildWeeklyRecap({
      name: user.name,
      weekStart: lastMonday,
      weekEnd: lastSunday,
      workoutsPlanned,
      workoutsLogged,
      fishMealsLogged,
      daysWithSleepResponse,
      windDownConfirmedNights,
      totalDays: 7,
    })

    await sendMessage(user.telegram_chat_id!, message)
    sent++
  }

  return NextResponse.json({ sent, weekStart: lastMonday, weekEnd: lastSunday })
}
