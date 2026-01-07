-- Migration: Add Language to Session Content History
-- This allows storing separate code for each language per challenge

-- 1. Remove old unique constraint
ALTER TABLE session_challenge_content 
  DROP CONSTRAINT IF EXISTS unique_session_challenge_content;

-- 2. Add new unique constraint including language
ALTER TABLE session_challenge_content 
  ADD CONSTRAINT unique_session_challenge_content 
  UNIQUE (session_id, challenge_id, content_type, language);

-- 3. Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_session_challenge_language 
  ON session_challenge_content(session_id, challenge_id, content_type, language);

-- 4. Update existing index for better lookup
DROP INDEX IF EXISTS idx_session_challenge_content_lookup;
CREATE INDEX idx_session_challenge_content_lookup 
  ON session_challenge_content(session_id, challenge_id, content_type, language);

-- Note: The 'started' field becomes optional/deprecated since we can infer
-- started status from: content != ''
