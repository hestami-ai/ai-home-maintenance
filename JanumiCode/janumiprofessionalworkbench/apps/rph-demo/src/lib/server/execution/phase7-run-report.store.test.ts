// ⭐ `JAN-EXEC` Phase 7, P7-2 D9 (`docs/_working/DESIGN-the-live-end-to-end-run.md` §6) — THE RUN REPORT, END TO END, OVER
// STORES THE PRODUCT ITSELF WROTE: the lane's five units driven through the Undertaking page's own actions in SERVER mode,
// onto a durable record store and content store; archived as the lane archives them — SQLite's backup, each copy turned
// to a rollback journal (D6); and read by `bun scripts/phase7/run-report.ts`, spawned, read-only.
//
// What no synthetic row can show, and this does: that the report reads what the product WRITES — the envelope in
// `domain_events.payload`, the first-event order, one batch's `ui-<n>` command ids, the calls a floor run drains, the
// evidence a join proposes — and that the CLI's read-only open leaves the archive byte for byte as it found it.
//
// ⭑ THE RUN, as the lane would drive it: the root (no model); requirements, clean; design, whose review fails at the
// transport on its call AND its one retry (`P7-2b`), so it stops; implementation, whose second command's review is
// REJECTED, so its completion is refused — ⭐ its step suspended by hand while its first review was in flight (`P76F-C` C6),
// so the route recorded no wait for a person's choice — and then the operator resumes and completes its step BY HAND,
// naming its one work product: the forbidden act the audit must name (P7-3, the critic's corrected rule); end-to-end, clean, with 33
// commands, the 33rd past the observer's cap (`REG-F-517`), and one naming a path outside the workspace. Then the
// sign-offs of the units that completed, the root last.
//
// ⚠ WHAT IS ARRANGED RATHER THAN RUN: the executor (agy, on its exec seam, answering the fixture's envelope) writes no
// file and runs no command, so the files a phase writes and the capture folder each completed run leaves are written
// here, as the model and the runner would have left them; and the lane's own files (`lane/run.json` and the rest) are
// written here as the spec writes them.
//
// ⛔ HERMETIC: devin answers on its exec seam as each review scripts; PATH names an empty directory while the run is
// driven; and the one process this file starts is bun, for the CLI, afterwards.
import { vi } from 'vitest';

/** The run folder, made before anything reads the environment: the workbench chooses its store when it loads. */
const fixture = await vi.hoisted(async () => {
	const { mkdtempSync } = await import('node:fs');
	const { tmpdir } = await import('node:os');
	const { join } = await import('node:path');
	const dir = mkdtempSync(join(tmpdir(), 'jpwb-p7-report-'));
	const saved = {
		mode: process.env.RPH_DEMO_MODE,
		seed: process.env.JPWB_SEED,
		db: process.env.JPWB_DEMO_DB
	};
	process.env.RPH_DEMO_MODE = 'server';
	process.env.JPWB_SEED = 'empty';
	process.env.JPWB_DEMO_DB = join(dir, 'demo.sqlite');
	return { dir, saved, path: process.env.PATH };
});

/** What the seams answer. Hoisted: the mock factories below run before this file's body. */
const seam = vi.hoisted(() => ({
	/** Every prompt devin's program was given, in order. */
	devin: [] as string[],
	/**
	 * ⭐ `P76F-C` C6 — what the operator does WHILE a review is in flight, run once at the next call devin receives, then
	 * cleared: the hand Wait the implementation phase's step takes mid-review.
	 */
	duringReview: undefined as undefined | (() => Promise<void>),
	/** What the host's process-run observer reports for the unit being run. */
	observed: undefined as
		| undefined
		| {
				readonly runs: readonly unknown[];
				readonly observedCount: number;
				readonly recordedLimit: number;
		  }
}));

vi.mock('./model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./model.js')>();
	return {
		...actual,
		getExecutionSession: vi.fn((selection: Parameters<typeof actual.getExecutionSession>[0]) => {
			const open = actual.getExecutionSession(selection, {
				agyExec: async (_file, args) => ({
					stdout: await actual.deterministicExecutionPrint(args[1] ?? '')
				}),
				openPi: async () => {
					throw new Error('hermetic: no Pi session is opened here');
				}
			});
			return async (context: Parameters<typeof open>[0]) => {
				const session = await open(context);
				return {
					...session,
					processRuns: () =>
						(seam.observed ?? session.processRuns()) as ReturnType<typeof session.processRuns>
				};
			};
		})
	};
});

