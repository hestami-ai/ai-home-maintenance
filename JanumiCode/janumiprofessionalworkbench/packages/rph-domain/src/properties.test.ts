// M12 property-based conformance (Conformance Spec §25, layer 4). Properties P1–P8 asserted GENERATIVELY with
// fast-check against the already-built domain kernels — the generative generalization of the deterministic
// per-milestone unit tests. Each property binds to its spec id. Pure (no I/O, no GPU/LLM).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
	applyPresentationChange,
	canSupersedeBaseline,
	classifyEvidenceInvalidation,
	decisionAuthorizesVersions,
	isPresentationOnlyChange,
	resolveIdempotency,
	satisfiesP1,
	TraceGraph,
	validateConstraintPropagation,
	validateObligationConservation,
	assertBaselineItemSetImmutable,
	type ConstraintDispositionRecord,
	type DecisionView,
	type ParentConstraint,
	type ParentObligation
} from './index.js';

const RUNS = 300;

// P1 — Execution never implies assurance: reaching workLifecycleState SATISFIED requires assuranceState
// SATISFIED, regardless of a SUCCEEDED execution (INV-5).
describe('Property P1 — execution never implies assurance (§25; RPH-PWU-005/007)', () => {
	it('a PWU is SATISFIED-consistent only when assuranceState is SATISFIED, whatever the execution state', () => {
		const state = fc.constantFrom(
			'NOT_PLANNED',
			'PLANNED',
			'QUEUED',
			'RUNNING',
			'SUCCEEDED',
			'FAILED'
		);
		const assurance = fc.constantFrom(
			'PENDING',
			'ASSESSING',
			'CONDITIONALLY_SATISFIED',
			'SATISFIED',
			'REJECTED'
		);
		fc.assert(
			fc.property(
				state,
				assurance,
				fc.constantFrom('PRESERVED', 'AT_RISK', 'VIOLATED'),
				(executionState, assuranceState, shapeIntegrityState) => {
					const axes = {
						workLifecycleState: 'SATISFIED',
						executionState,
						assuranceState,
						shapeIntegrityState
					};
					// satisfiesP1: if lifecycle claims SATISFIED, assurance MUST be SATISFIED — execution is irrelevant.
					expect(satisfiesP1(axes)).toBe(assuranceState === 'SATISFIED');
				}
			),
			{ numRuns: RUNS }
		);
	});
});

// P2 — every mandatory parent obligation has a valid disposition (conservation).
describe('Property P2 — obligation conservation (§25; RPH-DEC-007)', () => {
	it('conservation holds iff every MANDATORY obligation is allocated/retained/satisfied/waived', () => {
		const ids = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), {
			minLength: 1,
			maxLength: 8
		});
		fc.assert(
			fc.property(ids, fc.infiniteStream(fc.constantFrom(0, 1, 2, 3, 4)), (obIds, choices) => {
				const it2 = choices[Symbol.iterator]();
				const obligations: ParentObligation[] = obIds.map((id) => ({
					obligationId: id,
					strength: 'MANDATORY'
				}));
				const alloc: string[] = [],
					ret: string[] = [],
					sat: string[] = [],
					wai: string[] = [];
				for (const id of obIds) {
					switch (it2.next().value) {
						case 1:
							alloc.push(id);
							break;
						case 2:
							ret.push(id);
							break;
						case 3:
							sat.push(id);
							break;
						case 4:
							wai.push(id);
							break;
						// 0 => unaccounted
					}
				}
				const accountedAll = obIds.every(
					(id) => alloc.includes(id) || ret.includes(id) || sat.includes(id) || wai.includes(id)
				);
				const r = validateObligationConservation({
					parentObligations: obligations,
					allocatedObligationIds: alloc,
					retainedObligationIds: ret,
					satisfiedObligationIds: sat,
					authorizedWaiverObligationIds: wai
				});
				expect(r.ok).toBe(accountedAll);
			}),
			{ numRuns: RUNS }
		);
	});
});

