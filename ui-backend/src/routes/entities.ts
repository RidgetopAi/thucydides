import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// GET /api/entities - filtered list
router.get('/', async (req, res) => {
  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (req.query.type) {
      conditions.push(`type = $${idx++}`);
      params.push(req.query.type);
    }
    if (req.query.confidence_min) {
      conditions.push(`confidence >= $${idx++}`);
      params.push(parseFloat(req.query.confidence_min as string));
    }
    if (req.query.confidence_max) {
      conditions.push(`confidence <= $${idx++}`);
      params.push(parseFloat(req.query.confidence_max as string));
    }
    if (req.query.challenged === 'true') {
      conditions.push('challenged = true');
    }
    if (req.query.discovered_by) {
      conditions.push(`discovered_by = $${idx++}`);
      params.push(req.query.discovered_by);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sort = req.query.sort === 'name' ? 'name ASC' :
                 req.query.sort === 'oldest' ? 'created_at ASC' :
                 req.query.sort === 'confidence' ? 'confidence DESC' :
                 'created_at DESC';

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = (page - 1) * limit;

    const [countResult, entitiesResult] = await Promise.all([
      query<{ count: string }>(`SELECT COUNT(*) as count FROM entities ${where}`, params),
      query(
        `SELECT id, type, name, aliases, description, confidence, challenged, challenge_outcome,
                discovered_by, shift_discovered, dispute_status, created_at
         FROM entities ${where}
         ORDER BY ${sort}
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset]
      ),
    ]);

    res.json({
      entities: entitiesResult.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    console.error('Entity list error:', err);
    res.status(500).json({ error: 'Failed to load entities' });
  }
});

// GET /api/entities/:id - detail with relationships + sources
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [entityResult, outRels, inRels, sources] = await Promise.all([
      query('SELECT * FROM entities WHERE id = $1', [id]),

      // outgoing relationships
      query(
        `SELECT r.*, e.name as to_entity_name, e.type as to_entity_type
         FROM relationships r
         JOIN entities e ON e.id = r.to_entity_id
         WHERE r.from_entity_id = $1
         ORDER BY r.confidence DESC`,
        [id]
      ),

      // incoming relationships
      query(
        `SELECT r.*, e.name as from_entity_name, e.type as from_entity_type
         FROM relationships r
         JOIN entities e ON e.id = r.from_entity_id
         WHERE r.to_entity_id = $1
         ORDER BY r.confidence DESC`,
        [id]
      ),

      // sources with claims
      query(
        `SELECT s.id as source_id, s.title, s.url, s.type as source_type, s.author, s.reliability,
                es.claim
         FROM entity_sources es
         JOIN sources s ON s.id = es.source_id
         WHERE es.entity_id = $1
         ORDER BY s.reliability DESC`,
        [id]
      ),
    ]);

    if (entityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    res.json({
      entity: entityResult.rows[0],
      relationships: {
        outgoing: outRels.rows,
        incoming: inRels.rows,
      },
      sources: sources.rows,
    });
  } catch (err) {
    console.error('Entity detail error:', err);
    res.status(500).json({ error: 'Failed to load entity' });
  }
});

export default router;
