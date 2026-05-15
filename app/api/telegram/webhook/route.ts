import { NextRequest, NextResponse } from 'next/server'
import { sendMessage, type TelegramUpdate } from '@/lib/telegram'
import { detectIntent, parseFood, parseExercise, parseCRM, type ParsedCRMAdd, type ParsedCRMInteraction, type ParsedCRMFollowup } from '@/lib/ai-parser'
import {
  getUserByTelegramId,
  saveFoodLog,
  saveExerciseLog,
  upsertDailyCheck,
  saveSleepResponse,
  setWindDownConfirmed,
  saveMenuChoices,
  getWeeklyMenu,
  getNextWeekStart,
  clearLastCheckin,
  appendMenuOptions,
  getFoodPreferences,
  findCRMPerson,
  addCRMPerson,
  logCRMInteraction,
  addCRMFollowup,
  getCRMFollowupsDue,
  getCRMOverdueContacts,
} from '@/lib/db'
import { buildFoodReply, buildExerciseReply, buildDailySummary } from '@/lib/progress'
import { generateMenuOptions, formatMenuMessage, buildShoppingList } from '@/lib/ai-generators'

// How long after a check-in we treat a reply as "in response to" that check-in.
const CHECKIN_REPLY_WINDOW_HOURS = 4

export async function POST(req: NextRequest) {
  // Verify request is from Telegram
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const update: TelegramUpdate = await req.json()
  const message = update.message
  if (!message?.text) return NextResponse.json({ ok: true })

  const chatId = message.chat.id
  const text = message.text.trim()

  const user = await getUserByTelegramId(chatId)
  if (!user) {
    await sendMessage(chatId, "Hey! You're not set up yet. Contact Andrew to get access.")
    return NextResponse.json({ ok: true })
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: user.timezone })
  const lower = text.toLowerCase().trim()

  // --------------------------------------------------------------------------
  // 1) Check-in-context replies (when the bot just sent a question)
  // --------------------------------------------------------------------------
  const ctx = readCheckinContext(user)

  if (ctx === 'morning') {
    await saveSleepResponse(user.id, today, text)
    await clearLastCheckin(user.id)
    await sendMessage(chatId, 'Logged. Have a good one. ✓')
    return NextResponse.json({ ok: true })
  }

  if (ctx === 'bedtime') {
    const positive = ['yes', 'y', 'done', 'yep', 'yeah', 'ok', 'okay', 'wind down', 'winding down']
    const isPositive = positive.some((p) => lower === p || lower.startsWith(p + ' '))
    await setWindDownConfirmed(user.id, today, isPositive)
    await upsertDailyCheck(user.id, today, { bed_by_1030: isPositive })
    await clearLastCheckin(user.id)
    await sendMessage(chatId, isPositive ? 'Sleep well. 🌙' : 'No worries — log it tomorrow.')
    return NextResponse.json({ ok: true })
  }

  if (ctx === 'friday-menu') {
    const weekStart = getNextWeekStart()
    const menu = await getWeeklyMenu(user.id, weekStart)

    // "more" / "change" — generate 3 additional options and append
    if (lower === 'more' || lower === 'change' || lower === 'others' || lower === 'different') {
      if (!menu) {
        await sendMessage(chatId, "No menu generated yet. Hold tight.")
        return NextResponse.json({ ok: true })
      }
      if (menu.options.length >= 8) {
        await sendMessage(chatId, "I've already given you 8 options — pick 3 of those.")
        return NextResponse.json({ ok: true })
      }
      try {
        const prefs = await getFoodPreferences(user.id)
        if (!prefs) {
          await sendMessage(chatId, "Food preferences aren't set up yet — can't generate more.")
          return NextResponse.json({ ok: true })
        }
        const existingNames = menu.options.map((o) => o.name)
        const more = await generateMenuOptions(prefs, existingNames, 3)
        await appendMenuOptions(user.id, weekStart, more)
        const combined = [...menu.options, ...more]
        await sendMessage(chatId, formatMenuMessage(user.name, combined))
      } catch (e) {
        console.error('more menu error:', e)
        await sendMessage(chatId, "Couldn't generate more options right now — try again later.")
      }
      return NextResponse.json({ ok: true })
    }

    const totalOptions = menu?.options.length ?? 5
    const picks = parseMenuPicks(text, totalOptions)
    if (picks && picks.length === 3) {
      if (menu) {
        // Convert 1-based picks to 0-based indices
        const indices = picks.map((p) => p - 1)
        const valid = indices.every((i) => i >= 0 && i < menu.options.length)
        if (valid) {
          await saveMenuChoices(user.id, weekStart, indices)
          await clearLastCheckin(user.id)
          const chosen = indices.map((i) => menu.options[i])
          const chosenNames = chosen.map((o) => o.name).join(', ')
          await sendMessage(chatId, `Locked in: ${chosenNames}. 🛒 Shopping list incoming…`)
          const shoppingList = buildShoppingList(chosen)
          await sendMessage(chatId, shoppingList)
          return NextResponse.json({ ok: true })
        }
      }
      await sendMessage(chatId, `Hmm — I couldn't match those to this week's options. Try replying with the 3 numbers, like '1, 3, 5' (1-${totalOptions}).`)
      return NextResponse.json({ ok: true })
    }
    await sendMessage(chatId, `Reply with the 3 numbers you want (1-${totalOptions}), e.g. '1, 3, 5'. Or reply 'more' for 3 additional options.`)
    return NextResponse.json({ ok: true })
  }

  // --------------------------------------------------------------------------
  // 2) No active check-in context (or context expired) — fall back to intent
  // --------------------------------------------------------------------------
  // Simple keyword responses
  if (['skip', 'done', 'yes', 'no', 'y', 'n'].includes(lower)) {
    const reply = await handleSimpleResponse(user.id, lower, today)
    await sendMessage(chatId, reply)
    return NextResponse.json({ ok: true })
  }

  const intent = detectIntent(text)

  if (intent === 'food') {
    try {
      const parsed = await parseFood(text)

      // If the user is replying to a lunch or dinner check-in, trust the
      // context over Claude's guess (which often confuses lunch/dinner).
      const mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' =
        ctx === 'lunch' ? 'lunch' : ctx === 'dinner' ? 'dinner' : parsed.meal_type

      await saveFoodLog({
        user_id: user.id,
        meal_type: mealType,
        description: parsed.ingredients.join(', '),
        calories: parsed.calories,
        protein_g: parsed.protein_g,
        carbs_g: parsed.carbs_g,
        fat_g: parsed.fat_g,
        is_fish: parsed.is_fish,
        raw_input: text,
      })

      if (mealType === 'breakfast' && parsed.protein_g >= 15) {
        await upsertDailyCheck(user.id, today, { breakfast_protein: true })
      }

      const reply = await buildFoodReply(
        user.id,
        parsed.calories,
        parsed.protein_g,
        parsed.carbs_g,
        parsed.fat_g,
        parsed.is_fish,
        mealType,
        today
      )
      await sendMessage(chatId, reply)
    } catch {
      await sendMessage(chatId, "Got it! Couldn't parse exactly — try \"2 eggs toast\" or \"salmon rice broccoli\".")
    }
    await clearLastCheckin(user.id)
    return NextResponse.json({ ok: true })
  }

  if (intent === 'exercise') {
    try {
      const parsed = await parseExercise(text)
      await saveExerciseLog({
        user_id: user.id,
        exercise_type: parsed.exercise_type,
        duration_minutes: parsed.duration_minutes,
        description: parsed.description,
        raw_input: text,
      })

      if (parsed.duration_minutes >= 15) {
        await upsertDailyCheck(user.id, today, { workout_done: true })
      }

      const reply = await buildExerciseReply(user.id)
      await sendMessage(chatId, reply)
    } catch {
      await sendMessage(chatId, "Logged your workout! Try \"15 min pushups squats planks\" next time for full details.")
    }
    await clearLastCheckin(user.id)
    return NextResponse.json({ ok: true })
  }

  if (intent === 'crm') {
    // Quick query shortcuts — no parse needed
    if (['crm', 'contacts', 'networking', 'who should i follow up with', 'follow ups', 'followups'].includes(lower)) {
      const reply = await buildCRMSummary()
      await sendMessage(chatId, reply)
      return NextResponse.json({ ok: true })
    }

    try {
      const parsed = await parseCRM(text)
      const reply = await handleCRMAction(parsed)
      await sendMessage(chatId, reply)
    } catch {
      await sendMessage(chatId, 'Got it — try:\n• "Add Sarah Chen, partner at a16z"\n• "Talked to John about Series A"\n• "Follow up with Mike about intro by Friday"')
    }
    return NextResponse.json({ ok: true })
  }

  await sendMessage(chatId, 'Got it! Log food: "2 eggs toast". Log exercise: "15 min pushups". Reply HELP anytime.')
  return NextResponse.json({ ok: true })
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Returns the check-in type if the user last received one within the window;
 * otherwise null. Lunch/dinner are surfaced so the food intent branch can
 * lock the meal_type to the question we just asked (instead of letting the
 * AI re-guess and sometimes flip lunch ↔ dinner).
 */
