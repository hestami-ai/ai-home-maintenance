// ⭐⭐ `JAN-EXEC` Phase 7, package N — D9, D10, D11 (`REG-D-135` (1); `REG-F-485`; `REG-F-520` remedy 1; `REG-F-522` remedy
// candidate 2; `REG-F-579`; `DESIGN-data-flow-order-and-deliverable-review.md` D9-D11) — THROUGH THE PAGE'S OWN ACTIONS.
//
// ⭑ WHAT MUST HOLD.
//   · D9 — each try's runs are joined with THAT try's account and observation inside the loop; their reviews run in the try;
//     their subject findings go back to the model with the work product's findings for the next try (the `REG-D-059` loop).
//     The completion names the admitted try's work product and that try's command evidence; earlier tries' assessments stay
//     on the record. ⛔ One process-run observer per step across all its tries: the 32-run bound is the step's.
//   · D10 — the work product's review is shown the files the unit changed since its step began, as the host read them after
//     the try, and the step's writes and runs: a pre-existing CommonJS file read and then rewritten to ESM is judged on the
//     final file, and the read's own review carries the narrowed question.
//   · D11 — the declared-policy reviews at sign-off are shown the unit's changed files and sequence as recorded at its
//     completion; and `rerunReview` re-runs a refused floor through the same builders, shown what the refused try was.
//
// ⭑ THE ARRANGEMENT, IN TEST MODE: the reviewer is devin, NAMED with its model, its PROGRAM replaced at its exec seam (the
// real adapter reads the configured model back from the export it writes); the producer is a scripted session over the
// host's REAL process-run observer, writing into the Undertaking's workspace through the port it is handed; and the
// Undertaking's workspace is one in-memory workspace per Undertaking, held across requests, so a case can leave a file in
// it before the step begins — as an earlier unit would.
// ⛔ HERMETIC: devin's exec seam starts nothing; no process is started (each run is a value); PATH finds no program.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** One act a scripted turn makes: a run the host completed, or a write through the workspace port. */
type TurnAct =
	| { readonly run: { readonly argv: readonly string[]; readonly stdout: string; readonly exitCode?: number } }
	| { readonly write: { readonly path: string; readonly contents: string } };

/** What the seams saw and answer. Hoisted: the mock factories below run before this file's body. */
const seam = vi.hoisted(() => ({
	/** Every prompt the validator handed devin, in order. */
	prompts: [] as string[],
	/** What devin answers a prompt: undefined is a clean review over the prompt's own rubric. */
	review: undefined as undefined | ((prompt: string) => string | undefined),
	/** Every turn the producer was sent, in order — the first the instruction, any later one a repair. */
	turns: [] as string[],
	/** What the producer does on turn N (1-based): its acts, and the account it gives. */
	script: (() => ({ acts: [], account: 'An account.' })) as (turn: number) => {
		readonly acts: readonly TurnAct[];
		readonly account: string;
	},
	/** One in-memory workspace per Undertaking, held across requests. */
	workspaces: new Map<string, unknown>()
}));

vi.mock('./workspace-host.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./workspace-host.js')>();
	const { createInMemoryWorkspace, createRefusingProcessRunner } = await import('@janumipwb/rph-ports');
	return {
		...actual,
		resolveUndertakingSandbox: vi.fn((undertakingId: string) => {
			if (!seam.workspaces.has(undertakingId))
				seam.workspaces.set(undertakingId, {
					workspace: createInMemoryWorkspace({
						ownerKind: 'UNDERTAKING',
						ownerId: undertakingId,
						purgeability: 'RETAINED_BY_PARTICIPATION'
					}),
					outputWorkspace: createInMemoryWorkspace({
						ownerKind: 'UNDERTAKING',
						ownerId: undertakingId,
						purgeability: 'PURGEABLE_AT_EXPIRY'
					}),
					runner: createRefusingProcessRunner()
				});
			return seam.workspaces.get(undertakingId);
		})
	};
});

