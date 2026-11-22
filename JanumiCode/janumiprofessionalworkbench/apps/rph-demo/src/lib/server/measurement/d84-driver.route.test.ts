// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.38, as amended 2026-11-21; `REG-D-189`; `REG-F-680`; the
// lead's rulings r1 on `d84/d84-facts.md` §3) — THE MEASUREMENT DRIVER OVER THE NINTH RUN'S CASE, THROUGH THE PAGE'S OWN ACTIONS AND THE STAGE'S OWN PARTS.
//
// ⭑ WHAT MUST HOLD (the sponsor's rulings, `REG-D-189`; the lead's rulings r1):
//   · ONE DEFINITION (T1): at each role's seam in a press of the stage itself, what the driver prepares at that moment is what the stage sends there,
//     byte for byte — the writer's folder and argv, the Hypothesizer's copy, task text and executor, the Historian's folder, configuration, argv and
//     devin's version;
//   · the driver's own call (T2) sends, at each seam, the bytes it showed; the next role is given the earlier one's recorded answer (T13);
//   · the case check (T5): the ninth run's shape admitted, each other shape refused, naming what it found;
//   · the policy (T6, `REG-F-680`; Q2): the copy's narrow Historian policy edited in place to the seed's form, under the person's APPROVAL Decision,
//     in one batch — the Historian's assessment refused before and admitted after; refused where an assessment is held under it;
//   · the approval gate (T7) and the seam (T8): nothing is called without its approval, a byte changed after it, or a byte at the transport that
//     differs, a seam's refusal recorded as the part failing (Q10);
//   · the stop (T9): after the Historian, nothing more — no Unsticking Agent, no re-ask — though the same answer through the stage brings one;
//   · the Hypothesizer's full request (T10; Q1, Q3): its sha256 recorded from the turn's result, its bytes in the copy's content store as every Pi
//     try's are, nothing of them shown or recorded before the call, and written into `after/` only once the call record exists.
// ⭑ THE ARRANGEMENT: the stage's route test's (`execution/assurance-stage.route.test.ts`), its seams byte for byte but two, each named where it is:
// the floor's devin honours a program its caller hands in (the driver's), and D71's re-run in place may be pressed before any stage, as the ninth run's
// page pressed it (`seam.rerunBeforeTheStage`): L17b2's rule did not exist then, and today's page refuses it.
// ⭑ THE DRIVER'S DEPS are the stage's own over the route's store (that test's `onPi`): a FILESYSTEM shared workspace in a temporary folder, Pi's opener
// and devin's program the fakes below. Its steps run as the launcher runs them (`runD84Step`), the route's engine standing for the opened copy: the
// copy's record store a stand-in its read-only reading counts.
// ⛔ HERMETIC: no model, no real devin, Pi or Ollama; PATH finds no program; every program is a fake that runs nothing.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What the seams saw and answer. Hoisted: the mock factories below run before this file's body. */
const seam = vi.hoisted(() => ({
	/** What the floor's devin answers a prompt: undefined, a clean review over its own rubric. */
	review: undefined as undefined | ((prompt: string) => string | undefined),
	/** One in-memory sandbox per Undertaking, held across requests. */
	workspaces: new Map<string, unknown>(),
	/** How many producer sessions the page opened. */
	opens: 0,
	/** What the declared reviewer answers a policy's review: set in `beforeEach`, every criterion MET. */
	answer: (() => {
		throw new Error('arrangement: no declared answer set');
	}) as (policyId: string) => unknown,
	/** ⭐ D84 — set, D71's re-run in place is pressed before any stage, as the ninth run's page pressed it (the rule below says nothing). */
	rerunBeforeTheStage: false,
	/** ⭐ D84 — how many times devin was handed a program by its caller (the driver's), in place of the floor's. */
	passedPrograms: 0
}));

vi.mock('../execution/workspace-host.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../execution/workspace-host.js')>();
	const { createInMemoryWorkspace, createRefusingProcessRunner } = await import('@janumipwb/rph-ports');
	return {
		...actual,
		resolveUndertakingSandbox: vi.fn((undertakingId: string) => {
			if (!seam.workspaces.has(undertakingId))
				seam.workspaces.set(undertakingId, {
					workspace: createInMemoryWorkspace({ ownerKind: 'UNDERTAKING', ownerId: undertakingId, purgeability: 'RETAINED_BY_PARTICIPATION' }),
					outputWorkspace: createInMemoryWorkspace({ ownerKind: 'UNDERTAKING', ownerId: undertakingId, purgeability: 'PURGEABLE_AT_EXPIRY' }),
					runner: createRefusingProcessRunner()
				});
			return seam.workspaces.get(undertakingId);
		})
	};
});

// ⭑ A SCRIPTED PRODUCER OVER THE HOST'S REAL OBSERVER, the stage's route test's: it writes nothing, and answers the execution contract's envelope.
vi.mock('../execution/model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../execution/model.js')>();
	const { createProcessRunObserver } = await import('../tools/process-run-observer.js');
	return {
		...actual,
		getExecutionSession: vi.fn(() => async () => {
			const observer = createProcessRunObserver();
			seam.opens += 1;
			const session = seam.opens;
			return {
				mintedToolNames: [],
				turn: async (text: string) =>
					JSON.stringify({
						workProduct: { document: `ATTEMPT ${session}: ${text.split('\n')[0]}` },
						rationale: { rationale: 'An account.', assumptions: [], limitations: [], residualUncertainty: [] }
					}),
				lastTurnObservation: () => ({ canObserve: false, reason: 'a scripted fixture observes no tool calls' }),
				processRuns: () => observer.observed(),
				dispose: () => undefined,
				retainsHistory: true
			};
		})
	};
});

// ⭑ THE REAL devin ADAPTER FOR THE FLOOR'S REVIEW, ITS PROGRAM REPLACED AT THE SEAM — each prompt answered by the case (`seam.review`), else clean over
// the prompt's own rubric. ⭐ D84 — THIS FILE'S FIRST DEPARTURE FROM THE STAGE'S ROUTE TEST: a program the caller hands in is honoured (that test's
// seam ignores it), so the driver's own programs — its showing's, which copies and runs nothing, and its call's, checked at its seam — are the ones run.
vi.mock('../tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../tools/devin-reviewer.js')>();
	const { writeFile } = await import('node:fs/promises');
	type Program = NonNullable<Parameters<typeof actual.devinPrint>[1]>;
	const floorOf =
		(prompt: string): Program =>
		async (_file, args) => {
			const exportPath = args[args.indexOf('--export') + 1];
			if (exportPath !== undefined) await writeFile(exportPath, JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-assurance-model' } }] }), 'utf8');
			const ids = [...prompt.matchAll(/^- ([A-Za-z0-9_-]+): .* \[if unmet: [A-Z]+\]$/gm)].map((m) => m[1]!);
			return {
				stdout:
					seam.review?.(prompt) ??
					JSON.stringify({ findings: ids.map((id) => ({ criterionId: id, failed: false, statement: 'met' })), recommendation: 'SATISFIED', residualUncertainty: [] })
			};
		};
	return {
		...actual,
		devinPrint: vi.fn(
			(prompt: string, exec?: Program, wait?: Parameters<typeof actual.devinPrint>[2], now?: Parameters<typeof actual.devinPrint>[3]) => {
				if (exec !== undefined) seam.passedPrograms += 1;
				return actual.devinPrint(prompt, exec ?? floorOf(prompt), wait, now);
			}
		)
	};
});

// ⭑ THE DECLARED POLICIES' REVIEWER, STOOD IN FOR AT ITS SEAM: its answer is the case's (`seam.answer`).
vi.mock('../assurance/index.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../assurance/index.js')>();
	return {
		...actual,
		createDeclaredPolicyReviewer: vi.fn(() => ({
			validatorId: 'fixture.declared-policy',
			review: async (_subject: unknown, input: { readonly declaredPolicy?: { readonly policyId: string } }) => seam.answer(input.declaredPolicy?.policyId ?? '')
		}))
	};
});

// ⭑ The product's configured decision model, stood in for by a double that calls no model (package N's route test's).
vi.mock('../assurance/decision-model.js', async (importOriginal) => {
	const { TEST_INDICATIONS } = await import('../assurance/indications.testing.js');
	return { ...(await importOriginal<typeof import('../assurance/decision-model.js')>()), configuredIndications: () => TEST_INDICATIONS };
});

// ⭐ D84 — THIS FILE'S SECOND DEPARTURE: THE NINTH RUN'S PAGE. That run pressed D71's re-run in place before any stage, as its code allowed: L17b2's
// rule (`rerunRefusedByRule`), which refuses a re-run before the round's stage has run, did not exist then. Where a case arranges that run's shape
// (`seam.rerunBeforeTheStage`), the rule says nothing and the page runs the re-run as it did then; passed through otherwise.
vi.mock('../execution/loop-rule.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../execution/loop-rule.js')>();
	return {
		...actual,
		rerunRefusedByRule: vi.fn((...args: Parameters<typeof actual.rerunRefusedByRule>) => (seam.rerunBeforeTheStage ? undefined : actual.rerunRefusedByRule(...args)))
	};
});

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import { getObject, listByType, listPwus } from '@janumipwb/rph-engine';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { actions as undertakings } from '../../../routes/undertakings/+page.server.js';
import { actions as unitPage } from '../../../routes/undertakings/[id]/+page.server.js';
import { assuranceStageOffer, HISTORIAN_POLICY_ID, runAssuranceStage, type AssuranceStageDeps } from '../assurance/assurance-stage.js';
import { STAGE_PART, stageRecordsIn } from '../assurance/assurance-stage-records.js';
import { HELPER_INVOKER } from '../assurance/assurance-stage-roles.js';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
import type { ExecutorSessionPlace, ProducerSession, ProducerSessionContext } from '../execution/producer-session.js';
import { RERUN_REJECTED_WORK } from '../execution/rejected-rerun.js';
import { actingActor } from '../identity.js';
import { devinPrint, type DevinExec } from '../tools/devin-reviewer.js';
import type { HistorianExec } from '../tools/devin-historian.js';
import { createProcessRunObserver } from '../tools/process-run-observer.js';
import { dispatch, dispatchBatch, getArtifactStore, getEngine, mintUiId, resetEngine, uiSession } from '../workbench.js';
import { caseCheck, COMPARED_POLICY_FIELDS, POLICY_PREPARATION_RATIONALE, preparePolicy, seedPolicyForm } from './d84-case.js';
import { copyStoreOf, D84_LAYOUT, readJson, roleFolderOf, writeOnce, type D84Role, type Manifest } from './d84-files.js';
import { nodeMeasurementHost } from './d84-folder.js';
import { callRole, D84_STOPPED, prepareRole, prepareRoleInto, seamedDeps, writeHypothesizerRequest, type CallRecord, type D84Transports, type SeamSeen } from './d84-roles.js';
import { runD84Step, type StepHost } from './d84-steps.js';

