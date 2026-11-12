// ⭐⭐ `JAN-EXEC` Phase 7, package L10 — design D65 (`REG-D-154` (1); `REG-F-627`) — AN EDIT CHANGES ONLY THE PROMPT FIELDS IT PASSES.
//
// ⛔ WHAT WAS WRONG. `edit_pwu_type` says *"Edit an existing PWU Type in place. Only the fields you pass change."*, but whenever a call
// passed the prompt's text it built a WHOLE template from the fields the call passed (`dischargeInput`, `tools.ts`): DRAFT unless
// `promptActive` was true, and no output contract unless one was passed again; and a status or an output contract passed alone
// changed nothing. In P6 again's fifth paid run the agent's repair of the verification report's ACTIVE prompt passed its new text and
// output contract, and the edit saved it DRAFT; the type was published, and its unit's step was refused at render seven hours later.
//
// ⭑ WHAT MUST HOLD (D65; the lead's decisions, `l10-facts.md` §2 (a)): the template the edit sends is the type's STORED one with each
// prompt field the call passes taking effect, and every other keeping its stored value — the text, the output contract and the armed
// state; an output contract passed empty removes the stored one; an empty text is read as not passed; the version stays the stored
// one; and with no stored template, today's rule (a template only from a passed text, DRAFT unless armed). The tools that CREATE a
// type keep today's rule, byte for byte.
//
// ⭑ A REAL BROKER OVER THE APP'S OWN ENGINE (`makeAuthoringBroker`), the tools built as the agent is given them
// (`buildAuthoringTools`), and the STORED type read back after each call: `REG-F-373` — a mock broker proves what a tool assembles
// and nothing of what the engine keeps.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { beforeEach, describe, expect, it } from 'vitest';
import { dispatch, makeAuthoringBroker, mintUiId, resetEngine } from '../workbench.js';
import { createRationaleSink } from './rationale.js';
import { buildAuthoringTools } from './tools.js';

/** The verification report's prompt as defined, and as the repair rewrote it — each with its output contract. */
const TEXT = 'Write the verification report of {subject}: {purpose}';
const CONTRACT = 'A JSON object whose workProduct holds the verification report in full.';
const REPAIRED = 'Write the verification report of {subject}, citing each command run and its exit code; claim no run you did not make: {purpose}';
const REPAIRED_CONTRACT = 'A JSON object whose workProduct holds the report, each claim cited to a command run and its exit code.';
/** The markers both texts declare, derived from the text (`markersIn`), never taken from the agent. */
const MARKERS = ['subject', 'purpose'];

let broker: ReturnType<typeof makeAuthoringBroker>;
let tools: ReturnType<typeof buildAuthoringTools>;

beforeEach(() => {
	resetEngine('empty');
	const pwaId = mintUiId('pwa');
	const created = dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
		pwaId,
		name: 'Edit Prompt PWA',
		description: 'An edit changes only the prompt fields it passes.',
		domain: 'software product',
		version: '0.1.0'
	});
	expect(created.status, `arrangement: CreatePwa — ${created.error?.message ?? ''}`).toBe('ACCEPTED');
	broker = makeAuthoringBroker(pwaId);
	tools = buildAuthoringTools(broker, createRationaleSink());
});

const run = (name: string, args: Record<string, unknown>) => tools.find((t) => t.name === name)!.run(args);

/** A type a model is to run, defined by the agent's own tool with `prompt`'s fields: its minted id. */
function defined(prompt: Record<string, unknown>): string {
	const r = run('define_pwu_type', {
		name: 'wordfreq Verification Report',
		pwuKind: 'VERIFICATION_REPORT',
		purpose: 'Report what the end-to-end verification found.',
		isRoot: true,
		workDischarge: 'MODEL',
		...prompt
	});
	expect(r.ok, `arrangement: define_pwu_type — ${r.summary}`).toBe(true);
	return (r.data as { id: string }).id;
}

/** The type's prompt template as the engine STORED it. */
const stored = (id: string) => broker.getType(id)?.promptTemplate;

/** An edit by the agent's own tool, which the engine must accept. */
function edited(id: string, args: Record<string, unknown>): void {
	const r = run('edit_pwu_type', { pwuTypeId: id, ...args });
	expect(r.ok, `the edit was refused: ${r.summary}`).toBe(true);
}

