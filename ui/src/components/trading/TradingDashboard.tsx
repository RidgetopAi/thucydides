import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useTopic } from '../../lib/TopicContext';
import type { Stats } from '../../lib/types';
import { formatCurrency, formatDate, formatNumber, pct } from '../../lib/format';
import { Loader2 } from 'lucide-react';

type Timeframe = 'shift' | 'daily' | 'rolling';
const SHIFT_REFRESH_MINUTES = 10;
const SHIFT_REFRESH_MS = SHIFT_REFRESH_MINUTES * 60 * 1000;

export function TradingDashboard() {
  const { topic } = useTopic();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>('daily');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const refreshInFlight = useRef(false);

  const refreshStats = useCallback(async (showLoading: boolean) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (showLoading) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const data = await api.stats({ topic: topic || undefined });
      setStats(data);
      setLastUpdated(new Date());
    } finally {
      refreshInFlight.current = false;
      if (showLoading) {
        setLoading(false);
      }
      setIsRefreshing(false);
    }
  }, [topic]);

  useEffect(() => {
    refreshStats(true);
  }, [refreshStats]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => refreshStats(false), SHIFT_REFRESH_MS);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshStats]);

  const trading = stats?.trading;
  const edgeTotals = useMemo(() => {
    if (!trading?.edgeBuckets?.length) return null;
    const total = trading.edgeBuckets.reduce((acc, item) => acc + item.count, 0);
    const getCount = (bucket: string) => trading.edgeBuckets.find(item => item.bucket === bucket)?.count ?? 0;
    return {
      total,
      strong: getCount('strong'),
      medium: getCount('medium'),
      thin: getCount('thin'),
      neutral: getCount('neutral'),
      negative: getCount('negative'),
    };
  }, [trading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-zinc-500" size={24} />
      </div>
    );
  }

  if (!stats || !trading) {
    return <p className="text-sm text-zinc-500">No polymarket trading data yet.</p>;
  }

  const totals = trading.totals;
  const totalPnL = totals.realizedPnL + totals.unrealizedPnL;
  const exposurePct = totals.bankroll ? totals.activeExposure / totals.bankroll : 0;
  const watchlistItems = trading.watchlist.slice(0, 6);
  const openPositions = trading.openPositions;
  const rules = trading.ruleSummary;
  const exposureTotal = trading.exposureByCategory.reduce((acc, row) => acc + row.exposure, 0) || 1;

  const dailyTrend = trading.dailyEdges.map((row) => ({
    label: formatDate(row.day),
    decisions: row.trades,
    trades: row.trades,
    watchlist: 0,
    skips: 0,
    edgeAvg: row.edgeAvg,
    edgeMin: row.edgeMin,
    edgeMax: row.edgeMax,
  }));

  const rollingTrend = dailyTrend.map((row, index) => {
    const window = dailyTrend.slice(Math.max(0, index - 6), index + 1);
    const values = window.map((item) => item.edgeAvg).filter((v): v is number => v !== null && v !== undefined);
    if (values.length === 0) {
      return { ...row, edgeAvg: null, edgeMin: null, edgeMax: null };
    }
    const avg = values.reduce((acc, val) => acc + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { ...row, edgeAvg: avg, edgeMin: min, edgeMax: max };
  });

  const shiftTrend = trading.shiftStats.map((row) => ({
    label: `Shift ${row.shiftNumber}`,
    decisions: row.decisions ?? 0,
    trades: row.trades ?? 0,
    watchlist: row.watchlist ?? 0,
    skips: row.skips ?? 0,
    edgeAvg: row.edgeAvg,
    edgeMin: row.edgeMin,
    edgeMax: row.edgeMax,
  }));

  const trendData = timeframe === 'shift'
    ? shiftTrend
    : timeframe === 'rolling'
      ? rollingTrend
      : dailyTrend;

  const edgeExtent = trendData.reduce(
    (acc, row) => {
      const values = [row.edgeMin, row.edgeMax].filter((v): v is number => v !== null && v !== undefined);
      if (!values.length) return acc;
      const min = Math.min(acc.min, ...values);
      const max = Math.max(acc.max, ...values);
      return { min, max };
    },
    { min: 0, max: 0 }
  );
  const edgeRange = Math.max(edgeExtent.max - edgeExtent.min, 0.02);
  const lastUpdatedLabel = lastUpdated
    ? `${formatDate(lastUpdated.toISOString())} ${lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Polymarket Trading Monitor</h2>
          <p className="text-xs text-zinc-500">Live from the trading tables. Shift-level refresh.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>Last refresh: {lastUpdatedLabel}</span>
            <label className="flex items-center gap-2 text-zinc-400">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
                className="h-4 w-4 rounded border border-border-subtle bg-surface accent-emerald-500"
              />
              Auto-refresh ({SHIFT_REFRESH_MINUTES}m)
            </label>
            {isRefreshing && <Loader2 className="animate-spin text-zinc-500" size={14} />}
          </div>
          <div className="flex items-center gap-2">
            {(['shift', 'daily', 'rolling'] as Timeframe[]).map((value) => (
              <button
                key={value}
                onClick={() => setTimeframe(value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  timeframe === value
                    ? 'bg-surface-active text-zinc-100 border-border'
                    : 'bg-surface text-zinc-400 border-border-subtle hover:text-zinc-200'
                }`}
              >
                {value === 'shift' ? 'Per Shift' : value === 'daily' ? 'Daily (14d)' : 'Rolling (7d)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard label="Total P&L" value={formatCurrency(totalPnL)} hint={`Realized ${formatCurrency(totals.realizedPnL)} • Unrealized ${formatCurrency(totals.unrealizedPnL)}`} />
          <MetricCard label="Active Exposure" value={formatCurrency(totals.activeExposure)} hint={`${pct(exposurePct)} of bankroll ${formatCurrency(totals.bankroll)}`} />
          <MetricCard label="Open Positions" value={totals.openPositions.toString()} hint={`${totals.resolvedPositions} resolved`} />
          <MetricCard label="Edge Strength" value={edgeTotals ? `${edgeTotals.strong + edgeTotals.medium} / ${edgeTotals.total}` : '0'} hint="Strong + Medium edges" />
        </div>
        <div className="p-4 rounded-lg bg-surface border border-border-subtle">
          <h3 className="text-sm font-medium text-zinc-200 mb-3">Exposure by Category</h3>
          <div className="space-y-2">
            {trading.exposureByCategory.length === 0 && (
              <p className="text-xs text-zinc-500">No exposure yet.</p>
            )}
            {trading.exposureByCategory.map((row) => (
              <div key={row.category} className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 w-24 capitalize">{row.category}</span>
                <div className="flex-1 h-2 rounded bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500/70"
                    style={{ width: `${Math.min((row.exposure / exposureTotal) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 w-16 text-right">{formatCurrency(row.exposure, 0)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-4 rounded-lg bg-surface border border-border-subtle">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-200">Edge vs Market Trend</h3>
              <p className="text-xs text-zinc-500">Average + range of trade edges.</p>
            </div>
            <div className="text-xs text-zinc-500">
              {timeframe === 'shift' ? 'Last 12 shifts' : timeframe === 'rolling' ? '7-day rolling avg' : 'Last 14 days'}
            </div>
          </div>
          {trendData.length === 0 ? (
            <p className="text-xs text-zinc-500">No edge data yet.</p>
          ) : (
            <div className="grid grid-cols-12 gap-2 items-end">
              {trendData.map((row) => {
                const edgeAvg = row.edgeAvg ?? 0;
                const height = Math.round(((edgeAvg - edgeExtent.min) / edgeRange) * 100);
                const barHeight = Math.min(Math.max(height, 8), 100);
                return (
                  <div key={row.label} className="flex flex-col items-center gap-2">
                    <div className="h-28 w-full flex items-end">
                      <div
                        className="w-full rounded bg-sky-500/70"
                        style={{ height: `${barHeight}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 text-center leading-tight">{row.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 text-xs text-zinc-500">
            <span>Edge min: {formatNumber(edgeExtent.min, 2)}</span>
            <span className="text-center">Edge avg: {formatNumber(trendData.reduce((acc, row) => acc + (row.edgeAvg ?? 0), 0) / Math.max(trendData.length, 1), 2)}</span>
            <span className="text-right">Edge max: {formatNumber(edgeExtent.max, 2)}</span>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-surface border border-border-subtle">
          <h3 className="text-sm font-medium text-zinc-200 mb-3">Decision Mix</h3>
          <div className="space-y-3">
            <DecisionRow label="Strong" value={edgeTotals?.strong ?? 0} total={edgeTotals?.total ?? 0} color="bg-emerald-500/80" />
            <DecisionRow label="Medium" value={edgeTotals?.medium ?? 0} total={edgeTotals?.total ?? 0} color="bg-sky-500/80" />
            <DecisionRow label="Thin" value={edgeTotals?.thin ?? 0} total={edgeTotals?.total ?? 0} color="bg-amber-500/80" />
            <DecisionRow label="Neutral" value={edgeTotals?.neutral ?? 0} total={edgeTotals?.total ?? 0} color="bg-zinc-500/70" />
            <DecisionRow label="Negative" value={edgeTotals?.negative ?? 0} total={edgeTotals?.total ?? 0} color="bg-red-500/70" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-4 rounded-lg bg-surface border border-border-subtle">
          <h3 className="text-sm font-medium text-zinc-200 mb-3">Open Positions</h3>
          {openPositions.length === 0 ? (
            <p className="text-xs text-zinc-500">No open positions yet.</p>
          ) : (
            <div className="space-y-2">
              {openPositions.map((pos) => (
                <div key={pos.id} className="p-3 rounded-md border border-border-subtle bg-zinc-950/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-zinc-100 leading-snug">{pos.question}</p>
                      <p className="text-xs text-zinc-500">{pos.marketId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-400">Edge</p>
                      <p className={`text-sm font-semibold ${pos.edge && pos.edge > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pos.edge != null ? formatNumber(pos.edge, 2) : 'n/a'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs text-zinc-400">
                    <Info label="Side" value={pos.positionSide ?? '—'} />
                    <Info label="Size" value={pos.betSize != null ? formatCurrency(pos.betSize, 0) : '—'} />
                    <Info label="Our Prob" value={pct(pos.predictionProbability)} />
                    <Info label="Market" value={pos.marketProbability != null ? pct(pos.marketProbability) : '—'} />
                  </div>
                  {pos.resolvesAt && (
                    <p className="mt-2 text-[11px] text-zinc-500">Resolves {formatDate(pos.resolvesAt)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 rounded-lg bg-surface border border-border-subtle">
          <h3 className="text-sm font-medium text-zinc-200 mb-3">Watchlist</h3>
          {watchlistItems.length === 0 ? (
            <p className="text-xs text-zinc-500">No watchlist items yet.</p>
          ) : (
            <div className="space-y-3">
              {watchlistItems.map((item) => (
                <div key={item.id} className="p-3 rounded-md border border-border-subtle bg-zinc-950/60">
                  <p className="text-sm text-zinc-100 leading-snug">{item.question ?? 'Unknown market'}</p>
                  <p className="text-[11px] text-zinc-500">{item.marketSlug ?? '—'}</p>
                  <div className="flex items-center justify-between text-xs text-zinc-400 mt-2">
                    <span>{item.marketProbability != null ? pct(item.marketProbability) : '—'} market</span>
                    <span>{item.liquidity != null ? formatCurrency(item.liquidity, 0) : 'liq n/a'}</span>
                  </div>
                  {item.shiftNumber != null && (
                    <p className="text-[11px] text-zinc-500 mt-2">Shift {item.shiftNumber} • {formatDate(item.createdAt)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-4 rounded-lg bg-surface border border-border-subtle">
          <h3 className="text-sm font-medium text-zinc-200 mb-3">Shift Decisions</h3>
          {trading.shiftStats.length === 0 ? (
            <p className="text-xs text-zinc-500">No shift stats yet.</p>
          ) : (
            <div className="space-y-2">
              {trading.shiftStats.map((row) => (
                <div key={row.shiftNumber} className="grid grid-cols-12 items-center gap-3 text-xs text-zinc-400">
                  <span className="col-span-2 text-zinc-300">Shift {row.shiftNumber}</span>
                  <span className="col-span-2">{row.decisions ?? 0} decisions</span>
                  <span className="col-span-2">{row.trades ?? 0} trades</span>
                  <span className="col-span-2">{row.watchlist ?? 0} watchlist</span>
                  <span className="col-span-2">{row.skips ?? 0} skips</span>
                  <span className="col-span-2 text-right">avg {row.edgeAvg != null ? formatNumber(row.edgeAvg, 2) : 'n/a'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 rounded-lg bg-surface border border-border-subtle">
          <h3 className="text-sm font-medium text-zinc-200 mb-3">Strategy Rules</h3>
          {rules.length === 0 ? (
            <p className="text-xs text-zinc-500">No rules tracked yet.</p>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className="p-3 rounded-md border border-border-subtle bg-zinc-950/60">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{rule.ruleType}</p>
                  <p className="text-sm text-zinc-100 mt-1">{rule.ruleText}</p>
                  <div className="flex items-center justify-between text-xs text-zinc-400 mt-2">
                    <span>Applied {rule.timesApplied}x</span>
                    <span>Success {rule.successRate != null ? pct(rule.successRate) : 'n/a'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="p-4 rounded-lg bg-surface border border-border-subtle">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold text-zinc-100 mt-2">{value}</p>
      {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
    </div>
  );
}

function DecisionRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pctValue = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded bg-zinc-800 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pctValue}%` }} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-xs text-zinc-300">{value}</p>
    </div>
  );
}
