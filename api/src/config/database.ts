import { Pool, PoolClient } from 'pg'
import config from './env'

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
        input_example TEXT NOT NULL,
        output_example TEXT NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        interviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        interviewee_id UUID REFERENCES users(id) ON DELETE SET NULL,
        current_challenge_id INTEGER REFERENCES challenges(id) ON DELETE CASCADE,
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

      -- Add missing columns to sessions table if they don't exist
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_code VARCHAR(20);
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS interviewee_accepted BOOLEAN DEFAULT false;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS interviewee_requested_at TIMESTAMP;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

      -- Add language column if it doesn't exist
      ALTER TABLE session_challenge_content ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT 'python';

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
      systemUserResult = await query(
        `INSERT INTO users (email, password_hash, role, name) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        ['system@sourcerank.com', 'system', 'interviewer', 'System']
      )
      systemUserId = systemUserResult.rows[0].id
    } else {
      systemUserId = systemUserResult.rows[0].id
    }

    const challenges = [
      {
        title: 'FizzBuzz',
        description: 'Write a program that prints numbers from 1 to 100. For multiples of 3, print "Fizz" instead of the number. For multiples of 5, print "Buzz". For multiples of both, print "FizzBuzz".',
        difficulty: 'basic',
        input_example: 'n/a (no input)',
        output_example: '1\n2\nFizz\n4\nBuzz\n...\n15 (FizzBuzz)\n...'
      },
      {
        title: 'Two Sum',
        description: 'Given an array of integers nums and an integer target, return the indices of the two numbers that add up to the target. You may assume each input has exactly one solution, and you cannot use the same element twice.',
        difficulty: 'basic',
        input_example: 'nums = [2, 7, 11, 15], target = 9',
        output_example: '[0, 1]'
      },
      {
        title: 'Reverse String',
        description: 'Write a function that reverses a string. The input string is given as an array of characters s. You must do this by modifying the input array in-place with O(1) extra memory.',
        difficulty: 'basic',
        input_example: 's = ["h","e","l","l","o"]',
        output_example: '["o","l","l","e","h"]'
      },
      {
        title: 'Palindrome Number',
        description: 'Given an integer x, return true if x is a palindrome, and false otherwise. An integer is a palindrome when it reads the same backward as forward.',
        difficulty: 'basic',
        input_example: 'x = 121',
        output_example: 'true'
      },
      {
        title: 'Valid Parentheses',
        description: 'Given a string s containing just the characters "(", ")", "{", "}", "[" and "]", determine if the input string is valid. An input string is valid if: (1) Open brackets must be closed by the same type of brackets, (2) Open brackets must be closed in the correct order.',
        difficulty: 'intermediate',
        input_example: 's = "()[]{}"',
        output_example: 'true'
      },
      {
        title: 'Binary Search',
        description: 'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1. You must write an algorithm with O(log n) runtime complexity.',
        difficulty: 'intermediate',
        input_example: 'nums = [-1,0,3,4,6,10], target = 13',
        output_example: '-1'
      },
      {
        title: 'Longest Substring Without Repeating Characters',
        description: 'Given a string s, find the length of the longest substring without repeating characters.',
        difficulty: 'intermediate',
        input_example: 's = "au"',
        output_example: '2'
      },
      {
        title: 'Merge K Sorted Lists',
        description: 'You are given an array of k linked-lists lists, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list and return it.',
        difficulty: 'advanced',
        input_example: 'lists = [[1,4,5],[1,3,4],[2,6]]',
        output_example: '[1,1,2,1,3,4,4,5,6]'
      },
      {
        title: 'Median of Two Sorted Arrays',
        description: 'Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays. The overall run time complexity should be O(log (m+n)).',
        difficulty: 'advanced',
        input_example: 'nums1 = [1,3], nums2 = [2]',
        output_example: '2.0'
      },
      {
        title: 'Regular Expression Matching',
        description: 'Given an input string s and a pattern p, implement regular expression matching with support for "." and "*" where: "." Matches any single character, "*" Matches zero or more of the preceding element.',
        difficulty: 'advanced',
        input_example: 's = "aa", p = "a"',
        output_example: 'false'
      }
    ]

    for (const challenge of challenges) {
      await query(
        `INSERT INTO challenges (title, description, difficulty, input_example, output_example, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          challenge.title,
          challenge.description,
          challenge.difficulty,
          challenge.input_example,
          challenge.output_example,
          systemUserId
        ]
      )
    }

    console.log(`✅ ${challenges.length} challenges seeded successfully`)
  } catch (error) {
    console.error('Error seeding challenges:', error)
    // Don't throw - seeding is optional
  }
}

export default pool
