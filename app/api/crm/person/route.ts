import { NextRequest, NextResponse } from 'next/server'
import { getCRMPersonWithHistory, updateCRMPerson } from '@/lib/db'

function authCheck(req: NextRequest): boolean {
  const token = req.headers.get('x-token') ?? new URL(req.url).searchParams.get('token')
  return !!process.env.CRON_SECRET && token === process.env.CRON_SECRET
}

export async function GET(req: NextRequest) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  const name = new URL(req.url).searchParams.get('name')
  const query = name ?? id
  if (!query) return NextResponse.json({ error: 'id or name required' }, { status: 400 })

  const result = await getCRMPersonWithHistory(query)
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(result)
}

export async function PATCH(req: NextRequest) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await updateCRMPerson(id, updates)
  return NextResponse.json({ ok: true })
}
