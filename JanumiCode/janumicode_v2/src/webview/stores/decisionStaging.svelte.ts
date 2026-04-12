/**
 * DecisionStagingStore — per-card pending-decision staging for batched
 * submission (v1 MMP pattern).
 *
 * Cards call `stage(recordId, decision)` instead of dispatching immediately.
 * The staging store accumulates pending decisions per surface record and
 * shows a progress counter (`Mirror: 3/5 decisions made`). When the user
 * clicks "Submit Decisions", the card calls `submit(recordId, vscode)` which
 * dispatches all staged decisions for that card as a single `decisionBatch`
 * postMessage. DecisionRouter on the engine side routes them in one DB
 * transaction.
 *
 * Usage from a card component:
 *
 *   import { decisionStagingStore } from '../stores/decisionStaging.svelte';
 *
 *   // Per-row button click:
 *   decisionStagingStore.stage(record.id, { itemId: 'a1', type: 'accepted' });
 *
 *   // Submit button:
 *   decisionStagingStore.submit(record.id, vscode);
 *
 *   // Read staged decisions (reactive):
 *   const staged = $derived(decisionStagingStore.getStaged(record.id));
 *   const count = $derived(decisionStagingStore.countByCard(record.id));
 */

export interface StagedDecision {
  /** The id of the item within the card (assumption id, option id, etc.) */
  itemId: string;
  /** The decision action — matches v1's per-row status values. */
  action: 'accepted' | 'rejected' | 'deferred' | 'edited';
  /** Optional payload (edited text, custom response, etc.) */
  payload?: Record<string, unknown>;
}

interface VsCodeApi {
  postMessage(message: unknown): void;
}

function cloneForPost<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

class DecisionStagingStore {
  /**
   * Per-card map: surface record id → array of staged decisions.
   * Each card manages its own staging independently.
   */
  private state = $state<Map<string, StagedDecision[]>>(new Map());

  /**
   * Stage a decision for a card. If a decision for the same itemId already
   * exists, it's replaced (the user changed their mind).
   */
  stage(recordId: string, decision: StagedDecision): void {
    const existing = this.state.get(recordId) ?? [];
    const filtered = existing.filter(d => d.itemId !== decision.itemId);
    const next = new Map(this.state);
    next.set(recordId, [...filtered, decision]);
    this.state = next;
  }

  /** Remove a staged decision by itemId. */
  unstage(recordId: string, itemId: string): void {
    const existing = this.state.get(recordId);
    if (!existing) return;
    const next = new Map(this.state);
    next.set(recordId, existing.filter(d => d.itemId !== itemId));
    this.state = next;
  }

  /** Get all staged decisions for a card. */
  getStaged(recordId: string): StagedDecision[] {
    return this.state.get(recordId) ?? [];
  }

  /** Get the staged decision for a specific item within a card (or null). */
  getItemDecision(recordId: string, itemId: string): StagedDecision | null {
    const staged = this.state.get(recordId);
    if (!staged) return null;
    return staged.find(d => d.itemId === itemId) ?? null;
  }

  /** Count of staged decisions for a card. */
  countByCard(recordId: string): number {
    return (this.state.get(recordId) ?? []).length;
  }

  /** Total pending decisions across all cards. */
  get totalPending(): number {
    let total = 0;
    for (const decisions of this.state.values()) {
      total += decisions.length;
    }
    return total;
  }

  /**
   * Dispatch all staged decisions for a card as a single batched message.
   * Clears the staging for that card after submission.
   */
  submit(recordId: string, vscode: VsCodeApi): void {
    const decisions = this.getStaged(recordId);
    if (decisions.length === 0) return;

    vscode.postMessage(cloneForPost({
      type: 'decisionBatch',
      recordId,
      decisions,
    }));

    this.clear(recordId);
  }

  /** Clear all staged decisions for a card (after submit or on cancel). */
  clear(recordId: string): void {
    const next = new Map(this.state);
    next.delete(recordId);
    this.state = next;
  }

  /** Clear everything (e.g. on workflow reset). */
  clearAll(): void {
    this.state = new Map();
  }
}

export const decisionStagingStore = new DecisionStagingStore();
