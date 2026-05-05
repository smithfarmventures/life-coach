import Anthropic from '@anthropic-ai/sdk'
import type { FoodPreferencesData, MenuOption, WorkoutDay } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = 'claude-sonnet-4-6'

/**
 * Strip a JSON object/array out of model text (handles ```json fences too).
 */
function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const raw = fenced ? fenced[1] : text
  const match = raw.match(/[\[{][\s\S]*[\]}]/)
  if (!match) throw new Error('No JSON found in model response')
  return JSON.parse(match[0]) as T
}

// ============================================================================
// Friday: 5 menu options for next week
// ============================================================================
export async function generateMenuOptions(
  prefs: FoodPreferencesData,
  recentMenuNames: string[],
  count: number = 5
): Promise<MenuOption[]> {
  const recentBlock =
    recentMenuNames.length > 0
      ? `Recently suggested or already shown this week (do NOT repeat any of these): ${recentMenuNames.join(', ')}`
      : 'No recent menus to avoid.'

  const prompt = `You are Andrew's personal nutritionist. Generate exactly ${count} dinner option${count === 1 ? '' : 's'} for the upcoming week (Mon–Thu home-cooked dinners, with leftovers for next-day lunch).

Andrew's profile:
- Diet style: ${prefs.diet_style}
- Goals: ${prefs.goals.join('; ')}
- Weekday pattern: ${prefs.weekday_pattern}
- Cooking constraints: ${prefs.cooking_constraints}
- Protein staples: ${prefs.protein_staples.join(', ')}
- Veg staples: ${prefs.veg_staples.join(', ')}
- Carb staples: ${prefs.carb_staples.join(', ')}
- Cuisines he enjoys: ${prefs.cuisines.join(', ')}
- Notes: ${prefs.notes}

${recentBlock}

Hard requirements:
- ${count >= 4 ? 'At least 2' : 'At least 1'} of the ${count} option${count === 1 ? '' : 's'} must feature fish (Andrew has elevated ApoB/LDL).
- Each option = 1 protein + 2 vegetable sides + 1 carb base, format "set it and forget it" (1 stove + 2 oven where reasonable).
- Cuisine mix: try to span Italian, Asian, Mexican/Latin, and American-comfort lighter takes.
- Use his staple ingredients where possible.
- Skip the treats list (cheeseburgers, fried chicken, ice cream, Chinese takeout) — those are weekend exceptions, not weekday options.

Return ONLY a JSON array of ${count} object${count === 1 ? '' : 's'}, no prose, no markdown fences. Each object:
{
  "name": "<short dish name, 3–5 words>",
  "ingredients": ["<5–8 main items>"],
  "prep_notes": "<1 sentence: what hits the stove, what hits the oven>",
  "why": "<1 sentence on why this fits Andrew's goals>"
}`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const arr = extractJson<MenuOption[]>(text)
  if (!Array.isArray(arr) || arr.length !== count) {
    throw new Error(`Expected ${count} menu options, got ${Array.isArray(arr) ? arr.length : 'non-array'}`)
  }
  return arr
}

// ============================================================================
// Sunday: 7-day workout plan for the week ahead
// ============================================================================
export async function generateWorkoutPlan(
  recentExerciseSummary: string
): Promise<WorkoutDay[]> {
  const prompt = `You are Andrew's personal trainer. Build a 7-day workout plan for the week starting Monday.

Andrew's profile:
- Goal: add 5–10 lbs of muscle through bodyweight work, plus flexibility/longevity. Improve sleep and lower stress.
- Constraint: 4 hours/week MAX of pure exercise. Prefers short 10–30 min sessions over 90-min gym blocks.
- Equipment: bodyweight only — pushups, pullups, situps, calisthenics, planks, lunges, etc. No gym, no heavy weights.
- Loves: walking everywhere; rec sports (soccer, basketball) when logistics allow; running when weather is nice.
- Lifestyle: hectic schedule, baby coming in 6 weeks, often online 8 AM–7 PM.
- He likes integrating movement into existing routine (e.g., pushups while the dog plays).

Last 14 days of logged exercise (for variety):
${recentExerciseSummary || '(no recent logs)'}

Build a plan with this shape across the 7 days:
- 3 days "strength" (bodyweight: push/pull/legs/core split)
- 1 day "cardio" (run/jog/HIIT — 20–30 min)
- 1 day "sport" (placeholder for rec sport opportunity OR another cardio if no game)
- 2 days "active-rest" (long walk + stretching/mobility)

Avoid back-to-back same-muscle-group days. Keep target_minutes realistic (typically 10–30, never over 45).

Return ONLY a JSON array of 7 objects, no prose, no markdown fences. Order: Mon, Tue, Wed, Thu, Fri, Sat, Sun.
{
  "day": "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun",
  "type": "strength"|"cardio"|"sport"|"active-rest"|"rest",
  "description": "<1–2 short sentences with concrete moves and rep targets>",
  "target_minutes": <number>
}`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const arr = extractJson<WorkoutDay[]>(text)
  if (!Array.isArray(arr) || arr.length !== 7) {
    throw new Error(`Expected 7 workout days, got ${Array.isArray(arr) ? arr.length : 'non-array'}`)
  }
  return arr
}

