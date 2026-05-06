# Life Coach Dashboard Modernization Guide

## Overview
This guide will help you replace your current dashboard with the new modern, aesthetic design while maintaining all your existing functionality.

## What's New

### Design Improvements
- **Modern Typography**: Crimson Pro (serif) for headlines and numbers, DM Sans for body text
- **Enhanced Visual Hierarchy**: Clear section separation with cards, shadows, and spacing
- **Wearable Data Prominence**: Dedicated top card showcasing Oura + Whoop data with coaching notes
- **Tab Navigation**: Split content into Overview, Nutrition, Exercise, and Plan tabs
- **Smooth Animations**: Fade-in effects on cards with staggered delays
- **Mobile-First**: Fully responsive with touch-friendly interactions
- **Color System**: Cyan/blue gradients replacing generic purple, warm accents for important metrics

### Functional Enhancements
- **Better Data Visualization**: Macro nutrients in dedicated cards, clearer meal breakdown
- **Improved Stats Display**: Week summary cards with visual indicators (success/warning states)
- **Organized Content**: Tabbed interface prevents overwhelming single-page scroll
- **Empty States**: Friendly placeholders when no data exists

## Integration Steps

### Step 1: Update your Next.js page component

Replace your current `app/page.tsx` content with:

```typescript
import DashboardClient from './dashboard-client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  // Auth check
  if (searchParams.token !== process.env.CRON_SECRET) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        fontFamily: 'system-ui'
      }}>
        <h1>Access Denied</h1>
        <p>Invalid token</p>
      </div>
    );
  }

  // Fetch all data server-side
  const userId = 1; // Your Telegram user ID
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getMonday(new Date()).toISOString().split('T')[0];
  
  // Get user data
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  // Get today's daily check
  const { data: dailyCheck } = await supabase
    .from('daily_checks')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  // Get today's meals
  const { data: todayMeals } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', today)
    .order('logged_at', { ascending: true });

  // Get today's exercise
  const { data: todayExercise } = await supabase
    .from('exercise_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', today)
    .order('logged_at', { ascending: true });

  // Get week stats
  const { data: weekChecks } = await supabase
    .from('daily_checks')
    .select('*')
    .eq('user_id', userId)
    .gte('date', weekStart)
    .order('date', { ascending: true });

  // Get week food logs
  const { data: weekFood } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', weekStart)
    .order('logged_at', { ascending: false });

  // Get week exercise logs
  const { data: weekExercise } = await supabase
    .from('exercise_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', weekStart);

  // Get current week's menu
  const { data: weekMenu } = await supabase
    .from('weekly_menus')
    .select('*')
    .eq('user_id', userId)
    .gte('week_start', weekStart)
    .single();

  // Get current week's workout plan
  const { data: workoutPlan } = await supabase
    .from('weekly_workout_plans')
    .select('*')
    .eq('user_id', userId)
    .gte('week_start', weekStart)
    .single();

  // Calculate aggregates
  const todayCalories = todayMeals?.reduce((sum, m) => sum + (m.calories || 0), 0) || 0;
  const todayProtein = todayMeals?.reduce((sum, m) => sum + (m.protein || 0), 0) || 0;
  const todayCarbs = todayMeals?.reduce((sum, m) => sum + (m.carbs || 0), 0) || 0;
  const todayFat = todayMeals?.reduce((sum, m) => sum + (m.fat || 0), 0) || 0;

  const weekWorkouts = weekExercise?.length || 0;
  const weekFishMeals = weekFood?.filter(f => f.is_fish).length || 0;
  const weekSleepReplies = weekChecks?.filter(c => c.sleep_response).length || 0;
  const weekWindDown = weekChecks?.filter(c => c.wind_down_confirmed).length || 0;

  // Prepare data object
  const dashboardData = {
    user: {
      name: user?.name || 'Andrew',
      timezone: user?.timezone || 'America/New_York',
    },
    today: {
      date: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      weekOf: new Date(weekStart).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      calories: Math.round(todayCalories),
      protein: Math.round(todayProtein),
      carbs: Math.round(todayCarbs),
      fat: Math.round(todayFat),
      meals: todayMeals?.map(m => ({
        type: m.meal_type,
        calories: m.calories,
        description: m.raw_text || m.ingredients?.join(', '),
      })) || [],
      exercise: todayExercise?.map(e => ({
        type: e.type,
        duration: e.duration,
        description: e.description,
      })) || [],
    },
    thisWeek: {
      workoutsLogged: weekWorkouts,
      fishMeals: weekFishMeals,
      fishTarget: 2,
      sleepReplies: weekSleepReplies,
      windDown: weekWindDown,
      totalDays: 7,
    },
    wearables: {
      oura: dailyCheck?.oura_data || {
        sleep: 0,
        sleepScore: 0,
        readiness: 0,
      },
      whoop: dailyCheck?.whoop_data || {
        sleep: 0,
        performance: 0,
        recovery: 0,
        hrv: 0,
      },
      coaching: dailyCheck?.coaching_note || 'Loading wearable data...',
    },
    weekLog: weekFood?.map(f => ({
      day: new Date(f.logged_at).toLocaleDateString('en-US', { weekday: 'short' }),
      type: f.meal_type,
      calories: f.calories,
      description: f.raw_text || f.ingredients?.join(', '),
    })) || [],
    menu: weekMenu,
    workoutPlan: workoutPlan,
  };

  return <DashboardClient data={dashboardData} />;
}

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}
```

