import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Source } from '../../lib/types';
import { ConfidenceBadge } from '../shared/ConfidenceBadge';
import { FilterBar } from '../shared/FilterBar';
import { useTopic } from '../../lib/TopicContext';
import { ExternalLink, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

export function SourceList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { topic } = useTopic();
  const [sources, setSources] = useState<Source[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const type = searchParams.get('type') || '';
  const agent = searchParams.get('agent') || '';
  const sort = searchParams.get('sort') || '';
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    setLoading(true);
    api.sources({
      type: type || undefined,
      agent: agent || undefined,
      sort: sort || undefined,
      topic: topic || undefined,
      page,
      limit: 50,
    }).then((data) => {
      setSources(data.sources);
      setTotal(data.total);
    }).finally(() => setLoading(false));
  }, [type, agent, sort, page, topic]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-100 mb-4">Sources</h2>

      <FilterBar
        filters={[
          {
            label: 'Type', key: 'type', value: type,
            options: [
              { label: 'All', value: '' },
              { label: 'Academic', value: 'academic' },
              { label: 'Book', value: 'book' },
              { label: 'Article', value: 'article' },
              { label: 'Archive', value: 'archive' },
              { label: 'Patent', value: 'patent' },
              { label: 'Interview', value: 'interview' },
            ],
          },
          {
            label: 'Agent', key: 'agent', value: agent,
            options: [
              { label: 'All', value: '' },
              { label: 'Scholar', value: 'scholar' },
              { label: 'Digger', value: 'digger' },
              { label: 'Archivist', value: 'archivist' },
            ],
          },
          {
            label: 'Sort', key: 'sort', value: sort,
            options: [
              { label: 'Newest', value: '' },
              { label: 'Title', value: 'title' },
              { label: 'Reliability', value: 'reliability' },
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
          <p className="text-xs text-zinc-500 mb-3">{total} sources</p>
          <div className="space-y-1.5">
            {sources.map((src) => (
              <Link
                key={src.id}
                to={`/sources/${src.id}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-surface hover:bg-surface-hover border border-border-subtle transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-zinc-200 truncate">{src.title || 'Untitled'}</span>
                    {src.url && <ExternalLink size={12} className="text-zinc-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    {src.type && <span className="capitalize">{src.type}</span>}
                    {src.author && <span>by {src.author}</span>}
                    {src.agent && <span className="text-zinc-600">via {src.agent}</span>}
                  </div>
                </div>
                <ConfidenceBadge value={src.reliability} />
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                disabled={page <= 1}
                onClick={() => setFilter('page', String(page - 1))}
                className="p-1 rounded hover:bg-surface-hover disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-zinc-400">Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.set('page', String(page + 1));
                  setSearchParams(next);
                }}
                className="p-1 rounded hover:bg-surface-hover disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