function readCheckinContext(
  user: { last_checkin_type: string | null; last_checkin_at: string | null }
): 'morning' | 'lunch' | 'dinner' | 'bedtime' | 'friday-menu' | null {
  if (!user.last_checkin_type || !user.last_checkin_at) return null
  const ageHours =
    (Date.now() - new Date(user.last_checkin_at).getTime()) / (1000 * 60 * 60)
  if (ageHours > CHECKIN_REPLY_WINDOW_HOURS) return null

  const t = user.last_checkin_type
  if (
    t === 'morning' ||
    t === 'lunch' ||
    t === 'dinner' ||
    t === 'bedtime' ||
    t === 'friday-menu'
  )
    return t
  return null
}

/** Parse "1, 3, 5" / "1 3 5" / "135" into [1,3,5]. Returns null if not 3 distinct picks. */
function parseMenuPicks(text: string, max: number = 5): number[] | null {
  const numbers = text.match(/\d/g)
  if (!numbers) return null
  const picks = numbers.map(Number).filter((n) => n >= 1 && n <= max)
  const distinct = Array.from(new Set(picks))
  return distinct.length === 3 ? distinct : null
}

async function handleCRMAction(parsed: Awaited<ReturnType<typeof parseCRM>>): Promise<string> {
  if (parsed.action === 'add_person') {
    const p = parsed as ParsedCRMAdd
    const existing = await findCRMPerson(p.name)
    if (existing) {
      return `${existing.name} is already in your contacts${existing.company ? ` (${existing.company})` : ''}. Reply "Talked to ${existing.name} about..." to log an interaction.`
    }
    const person = await addCRMPerson({
      name: p.name,
      company: p.company,
      role: p.role,
      relationship_type: p.relationship_type,
      notes: p.notes,
    })
    const parts = [person.name]
    if (person.role) parts.push(person.role)
    if (person.company) parts.push(`at ${person.company}`)
    return `Added ${parts.join(', ')} to your CRM. ✓\nSay "Follow up with ${person.name} about..." to set a reminder.`
  }

  if (parsed.action === 'log_interaction') {
    const p = parsed as ParsedCRMInteraction
    const person = await findCRMPerson(p.person_name)
    if (!person) {
      return `I don't have ${p.person_name} in your contacts. Say "Add ${p.person_name}, [company]" first.`
    }
    await logCRMInteraction({ person_id: person.id, type: p.interaction_type, notes: p.notes })
    return `Logged: ${p.interaction_type} with ${person.name}${p.notes ? ` — ${p.notes}` : ''}. ✓\nLast contact updated to today.`
  }

  if (parsed.action === 'add_followup') {
    const p = parsed as ParsedCRMFollowup
    const person = await findCRMPerson(p.person_name)
    if (!person) {
      return `I don't have ${p.person_name} in your contacts. Add them first: "Add ${p.person_name}, [company]".`
    }
    await addCRMFollowup({ person_id: person.id, description: p.description, due_date: p.due_date })
    const due = p.due_date ? ` by ${p.due_date}` : ''
    return `Follow-up set: ${p.description} with ${person.name}${due}. ✓`
  }

  return 'Got it!'
}