### Step 2: Create the client component

Create `app/dashboard-client.tsx`:

```typescript
'use client';

import { useState } from 'react';

interface DashboardData {
  user: {
    name: string;
    timezone: string;
  };
  today: {
    date: string;
    weekOf: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    meals: Array<{
      type: string;
      calories: number;
      description: string;
    }>;
    exercise: Array<{
      type: string;
      duration: number;
      description: string;
    }>;
  };
  thisWeek: {
    workoutsLogged: number;
    fishMeals: number;
    fishTarget: number;
    sleepReplies: number;
    windDown: number;
    totalDays: number;
  };
  wearables: {
    oura: {
      sleep: number;
      sleepScore: number;
      readiness: number;
    };
    whoop: {
      sleep: number;
      performance: number;
      recovery: number;
      hrv: number;
    };
    coaching: string;
  };
  weekLog: Array<{
    day: string;
    type: string;
    calories: number;
    description: string;
  }>;
  menu?: any;
  workoutPlan?: any;
}

export default function DashboardClient({ data }: { data: DashboardData }) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="dashboard">
      <style jsx>{`
        // [PASTE THE ENTIRE STYLE BLOCK FROM life-coach-dashboard.jsx HERE]
      `}</style>

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="greeting">Hey {data.user.name}</h1>
          <p className="date-info">{data.today.date} · Week of {data.today.weekOf}</p>
        </div>
      </header>

      {/* Wearables Summary */}
      <section className="wearables-card">
        <div className="wearables-content">
          <div className="wearables-grid">
            <div className="wearable-item oura">
              <div className="wearable-label">💍 Oura Ring</div>
              <div className="wearable-stats">
                <div className="stat">
                  <span className="stat-label">Sleep</span>
                  <span className="stat-value">{data.wearables.oura.sleep}h</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Score</span>
                  <span className="stat-value">{data.wearables.oura.sleepScore}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Readiness</span>
                  <span className="stat-value">{data.wearables.oura.readiness}</span>
                </div>
              </div>
            </div>

            <div className="wearable-item whoop">
              <div className="wearable-label">🟢 Whoop</div>
              <div className="wearable-stats">
                <div className="stat">
                  <span className="stat-label">Sleep</span>
                  <span className="stat-value">{data.wearables.whoop.sleep}h</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Recovery</span>
                  <span className="stat-value">{data.wearables.whoop.recovery}%</span>
                </div>
                <div className="stat">
                  <span className="stat-label">HRV</span>
                  <span className="stat-value">{data.wearables.whoop.hrv}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="coaching-note">
            {data.wearables.coaching}
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <nav className="tabs">
        <div className="tabs-list">
          <button
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`tab-button ${activeTab === 'nutrition' ? 'active' : ''}`}
            onClick={() => setActiveTab('nutrition')}
          >
            Nutrition
          </button>
          <button
            className={`tab-button ${activeTab === 'exercise' ? 'active' : ''}`}
            onClick={() => setActiveTab('exercise')}
          >
            Exercise
          </button>
          <button
            className={`tab-button ${activeTab === 'plan' ? 'active' : ''}`}
            onClick={() => setActiveTab('plan')}
          >
            Plan
          </button>
        </div>
      </nav>

      {/* [REST OF THE JSX FROM life-coach-dashboard.jsx] */}

      {/* Footer */}
      <footer className="footer">
        <p>Auto-refresh: reload to update · Crons via cron-job.org</p>
      </footer>
    </div>
  );
}
```

