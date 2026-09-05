// JAN-PROMPT — a work-unit type that says HOW the work is attempted, not only what it is.
//
// `REG-D-058` (sponsor): *"I will assert a prompt templates are owned."* Owned means the template rides the
// type's own aggregate, is authored through the type's own commands, freezes when the PWA publishes, and
// cannot outlive its type.
//
// ⭑ THE FIRST TEST IS THE ONE THAT WOULD HAVE SHIPPED BROKEN. `EditPwuType` refuses a no-op edit by comparing
// an enumerated list of payload fields; a field absent from that list is invisible to the comparison, so an
// edit changing ONLY the prompt would compare equal and be refused as "nothing changed" — the sponsor's own
// complaint (*"I couldn't see where to view or edit the PWU's prompt template"*) reproduced one layer down by
// the fix for it.
import { describe, expect, it } from 'vitest';
import {
	PwuTypeSchema,
	type DomainCommand,
	type PromptTemplate
} from '@janumipwb/rph-contracts';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { Engine } from '../index.js';
import type { AuthedEngine } from '../index.js';

const TS = '2026-09-04T00:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P10';
const TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P20';
const TYPE2 = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P21';
const TYPE3 = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P22';

let seq = 0;
let store: SqliteStorageAdapter;
function fresh(): AuthedEngine {
	seq = 0;
	store = new SqliteStorageAdapter({ now: () => TS });
	return new Engine({
		authenticate: testAuthenticator(),
		store,
		now: () => TS,
		newEventId: () => `e${++seq}`
	}).as(TEST_CRED.human);
}

function dispatch(
	engine: AuthedEngine,
	commandType: string,
	targetAggregateId: string,
	targetAggregateType: string,
	payload: unknown
) {
	const n = ++seq;
	const command: DomainCommand = {
		commandId: `c-${n}`,
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType,
		targetAggregateId,
		issuedAt: TS,
		correlationId: 'jan-prompt',
		idempotencyKey: `k-${n}`,
		payload
	} as DomainCommand;
	return engine.dispatch(command);
}

const TEMPLATE: PromptTemplate = {
	templateText: 'Assess {subject} against {criteria}.',
	templateVersion: 1,
	declaredPlaceholders: ['subject', 'criteria'],
	status: 'DRAFT'
};

const ACTOR = { actorId: 'a1', actorType: 'HUMAN', displayName: 'Test Professional' };

/**
 * A COMPLETE, VALID PWU_TYPE, so every assertion below turns on the ONE thing it is testing.
 *
 * ⚠⚠ THIS HELPER EXISTS BECAUSE THE FIRST DRAFT SHIPPED WITHOUT IT AND ONE TEST PASSED FOR THE WRONG REASON.
 * The fixtures omitted the whole object envelope, so the DEC-4 refusal test — "a fate canon does not name must
 * be refused" — went green against a parse that was ALSO failing on eighteen missing envelope fields. It would
 * have passed just as happily with `fate` typed as a bare string, which is the mutant it exists to catch.
 * An arrangement that trips two guards proves NEITHER.
 */
function pwuType(over: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5FAV',
		objectType: 'PWU_TYPE',
		schemaVersion: 1,
		semanticVersion: 1,
		revision: 1,
		lifecycleStatus: 'DRAFT',
		createdAt: '2026-09-04T10:00:00Z',
		createdBy: ACTOR,
		updatedAt: '2026-09-04T10:00:00Z',
		updatedBy: ACTOR,
		provenance: { originType: 'HUMAN_DECISION', sourceObjectIds: [], sourceEventIds: [] },
		tags: [],
		extensions: [],
		pwaId: 'pwa_1',
		pwaVersion: '1.0.0',
		pwuKind: 'analysis',
		name: 'Assess',
		purpose: 'Assess the subject',
		isRoot: false,
		permittedParentTypeIds: [],
		permittedChildTypeIds: [],
		requiredInputs: [],
		requiredOutputs: [],
		requiredAssurancePolicyIds: [],
		completionRule: 'all outputs produced',
		status: 'DRAFT',
		...over
	};
}

