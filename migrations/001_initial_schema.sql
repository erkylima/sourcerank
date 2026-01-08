-- SourceRank Database Schema v1.0
-- PostgreSQL 16 Migration Script
-- This file contains the complete database schema with seeds

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('interviewer', 'interviewee')),
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  difficulty VARCHAR(50) NOT NULL CHECK (difficulty IN ('basic', 'intermediate', 'advanced')),
  input_example TEXT NOT NULL,
  output_example TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interviewee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  current_challenge_id INTEGER REFERENCES challenges(id) ON DELETE CASCADE,
  preferred_language VARCHAR(50) DEFAULT 'python',
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'expired')),
  session_code VARCHAR(20),
  interviewee_accepted BOOLEAN DEFAULT false,
  interviewee_requested_at TIMESTAMP,
  expires_at TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Executions table
CREATE TABLE IF NOT EXISTS executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  language VARCHAR(50) NOT NULL,
  code TEXT NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'error')),
  output TEXT,
  error TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES executions(id),
  message TEXT NOT NULL,
  level VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Session content table (stores code/notes for each challenge in each session)
CREATE TABLE IF NOT EXISTS session_challenge_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  content_type VARCHAR(50) NOT NULL DEFAULT 'code',
  language VARCHAR(50) NOT NULL DEFAULT 'python',
  content TEXT NOT NULL DEFAULT '',
  started BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_session_challenge_content UNIQUE (session_id, challenge_id, content_type)
);

-- Content history table (stores previous versions when language changes)
CREATE TABLE IF NOT EXISTS session_challenge_content_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  content_type VARCHAR(50) NOT NULL DEFAULT 'code',
  language VARCHAR(50) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Legacy table (kept for backward compatibility)
CREATE TABLE IF NOT EXISTS session_language_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  content_type VARCHAR(50) NOT NULL DEFAULT 'code',
  language VARCHAR(50) NOT NULL,
  source VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Starter code templates
