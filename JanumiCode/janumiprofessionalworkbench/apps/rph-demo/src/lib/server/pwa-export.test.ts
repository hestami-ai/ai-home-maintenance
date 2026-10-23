// JAN-EXECGOV EG-07d — the whole-PWA reviewer sees how work is discharged.
//
// WHY THIS FILE EXISTS. `buildPwaExport` is the canonical subject of the ONE assurance act that reads a whole
// PWA: the de minimis floor Reasoning Review. Until this increment it projected EIGHT fields, and
// `workDischarge` was not among them — so the reviewer approving a PWA for use could not see how any of its
// work would be discharged, while `undertakings/[id]/+page.server.ts` decides `isModelStep` from exactly that
// value and silently downgrades an undeclared type to a TRANSFORMATION step.
//
// ⭑ SPONSOR DECISION `G-5`, answered verbatim: *"Add both to the export, no new criterion."* Both halves are
// asserted below — the export CARRIES the two fields, and `REASONING_REVIEW_CRITERIA` is UNCHANGED. A ratified
// floor policy is not edited by an implementer to carry a new rule, and the control is what keeps that true.
//
// ⚠ AND THE EXPORT HAD NO TEST AT ALL, which is why the roadmap's mutant ("leave `buildPwaExport` at 8 fields")
// had nothing to redden. That absence is the reason this file is new rather than an edit.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import {
	createEngine,
	seedAdditivePolicies,
	type AuthedEngineHandle,
	type EngineHandle
} from '@janumipwb/rph-engine';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { beforeEach, describe, expect, it } from 'vitest';
import { SESSION_CREDENTIAL, standaloneAuthenticator } from './identity.js';
import { buildPwaExport } from './workbench.js';

const TS = '2026-07-18T12:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P01';

