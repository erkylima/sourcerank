import { query } from '../../config/database'
import { Challenge, Difficulty } from '../auth/auth.types'

export class ChallengeService {
  async createChallenge(
    title: string,
    description: string,
    difficulty: Difficulty,
    examples: any,
    createdBy: string,
  ): Promise<Challenge> {
    const inputExample = typeof examples === 'string' ? examples : JSON.stringify(examples)
    const result = await query(
      `INSERT INTO challenges (title, description, difficulty, input_example, output_example, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, description, difficulty, inputExample, inputExample, createdBy],
    )
    return result.rows[0]
  }

  async getChallenges(limit: number = 10, offset: number = 0): Promise<{ challenges: Challenge[]; total: number }> {
    const countResult = await query('SELECT COUNT(*) FROM challenges')
    const total = parseInt(countResult.rows[0].count, 10)

    const result = await query(
      `SELECT * FROM challenges ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    )

    return { challenges: result.rows, total }
  }

  async getChallengeById(id: string): Promise<Challenge> {
    const result = await query('SELECT * FROM challenges WHERE id = $1', [id])
    if (result.rows.length === 0) {
      throw new Error('Challenge not found')
    }
    return result.rows[0]
  }

  async updateChallenge(
    id: string,
    title?: string,
    description?: string,
    difficulty?: Difficulty,
    examples?: string,
  ): Promise<Challenge> {
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 1

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`)
      values.push(title)
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`)
      values.push(description)
    }
    if (difficulty !== undefined) {
      updates.push(`difficulty = $${paramCount++}`)
      values.push(difficulty)
    }
    if (examples !== undefined) {
      const inputExample = typeof examples === 'string' ? examples : JSON.stringify(examples)
      updates.push(`input_example = $${paramCount++}`)
      values.push(inputExample)
      updates.push(`output_example = $${paramCount++}`)
      values.push(inputExample)
    }

    if (updates.length === 0) {
      return this.getChallengeById(id)
    }

    values.push(id)
    const query_text = `UPDATE challenges SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`
    const result = await query(query_text, values)

    if (result.rows.length === 0) {
      throw new Error('Challenge not found')
    }

    return result.rows[0]
  }

  async deleteChallenge(id: string): Promise<void> {
    await query('DELETE FROM challenges WHERE id = $1', [id])
  }
}

export default new ChallengeService()
