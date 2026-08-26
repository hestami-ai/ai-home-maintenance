// REG-D-044 S-1b — the two PWU recomposition arrows stop being performable by anyone with nothing cited.
//
// ⚠ READ WHAT THIS REPLACES. `verif/recomposition-ungoverned.test.ts` pinned both arrows as ACCEPTED through the
// generic setter with `reasonCode: 'CONTROLLER'` and `supportingObjectIds: []`. Their ratified guards —
// §8.1's *"Parent exists and recomposition is required"* and *"Recomposition contract satisfied"* — were
// enforced by nothing, because neither state sat in `PWU_SEMANTIC_LIFECYCLE_COMMANDS` and no substance check in
// `changePwuState` branched on either. That pin is inverted in this same commit.
//
// ⚠ AND WHY THE SECOND GUARD COULD NOT BE BUILT BEFORE S-1a. `RECOMPOSING -> RECOMPOSED` names contract status
// `SATISFIED`, and until S-1a NOTHING could drive `RecompositionContract.status` there. REG-F-085 recorded that
// a build agent had only two ways out and both were forbidden: ship a command that can never fire, or accept
// `COMPOSABLE` and silently weaken a ratified guard. **So the arrangement below drives the REAL chain rather
// than seeding a status.** Seeding `status: 'SATISFIED'` would prove the guard reads a field; driving
// `AcceptRecomposition` proves the field is REACHABLE, which is the half REG-F-085 blocked on for twelve days.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { RecompositionContractSchema } from '@janumipwb/rph-contracts';
import { Engine } from '../index.js';
import { seedPolicy } from './__tests__/floor-fixtures.js';
import {
	expectPwuReplayEquivalence,
	seedPwuWorkLifecycleState_FIXTURE
} from './__tests__/pwu-fixtures.js';

const TS = '2026-08-21T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69J1100';
const PARENT = 'pwu_01ARZ3NDEKTSV4RRFFQ69J1101';
const CHILD = 'pwu_01ARZ3NDEKTSV4RRFFQ69J110A';
const OTHER_PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69J110B';
const RCP = 'rcp_01ARZ3NDEKTSV4RRFFQ69J1105';
const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69J1106';
const WAIVER = 'dec_01ARZ3NDEKTSV4RRFFQ69J1107';
const ACCEPT_DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69J1109';
const ASSESSMENT = 'assess_01ARZ3NDEKTSV4RRFFQ69J110D';
const POLICY = 'pol_recomposition_integrity';

