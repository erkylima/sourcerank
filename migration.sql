-- Drop all tables if they exist
DROP TABLE IF EXISTS executions CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS challenges CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('interviewer', 'interviewee')),
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Challenges table
CREATE TABLE challenges (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    difficulty VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_challenges_created_by ON challenges(created_by);

-- Sessions table (with new columns for invite system)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interviewee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    current_challenge_id INTEGER REFERENCES challenges(id) ON DELETE SET NULL,
    session_code VARCHAR(8) UNIQUE,
    interviewee_accepted BOOLEAN DEFAULT false,
    interviewee_requested_at TIMESTAMP,
    expires_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'expired')),
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_interviewer ON sessions(interviewer_id);
CREATE INDEX idx_sessions_interviewee ON sessions(interviewee_id);
CREATE INDEX idx_sessions_code ON sessions(session_code);

-- Executions table
CREATE TABLE executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    language VARCHAR(50) NOT NULL,
    code TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    output TEXT,
    error TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_executions_session ON executions(session_id);

-- Insert test users
INSERT INTO users (id, email, password_hash, role, name) VALUES
    ('90c28769-cc1f-4ec0-bb9b-0356f0aae6ae', 'interviewer@test.com', '$2a$06$MS/faSaJEx5i.JgFps9i1O9TMxPKgxOIPNnYog/KlB5W9Owe2QPWq', 'interviewer', 'Interviewer Test'),
    ('0373f831-0a70-4048-b42d-5e030e855425', 'candidate@test.com', '$2a$06$MS/faSaJEx5i.JgFps9i1O9TMxPKgxOIPNnYog/KlB5W9Owe2QPWq', 'interviewee', 'Candidate Test');

-- Insert test challenges
INSERT INTO challenges (title, description, created_by, difficulty) VALUES
    ('Hello World', 'Escreva um programa que imprime "Hello, World!"', '90c28769-cc1f-4ec0-bb9b-0356f0aae6ae', 'easy'),
    ('Fibonacci', 'Implemente a sequência de Fibonacci', '90c28769-cc1f-4ec0-bb9b-0356f0aae6ae', 'medium'),
    ('Prime Numbers', 'Encontre todos os números primos até N', '90c28769-cc1f-4ec0-bb9b-0356f0aae6ae', 'hard');
