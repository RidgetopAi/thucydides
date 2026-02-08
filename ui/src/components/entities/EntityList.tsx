import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Entity } from '../../lib/types';
import { EntityCard } from './EntityCard';
import { FilterBar } from '../shared/FilterBar';
import { useTopic } from '../../lib/TopicContext';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

export function EntityList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { topic } = useTopic();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const type = searchParams.get('type') || '';
  const discovered_by = searchParams.get('discovered_by') || '';
  const sort = searchParams.get('sort') || '';
  const challenged = searchParams.get('challenged') || '';
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    setLoading(true);
    api.entities({
      type: type || undefined,
      discovered_by: discovered_by || undefined,
      sort: sort || undefined,
      challenged: challenged || undefined,
      topic: topic || undefined,
      page,
      limit: 48,
    }).then((data) => {
      setEntities(data.entities);
      setTotal(data.total);
    }).finally(() => setLoading(false));
  }, [type, discovered_by, sort, challenged, page, topic]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  };

  const totalPages = Math.ceil(total / 48);

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-100 mb-4">Entities</h2>

      <FilterBar
        filters={[
          {
            label: 'Type', key: 'type', value: type,
            options: [
              { label: 'All', value: '' },
              { label: 'Person', value: 'person' },
              { label: 'Organization', value: 'organization' },
              { label: 'Technology', value: 'technology' },
              { label: 'Event', value: 'event' },
              { label: 'Location', value: 'location' },
              { label: 'Patent', value: 'patent' },
              { label: 'Program', value: 'program' },
            ],
          },
          {
            label: 'Agent', key: 'discovered_by', value: discovered_by,
            options: [
              { label: 'All', value: '' },
              { label: 'Scholar', value: 'scholar' },
              { label: 'Digger', value: 'digger' },
              { label: 'Archivist', value: 'archivist' },
              { label: 'Jester', value: 'jester' },
            ],
          },
          {
            label: 'Sort', key: 'sort', value: sort,
            options: [
              { label: 'Newest', value: '' },
              { label: 'Name', value: 'name' },
              { label: 'Confidence', value: 'confidence' },
              { label: 'Oldest', value: 'oldest' },
            ],
          },
          {
            label: 'Challenged', key: 'challenged', value: challenged,
            options: [
              { label: 'All', value: '' },
              { label: 'Yes', value: 'true' },
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
          <p className="text-xs text-zinc-500 mb-3">{total} entities</p>
          <div className="grid gap-2 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {entities.map((e) => <EntityCard key={e.id} entity={e} />)}
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
              <span className="text-sm text-zinc-400">
                Page {page} of {totalPages}
              </span>
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
