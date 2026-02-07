import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';

export function ChallengeBadge({ challenged, outcome }: { challenged: boolean; outcome: string | null }) {
  if (!challenged) return null;

  if (outcome === 'upheld') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
        <ShieldCheck size={12} /> Upheld
      </span>
    );
  }
  if (outcome === 'overturned') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
        <ShieldAlert size={12} /> Overturned
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
      <ShieldQuestion size={12} /> Challenged
    </span>
  );
}