// P3 — every mandatory applicable parent constraint persists to every relevant child.
describe('Property P3 — constraint non-drop (§25; RPH-CNS/RPH-DEC-003)', () => {
	it('non-drop holds iff every relevant child of every mandatory constraint is dispositioned', () => {
		const constraintIds = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 5 }), {
			minLength: 1,
			maxLength: 4
		});
		fc.assert(
			fc.property(
				constraintIds,
				fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 4 }),
				fc.infiniteStream(fc.boolean()),
				(cIds, childIds, covers) => {
					const children = [...new Set(childIds)];
					if (children.length === 0) return;
					const it2 = covers[Symbol.iterator]();
					const parentConstraints: ParentConstraint[] = cIds.map((id) => ({
						constraintId: id,
						strength: 'MANDATORY',
						applicable: true,
						relevantChildWorkUnitIds: children
					}));
					const dispositions: ConstraintDispositionRecord[] = [];
					let allCovered = true;
					for (const cId of cIds) {
						const covered = children.filter(() => it2.next().value);
						if (covered.length < children.length) allCovered = false;
						if (covered.length > 0)
							dispositions.push({
								constraintId: cId,
								disposition: 'PROPAGATED',
								childWorkUnitIds: covered
							});
					}
					const r = validateConstraintPropagation({ parentConstraints, dispositions });
					expect(r.ok).toBe(allCovered);
				}
			),
			{ numRuns: RUNS }
		);
	});
});

// P4 — invalidated evidence cannot silently back a claim: every SUPPORTS-linked claim is flagged REVALIDATION.
describe('Property P4 — evidence invalidation cascade (§25; CT-10)', () => {
	it('invalidating an evidence flags EXACTLY its own supported claims, excluding claims supported by other evidence', () => {
		// claim ids are prefixed so they can never collide with the evidence ids 'ev'/'ev2'.
		const claimName = fc.string({ minLength: 1, maxLength: 6 }).map((s) => `c_${s}`);
		const ours = fc.uniqueArray(claimName, { minLength: 0, maxLength: 6 });
		const decoys = fc.uniqueArray(claimName, { minLength: 0, maxLength: 4 });
		fc.assert(
			fc.property(ours, decoys, (ourClaims, decoyClaims) => {
				const g = new TraceGraph();
				g.addNode({ id: 'ev', objectType: 'EVIDENCE' });
				g.addNode({ id: 'ev2', objectType: 'EVIDENCE' }); // a DIFFERENT evidence — its claims must be excluded
				const claimSet = new Set([...ourClaims, ...decoyClaims]);
				for (const c of claimSet) g.addNode({ id: c, objectType: 'CLAIM' });
				for (const c of ourClaims)
					g.addLink({ id: `l_${c}`, relation: 'SUPPORTS', from: 'ev', to: c });
				for (const c of decoyClaims)
					if (!ourClaims.includes(c))
						g.addLink({ id: `d_${c}`, relation: 'SUPPORTS', from: 'ev2', to: c });
				const impacts = classifyEvidenceInvalidation(g, 'ev');
				// exactly ev's own supported claims — the from-filter must exclude ev2's decoys
				expect(new Set(impacts.map((i) => i.objectId))).toEqual(new Set(ourClaims));
				expect(impacts.every((i) => i.classification === 'REVALIDATION')).toBe(true);
			}),
			{ numRuns: RUNS }
		);
	});
});

// P5 — approval of semantic version n never authorizes n+1.
describe('Property P5 — version-binding (§25; RPH-GOV-003)', () => {
	it('a decision authorizes a subject only at its exact bound version', () => {
		const subj = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 5 }), {
			minLength: 1,
			maxLength: 4
		});
		fc.assert(
			fc.property(
				subj,
				fc.infiniteStream(fc.integer({ min: 1, max: 3 })), // small range => versions collide AND differ
				fc.infiniteStream(fc.integer({ min: 1, max: 3 })),
				fc.infiniteStream(fc.boolean()), // whether each subject is PRESENT in the current-versions map
				(subjects, boundS, currentS, presentS) => {
					const bi = boundS[Symbol.iterator](),
						ci = currentS[Symbol.iterator](),
						pi = presentS[Symbol.iterator]();
					const bound: Record<string, number> = {},
						current: Record<string, number> = {};
					for (const s of subjects) {
						bound[s] = bi.next().value;
						const cur = ci.next().value;
						if (pi.next().value) current[s] = cur; // sometimes the subject is ABSENT from current
					}
					const d: DecisionView = {
						decisionId: 'd',
						decisionType: 'APPROVAL',
						status: 'EFFECTIVE',
						subjectObjectIds: subjects,
						subjectSemanticVersions: bound,
						authorityHeld: true
					};
					const r = decisionAuthorizesVersions(d, current);
					// a subject absent from `current` is NOT stale (unknown current version); a present-but-differing one IS.
					const stale = subjects.filter((s) => current[s] !== undefined && current[s] !== bound[s]);
					expect(r.ok).toBe(stale.length === 0);
					expect(new Set(r.staleSubjects.map((x) => x.subjectId))).toEqual(new Set(stale));
				}
			),
			{ numRuns: RUNS }
		);
	});
});

