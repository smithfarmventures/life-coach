import Anthropic from '@anthropic-ai/sdk'
import type { ParsedFood, ParsedExercise } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const FOOD_KEYWORDS = [
  'egg', 'eggs', 'toast', 'oatmeal', 'yogurt', 'salmon', 'chicken', 'rice', 'quinoa',
  'broccoli', 'salad', 'sandwich', 'burger', 'pizza', 'pasta', 'soup', 'steak', 'fish',
  'tuna', 'cod', 'shrimp', 'beef', 'pork', 'turkey', 'avocado', 'banana', 'apple',
  'protein', 'bar', 'shake', 'smoothie', 'coffee', 'lunch', 'dinner', 'breakfast',
  'snack', 'ate', 'eat', 'had', 'meal', 'food', 'leftovers', 'bowl', 'wrap', 'calories',
]

const EXERCISE_KEYWORDS = [
  'workout', 'exercise', 'run', 'jog', 'walk', 'pushup', 'squat', 'plank', 'lunge',
  'gym', 'lift', 'weights', 'cardio', 'bike', 'swim', 'yoga', 'stretch', 'min',
  'minutes', 'sets', 'reps', 'pullup', 'situp', 'crunch', 'burpee', 'hiit', 'training',
]

export function detectIntent(message: string): 'food' | 'exercise' | 'simple' {
  const lower = message.toLowerCase()

  const foodScore = FOOD_KEYWORDS.filter((kw) => lower.includes(kw)).length
  const exerciseScore = EXERCISE_KEYWORDS.filter((kw) => lower.includes(kw)).length

  if (exerciseScore > 0 && exerciseScore >= foodScore) return 'exercise'
  if (foodScore > 0) return 'food'
  return 'simple'
}

export async function parseFood(userMessage: string): Promise<ParsedFood> {
  const prompt = `You are a nutrition analyst. Parse this meal description and return ONLY valid JSON with no extra text.

User input: "${userMessage}"

Return JSON with this exact structure:
{
  "meal_type": "breakfast|lunch|dinner|snack",
  "calories": <number>,
  "protein_g": <number>,
  "carbs_g": <number>,
  "fat_g": <number>,
  "is_fish": <boolean>,
  "ingredients": ["item1", "item2"]
}

Guidelines:
- Infer meal_type from context or time of day if unclear, default to "snack"
- Estimate calories and macros realistically based on typical serving sizes
- Set is_fish to true only for: salmon, cod, tuna, tilapia, halibut, sardines, mackerel, trout, bass, snapper, shrimp, or other seafood
- ingredients should list main food items`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in food parse response')

  return JSON.parse(jsonMatch[0]) as ParsedFood
}

export async function parseExercise(userMessage: string): Promise<ParsedExercise> {
  const prompt = `You are a fitness tracker. Parse this exercise description and return ONLY valid JSON with no extra text.

User input: "${userMessage}"

Return JSON with this exact structure:
{
  "exercise_type": "bodyweight|cardio|sport",
  "duration_minutes": <number>,
  "description": "<brief summary>",
  "exercises": ["exercise1", "exercise2"]
}

Guidelines:
- bodyweight: pushups, squats, planks, lunges, pullups, etc.
- cardio: running, jogging, walking, biking, swimming
- sport: tennis, basketball, soccer, etc.
- If mixed, use the dominant type
- duration_minutes: extract from message or estimate (e.g., "3 sets of exercises" ≈ 15 min)
- exercises: list specific movements mentioned`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in exercise parse response')

  return JSON.parse(jsonMatch[0]) as ParsedExercise
}
