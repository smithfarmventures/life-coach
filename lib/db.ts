import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type {
  User,
  FoodLog,
  ExerciseLog,
  DailyCheck,
  CheckinType,
  FoodPreferencesData,
  MenuOption,
  WeeklyMenu,
  WorkoutDay,
  WeeklyWorkoutPlan,
} from '@/types'

let _supabase: SupabaseClient | null = null

function db(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabase
}

export async function getUserByPhone(phone: string): Promise<User | null> {
  const { data } = await db()
    .from('users')
    .select('*')
    .eq('phone_number', phone)
    .single()
  return data
}

export async function getUserByTelegramId(telegramChatId: number): Promise<User | null> {
  const { data } = await db()
    .from('users')
    .select('*')
    .eq('telegram_chat_id', telegramChatId)
    .single()
  return data
}

export async function getAllUsers(): Promise<User[]> {
  const { data } = await db().from('users').select('*')
  return data ?? []
}

export async function saveFoodLog(log: Omit<FoodLog, 'id' | 'logged_at'>): Promise<void> {
  await db().from('food_logs').insert(log)
}

export async function saveExerciseLog(log: Omit<ExerciseLog, 'id' | 'logged_at'>): Promise<void> {
  await db().from('exercise_logs').insert(log)
}

export async function getTodayChecks(userId: string, date: string): Promise<DailyCheck | null> {
  const { data } = await db()
    .from('daily_checks')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single()
  return data
}

export async function upsertDailyCheck(
  userId: string,
  date: string,
  updates: Partial<DailyCheck>
): Promise<void> {
  await db().from('daily_checks').upsert(
    { user_id: userId, date, ...updates },
    { onConflict: 'user_id,date' }
  )
}

export async function getStreak(userId: string): Promise<number> {
  const { data } = await db()
    .from('daily_checks')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(30)

  if (!data || data.length === 0) return 0

  let streak = 0
  const today = new Date().toISOString().split('T')[0]

  for (const check of data) {
    const isOnTrack =
      check.breakfast_protein && check.workout_done && check.eating_done_by_930 && check.bed_by_1030
    if (!isOnTrack) break
    if (streak === 0 && check.date !== today) break
    streak++
  }

  return streak
}

export async function getWeeklyFishCount(userId: string, weekStart: string): Promise<number> {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const { data } = await db()
    .from('food_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('is_fish', true)
    .gte('logged_at', weekStart)
    .lt('logged_at', weekEnd.toISOString().split('T')[0])

  return data?.length ?? 0
}

export async function getWeeklyWorkoutCount(userId: string, weekStart: string): Promise<number> {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const { data } = await db()
    .from('exercise_logs')
    .select('id')
    .eq('user_id', userId)
    .gte('logged_at', weekStart)
    .lt('logged_at', weekEnd.toISOString().split('T')[0])

  return data?.length ?? 0
}

// Returns the Monday of the current week as YYYY-MM-DD
export function getCurrentWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  return monday.toISOString().split('T')[0]
}

// Returns the Monday of NEXT week as YYYY-MM-DD (used by Friday menu + Sunday workout crons)
export function getNextWeekStart(): string {
  const current = new Date(getCurrentWeekStart())
  current.setDate(current.getDate() + 7)
  return current.toISOString().split('T')[0]
}

// Adds days to a YYYY-MM-DD and returns YYYY-MM-DD (UTC-safe).
export function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ============================================================================
// Check-in context (so the webhook knows which question the user is replying to)
// ============================================================================
export async function setLastCheckin(userId: string, type: CheckinType): Promise<void> {
  await db()
    .from('users')
    .update({ last_checkin_type: type, last_checkin_at: new Date().toISOString() })
    .eq('id', userId)
}

export async function clearLastCheckin(userId: string): Promise<void> {
  await db()
    .from('users')
    .update({ last_checkin_type: null, last_checkin_at: null })
    .eq('id', userId)
}

// ============================================================================
// Food preferences
// ============================================================================
export async function getFoodPreferences(userId: string): Promise<FoodPreferencesData | null> {
  const { data } = await db()
    .from('food_preferences')
    .select('data')
    .eq('user_id', userId)
    .single()
  return (data?.data as FoodPreferencesData) ?? null
}

// ============================================================================
// Weekly menus
// ============================================================================
export async function saveWeeklyMenu(
  userId: string,
  weekStart: string,
  options: MenuOption[]
): Promise<void> {
  await db()
    .from('weekly_menus')
    .upsert(
      { user_id: userId, week_start: weekStart, options, chosen: null },
      { onConflict: 'user_id,week_start' }
    )
}

export async function getWeeklyMenu(
  userId: string,
  weekStart: string
): Promise<WeeklyMenu | null> {
  const { data } = await db()
    .from('weekly_menus')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single()
  return (data as WeeklyMenu) ?? null
}

