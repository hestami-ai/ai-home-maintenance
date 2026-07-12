// M9 conformance: decomposition / recomposition + obligation·constraint·assumption enforcement.
// Each test binds to a numbered conformance test (RPH-DEC-*, RPH-CNS-*, RPH-ASM-*) or a named property
// (P2/P3) from the Executable Invariant & Conformance Test Spec, using the canonical Reference Undertaking
// fixture ids (the field-service-management product realization) where the scenario is instance-specific.
import { describe, expect, it } from 'vitest';
import {
	assessAcceptance,
	assessFalsification,
	blocksIrreversibleWork,
	canAuthorizeNewWork,
	evaluateRecomposition,
	requiresReification,
	validateAssumptionReification,
	validateConstraintPropagation,
	validateDecomposition,
	validateObligationConservation,
	type ConstraintDispositionRecord,
	type ObligationConservationInput,
	type ParentConstraint,
	type ParentObligation
} from './index.js';

// ---- Fixture fragment (Reference Undertaking §13/§6): the 5 mandatory architecture obligations, their
// allocations, and the 4 constraints (3 MANDATORY + 1 PREFERRED). ----
const ARCH_OBLIGATIONS: readonly ParentObligation[] = [
	{ obligationId: 'obl_fsm_arch_cover_requirements', strength: 'MANDATORY' },
	{ obligationId: 'obl_fsm_arch_isolate_tenants', strength: 'MANDATORY' },
	{ obligationId: 'obl_fsm_arch_preserve_audit', strength: 'MANDATORY' },
	{ obligationId: 'obl_fsm_arch_support_mobile', strength: 'MANDATORY' },
	{ obligationId: 'obl_fsm_arch_support_extensions', strength: 'MANDATORY' }
];
const ALL_ALLOCATED = ARCH_OBLIGATIONS.map((o) => o.obligationId);

// Fixture §13 constraintPropagations: each constraint's relevant children.
const REL = {
	con_fsm_multitenancy: [
		'pwu_fsm_arch_multitenancy',
		'pwu_fsm_arch_data',
		'pwu_fsm_arch_integrations'
	],
	con_fsm_auditability: ['pwu_fsm_arch_data'],
	con_fsm_extensibility: ['pwu_fsm_arch_context', 'pwu_fsm_arch_data'],
	con_fsm_mobile_ready: ['pwu_fsm_arch_mobile']
};
const ARCH_CONSTRAINTS: readonly ParentConstraint[] = [
	{
		constraintId: 'con_fsm_multitenancy',
		strength: 'MANDATORY',
		applicable: true,
		relevantChildWorkUnitIds: REL.con_fsm_multitenancy
	},
	{
		constraintId: 'con_fsm_auditability',
		strength: 'MANDATORY',
		applicable: true,
		relevantChildWorkUnitIds: REL.con_fsm_auditability
	},
	{
		constraintId: 'con_fsm_extensibility',
		strength: 'MANDATORY',
		applicable: true,
		relevantChildWorkUnitIds: REL.con_fsm_extensibility
	},
	{
		constraintId: 'con_fsm_mobile_ready',
		strength: 'PREFERRED',
		applicable: true,
		relevantChildWorkUnitIds: REL.con_fsm_mobile_ready
	}
];
// Every mandatory constraint propagated to ALL its relevant children (the fixture happy path).
const ALL_PROPAGATED: readonly ConstraintDispositionRecord[] = [
	{
		constraintId: 'con_fsm_multitenancy',
		disposition: 'PROPAGATED',
		childWorkUnitIds: REL.con_fsm_multitenancy
	},
	{
		constraintId: 'con_fsm_auditability',
		disposition: 'PROPAGATED',
		childWorkUnitIds: REL.con_fsm_auditability
	},
	{
		constraintId: 'con_fsm_extensibility',
		disposition: 'PROPAGATED',
		childWorkUnitIds: REL.con_fsm_extensibility
	}
];

function conservation(
	over: Partial<ObligationConservationInput> = {}
): ObligationConservationInput {
	return {
		parentObligations: ARCH_OBLIGATIONS,
		allocatedObligationIds: ALL_ALLOCATED,
		retainedObligationIds: [],
		satisfiedObligationIds: [],
		authorizedWaiverObligationIds: [],
		...over
	};
}

