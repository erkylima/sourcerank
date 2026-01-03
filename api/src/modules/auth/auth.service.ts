import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { query } from '../../config/database'
import config from '../../config/env'
import { User, UserRole } from './auth.types'

export class AuthService {
  async register(email: string, password: string, role: UserRole, name?: string): Promise<{ user: User; token: string }> {
    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email])
    if (existingUser.rows.length > 0) {
      throw new Error('User already exists')
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const password_hash = await bcrypt.hash(password, salt)

    // Create user
    const userId = uuidv4()
    const result = await query(
      'INSERT INTO users (id, email, password_hash, role, name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, email, password_hash, role, name],
    )

    const user = result.rows[0]

    // Generate token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as any,
    )

    return { user, token }
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    // Find user
    const result = await query('SELECT * FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) {
      throw new Error('Invalid credentials')
    }

    const user = result.rows[0]

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    if (!isValidPassword) {
      throw new Error('Invalid credentials')
    }

    // Generate token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as any,
    )

    return { user, token }
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret)
      return decoded
    } catch (error) {
      throw new Error('Invalid token')
    }
  }

  async getUserById(id: string): Promise<User> {
    const result = await query('SELECT * FROM users WHERE id = $1', [id])
    if (result.rows.length === 0) {
      throw new Error('User not found')
    }
    return result.rows[0]
  }
}

export default new AuthService()
