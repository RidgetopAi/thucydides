import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) {
      return res.json({ entities: [], sources: [], threads: [] });
    }

    const types = (req.query.types as string || 'entities,sources,threads').split(',');
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const pattern = `%${q}%`;
    const topic = req.query.topic as string | undefined;

    const results: Record<string, unknown[]> = {};

    if (types.includes('entities')) {
      const topicClause = topic ? ' AND topic = $4' : '';
      const params: unknown[] = [pattern, q, limit];
      if (topic) params.push(topic);
      const entities = await query(
        `SELECT id, type, name, aliases, description, confidence, challenged, challenge_outcome, discovered_by
         FROM entities
         WHERE (name ILIKE $1 OR description ILIKE $1 OR $2 = ANY(aliases))${topicClause}
         ORDER BY confidence DESC, name
         LIMIT $3`,
        params
      );
      results.entities = entities.rows;
    }

    if (types.includes('sources')) {
      const topicClause = topic ? ' AND topic = $3' : '';
      const params: unknown[] = [pattern, limit];
      if (topic) params.push(topic);
      const sources = await query(
        `SELECT id, title, type, author, url, reliability, agent
         FROM sources
         WHERE (title ILIKE $1 OR description ILIKE $1 OR author ILIKE $1)${topicClause}
         ORDER BY reliability DESC, title
         LIMIT $2`,
        params
      );
      results.sources = sources.rows;
    }

    if (types.includes('threads')) {
      const topicClause = topic ? ' AND topic = $3' : '';
      const params: unknown[] = [pattern, limit];
      if (topic) params.push(topic);
      const threads = await query(
        `SELECT id, title, description, status, priority, opened_by
         FROM threads
         WHERE (title ILIKE $1 OR description ILIKE $1)${topicClause}
         ORDER BY
           CASE status WHEN 'open' THEN 0 WHEN 'progressed' THEN 1 WHEN 'disputed' THEN 2 ELSE 3 END,
           CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
         LIMIT $2`,
        params
      );
      results.threads = threads.rows;
    }

    res.json(results);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
