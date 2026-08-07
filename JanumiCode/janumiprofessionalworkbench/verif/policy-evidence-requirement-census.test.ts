// THE POLICY EVIDENCE-REQUIREMENT CENSUS — how many policies declare required evidence, and how many the engine
// can actually see (REG-F-022).
//
// ── WHY IT EXISTS, AND WHY IT IS A TEST RATHER THAN A NUMBER IN A DOCUMENT ────────────────────────────────────
// REG-F-022 was found by a throwaway probe that printed two counts. The counts went into the register and the
// design; the probe was deleted. That is the exact failure this repository keeps catching in other people's work:
// a load-bearing measurement with no surviving source, which cannot be re-run, cannot redden, and cannot tell
// "nothing found" from "nothing ran". So the probe is promoted here, DERIVED rather than pinned.
//
// WHAT IT MEASURES.
//   * `requiredEvidence` on every seeded ASSURANCE_POLICY OBJECT, read back out of a live engine — not from the
//     source literals, because the drop happens in the seeding and reading the literals would miss it entirely.
//   * `requiredEvidenceTypes` on the ontology's seed policies — the AUTHORED declaration that never arrives.
//
// THE FINDING THIS ONCE PINNED, AND WHAT REPLACED IT. Every catalog policy declared which evidence it needed;
// `seedAdditivePolicies` mapped eleven fields and not that one; so every policy object was born with
// `requiredEvidence: []`. Gate A in `completeAssuranceAssessment` — the refusal that stops a SATISFIED
// disposition standing on unmet mandatory evidence — read that array, evaluated an empty set, and admitted
// everything. A control whose population is empty is a control that cannot fail.
//
// CLOSED 2026-08-05 (REG-E-026). The 89 evidence items DOC-004 ratifies are authored as §6.1
// EvidenceRequirements and delivered. The pin — `carrying === []` — is DELETED, per its own instruction, not
// widened to accommodate the fix. This file now measures WHAT ARRIVES, so under- and over-delivery both redden.
//
// WHAT MUST REDDEN, NAMED IN ADVANCE (a green here means nothing unless these are true):
//   1. Either field dropped from the seeding payload        -> the delivery census reddens, naming the counts.
//   2. The reader breaks (wrong field, wrong object type)   -> only the CONTROL reddens. Without the control,
//      a broken reader and a working engine both report "0", and this file would call the second one the first.
//   3. §17-§26's 76 items routed into `requiredEvidence`    -> the 2/9 split reddens. That mutation would make
//      nine policies unsatisfiable by any caller, so it is the one that most needs to be loud.
//   4. A list invented for §20, or for a floor policy       -> the "carries NEITHER" assertion reddens.
import { FLOOR_POLICY_DEFINITIONS } from '@janumipwb/rph-assurance';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { createEngine, getObject, seedAdditivePolicies, seedFloorPolicies } from '@janumipwb/rph-engine';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

const ACTOR: ActorReference = { actorId: 'census', actorType: 'HUMAN', displayName: 'Census' };

