import { getTodayChecks, getWeeklyFishCount, getWeeklyWorkoutCount, getStreak, getCurrentWeekStart } from './db'

export async function buildFoodReply(
  userId: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  isFish: boolean,
  mealType: string,
  date: string
): Promise<string> {
  const weekStart = getCurrentWeekStart()
  const fishCount = await getWeeklyFishCount(userId, weekStart)

  let reply = `✓ Logged ${mealType}\n~${calories} cal | ${protein}g protein | ${carbs}g carbs | ${fat}g fat`

  if (isFish) {
    reply += `\nThat's ${fishCount}/3 fish meals this week.${fishCount >= 3 ? ' Goal hit! 🐟' : ' Keep it up!'}`
  } else if (mealType === 'breakfast' && protein >= 15) {
    reply += `\nGreat protein start! ✓`
  }

  return reply
}

export async function buildExerciseReply(userId: string): Promise<string> {
  const weekStart = getCurrentWeekStart()
  const workoutCount = await getWeeklyWorkoutCount(userId, weekStart)
  const remaining = Math.max(0, 3 - workoutCount)

  let reply = `💪 Logged!\n${workoutCount}/3 workouts this week.`
  if (remaining === 0) {
    reply += ' Workout goal hit! 🔥'
  } else {
    reply += ` ${remaining} more to go!`
  }
  return reply
}

export async function buildDailySummary(userId: string, date: string): Promise<string> {
  const checks = await getTodayChecks(userId, date)
  const streak = await getStreak(userId)
  const weekStart = getCurrentWeekStart()
  const [fishCount, workoutCount] = await Promise.all([
    getWeeklyFishCount(userId, weekStart),
    getWeeklyWorkoutCount(userId, weekStart),
  ])

  const done = checks
    ? [checks.breakfast_protein, checks.workout_done, checks.eating_done_by_930, checks.bed_by_1030]
    : [false, false, false, false]

  const score = done.filter(Boolean).length
  const allDone = score === 4

  const lines = [
    `Today: ${score}/4${allDone ? ' ✓ 🔥' : ''}`,
    `- Breakfast protein ${done[0] ? '✓' : '✗'}`,
    `- 15-min workout ${done[1] ? '✓' : '✗'}`,
    `- Kitchen closed on time ${done[2] ? '✓' : '✗'}`,
    `- Bed ready ${done[3] ? '✓' : '✗'}`,
    `Week so far: ${fishCount}/3 fish | ${workoutCount}/3 workouts`,
  ]

  if (streak > 0) lines.push(`Streak: ${streak} day${streak === 1 ? '' : 's'} 🔥`)

  return lines.join('\n')
}
