// ⭐⭐ `JAN-EXEC` Phase 7, package L11 — design D66 (`REG-D-155`; `REG-F-502`, remedy 1; `REG-F-508`; `REG-F-627`) — SUBMIT REFUSES A PWA THAT
// VALIDATE OR PUBLISH WOULD REFUSE FOR ITS STRUCTURE, ITS PROMPTS OR ITS FLOOR, naming every check that fails, while the PWA is DRAFT.
//
// ⛔ WHAT WAS WRONG (`REG-F-502`). The publication machine has no arrow back to DRAFT, and a PWA's types are edited only while it is DRAFT; yet
// SubmitPwaForReview had no guard, so the structure was first refused at ValidatePwa and the prompts and the floor at PublishPwa, each once the
// PWA could no longer be repaired, only authored again. And in a PWA an agent built, repairing a prompt is a type's edit, which raises the PWA's
// version and leaves its recorded floor at another version — a floor only an agent turn records, on a DRAFT.
//
// ⭑ WHAT MUST HOLD (D66; `l11-facts.md` §3 (a) to (c)). Submit, after its precondition, asks the three things the later checks decide, by calling
// their decisions, so it and they cannot disagree; and it refuses once, naming every check that fails, the structure and the prompts before the
// floor. Nothing is submitted and the PWA is left DRAFT. A PWA no agent produced and for which no floor was recorded passes the floor, as at Publish.
//
// ⭑ THE REFUSAL'S WORDS ARE RESTATED HERE, NOT IMPORTED: a person reads them on the PWA's page and the lane writes them as its end
// (`designerEnd`), so a change to them must redden here.
import type { ActorReference, DomainCommand, PromptTemplate } from '@janumipwb/rph-contracts';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine, markersIn } from '../index.js';
import { recordFloorAssessment, seedFloorPolicies } from './__tests__/floor-fixtures.js';

const TS = '2026-11-12T00:00:00Z';
const AGENT: ActorReference = { actorId: 'agent-1', actorType: 'AGENT', displayName: 'Authoring Agent' };
const HUMAN: ActorReference = { actorId: 'lead', actorType: 'HUMAN', displayName: 'Eng Lead' };
const SVC: ActorReference = { actorId: 'assurance', actorType: 'SERVICE', displayName: 'Assurance' };
const DIR = testDirectory([
	{ ...AGENT, tenantId: 't', organizationId: 'o' },
	{ ...HUMAN, tenantId: 't', organizationId: 'o' },
	{ ...SVC, tenantId: 't', organizationId: 'o' }
]);
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5X00';
const OTHER_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5X01';
const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5X10';
const CHILD = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5X11';
const SECOND = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5X12';
const ORPHAN = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5X13';
const SIGN_OFF = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5X14';
const UNDECIDED = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5X15';
const DESIGN = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5X16';
const REMOVED = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5X17';
const OTHER_ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5X20';
const SCHEMA = 'floor.schema-invariant';
const IDENTITY = 'floor.identity-provenance';
const REVIEW = 'floor.reasoning-review';

/** The render's own words for a DRAFT (`renderPromptTemplate`). */
const DRAFT_WORDS =
	'The template is DRAFT and only an ACTIVE template is a runnable asset. A DRAFT is authored text, not an instruction anyone approved.';
/** The step's own words for a type with no template (`prepareModelInvocation`). */
const noTemplateWords = (typeId: string) =>
	`The work-unit type ${typeId} carries no prompt template, so it declares no agent behaviour. Author one on the type before executing this step as a model invocation.`;
/** The render's own words for a declared marker nothing supplies (`renderPromptTemplate`). */
const unsuppliedWords = (marker: string) =>
	`The assembled context supplies no value for {${marker}}. DEC-4 (DOC-003:224-225) governs context assembly and forbids a silent omission; rendering the hole and disclosing it afterwards would disclose AFTER the prompt reached the model, which is the wrong order.`;

/** ⭐ THE REFUSAL, in the builder's words (D66: the build writes them; `l11-facts.md` §9): one passage per check that fails, in order. */
const submitRefusal = (pwaId: string, checks: readonly string[]) =>
	`SubmitPwaForReview blocked: PWA ${pwaId} fails each check named here, for which ValidatePwa or PublishPwa would refuse it later, when it could no longer change (REG-F-502). ${checks.join(' ')} Nothing was submitted: the PWA stays DRAFT, where its types can be edited.`;
