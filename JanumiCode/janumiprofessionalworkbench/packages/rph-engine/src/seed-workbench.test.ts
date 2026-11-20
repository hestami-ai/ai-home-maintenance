// Proves seedWorkbench stands up the full RPH-DOC-010 picture LIVE in one call: one PUBLISHED Product Realization
// PWA with its PWU Types, one Undertaking bound to it, and that Undertaking's 9-node Professional Work Graph —
// all via real commands. The query surface returns the read-model the UI renders.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { policyApplicability } from '@janumipwb/rph-domain';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { describe, expect, it } from 'vitest';
import {
	createEngine,
	listByType,
	listPwas,
	listPwuTypes,
	listPwus,
	listUndertakings,
	professionalWorkGraph,
	seedWorkbench,
	SEED_PWA,
	SEED_UNDERTAKING
} from './index.js';

// ── THE SESSION THE SEED MUST RUN IN, AND WHY IT IS NOT THE SHARED CREDENTIAL ─────────────────────────────────
// `seedWorkbench` delegates the Undertaking's graph to `driveReferenceUndertaking`, which AUTHORS ITS ACTING
// PARTY into the payloads it sends — `producedBy`, `producer`, `introducedBy`, and, load-bearing here,
// `authority` on `ProposeDecision`. REG-F-014 requires that declared authority to EQUAL the issuing actor, and
// the engine now stamps the issuer from the authenticated session. So the session's principal must BE that
// party — `owner-1`, the Undertaking Owner. Under any other principal the drive is refused at ProposeDecision
// with RPH_AUTHORITY_INSUFFICIENT and its fail-loud `send` throws before the seed finishes.
//
// ⚠ The literal is duplicated from `reference-undertaking.ts`'s module-private ACTOR, which is not exported.
// `executionInstanceId` is carried for the same reason it exists there: with it, the stamped `issuedBy` is the
// exact value the envelope carried before the trust boundary landed, so nothing downstream of the gate moves.
const DIR = testDirectory([
	{
		actorId: 'owner-1',
		actorType: 'HUMAN',
		displayName: 'Undertaking Owner',
		executionInstanceId: 'exec-production',
		tenantId: 'tenant-test',
		organizationId: 'org-test'
	}
]);
const OWNER = DIR.credentialFor('owner-1');

