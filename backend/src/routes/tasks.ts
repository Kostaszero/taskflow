import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

// GET /projects/:id/tasks
router.get('/projects/:projectId/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const { status, assignee, page = 1, limit = 20 } = req.query;

    let query = 'SELECT * FROM tasks WHERE project_id = $1';
    const values: any[] = [projectId];
    let paramCount = 2;

    if (status) {
      query += ` AND status = $${paramCount++}`;
      values.push(status);
    }

    if (assignee) {
      query += ` AND assignee_id = $${paramCount++}`;
      values.push(assignee);
    }

    query += ' ORDER BY created_at DESC';

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(limitNum, offset);

    const result = await db.query(query, values);
    res.json({ tasks: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /projects/:id/tasks/:taskId
router.get('/projects/:projectId/tasks/:taskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, taskId } = req.params;

    const projectResult = await db.query(
      'SELECT id, name, description, owner_id FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'project not found' });
    }

    const taskResult = await db.query(
      'SELECT * FROM tasks WHERE id = $1 AND project_id = $2',
      [taskId, projectId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'task not found' });
    }

    const project = projectResult.rows[0] as {
      id: string;
      name: string;
      description: string | null;
      owner_id: string | null;
    };
    const task = taskResult.rows[0] as {
      assignee_id: string | null;
      created_by: string | null;
    };

    const relatedUserIds = [project.owner_id, task.assignee_id, task.created_by].filter(
      (value): value is string => Boolean(value)
    );

    let assignableUsers: Array<{ id: string; name: string; email: string; created_at: string }> = [];
    if (relatedUserIds.length > 0) {
      const usersResult = await db.query(
        'SELECT id, name, email, created_at FROM users WHERE id = ANY($1::uuid[]) ORDER BY name ASC',
        [Array.from(new Set(relatedUserIds))]
      );
      assignableUsers = usersResult.rows;
    }

    return res.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
      },
      task: taskResult.rows[0],
      assignable_users: assignableUsers,
    });
  } catch (error) {
    next(error);
  }
});

// POST /projects/:id/tasks
router.post('/projects/:projectId/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const { title, description, priority, assignee_id, due_date } = req.body;

    if (!req.user?.user_id) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    if (!title) {
      return res.status(400).json({
        error: 'validation failed',
        fields: { title: 'is required' },
      });
    }

    const taskId = uuidv4();
    const now = new Date().toISOString();

    await db.query(
      `INSERT INTO tasks (id, title, description, status, priority, project_id, created_by, assignee_id, due_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [taskId, title, description || null, 'todo', priority || 'medium', projectId, req.user.user_id, assignee_id || null, due_date || null, now, now]
    );

    res.status(201).json({
      id: taskId,
      title,
      description: description || null,
      status: 'todo',
      priority: priority || 'medium',
      project_id: projectId,
      created_by: req.user.user_id,
      assignee_id: assignee_id || null,
      due_date: due_date || null,
      created_at: now,
      updated_at: now,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /tasks/:id
router.patch('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, assignee_id, due_date } = req.body;

    const result = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not found' });
    }

    const updates: string[] = [];
    const values: any[] = [id];
    let paramCount = 2;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
    }
    if (assignee_id !== undefined) {
      updates.push(`assignee_id = $${paramCount++}`);
      values.push(assignee_id);
    }
    if (due_date !== undefined) {
      updates.push(`due_date = $${paramCount++}`);
      values.push(due_date);
    }

    updates.push(`updated_at = $${paramCount++}`);
    values.push(new Date().toISOString());

    if (updates.length === 0) {
      return res.json(result.rows[0]);
    }

    const updateResult = await db.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    res.json(updateResult.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /tasks/:id
router.delete('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT t.id, t.created_by, p.owner_id
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not found' });
    }

    const task = result.rows[0] as { created_by: string; owner_id: string };
    const currentUserId = req.user!.user_id;

    if (task.created_by !== currentUserId && task.owner_id !== currentUserId) {
      return res.status(403).json({ error: 'forbidden' });
    }

    await db.query('DELETE FROM tasks WHERE id = $1', [id]);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { router as taskRoutes };