describe('M9 obligation conservation (§35.1, Property P2; RPH-DEC-002/007)', () => {
	it('RPH-DEC-002: a mandatory obligation with no disposition => MISSING_OBLIGATION_ALLOCATION', () => {
		const r = validateObligationConservation(
			conservation({ allocatedObligationIds: ALL_ALLOCATED.slice(1) })
		);
		expect(r.ok).toBe(false);
		expect(r.findings).toEqual([
			{ code: 'MISSING_OBLIGATION_ALLOCATION', obligationId: 'obl_fsm_arch_cover_requirements' }
		]);
	});

	it('each of the four dispositions independently satisfies conservation', () => {
		const [a, b, c, d, e] = ALL_ALLOCATED;
		const r = validateObligationConservation({
			parentObligations: ARCH_OBLIGATIONS,
			allocatedObligationIds: [a!],
			retainedObligationIds: [b!],
			satisfiedObligationIds: [c!],
			authorizedWaiverObligationIds: [d!, e!]
		});
		expect(r.ok).toBe(true);
		expect(r.dispositions.get(b!)).toEqual(['RETAINED']);
		expect(r.dispositions.get(c!)).toEqual(['SATISFIED']);
	});

	it('CONDITIONAL / ADVISORY obligations are not conservation-gated', () => {
		const r = validateObligationConservation({
			parentObligations: [
				{ obligationId: 'obl_soft', strength: 'ADVISORY' },
				{ obligationId: 'obl_cond', strength: 'CONDITIONAL' }
			],
			allocatedObligationIds: [],
			retainedObligationIds: [],
			satisfiedObligationIds: [],
			authorizedWaiverObligationIds: []
		});
		expect(r.ok).toBe(true);
		expect(r.findings).toEqual([]);
	});

	// RPH-DEC-007 / Property P2: for every partition of mandatory obligations across the four dispositions,
	// conservation holds iff every mandatory obligation lands in >= 1 disposition. Exhaustive over 3^n here
	// (each obligation: unaccounted | allocated | retained) — a deterministic stand-in for PBT.
	it('Property P2: conservation holds iff no mandatory obligation is unaccounted (exhaustive)', () => {
		const obs = ARCH_OBLIGATIONS.slice(0, 4);
		const choices = [0, 1, 2]; // 0 = unaccounted, 1 = allocated, 2 = retained
		let checked = 0;
		const rec = (i: number, alloc: string[], ret: string[]): void => {
			if (i === obs.length) {
				const anyUnaccounted = obs.some(
					(o) => !alloc.includes(o.obligationId) && !ret.includes(o.obligationId)
				);
				const r = validateObligationConservation({
					parentObligations: obs,
					allocatedObligationIds: alloc,
					retainedObligationIds: ret,
					satisfiedObligationIds: [],
					authorizedWaiverObligationIds: []
				});
				expect(r.ok).toBe(!anyUnaccounted);
				checked++;
				return;
			}
			for (const c of choices) {
				rec(
					i + 1,
					c === 1 ? [...alloc, obs[i]!.obligationId] : alloc,
					c === 2 ? [...ret, obs[i]!.obligationId] : ret
				);
			}
		};
		rec(0, [], []);
		expect(checked).toBe(3 ** obs.length);
	});
});

