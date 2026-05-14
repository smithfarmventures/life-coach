import { NextRequest, NextResponse } from 'next/server'
import { getCRMFollowupsDue, getCRMOverdueContacts } from '@/lib/db'

function authCheck(req: NextRequest): boolean {
  const token = req.headers.get('x-token') ?? new URL(req.url).searchParams.get('token')
  return !!process.env.CRON_SECRET && token === process.env.CRON_SECRET
}

export async function GET(req: NextRequest) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [followups, overdue] = await Promise.all([
    getCRMFollowupsDue(),
    getCRMOverdueContacts(30),
  ])

  return NextResponse.json({ followups, overdue })
}
