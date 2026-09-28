// ⭐ `JAN-SELRES` RS-2 (D7; `REG-F-460`) — THE AUTHORING ROUTE HOLDS A REFUSED SUBSTITUTE AS AN EXTERNAL BLOCK, NEVER AS
// WORK FOR THE PRODUCER.
//
// ⛔ WHAT IS AT STAKE. `applyFloorDisposition` (`routes/pwa/[id]/agent/+server.ts`) decides whether an unsatisfied floor
// is the reviewer's problem (`BLOCKED_EXTERNAL`) or the candidate's (`REVISION_REQUIRED`). It enumerated the operational
// actions with three `===` comparisons, so an action added to `FloorRemediationAction` and missed there would mark a
// refused review REVISION_REQUIRED — a defect in the candidate, for a review nobody the sponsor selected gave. Its test
// is now `isOperationalRemediation`, an exhaustive switch (`floor.ts`); this file holds the ROUTE to it.
//
// ⭑ THE PRODUCTION COMPOSITION, END TO END. The route is POSTed in-process in test mode: the deterministic mock agent
// authors, and the floor runs the product's own devin branch (`JPWB_ASSURANCE_TOOL=devin` with a model — test mode
// admits a NAMED tool, `reviewer-selection.ts`). Only devin's PROGRAM is replaced: `devinPrint` is the real adapter
// handed an exec seam that writes the ATIF export devin writes, naming the model it reports having run.
//
// ⛔ HERMETIC. The exec seam starts nothing and PATH finds no program, so no case can reach a real devin; the agent is
// the mock (test mode, `JPWB_AGENT` unset).
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What devin's exec seam was handed, and the model the next call reports. Hoisted: the mock factory runs first. */
const seam = vi.hoisted(() => ({
	calls: [] as { readonly file: string; readonly args: readonly string[] }[],
	reported: '',
	answer: ''
}));

// ⭑ THE REAL ADAPTER, ITS PROGRAM REPLACED AT THE SEAM — so the reported model is read back from the export exactly as
// `readReportedModel` reads a real one, and `execFile` is never reached.
vi.mock('./tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./tools/devin-reviewer.js')>();
	const { writeFile } = await import('node:fs/promises');
	return {
		...actual,
		devinPrint: vi.fn((prompt: string) =>
			actual.devinPrint(prompt, async (file, args) => {
				seam.calls.push({ file, args: [...args] });
				const exportPath = args[args.indexOf('--export') + 1];
				if (exportPath !== undefined)
					await writeFile(
						exportPath,
						JSON.stringify({ steps: [{ extra: { generation_model: seam.reported } }] }),
						'utf8'
					);
				return { stdout: seam.answer };
			})
		)
	};
});

import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../routes/pwa/[id]/agent/+server.js';
import { clearingJudgement } from './assurance/clearing-reviewer.testing.js';
import { noProgramsDirectory } from './assurance/no-programs.testing.js';
import { clearAuthoringTurns, getPendingAuthoringTurn } from './authoring-turn.js';
import { dispatch, mintUiId, resetEngine } from './workbench.js';

type RouteEvent = Parameters<typeof POST>[0];
interface StreamedEvent {
	readonly kind: string;
	readonly text?: string;
	readonly message?: string;
}

const CONFIGURED = 'fixture-devin-model';
/** D7's guidance, verbatim (`DESIGN-the-selection-residuals.md` D7). */
const REQUALIFY_OR_RESELECT_GUIDANCE =
	'PublishPwa remains blocked because the reviewing tool reported that a model other than the configured and selected one answered, so the review was refused. Retrying or reconfiguring the same selection does not fix this: another call is billed and may be served the same way. The remedy is a sponsor decision: re-qualify the model the tool actually serves and select it, or re-select the reviewer (REG-D-084, REG-D-086); then configure the host to the new selection. Do not revise the PWA or record a waiver in response to this refusal.';