vi.mock('./model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./model.js')>();
	const { createProcessRunObserver } = await import('../tools/process-run-observer.js');
	return {
		...actual,
		// ⭑ A SCRIPTED PRODUCER OVER THE HOST'S REAL OBSERVER: each turn makes its acts — a run reported as the host
		// completed it, a write through the workspace port the session is handed, observed as `write_file` observes it — and
		// answers the execution contract's envelope, its account the script's.
		getExecutionSession: vi.fn(() => async (context: { readonly workspace: import('@janumipwb/rph-ports').Workspace }) => {
			const observer = createProcessRunObserver();
			return {
				turn: async (text: string) => {
					seam.turns.push(text);
					const { acts, account } = seam.script(seam.turns.length);
					for (const act of acts) {
						if ('write' in act) {
							const out = await context.workspace.writeFile(act.write.path, act.write.contents);
							if (out.written) observer.wrote({ path: out.path });
						} else
							observer.ran({
								argv: act.run.argv,
								exitCode: act.run.exitCode ?? 0,
								timedOut: false,
								durationMs: 7,
								outputComplete: true,
								omittedRegions: [],
								retention: {
									retained: true,
									workspaceOwnerId: 'und_n',
									purgeability: 'PURGEABLE_AT_EXPIRY',
									stdoutPath: 'captures/n/stdout.txt',
									stderrPath: 'captures/n/stderr.txt',
									omittedRegions: [],
									omissionsPath: 'captures/n/omissions.json'
								},
								stdout: act.run.stdout,
								stderr: ''
							} as never);
					}
					return JSON.stringify({
						workProduct: { done: `turn ${seam.turns.length}` },
						rationale: { rationale: account, assumptions: [], limitations: [], residualUncertainty: [] }
					});
				},
				lastTurnObservation: () => ({ canObserve: false, reason: 'a scripted fixture observes no tool calls' }),
				processRuns: () => observer.observed(),
				dispose: () => undefined,
				retainsHistory: true
			};
		})
	};
});

// ⭑ THE REAL devin ADAPTER, ITS PROGRAM REPLACED AT THE SEAM — the CONFIGURED model reported; each prompt answered by the
// case (`seam.review`), else clean over the prompt's own rubric (a declared policy's read off its lines).
vi.mock('../tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../tools/devin-reviewer.js')>();
	const { writeFile } = await import('node:fs/promises');
	return {
		...actual,
		devinPrint: vi.fn((prompt: string) =>
			actual.devinPrint(prompt, async (_file, args) => {
				seam.prompts.push(prompt);
				const exportPath = args[args.indexOf('--export') + 1];
				if (exportPath !== undefined)
					await writeFile(
						exportPath,
						JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-assurance-model' } }] }),
						'utf8'
					);
				const ids = [...prompt.matchAll(/^- ([A-Za-z0-9_-]+): .* \[if unmet: [A-Z]+\]$/gm)].map((m) => m[1]!);
				return {
					stdout:
						seam.review?.(prompt) ??
						JSON.stringify({
							findings: ids.map((id) => ({ criterionId: id, failed: false, statement: 'met' })),
							recommendation: 'SATISFIED',
							residualUncertainty: []
						})
				};
			})
		)
	};
});

import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { getObject, listAssessments, listByType, listPwus } from '@janumipwb/rph-engine';
import type { Workspace } from '@janumipwb/rph-ports';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { actions } from '../../../routes/undertakings/[id]/+page.server.js';
import { actions as undertakings } from '../../../routes/undertakings/+page.server.js';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { dispatch, getEngine, mintUiId, resetEngine } from '../workbench.js';
import { actionEvent, beginExecute, modelWorkUnit } from './begin-execute.testing.js';
import { resolveUndertakingSandbox } from './workspace-host.js';

const LIVE_BACKEND_VARIABLES = [
	'JPWB_ASSURANCE_TOOL',
	'JPWB_ASSURANCE_MODEL',
	'JPWB_JUDGE_MODEL',
	'JPWB_EXECUTOR',
	'JPWB_EXECUTOR_MODEL',
	'JPWB_AGENT',
	'JPWB_DEVIN_BIN',
	'JPWB_AGY_BIN'
] as const;

/**
 * ⭐ D12's scoping sentence, BYTE FOR BYTE (design D12; Q41b) — restated here, never imported: a command's review asks only
 * what the account says of THIS command's result, and a statement about the unit's obligation supports no finding there.
 */
const SCOPE =
	"Judge each criterion below on that question alone. Whether the unit's work discharges the instruction is judged by the review of its finished work, not here: a statement about the unit's obligation, another command or a file supports no finding here either way, and a command the account says nothing about meets each criterion here.";

