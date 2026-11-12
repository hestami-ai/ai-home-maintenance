// ⭐⭐ `JAN-EXEC` Phase 7, package L10 — design D65 (`REG-D-154` (2); `REG-F-508`, remedy 1; `REG-F-627`) — PUBLISH REFUSES A PWA WITH A
// TYPE DECLARING MODEL WHOSE PROMPT THE STEP OF ITS UNIT WOULD REFUSE TO RENDER, naming each such type and why, before any event.
//
// ⛔ WHAT WAS WRONG (`REG-F-508`). Nothing before a unit's step read a prompt: the per-edit rule refuses only an ACTIVE template on a type
// that does not declare MODEL (its converse was dropped as a rule against drafting, `REG-F-353`), ValidatePwa reads the graph, and
// PublishPwa read the floor alone. So a PWA published with a MODEL type whose prompt was DRAFT, absent, or used a marker no work unit
// supplies, and its unit's step was refused at render after it had started, when the PWA could no longer change. In P6 again's fifth
// paid run that happened to the verification report, seven hours in (`REG-F-627`).
//
// ⭑ WHAT MUST HOLD (D65; the lead's decision (b)). PublishPwa refuses such a PWA, decided by the code the step runs
// (`renderPromptTemplate` over the context a unit of the type is given, `unitPromptRefusal`): each refused type named — its name and
// id — with its reason, the render's own words or the step's no-template words; nothing published, and the PWA left as it was, VALIDATED
// (the publication machine has no arrow back to DRAFT). A type that does not declare MODEL is not asked. ⭑ The builder's order: the
// prompts first, then the floor (`pwaPromptGate`, `pwa-authoring.ts`).
//
// ⭑ THE REFUSAL'S WORDS ARE RESTATED HERE, NOT IMPORTED: they are read by a person and by the lane (`designerEnd`), so a change to
// them must redden here rather than be followed.
import type { ActorReference, DomainCommand, PromptTemplate } from '@janumipwb/rph-contracts';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine, markersIn, unitPromptRefusal, unitSubjectOfType } from '../index.js';
import { seedFloorPolicies } from './__tests__/floor-fixtures.js';

const TS = '2026-11-12T00:00:00Z';
const AGENT: ActorReference = { actorId: 'agent-1', actorType: 'AGENT', displayName: 'Authoring Agent' };
const HUMAN: ActorReference = { actorId: 'lead', actorType: 'HUMAN', displayName: 'Eng Lead' };
const DIR = testDirectory([
	{ ...AGENT, tenantId: 't', organizationId: 'o' },
	{ ...HUMAN, tenantId: 't', organizationId: 'o' }
]);
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5W00';
const OTHER_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5W01';
const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5W10';
const REPORT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5W11';
const DESIGN = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5W12';
const REVIEW = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5W13';
const UNDECIDED = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5W14';
const REMOVED = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5W15';
const OTHER_ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5W20';

/** The render's own words for a DRAFT (`renderPromptTemplate`). */
const DRAFT_WORDS =
	'The template is DRAFT and only an ACTIVE template is a runnable asset. A DRAFT is authored text, not an instruction anyone approved.';
/** The step's own words for a type with no template (`prepareModelInvocation`). */
const noTemplateWords = (typeId: string) =>
	`The work-unit type ${typeId} carries no prompt template, so it declares no agent behaviour. Author one on the type before executing this step as a model invocation.`;
/** The render's own words for a declared marker nothing supplies (`renderPromptTemplate`). */
const unsuppliedWords = (marker: string) =>
	`The assembled context supplies no value for {${marker}}. DEC-4 (DOC-003:224-225) governs context assembly and forbids a silent omission; rendering the hole and disclosing it afterwards would disclose AFTER the prompt reached the model, which is the wrong order.`;

/**
 * ⭑ THE FLOOR'S REFUSAL OF THE FLOOR CONTROL'S ARRANGEMENT, read at cd7a057c (before package L10) from the engine's own words
 * (`pwaFloorGate`): v2, its type's definition having raised the PWA's version once.
 */
