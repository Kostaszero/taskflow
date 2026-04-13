import { Router, Request, Response, NextFunction } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, created_at FROM users ORDER BY created_at ASC'
    );

    res.json({ users: result.rows });
  } catch (error) {
    next(error);
  }
});

export { router as userRoutes };
