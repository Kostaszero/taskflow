import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';

import { authRoutes } from './routes/auth.js';
import { projectRoutes } from './routes/projects.js';
import { taskRoutes } from './routes/tasks.js';
import { userRoutes } from './routes/users.js';
import { errorHandler } from './middleware/errorHandler.js';
import { verifyToken } from './middleware/auth.js';

const app: Express = express();
const port = Number(process.env.PORT || 3001);

const log = (level: 'info' | 'error', message: string, meta?: Record<string, unknown>) => {
  console.log(
    JSON.stringify({
      level,
      message,
      ...meta,
      timestamp: new Date().toISOString(),
    })
  );
};

// Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  log('info', 'incoming request', { method: req.method, url: req.url });
  next();
});
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// API Routes
app.use('/auth', authRoutes);
app.use('/projects', verifyToken, projectRoutes);
app.use('/tasks', verifyToken, taskRoutes);
app.use('/users', verifyToken, userRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(port, '0.0.0.0', () => {
  log('info', 'API running', { host: '0.0.0.0', port });
});

export default app;
