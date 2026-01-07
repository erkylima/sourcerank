-- Migration: Create session_challenge_content_history table
-- This table stores the history of content changes per language
-- Used for recovery when switching languages

-- 1. Create the history table with proper schema
CREATE TABLE IF NOT EXISTS session_challenge_content_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  content_type VARCHAR(50) NOT NULL DEFAULT 'code',
  language VARCHAR(50) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create indices for fast lookups
CREATE INDEX IF NOT EXISTS idx_content_history_session 
  ON session_challenge_content_history(session_id);

CREATE INDEX IF NOT EXISTS idx_content_history_challenge 
  ON session_challenge_content_history(challenge_id);

CREATE INDEX IF NOT EXISTS idx_content_history_lookup 
  ON session_challenge_content_history(session_id, challenge_id, content_type, language);

CREATE INDEX IF NOT EXISTS idx_content_history_updated 
  ON session_challenge_content_history(updated_at DESC);

-- 3. Drop old session_language_history if it exists and is not being used
-- (keeping it for now as backup, but the new table is the source of truth)
