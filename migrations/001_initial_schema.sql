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
  code_example TEXT NOT NULL,
  lang_example VARCHAR(50) NOT NULL DEFAULT 'python',
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

-- Starter code templates
CREATE TABLE IF NOT EXISTS starter_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_starter_code UNIQUE (language);

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
INSERT INTO challenges (title, description, difficulty, input_example, output_example, code_example, lang_example, created_by)
SELECT * FROM (
  VALUES
    ('FizzBuzz', 'Write a program that prints numbers from 1 to 100. For multiples of 3, print "Fizz" instead of the number. For multiples of 5, print "Buzz". For multiples of both, print "FizzBuzz".', 'basic', 'n/a (no input)', '1\n2\nFizz\n4\nBuzz\n...\n15 (FizzBuzz)\n...', 'for i in range(1, 101):\n    if i % 15 == 0:\n        print(\'FizzBuzz\')\n    elif i % 3 == 0:\n        print(\'Fizz\')\n    elif i % 5 == 0:\n        print(\'Buzz\')\n    else:\n        print(i)', 'python', (SELECT id FROM system_user)),
    ('Two Sum', 'Given an array of integers nums and an integer target, return the indices of the two numbers that add up to the target. You may assume each input has exactly one solution, and you cannot use the same element twice.', 'basic', 'nums = [2, 7, 11, 15], target = 9', '[0, 1]', 'def two_sum(nums, target):\n    lookup = {}\n    for i, num in enumerate(nums):\n        if target - num in lookup:\n            return [lookup[target - num], i]\n        lookup[num] = i\nnums = [2, 7, 11, 15]\ntarget = 9\nprint(two_sum(nums, target))', 'python', (SELECT id FROM system_user)),
    ('Reverse String', 'Write a function that reverses a string. The input string is given as an array of characters s. You must do this by modifying the input array in-place with O(1) extra memory.', 'basic', 's = ["h","e","l","l","o"]', '["o","l","l","e","h"]', 's = ["h","e","l","l","o"]\ns.reverse()\nprint(s)', 'python', (SELECT id FROM system_user)),
    ('Palindrome Number', 'Given an integer x, return true if x is a palindrome, and false otherwise. An integer is a palindrome when it reads the same backward as forward.', 'basic', 'x = 121', 'true', 'x = 121\nprint(str(x) == str(x)[::-1])', 'python', (SELECT id FROM system_user)),
    ('Valid Parentheses', 'Given a string s containing just the characters "(", ")", "{", "}", "[" and "]", determine if the input string is valid. An input string is valid if: (1) Open brackets must be closed by the same type of brackets, (2) Open brackets must be closed in the correct order.', 'intermediate', 's = "()[]{}"', 'true', 's = "()[]{}"\nstack = []\npairs = {\')\': \'(\', \'\}\': \'{\', \'\]\': \'[\'}\nfor c in s:\n    if c in pairs.values():\n        stack.append(c)\n    elif c in pairs:\n        if not stack or stack.pop() != pairs[c]:\n            print(False)\n            break\nelse:\n    print(not stack)', 'python', (SELECT id FROM system_user)),
    ('Binary Search', 'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1. You must write an algorithm with O(log n) runtime complexity.', 'intermediate', 'nums = [-1,0,3,4,6,10], target = 13', '-1', 'def binary_search(nums, target):\n    l, r = 0, len(nums) - 1\n    while l <= r:\n        m = (l + r) // 2\n        if nums[m] == target:\n            return m\n        elif nums[m] < target:\n            l = m + 1\n        else:\n            r = m - 1\n    return -1\nnums = [-1,0,3,4,6,10]\ntarget = 13\nprint(binary_search(nums, target))', 'python', (SELECT id FROM system_user)),
    ('Longest Substring Without Repeating Characters', 'Given a string s, find the length of the longest substring without repeating characters.', 'intermediate', 's = "au"', '2', 's = "au"\nseen = {}\nmax_len = start = 0\nfor i, c in enumerate(s):\n    if c in seen and seen[c] >= start:\n        start = seen[c] + 1\n    seen[c] = i\n    max_len = max(max_len, i - start + 1)\nprint(max_len)', 'python', (SELECT id FROM system_user)),
    ('Merge K Sorted Lists', 'You are given an array of k linked-lists lists, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list and return it.', 'advanced', 'lists = [[1,4,5],[1,3,4],[2,6]]', '[1,1,2,1,3,4,4,5,6]', 'import heapq\nlists = [[1,4,5],[1,3,4],[2,6]]\nmerged = list(heapq.merge(*lists))\nprint(merged)', 'python', (SELECT id FROM system_user)),
    ('Median of Two Sorted Arrays', 'Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays. The overall run time complexity should be O(log (m+n)).', 'advanced', 'nums1 = [1,3], nums2 = [2]', '2.0', 'nums1 = [1,3]\nnums2 = [2]\nnums = sorted(nums1 + nums2)\nn = len(nums)\nif n % 2 == 1:\n    print(float(nums[n//2]))\nelse:\n    print((nums[n//2-1] + nums[n//2]) / 2)', 'python', (SELECT id FROM system_user)),
    ('Regular Expression Matching', 'Given an input string s and a pattern p, implement regular expression matching with support for "." and "*" where: "." Matches any single character, "*" Matches zero or more of the preceding element.', 'advanced', 's = "aa", p = "a"', 'false', 'import re\ns = "aa"\np = "a"\nprint(bool(re.fullmatch(p, s)))', 'python', (SELECT id FROM system_user))
) AS t(title, description, difficulty, input_example, output_example, code_example, lang_example, created_by)
WHERE NOT EXISTS (SELECT 1 FROM challenges WHERE title = t.title)
ON CONFLICT DO NOTHING;