/** The structure's passage, its detail ValidatePwa's: the invariants that fail. */
const structureCheck = (detail: string) =>
	`The structure, ValidatePwa's check: the PWU-Type composition is not a valid recursive decomposition (${detail}). Fix the child rules so the graph has exactly one root, no composition cycle, and every type reachable from that root (§11.6).`;
/** The prompts' passage, its items PublishPwa's: `[n] "name" (id): reason`. */
const promptsCheck = (items: readonly string[]) =>
	`The prompts, PublishPwa's check: each type named here declares workDischarge MODEL, but the step of its unit could not render its prompt (REG-F-508). ${items.join(' ')} Give each an ACTIVE prompt that uses only the markers a work unit supplies.`;
/** The floor's passage, its detail PublishPwa's: each policy's disposition, part by part, at the PWA's version. */
const floorCheck = (version: number, detail: string) =>
	`The floor, PublishPwa's check: the de minimis assurance floor is not SATISFIED at v${version} (${detail}). An agent turn in the PWA Designer records one while the PWA is DRAFT, once its candidate is accepted; run it after any edit of a type, since an edit raises the PWA's version and leaves a floor recorded before it at another version.`;

const prompt = (templateText: string, status: PromptTemplate['status'] = 'ACTIVE'): PromptTemplate => ({
	templateText,
	templateVersion: 1,
	declaredPlaceholders: markersIn(templateText),
	status
});

interface TypeSpec {
	readonly id: string;
	readonly name: string;
	readonly purpose?: string;
	/** Where the type sits, when the test states it; else the first type is the root, permitting every other. */
	readonly isRoot?: boolean;
	readonly children?: readonly string[];
	readonly workDischarge?: 'MODEL' | 'HUMAN' | 'UNDECLARED';
	readonly promptTemplate?: PromptTemplate;
}

let store: SqliteStorageAdapter;
let engine: Engine;
let seq = 0;
let assessments = 0;
const as = (a: ActorReference) => engine.as(DIR.credentialFor(a.actorId));

beforeEach(() => {
	store = new SqliteStorageAdapter({ now: () => TS });
	seq = 0;
	assessments = 0;
	engine = new Engine({ authenticate: DIR.authenticate, store, now: () => TS, newEventId: () => `e${++seq}` });
	seedFloorPolicies(as(HUMAN));
});

function d(actor: ActorReference, commandType: string, payload: unknown, id: string, type: string) {
	const n = ++seq;
	const command: DomainCommand = {
		commandId: `c-${n}`,
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType: type,
		targetAggregateId: id,
		issuedAt: TS,
		correlationId: 'submit-gate',
		idempotencyKey: `k-${n}`,
		payload
	};
	return as(actor).dispatch(command);
}