const LIVE_BACKEND_VARIABLES = [
	'JPWB_ASSURANCE_TOOL',
	'JPWB_ASSURANCE_MODEL',
	'JPWB_JUDGE_MODEL',
	'JPWB_EXECUTOR',
	'JPWB_EXECUTOR_MODEL',
	'JPWB_AGENT',
	'JPWB_DEVIN_BIN',
	'JPWB_AGY_BIN',
	'JPWB_D84_PAID'
] as const;

const RISK = {
	'risk.consequence': 'HIGH',
	'risk.uncertainty': 'MEDIUM',
	'risk.irreversibility': 'LOW',
	'risk.securitySensitivity': 'LOW',
	'risk.regulatoryExposure': 'NONE'
};

type ActionEvent = Parameters<typeof undertakings.create>[0];
const event = (path: string, action: string, fields: Readonly<Record<string, string>>, id?: string): ActionEvent => {
	const form = new FormData();
	for (const [k, v] of Object.entries(fields)) form.set(k, v);
	return {
		request: new Request(`http://localhost${path}?/${action}`, { method: 'POST', body: form }),
		params: id === undefined ? {} : { id }
	} as unknown as ActionEvent;
};

/** One type of the fixture PWA: its name, its children by name, what it requires and produces, who discharges it, and its policies. */
interface FixtureType {
	readonly name: string;
	readonly isRoot?: boolean;
	readonly children?: readonly string[];
	readonly inputs?: readonly string[];
	readonly outputs?: readonly string[];
	readonly model?: boolean;
	readonly policies?: readonly string[];
	readonly kind?: string;
}

/** A PWA of `types`, authored and published through the commands, then an Undertaking of it created through the portfolio's own action. */
async function instantiated(types: readonly FixtureType[]): Promise<{
	readonly undertakingId: string;
	readonly unitOf: (title: string) => { readonly id: string; readonly state: Record<string, unknown> };
}> {
	const pwaId = mintUiId('pwa');
	const idOf = new Map(types.map((t) => [t.name, mintUiId('pwut')]));
	const r = (commandType: string, aggregateType: string, aggregateId: string, payload: unknown): void => {
		const result = dispatch(commandType, aggregateType, aggregateId, payload);
		expect(result.status, `arrangement: ${commandType} — ${result.error?.message ?? ''}`).toBe('ACCEPTED');
	};
	r('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
		pwaId,
		name: 'Criteria and Rework PWA',
		description: 'A PWA whose types declare the policies their sign-off reviews.',
		domain: 'software product',
		version: '0.1.0'
	});
	for (const t of [...types].reverse())
		r('DefinePwuType', 'PWU_TYPE', idOf.get(t.name)!, {
			pwuTypeId: idOf.get(t.name)!,
			pwaId,
			pwuKind: t.kind ?? t.name.toUpperCase().replaceAll(/[^A-Z]/g, '_'),
			name: t.name,
			purpose: `Do the ${t.name}`,
			isRoot: t.isRoot === true,
			permittedChildTypeIds: (t.children ?? []).map((c) => idOf.get(c)!),
			requiredInputs: [...(t.inputs ?? [])],
			requiredOutputs: [...(t.outputs ?? [])],
			requiredAssurancePolicyIds: [...(t.policies ?? [])],
			workDischarge: t.model === true ? 'MODEL' : 'HUMAN',
			...(t.model === true
				? { promptTemplate: { templateText: 'Write the {subject}.', templateVersion: 1, declaredPlaceholders: ['subject'], status: 'ACTIVE' } }
				: {})
		});
	r('SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {});
	r('ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {});
	r('PublishPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, { rootPwuTypeId: idOf.get(types.find((t) => t.isRoot === true)!.name)! });
	const created = (await undertakings.create(event('/undertakings', 'create', { name: 'Criteria and Rework', pwaId, ...RISK }))) as {
		created?: string;
		data?: { error?: string };
	};
	expect(created.created, `arrangement: the Undertaking — ${created.data?.error ?? ''}`).toBeDefined();
	const undertakingId = created.created!;
	return {
		undertakingId,
		unitOf: (title) => {
			const u = listPwus(getEngine(), undertakingId).find((p) => p.state.title === title);
			if (u === undefined) throw new Error(`arrangement: no unit titled ${title}`);
			return { id: u.id, state: u.state as Record<string, unknown> };
		}
	};
}

type Fixture = Awaited<ReturnType<typeof instantiated>>;

/** A page action on the fixture's Undertaking, as the page posts it: its refusal, if any. */
async function press(u: Fixture, action: string, fields: Readonly<Record<string, string>>): Promise<{ readonly error?: string }> {
	const act = (unitPage as Record<string, ((e: never) => Promise<unknown>) | undefined>)[action];
	if (act === undefined) return { error: `the page has no action ${action}` };
	const r = (await act(event(`/undertakings/${u.undertakingId}`, action, fields, u.undertakingId) as never)) as { data?: { error?: string } } | undefined;
	return r?.data?.error === undefined ? {} : { error: r.data.error };
}

/** The stored policy's criteria, as the sign-off's reader reads them. */
const policyOf = (id: string) => getObject(getEngine(), id) as unknown as { criteria: { id: string }[] };

/** A declared review's answer: each of the policy's criteria with `outcomes[i]` (MET where none is said). */
function answerOf(policyId: string, outcomes: Readonly<Record<number, readonly [string, string]>> = {}, blocking?: string): unknown {
	const criteria = policyOf(policyId).criteria.map((c, i) => {
		const [outcome, rationale] = outcomes[i] ?? ['MET', 'met'];
		return { criterionId: c.id, outcome, mandatory: false, rationale };
	});
	return {
		policyId,
		validatorId: 'fixture.declared-policy',
		evaluator: { actorType: 'AGENT', agentId: 'fixture-declared-reviewer', modelId: 'fixture-declared-model', providerId: 'fixture-provider' },
		criteria,
		observations: blocking === undefined ? [] : [{ code: blocking, severity: 'BLOCKING', statement: `${blocking} blocks.`, open: true }],
		recommendation: blocking === undefined ? 'SATISFIED' : 'REJECTED',
		residualUncertainty: [],
		limitations: []
	};
}

const axesOf = (pwuId: string) => {
	const s = getObject(getEngine(), pwuId) ?? {};
	return [s.workLifecycleState, s.executionState, s.assuranceState];
};
/** The latest declared verdict of each policy over the unit, by policy: its assessment id and state. */
const verdictsOf = (pwuId: string, policyIds: readonly string[]) =>
	policyIds.map((policyId) => {
		const mine = listByType(getEngine(), 'ASSURANCE_ASSESSMENT').filter(
			(a) => a.state.assurancePolicyId === policyId && ((a.state.subjectObjectIds as string[] | undefined) ?? []).includes(pwuId)
		);
		const last = mine.at(-1);
		return { policyId, assessmentId: last?.id ?? '', state: String(last?.state.assessmentState ?? '') };
	});

/** Begin & Execute, Record Assurance (every criterion MET), then Mark Satisfied on `title`: the unit SATISFIED. */
async function accept(u: Fixture, title: string): Promise<void> {
	const pwuId = u.unitOf(title).id;
	for (const action of ['beginExecute', 'recordAssurance', 'markSatisfied'] as const)
		expect((await press(u, action, { pwuId })).error, `arrangement: ${action} on ${title}`).toBeUndefined();
	expect(getObject(getEngine(), pwuId)?.workLifecycleState, `arrangement: ${title} accepted`).toBe('SATISFIED');
}

/** Two declared policies the reference seed holds, each governing REQUIREMENT_DEFINITION — the two that reject Verification. */
const COVERAGE = 'pol_requirement_coverage';
const INTENT = 'pol_intent_preservation';

/** The ninth run's shape, smaller, as the stage's route test builds it: Verification needs Build's work and declares the two policies that reject it. */
const TYPES: readonly FixtureType[] = [
	{ name: 'Product', isRoot: true, children: ['Specification', 'Build', 'Verification', 'Docs'], inputs: ['originating-intent'] },
	{ name: 'Specification', inputs: ['originating-intent'], outputs: ['specification'], model: true },
	{ name: 'Build', children: ['Source', 'Tests', 'Lint'], outputs: ['build'], model: true },
	{ name: 'Source', inputs: ['specification'], outputs: ['source'], model: true },
	{ name: 'Tests', inputs: ['source'], outputs: ['tests'], model: true },
	{ name: 'Lint', inputs: ['specification'], outputs: ['lint'], model: true },
	{ name: 'Verification', inputs: ['build'], outputs: ['verdict'], model: true, policies: [COVERAGE, INTENT], kind: 'REQUIREMENT_DEFINITION' },
	{ name: 'Docs', inputs: ['specification'], outputs: ['docs'], model: true }
];

/** Both declared reviews of Verification rejecting it: each its first criterion NOT_MET and a BLOCKING finding open. */
function rejectingAnswers(): void {
	const cov = policyOf(COVERAGE).criteria.map((c) => c.id);
	const intent = policyOf(INTENT).criteria.map((c) => c.id);
	seam.answer = (policyId) =>
		policyId === COVERAGE
			? answerOf(COVERAGE, { 0: ['NOT_MET', 'The standard-input mode exits 1: the reader Source wrote cannot read a pipe.'] }, cov[0])
			: answerOf(INTENT, { 0: ['NOT_MET', 'A documented usage does not work.'] }, intent[0]);
}

/** Record Assurance on Verification, its declared reviews answering as `seam.answer` does; then every review clean again. */
async function signOff(u: Fixture, pwuId: string, rejecting: boolean): Promise<void> {
	if (rejecting) rejectingAnswers();
	const signed = await press(u, 'recordAssurance', { pwuId });
	seam.answer = (policyId) => answerOf(policyId);
	if (rejecting)
		expect(signed.error ?? '', 'arrangement: the declared reviews rejected Verification').toContain(
			"Assurance recorded, and the declared review did not conclude in this PWU's favour"
		);
	else expect(signed.error, 'arrangement: the declared reviews accepted Verification').toBeUndefined();
}

/** Every unit but the root accepted, then Verification run and REJECTED at its sign-off by both its declared reviews. */
async function verificationRejected() {
	const u = await instantiated(TYPES);
	for (const title of ['Specification', 'Source', 'Tests', 'Lint', 'Build', 'Docs']) await accept(u, title);
	const verification = u.unitOf('Verification').id;
	expect((await press(u, 'beginExecute', { pwuId: verification })).error, 'arrangement: Verification ran').toBeUndefined();
	await signOff(u, verification, true);
	expect(axesOf(verification), 'arrangement: Verification rejected at its sign-off').toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);
	return { u, ids: { verification, source: u.unitOf('Source').id }, first: verdictsOf(verification, [COVERAGE, INTENT]) };
}

/** The person's words for D71's re-run, as the ninth run's operator typed a rationale. */
const RERUN_WORDS = 'The verification’s reviews found the standard-input mode fails; re-run its work with their findings.';

/** D71's re-run in place pressed on Verification before any stage, as the ninth run's page pressed it. */
async function rerunBeforeTheStage(r: Awaited<ReturnType<typeof verificationRejected>>): Promise<void> {
	seam.rerunBeforeTheStage = true;
	try {
		expect((await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: RERUN_WORDS })).error, 'arrangement: D71’s re-run in place').toBeUndefined();
	} finally {
		seam.rerunBeforeTheStage = false;
	}
}

