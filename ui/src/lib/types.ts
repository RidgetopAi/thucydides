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