function accepted(r: ReturnType<typeof d>, what: string): void {
	expect(r.status, `arrangement: ${what} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
}

/** A PWA `actor` creates, its types as given, defined while it is DRAFT. */
function draftPwa(actor: ActorReference, pwaId: string, types: readonly TypeSpec[]): void {
	accepted(
		d(actor, 'CreatePwa', { pwaId, name: 'Submit Gate PWA', description: 'd', domain: 'software', version: '1.0.0' }, pwaId, 'PROFESSIONAL_WORK_ARCHITECTURE'),
		'CreatePwa'
	);
	for (const [i, t] of types.entries())
		accepted(
			d(
				actor,
				'DefinePwuType',
				{
					pwuTypeId: t.id,
					pwaId,
					pwuKind: 'WORK',
					name: t.name,
					purpose: t.purpose ?? `Do the work of ${t.name}.`,
					isRoot: t.isRoot ?? i === 0,
					permittedChildTypeIds: t.children ?? (i === 0 ? types.slice(1).map((x) => x.id) : []),
					...(t.workDischarge === undefined ? {} : { workDischarge: t.workDischarge }),
					...(t.promptTemplate === undefined ? {} : { promptTemplate: t.promptTemplate })
				},
				t.id,
				'PWU_TYPE'
			),
			`DefinePwuType ${t.name}`
		);
}

const statusOf = (pwaId = PWA) =>
	(store.loadObject(pwaId)?.state as { publicationStatus: string }).publicationStatus;
/** An object's CURRENT semantic version, read from the store — a type's definition and edit raise the PWA's. */
const versionOf = (id: string) => Number((store.loadObject(id)?.state as { semanticVersion?: number }).semanticVersion ?? 1);
const events = () => store.readAllEvents().length;

/** Submit asked of the PWA as it stands: its answer, and what it left behind — the PWA's status and the events it appended. */
function submitted(actor: ActorReference, pwaId = PWA) {
	const before = events();
	const r = d(actor, 'SubmitPwaForReview', {}, pwaId, 'PROFESSIONAL_WORK_ARCHITECTURE');
	return { r, left: [statusOf(pwaId), events() - before] as const };
}

/** Submit, Validate and Publish, each answered: the PWA published. */
function publishedThrough(actor: ActorReference, rootId: string, pwaId = PWA): void {
	accepted(d(actor, 'SubmitPwaForReview', {}, pwaId, 'PROFESSIONAL_WORK_ARCHITECTURE'), 'SubmitPwaForReview');
	accepted(d(actor, 'ValidatePwa', {}, pwaId, 'PROFESSIONAL_WORK_ARCHITECTURE'), 'ValidatePwa');
	accepted(d(actor, 'PublishPwa', { rootPwuTypeId: rootId }, pwaId, 'PROFESSIONAL_WORK_ARCHITECTURE'), 'PublishPwa');
	expect(statusOf(pwaId)).toBe('PUBLISHED');
}

/** One floor assessment, recorded by the assurance service in the fixtures' one round. */
function assessed(policyId: string, subjectId: string, disposition: 'SATISFIED' | 'REJECTED' = 'SATISFIED'): void {
	recordFloorAssessment(as(SVC), {
		assessmentId: `asmt_${String(++assessments).padStart(26, '0')}`,
		policyId,
		subjectId,
		subjectSemanticVersion: versionOf(subjectId),
		disposition,
		now: TS
	});
}

/** ⭑ The floor an agent turn records: the PWA's two deterministic policies at its version, and each live type's review at the type's, SATISFIED. */
function floorRecordedNow(pwaId: string, typeIds: readonly string[]): void {
	assessed(SCHEMA, pwaId);
	assessed(IDENTITY, pwaId);
	for (const typeId of typeIds) assessed(REVIEW, typeId);
}

describe('⭐⭐ L11 (D66; REG-D-155 (1)) — SubmitPwaForReview refuses a PWA whose structure, prompts or floor a later check would refuse, the PWA left DRAFT', () => {
	describe('the structure, decided as ValidatePwa decides it', () => {
		it('⭐ two roots — refused, the failed invariant named; nothing submitted, the PWA left DRAFT', () => {
			draftPwa(HUMAN, PWA, [
				{ id: ROOT, name: 'A', isRoot: true, children: [] },
				{ id: SECOND, name: 'B', isRoot: true }
			]);
			const { r, left } = submitted(HUMAN);
			expect(r.status, 'the PWA was submitted').toBe('REJECTED');
			expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
			expect(r.error?.message).toBe(submitRefusal(PWA, [structureCheck('single-root: 2 roots (A, B)')]));
			expect(left, 'the PWA did not stay as it was').toEqual(['DRAFT', 0]);
		});

		it('⭐ a composition cycle — refused, the failed invariant named', () => {
			draftPwa(HUMAN, PWA, [
				{ id: ROOT, name: 'A', isRoot: true, children: [CHILD] },
				{ id: CHILD, name: 'B', children: [ROOT] }
			]);
			const { r, left } = submitted(HUMAN);
			expect(r.status, 'the PWA was submitted').toBe('REJECTED');
			expect(r.error?.message).toBe(submitRefusal(PWA, [structureCheck('acyclic-permits: 2 node(s) in a composition cycle')]));
			expect(left, 'the PWA did not stay as it was').toEqual(['DRAFT', 0]);
		});

		it('⭐ a type the root does not reach — refused, the failed invariant named', () => {
			draftPwa(HUMAN, PWA, [
				{ id: ROOT, name: 'A', isRoot: true, children: [CHILD] },
				{ id: CHILD, name: 'B' },
				{ id: ORPHAN, name: 'Orphan' }
			]);
			const { r, left } = submitted(HUMAN);
			expect(r.status, 'the PWA was submitted').toBe('REJECTED');
			expect(r.error?.message).toBe(submitRefusal(PWA, [structureCheck('connected: 1 orphan(s): Orphan')]));
			expect(left, 'the PWA did not stay as it was').toEqual(['DRAFT', 0]);
		});
	});

	describe('the prompts, decided as PublishPwa decides them (package L10, D65)', () => {
		it('⭐ a type declaring MODEL whose prompt is DRAFT — refused, the type named with the render’s words', () => {
			draftPwa(HUMAN, PWA, [
				{
					id: ROOT,
					name: 'wordfreq Verification Report',
					workDischarge: 'MODEL',
					promptTemplate: prompt('Write the verification report of {subject}: {purpose}', 'DRAFT')
				}
			]);
			const { r, left } = submitted(HUMAN);
			expect(r.status, 'the PWA was submitted').toBe('REJECTED');
			expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
			expect(r.error?.message).toBe(
				submitRefusal(PWA, [promptsCheck([`[1] "wordfreq Verification Report" (${ROOT}): ${DRAFT_WORDS}`])])
			);
			expect(left, 'the PWA did not stay as it was').toEqual(['DRAFT', 0]);
		});

		it('⭐ a type declaring MODEL with no prompt template — refused with the step’s no-template words', () => {
			draftPwa(HUMAN, PWA, [{ id: ROOT, name: 'wordfreq Design', workDischarge: 'MODEL' }]);
			const { r, left } = submitted(HUMAN);
			expect(r.status, 'the PWA was submitted').toBe('REJECTED');
			expect(r.error?.message).toBe(submitRefusal(PWA, [promptsCheck([`[1] "wordfreq Design" (${ROOT}): ${noTemplateWords(ROOT)}`])]));
			expect(left, 'the PWA did not stay as it was').toEqual(['DRAFT', 0]);
		});

		it('⭐ a type declaring MODEL whose prompt uses {criteria}, which no work unit supplies — refused with the render’s words', () => {
			draftPwa(HUMAN, PWA, [
				{ id: ROOT, name: 'wordfreq Review', workDischarge: 'MODEL', promptTemplate: prompt('Assess {subject} against {criteria}, and report findings.') }
			]);
			const { r, left } = submitted(HUMAN);
			expect(r.status, 'the PWA was submitted').toBe('REJECTED');
			expect(r.error?.message).toBe(
				submitRefusal(PWA, [promptsCheck([`[1] "wordfreq Review" (${ROOT}): ${unsuppliedWords('criteria')}`])])
			);
			expect(left, 'the PWA did not stay as it was').toEqual(['DRAFT', 0]);
		});
	});

	describe('the floor, decided as PublishPwa decides it', () => {
		it('⭐ a PWA an agent produced, no floor recorded — refused, each policy’s disposition named, part by part', () => {
			draftPwa(AGENT, PWA, [
				{ id: ROOT, name: 'wordfreq Realization', workDischarge: 'MODEL', promptTemplate: prompt('Realize {subject}.') },
				{ id: SIGN_OFF, name: 'wordfreq Sign-off', workDischarge: 'HUMAN' }
			]);
			const { r, left } = submitted(AGENT);
			expect(r.status, 'the PWA was submitted').toBe('REJECTED');
			expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
			expect(r.error?.message).toBe(
				submitRefusal(PWA, [
					floorCheck(
						versionOf(PWA),
						`${SCHEMA}=MISSING, ${IDENTITY}=MISSING, ${REVIEW} of ${ROOT}=MISSING, ${REVIEW} of ${SIGN_OFF}=MISSING`
					)
				])
			);
			expect(left, 'the PWA did not stay as it was').toEqual(['DRAFT', 0]);
		});

		it('⭐ a PWA an agent produced, whose floor a type’s edit has left at another version — refused, naming what the edit left MISSING', () => {
			draftPwa(AGENT, PWA, [{ id: ROOT, name: 'wordfreq Realization', workDischarge: 'MODEL', promptTemplate: prompt('Realize {subject}.') }]);
			floorRecordedNow(PWA, [ROOT]);
			const reviewed = versionOf(PWA);
			accepted(
				d(AGENT, 'EditPwuType', { pwuTypeId: ROOT, purpose: 'Realize wordfreq, as edited after its review.' }, ROOT, 'PWU_TYPE'),
				'EditPwuType'
			);
			expect(versionOf(PWA), 'arrangement: the edit did not raise the PWA’s version').toBe(reviewed + 1);
			const { r, left } = submitted(AGENT);
			expect(r.status, 'the PWA was submitted').toBe('REJECTED');
			// The type's own review stands: an edit raises the PWA's version, not the type's (`EditPwuType`).
			expect(r.error?.message).toBe(submitRefusal(PWA, [floorCheck(reviewed + 1, `${SCHEMA}=MISSING, ${IDENTITY}=MISSING`)]));
			expect(left, 'the PWA did not stay as it was').toEqual(['DRAFT', 0]);
		});

		it('⭑ CONTROL — a PWA an agent produced, its floor recorded at its current version: submitted, validated and published', () => {
			draftPwa(AGENT, PWA, [
				{ id: ROOT, name: 'wordfreq Realization', workDischarge: 'MODEL', promptTemplate: prompt('Realize {subject}.') },
				{ id: SIGN_OFF, name: 'wordfreq Sign-off', workDischarge: 'HUMAN' }
			]);
			floorRecordedNow(PWA, [ROOT, SIGN_OFF]);
			publishedThrough(AGENT, ROOT);
		});
	});

	describe('every check that fails, named in one refusal, in the order a person repairs them', () => {
		it('⭐ the structure, the prompts and the floor all fail: one refusal names the three, the structure first and the floor last', () => {
			draftPwa(AGENT, PWA, [
				{ id: ROOT, name: 'A', isRoot: true, children: [], workDischarge: 'MODEL', promptTemplate: prompt('Report on {subject}.', 'DRAFT') },
				{ id: SECOND, name: 'B', isRoot: true, workDischarge: 'MODEL' }
			]);
			const { r, left } = submitted(AGENT);
			expect(r.status, 'the PWA was submitted').toBe('REJECTED');
			expect(r.error?.message).toBe(
				submitRefusal(PWA, [
					structureCheck('single-root: 2 roots (A, B)'),
					promptsCheck([`[1] "A" (${ROOT}): ${DRAFT_WORDS}`, `[2] "B" (${SECOND}): ${noTemplateWords(SECOND)}`]),
					floorCheck(
						versionOf(PWA),
						`${SCHEMA}=MISSING, ${IDENTITY}=MISSING, ${REVIEW} of ${ROOT}=MISSING, ${REVIEW} of ${SECOND}=MISSING`
					)
				])
			);
			expect(left, 'the PWA did not stay as it was').toEqual(['DRAFT', 0]);
		});

		it('⭐ the prompts and the floor fail: one refusal names both, the prompts before the floor', () => {
			draftPwa(AGENT, PWA, [
				{ id: ROOT, name: 'wordfreq Verification Report', workDischarge: 'MODEL', promptTemplate: prompt('Report on {subject}.', 'DRAFT') }
			]);
			const { r, left } = submitted(AGENT);
			expect(r.status, 'the PWA was submitted').toBe('REJECTED');
			expect(r.error?.message).toBe(
				submitRefusal(PWA, [
					promptsCheck([`[1] "wordfreq Verification Report" (${ROOT}): ${DRAFT_WORDS}`]),
					floorCheck(versionOf(PWA), `${SCHEMA}=MISSING, ${IDENTITY}=MISSING, ${REVIEW} of ${ROOT}=MISSING`)
				])
			);
			expect(left, 'the PWA did not stay as it was').toEqual(['DRAFT', 0]);
		});
	});

	it('⭐ THE FIFTH RUN’S CASE, CARRIED TO ITS REPAIR: refused for its DRAFT prompt, the PWA left DRAFT; the named type’s edit is accepted; Submit, asked again, refuses for the floor that edit left at another version; the floor recorded again, the PWA is submitted, validated and published', () => {
		const text = 'Write the verification report of {subject}: {purpose}';
		draftPwa(AGENT, PWA, [{ id: ROOT, name: 'wordfreq Verification Report', workDischarge: 'MODEL', promptTemplate: prompt(text, 'DRAFT') }]);
		// The agent turn's floor, current: the fifth run's second round passed this type with its prompt DRAFT (`REG-F-627`).
		floorRecordedNow(PWA, [ROOT]);
		const first = submitted(AGENT);
		expect(first.r.status, 'the PWA was submitted with its prompt DRAFT').toBe('REJECTED');
		expect(first.r.error?.message).toBe(
			submitRefusal(PWA, [promptsCheck([`[1] "wordfreq Verification Report" (${ROOT}): ${DRAFT_WORDS}`])])
		);
		expect(first.left, 'the PWA did not stay as it was').toEqual(['DRAFT', 0]);
		// ⭑ THE REPAIR THE REFUSAL NAMES, which the PWA's being DRAFT allows: the prompt armed — a type's edit, raising the PWA's version.
		const reviewed = versionOf(PWA);
		accepted(d(AGENT, 'EditPwuType', { pwuTypeId: ROOT, promptTemplate: prompt(text) }, ROOT, 'PWU_TYPE'), 'EditPwuType (the prompt armed)');
		expect(versionOf(PWA), 'arrangement: the edit did not raise the PWA’s version').toBe(reviewed + 1);
		const second = submitted(AGENT);
		expect(second.r.status, 'the PWA was submitted with its floor at another version').toBe('REJECTED');
		expect(second.r.error?.message).toBe(submitRefusal(PWA, [floorCheck(reviewed + 1, `${SCHEMA}=MISSING, ${IDENTITY}=MISSING`)]));
		expect(second.left, 'the PWA did not stay as it was').toEqual(['DRAFT', 0]);
		// The floor recorded again, as an agent turn on the DRAFT records it: every later check now passes too.
		floorRecordedNow(PWA, [ROOT]);
		publishedThrough(AGENT, ROOT);
	});

	it('⭑ CONTROL — the guard is asked after the precondition: a Submit re-issued on a PWA under review, whose floor a later review has left REJECTED, is refused on its state', () => {
		draftPwa(AGENT, PWA, [{ id: ROOT, name: 'wordfreq Realization', workDischarge: 'MODEL', promptTemplate: prompt('Realize {subject}.') }]);
		floorRecordedNow(PWA, [ROOT]);
		accepted(d(AGENT, 'SubmitPwaForReview', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE'), 'SubmitPwaForReview');
		// A later review of the type, REJECTED: the floor the guard reads now blocks, so only the order tells the two refusals apart.
		assessed(REVIEW, ROOT, 'REJECTED');
		const { r, left } = submitted(AGENT);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code, 'the guard was asked before the precondition').toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(r.error?.message, 'the guard was asked before the precondition').not.toContain('SubmitPwaForReview blocked');
		expect(left, 'the re-issued Submit moved the PWA').toEqual(['UNDER_REVIEW', 0]);
	});

	it('⭑ CONTROL — a PWA no agent produced, no floor recorded, its structure valid and its prompts runnable, is submitted, validated and published: a HUMAN type with no prompt, an UNDECLARED one, a MODEL one with an empty purpose and no {purpose}, a removed MODEL type with none, and another PWA’s DRAFT one beside it', () => {
		// Another PWA's type the guard must not read, and a type removed from this one before Submit.
		draftPwa(HUMAN, OTHER_PWA, [{ id: OTHER_ROOT, name: 'Elsewhere', workDischarge: 'MODEL', promptTemplate: prompt('Do {subject}.', 'DRAFT') }]);
		draftPwa(HUMAN, PWA, [
			{
				id: ROOT,
				name: 'wordfreq Realization',
				workDischarge: 'MODEL',
				promptTemplate: prompt('Realize {subject} ({title}): {description}. Deliver {purpose}.')
			},
			{ id: SIGN_OFF, name: 'wordfreq Sign-off', workDischarge: 'HUMAN' },
			{ id: UNDECIDED, name: 'wordfreq Packaging', workDischarge: 'UNDECLARED' },
			{ id: DESIGN, name: 'wordfreq Design', purpose: '', workDischarge: 'MODEL', promptTemplate: prompt('Design {subject}: {description}.') }
		]);
		accepted(
			d(HUMAN, 'DefinePwuType', { pwuTypeId: REMOVED, pwaId: PWA, pwuKind: 'WORK', name: 'Dropped', purpose: 'p', isRoot: false, workDischarge: 'MODEL' }, REMOVED, 'PWU_TYPE'),
			'DefinePwuType Dropped'
		);
		accepted(d(HUMAN, 'RemovePwuType', { pwuTypeId: REMOVED }, REMOVED, 'PWU_TYPE'), 'RemovePwuType Dropped');
		publishedThrough(HUMAN, ROOT);
	});
});