// P6 — same idempotency key => same result, no extra events.
describe('Property P6 — idempotent commands (§25; RPH-PER-002)', () => {
	it('a key present in prior receipts is a duplicate returning the prior result; a fresh key is not', () => {
		fc.assert(
			fc.property(
				fc.uniqueArray(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 8 }),
				fc.string({ minLength: 1 }),
				(keys, probe) => {
					const prior = new Map(keys.map((k, i) => [k, { eventId: `e${i}` }]));
					const r = resolveIdempotency(probe, prior);
					expect(r.duplicate).toBe(prior.has(probe));
					if (r.duplicate) expect(r.priorResult).toEqual(prior.get(probe));
				}
			),
			{ numRuns: RUNS }
		);
	});
});

// P7 — no legal command mutates an authoritative baseline's item set. The kernel is status-keyed by design;
// here we assert the FULL immutability contract couples consistently across two kernel functions (mutation
// immutability + the successor path), not just one `if`. (Item-set byte-stability under a mutating command is
// an M13 integration property once the baseline command handlers exist — see OPEN-QUESTIONS.)
describe('Property P7 — baseline immutability (§25; RPH-BAS-005/007)', () => {
	// arbitrary status strings, incl. off-machine values, so the invariant is not fed only the 7 legal statuses.
	const anyStatus = fc.oneof(
		fc.constantFrom(
			'DRAFT',
			'CANDIDATE',
			'UNDER_REVIEW',
			'APPROVED',
			'AUTHORITATIVE',
			'SUPERSEDED',
			'REVOKED'
		),
		fc.string({ minLength: 1, maxLength: 12 })
	);
	it('the item set is immutable EXACTLY when AUTHORITATIVE, and an authoritative baseline is exactly what may be superseded', () => {
		fc.assert(
			fc.property(anyStatus, (status) => {
				const immutable = assertBaselineItemSetImmutable(status);
				const isAuthoritative = status === 'AUTHORITATIVE';
				// immutability holds iff AUTHORITATIVE (both directions), and forces a successor when it does
				expect(immutable.ok).toBe(!isAuthoritative);
				expect(immutable.requiresSuccessor).toBe(isAuthoritative);
				// the ONLY legal replacement of an authoritative baseline is supersession (RPH-BAS-007)
				if (isAuthoritative) expect(canSupersedeBaseline(status)).toBe(true);
			}),
			{ numRuns: RUNS }
		);
	});
});

// P8 — presentation changes leave semantic version + assurance state unchanged.
describe('Property P8 — presentation independence (§25; §35.8)', () => {
	const snapshot = fc.record({
		semanticVersion: fc.integer({ min: 0, max: 4 }), // small range => before/after collide AND differ
		assuranceState: fc.constantFrom('PENDING', 'ASSESSING', 'SATISFIED', 'REJECTED'),
		revision: fc.integer({ min: 0, max: 50 })
	});

	it('isPresentationOnlyChange is TRUE exactly when semanticVersion and assuranceState are unchanged (both branches)', () => {
		// independently-generated before/after — the detector must return false when a semantic field differs.
		fc.assert(
			fc.property(snapshot, snapshot, (before, after) => {
				const semanticsEqual =
					before.semanticVersion === after.semanticVersion &&
					before.assuranceState === after.assuranceState;
				expect(isPresentationOnlyChange(before, after)).toBe(semanticsEqual);
			}),
			{ numRuns: RUNS }
		);
	});

	it('applyPresentationChange bumps only the display revision, leaving semantics untouched', () => {
		fc.assert(
			fc.property(snapshot, fc.anything(), (before, layout) => {
				const after = applyPresentationChange(before, layout);
				expect(isPresentationOnlyChange(before, after)).toBe(true);
				expect(after.semanticVersion).toBe(before.semanticVersion);
				expect(after.assuranceState).toBe(before.assuranceState);
				expect(after.revision).toBe(before.revision + 1);
			}),
			{ numRuns: RUNS }
		);
	});
});
