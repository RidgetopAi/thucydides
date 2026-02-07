import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Stats } from '../../lib/types';
import { entityTypeColor, statusColor } from '../../lib/format';
import { Database, GitBranch, BookOpen, MessageSquare, Clock, Loader2 } from 'lucide-react';

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.stats().then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-zinc-500" size={24} />
      </div>
    );
  }

  if (!stats) return null;

  const maxEntityCount = Math.max(...stats.entityTypes.map(t => t.count));
  const maxAgentCount = Math.max(...stats.agents.map(a => a.count));

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-100 mb-6">Research Dashboard</h2>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <TotalCard label="Entities" value={stats.totals.entities} icon={Database} />
        <TotalCard label="Relationships" value={stats.totals.relationships} icon={GitBranch} />
        <TotalCard label="Sources" value={stats.totals.sources} icon={BookOpen} />
        <TotalCard label="Threads" value={stats.totals.threads} icon={MessageSquare} />
        <TotalCard label="Shifts" value={stats.totals.shifts} icon={Clock} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Entity types */}
        <div className="p-4 rounded-lg bg-surface border border-border-subtle">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Entity Types</h3>
          <div className="space-y-2">
            {stats.entityTypes.map(({ type, count }) => (
              <div key={type} className="flex items-center gap-2">
                <span className={`text-xs w-24 capitalize px-2 py-0.5 rounded ${entityTypeColor(type)}`}>
                  {type}
                </span>
                <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${entityTypeColor(type).replace('text-', 'bg-').split(' ')[0]}`}
                    style={{ width: `${(count / maxEntityCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence distribution */}
        <div className="p-4 rounded-lg bg-surface border border-border-subtle">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Confidence Distribution</h3>
          <div className="space-y-2">
            {stats.confidenceDistribution.map(({ bucket, count }) => {
              const color = bucket === 'high' ? 'bg-confidence-high' : bucket === 'medium' ? 'bg-confidence-medium' : 'bg-confidence-low';
              const totalEntities = stats.totals.entities;
              return (
                <div key={bucket} className="flex items-center gap-2">
                  <span className="text-xs w-16 capitalize text-zinc-400">{bucket}</span>
                  <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                    <div className={`h-full rounded ${color}`} style={{ width: `${(count / totalEntities) * 100}%` }} />
                  </div>
                  <span className="text-xs text-zinc-400 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Thread statuses */}
        <div className="p-4 rounded-lg bg-surface border border-border-subtle">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Thread Status</h3>
          <div className="space-y-2">
            {stats.threadStatuses.map(({ status, count }) => (
              <div key={status} className="flex items-center gap-2">
                <span className={`text-xs w-20 capitalize px-2 py-0.5 rounded ${statusColor(status)}`}>
                  {status}
                </span>
                <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                  <div
                    className="h-full rounded bg-zinc-600"
                    style={{ width: `${(count / stats.totals.threads) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Agent contributions */}
        <div className="p-4 rounded-lg bg-surface border border-border-subtle">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Agent Contributions</h3>
          <div className="space-y-2">
            {stats.agents.map(({ agent, count }) => (
              <div key={agent} className="flex items-center gap-2">
                <span className="text-xs w-20 capitalize text-zinc-400">{agent}</span>
                <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                  <div className="h-full rounded bg-indigo-500/60" style={{ width: `${(count / maxAgentCount) * 100}%` }} />
                </div>
                <span className="text-xs text-zinc-400 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TotalCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ size: number; className?: string }> }) {
  return (
    <div className="p-4 rounded-lg bg-surface border border-border-subtle text-center">
      <Icon size={20} className="mx-auto text-zinc-500" />
      <p className="text-2xl font-bold text-zinc-100 mt-1">{value.toLocaleString()}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}
