// WHICH POLICIES GOVERN A PWU — DECLARED ∩ DETERMINED (REG-F-029).
//
// ── WHY IT IS A MODULE AND NOT A CLOSURE ─────────────────────────────────────────────────────────────────────
// This began inside `driveReferenceUndertaking`, which made it untestable except through a 400-command drive.
// An adversarial review then measured branch coverage over BOTH drive paths and found the exclusion branches at
// ZERO — no policy is ever excluded by either drive, so the DETERMINED half was an identity function on every
// input it had ever had, and "the drive passes the §5.1 precondition BY CONSTRUCTION" was indistinguishable from
// a check that re-derives what it checks. That is this repository's documented failure mode stated as a virtue.
//
// Extracted so the exclusions can be exercised directly, against the real seeded data, by a test that does not
// need a drive to reach them. `select()` RETURNS its exclusions rather than discarding them: a governance
// decision nobody can read is the shape half this register is about.
//
// ── THE TWO HALVES ───────────────────────────────────────────────────────────────────────────────────────────
// DECLARED — the PWU's own `assurancePolicyIds` plus its PWU Type's `requiredAssurancePolicyIds`.
// DETERMINED — of those, the ones that EXIST, are ACTIVE, and whose DOC-004 §5.1 rule admits this subject, using
// the same `policyApplicability` kernel (and the same DOC-007 §18 expression evaluator) that
// `RequestAssuranceAssessment` runs. Same function, same data, so the two cannot answer differently.
import { evaluateApplicability } from '@janumipwb/rph-assurance';
import { applicabilityPermitsAssessment, policyApplicability } from '@janumipwb/rph-domain';
import type { EngineHandle } from './engine.js';

export interface GoverningPolicies {
	/** Policies that govern this PWU and may therefore assess it. */
	readonly selected: readonly string[];
	/** Everything DECLARED that did not survive, each with the reason — never silently dropped. */
	readonly excluded: ReadonlyArray<{ readonly policyId: string; readonly reason: string }>;
	/** The union before determination, for callers that need to show what was claimed vs what held. */
	readonly declared: readonly string[];
}

/** Compute DECLARED ∩ DETERMINED for one PWU. Pure w.r.t. the store: reads objects, writes nothing. */
export function selectGoverningPolicies(handle: EngineHandle, pwuId: string): GoverningPolicies {
	const pwu = handle.loadObject(pwuId)?.state as
		| { pwuKind?: string; pwuTypeId?: string; assurancePolicyIds?: string[]; tags?: string[] }
		| undefined;
	const viaType = pwu?.pwuTypeId
		? ((
				handle.loadObject(pwu.pwuTypeId)?.state as
					{ requiredAssurancePolicyIds?: string[] } | undefined
			)?.requiredAssurancePolicyIds ?? [])
		: [];
	const declared = [...new Set([...(pwu?.assurancePolicyIds ?? []), ...viaType])];
	const excluded: Array<{ policyId: string; reason: string }> = [];
	const selected: string[] = [];

	for (const policyId of declared) {
		const pol = handle.loadObject(policyId)?.state as
			{ status?: string; applicability?: unknown; applicableObjectTypes?: string[] } | undefined;
		if (!pol) {
			excluded.push({ policyId, reason: 'ABSENT — declared but not an object in the store' });
			continue;
		}
		if (pol.status !== 'ACTIVE') {
			excluded.push({ policyId, reason: `NOT_ACTIVE — status is ${String(pol.status)}` });
			continue;
		}
		const outcome = policyApplicability(
			// A policy created before `applicability` existed carries only `applicableObjectTypes`; deriving the
			// rule from it is what lets one determination read both shapes.
			pol.applicability ?? { objectTypeConditions: pol.applicableObjectTypes },
			{
				objectType: 'PROFESSIONAL_WORK_UNIT',
				...(pwu?.pwuKind ? { pwuKind: pwu.pwuKind } : {}),
				...(pwu?.tags ? { tags: pwu.tags } : {})
			},
			(expr, subj) => evaluateApplicability(expr as never, subj)
		);
		if (applicabilityPermitsAssessment(outcome)) selected.push(policyId);
		else excluded.push({ policyId, reason: outcome });
	}
	return { selected, excluded, declared };
}

/**
 * The drive's form: the selection, or a loud failure naming what was declared and why none of it survived.
 *
 * An empty selection is not a quiet `[]`. A PWU nothing can assess cannot be driven to a disposition —
 * RPH-PWU-006 requires an assessment behind one — so returning empty here would surface as a missing assessment
 * several layers away, or as a PWU driven to SATISFIED with nothing backing it.
 */
export function requireGoverningPolicies(handle: EngineHandle, pwuId: string): readonly string[] {
	const { selected, excluded, declared } = selectGoverningPolicies(handle, pwuId);
	if (selected.length === 0) {
		const kind = (handle.loadObject(pwuId)?.state as { pwuKind?: string } | undefined)?.pwuKind;
		const excludedList = excluded.map((e) => `${e.policyId}: ${e.reason}`).join('; ') || 'n/a';
		throw new Error(
			`No policy governs ${pwuId} (${String(kind)}). Declared [${declared.join(', ') || 'nothing'}]; ` +
				`excluded [${excludedList}]. A PWU nothing ` +
				`can assess cannot be driven to a disposition — RPH-PWU-006 requires an assessment behind it.`
		);
	}
	return selected;
}