describe('JAN-EXECGOV EG-07d — buildPwaExport carries workDischarge and prompt status', () => {
	let host: EngineHandle;
	let engine: AuthedEngineHandle;
	let sequence: number;

	function dispatch(
		commandType: string,
		targetAggregateType: string,
		targetAggregateId: string,
		payload: unknown
	) {
		sequence += 1;
		const command: DomainCommand = {
			commandId: `setup-${sequence}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: TS,
			correlationId: 'setup',
			idempotencyKey: `setup-idem-${sequence}`,
			payload
		};
		return engine.dispatch(command);
	}

	/** One PWU type. `extra` carries the EG-07 fields under test; omitting it is the NEVER-ASKED case. */
	function defineType(id: string, name: string, extra: Record<string, unknown> = {}) {
		expect(
			dispatch('DefinePwuType', 'PWU_TYPE', id, {
				pwuTypeId: id,
				pwaId: PWA,
				pwuKind: name.toUpperCase(),
				name,
				purpose: name,
				isRoot: name === 'Root',
				permittedChildTypeIds: [],
				requiredInputs: [],
				requiredOutputs: [],
				requiredAssurancePolicyIds: [],
				...extra
			}).status
		).toBe('ACCEPTED');
	}

	beforeEach(() => {
		sequence = 0;
		host = createEngine({
			authenticate: standaloneAuthenticator(),
			ontology,
			now: () => TS,
			newEventId: () => `evt_${++sequence}`
		});
		engine = host.as(SESSION_CREDENTIAL);
		expect(
			dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, {
				pwaId: PWA,
				name: 'Export PWA',
				description: 'EG-07d subject',
				domain: 'software',
				version: '1.0.0'
			}).status
		).toBe('ACCEPTED');
	});

	/** The floor this file's assertions rest on: an export with no nodes would satisfy every `find` below. */
	it('projects a non-empty node set, so nothing after this can pass vacuously', () => {
		defineType('put_01ARZ3NDEKTSV4RRFFQ69G5P01', 'Root');
		const graph = buildPwaExport(PWA, engine);
		expect(graph?.nodes.length).toBeGreaterThan(0);
	});

	it('⭑ carries workDischarge into the export — the reviewer can see WHO does the work', () => {
		defineType('put_01ARZ3NDEKTSV4RRFFQ69G5P02', 'Root', { workDischarge: 'MODEL' });
		const node = buildPwaExport(PWA, engine)?.nodes.find((n) => n.name === 'Root');
		expect(node?.workDischarge).toBe('MODEL');
	});

	it('⭑ carries the prompt template status into the export', () => {
		defineType('put_01ARZ3NDEKTSV4RRFFQ69G5P03', 'Root', {
			workDischarge: 'MODEL',
			promptTemplate: {
				templateText: 'Do the thing.',
				outputContract: 'A thing.',
				templateVersion: 1,
				status: 'ACTIVE',
				declaredPlaceholders: []
			}
		});
		const node = buildPwaExport(PWA, engine)?.nodes.find((n) => n.name === 'Root');
		expect(node?.promptStatus).toBe('ACTIVE');
	});

	it('⛔ ABSENT STAYS ABSENT — a type never asked is not a type that DEFERRED', () => {
		// The conflation `workDischarge` exists to remove, re-created at the surface that reports it would be
		// the worst place for it: a reviewer told `'UNDECLARED'` reads "the author was asked and declined",
		// which is a different professional fact from "this type predates the question".
		defineType('put_01ARZ3NDEKTSV4RRFFQ69G5P04', 'Root');
		const node = buildPwaExport(PWA, engine)?.nodes.find((n) => n.name === 'Root');
		expect(node?.workDischarge).toBeUndefined();
		expect(node?.promptStatus).toBeUndefined();
	});

	it('⛔ a DRAFT template is reported as DRAFT, never as armed', () => {
		defineType('put_01ARZ3NDEKTSV4RRFFQ69G5P05', 'Root', {
			workDischarge: 'MODEL',
			promptTemplate: {
				templateText: 'Draft text.',
				outputContract: 'A thing.',
				templateVersion: 1,
				status: 'DRAFT',
				declaredPlaceholders: []
			}
		});
		const node = buildPwaExport(PWA, engine)?.nodes.find((n) => n.name === 'Root');
		expect(node?.promptStatus).toBe('DRAFT');
	});

	// ── THE CONTROL (sponsor decision `G-5`, second half) ────────────────────────────────────────────────────
	it('⛔ CONTROL — the REASONING_REVIEW criteria are UNCHANGED: no new criterion was added', () => {
		// `G-5` answered TWO questions and this is the one an implementer is most likely to over-reach on:
		// having given the reviewer a new fact, the tempting next step is to give them a new RULE about it.
		// A floor policy's criteria are ratified; widening them here would be an implementer legislating.
		// ⚠ The pin is by ID and by COUNT: an id list alone would tolerate an appended criterion if the
		// assertion were `toContain`, and a count alone would tolerate a swap.
		// ⛔ THE FIRST DRAFT OF THIS LINE SPREAD `REASONING_REVIEW_CRITERIA.slice(7)` BACK INTO ITS OWN EXPECTED
		// VALUE, which compares the subject to itself for every entry past the seventh — a control that cannot
		// fail for exactly the appended-criterion case it exists to catch. The list is written out in full.
		expect(REASONING_REVIEW_CRITERIA.map((c) => c.id)).toEqual([
			'RR-01-no-problem-substitution',
			'RR-02-no-obligation-elision',
			'RR-03-no-unjustified-scope-reduction',
			'RR-04-no-proxy-satisfaction',
			'RR-05-no-premature-convergence',
			'RR-06-sound-inference',
			'RR-07-no-contradiction',
			'RR-08-evidence-integrity',
			'RR-09-no-completeness-from-existence'
		]);
		// ⛔ AND A SECOND PROBE WAS WRITTEN HERE AND DELETED, RECORDED BECAUSE IT FAILED FOR THE RIGHT REASON.
		// It asserted that no criterion's text matches /discharge|prompt/ — and `RR-01`'s RATIFIED label reads
		// *"The result genuinely DISCHARGES its delegated obligation…"*, so it fired on canon prose that has
		// nothing to do with `workDischarge`. It was also redundant: `toEqual` over the full id list above
		// already fails on ANY addition, which is the thing `G-5` forbids. A keyword probe over ratified text is
		// a worse instrument than an exact pin, and it manufactures false positives the pin cannot.
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7 after P6's third run, package P, F1 (`REG-F-503` remedy 1; `REG-D-123` Q25;
// DESIGN-phase-7-completion.md §4c) — WHAT THE REVIEWER OF A WHOLE PWA MUST JUDGE, CARRIED.
//
// In run-11 the authoring reviewer rejected a candidate whose 16 types all declared MODEL, faulting that the export it was
// shown carried no requiredAssurancePolicyIds and no instruction content on any node (`REG-F-503`). The export gave each type
// its structure, `workDischarge` and `promptStatus`, and dropped what the type declares about its work. These hold the live
// exporter to carrying, from the STORED type, its declared policy ids, its purpose, each child rule with its cardinality and
// applicability note, and its prompt template's text, output contract, status and version:
//   · a field the stored type does not hold is omitted, never manufactured — no empty value for an absence, and no empty
//     template for a type with none;
//   · an empty array or an empty string the author stored is carried as authored;
//   · `workDischarge` and `promptStatus` keep their three-way distinctions beside the template.
describe('⭐⭐ package P F1 (REG-F-503 remedy 1) — buildPwaExport carries a type’s declared policies, purpose, child rules and prompt template', () => {
	const ROOT_ID = 'put_01ARZ3NDEKTSV4RRFFQ69G5P11';
	const CHILD_ID = 'put_01ARZ3NDEKTSV4RRFFQ69G5P12';
	let host: EngineHandle;
	let engine: AuthedEngineHandle;
	let sequence: number;

	function dispatch(commandType: string, targetAggregateType: string, targetAggregateId: string, payload: unknown) {
		sequence += 1;
		const command: DomainCommand = {
			commandId: `f1-${sequence}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: TS,
			correlationId: 'f1',
			idempotencyKey: `f1-idem-${sequence}`,
			payload
		};
		const result = engine.dispatch(command);
		expect(result.status, `${commandType} ${targetAggregateId}: ${JSON.stringify(result.error)}`).toBe('ACCEPTED');
	}
	const define = (id: string, payload: Record<string, unknown>) =>
		dispatch('DefinePwuType', 'PWU_TYPE', id, { pwuTypeId: id, pwaId: PWA, isRoot: false, ...payload });
	const exported = (id: string) => buildPwaExport(PWA, engine)?.nodes.find((n) => n.id === id);

	beforeEach(() => {
		sequence = 0;
		host = createEngine({
			authenticate: standaloneAuthenticator(),
			ontology,
			now: () => TS,
			newEventId: () => `evt_${++sequence}`
		});
		engine = host.as(SESSION_CREDENTIAL);
		// The catalog's policies, ACTIVE, so a type may declare them (`checkPolicyRefsOnState`).
		seedAdditivePolicies(engine);
		dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, {
			pwaId: PWA,
			name: 'Export PWA',
			description: 'F1 subject',
			domain: 'software',
			version: '1.0.0'
		});
	});

	/** The verification child every root below permits, defined first so the root's rule names a type that exists. */
	const defineChild = (extra: Record<string, unknown> = {}) =>
		define(CHILD_ID, {
			pwuKind: 'INTEGRATED_PRODUCT_VALIDATION',
			name: 'Verification',
			purpose: 'Run the built product against its requirements and report what each run shows.',
			...extra
		});
	const TEMPLATE = {
		templateText: 'Realize {title}: synthesize the result from your children’s work products, citing each.',
		outputContract: 'A JSON object: {"result": string, "evidence": string[]}.',
		templateVersion: 2,
		status: 'ACTIVE',
		declaredPlaceholders: ['title']
	} as const;
	const RULE = {
		typeId: CHILD_ID,
		cardinality: 'M1',
		applicabilityNote: 'Every realization is verified before it is reported.'
	} as const;

	it('⭐ RED FIRST — a stored type’s declared policy ids, purpose, child rules and prompt template reach the export unchanged', () => {
		defineChild();
		define(ROOT_ID, {
			pwuKind: 'PRODUCT_REALIZATION',
			name: 'Realization',
			purpose: 'Construct and verify wordfreq from the supplied requirements and design.',
			isRoot: true,
			permittedChildTypeIds: [CHILD_ID],
			permittedChildren: [RULE],
			requiredAssurancePolicyIds: ['pol_intent_preservation', 'pol_fitness_for_purpose'],
			workDischarge: 'MODEL',
			promptTemplate: TEMPLATE
		});
		const node = exported(ROOT_ID);
		expect(
			{
				purpose: node?.purpose,
				requiredAssurancePolicyIds: node?.requiredAssurancePolicyIds,
				permittedChildren: node?.permittedChildren,
				promptTemplate: node?.promptTemplate
			},
			'what the stored type declares about its work'
		).toEqual({
			purpose: 'Construct and verify wordfreq from the supplied requirements and design.',
			requiredAssurancePolicyIds: ['pol_intent_preservation', 'pol_fitness_for_purpose'],
			permittedChildren: [RULE],
			// Its text and output contract with its status and version; nothing else of the stored template.
			promptTemplate: {
				templateText: TEMPLATE.templateText,
				outputContract: TEMPLATE.outputContract,
				status: 'ACTIVE',
				templateVersion: 2
			}
		});
		// Beside the existing flat child ids and the two EG-07d fields, which keep their meaning.
		expect([node?.permittedChildTypeIds, node?.workDischarge, node?.promptStatus]).toEqual([[CHILD_ID], 'MODEL', 'ACTIVE']);
	});

	it('⭐ the four fields follow the fields the export already carried, in this order — the key order a qualification case writes its nodes in', () => {
		defineChild();
		define(ROOT_ID, {
			pwuKind: 'PRODUCT_REALIZATION',
			name: 'Realization',
			purpose: 'Construct and verify wordfreq.',
			isRoot: true,
			permittedChildren: [RULE],
			requiredAssurancePolicyIds: ['pol_intent_preservation'],
			workDischarge: 'MODEL',
			promptTemplate: TEMPLATE
		});
		const node = exported(ROOT_ID);
		expect(Object.keys(node ?? {})).toEqual([
			'id',
			'name',
			'pwuKind',
			'isRoot',
			'permittedChildTypeIds',
			'requiredInputs',
			'requiredOutputs',
			'executionBoundary',
			'workDischarge',
			'promptStatus',
			'purpose',
			'requiredAssurancePolicyIds',
			'permittedChildren',
			'promptTemplate'
		]);
		expect(Object.keys(node?.promptTemplate ?? {})).toEqual(['templateText', 'outputContract', 'status', 'templateVersion']);
	});

	it('⭐ AN AUTHORED EMPTY VALUE IS CARRIED AS AUTHORED — an empty purpose, no declared policy, no child rule, an empty output contract and an empty applicability note', () => {
		defineChild({ purpose: '', requiredAssurancePolicyIds: [], permittedChildren: [] });
		define(ROOT_ID, {
			pwuKind: 'PRODUCT_REALIZATION',
			name: 'Realization',
			purpose: 'Construct and verify wordfreq.',
			isRoot: true,
			permittedChildren: [{ ...RULE, applicabilityNote: '' }],
			requiredAssurancePolicyIds: [],
			workDischarge: 'MODEL',
			promptTemplate: { ...TEMPLATE, outputContract: '' }
		});
		const child = exported(CHILD_ID);
		expect([child?.purpose, child?.requiredAssurancePolicyIds, child?.permittedChildren], 'the child’s empty values').toEqual(['', [], []]);
		const root = exported(ROOT_ID);
		expect(root?.permittedChildren, 'an empty applicability note').toEqual([{ ...RULE, applicabilityNote: '' }]);
		expect(root?.promptTemplate?.outputContract, 'an empty output contract').toBe('');
		expect(root?.requiredAssurancePolicyIds, 'no declared policy').toEqual([]);
	});

	it('⛔ ABSENT STAYS ABSENT — a type with no template carries none, a template with no output contract carries none, a rule with no note carries none', () => {
		// A type never given a template has not been written; an empty template in the export would say it had.
		defineChild();
		define(ROOT_ID, {
			pwuKind: 'PRODUCT_REALIZATION',
			name: 'Realization',
			purpose: 'Construct and verify wordfreq.',
			isRoot: true,
			permittedChildren: [{ typeId: CHILD_ID, cardinality: 'C1' }],
			workDischarge: 'MODEL',
			promptTemplate: { templateText: 'Realize {title}.', templateVersion: 1, status: 'DRAFT', declaredPlaceholders: ['title'] }
		});
		const child = exported(CHILD_ID);
		expect(child, 'arrangement: the child is exported').toBeDefined();
		expect(child !== undefined && 'promptTemplate' in child, 'a type with no template carries none').toBe(false);
		expect(child !== undefined && 'promptStatus' in child, 'nor a prompt status (EG-07d)').toBe(false);
		const root = exported(ROOT_ID);
		expect(root?.promptTemplate, 'a DRAFT template with no output contract').toEqual({
			templateText: 'Realize {title}.',
			status: 'DRAFT',
			templateVersion: 1
		});
		expect(root?.promptStatus, 'reported DRAFT, never armed (EG-07d)').toBe('DRAFT');
		expect(root?.permittedChildren, 'a rule with no applicability note').toEqual([{ typeId: CHILD_ID, cardinality: 'C1' }]);
	});

	it('⛔ ABSENT STAYS ABSENT — a stored type that predates a field carries none of it: no purpose, no policy ids and no child rules are manufactured', () => {
		// `definePwuType` stores a purpose, policy ids and child rules on every type it defines, so a type without them is one
		// stored before they existed: read here through a handle whose stored PWU_TYPE states lack the three.
		defineChild();
		const PREDATES = ['purpose', 'requiredAssurancePolicyIds', 'permittedChildren'];
		const predating = new Proxy(engine, {
			get(target, key, receiver) {
				if (key === 'loadObject')
					return (id: string) => {
						const stored = target.loadObject(id);
						const state = stored?.state as Record<string, unknown> | undefined;
						if (!stored || state?.objectType !== 'PWU_TYPE') return stored;
						const older = { ...state };
						for (const field of PREDATES) delete older[field];
						return { ...stored, state: older };
					};
				const value = Reflect.get(target, key, receiver) as unknown;
				return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
			}
		});
		const node = buildPwaExport(PWA, predating)?.nodes.find((n) => n.id === CHILD_ID);
		expect(node, 'arrangement: the type is exported').toBeDefined();
		expect(PREDATES.filter((field) => node !== undefined && field in node), 'fields manufactured for an absence').toEqual([]);
		// ⭑ CONTROL — the same type, read as stored: each of the three is there.
		const stored = exported(CHILD_ID);
		expect(PREDATES.filter((field) => stored !== undefined && field in stored), 'the define path stored all three').toEqual(PREDATES);
	});
});
