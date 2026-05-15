import Anthropic from '@anthropic-ai/sdk'
import type { ParsedFood, ParsedExercise } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ParsedCRMAdd {
  action: 'add_person'
  name: string
  company: string | null
  role: string | null
  relationship_type: string | null
  bio: string | null
  tags: string[]
  warmth: 'hot' | 'warm' | 'cold' | 'dormant'
  how_we_met: string | null
  location: string | null
}

export interface ParsedCRMInteraction {
  action: 'log_interaction'
  person_name: string
  interaction_type: string
  notes: string | null
  topics: string[]
  bio_update: string | null
  implicit_followups: Array<{ description: string; due_date: string | null }>
}

export interface ParsedCRMFollowup {
  action: 'add_followup'
  person_name: string
  description: string
  due_date: string | null
}

export interface ParsedCRMLookup {
  action: 'lookup'
  person_name: string
}

export type ParsedCRM = ParsedCRMAdd | ParsedCRMInteraction | ParsedCRMFollowup | ParsedCRMLookup

const CRM_KEYWORDS = [
  'add contact', 'new contact', 'met ', 'met with', 'just met',
  'talked to', 'spoke to', 'spoke with', 'called ', 'emailed ',
  'follow up with', 'follow-up with', 'reach out to', 'remind me to',
  'need to contact', 'who should i', 'my contacts', 'crm',
  'who is ', 'tell me about ', 'what do i know about',
  'grabbed coffee', 'had lunch', 'had dinner', 'had a call', 'had a meeting',
  'caught up with', 'connected with', 'intro to', 'intro\'d',
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

  const prompt = `You are a zero-friction CRM assistant. Parse this message and return ONLY valid JSON — no prose, no markdown.

Today's date: ${today}
User input: "${userMessage}"

Choose ONE action:

1. Looking someone up ("who is X", "tell me about X") — return:
{"action":"lookup","person_name":"<name>"}

2. Adding a new person — return:
{"action":"add_person","name":"<full name>","company":"<company or null>","role":"<role/title or null>","relationship_type":"<investor|founder|operator|advisor|friend|family|biz-dev|media|other or null>","bio":"<1-2 sentence context summary or null>","tags":["<tag1>"],"warmth":"<hot|warm|cold|dormant — default warm>","how_we_met":"<context or null>","location":"<city or null>"}

3. Logging an interaction (talked to, called, had coffee, grabbed lunch, met with, emailed, caught up) — return:
{"action":"log_interaction","person_name":"<name>","interaction_type":"<email|call|meeting|coffee|lunch|dinner|message|linkedin|event|other>","notes":"<concise summary of what was discussed>","topics":["<topic1>","<topic2>"],"bio_update":"<new fact to remember about this person — job change, fundraising status, key interest — or null>","implicit_followups":[{"description":"<action item or commitment>","due_date":"<YYYY-MM-DD or null>"}]}

Extract ALL commitments from the message as implicit_followups (e.g. "send intro by Friday" → followup with due_date; "reconnect in 2 weeks" → followup with calculated due_date). Empty array if none.

4. Adding a follow-up task — return:
{"action":"add_followup","person_name":"<name>","description":"<what to do>","due_date":"<YYYY-MM-DD or null>"}

If the message mentions an interaction AND follow-ups, choose log_interaction (implicit_followups handles the rest).
If unclear between add_person and log_interaction, choose log_interaction.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
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
