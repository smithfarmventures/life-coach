// One-off script: patch Andrew's food_preferences with wife's iron-deficiency context.
// Run once: node scripts/update-iron-prefs.mjs
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://sedrodwhdkyqulhfwlny.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const { data: users } = await supabase.from('users').select('id').eq('name', 'Andrew').single()
if (!users) { console.error('User not found'); process.exit(1) }

const { data: prefs } = await supabase.from('food_preferences').select('data').eq('user_id', users.id).single()
if (!prefs) { console.error('No food_preferences row found'); process.exit(1) }

const updated = {
  ...prefs.data,
  household_health_notes: `Wife has iron-deficiency anemia — they share all meals. Every dinner must pair a heme-iron source (red meat, dark poultry, fish) OR iron-rich legumes/leafy greens with at least one high-vitamin-C veg (bell peppers, broccoli, Brussels sprouts, tomatoes). Include 1-2 red-meat options per week rotation. Favour iron-boosting veg: spinach, broccoli, Brussels sprouts, bell peppers. Avoid heavy dairy as dominant side (calcium inhibits iron absorption). Highlight iron+vitamin-C benefit in the "why" field where relevant.`,
  goals: [
    ...prefs.data.goals,
    'Support wife\'s iron-deficiency anemia recovery (heme iron + vitamin C pairing every dinner)',
  ],
}

const { error } = await supabase
  .from('food_preferences')
  .update({ data: updated, updated_at: new Date().toISOString() })
  .eq('user_id', users.id)

if (error) { console.error('Update failed:', error); process.exit(1) }
console.log('✓ Food preferences updated with iron/anemia context')
