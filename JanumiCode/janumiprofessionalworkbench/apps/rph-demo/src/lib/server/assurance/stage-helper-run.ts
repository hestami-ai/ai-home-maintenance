// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D74, D75, D85 (`REG-D-166` (3); `REG-D-167` (4)) — THE ASSURANCE STAGE'S HELPERS' HARNESS: the executor's
// harness, in a copy of the Undertaking's shared workspace.
//
// ⭑ WHAT IT DOES, IN ORDER (D74, D75; the lead's rulings on readings 8 to 12):
//   1. Only on a Pi selection: a helper needs `write_file` and `run_command`, minted for the executor's grant. Any other selection — agy, the stand-in,
//      a replay (which does not replay the stage) — runs nothing, and says why.
//   2. A COPY of the shared workspace, `<W>.<role>-<round id>`, beside it; a copy an earlier, killed press left is removed first and named, never
//      reused. ⛔ The copy is NOT A SANDBOX: `run_command` runs any program as the server user (`execution-tool-surface.ts`) — the confinement of a
//      unit's own executor, no more. So the shared workspace's manifest (`takeManifest`) is taken before the copy and after the answer, and any path
//      added, changed or removed is returned for the caller to refuse the answer with.
//   3. Its session: Pi's own file in `<D>.sessions/<role>/<round id>/`, its working folder the copy (D85), or in memory with no durable store.
//   4. One turn. Its exchange recorded on the EXECUTION plane under a role of its own (`invokerId`), its subject the round's opening verdict — never
//      the rejected unit, whose tries six readers count by subject (the lead's ruling on reading 8) — so it is no reviewer call.
//   5. Its commands captured as a unit's are, through the evidence join's mint and evidence, WITHOUT the floor (`proposeHelperEvidence`).
//   6. The copy removed after. Its process-output sibling, where its commands' captures lie, is kept, as the runner's captures are.
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { ArtifactStore, Workspace } from '@janumipwb/rph-ports';
import type { RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import { captureTry, createExchangeSink } from './exchange-capture.js';
import { recordExchanges } from './exchange-recorder.js';
// ⭐ The lead's ruling (k) on the review's fifth re-check — the one describer of a thrown value, which cannot throw: a helper's turn, its failure, its
// session's close and its copy's removal describe through it, so nothing a helper throws, whatever its value, throws out to the stage.
import { describedThrow } from '../described-throw.js';
import { createChildProcessRunner } from '../execution/child-process-runner.js';
import { takeManifest } from '../execution/deliverable-view.js';
import { proposeHelperEvidence } from '../execution/evidence-join.js';
import type { RunnableExecutorSelection } from '../execution/executor-selection.js';
import { sessionFilesIn } from '../execution/executor-session.js';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
import {
	IN_MEMORY_SESSION,
	type ExecutorSessionPlace,
	type ProducerSession,
	type ProducerSessionContext
} from '../execution/producer-session.js';
import { sessionFolderOf } from '../execution/workspace-host.js';
import { isToolInvocationResult } from '../tools/backing-tool.js';
import { governedToolCallReport } from '../tools/observed-tool-calls.js';
import type { StageStep } from './assurance-stage-records.js';
import { HELPER_INVOKER } from './assurance-stage-roles.js';

/** The two helpers, by the role each is recorded under (`HELPER_INVOKER`). */
export type HelperRole = keyof typeof HELPER_INVOKER;

/** What the harness needs from its caller. */
export interface HelperDeps {
	readonly store: ArtifactStore;
	readonly tenantPrefix: string;
	readonly newId: (prefix: string) => string;
	readonly now: () => string;
	readonly runSteps: (steps: readonly StageStep[]) => string | null;
	readonly dispatchExchange: (payload: RecordModelExchangePayload, aggregateId: string) => { status: string };
	/** `<D>.sessions`, or undefined: no durable store, and the session is held in memory. */
	readonly sessionsRoot: string | undefined;
	/** Pi's opener; a test hands in its own. Absent, `openPiExecutionSession`, loaded only when a helper runs. */
	readonly openPi?: (context: ProducerSessionContext, modelId: string, place: ExecutorSessionPlace) => Promise<ProducerSession>;
	/** ⭐ The review's re-check (E) — the copy's removal; a test hands in its own. Absent, the copy and its purge record are removed from disk. */
	readonly removeCopy?: (copyDir: string) => void;
}

/** One helper's run. */
export interface HelperRun {
	readonly role: HelperRole;
	/** The round: its opening verdict, the exchange's subject. */
	readonly roundId: string;
	readonly roundVersion: number;
	readonly undertakingId: string;
	readonly shared: Workspace;
	readonly executor: RunnableExecutorSelection;
	readonly prompt: string;
	/** How the caller reads the answer, for the exchange's parse outcome. */
	readonly parse: (answer: string) => { readonly outcome: 'PARSED' | 'JSON_PARSE_FAILED'; readonly detail: string };
}

export type HelperOutcome =
	/** Not run: by rule (`failed` absent — another executor, no directory), or ⭐ the independent review's defect 4, because it failed (`failed: true`). */
	| { readonly ran: false; readonly why: string; readonly limitations: readonly string[]; readonly failed?: true }
	| {
			readonly ran: true;
			readonly answer: string;
			readonly arrived: boolean;
			readonly capturedArgv: readonly (readonly string[])[];
			readonly evidenceIds: readonly string[];
			/** Each path of the SHARED workspace added, changed or removed while the helper ran: any one refuses its answer. */
			readonly sharedChanged: readonly string[];
			readonly limitations: readonly string[];
			readonly producer: { readonly modelId: string; readonly providerId: string };
	  };

/** The Pi opener, loaded only when called, as `model.ts` loads it. */
const lazyPi = async (context: ProducerSessionContext, modelId: string, place: ExecutorSessionPlace): Promise<ProducerSession> =>
	(await import('../tools/pi-executor.js')).openPiExecutionSession(context, modelId, place);

/** The paths of two manifests that differ: added, changed or removed. */
function changedPaths(
	before: ReadonlyMap<string, { readonly hash: string }>,
	after: ReadonlyMap<string, { readonly hash: string }>
): string[] {
	const paths = [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => Number(a > b) - Number(a < b));
	return paths.filter((p) => before.get(p)?.hash !== after.get(p)?.hash);
}

/** ⭐ D85 + the lead's ruling on reading 10 — a session a killed press left in the helper's folder is moved aside within it, never reused or removed. */
function asideLeftoverSession(folder: string): string[] {
	const left = sessionFilesIn(folder);
	if (left.length === 0) return [];
	const aside = join(folder, `left-by-an-earlier-press-${Date.now()}`);
	mkdirSync(aside, { recursive: true });
	for (const f of left) renameSync(f, join(aside, basename(f)));
	return [`a session an earlier press of this round left (${left.map((f) => basename(f)).join(', ')}) was moved aside, never continued (design D85)`];
}

/** ⭐⭐ D74, D75 — RUN ONE HELPER: see the header for its order. */
export async function runStageHelper(run: HelperRun, deps: HelperDeps): Promise<HelperOutcome> {
	if (run.executor.kind !== 'PI')
		return {
			ran: false,
			why:
				run.executor.kind === 'REPLAY'
					? 'a replay does not replay the assurance stage: its helpers’ answers are not recorded for it (design D74)'
					: `the ${run.role} runs on Pi's harness alone — it needs write_file and run_command — and the executor selected is ${run.executor.kind}`,
			limitations: []
		};
	const dir = run.shared.directoryPath;
	if (run.shared.materialization !== 'FILESYSTEM' || dir === undefined || dir === '')
		return {
			ran: false,
			why: 'the shared workspace has no directory on disk to copy — no durable store is configured — so the helper has nowhere to work',
			limitations: []
		};
	const copyDir = `${dir}.${run.role}-${run.roundId}`;
	const outDir = `${copyDir}.process-output`;
	const limitations: string[] = [];
	let session: ProducerSession | undefined;
	let outcome: HelperOutcome;
	// ⭐ The independent review's defect 4 — EVERYTHING THE HELPER DOES IS INSIDE ONE try: its copy, its session's place, its manifest, its opening, its
	// turn. A step that throws — a model Pi cannot resolve, a copy that cannot be made — is the helper's failure (`failed`), returned for the stage to
	// record as that part's; the stage goes on, and the copy is removed as after any run.
	try {
		// ⭐ Reading 10 — a copy a killed press left is removed before this one is made, and named; never reused.
		if (existsSync(copyDir)) {
			rmSync(copyDir, { recursive: true, force: true });
			limitations.push(`a copy of the workspace an earlier, unfinished press left (${basename(copyDir)}) was removed first, never reused (design D74)`);
		}
		let place: ExecutorSessionPlace = IN_MEMORY_SESSION;
		if (deps.sessionsRoot !== undefined) {
			const folder = sessionFolderOf(deps.sessionsRoot, run.role, run.roundId);
			limitations.push(...asideLeftoverSession(folder));
			place = { kind: 'DURABLE', folder, opening: { kind: 'NEW' } };
		}
		const before = await takeManifest(run.shared);
		cpSync(dir, copyDir, { recursive: true, verbatimSymlinks: true, errorOnExist: true, force: false });
		mkdirSync(outDir, { recursive: true });
		const copy = createFilesystemWorkspace({
			ownerKind: 'UNDERTAKING',
			ownerId: run.undertakingId,
			purgeability: 'PURGEABLE_AT_EXPIRY',
			directoryPath: copyDir
		});
		const output = createFilesystemWorkspace({
			ownerKind: 'UNDERTAKING',
			ownerId: run.undertakingId,
			purgeability: 'PURGEABLE_AT_EXPIRY',
			directoryPath: outDir
		});
		session = await (deps.openPi ?? lazyPi)(
			{
				workspace: copy,
				runner: createChildProcessRunner({ deliverableWorkspace: copy, outputWorkspace: output }),
				grantedCapabilities: ['file-system', 'process-execution'],
				bindingAuthorizationStatus: 'AUTHORIZED'
			},
			run.executor.modelId,
			place
		);
		const requestedAt = deps.now();
		let answer = '';
		let arrived = false;
		let raw = '';
		let materialized: string | undefined;
		let producer = { modelId: run.executor.modelId, providerId: 'pi' };
		let identity: 'PROVIDER_REPORTED' | undefined;
		let failure: string | undefined;
		try {
			const returned = await session.turn(run.prompt);
			if (isToolInvocationResult(returned)) {
				arrived = returned.answer.arrived;
				answer = returned.answer.arrived ? returned.answer.text : '';
				raw = returned.rawOutput;
				materialized = returned.materializedInput;
				producer = { modelId: returned.producer.modelId, providerId: returned.producer.providerId };
				identity = returned.identityEvidence === 'PROVIDER_REPORTED' ? 'PROVIDER_REPORTED' : undefined;
			} else {
				arrived = returned.trim() !== '';
				answer = returned;
				raw = returned;
			}
		} catch (e) {
			failure = describedThrow(e);
		}
		const observation = session.processRuns();
		const parsed = arrived ? run.parse(answer) : undefined;
		// ── The exchange: the EXECUTION plane, its own role, the round's verdict its subject (reading 8).
		const sink = createExchangeSink();
		await captureTry({
			store: deps.store,
			sink,
			tenantPrefix: deps.tenantPrefix,
			exchangeId: deps.newId('exch'),
			role: 'initial',
			model: { ...producer, ...(identity ? { evidence: identity } : {}) },
			prompt: materialized ?? run.prompt,
			rawOutput: raw,
			disposition: arrived ? 'accepted' : 'no-response',
			attemptOrdinal: 1,
			requestedAt,
			respondedAt: deps.now(),
			parseOutcome: parsed ?? {
				outcome: failure === undefined ? 'EMPTY_RESPONSE' : 'NOT_ATTEMPTED',
				detail: failure === undefined ? `The ${run.role} returned no answer.` : `The ${run.role}'s call failed: ${failure}`
			},
			workProductDerivation: {
				relation: 'NO_WORK_PRODUCT_EXPECTED',
				reason: `The assurance stage's ${run.role} (design D74, D75): its answer is advice about the work, never work product.`
			},
			observedToolCalls: governedToolCallReport(session.lastTurnObservation())
		});
		const recorded = recordExchanges(deps.dispatchExchange, sink.drain(), {
			runToken: deps.newId('stagerun'),
			plane: 'EXECUTION',
			invokerId: HELPER_INVOKER[run.role],
			subjectObjectId: run.roundId,
			subjectObjectType: 'ASSURANCE_ASSESSMENT',
			subjectSemanticVersion: run.roundVersion,
			newId: deps.newId
		});
		for (const f of recorded.failures) limitations.push(`its exchange could not be recorded: ${f}`);
		// ── Its commands, captured as a unit's are, with no floor (reading 9).
		const evidence = await proposeHelperEvidence(
			{
				runs: observation.runs,
				scope: `commands run by the assurance stage's ${run.role} of round ${run.roundId}`,
				tenantPrefix: deps.tenantPrefix,
				producerModelId: producer.modelId
			},
			{
				artifacts: deps.store,
				now: deps.now,
				newId: deps.newId,
				propose: (evidenceId, payload) => deps.runSteps([['ProposeEvidence', 'EVIDENCE', evidenceId, payload]])
			}
		);
		if (evidence.refusedBecause !== undefined) limitations.push(`a command it ran could not be recorded as evidence: ${evidence.refusedBecause}`);
		if (observation.observedCount > observation.runs.length)
			limitations.push(`it ran ${observation.observedCount} commands and the host kept ${observation.runs.length} (the step's bound)`);
		if (failure !== undefined) limitations.push(`its call failed: ${failure}`);
		const after = await takeManifest(run.shared);
		outcome = {
			ran: true,
			answer,
			arrived,
			capturedArgv: observation.runs.map((r) => r.argv),
			evidenceIds: evidence.evidenceIds,
			sharedChanged: changedPaths(before, after),
			limitations,
			producer
		};
	} catch (e) {
		outcome = { ran: false, failed: true, why: `the ${run.role} failed: ${describedThrow(e)}`, limitations };
	}
	// ⭐ The review's re-check (E) — THE SESSION CLOSED AND THE COPY REMOVED, EACH WHATEVER THE OTHER DOES: a close that fails fails the helper, as any
	// failure of its run does; the copy is removed all the same — never left for the round's next press, which is refused, to never reclaim — and a
	// removal that fails is named in the part's limitations.
	const closeFailure = sessionCloseFailure(session);
	const removal = copyRemovalFailure(copyDir, deps.removeCopy ?? removeCopyOnDisk);
	if (removal !== undefined) limitations.push(removal);
	return closeFailure === undefined ? outcome : { ran: false, failed: true, why: `the ${run.role} failed: ${closeFailure}`, limitations };
}

/** ⭐ The review's re-check (E) — close a helper's session: why it could not be closed, or `undefined`. */
function sessionCloseFailure(session: ProducerSession | undefined): string | undefined {
	try {
		session?.dispose();
		return undefined;
	} catch (e) {
		return describedThrow(e);
	}
}

/** ⭐ The review's re-check (E) — remove a helper's copy: why it could not be removed, or `undefined`. */
function copyRemovalFailure(copyDir: string, remove: (copyDir: string) => void): string | undefined {
	try {
		remove(copyDir);
		return undefined;
	} catch (e) {
		return `its copy of the workspace (${basename(copyDir)}) could not be removed: ${describedThrow(e)}`;
	}
}

/** A helper's copy removed from disk, and its purge record, should anything have made one beside it. */
function removeCopyOnDisk(copyDir: string): void {
	rmSync(copyDir, { recursive: true, force: true });
	// The copy's own purge record, should anything have made one beside it.
	for (const name of readdirSync(join(copyDir, '..')).filter((n) => n.startsWith(`${basename(copyDir)}.jpwb-workspace-tombstones`)))
		rmSync(join(copyDir, '..', name), { force: true });
}