async function buildCRMSummary(): Promise<string> {
  const [followups, overdue] = await Promise.all([
    getCRMFollowupsDue(),
    getCRMOverdueContacts(30),
  ])

  const lines: string[] = ['*Your People*\n']

  if (followups.length > 0) {
    lines.push('*Follow up:*')
    for (const f of followups) {
      const due = f.due_date ? ` (${f.due_date})` : ''
      const co = f.company ? ` · ${f.company}` : ''
      lines.push(`• ${f.name}${co}${due}: ${f.description}`)
    }
    lines.push('')
  }

  if (overdue.length > 0) {
    lines.push('*Reach out:*')
    for (const c of overdue) {
      const co = c.company ? ` · ${c.company}` : ''
      const when = c.last_contact_date ? `last: ${c.last_contact_date}` : 'never contacted'
      lines.push(`• ${c.name}${co} (${when})`)
    }
    lines.push('')
  }

  if (followups.length === 0 && overdue.length === 0) {
    lines.push("You're all caught up. 🎉")
  }

  return lines.join('\n')
}

async function handleSimpleResponse(
  userId: string,
  response: string,
  today: string
): Promise<string> {
  if (response === 'skip') return 'No worries, skipped!'

  if (['done', 'yes', 'y'].includes(response)) {
    const hour = new Date().getHours()
    if (hour >= 22 || hour < 4) {
      await upsertDailyCheck(userId, today, { bed_by_1030: true })
      const summary = await buildDailySummary(userId, today)
      return `Bed logged ✓\n\n${summary}`
    }
    if (hour >= 20) {
      await upsertDailyCheck(userId, today, { eating_done_by_930: true })
      return 'Kitchen closed! ✓'
    }
    return 'Got it, marked done! ✓'
  }

  return 'Got it!'
}
