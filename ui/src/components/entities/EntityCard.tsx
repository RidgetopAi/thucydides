import { Link } from 'react-router-dom';
import { TypeBadge } from '../shared/TypeBadge';
import { ConfidenceBadge } from '../shared/ConfidenceBadge';
import { ChallengeBadge } from '../shared/ChallengeBadge';
import type { Entity } from '../../lib/types';

export function EntityCard({ entity }: { entity: Entity }) {
  return (
    <Link
      to={`/entities/${entity.id}`}
      className="block p-4 rounded-lg bg-surface hover:bg-surface-hover border border-border-subtle transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <TypeBadge type={entity.type} />
        <ConfidenceBadge value={entity.confidence} />
        <ChallengeBadge challenged={entity.challenged} outcome={entity.challenge_outcome} />
        {entity.discovered_by && (
          <span className="text-xs text-zinc-500 ml-auto">{entity.discovered_by}</span>
        )}
      </div>
      <h3 className="text-sm font-medium text-zinc-100 mb-1">{entity.name}</h3>
      {entity.description && (
        <p className="text-xs text-zinc-400 line-clamp-2">{entity.description}</p>
      )}
    </Link>
  );
}
