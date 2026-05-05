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
} from '@/lib/db'
import type { WorkoutDay, MenuOption, FoodLog } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function Home({ searchParams }: PageProps) {
  const { token } = await searchParams

  if (!process.env.CRON_SECRET) {
    return (
      <Wrap>
        <Card>
          <h1 className="text-xl font-semibold">Dashboard misconfigured</h1>
          <p className="mt-2 text-sm text-zinc-600">
            CRON_SECRET is not set on the server.
          </p>
        </Card>
      </Wrap>
    )
  }

  if (!token || token !== process.env.CRON_SECRET) {
    return (
      <Wrap>
        <Card>
          <h1 className="text-xl font-semibold">Dashboard locked</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Append <code className="rounded bg-zinc-100 px-1 py-0.5">?token=…</code> to the URL.
          </p>
        </Card>
      </Wrap>
    )
  }

  const users = await getAllUsers()
  const user = users.find((u) => u.telegram_chat_id) ?? users[0]

  if (!user) {
    return (
      <Wrap>
        <Card>
          <h1 className="text-xl font-semibold">No users yet</h1>
          <p className="mt-2 text-sm text-zinc-600">Add a user via the seed script.</p>
        </Card>
      </Wrap>
    )
  }

  // Today + week boundaries (in user's timezone)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: user.timezone })
  const weekStart = getCurrentWeekStart()
  const weekEnd = addDays(weekStart, 6)

  // Pull everything in parallel
  const [
    menu,
    plan,
    weekChecks,
    workoutsLogged,
    fishMealsLogged,
    todayFood,
    todayEx,
    weekFood,
  ] = await Promise.all([
    getWeeklyMenu(user.id, weekStart),
    getWeeklyWorkoutPlan(user.id, weekStart),
    getWeeklyChecksRange(user.id, weekStart, weekEnd),
    getWeeklyExerciseLogsCount(user.id, weekStart, weekEnd),
    getWeeklyFishMealsCount(user.id, weekStart, weekEnd),
    getTodayFoodLogs(user.id, today),
    getTodayExerciseLogs(user.id, today),
    getWeekFoodLogs(user.id, weekStart, weekEnd),
  ])

  // Compute weekly stats
  const workoutsPlanned = (plan?.plan ?? []).filter(
    (d) => d.type === 'strength' || d.type === 'cardio' || d.type === 'sport'
  ).length
  const sleepReplies = weekChecks.filter((c) => !!c.sleep_response).length
  const windDownNights = weekChecks.filter((c) => c.wind_down_confirmed === true).length

  // Today's macros
  const macros = sumMacros(todayFood)

  // This week's chosen menu (resolve indices to names)
  const chosenMeals: MenuOption[] = (() => {
    if (!menu || !menu.chosen) return []
    return menu.chosen.map((i) => menu.options[i]).filter(Boolean)
  })()

  return (
    <Wrap>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-zinc-500">Life Coach</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
          Hey {user.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {fmtDate(today)} · Week of {fmtDate(weekStart)}
        </p>
      </header>

      {/* This week stats */}
      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          This week
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Workouts"
            value={`${workoutsLogged}${workoutsPlanned ? ` / ${workoutsPlanned}` : ''}`}
            sub={workoutsPlanned ? 'planned' : 'logged'}
          />
          <Stat label="Fish meals" value={String(fishMealsLogged)} sub="target 2+" />
          <Stat
            label="Sleep replies"
            value={`${sleepReplies} / 7`}
            sub="mornings"
          />
          <Stat
            label="Wind-down"
            value={`${windDownNights} / 7`}
            sub="by 10 PM"
          />
        </div>
      </Card>

      {/* Today */}
      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Today
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Calories" value={macros.cals.toString()} sub="kcal" />
          <Stat label="Protein" value={`${macros.p}g`} />
          <Stat label="Carbs" value={`${macros.c}g`} />
          <Stat label="Fat" value={`${macros.f}g`} />
        </div>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Meals ({todayFood.length})
        </h3>
        {todayFood.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nothing logged yet today.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100">
            {todayFood.map((f) => (
              <li key={f.id} className="py-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium capitalize text-zinc-800">
                    {f.meal_type} {f.is_fish ? '🐟' : ''}
                  </span>
                  <span className="text-zinc-500">{f.calories} kcal</span>
                </div>
                <div className="text-xs text-zinc-500">{f.description}</div>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Exercise ({todayEx.length})
        </h3>
        {todayEx.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nothing logged yet today.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100">
            {todayEx.map((e) => (
              <li key={e.id} className="py-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium capitalize text-zinc-800">
                    {e.exercise_type}
                  </span>
                  <span className="text-zinc-500">{e.duration_minutes} min</span>
                </div>
                <div className="text-xs text-zinc-500">{e.description}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Workout plan */}
      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Workout plan
        </h2>
        {!plan ? (
          <p className="mt-2 text-sm text-zinc-500">
            No plan yet — Sunday 8 AM cron generates this.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {plan.plan.map((d) => (
              <DayRow key={d.day} d={d} />
            ))}
          </ul>
        )}
      </Card>

      {/* Menu */}
      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          This week&apos;s menu
        </h2>
        {!menu ? (
          <p className="mt-2 text-sm text-zinc-500">
            No menu generated yet — Friday 8 AM cron handles this.
          </p>
        ) : chosenMeals.length === 0 ? (
          <>
            <p className="mt-2 text-sm text-zinc-500">
              {menu.options.length} options sent — pending pick.
            </p>
            <ul className="mt-3 divide-y divide-zinc-100">
              {menu.options.map((o, i) => (
                <li key={i} className="py-2 text-sm">
                  <div className="font-medium text-zinc-800">
                    {i + 1}. {o.name}
                  </div>
                  <div className="text-xs text-zinc-500">{o.prep_notes}</div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {chosenMeals.map((o, i) => (
              <li key={i} className="py-2 text-sm">
                <div className="font-medium text-zinc-800">{o.name}</div>
                <div className="text-xs text-zinc-500">{o.prep_notes}</div>
                <div className="mt-1 text-xs text-zinc-400">
                  {o.ingredients.join(' · ')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Week food log */}
      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Week food log ({weekFood.length})
        </h2>
        {weekFood.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nothing logged this week yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100">
            {weekFood.slice().reverse().map((f) => (
              <li key={f.id} className="py-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium capitalize text-zinc-800">
                    {fmtDayShort(f.logged_at, user.timezone)} {f.meal_type}{' '}
                    {f.is_fish ? '🐟' : ''}
                  </span>
                  <span className="text-zinc-500">{f.calories} kcal</span>
                </div>
                <div className="text-xs text-zinc-500">{f.description}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-6 text-center text-xs text-zinc-400">
        Auto-refresh: reload to update · Crons via cron-job.org
      </p>
    </Wrap>
  )
}

// ----------------------------------------------------------------------------
// Tiny helpers + presentational components
// ----------------------------------------------------------------------------
function sumMacros(logs: FoodLog[]) {
  return logs.reduce(
    (acc, l) => ({
      cals: acc.cals + (l.calories || 0),
      p: acc.p + (l.protein_g || 0),
      c: acc.c + (l.carbs_g || 0),
      f: acc.f + (l.fat_g || 0),
    }),
    { cals: 0, p: 0, c: 0, f: 0 }
  )
}

function fmtDate(yyyy_mm_dd: string): string {
  const d = new Date(yyyy_mm_dd + 'T12:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function fmtDayShort(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: tz,
  })
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-6 font-sans text-zinc-900 sm:px-6">
      <div className="mx-auto max-w-2xl">{children}</div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      {children}
    </section>
  )
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-zinc-900">{value}</div>
      {sub && <div className="text-[10px] text-zinc-400">{sub}</div>}
    </div>
  )
}

function DayRow({ d }: { d: WorkoutDay }) {
  const tag =
    d.type === 'strength'
      ? '💪'
      : d.type === 'cardio'
        ? '🏃'
        : d.type === 'sport'
          ? '⚽'
          : d.type === 'active-rest'
            ? '🚶'
            : '😌'
  return (
    <li className="py-2 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-zinc-800">
          {tag} {d.day}
        </span>
        <span className="text-xs text-zinc-500">
          {d.target_minutes} min · {d.type}
        </span>
      </div>
      <div className="text-xs text-zinc-500">{d.description}</div>
    </li>
  )
}