const FLOOR_REFUSAL_AT_HEAD = `PublishPwa blocked: the de minimis assurance floor is not SATISFIED for PWA ${PWA} at v2 (floor.schema-invariant=MISSING, floor.identity-provenance=MISSING, floor.reasoning-review of ${ROOT}=MISSING). Record a satisfied floor (schema/invariant, identity/provenance, independent reasoning review) for the current version before publishing. The floor is unconditional: no governance waiver discharges it.`;

/** ⭐ THE REFUSAL, in the builder's words (D65: the build writes them; `l10-facts.md` §8): each refused type `[n] "name" (id): reason`. */
const refusal = (pwaId: string, items: readonly string[]) =>
	`PublishPwa blocked: each type of PWA ${pwaId} named here declares workDischarge MODEL, but the step of its unit could not render its prompt, so that unit would be stopped once its step had started, when the PWA could no longer change (REG-F-508). ${items.join(' ')} Nothing was published: the PWA stays VALIDATED, where its types cannot be edited, so its repair is a new PWA in which each type declaring MODEL carries an ACTIVE prompt that uses only the markers a work unit supplies.`;

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
	readonly workDischarge?: 'MODEL' | 'HUMAN' | 'UNDECLARED';
	readonly promptTemplate?: PromptTemplate;
}

let store: SqliteStorageAdapter;
let engine: Engine;
let seq = 0;
const as = (a: ActorReference) => engine.as(DIR.credentialFor(a.actorId));

beforeEach(() => {
	store = new SqliteStorageAdapter({ now: () => TS });
	seq = 0;
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
		correlationId: 'prompt-gate',
		idempotencyKey: `k-${n}`,
		payload
	};
	return as(actor).dispatch(command);
}