/**
 * ⭐ D84 — THE NINTH RUN'S CASE: Verification rejected at its sign-off by both its declared reviews, re-run in place by D71 before any stage, and rejected
 * again at its second sign-off — no stage record for the Undertaking. `second` false accepts it at the second sign-off instead.
 */
async function ninthRunCase(o: { readonly second?: boolean } = {}) {
	const r = await verificationRejected();
	await rerunBeforeTheStage(r);
	await signOff(r.u, r.ids.verification, o.second !== false);
	return { ...r, second: verdictsOf(r.ids.verification, [COVERAGE, INTENT]) };
}

/** The page's batch, as a direct call of the stage is handed it: one atomic dispatch, its refusal said. */
const runStepsHere = (steps: readonly (readonly [string, string, string, Record<string, unknown>])[]): string | null => {
	const batch = dispatchBatch(steps.map(([commandType, targetAggregateType, targetAggregateId, payload]) => ({ commandType, targetAggregateType, targetAggregateId, payload })));
	return batch.ok ? null : String(batch.results[batch.failedIndex ?? 0]?.error?.message ?? 'REJECTED');
};

const NOW = '2026-11-21T12:00:00.000Z';
const VERSION = 'devin 3000.11.234 (92c83011d113)';
const TMP = mkdtempSync(join(tmpdir(), 'jpwb-d84-driver-'));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));
const fresh = (name: string): string => mkdtempSync(join(TMP, `${name}-`));

/** Every file under `root`, by its `/`-separated path, with its bytes: this test's own reading, never the driver's. */
function tree(root: string): Map<string, Buffer> {
	const out = new Map<string, Buffer>();
	const walk = (dir: string): void => {
		for (const name of readdirSync(dir)) {
			const at = join(dir, name);
			if (lstatSync(at).isDirectory()) walk(at);
			else out.set(relative(root, at).split(sep).join('/'), readFileSync(at));
		}
	};
	if (existsSync(root)) walk(root);
	return out;
}
const sha256 = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
/** A manifest as D84 writes one, restated: each file's path, bytes and sha256, in code-unit order, and the sha256 of those entries' JSON. */
function manifestOfTree(files: ReadonlyMap<string, Buffer>): Manifest {
	const entries = [...files.entries()]
		.map(([path, bytes]) => ({ path, kind: 'file' as const, bytes: bytes.length, sha256: sha256(bytes) }))
		.sort((a, b) => Number(a.path > b.path) - Number(a.path < b.path));
	return { entries, sha256: sha256(JSON.stringify(entries)) };
}
/** `files` under `prefix`, the prefix taken off. */
const under = (files: ReadonlyMap<string, Buffer>, prefix: string): Map<string, Buffer> =>
	new Map([...files.entries()].filter(([p]) => p.startsWith(prefix)).map(([p, b]) => [p.slice(prefix.length), b]));
/** Two file sets, as hex per path, for one comparison whose difference names the path. */
const hexOf = (files: ReadonlyMap<string, Buffer>): Record<string, string> => Object.fromEntries([...files.entries()].map(([p, b]) => [p, b.toString('hex')]));
/** `args` with each folder's path held, longest first. */
const held = (args: readonly string[], paths: readonly (readonly [string, string])[]): string[] =>
	args.map((a) => [...paths].sort((x, y) => y[0].length - x[0].length).reduce((s, [path, hold]) => s.split(path).join(hold), a));
const flagOf = (args: readonly string[], flag: string): string => args[args.indexOf(flag) + 1] ?? '';

/** The writer's prompt's opening (`narrativeChapterPrompt`), restated. */
const WRITER_PROMPT = 'You are writing chapter';
/** The narrative writer, answering the chapter's form: one statement per record it was given, citing it. */
const chapterAnswering = (prompt: string): string => {
	const ids = [...prompt.matchAll(/^- \[([^\]]+)\] /gm)].map((m) => m[1]!);
	return JSON.stringify({
		chapter: 1,
		covers: ids,
		statements: ids.map((id) => ({ text: `The record ${id} stands as it was given.`, cites: [id] })),
		openItems: [],
		knownOmissions: [],
		previousChapter: null
	});
};
const diagnosisNaming = (unitId: string): string =>
	JSON.stringify({
		hypotheses: [
			{
				candidate: unitId,
				statement: 'Source’s reader treats a pipe as a file.',
				evidence: ['src/reader.ts'],
				checks: [{ command: ['node', 'bin/wf.js', '-'], why: 'reads a pipe', ifHeld: 'exit 1', showed: 'exit 1' }]
			}
		],
		named: unitId,
		confidence: 'fairly sure',
		guidance: 'Build the reader in parts and check each against a pipe before the whole.'
	});
const STEP_BACK = JSON.stringify({
	questions: [{ reconsider: 'the reader', question: 'What does the reader assume about its input that a pipe does not give?' }],
	facts: [{ fact: 'The reader calls fstat before it reads.', source: 'src/reader.ts' }]
});
/** The Historian's answer, recording a recurrence of the round's failure: its RESHAPE recommended (the stage's route test's). */
const recurringHistorian = (roundId: string): string =>
	JSON.stringify({
		findings: ['HC-01', 'HC-02', 'HC-03', 'HC-04', 'HC-05'].map((id) => ({
			criterionId: id,
			failed: id === 'HC-02',
			statement: id === 'HC-02' ? 'The standard-input failure of the round before comes back.' : 'met'
		})),
		recommendation: 'REJECTED',
		residualUncertainty: [],
		recurrence: { recurs: true, statement: 'The standard-input failure of the round comes back.', earlierRecords: [roundId] },
		recommendedControlAction: { action: 'RESHAPE_PWU', reason: 'Build the reader in parts, each checked against a pipe.' }
	});
/** ⭐ D84 — the mark the fake Pi puts in its full request, the composite it assembles at its send: nowhere else in this file's answers. */
const REQUEST_MARK = 'D84-FIXTURE-COMPOSITE: the system prompt, tools and history Pi assembles at its send';

/**
 * The stage's deps over the route's store, on Pi's selection (the stage's route test's `onPi`): the shared workspace a FILESYSTEM one in a temporary
 * folder, holding the reader the case's Source wrote; a sessions root beside it; `o`, the seams a case hands in.
 */
function driverDeps(o: Partial<AssuranceStageDeps> = {}): { readonly deps: AssuranceStageDeps; readonly shared: string } {
	const root = fresh('case');
	const dir = join(root, 'demo.sqlite.workspaces', 'und-0123456789abcdef');
	mkdirSync(join(dir, 'src'), { recursive: true });
	writeFileSync(join(dir, 'src', 'reader.ts'), 'export const read = () => "";\n');
	const shared = createFilesystemWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und', purgeability: 'RETAINED_BY_PARTICIPATION', directoryPath: dir });
	const deps: AssuranceStageDeps = {
		engine: getEngine(),
		store: getArtifactStore(),
		tenantPrefix: 'tnt-local',
		newId: mintUiId,
		now: () => NOW,
		runSteps: runStepsHere,
		dispatchExchange: (payload: RecordModelExchangePayload, aggregateId: string) => dispatch('RecordModelExchange', 'MODEL_EXCHANGE', aggregateId, payload),
		testMode: true,
		executor: { kind: 'PI', modelId: 'faux/model' } as unknown as AssuranceStageDeps['executor'],
		sandboxOf: () => ({ workspace: shared }) as never,
		sessionsRoot: join(root, 'demo.sqlite.sessions'),
		...o
	};
	return { deps, shared: dir };
}

/** What one devin call was sent, read by this test: its program's argv (folders held), its folder's files, and its user configuration. */
interface DevinSent {
	readonly argv: { readonly program: string; readonly args: readonly string[]; readonly timeout: number; readonly maxBuffer: number; readonly windowsHide: boolean };
	readonly folder: Map<string, Buffer>;
	readonly userConfig?: Buffer;
}
/** What devin is sent at a call: the writer's, its folder held; the Historian's, its host and its folder held, and its user configuration. */
function devinSent(file: string, args: readonly string[], options: { readonly cwd: string; readonly timeout: number; readonly maxBuffer: number; readonly windowsHide: boolean }): DevinSent {
	const historian = args.includes('--config');
	const folder = options.cwd;
	const paths: (readonly [string, string])[] = historian ? [[`${folder}.host`, '<host>'], [folder, '<folder>']] : [[folder, '<folder>']];
	return {
		argv: { program: file, args: held(args, paths), timeout: options.timeout, maxBuffer: options.maxBuffer, windowsHide: options.windowsHide },
		folder: tree(folder),
		...(historian ? { userConfig: readFileSync(flagOf(args, '--config')) } : {})
	};
}
/** What Pi is sent at a turn, read by this test: the copy it is opened in, the turn's text, its model and its session's place. */
interface PiSent {
	readonly copy: Map<string, Buffer>;
	readonly text: string;
	readonly modelId: string;
	readonly place: string;
}

/** A scripted Pi session answering the Hypothesizer `diagnosis` and the Unsticking Agent `STEP_BACK`, each turn kept as `seen` reads it. */
function scriptedPi(diagnosis: string, seen: PiSent[], requests: string[]): D84Transports['openPi'] {
	return async (context: ProducerSessionContext, modelId: string, place: ExecutorSessionPlace): Promise<ProducerSession> => ({
		retainsHistory: true,
		mintedToolNames: [],
		turn: async (text: string) => {
			seen.push({ copy: tree(context.workspace.directoryPath ?? ''), text, modelId, place: place.kind });
			const answer = text.includes('You are the Hypothesizer') ? diagnosis : STEP_BACK;
			const materializedInput = JSON.stringify({ system: REQUEST_MARK, tools: ['write_file', 'run_command'], messages: [{ role: 'user', content: text }] });
			requests.push(materializedInput);
			return {
				answer: { arrived: true as const, text: answer },
				rawOutput: answer,
				producer: { agentId: 'assurance-stage.hypothesizer', modelId, providerId: 'faux' },
				identityEvidence: 'PROVIDER_REPORTED' as const,
				observedToolCalls: { canObserve: false as const, reason: 'a scripted fixture observes no tool calls' },
				materializedInput
			};
		},
		lastTurnObservation: () => ({ canObserve: false, reason: 'a scripted fixture observes no tool calls' }),
		processRuns: () => createProcessRunObserver().observed(),
		dispose: () => undefined
	});
}