/** devin's reply over the seeded floor criteria: every row met, save `faulted`, failed with `statement`. */
const floorReply = (faulted?: { readonly statement: string }): string =>
	JSON.stringify({
		findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c, i) =>
			faulted && i === 0
				? { criterionId: c.id, failed: true, statement: faulted.statement, severity: 'BLOCKING' }
				: { criterionId: c.id, failed: false, statement: 'met' }
		),
		recommendation: faulted ? 'REJECTED' : 'SATISFIED',
		residualUncertainty: []
	});

const isWorkProductReview = (p: string): boolean => p.includes('The WORK PRODUCT to review');
const isCommandReview = (p: string): boolean => p.includes('The COMMAND RESULT to review');
/** The command a command review is OF: its view's command line, the line after the fence that follows its heading. */
const commandOf = (p: string): string => {
	const lines = p.split('\n');
	const at = lines.indexOf('the command line, as a JSON array of its arguments:');
	return at < 0 ? '' : (lines[at + 2] ?? '');
};
/** The stdout a command review is OF: the line after the fence that follows the view's `stdout:` heading. */
const stdoutOf = (p: string): string => {
	const lines = p.split('\n');
	const at = lines.indexOf('stdout:');
	return at < 0 ? '' : (lines[at + 2] ?? '');
};

const run = (argv: readonly string[], stdout = 'ok\n', exitCode = 0): TurnAct => ({ run: { argv, stdout, exitCode } });
const write = (path: string, contents: string): TurnAct => ({ write: { path, contents } });

/** The Undertaking's workspace, as the route will resolve it — so a case can leave a file in it before the step. */
function workspaceOf(pwuId: string): Workspace {
	const undertakingId = String(getObject(getEngine(), pwuId)?.undertakingId ?? '');
	return (resolveUndertakingSandbox(undertakingId) as unknown as { workspace: Workspace }).workspace;
}

/** The unit's one execution plan's completions, in log order: what each `ExecutionStepSucceeded` named. */
function completionsOf(pwuId: string): { readonly outputs: string[]; readonly evidence: string[] }[] {
	const plans = new Set(
		listByType(getEngine(), 'EXECUTION_PLAN')
			.filter((p) => p.state.workUnitId === pwuId)
			.map((p) => p.id)
	);
	return getEngine()
		.readAllEvents()
		.filter((e) => e.eventType === 'ExecutionStepSucceeded' && plans.has(e.aggregateId))
		.map((e) => {
			const p = e.payload as { outputArtifactIds?: string[]; proposedEvidenceIds?: string[] };
			return { outputs: p.outputArtifactIds ?? [], evidence: p.proposedEvidenceIds ?? [] };
		});
}

/** The unit's command evidence, in the order recorded, with its command and the latest reasoning-review assessment over it. */
function evidenceOf(pwuId: string) {
	const ids = new Set(
		listByType(getEngine(), 'ARTIFACT')
			.filter((a) => a.state.producingPwuId === pwuId)
			.map((a) => String(a.state.producingExecutionAttemptId))
	);
	return listByType(getEngine(), 'EVIDENCE')
		.filter((e) => ids.has(String((e.state.contentReference as { producingExecutionAttemptId?: string }).producingExecutionAttemptId)))
		.map((e) => {
			const review = listAssessments(getEngine(), { kind: 'WORKSPACE' })
				.filter(
					(a) =>
						((a.state.subjectObjectIds as string[] | undefined) ?? []).includes(e.id) &&
						a.state.assurancePolicyId === 'floor.reasoning-review'
				)
				.at(-1);
			return {
				id: e.id,
				command: (e.state.contentReference as { command?: string[] }).command,
				reasoningReview: String(review?.state.assessmentState ?? '')
			};
		});
}