/** A DRAFT PWA to author — the only kind the route opens a turn on. */
function draftPwa(): string {
	const pwaId = mintUiId('pwa');
	const r = dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
		pwaId,
		name: 'Substituted reviewer fixture',
		description: 'A DRAFT PWA whose review is answered by a model nobody selected.',
		domain: 'software',
		version: '0.1.0'
	});
	expect(r.status, `arrangement: CreatePwa — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	return pwaId;
}

/** POST the route in-process and read its whole Server-Sent Event stream. */
async function postInstruction(pwaId: string): Promise<StreamedEvent[]> {
	const response = await POST({
		params: { id: pwaId },
		request: new Request(`http://localhost/pwa/${pwaId}/agent`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ instruction: 'Author a minimal product realization graph.' })
		})
	} as unknown as RouteEvent);
	const body = await response.text();
	return body
		.split('\n\n')
		.filter((chunk) => chunk.startsWith('data: '))
		.map((chunk) => JSON.parse(chunk.slice('data: '.length)) as StreamedEvent);
}

beforeEach(() => {
	clearAuthoringTurns();
	resetEngine('reference');
	seam.calls.length = 0;
	seam.reported = '';
	seam.answer = '';
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of ['JPWB_ASSURANCE_TOOL', 'JPWB_ASSURANCE_MODEL', 'JPWB_JUDGE_MODEL', 'JPWB_AGENT'])
		vi.stubEnv(v, undefined);
	// ⭑ THE SELECTED REVIEWER, NAMED — test mode admits it, so the floor runs devin's branch, not the stand-in.
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', CONFIGURED);
});
afterEach(() => {
	clearAuthoringTurns();
	vi.unstubAllEnvs();
});

describe('⭐ D7 — a review refused for a substituted model blocks the turn EXTERNALLY, with D7’s guidance', () => {
	it('⛔ devin reports another model: the staged candidate is BLOCKED_EXTERNAL, never REVISION_REQUIRED, and the operator is told to re-qualify or re-select', async () => {
		seam.reported = 'substituted-model';
		seam.answer = clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA);
		const pwaId = draftPwa();

		const events = await postInstruction(pwaId);

		expect(events.at(-1)?.kind).toBe('done');
		expect(seam.calls.length, 'arrangement: the devin branch reviewed the candidate').toBe(1);
		expect(seam.calls[0]!.args.slice(0, 3)).toEqual(['--print', '--model', CONFIGURED]);
		const turn = getPendingAuthoringTurn(pwaId);
		expect(turn, 'the refused turn left no staged candidate').toBeDefined();
		expect(turn!.status, 'a refused substitute was recorded as a defect in the candidate').toBe(
			'BLOCKED_EXTERNAL'
		);
		expect(turn!.detail).toBe(REQUALIFY_OR_RESELECT_GUIDANCE);
		expect(
			events.filter((e) => e.kind === 'status').map((e) => e.text),
			'the operator was not shown D7’s guidance'
		).toContain(`⚠ ${REQUALIFY_OR_RESELECT_GUIDANCE}`);
	});

	it('⭑ CONTROL — the SAME route, devin reporting the configured model and faulting a criterion, marks REVISION_REQUIRED', async () => {
		// Without this, "BLOCKED_EXTERNAL" above could hold because the route marks every unsatisfied floor external: here
		// a genuine subject finding must reach the other arm through the same POST, the same reviewer and the same observer.
		seam.reported = CONFIGURED;
		seam.answer = JSON.stringify({
			findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c, i) => ({
				criterionId: c.id,
				failed: i === 0,
				statement: i === 0 ? 'The graph substitutes an easier problem.' : 'evaluated; absent'
			})),
			recommendation: 'REJECTED',
			residualUncertainty: []
		});
		const pwaId = draftPwa();

		const events = await postInstruction(pwaId);

		expect(events.at(-1)?.kind).toBe('done');
		expect(seam.calls.length, 'arrangement: the devin branch reviewed the candidate').toBe(1);
		const turn = getPendingAuthoringTurn(pwaId);
		expect(turn, 'the turn left no staged candidate').toBeDefined();
		expect(turn!.status, 'a valid subject finding did not require revision').toBe(
			'REVISION_REQUIRED'
		);
	});
});
