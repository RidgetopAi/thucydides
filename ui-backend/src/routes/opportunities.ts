import { Router } from 'express';
import { query } from '../db.js';

const router = Router();
const OPPORTUNITY_MODE = 'opportunity';

type CountRow = { count: string };
type TypeCountRow = { type: string; count: string };
type SourceTypeCountRow = { source_type: string | null; count: string };
type ThreadRow = {
  id: number;
  title: string;
  description: string | null;
  priority: string;
  created_at: string;
};
type ShiftRow = {
  id: number;
  run_name: string;
  shift_number: number;
  topic: string | null;
  summary: string | null;
  key_findings: string | null;
  next_priorities: string | null;
  created_at: string;
};
type EntityRow = {
  id: number;
  type: string;
  name: string;
  description: string | null;
  confidence: number;
  topic: string | null;
  created_at: string;
};

function opportunityFilter(topic?: string): { where: string; params: unknown[] } {
  const params: unknown[] = [OPPORTUNITY_MODE];
  const filters = ['mode = $1'];

  if (topic) {
    params.push(topic);
    filters.push(`topic = $${params.length}`);
  }

  return {
    where: `WHERE ${filters.join(' AND ')}`,
    params,
  };
}

function appendParam(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

// GET /api/opportunities/summary - mode-specific operating snapshot
router.get('/summary', async (req, res) => {
  try {
    const topic = (req.query.topic as string | undefined)?.trim() || undefined;
    const { where, params } = opportunityFilter(topic);

    const openThreadParams = [...params];
    const openStatusParam = appendParam(openThreadParams, 'open');

    const experimentParams = [...params];
    const experimentTypeParam = appendParam(experimentParams, 'experiment');

    const metricParams = [...params];
    const metricTypeParam = appendParam(metricParams, 'metric');

    const signalParams = [...params];
    const signalTypeParam = appendParam(signalParams, 'pain_signal');
    const signalConfidenceParam = appendParam(signalParams, 0.65);

    const [
      entities,
      relationships,
      sources,
      threads,
      shifts,
      entityTypes,
      sourceTypes,
      openThreads,
      recentShifts,
      experiments,
      metrics,
      highConfidenceSignals,
    ] = await Promise.all([
      query<CountRow>(`SELECT COUNT(*) as count FROM entities ${where}`, params),
      query<CountRow>(`SELECT COUNT(*) as count FROM relationships ${where}`, params),
      query<CountRow>(`SELECT COUNT(*) as count FROM sources ${where}`, params),
      query<CountRow>(`SELECT COUNT(*) as count FROM threads ${where}`, params),
      query<CountRow>(`SELECT COUNT(*) as count FROM shift_reports ${where}`, params),
      query<TypeCountRow>(
        `SELECT type, COUNT(*) as count
         FROM entities ${where}
         GROUP BY type
         ORDER BY count DESC, type ASC`,
        params
      ),
      query<SourceTypeCountRow>(
        `SELECT type as source_type, COUNT(*) as count
         FROM sources ${where}
         GROUP BY type
         ORDER BY count DESC, type ASC`,
        params
      ),
      query<ThreadRow>(
        `SELECT id, title, description, priority, created_at
         FROM threads ${where} AND status = ${openStatusParam}
         ORDER BY
           CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
           created_at DESC
         LIMIT 10`,
        openThreadParams
      ),
      query<ShiftRow>(
        `SELECT id, run_name, shift_number, topic, summary, key_findings, next_priorities, created_at
         FROM shift_reports ${where}
         ORDER BY created_at DESC
         LIMIT 5`,
        params
      ),
      query<EntityRow>(
        `SELECT id, type, name, description, confidence, topic, created_at
         FROM entities ${where} AND type = ${experimentTypeParam}
         ORDER BY created_at DESC
         LIMIT 10`,
        experimentParams
      ),
      query<EntityRow>(
        `SELECT id, type, name, description, confidence, topic, created_at
         FROM entities ${where} AND type = ${metricTypeParam}
         ORDER BY confidence DESC, created_at DESC
         LIMIT 10`,
        metricParams
      ),
      query<EntityRow>(
        `SELECT id, type, name, description, confidence, topic, created_at
         FROM entities ${where}
           AND type = ${signalTypeParam}
           AND confidence >= ${signalConfidenceParam}
         ORDER BY confidence DESC, created_at DESC
         LIMIT 10`,
        signalParams
      ),
    ]);

    res.json({
      mode: OPPORTUNITY_MODE,
      topic: topic ?? null,
      generatedAt: new Date().toISOString(),
      totals: {
        entities: parseInt(entities.rows[0].count),
        relationships: parseInt(relationships.rows[0].count),
        sources: parseInt(sources.rows[0].count),
        threads: parseInt(threads.rows[0].count),
        shifts: parseInt(shifts.rows[0].count),
      },
      entityTypes: entityTypes.rows.map((row) => ({
        type: row.type,
        count: parseInt(row.count),
      })),
      sourceTypes: sourceTypes.rows.map((row) => ({
        type: row.source_type ?? 'unknown',
        count: parseInt(row.count),
      })),
      openThreads: openThreads.rows,
      recentShifts: recentShifts.rows,
      experiments: experiments.rows,
      metrics: metrics.rows,
      highConfidenceSignals: highConfidenceSignals.rows,
    });
  } catch (err) {
    console.error('Opportunity summary error:', err);
    res.status(500).json({ error: 'Failed to load opportunity summary' });
  }
});

export default router;
