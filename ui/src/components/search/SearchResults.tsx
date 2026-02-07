import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import type { SearchResults as SearchResultsType } from '../../lib/types';
import { EntityResultCard, SourceResultCard, ThreadResultCard } from './ResultCard';
import { Loader2 } from 'lucide-react';

export function SearchResults() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const [results, setResults] = useState<SearchResultsType | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) { setResults(null); return; }
    setLoading(true);
    api.search(q).then(setResults).finally(() => setLoading(false));
  }, [q]);

  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
        <p className="text-lg">Search the Thucydides research database</p>
        <p className="text-sm mt-1">Entities, sources, and research threads</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-zinc-500" size={24} />
      </div>
    );
  }

  if (!results) return null;

  const entities = results.entities || [];
  const sources = results.sources || [];
  const threads = results.threads || [];
  const total = entities.length + sources.length + threads.length;

  return (
    <div>
      <h2 className="text-sm text-zinc-400 mb-4">
        {total} result{total !== 1 ? 's' : ''} for "<span className="text-zinc-200">{q}</span>"
      </h2>

      {entities.length > 0 && (
        <section className="mb-6">
          <h3 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Entities ({entities.length})</h3>
          <div className="grid gap-2 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {entities.map((e) => <EntityResultCard key={e.id} entity={e} />)}
          </div>
        </section>
      )}

      {sources.length > 0 && (
        <section className="mb-6">
          <h3 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Sources ({sources.length})</h3>
          <div className="grid gap-2 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {sources.map((s) => <SourceResultCard key={s.id} source={s} />)}
          </div>
        </section>
      )}

      {threads.length > 0 && (
        <section className="mb-6">
          <h3 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Threads ({threads.length})</h3>
          <div className="grid gap-2 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {threads.map((t) => <ThreadResultCard key={t.id} thread={t} />)}
          </div>
        </section>
      )}

      {total === 0 && (
        <p className="text-zinc-500 text-center py-12">No results found</p>
      )}
    </div>
  );
}