describe('REG-D-044 S-1b — BeginPwuRecomposition and CompletePwuRecomposition', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	function dispatch(commandType: string, id: string, aggType: string, payload: unknown) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'corr-s1b',
			idempotencyKey: `idem-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${JSON.stringify(r.error)}`).toBe('ACCEPTED');
		return r;
	};
	const lifecycle = (id = PARENT) =>
		(store.loadObject(id)!.state as { workLifecycleState: string }).workLifecycleState;
	const statusOf = (id: string) =>
		(store.loadObject(id)?.state as Record<string, string>)?.status ?? '';
	const emitted = (id = PARENT) =>
		store.readAggregateEvents('PROFESSIONAL_WORK_UNIT', id).map((e) => e.eventType);

	function proposePwu(pwuId: string) {
		ok(
			dispatch('ProposePwu', pwuId, 'PROFESSIONAL_WORK_UNIT', {
				pwuId,
				pwuKind: 'ARCHITECTURE',
				title: pwuId,
				description: 'd',
				intentId: INTENT,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'HIGH',
					uncertainty: 'MEDIUM',
					irreversibility: 'MEDIUM',
					securitySensitivity: 'HIGH',
					regulatoryExposure: 'LOW'
				}
			}),
			`propose ${pwuId}`
		);
	}

	/** A contract in READY naming PARENT and requiring `children`. */
	function contract(children: string[] = [CHILD], parent = PARENT) {
		ok(
			dispatch('ProposeRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
				parentWorkUnitId: parent,
				requiredChildWorkUnitIds: children,
				parentCompletionClaimId: CLAIM,
				conflictResolutionRules: []
			}),
			'propose recomposition'
		);
	}

	/** Move CHILD's assurance axis to WAIVED through a real, granted waiver — the acceptable-child set is
	 *  {SATISFIED, WAIVED} and WAIVED is the arm reachable without walking the execution chain. */
	function waiveChild() {
		ok(
			dispatch('ChangePwuState', CHILD, 'PROFESSIONAL_WORK_UNIT', {
				previousState: 'PROPOSED',
				newState: 'PROPOSED',
				executionState: 'NOT_PLANNED',
				assuranceState: 'EVIDENCE_REQUIRED',
				shapeIntegrityState: 'UNKNOWN',
				reasonCode: 'CONTROLLER',
				supportingObjectIds: []
			}),
			'open the assurance axis'
		);
		ok(
			dispatch('ProposeDecision', WAIVER, 'DECISION', {
				decisionType: 'WAIVER',
				subjectObjectIds: [CHILD],
				selectedOption: 'accept the residual risk on this child',
				rationale: 'Recorded so this control rests on a real, granted waiver.',
				authority: { actorId: 'u1', actorType: 'HUMAN', displayName: 'Operator' },
				consideredEvidenceIds: [],
				consideredObservationIds: []
			}),
			'propose the waiver'
		);
		ok(
			dispatch('GrantWaiver', WAIVER, 'DECISION', { waiverDecisionId: WAIVER, duration: 'P30D' }),
			'grant the waiver'
		);
		ok(
			dispatch('ChangePwuState', CHILD, 'PROFESSIONAL_WORK_UNIT', {
				previousState: 'PROPOSED',
				newState: 'PROPOSED',
				executionState: 'NOT_PLANNED',
				assuranceState: 'WAIVED',
				shapeIntegrityState: 'UNKNOWN',
				reasonCode: 'CONTROLLER',
				supportingObjectIds: [WAIVER]
			}),
			'waive the child'
		);
	}

	/** Drive the contract all the way to SATISFIED through the acts that actually perform it: evaluate to
	 *  COMPOSABLE, then S-1a's AcceptRecomposition citing an EFFECTIVE APPROVAL and a concluded assessment. */
	function satisfiedContract() {
		waiveChild();
		contract();
		ok(dispatch('BeginRecomposition', RCP, 'RECOMPOSITION_CONTRACT', { recompositionContractId: RCP }), 'begin');
		ok(
			dispatch('CompleteRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
				parentCompletionClaimId: CLAIM
			}),
			'complete'
		);
		expect(statusOf(RCP), 'the contract must reach COMPOSABLE or nothing below is about acceptance').toBe(
			'COMPOSABLE'
		);
		ok(
			dispatch('ProposeDecision', ACCEPT_DEC, 'DECISION', {
				decisionType: 'APPROVAL',
				subjectObjectIds: [RCP],
				selectedOption: 'accept the recomposition',
				rationale: 'The recomposed whole was assessed and the residual risk is accepted.',
				authority: { actorId: 'u1', actorType: 'HUMAN', displayName: 'Operator' },
				consideredEvidenceIds: [],
				consideredObservationIds: []
			}),
			'propose approval'
		);
		ok(
			dispatch('ApproveDecision', ACCEPT_DEC, 'DECISION', {
				selectedOption: 'accept the recomposition',
				rationale: 'The recomposed whole was assessed and the residual risk is accepted.',
				consideredEvidenceIds: [],
				consideredObservationIds: [],
				subjectSemanticVersions: { [RCP]: 1 }
			}),
			'approve'
		);
		seedPolicy(engine, POLICY);
		ok(
			dispatch('RequestAssuranceAssessment', ASSESSMENT, 'ASSURANCE_ASSESSMENT', {
				assessmentId: ASSESSMENT,
				assurancePolicyId: POLICY,
				policyVersion: '1.0.0',
				subjectObjectIds: [PARENT],
				subjectSemanticVersions: { [PARENT]: 1 },
				claimIds: [CLAIM]
			}),
			'request assessment'
		);
		ok(dispatch('BeginAssuranceAssessment', ASSESSMENT, 'ASSURANCE_ASSESSMENT', {}), 'begin assessment');
		ok(
			dispatch('CompleteAssuranceAssessment', ASSESSMENT, 'ASSURANCE_ASSESSMENT', {
				validatorResult: {
					validatorId: 'test.recomposition-integrity',
					validatorVersion: '1',
					policyId: POLICY,
					policyVersion: '1.0.0',
					assessmentId: ASSESSMENT,
					subjectObjectIds: [PARENT],
					subjectSemanticVersions: { [PARENT]: 1 },
					claimResults: [],
					evidenceConsideredIds: [],
					evidenceRejected: [],
					observations: [],
					dispositionRecommendation: 'SATISFIED',
					recommendedControlActions: [],
					residualUncertainty: [],
					limitations: [],
					executionProvenance: {
						evaluator: { actorId: 'u1', actorType: 'HUMAN', displayName: 'Operator' }
					}
				}
			}),
			'complete assessment'
		);
		ok(
			dispatch('AcceptRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
				acceptanceDecisionId: ACCEPT_DEC,
				parentAssessmentId: ASSESSMENT
			}),
			'accept'
		);
		expect(statusOf(RCP), 'S-1a is the only route to SATISFIED; without it this suite proves nothing').toBe(
			'SATISFIED'
		);
	}


	/** Empty an EXISTING contract's required-child set.
	 *
	 * ⚠ THIS BYPASSES THE COMMAND BUS DELIBERATELY, AND A SURVIVING MUTANT IS WHY IT EXISTS. The test below
	 * used to arrange this case through `ProposeRecomposition` — which REFUSES an empty composition (REG-F-041
	 * S-0) — so the contract never existed and `BeginPwuRecomposition` refused on the FIRST conjunct, not the
	 * second. The test read as coverage of the child-count limb and covered the parent-match limb twice.
	 * `MU-F085B-begin-admits-an-empty-composition` SURVIVED and said so.
	 *
	 * The state this seeds is one the command surface can no longer mint — which is exactly the case the limb
	 * is for: a contract written BEFORE S-0 landed. Re-parsed against the schema before writing, per
	 * `pwu-fixtures.ts`'s rule that a fixture able to write a shape the contract forbids is its own defect. */
	function emptyTheRequiredChildren(): void {
		const stored = store.loadObject(RCP);
		expect(stored, 'nothing to empty — the arrangement did not happen').toBeTruthy();
		const nextState = RecompositionContractSchema.parse({
			...RecompositionContractSchema.parse(stored!.state),
			requiredChildWorkUnitIds: []
		});
		const result = store.commit({
			aggregateType: 'RECOMPOSITION_CONTRACT',
			aggregateId: RCP,
			objectType: 'RECOMPOSITION_CONTRACT',
			expectedRevision: stored!.revision,
			newRevision: stored!.revision + 1,
			newSemanticVersion: stored!.semanticVersion,
			currentState: nextState,
			events: [],
			receipt: {
				commandId: 'fixture-emptyRecompositionChildren',
				idempotencyKey: 'fixture-emptyRecompositionChildren',
				commandType: 'FixtureEmptyRecompositionChildren',
				targetAggregateId: RCP,
				status: 'ACCEPTED',
				producedEventIds: []
			}
		});
		expect(result.ok, 'fixture commit refused').toBe(true);
	}

	const begin = (contractId = RCP, pwu = PARENT) =>
		dispatch('BeginPwuRecomposition', pwu, 'PROFESSIONAL_WORK_UNIT', {
			recompositionContractId: contractId
		});
	const finish = (contractId = RCP, pwu = PARENT) =>
		dispatch('CompletePwuRecomposition', pwu, 'PROFESSIONAL_WORK_UNIT', {
			recompositionContractId: contractId
		});

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		}).as(TEST_CRED.human);
		ok(
			dispatch('CaptureIntent', INTENT, 'INTENT', {
				intentId: INTENT,
				originatingExpression: 'x',
				ontologyId: 'o',
				ontologyVersion: '1'
			}),
			'intent'
		);
		proposePwu(PARENT);
		proposePwu(CHILD);
		proposePwu(OTHER_PWU);
	});

	// ── BeginPwuRecomposition — §8.1 "Parent exists and recomposition is required" ────────────────────────────
	describe('BeginPwuRecomposition', () => {
		it('ACCEPTS SATISFIED -> RECOMPOSING when a contract names this PWU as parent and requires a child', () => {
			contract();
			seedPwuWorkLifecycleState_FIXTURE(store, PARENT, 'SATISFIED');
			ok(begin(), 'begin recomposition');
			expect(lifecycle()).toBe('RECOMPOSING');
			expect(emitted(), 'the semantic event, not the generic one').toContain('PwuRecompositionBegun');
			expect(emitted()).not.toContain('PwuStateChanged');
		});

		it('REFUSES when the cited contract names a DIFFERENT parent — REG-Q-028 default, enforced', () => {
			contract([CHILD], OTHER_PWU);
			seedPwuWorkLifecycleState_FIXTURE(store, PARENT, 'SATISFIED');
			const r = begin();
			expect(r.status).toBe('REJECTED');
			expect(r.error?.message).toContain('parentWorkUnitId');
			expect(lifecycle()).toBe('SATISFIED');
		});

		it('CONTROL — S-0 still refuses to MINT an empty composition', () => {
			const proposed = dispatch('ProposeRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
				parentWorkUnitId: PARENT,
				requiredChildWorkUnitIds: [],
				parentCompletionClaimId: CLAIM,
				conflictResolutionRules: []
			});
			expect(proposed.status, 'if this ACCEPTS, REG-F-041 S-0 has regressed').toBe('REJECTED');
		});

		it('REFUSES when the contract requires NO children — an empty set is not a recomposition', () => {
			// ⚠ THE ARRANGEMENT IS THE POINT. This case used to be built by proposing an empty contract, which
			// S-0 refuses — so no contract existed and Begin refused on the FIRST conjunct while the test claimed
			// to be about the second. `MU-F085B-begin-admits-an-empty-composition` SURVIVED and exposed it.
			// A real contract is minted, THEN emptied, which is the one state this limb is actually for: a
			// contract written before S-0 landed.
			contract();
			emptyTheRequiredChildren();
			seedPwuWorkLifecycleState_FIXTURE(store, PARENT, 'SATISFIED');
			const r = begin();
			expect(r.status).toBe('REJECTED');
			expect(r.error?.message, 'the refusal must be about the CHILDREN, not the missing contract').toContain(
				'requires no child work units'
			);
			expect(lifecycle()).toBe('SATISFIED');
		});

		it('REFUSES from EXECUTING — the arrow is declared from SATISFIED alone', () => {
			contract();
			seedPwuWorkLifecycleState_FIXTURE(store, PARENT, 'EXECUTING');
			const r = begin();
			expect(r.status).toBe('REJECTED');
			expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
			expect(lifecycle()).toBe('EXECUTING');
		});
	});

	// ── CompletePwuRecomposition — §8.1 "Recomposition contract satisfied", the ENUM LITERAL ─────────────────
	describe('CompletePwuRecomposition', () => {
		it('ACCEPTS RECOMPOSING -> RECOMPOSED once the contract has been ACCEPTED into SATISFIED', () => {
			satisfiedContract();
			seedPwuWorkLifecycleState_FIXTURE(store, PARENT, 'RECOMPOSING');
			ok(finish(), 'complete recomposition');
			expect(lifecycle()).toBe('RECOMPOSED');
			expect(emitted()).toContain('PwuRecomposed');
			expect(emitted()).not.toContain('PwuStateChanged');
		});

		it('REFUSES on a COMPOSABLE contract — the candidacy is not the verdict', () => {
			// ⚠ THE WHOLE INCREMENT IN ONE TEST. COMPOSABLE means "no contradiction found"; the guard names
			// "contract satisfied". Accepting COMPOSABLE here is the substitution REG-F-085 refused to make and
			// REG-D-044 Ruling 1 closed. Everything up to the acceptance has happened — only the Decision is missing.
			waiveChild();
			contract();
			ok(dispatch('BeginRecomposition', RCP, 'RECOMPOSITION_CONTRACT', { recompositionContractId: RCP }), 'begin');
			ok(
				dispatch('CompleteRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
					parentCompletionClaimId: CLAIM
				}),
				'complete'
			);
			expect(statusOf(RCP)).toBe('COMPOSABLE');
			seedPwuWorkLifecycleState_FIXTURE(store, PARENT, 'RECOMPOSING');
			const r = finish();
			expect(r.status).toBe('REJECTED');
			expect(r.error?.message).toContain('COMPOSABLE');
			expect(lifecycle()).toBe('RECOMPOSING');
		});

		it('REFUSES on a contract that never left READY', () => {
			contract();
			seedPwuWorkLifecycleState_FIXTURE(store, PARENT, 'RECOMPOSING');
			const r = finish();
			expect(r.status).toBe('REJECTED');
			expect(lifecycle()).toBe('RECOMPOSING');
		});

		it('REFUSES a SATISFIED contract that belongs to another parent', () => {
			satisfiedContract();
			seedPwuWorkLifecycleState_FIXTURE(store, OTHER_PWU, 'RECOMPOSING');
			const r = finish(RCP, OTHER_PWU);
			expect(r.status).toBe('REJECTED');
			expect(r.error?.message).toContain('parentWorkUnitId');
			expect(lifecycle(OTHER_PWU)).toBe('RECOMPOSING');
		});
	});

	// ── The generic setter must no longer perform either arrow (REG-F-072 / PER-3) ───────────────────────────
	it('CONTROL — ChangePwuState is REFUSED for both arrows now that each has an owner', () => {
		// This is the control on the OWNERSHIP rows specifically, not on the guards. Its own mutant deletes the
		// two `PWU_SEMANTIC_LIFECYCLE_COMMANDS` entries — which leaves every guard test above green, because a
		// caller can simply bypass them. That is exactly the defect REG-F-085 pinned.
		for (const [from, to, owner] of [
			['SATISFIED', 'RECOMPOSING', 'BeginPwuRecomposition'],
			['RECOMPOSING', 'RECOMPOSED', 'CompletePwuRecomposition']
		] as const) {
			seedPwuWorkLifecycleState_FIXTURE(store, PARENT, from);
			const r = dispatch('ChangePwuState', PARENT, 'PROFESSIONAL_WORK_UNIT', {
				previousState: from,
				newState: to,
				executionState: 'NOT_PLANNED',
				assuranceState: 'UNASSESSED',
				shapeIntegrityState: 'PRESERVED',
				reasonCode: 'CONTROLLER',
				supportingObjectIds: []
			});
			expect(r.status, `${from} -> ${to} must be refused as owned`).toBe('REJECTED');
			expect(r.error?.message, `${from} -> ${to} must name its owner`).toContain(owner);
			expect(lifecycle()).toBe(from);
		}
	});

	// ── The fold (REG-F-084 / B-4) ───────────────────────────────────────────────────────────────────────────
	// ⚠ THIS IS THE NAMED DRIVE SITE FOR BOTH NEW EVENTS. `pwu-fold-drive-sites.test.ts` resolves each event
	// owned by a semantic command to a test that EMITS it, because co-location proves nothing — W-5 added two
	// fold cases in exactly the right commit and both were still DEAD, with a mutant deleting them leaving 1203
	// tests green. The §26 reference seed never occupies RECOMPOSING or RECOMPOSED, so the seed cannot cover this.
	it('CONTROL — a recomposed PWU rebuilds from its own event stream', () => {
		satisfiedContract();
		seedPwuWorkLifecycleState_FIXTURE(store, PARENT, 'SATISFIED');
		ok(begin(), 'begin');
		expectPwuReplayEquivalence(store, PARENT);
		ok(finish(), 'complete');
		expect(lifecycle()).toBe('RECOMPOSED');
		expectPwuReplayEquivalence(store, PARENT);
	});
});
