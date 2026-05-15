import Anthropic from '@anthropic-ai/sdk'
import type { ParsedFood, ParsedExercise } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ParsedCRMAdd {
  action: 'add_person'
  name: string
  company: string | null
  role: string | null
  relationship_type: string | null
  notes: string | null
}

export interface ParsedCRMInteraction {
  action: 'log_interaction'
  person_name: string
  interaction_type: string
  notes: string | null
}

export interface ParsedCRMFollowup {
  action: 'add_followup'
  person_name: string
  description: string
  due_date: string | null
}

export type ParsedCRM = ParsedCRMAdd | ParsedCRMInteraction | ParsedCRMFollowup

const CRM_KEYWORDS = [
  'add contact', 'new contact', 'met ', 'met with', 'just met',
  'talked to', 'spoke to', 'spoke with', 'called ', 'emailed ',
  'follow up with', 'follow-up with', 'reach out to', 'remind me to',
  'need to contact', 'who should i', 'my contacts', 'crm',
]

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

export function detectIntent(message: string): 'food' | 'exercise' | 'crm' | 'simple' {
  const lower = message.toLowerCase()

  const crmScore = CRM_KEYWORDS.filter((kw) => lower.includes(kw)).length
  const foodScore = FOOD_KEYWORDS.filter((kw) => lower.includes(kw)).length
  const exerciseScore = EXERCISE_KEYWORDS.filter((kw) => lower.includes(kw)).length

  if (crmScore > 0 && crmScore >= foodScore && crmScore >= exerciseScore) return 'crm'
  if (exerciseScore > 0 && exerciseScore >= foodScore) return 'exercise'
  if (foodScore > 0) return 'food'
  return 'simple'
}

export async function parseCRM(userMessage: string): Promise<ParsedCRM> {
  const today = new Date().toISOString().split('T')[0]

  const prompt = `You are a CRM assistant. Parse this message and return ONLY valid JSON with no extra text.

Today's date: ${today}
User input: "${userMessage}"

Determine which action this is and return the appropriate structure:

1. Adding a new person — return:
{"action":"add_person","name":"<full name>","company":"<company or null>","role":"<role/title or null>","relationship_type":"<investor|founder|advisor|friend|professional|family|other or null>","notes":"<context or null>"}

2. Logging an interaction (talked to, called, met with, emailed) — return:
{"action":"log_interaction","person_name":"<name>","interaction_type":"<email|call|meeting|message|linkedin|event|other>","notes":"<what was discussed or null>"}

3. Adding a follow-up task — return:
{"action":"add_followup","person_name":"<name>","description":"<what to do>","due_date":"<YYYY-MM-DD or null>"}

Pick the best action. If unclear, default to add_person.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in CRM parse response')

  return JSON.parse(jsonMatch[0]) as ParsedCRM
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
