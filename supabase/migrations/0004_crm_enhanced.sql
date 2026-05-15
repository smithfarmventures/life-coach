-- Migration: enhanced CRM fields for zero-friction personal network tracking
-- Run once in the Supabase SQL Editor.

-- ============================================================================
-- 1. Richer contact fields on crm_people
-- ============================================================================
ALTER TABLE crm_people
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS warmth TEXT DEFAULT 'warm'
    CHECK (warmth IN ('hot', 'warm', 'cold', 'dormant')),
  ADD COLUMN IF NOT EXISTS how_we_met TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT;

-- ============================================================================
-- 2. Richer interaction fields on crm_interactions
-- ============================================================================
ALTER TABLE crm_interactions
  ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS action_items TEXT[] DEFAULT '{}';

-- ============================================================================
-- 3. Indexes for lookup performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_crm_people_warmth ON crm_people(warmth);
CREATE INDEX IF NOT EXISTS idx_crm_people_last_contact ON crm_people(last_contact_date ASC NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_person_date ON crm_interactions(person_id, date DESC);
