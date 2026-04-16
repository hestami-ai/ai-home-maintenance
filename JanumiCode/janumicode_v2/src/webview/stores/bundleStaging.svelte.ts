/**
 * BundleStagingStore — local draft state for a composite decision bundle.
 *
 * The composite bundle card (Mirror section + Menu section + single
 * Submit) stages every row-level action here instead of emitting a
 * governed-stream record per click. Only when the user hits Submit do
 * we post a single `decisionBundleSubmit` message; DecisionRouter on
 * the extension host then writes ONE `decision_bundle_resolved` record
 * carrying all decisions atomically. That atomicity is the whole point
 * of the bundle — the user must not be able to ship a half-resolved
 * decision.
 *
 * Why a dedicated store instead of reusing decisionStagingStore:
 *   - Two sections with different item shapes (mirror rows vs menu
 *     option selections) — a shared flat list loses that distinction.
 *   - Inline edits carry a text payload that's buffered independently
 *     of the accept/reject/edit choice; conflating them made the edit
 *     UX confusing in v1's prototype.
 *   - Submit produces a bundle-specific postMessage shape, not the
 *     generic decisionBatch the staging store ships.
 */

import type {
  MirrorItemDecision,
  MenuOptionSelection,
  MirrorDecisionAction,
} from '../../lib/types/decisionBundle';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

function cloneForPost<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export interface BundleDraft {
  /**
   * Mirror item decisions keyed by item_id so the latest action per row
   * always wins — the user may change their mind between accept/reject/
   * edit/defer before Submit.
   */
  mirror: Record<string, MirrorItemDecision>;
  /**
   * Menu selections. Modeled as an array to preserve insertion order
   * (matters for multi-select audit), but we still dedup by option_id
   * in multi-select toggles and single-select replaces.
   */
  menu: MenuOptionSelection[];
}

const EMPTY: BundleDraft = { mirror: {}, menu: [] };

class BundleStagingStore {
  private state = $state<Record<string, BundleDraft>>({});

  /** Read-only draft for a bundle. Returns an empty draft when unset. */
  getDraft(recordId: string): BundleDraft {
    return this.state[recordId] ?? EMPTY;
  }

  /** Stage or replace a Mirror-row decision. Null unsets it (row returns to undecided). */
  stageMirror(
    recordId: string,
    itemId: string,
    action: MirrorDecisionAction | null,
    editedText?: string,
  ): void {
    const draft = this.state[recordId] ?? { mirror: {}, menu: [] };
    const mirror = { ...draft.mirror };
    if (action === null) {
      delete mirror[itemId];
    } else if (action === 'edited') {
      mirror[itemId] = { item_id: itemId, action, edited_text: editedText ?? '' };
    } else {
      mirror[itemId] = { item_id: itemId, action };
    }
    this.state = { ...this.state, [recordId]: { ...draft, mirror } };
  }

  /**
   * Stage a menu selection. Single-select replaces the list; multi-select
   * toggles the option in/out. Free-text answers attach to `_OTHER`.
   */
  stageMenu(
    recordId: string,
    optionId: string,
    multiSelect: boolean,
    freeText?: string,
  ): void {
    const draft = this.state[recordId] ?? { mirror: {}, menu: [] };
    let next: MenuOptionSelection[];
    if (multiSelect) {
      const present = draft.menu.find(s => s.option_id === optionId);
      next = present
        ? draft.menu.filter(s => s.option_id !== optionId)
        : [...draft.menu, { option_id: optionId, ...(freeText !== undefined ? { free_text: freeText } : {}) }];
    } else {
      next = [{ option_id: optionId, ...(freeText !== undefined ? { free_text: freeText } : {}) }];
    }
    this.state = { ...this.state, [recordId]: { ...draft, menu: next } };
  }

  /** Flatten the draft into the shape DecisionRouter expects on submit. */
  serialize(recordId: string): { mirror: MirrorItemDecision[]; menu: MenuOptionSelection[] } {
    const draft = this.getDraft(recordId);
    return {
      mirror: Object.values(draft.mirror),
      menu: draft.menu,
    };
  }

  /**
   * Post `decisionBundleSubmit` with the full draft. Clears the draft
   * after posting so a resolved bundle can't accidentally be submitted
   * twice. Returns true when the message was dispatched.
   */
  submit(recordId: string, surfaceId: string, vscode: VsCodeApi): boolean {
    const { mirror, menu } = this.serialize(recordId);
    if (mirror.length === 0 && menu.length === 0) return false;
    vscode.postMessage(cloneForPost({
      type: 'decisionBundleSubmit',
      recordId,
      surfaceId,
      mirror_decisions: mirror,
      menu_selections: menu,
    }));
    this.clear(recordId);
    return true;
  }

  /** Drop a draft (e.g. after receiving the confirmation record). */
  clear(recordId: string): void {
    if (!(recordId in this.state)) return;
    const next = { ...this.state };
    delete next[recordId];
    this.state = next;
  }

  reset(): void {
    this.state = {};
  }
}

export const bundleStagingStore = new BundleStagingStore();
