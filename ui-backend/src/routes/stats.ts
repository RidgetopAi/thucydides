import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [entities, relationships, sources, threads, shifts, entityTypes, confidenceDistribution, threadStatuses] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) as count FROM entities'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM relationships'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM sources'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM threads'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM shift_reports'),
      query<{ type: string; count: string }>('SELECT type, COUNT(*) as count FROM entities GROUP BY type ORDER BY count DESC'),
      query<{ bucket: string; count: string }>(`
        SELECT
          CASE
            WHEN confidence >= 0.8 THEN 'high'
            WHEN confidence >= 0.5 THEN 'medium'
            ELSE 'low'
          END as bucket,
          COUNT(*) as count
        FROM entities GROUP BY bucket ORDER BY bucket
      `),
      query<{ status: string; count: string }>('SELECT status, COUNT(*) as count FROM threads GROUP BY status ORDER BY count DESC'),
    ]);

    const agents = await query<{ discovered_by: string; count: string }>(
      'SELECT discovered_by, COUNT(*) as count FROM entities WHERE discovered_by IS NOT NULL GROUP BY discovered_by ORDER BY count DESC'
    );

    res.json({
      totals: {
        entities: parseInt(entities.rows[0].count),
        relationships: parseInt(relationships.rows[0].count),
        sources: parseInt(sources.rows[0].count),
        threads: parseInt(threads.rows[0].count),
        shifts: parseInt(shifts.rows[0].count),
      },
      entityTypes: entityTypes.rows.map(r => ({ type: r.type, count: parseInt(r.count) })),
      confidenceDistribution: confidenceDistribution.rows.map(r => ({ bucket: r.bucket, count: parseInt(r.count) })),
      threadStatuses: threadStatuses.rows.map(r => ({ status: r.status, count: parseInt(r.count) })),
      agents: agents.rows.map(r => ({ agent: r.discovered_by, count: parseInt(r.count) })),
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

export default router;