// ⭑ THE REAL devin ADAPTER, ITS PROGRAM REPLACED AT THE SEAM: it reports the configured model, and answers by what it is
// asked — a transport failure for the design phase's review, a REJECTED review for a command marked so, else clean.
vi.mock('../tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../tools/devin-reviewer.js')>();
	const { writeFile } = await import('node:fs/promises');
	const { SEEDED_REASONING_REVIEW_CRITERIA } = await import('@janumipwb/rph-assurance');
	// ⭐ `JAN-EXEC` Phase 7 completion E2 — a DECLARED policy's review is answered by ITS rubric, read off the prompt (each
	// rubric line is `- <id>: … [if unmet: …]`), as a reviewer reads it; a floor review by the seeded floor rubric, as before.
	const rubricOf = (prompt: string): readonly { id: string }[] =>
		prompt.includes('declared assurance policy')
			? [...prompt.matchAll(/^- ([A-Za-z0-9_-]+): .* \[if unmet: [A-Z]+\]$/gm)].map((m) => ({ id: m[1]! }))
			: SEEDED_REASONING_REVIEW_CRITERIA;
	const judgement = (faulted?: string, criteria: readonly { id: string }[] = SEEDED_REASONING_REVIEW_CRITERIA) =>
		JSON.stringify({
			findings: criteria.map((c) =>
				c.id === faulted
					? {
							criterionId: c.id,
							failed: true,
							statement: 'the run named here did not pass',
							severity: 'BLOCKING'
						}
					: {
							criterionId: c.id,
							failed: false,
							statement: 'evaluated; the failure class is absent'
						}
			),
			recommendation: faulted ? 'REJECTED' : 'SATISFIED',
			residualUncertainty: []
		});
	return {
		...actual,
		devinPrint: vi.fn((prompt: string) =>
			actual.devinPrint(prompt, async (_file, args) => {
				seam.devin.push(prompt);
				// ⭐ `P76F-C` C6 — the operator's act during the review, once.
				const during = seam.duringReview;
				seam.duringReview = undefined;
				if (during) await during();
				if (prompt.includes('Work unit: Design.'))
					throw new Error('devin exited with code 1: connection reset by peer');
				const exportPath = args[args.indexOf('--export') + 1];
				if (exportPath !== undefined)
					await writeFile(
						exportPath,
						JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-assurance-model' } }] }),
						'utf8'
					);
				return {
					stdout: judgement(
						prompt.includes('marker-reject') ? 'RR-08-evidence-integrity' : undefined,
						rubricOf(prompt)
					)
				};
			})
		)
	};
});

import Database from 'better-sqlite3';
import { listByType, listPwus } from '@janumipwb/rph-engine';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	PHASE7_E2E,
	PHASE7_IMPLEMENTATION,
	PHASE7_PWA,
	PHASE7_REQUIREMENTS,
	PHASE7_ROOT,
	PHASE7_DESIGN,
	promptMarkers
} from '../../../../../../scripts/phase7/pwa-content.js';
import { manifestProblems, selectUnit } from '../../../../../../scripts/phase7/rerun-commands.js';
import { workspaceTreeSha256 } from '../../../../../../scripts/phase7/node-tests.js';
import {
	K5_JOIN_CAUSE,
	K5_OWN_FOLDER_CAUSE,
	K5_STOP_CAUSE,
	k5CapCause
} from '../../../../../../scripts/phase7/k5-causes.js';
import {
	workspaceDirectoryFor,
	type RunReport
} from '../../../../../../scripts/phase7/run-report-core.js';
import { accountNames, scanTarget } from '../../../../../../scripts/phase7/archive-scan.js';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import {
	createProcessRunObserver,
	type ObservedProcessRun
} from '../tools/process-run-observer.js';
import { dispatch, getEngine, mintUiId } from '../workbench.js';
import { actionEvent } from './begin-execute.testing.js';
import { actions } from '../../../routes/undertakings/[id]/+page.server.js';
import { actions as undertakings } from '../../../routes/undertakings/+page.server.js';

const RUN_REPORT = fileURLToPath(
	new URL('../../../../../../scripts/phase7/run-report.ts', import.meta.url)
);
const DB = join(fixture.dir, 'demo.sqlite');
const LANE = join(fixture.dir, 'lane');
const FINAL = join(LANE, 'archive', '06-final');
/** A second run folder, whose final archive keeps its store in WAL mode. */
const UNCONVERTED = join(fixture.dir, 'unconverted');
/** The live-backend selection this run needs: devin reviewing, agy executing, each with its model. */
const BACKEND = {
	JPWB_ASSURANCE_TOOL: 'devin',
	JPWB_ASSURANCE_MODEL: 'fixture-assurance-model',
	JPWB_EXECUTOR: 'agy',
	JPWB_EXECUTOR_MODEL: 'fixture-executor-model'
} as const;
const RISK = {
	'risk.consequence': 'HIGH',
	'risk.uncertainty': 'MEDIUM',
	'risk.irreversibility': 'LOW',
	'risk.securitySensitivity': 'LOW',
	'risk.regulatoryExposure': 'NONE'
};
const UNITS = [
	{ order: 1, slug: 'root', type: PHASE7_ROOT },
	{ order: 2, slug: 'requirements', type: PHASE7_REQUIREMENTS },
	{ order: 3, slug: 'design', type: PHASE7_DESIGN },
	{ order: 4, slug: 'implementation', type: PHASE7_IMPLEMENTATION },
	{ order: 5, slug: 'end-to-end', type: PHASE7_E2E }
] as const;
const archiveOf = (order: number, slug: string): string =>
	join(LANE, 'archive', `${String(order).padStart(2, '0')}-${slug}`);

/** One command the host completed and retained, its capture folder named `folder`. */
const aRun = (
	folder: string,
	argv: readonly string[],
	exitCode = 0
): Omit<ObservedProcessRun, 'ordinal'> => ({
	argv,
	exitCode,
	timedOut: false,
	durationMs: 12,
	outputComplete: true,
	omittedRegions: [],
	retention: {
		retained: true,
		workspaceOwnerId: 'arranged',
		purgeability: 'PURGEABLE_AT_EXPIRY',
		stdoutPath: `captures/${folder}/stdout.txt`,
		stderrPath: `captures/${folder}/stderr.txt`,
		omittedRegions: [],
		omissionsPath: `captures/${folder}/omissions.json`
	},
	stdout: `${folder}: 1 passed\n`,
	stderr: ''
});

