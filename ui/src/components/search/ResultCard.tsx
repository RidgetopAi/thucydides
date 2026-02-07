import { Link } from 'react-router-dom';
import { TypeBadge } from '../shared/TypeBadge';
import { ConfidenceBadge } from '../shared/ConfidenceBadge';
import { ChallengeBadge } from '../shared/ChallengeBadge';
import type { Entity, Source, Thread } from '../../lib/types';
import { statusColor } from '../../lib/format';

export function EntityResultCard({ entity }: { entity: Entity }) {
  return (
    <Link to={`/entities/${entity.id}`} className="block p-3 rounded-lg bg-surface hover:bg-surface-hover border border-border-subtle transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <TypeBadge type={entity.type} />
        <ConfidenceBadge value={entity.confidence} />
        <ChallengeBadge challenged={entity.challenged} outcome={entity.challenge_outcome} />
      </div>
      <h3 className="text-sm font-medium text-zinc-100">{entity.name}</h3>
      {entity.description && (
        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{entity.description}</p>
      )}
    </Link>
  );
}

export function SourceResultCard({ source }: { source: Source }) {
  return (
    <Link to={`/sources/${source.id}`} className="block p-3 rounded-lg bg-surface hover:bg-surface-hover border border-border-subtle transition-colors">
      <div className="flex items-center gap-2 mb-1">
        {source.type && <span className="text-xs px-2 py-0.5 rounded bg-zinc-700/50 text-zinc-300">{source.type}</span>}
        <ConfidenceBadge value={source.reliability} />
      </div>
      <h3 className="text-sm font-medium text-zinc-100">{source.title || 'Untitled Source'}</h3>
      {source.author && <p className="text-xs text-zinc-400 mt-0.5">{source.author}</p>}
    </Link>
  );
}

export function ThreadResultCard({ thread }: { thread: Thread }) {
  return (
    <Link to={`/threads/${thread.id}`} className="block p-3 rounded-lg bg-surface hover:bg-surface-hover border border-border-subtle transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${statusColor(thread.status)}`}>
          {thread.status}
        </span>
        <span className="text-xs text-zinc-500">{thread.priority}</span>
      </div>
      <h3 className="text-sm font-medium text-zinc-100">{thread.title}</h3>
      {thread.description && (
        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{thread.description}</p>
      )}
    </Link>
  );
}
