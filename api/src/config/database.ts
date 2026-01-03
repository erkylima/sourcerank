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
        interviewer_id UUID NOT NULL REFERENCES users(id),
        interviewee_id UUID NOT NULL REFERENCES users(id),
        current_challenge_id INTEGER REFERENCES challenges(id),
        status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
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

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_challenges_created_by ON challenges(created_by);
      CREATE INDEX IF NOT EXISTS idx_sessions_interviewer ON sessions(interviewer_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_interviewee ON sessions(interviewee_id);
      CREATE INDEX IF NOT EXISTS idx_executions_session ON executions(session_id);
      CREATE INDEX IF NOT EXISTS idx_logs_execution ON logs(execution_id);
    `)
    console.log('✅ Database tables initialized successfully')
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  }
}

export default pool
