import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const result = await query(
      `SELECT id, run_name, shift_number, topic, summary,
              new_entities, new_relationships, new_sources,
              threads_opened, threads_progressed, threads_resolved,
              key_findings, created_at
       FROM shift_reports
       ORDER BY shift_number DESC`
    );

    res.json({ shifts: result.rows });
  } catch (err) {
    console.error('Shift list error:', err);
    res.status(500).json({ error: 'Failed to load shifts' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await query('SELECT * FROM shift_reports WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shift report not found' });
    }

    res.json({ shift: result.rows[0] });
  } catch (err) {
    console.error('Shift detail error:', err);
    res.status(500).json({ error: 'Failed to load shift report' });
  }
});

export default router;