beforeEach(() => {
	resetEngine('reference');
	seam.prompts.length = 0;
	seam.turns.length = 0;
	seam.review = undefined;
	seam.script = () => ({ acts: [], account: 'An account.' });
	seam.workspaces.clear();
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe('⭐⭐ package N — D9: each try’s runs are joined and reviewed INSIDE the try, and their findings go back to the model', () => {
	it('⭐ a command’s finding in try 1 reaches the model’s try 2 prompt; the completion names try 2’s work product and command evidence; try 1’s refusal stays on the record', async () => {
		// THE RED (design §4, predicted from the code at `11514fc6`): the join followed the loop and the producer's disposal, so a
		// command review's finding could reach no try at all, and one refused command review refused the step (`REG-F-520`).
		seam.script = (turn) => ({
			acts: [run(['node', '--test'], turn === 1 ? '1 failed\n' : '2 passed\n', turn === 1 ? 1 : 0)],
			account: `The suite was run on try ${turn}.`
		});
		seam.review = (p) =>
			isCommandReview(p) && stdoutOf(p) === '1 failed' ? floorReply({ statement: 'THE SUITE FAILED ON TRY ONE.' }) : undefined;
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);

		expect(seam.turns, 'the command’s finding sent the model no second try').toHaveLength(2);
		expect(seam.turns[1], 'the command’s finding never reached the model’s second turn').toContain('THE SUITE FAILED ON TRY ONE.');
		expect(seam.turns[1], 'the finding does not say which command it is about').toContain('On the command ["node","--test"]');
		expect(result.data?.error, 'the clean second try did not complete').toBeUndefined();
		// ⭐ The completion names the ADMITTED try's work product and ITS command evidence, never the first try's.
		const products = listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.producingPwuId === pwuId);
		expect(products, 'each try records its own work product').toHaveLength(2);
		const evidence = evidenceOf(pwuId);
		expect(evidence.map((e) => e.reasoningReview), 'each try’s command reviewed in its try').toEqual(['REJECTED', 'SATISFIED']);
		expect(completionsOf(pwuId)).toEqual([{ outputs: [products[1]!.id], evidence: [evidence[1]!.id] }]);
		// ⭐ And the first try's refusal stays on the record (DOC-001: findings are durable obligations).
		expect(getObject(getEngine(), evidence[0]!.id), 'the first try’s evidence is gone').toBeDefined();
	});

	it('⭐ a run is judged against ITS OWN try’s account, never the last try’s (REG-F-485)', async () => {
		// THE RED: every run was joined against the LAST try's account, so a try-1 run was judged against try 2's.
		seam.script = (turn) => ({
			acts: turn === 1 ? [run(['cat', 'notes.txt'], 'the notes\n')] : [],
			account: `ACCOUNT GIVEN ON TRY ${turn}.`
		});
		// The first try's work product is refused with a finding, so the producer is asked again; the second try runs nothing.
		seam.review = (p) =>
			isWorkProductReview(p) && p.includes('ACCOUNT GIVEN ON TRY 1.') ? floorReply({ statement: 'The answer is thin.' }) : undefined;
		const pwuId = await modelWorkUnit();

		await beginExecute(pwuId);

		expect(seam.turns, 'arrangement: the refused work product sent no second try').toHaveLength(2);
		const commandReviews = seam.prompts.filter(isCommandReview);
		expect(commandReviews, 'arrangement: the one command was not reviewed once').toHaveLength(1);
		expect(commandReviews[0], 'the try-1 run was not judged against try 1’s account').toContain('ACCOUNT GIVEN ON TRY 1.');
		expect(commandReviews[0], 'the try-1 run was judged against the last try’s account').not.toContain('ACCOUNT GIVEN ON TRY 2.');
	});

	it('⭐ CONTROL — a clean try whose work-product and command reviews pass completes on its first try, naming its own evidence', async () => {
		seam.script = () => ({ acts: [run(['node', '--test'], '3 passed\n')], account: 'The suite passed.' });
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);

		expect(result.data?.error, 'a clean try did not complete').toBeUndefined();
		expect(seam.turns, 'a clean try was asked again').toHaveLength(1);
		const evidence = evidenceOf(pwuId);
		expect(completionsOf(pwuId).map((c) => c.evidence)).toEqual([[evidence[0]!.id]]);
	});

	it('⛔ ONE observer per step: three tries that run 40 commands in all retain 32, and at most 32 are reviewed', async () => {
		// ⛔ The 32-run bound is the STEP's (`OBSERVED_PROCESS_RUN_LIMIT`), and the lane's whole-press worst case counts it once
		// (`PHASE7_UNIT_REVIEWER_CALLS` = (3 tries + 32 runs) × 6). An observer minted per try would retain 40, and review 40.
		const counts = [14, 14, 12];
		seam.script = (turn) => ({
			acts: Array.from({ length: counts[turn - 1] ?? 0 }, (_, i) =>
				run(['node', '--test', `t${turn}-${i}.test.js`], turn === 2 && i === 0 ? 'clean\n' : 'marked\n')
			),
			account: `Try ${turn}.`
		});
		// Each marked command's review is REJECTED with a finding, so the open findings fall (14, 13, …) and the loop goes on.
		seam.review = (p) => (isCommandReview(p) && stdoutOf(p) === 'marked' ? floorReply({ statement: 'Marked.' }) : undefined);
		const pwuId = await modelWorkUnit();

		await beginExecute(pwuId);

		expect(seam.turns, 'arrangement: the loop did not run three tries').toHaveLength(3);
		const reviewed = seam.prompts.filter(isCommandReview).map(commandOf);
		expect(reviewed, 'more commands were reviewed than the step retains').toHaveLength(32);
		expect(evidenceOf(pwuId), 'more commands became evidence than the step retains').toHaveLength(32);
		// ⭐ The third try's 12: 4 retained (28 + 4 = 32), 8 past the bound, declared on its work product's review.
		expect(reviewed.filter((c) => c.includes('"t3-')), 'the third try’s retained runs').toHaveLength(4);
		const lastWorkProduct = seam.prompts.filter(isWorkProductReview).at(-1)!;
		expect(lastWorkProduct, 'the runs past the bound are not declared').toContain(
			"(8 runs past the step's bound of 32 took numbers missing above: none is retained, and none is reviewed.)"
		);
	});
});