/** What the host's REAL observer reports after `runs` complete — its own cap applied. */
function observedRuns(runs: readonly Omit<ObservedProcessRun, 'ordinal'>[]) {
	const observer = createProcessRunObserver();
	for (const run of runs) observer.ran(run);
	return observer.observed();
}

/** Every file under `dir`, by relative path, with its SHA-256. */
function digestOf(dir: string): Record<string, string> {
	const out: Record<string, string> = {};
	const walk = (d: string) => {
		for (const name of readdirSync(d)) {
			const p = join(d, name);
			if (statSync(p).isDirectory()) walk(p);
			else
				out[relative(dir, p).split('\\').join('/')] = createHash('sha256')
					.update(readFileSync(p))
					.digest('hex');
		}
	};
	walk(dir);
	return out;
}

/** The lane's archive of one store: SQLite's backup, then the copy turned to a rollback journal (design D6). */
async function backupConverted(source: string, target: string): Promise<void> {
	const from = new Database(source, { readonly: true, fileMustExist: true });
	try {
		await from.backup(target);
	} finally {
		from.close();
	}
	const to = new Database(target);
	try {
		to.pragma('journal_mode = DELETE');
	} finally {
		to.close();
	}
}

/** The CLI, as an operator runs it, with the PATH the run hid from the product. */
function runReport(runDir: string): { readonly code: number | null; readonly out: string } {
	const r = spawnSync('bun', [RUN_REPORT, runDir], {
		encoding: 'utf8',
		timeout: 120_000,
		env: { ...process.env, PATH: fixture.path }
	});
	return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** §3.2's PWA, as the designer stores it: the four phases, then the root over them, all M1; published. */
function publishThePwa(): string {
	const pwaId = mintUiId('pwa');
	const typeIds = new Map<string, string>();
	const steps: [string, string, string, Record<string, unknown>][] = [
		[
			'CreatePwa',
			'PROFESSIONAL_WORK_ARCHITECTURE',
			pwaId,
			{
				pwaId,
				name: PHASE7_PWA.name,
				description: 'The run’s PWA.',
				domain: PHASE7_PWA.domain,
				version: '0.1.0'
			}
		]
	];
	for (const t of PHASE7_PWA.types) {
		const id = mintUiId('pwut');
		typeIds.set(t.name, id);
		const children = (t.children ?? []).map((name) => typeIds.get(name)!);
		steps.push([
			'DefinePwuType',
			'PWU_TYPE',
			id,
			{
				pwuTypeId: id,
				pwaId,
				pwuKind: t.pwuKind,
				name: t.name,
				purpose: t.purpose,
				isRoot: t.isRoot === true,
				permittedChildTypeIds: children,
				permittedChildren: children.map((typeId) => ({ typeId, cardinality: 'M1' })),
				requiredInputs: [],
				requiredOutputs: [],
				requiredAssurancePolicyIds: [...t.policyIds],
				executionBoundary: 'INTERNAL',
				...(t.prompt
					? {
							promptTemplate: {
								templateText: t.prompt,
								templateVersion: 1,
								declaredPlaceholders: promptMarkers(t.prompt),
								...(t.outputContract ? { outputContract: t.outputContract } : {}),
								status: 'ACTIVE'
							}
						}
					: {}),
				workDischarge: t.workDischarge
			}
		]);
	}
	steps.push(
		['SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
		['ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
		[
			'PublishPwa',
			'PROFESSIONAL_WORK_ARCHITECTURE',
			pwaId,
			{ rootPwuTypeId: typeIds.get(PHASE7_ROOT.name) }
		]
	);
	for (const [commandType, aggregateType, aggregateId, payload] of steps) {
		const r = dispatch(commandType, aggregateType, aggregateId, payload);
		expect(r.status, `arrangement: ${commandType} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	}
	return pwaId;
}

type Envelope = { readonly type: 'success' | 'failure'; readonly error: string };
/** A page action's answer, as the lane saves it: a success, or a refusal and its text. */
const envelopeOf = (r: unknown): Envelope => {
	const failure = r as { status?: number; data?: { error?: string } } | undefined;
	return typeof failure?.status === 'number' && failure.status >= 400
		? { type: 'failure', error: failure.data?.error ?? '' }
		: { type: 'success', error: '' };
};

/** What the run did, as the lane records it, and the report the CLI wrote. */
const ran = {
	undertakingId: '',
	units: new Map<string, string>(),
	workspace: '',
	posts: [] as { seq: number; at: string; url: string; action: string; status: number }[],
	envelopes: new Map<string, Envelope>(),
	before: {} as Record<string, string>,
	cli: { code: null as number | null, out: '' },
	report: undefined as RunReport | undefined
};

/** One page action, posted as the lane posts it: logged in `posts.jsonl`, its answer saved in `lane/actions/`. */
async function press(
	action:
		| 'beginExecute'
		| 'enterWaitStep'
		| 'resolveWaitStep'
		| 'completeStep'
		| 'recordAssurance'
		| 'markSatisfied',
	unit: (typeof UNITS)[number],
	fields: Readonly<Record<string, string>>
): Promise<Envelope> {
	const answer = envelopeOf(await actions[action](actionEvent(action, fields)));
	ran.posts.push({
		seq: ran.posts.length + 1,
		at: new Date().toISOString(),
		url: `http://127.0.0.1:4322/undertakings/${ran.undertakingId}?/${action}`,
		action,
		status: 200
	});
	const file = `${String(unit.order).padStart(2, '0')}-${unit.slug}-${action}.json`;
	mkdirSync(join(LANE, 'actions'), { recursive: true });
	writeFileSync(
		join(LANE, 'actions', file),
		JSON.stringify({
			unit: unit.slug,
			action,
			status: 200,
			envelopeType: answer.type,
			rawBody: '',
			decoded: null
		})
	);
	ran.envelopes.set(`${unit.slug}:${action}`, answer);
	return answer;
}

/** The files a phase would have written into the shared workspace, and a capture folder per run it completed. */
function leaveWhatThePhaseLeft(
	files: Readonly<Record<string, string>>,
	folders: readonly string[]
): void {
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(join(ran.workspace, file, '..'), { recursive: true });
		writeFileSync(join(ran.workspace, file), text);
	}
	for (const folder of folders) {
		const dir = join(`${ran.workspace}.process-output`, 'captures', folder);
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, 'stdout.txt'), `${folder}: 1 passed\n`);
		writeFileSync(join(dir, 'stderr.txt'), '');
		writeFileSync(join(dir, 'omissions.json'), '{"note":"COMPLETE.","omittedRegions":[]}');
	}
}