describe('⭐⭐ L10 (D65; REG-D-154 (1)) — edit_pwu_type changes only the prompt fields the call passes', () => {
	it('⭐ the fifth run’s repair: a stored ACTIVE prompt’s new text and output contract, promptActive not passed — it stays ACTIVE', () => {
		const id = defined({ promptTemplateText: TEXT, promptOutputContract: CONTRACT, promptActive: true });
		expect(stored(id)?.status, 'arrangement: the prompt was defined ACTIVE').toBe('ACTIVE');
		edited(id, { promptTemplateText: REPAIRED, promptOutputContract: REPAIRED_CONTRACT });
		expect(stored(id)).toStrictEqual({
			templateText: REPAIRED,
			templateVersion: 1,
			declaredPlaceholders: MARKERS,
			outputContract: REPAIRED_CONTRACT,
			status: 'ACTIVE'
		});
	});

	it('⭐ new text alone keeps the stored output contract, and the stored armed state', () => {
		const id = defined({ promptTemplateText: TEXT, promptOutputContract: CONTRACT, promptActive: true });
		edited(id, { promptTemplateText: REPAIRED });
		expect(stored(id)).toStrictEqual({
			templateText: REPAIRED,
			templateVersion: 1,
			declaredPlaceholders: MARKERS,
			outputContract: CONTRACT,
			status: 'ACTIVE'
		});
	});

	it('⭐ an output contract alone changes it on the stored text, the armed state kept', () => {
		const id = defined({ promptTemplateText: TEXT, promptOutputContract: CONTRACT, promptActive: true });
		edited(id, { promptOutputContract: REPAIRED_CONTRACT });
		expect(stored(id)).toStrictEqual({
			templateText: TEXT,
			templateVersion: 1,
			declaredPlaceholders: MARKERS,
			outputContract: REPAIRED_CONTRACT,
			status: 'ACTIVE'
		});
	});

	it('⭐ promptActive: true alone arms the stored DRAFT text, its output contract kept', () => {
		const id = defined({ promptTemplateText: TEXT, promptOutputContract: CONTRACT });
		expect(stored(id)?.status, 'arrangement: the prompt was defined DRAFT').toBe('DRAFT');
		edited(id, { promptActive: true });
		expect(stored(id)).toStrictEqual({
			templateText: TEXT,
			templateVersion: 1,
			declaredPlaceholders: MARKERS,
			outputContract: CONTRACT,
			status: 'ACTIVE'
		});
	});

	it('⭐ an output contract passed empty removes the stored one (a field passed takes effect)', () => {
		const id = defined({ promptTemplateText: TEXT, promptOutputContract: CONTRACT, promptActive: true });
		edited(id, { promptOutputContract: '   ' });
		expect(stored(id)).toStrictEqual({
			templateText: TEXT,
			templateVersion: 1,
			declaredPlaceholders: MARKERS,
			status: 'ACTIVE'
		});
	});

	it('⭐ an EMPTY text is read as not passed (the lead’s decision): it clears nothing, and promptActive beside it arms the stored text', () => {
		const id = defined({ promptTemplateText: TEXT, promptOutputContract: CONTRACT });
		edited(id, { promptTemplateText: '   ', promptActive: true });
		expect(stored(id)).toStrictEqual({
			templateText: TEXT,
			templateVersion: 1,
			declaredPlaceholders: MARKERS,
			outputContract: CONTRACT,
			status: 'ACTIVE'
		});
	});

	it('⭐ the template keeps its stored version (the lead’s decision): new text on a version-3 template stays version 3', () => {
		const id = defined({ promptTemplateText: TEXT, promptOutputContract: CONTRACT, promptActive: true });
		// A version only a person sets: the designer's form keeps the version it was shown (`promptTemplateVersion`).
		const versioned = dispatch('EditPwuType', 'PWU_TYPE', id, {
			pwuTypeId: id,
			promptTemplate: { ...stored(id)!, templateVersion: 3 }
		});
		expect(versioned.status, `arrangement: the version-3 template — ${versioned.error?.message ?? ''}`).toBe('ACCEPTED');
		edited(id, { promptTemplateText: REPAIRED });
		expect(stored(id)).toStrictEqual({
			templateText: REPAIRED,
			templateVersion: 3,
			declaredPlaceholders: MARKERS,
			outputContract: CONTRACT,
			status: 'ACTIVE'
		});
	});

	it('⭑ CONTROL — promptActive: false passed with new text saves it DRAFT, as before', () => {
		const id = defined({ promptTemplateText: TEXT, promptOutputContract: CONTRACT, promptActive: true });
		edited(id, { promptTemplateText: REPAIRED, promptOutputContract: REPAIRED_CONTRACT, promptActive: false });
		expect(stored(id)).toStrictEqual({
			templateText: REPAIRED,
			templateVersion: 1,
			declaredPlaceholders: MARKERS,
			outputContract: REPAIRED_CONTRACT,
			status: 'DRAFT'
		});
	});

	it('⭑ CONTROL — an edit passing no prompt field leaves the stored template as it was', () => {
		const id = defined({ promptTemplateText: TEXT, promptOutputContract: CONTRACT, promptActive: true });
		const before = stored(id);
		edited(id, { name: 'wordfreq Verification Report (renamed)', purpose: 'Report what the verification found, run by run.' });
		expect(broker.getType(id)?.name, 'arrangement: the edit landed').toBe('wordfreq Verification Report (renamed)');
		expect(stored(id)).toStrictEqual(before);
	});

	it('⭑ CONTROL — with no stored template, as before: a status or a contract passed alone changes no prompt field, and a text makes a DRAFT one', () => {
		const id = defined({});
		expect(stored(id), 'arrangement: defined with no prompt').toBeUndefined();
		const alone = run('edit_pwu_type', { pwuTypeId: id, promptActive: true, promptOutputContract: CONTRACT });
		expect(alone.ok, 'an edit that changes nothing was accepted').toBe(false);
		expect(alone.summary).toContain('EditPwuType changes nothing');
		expect(stored(id), 'a template was made from no text').toBeUndefined();
		edited(id, { promptTemplateText: TEXT, promptOutputContract: CONTRACT });
		expect(stored(id)).toStrictEqual({
			templateText: TEXT,
			templateVersion: 1,
			declaredPlaceholders: MARKERS,
			outputContract: CONTRACT,
			status: 'DRAFT'
		});
	});
});

