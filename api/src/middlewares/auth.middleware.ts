import { Request, Response, NextFunction } from 'express'
import authService from '../modules/auth/auth.service'

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader?.split(' ')[1]

    if (!token) {
      res.status(401).json({ error: 'No token provided' })
      return
    }

    const decoded = await authService.verifyToken(token)
    ;(req as any).userId = decoded.id
    ;(req as any).userRole = decoded.role
    next()
  } catch (error: any) {
    res.status(403).json({ error: 'Invalid token' })
  }
}

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).userRole
    if (!roles.includes(userRole)) {
      res.status(403).json({ error: 'Insufficient permissions' })
      return
    }
    next()
  }
}
