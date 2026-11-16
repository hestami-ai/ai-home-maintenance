// ⭐⭐ `JAN-EXEC` Phase 7, package L17a — design D72 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.26; `REG-D-166` (1), (2), (5);
// `REG-F-643`; `REG-F-212`) — A DEFECT A LATER CHECK FINDS GOES BACK TO THE UNIT THAT MADE IT, BY REPLACEMENT: WHAT THE PAGE OFFERS, AND
// THE REPLACEMENT IT MAKES, READ FROM THE RECORD.
//
// ⛔ WHAT WAS WRONG (`REG-F-643`). P6 again's ninth run accepted Source Construction's work, and End-to-End Verification, two levels on, was
// rejected for a defect in it; D71's re-run redid only the verification's own work. Canon's route is replacement (`JPWB-DOC-003` STA-7, PER-8):
// the unit the work is sent back to and every started unit its work reached are replaced by new units of their types, each old one superseded
// and kept on record with a link to its successor (D72).
// ⭑ WHAT IS READ HERE, AND WHY HERE: the page offers the act, and the route's action accepts it, by ONE reading (`sendBackOffer`), so the page
// never offers what the server refuses; the replacement's commands are built from the record by one planner (`replacementPlan`), and the
// kernel refuses each supersession without its successor and its Decision (`supersedePwu`, `resolveSupersession`).
// ⚠ L17a BUILDS THE PERSON'S CHOICE: the target is chosen by the person among the candidates D72 names; the Hypothesizer's naming and the
// Historian's rule in front of it are package L17b's.
import { listByType, listExecutionPlans, listPwus, type EngineHandle } from '@janumipwb/rph-engine';
import {
	effectiveDependencyIds,
	effectiveParentId,
	isCurrentUnit,
	replacementCandidates,
	replacementReach,
	successorLinkOf,
	type ReachUnit
} from '@janumipwb/rph-projections';
import { acceptedWorkFile } from '@janumipwb/rph-application';
import { ProfessionalWorkUnitSchema, type ProposePwuPayload } from '@janumipwb/rph-contracts';
import { governingDeclaredPolicies, latestDeclaredVerdicts, type LatestDeclaredVerdict } from '../assurance/declared-policy-signoff.js';

/** ⭐ D72 — the option a person's sending of the work back selects, on its Decision: a free string, as `RERUN_REJECTED_WORK`. */
export const REPLACE_REACHED_WORK = 'REPLACE_REACHED_WORK';

/** One unit the work may be sent back to: its id, and its title as the page shows it. */
export interface SendBackCandidate {
	readonly id: string;
	readonly title: string;
}