describe('⭑ L10 (D65) CONTROL — the tools that CREATE a type keep today’s rule, byte for byte', () => {
	it('⭑ define_pwu_type: DRAFT unless promptActive is true, version 1, the contract when passed — and no template without a text', () => {
		const draft = defined({ promptTemplateText: TEXT, promptOutputContract: CONTRACT });
		expect(stored(draft)).toStrictEqual({
			templateText: TEXT,
			templateVersion: 1,
			declaredPlaceholders: MARKERS,
			outputContract: CONTRACT,
			status: 'DRAFT'
		});
		const armed = run('define_pwu_type', {
			name: 'Armed',
			pwuKind: 'ARMED',
			workDischarge: 'MODEL',
			promptTemplateText: `  ${TEXT}  `,
			promptActive: true
		});
		expect(armed.ok, armed.summary).toBe(true);
		expect(stored((armed.data as { id: string }).id)).toStrictEqual({
			templateText: TEXT,
			templateVersion: 1,
			declaredPlaceholders: MARKERS,
			status: 'ACTIVE'
		});
		const none = run('define_pwu_type', {
			name: 'No text',
			pwuKind: 'NO_TEXT',
			workDischarge: 'MODEL',
			promptActive: true,
			promptOutputContract: CONTRACT
		});
		expect(none.ok, none.summary).toBe(true);
		expect(stored((none.data as { id: string }).id)).toBeUndefined();
	});

	it('⭑ scaffold_graph: each type’s template by the same rule — DRAFT unless armed, and none without a text', () => {
		const r = run('scaffold_graph', {
			types: [
				{
					tempKey: 'root',
					name: 'Root',
					pwuKind: 'ROOT',
					isRoot: true,
					workDischarge: 'MODEL',
					promptTemplateText: TEXT,
					promptOutputContract: CONTRACT,
					childTempKeys: ['armed', 'none']
				},
				{ tempKey: 'armed', name: 'Armed', pwuKind: 'ARMED', workDischarge: 'MODEL', promptTemplateText: TEXT, promptActive: true },
				{ tempKey: 'none', name: 'None', pwuKind: 'NONE', workDischarge: 'MODEL', promptActive: true, promptOutputContract: CONTRACT }
			]
		});
		expect(r.ok, r.summary).toBe(true);
		const ids = (r.data as { ids: Record<string, string> }).ids;
		expect(stored(ids.root!)).toStrictEqual({
			templateText: TEXT,
			templateVersion: 1,
			declaredPlaceholders: MARKERS,
			outputContract: CONTRACT,
			status: 'DRAFT'
		});
		expect(stored(ids.armed!)).toStrictEqual({
			templateText: TEXT,
			templateVersion: 1,
			declaredPlaceholders: MARKERS,
			status: 'ACTIVE'
		});
		expect(stored(ids.none!)).toBeUndefined();
	});

	it('⭑ define_from_template: a blueprint carries no prompt, so its type has none', () => {
		const r = run('define_from_template', { templateKey: 'architecture', isRoot: true });
		expect(r.ok, r.summary).toBe(true);
		expect(stored((r.data as { id: string }).id)).toBeUndefined();
	});
});