function accepted(r: ReturnType<typeof d>, what: string): void {
	expect(r.status, `arrangement: ${what} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
}

/** A PWA `actor` creates, its types as given (the first the root, permitting every other), defined while DRAFT. */
function draftPwa(actor: ActorReference, pwaId: string, types: readonly TypeSpec[]): void {
	accepted(
		d(actor, 'CreatePwa', { pwaId, name: 'Prompt Gate PWA', description: 'd', domain: 'software', version: '1.0.0' }, pwaId, 'PROFESSIONAL_WORK_ARCHITECTURE'),
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
					isRoot: i === 0,
					permittedChildTypeIds: i === 0 ? types.slice(1).map((x) => x.id) : [],
					...(t.workDischarge === undefined ? {} : { workDischarge: t.workDischarge }),
					...(t.promptTemplate === undefined ? {} : { promptTemplate: t.promptTemplate })
				},
				t.id,
				'PWU_TYPE'
			),
			`DefinePwuType ${t.name}`
		);
}

/** Submitted and validated: the state PublishPwa transitions from. */
function validated(actor: ActorReference, pwaId: string): void {
	accepted(d(actor, 'SubmitPwaForReview', {}, pwaId, 'PROFESSIONAL_WORK_ARCHITECTURE'), 'SubmitPwaForReview');
	accepted(d(actor, 'ValidatePwa', {}, pwaId, 'PROFESSIONAL_WORK_ARCHITECTURE'), 'ValidatePwa');
}

const publish = (actor: ActorReference, pwaId: string, rootId: string) =>
	d(actor, 'PublishPwa', { rootPwuTypeId: rootId }, pwaId, 'PROFESSIONAL_WORK_ARCHITECTURE');
const statusOf = (pwaId: string) =>
	(store.loadObject(pwaId)?.state as { publicationStatus: string }).publicationStatus;
const events = () => store.readAllEvents().length;

/** A PWA a person authored, its one root type as given, published: the refusal, and what it left behind. */
function publishedOne(root: TypeSpec) {
	draftPwa(HUMAN, PWA, [root]);
	validated(HUMAN, PWA);
	const before = events();
	const r = publish(HUMAN, PWA, root.id);
	return { r, left: [statusOf(PWA), events() - before] as const };
}

describe('⭐⭐ L10 (D65; REG-D-154 (2)) — PublishPwa refuses a type declaring MODEL whose prompt the step of its unit would refuse', () => {
	it('⭐ its prompt is DRAFT — refused, the type named with the render’s words; nothing published', () => {
		const { r, left } = publishedOne({
			id: ROOT,
			name: 'wordfreq Verification Report',
			workDischarge: 'MODEL',
			promptTemplate: prompt('Write the verification report of {subject}: {purpose}', 'DRAFT')
		});
		expect(r.status, 'the PWA was published').toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toBe(refusal(PWA, [`[1] "wordfreq Verification Report" (${ROOT}): ${DRAFT_WORDS}`]));
		expect(left, 'the PWA did not stay as it was').toEqual(['VALIDATED', 0]);
	});

	it('⭐ it carries no prompt template — refused with the step’s no-template words', () => {
		const { r, left } = publishedOne({ id: ROOT, name: 'wordfreq Design', workDischarge: 'MODEL' });
		expect(r.status, 'the PWA was published').toBe('REJECTED');
		expect(r.error?.message).toBe(refusal(PWA, [`[1] "wordfreq Design" (${ROOT}): ${noTemplateWords(ROOT)}`]));
		expect(left, 'the PWA did not stay as it was').toEqual(['VALIDATED', 0]);
	});

	it('⭐ its prompt uses {criteria}, which no work unit supplies — refused with the render’s words (REG-F-507)', () => {
		const { r, left } = publishedOne({
			id: ROOT,
			name: 'wordfreq Review',
			workDischarge: 'MODEL',
			promptTemplate: prompt('Assess {subject} against {criteria}, and report findings.')
		});
		expect(r.status, 'the PWA was published').toBe('REJECTED');
		expect(r.error?.message).toBe(refusal(PWA, [`[1] "wordfreq Review" (${ROOT}): ${unsuppliedWords('criteria')}`]));
		expect(left, 'the PWA did not stay as it was').toEqual(['VALIDATED', 0]);
	});

	it('⭐ its prompt uses {purpose} while its purpose is empty — refused: a unit is given {purpose} only when it is not', () => {
		const { r, left } = publishedOne({
			id: ROOT,
			name: 'wordfreq Report',
			purpose: '',
			workDischarge: 'MODEL',
			promptTemplate: prompt('Report on {subject}: {purpose}')
		});
		expect(r.status, 'the PWA was published').toBe('REJECTED');
		expect(r.error?.message).toBe(refusal(PWA, [`[1] "wordfreq Report" (${ROOT}): ${unsuppliedWords('purpose')}`]));
		expect(left, 'the PWA did not stay as it was').toEqual(['VALIDATED', 0]);
	});

	it('⭐ EACH refused type is named, in the order the store holds them, beside one that renders', () => {
		draftPwa(HUMAN, PWA, [
			{ id: ROOT, name: 'wordfreq Realization', workDischarge: 'MODEL', promptTemplate: prompt('Realize {subject}.') },
			{ id: REPORT, name: 'wordfreq Verification Report', workDischarge: 'MODEL', promptTemplate: prompt('Report on {subject}.', 'DRAFT') },
			{ id: DESIGN, name: 'wordfreq Design', workDischarge: 'MODEL' }
		]);
		validated(HUMAN, PWA);
		const before = events();
		const r = publish(HUMAN, PWA, ROOT);
		expect(r.status, 'the PWA was published').toBe('REJECTED');
		expect(r.error?.message).toBe(
			refusal(PWA, [
				`[1] "wordfreq Verification Report" (${REPORT}): ${DRAFT_WORDS}`,
				`[2] "wordfreq Design" (${DESIGN}): ${noTemplateWords(DESIGN)}`
			])
		);
		expect([statusOf(PWA), events() - before], 'the PWA did not stay as it was').toEqual(['VALIDATED', 0]);
	});

	it('⭐ THE PROMPTS FIRST, THEN THE FLOOR (the builder’s order): an agent’s PWA with no floor recorded and a DRAFT prompt is refused for its prompt', () => {
		draftPwa(AGENT, PWA, [
			{ id: ROOT, name: 'wordfreq Verification Report', workDischarge: 'MODEL', promptTemplate: prompt('Report on {subject}.', 'DRAFT') }
		]);
		validated(AGENT, PWA);
		const r = publish(AGENT, PWA, ROOT);
		expect(r.status, 'the PWA was published').toBe('REJECTED');
		expect(r.error?.message).toBe(refusal(PWA, [`[1] "wordfreq Verification Report" (${ROOT}): ${DRAFT_WORDS}`]));
	});

	it('⭑ CONTROL — every MODEL type renders: published, a HUMAN type with no prompt, an UNDECLARED one, a removed one and another PWA’s among them', () => {
		// Another PWA's type the gate must not read, and a type removed from this one before Submit.
		draftPwa(HUMAN, OTHER_PWA, [{ id: OTHER_ROOT, name: 'Elsewhere', workDischarge: 'MODEL', promptTemplate: prompt('Do {subject}.', 'DRAFT') }]);
		draftPwa(HUMAN, PWA, [
			{
				id: ROOT,
				name: 'wordfreq Realization',
				workDischarge: 'MODEL',
				promptTemplate: prompt('Realize {subject} ({title}): {description}. Deliver {purpose}.')
			},
			{ id: REVIEW, name: 'wordfreq Sign-off', workDischarge: 'HUMAN' },
			{ id: UNDECIDED, name: 'wordfreq Packaging', workDischarge: 'UNDECLARED' },
			{ id: DESIGN, name: 'wordfreq Design', purpose: '', workDischarge: 'MODEL', promptTemplate: prompt('Design {subject}: {description}.') }
		]);
		accepted(
			d(HUMAN, 'DefinePwuType', { pwuTypeId: REMOVED, pwaId: PWA, pwuKind: 'WORK', name: 'Dropped', purpose: 'p', isRoot: false, workDischarge: 'MODEL' }, REMOVED, 'PWU_TYPE'),
			'DefinePwuType Dropped'
		);
		accepted(d(HUMAN, 'RemovePwuType', { pwuTypeId: REMOVED }, REMOVED, 'PWU_TYPE'), 'RemovePwuType Dropped');
		validated(HUMAN, PWA);
		const r = publish(HUMAN, PWA, ROOT);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(statusOf(PWA)).toBe('PUBLISHED');
	});

	it('⭑ CONTROL — the floor’s refusal as before: an agent’s PWA whose MODEL type renders, no floor recorded, refused in the floor’s words', () => {
		draftPwa(AGENT, PWA, [
			{ id: ROOT, name: 'wordfreq Realization', workDischarge: 'MODEL', promptTemplate: prompt('Realize {subject}.') }
		]);
		validated(AGENT, PWA);
		const r = publish(AGENT, PWA, ROOT);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toBe(FLOOR_REFUSAL_AT_HEAD);
		expect(statusOf(PWA)).toBe('VALIDATED');
	});
});

describe('⭐⭐ L10 (D65) — the subject a unit of a type is given, and the refusal decided on it', () => {
	it('⭐ the type’s name its title, its purpose its description, and {purpose} only when the purpose is not empty', () => {
		expect(unitSubjectOfType(ROOT, 'wordfreq Report', 'Report what ran.')).toStrictEqual({
			id: ROOT,
			title: 'wordfreq Report',
			description: 'Report what ran.',
			purpose: 'Report what ran.'
		});
		expect(unitSubjectOfType(ROOT, 'wordfreq Report', '')).toStrictEqual({ id: ROOT, title: 'wordfreq Report', description: '' });
		// Instantiation's `purpose ?? title`: a type with no purpose at all (none the engine stores) gives its name as the description.
		expect(unitSubjectOfType(ROOT, 'wordfreq Report', undefined)).toStrictEqual({ id: ROOT, title: 'wordfreq Report', description: 'wordfreq Report' });
	});

	it('⭐ unitPromptRefusal: undefined where the prompt renders; the render’s or the no-template words where it would not', () => {
		const every = prompt('{subject} {title} {description} {purpose}');
		expect(unitPromptRefusal(ROOT, 'R', { purpose: 'p', promptTemplate: every })).toBeUndefined();
		expect(unitPromptRefusal(ROOT, 'R', { purpose: '', promptTemplate: every })).toBe(unsuppliedWords('purpose'));
		expect(unitPromptRefusal(ROOT, 'R', { purpose: 'p', promptTemplate: prompt('{statement}') })).toBe(unsuppliedWords('statement'));
		expect(unitPromptRefusal(ROOT, 'R', { purpose: 'p', promptTemplate: { ...every, status: 'DRAFT' } })).toBe(DRAFT_WORDS);
		expect(unitPromptRefusal(ROOT, 'R', { purpose: 'p' })).toBe(noTemplateWords(ROOT));
	});
});