/** ⭐ D72 — what the page offers a unit its declared reviews rejected, whose work used other units' work. */
export interface SendBackOffer {
	/** The governing declared policies' latest verdicts over the unit that are REJECTED, in the selection's order. */
	readonly rejected: readonly LatestDeclaredVerdict[];
	/** The rejecting verdicts' observations — what the person's Decision considered (RD4, as D71's). */
	readonly consideredObservationIds: readonly string[];
	/** The units whose work its work used, in the Undertaking's order (`replacementCandidates`). */
	readonly candidates: readonly SendBackCandidate[];
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/**
 * ⭐ D72 — THE UNDERTAKING'S CURRENT UNITS AS THE CANDIDATES AND THE REACH READ THEM: each unit not superseded, its parent and its dependencies
 * read through the supersession links, and whether it has started (it holds an execution plan) — in the store's order.
 */
export function reachUnitsOf(engine: EngineHandle, undertakingId: string): ReachUnit[] {
	const units = listPwus(engine, undertakingId);
	const successorOf = (id: string): string | undefined => successorLinkOf(units.find((u) => u.id === id)?.state);
	const planned = new Set(listExecutionPlans(engine).map((p) => String((p.state.workUnitId ?? '') as string)));
	return units
		.filter((u) => isCurrentUnit(String((u.state.workLifecycleState ?? '') as string)))
		.map((u) => ({
			id: u.id,
			parentId: effectiveParentId(String((u.state.parentWorkUnitId ?? '') as string) || undefined, successorOf),
			dependencyIds: effectiveDependencyIds(strings(u.state.dependencyIds), successorOf),
			started: planned.has(u.id)
		}));
}

/**
 * ⭐⭐ D72 — WHETHER A PERSON MAY SEND THE WORK OF `pwuId` BACK TO AN EARLIER UNIT, AND TO WHICH: read from the record. ⛔ Refused, with why,
 * unless the unit is in D71's rejected state — UNDER_ASSURANCE with its execution SUCCEEDED and its assurance REJECTED — and at least one
 * governing declared policy's latest verdict over it is REJECTED; and unless its work used another unit's work (a candidate). ⭑ The unit's own
 * re-run in place stays D71's act (`rejectedRerunOffer`), unchanged. ⚠ The builder's reading, ruled: no `workDischarge` is asked — D71's
 * amendment is about re-running a unit's OWN work, and this act sends the work to another unit.
 */
export function sendBackOffer(engine: EngineHandle, pwuId: string): SendBackOffer | { readonly refusedBecause: string } {
	const unit = engine.loadObject(pwuId)?.state as
		| { workLifecycleState?: unknown; executionState?: unknown; assuranceState?: unknown; undertakingId?: unknown }
		| undefined;
	if (unit?.workLifecycleState !== 'UNDER_ASSURANCE' || unit.executionState !== 'SUCCEEDED' || unit.assuranceState !== 'REJECTED')
		return {
			refusedBecause:
				`the unit is ${String(unit?.workLifecycleState ?? 'unknown')} with its execution ${String(unit?.executionState ?? 'unknown')} ` +
				`and its assurance ${String(unit?.assuranceState ?? 'unknown')}; only a unit its declared reviews rejected at its sign-off ` +
				'(UNDER_ASSURANCE, SUCCEEDED, REJECTED) may have its work sent back to an earlier unit (REG-D-166 (1))'
		};
	const { policies } = governingDeclaredPolicies(engine, pwuId);
	const latest = latestDeclaredVerdicts(
		engine,
		pwuId,
		policies.map((p) => p.policyId)
	);
	const rejected = policies.flatMap((p) => {
		const verdict = latest.get(p.policyId);
		return verdict?.state === 'REJECTED' ? [verdict] : [];
	});
	if (rejected.length === 0)
		return {
			refusedBecause:
				'no governing declared policy of this unit holds a REJECTED verdict over it, so its assurance was not rejected by its declared ' +
				'reviews at its sign-off, and nothing here may be sent back (REG-D-166 (1))'
		};
	const titleOf = (id: string): string => String(((engine.loadObject(id)?.state ?? {}) as { title?: unknown }).title ?? id);
	const candidates = replacementCandidates(reachUnitsOf(engine, String((unit.undertakingId ?? '') as string)), pwuId).map((id) => ({
		id,
		title: titleOf(id)
	}));
	if (candidates.length === 0)
		return {
			refusedBecause:
				'its work used no other unit’s work, so there is no earlier unit to send it back to; re-running its own work is a re-run in place (REG-D-163 (2))'
		};
	const verdictIds = new Set(rejected.map((v) => v.assessmentId));
	return {
		rejected,
		consideredObservationIds: listByType(engine, 'ASSURANCE_OBSERVATION')
			.filter((o) => verdictIds.has(String((o.state.assessmentId ?? '') as string)))
			.map((o) => o.id),
		candidates
	};
}

/** ⭐ D72 — one unit the replacement supersedes: its id, its successor's, its title (the successor's too), and the state it was in. */
export interface ReplacedUnit {
	readonly oldId: string;
	readonly newId: string;
	readonly title: string;
	/** Its work lifecycle state before the act: an accepted unit had an accepted-work file, which the act overwrites with a notice. */
	readonly oldState: string;
}

/** ⭐ D72 — one new composite's decomposition, proposed and validated over its children, as the Undertaking's creation does. */
export interface ReplacementDecomposition {
	readonly parentWorkUnitId: string;
	readonly childWorkUnitIds: readonly string[];
	readonly rationale: string;
	readonly siblingDependencyIds: readonly string[];
}

/** ⭐ D72 — the replacement, as commands' payloads: the units it supersedes, the new units, and the new composites' decompositions. */
export interface ReplacementPlan {
	/** Each unit in the reach, parents before children, with its successor. */
	readonly replaced: readonly ReplacedUnit[];
	/** Each new unit's proposal, in the same order: a proposed parent exists before its children (`pwu.ts`, PWU-003). */
	readonly proposals: readonly ProposePwuPayload[];
	readonly decompositions: readonly ReplacementDecomposition[];
}

/**
 * ⭐⭐ D72 — THE REPLACEMENT OF SENDING THE WORK BACK TO `targetId`: the reach (`replacementReach`), ordered parents before children (by depth in
 * the current tree, then the Undertaking's order); for each unit in it, a new unit of its type with the old one's shape — every proposal field
 * copied, its parent and its dependencies pointing at the new units where those were replaced and at the live units where they were kept, and
 * its expected output's id minted afresh, as every production site mints it (`out_<pwuId>`; the builder's reading, ruled); and for each new unit
 * with children, its decomposition over its current children — the new ones and any kept one, which follows through the link — with the
 * sibling dependencies `unitDependencies` would name. ⚠ The caller has checked that `targetId` is a candidate (`sendBackOffer`).
 */
export function replacementPlan(
	engine: EngineHandle,
	targetId: string,
	mint: (prefix: string) => string
): ReplacementPlan | { readonly refusedBecause: string } {
	const undertakingId = String(((engine.loadObject(targetId)?.state ?? {}) as { undertakingId?: unknown }).undertakingId ?? '');
	const units = reachUnitsOf(engine, undertakingId);
	const byId = new Map(units.map((u) => [u.id, u]));
	const position = new Map(units.map((u, i) => [u.id, i]));
	const depthOf = (id: string): number => {
		let depth = 0;
		for (let p = byId.get(id)?.parentId; p !== undefined && depth <= units.length; p = byId.get(p)?.parentId) depth += 1;
		return depth;
	};
	const reach = replacementReach(units, targetId).sort(
		(a, b) => depthOf(a) - depthOf(b) || position.get(a)! - position.get(b)!
	);
	const newIdOf = new Map(reach.map((id) => [id, mint('pwu')]));
	const mapped = (id: string): string => newIdOf.get(id) ?? id;
	const replaced: ReplacedUnit[] = [];
	const proposals: ProposePwuPayload[] = [];
	for (const oldId of reach) {
		const parsed = ProfessionalWorkUnitSchema.safeParse(engine.loadObject(oldId)?.state);
		if (!parsed.success) return { refusedBecause: `the record of ${oldId} does not parse as a work unit, so its shape cannot be copied` };
		const old = parsed.data;
		const unit = byId.get(oldId)!;
		const newId = newIdOf.get(oldId)!;
		replaced.push({ oldId, newId, title: old.title, oldState: old.workLifecycleState });
		proposals.push({
			pwuId: newId,
			pwuKind: old.pwuKind,
			title: old.title,
			description: old.description,
			intentId: old.intentId,
			...(unit.parentId === undefined ? {} : { parentWorkUnitId: mapped(unit.parentId) }),
			boundaries: old.boundaries,
			obligationIds: old.obligationIds,
			constraintIds: old.constraintIds,
			assumptionIds: old.assumptionIds,
			expectedOutputs: old.expectedOutputs.map((o) => (o.outputId === `out_${oldId}` ? { ...o, outputId: `out_${newId}` } : o)),
			assurancePolicyIds: old.assurancePolicyIds,
			riskProfile: old.riskProfile,
			...(old.undertakingId === undefined ? {} : { undertakingId: old.undertakingId }),
			...(old.pwuTypeId === undefined ? {} : { pwuTypeId: old.pwuTypeId }),
			...(old.isLocalExtension === undefined ? {} : { isLocalExtension: old.isLocalExtension }),
			dependencyIds: unit.dependencyIds.map(mapped),
			inputRequirements: old.inputRequirements
		});
	}
	// ⭐ Each replaced composite's successor is decomposed over the children it has in the new composition: the current children of the old
	// composite, each mapped to its successor where it was replaced, a kept one as it is (the lead's ruling on the builder's reading).
	const decompositions = reach.flatMap((oldId): ReplacementDecomposition[] => {
		const children = units.filter((u) => u.parentId === oldId);
		if (children.length === 0) return [];
		const childIds = children.map((c) => mapped(c.id));
		const depsOf = new Map(children.map((c) => [mapped(c.id), c.dependencyIds.map(mapped)]));
		return [
			{
				parentWorkUnitId: mapped(oldId),
				childWorkUnitIds: childIds,
				rationale: `Proposed at the replacement of ${oldId} by ${mapped(oldId)} (design D72; REG-D-166 (1)): its children in the current composition.`,
				siblingDependencyIds: childIds.filter((c) => childIds.some((o) => o !== c && (depsOf.get(o) ?? []).includes(c)))
			}
		];
	});
	return { replaced, proposals, decompositions };
}

/**
 * ⭐⭐ D72, AS THE LEAD RULED IT (option D) — THE WORDS A SUPERSEDED UNIT'S ACCEPTED-WORK FILE HOLDS AFTER THE ACT, in place of its work: the
 * port has no removal, and `purge` is refused on a workspace RETAINED_BY_PARTICIPATION (`workspace-host.ts`), so the file is overwritten
 * through `writeFile` — and a model reads only current work in `.jpwb/accepted/`. The superseded work's bytes stay in the content store.
 */
export function supersededWorkNotice(n: {
	readonly title: string;
	readonly unitId: string;
	readonly successorId: string;
	readonly decisionId: string;
}): string {
	return [
		`This file held the accepted work of "${n.title}" (${n.unitId}). That work was superseded by the replacement the sponsor's ruling REG-D-166 (1) provides (design D72): "${n.title}" (${n.successorId}) takes its place, under the person's Decision ${n.decisionId}.`,
		`The successor's own accepted work is written to ${acceptedWorkFile(n.title, n.successorId)} when it is accepted.`,
		'The superseded work is no longer in this file; its bytes stay in the workbench’s content store.',
		''
	].join('\n');
}