/** A seeded engine plus a raw dispatcher, so the CONTROL can create a policy the seeds cannot. */
function seededEngine() {
	let n = 0;
	const engine = createEngine({ authenticate: testAuthenticator(),
		ontology,
		now: () => '2026-08-04T00:00:00Z',
		newEventId: () => `e${++n}`
	}).as(TEST_CRED.human);
	seedFloorPolicies(engine);
	seedAdditivePolicies(engine);
	let c = 0;
	const send = (commandType: string, aggregateId: string, payload: unknown) => {
		c += 1;
		const command: DomainCommand = {
			commandId: `census-${c}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'ASSURANCE_POLICY',
			targetAggregateId: aggregateId,
			issuedAt: '2026-08-04T00:00:00Z',
			issuedBy: ACTOR,
			correlationId: 'evidence-census',
			idempotencyKey: `census-idem-${c}`,
			payload
		};
		return engine.dispatch(command);
	};
	return { engine, send };
}

/** Every policy id the two production seeders create — DERIVED from the same sources they iterate, so a policy
 *  added to either one is measured here without anybody remembering to add it. */
const SEEDED_POLICY_IDS = [
	...FLOOR_POLICY_DEFINITIONS.map((d) => d.policyId),
	...ontology.seedPolicies.map((p) => p.policyId)
];

/** NOTE THE SHAPE, because getting it wrong is how the first attempt at this measurement lied: `getObject`
 *  returns the object's STATE, not a wrapper around it. Reading `getObject(...)?.state` yields `state.state` —
 *  `undefined` — which `?? []` turns into an empty array for EVERY policy, producing a confident "0 of 15" that
 *  is a statement about the reader. The CONTROL below is what caught it. */
const requiredEvidenceOf = (engine: ReturnType<typeof createEngine>, id: string): unknown[] =>
	((getObject(engine, id) as { requiredEvidence?: unknown[] } | undefined)?.requiredEvidence ??
		[]) as unknown[];

/** The same reader for the OTHER ratified field (DOC-004 §3.1 declares both). Separate rather than parameterised
 *  so a typo in one field name cannot silently make both report the same array. */
const optionalEvidenceOf = (engine: ReturnType<typeof createEngine>, id: string): unknown[] =>
	((getObject(engine, id) as { optionalEvidence?: unknown[] } | undefined)?.optionalEvidence ??
		[]) as unknown[];

describe('REG-F-022: what policies declare as required evidence, and what the engine receives', () => {
	it('CONTROL: the reader CAN see a non-empty requiredEvidence, so "0" means empty and not broken', () => {
		const { engine, send } = seededEngine();
		// Create a policy through the real command path, carrying one real EvidenceRequirement. If the reader
		// below is looking at the wrong field or the wrong object, THIS reddens — and this is the only assertion
		// in the file that a genuine fix to REG-F-022 must NOT change.
		const id = 'pol_census_control';
		const r = send('CreateAssurancePolicy', id, {
			policyId: id,
			version: '1.0.0',
			name: 'Census Control Policy',
			purpose: 'Prove the census reader can observe a declared evidence requirement.',
			rationale: 'A control needs its own failure mode, or "zero" is indistinguishable from "blind".',
			applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
			evaluatedClaimTypes: ['CORRECTNESS'],
			criteria: [
				{
					id: 'CTRL-01',
					name: 'Control criterion',
					description: 'Exists so the policy is a real policy.',
					criterionType: 'QUALITATIVE',
					evaluationMethod: 'DETERMINISTIC',
					requiredEvidenceIds: [],
					severityIfNotMet: 'MATERIAL',
					mayBeNotApplicable: false
				}
			],
			requiredEvidence: [
				{
					id: 'EV-CTRL-01',
					evidenceType: 'ARTIFACT',
					description: 'An artifact the control policy requires.',
					purpose: 'To give the census something non-empty to find.',
					cardinality: 'EXACTLY_ONE',
					admissibilityRules: [],
					requiredForDispositions: 'ALL',
					mayBeWaived: false
				}
			],
			evaluatorRole: 'REVIEWER',
			independenceRequirement: 'DIFFERENT_AGENT',
			findingDefinitions: [],
			permittedControlActions: ['ESCALATE']
		});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		// Distinguish "object missing" from "field empty" — `?? []` collapses both to [], and a reader that cannot
		// tell them apart is the defect this whole file exists to avoid.
		const state = getObject(engine, id);
		expect(state, 'the control policy object must exist before its fields mean anything').toBeDefined();
		expect(
			Object.keys(state ?? {}),
			'the control object must carry a requiredEvidence key at all'
		).toContain('requiredEvidence');
		expect(
			requiredEvidenceOf(engine, id),
			'the census reader must be able to observe a declared requirement — otherwise every "0" below is ' +
				'a statement about the reader rather than about the engine'
		).toHaveLength(1);
	});

	// ── THE PIN IS GONE (REG-E-026, 2026-08-05) ────────────────────────────────────────────────────────────────
	// This file used to assert `carrying === []` — the finding, pinned. Its own instruction was "when REG-F-022 is
	// fixed this reddens — DELETE THE PIN, do not extend it." It reddened, and the pin is deleted rather than
	// widened to accommodate the fix. What replaces it is the POSITIVE census: not "is it still empty" but "what
	// exactly arrives", stated so that under-delivery and over-delivery both redden.
	//
	// WHY IT IS NOT "ALL TWELVE". DOC-004 §20 POL-CONSTRAINT-PROPAGATION has no evidence subsection at all, so it
	// carries nothing and MUST carry nothing. If this file asserted "twelve of twelve", the only way to satisfy it
	// would be to invent a list for §20 — the census would have become the thing that forces the fabrication it
	// exists to detect.
	it('the catalog delivers evidence to the OBJECTS: 2 policies gate, 9 carry, 1 has none', () => {
		const { engine } = seededEngine();
		const required = SEEDED_POLICY_IDS.filter((id) => requiredEvidenceOf(engine, id).length > 0);
		const optional = SEEDED_POLICY_IDS.filter((id) => optionalEvidenceOf(engine, id).length > 0);
		expect(
			required.sort((a, b) => a.localeCompare(b)),
			'ONLY §15.5 and §16.4 say "Required evidence", and only these two therefore gate a verdict at Gate A'
		).toEqual(['pol_intent_completeness', 'pol_intent_fidelity']);
		expect(
			optional.sort((a, b) => a.localeCompare(b)),
			'the nine §17-§26 sections headed plain "Evidence" — carried so the ratified list is not lost, and ' +
				'read by no gate'
		).toEqual([
			'pol_architecture_coverage',
			'pol_assumption_disclosure',
			'pol_baseline_promotion',
			'pol_decomposition_coverage',
			'pol_fitness_for_purpose',
			'pol_historical_consistency',
			'pol_intent_preservation',
			'pol_requirement_coverage',
			'pol_test_adequacy'
		]);
		// Item counts, so a policy delivering an empty-but-present array cannot pass the membership checks above.
		const count = (f: (id: string) => unknown[]) => SEEDED_POLICY_IDS.reduce((n, id) => n + f(id).length, 0);
		expect(count((id) => requiredEvidenceOf(engine, id))).toBe(13);
		expect(count((id) => optionalEvidenceOf(engine, id))).toBe(76);
	});

	it('§20 CONSTRAINT-PROPAGATION carries NEITHER, and the floor policies carry neither', () => {
		// The non-uniformity, asserted positively. Two separate reasons for two separate zeros:
		//   §20  — the corpus gives it no evidence subsection (see doc004-conformance.test.ts).
		//   floor — the de minimis floor is not in §15-§26 and has no ratified evidence list at all.
		// Naming both here is what stops a future author "completing" either one to make a number look tidy.
		const { engine } = seededEngine();
		for (const id of ['pol_constraint_propagation', ...FLOOR_POLICY_DEFINITIONS.map((d) => d.policyId)]) {
			expect(requiredEvidenceOf(engine, id), `${id} must carry no required evidence`).toEqual([]);
			expect(optionalEvidenceOf(engine, id), `${id} must carry no optional evidence`).toEqual([]);
		}
	});

	// THE SITE, INVERTED. It used to assert the field was ABSENT from the seeding payload. It now asserts both are
	// present — same reasoning, opposite polarity: the payload is an explicit field list with no spread, so a field
	// it does not name cannot reach the object, and a future edit dropping either one would otherwise be silent.
	it('the seeding site names BOTH evidence fields — a field it does not name cannot arrive', () => {
		const seed = readFileSync(`${REPO_ROOT}packages/rph-engine/src/seed-workbench.ts`, 'utf8');
		const body = seed.slice(seed.indexOf('export function seedAdditivePolicies'));
		const fn = body.slice(0, body.indexOf('\n}'));
		expect(fn).toContain("send('CreateAssurancePolicy'"); // CONTROL: we sliced the right function
		expect(fn).toContain('requiredEvidence: p.requiredEvidence');
		expect(fn).toContain('optionalEvidence: p.optionalEvidence');
	});

	// The ontology side, kept because the delivery census can only compare against what was authored.
	it('the authored side is complete: 11 of 12 catalog policies declare evidence', () => {
		const declaring = ontology.seedPolicies.filter(
			(p) => p.requiredEvidence.length + p.optionalEvidence.length > 0
		);
		expect(declaring).toHaveLength(11);
		expect(
			ontology.seedPolicies.filter((p) => p.requiredEvidence.length + p.optionalEvidence.length === 0),
			'exactly one policy declares none, and it is the one DOC-004 gives no evidence subsection'
		).toHaveLength(1);
	});
});
