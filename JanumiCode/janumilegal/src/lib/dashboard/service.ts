/**
 * Dashboard data layer.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 7 §7.3 and
 * docs/janumilegal_multi_matter_isolation_addendum.md §8.
 *
 * Builds the structured data that the Svelte webview renders. The data layer
 * is the only layer that may consume CLV / matter context / state outputs;
 * the Svelte view is purely presentational.
 *
 * The Matter Header Bar carries: client name, matter name, active lens,
 * procedural posture, release-status badge, and a deterministic color hash
 * derived from the matter id (per §8.1 — color reinforces context).
 */

import { createHash } from 'node:crypto';
import type { Scope } from '../database/types.js';
import type { ActivationDal } from '../database/activationDal.js';
import type { DashboardDal } from '../database/dashboardDal.js';

export interface MatterHeaderBarData {
  readonly clientName: string;
  readonly matterName: string;
  readonly practiceArea: string;
  readonly proceduralPosture?: string;
  readonly activeLens?: { lensId: string; lensVersion: string };
  readonly colorHashHex: string; // 6-hex deterministic color derived from matter id
  readonly readOnly: boolean; // for cross-matter dashboards
}

export interface MatterListEntry {
  readonly scope: Scope;
  readonly matterName: string;
  readonly clientName: string;
  readonly practiceArea: string;
  readonly status: 'open' | 'closed';
}

export interface CrossMatterDashboardData {
  readonly chrome: 'cross_matter_read_only';
  readonly matters: readonly MatterListEntry[];
}

/**
 * Wave 7 dashboard service. Reads matter metadata for the Matter Header Bar
 * and the user's accessible matter list (with screened matters already
 * filtered out at the FirmDal layer).
 */
export class DashboardService {
  constructor(
    private readonly dashboardDal: DashboardDal,
    private readonly activationDal: ActivationDal,
  ) {}

  buildMatterHeaderBar(scope: Scope, opts: { readOnly?: boolean } = {}): MatterHeaderBarData | undefined {
    const r = this.dashboardDal.matterHeader(scope);
    if (!r) return undefined;
    const activation = this.dashboardDal.activeLens(scope);
    return {
      clientName: r.clientName,
      matterName: r.matterName,
      practiceArea: r.practiceArea,
      proceduralPosture: r.proceduralPosture ?? undefined,
      activeLens: activation ?? undefined,
      colorHashHex: deterministicColor(scope),
      readOnly: opts.readOnly ?? false,
    };
  }

  /** Cross-matter dashboard — read-only, distinct chrome. No actions on this surface. */
  buildCrossMatterDashboard(firmId: string, accessibleScopes: readonly Scope[]): CrossMatterDashboardData {
    const matters: MatterListEntry[] = [];
    for (const s of accessibleScopes) {
      const r = this.dashboardDal.matterListEntry(s);
      if (r) {
        matters.push({
          scope: s,
          matterName: r.matterName,
          clientName: r.clientName,
          practiceArea: r.practiceArea,
          status: r.status,
        });
      }
    }
    void firmId;
    return { chrome: 'cross_matter_read_only', matters };
  }

  /** Lens state machine view data: completed states + remaining required states. */
  buildLensStateView(scope: Scope, activationId: string): { completed: readonly string[]; remaining: readonly string[] } {
    const completed = this.activationDal.listCompletedStates(scope, activationId);
    // Remaining computation is left to the orchestrator at runtime; the
    // dashboard returns the snapshot only.
    return { completed, remaining: [] };
  }
}

function deterministicColor(scope: Scope): string {
  // Stable 6-hex color from matter id (per multi-matter §8.1: deterministic,
  // accessibility-aware). We pick from a constrained palette so all colors
  // are sufficiently saturated and distinguishable.
  const PALETTE_HEX = ['1f6feb', '8957e5', 'd29922', 'cf222e', '2da44e', 'bf3989', '0969da', 'a40e26'];
  const h = createHash('sha256').update(scope.matterId).digest();
  const idx = h[0] % PALETTE_HEX.length;
  return PALETTE_HEX[idx];
}