/** ⭐ D84 — the driver's programs, faked: devin answering the writer's chapter and the Historian's `historian`; Pi, `diagnosis`; each call kept. */
function fakeTransports(o: { readonly historian: () => string; readonly diagnosis: string }) {
	// ⭐ r2 (`D84R-B01`) — and each opening of Pi counted (`opens`), apart from its turns (`pi`): a session opened and never turned is seen.
	const sent = { writer: [] as DevinSent[], historian: [] as DevinSent[], pi: [] as PiSent[], requests: [] as string[], versions: 0, opens: 0 };
	const devinExec: DevinExec = async (file, args, options) => {
		const call = devinSent(file, args, options);
		const historian = call.userConfig !== undefined;
		(historian ? sent.historian : sent.writer).push(call);
		if (historian) {
			writeFileSync(flagOf(args, '--export'), JSON.stringify({ schema_version: 'ATIF-v1.7', steps: [] }));
			return { stdout: o.historian() };
		}
		writeFileSync(flagOf(args, '--export'), JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-assurance-model' } }] }));
		return { stdout: chapterAnswering(readFileSync(flagOf(args, '--prompt-file'), 'utf8')) };
	};
	const transports: D84Transports = {
		devinExec,
		openPi: async (context, modelId, place) => {
			sent.opens += 1;
			return scriptedPi(o.diagnosis, sent.pi, sent.requests)(context, modelId, place);
		},
		devinVersion: async () => {
			sent.versions += 1;
			return VERSION;
		}
	};
	return { sent, transports, calls: () => sent.writer.length + sent.historian.length + sent.pi.length };
}

/**
 * ⭐ D84 — A MEASUREMENT FOLDER FOR THE ROUTE'S CASE, as the begin and copy steps leave one, its record naming the unit — save that the route's engine is
 * in memory: the copy's record store is a stand-in its read-only reading counts (no event, no outbox), and the deps the steps open are the route's.
 */
function measurementFolderFor(unitId: string): string {
	const folder = fresh('m');
	writeOnce(join(folder, D84_LAYOUT.state), { begunAt: NOW, checkoutHead: 'fixture', source: 'the route’s engine', unitId, earlierFolders: [] });
	mkdirSync(join(folder, D84_LAYOUT.copy));
	const db = new DatabaseSync(copyStoreOf(folder));
	db.exec('CREATE TABLE domain_events (id TEXT); CREATE TABLE outbox_messages (status TEXT);');
	db.close();
	writeOnce(join(folder, D84_LAYOUT.copyManifest), { source: 'the route’s engine', unitId, undertakingId: '', files: [], checks: [] });
	return folder;
}
/** The launcher's environment for one step over `folder`, as the server is launched over the copy. */
const stepEnv = (folder: string, step: string, more: Readonly<Record<string, string>> = {}): Record<string, string> => ({
	RPH_DEMO_MODE: 'server',
	JPWB_DEMO_DB: copyStoreOf(folder),
	JPWB_D84_FOLDER: folder,
	JPWB_D84_STEP: step,
	...more
});
/** The step host over the route's deps and the fake programs. */
const hostOver = (deps: AssuranceStageDeps, transports: D84Transports): StepHost => ({
	deps: () => deps,
	transports,
	probeExec: async () => {
		throw new Error('arrangement: this file runs no probe');
	},
	childrenOf: async () => [],
	folderHost: nodeMeasurementHost(),
	now: () => NOW,
	checkoutHead: () => 'fixture'
});
/** One step of the measurement over `folder`, as the launcher runs it. */
const stepper = (folder: string, host: StepHost) => (step: string, more: Readonly<Record<string, string>> = {}) => runD84Step(stepEnv(folder, step, more), host);
/** A role's shown manifest. */
const shownOf = (folder: string, role: D84Role): Manifest => readJson<Manifest>(join(roleFolderOf(folder, role), D84_LAYOUT.manifest))!;
/** A role prepared, approved by its shown manifest's sha256, and called with the flag set, each step held. */
async function prepareApproveCall(step: ReturnType<typeof stepper>, folder: string, role: D84Role): Promise<void> {
	const shown = await step('prepare', { JPWB_D84_ROLE: role });
	expect(shown.ok, `arrangement: the ${role} is shown — ${shown.said.join('\n')}`).toBe(true);
	await approveCall(step, folder, role);
}
/** A role shown already, approved by its shown manifest's sha256, and called with the flag set, each step held. */
async function approveCall(step: ReturnType<typeof stepper>, folder: string, role: D84Role): Promise<void> {
	const approved = await step('approve', { JPWB_D84_ROLE: role, JPWB_D84_MANIFEST_SHA256: shownOf(folder, role).sha256, JPWB_D84_WORDS: 'Approved as shown.' });
	expect(approved.ok, `arrangement: the ${role} is approved — ${approved.said.join('\n')}`).toBe(true);
	const called = await step('call', { JPWB_D84_ROLE: role, JPWB_D84_PAID: '1' });
	expect(called.ok, `arrangement: the ${role} is called — ${called.said.join('\n')}`).toBe(true);
}
/** Every file under the measurement folder whose bytes hold `mark`, by its path. */
const holding = (folder: string, mark: string): string[] =>
	[...tree(folder).entries()].filter(([, bytes]) => bytes.includes(mark)).map(([path]) => path);

beforeEach(() => {
	resetEngine('reference');
	seam.review = undefined;
	seam.workspaces.clear();
	seam.opens = 0;
	seam.rerunBeforeTheStage = false;
	seam.passedPrograms = 0;
	seam.answer = (policyId) => answerOf(policyId);
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
	vi.stubEnv('JPWB_HISTORIAN_CALL_MS', '600000');
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe('⭐⭐ D84 (T1) — one definition: what the driver prepares at each role’s seam is what the stage sends there', () => {
	it('⛔ RED FIRST — at each seam of a press of the stage itself, the driver’s preparation, made at that moment, is the bytes the stage sends: the writer’s folder and argv; the Hypothesizer’s copy, task text and executor; the Historian’s folder, user configuration, argv and devin’s version — each manifest the sha256 of what it shows; ⭑ CONTROL (T9): that press, its Historian recording a recurrence, runs the Unsticking Agent', async () => {
		const c = await ninthRunCase();
		const offer = assuranceStageOffer(getEngine(), c.ids.verification);
		if ('refusedBecause' in offer) throw new Error(`arrangement: the stage is offered — ${offer.refusedBecause}`);
		const at = { unitId: c.ids.verification, roundId: offer.roundId };
		const version = async () => VERSION;
		const seen: Partial<Record<D84Role, { readonly prepared: Awaited<ReturnType<typeof prepareRoleInto>>; readonly shown: Map<string, Buffer>; readonly sent: unknown }>> = {};
		const pis: PiSent[] = [];
		const requests: string[] = [];
		// ⭑ The driver's preparation, at the moment a seam is reached, over the very deps the stage is pressed with (`deps`, below: each seam runs only
		// once the press has begun).
		const preparedAt = async (role: D84Role) => {
			const into = fresh(`t1-${role}`);
			return { prepared: await prepareRoleInto(role, deps, at, into, version), shown: tree(into) };
		};
		const pi = scriptedPi(diagnosisNaming(c.ids.source), pis, requests);
		const historianExec: HistorianExec = async (file, args, options) => {
			const sent = devinSent(file, args, options);
			seen.historian = { ...(await preparedAt('historian')), sent };
			writeFileSync(flagOf(args, '--export'), JSON.stringify({ schema_version: 'ATIF-v1.7', steps: [] }));
			return { stdout: recurringHistorian(at.roundId) };
		};
		const deps: AssuranceStageDeps = driverDeps({
			writerPrint: (prompt: string) =>
				devinPrint(prompt, async (file, args, options) => {
					const sent = devinSent(file, args, options);
					seen.writer = { ...(await preparedAt('writer')), sent };
					writeFileSync(flagOf(args, '--export'), JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-assurance-model' } }] }));
					return { stdout: chapterAnswering(readFileSync(flagOf(args, '--prompt-file'), 'utf8')) };
				}),
			openPi: async (context, modelId, place) => {
				const session = await pi(context, modelId, place);
				return {
					...session,
					turn: async (text: string) => {
						if (text.includes('You are the Hypothesizer'))
							seen.hypothesizer = {
								...(await preparedAt('hypothesizer')),
								sent: { copy: tree(context.workspace.directoryPath ?? ''), text, modelId, place: place.kind }
							};
						return session.turn(text);
					}
				};
			},
			historianExec,
			historianVersionOf: version
		}).deps;

		const done = await runAssuranceStage(c.ids.verification, deps);

		expect.soft('parts' in done && done.parts.map((p) => [p.part, p.status]), '⭑ CONTROL (T9): the stage’s own press did not run its parts, the Unsticking Agent brought by the Historian’s recurrence last').toEqual([
			[STAGE_PART.CHAPTER, 'recorded'],
			[STAGE_PART.DIAGNOSIS, 'recorded'],
			[STAGE_PART.HISTORIAN, 'recorded'],
			[STAGE_PART.STEP_BACK, 'recorded']
		]);
		// ── The writer: the folder devin starts in, every file byte for byte, and its program's argv; the manifest, what was shown.
		const writer = seen.writer;
		expect(writer, 'the stage never reached the writer’s seam').toBeDefined();
		if (writer === undefined || 'refusedBecause' in writer.prepared) throw new Error(`the driver could not prepare the writer: ${JSON.stringify(writer?.prepared)}`);
		const writerSent = writer.sent as DevinSent;
		expect(hexOf(new Map([...writer.shown].filter(([p]) => p !== 'argv.json'))), 'the writer’s shown folder is not, byte for byte, the folder the stage’s devin starts in').toEqual(hexOf(writerSent.folder));
		expect(JSON.parse(writer.shown.get('argv.json')?.toString('utf8') ?? 'null'), 'the writer’s shown argv is not the stage’s').toEqual(writerSent.argv);
		expect(writer.prepared.manifest, 'the writer’s manifest is not the sha256 of what it shows').toEqual(manifestOfTree(writer.shown));
		// ── The Hypothesizer: its copy byte for byte, its task text, its model and its session's place.
		const hypothesizer = seen.hypothesizer;
		expect(hypothesizer, 'the stage never reached the Hypothesizer’s turn').toBeDefined();
		if (hypothesizer === undefined || 'refusedBecause' in hypothesizer.prepared) throw new Error(`the driver could not prepare the Hypothesizer: ${JSON.stringify(hypothesizer?.prepared)}`);
		const piSent = hypothesizer.sent as PiSent;
		expect(hexOf(under(hypothesizer.shown, 'copy/')), 'the Hypothesizer’s shown copy is not, byte for byte, the copy the stage opens Pi in').toEqual(hexOf(piSent.copy));
		expect([...piSent.copy.keys()].filter((p) => p.startsWith('.jpwb/record/')).length, 'arrangement: the copy holds the recorded conversations it is given').toBeGreaterThan(0);
		expect(hypothesizer.shown.get('task.txt')?.toString('utf8'), 'the Hypothesizer’s shown task text is not the turn the stage sends').toBe(piSent.text);
		const executor = JSON.parse(hypothesizer.shown.get('executor.json')?.toString('utf8') ?? '{}') as { modelId?: unknown; session?: unknown };
		expect([executor.modelId, String(executor.session).includes('durable')], 'the Hypothesizer’s shown executor is not the model and the place the stage opens Pi with').toEqual([
			piSent.modelId,
			piSent.place === 'DURABLE'
		]);
		expect([...hypothesizer.shown.keys()].filter((p) => !p.startsWith('copy/')).sort(), 'the Hypothesizer is shown more, or less, than its copy, its task text and its executor').toEqual([
			'executor.json',
			'task.txt'
		]);
		expect(hypothesizer.prepared.manifest, 'the Hypothesizer’s manifest is not the sha256 of what it shows').toEqual(manifestOfTree(hypothesizer.shown));
		// ── The Historian: its folder byte for byte, its user configuration, its argv and the version devin reported.
		const historian = seen.historian;
		expect(historian, 'the stage never reached the Historian’s seam').toBeDefined();
		if (historian === undefined || 'refusedBecause' in historian.prepared) throw new Error(`the driver could not prepare the Historian: ${JSON.stringify(historian?.prepared)}`);
		const historianSent = historian.sent as DevinSent;
		expect(hexOf(under(historian.shown, 'folder/')), 'the Historian’s shown folder is not, byte for byte, the folder the stage’s devin starts in').toEqual(hexOf(historianSent.folder));
		expect(historian.shown.get('host/config.json')?.toString('hex'), 'the Historian’s shown user configuration is not the one the stage’s devin is given').toBe(
			historianSent.userConfig?.toString('hex')
		);
		expect(JSON.parse(historian.shown.get('argv.json')?.toString('utf8') ?? 'null'), 'the Historian’s shown argv is not the stage’s').toEqual(historianSent.argv);
		expect(historian.shown.get('devin-version.txt')?.toString('utf8'), 'the Historian’s shown version is not the one devin reported').toBe(VERSION);
		expect(historian.prepared.manifest, 'the Historian’s manifest is not the sha256 of what it shows').toEqual(manifestOfTree(historian.shown));
	});
});

describe('⭐⭐ D84 (T2, T13, T9, T10) — the driver’s steps over the ninth run’s case: each role shown, approved and called, the next given the earlier’s answer, then the stop', () => {
	it('⛔ RED FIRST — T2: each call sends, at its seam, the bytes its role showed; T13: the Hypothesizer is shown the writer’s recorded chapter, the Historian the Hypothesizer’s diagnosis, and neither is shown before the role before it is called', async () => {
		const c = await ninthRunCase();
		const { deps } = driverDeps();
		const folder = measurementFolderFor(c.ids.verification);
		const fake = fakeTransports({ historian: () => recurringHistorian(String(readJson<{ reading: { roundId: string } }>(join(folder, D84_LAYOUT.case))?.reading.roundId)), diagnosis: diagnosisNaming(c.ids.source) });
		const step = stepper(folder, hostOver(deps, fake.transports));
		const said = await step('case');
		expect(said.ok, `arrangement: the case holds — ${said.said.join('\n')}`).toBe(true);
		expect(said.said[0], 'the unit is not said, by its id, title and kind, before the case check').toBe(`the unit named: ${c.ids.verification}, "Verification", of kind REQUIREMENT_DEFINITION`);
		expect((await step('policy')).ok, 'arrangement: the policy step').toBe(true);

		// ── T13 — no role is shown before the role before it is called.
		const early = await step('prepare', { JPWB_D84_ROLE: 'hypothesizer' });
		expect([early.ok, early.said.join('\n')], 'the Hypothesizer was shown before the writer was called').toEqual([
			false,
			"the writer has not been called: each role is given the earlier roles' real answers, so the hypothesizer waits for it (REG-D-189 (1))"
		]);
		expect(existsSync(roleFolderOf(folder, 'hypothesizer')), 'a refused showing wrote something').toBe(false);

		await prepareApproveCall(step, folder, 'writer');
		const writerShown = tree(join(roleFolderOf(folder, 'writer'), D84_LAYOUT.shown));
		expect(fake.sent.writer.length, 'the writer’s devin was not called once').toBe(1);
		expect(hexOf(new Map([...writerShown].filter(([p]) => p !== 'argv.json'))), 'T2: the writer’s call did not send the folder it showed').toEqual(hexOf(fake.sent.writer[0]!.folder));
		expect(JSON.parse(writerShown.get('argv.json')!.toString('utf8')), 'T2: the writer’s call did not send the argv it showed').toEqual(fake.sent.writer[0]!.argv);

		await prepareApproveCall(step, folder, 'hypothesizer');
		const hypothesizerShown = tree(join(roleFolderOf(folder, 'hypothesizer'), D84_LAYOUT.shown));
		expect(fake.sent.pi.length, 'the Hypothesizer’s Pi was not turned once').toBe(1);
		expect(fake.sent.opens, '⭑ CONTROL (r2, `D84R-B01`): the approved Hypothesizer’s call did not open Pi once').toBe(1);
		expect(hexOf(under(hypothesizerShown, 'copy/')), 'T2: the Hypothesizer was not opened in the copy it showed').toEqual(hexOf(fake.sent.pi[0]!.copy));
		expect(hypothesizerShown.get('task.txt')?.toString('utf8'), 'T2: the Hypothesizer was not sent the task text it showed').toBe(fake.sent.pi[0]!.text);
		const chapter = chapterAnswering(readFileSync(join(roleFolderOf(folder, 'writer'), D84_LAYOUT.shown, 'prompt.txt'), 'utf8'));
		const statement = (JSON.parse(chapter) as { statements: { text: string }[] }).statements[0]?.text ?? '(no statement)';
		expect(hypothesizerShown.get('task.txt')?.toString('utf8') ?? '', 'T13: the Hypothesizer was not shown the writer’s recorded chapter').toContain(statement);

		await prepareApproveCall(step, folder, 'historian');
		const historianShown = tree(join(roleFolderOf(folder, 'historian'), D84_LAYOUT.shown));
		expect(fake.sent.historian.length, 'the Historian’s devin was not called once').toBe(1);
		expect(hexOf(under(historianShown, 'folder/')), 'T2: the Historian’s call did not send the folder it showed').toEqual(hexOf(fake.sent.historian[0]!.folder));
		expect(historianShown.get('host/config.json')?.toString('hex'), 'T2: the Historian’s call did not send the user configuration it showed').toBe(
			fake.sent.historian[0]!.userConfig?.toString('hex')
		);
		expect(JSON.parse(historianShown.get('argv.json')!.toString('utf8')), 'T2: the Historian’s call did not send the argv it showed').toEqual(fake.sent.historian[0]!.argv);
		expect(
			[...historianShown.entries()].some(([p, b]) => p.startsWith('folder/records/') && b.includes('Source’s reader treats a pipe as a file.')),
			'T13: the Historian was not shown the Hypothesizer’s recorded diagnosis'
		).toBe(true);
		for (const role of ['writer', 'hypothesizer', 'historian'] as const) {
			const call = readJson<CallRecord>(join(roleFolderOf(folder, role), D84_LAYOUT.call));
			expect.soft([call?.checkedAtSeam, call?.approvedManifestSha256, call?.outcome?.status], `the ${role}’s call record does not say it was checked at its seam and recorded`).toEqual([
				true,
				shownOf(folder, role).sha256,
				'recorded'
			]);
		}
	});

	it('⛔ RED FIRST — T9: THE STOP — the Historian recording a recurrence, the driver records no step-back and opens no Unsticking Agent; nothing is shown or called after it; and the driver’s modules name neither the stage’s press nor its re-ask', async () => {
		const c = await ninthRunCase();
		const { deps } = driverDeps();
		const folder = measurementFolderFor(c.ids.verification);
		const fake = fakeTransports({ historian: () => recurringHistorian(String(readJson<{ reading: { roundId: string } }>(join(folder, D84_LAYOUT.case))?.reading.roundId)), diagnosis: diagnosisNaming(c.ids.source) });
		const step = stepper(folder, hostOver(deps, fake.transports));
		expect((await step('case')).ok && (await step('policy')).ok, 'arrangement: the case and the policy').toBe(true);
		for (const role of ['writer', 'hypothesizer', 'historian'] as const) await prepareApproveCall(step, folder, role);
		const roundId = readJson<{ reading: { roundId: string } }>(join(folder, D84_LAYOUT.case))!.reading.roundId;
		const recurrence = listByType(getEngine(), 'ASSURANCE_OBSERVATION').filter((o) => o.state.findingCode === 'KNOWN_FAILURE_RECURRENCE');
		expect(recurrence.length, 'arrangement: the Historian’s recurrence is recorded open, as the stage would bring the Unsticking Agent on it').toBe(1);

		expect(stageRecordsIn(getEngine()).filter((r) => r.roundId === roundId).map((r) => r.part), 'the driver ran a part after the Historian').toEqual([
			STAGE_PART.CHAPTER,
			STAGE_PART.DIAGNOSIS,
			STAGE_PART.HISTORIAN
		]);
		expect(listByType(getEngine(), 'MODEL_EXCHANGE').filter((x) => x.state.invokerId === HELPER_INVOKER.unsticking).length, 'the driver opened the Unsticking Agent').toBe(0);
		expect(fake.sent.pi.length, 'Pi was turned after the Hypothesizer').toBe(1);
		expect(existsSync(join(folder, D84_STOPPED)), 'the driver did not record that it stopped after the Historian').toBe(true);
		const calls = fake.calls();
		for (const role of ['writer', 'hypothesizer', 'historian'] as const) {
			const again = await step('call', { JPWB_D84_ROLE: role, JPWB_D84_PAID: '1' });
			expect([again.ok, again.said[0]], `the ${role} could be called after the stop`).toEqual([false, 'the driver stopped after the Historian: nothing more is called on this copy (D84)']);
		}
		expect(fake.calls(), 'a program ran after the stop').toBe(calls);
		const sources = readdirSync(new URL('.', import.meta.url))
			.filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))
			.map((n) => [n, readFileSync(new URL(n, import.meta.url), 'utf8')] as const);
		expect(sources.length, 'arrangement: the driver’s modules are read').toBeGreaterThanOrEqual(8);
		expect(
			sources.filter(([, text]) => /\b(runAssuranceStage|rerunHistorian|stepBackPart)\b/.test(text)).map(([n]) => n),
			'a driver module names the stage’s press, its re-ask or its step-back'
		).toEqual([]);
	});

	it('⛔ RED FIRST — T10: THE HYPOTHESIZER’S FULL REQUEST — its sha256 recorded from the turn’s result; its bytes in the copy’s content store as the stage stores them; nothing of them shown, or in any record, before the call; and written into after/ only once the call record exists, from the content store, its sha256 the one recorded', async () => {
		const c = await ninthRunCase();
		const { deps } = driverDeps();
		const folder = measurementFolderFor(c.ids.verification);
		const fake = fakeTransports({ historian: () => recurringHistorian('none'), diagnosis: diagnosisNaming(c.ids.source) });
		const step = stepper(folder, hostOver(deps, fake.transports));
		expect((await step('case')).ok && (await step('policy')).ok, 'arrangement: the case and the policy').toBe(true);
		await prepareApproveCall(step, folder, 'writer');
		const roundId = readJson<{ reading: { roundId: string } }>(join(folder, D84_LAYOUT.case))!.reading.roundId;
		const at = { folder, unitId: c.ids.verification, roundId };
		expect((await step('prepare', { JPWB_D84_ROLE: 'hypothesizer' })).ok, 'arrangement: the Hypothesizer shown').toBe(true);
		expect(
			(await step('approve', { JPWB_D84_ROLE: 'hypothesizer', JPWB_D84_MANIFEST_SHA256: shownOf(folder, 'hypothesizer').sha256, JPWB_D84_WORDS: 'Approved as shown.' })).ok,
			'arrangement: the Hypothesizer approved'
		).toBe(true);
		const before = await writeHypothesizerRequest(deps, at);
		expect(before, 'its request could be written before its call').toEqual({
			refusedBecause: 'the Hypothesizer has not been called (call.json): its full request is read after its call, never before'
		});

		const called = await callRole('hypothesizer', deps, at, fake.transports, { JPWB_D84_PAID: '1' });

		if ('refusedBecause' in called) throw new Error(`arrangement: the Hypothesizer is called — ${called.refusedBecause}`);
		const request = fake.sent.requests[0] ?? '';
		expect(request, 'arrangement: Pi’s full request carries its mark').toContain(REQUEST_MARK);
		expect(called.called.requestSha256, 'the sha256 of the turn’s full request is not recorded').toBe(sha256(request));
		const exchange = listByType(getEngine(), 'MODEL_EXCHANGE').find((x) => x.state.invokerId === HELPER_INVOKER.hypothesizer && x.state.subjectObjectId === roundId);
		const ref = (exchange?.state.materializedInputRef ?? {}) as { storageKey?: string; status?: string };
		expect([ref.status, await getArtifactStore().get(String(ref.storageKey))], 'its full request is not in the copy’s content store as the stage stores it').toEqual(['STORED', request]);
		expect(holding(folder, REQUEST_MARK), 'its full request was written into the measurement folder by its call, before the call record').toEqual([]);
		expect(existsSync(join(roleFolderOf(folder, 'hypothesizer'), D84_LAYOUT.after)), 'its call wrote after/').toBe(false);

		const written = await writeHypothesizerRequest(deps, at);

		expect(written, 'its full request was not written after its call, as the content store holds it').toEqual({ written: { sha256: sha256(request), bytes: Buffer.byteLength(request) } });
		expect(holding(folder, REQUEST_MARK), 'its full request is anywhere but after/').toEqual(['roles/2-hypothesizer/after/request.json']);
		expect(readFileSync(join(roleFolderOf(folder, 'hypothesizer'), D84_LAYOUT.after, 'request.json'), 'utf8'), 'after/ does not hold the request byte for byte').toBe(request);

		// ⭑ Held to the sha256 its call recorded: a call record naming another refuses the request, and writes nothing.
		const other = measurementFolderFor(c.ids.verification);
		writeOnce(join(roleFolderOf(other, 'hypothesizer'), D84_LAYOUT.call), { ...called.called, requestSha256: 'f'.repeat(64) });
		expect(await writeHypothesizerRequest(deps, { ...at, folder: other }), 'a request whose sha256 is not the one its call recorded was written').toEqual({
			refusedBecause: `the request the copy holds has sha256 ${sha256(request)}, and the call recorded ${'f'.repeat(64)}: it is not the request sent`
		});
		expect(existsSync(join(roleFolderOf(other, 'hypothesizer'), D84_LAYOUT.after)), 'a refused request wrote after/').toBe(false);
	});
});

describe('⭐⭐ D84 (r2, (7)) — the Hypothesizer’s full request, written into after/ by its call step or by a step of its own', () => {
	it('⛔ RED FIRST — the call step is not ok where the request could not be written into after/, its call record standing; the export step writes it alone, once, and is refused before any call record and where after/ is written already', async () => {
		const c = await ninthRunCase();
		const { deps } = driverDeps();
		// ⭑ The content store, made to answer nothing for a key written while `armed` — the call's own records — as a store that lost them would.
		let armed = false;
		const written = new Set<string>();
		const store = new Proxy(deps.store, {
			get: (target, property) => {
				if (property === 'put')
					return async (...a: Parameters<typeof target.put>) => {
						const ref = await target.put(...a);
						if (armed) written.add(ref.storageKey);
						return ref;
					};
				if (property === 'get') return async (key: string) => (armed && written.has(key) ? undefined : target.get(key));
				const value: unknown = Reflect.get(target, property, target);
				return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
			}
		});
		const lossy: AssuranceStageDeps = { ...deps, store };
		const folder = measurementFolderFor(c.ids.verification);
		const fake = fakeTransports({ historian: () => recurringHistorian('none'), diagnosis: diagnosisNaming(c.ids.source) });
		const step = stepper(folder, hostOver(lossy, fake.transports));
		expect((await step('case')).ok && (await step('policy')).ok, 'arrangement: the case and the policy').toBe(true);
		// ⭑ Another folder of the same case, its case checked before any chapter is recorded (after one, the case check refuses, rightly).
		const other = measurementFolderFor(c.ids.verification);
		const otherStep = stepper(other, hostOver(lossy, fake.transports));
		expect((await otherStep('case')).ok, 'arrangement: another folder’s case').toBe(true);
		await prepareApproveCall(step, folder, 'writer');
		expect((await step('prepare', { JPWB_D84_ROLE: 'hypothesizer' })).ok, 'arrangement: the Hypothesizer shown').toBe(true);
		expect(
			(await step('approve', { JPWB_D84_ROLE: 'hypothesizer', JPWB_D84_MANIFEST_SHA256: shownOf(folder, 'hypothesizer').sha256, JPWB_D84_WORDS: 'Approved as shown.' })).ok,
			'arrangement: the Hypothesizer approved'
		).toBe(true);

		armed = true;
		const called = await step('call', { JPWB_D84_ROLE: 'hypothesizer', JPWB_D84_PAID: '1' });
		armed = false;

		const after = join(roleFolderOf(folder, 'hypothesizer'), D84_LAYOUT.after, 'request.json');
		expect([called.ok, existsSync(join(roleFolderOf(folder, 'hypothesizer'), D84_LAYOUT.call)), existsSync(after)], 'a call step whose request was not written was ok, or its call record did not stand').toEqual([
			false,
			true,
			false
		]);
		expect(called.said.join('\n'), 'the call step does not name why its request was not written').toContain('not in the content store');
		expect(fake.sent.pi.length, 'arrangement: the Hypothesizer was turned once').toBe(1);
		const exported = await step('export');
		expect([exported.ok, exported.said[0]?.startsWith('its full request is written into after/: sha256 ')], 'the export step did not write the request').toEqual([true, true]);
		expect(readFileSync(after, 'utf8'), 'the export step did not write the request the call recorded').toBe(fake.sent.requests[0]);
		// ⭑ Settled before it is expected: a step that throws (a second write refused by the file system) still reaches the check, naming it.
		const twice = await step('export').catch((e: unknown) => ({ ok: false, said: [`the step threw: ${e instanceof Error ? e.message : String(e)}`] }));
		expect(twice, 'the request was written twice').toEqual({
			ok: false,
			said: ['the Hypothesizer’s full request is written already (after/request.json): it is written once']
		});
		expect(await otherStep('export'), 'a request was exported before any call').toEqual({
			ok: false,
			said: ['the Hypothesizer has not been called (call.json): its full request is read after its call, never before']
		});
		expect(fake.sent.pi.length, 'the export ran a program').toBe(1);
	});
});

describe('⭐⭐ D84 (T5) — the case check: the ninth run’s shape admitted, every other refused, naming what it found', () => {
	it('⛔ RED FIRST — the ninth run’s case: Verification, rejected at its second sign-off after one re-run in place, its reading recorded', async () => {
		const c = await ninthRunCase();
		const checked = caseCheck(getEngine(), c.ids.verification);
		const decisions = listByType(getEngine(), 'DECISION').filter((d) => d.state.selectedOption === RERUN_REJECTED_WORK);
		expect(checked, 'the ninth run’s case is not admitted, with its reading').toEqual({
			ok: true,
			reading: {
				unit: { id: c.ids.verification, title: 'Verification', kind: 'REQUIREMENT_DEFINITION', undertakingId: c.u.undertakingId },
				roundId: c.second[0]!.assessmentId,
				secondRejection: c.second.map((v) => v.assessmentId),
				firstRejection: c.first.map((v) => v.assessmentId),
				rerun: { decisionId: decisions[0]?.id, moveBackEvent: expect.any(Number) }
			}
		});
	});

	it('⛔ RED FIRST — once rejected, with no re-run in place: refused, naming it', async () => {
		const r = await verificationRejected();
		const checked = caseCheck(getEngine(), r.ids.verification);
		expect(checked.ok, 'a unit rejected once is admitted').toBe(false);
		expect('found' in checked ? checked.found : [], 'the refusal does not name the missing re-run').toContain(
			`0 re-run(s) in place recorded for the unit (REPLAN Decisions selecting ${RERUN_REJECTED_WORK} naming it): D84's case is the second rejection after one`
		);
	});

	it('⛔ RED FIRST — a re-run Decision recorded after the one rejection, with no move back and no second sign-off: refused, naming each', async () => {
		const r = await verificationRejected();
		const decisionId = mintUiId('dec');
		const subjects = [r.ids.verification, ...r.first.map((v) => v.assessmentId)];
		const rationale = 'Re-run it with the findings.';
		expect(
			runStepsHere([
				[
					'ProposeDecision',
					'DECISION',
					decisionId,
					{ decisionType: 'REPLAN', subjectObjectIds: subjects, selectedOption: RERUN_REJECTED_WORK, rationale, authority: actingActor(uiSession()), consideredObservationIds: [] }
				],
				[
					'ApproveDecision',
					'DECISION',
					decisionId,
					{ selectedOption: RERUN_REJECTED_WORK, rationale, consideredEvidenceIds: [], consideredObservationIds: [], subjectSemanticVersions: { [r.ids.verification]: 1 } }
				]
			]),
			'arrangement: the Decision recorded alone'
		).toBeNull();
		const checked = caseCheck(getEngine(), r.ids.verification);
		const found = 'found' in checked ? checked.found : [];
		const ids = r.first.map((v) => v.assessmentId).join(', ');
		expect.soft(found, 'the refusal does not name the missing move back').toContain(`no move back of the unit cites the re-run's Decision ${decisionId} (UNDER_ASSURANCE to PLANNED)`);
		expect.soft(found, 'the refusal does not name this rejection as made before the re-run').toContain(`this rejection's verdict(s) ${ids} were completed before the re-run in place`);
		expect.soft(found, 'the refusal does not name the missing second sign-off').toContain(`the verdict(s) ${ids} are the first rejection's and this one's: no second sign-off is recorded`);
		expect(checked.ok, 'the shape is admitted').toBe(false);
	});

	it('⛔ RED FIRST — the stage already run for the round: refused, naming its records', async () => {
		const c = await ninthRunCase();
		const fake = fakeTransports({ historian: () => recurringHistorian('none'), diagnosis: diagnosisNaming(c.ids.source) });
		const { deps } = driverDeps({
			writerPrint: (prompt: string) => devinPrint(prompt, fake.transports.devinExec),
			openPi: fake.transports.openPi,
			historianExec: fake.transports.devinExec,
			historianVersionOf: fake.transports.devinVersion
		});
		const done = await runAssuranceStage(c.ids.verification, deps);
		expect('parts' in done, 'arrangement: the stage ran').toBe(true);
		const checked = caseCheck(getEngine(), c.ids.verification);
		const found = 'found' in checked ? checked.found : [];
		expect(found.some((f) => f.startsWith('the assurance stage has run for the Undertaking: ')), `the refusal does not name the stage’s records: ${found.join(' | ')}`).toBe(true);
		expect(checked.ok, 'a case whose stage has run is admitted').toBe(false);
	});

	it('⛔ RED FIRST — accepted at its second sign-off, or a work unit the copy does not hold: refused, naming it', async () => {
		const c = await ninthRunCase({ second: false });
		const accepted = caseCheck(getEngine(), c.ids.verification);
		expect(accepted.ok, 'a unit accepted at its second sign-off is admitted').toBe(false);
		expect(('found' in accepted ? accepted.found : []).some((f) => f.startsWith('the unit is UNDER_ASSURANCE with its execution SUCCEEDED and its assurance SATISFIED')), JSON.stringify(accepted)).toBe(true);
		expect(caseCheck(getEngine(), 'pwu_00000000000000000000000000'), 'a unit the copy does not hold is not refused by name').toEqual({
			ok: false,
			found: ['the copy holds no work unit "pwu_00000000000000000000000000"']
		});
		expect(caseCheck(getEngine(), c.u.undertakingId).ok, 'an object that is not a work unit is admitted').toBe(false);
	});

	it('⛔ RED FIRST — a second re-run in place and a third rejection: refused, naming the two re-runs', async () => {
		const c = await ninthRunCase();
		await rerunBeforeTheStage(c);
		await signOff(c.u, c.ids.verification, true);
		const checked = caseCheck(getEngine(), c.ids.verification);
		expect('found' in checked ? checked.found : [], 'the refusal does not name the two re-runs').toContain(
			`2 re-run(s) in place recorded for the unit (REPLAN Decisions selecting ${RERUN_REJECTED_WORK} naming it): D84's case is the second rejection after one`
		);
	});
});

/** ⭐ D84 — the Historian policy's narrow form, as the ninth run's store holds it: the seed's before package L17b2 widened its kind scope (`336ce4e4`). */
const NARROW_APPLICABILITY = { objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'], pwuKindConditions: ['ARCHITECTURE_DECISION'] };
/** The Historian policy edited to `patch`, as an arrangement: the copy's stored form. */
function storedPolicyEdited(patch: Readonly<Record<string, unknown>>): void {
	expect(runStepsHere([['EditAssurancePolicy', 'ASSURANCE_POLICY', HISTORIAN_POLICY_ID, { policyId: HISTORIAN_POLICY_ID, ...patch }]]), 'arrangement: the stored policy edited').toBeNull();
}
/** The Historian's assessment of `pwuId` requested, as its part requests it first (`RequestAssuranceAssessment`): its refusal, or null. */
const historianRequest = (pwuId: string, assessmentId: string = mintUiId('asmt')): string | null =>
	runStepsHere([
		[
			'RequestAssuranceAssessment',
			'ASSURANCE_ASSESSMENT',
			assessmentId,
			{
				assessmentId,
				assurancePolicyId: HISTORIAN_POLICY_ID,
				policyVersion: String((getObject(getEngine(), HISTORIAN_POLICY_ID) as { version?: unknown } | undefined)?.version ?? ''),
				subjectObjectIds: [pwuId],
				subjectSemanticVersions: { [pwuId]: Number(getEngine().loadObject(pwuId)?.semanticVersion ?? 1) },
				claimIds: []
			}
		]
	]);
const comparedOfStored = (): Record<string, unknown> => {
	const state = (getObject(getEngine(), HISTORIAN_POLICY_ID) ?? {}) as Record<string, unknown>;
	return Object.fromEntries(COMPARED_POLICY_FIELDS.map((f) => [f, state[f]]));
};

describe('⭐⭐ D84 (T6; `REG-F-680`; the lead’s rulings r1, Q2) — the copy’s Historian policy brought to the seed’s form, edited in place under the person’s Decision', () => {
	it('⛔ RED FIRST — the narrow form refuses the Historian’s assessment of Verification (⭑ CONTROL); one batch — the APPROVAL Decision over the policy citing REG-D-166 (3), REG-D-189, REG-F-680 and D84, then the edit of its applicability — brings it to the seed’s form, its version unmoved; and the assessment is admitted', async () => {
		const r = await verificationRejected();
		storedPolicyEdited({ applicability: NARROW_APPLICABILITY });
		const refusal = historianRequest(r.ids.verification);
		expect(refusal, '⭑ CONTROL: the narrow form admits the Historian’s assessment of Verification').not.toBeNull();
		const version = (getObject(getEngine(), HISTORIAN_POLICY_ID) as { version?: unknown }).version;
		const eventsBefore = getEngine().readAllEvents().length;
		const seed = seedPolicyForm();

		const prepared = preparePolicy({ engine: getEngine(), runSteps: runStepsHere, newId: mintUiId }, seed);

		if ('refusedBecause' in prepared) throw new Error(`the policy was not prepared: ${prepared.refusedBecause}`);
		expect([prepared.prepared.prepared, prepared.prepared.differs], 'the preparation did not edit the applicability alone').toEqual([true, ['applicability']]);
		expect(JSON.stringify(comparedOfStored()), 'the stored policy is not the seed’s form after the preparation').toBe(JSON.stringify(seed));
		expect((getObject(getEngine(), HISTORIAN_POLICY_ID) as { version?: unknown }).version, 'the edit in place moved the policy’s version').toBe(version);
		const decision = getObject(getEngine(), prepared.prepared.decisionId ?? '') as Record<string, unknown> | undefined;
		expect(
			[decision?.decisionType, decision?.status, decision?.subjectObjectIds, decision?.rationale],
			'the edit was not made under the person’s APPROVAL Decision over the policy'
		).toEqual(['APPROVAL', 'EFFECTIVE', [HISTORIAN_POLICY_ID], POLICY_PREPARATION_RATIONALE]);
		for (const cited of ['REG-D-166 (3)', 'REG-D-189', 'REG-F-680', 'design D84'])
			expect.soft(String(decision?.rationale), `the Decision’s rationale does not cite ${cited}`).toContain(cited);
		expect(
			getEngine()
				.readAllEvents()
				.slice(eventsBefore)
				.map((e) => [e.eventType, e.aggregateId]),
			'the Decision and the edit are not one batch, the Decision first'
		).toEqual([
			['DecisionProposed', prepared.prepared.decisionId],
			['DecisionEffective', prepared.prepared.decisionId],
			['AssurancePolicyEdited', HISTORIAN_POLICY_ID]
		]);
		expect(historianRequest(r.ids.verification), 'the Historian’s assessment of Verification is not admitted after the preparation').toBeNull();
	});

	it('⛔ RED FIRST — refused, nothing recorded, where an assessment is held under the policy, naming it (⭑ CONTROL: the same narrow form, none held, is prepared); and where another field differs beside the applicability', async () => {
		const r = await verificationRejected();
		storedPolicyEdited({ applicability: NARROW_APPLICABILITY });
		const deps = { engine: getEngine(), runSteps: runStepsHere, newId: mintUiId };
		const seed = seedPolicyForm();
		storedPolicyEdited({ applicability: seed?.applicability as Record<string, unknown> });
		expect(historianRequest(r.ids.verification), 'arrangement: an assessment held under the policy').toBeNull();
		const heldIds = listByType(getEngine(), 'ASSURANCE_ASSESSMENT').filter((a) => a.state.assurancePolicyId === HISTORIAN_POLICY_ID).map((a) => a.id);
		storedPolicyEdited({ applicability: NARROW_APPLICABILITY });
		const events = getEngine().readAllEvents().length;

		const refusedHeld = preparePolicy(deps, seed);

		expect(refusedHeld, 'the policy was edited in place under a held assessment').toEqual({
			refusedBecause:
				`the copy holds 1 assessment(s) under ${HISTORIAN_POLICY_ID} (${heldIds.join(', ')}): an edit in place moves no version ` +
				"(REG-F-209), and a held assessment's meaning would move under it, so the policy is not edited (REG-F-680)"
		});
		expect(getEngine().readAllEvents().length, 'a refused preparation recorded something').toBe(events);

		resetEngine('reference');
		await verificationRejected();
		storedPolicyEdited({ applicability: NARROW_APPLICABILITY });
		const control = preparePolicy({ engine: getEngine(), runSteps: runStepsHere, newId: mintUiId }, seedPolicyForm());
		expect('prepared' in control && control.prepared.prepared, '⭑ CONTROL: the narrow form with no held assessment is not prepared').toBe(true);

		storedPolicyEdited({ applicability: NARROW_APPLICABILITY, purpose: 'Another purpose.' });
		expect(preparePolicy({ engine: getEngine(), runSteps: runStepsHere, newId: mintUiId }, seedPolicyForm()), 'a policy differing beyond its applicability was edited').toEqual({
			refusedBecause: `the copy's ${HISTORIAN_POLICY_ID} differs from the seed's in purpose beside its applicability: the lead's ruling edits its applicability alone (REG-F-680)`
		});
	});
});

describe('⭐⭐ D84 (T7, T8; the lead’s rulings r1, Q10) — nothing is called without its approval; a byte changed after it, or at the seam, refuses the call', () => {
	/** The ninth run's case, its case and policy steps held, and the writer shown. */
	async function shownWriter() {
		const c = await ninthRunCase();
		const { deps, shared } = driverDeps();
		const folder = measurementFolderFor(c.ids.verification);
		const fake = fakeTransports({ historian: () => recurringHistorian('none'), diagnosis: diagnosisNaming(c.ids.source) });
		const step = stepper(folder, hostOver(deps, fake.transports));
		expect((await step('case')).ok && (await step('policy')).ok, 'arrangement: the case and the policy').toBe(true);
		expect((await step('prepare', { JPWB_D84_ROLE: 'writer' })).ok, 'arrangement: the writer shown').toBe(true);
		const roundId = readJson<{ reading: { roundId: string } }>(join(folder, D84_LAYOUT.case))!.reading.roundId;
		return { c, deps, shared, folder, fake, step, at: { folder, unitId: c.ids.verification, roundId } };
	}
	const paid = { JPWB_D84_PAID: '1' };

	it('⛔ RED FIRST — T7: no approval, an approval of another manifest, and a byte changed after the approval are each refused before any program runs; ⭑ CONTROL: the approval of what was shown calls the program once', async () => {
		const s = await shownWriter();
		const writer = roleFolderOf(s.folder, 'writer');
		const shown = shownOf(s.folder, 'writer');
		expect(await callRole('writer', s.deps, s.at, s.fake.transports, paid), 'a call with no approval ran').toEqual({
			refusedBecause: 'no approval is recorded (approval.json): no call runs without its approval record (REG-D-189 (1))'
		});
		writeOnce(join(writer, D84_LAYOUT.approval), { manifestSha256: 'f'.repeat(64), approvedAt: NOW, words: 'Approved.', recordedBy: 'the lead' });
		expect(await callRole('writer', s.deps, s.at, s.fake.transports, paid), 'a call approved for another manifest ran').toEqual({
			refusedBecause: `the approval is of manifest ${'f'.repeat(64)}, and what was shown is manifest ${shown.sha256}: no call runs on what was not approved`
		});
		rmSync(join(writer, D84_LAYOUT.approval));
		expect((await s.step('approve', { JPWB_D84_ROLE: 'writer', JPWB_D84_MANIFEST_SHA256: shown.sha256, JPWB_D84_WORDS: 'Approved as shown.' })).ok, 'arrangement: approved').toBe(true);
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'another-model');
		const changed = await callRole('writer', s.deps, s.at, s.fake.transports, paid);
		expect('refusedBecause' in changed ? changed.refusedBecause : 'it was not refused', 'a call whose bytes changed after its approval ran').toMatch(
			/^the writer prepared again differs from what was approved, so it is not called: argv\.json: its bytes differ from what was approved/
		);
		expect([s.fake.calls(), existsSync(join(writer, D84_LAYOUT.call))], 'a refused call ran a program, or recorded a call').toEqual([0, false]);

		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
		const control = await callRole('writer', s.deps, s.at, s.fake.transports, paid);
		expect('called' in control && control.called.outcome?.status, '⭑ CONTROL: the approved call did not run, recorded').toBe('recorded');
		expect(s.fake.sent.writer.length, '⭑ CONTROL: the approved call did not run its program once').toBe(1);
		const attempt = readJson<{ readonly manifestSha256?: unknown; readonly at?: unknown }>(join(writer, 'attempt.json'));
		expect(
			[attempt?.manifestSha256, typeof attempt?.at === 'string' && !Number.isNaN(Date.parse(attempt.at))],
			'⭑ CONTROL (r2, `D84R-A01`): the call reserved no attempt before its program, naming the manifest approved and the time'
		).toEqual([shown.sha256, true]);
		expect(await callRole('writer', s.deps, s.at, s.fake.transports, paid), 'a role was called twice on one copy').toEqual({
			refusedBecause: "the writer has been called (call.json): a role is called once on a copy (the lead's rulings r1, Q10)"
		});
	});

	it('⛔ RED FIRST — T7: a file of the Hypothesizer’s copy changed after its approval refuses its call, naming the file', async () => {
		const s = await shownWriter();
		await approveCall(s.step, s.folder, 'writer');
		await s.step('prepare', { JPWB_D84_ROLE: 'hypothesizer' });
		expect(
			(await s.step('approve', { JPWB_D84_ROLE: 'hypothesizer', JPWB_D84_MANIFEST_SHA256: shownOf(s.folder, 'hypothesizer').sha256, JPWB_D84_WORDS: 'Approved as shown.' })).ok,
			'arrangement: approved'
		).toBe(true);
		writeFileSync(join(s.shared, 'src', 'reader.ts'), 'export const read = () => "changed";\n');
		const refused = await callRole('hypothesizer', s.deps, s.at, s.fake.transports, paid);
		expect('refusedBecause' in refused ? refused.refusedBecause : 'it was not refused', 'a Hypothesizer whose copy changed after its approval was called').toMatch(
			/^the hypothesizer prepared again differs from what was approved, so it is not called: copy\/src\/reader\.ts: its bytes differ from what was approved/
		);
		expect(s.fake.sent.pi.length, 'Pi was turned').toBe(0);
	});

	it('⛔ RED FIRST — T8: at each seam alone, what would be sent is held to what was approved: a difference throws there and the program is never reached; ⭑ CONTROL: what was approved is sent, once', async () => {
		const s = await shownWriter();
		const approved = shownOf(s.folder, 'writer');
		const program = vi.fn(s.fake.transports.devinExec);
		const transports: D84Transports = { ...s.fake.transports, devinExec: program };
		const seen: SeamSeen = { checked: false };
		const otherwise = { ...approved, entries: approved.entries.map((e) => (e.path === 'prompt.txt' ? { ...e, sha256: '0'.repeat(64) } : e)) };
		const refusing = seamedDeps('writer', s.deps, otherwise, transports, seen);
		const prompt = readFileSync(join(roleFolderOf(s.folder, 'writer'), D84_LAYOUT.shown, 'prompt.txt'), 'utf8');
		const writerPrompt = prompt.slice(prompt.indexOf(WRITER_PROMPT));
		// ⭑ As `devinPrint` throws any failure of its program: its diagnostic after "devin invocation failed: ".
		const thrown = await refusing.writerPrint!(writerPrompt).then(
			() => 'it sent',
			(e: unknown) => (e instanceof Error ? e.message : String(e))
		);
		expect(thrown, 'the writer’s seam sent what was not approved').toMatch(
			/^devin invocation failed: D84 refused the call at its transport \(the writer's prompt file\): what it would send differs from what was approved — prompt\.txt: its bytes differ/
		);
		expect([program.mock.calls.length, seen.checked, seen.refusedBecause !== undefined], 'the writer’s program was reached past its seam’s refusal').toEqual([0, false, true]);
		const sending: SeamSeen = { checked: false };
		const sent = await seamedDeps('writer', s.deps, approved, transports, sending).writerPrint!(writerPrompt).then(
			() => 'it sent',
			(e: unknown) => (e instanceof Error ? e.message : String(e))
		);
		expect([sent, program.mock.calls.length, sending.checked], '⭑ CONTROL: the writer’s seam did not send what was approved, once').toEqual(['it sent', 1, true]);
	});

	it('⛔ RED FIRST — T8: the Historian’s seam — devin’s version reported again at its call, another build than the one shown and checked: the call refused at its transport, devin never run, the part recorded failing, the call record saying so', async () => {
		const c = await ninthRunCase();
		const { deps } = driverDeps();
		const folder = measurementFolderFor(c.ids.verification);
		const fake = fakeTransports({ historian: () => recurringHistorian('none'), diagnosis: diagnosisNaming(c.ids.source) });
		let versions = 0;
		// ⭑ devin's version as the Historian's check reads it: the one measured at its showing and at its check again; at its call, another build of it.
		const transports: D84Transports = {
			...fake.transports,
			devinVersion: async () => {
				versions += 1;
				return versions <= 2 ? VERSION : 'devin 3000.11.234 (another build)';
			}
		};
		const step = stepper(folder, hostOver(deps, transports));
		expect((await step('case')).ok && (await step('policy')).ok, 'arrangement: the case and the policy').toBe(true);
		await prepareApproveCall(step, folder, 'writer');
		await prepareApproveCall(step, folder, 'hypothesizer');
		expect((await step('prepare', { JPWB_D84_ROLE: 'historian' })).ok, 'arrangement: the Historian shown').toBe(true);
		expect(
			(await step('approve', { JPWB_D84_ROLE: 'historian', JPWB_D84_MANIFEST_SHA256: shownOf(folder, 'historian').sha256, JPWB_D84_WORDS: 'Approved as shown.' })).ok,
			'arrangement: the Historian approved'
		).toBe(true);
		const roundId = readJson<{ reading: { roundId: string } }>(join(folder, D84_LAYOUT.case))!.reading.roundId;

		const called = await callRole('historian', deps, { folder, unitId: c.ids.verification, roundId }, transports, paid);

		if ('refusedBecause' in called) throw new Error(`the call was refused before its part: ${called.refusedBecause}`);
		expect(versions, 'arrangement: devin’s version was read at the showing, at the check and at the call').toBe(3);
		expect(fake.sent.historian.length, 'devin ran past the Historian’s seam').toBe(0);
		expect([called.called.checkedAtSeam, called.called.seamRefusal?.startsWith("D84 refused the call at its transport (the Historian's folder)")], 'the call record does not say the seam refused').toEqual([false, true]);
		expect(called.called.outcome?.status, 'the Historian’s part was not recorded failing').not.toBe('recorded');
	});

	it('⛔ RED FIRST — T8 (Q10): a seam’s refusal is recorded as the part failing — the Hypothesizer’s copy changed between its check and its opening: Pi is never opened, the part is recorded failing with the seam’s words, and the call record says so', async () => {
		const s = await shownWriter();
		await approveCall(s.step, s.folder, 'writer');
		let asked = 0;
		const sandboxOf = s.deps.sandboxOf;
		// ⭑ The shared workspace, as the part asks for it after the check: one of its files changed then, as a write between the two would change it.
		const deps: AssuranceStageDeps = {
			...s.deps,
			sandboxOf: (undertakingId: string) => {
				asked += 1;
				if (asked === 3) writeFileSync(join(s.shared, 'src', 'reader.ts'), 'export const read = () => "between";\n');
				return sandboxOf(undertakingId);
			}
		};
		const step = stepper(s.folder, hostOver(deps, s.fake.transports));
		expect((await step('prepare', { JPWB_D84_ROLE: 'hypothesizer' })).ok, 'arrangement: shown').toBe(true);
		expect(
			(await step('approve', { JPWB_D84_ROLE: 'hypothesizer', JPWB_D84_MANIFEST_SHA256: shownOf(s.folder, 'hypothesizer').sha256, JPWB_D84_WORDS: 'Approved as shown.' })).ok,
			'arrangement: approved'
		).toBe(true);

		const called = await callRole('hypothesizer', deps, s.at, s.fake.transports, paid);

		if ('refusedBecause' in called) throw new Error(`the call was refused before its part: ${called.refusedBecause}`);
		expect(asked, 'arrangement: the part asked for the shared workspace after the check').toBeGreaterThanOrEqual(3);
		// ⭐ RESTATED (r2, `D84R-B01`): ~~`expect(s.fake.sent.pi.length, 'Pi was opened past the seam’s refusal').toBe(0)`~~ — that count is of turns,
		// which the fake keeps inside `turn`, so an opening made before the check and never turned passed it. Under its message now, the openings
		// themselves counted, which an opening before the check reddens (`P6X-D84-M57`); and its old count of turns kept after it, under its true
		// name. Stronger, never weaker: one check more, and none taken away.
		expect(s.fake.sent.opens, 'Pi was opened past the seam’s refusal').toBe(0);
		expect(s.fake.sent.pi.length, 'Pi was turned past the seam’s refusal').toBe(0);
		expect([called.called.checkedAtSeam, called.called.seamRefusal?.startsWith("D84 refused the call at its transport (the Hypothesizer's copy)")], 'the call record does not say the seam refused').toEqual([false, true]);
		expect(called.called.outcome?.status, 'the part was not recorded failing').not.toBe('recorded');
		expect(String(called.called.outcome?.why ?? ''), 'the part’s record does not carry the seam’s words').toContain('D84 refused the call at its transport');
		expect(await callRole('hypothesizer', deps, s.at, s.fake.transports, paid), 'a failed role could be called again on its copy').toEqual({
			refusedBecause: "the hypothesizer has been called (call.json): a role is called once on a copy (the lead's rulings r1, Q10)"
		});
		expect(await prepareRole('historian', deps, s.at, s.fake.transports.devinVersion), 'the Historian is not shown after a Hypothesizer that failed').toHaveProperty('shown');
	});
});