describe('M9 constraint propagation (§11.2, Property P3; RPH-CNS-001..004, RPH-DEC-003)', () => {
	// One MANDATORY constraint used across the ad-hoc records below; covering all its relevant children.
	const MT = ARCH_CONSTRAINTS[0]!; // con_fsm_multitenancy, relevant to 3 children
	const mtRecord = (over: Partial<ConstraintDispositionRecord>): ConstraintDispositionRecord => ({
		constraintId: 'con_fsm_multitenancy',
		disposition: 'PROPAGATED',
		childWorkUnitIds: REL.con_fsm_multitenancy,
		...over
	});

	it('RPH-DEC-003: dropping a whole mandatory constraint => SILENT_CONSTRAINT_DROP for each relevant child', () => {
		const r = validateConstraintPropagation({
			parentConstraints: ARCH_CONSTRAINTS,
			dispositions: ALL_PROPAGATED.slice(1) // drop con_fsm_multitenancy (a SECURITY constraint)
		});
		expect(r.ok).toBe(false);
		// one per uncovered relevant child of the dropped constraint
		for (const child of REL.con_fsm_multitenancy)
			expect(r.findings).toContainEqual({
				code: 'SILENT_CONSTRAINT_DROP',
				constraintId: 'con_fsm_multitenancy',
				childWorkUnitId: child
			});
	});

	it('RPH-DEC-003 (per-child): propagating a mandatory constraint to SOME but not all relevant children is a partial drop', () => {
		// Propagate con_fsm_multitenancy to only the first relevant child; B and C are silently omitted.
		const r = validateConstraintPropagation({
			parentConstraints: [MT],
			dispositions: [mtRecord({ childWorkUnitIds: [REL.con_fsm_multitenancy[0]!] })]
		});
		expect(r.ok).toBe(false);
		expect(r.findings).toEqual([
			{
				code: 'SILENT_CONSTRAINT_DROP',
				constraintId: 'con_fsm_multitenancy',
				childWorkUnitId: REL.con_fsm_multitenancy[1]
			},
			{
				code: 'SILENT_CONSTRAINT_DROP',
				constraintId: 'con_fsm_multitenancy',
				childWorkUnitId: REL.con_fsm_multitenancy[2]
			}
		]);
	});

	it('RPH-CNS-001: propagation to every relevant child preserving strength is accepted; a PREFERRED constraint may be dropped', () => {
		const r = validateConstraintPropagation({
			parentConstraints: ARCH_CONSTRAINTS,
			dispositions: ALL_PROPAGATED
		});
		expect(r.ok).toBe(true); // con_fsm_mobile_ready is PREFERRED, not gated
	});

	it('RPH-CNS-002: weakening a mandatory constraint without authority => finding; with authority => ok', () => {
		const weakenNoAuth = validateConstraintPropagation({
			parentConstraints: [MT],
			dispositions: [mtRecord({ propagatedStrength: 'ADVISORY' })]
		});
		expect(weakenNoAuth.findings).toContainEqual({
			code: 'CONSTRAINT_WEAKENED_WITHOUT_AUTHORITY',
			constraintId: 'con_fsm_multitenancy'
		});
		const weakenWithAuth = validateConstraintPropagation({
			parentConstraints: [MT],
			dispositions: [mtRecord({ propagatedStrength: 'ADVISORY', authorityDecisionId: 'dec_x' })]
		});
		expect(weakenWithAuth.ok).toBe(true);
	});

	it('RPH-CNS-003: INAPPLICABLE requires rationale AND authority basis', () => {
		const bad = validateConstraintPropagation({
			parentConstraints: [MT],
			dispositions: [mtRecord({ disposition: 'INAPPLICABLE', rationale: 'n/a' })]
		});
		expect(bad.findings).toContainEqual({
			code: 'INAPPLICABLE_WITHOUT_RATIONALE',
			constraintId: 'con_fsm_multitenancy'
		});
		const ok = validateConstraintPropagation({
			parentConstraints: [MT],
			dispositions: [
				mtRecord({ disposition: 'INAPPLICABLE', rationale: 'n/a', authorityDecisionId: 'dec_x' })
			]
		});
		expect(ok.ok).toBe(true);
	});

	it('WAIVED needs an authority decision; SUPERSEDED needs the replacement constraint', () => {
		const r = validateConstraintPropagation({
			parentConstraints: [MT, ARCH_CONSTRAINTS[1]!],
			dispositions: [
				mtRecord({ disposition: 'WAIVED' }),
				{
					constraintId: 'con_fsm_auditability',
					disposition: 'SUPERSEDED',
					childWorkUnitIds: REL.con_fsm_auditability
				}
			]
		});
		expect(r.findings).toContainEqual({
			code: 'WAIVED_WITHOUT_AUTHORITY',
			constraintId: 'con_fsm_multitenancy'
		});
		expect(r.findings).toContainEqual({
			code: 'SUPERSEDED_WITHOUT_REPLACEMENT',
			constraintId: 'con_fsm_auditability'
		});
	});

	it('RPH-CNS-004: an expired waiver no longer satisfies the disposition (review-required)', () => {
		const authorizedButExpired = validateConstraintPropagation({
			parentConstraints: [MT],
			dispositions: [
				mtRecord({ disposition: 'WAIVED', authorityDecisionId: 'dec_x', waiverExpired: true })
			]
		});
		expect(authorizedButExpired.findings).toContainEqual({
			code: 'WAIVED_EXPIRED',
			constraintId: 'con_fsm_multitenancy'
		});
		const authorizedLive = validateConstraintPropagation({
			parentConstraints: [MT],
			dispositions: [mtRecord({ disposition: 'WAIVED', authorityDecisionId: 'dec_x' })]
		});
		expect(authorizedLive.ok).toBe(true);
	});

	it('Property P3: RETAINED and well-formed dispositions each cover their relevant children (non-drop)', () => {
		const r = validateConstraintPropagation({
			parentConstraints: ARCH_CONSTRAINTS,
			dispositions: [
				{
					constraintId: 'con_fsm_multitenancy',
					disposition: 'RETAINED',
					childWorkUnitIds: REL.con_fsm_multitenancy
				},
				{
					constraintId: 'con_fsm_auditability',
					disposition: 'PROPAGATED',
					childWorkUnitIds: REL.con_fsm_auditability
				},
				{
					constraintId: 'con_fsm_extensibility',
					disposition: 'SUPERSEDED',
					childWorkUnitIds: REL.con_fsm_extensibility,
					supersededByConstraintId: 'con_stronger'
				}
			]
		});
		expect(r.ok).toBe(true);
	});
});