/** The lane's archive after one unit: the workspace and its capture sibling, byte for byte, when they exist. */
function archiveTheUnit(order: number, slug: string): void {
	const into = archiveOf(order, slug);
	mkdirSync(into, { recursive: true });
	if (ran.workspace !== '' && existsSync(ran.workspace)) {
		cpSync(ran.workspace, join(into, 'workspace'), { recursive: true });
		cpSync(`${ran.workspace}.process-output`, join(into, 'process-output'), { recursive: true });
	}
}

const saved = new Map<string, string | undefined>();
beforeAll(async () => {
	for (const [k, v] of Object.entries({ ...BACKEND, PATH: noProgramsDirectory() })) {
		saved.set(k, process.env[k]);
		process.env[k] = v;
	}
	try {
		const pwaId = publishThePwa();
		const created = (await undertakings.create(
			actionEvent('create', {
				name: 'wordfreq realization',
				pwaId,
				product: 'wordfreq',
				...RISK
			}) as never
		)) as { created?: string };
		expect(created.created, 'arrangement: the Undertaking').toBeDefined();
		ran.undertakingId = created.created!;
		for (const p of listPwus(getEngine(), ran.undertakingId))
			ran.units.set(String(p.state.title), p.id);
		expect(ran.units.size, 'arrangement: five units').toBe(5);
		const unitId = (u: (typeof UNITS)[number]) => ran.units.get(u.type.name)!;
		const [root, requirements, design, implementation, e2e] = UNITS;

		// The root: Begin & Execute runs no model.
		expect((await press('beginExecute', root, { pwuId: unitId(root) })).type).toBe('success');
		archiveTheUnit(root.order, root.slug);

		seam.observed = observedRuns([]);
		expect((await press('beginExecute', requirements, { pwuId: unitId(requirements) })).type).toBe(
			'success'
		);
		const workspaces = readdirSync(`${DB}.workspaces`).filter((n) => !n.includes('.'));
		expect(workspaces, 'arrangement: one Undertaking workspace').toHaveLength(1);
		ran.workspace = join(`${DB}.workspaces`, workspaces[0]!);
		leaveWhatThePhaseLeft({ 'docs/requirements.md': '# Requirements\n' }, []);
		archiveTheUnit(requirements.order, requirements.slug);

		// design: its review fails at the transport, on the call and on its one retry, so the unit stops.
		const designAnswer = await press('beginExecute', design, { pwuId: unitId(design) });
		expect(
			designAnswer.error,
			'arrangement: the design review did not fail at the transport'
		).toMatch(/VALIDATOR_EXECUTION_FAILED/);
		leaveWhatThePhaseLeft({ 'docs/design.md': '# Design\n' }, []);
		archiveTheUnit(design.order, design.slug);

		// implementation: its second command's review is REJECTED, so the completion is refused …
		seam.observed = observedRuns([
			aRun('impl-1', ['node', '--test', 'test/unit/wordfreq.test.js']),
			aRun('impl-2', [
				'node',
				'--test',
				join(ran.workspace, 'test', 'unit', 'marker-reject.test.js')
			])
		]);
		// ⭐⭐ `P76F-C` C6 — … AND, WHILE ITS FIRST REVIEW IS IN FLIGHT, THE OPERATOR SUSPENDS ITS STEP BY HAND: the step is RUNNING,
		// the page offers Wait on it, and the unit is not waiting for a person's choice, so the server admits it (A5 refuses
		// Resume and Cancel only on the wait the route records at a refusal, `stepActOnAwaitedChoice`). ⛔ Before this, the
		// operator Resumed the route's own recovery wait, which A5 now refuses — so no hand completion reached any store the
		// product wrote, and PQ7-M156 and PQ7-M168 were held by synthetic rows alone.
		const stepOf = () => {
			const plan = listByType(getEngine(), 'EXECUTION_PLAN').find(
				(p) => p.state.workUnitId === unitId(implementation)
			)!;
			return { planId: plan.id, stepId: (plan.state.steps as { id: string }[])[0]!.id };
		};
		seam.duringReview = async () => {
			const waited = await press('enterWaitStep', implementation, stepOf());
			expect(waited.type, `arrangement: the hand Wait mid-review was refused: ${waited.error}`).toBe('success');
		};
		const refused = await press('beginExecute', implementation, { pwuId: unitId(implementation) });
		expect(seam.duringReview, 'arrangement: no review was in flight to wait the step during').toBeUndefined();
		expect(refused.error, 'arrangement: the command review did not refuse the completion').toMatch(
			/the command evidence did not pass its own floor/
		);
		// ⭐ The step was no longer RUNNING when the completion was refused, so the route recorded no wait of its own
		// (`waitForAPerson`): the unit's execution is still RUNNING, never WAITING for a person's choice.
		expect(
			listPwus(getEngine(), ran.undertakingId).find((p) => p.id === unitId(implementation))?.state.executionState,
			'arrangement: the route recorded a wait for a person’s choice'
		).toBe('RUNNING');
		// … then the operator resumes the step by hand — ADMITTED, the unit never having waited for a person's choice — and
		// completes it by hand, naming its one work product: the act P7-3 forbids.
		const product = listByType(getEngine(), 'ARTIFACT')
			.filter((a) => a.state.producingPwuId === unitId(implementation))
			.at(-1)!;
		const resumed = await press('resolveWaitStep', implementation, stepOf());
		expect(resumed.type, `arrangement: the hand Resume was refused: ${resumed.error}`).toBe('success');
		const byHand = await press('completeStep', implementation, { ...stepOf(), outputArtifactId: product.id });
		expect(byHand, 'arrangement: the hand completion naming one output was refused').toEqual({
			type: 'success',
			error: ''
		});
		leaveWhatThePhaseLeft(
			{ 'src/wordfreq.js': 'export {};\n', 'test/unit/wordfreq.test.js': '// unit tests\n' },
			['impl-1', 'impl-2']
		);
		archiveTheUnit(implementation.order, implementation.slug);

		// end-to-end: 33 commands, the 33rd past the observer's cap; the 5th names a path outside the workspace.
		const e2eRuns = Array.from({ length: 33 }, (_, i) =>
			aRun(`e2e-${i + 1}`, [
				'node',
				'--test',
				i === 4 ? join(fixture.dir, 'elsewhere', 'x.test.js') : `test/e2e/case-${i + 1}.test.js`
			])
		);
		seam.observed = observedRuns(e2eRuns);
		expect((await press('beginExecute', e2e, { pwuId: unitId(e2e) })).type).toBe('success');
		seam.observed = undefined;
		leaveWhatThePhaseLeft(
			{
				'test/e2e/cli.test.js': '// end-to-end tests\n',
				'docs/verification.md': '# Verification\n'
			},
			e2eRuns.map((_, i) => `e2e-${i + 1}`)
		);
		archiveTheUnit(e2e.order, e2e.slug);
		// ⭐ P5 package B (F5) — and its K5 check's causes, as the archiver records them for a unit whose join recorded the 32
		// runs the product keeps (`run-archive.ts` `causesOf`): the report takes the 33rd run's cause from them.
		writeFileSync(
			join(archiveOf(e2e.order, e2e.slug), 'checks.json'),
			JSON.stringify({
				k5: {
					causes: [
						{ cause: k5CapCause(32), possible: true },
						{ cause: K5_STOP_CAUSE, possible: false },
						{ cause: K5_JOIN_CAUSE, possible: false },
						{ cause: K5_OWN_FOLDER_CAUSE, possible: true }
					]
				}
			})
		);

		// The sign-offs of the units that completed, the root last.
		for (const u of [requirements, e2e, root]) {
			expect(
				(await press('recordAssurance', u, { pwuId: unitId(u) })).type,
				`arrangement: ${u.slug} assured`
			).toBe('success');
			expect(
				(await press('markSatisfied', u, { pwuId: unitId(u) })).type,
				`arrangement: ${u.slug} satisfied`
			).toBe('success');
		}
	} finally {
		for (const [k, v] of saved) {
			if (v === undefined) delete process.env[k];
			else process.env[k] = v;
		}
	}

	// The final archive: both stores through SQLite's backup, each a rollback journal; the workspace and its sibling.
	mkdirSync(FINAL, { recursive: true });
	await backupConverted(DB, join(FINAL, 'demo.sqlite'));
	await backupConverted(`${DB}.content.sqlite`, join(FINAL, 'demo.sqlite.content.sqlite'));
	cpSync(ran.workspace, join(FINAL, 'workspace'), { recursive: true });
	cpSync(`${ran.workspace}.process-output`, join(FINAL, 'process-output'), { recursive: true });

	// The lane's own record, as the spec writes it.
	writeFileSync(
		join(LANE, 'boot.json'),
		JSON.stringify({
			startedAt: '2026-10-09T12:00:00.000Z',
			mode: 'paid',
			node: process.version,
			inherited: { JPWB_PHASE7_PRIOR_REVIEWER_CALLS: '6' },
			overlay: { RPH_DEMO_MODE: 'server', JPWB_HARNESS: '1', JPWB_SEED: 'empty', JPWB_DEMO_DB: DB }
		})
	);
	writeFileSync(
		join(LANE, 'posts.jsonl'),
		`${ran.posts.map((p) => JSON.stringify(p)).join('\n')}\n`
	);
	writeFileSync(
		join(LANE, 'run.json'),
		JSON.stringify({
			mode: 'paid',
			units: UNITS.map((u) => ({
				order: u.order,
				slug: u.slug,
				unitId: ran.units.get(u.type.name),
				title: u.type.name,
				archive: `${String(u.order).padStart(2, '0')}-${u.slug}`,
				beginExecute: {
					status: 200,
					envelopeType: ran.envelopes.get(`${u.slug}:beginExecute`)?.type ?? null
				},
				stopped: ran.envelopes.get(`${u.slug}:beginExecute`)?.type === 'failure',
				upstreamNotAssured: u.order > 3,
				limitCheck:
					u.order === 1
						? null
						: { prior: 6, recorded: 0, reserve: 4, total: 10, limit: 200, allowed: true },
				signOff: ran.envelopes.has(`${u.slug}:recordAssurance`)
					? { recordAssurance: 'success' }
					: null
			})),
			end: { reason: 'complete', at: '2026-10-09T13:00:00.000Z' }
		})
	);

	ran.before = digestOf(FINAL);
	ran.cli = runReport(fixture.dir);
	if (existsSync(join(LANE, 'report', 'report.json')))
		ran.report = JSON.parse(readFileSync(join(LANE, 'report', 'report.json'), 'utf8')) as RunReport;
}, 300_000);

