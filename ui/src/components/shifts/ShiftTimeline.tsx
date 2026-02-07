import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { ShiftReport } from '../../lib/types';
import { formatDate } from '../../lib/format';
import { Loader2, Database, GitBranch, BookOpen } from 'lucide-react';

export function ShiftTimeline() {
  const [shifts, setShifts] = useState<ShiftReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.shifts().then((data) => setShifts(data.shifts)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-zinc-500" size={24} />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-100 mb-4">Shift Reports</h2>
      <div className="space-y-2">
        {shifts.map((shift) => (
          <Link
            key={shift.id}
            to={`/shifts/${shift.id}`}
            className="block p-4 rounded-lg bg-surface hover:bg-surface-hover border border-border-subtle transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-zinc-200">
                Shift #{shift.shift_number}
              </h3>
              <span className="text-xs text-zinc-500">{formatDate(shift.created_at)}</span>
            </div>
            {shift.summary && (
              <p className="text-xs text-zinc-400 line-clamp-2 mb-2">{shift.summary}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Database size={12} /> {shift.new_entities} entities
              </span>
              <span className="flex items-center gap-1">
                <GitBranch size={12} /> {shift.new_relationships} rels
              </span>
              <span className="flex items-center gap-1">
                <BookOpen size={12} /> {shift.new_sources} sources
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ShiftDetail() {
  const { id } = useParams<{ id: string }>();
  const [shift, setShift] = useState<ShiftReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.shift(parseInt(id)).then((data) => setShift(data.shift)).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-zinc-500" size={24} />
      </div>
    );
  }

  if (!shift) return <p className="text-zinc-500">Shift report not found</p>;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Shift #{shift.shift_number}</h1>
      <p className="text-sm text-zinc-500 mb-4">{shift.run_name} | {formatDate(shift.created_at)}</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="New Entities" value={shift.new_entities} icon={Database} />
        <StatCard label="New Relationships" value={shift.new_relationships} icon={GitBranch} />
        <StatCard label="New Sources" value={shift.new_sources} icon={BookOpen} />
      </div>

      {shift.summary && (
        <Section title="Summary">
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{shift.summary}</p>
        </Section>
      )}

      {shift.key_findings && (
        <Section title="Key Findings">
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{shift.key_findings}</p>
        </Section>
      )}

      {shift.next_priorities && (
        <Section title="Next Priorities">
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{shift.next_priorities}</p>
        </Section>
      )}

      {shift.threads_opened && shift.threads_opened.length > 0 && (
        <Section title="Threads Opened">
          <ul className="space-y-1">
            {shift.threads_opened.map((t, i) => <li key={i} className="text-sm text-zinc-300">- {t}</li>)}
          </ul>
        </Section>
      )}

      {shift.threads_resolved && shift.threads_resolved.length > 0 && (
        <Section title="Threads Resolved">
          <ul className="space-y-1">
            {shift.threads_resolved.map((t, i) => <li key={i} className="text-sm text-green-400">- {t}</li>)}
          </ul>
        </Section>
      )}

      {shift.jester_challenges != null && (
        <Section title="Jester Challenges">
          <pre className="text-xs text-zinc-400 bg-zinc-900 rounded p-3 overflow-x-auto">
            {JSON.stringify(shift.jester_challenges as Record<string, unknown>, null, 2)}
          </pre>
        </Section>
      )}

      {shift.agent_reports != null && (
        <Section title="Agent Reports">
          <pre className="text-xs text-zinc-400 bg-zinc-900 rounded p-3 overflow-x-auto">
            {JSON.stringify(shift.agent_reports as Record<string, unknown>, null, 2)}
          </pre>
        </Section>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ size: number }> }) {
  return (
    <div className="p-3 rounded-lg bg-surface border border-border-subtle text-center">
      <Icon size={18} />
      <p className="text-2xl font-bold text-zinc-100 mt-1">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-zinc-300 mb-2">{title}</h2>
      <div className="p-4 rounded-lg bg-surface border border-border-subtle">{children}</div>
    </div>
  );
}
