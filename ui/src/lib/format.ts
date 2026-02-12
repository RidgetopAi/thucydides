export function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-confidence-high';
  if (confidence >= 0.5) return 'text-confidence-medium';
  return 'text-confidence-low';
}

export function confidenceBg(confidence: number): string {
  if (confidence >= 0.8) return 'bg-confidence-high/20 text-confidence-high';
  if (confidence >= 0.5) return 'bg-confidence-medium/20 text-confidence-medium';
  return 'bg-confidence-low/20 text-confidence-low';
}

export function entityTypeColor(type: string): string {
  const map: Record<string, string> = {
    person: 'bg-entity-person/20 text-entity-person',
    organization: 'bg-entity-organization/20 text-entity-organization',
    technology: 'bg-entity-technology/20 text-entity-technology',
    event: 'bg-entity-event/20 text-entity-event',
    location: 'bg-entity-location/20 text-entity-location',
    patent: 'bg-entity-patent/20 text-entity-patent',
    program: 'bg-entity-program/20 text-entity-program',
  };
  return map[type] || 'bg-zinc-700/50 text-zinc-300';
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    open: 'bg-status-open/20 text-status-open',
    progressed: 'bg-status-progressed/20 text-status-progressed',
    resolved: 'bg-status-resolved/20 text-status-resolved',
    disputed: 'bg-status-disputed/20 text-status-disputed',
  };
  return map[status] || 'bg-zinc-700/50 text-zinc-300';
}

export function priorityColor(priority: string): string {
  const map: Record<string, string> = {
    critical: 'text-red-400',
    high: 'text-orange-400',
    medium: 'text-yellow-400',
    low: 'text-zinc-400',
  };
  return map[priority] || 'text-zinc-400';
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function formatCurrency(value: number, decimals = 2): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