afterAll(() => {
	const restore = (name: string, value: string | undefined) => {
		if (value === undefined) delete process.env[name];
		else process.env[name] = value;
	};
	restore('RPH_DEMO_MODE', fixture.saved.mode);
	restore('JPWB_SEED', fixture.saved.seed);
	restore('JPWB_DEMO_DB', fixture.saved.db);
	// ⚠ The live stores stay open in this process, and Windows will not unlink an open file: the lane's copies go, and the
	// OS temp folder is the backstop for the rest.
	for (const dir of [LANE, UNCONVERTED])
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			/* a handle the OS still holds; the temp folder is the backstop */
		}
});

const report = (): RunReport => {
	expect(ran.report, `the CLI wrote no report.json: ${ran.cli.out}`).toBeDefined();
	return ran.report!;
};
const written = (file: string): unknown =>
	JSON.parse(readFileSync(join(LANE, 'report', file), 'utf8'));
const at = (stage: string, row: string) =>
	report().matrix.find((c) => c.stage === stage && c.row === row);
const PHASES = ['requirements', 'design', 'implementation', 'end-to-end'];

describe('JAN-EXEC P7-2 D9 — the run report over stores the product wrote, read by its own command line', () => {
	it('⭐ the CLI reads the final archive and writes the four files, once, exit 0', () => {
		expect(ran.cli.code, ran.cli.out).toBe(0);
		expect(ran.cli.out).toMatch(/read lane\/archive\/06-final; wrote lane\/report\//);
		expect(readdirSync(join(LANE, 'report')).sort()).toEqual([
			'command-manifest.excluded.json',
			'command-manifest.json',
			'report.json',
			'report.md'
		]);
		expect(report().problems).toEqual([]);
	});

	// ⚠ `REG-F-556` — AN EXPLICIT BUDGET, SIZED TO ITS WORK: it hashes every file of the run's archive. Under `gate:fast`'s parallel test step it timed
	// out at vitest's 5 s default, and it passes alone (`REG-F-169`'s safe default: a failure under load that passes
	// alone is a diagnosis). The global default is not raised.
	it('⛔ the archive is byte-identical afterwards: the read-only open wrote nothing beside either store', () => {
		expect(
			Object.keys(ran.before).filter((f) => /-(wal|shm|journal)$/.test(f)),
			'arrangement: the archive held no journal'
		).toEqual([]);
		expect(digestOf(FINAL)).toEqual(ran.before);
	}, 60_000);

	it('⭐ the workspace the report makes paths relative to is the one the product made', () => {
		expect(workspaceDirectoryFor(DB, ran.undertakingId).split('/').join('\\')).toBe(
			ran.workspace.split('/').join('\\')
		);
	});

	it('⭐ the pairing reads the calls each floor run drained — and the design review’s two NO_RESPONSE calls conclude it as no response', () => {
		const rows = (unit: string, kind: string) =>
			report().pairing.rows.filter((r) => r.unit === unit && r.subjectKind === kind);
		expect(rows('requirements', 'work product').map((r) => [r.label, r.calls])).toEqual([
			['answered', ['INITIAL:ACCEPTED']]
		]);
		expect(
			rows('design', 'work product').map((r) => [r.label, r.assessmentState, r.calls])
		).toEqual([['no-response', 'INCONCLUSIVE', ['INITIAL:NO_RESPONSE', 'RETRY:NO_RESPONSE']]]);
		expect(rows('implementation', 'command').map((r) => [r.label, r.assessmentState])).toEqual([
			['answered', 'SATISFIED'],
			['answered', 'REJECTED']
		]);
		expect(report().pairing.counts).toEqual({
			answered: 37,
			'no-criterion-answered': 0,
			'no-response': 1,
			refused: 0,
			'no-answer-recorded': 0,
			'not-pairable': 0
		});
		// ⭐ P7-6 B7 (`REG-F-433`) — EVERY review the product recorded is joined to its calls by its floor run's TOKEN, read
		// from the archived envelopes by the command line itself: never by its subject, which a re-review would make ambiguous.
		expect(
			[...new Set(report().pairing.rows.map((r) => r.joinedBy))],
			'a review the product recorded was not joined by its run’s token'
		).toEqual(['run token']);
		// ⛔ The deterministic policies and the demo sign-off ask no model: listed so, never as "no answer recorded".
		// ⭐ E2 (`REG-D-110` (3)) — ~~and the 7 declared-policy sign-offs~~: each of the 7 declared policies of the three units
		// signed off is REVIEWED now, one call each, so none is listed as asking no model.
		expect(
			Object.fromEntries(
				Object.entries(report().pairing.noModelAnswerByDesign).map(([k, ids]) => [k, ids.length])
			)
		).toEqual({
			'deterministic floor policy': 76,
			'declared-policy sign-off': 0,
			'demo sign-off': 3,
			other: 0
		});
		expect(report().reviewerCalls).toMatchObject({
			// ⭐ E2 — ~~39~~: the floor's 39, and one call for each of the 7 declared reviews.
			recorded: 46,
			noResponse: 2,
			retries: 1,
			repairs: 0
		});
		// ⭐ The count is a lower bound in general; here, where no capture failed, it is every call devin received.
		expect(seam.devin).toHaveLength(report().reviewerCalls.recorded);
	});

	// ⛔⛔ `P76F-C` C6 — A REAL HAND COMPLETION, IN A REAL STORE, AGAIN. `P76F-A` A5 restated this case when the server began
	// refusing the hand Resume of a step awaiting a person's choice: no hand completion then reached any store the product
	// wrote, and PQ7-M156 and PQ7-M168 were held by synthetic rows alone. The operator now reaches one by acts the server
	// still ADMITS — a hand Wait while the phase's review is in flight, so the unit never waited for a person's choice, then
	// a hand Resume and a hand completion naming the one work product — and the audit must find each where the store has it.
	it('⛔ the audit names the hand completion that names ONE output — after a hand Wait and Resume the server admits — and none of Begin & Execute’s own three', () => {
		const acts = report().audit.acts;
		const complete = acts.find((a) => a.act === 'completeStep')!;
		expect(complete.found.map((f) => [f.unit, f.why]), 'no hand completion reached the store').toEqual([
			[
				'implementation',
				expect.stringMatching(
					/^executed by a HUMAN actor, naming 1 output\(s\), without the same-batch execution hop/
				)
			]
		]);
		expect(complete.posted).toBe(1);
		// ⭐ The hand Wait and the hand Resume before it are each FOUND, on the implementation phase — a single-command batch,
		// never the route's own wait (which moves the unit's axis in its batch); the design phase's wait is the route's.
		for (const act of ['enterWaitStep', 'resolveWaitStep'])
			expect(
				acts.find((a) => a.act === act)?.found.map((f) => f.unit),
				`${act} by hand is not found where the store has it`
			).toEqual(['implementation']);
		expect(acts.filter((a) => a.verdict === 'FOUND').map((a) => a.act).sort()).toEqual([
			'completeStep',
			'enterWaitStep',
			'resolveWaitStep'
		]);
		expect(report().audit.forbiddenFound).toBe(1);
		expect(report().audit.expected.map((e) => [e.act, e.count])).toEqual([
			['CreateAssurancePolicy', 1],
			['ActivateAssurancePolicy', 1]
		]);
	});

	// ⭐ `P76F-C` C6 — as before `P76F-A` A5: the hand completion broke the implementation phase's floor (stage 5a), and its
	// unit, whose own execution never SUCCEEDED, is still a stop (stage 7) — the reading PQ7-M168 attacks.
	it('⭐ the matrix reads the run as it went: the stops broke, the 33rd run broke stage 4, the hand completion broke the floor', () => {
		expect(at('1', 'whole run')?.value).toBe('not measured in this half');
		expect(at('2', 'whole run')?.value).toBe('as intended');
		expect([at('7', 'whole run')?.value, at('7', 'whole run')?.registerIds]).toEqual([
			'broke',
			['REG-F-511']
		]);
		expect(PHASES.map((p) => at('7', p)?.value)).toEqual([
			'as intended',
			'broke',
			'broke',
			'as intended'
		]);
		expect([at('4', 'design')?.value, at('4', 'design')?.registerIds]).toEqual([
			'broke',
			['REG-F-499']
		]);
		expect([at('4', 'end-to-end')?.value, at('4', 'end-to-end')?.registerIds]).toEqual([
			'broke',
			['REG-F-517', 'REG-F-521']
		]);
		expect([at('4', 'implementation')?.value, at('4', 'implementation')?.owedTo]).toEqual([
			null,
			'P7-4f, the adjudication table'
		]);
		expect(at('5a', 'implementation')?.value, 'the hand completion did not break the floor').toBe('broke');
		// ⭐⭐ E2 (`REG-F-523`; design B8) — ~~vacuous by construction~~: the declared policies of the two phases signed off were
		// JUDGED, by devin on its seam, and 5b reads each from what it recorded — every criterion answered, each verdict the one
		// its answers give.
		expect(PHASES.map((p) => at('5b', p)?.value)).toEqual([
			'as intended',
			'not reached',
			'not reached',
			'as intended'
		]);
		// ⭐ ONE CRITERION RESULT PER CRITERION OF EACH POLICY (~~0 each~~), the reviewer's verdicts first and a HUMAN's
		// (`pol_fitness_for_purpose`, the operator's, `REG-D-111` (3)) after them, as the batch issues them.
		expect(report().declaredVerdicts.rows.map((d) => [d.unit, d.policyId, d.criterionResults, d.value])).toEqual([
			['requirements', 'pol_requirement_coverage', 6, 'as intended'],
			['requirements', 'pol_intent_preservation', 7, 'as intended'],
			['end-to-end', 'pol_test_adequacy', 8, 'as intended'],
			['end-to-end', 'pol_intent_preservation', 7, 'as intended'],
			['end-to-end', 'pol_fitness_for_purpose', 7, 'as intended'],
			['root', 'pol_intent_preservation', 7, 'as intended'],
			['root', 'pol_fitness_for_purpose', 7, 'as intended']
		]);
		// ⭐ `REG-F-514` — each phase's verdicts name its EXECUTOR as producer; the root's, the operator who ran its step.
		expect([...new Set(report().declaredVerdicts.rows.map((d) => `${d.unit}:${d.producer}`))]).toEqual([
			'requirements:model:fixture-executor-model',
			'end-to-end:model:fixture-executor-model',
			'root:local-professional'
		]);
		// ⭐ Stage 8 over what the product stored: each exchange's asked and answered bytes hash to their records — the
		// design review's two calls that threw included, which got no answer to read.
		for (const p of PHASES) {
			expect(at('8', p)?.value, p).toBe('as intended');
			expect(at('8', p)?.basis[0], p).toMatch(/^([1-9]\d*) of \1 exchange\(s\) can be read/);
		}
		expect(report().answer.brokeUnregistered).toBe(
			report().matrix.filter((c) => c.value === 'broke' && c.registerIds.length === 0).length
		);
	});

	it('⭐ the adjudication row of the REJECTED command review carries what the product recorded: its exit, its faulted criterion', () => {
		const rejected = report().pairing.rows.find(
			(r) =>
				r.unit === 'implementation' &&
				r.subjectKind === 'command' &&
				r.assessmentState === 'REJECTED'
		)!;
		const row = report().adjudication.rows.find((a) => a.assessmentId === rejected.assessmentId);
		expect(row?.groundTruth).toMatchObject({
			kind: 'command',
			argv: ['node', '--test', 'test/unit/marker-reject.test.js'],
			exitCode: 0,
			timedOut: false
		});
		expect(row?.verdict.criteria).toContainEqual({
			criterionId: 'RR-08-evidence-integrity',
			result: 'NOT_MET'
		});
		expect(row?.account?.declared).toBe(true);
	});

	it('⭐ the manifest is one the re-runner accepts: a path inside the workspace made relative, one outside left out, each tree its own archive’s', () => {
		const manifest = written('command-manifest.json') as Parameters<typeof selectUnit>[0];
		expect(manifestProblems(manifest)).toEqual([]);
		expect(
			manifest.commands
				.filter((c) => c.unit === 'implementation')
				.map((c) => [c.ordinal, c.argv, c.evidenceVerdict])
		).toEqual([
			[1, ['node', '--test', 'test/unit/wordfreq.test.js'], 'SATISFIED'],
			[2, ['node', '--test', 'test/unit/marker-reject.test.js'], 'REJECTED']
		]);
		expect(manifest.commands.filter((c) => c.unit === 'end-to-end')).toHaveLength(31);
		const excluded = written('command-manifest.excluded.json') as {
			excluded: { unit: string; ordinal: number; reason: string; argv: string[] }[];
		};
		expect(excluded.excluded.map((e) => [e.unit, e.ordinal, e.reason, e.argv])).toEqual([
			[
				'end-to-end',
				5,
				'argv[2] names an absolute path outside the workspace',
				['node', '--test', '<absolute path outside the workspace>']
			]
		]);
		const archived = join(archiveOf(4, 'implementation'), 'workspace');
		expect(selectUnit(manifest, archived, 'implementation')).toEqual({
			unit: 'implementation',
			treeSha256: workspaceTreeSha256(archived)
		});
	});

	it('⛔ nothing the report wrote names the account or an absolute path — and the archive it read does (REG-F-536)', () => {
		expect(scanTarget(join(LANE, 'report'), accountNames()).hits).toEqual([]);
		// CONTROL: the scan is not blind to this run — its content store holds the workspace's absolute path.
		expect(
			scanTarget(join(FINAL, 'demo.sqlite.content.sqlite'), accountNames()).hits.length
		).toBeGreaterThan(0);
	});

	it('⛔ a store archived in WAL mode is refused, never opened, and its folder is left byte for byte', async () => {
		const archive = join(UNCONVERTED, 'lane', 'archive', '06-final');
		mkdirSync(archive, { recursive: true });
		// The lane's backup, NOT converted: SQLite's backup of a WAL store is itself in WAL mode — and bun's read-only
		// open of a WAL-mode file writes its -shm and -wal beside it, and leaves them (driven 2026-10-09).
		const from = new Database(DB, { readonly: true, fileMustExist: true });
		try {
			await from.backup(join(archive, 'demo.sqlite'));
		} finally {
			from.close();
		}
		const before = digestOf(archive);
		const r = runReport(UNCONVERTED);
		expect(r.code, r.out).toBe(2);
		expect(r.out).toContain(
			'refused, and nothing was opened: lane/archive/06-final/demo.sqlite is in WAL mode, and a read-only open of it could write its -shm and -wal beside it'
		);
		expect(digestOf(archive)).toEqual(before);
		expect(existsSync(join(UNCONVERTED, 'lane', 'report'))).toBe(false);
	});
});