describe('M9 recomposition is not concatenation (§14.1; RPH-DEC-005/006)', () => {
	const REQUIRED_CHILDREN = [
		'pwu_fsm_arch_context',
		'pwu_fsm_arch_multitenancy',
		'pwu_fsm_arch_data',
		'pwu_fsm_arch_mobile',
		'pwu_fsm_arch_integrations'
	].map((id) => ({ childWorkUnitId: id, acceptable: true }));

	const CONFLICT_RULES = [
		{ conflictType: 'TENANT_IDENTITY_MISMATCH', action: 'REJECT_RECOMPOSITION' },
		{ conflictType: 'OFFLINE_AUDIT_CONFLICT', action: 'RESHAPE_MOBILE_ARCHITECTURE' }
	];

	it('RPH-DEC-006: all children individually SATISFIED but a tenant-identity conflict => CONFLICTED, parent NOT satisfied', () => {
		const r = evaluateRecomposition({
			requiredChildResults: REQUIRED_CHILDREN, // every child acceptable
			detectedConflicts: [
				{
					conflictType: 'TENANT_IDENTITY_MISMATCH',
					conflictingChildWorkUnitIds: ['pwu_fsm_arch_multitenancy', 'pwu_fsm_arch_data'],
					description: 'incompatible tenant identity models'
				}
			],
			conflictResolutionRules: CONFLICT_RULES,
			parentCompletionClaimSupported: true,
			parentConstraintsHoldAgainstWhole: true
		});
		expect(r.status).toBe('CONFLICTED');
		expect(r.parentSatisfied).toBe(false); // child satisfaction is necessary but not sufficient
		expect(r.event).toBe('RecompositionConflictDetected');
		expect(r.appliedResolutions).toEqual([
			{ conflictType: 'TENANT_IDENTITY_MISMATCH', action: 'REJECT_RECOMPOSITION' }
		]);
	});

	it('an unmapped conflict falls back to REJECT_RECOMPOSITION', () => {
		const r = evaluateRecomposition({
			requiredChildResults: REQUIRED_CHILDREN,
			detectedConflicts: [
				{ conflictType: 'UNKNOWN', conflictingChildWorkUnitIds: [], description: 'x' }
			],
			conflictResolutionRules: CONFLICT_RULES,
			parentCompletionClaimSupported: true,
			parentConstraintsHoldAgainstWhole: true
		});
		expect(r.appliedResolutions).toEqual([
			{ conflictType: 'UNKNOWN', action: 'REJECT_RECOMPOSITION' }
		]);
	});

	it('no conflict but a not-yet-acceptable child => INSUFFICIENT / RecompositionFailed', () => {
		const r = evaluateRecomposition({
			requiredChildResults: [
				...REQUIRED_CHILDREN.slice(1),
				{ childWorkUnitId: 'pwu_fsm_arch_context', acceptable: false }
			],
			detectedConflicts: [],
			conflictResolutionRules: CONFLICT_RULES,
			parentCompletionClaimSupported: true,
			parentConstraintsHoldAgainstWhole: true
		});
		expect(r.status).toBe('INSUFFICIENT');
		expect(r.event).toBe('RecompositionFailed');
		expect(r.unsatisfiedChildWorkUnitIds).toEqual(['pwu_fsm_arch_context']);
	});

	it('all children acceptable but the recomposed whole does not support the parent claim => INSUFFICIENT', () => {
		const r = evaluateRecomposition({
			requiredChildResults: REQUIRED_CHILDREN,
			detectedConflicts: [],
			conflictResolutionRules: CONFLICT_RULES,
			parentCompletionClaimSupported: false,
			parentConstraintsHoldAgainstWhole: true
		});
		expect(r.status).toBe('INSUFFICIENT');
		expect(r.parentSatisfied).toBe(false);
	});

	it('happy path: children acceptable, no conflict, whole supports parent claim => SATISFIED / RecompositionCompleted', () => {
		const r = evaluateRecomposition({
			requiredChildResults: REQUIRED_CHILDREN,
			detectedConflicts: [],
			conflictResolutionRules: CONFLICT_RULES,
			parentCompletionClaimSupported: true,
			parentConstraintsHoldAgainstWhole: true
		});
		expect(r.status).toBe('SATISFIED');
		expect(r.parentSatisfied).toBe(true);
		expect(r.event).toBe('RecompositionCompleted');
	});
});

