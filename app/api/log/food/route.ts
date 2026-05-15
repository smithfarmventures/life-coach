import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, upsertDailyCheck, getWeekFoodLogs } from '@/lib/db'
import { parseFood } from '@/lib/ai-parser'
import { createClient } from '@supabase/supabase-js'
import type { FoodLog } from '@/types'

function db() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function authCheck(req: NextRequest): boolean {
  const token = req.headers.get('x-token') ?? new URL(req.url).searchParams.get('token')
  return !!process.env.CRON_SECRET && token === process.env.CRON_SECRET
}

export async function GET(req: NextRequest) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })

  const users = await getAllUsers()
  const user = users.find((u) => u.telegram_chat_id) ?? users[0]
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 404 })

  const logs = await getWeekFoodLogs(user.id, from, to)
  return NextResponse.json({ logs, timezone: user.timezone })
}

export async function POST(req: NextRequest) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { description, meal_type, date } = body as { description: string; meal_type?: string; date?: string }
  if (!description?.trim()) return NextResponse.json({ error: 'description required' }, { status: 400 })

  const users = await getAllUsers()
  const user = users.find((u) => u.telegram_chat_id) ?? users[0]
  if (!user) return NextResponse.json({ error: 'No user found' }, { status: 404 })

  const logDate = date ?? new Date().toLocaleDateString('en-CA', { timeZone: user.timezone })

  const parsed = await parseFood(description)
  const finalMealType: FoodLog['meal_type'] =
    (meal_type as FoodLog['meal_type']) ?? parsed.meal_type

  await db()
    .from('food_logs')
    .insert({
      user_id: user.id,
      meal_type: finalMealType,
      description: parsed.ingredients.join(', '),
      calories: parsed.calories,
      protein_g: parsed.protein_g,
      carbs_g: parsed.carbs_g,
      fat_g: parsed.fat_g,
      is_fish: parsed.is_fish,
      raw_input: description,
      logged_at: `${logDate}T12:00:00`,
    })

  if (finalMealType === 'breakfast' && parsed.protein_g >= 15) {
    await upsertDailyCheck(user.id, logDate, { breakfast_protein: true })
  }
  if (parsed.is_fish) {
    // no daily_check flag for fish — counted from food_logs directly
  }

  return NextResponse.json({
    ok: true,
    date: logDate,
    meal_type: finalMealType,
    calories: parsed.calories,
    protein_g: parsed.protein_g,
    carbs_g: parsed.carbs_g,
    fat_g: parsed.fat_g,
    is_fish: parsed.is_fish,
    description: parsed.ingredients.join(', '),
  })
}
