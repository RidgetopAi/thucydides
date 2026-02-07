import { confidenceBg, pct } from '../../lib/format';

export function ConfidenceBadge({ value }: { value: number }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${confidenceBg(value)}`}>
      {pct(value)}
    </span>
  );
}
