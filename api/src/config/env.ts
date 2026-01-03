import dotenv from 'dotenv'

dotenv.config()

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  database: {
    url: process.env.DATABASE_URL || 'postgresql://sourcerank:sourcerank_dev@localhost:5432/sourcerank',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  runner: {
    url: process.env.RUNNER_URL || 'http://localhost:3001',
  },
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
}

export default config
