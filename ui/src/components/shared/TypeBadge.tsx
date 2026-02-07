import { entityTypeColor } from '../../lib/format';

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${entityTypeColor(type)}`}>
      {type}
    </span>
  );
}
