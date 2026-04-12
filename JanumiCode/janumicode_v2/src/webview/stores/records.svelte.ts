/**
 * Reactive store for Governed Stream records (Svelte 5 runes).
 * Single source of truth for the webview.
 *
 * The extension host sends records via postMessage.
 * This store holds them as a $state field; consumers read `recordsStore.records`
 * directly and Svelte's runtime tracks the dependency for surgical updates.
 */

export interface SerializedRecord {
  id: string;
  record_type: string;
  phase_id: string | null;
  sub_phase_id: string | null;
  produced_by_agent_role: string | null;
  produced_at: string;
  authority_level: number;
  quarantined: boolean;
  content: Record<string, unknown>;
}

class RecordsStore {
  records = $state<SerializedRecord[]>([]);

  /**
   * Add a single record. Inserts in chronological order by produced_at.
   * No-op if a record with the same id already exists.
   */
  add(record: SerializedRecord): void {
    if (this.records.some(r => r.id === record.id)) return;
    const next = [...this.records, record];
    next.sort((a, b) => a.produced_at.localeCompare(b.produced_at));
    this.records = next;
  }

  /**
   * Update fields on an existing record.
   */
  update(id: string, fields: Partial<SerializedRecord>): void {
    this.records = this.records.map(r =>
      r.id === id ? { ...r, ...fields } : r,
    );
  }

  /**
   * Replace the entire record set (e.g. on webview restore).
   */
  setSnapshot(snapshot: SerializedRecord[]): void {
    const sorted = [...snapshot].sort(
      (a, b) => a.produced_at.localeCompare(b.produced_at),
    );
    this.records = sorted;
  }

  clear(): void {
    this.records = [];
  }

  /** Look up a single record by id (used by provenance citation chips). */
  getById(id: string): SerializedRecord | undefined {
    return this.records.find(r => r.id === id);
  }

  get count(): number {
    return this.records.length;
  }
}

export const recordsStore = new RecordsStore();
