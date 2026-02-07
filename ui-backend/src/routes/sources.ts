import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (req.query.type) {
      conditions.push(`type = $${idx++}`);
      params.push(req.query.type);
    }
    if (req.query.reliability_min) {
      conditions.push(`reliability >= $${idx++}`);
      params.push(parseFloat(req.query.reliability_min as string));
    }
    if (req.query.agent) {
      conditions.push(`agent = $${idx++}`);
      params.push(req.query.agent);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sort = req.query.sort === 'title' ? 'title ASC' :
                 req.query.sort === 'reliability' ? 'reliability DESC' :
                 'created_at DESC';

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = (page - 1) * limit;

    const [countResult, sourcesResult] = await Promise.all([
      query<{ count: string }>(`SELECT COUNT(*) as count FROM sources ${where}`, params),
      query(
        `SELECT id, title, type, author, url, reliability, agent, publication_date, description, created_at
         FROM sources ${where}
         ORDER BY ${sort}
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset]
      ),
    ]);

    res.json({
      sources: sourcesResult.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    console.error('Source list error:', err);
    res.status(500).json({ error: 'Failed to load sources' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [sourceResult, entitiesResult] = await Promise.all([
      query('SELECT * FROM sources WHERE id = $1', [id]),
      query(
        `SELECT e.id as entity_id, e.name, e.type as entity_type, e.confidence,
                es.claim
         FROM entity_sources es
         JOIN entities e ON e.id = es.entity_id
         WHERE es.source_id = $1
         ORDER BY e.name`,
        [id]
      ),
    ]);

    if (sourceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Source not found' });
    }

    res.json({
      source: sourceResult.rows[0],
      entities: entitiesResult.rows,
    });
  } catch (err) {
    console.error('Source detail error:', err);
    res.status(500).json({ error: 'Failed to load source' });
  }
});

export default router;
