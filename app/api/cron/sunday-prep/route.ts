import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers } from '@/lib/db'
import { sendMessage } from '@/lib/telegram'

// Sunday 10:00 AM ET → 14:00 UTC (EDT) / 15:00 UTC (EST)
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await getAllUsers()
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
  const isWeek1 = weekNumber % 2 === 0

  const week1 = `Morning! Meal prep time 🥗

Week 1 shopping list:
🐟 2 lbs salmon, 1 lb cod
🍗 1.5 lbs chicken breast
🥦 Broccoli, Brussels sprouts, kale, spinach
🍠 Sweet potatoes, carrots
🌾 Quinoa, brown rice
🫒 Olive oil, garlic, lemons

Reply DONE when you finish prep.`

  const week2 = `Morning! Meal prep time 🥗

Week 2 shopping list:
🐟 1.5 lbs salmon, 1 lb tilapia
🍗 2 lbs chicken thighs
🥦 Asparagus, zucchini, spinach, arugula
🥔 Potatoes, butternut squash
🌾 Farro, lentils
🫒 Olive oil, garlic, limes

Reply DONE when you finish prep.`

  await Promise.all(
    users
      .filter((u) => u.telegram_chat_id)
      .map((u) => sendMessage(u.telegram_chat_id!, isWeek1 ? week1 : week2))
  )

  return NextResponse.json({ ok: true, week: isWeek1 ? 1 : 2 })
}
