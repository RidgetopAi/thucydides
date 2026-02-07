import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Source, SourceEntity } from '../../lib/types';
import { ConfidenceBadge } from '../shared/ConfidenceBadge';
import { TypeBadge } from '../shared/TypeBadge';
import { formatDate } from '../../lib/format';
import { ExternalLink, Loader2 } from 'lucide-react';

export function SourceDetail() {
  const { id } = useParams<{ id: string }>();
  const [source, setSource] = useState<Source | null>(null);
  const [entities, setEntities] = useState<SourceEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.source(parseInt(id)).then((data) => {
      setSource(data.source);
      setEntities(data.entities);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-zinc-500" size={24} />
      </div>
    );
  }

  if (!source) return <p className="text-zinc-500">Source not found</p>;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          {source.type && <span className="text-xs px-2 py-0.5 rounded bg-zinc-700/50 text-zinc-300 capitalize">{source.type}</span>}
          <ConfidenceBadge value={source.reliability} />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">{source.title || 'Untitled Source'}</h1>
        {source.author && <p className="text-sm text-zinc-400 mt-1">by {source.author}</p>}
        {source.description && (
          <p className="text-sm text-zinc-300 mt-3 leading-relaxed">{source.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {source.agent && <MetaItem label="Agent" value={source.agent} />}
        {source.publication_date && <MetaItem label="Published" value={source.publication_date} />}
        <MetaItem label="Created" value={formatDate(source.created_at)} />
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 p-2 rounded bg-surface border border-border-subtle hover:bg-surface-hover transition-colors"
          >
            <ExternalLink size={14} className="text-zinc-400" />
            <span className="text-sm text-zinc-300 truncate">View source</span>
          </a>
        )}
      </div>

      {entities.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-zinc-300 mb-3">
            Backed Entities ({entities.length})
          </h2>
          <div className="space-y-1.5">
            {entities.map((ent) => (
              <Link
                key={ent.entity_id}
                to={`/entities/${ent.entity_id}`}
                className="block p-3 rounded-lg bg-surface hover:bg-surface-hover border border-border-subtle transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <TypeBadge type={ent.entity_type} />
                  <span className="text-sm font-medium text-zinc-200">{ent.name}</span>
                  <ConfidenceBadge value={ent.confidence} />
                </div>
                {ent.claim && (
                  <p className="text-xs text-zinc-400 italic">"{ent.claim}"</p>
                )}
              </Link>
            ))}
          </div>
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