// ============================================================================
// Format helpers (called from cron routes)
// ============================================================================
export function formatMenuMessage(name: string, options: MenuOption[]): string {
  const lines = options.map(
    (o, i) => `${i + 1}. ${o.name}\n   ${o.prep_notes}\n   _${o.why}_`
  )
  const intro =
    options.length === 5
      ? `Hey ${name} — next week's menu options 🍽️\n\nPick your 3 by replying with the numbers, e.g. "1, 3, 5". Don't love any? Reply "more" for 3 alternatives.\n\n`
      : `Hey ${name} — here are all ${options.length} options 🍽️\n\nPick your 3 by replying with the numbers, e.g. "2, 5, 7".\n\n`
  return intro + lines.join('\n\n')
}

// ============================================================================
// Shopping list — aggregate ingredients across the chosen meals
// ============================================================================
export function buildShoppingList(chosen: MenuOption[]): string {
  // Naive but effective dedupe: lowercase trim, prefer original casing
  const seen = new Map<string, string>()
  for (const opt of chosen) {
    for (const raw of opt.ingredients) {
      const key = raw.trim().toLowerCase()
      if (!key) continue
      if (!seen.has(key)) seen.set(key, raw.trim())
    }
  }

  const items = Array.from(seen.values()).sort((a, b) => a.localeCompare(b))
  const meals = chosen.map((c) => `• ${c.name}`).join('\n')
  const list = items.map((i) => `• ${i}`).join('\n')

  return `🛒 *Shopping list for the week*\n\nMeals:\n${meals}\n\nIngredients (${items.length}):\n${list}\n\nTip: copy/paste into Instacart or your grocery app.`
}

export function formatWorkoutMessage(name: string, plan: WorkoutDay[]): string {
  const lines = plan.map((d) => {
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
    return `${tag} *${d.day}* (${d.target_minutes} min) — ${d.description}`
  })
  return `Morning ${name} — here's the week 🗓️\n\n${lines.join('\n')}`
}

// ============================================================================
// Monday recap — pure formatter (data assembled by the route)
// ============================================================================
export interface RecapInput {
  name: string
  weekStart: string                  // YYYY-MM-DD
  weekEnd: string                    // YYYY-MM-DD inclusive
  workoutsPlanned: number
  workoutsLogged: number
  fishMealsLogged: number
  daysWithSleepResponse: number
  windDownConfirmedNights: number
  totalDays: number                  // typically 7
}

export function buildWeeklyRecap(r: RecapInput): string {
  const workoutPct =
    r.workoutsPlanned > 0
      ? Math.round((r.workoutsLogged / r.workoutsPlanned) * 100)
      : null

  const lines: string[] = []
  lines.push(`Morning ${r.name} — last week's recap (${r.weekStart} → ${r.weekEnd}):\n`)

  if (workoutPct !== null) {
    lines.push(
      `💪 Workouts: ${r.workoutsLogged} of ${r.workoutsPlanned} planned (${workoutPct}%)`
    )
  } else {
    lines.push(`💪 Workouts logged: ${r.workoutsLogged}`)
  }

  lines.push(`🐟 Fish meals: ${r.fishMealsLogged} (target 2+ for ApoB)`)
  lines.push(
    `😴 Sleep replies: ${r.daysWithSleepResponse} of ${r.totalDays} mornings`
  )
  lines.push(
    `🌙 Wind-down by 10 PM: ${r.windDownConfirmedNights} of ${r.totalDays} nights`
  )

  // A short closing line based on how the week went
  const score =
    (workoutPct ?? 0) * 0.4 +
    Math.min(r.fishMealsLogged / 2, 1) * 100 * 0.2 +
    (r.daysWithSleepResponse / r.totalDays) * 100 * 0.2 +
    (r.windDownConfirmedNights / r.totalDays) * 100 * 0.2

  let closing = ''
  if (score >= 75) closing = '\nStrong week. Keep this pace.'
  else if (score >= 50) closing = '\nDecent week. Two small wins to chase this week.'
  else closing = '\nReset week. Pick the easiest box and just hit that one.'

  return lines.join('\n') + closing
}