describe('⭐⭐ package N — D10: the work-product review is shown the finished work; D12: the read’s own review is narrowed', () => {
	const COMMONJS = "'use strict';\nconst fs = require('node:fs');\nmodule.exports = { count };\n";
	const ESM = "import fs from 'node:fs';\nexport function count(text) {\n  return text.split(/\\s+/).length;\n}\n";

	it('⭐ a pre-existing CommonJS file read and then rewritten to ESM: the work product is judged on the FINAL file, and the read’s review is scoped to the read', async () => {
		// THE RED (run-12 cases 18-23's shape; `REG-F-579`): the work product's review was given the answer alone, so no review
		// saw the file the unit delivered — and each read of the file's earlier state was judged against the whole obligation.
		const pwuId = await modelWorkUnit();
		await workspaceOf(pwuId).writeFile('src/wordfreq.js', COMMONJS);
		seam.script = () => ({
			acts: [run(['cat', 'src/wordfreq.js'], COMMONJS), write('src/wordfreq.js', ESM)],
			account: 'Rewrote the module as an ES module.'
		});

		const result = await beginExecute(pwuId);

		expect(result.data?.error, 'arrangement: the clean step did not complete').toBeUndefined();
		const workProduct = seam.prompts.find(isWorkProductReview)!;
		expect(workProduct, 'the work product’s review was not shown the changed file').toContain('Changed "src/wordfreq.js":');
		expect(workProduct, 'the work product’s review was not shown the FINAL file’s text').toContain(ESM.trimEnd());
		expect(workProduct, 'the work product’s review was shown the file’s earlier state').not.toContain("module.exports = { count };");
		expect(workProduct, 'the work product’s review was not shown the step’s sequence, in order').toContain(
			'Try 1:\n  1. ran ["cat","src/wordfreq.js"] — exit 0\n  2. wrote "src/wordfreq.js"'
		);
		// ⭐ D12 — and the read's own review asks only what the account says of THAT result, its place in the sequence named.
		const read = seam.prompts.find(isCommandReview)!;
		expect(read, 'the read’s review does not carry the scoping sentence').toContain(SCOPE);
		expect(read, 'the read’s review does not name its place in the step’s sequence').toContain(
			'  1. ran ["cat","src/wordfreq.js"] — exit 0 ← this command\n  2. wrote "src/wordfreq.js"'
		);
		expect(read, 'the read’s review still asks the obligation question').not.toContain(
			'You are reviewing one command result and the account the agent gave of its work'
		);
	});

	it('⭐ CONTROL — a file the unit did not change is not shown as changed; none changed says so', async () => {
		const pwuId = await modelWorkUnit();
		await workspaceOf(pwuId).writeFile('README.md', '# untouched\n');
		seam.script = () => ({ acts: [run(['ls'], 'README.md\n')], account: 'Listed the workspace.' });

		await beginExecute(pwuId);

		const workProduct = seam.prompts.find(isWorkProductReview)!;
		expect(workProduct).toContain('The unit changed no file in its workspace since its step began, as the host read it after try 1.');
		expect(workProduct, 'an untouched file was shown as changed').not.toContain('"README.md":');
	});
});