describe('M9 assumption reification & lifecycle (§12; RPH-ASM-001..006)', () => {
	const material = {
		assumptionId: 'asm_fsm_001',
		materiality: 'MATERIAL',
		status: 'DISCLOSED',
		affectedObjectIds: ['int_fsm_001', 'pwu_fsm_behavior', 'pwu_fsm_arch']
	};

	it('materiality classifier: MATERIAL and CRITICAL are reification-worthy; IMMATERIAL is not', () => {
		expect(requiresReification('MATERIAL')).toBe(true);
		expect(requiresReification('CRITICAL')).toBe(true);
		expect(requiresReification('IMMATERIAL')).toBe(false);
	});

	it('RPH-ASM-001/002 + §35.1: a surfaced MATERIAL assumption left unreified => assessment rejected/incomplete', () => {
		// all material assumptions reified => ok
		const clean = validateAssumptionReification([
			{ assumptionId: 'asm_fsm_001', materiality: 'MATERIAL', reified: true },
			{ assumptionId: 'asm_imm', materiality: 'IMMATERIAL', reified: false } // immaterial need not reify
		]);
		expect(clean.ok).toBe(true);
		expect(clean.findings).toEqual([]);

		// a MATERIAL (and a CRITICAL) assumption still embedded only in prose => gate fails
		const hidden = validateAssumptionReification([
			{ assumptionId: 'asm_fsm_001', materiality: 'MATERIAL', reified: false },
			{ assumptionId: 'asm_crit', materiality: 'CRITICAL', reified: false }
		]);
		expect(hidden.ok).toBe(false);
		expect(hidden.findings).toEqual([
			{ code: 'UNREIFIED_MATERIAL_ASSUMPTION', assumptionId: 'asm_fsm_001' },
			{ code: 'UNREIFIED_MATERIAL_ASSUMPTION', assumptionId: 'asm_crit' }
		]);
	});

	it('RPH-ASM-003: human acceptance sets ACCEPTED, not VERIFIED (and the transition is legal)', () => {
		const o = assessAcceptance(material);
		expect(o.newStatus).toBe('ACCEPTED');
		expect(o.isVerified).toBe(false);
		expect(o.legalTransition).toBe(true);
	});

	it('RPH-ASM-004: falsification requires impact analysis over the affected objects (the fixture asm_fsm_001 set)', () => {
		const o = assessFalsification(material, ['ev_national_enterprise_requirement']);
		expect(o.newStatus).toBe('FALSIFIED');
		expect(o.impactAnalysisRequired).toBe(true);
		expect(o.event).toBe('AssumptionFalsified');
		expect(o.impactedObjectIds).toEqual(['int_fsm_001', 'pwu_fsm_behavior', 'pwu_fsm_arch']);
	});

	it('RPH-ASM-005: an unresolved CRITICAL assumption blocks irreversible work; verified/accepted unblocks', () => {
		expect(
			blocksIrreversibleWork({ ...material, materiality: 'CRITICAL', status: 'DISCLOSED' })
		).toBe(true);
		expect(
			blocksIrreversibleWork({ ...material, materiality: 'CRITICAL', status: 'VERIFIED' })
		).toBe(false);
		expect(
			blocksIrreversibleWork({ ...material, materiality: 'CRITICAL', status: 'ACCEPTED' })
		).toBe(false);
		expect(
			blocksIrreversibleWork({ ...material, materiality: 'MATERIAL', status: 'DISCLOSED' })
		).toBe(false);
	});

	it('RPH-ASM-006: EXPIRED / FALSIFIED / SUPERSEDED assumptions cannot authorize new work', () => {
		expect(canAuthorizeNewWork({ ...material, status: 'VERIFIED' })).toBe(true);
		expect(canAuthorizeNewWork({ ...material, status: 'EXPIRED' })).toBe(false);
		expect(canAuthorizeNewWork({ ...material, status: 'FALSIFIED' })).toBe(false);
	});
});

