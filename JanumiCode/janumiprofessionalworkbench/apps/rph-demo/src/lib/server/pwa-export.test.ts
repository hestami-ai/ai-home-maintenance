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
import { createEngine, type AuthedEngineHandle, type EngineHandle } from '@janumipwb/rph-engine';
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
