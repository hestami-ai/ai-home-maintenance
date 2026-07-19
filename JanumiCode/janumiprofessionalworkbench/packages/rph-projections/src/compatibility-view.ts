// W2-INC-3 (WP-2-006). The Compatibility read-model: each PWU's derived legacy-phase milestone label, FOLDED
// FROM EVENTS so it is rebuildable (RPH-PER-007). Master invariant 11 — "legacy phases SHALL become derived
// compatibility projections" — and DOC-006's own caveat ("this label MUST NOT be authoritative state; it is a
// derived projection"). The projection carries NO authority; nothing writes it and no command validates against it.
//
// SCOPE: this is the W2 BASELINE derivation (a stable kind → milestone map) proving the projection MECHANISM is
// derived + rebuildable. The full RPH-DOC-005 *versioned* derivation rules — milestone advancement as a PWU
// progresses through its work/execution/assurance axes — are the W5 master work package WP-5-003 ("Compatibility
// Milestone Derivation"); they layer on top of this projector's `handlerVersion` without changing its shape.
import type { CompatibilityMilestone, DomainEvent } from '@janumipwb/rph-contracts';
import type { Projector } from './projector.js';

// PWU kind -> legacy phase milestone. The Product Realization PWA's kinds map onto DOC-006's phase labels.
// Unknown kinds fall back to INTAKE (the entry milestone) rather than fabricate a later phase.
const KIND_TO_MILESTONE: Record<string, CompatibilityMilestone> = {
	PRODUCT_REALIZATION: 'INTAKE',
	INTENT_DEFINITION: 'INTAKE',
	PRODUCT_BEHAVIOR: 'PROPOSE',
	ARCHITECTURE: 'ARCHITECTURE',
	ARCHITECTURE_CONCERN: 'ARCHITECTURE',
	IMPLEMENTATION_PLANNING: 'PROPOSE',
	PRODUCT_IMPLEMENTATION: 'EXECUTE',
	INTEGRATED_VALIDATION: 'VALIDATE',
	BASELINE_PROMOTION: 'COMMIT'
};

/** Derive the baseline compatibility milestone for a PWU kind (WP-2-006; W5/WP-5-003 refines with axis state). */
export function milestoneForKind(pwuKind: string): CompatibilityMilestone {
	return KIND_TO_MILESTONE[pwuKind] ?? 'INTAKE';
}

export interface CompatibilityView {
	/** pwuId -> derived legacy-phase milestone label (a viewer's familiar phase, never authoritative state). */
	readonly milestoneByPwu: Record<string, CompatibilityMilestone>;
}

export const compatibilityProjector: Projector<CompatibilityView> = {
	name: 'compatibility',
	handlerVersion: 1,
	initial: () => ({ milestoneByPwu: {} }),
	apply: (view, event: DomainEvent) => {
		if (event.eventType !== 'PwuProposed') return view;
		const p = event.payload as { pwuId: string; pwuKind: string };
		return {
			milestoneByPwu: { ...view.milestoneByPwu, [p.pwuId]: milestoneForKind(p.pwuKind) }
		};
	}
};
