import express from 'express';
import cors from 'cors';
import { checkHealth } from './db.js';
import statsRouter from './routes/stats.js';
import searchRouter from './routes/search.js';
import entitiesRouter from './routes/entities.js';
import sourcesRouter from './routes/sources.js';
import threadsRouter from './routes/threads.js';
import shiftsRouter from './routes/shifts.js';
import topicsRouter from './routes/topics.js';

const app = express();
const PORT = parseInt(process.env.PORT || '5002');

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (_req, res) => {
  const dbOk = await checkHealth();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk,
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/stats', statsRouter);
app.use('/api/search', searchRouter);
app.use('/api/entities', entitiesRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/threads', threadsRouter);
app.use('/api/shifts', shiftsRouter);
app.use('/api/topics', topicsRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Thucydides UI backend running on port ${PORT}`);
});