describe('seedWorkbench (live PWA + Undertaking + graph)', () => {
	function build() {
		let s = 0;
		const engine = createEngine({
			authenticate: DIR.authenticate,
			ontology,
			now: () => '2026-07-12T00:00:00Z',
			newEventId: () => `e${++s}`
		}).as(OWNER);
		seedWorkbench(engine);
		return engine;
	}

	it('publishes one Product Realization PWA with its PWU Types', () => {
		const engine = build();
		const pwas = listPwas(engine);
		expect(pwas).toHaveLength(1);
		expect(pwas[0]!.state.publicationStatus).toBe('PUBLISHED');
		expect(pwas[0]!.id).toBe(SEED_PWA);
		const types = listPwuTypes(engine, SEED_PWA);
		expect(types.length).toBeGreaterThanOrEqual(8);
		expect(types.filter((t) => t.state.isRoot)).toHaveLength(1);
	});

	// ── THE PUBLISHED NAMES ARE PINNED, BECAUSE A REFACTOR RENAMED THEM ONCE ─────────────────────────────────
	// The tree is now DERIVED from the ontology (REG-F-033) instead of a hand-written literal. The first version
	// of that derivation took names from `humanizeCode`, which sentence-cases — so every published type was
	// silently relabelled ("Architecture definition" for "Architecture Definition"). Seventy-nine references
	// across the suite depend on these names and three e2e specs went red, which is the only reason it was
	// caught: a refactor whose whole point was to change the SOURCE of the data changed the DATA.
	//
	// Pinned here so the next such change reddens in a unit test rather than in a browser five minutes later.
	it('the derived display names reproduce the established ones EXACTLY', () => {
		const engine = build();
		const byKind = new Map(
			listPwuTypes(engine, SEED_PWA).map((t) => [String(t.state.pwuKind), String(t.state.name)])
		);
		expect(byKind.get('PRODUCT_REALIZATION')).toBe('Product Realization');
		expect(byKind.get('INTENT_AND_PRODUCT_DEFINITION')).toBe('Intent & Product Definition');
		expect(byKind.get('PRODUCT_BEHAVIOR_DEFINITION')).toBe('Product Behavior Definition');
		expect(byKind.get('ARCHITECTURE_DEFINITION')).toBe('Architecture Definition');
		expect(byKind.get('IMPLEMENTATION_PLANNING')).toBe('Implementation Planning');
		expect(byKind.get('PRODUCT_IMPLEMENTATION')).toBe('Product Implementation');
		expect(byKind.get('INTEGRATED_PRODUCT_VALIDATION')).toBe('Integrated Product Validation');
		expect(byKind.get('PRODUCT_BASELINE_PROMOTION')).toBe('Product Baseline Promotion');
		expect(byKind.get('ARCHITECTURE_CONCERN')).toBe('Architecture Concern');
		// And the five the 2026-08-06 deepening added, by the same rule.
		expect(byKind.get('INTENT_DISCOVERY')).toBe('Intent Discovery');
		expect(byKind.get('USER_JOURNEY_DEFINITION')).toBe('User Journey Definition');
	});

	// ── THE DEEPENING (2026-08-06) ───────────────────────────────────────────────────────────────────────────
	it('publishes THREE levels, derived from the ontology’s candidateChildren', () => {
		const engine = build();
		const types = listPwuTypes(engine, SEED_PWA);
		const byId = new Map(types.map((t) => [t.id, t.state]));
		const kindOf = (id: string) => String(byId.get(id)?.pwuKind ?? id);
		const childrenOf = (kind: string) =>
			(
				(types.find((t) => t.state.pwuKind === kind)?.state.permittedChildTypeIds ?? []) as string[]
			).map(kindOf);

		expect(types).toHaveLength(14);
		// Level 2 -> level 3: the five sub-kinds the PWA never published before.
		expect(childrenOf('INTENT_AND_PRODUCT_DEFINITION').sort()).toEqual([
			'INTENT_DISCOVERY',
			'PRODUCT_BOUNDARY'
		]);
		expect(childrenOf('PRODUCT_BEHAVIOR_DEFINITION').sort()).toEqual([
			'REQUIREMENT_DEFINITION',
			'USER_JOURNEY_DEFINITION'
		]);
		expect(childrenOf('IMPLEMENTATION_PLANNING')).toEqual(['WORK_DECOMPOSITION']);
		// ARCHITECTURE_DECISION is DESCRIBED by the ontology and named in NO candidateChildren list, so
		// `ValidatePwa` would refuse it as an orphan (§11.6). Unpublished by measurement, not by omission.
		expect(types.map((t) => String(t.state.pwuKind))).not.toContain('ARCHITECTURE_DECISION');
	});

	it('the four formerly-unread template fields reach the PWU Types', () => {
		// REG-F-033: `inputs`, `outputArtifactTypes`, `completionClaims` and `candidateChildren` reached nothing.
		// Their ratified homes on PWU_TYPE existed all along and were simply never populated.
		const engine = build();
		const arch = listPwuTypes(engine, SEED_PWA).find(
			(t) => t.state.pwuKind === 'ARCHITECTURE_DEFINITION'
		)!.state;
		expect((arch.requiredInputs as string[])?.length, 'inputs -> requiredInputs').toBeGreaterThan(5);
		expect(
			(arch.requiredOutputs as string[])?.length,
			'outputArtifactTypes -> requiredOutputs'
		).toBeGreaterThan(5);
		expect(String(arch.completionRule), 'completionClaims -> completionRule').toContain(
			'Architecture covers applicable requirements.'
		);
		expect(String(arch.completionRule)).toMatch(/^All of: /);
	});

	it('§11.3: PwuProposed carries pwuTypeId (the join key the Assurance View needs) and isLocalExtension', () => {
		// The event dropped both fields until Increment 35. pwuTypeId is what "applicable policies" (§38) folds
		// on: pwuTypeId -> PwuType.requiredAssurancePolicyIds. Without it that field rendered a false "none".
		// Only the seed-workbench path exercises this — its PWUs realize published PWU Types (non-local); the
		// standalone reference drive's PWUs are local extensions (no type), covered by emitted-event-conformance.
		const engine = build();
		const proposed = engine
			.readAllEvents()
			.filter((e) => e.eventType === 'PwuProposed')
			.map(
				(e) => e.payload as { pwuTypeId?: string; isLocalExtension?: boolean; pwuKind?: string }
			);
		expect(proposed.length).toBeGreaterThanOrEqual(8);
		const typed = proposed.filter((p) => typeof p.pwuTypeId === 'string');
		expect(
			typed.length,
			'the seeded PWUs realize published PWU Types, so pwuTypeId must be present'
		).toBe(proposed.length);
		// A typed PWU is not a local extension (§11.3: a local extension has no published pwuTypeId).
		expect(proposed.every((p) => p.isLocalExtension === false)).toBe(true);
		// The join actually resolves: every emitted pwuTypeId is a PWU Type that exists in the published PWA.
		const typeIds = new Set(listPwuTypes(engine, SEED_PWA).map((t) => t.id));
		expect(proposed.every((p) => typeIds.has(p.pwuTypeId!))).toBe(true);
	});

	it('instantiates one Undertaking bound to the published PWA and owns its PWUs (CON-009)', () => {
		const engine = build();
		const unds = listUndertakings(engine);
		expect(
			unds,
			`types=${[...new Set(engine.readAllEvents().map((e) => e.aggregateType))].join(',')}`
		).toHaveLength(1);
		expect(unds[0]!.state.pwaId).toBe(SEED_PWA);
		const pwus = listPwus(engine, SEED_UNDERTAKING);
		expect(pwus).toHaveLength(13);
		expect(pwus.every((p) => p.state.undertakingId === SEED_UNDERTAKING)).toBe(true);
	});

	it('seeds the policy library: 3 locked de minimis floor policies + ALL 12 catalog policies as ASSURANCE_POLICY objects', () => {
		const engine = build();
		const policies = listByType(engine, 'ASSURANCE_POLICY');
		// 3 floor (locked) + 12 additive = the full workbench policy library.
		//
		// This asserted 9 — 3 floor + SIX additive — because seeding read a hand-maintained copy of the catalog in
		// seed-workbench.ts while the ontology (and validateOntology, and the conformance profiles) read all 12.
		// So half of DOC-004's ratified catalog existed as ontology data and as NO object: not in the policy
		// manager, not in the picker, and not in what `list_assurance_policies` shows the authoring agent. The
		// agent is told to reuse an existing policy and to create one only for a treatment "not already offered" —
		// so the six invisible policies were an instruction to fabricate duplicates of ratified ones.
		expect(policies).toHaveLength(15);
		const ids = policies.map((p) => p.id).sort();
		expect(ids).toEqual([
			'floor.identity-provenance',
			'floor.reasoning-review',
			'floor.schema-invariant',
			'pol_architecture_coverage',
			'pol_assumption_disclosure',
			'pol_baseline_promotion',
			'pol_constraint_propagation',
			'pol_decomposition_coverage',
			'pol_fitness_for_purpose',
			'pol_historical_consistency',
			'pol_intent_completeness',
			'pol_intent_fidelity',
			'pol_intent_preservation',
			'pol_requirement_coverage',
			'pol_test_adequacy'
		]);
		const rr = policies.find((p) => p.id === 'floor.reasoning-review')!;
		expect(rr.state.status).toBe('ACTIVE');
		expect(rr.state.independenceRequirement).toBe('DIFFERENT_MODEL');
		expect(rr.state.criteria as unknown[]).toHaveLength(9);
		// Additive policies are also ACTIVE, versioned objects (engine-backed, not a static UI catalog).
		const intentPreservation = policies.find((p) => p.id === 'pol_intent_preservation')!;
		expect(intentPreservation.state.status).toBe('ACTIVE');
		expect(intentPreservation.state.version).toBe('1.0.0');
	});

	it('drives the Undertaking to a graph that upholds INV-5', () => {
		const engine = build();
		const graph = professionalWorkGraph(engine);
		expect(graph.nodes).toHaveLength(13);
		const mobile = graph.nodes.find((n) => n.label === 'Mobile & Offline Architecture');
		expect(mobile?.qualifiedSuccess).toBe(false);
		const arch = graph.nodes.find((n) => n.label === 'Architecture Definition');
		expect(arch?.baselined).toBe(true);
	});

	// ── ⭐⭐ `JAN-EXEC` Phase 7, package L17b2 — design D78 (`REG-D-166` (3)) ─────────────────────────────────────────────────────────
	// THE SEEDED HISTORIAN GOVERNS EVERY KIND OF UNIT. The harness assesses a rejected unit of any kind under
	// `pol_historical_consistency` (D73), and the kernel refuses to assess a unit whose kind a policy's kinds exclude (the request's
	// applicability block in `assurance.ts`, over `policyApplicability`). So the seed's `appliesToPwuKinds` is emptied, and an empty
	// list reaches the store as no kind condition at all (`seedAdditivePolicies`: "absent reads as unrestricted"). Its tests: every kind
	// the vocabulary names, and one it does not, read by the kernel's own applicability over the stored policy; and a unit of each
	// kind, proposed and asked for through the command, as the harness asks. ⭑ CONTROL: every other seeded policy's kinds as they were.
	const HISTORIAN = 'pol_historical_consistency';
	/** Every kind a template or a catalog policy names, and one no catalog names (an authored graph's kinds are the author's). */
	const EVERY_KIND = [
		...[...new Set([...ontology.pwuTemplates.map((t) => t.pwuKind), ...ontology.seedPolicies.flatMap((p) => p.appliesToPwuKinds ?? [])])].sort(),
		'A_KIND_NO_CATALOG_NAMES'
	];
	const storedApplicability = (engine: ReturnType<typeof build>, policyId: string) =>
		listByType(engine, 'ASSURANCE_POLICY').find((p) => p.id === policyId)!.state.applicability as {
			readonly objectTypeConditions?: readonly string[];
			readonly pwuKindConditions?: readonly string[];
		};

	it('⛔ RED FIRST — D78: the seeded pol_historical_consistency governs a unit of each kind — no kind condition stored, the kernel’s applicability excluding none, and a unit of each kind assessable under it through the command', () => {
		const engine = build();
		const applicability = storedApplicability(engine, HISTORIAN);
		expect(EVERY_KIND.length, 'arrangement: the fifteen kinds the catalog and the templates name, and one more').toBe(16);
		expect.soft(applicability.pwuKindConditions, 'a kind condition is stored').toBeUndefined();
		expect
			.soft(
				EVERY_KIND.filter(
					(pwuKind) => policyApplicability(applicability as never, { objectType: 'PROFESSIONAL_WORK_UNIT', pwuKind } as never) === 'NOT_APPLICABLE'
				),
				'the kinds the stored policy excludes'
			)
			.toEqual([]);
		// Through the command, as the harness asks it: a unit of each kind, proposed under one provisioned intent, then one request each.
		let n = 0;
		const send = (commandType: string, targetAggregateType: string, targetAggregateId: string, payload: unknown) => {
			n += 1;
			const command: DomainCommand = {
				commandId: `d78-${n}`,
				commandType,
				commandSchemaVersion: 1,
				targetAggregateType,
				targetAggregateId,
				issuedAt: '2026-07-12T00:00:00Z',
				correlationId: 'l17b2-d78',
				idempotencyKey: `d78-idem-${n}`,
				payload
			};
			return engine.dispatch(command);
		};
		const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5K00';
		for (const [type, payload] of [
			['CaptureIntent', { intentId: INTENT, originatingExpression: 'Assess any kind of unit.', ontologyId: 'product-realization-pwa', ontologyVersion: '1.3.0' }],
			['BeginIntentDiscovery', {}],
			['ProvisionIntent', { ambiguityIds: [] }]
		] as const)
			expect(send(type, 'INTENT', INTENT, payload).status, `arrangement: ${type}`).toBe('ACCEPTED');
		const refused = EVERY_KIND.flatMap((pwuKind, k) => {
			const nn = String(k + 1).padStart(2, '0');
			const [pwuId, assessmentId] = [`pwu_01ARZ3NDEKTSV4RRFFQ69G5K${nn}`, `asm_01ARZ3NDEKTSV4RRFFQ69G5K${nn}`];
			const proposed = send('ProposePwu', 'PROFESSIONAL_WORK_UNIT', pwuId, {
				pwuId,
				pwuKind,
				title: `A unit of ${pwuKind}`,
				description: 'd',
				intentId: INTENT,
				boundaries: { inScope: ['a'], outOfScope: ['b'], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [{ artifactType: 'DOCUMENT', description: 'n', verificationCriteria: ['r'] }],
				assurancePolicyIds: [],
				riskProfile: { consequence: 'HIGH', uncertainty: 'MEDIUM', irreversibility: 'MEDIUM', securitySensitivity: 'HIGH', regulatoryExposure: 'LOW' }
			});
			expect(proposed.status, `arrangement: a unit of ${pwuKind} proposed: ${proposed.error?.message ?? ''}`).toBe('ACCEPTED');
			const asked = send('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
				assessmentId,
				assurancePolicyId: HISTORIAN,
				policyVersion: '1.0.0',
				subjectObjectIds: [pwuId],
				subjectSemanticVersions: { [pwuId]: 1 },
				claimIds: []
			});
			return asked.status === 'ACCEPTED' ? [] : [pwuKind];
		});
		expect.soft(refused, 'the kinds whose unit the kernel will not let the Historian assess').toEqual([]);
	});

	it('⭑ CONTROL — D78 moves the Historian’s kinds alone: every other seeded policy’s kinds are stored as they were', () => {
		const engine = build();
		const others = Object.fromEntries(
			ontology.seedPolicies
				.filter((p) => p.policyId !== HISTORIAN)
				.map((p) => [p.policyId, storedApplicability(engine, p.policyId).pwuKindConditions])
		);
		expect(others).toEqual({
			pol_intent_fidelity: ['INTENT_AND_PRODUCT_DEFINITION', 'INTENT_DISCOVERY', 'PRODUCT_BOUNDARY', 'PRODUCT_REALIZATION'],
			pol_intent_completeness: ['INTENT_AND_PRODUCT_DEFINITION', 'PRODUCT_BOUNDARY'],
			pol_assumption_disclosure: [
				'INTENT_AND_PRODUCT_DEFINITION',
				'PRODUCT_BEHAVIOR_DEFINITION',
				'ARCHITECTURE_DEFINITION',
				'ARCHITECTURE_DECISION',
				'IMPLEMENTATION_PLANNING',
				'WORK_DECOMPOSITION',
				'PRODUCT_IMPLEMENTATION',
				'INTEGRATED_PRODUCT_VALIDATION',
				'INTENT_DISCOVERY'
			],
			pol_requirement_coverage: ['PRODUCT_BEHAVIOR_DEFINITION', 'USER_JOURNEY_DEFINITION', 'REQUIREMENT_DEFINITION'],
			pol_decomposition_coverage: ['ARCHITECTURE_DEFINITION', 'IMPLEMENTATION_PLANNING', 'WORK_DECOMPOSITION', 'PRODUCT_REALIZATION'],
			pol_constraint_propagation: ['IMPLEMENTATION_PLANNING', 'WORK_DECOMPOSITION'],
			pol_architecture_coverage: ['ARCHITECTURE_DEFINITION', 'ARCHITECTURE_CONCERN'],
			pol_intent_preservation: [
				'PRODUCT_BEHAVIOR_DEFINITION',
				'ARCHITECTURE_DEFINITION',
				'IMPLEMENTATION_PLANNING',
				'WORK_DECOMPOSITION',
				'PRODUCT_IMPLEMENTATION',
				'INTEGRATED_PRODUCT_VALIDATION',
				'PRODUCT_BASELINE_PROMOTION',
				'PRODUCT_REALIZATION',
				'USER_JOURNEY_DEFINITION',
				'REQUIREMENT_DEFINITION'
			],
			pol_test_adequacy: ['PRODUCT_IMPLEMENTATION', 'INTEGRATED_PRODUCT_VALIDATION'],
			pol_fitness_for_purpose: ['INTEGRATED_PRODUCT_VALIDATION', 'PRODUCT_REALIZATION', 'PRODUCT_BASELINE_PROMOTION'],
			pol_baseline_promotion: ['PRODUCT_BASELINE_PROMOTION']
		});
	});
});