describe('JAN-PROMPT — the type owns its prompt', () => {
	// ⚠⚠ THE FIRST VERSION OF THIS TEST COULD NOT HAVE CAUGHT ITS OWN MUTANT. It asserted that
	// `promptTemplate` is a key of `EditPwuTypePayloadSchema` — which stays true whether the no-op comparison
	// is derived from that schema or hand-written from a stale list. It was testing the payload, not the
	// comparison. The only thing that separates the two implementations is DRIVING AN EDIT, so that is what
	// this does: a real engine, a real PWA, a real type, and an edit that changes NOTHING BUT THE PROMPT.
	it('⭑ an edit that changes ONLY the prompt is ACCEPTED, not refused as a no-op', () => {
		const engine = fresh();
		dispatch(engine, 'CreatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
			pwaId: PWA,
			name: 'Test PWA',
			description: 'for the prompt test',
			domain: 'test',
			version: '1.0.0'
		});
		dispatch(engine, 'DefinePwuType', TYPE, 'PWU_TYPE', {
			pwuTypeId: TYPE,
			pwaId: PWA,
			pwuKind: 'analysis',
			name: 'Assess',
			purpose: 'Assess the subject',
			isRoot: true
		});

		// THE MUTANT: restore the hand-written twelve-name list in `EDITABLE_PWU_TYPE_FIELDS`. The comparison
		// then sees no change, `pwuTypeEditNoOp` refuses, and the prompt can never be saved — the sponsor's
		// original complaint reproduced by the fix for it.
		const r = dispatch(engine, 'EditPwuType', TYPE, 'PWU_TYPE', {
			pwuTypeId: TYPE,
			promptTemplate: TEMPLATE
		});
		expect(r.status, JSON.stringify(r)).toBe('ACCEPTED');

		// And it actually landed in state — accepted-but-dropped is the other half of the same defect.
		const state = store.loadObject(TYPE)?.state as { promptTemplate?: PromptTemplate };
		expect(state.promptTemplate?.templateText, 'the prompt was accepted and not stored').toBe(
			TEMPLATE.templateText
		);
	});

	// ── JAN-DISCHARGE — a type must not disagree with itself about who does its work ────────────────────────
	it('⛔ REFUSES an ACTIVE prompt on a type that does not declare MODEL', () => {
		// ⭑ THE DIRECTION THAT WOULD OTHERWISE BE SILENT. A carefully authored prompt sits on a HUMAN type,
		// nothing ever renders it, and no field anywhere says so — authored, reviewed, published, inert.
		//
		// THE MUTANT: keep only the obvious rule (MODEL needs a template) and drop this one. Every other test
		// here still passes, and the inert-prompt state becomes reachable and invisible.
		const engine = fresh();
		dispatch(engine, 'CreatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
			pwaId: PWA, name: 'T', description: 'd', domain: 'test', version: '1.0.0'
		});
		const r = dispatch(engine, 'DefinePwuType', TYPE, 'PWU_TYPE', {
			pwuTypeId: TYPE, pwaId: PWA, pwuKind: 'analysis', name: 'A', purpose: 'p', isRoot: true,
			workDischarge: 'HUMAN',
			promptTemplate: { ...TEMPLATE, status: 'ACTIVE' }
		});
		expect(r.status).not.toBe('ACCEPTED');
		expect(JSON.stringify(r)).toMatch(/never be rendered|ACTIVE prompt template/);
	});

	it('⛔ REFUSES a discharge on a DELEGATED_EXTERNAL type — the counterparty owns that answer', () => {
		// executionBoundary already says the work leaves the organisation and boundaryContract names who does
		// it. THE MUTANT: allow it. Two statements of one fact, free to disagree.
		const engine = fresh();
		dispatch(engine, 'CreatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
			pwaId: PWA, name: 'T', description: 'd', domain: 'test', version: '1.0.0'
		});
		const r = dispatch(engine, 'DefinePwuType', TYPE, 'PWU_TYPE', {
			pwuTypeId: TYPE, pwaId: PWA, pwuKind: 'analysis', name: 'A', purpose: 'p', isRoot: true,
			executionBoundary: 'DELEGATED_EXTERNAL',
			boundaryContract: { counterpartyLabel: 'Acme', attestedAssurancePolicyIds: [] },
			workDischarge: 'HUMAN'
		});
		expect(r.status).not.toBe('ACCEPTED');
		expect(JSON.stringify(r)).toMatch(/DELEGATED_EXTERNAL/);
	});

	it('⭑ CONTROL — MODEL mid-draft, HUMAN, and a plain delegated type are ALL accepted', () => {
		// Without this the two refusals above could not be told apart from "refuse every discharge".
		//
		// ⚠⚠ AND THE FIRST CASE IS A RULE THIS PROGRAMME DROPPED ON EVIDENCE. A symmetric rule refusing MODEL
		// with no ACTIVE template was implemented and shipped; the first e2e that authored a type failed,
		// because DECLARING MODEL AND THEN WRITING THE PROMPT IS THE NORMAL ORDER. It also bought nothing —
		// `prepareModelInvocation` already refuses at run time with a better message. Pinning it accepted here
		// is what stops someone re-adding it on the same reasoning.
		const engine = fresh();
		dispatch(engine, 'CreatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
			pwaId: PWA, name: 'T', description: 'd', domain: 'test', version: '1.0.0'
		});
		const mid = dispatch(engine, 'DefinePwuType', TYPE, 'PWU_TYPE', {
			pwuTypeId: TYPE, pwaId: PWA, pwuKind: 'analysis', name: 'A', purpose: 'p', isRoot: true,
			workDischarge: 'MODEL'
		});
		expect(mid.status, 'declaring MODEL before the prompt is written must be allowed').toBe('ACCEPTED');

		const human = dispatch(engine, 'DefinePwuType', TYPE2, 'PWU_TYPE', {
			pwuTypeId: TYPE2, pwaId: PWA, pwuKind: 'analysis', name: 'B', purpose: 'p', isRoot: false,
			workDischarge: 'HUMAN'
		});
		expect(human.status, JSON.stringify(human)).toBe('ACCEPTED');

		const delegated = dispatch(engine, 'DefinePwuType', TYPE3, 'PWU_TYPE', {
			pwuTypeId: TYPE3, pwaId: PWA, pwuKind: 'analysis', name: 'C', purpose: 'p', isRoot: false,
			executionBoundary: 'DELEGATED_EXTERNAL',
			boundaryContract: { counterpartyLabel: 'Acme', attestedAssurancePolicyIds: [] }
		});
		expect(delegated.status, JSON.stringify(delegated)).toBe('ACCEPTED');
	});

	it('CONTROL — an edit that changes genuinely nothing IS still refused', () => {
		// Without this, the test above could not be told apart from "the no-op check was deleted", which would
		// silently re-admit the double-`PwuTypeRedefined` and the INV-6 version leak DWP-08 exists to stop.
		const engine = fresh();
		dispatch(engine, 'CreatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
			pwaId: PWA,
			name: 'Test PWA',
			description: 'for the prompt test',
			domain: 'test',
			version: '1.0.0'
		});
		dispatch(engine, 'DefinePwuType', TYPE, 'PWU_TYPE', {
			pwuTypeId: TYPE,
			pwaId: PWA,
			pwuKind: 'analysis',
			name: 'Assess',
			purpose: 'Assess the subject',
			isRoot: true
		});
		const r = dispatch(engine, 'EditPwuType', TYPE, 'PWU_TYPE', {
			pwuTypeId: TYPE,
			name: 'Assess'
		});
		expect(r.status, 'a real no-op must still be refused').not.toBe('ACCEPTED');
	});

	it('a PWU type accepts a prompt template and a context specification', () => {
		const parsed = PwuTypeSchema.safeParse(
			pwuType({
				promptTemplate: TEMPLATE,
				contextSpecification: { requiredElements: ['subject', 'criteria'], constraintDispositions: [] }
			})
		);
		expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
	});

	it('⛔ CONSTRAINT FATES ARE A CLOSED UNION — canon names five and only five', () => {
		// DEC-4 (JPWB-DOC-003:224): "exactly one holds per relevant child: propagated …; retained at parent
		// level; marked inapplicable with rationale; waived through authority; or superseded by a stronger
		// constraint. No silent omission." ⭑ THE FIVE ARE QUOTED FROM CANON, NOT INVENTED — so a sixth is not
		// an extension, it is a fate canon does not recognise.
		//
		// THE MUTANT: type `fate` as a bare string. A context assembly could then record "dropped" or "n/a" and
		// satisfy the schema, which is precisely the silent removal DEC-4 exists to forbid.
		const bad = PwuTypeSchema.safeParse(
			pwuType({
				contextSpecification: {
					requiredElements: [],
					constraintDispositions: [{ constraintId: 'c1', fate: 'DROPPED' }]
				}
			})
		);
		expect(bad.success, 'a fate canon does not name must be refused').toBe(false);
		// ⭑ AND THE REFUSAL IS ABOUT THE FATE, not about anything else the fixture might be missing. Without
		// this the test would pass against a fixture broken in some other way — which is exactly how the first
		// draft of it passed.
		const paths = bad.error?.issues.map((i) => i.path.join('.')) ?? [];
		expect(paths, 'the only complaint must be the fate').toEqual([
			'contextSpecification.constraintDispositions.0.fate'
		]);
	});

	it('CONTROL — one of the five real fates IS accepted, so the union is closed and not empty', () => {
		// Without this, the refusal above could not be told apart from "refuse every disposition", which would
		// make the DEC-4 carrier unusable and look like enforcement.
		const ok = PwuTypeSchema.safeParse(
			pwuType({
				contextSpecification: {
					requiredElements: [],
					constraintDispositions: [
						{ constraintId: 'c1', fate: 'INAPPLICABLE_WITH_RATIONALE', rationale: 'out of scope' }
					]
				}
			})
		);
		expect(ok.success, JSON.stringify(ok.error?.issues)).toBe(true);
	});

	it('⚠ both fields are OPTIONAL, and that is forced by PER-2 rather than preferred', () => {
		// Every `PwuTypeDefined` already written carries no template. A REQUIRED field would either falsify
		// those records or demand an upcaster inventing a template nobody authored — and PER-2 forbids
		// rewriting events. Absence means "this type declares no agent behaviour", which is TRUE of every type
		// that exists today.
		//
		// THE MUTANT: make either field required. Every existing type, and the whole seeded reference
		// undertaking, stops parsing.
		const bare = PwuTypeSchema.safeParse(pwuType());
		expect(bare.success, JSON.stringify(bare.error?.issues)).toBe(true);
	});
});
