-- Wearables: Oura + Whoop sleep + recovery snapshots, plus OAuth tokens for Whoop.

-- ----------------------------------------------------------------------------
-- Per-day wearable snapshots stored alongside daily_checks
-- ----------------------------------------------------------------------------
ALTER TABLE daily_checks
  ADD COLUMN IF NOT EXISTS oura_data  JSONB,
  ADD COLUMN IF NOT EXISTS whoop_data JSONB;

-- ----------------------------------------------------------------------------
-- OAuth tokens (Whoop). One row per (user, provider).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oauth_tokens (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,                       -- 'whoop'
  access_token   TEXT NOT NULL,
  refresh_token  TEXT,
  expires_at     TIMESTAMPTZ,
  scope          TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider ON oauth_tokens(provider);
