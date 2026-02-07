import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (req.query.status) {
      conditions.push(`status = $${idx++}`);
      params.push(req.query.status);
    }
    if (req.query.priority) {
      conditions.push(`priority = $${idx++}`);
      params.push(req.query.priority);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sort = req.query.sort === 'title' ? 'title ASC' :
                 req.query.sort === 'priority' ?
                   `CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END` :
                 'created_at DESC';

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = (page - 1) * limit;

    const [countResult, threadsResult] = await Promise.all([
      query<{ count: string }>(`SELECT COUNT(*) as count FROM threads ${where}`, params),
      query(
        `SELECT id, title, description, status, priority, opened_by, opened_shift, resolved_shift,
                resolution, created_at, updated_at
         FROM threads ${where}
         ORDER BY ${sort}
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset]
      ),
    ]);

    res.json({
      threads: threadsResult.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    console.error('Thread list error:', err);
    res.status(500).json({ error: 'Failed to load threads' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await query('SELECT * FROM threads WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    res.json({ thread: result.rows[0] });
  } catch (err) {
    console.error('Thread detail error:', err);
    res.status(500).json({ error: 'Failed to load thread' });
  }
});

export default router;
