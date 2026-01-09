import { Pool, PoolClient } from 'pg'
import config from './env'
import bcrypt from 'bcryptjs'

const pool = new Pool({
  connectionString: config.database.url,
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

export const getClient = async (): Promise<PoolClient> => {
  return pool.connect()
}

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params)
}

export const initializeDatabase = async () => {
  try {
    // Create tables
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('interviewer', 'interviewee')),
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS challenges (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        difficulty VARCHAR(50) NOT NULL CHECK (difficulty IN ('basic', 'intermediate', 'advanced')),
        code_example TEXT NOT NULL,
        lang_example VARCHAR(50) NOT NULL DEFAULT 'python',
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS challenges_evaluations (
        id SERIAL PRIMARY KEY,
        challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
        input_example TEXT NOT NULL,
        expected_output TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_challenges_created_by ON challenges(created_by);
      CREATE INDEX IF NOT EXISTS idx_challenge_eval_challenge_id ON challenges_evaluations(challenge_id);

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

      CREATE TABLE IF NOT EXISTS logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        execution_id UUID NOT NULL REFERENCES executions(id),
        message TEXT NOT NULL,
        level VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS session_challenge_content (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES sessions(id),
        challenge_id INTEGER NOT NULL REFERENCES challenges(id),
        content_type VARCHAR(50) NOT NULL DEFAULT 'code',
        language VARCHAR(50) NOT NULL DEFAULT 'python',
        content TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_session_challenge_content UNIQUE (session_id, challenge_id, content_type)
      );

      CREATE INDEX IF NOT EXISTS idx_session_challenge_content_session ON session_challenge_content(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_challenge_content_challenge ON session_challenge_content(challenge_id);
      CREATE INDEX IF NOT EXISTS idx_session_challenge_content_lookup ON session_challenge_content(session_id, challenge_id, content_type);

      -- Content history: stores previous versions when language changes
      CREATE TABLE IF NOT EXISTS session_challenge_content_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
        content_type VARCHAR(50) NOT NULL DEFAULT 'code',
        language VARCHAR(50) NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_content_history_session ON session_challenge_content_history(session_id);
      CREATE INDEX IF NOT EXISTS idx_content_history_challenge ON session_challenge_content_history(challenge_id);
      CREATE INDEX IF NOT EXISTS idx_content_history_lookup ON session_challenge_content_history(session_id, challenge_id, content_type, language);
      CREATE INDEX IF NOT EXISTS idx_content_history_updated ON session_challenge_content_history(updated_at DESC);


      -- Add missing columns to sessions table if they don't exist
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_code VARCHAR(20);
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS interviewee_accepted BOOLEAN DEFAULT false;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS interviewee_requested_at TIMESTAMP;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

      -- Add language column if it doesn't exist
      ALTER TABLE session_challenge_content ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT 'python';
      
      -- Add started column to track if challenge was initiated
      ALTER TABLE session_challenge_content ADD COLUMN IF NOT EXISTS started BOOLEAN DEFAULT false;

      -- Starter code templates para cada linguagem
      CREATE TABLE IF NOT EXISTS starter_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        language VARCHAR(50) NOT NULL UNIQUE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_challenges_created_by ON challenges(created_by);
      CREATE INDEX IF NOT EXISTS idx_sessions_interviewer ON sessions(interviewer_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_interviewee ON sessions(interviewee_id);
      CREATE INDEX IF NOT EXISTS idx_executions_session ON executions(session_id);
      CREATE INDEX IF NOT EXISTS idx_logs_execution ON logs(execution_id);
    `)
    console.log('✅ Database tables initialized successfully')
    
    // Seed default challenges if they don't exist
    await seedChallenges()
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  }
}

const seedChallenges = async () => {
  try {
    // Check if challenges already exist
    const result = await query('SELECT COUNT(*) as count FROM challenges')
    const count = parseInt(result.rows[0].count, 10)
    
    if (count > 0) {
      console.log(`✅ Challenges already seeded (${count} challenges found)`)
      return
    }

    // Get or create system user for challenges
    let systemUserResult = await query(
      `SELECT id FROM users WHERE email = $1`,
      ['system@sourcerank.com']
    )
    
    let systemUserId: string
    if (systemUserResult.rows.length === 0) {
      // Hash password for system user
      const systemPasswordHash = await bcrypt.hash('dev-jwt-secret', await bcrypt.genSalt(10))
      systemUserResult = await query(
        `INSERT INTO users (email, password_hash, role, name) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        ['system@sourcerank.com', systemPasswordHash, 'interviewer', 'System']
      )
      systemUserId = systemUserResult.rows[0].id
    } else {
      systemUserId = systemUserResult.rows[0].id
    }

    // Seed de usuários de teste
    const testUsers = [
      { email: 'interviewer@test.com', role: 'interviewer', name: 'Test Interviewer' },
      { email: 'candidate@test.com', role: 'interviewee', name: 'Test Candidate' }
    ]

    for (const testUser of testUsers) {
      const existingUser = await query(
        `SELECT id FROM users WHERE email = $1`,
        [testUser.email]
      )
      if (existingUser.rows.length === 0) {
        // Hash password
        const passwordHash = await bcrypt.hash('password123', await bcrypt.genSalt(10))
        await query(
          `INSERT INTO users (email, password_hash, role, name) 
           VALUES ($1, $2, $3, $4)`,
          [testUser.email, passwordHash, testUser.role, testUser.name]
        )
        console.log(`✅ Test user created: ${testUser.email} (${testUser.role})`)
      } else {
        console.log(`ℹ️ Test user already exists: ${testUser.email}`)
      }
    }

    const challenges = [
      {
        title: 'FizzBuzz',
        description: 'Write a program that prints numbers from 1 to 100. For multiples of 3, print "Fizz" instead of the number. For multiples of 5, print "Buzz". For multiples of both, print "FizzBuzz".',
        difficulty: 'basic',
        code_example: `def fizzbuzz(n):\n    res = []\n    for i in range(1, n+1):\n        if i % 15 == 0:\n            res.append('FizzBuzz')\n        elif i % 3 == 0:\n            res.append('Fizz')\n        elif i % 5 == 0:\n            res.append('Buzz')\n        else:\n            res.append(str(i))\n    return '\\n'.join(res)\n\nif __name__ == '__main__':\n    n = int(input())\n    print(fizzbuzz(n))`,
        lang_example: 'python'
      },
      {
        title: 'Two Sum',
        description: 'Given an array of integers nums and an integer target, return the indices of the two numbers that add up to the target. You may assume each input has exactly one solution, e não pode usar o mesmo elemento duas vezes.',
        difficulty: 'basic',
        code_example: `def two_sum(nums, target):\n    lookup = {}\n    for i, num in enumerate(nums):\n        if target - num in lookup:\n            return [lookup[target - num], i]\n        lookup[num] = i\n\nif __name__ == '__main__':\n    import ast\n    nums = ast.literal_eval(input())\n    target = int(input())\n    print(two_sum(nums, target))`,
        lang_example: 'python'
      },
      {
        title: 'Reverse String',
        description: 'Write a function that reverses a string. The input string is given as an array of characters s. Você deve modificar o array in-place com O(1) memória extra.',
        difficulty: 'basic',
        code_example: `def reverse_string(s):\n    s.reverse()\n    return s\n\nif __name__ == '__main__':\n    import ast\n    s = ast.literal_eval(input())\n    print(reverse_string(s))`,
        lang_example: 'python'
      },
      {
        title: 'Palindrome Number',
        description: 'Given an integer x, return true if x is a palindrome, and false otherwise. Um inteiro é palíndromo se lê igual para frente e para trás.',
        difficulty: 'basic',
        code_example: `def is_palindrome(x):\n    return str(x) == str(x)[::-1]\n\nif __name__ == '__main__':\n    x = int(input())\n    print(is_palindrome(x))`,
        lang_example: 'python'
      },
      {
        title: 'Valid Parentheses',
        description: 'Given a string s containing just the characters "(", ")", "{", "}", "[" and "]", determine if the input string is valid. Deve fechar corretamente e na ordem.',
        difficulty: 'intermediate',
        code_example: `def is_valid(s):\n    stack = []\n    pairs = {')': '(', '}': '{', ']': '['}\n    for c in s:\n        if c in pairs.values():\n            stack.append(c)\n        elif c in pairs:\n            if not stack or stack.pop() != pairs[c]:\n                return False\n    return not stack\n\nif __name__ == '__main__':\n    s = input()\n    print(is_valid(s))`,
        lang_example: 'python'
      },
      {
        title: 'Binary Search',
        description: 'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. Se existir, retorna o índice, senão -1.',
        difficulty: 'intermediate',
        code_example: `def binary_search(nums, target):\n    l, r = 0, len(nums) - 1\n    while l <= r:\n        m = (l + r) // 2\n        if nums[m] == target:\n            return m\n        elif nums[m] < target:\n            l = m + 1\n        else:\n            r = m - 1\n    return -1\n\nif __name__ == '__main__':\n    import ast\n    nums = ast.literal_eval(input())\n    target = int(input())\n    print(binary_search(nums, target))`,
        lang_example: 'python'
      },
      {
        title: 'Longest Substring Without Repeating Characters',
        description: 'Given a string s, find the length of the longest substring without repeating characters.',
        difficulty: 'intermediate',
        code_example: `def length_of_longest_substring(s):\n    seen = {}\n    max_len = start = 0\n    for i, c in enumerate(s):\n        if c in seen and seen[c] >= start:\n            start = seen[c] + 1\n        seen[c] = i\n        max_len = max(max_len, i - start + 1)\n    return max_len\n\nif __name__ == '__main__':\n    s = input()\n    print(length_of_longest_substring(s))`,
        lang_example: 'python'
      },
      {
        title: 'Merge K Sorted Lists',
        description: 'You are given an array of k linked-lists lists, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list and return it.',
        difficulty: 'advanced',
        code_example: `import heapq\ndef merge_k_lists(lists):\n    return list(heapq.merge(*lists))\n\nif __name__ == '__main__':\n    import ast\n    lists = ast.literal_eval(input())\n    print(merge_k_lists(lists))`,
        lang_example: 'python'
      },
      {
        title: 'Median of Two Sorted Arrays',
        description: 'Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.',
        difficulty: 'advanced',
        code_example: `def find_median(nums1, nums2):\n    nums = sorted(nums1 + nums2)\n    n = len(nums)\n    if n % 2 == 1:\n        return float(nums[n//2])\n    else:\n        return (nums[n//2-1] + nums[n//2]) / 2\n\nif __name__ == '__main__':\n    import ast\n    nums1 = ast.literal_eval(input())\n    nums2 = ast.literal_eval(input())\n    print(find_median(nums1, nums2))`,
        lang_example: 'python'
      },
      {
        title: 'Regular Expression Matching',
        description: 'Given an input string s and a pattern p, implement regular expression matching com suporte a "." e "*".',
        difficulty: 'advanced',
        code_example: `import re\ndef regex_match(s, p):\n    return bool(re.fullmatch(p, s))\n\nif __name__ == '__main__':\n    s = input()\n    p = input()\n    print(regex_match(s, p))`,
        lang_example: 'python'
      }
    ]

    for (const challenge of challenges) {
      // Adiciona lang_example se não existir
      if (!challenge.lang_example) challenge.lang_example = 'python';
      const res = await query(
        `INSERT INTO challenges (title, description, difficulty, code_example, lang_example, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          challenge.title,
          challenge.description,
          challenge.difficulty,
          challenge.code_example,
          challenge.lang_example,
          systemUserId
        ]
      );
      const challengeId = res.rows[0].id;

      // Seeds para challenges_evaluations (múltiplos casos por desafio)
      switch (challenge.title) {
        case 'FizzBuzz':
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '15', '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz', 'Primeiros 15 números']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '5', '1\n2\nFizz\n4\nBuzz', 'Primeiros 5 números']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '1', '1', 'Apenas 1 número']
          );
          break;
        case 'Two Sum':
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '[2, 7, 11, 15, 9]', '[0, 1]', 'Exemplo clássico']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '[3, 2, 4, 6]', '[1, 2]', 'Outro exemplo']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '[3, 3, 6]', '[0, 1]', 'Pares iguais']
          );
          break;
        case 'Reverse String':
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '["h","e","l","l","o"]', '["o","l","l","e","h"]', 'String simples']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '["a","b","c"]', '["c","b","a"]', 'Três letras']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '["x"]', '["x"]', 'Um caractere']
          );
          break;
        case 'Palindrome Number':
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '121', 'True', 'Número palíndromo']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '123', 'False', 'Número não palíndromo']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '1', 'True', 'Palíndromo unitário']
          );
          break;
        case 'Valid Parentheses':
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '()[]{}', 'True', 'Todos válidos']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '(]', 'False', 'Parênteses misturados']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '([)]', 'False', 'Ordem incorreta']
          );
          break;
        case 'Binary Search':
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '[-1, 0, 3, 4, 6, 10, 13]', '-1', 'Busca sem sucesso']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '[-1, 0, 3, 4, 6, 10, 4]', '3', 'Busca com sucesso']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '[1, 2, 3, 4, 5, 1]', '0', 'Busca no início']
          );
          break;
        case 'Longest Substring Without Repeating Characters':
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, 'au', '2', 'Exemplo simples']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, 'abcabcbb', '3', 'Repetição no meio']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, 'bbbbb', '1', 'Todos iguais']
          );
          break;
        case 'Merge K Sorted Lists':
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '[[1,4,5],[1,3,4],[2,6]]', '[1, 1, 2, 3, 4, 4, 5, 6]', 'Merge de listas ordenadas']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '[[1],[2],[3]]', '[1, 2, 3]', 'Listas unitárias']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '[[],[1,2,3],[]]', '[1, 2, 3]', 'Listas com vazias']
          );
          break;
        case 'Median of Two Sorted Arrays':
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '[[1, 3], [2]]', '2.0', 'Mediana de duas listas']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '[[1, 2], [3, 4]]', '2.5', 'Mediana par']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '[[0, 0], [0, 0]]', '0.0', 'Zeros']
          );
          break;
        case 'Regular Expression Matching':
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '["aa", "a"]', 'false', 'Regex simples']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '["aa", "aa"]', 'true', 'Regex igual']
          );
          await query(
            `INSERT INTO challenges_evaluations (challenge_id, input_example, expected_output, description) VALUES ($1, $2, $3, $4)`,
            [challengeId, '["ab", ".*"]', 'true', 'Regex qualquer']
          );
          break;
      }
    }
    // Check if starters already exist
    const starterResult = await query('SELECT COUNT(*) as count FROM starter_codes')
    const starterCount = parseInt(starterResult.rows[0].count, 10)
    if (starterCount > 0) {
      console.log(`✅ Starter codes already seeded (${starterCount} starters found)`)
      return
    }
    // Get all challenges
    const challengesResult = await query('SELECT id FROM challenges ORDER BY id')
    if (challengesResult.rows.length === 0) {
      console.log('⚠️ No challenges found for starter seeding')
      return
    }
    const starterTemplates: { [key: string]: string } = {
  python: `import json
import sys

def solution(args):
    # TODO: Implement your solution here
    # args can be a list, dict, string, int, etc.
    return ["result"]

if __name__ == "__main__":
    args = json.loads(sys.stdin.read())
    result = solution(args)
    print(json.dumps(result))
`,
  javascript: `const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
let input_data = '';
rl.on('line', (line) => {
  input_data += line + '\\n';
});
rl.on('close', () => {
  function solution(args) {
    // TODO: Implement your solution here
    // args can be a list, object, string, number, etc.
    return ["result"];
  }
  const args = JSON.parse(input_data.trim());
  const result = solution(args);
  console.log(JSON.stringify(result));
});
`,
  typescript: `import * as readline from 'readline';
const rl = readline.createInterface({ input: process.stdin });
let input_data = '';
rl.on('line', (line) => {
  input_data += line + '\\n';
});
rl.on('close', () => {
  function solution(args: any): string[] {
    // TODO: Implement your solution here
    // args can be a list, object, string, number, etc.
    return ["result"];
  }
  const args = JSON.parse(input_data.trim());
  const result = solution(args);
  console.log(JSON.stringify(result));
});
`,
  java: `import java.util.*;
import org.json.*;

public class Solution {
  public static List<String> solution(Object args) {
    // TODO: Implement your solution here
    // args can be JSONArray, JSONObject, String, Integer, etc.
    // Validate type before using:
    // if (args instanceof JSONArray) { ... }
    // if (args instanceof JSONObject) { ... }
    // if (args instanceof String) { ... }
    // if (args instanceof Integer || args instanceof Double) { ... }
    return Arrays.asList("result");
  }
  
  public static void main(String[] args) throws Exception {
    Scanner scanner = new Scanner(System.in);
    StringBuilder inputBuilder = new StringBuilder();
    while (scanner.hasNextLine()) {
      inputBuilder.append(scanner.nextLine()).append("\\n");
    }
    scanner.close();
    
    String input_data = inputBuilder.toString().trim();
    Object parsed;
    try {
      parsed = new JSONTokener(input_data).nextValue();
    } catch (JSONException e) {
      parsed = input_data; // Fallback to string
    }
    
    List<String> result = solution(parsed);
    System.out.println(new JSONArray(result).toString());
  }
}
`,
  cpp: `#include <iostream>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>
using namespace std;
using json = nlohmann::json;

vector<string> solution(const json& args) {
  // TODO: Implement your solution here
  // args can be array, object, string, number, etc.
  // Validate type before using:
  // if (args.is_array()) { ... }
  // if (args.is_object()) { ... }
  // if (args.is_string()) { ... }
  // if (args.is_number()) { ... }
  return {"result"};
}

int main() {
  string input_data, line;
  while (getline(cin, line)) {
    input_data += line + "\\n";
  }
  
  try {
    auto args = json::parse(input_data);
    auto result = solution(args);
    json result_json = result;
    cout << result_json.dump() << endl;
  } catch (const exception& e) {
    cerr << "Error: " << e.what() << endl;
    return 1;
  }
  return 0;
}
`,
  go: `package main
import (
  "bufio"
  "encoding/json"
  "fmt"
  "os"
  "strings"
)

func solution(args interface{}) []string {
  // TODO: Implement your solution here
  // args can be []interface{}, map[string]interface{}, string, float64, etc.
  // Type assert before using:
  // if arr, ok := args.([]interface{}); ok { ... }
  // if obj, ok := args.(map[string]interface{}); ok { ... }
  // if str, ok := args.(string); ok { ... }
  // if num, ok := args.(float64); ok { ... }
  return []string{"result"}
}

func main() {
  reader := bufio.NewReader(os.Stdin)
  var input_data strings.Builder
  for {
    line, err := reader.ReadString('\\n')
    if err != nil {
      break
    }
    input_data.WriteString(line)
  }
  
  var args interface{}
  if err := json.Unmarshal([]byte(input_data.String()), &args); err != nil {
    fmt.Fprintf(os.Stderr, "Error: %v\\n", err)
    return
  }
  
  result := solution(args)
  resultJSON, _ := json.Marshal(result)
  fmt.Println(string(resultJSON))
}
`,
  csharp: `using System;
using System.Collections.Generic;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public class Solution {
  public static List<string> Solution(dynamic args) {
    // TODO: Implement your solution here
    // args can be JArray, JObject, string, int, double, etc.
    // Check type before using:
    // if (args is JArray) { ... }
    // if (args is JObject) { ... }
    // if (args is string) { ... }
    // if (args is long || args is double) { ... }
    return new List<string> { "result" };
  }
  
  public static void Main() {
    StringBuilder inputBuilder = new StringBuilder();
    string line;
    while ((line = Console.ReadLine()) != null) {
      inputBuilder.AppendLine(line);
    }
    
    string input_data = inputBuilder.ToString().Trim();
    dynamic args = null;
    try {
      args = JsonConvert.DeserializeObject(input_data);
    } catch (Exception e) {
      Console.Error.WriteLine($"Error: {e.Message}");
      return;
    }
    
    List<string> result = Solution(args);
    string resultJson = JsonConvert.SerializeObject(result);
    Console.WriteLine(resultJson);
  }
}
`
}



    // Insert only one starter code genérico por linguagem (challenge_id = NULL)
    for (const [language, content] of Object.entries(starterTemplates)) {
      await query(
        `INSERT INTO starter_codes (language, content) 
         VALUES ($1, $2)
         ON CONFLICT (language) DO NOTHING`,
        [language, content]
      )
    }

    console.log(`✅ Starter codes seeded successfully`)
  } catch (error) {
    console.error('Error seeding starter codes:', error)
    // Don't throw - seeding is optional
  }
}

export default pool