export async function getRecentMenuNames(userId: string, weeks = 4): Promise<string[]> {
  const { data } = await db()
    .from('weekly_menus')
    .select('options')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(weeks)

  if (!data) return []
  const names: string[] = []
  for (const row of data as Array<{ options: MenuOption[] }>) {
    for (const opt of row.options ?? []) names.push(opt.name)
  }
  return names
}

export async function saveMenuChoices(
  userId: string,
  weekStart: string,
  chosen: number[]
): Promise<void> {
  await db()
    .from('weekly_menus')
    .update({ chosen })
    .eq('user_id', userId)
    .eq('week_start', weekStart)
}

/** Append additional menu options to an existing weekly_menus row. */
export async function appendMenuOptions(
  userId: string,
  weekStart: string,
  more: MenuOption[]
): Promise<void> {
  const existing = await getWeeklyMenu(userId, weekStart)
  const merged = [...(existing?.options ?? []), ...more]
  await db()
    .from('weekly_menus')
    .update({ options: merged })
    .eq('user_id', userId)
    .eq('week_start', weekStart)
}

// ============================================================================
// Dashboard reads
// ============================================================================
export async function getTodayFoodLogs(userId: string, date: string): Promise<FoodLog[]> {
  const { data } = await db()
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', date)
    .lt('logged_at', addDays(date, 1))
    .order('logged_at', { ascending: true })
  return (data as FoodLog[]) ?? []
}

export async function getTodayExerciseLogs(userId: string, date: string): Promise<ExerciseLog[]> {
  const { data } = await db()
    .from('exercise_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', date)
    .lt('logged_at', addDays(date, 1))
    .order('logged_at', { ascending: true })
  return (data as ExerciseLog[]) ?? []
}

export async function getWeekFoodLogs(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<FoodLog[]> {
  const { data } = await db()
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', fromDate)
    .lt('logged_at', addDays(toDate, 1))
    .order('logged_at', { ascending: true })
  return (data as FoodLog[]) ?? []
}

// ============================================================================
// Weekly workout plans
// ============================================================================
export async function saveWeeklyWorkoutPlan(
  userId: string,
  weekStart: string,
  plan: WorkoutDay[]
): Promise<void> {
  await db()
    .from('weekly_workout_plans')
    .upsert(
      { user_id: userId, week_start: weekStart, plan },
      { onConflict: 'user_id,week_start' }
    )
}

export async function getWeeklyWorkoutPlan(
  userId: string,
  weekStart: string
): Promise<WeeklyWorkoutPlan | null> {
  const { data } = await db()
    .from('weekly_workout_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single()
  return (data as WeeklyWorkoutPlan) ?? null
}

export async function getRecentExerciseSummary(
  userId: string,
  days = 14
): Promise<string> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data } = await db()
    .from('exercise_logs')
    .select('exercise_type, duration_minutes, description, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', since.toISOString())
    .order('logged_at', { ascending: false })
    .limit(20)

  if (!data || data.length === 0) return ''
  return (data as Array<{ exercise_type: string; duration_minutes: number; description: string; logged_at: string }>)
    .map((r) => `- ${r.logged_at.slice(0, 10)}: ${r.exercise_type} ${r.duration_minutes}min — ${r.description}`)
    .join('\n')
}

// ============================================================================
// Weekly recap reads
// ============================================================================
export async function getWeeklyChecksRange(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<DailyCheck[]> {
  const { data } = await db()
    .from('daily_checks')
    .select('*')
    .eq('user_id', userId)
    .gte('date', fromDate)
    .lte('date', toDate)
  return (data as DailyCheck[]) ?? []
}

export async function getWeeklyExerciseLogsCount(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<number> {
  const { count } = await db()
    .from('exercise_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('logged_at', fromDate)
    .lte('logged_at', toDate + 'T23:59:59')
  return count ?? 0
}

export async function getWeeklyFishMealsCount(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<number> {
  const { count } = await db()
    .from('food_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_fish', true)
    .gte('logged_at', fromDate)
    .lte('logged_at', toDate + 'T23:59:59')
  return count ?? 0
}

export async function saveSleepResponse(
  userId: string,
  date: string,
  rawText: string
): Promise<void> {
  await db().from('daily_checks').upsert(
    { user_id: userId, date, sleep_response: rawText },
    { onConflict: 'user_id,date' }
  )
}

export async function setWindDownConfirmed(
  userId: string,
  date: string,
  confirmed: boolean
): Promise<void> {
  await db().from('daily_checks').upsert(
    { user_id: userId, date, wind_down_confirmed: confirmed },
    { onConflict: 'user_id,date' }
  )
}
