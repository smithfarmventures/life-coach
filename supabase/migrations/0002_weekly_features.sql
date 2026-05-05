-- Migration: weekly features (Friday menu, Sunday workout plan, Monday recap)
-- Run this once in the Supabase SQL Editor.

-- ============================================================================
-- 1. Food preferences (one row per user; structured profile from onboarding)
-- ============================================================================
CREATE TABLE IF NOT EXISTS food_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 2. Weekly menu options (5 generated each Friday, 3 chosen by user)
-- ============================================================================
CREATE TABLE IF NOT EXISTS weekly_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,            -- Monday this menu is for
  options JSONB NOT NULL,              -- array of 5 { name, ingredients, prep_notes, why }
  chosen JSONB,                        -- array of 3 zero-based indices, null until user replies
  generated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- ============================================================================
-- 3. Weekly workout plans (generated each Sunday for the week ahead)
-- ============================================================================
CREATE TABLE IF NOT EXISTS weekly_workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,            -- Monday this plan covers
  plan JSONB NOT NULL,                 -- array of 7 { day, type, description, target_minutes }
  generated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- ============================================================================
-- 4. Sleep + bedtime tracking on daily_checks
-- ============================================================================
ALTER TABLE daily_checks
  ADD COLUMN IF NOT EXISTS sleep_response TEXT,
  ADD COLUMN IF NOT EXISTS sleep_hours NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS sleep_quality TEXT,
  ADD COLUMN IF NOT EXISTS wind_down_confirmed BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 5. Webhook context: which check-in did the bot last send?
-- ============================================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_checkin_type TEXT,
  ADD COLUMN IF NOT EXISTS last_checkin_at TIMESTAMP;

-- ============================================================================
-- 6. Seed Andrew's food preferences from his onboarding doc.
--    Re-running is safe (ON CONFLICT updates the row).
-- ============================================================================
INSERT INTO food_preferences (user_id, data, updated_at)
SELECT
  u.id,
  jsonb_build_object(
    'diet_style', 'Mediterranean-leaning, fish-forward, omnivore. Targets lowering ApoB/LDL and raising vitamin D.',
    'goals', jsonb_build_array(
      'Lower ApoB / LDL particles (eat fish 2+ times per week)',
      'Raise vitamin D (outdoor time + fatty fish)',
      'Add 5–10 lbs of muscle via bodyweight work',
      'Protect deep/REM sleep (no late-night eating, no in-bed scrolling)'
    ),
    'weekday_pattern', 'Mon–Thu predictable: protein + 2 veg sides + 1 carb base. 1 stove dish + 2 in the oven. Cook enough so leftovers cover next day''s lunch.',
    'protein_staples', jsonb_build_array(
      'chicken breast', 'ground chicken', 'ground turkey', 'salmon',
      'cod', 'sea bass', 'tuna steak', 'chicken sausage (Trader Joe''s)', 'ribeye (occasional)'
    ),
    'veg_staples', jsonb_build_array(
      'broccoli', 'asparagus', 'roasted tomatoes', 'zucchini',
      'sweet potato', 'carrots', 'spinach', 'arugula'
    ),
    'carb_staples', jsonb_build_array('rice', 'quinoa', 'pasta', 'sweet potato', 'farro'),
    'cuisines', jsonb_build_array('Italian', 'Asian', 'Mexican/Latin', 'American comfort'),
    'treats_allowed', jsonb_build_array(
      'cheeseburger (~monthly)',
      'fried chicken / schnitzel (~weekly weekend)',
      'ice cream (most nights — find lighter swaps where possible)',
      'Chinese takeout (~once a month)'
    ),
    'dislikes', jsonb_build_array(),
    'restrictions', jsonb_build_array(),
    'cooking_constraints', 'Set-it-and-forget-it. 1 stove dish + 2 oven dishes. Defrost-and-go meal prep style. Limited time once baby arrives.',
    'notes', 'Loves sushi (tuna, salmon, yellowtail). Imitation crab is ok-but-not-counted. Eats out Fri/Sat/Sun typically. Snack window 3–3:30 PM. Dinner 7:30–8 PM. Wants foods that are easy to mix-and-match through the week.'
  ),
  NOW()
FROM users u
WHERE u.name = 'Andrew'
ON CONFLICT (user_id) DO UPDATE
  SET data = EXCLUDED.data, updated_at = NOW();
