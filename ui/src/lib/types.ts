export interface Entity {
  id: number;
  type: string;
  name: string;
  aliases: string[] | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  topic: string | null;
  run_name: string | null;
  shift_discovered: number | null;
  discovered_by: string | null;
  confidence: number;
  challenged: boolean;
  challenge_outcome: string | null;
  dispute_note: string | null;
  dispute_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface Relationship {
  id: number;
  from_entity_id: number;
  to_entity_id: number;
  type: string;
  description: string | null;
  period: string | null;
  confidence: number;
  discovered_by: string | null;
  from_entity_name?: string;
  from_entity_type?: string;
  to_entity_name?: string;
  to_entity_type?: string;
}

export interface Source {
  id: number;
  url: string | null;
  title: string | null;
  type: string | null;
  author: string | null;
  publication_date: string | null;
  agent: string | null;
  description: string | null;
  reliability: number;
  topic: string | null;
  created_at: string;
}

export interface EntitySource {
  source_id: number;
  title: string | null;
  url: string | null;
  source_type: string | null;
  author?: string | null;
  reliability: number;
  claim: string | null;
}

export interface SourceEntity {
  entity_id: number;
  name: string;
  entity_type: string;
  confidence: number;
  claim: string | null;
}

export interface Thread {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  opened_by: string | null;
  opened_shift: number | null;
  resolved_shift: number | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftReport {
  id: number;
  run_name: string;
  shift_number: number;
  topic: string | null;
  summary: string | null;
  new_entities: number;
  new_relationships: number;
  new_sources: number;
  threads_opened: string[] | null;
  threads_progressed: string[] | null;
  threads_resolved: string[] | null;
  jester_challenges: unknown;
  key_findings: string | null;
  next_priorities: string | null;
  agent_reports: unknown;
  created_at: string;
}

export interface Stats {
  totals: {
    entities: number;
    relationships: number;
    sources: number;
    threads: number;
    shifts: number;
  };
  entityTypes: { type: string; count: number }[];
  confidenceDistribution: { bucket: string; count: number }[];
  threadStatuses: { status: string; count: number }[];
  agents: { agent: string; count: number }[];
  trading?: {
    totals: {
      openPositions: number;
      resolvedPositions: number;
      activeExposure: number;
      realizedPnL: number;
      unrealizedPnL: number;
      bankroll: number;
    };
    positionsByStatus: { status: string; count: number }[];
    exposureByCategory: { category: string; exposure: number }[];
    edgeBuckets: { bucket: string; count: number }[];
    openPositions: {
      id: number;
      marketId: string;
      question: string;
      category: string | null;
      positionSide: string | null;
      betSize: number | null;
      betPrice: number | null;
      predictionProbability: number;
      marketProbability: number | null;
      edge: number | null;
      resolvesAt: string | null;
    }[];
    watchlist: {
      id: number;
      shiftNumber: number | null;
      createdAt: string;
      decisionReasoning: string | null;
      marketSlug: string | null;
      question: string | null;
      marketProbability: number | null;
      liquidity: number | null;
    }[];
    ruleSummary: {
      id: number;
      ruleType: string;
      ruleText: string;
      confidence: number;
      timesApplied: number;
      timesSuccessful: number;
      successRate: number | null;
      active: boolean;
    }[];
    dailyEdges: {
      day: string;
      trades: number;
      edgeAvg: number | null;
      edgeMin: number | null;
      edgeMax: number | null;
    }[];
    shiftStats: {
      shiftNumber: number;
      decisions: number | null;
      trades: number | null;
      watchlist: number | null;
      skips: number | null;
      edgeAvg: number | null;
      edgeMin: number | null;
      edgeMax: number | null;
    }[];
  };
}

export interface SearchResults {
  entities?: Entity[];
  sources?: Source[];
  threads?: Thread[];
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  limit: number;
  [key: string]: T[] | number;
}
