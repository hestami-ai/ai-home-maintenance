/**
 * DecisionBundle — composite Mirror + Menu surface presented to the user
 * as a single atomic decision. See spec §6.2 (human interaction records)
 * and the design note on `decision_bundle_presented`.
 *
 * Why this exists: emitting a mirror_presented and a menu_presented as
 * two separate records for the same conceptual decision led to the bug
 * where the user would hit Submit on the Mirror and never see the Menu,
 * accidentally advancing the workflow past a gate they hadn't actually
 * resolved. Wrapping both sections in one record makes the producer
 * responsible for coherence; the webview just renders what's there.
 *
 * Resolution: when the user clicks the single Submit at the bottom of
 * the bundle, the webview posts one `decisionBundleSubmit` message,
 * which DecisionRouter translates into exactly one
 * `decision_bundle_resolved` record (plus one `decision_trace`). The
 * phase handler awaits that resolution, reads the counters, and decides
 * whether to advance.
 */

// ── Mirror section ─────────────────────────────────────────────────

export interface MirrorItem {
  /** Stable id within the bundle — used by resolution to point back at the row. */
  id: string;
  /** Human-facing text (assumption, proposal, steel-man sentence, etc.). */
  text: string;
  /** Optional rationale the agent attached; shown under the item when expanded. */
  rationale?: string;
  /** Optional richer fields for candidate-interpretation review surfaces. */
  description?: string;
  who_it_serves?: string;
  problem_it_solves?: string;
  constraints?: string[];
  open_questions?: string[];
  supporting_assumptions?: Array<{
    text: string;
    rationale?: string;
  }>;
}

export interface MirrorSection {
  kind: 'assumption_mirror' | 'steelman' | 'field_review' | string;
  items: MirrorItem[];
}

// ── Menu section ───────────────────────────────────────────────────

export interface MenuOption {
  id: string;
  label: string;
  description?: string;
  tradeoffs?: string;
  recommended?: boolean;
}

export interface MenuSection {
  question: string;
  /** Optional preamble rendered above the options. */
  context?: string;
  multi_select: boolean;
  allow_free_text: boolean;
  options: MenuOption[];
}

// ── Bundle content (content field of decision_bundle_presented) ─────

export interface DecisionBundleContent {
  /**
   * Stable identifier for the surface. Lets downstream consumers (audit
   * queries, decision-history retrieval) refer to the bundle without
   * caring which governed_stream record id it was written under.
   */
  surface_id: string;
  /** Header label shown in the UI. */
  title?: string;
  /** Optional summary rendered above both sections. */
  summary?: string;
  mirror?: MirrorSection;
  menu?: MenuSection;
}

// ── Resolution (content field of decision_bundle_resolved) ──────────
//
// Emitted by DecisionRouter when the webview posts `decisionBundleSubmit`.
// Everything the user decided lives on this one record — the phase
// handler shouldn't have to sweep the stream for mirror_approved /
// menu_selection records to reconstruct what happened.

export type MirrorDecisionAction = 'accepted' | 'rejected' | 'edited' | 'deferred';

export interface MirrorItemDecision {
  item_id: string;
  action: MirrorDecisionAction;
  /**
   * Set when action='edited'. Inline edits are buffered in the webview
   * and only committed on Submit — so every edited row arrives here
   * with its final text, not a sequence of per-keystroke records.
   */
  edited_text?: string;
}

export interface MenuOptionSelection {
  option_id: string;
  /** Free-text answer when option_id === '_OTHER'. */
  free_text?: string;
}

export interface DecisionBundleCounters {
  mirror_accepted: number;
  mirror_rejected: number;
  mirror_edited: number;
  mirror_deferred: number;
  menu_selected: number;
}

export interface DecisionBundleResolution {
  surface_id: string;
  /** The decision_bundle_presented record id this resolves. */
  target_record_id: string;
  mirror_decisions: MirrorItemDecision[];
  menu_selections: MenuOptionSelection[];
  counters: DecisionBundleCounters;
}

/**
 * Tally counters from the per-item / per-option decisions. Kept as a
 * free function so both the producer-side tests and the DecisionRouter
 * can call it without instantiating anything.
 */
export function computeBundleCounters(
  mirrorDecisions: MirrorItemDecision[],
  menuSelections: MenuOptionSelection[],
): DecisionBundleCounters {
  const counters: DecisionBundleCounters = {
    mirror_accepted: 0,
    mirror_rejected: 0,
    mirror_edited: 0,
    mirror_deferred: 0,
    menu_selected: menuSelections.length,
  };
  for (const d of mirrorDecisions) {
    switch (d.action) {
      case 'accepted': counters.mirror_accepted++; break;
      case 'rejected': counters.mirror_rejected++; break;
      case 'edited':   counters.mirror_edited++; break;
      case 'deferred': counters.mirror_deferred++; break;
    }
  }
  return counters;
}

/**
 * Count items pending a decision. Submit stays disabled until every
 * Mirror item has an action AND (if the Menu is present) at least one
 * option is selected. This is where the "user can't miss a section"
 * invariant lives.
 */
export function countPendingInBundle(
  content: DecisionBundleContent,
  mirrorDecisions: MirrorItemDecision[],
  menuSelections: MenuOptionSelection[],
): { pendingMirror: number; pendingMenu: number; submittable: boolean } {
  const mirrorTotal = content.mirror?.items.length ?? 0;
  const decidedMirrorIds = new Set(mirrorDecisions.map(d => d.item_id));
  const pendingMirror = Math.max(0, mirrorTotal - decidedMirrorIds.size);

  const menuRequired = !!content.menu && content.menu.options.length > 0;
  const pendingMenu = menuRequired && menuSelections.length === 0 ? 1 : 0;

  return {
    pendingMirror,
    pendingMenu,
    submittable: pendingMirror === 0 && pendingMenu === 0,
  };
}