-- Insert starter codes for all challenges and languages
INSERT INTO starter_codes (challenge_id, language, content)
SELECT c.id, langs.lang, langs.template
FROM challenges c
CROSS JOIN (
  VALUES
    ('python', E'import json\nimport sys\n\ndef solution(args):\n    return ["result"]\n\nif __name__ == "__main__":\n    args = json.loads(sys.stdin.read())\n    result = solution(args)\n    print(json.dumps(result))'),
    ('javascript', E'const readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin });\nlet input_data = "";\nrl.on("line", (line) => {\n  input_data += line + "\\n";\n});\nrl.on("close", () => {\n  function solution(args) {\n    return ["result"];\n  }\n  const args = JSON.parse(input_data.trim());\n  const result = solution(args);\n  console.log(JSON.stringify(result));\n});'),
    ('typescript', E'import * as readline from "readline";\nconst rl = readline.createInterface({ input: process.stdin });\nlet input_data = "";\nrl.on("line", (line) => {\n  input_data += line + "\\n";\n});\nrl.on("close", () => {\n  function solution(args: any): string[] {\n    return ["result"];\n  }\n  const args = JSON.parse(input_data.trim());\n  const result = solution(args);\n  console.log(JSON.stringify(result));\n});'),
    ('java', E'import java.util.*;\nimport org.json.JSONArray;\nimport org.json.JSONTokener;\n\npublic class Solution {\n  public static List<String> solution(Object args) {\n    return Arrays.asList("result");\n  }\n  public static void main(String[] args) throws Exception {\n    Scanner scanner = new Scanner(System.in);\n    StringBuilder inputBuilder = new StringBuilder();\n    while (scanner.hasNextLine()) {\n      inputBuilder.append(scanner.nextLine()).append("\\n");\n    }\n    scanner.close();\n    String input_data = inputBuilder.toString().trim();\n    Object parsed = new JSONTokener(input_data).nextValue();\n    List<String> result = solution(parsed);\n    System.out.println(new JSONArray(result).toString());\n  }\n}'),
    ('cpp', E'#include <iostream>\n#include <string>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing namespace std;\nusing json = nlohmann::json;\n\nvector<string> solution(json args) {\n  return {"result"};\n}\n\nint main() {\n  string input_data, line;\n  while (getline(cin, line)) {\n    input_data += line + "\\n";\n  }\n  auto args = json::parse(input_data);\n  auto result = solution(args);\n  json result_json = result;\n  cout << result_json.dump() << endl;\n  return 0;\n}'),
    ('go', E'package main\nimport (\n  "bufio"\n  "encoding/json"\n  "fmt"\n  "os"\n  "strings"\n)\nfunc solution(args interface{}) []string {\n  return []string{"result"}\n}\nfunc main() {\n  reader := bufio.NewReader(os.Stdin)\n  var input_data strings.Builder\n  for {\n    line, err := reader.ReadString('\'n\')\n    if err != nil {\n      break\n    }\n    input_data.WriteString(line)\n  }\n  var args interface{}\n  json.Unmarshal([]byte(input_data.String()), &args)\n  result := solution(args)\n  resultJSON, _ := json.Marshal(result)\n  fmt.Println(string(resultJSON))\n}'),
    ('csharp', E'using System;\nusing System.Collections.Generic;\nusing System.Text;\nusing Newtonsoft.Json;\n\npublic class Solution {\n  public static List<string> Solution(dynamic args) {\n    return new List<string> { "result" };\n  }\n  public static void Main() {\n    StringBuilder inputBuilder = new StringBuilder();\n    string line;\n    while ((line = Console.ReadLine()) != null) {\n      inputBuilder.AppendLine(line);\n    }\n    string input_data = inputBuilder.ToString().Trim();\n    dynamic args = JsonConvert.DeserializeObject(input_data);\n    List<string> result = Solution(args);\n    string resultJson = JsonConvert.SerializeObject(result);\n    Console.WriteLine(resultJson);\n  }\n}')
) AS langs(lang, template)
ON CONFLICT (challenge_id, language) DO NOTHING;

-- ============================================================================
-- DONE
-- ============================================================================
-- Database schema and seeds initialized successfully
