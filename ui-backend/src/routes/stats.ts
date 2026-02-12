import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const topic = req.query.topic as string | undefined;
    const mode = req.query.mode as string | undefined;
    const filters: string[] = [];
    const params: unknown[] = [];

    if (topic) {
      params.push(topic);
      filters.push(`topic = $${params.length}`);
    }

    if (mode) {
      params.push(mode);
      filters.push(`mode = $${params.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const eWhere = whereClause;
    const rWhere = whereClause;
    const sWhere = whereClause;
    const tWhere = whereClause;
    const srWhere = whereClause;

    const predictionFilters: string[] = ["p.mode = 'polymarket'"];
    const predictionParams: unknown[] = [];
    if (topic) {
      predictionParams.push(topic);
      predictionFilters.push(`p.topic = $${predictionParams.length}`);
    }
    const predictionWhere = `WHERE ${predictionFilters.join(' AND ')}`;

    const [entities, relationships, sources, threads, shifts, entityTypes, confidenceDistribution, threadStatuses] = await Promise.all([
      query<{ count: string }>(`SELECT COUNT(*) as count FROM entities ${eWhere}`, params),
      query<{ count: string }>(`SELECT COUNT(*) as count FROM relationships ${rWhere}`, params),
      query<{ count: string }>(`SELECT COUNT(*) as count FROM sources ${sWhere}`, params),
      query<{ count: string }>(`SELECT COUNT(*) as count FROM threads ${tWhere}`, params),
      query<{ count: string }>(`SELECT COUNT(*) as count FROM shift_reports ${srWhere}`, params),
      query<{ type: string; count: string }>(`SELECT type, COUNT(*) as count FROM entities ${eWhere} GROUP BY type ORDER BY count DESC`, params),
      query<{ bucket: string; count: string }>(`
        SELECT
          CASE
            WHEN confidence >= 0.8 THEN 'high'
            WHEN confidence >= 0.5 THEN 'medium'
            ELSE 'low'
          END as bucket,
          COUNT(*) as count
        FROM entities ${eWhere} GROUP BY bucket ORDER BY bucket
      `, params),
      query<{ status: string; count: string }>(`SELECT status, COUNT(*) as count FROM threads ${tWhere} GROUP BY status ORDER BY count DESC`, params),
    ]);

    const agentFilters = [...filters, 'discovered_by IS NOT NULL'];
    const dbWhere = `WHERE ${agentFilters.join(' AND ')}`;
    const agents = await query<{ discovered_by: string; count: string }>(
      `SELECT discovered_by, COUNT(*) as count FROM entities ${dbWhere} GROUP BY discovered_by ORDER BY count DESC`,
      params
    );

    const [
      portfolioTotals,
      portfolioByStatus,
      exposureByCategory,
      edgeBuckets,
      openPositions,
      realizedPnl,
      unrealizedPnl,
      bankroll,
      watchlist,
      dailyEdges,
      shiftDecisions,
      shiftEdges,
      ruleSummary,
    ] = await Promise.all([
      query<{ open_positions: string; resolved_positions: string; active_exposure: string }>(
        `SELECT
           COALESCE(SUM(CASE WHEN p.status = 'active' THEN p.bet_size ELSE 0 END), 0) AS active_exposure,
           COALESCE(SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END), 0) AS open_positions,
           COALESCE(SUM(CASE WHEN p.status = 'resolved' THEN 1 ELSE 0 END), 0) AS resolved_positions
         FROM predictions p
         ${predictionWhere}`,
        predictionParams
      ),
      query<{ status: string; count: string }>(
        `SELECT p.status, COUNT(*) as count
         FROM predictions p ${predictionWhere}
         GROUP BY p.status
         ORDER BY count DESC`,
        predictionParams
      ),
      query<{ category: string; exposure: string }>(
        `SELECT COALESCE(p.category, 'uncategorized') as category,
                SUM(COALESCE(p.bet_size, 0)) as exposure
         FROM predictions p ${predictionWhere} AND p.status = 'active'
         GROUP BY category
         ORDER BY exposure DESC`,
        predictionParams
      ),
      query<{ bucket: string; count: string }>(
        `SELECT
           CASE
             WHEN p.edge >= 0.15 THEN 'strong'
             WHEN p.edge >= 0.08 THEN 'medium'
             WHEN p.edge >= 0.05 THEN 'thin'
             WHEN p.edge >= 0 THEN 'neutral'
             ELSE 'negative'
           END as bucket,
           COUNT(*) as count
         FROM predictions p ${predictionWhere} AND p.status = 'active'
         GROUP BY bucket
         ORDER BY bucket`,
        predictionParams
      ),
      query<{
        id: number;
        market_id: string;
        question: string;
        category: string | null;
        position_side: string | null;
        bet_size: string | null;
        bet_price: string | null;
        prediction_probability: string;
        market_probability: string | null;
        edge: string | null;
        resolves_at: string | null;
      }>(
        `SELECT
           p.id,
           p.market_id,
           p.question,
           p.category,
           p.position_side,
           p.bet_size,
           p.bet_price,
           p.prediction_probability,
           p.market_probability,
           p.edge,
           p.resolves_at
         FROM predictions p
         ${predictionWhere} AND p.status = 'active'
         ORDER BY p.resolves_at ASC NULLS LAST
         LIMIT 12`,
        predictionParams
      ),
      query<{ realized_pnl: string }>(
        `SELECT COALESCE(SUM(po.profit_loss), 0) as realized_pnl
         FROM prediction_outcomes po
         JOIN predictions p ON p.id = po.prediction_id
         ${predictionWhere}`,
        predictionParams
      ),
      query<{ unrealized_pnl: string }>(
        `SELECT COALESCE(SUM(COALESCE(latest.unrealized_pnl, 0)), 0) as unrealized_pnl
         FROM predictions p
         LEFT JOIN LATERAL (
           SELECT ms.unrealized_pnl
           FROM market_snapshots ms
           WHERE ms.prediction_id = p.id
           ORDER BY ms.created_at DESC
           LIMIT 1
         ) latest ON true
         ${predictionWhere} AND p.status = 'active'`,
        predictionParams
      ),
      query<{ bankroll: string | null }>(
        `SELECT (value::text)::float as bankroll
         FROM trading_config
         WHERE key = 'dry_run_virtual_bankroll'
         LIMIT 1`
      ),
      query<{
        id: number;
        shift_number: number | null;
        created_at: string;
        decision_reasoning: string | null;
        market_slug: string | null;
        question: string | null;
        market_probability: string | null;
        liquidity: string | null;
      }>(
        `SELECT
           id,
           shift_number,
           created_at,
           decision_reasoning,
           input_context->'market'->>'slug' as market_slug,
           input_context->'market'->>'question' as question,
           input_context->'market'->>'probability' as market_probability,
           input_context->'market'->>'liquidity' as liquidity
         FROM reasoning_traces
         WHERE trace_type = 'pre_trade' AND decision = 'watchlist'
         ORDER BY created_at DESC
         LIMIT 10`
      ),
      query<{ day: string; trades: string; edge_avg: string | null; edge_min: string | null; edge_max: string | null }>(
        `SELECT
           DATE(p.predicted_at) as day,
           COUNT(*) as trades,
           AVG(p.edge) as edge_avg,
           MIN(p.edge) as edge_min,
           MAX(p.edge) as edge_max
         FROM predictions p
         ${predictionWhere} AND p.predicted_at >= NOW() - INTERVAL '14 days'
         GROUP BY day
         ORDER BY day ASC`,
        predictionParams
      ),
      query<{ shift_number: number; decisions: string; trades: string; watchlist: string; skips: string }>(
        `SELECT
           shift_number,
           COUNT(*) as decisions,
           COUNT(*) FILTER (WHERE decision = 'trade') as trades,
           COUNT(*) FILTER (WHERE decision = 'watchlist') as watchlist,
           COUNT(*) FILTER (WHERE decision = 'skip') as skips
         FROM reasoning_traces
         WHERE trace_type = 'pre_trade' AND phase = 'decision'
         GROUP BY shift_number
         ORDER BY shift_number DESC
         LIMIT 12`
      ),
      query<{ shift_number: number; trades: string; edge_avg: string | null; edge_min: string | null; edge_max: string | null }>(
        `SELECT
           p.shift_number,
           COUNT(*) as trades,
           AVG(p.edge) as edge_avg,
           MIN(p.edge) as edge_min,
           MAX(p.edge) as edge_max
         FROM predictions p
         ${predictionWhere} AND p.shift_number IS NOT NULL
         GROUP BY p.shift_number
         ORDER BY p.shift_number DESC
         LIMIT 12`,
        predictionParams
      ),
      query<{ id: number; rule_type: string; rule_text: string; confidence: string; times_applied: string; times_successful: string; success_rate: string | null; active: boolean }>(
        `SELECT id, rule_type, rule_text, confidence, times_applied, times_successful, success_rate, active
         FROM strategy_rules
         WHERE active = TRUE
         ORDER BY success_rate DESC NULLS LAST, confidence DESC
         LIMIT 8`
      ),
    ]);

    const shiftStatsMap = new Map<number, {
      shiftNumber: number;
      decisions: number | null;
      trades: number | null;
      watchlist: number | null;
      skips: number | null;
      edgeAvg: number | null;
      edgeMin: number | null;
      edgeMax: number | null;
    }>();

    for (const row of shiftDecisions.rows) {
      if (row.shift_number == null) continue;
      shiftStatsMap.set(row.shift_number, {
        shiftNumber: row.shift_number,
        decisions: parseInt(row.decisions),
        trades: parseInt(row.trades),
        watchlist: parseInt(row.watchlist),
        skips: parseInt(row.skips),
        edgeAvg: null,
        edgeMin: null,
        edgeMax: null,
      });
    }

    for (const row of shiftEdges.rows) {
      if (row.shift_number == null) continue;
      const existing = shiftStatsMap.get(row.shift_number);
      shiftStatsMap.set(row.shift_number, {
        shiftNumber: row.shift_number,
        decisions: existing?.decisions ?? null,
        trades: existing?.trades ?? parseInt(row.trades),
        watchlist: existing?.watchlist ?? null,
        skips: existing?.skips ?? null,
        edgeAvg: row.edge_avg ? parseFloat(row.edge_avg) : null,
        edgeMin: row.edge_min ? parseFloat(row.edge_min) : null,
        edgeMax: row.edge_max ? parseFloat(row.edge_max) : null,
      });
    }

    const shiftStats = Array.from(shiftStatsMap.values())
      .sort((a, b) => b.shiftNumber - a.shiftNumber)
      .slice(0, 12);

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
      trading: {
        totals: {
          openPositions: parseInt(portfolioTotals.rows[0]?.open_positions ?? '0'),
          resolvedPositions: parseInt(portfolioTotals.rows[0]?.resolved_positions ?? '0'),
          activeExposure: parseFloat(portfolioTotals.rows[0]?.active_exposure ?? '0'),
          realizedPnL: parseFloat(realizedPnl.rows[0]?.realized_pnl ?? '0'),
          unrealizedPnL: parseFloat(unrealizedPnl.rows[0]?.unrealized_pnl ?? '0'),
          bankroll: parseFloat(bankroll.rows[0]?.bankroll ?? '0'),
        },
        positionsByStatus: portfolioByStatus.rows.map(r => ({ status: r.status, count: parseInt(r.count) })),
        exposureByCategory: exposureByCategory.rows.map(r => ({ category: r.category, exposure: parseFloat(r.exposure) })),
        edgeBuckets: edgeBuckets.rows.map(r => ({ bucket: r.bucket, count: parseInt(r.count) })),
        openPositions: openPositions.rows.map(r => ({
          id: r.id,
          marketId: r.market_id,
          question: r.question,
          category: r.category,
          positionSide: r.position_side,
          betSize: r.bet_size ? parseFloat(r.bet_size) : null,
          betPrice: r.bet_price ? parseFloat(r.bet_price) : null,
          predictionProbability: parseFloat(r.prediction_probability),
          marketProbability: r.market_probability ? parseFloat(r.market_probability) : null,
          edge: r.edge ? parseFloat(r.edge) : null,
          resolvesAt: r.resolves_at,
        })),
        watchlist: watchlist.rows.map(r => ({
          id: r.id,
          shiftNumber: r.shift_number,
          createdAt: r.created_at,
          decisionReasoning: r.decision_reasoning,
          marketSlug: r.market_slug,
          question: r.question,
          marketProbability: r.market_probability ? parseFloat(r.market_probability) : null,
          liquidity: r.liquidity ? parseFloat(r.liquidity) : null,
        })),
        ruleSummary: ruleSummary.rows.map(r => ({
          id: r.id,
          ruleType: r.rule_type,
          ruleText: r.rule_text,
          confidence: parseFloat(r.confidence),
          timesApplied: parseInt(r.times_applied),
          timesSuccessful: parseInt(r.times_successful),
          successRate: r.success_rate ? parseFloat(r.success_rate) : null,
          active: r.active,
        })),
        dailyEdges: dailyEdges.rows.map(r => ({
          day: r.day,
          trades: parseInt(r.trades),
          edgeAvg: r.edge_avg ? parseFloat(r.edge_avg) : null,
          edgeMin: r.edge_min ? parseFloat(r.edge_min) : null,
          edgeMax: r.edge_max ? parseFloat(r.edge_max) : null,
        })),
        shiftStats,
      },
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

export default router;
