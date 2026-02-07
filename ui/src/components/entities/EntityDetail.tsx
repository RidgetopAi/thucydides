import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Entity, Relationship, EntitySource } from '../../lib/types';
import { TypeBadge } from '../shared/TypeBadge';
import { ConfidenceBadge } from '../shared/ConfidenceBadge';
import { ChallengeBadge } from '../shared/ChallengeBadge';
import { formatDate, entityTypeColor } from '../../lib/format';
import { ArrowRight, ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';

export function EntityDetail() {
  const { id } = useParams<{ id: string }>();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [outgoing, setOutgoing] = useState<Relationship[]>([]);
  const [incoming, setIncoming] = useState<Relationship[]>([]);
  const [sources, setSources] = useState<EntitySource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.entity(parseInt(id)).then((data) => {
      setEntity(data.entity);
      setOutgoing(data.relationships.outgoing);
      setIncoming(data.relationships.incoming);
      setSources(data.sources);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-zinc-500" size={24} />
      </div>
    );
  }

  if (!entity) {
    return <p className="text-zinc-500">Entity not found</p>;
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <TypeBadge type={entity.type} />
          <ConfidenceBadge value={entity.confidence} />
          <ChallengeBadge challenged={entity.challenged} outcome={entity.challenge_outcome} />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">{entity.name}</h1>
        {entity.aliases && entity.aliases.length > 0 && (
          <p className="text-sm text-zinc-500 mt-1">
            aka: {entity.aliases.join(', ')}
          </p>
        )}
        {entity.description && (
          <p className="text-sm text-zinc-300 mt-3 leading-relaxed">{entity.description}</p>
        )}
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {entity.discovered_by && (
          <MetaItem label="Discovered by" value={entity.discovered_by} />
        )}
        {entity.shift_discovered !== null && (
          <MetaItem label="Shift" value={`#${entity.shift_discovered}`} />
        )}
        <MetaItem label="Created" value={formatDate(entity.created_at)} />
        {entity.dispute_status && (
          <MetaItem label="Dispute" value={entity.dispute_status} />
        )}
      </div>

      {entity.dispute_note && (
        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs uppercase tracking-wide text-red-400 mb-1">Dispute Note</p>
          <p className="text-sm text-zinc-300">{entity.dispute_note}</p>
        </div>
      )}

      {/* Metadata JSON */}
      {entity.metadata && Object.keys(entity.metadata).length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-zinc-300 mb-2">Metadata</h2>
          <div className="bg-surface rounded-lg border border-border-subtle p-3">
            {Object.entries(entity.metadata).map(([key, value]) => (
              <div key={key} className="flex gap-2 py-1 text-sm">
                <span className="text-zinc-500 shrink-0">{key}:</span>
                <span className="text-zinc-300">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relationships */}
      {(outgoing.length > 0 || incoming.length > 0) && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-zinc-300 mb-3">
            Relationships ({outgoing.length + incoming.length})
          </h2>
          <div className="space-y-1.5">
            {outgoing.map((rel) => (
              <RelationshipRow key={rel.id} rel={rel} direction="outgoing" />
            ))}
            {incoming.map((rel) => (
              <RelationshipRow key={rel.id} rel={rel} direction="incoming" />
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-zinc-300 mb-3">
            Sources ({sources.length})
          </h2>
          <div className="space-y-2">
            {sources.map((src) => (
              <div key={src.source_id} className="p-3 rounded-lg bg-surface border border-border-subtle">
                <div className="flex items-center gap-2 mb-1">
                  <Link to={`/sources/${src.source_id}`} className="text-sm font-medium text-zinc-200 hover:text-zinc-100">
                    {src.title || 'Untitled'}
                  </Link>
                  <ConfidenceBadge value={src.reliability} />
                  {src.url && (
                    <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300">
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                {src.claim && (
                  <p className="text-xs text-zinc-400 mt-1 italic">"{src.claim}"</p>
                )}
              </div>
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

function RelationshipRow({ rel, direction }: { rel: Relationship; direction: 'outgoing' | 'incoming' }) {
  const targetId = direction === 'outgoing' ? rel.to_entity_id : rel.from_entity_id;
  const targetName = direction === 'outgoing' ? rel.to_entity_name : rel.from_entity_name;
  const targetType = direction === 'outgoing' ? rel.to_entity_type : rel.from_entity_type;

  return (
    <Link
      to={`/entities/${targetId}`}
      className="flex items-center gap-2 p-2.5 rounded-lg bg-surface hover:bg-surface-hover border border-border-subtle transition-colors"
    >
      {direction === 'outgoing' ? (
        <ArrowRight size={14} className="text-zinc-500 shrink-0" />
      ) : (
        <ArrowLeft size={14} className="text-zinc-500 shrink-0" />
      )}
      <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400 shrink-0">{rel.type}</span>
      <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 capitalize ${entityTypeColor(targetType || '')}`}>
        {targetType}
      </span>
      <span className="text-sm text-zinc-200 truncate">{targetName}</span>
      <ConfidenceBadge value={rel.confidence} />
      {rel.period && <span className="text-xs text-zinc-500 ml-auto shrink-0">{rel.period}</span>}
    </Link>
  );
}
