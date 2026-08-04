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
// THE FINDING THIS PINS. Every catalog policy declares which evidence types it requires; `seedAdditivePolicies`
// maps eleven fields and not that one; so every policy object is born with `requiredEvidence: []`. Gate A in
// `completeAssuranceAssessment` — the refusal that stops a SATISFIED disposition standing on unmet mandatory
// evidence — reads that array, evaluates an empty set, and admits everything. A control whose population is
// empty is a control that cannot fail.
//
// WHAT MUST REDDEN, NAMED IN ADVANCE (a green here means nothing unless these are true):
//   1. Someone maps the authored requirement into the seed  -> `policies carrying required evidence` reddens.
//      THAT IS THE FIX LANDING, and the pin comes out with it.
//   2. The reader breaks (wrong field, wrong object type)   -> only the CONTROL reddens. Without the control,
//      a broken reader and a fixed engine both report "0", and this file would call the second one the first.
//   3. A 13th catalog policy arrives without the field      -> `every catalog policy declares` reddens.
import { FLOOR_POLICY_DEFINITIONS } from '@janumipwb/rph-assurance';
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
	const engine = createEngine({
		ontology,
		now: () => '2026-08-04T00:00:00Z',
		newEventId: () => `e${++n}`
	});
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

	it('every catalog policy DECLARES required evidence types — the authored side is not the gap', () => {
		const declaring = ontology.seedPolicies.filter(
			(p) => ((p as { requiredEvidenceTypes?: readonly string[] }).requiredEvidenceTypes ?? []).length > 0
		);
		expect(
			declaring.map((p) => p.policyId).sort((a, b) => a.localeCompare(b)),
			'every catalog policy states which evidence types it requires — so nothing is missing at the source'
		).toEqual(ontology.seedPolicies.map((p) => p.policyId).sort((a, b) => a.localeCompare(b)));
		expect(declaring.length).toBeGreaterThanOrEqual(12);
	});

	// THE FINDING. Read back from live objects, because the drop is in the seeding — the source literals are fine.
	it('NO seeded policy OBJECT carries any required evidence — the authored declaration never arrives', () => {
		const { engine } = seededEngine();
		const carrying = SEEDED_POLICY_IDS.filter((id) => requiredEvidenceOf(engine, id).length > 0);
		expect(
			carrying,
			'REG-F-022 KNOWN GAP. These policies would be the ones whose declaration survived seeding. While this ' +
				'list is empty, Gate A in completeAssuranceAssessment (the refusal that stops a SATISFIED ' +
				'disposition standing on unmet mandatory evidence) reads an empty set on every policy that ships, ' +
				'and §38 "missing evidence" is always empty. When REG-F-022 is fixed this reddens — DELETE THE PIN, ' +
				'do not extend it.'
		).toEqual([]);
		// Counted separately so the two halves of the finding cannot drift: N policies exist, 0 of them carry.
		expect(SEEDED_POLICY_IDS.length).toBeGreaterThanOrEqual(15);
	});

	// THE SITE. Named precisely, because the handler's `p.requiredEvidence ?? []` is the DEFAULTING and is where a
	// reader lands first — the cause is that no production caller supplies the field at all.
	it('the seeding site is where it is dropped — seedAdditivePolicies never mentions the field', () => {
		const seed = readFileSync(`${REPO_ROOT}packages/rph-engine/src/seed-workbench.ts`, 'utf8');
		const body = seed.slice(seed.indexOf('export function seedAdditivePolicies'));
		const fn = body.slice(0, body.indexOf('\n}'));
		expect(fn).toContain("send('CreateAssurancePolicy'"); // CONTROL: we sliced the right function
		expect(
			fn.includes('requiredEvidence'),
			'seedAdditivePolicies builds the CreateAssurancePolicy payload as an explicit field list with no ' +
				'spread, so a field it does not name cannot reach the object. Fixing REG-F-022 means naming it here.'
		).toBe(false);
	});
});