describe('⭐⭐ package N — D11: the declared reviews at sign-off are shown the finished work; a re-review is shown what the refused try was', () => {
	/** A MODEL work unit of a type that declares `pol_requirement_coverage`, of a kind it governs — published, instantiated. */
	async function declaringModelUnit(): Promise<string> {
		const pwaId = mintUiId('pwa');
		const typeId = mintUiId('pwut');
		const steps: readonly [string, string, string, Record<string, unknown>][] = [
			['CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, { pwaId, name: 'Requirements PWA', description: 'd', domain: 'software', version: '0.1.0' }],
			[
				'DefinePwuType',
				'PWU_TYPE',
				typeId,
				{
					pwuTypeId: typeId,
					pwaId,
					pwuKind: 'REQUIREMENT_DEFINITION',
					name: 'Requirements',
					purpose: 'Write the requirements',
					isRoot: true,
					permittedChildTypeIds: [],
					requiredInputs: [],
					requiredOutputs: [],
					requiredAssurancePolicyIds: ['pol_requirement_coverage'],
					workDischarge: 'MODEL',
					promptTemplate: {
						templateText: 'Write the requirements of {subject}.',
						templateVersion: 1,
						declaredPlaceholders: ['subject'],
						status: 'ACTIVE'
					}
				}
			],
			['SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
			['ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
			['PublishPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, { rootPwuTypeId: typeId }]
		];
		for (const [commandType, aggregateType, aggregateId, payload] of steps) {
			const r = dispatch(commandType, aggregateType, aggregateId, payload);
			expect(r.status, `arrangement: ${commandType} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
		}
		const created = (await undertakings.create(
			actionEvent('create', {
				name: 'Declared Demo',
				pwaId,
				'risk.consequence': 'HIGH',
				'risk.uncertainty': 'MEDIUM',
				'risk.irreversibility': 'LOW',
				'risk.securitySensitivity': 'LOW',
				'risk.regulatoryExposure': 'NONE'
			}) as never
		)) as { created?: string };
		expect(created.created, 'arrangement: the Undertaking').toBeDefined();
		return listPwus(getEngine(), created.created!).find((p) => p.state.pwuTypeId === typeId)!.id;
	}

	const recordAssurance = async (pwuId: string) =>
		(await actions.recordAssurance(actionEvent('recordAssurance', { pwuId }) as never)) as { data?: { error?: string } };

	it('⭐ a declared review’s input holds the unit’s changed files and its step’s sequence, as recorded at its completion', async () => {
		// THE RED (design D11): the declared reviews judged the work products and commands alone — `REG-F-522`'s gap on this plane.
		const pwuId = await declaringModelUnit();
		seam.script = () => ({
			acts: [write('docs/requirements.md', '# Requirements\nR1. Count words.\n'), run(['cat', 'docs/requirements.md'], '# Requirements\n')],
			account: 'Wrote the requirements.'
		});
		expect((await beginExecute(pwuId)).data?.error, 'arrangement: Begin & Execute').toBeUndefined();

		await recordAssurance(pwuId);

		const declared = seam.prompts.find((p) => p.includes('declared assurance policy'));
		expect(declared, 'arrangement: no declared review was asked').toBeDefined();
		expect(declared, 'the declared review was not shown the unit’s changed file').toContain(
			'"files":[{"workUnit":"Requirements","path":"docs/requirements.md","change":"ADDED","text":"# Requirements\\nR1. Count words.\\n"}]'
		);
		expect(declared, 'the declared review was not shown the step’s sequence').toContain(
			'"sequence":[{"workUnit":"Requirements","try":1,"act":1,"wrote":"docs/requirements.md"},{"workUnit":"Requirements","try":1,"act":2,"ran":["cat","docs/requirements.md"],"exitCode":0,"timedOut":false}]'
		);
	});

	it('⭐ CONTROL — a unit whose admitted try ran no command has no view on the record: its declared review is told so, never shown "no file changed"', async () => {
		const pwuId = await declaringModelUnit();
		seam.script = () => ({ acts: [write('docs/requirements.md', '# Requirements\n')], account: 'Wrote the requirements.' });
		expect((await beginExecute(pwuId)).data?.error, 'arrangement: Begin & Execute').toBeUndefined();

		await recordAssurance(pwuId);

		const declared = seam.prompts.find((p) => p.includes('declared assurance policy'))!;
		expect(declared).toContain(
			'The host holds no record of the files the work unit "Requirements" changed, or of its step\'s writes and runs: its last try ran no command, so no command evidence carries that record, and nothing of it is in "files" or "sequence" above.'
		);
		expect(declared, 'an unrecorded view was shown as no file changed').toContain('"files":[]');
	});

	it('⭐ rerunReview re-runs a refused floor through the same builders: the re-review is shown the refused try’s finished work', async () => {
		// THE RED (design D9-D10; RD7): a re-review rebuilt the producing turn and each refused run, and nothing of the files.
		const pwuId = await modelWorkUnit();
		seam.script = () => ({
			acts: [write('src/report.md', '# The report\n'), run(['cat', 'src/report.md'], '# The report\n')],
			account: 'Wrote the report.'
		});
		// The work product's review fails at the transport on every call: it does not conclude, so the unit waits and a
		// re-review is offered (RD3).
		let down = true;
		seam.review = (p) => {
			if (down && isWorkProductReview(p)) throw new Error('devin exited with code 1: connection reset by peer');
			return undefined;
		};
		const refused = await beginExecute(pwuId);
		expect(refused.data?.error, 'arrangement: the work product’s review concluded').toMatch(/VALIDATOR_EXECUTION_FAILED/);
		down = false;
		seam.prompts.length = 0;

		const rerun = (await actions.rerunReview(
			actionEvent('rerunReview', { pwuId, rationale: 'The reviewer failed at the transport; review it again.' }) as never
		)) as { advanced?: string; data?: { error?: string } };

		expect(rerun.data?.error, 'the re-review did not complete').toBeUndefined();
		const reReview = seam.prompts.find(isWorkProductReview);
		expect(reReview, 'arrangement: the work product was not re-reviewed').toBeDefined();
		expect(reReview, 'the re-review was not shown the refused try’s changed file').toContain('Added "src/report.md":');
		expect(reReview, 'the re-review was not shown the refused try’s sequence').toContain(
			'  1. wrote "src/report.md"\n  2. ran ["cat","src/report.md"] — exit 0'
		);
	});

	it('⭐ D9 — a stopped unit is the REFUSED try’s: a re-review re-runs that try’s refused floors alone, and completes naming that try’s evidence — an earlier try’s concluded refusal stays on the record, and decides nothing', async () => {
		// ⛔ Each try's runs are joined in the try now, so one attempt holds every try's command evidence. Read whole, the first
		// try's REJECTED command would make the stop CONCLUDED — no re-review offered (`REG-D-105` (3)) — and B's completion would
		// name evidence no completion of the refused try named.
		const pwuId = await modelWorkUnit();
		seam.script = (turn) => ({ acts: [run(['node', '--test'], turn === 1 ? '1 failed\n' : '2 passed\n')], account: `Try ${turn}.` });
		let down = true;
		seam.review = (p) => {
			if (!isCommandReview(p)) return undefined;
			if (stdoutOf(p) === '1 failed') return floorReply({ statement: 'THE SUITE FAILED ON TRY ONE.' });
			// The second try's command review fails at the transport: it does not conclude, so the unit waits.
			if (down) throw new Error('devin exited with code 1: connection reset by peer');
			return undefined;
		};
		const refused = await beginExecute(pwuId);
		expect(refused.data?.error, 'arrangement: the second try’s command review concluded').toMatch(/VALIDATOR_EXECUTION_FAILED/);
		expect(seam.turns, 'arrangement: no second try').toHaveLength(2);
		const [first, second] = evidenceOf(pwuId);
		expect([first?.reasoningReview, second?.reasoningReview], 'arrangement: each try’s command reviewed in its try').toEqual([
			'REJECTED',
			'INCONCLUSIVE'
		]);
		down = false;
		seam.review = undefined;

		const rerun = (await actions.rerunReview(
			actionEvent('rerunReview', { pwuId, rationale: 'The reviewer failed at the transport; review it again.' }) as never
		)) as { data?: { error?: string } };

		expect(rerun.data?.error, 'the refused try’s re-review was refused, or did not complete').toBeUndefined();
		const completions = completionsOf(pwuId);
		expect(completions.at(-1)?.evidence, 'the re-review’s completion named another try’s evidence').toEqual([second!.id]);
		expect(evidenceOf(pwuId)[0]?.reasoningReview, 'the first try’s refusal is gone from the record').toBe('REJECTED');
	});
});
