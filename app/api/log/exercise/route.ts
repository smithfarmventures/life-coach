import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, upsertDailyCheck } from '@/lib/db'
import { parseExercise } from '@/lib/ai-parser'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function authCheck(req: NextRequest): boolean {
  const token = req.headers.get('x-token') ?? new URL(req.url).searchParams.get('token')
  return !!process.env.CRON_SECRET && token === process.env.CRON_SECRET
}

export async function POST(req: NextRequest) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { description, date } = body as { description: string; date?: string }
  if (!description?.trim()) return NextResponse.json({ error: 'description required' }, { status: 400 })

  const users = await getAllUsers()
  const user = users.find((u) => u.telegram_chat_id) ?? users[0]
  if (!user) return NextResponse.json({ error: 'No user found' }, { status: 404 })

  const logDate = date ?? new Date().toLocaleDateString('en-CA', { timeZone: user.timezone })

  const parsed = await parseExercise(description)

  await db()
    .from('exercise_logs')
    .insert({
      user_id: user.id,
      exercise_type: parsed.exercise_type,
      duration_minutes: parsed.duration_minutes,
      description: parsed.description,
      raw_input: description,
      logged_at: `${logDate}T12:00:00`,
    })

  if (parsed.duration_minutes >= 15) {
    await upsertDailyCheck(user.id, logDate, { workout_done: true })
  }

  return NextResponse.json({
    ok: true,
    date: logDate,
    exercise_type: parsed.exercise_type,
    duration_minutes: parsed.duration_minutes,
    description: parsed.description,
  })
}