## Additional Enhancements to Consider

### 1. Add Workout Plan Display
When you have workout plan data, update the Plan tab:

```tsx
{activeTab === 'plan' && (
  <>
    <section className="section">
      <h2 className="section-title">Workout Plan</h2>
      {data.workoutPlan ? (
        <div className="week-log">
          {data.workoutPlan.plan.map((day: any, index: number) => (
            <div key={index} className="log-item">
              <div className="log-day">{day.day}</div>
              <div className="log-details">
                <div className="log-meta">
                  {day.type} · {day.minutes} min
                </div>
                <div className="log-description">{day.description}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-text">No plan yet — Sunday 8 AM cron generates this</div>
        </div>
      )}
    </section>
  </>
)}
```

### 2. Add Menu Display
Display the weekly menu when available:

```tsx
<section className="section">
  <h2 className="section-title">This Week's Menu</h2>
  {data.menu ? (
    <div className="meal-list">
      {data.menu.chosen_indices?.map((idx: number) => {
        const option = data.menu.options[idx];
        return (
          <div key={idx} className="meal-card">
            <div className="meal-header">
              <span className="meal-type">{option.title}</span>
            </div>
            <div className="meal-description">
              {option.ingredients.join(', ')}
            </div>
          </div>
        );
      })}
    </div>
  ) : (
    <div className="empty-state">
      <div className="empty-state-icon">🥘</div>
      <div className="empty-state-text">No menu generated yet — Friday 8 AM cron handles this</div>
    </div>
  )}
</section>
```

### 3. Add Auto-Refresh
Add client-side auto-refresh every 5 minutes:

```tsx
'use client';
import { useEffect } from 'react';

export default function DashboardClient({ data }: { data: DashboardData }) {
  useEffect(() => {
    const interval = setInterval(() => {
      window.location.reload();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  // ... rest of component
}
```

### 4. Customization Options
Add theme toggle or customization panel:

```tsx
const [theme, setTheme] = useState<'light' | 'dark'>('light');

// Add dark mode CSS variables
const darkTheme = `
  :root {
    --bg-primary: #0f172a;
    --bg-secondary: #1e293b;
    --bg-tertiary: #334155;
    --text-primary: #f1f5f9;
    --text-secondary: #cbd5e1;
    --text-tertiary: #64748b;
    // ... other dark colors
  }
`;
```

## Deployment

1. Commit your changes:
```bash
git add .
git commit -m "Modernize dashboard with new aesthetic design"
git push
```

2. Vercel will auto-deploy in ~30 seconds

3. Visit your dashboard:
```
https://mylifecoach-sfv.vercel.app/?token=YOUR_CRON_SECRET
```

## Testing Checklist

- [ ] Dashboard loads with proper authentication
- [ ] Wearable data displays correctly (Oura + Whoop)
- [ ] Tab navigation works smoothly
- [ ] Today's nutrition shows accurate macros
- [ ] Meal cards display with correct formatting
- [ ] Week stats calculate properly
- [ ] Mobile responsive design works on phone
- [ ] Empty states show when no data exists
- [ ] Animations play smoothly on page load

## Troubleshooting

**Problem**: Wearable data not showing
**Solution**: Check that your morning cron is properly populating the `oura_data` and `whoop_data` JSONB fields in `daily_checks`

**Problem**: Date formatting issues
**Solution**: Ensure timezone is set correctly in user table and Date objects use proper locale

**Problem**: Styles not applying
**Solution**: Make sure you're using `<style jsx>` not regular `<style>` tags in Next.js

---

Enjoy your new modern dashboard! 🎉
