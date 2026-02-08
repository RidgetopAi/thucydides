import type { Stats, SearchResults, Entity, Source, Thread, ShiftReport, EntitySource, SourceEntity, Relationship } from './types';

const BASE = '/api';

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  topics: () => get<{ topics: string[] }>(`${BASE}/topics`),

  stats: (params?: Record<string, string | number | undefined>) =>
    get<Stats>(`${BASE}/stats`, params),

  search: (q: string, types?: string, limit?: number, topic?: string) =>
    get<SearchResults>(`${BASE}/search`, { q, types, limit, topic }),

  entities: (params?: Record<string, string | number | undefined>) =>
    get<{ entities: Entity[]; total: number; page: number; limit: number }>(`${BASE}/entities`, params),

  entity: (id: number) =>
    get<{
      entity: Entity;
      relationships: { outgoing: Relationship[]; incoming: Relationship[] };
      sources: EntitySource[];
    }>(`${BASE}/entities/${id}`),

  sources: (params?: Record<string, string | number | undefined>) =>
    get<{ sources: Source[]; total: number; page: number; limit: number }>(`${BASE}/sources`, params),

  source: (id: number) =>
    get<{ source: Source; entities: SourceEntity[] }>(`${BASE}/sources/${id}`),

  threads: (params?: Record<string, string | number | undefined>) =>
    get<{ threads: Thread[]; total: number; page: number; limit: number }>(`${BASE}/threads`, params),

  thread: (id: number) =>
    get<{ thread: Thread }>(`${BASE}/threads/${id}`),

  shifts: (params?: Record<string, string | number | undefined>) =>
    get<{ shifts: ShiftReport[] }>(`${BASE}/shifts`, params),

  shift: (id: number) =>
    get<{ shift: ShiftReport }>(`${BASE}/shifts/${id}`),
};