CREATE TABLE IF NOT EXISTS starter_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  language VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_starter_code UNIQUE (challenge_id, language)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Challenges indexes
CREATE INDEX IF NOT EXISTS idx_challenges_created_by ON challenges(created_by);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_interviewer ON sessions(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_interviewee ON sessions(interviewee_id);

-- Session content indexes
CREATE INDEX IF NOT EXISTS idx_session_challenge_content_session ON session_challenge_content(session_id);
CREATE INDEX IF NOT EXISTS idx_session_challenge_content_challenge ON session_challenge_content(challenge_id);
CREATE INDEX IF NOT EXISTS idx_session_challenge_content_lookup ON session_challenge_content(session_id, challenge_id, content_type);

-- Content history indexes
CREATE INDEX IF NOT EXISTS idx_content_history_session ON session_challenge_content_history(session_id);
CREATE INDEX IF NOT EXISTS idx_content_history_challenge ON session_challenge_content_history(challenge_id);
CREATE INDEX IF NOT EXISTS idx_content_history_lookup ON session_challenge_content_history(session_id, challenge_id, content_type, language);
CREATE INDEX IF NOT EXISTS idx_content_history_updated ON session_challenge_content_history(updated_at DESC);

-- Language history indexes
CREATE INDEX IF NOT EXISTS idx_language_history_session ON session_language_history(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_language_history_challenge ON session_language_history(challenge_id, created_at);

-- Starter codes indexes
CREATE INDEX IF NOT EXISTS idx_starter_codes_challenge ON starter_codes(challenge_id);
CREATE INDEX IF NOT EXISTS idx_starter_codes_lookup ON starter_codes(challenge_id, language);

-- Executions indexes
CREATE INDEX IF NOT EXISTS idx_executions_session ON executions(session_id);

-- Logs indexes
CREATE INDEX IF NOT EXISTS idx_logs_execution ON logs(execution_id);

-- ============================================================================
-- SEEDS
-- ============================================================================

-- Create system user for seeding challenges
INSERT INTO users (email, password_hash, role, name) 
VALUES ('system@sourcerank.com', 'system', 'interviewer', 'System')
ON CONFLICT (email) DO NOTHING;

-- Get system user ID for seeding
WITH system_user AS (
  SELECT id FROM users WHERE email = 'system@sourcerank.com' LIMIT 1
)

-- Insert challenges (if not already present)
INSERT INTO challenges (title, description, difficulty, input_example, output_example, created_by)
SELECT * FROM (
  VALUES
    ('FizzBuzz', 'Write a program that prints numbers from 1 to 100. For multiples of 3, print "Fizz" instead of the number. For multiples of 5, print "Buzz". For multiples of both, print "FizzBuzz".', 'basic', 'n/a (no input)', '1\n2\nFizz\n4\nBuzz\n...\n15 (FizzBuzz)\n...', (SELECT id FROM system_user)),
    ('Two Sum', 'Given an array of integers nums and an integer target, return the indices of the two numbers that add up to the target. You may assume each input has exactly one solution, and you cannot use the same element twice.', 'basic', 'nums = [2, 7, 11, 15], target = 9', '[0, 1]', (SELECT id FROM system_user)),
    ('Reverse String', 'Write a function that reverses a string. The input string is given as an array of characters s. You must do this by modifying the input array in-place with O(1) extra memory.', 'basic', 's = ["h","e","l","l","o"]', '["o","l","l","e","h"]', (SELECT id FROM system_user)),
    ('Palindrome Number', 'Given an integer x, return true if x is a palindrome, and false otherwise. An integer is a palindrome when it reads the same backward as forward.', 'basic', 'x = 121', 'true', (SELECT id FROM system_user)),
    ('Valid Parentheses', 'Given a string s containing just the characters "(", ")", "{", "}", "[" and "]", determine if the input string is valid. An input string is valid if: (1) Open brackets must be closed by the same type of brackets, (2) Open brackets must be closed in the correct order.', 'intermediate', 's = "()[]{}"', 'true', (SELECT id FROM system_user)),
    ('Binary Search', 'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1. You must write an algorithm with O(log n) runtime complexity.', 'intermediate', 'nums = [-1,0,3,4,6,10], target = 13', '-1', (SELECT id FROM system_user)),
    ('Longest Substring Without Repeating Characters', 'Given a string s, find the length of the longest substring without repeating characters.', 'intermediate', 's = "au"', '2', (SELECT id FROM system_user)),
    ('Merge K Sorted Lists', 'You are given an array of k linked-lists lists, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list and return it.', 'advanced', 'lists = [[1,4,5],[1,3,4],[2,6]]', '[1,1,2,1,3,4,4,5,6]', (SELECT id FROM system_user)),
    ('Median of Two Sorted Arrays', 'Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays. The overall run time complexity should be O(log (m+n)).', 'advanced', 'nums1 = [1,3], nums2 = [2]', '2.0', (SELECT id FROM system_user)),
    ('Regular Expression Matching', 'Given an input string s and a pattern p, implement regular expression matching with support for "." and "*" where: "." Matches any single character, "*" Matches zero or more of the preceding element.', 'advanced', 's = "aa", p = "a"', 'false', (SELECT id FROM system_user))
) AS t(title, description, difficulty, input_example, output_example, created_by)
WHERE NOT EXISTS (SELECT 1 FROM challenges WHERE title = t.title)
ON CONFLICT DO NOTHING;

-- Insert starter codes for all challenges and languages
INSERT INTO starter_codes (challenge_id, language, content)
SELECT c.id, langs.lang, langs.template
FROM challenges c
CROSS JOIN (
  VALUES
    ('python', E'# Start coding here\ndef solution(args):\n    pass\n\n# Test your solution\nif __name__ == "__main__":\n    result = solution(None)\n    print(result)'),
    ('javascript', E'// Start coding here\nfunction solution(args) {\n  // Your code here\n}\n\n// Test your solution\nconsole.log(solution(null));'),
    ('typescript', E'// Start coding here\nfunction solution(args: any): any {\n  // Your code here\n}\n\n// Test your solution\nconsole.log(solution(null));'),
    ('java', E'public class Solution {\n  public static Object solution(Object args) {\n    // Your code here\n    return null;\n  }\n\n  public static void main(String[] args) {\n    System.out.println(solution(null));\n  }\n}'),
    ('cpp', E'#include <iostream>\nusing namespace std;\n\nvoid solution(void* args) {\n  // Your code here\n}\n\nint main() {\n  solution(nullptr);\n  return 0;\n}'),
    ('go', E'package main\n\nimport "fmt"\n\nfunc solution(args interface{}) interface{} {\n  // Your code here\n  return nil\n}\n\nfunc main() {\n  result := solution(nil)\n  fmt.Println(result)\n}'),
    ('csharp', E'using System;\n\npublic class Solution {\n  public static object Solution(object args) {\n    // Your code here\n    return null;\n  }\n\n  public static void Main() {\n    object result = Solution(null);\n    Console.WriteLine(result);\n  }\n}')
) AS langs(lang, template)
ON CONFLICT (challenge_id, language) DO NOTHING;

-- ============================================================================
-- DONE
-- ============================================================================
-- Database schema and seeds initialized successfully
