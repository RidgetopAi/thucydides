import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const result = await query<{ topic: string }>(
      `SELECT DISTINCT topic FROM entities WHERE topic IS NOT NULL ORDER BY topic`
    );
    res.json({ topics: result.rows.map(r => r.topic) });
  } catch (err) {
    console.error('Topics error:', err);
    res.status(500).json({ error: 'Failed to load topics' });
  }
});

export default router;
