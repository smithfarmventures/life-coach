import { NextRequest, NextResponse } from 'next/server'
import {
  getCRMFollowupsDue,
  getCRMOverdueContacts,
  getCRMPeople,
  addCRMPerson,
  logCRMInteraction,
  completeCRMFollowup,
  addCRMFollowup,
  updateCRMPerson,
} from '@/lib/db'

function authCheck(req: NextRequest): boolean {
  const token = req.headers.get('x-token') ?? new URL(req.url).searchParams.get('token')
  return !!process.env.CRON_SECRET && token === process.env.CRON_SECRET
}

export async function GET(req: NextRequest) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [followups, overdue, people] = await Promise.all([
    getCRMFollowupsDue(),
    getCRMOverdueContacts(30),
    getCRMPeople(),
  ])

  return NextResponse.json({ followups, overdue, people })
}

export async function POST(req: NextRequest) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action } = body as { action: string }

  if (action === 'add_person') {
    const { name, company, role, relationship_type, notes } = body
    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const person = await addCRMPerson({ name, company, role, relationship_type, notes })
    return NextResponse.json({ ok: true, person })
  }

  if (action === 'log_interaction') {
    const { person_id, type, notes } = body
    if (!person_id || !type) return NextResponse.json({ error: 'person_id and type required' }, { status: 400 })
    await logCRMInteraction({ person_id, type, notes })
    return NextResponse.json({ ok: true })
  }

  if (action === 'complete_followup') {
    const { followup_id } = body
    if (!followup_id) return NextResponse.json({ error: 'followup_id required' }, { status: 400 })
    await completeCRMFollowup(followup_id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'add_followup') {
    const { person_id, description, due_date } = body
    if (!person_id || !description) return NextResponse.json({ error: 'person_id and description required' }, { status: 400 })
    await addCRMFollowup({ person_id, description, due_date })
    return NextResponse.json({ ok: true })
  }

  if (action === 'update_person') {
    const { person_id, ...updates } = body
    if (!person_id) return NextResponse.json({ error: 'person_id required' }, { status: 400 })
    await updateCRMPerson(person_id, updates)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
