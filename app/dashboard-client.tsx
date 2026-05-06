'use client'

import { useState, useEffect } from 'react'
import type { OuraData, WhoopData, MenuOption, WorkoutDay, FoodLog, ExerciseLog } from '@/types'

export interface DashboardData {
  user: { name: string; timezone: string }
  today: {
    date: string
    weekOf: string
    calories: number
    protein: number
    carbs: number
    fat: number
    meals: FoodLog[]
    exercise: ExerciseLog[]
  }
  thisWeek: {
    workoutsLogged: number
    workoutsPlanned: number
    fishMeals: number
    sleepReplies: number
    windDown: number
  }
  wearables: {
    oura: OuraData | null
    whoop: WhoopData | null
    coaching: string
  }
  weekFood: FoodLog[]
  menu: { options: MenuOption[]; chosen: number[] | null } | null
  workoutPlan: WorkoutDay[] | null
}

type Tab = 'overview' | 'nutrition' | 'exercise' | 'plan'

export default function DashboardClient({ data }: { data: DashboardData }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const id = setInterval(() => window.location.reload(), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const firstName = data.user.name.split(' ')[0]

  return (
    <div
      style={{ fontFamily: 'var(--font-dm-sans, system-ui)', background: 'var(--bg)', minHeight: '100vh' }}
    >
      {/* Header */}
      <header className="fade-up-1" style={{ padding: '28px 20px 0', maxWidth: 680, margin: '0 auto' }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
          Life Coach
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-crimson, Georgia, serif)',
            fontSize: 36,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '4px 0 4px',
            lineHeight: 1.1,
          }}
        >
          Hey {firstName}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          {data.today.date} · Week of {data.today.weekOf}
        </p>
      </header>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 20px 40px' }}>

        {/* Wearables Card */}
        <div
          className="fade-up-2"
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            borderRadius: 16,
            padding: '20px',
            marginBottom: 16,
            color: 'white',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Oura */}
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 10 }}>
                💍 Oura Ring
              </div>
              {data.wearables.oura ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <WearStat label="Sleep" value={data.wearables.oura.total_sleep_hours != null ? `${data.wearables.oura.total_sleep_hours}h` : '—'} />
                  <WearStat label="Score" value={data.wearables.oura.sleep_score ?? '—'} color={scoreColor(data.wearables.oura.sleep_score)} />
                  <WearStat label="Readiness" value={data.wearables.oura.readiness_score ?? '—'} color={scoreColor(data.wearables.oura.readiness_score)} />
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>No data yet</p>
              )}
            </div>

            {/* Whoop */}
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 10 }}>
                🟢 Whoop
              </div>
              {data.wearables.whoop ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <WearStat label="Sleep" value={data.wearables.whoop.total_sleep_hours != null ? `${data.wearables.whoop.total_sleep_hours}h` : '—'} />
                  <WearStat label="Recovery" value={data.wearables.whoop.recovery != null ? `${data.wearables.whoop.recovery}%` : '—'} color={scoreColor(data.wearables.whoop.recovery)} />
                  <WearStat label="HRV" value={data.wearables.whoop.hrv_ms != null ? `${Math.round(data.wearables.whoop.hrv_ms)}` : '—'} />
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>No data yet</p>
              )}
            </div>
          </div>

          {/* Coaching note */}
          <div
            style={{
              background: 'rgba(8, 145, 178, 0.15)',
              border: '1px solid rgba(8, 145, 178, 0.3)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              color: '#7dd3fc',
              lineHeight: 1.5,
            }}
          >
            {data.wearables.coaching}
          </div>
        </div>

        {/* Tab Nav */}
        <div
          className="fade-up-3"
          style={{
            display: 'flex',
            background: 'white',
            borderRadius: 12,
            padding: 4,
            marginBottom: 16,
            border: '1px solid var(--border)',
            gap: 2,
          }}
        >
          {(['overview', 'nutrition', 'exercise', 'plan'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 9,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
                background: activeTab === tab ? 'var(--accent)' : 'transparent',
                color: activeTab === tab ? 'white' : 'var(--text-secondary)',
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* === OVERVIEW TAB === */}
        {activeTab === 'overview' && (
          <div className="fade-up">
            <Card>
              <SectionLabel>This week</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <StatCard
                  label="Workouts"
                  value={`${data.thisWeek.workoutsLogged}${data.thisWeek.workoutsPlanned ? ` / ${data.thisWeek.workoutsPlanned}` : ''}`}
                  sub={data.thisWeek.workoutsPlanned ? 'planned' : 'logged'}
                  status={data.thisWeek.workoutsLogged >= data.thisWeek.workoutsPlanned && data.thisWeek.workoutsPlanned > 0 ? 'success' : 'neutral'}
                />
                <StatCard
                  label="Fish meals"
                  value={String(data.thisWeek.fishMeals)}
                  sub="target 2+"
                  status={data.thisWeek.fishMeals >= 2 ? 'success' : 'warning'}
                />
                <StatCard
                  label="Sleep replies"
                  value={`${data.thisWeek.sleepReplies} / 7`}
                  sub="mornings"
                  status={data.thisWeek.sleepReplies >= 5 ? 'success' : 'neutral'}
                />
                <StatCard
                  label="Wind-down"
                  value={`${data.thisWeek.windDown} / 7`}
                  sub="by 10 PM"
                  status={data.thisWeek.windDown >= 5 ? 'success' : 'neutral'}
                />
              </div>
            </Card>

            <Card>
              <SectionLabel>Today&apos;s calories</SectionLabel>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                <span style={{ fontFamily: 'var(--font-crimson, Georgia, serif)', fontSize: 48, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {data.today.calories}
                </span>
                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>kcal</span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                <MacroBar label="Protein" value={data.today.protein} unit="g" color="#0891b2" />
                <MacroBar label="Carbs" value={data.today.carbs} unit="g" color="#8b5cf6" />
                <MacroBar label="Fat" value={data.today.fat} unit="g" color="#f59e0b" />
              </div>
            </Card>
          </div>
        )}

        {/* === NUTRITION TAB === */}
        {activeTab === 'nutrition' && (
          <div className="fade-up">
            <Card>
              <SectionLabel>Today&apos;s macros</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
                <MacroCard label="Calories" value={data.today.calories} unit="kcal" />
                <MacroCard label="Protein" value={data.today.protein} unit="g" accent="#0891b2" />
                <MacroCard label="Carbs" value={data.today.carbs} unit="g" accent="#8b5cf6" />
                <MacroCard label="Fat" value={data.today.fat} unit="g" accent="#f59e0b" />
              </div>
            </Card>

            <Card>
              <SectionLabel>Today&apos;s meals ({data.today.meals.length})</SectionLabel>
              {data.today.meals.length === 0 ? (
                <EmptyState icon="🍽️" text="Nothing logged yet today" />
              ) : (
                <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
                  {data.today.meals.map((f) => (
                    <MealRow key={f.id} f={f} tz={data.user.timezone} />
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <SectionLabel>Week food log ({data.weekFood.length})</SectionLabel>
              {data.weekFood.length === 0 ? (
                <EmptyState icon="📋" text="Nothing logged this week yet" />
              ) : (
                <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
                  {[...data.weekFood].reverse().map((f) => (
                    <MealRow key={f.id} f={f} tz={data.user.timezone} showDay />
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        {/* === EXERCISE TAB === */}
        {activeTab === 'exercise' && (
          <div className="fade-up">
            <Card>
              <SectionLabel>Today&apos;s exercise ({data.today.exercise.length})</SectionLabel>
              {data.today.exercise.length === 0 ? (
                <EmptyState icon="🏋️" text="Nothing logged yet today" />
              ) : (
                <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
                  {data.today.exercise.map((e) => (
                    <ExerciseRow key={e.id} e={e} />
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        {/* === PLAN TAB === */}
        {activeTab === 'plan' && (
          <div className="fade-up">
            <Card>
              <SectionLabel>Workout plan</SectionLabel>
              {!data.workoutPlan ? (
                <EmptyState icon="📅" text="No plan yet — Sunday 8 AM cron generates this" />
              ) : (
                <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
                  {data.workoutPlan.map((d) => (
                    <WorkoutRow key={d.day} d={d} />
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <SectionLabel>This week&apos;s menu</SectionLabel>
              {!data.menu ? (
                <EmptyState icon="🥘" text="No menu yet — Friday 8 AM cron handles this" />
              ) : (() => {
                const chosen = data.menu.chosen
                  ? data.menu.chosen.map((i) => data.menu!.options[i]).filter(Boolean)
                  : []
                const display = chosen.length > 0 ? chosen : data.menu.options
                return (
                  <>
                    {chosen.length === 0 && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>
                        {data.menu.options.length} options sent — pending your pick
                      </p>
                    )}
                    <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
                      {display.map((o, i) => (
                        <MenuRow key={i} o={o} index={chosen.length === 0 ? i + 1 : undefined} />
                      ))}
                    </ul>
                  </>
                )
              })()}
            </Card>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 24 }}>
          Auto-refresh every 5 min · Crons via cron-job.org
        </p>
      </div>
    </div>
  )
}

// ─── Small presentational components ────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {children}
    </section>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
      {children}
    </p>
  )
}

function WearStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: color ?? 'white', fontFamily: 'var(--font-crimson, Georgia, serif)' }}>
        {value}
      </span>
    </div>
  )
}

function StatCard({ label, value, sub, status }: { label: string; value: string; sub?: string; status?: 'success' | 'warning' | 'neutral' }) {
  const accent = status === 'success' ? 'var(--success)' : status === 'warning' ? 'var(--warning)' : 'var(--accent)'
  return (
    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${accent}` }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-crimson, Georgia, serif)', fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1, marginTop: 4 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function MacroCard({ label, value, unit, accent }: { label: string; value: number; unit: string; accent?: string }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-crimson, Georgia, serif)', fontSize: 22, fontWeight: 600, color: accent ?? 'var(--text-primary)', lineHeight: 1.1, marginTop: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{unit}</div>
    </div>
  )
}

function MacroBar({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-crimson, Georgia, serif)', fontSize: 18, fontWeight: 600, color }}>
        {value}<span style={{ fontSize: 11, fontFamily: 'inherit', color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span>
      </div>
    </div>
  )
}

function MealRow({ f, tz, showDay }: { f: FoodLog; tz: string; showDay?: boolean }) {
  const day = showDay
    ? new Date(f.logged_at).toLocaleDateString('en-US', { weekday: 'short', timeZone: tz }) + ' · '
    : ''
  return (
    <li style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
          {day}{f.meal_type} {f.is_fish ? '🐟' : ''}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{f.calories} kcal</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{f.description}</div>
    </li>
  )
}

function ExerciseRow({ e }: { e: ExerciseLog }) {
  const icon = e.exercise_type === 'cardio' ? '🏃' : e.exercise_type === 'sport' ? '⚽' : '💪'
  return (
    <li style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
          {icon} {e.exercise_type}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{e.duration_minutes} min</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{e.description}</div>
    </li>
  )
}

function WorkoutRow({ d }: { d: WorkoutDay }) {
  const icon = d.type === 'strength' ? '💪' : d.type === 'cardio' ? '🏃' : d.type === 'sport' ? '⚽' : d.type === 'active-rest' ? '🚶' : '😌'
  return (
    <li style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
          {icon} {d.day}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.target_minutes} min · {d.type}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{d.description}</div>
    </li>
  )
}

function MenuRow({ o, index }: { o: MenuOption; index?: number }) {
  return (
    <li style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
        {index != null ? `${index}. ` : ''}{o.name}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{o.prep_notes}</div>
      <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 3 }}>{o.ingredients.join(' · ')}</div>
    </li>
  )
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  )
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return 'white'
  if (score >= 80) return '#34d399'
  if (score >= 65) return '#fbbf24'
  return '#f87171'
}
