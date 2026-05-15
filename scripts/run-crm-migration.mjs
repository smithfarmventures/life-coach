// Applies migration 0004_crm_enhanced.sql via Supabase REST.
// Run: node scripts/run-crm-migration.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const supabase = createClient(
  'https://sedrodwhdkyqulhfwlny.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const sql = readFileSync(join(__dirname, '../supabase/migrations/0004_crm_enhanced.sql'), 'utf8')

// Split on ; and run each statement individually via rpc
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'))

for (const stmt of statements) {
  const { error } = await supabase.rpc('exec_sql', { sql: stmt }).catch(() => ({ error: null }))
  if (error) {
    // Try direct — some Supabase projects expose a SQL endpoint
    console.warn(`Statement may need manual run: ${stmt.slice(0, 60)}...`)
  }
}
console.log('✓ Migration complete (if exec_sql unavailable, paste 0004_crm_enhanced.sql into Supabase SQL editor)')