describe('M9 decomposition validation (composition) — §13.2; RPH-DEC-001..005', () => {
	const validInput = {
		obligations: conservation(),
		constraints: { parentConstraints: ARCH_CONSTRAINTS, dispositions: ALL_PROPAGATED },
		hasRecompositionContract: true,
		isMaterialDecomposition: true,
		childrenTraceToParent: true
	};

	it('RPH-DEC-001: fully allocated + propagated + recomposition contract present => VALID and permits PLANNED', () => {
		const r = validateDecomposition(validInput);
		expect(r.status).toBe('VALID');
		expect(r.findings).toEqual([]);
		expect(r.permitsParentPlanned).toBe(true);
	});

	it('RPH-DEC-002: a missing mandatory obligation makes the decomposition INVALID and blocks child execution', () => {
		const r = validateDecomposition({
			...validInput,
			obligations: conservation({ allocatedObligationIds: ALL_ALLOCATED.slice(1) })
		});
		expect(r.status).toBe('INVALID');
		expect(r.permitsParentPlanned).toBe(false);
		expect(r.findings.map((f) => f.code)).toContain('MISSING_OBLIGATION_ALLOCATION');
	});

	it('RPH-DEC-005: a material decomposition without a recomposition contract is INVALID', () => {
		const r = validateDecomposition({ ...validInput, hasRecompositionContract: false });
		expect(r.status).toBe('INVALID');
		expect(r.findings.map((f) => f.code)).toContain('MISSING_RECOMPOSITION_CONTRACT');
	});

	it('RPH-DEC-004: child intent divergence is REQUIRES_DECISION => CONDITIONALLY_VALID (still permits PLANNED)', () => {
		const r = validateDecomposition({ ...validInput, intentDivergentChildIds: ['pwu_rogue'] });
		expect(r.status).toBe('CONDITIONALLY_VALID');
		expect(r.permitsParentPlanned).toBe(true);
		expect(r.findings.map((f) => f.code)).toContain('CHILD_INTENT_DIVERGENCE');
	});

	it('§13.2: a child that does not trace to the parent is BLOCKING => INVALID', () => {
		const r = validateDecomposition({ ...validInput, childrenTraceToParent: false });
		expect(r.status).toBe('INVALID');
		expect(r.findings.map((f) => f.code)).toContain('CHILD_DOES_NOT_TRACE_TO_PARENT');
	});
});
