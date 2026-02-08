import { useEffect, useState } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Thread } from '../../lib/types';
import { FilterBar } from '../shared/FilterBar';
import { useTopic } from '../../lib/TopicContext';
import { statusColor, priorityColor, formatDate } from '../../lib/format';
import { Loader2 } from 'lucide-react';

export function ThreadBoard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { topic } = useTopic();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const status = searchParams.get('status') || '';
  const priority = searchParams.get('priority') || '';
  const sort = searchParams.get('sort') || '';

  useEffect(() => {
    setLoading(true);
    api.threads({
      status: status || undefined,
      priority: priority || undefined,
      sort: sort || undefined,
      topic: topic || undefined,
      limit: 100,
    }).then((data) => {
      setThreads(data.threads);
      setTotal(data.total);
    }).finally(() => setLoading(false));
  }, [status, priority, sort, topic]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-100 mb-4">Research Threads</h2>

      <FilterBar
        filters={[
          {
            label: 'Status', key: 'status', value: status,
            options: [
              { label: 'All', value: '' },
              { label: 'Open', value: 'open' },
              { label: 'Progressed', value: 'progressed' },
              { label: 'Resolved', value: 'resolved' },
              { label: 'Disputed', value: 'disputed' },
            ],
          },
          {
            label: 'Priority', key: 'priority', value: priority,
            options: [
              { label: 'All', value: '' },
              { label: 'Critical', value: 'critical' },
              { label: 'High', value: 'high' },
              { label: 'Medium', value: 'medium' },
              { label: 'Low', value: 'low' },
            ],
          },
          {
            label: 'Sort', key: 'sort', value: sort,
            options: [
              { label: 'Newest', value: '' },
              { label: 'Title', value: 'title' },
              { label: 'Priority', value: 'priority' },
            ],
          },
        ]}
        onChange={setFilter}
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-zinc-500" size={24} />
        </div>
      ) : (
        <>
          <p className="text-xs text-zinc-500 mb-3">{total} threads</p>
          <div className="space-y-1.5">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                to={`/threads/${thread.id}`}
                className="block p-3 rounded-lg bg-surface hover:bg-surface-hover border border-border-subtle transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${statusColor(thread.status)}`}>
                    {thread.status}
                  </span>
                  <span className={`text-xs capitalize ${priorityColor(thread.priority)}`}>
                    {thread.priority}
                  </span>
                  {thread.opened_by && (
                    <span className="text-xs text-zinc-600 ml-auto">{thread.opened_by}</span>
                  )}
                </div>
                <h3 className="text-sm font-medium text-zinc-200">{thread.title}</h3>
                {thread.description && (
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{thread.description}</p>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ThreadDetail() {
  const { id } = useParams<{ id: string }>();
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.thread(parseInt(id)).then((data) => setThread(data.thread)).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-zinc-500" size={24} />
      </div>
    );
  }

  if (!thread) return <p className="text-zinc-500">Thread not found</p>;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${statusColor(thread.status)}`}>
          {thread.status}
        </span>
        <span className={`text-xs capitalize ${priorityColor(thread.priority)}`}>{thread.priority}</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-100 mb-3">{thread.title}</h1>

      {thread.description && (
        <p className="text-sm text-zinc-300 leading-relaxed mb-4">{thread.description}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {thread.opened_by && <MetaItem label="Opened by" value={thread.opened_by} />}
        {thread.opened_shift !== null && <MetaItem label="Opened shift" value={`#${thread.opened_shift}`} />}
        {thread.resolved_shift !== null && <MetaItem label="Resolved shift" value={`#${thread.resolved_shift}`} />}
        <MetaItem label="Created" value={formatDate(thread.created_at)} />
      </div>

      {thread.resolution && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-xs uppercase tracking-wide text-green-400 mb-1">Resolution</p>
          <p className="text-sm text-zinc-300 leading-relaxed">{thread.resolution}</p>
        </div>
      )}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded bg-surface border border-border-subtle">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm text-zinc-200 capitalize">{value}</p>
    </div>
  );
}
