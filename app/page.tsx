import {
  getAllUsers,
  getCurrentWeekStart,
  addDays,
  getWeeklyMenu,
  getWeeklyWorkoutPlan,
  getWeeklyChecksRange,
  getWeeklyExerciseLogsCount,
  getWeeklyFishMealsCount,
  getTodayFoodLogs,
  getTodayExerciseLogs,
  getWeekFoodLogs,
  getTodayChecks,
  getCRMFollowupsDue,
  getCRMOverdueContacts,
} from '@/lib/db'
import type { WorkoutDay } from '@/types'
import DashboardClient from './dashboard-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function Home({ searchParams }: PageProps) {
  const { token } = await searchParams

  if (!process.env.CRON_SECRET) {
    return <ErrorPage title="Dashboard misconfigured" body="CRON_SECRET is not set on the server." />
  }

  if (!token || token !== process.env.CRON_SECRET) {
    return <ErrorPage title="Dashboard locked" body="Append ?token=… to the URL." />
  }

  const users = await getAllUsers()
  const user = users.find((u) => u.telegram_chat_id) ?? users[0]

  if (!user) {
    return <ErrorPage title="No users yet" body="Add a user via the seed script." />
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: user.timezone })
  const weekStart = getCurrentWeekStart()
  const weekEnd = addDays(weekStart, 6)

  const [
    menu,
    plan,
    weekChecks,
    workoutsLogged,
    fishMealsLogged,
    todayFood,
    todayEx,
    weekFood,
    dailyCheck,
    crmFollowups,
    crmOverdue,
  ] = await Promise.all([
    getWeeklyMenu(user.id, weekStart),
    getWeeklyWorkoutPlan(user.id, weekStart),
    getWeeklyChecksRange(user.id, weekStart, weekEnd),
    getWeeklyExerciseLogsCount(user.id, weekStart, weekEnd),
    getWeeklyFishMealsCount(user.id, weekStart, weekEnd),
    getTodayFoodLogs(user.id, today),
    getTodayExerciseLogs(user.id, today),
    getWeekFoodLogs(user.id, weekStart, weekEnd),
    getTodayChecks(user.id, today),
    getCRMFollowupsDue().catch(() => []),
    getCRMOverdueContacts(30).catch(() => []),
  ])

  const workoutsPlanned = (plan?.plan ?? []).filter(
    (d: WorkoutDay) => d.type === 'strength' || d.type === 'cardio' || d.type === 'sport'
  ).length
  const sleepReplies = weekChecks.filter((c) => !!c.sleep_response).length
  const windDownNights = weekChecks.filter((c) => c.wind_down_confirmed === true).length

  const macros = todayFood.reduce(
    (acc, l) => ({
      cals: acc.cals + (l.calories || 0),
      p: acc.p + (l.protein_g || 0),
      c: acc.c + (l.carbs_g || 0),
      f: acc.f + (l.fat_g || 0),
    }),
    { cals: 0, p: 0, c: 0, f: 0 }
  )

  const oura = dailyCheck?.oura_data ?? null
  const whoop = dailyCheck?.whoop_data ?? null
  const coaching = buildCoachingNote(oura, whoop)

  return (
    <DashboardClient
      token={token!}
      data={{
        user: { name: user.name, timezone: user.timezone },
        today: {
          date: fmtDate(today),
          todayRaw: today,
          weekOf: fmtDate(weekStart),
          calories: Math.round(macros.cals),
          protein: Math.round(macros.p),
          carbs: Math.round(macros.c),
          fat: Math.round(macros.f),
          meals: todayFood,
          exercise: todayEx,
        },
        thisWeek: {
          workoutsLogged,
          workoutsPlanned,
          fishMeals: fishMealsLogged,
          sleepReplies,
          windDown: windDownNights,
        },
        wearables: { oura, whoop, coaching },
        weekFood,
        menu: menu ? { options: menu.options, chosen: menu.chosen } : null,
        workoutPlan: plan?.plan ?? null,
        crm: { followups: crmFollowups, overdue: crmOverdue },
      }}
    />
  )
}

function buildCoachingNote(
  oura: { sleep_score?: number | null; readiness_score?: number | null } | null,
  whoop: { recovery?: number | null } | null
): string {
  const score = oura?.readiness_score ?? whoop?.recovery ?? oura?.sleep_score ?? null
  if (score == null) return 'No wearable data yet — check back after your morning cron runs.'
  if (score >= 80) return `Green day (${score}) — push the workout, your body is ready.`
  if (score >= 65) return `Solid base (${score}) — moderate intensity, you're in good shape.`
  return `Low battery (${score}) — keep it light today, prioritise walking and an early night.`
}

function fmtDate(yyyy_mm_dd: string): string {
  const d = new Date(yyyy_mm_dd + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function ErrorPage({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>{title}</h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>{body}</p>
      </div>
    </div>
  )
}
