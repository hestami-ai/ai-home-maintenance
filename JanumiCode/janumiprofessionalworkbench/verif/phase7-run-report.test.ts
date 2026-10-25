// ⭐ `JAN-EXEC` Phase 7, P7-2 D9 (DESIGN-the-live-end-to-end-run.md §1, §2, §6 P7-2, P7-3, P7-4d/f/g) — THE RUN REPORT'S
// DECISIONS, EACH SHOWN ABLE TO GO THE OTHER WAY, ON ROWS SHAPED AS THE STORES HOLD THEM; ITS COMMAND LINE; AND THE COPY
// TAKEN AFTER THE RUN.
//
// `scripts/phase7/run-report-core.ts` decides; this holds each decision on a fixture run built row by row:
//   · ⭐ what it restates of the product is the product's own text, read from the product's source;
//   · ⛔ THE PAIRING (`REG-F-433`): a subject with two floor runs is NOT PAIRABLE — by each of the three witnesses; a
//     review whose two calls threw is a NO RESPONSE; a substitute and a failed repair are each REFUSED and named; no
//     exchange, or a last call that concludes nothing, is NO ANSWER RECORDED; a throw then an answer is ANSWERED by the
//     retry; and a deterministic floor policy or a sign-off is listed as asking no model, never as unanswered;
//   · ⛔ THE AUDIT (P7-3): a step success is Begin & Execute's only in one of its two shapes AND beside its same-batch
//     hop — so an operator's completion naming ONE output is a hand completion (the critic's corrected rule); a retry,
//     a skip, a Mark Satisfied with no Record Assurance before it, and an abandon followed by a re-proposal are each
//     found; and a refused POST, which leaves no event, is found in the lane's own log;
//   · ⭐ THE MATRIX (§1): a complete run, a dry run, a stopped phase, runs past the 32nd, a narrated answer (K9), a
//     deterministic finding never sent back (`REG-F-515`), a review against the work — each cell one of §1's five
//     values, or OPEN and naming who decides it; ⛔ and, after the verifiers' round: a press past the allowance read as
//     cut (D4), runs that cannot be counted left open, K9 read where an account was handed, a stop's dropped runs
//     (`REG-F-511`), stage 8 asked whether a person can READ each exchange, and every break with no id marked so;
//   · ⭐ THE MANIFEST (P7-4d): a path inside the workspace made relative in both spellings, ⛔ one outside left out with
//     ITS command — never the manifest — and one naming the account, in either spelling it is written in, redacted;
//     ordinals in completion order; and the re-runner's own format check passing on what is written;
//   · ⭐ THE ADJUDICATION TABLE'S ROWS (P7-4f): each command's exit, the account its review was handed, the criteria;
//   · ⛔ THE COMMAND LINE, spawned under bun as the tracker's tests spawn theirs: it writes nothing when its own output
//     would name an absolute path (`REG-F-536`) — and a relative path is none — never replaces a report, reads the last
//     archive present, and opens no store in WAL mode;
//   · ⛔ `REG-F-545`: run as the gate runs it — no USERNAME, no USERPROFILE, so that Bun answers the user record's name
//     with `unknown` — it still WRITES the report, whose own cells print `unknown`; and with no account name to scan
//     for, the command line, the report and an argv each REFUSE, rather than scanning for nothing;
//   · ⭐ `finalize-run.ts`: the run folder copied whole, `-wal` and `-shm` with it, each link as a link, never over a copy
//     already taken, never left half-made as `<RUN>-final`, and this run's Playwright results alone copied into it.
//
// No model is called. The command line's stores are written by the product's own driver (`createSqliteDriver`) and
// turned to a rollback journal, as the lane archives a store.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
	deMinimisFloorPlan,
	FLOOR_POLICY_IDS,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ReasoningReviewInput
} from '@janumipwb/rph-assurance';
// ⭐ `JAN-EXEC` Phase 7 completion E2 — each declared policy's criteria, from the ontology the product seeds.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { createSqliteDriver, SCHEMA_SQL } from '@janumipwb/rph-persistence';
import { afterAll, describe, expect, it } from 'vitest';
import { main as finalize, RESULTS_NAME } from '../scripts/phase7/finalize-run.js';
import { manifestProblems } from '../scripts/phase7/rerun-commands.js';
// ⭐ P7-6 I5 (`p76-fix-c` C1) — the marker the validator OPENS every I5 record's detail with, which the report restates;
// and the validator, its sink and the floor's recorder, which write the I5 records these cases read (`i5Chain`).
import {
	createAgyReasoningReviewValidator,
	NO_CRITERION_ANSWERED as VALIDATOR_I5_MARKER,
	type AgyPrint
} from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { createExchangeSink } from '../apps/rph-demo/src/lib/server/assurance/exchange-capture.js';
import { mintIdsFor, toRecordModelExchange } from '../apps/rph-demo/src/lib/server/assurance/exchange-recorder.js';
// ⭐ P5 package A (F1) — the detail the validator writes on a reply the tool ended at the model's output-token limit.
import { outputLimitDetail } from '../apps/rph-demo/src/lib/server/tools/output-limit.js';
// ⭐ P5 package B's check (finding 2) — the builder of a declared review's input, whose prompts the report's reader reads.
import { declaredPolicyReviewInput } from '../apps/rph-demo/src/lib/server/assurance/review-input.js';
import {
	ALWAYS_STATED,
	buildRunReport,
	CELL_VALUES,
	contentVerdict,
	declaredWorkShown,
	DECLARED_RERUN_OPTION,
	DECLARED_REVIEW_VALIDATORS,
	DECLARED_SIGNOFF_VALIDATOR,
	DEMO_FINDING_CODE,
	DEMO_POLICY_ID,
	EVIDENCE_SCOPE_PREFIX,
	evidenceVerdictOf,
	exchangeReading,
	FLOOR_POLICIES,
	K5_OWED,
	manifestArgv,
	MODEL_EXECUTOR_NAME,
	NO_CRITERION_ANSWERED,
	OPERATOR_ACTOR_ID,
	OPERATOR_COMPLETION_DETAIL,
	OPERATOR_FAILURE_REASON,
	OUTSIDE,
	PAID_LIMIT,
	pairReview,
	pairRun,
	parseClass,
	PHASE7_UNITS,
	RECORDED_RUN_LIMIT,
	REDACTED,
	relativeToWorkspace,
	renderMarkdown,
	REPLAYED_DECLARED_REVIEW_VALIDATOR,
	ROOT_COMPLETION_DETAIL,
	stepSuccessShape,
	type ArchiveFacts,
	type DeclaredWorkShown,
	type LaneRows,
	type MatrixCell,
	type RunReport,
	type StoredContent,
	type StoredEvent,
	type StoredObject,
	type StoreRows
} from '../scripts/phase7/run-report-core.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RUN_REPORT = join(ROOT, 'scripts', 'phase7', 'run-report.ts');
const NAMES = ['jdoe'];
const B = '\\';
const DEMO_DB = 'E:/runs/p7/demo.sqlite';

const dirs: string[] = [];
afterAll(() => {
	for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const tempDir = (label: string): string => {
	const d = mkdtempSync(join(tmpdir(), `jpwb-p7-report-${label}-`));
	dirs.push(d);
	return d;
};

// ── A FIXTURE RUN, ROW BY ROW, IN THE SHAPES THE STORES HOLD (each shape read off the product; the real-store test,
// `apps/rph-demo/src/lib/server/execution/phase7-run-report.store.test.ts`, holds the same rules on rows it wrote) ──

type Floor = readonly [string, string, string];
interface Call {
	readonly role: string;
	readonly disposition: string;
	readonly ordinal: number;
	readonly runToken?: string;
	readonly parse?: string;
	/** E-5's detail, as the validator wrote it — what tells a P7-6 I5 chain (`NO_CRITERION_ANSWERED`, the marker opening it). */
	readonly detail?: string;
	/**
	 * ⭐ P5 package C (F1) — E-4's output truncation, as the floor projects it: `DECLARED` with the class's detail is a reply
	 * the tool cut at the model's output-token limit (`outputLimitOf`). Absent, the record carries none, as before.
	 */
	readonly outputTruncation?: string;
}
interface PhaseKnobs {
	/** Begin & Execute was pressed. Default true. */
	readonly begun?: boolean;
	/** The executor's tries: each its disposition, and its parse outcome (with a shortfall's detail). */
	readonly tries?: readonly { readonly disposition: string; readonly parse?: { outcome: string; detail: string } }[];
	/** Work products recorded — one per answered try by default; 0 for a phase that stopped before any. */
	readonly workProducts?: 0;
	readonly workProductFloor?: Floor;
	/** The work product's review calls. Default one INITIAL call, ACCEPTED. */
	readonly review?: readonly Call[];
	readonly commands?: number;
	readonly commandFloor?: Floor;
	/** Each command's review calls. Default one INITIAL call, ACCEPTED. */
	readonly commandReview?: readonly Call[];
	readonly stepState?: string;
	readonly unit?: { readonly lifecycle: string; readonly execution: string; readonly assurance: string };
	/**
	 * How the step's success was recorded: Begin & Execute's model path, by hand (naming the work product, or, ⭐ P5 package
	 * B's check, naming no output: `completeStep`'s default), or not at all.
	 */
	readonly completion?: 'model' | 'hand' | 'hand-no-output' | 'none';
	/** Capture folders the unit's archive gained. Default: one per command. */
	readonly captures?: number;
	readonly signedOff?: boolean;
	/** The lane's record of a sign-off attempted on this unit: Record Assurance's envelope. */
	readonly signOffPressed?: 'success' | 'failure';
	/** Begin & Execute outlasted the lane's allowance (D4): the lane recorded no answer, and the run ended here. */
	readonly timedOutAfterMs?: number;
	/** What the executor's tries retained: bytes that do not hash to their record, or nothing at all. */
	readonly content?: 'mismatch' | 'unretained';
	/**
	 * ⭐ P7-6 B7 (`REG-F-433`) — the floor-run token the work product's review was recorded under (its events'
	 * `correlationId`). Unset, the review's record carries none, as a run's before the join key did.
	 */
	readonly reviewToken?: string;
	/** ⭐ P7-6 B7 — later floor runs' reviews of the same work product (a re-review), each its state and its token. */
	readonly reReviews?: readonly { readonly state: string; readonly token?: string }[];
	/**
	 * ⭐ E2 (`REG-F-523`; design B8) — how the unit's declared policies were signed off: JUDGED by a reviewer, one row per
	 * criterion and the verdict computed from them (the default); by the pre-E2 sign-off (`legacy`); with one mandatory
	 * criterion left unanswered (`unanswered`); or with a verdict the answers do not give (`off-verdict`). ⭐ R3-A F2 — or judged
	 * as `judged` is, by a REPLAY of a recorded run (`replayed`): completed under the replayed declared reviewer's own id.
	 */
	readonly declared?: DeclaredKnob;
	/**
	 * ⭐ `E12F` F7 — ONE of the unit's declared policies DECLARES REQUIRED EVIDENCE, so its own evidence can CAP a verdict
	 * below its answers (`supportedDisposition`): the policy, the verdict recorded, and whether its first criterion was
	 * answered NOT_MET. ⚠ Name a policy no earlier unit declares: a policy object is put once, by the first unit to sign it off.
	 */
	readonly evidenced?: { readonly policyId: string; readonly recorded: string; readonly unmet?: boolean };
	/**
	 * ⭐ P5 package B (F5) — what the unit's archive's `checks.json` records of K5's causes (`run-archive.ts`, `k5.causes`), each
	 * whether the record leaves it possible. Unset, the archive records no K5 check.
	 */
	readonly k5?: readonly { readonly cause: string; readonly possible: boolean }[];
}
type DeclaredKnob = 'judged' | 'legacy' | 'unanswered' | 'off-verdict' | 'replayed';
/** ⭐ R3-A F2 — the id a replayed declared verdict is completed under (`declared-policy-review.ts`), written here as the product writes it. */
const REPLAYED_DECLARED = 'replay.declared-policy';
/** ⭐ E2 — each catalog policy's criteria, as the product seeds them (`seedAdditivePolicies`). */
const POLICY_CRITERIA = new Map<string, readonly { readonly id: string; readonly severityIfNotMet: string }[]>(
	ontology.seedPolicies.map((p) => [p.policyId, p.criteria])
);
type Slug = 'requirements' | 'design' | 'implementation' | 'end-to-end';
const SATISFIED: Floor = ['SATISFIED', 'SATISFIED', 'SATISFIED'];
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** A run's rows and the lane's files. By default a complete run: the root and the four phases, each SATISFIED. */
function aRun(
	knobs: Partial<Record<Slug, PhaseKnobs>> = {},
	o: {
		readonly extraEvents?: readonly Omit<StoredEvent, 'sequence'>[];
		readonly lane?: Partial<LaneRows>;
		/** Fields of `lane/run.json` beside its units — its mode and its end. */
		readonly run?: Record<string, unknown>;
		/**
		 * The root signed off. Default true — ~~the lane's dry run signs it off too (D11)~~ ⛔ `E12F` F1: a paid run's, and a
		 * dry run's before `REG-D-112` (b); false is a run cut short before its sign-offs, or a dry run's since, its sign-off
		 * rehearsed and never pressed.
		 */
		readonly rootSignedOff?: boolean;
		/** ⭐ E2 — how the root's declared policies were signed off (`PhaseKnobs.declared`). Default `judged`. */
		readonly rootDeclared?: DeclaredKnob;
		/** The archive read holds the content store. Default true. */
		readonly contentStore?: boolean;
	} = {}
): { store: StoreRows; lane: LaneRows } {
	let seq = 0;
	let ui = 100;
	const objects: StoredObject[] = [];
	const events: StoredEvent[] = [];
	const content: StoredContent[] = [];
	const put = (objectType: string, id: string, state: Record<string, unknown>) =>
		objects.push({ id, objectType, state, firstSequence: ++seq });
	const emit = (
		eventType: string,
		aggregateId: string,
		payload: Record<string, unknown>,
		commandId: string | null = null,
		correlationId?: string
	) =>
		events.push({
			sequence: ++seq,
			eventType,
			aggregateType: '',
			aggregateId,
			commandId,
			payload,
			...(correlationId === undefined ? {} : { correlationId })
		});
	/** A ref the content store holds, and its row — the bytes `text`, hashed as the reader hashes them; ⛔ or not. */
	const stored = (key: string, text: string, fault?: 'mismatch') => {
		const contentHash = `sha256:${sha(text)}`;
		content.push({
			storageKey: key,
			contentHash,
			byteSize: text.length,
			purged: false,
			actualHash: fault === 'mismatch' ? `sha256:${sha('other bytes')}` : contentHash,
			actualSize: text.length
		});
		return { status: 'STORED', storageKey: key, contentHash, byteSize: text.length };
	};
	const pending = { status: 'PENDING_CONTENT_PLANE', reason: 'no content store was wired on this path' };
	/** What an exchange retained of what it was asked and what it answered — a call that got no answer retains none. */
	const refs = (id: string, disposition: string, fault?: 'mismatch' | 'unretained') =>
		fault === 'unretained'
			? { materializedInputRef: pending, answerSpanRef: pending }
			: {
					materializedInputRef: stored(`k_in_${id}`, `asked ${id}`),
					answerSpanRef:
						disposition === 'NO_RESPONSE'
							? pending
							: stored(`k_ans_${id}`, `answered ${id}`, fault === 'mismatch' ? fault : undefined)
				};
	const assess = (id: string, policyId: string, subject: string, state: string, validatorId?: string) => {
		put('ASSURANCE_ASSESSMENT', id, { assurancePolicyId: policyId, subjectObjectIds: [subject], assessmentState: state });
		if (validatorId) emit('AssuranceAssessmentCompleted', id, { assessmentId: id, validatorId });
	};
	const floor = (subject: string, states: Floor) =>
		FLOOR_POLICIES.forEach((p, i) => assess(`asmt_${subject}_${i}`, p, subject, states[i]!));
	const reviewCalls = (subject: string, calls: readonly Call[]) =>
		calls.forEach((c, i) =>
			put('MODEL_EXCHANGE', `mex_${subject}_${i}`, {
				plane: 'ASSURANCE',
				assurancePolicyId: 'floor.reasoning-review',
				subjectObjectId: subject,
				runToken: c.runToken ?? `run_${subject}`,
				attemptOrdinal: c.ordinal,
				exchangeRole: c.role,
				disposition: c.disposition,
				parseOutcome: { outcome: c.parse ?? 'PARSED', detail: c.detail ?? '' },
				...(c.outputTruncation === undefined ? {} : { outputTruncation: c.outputTruncation }),
				...refs(`mex_${subject}_${i}`, c.disposition)
			})
		);
	const hop = (unitId: string, planId: string) =>
		emit(
			'PwuStateChanged',
			unitId,
			{ previousState: 'EXECUTING', newState: 'EXECUTING', executionState: 'SUCCEEDED', supportingObjectIds: [planId] },
			`ui-${++ui}`
		);
	const policiesPut = new Set<string>();
	/**
	 * ⭐ E2 — ONE DECLARED VERDICT AS THE SIGN-OFF RECORDS IT NOW: the policy's criteria each recorded
	 * (`AssuranceCriterionEvaluated`), the verdict computed from them, completed under the declared reviewer, its evaluator's
	 * invocation the review's token — or, `legacy`, as the pre-E2 sign-off recorded it: no criterion, its own validator.
	 */
	const declaredVerdict = (
		asm: string,
		policyId: string,
		unitId: string,
		how: DeclaredKnob,
		evidenced?: PhaseKnobs['evidenced']
	) => {
		if (how === 'legacy') return assess(asm, policyId, unitId, 'SATISFIED', DECLARED_SIGNOFF_VALIDATOR);
		const criteria = POLICY_CRITERIA.get(policyId) ?? [];
		// ⭐ `E12F` F7 — the one policy the knob names declares required evidence, gating SATISFIED alone (its ceiling then
		// CONDITIONALLY_SATISFIED), as four of the catalog's kinds' policies do.
		const ev = evidenced?.policyId === policyId ? evidenced : undefined;
		if (!policiesPut.has(policyId))
			put('ASSURANCE_POLICY', policyId, {
				criteria: criteria.map((c) => ({ id: c.id, severityIfNotMet: c.severityIfNotMet })),
				...(ev ? { requiredEvidence: [{ requirementId: 'RE-1', requiredForDispositions: 'SATISFIED_ONLY', cardinality: 'ONE_OR_MORE' }] } : {})
			});
		policiesPut.add(policyId);
		let state = 'SATISFIED';
		if (how === 'unanswered') state = 'INCONCLUSIVE';
		if (how === 'off-verdict') state = 'REJECTED';
		if (ev) state = ev.recorded;
		put('ASSURANCE_ASSESSMENT', asm, {
			assurancePolicyId: policyId,
			subjectObjectIds: [unitId],
			assessmentState: state,
			evaluator: { actorId: 'devin', actorType: 'AGENT', executionInstanceId: `declared-review:${asm}` },
			producer: { actorId: 'model:fixture-executor-model', actorType: 'AGENT' }
		});
		criteria.forEach((c, j) =>
			emit('AssuranceCriterionEvaluated', asm, {
				assessmentId: asm,
				criterionId: c.id,
				result: (how === 'unanswered' || ev?.unmet === true) && j === 0 ? (ev?.unmet ? 'NOT_MET' : 'UNABLE_TO_DETERMINE') : 'MET'
			})
		);
		emit('AssuranceAssessmentCompleted', asm, {
			assessmentId: asm,
			validatorId: how === 'replayed' ? REPLAYED_DECLARED : DECLARED_REVIEW_VALIDATORS[0]
		});
	};
	const signOff = (
		unitId: string,
		policyIds: readonly string[],
		how: DeclaredKnob = 'judged',
		evidenced?: PhaseKnobs['evidenced']
	) => {
		policyIds.forEach((p, i) => declaredVerdict(`asm_${unitId}_${i}`, p, unitId, how, evidenced));
		assess(`asm_${unitId}_demo`, DEMO_POLICY_ID, unitId, 'SATISFIED', 'workbench.demo-signoff');
		emit('PwuStateChanged', unitId, {
			previousState: 'UNDER_ASSURANCE',
			newState: 'UNDER_ASSURANCE',
			assuranceState: 'SATISFIED',
			supportingObjectIds: [`asm_${unitId}_demo`]
		});
		emit('PwuStateChanged', unitId, { previousState: 'UNDER_ASSURANCE', newState: 'SATISFIED', assuranceState: 'SATISFIED' });
	};

	put('PROFESSIONAL_WORK_ARCHITECTURE', 'pwa_1', { name: 'CLI Product Realization', publicationStatus: 'PUBLISHED' });
	put('UNDERTAKING', 'und_1', { name: 'wordfreq realization', status: 'ACTIVE' });
	for (const u of PHASE7_UNITS) emit('PwuProposed', `pwu_${u.slug}`, { pwuId: `pwu_${u.slug}` });
	emit('DecompositionProposed', 'dcp_1', {});
	const archives: ArchiveFacts[] = [{ name: '01-root', workspaceTree: null, captures: null }];
	const captures: string[] = [];
	const laneUnits: Record<string, unknown>[] = [];

	// The root: Begin & Execute's model-free path — signed off, unless the run was cut short before its sign-offs.
	const rootSignedOff = o.rootSignedOff ?? true;
	put('PROFESSIONAL_WORK_UNIT', 'pwu_root', {
		title: PHASE7_UNITS[0]!.type.name,
		undertakingId: 'und_1',
		workLifecycleState: rootSignedOff ? 'SATISFIED' : 'EXECUTING',
		executionState: 'SUCCEEDED',
		assuranceState: rootSignedOff ? 'SATISFIED' : 'UNASSESSED'
	});
	put('EXECUTION_PLAN', 'plan_root', { workUnitId: 'pwu_root', steps: [{ id: 'step_root', stepState: 'SUCCEEDED' }] });
	emit('ExecutionStepStarted', 'plan_root', { stepId: 'step_root' });
	emit(
		'ExecutionStepSucceeded',
		'plan_root',
		{ outputArtifactIds: [], proposedEvidenceIds: [], noOutputResult: { detail: ROOT_COMPLETION_DETAIL } },
		`ui-${++ui}`
	);
	hop('pwu_root', 'plan_root');
	laneUnits.push({ order: 1, slug: 'root', unitId: 'pwu_root', beginExecute: { status: 200, envelopeType: 'success', timedOutAfterMs: null } });

	for (const spec of PHASE7_UNITS.slice(1)) {
		const k = knobs[spec.slug as Slug] ?? {};
		const id = `pwu_${spec.slug}`;
		const begun = k.begun ?? true;
		const stepState = k.stepState ?? 'SUCCEEDED';
		const unit = k.unit ?? (begun ? { lifecycle: 'SATISFIED', execution: 'SUCCEEDED', assurance: 'SATISFIED' } : undefined);
		put('PROFESSIONAL_WORK_UNIT', id, {
			title: spec.type.name,
			undertakingId: 'und_1',
			parentWorkUnitId: 'pwu_root',
			workLifecycleState: unit?.lifecycle ?? 'PROPOSED',
			executionState: unit?.execution ?? 'NOT_STARTED',
			assuranceState: unit?.assurance ?? 'UNASSESSED'
		});
		let beginExecute: Record<string, unknown> | null = null;
		if (k.timedOutAfterMs !== undefined) beginExecute = { status: null, envelopeType: null, timedOutAfterMs: k.timedOutAfterMs };
		else if (begun) beginExecute = { status: 200, envelopeType: stepState === 'SUCCEEDED' ? 'success' : 'failure', timedOutAfterMs: null };
		laneUnits.push({
			order: spec.order,
			slug: spec.slug,
			unitId: id,
			beginExecute,
			...(k.signOffPressed
				? { signOff: { offered: true, recordAssurance: { status: 200, envelopeType: k.signOffPressed }, markSatisfied: null } }
				: {})
		});
		if (!begun) continue;
		const plan = `plan_${spec.slug}`;
		put('EXECUTION_PLAN', plan, { workUnitId: id, steps: [{ id: `step_${spec.slug}`, stepState }] });
		emit('ExecutionStepStarted', plan, { stepId: `step_${spec.slug}` });
		const art = `art_${spec.slug}`;
		for (const [i, t] of (k.tries ?? [{ disposition: 'ACCEPTED' }]).entries())
			put('MODEL_EXCHANGE', `mex_${spec.slug}_try${i}`, {
				plane: 'EXECUTION',
				subjectObjectId: id,
				disposition: t.disposition,
				parseOutcome: t.parse ?? { outcome: 'PARSED', detail: '' },
				workProductDerivation: { storageKey: `k_${art}` },
				...refs(`mex_${spec.slug}_try${i}`, t.disposition, k.content)
			});
		const evidence: string[] = [];
		if (k.workProducts !== 0) {
			// ⭐ P5 package B's check (finding 4) — and the attempt that made it, as Begin & Execute records it: the step's first.
			put('ARTIFACT', art, {
				producingPwuId: id,
				producingExecutionAttemptId: `step_${spec.slug}#1`,
				storageKey: `k_${art}`,
				contentHash: `sha256:${sha(art)}`
			});
			floor(art, k.workProductFloor ?? SATISFIED);
			// ⭐ P7-6 B7 — each review's recording carried its floor run's token, as the floor now records it.
			if (k.reviewToken !== undefined) emit('AssuranceAssessmentRequested', `asmt_${art}_2`, {}, null, k.reviewToken);
			for (const [i, again] of (k.reReviews ?? []).entries()) {
				const id = `asmt_${art}_again${i + 1}`;
				put('ASSURANCE_ASSESSMENT', id, { assurancePolicyId: 'floor.reasoning-review', subjectObjectIds: [art], assessmentState: again.state });
				if (again.token !== undefined) emit('AssuranceAssessmentRequested', id, {}, null, again.token);
			}
			reviewCalls(art, k.review ?? [{ role: 'INITIAL', disposition: 'ACCEPTED', ordinal: 1 }]);
			for (let i = 1; i <= (k.commands ?? 0); i++) {
				const evd = `evd_${spec.slug}_${i}`;
				evidence.push(evd);
				put('EVIDENCE', evd, {
					scope: `${EVIDENCE_SCOPE_PREFIX}${id}`,
					contentReference: {
						command: ['node', '--test', `test/${spec.slug}-${i}.test.js`],
						exitCode: 0,
						timedOut: false,
						durationMs: 5,
						// ⭐ P5 package B (F4) — the attempt that ran it, as the evidence join records it: the step's first.
						producingExecutionAttemptId: `step_${spec.slug}#1`,
						capture: { retained: true, stdoutPath: `captures/${spec.slug}-${i}/stdout.txt`, stderrPath: `captures/${spec.slug}-${i}/stderr.txt` }
					}
				});
				emit('EvidenceProposed', evd, {
					scope: `${EVIDENCE_SCOPE_PREFIX}${id}`,
					producedBy: { actorId: 'model:fixture-executor', actorType: 'AGENT', displayName: MODEL_EXECUTOR_NAME }
				});
				floor(evd, k.commandFloor ?? SATISFIED);
				reviewCalls(evd, k.commandReview ?? [{ role: 'INITIAL', disposition: 'ACCEPTED', ordinal: 1 }]);
			}
		}
		const completion = k.completion ?? (stepState === 'SUCCEEDED' ? 'model' : 'none');
		if (completion === 'model') {
			emit(
				'ExecutionStepSucceeded',
				plan,
				{
					outputArtifactIds: [art],
					proposedEvidenceIds: evidence,
					executionProvenance: { executedBy: { actorId: 'model:fixture-executor', actorType: 'AGENT', displayName: MODEL_EXECUTOR_NAME } }
				},
				`ui-${++ui}`
			);
			hop(id, plan);
		} else if (completion === 'hand' || completion === 'hand-no-output')
			emit(
				'ExecutionStepSucceeded',
				plan,
				{
					// ⭐ P5 package B's check (finding 4) — `completeStep` names no output unless the person chose one.
					...(completion === 'hand'
						? { outputArtifactIds: [art] }
						: { outputArtifactIds: [], noOutputResult: { reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT', detail: OPERATOR_COMPLETION_DETAIL } }),
					proposedEvidenceIds: [],
					executionProvenance: { executedBy: { actorId: 'local-professional', actorType: 'HUMAN', displayName: 'Operator' } }
				},
				`ui-${++ui}`
			);
		if (k.signedOff ?? (unit?.lifecycle === 'SATISFIED')) signOff(id, spec.type.policyIds, k.declared, k.evidenced);
		for (let i = 1; i <= (k.captures ?? k.commands ?? 0); i++) captures.push(`${spec.slug}-${i}`);
		archives.push({
			name: `${String(spec.order).padStart(2, '0')}-${spec.slug}`,
			workspaceTree: sha(spec.slug),
			captures: [...captures],
			...(k.k5 ? { k5Causes: k.k5 } : {})
		});
	}
	if (rootSignedOff) signOff('pwu_root', PHASE7_UNITS[0]!.type.policyIds, o.rootDeclared);
	for (const e of o.extraEvents ?? []) events.push({ ...e, sequence: ++seq });
	return {
		store: { objects, events, content: o.contentStore === false ? null : content },
		lane: {
			run: { mode: 'paid', units: laneUnits, end: { reason: 'complete' }, ...o.run },
			boot: { startedAt: '2026-10-09T12:00:00.000Z', overlay: { JPWB_DEMO_DB: DEMO_DB } },
			posts: [],
			actions: [],
			archives,
			archiveRead: '06-final',
			problems: [],
			...o.lane
		}
	};
}

const reportOf = (run: ReturnType<typeof aRun>) => buildRunReport(run.store, run.lane, { accountNames: NAMES });
/**
 * ⭐ P5 package B (F5) — K5's four causes of a capture folder no evidence names, as an archive's `checks.json` records them
 * (`run-archive.ts` `causesOf`, worded by `k5-causes.ts`): the report takes a captured run's cause from the ones possible.
 */
const K5 = {
	cap: 'a run after the first 32, which the product keeps as no evidence (REG-F-517)',
	stop: 'the step stopped before its evidence join: a try that did not run, a work product that could not be recorded, or a sandbox or executor that refused to open',
	join: 'the evidence join refused part-way, and the runs after the one it could not record got none',
	own: 'a folder a command wrote itself: a command runs as the server’s user, unconfined (REG-F-521), and can reach this folder'
} as const;
/** K5's causes, those named possible and the rest not, in the order the archive records them. */
const causes = (...possible: (keyof typeof K5)[]) =>
	(Object.keys(K5) as (keyof typeof K5)[]).map((k) => ({ cause: K5[k], possible: possible.includes(k) }));
const cellOf = (r: RunReport, stage: string, row: string): MatrixCell => {
	const c = r.matrix.find((m) => m.stage === stage && m.row === row);
	expect(c, `no cell ${stage} × ${row}`).toBeDefined();
	return c!;
};
/** The audit's act of that name — ⛔ asserted present first, so an act the audit drops reddens naming it, never as a TypeError. */
const actOf = (r: RunReport, name: string): RunReport['audit']['acts'][number] => {
	const a = r.audit.acts.find((x) => x.act === name);
	expect(a, `the audit lists no act named "${name}"`).toBeDefined();
	return a!;
};
const shown = (c: MatrixCell) => [c.value, c.registerIds];
const exchange =(state: Record<string, unknown>, id = 'mex_x'): StoredObject => ({
	id,
	objectType: 'MODEL_EXCHANGE',
	state,
	firstSequence: 1
});
const call = (
	role: string,
	disposition: string,
	ordinal: number,
	o: { runToken?: string; parse?: string; detail?: string } = {}
) =>
	exchange(
		{
			exchangeRole: role,
			disposition,
			attemptOrdinal: ordinal,
			runToken: o.runToken ?? 'run_1',
			parseOutcome: { outcome: o.parse ?? 'PARSED', detail: o.detail ?? '' }
		},
		`mex_${role}_${ordinal}_${o.runToken ?? 'run_1'}`
	);

describe('JAN-EXEC P7-2 D9 — what the report restates of the product is the product’s own', () => {
	const source = (file: string) => readFileSync(join(ROOT, file), 'utf8');
	const page = source('apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts');

	it('⭐ the completion shapes and the evidence scope are the Undertaking page’s own text', () => {
		expect(page).toContain(`'${ROOT_COMPLETION_DETAIL}'`);
		expect(page).toContain(`detail: '${OPERATOR_COMPLETION_DETAIL}'`);
		expect(page).toContain(`|| '${OPERATOR_FAILURE_REASON}'`);
		expect(page).toContain(`displayName: '${MODEL_EXECUTOR_NAME}'`);
		expect(page).toContain('scope: `' + EVIDENCE_SCOPE_PREFIX + '${pwuId}`');
	});

	it('⭐ the policy, the validator, the finding code and the cap are declared where the report says they are', () => {
		expect(source('apps/rph-demo/src/lib/server/assurance/demo-policy.ts')).toContain(
			`export const DEMO_POLICY_ID = '${DEMO_POLICY_ID}';`
		);
		expect(source('apps/rph-demo/src/lib/server/assurance/demo-policy.ts')).toContain(
			`export const DEMO_FINDING_CODE = '${DEMO_FINDING_CODE}';`
		);
		expect(source('apps/rph-demo/src/lib/server/assurance/declared-policy-signoff.ts')).toContain(
			`export const DEMO_REVIEW_VALIDATOR_ID = '${DECLARED_SIGNOFF_VALIDATOR}';`
		);
		// ⭐ E2 — the validators a declared verdict is recorded under now, each where the product declares it.
		const [model, standin, unconfigured, missing, replayed] = DECLARED_REVIEW_VALIDATORS;
		const review = source('apps/rph-demo/src/lib/server/assurance/declared-policy-review.ts');
		expect(review).toContain(`export const DECLARED_REVIEW_VALIDATOR_ID = '${model}';`);
		expect(review).toContain(`export const STANDIN_DECLARED_REVIEW_VALIDATOR_ID = '${standin}';`);
		expect(review).toContain(`export const UNCONFIGURED_DECLARED_REVIEWER_ID = '${unconfigured}';`);
		// ⭐ R3-A F2 — and a replayed one's, which this file's fixture writes as the product does.
		expect(review).toContain(`export const REPLAY_DECLARED_REVIEW_VALIDATOR_ID = '${replayed}';`);
		expect([replayed, REPLAYED_DECLARED_REVIEW_VALIDATOR]).toEqual([REPLAYED_DECLARED, REPLAYED_DECLARED]);
		expect(source('apps/rph-demo/src/lib/server/assurance/declared-policy-signoff.ts')).toContain(`validatorId: '${missing}',`);
		// ⭐ `E12F` F3 — the option a person's re-run of the declared reviews selects.
		expect(source('apps/rph-demo/src/lib/server/assurance/declared-policy-signoff.ts')).toContain(
			`export const RERUN_DECLARED_REVIEWS = '${DECLARED_RERUN_OPTION}';`
		);
		expect(source('apps/rph-demo/src/lib/server/identity.ts')).toContain(`actorId: '${OPERATOR_ACTOR_ID}',`);
		expect(source('apps/rph-demo/src/lib/server/tools/process-run-observer.ts')).toContain(
			`export const OBSERVED_PROCESS_RUN_LIMIT = ${RECORDED_RUN_LIMIT};`
		);
	});

	it('⭐ the floor’s policies, in the plan’s order, are the package’s own', () => {
		const plan = deMinimisFloorPlan({
			subjectId: 'x',
			objectType: 'ARTIFACT',
			semanticVersion: 1,
			isAiProduced: true,
			producer: { actorType: 'AGENT', agentId: 'a', modelId: 'm', providerId: 'p' }
		});
		expect(plan.map((p) => p.policyId)).toEqual([...FLOOR_POLICIES]);
		expect(Object.values(FLOOR_POLICY_IDS).sort()).toEqual([...FLOOR_POLICIES].sort());
	});

	it('⭐ each of the five envelope shortfalls K9 names is the execution contract’s own sentence', () => {
		const contract = source('apps/rph-demo/src/lib/server/execution/execution-contract.ts');
		for (const sentence of [
			'The answer is not a JSON object, so the execution contract’s envelope could not be read.',
			'The answer is not a JSON object.',
			'The answer carries no `workProduct` field',
			'The envelope declared no `rationale`',
			'A `rationale` object was returned with no account in it.'
		])
			expect(contract, sentence).toContain(sentence);
	});

	it('⛔ CONTROL — each pinned text is the page’s own, found ONCE: one emptied, or common, would pass its pin on its quotes alone', () => {
		// What this catches: a restated sentence that collapsed to text every source holds — `''` is on the page dozens of
		// times — turns its pin above green without saying anything. Its own mutant empties ROOT_COMPLETION_DETAIL.
		for (const needle of [
			`'${ROOT_COMPLETION_DETAIL}'`,
			`detail: '${OPERATOR_COMPLETION_DETAIL}'`,
			`|| '${OPERATOR_FAILURE_REASON}'`,
			`displayName: '${MODEL_EXECUTOR_NAME}'`,
			'scope: `' + EVIDENCE_SCOPE_PREFIX + '${pwuId}`'
		])
			expect(page.split(needle).length - 1, needle).toBe(1);
		expect(page).not.toContain(`'${ROOT_COMPLETION_DETAIL.replace('execution axis', 'execution axes')}'`);
	});
});

describe('JAN-EXEC P7-2 D9 — the pairing of a review with the call that concluded it (stage 8; REG-F-433)', () => {
	it('⭐ one floor run, its call answered: ANSWERED, concluded by that call', () => {
		const p = pairReview('evd_1', 1, [call('INITIAL', 'ACCEPTED', 1)]);
		expect([p.label, p.floorRuns, p.concludedBy, p.calls]).toEqual(['answered', 1, 'mex_INITIAL_1_run_1', ['INITIAL:ACCEPTED']]);
	});

	it('⛔ two floor runs on one subject — two runTokens, ordinals restarting at 1 — are NOT PAIRABLE, with the count', () => {
		const p = pairReview('evd_1', 2, [
			call('INITIAL', 'REJECTED', 1, { runToken: 'run_a', parse: 'PARSED' }),
			call('INITIAL', 'ACCEPTED', 1, { runToken: 'run_b' })
		]);
		expect([p.label, p.floorRuns, p.concludedBy]).toEqual(['not-pairable', 2, null]);
		expect(p.detail).toMatch(/had 2 floor runs, and no recorded key joins a review to its own run's calls \(REG-F-433\)/);
	});

	it('⛔ each witness of a second run is enough alone: a second review, a second runToken, or a second call at ordinal 1', () => {
		expect(pairReview('evd_1', 2, [call('INITIAL', 'ACCEPTED', 1)]).label).toBe('not-pairable');
		expect(
			pairReview('evd_1', 1, [call('INITIAL', 'ACCEPTED', 1, { runToken: 'a' }), call('RETRY', 'ACCEPTED', 2, { runToken: 'b' })])
				.label
		).toBe('not-pairable');
		// One review, one runToken — and the validator's counter restarted: two runs whose exchanges share a token.
		const restarted = pairReview('evd_1', 1, [call('INITIAL', 'ACCEPTED', 1), call('RETRY', 'ACCEPTED', 2), exchange({ exchangeRole: 'INITIAL', disposition: 'REJECTED', attemptOrdinal: 1, runToken: 'run_1' }, 'mex_again')]);
		expect([restarted.label, restarted.floorRuns]).toEqual(['not-pairable', 2]);
	});

	it('⛔ the highest call NO_RESPONSE: NO RESPONSE — both calls threw, or one at its bound that was not run again', () => {
		const both = pairReview('art_1', 1, [call('INITIAL', 'NO_RESPONSE', 1), call('RETRY', 'NO_RESPONSE', 2)]);
		expect([both.label, both.detail, both.calls]).toEqual([
			'no-response',
			'both calls threw: the call and its one retry (REG-D-102)',
			['INITIAL:NO_RESPONSE', 'RETRY:NO_RESPONSE']
		]);
		expect(pairReview('art_1', 1, [call('INITIAL', 'NO_RESPONSE', 1)]).detail).toMatch(/threw and was not run again/);
	});

	it('⭐ a throw, then an answer: ANSWERED, by the retry', () => {
		const p = pairReview('art_1', 1, [call('INITIAL', 'NO_RESPONSE', 1), call('RETRY', 'ACCEPTED', 2)]);
		expect([p.label, p.concludedBy]).toEqual(['answered', 'mex_RETRY_2_run_1']);
	});

	it('⛔ the highest call REJECTED: REFUSED — a substitute when no parse was attempted, else a failed repair', () => {
		const substitute = pairReview('art_1', 1, [call('INITIAL', 'REJECTED', 1, { parse: 'NOT_ATTEMPTED' })]);
		expect([substitute.label, substitute.refusal]).toEqual(['refused', 'substitute']);
		const repair = pairReview('art_1', 1, [
			call('INITIAL', 'REPAIR_REQUESTED', 1, { parse: 'JSON_PARSE_FAILED' }),
			call('REPAIR', 'REJECTED', 2, { parse: 'JSON_PARSE_FAILED' })
		]);
		expect([repair.label, repair.refusal]).toEqual(['refused', 'failed-repair']);
	});

	// ── ⭐⭐ `JAN-EXEC` Phase 7 P5, package A (F1) — A REPLY THE TOOL ENDED AT THE MODEL'S OUTPUT-TOKEN LIMIT HAS ITS OWN LABEL ──
	// It is recorded REJECTED and NOT_ATTEMPTED — a refused substitute's pair — with E-4's output truncation DECLARED and the
	// class's marker opening E-5 (`tools/output-limit.ts`). ⛔ Read by its pair alone, the report called it a model other
	// than the one configured, refused unread.
	/** A call the tool cut at the model's output-token limit, its E-5 the validator's own (`outputLimitDetail`). */
	const cutAt = (role: string, ordinal: number) =>
		exchange(
			{
				exchangeRole: role,
				disposition: 'REJECTED',
				attemptOrdinal: ordinal,
				runToken: 'run_1',
				outputTruncation: 'DECLARED',
				parseOutcome: {
					outcome: 'NOT_ATTEMPTED',
					detail: outputLimitDetail({
						facts: { outputTokens: 25_000 },
						partialChars: 0,
						elapsedMs: 90_010,
						clause: 'it was itself the one further call a thrown call is given (REG-D-102), so this failure stands',
						reported: 'reasoning-review backing tool invocation failed: devin invocation failed: (fixture)'
					})
				}
			},
			`mex_${role}_${ordinal}_run_1`
		);

	it('⛔ P5 A — the highest call cut at the output-token limit: OUTPUT LIMIT, concluded by it — never a substitute refused unread', () => {
		const p = pairReview('evd_1', 1, [cutAt('INITIAL', 1), cutAt('RETRY', 2)]);
		expect([p.label, p.refusal ?? null, p.concludedBy, p.detail]).toEqual([
			'output-limit',
			null,
			'mex_RETRY_2_run_1',
			"its RETRY call's reply was cut at the model's output-token limit, and nothing was judged from it"
		]);
	});

	it('⛔ P5 A — an I5 criterion repair cut at the output-token limit: the review kept the first reply’s judgement, and the report says why', () => {
		const p = pairReview('art_1', 1, [
			call('INITIAL', 'REPAIR_REQUESTED', 1, { parse: 'SCHEMA_COERCION_FAILED', detail: `${NO_CRITERION_ANSWERED} x` }),
			cutAt('REPAIR', 2)
		]);
		expect([p.label, p.concludedBy]).toEqual(['no-criterion-answered', 'mex_INITIAL_1_run_1']);
		expect(p.detail).toContain('its criterion repair was cut at the model’s output-token limit (REG-F-552)');
	});

	it('⛔ P5 A — after a cut, the first reply is its retry’s: an I5 retry whose repair did not parse concluded it', () => {
		const p = pairReview('art_1', 1, [
			cutAt('INITIAL', 1),
			call('RETRY', 'REPAIR_REQUESTED', 2, { parse: 'SCHEMA_COERCION_FAILED', detail: `${NO_CRITERION_ANSWERED} x` }),
			call('REPAIR', 'REJECTED', 3, { parse: 'JSON_EXTRACTION_FAILED' })
		]);
		expect([p.label, p.concludedBy]).toEqual(['no-criterion-answered', 'mex_RETRY_2_run_1']);
		expect(p.detail).toContain('its criterion repair did not parse (REG-F-552)');
	});

	it('⭑ CONTROL — a refused substitute is still REFUSED: the pair without the class’s marker and DECLARED is not the class', () => {
		const p = pairReview('art_1', 1, [
			call('INITIAL', 'REJECTED', 1, { parse: 'NOT_ATTEMPTED', detail: 'The reviewing tool reported another model.' })
		]);
		expect([p.label, p.refusal]).toEqual(['refused', 'substitute']);
	});

	it('⛔ no exchange at all, or a last call that concludes nothing: NO ANSWER RECORDED', () => {
		const none = pairReview('art_1', 1, []);
		expect([none.label, none.detail]).toEqual(['no-answer-recorded', 'no ASSURANCE-plane exchange names the subject (REG-F-525)']);
		const cut = pairReview('art_1', 1, [call('INITIAL', 'REPAIR_REQUESTED', 1, { parse: 'JSON_PARSE_FAILED' })]);
		expect([cut.label, cut.concludedBy]).toEqual(['no-answer-recorded', null]);
	});

	it('⛔ two calls at one subject’s highest ordinal in one run are not pairable', () => {
		expect(pairReview('art_1', 1, [call('INITIAL', 'ACCEPTED', 2), call('RETRY', 'ACCEPTED', 2)]).label).toBe('not-pairable');
	});

	// ── ⭐⭐ `JAN-EXEC` P7-6 B7 — `REG-F-433`'s JOIN KEY: EACH REVIEW PAIRED WITH ITS OWN RUN'S CALLS, BY THE RUN'S TOKEN ──────────
	// (`DESIGN-the-stopped-unit-recovery.md` RD10, as corrected.) A floor run's assessments now carry, as their correlation,
	// the token its reviewer calls carry as `runToken` (`floor-over-subject.ts`, `floor.ts`). ⛔ Without it a re-reviewed
	// work product — P7-6R's re-run of the review — was a subject with two floor runs, reported NOT PAIRABLE: P7-4f could not
	// adjudicate one review of it.
	it('⭐ B7 — a RE-REVIEWED work product: each review is paired with ITS OWN run’s calls, by the run’s token — never "not pairable"', () => {
		const r = reportOf(
			aRun({
				design: {
					workProductFloor: ['SATISFIED', 'SATISFIED', 'INCONCLUSIVE'],
					reviewToken: 'work-product-floor:art_design:wpfloor_a',
					reReviews: [{ state: 'SATISFIED', token: 'work-product-floor:art_design:wpfloor_b' }],
					review: [
						{ role: 'INITIAL', disposition: 'REPAIR_REQUESTED', ordinal: 1, parse: 'JSON_PARSE_FAILED', runToken: 'work-product-floor:art_design:wpfloor_a' },
						{ role: 'REPAIR', disposition: 'REJECTED', ordinal: 2, parse: 'JSON_PARSE_FAILED', runToken: 'work-product-floor:art_design:wpfloor_a' },
						{ role: 'INITIAL', disposition: 'ACCEPTED', ordinal: 1, runToken: 'work-product-floor:art_design:wpfloor_b' }
					]
				}
			})
		).report;
		expect(
			r.pairing.rows.filter((p) => p.unit === 'design').map((p) => [p.assessmentState, p.label, p.refusal ?? null, p.concludedBy, p.calls]),
			'a re-reviewed subject was not paired review by review (REG-F-433)'
		).toEqual([
			['INCONCLUSIVE', 'refused', 'failed-repair', 'mex_art_design_1', ['INITIAL:REPAIR_REQUESTED', 'REPAIR:REJECTED']],
			['SATISFIED', 'answered', null, 'mex_art_design_2', ['INITIAL:ACCEPTED']]
		]);
		expect(r.pairing.counts['not-pairable']).toBe(0);
	});

	it('⛔ B7 — a record with NO token (a run before the join key) keeps the refusal: two floor runs on its subject are NOT PAIRABLE, honestly', () => {
		const r = reportOf(
			aRun({
				design: {
					reReviews: [{ state: 'SATISFIED' }],
					review: [
						{ role: 'INITIAL', disposition: 'ACCEPTED', ordinal: 1, runToken: 'wpfloorrun_a' },
						{ role: 'INITIAL', disposition: 'ACCEPTED', ordinal: 1, runToken: 'wpfloorrun_b' }
					]
				}
			})
		).report;
		expect(r.pairing.rows.filter((p) => p.unit === 'design').map((p) => [p.label, p.floorRuns])).toEqual([
			['not-pairable', 2],
			['not-pairable', 2]
		]);
	});

	it('⛔ B7 — a run whose token names NO call recorded nothing: NO ANSWER RECORDED — never paired with another run’s calls, never "not pairable"', () => {
		// Two runs that recorded no call, beside one that did: each says so on its own, and none is pooled with the others.
		const r = reportOf(
			aRun({
				design: {
					reviewToken: 'work-product-floor:art_design:wpfloor_a',
					reReviews: [
						{ state: 'SATISFIED', token: 'work-product-floor:art_design:wpfloor_b' },
						{ state: 'INCONCLUSIVE', token: 'work-product-floor:art_design:wpfloor_c' }
					],
					review: [{ role: 'INITIAL', disposition: 'ACCEPTED', ordinal: 1, runToken: 'work-product-floor:art_design:wpfloor_b' }]
				}
			})
		).report;
		expect(r.pairing.rows.filter((p) => p.unit === 'design').map((p) => [p.label, p.joinedBy, p.concludedBy])).toEqual([
			['no-answer-recorded', 'run token', null],
			['answered', 'run token', 'mex_art_design_0'],
			['no-answer-recorded', 'run token', null]
		]);
	});

	it('⛔ B7 — a record from before the key beside one after it: the old review is paired by its subject over the calls NO token names — never with the new run’s', () => {
		const r = reportOf(
			aRun({
				design: {
					reReviews: [{ state: 'SATISFIED', token: 'work-product-floor:art_design:wpfloor_b' }],
					review: [
						{ role: 'INITIAL', disposition: 'NO_RESPONSE', ordinal: 1, runToken: 'wpfloorrun_a', parse: 'NOT_ATTEMPTED' },
						{ role: 'INITIAL', disposition: 'ACCEPTED', ordinal: 1, runToken: 'work-product-floor:art_design:wpfloor_b' }
					]
				}
			})
		).report;
		expect(r.pairing.rows.filter((p) => p.unit === 'design').map((p) => [p.label, p.joinedBy, p.floorRuns, p.calls])).toEqual([
			['no-response', 'subject', 1, ['INITIAL:NO_RESPONSE']],
			['answered', 'run token', 1, ['INITIAL:ACCEPTED']]
		]);
	});

	// ⛔ `p76-fix-c` C9 (b) — `pairRun`'s own refusal had no case: deleted, two runs sharing a token were paired as one, the
	// later run's last call taken as the review's conclusion. A third call above ordinal 1 is arranged on purpose: with only
	// the two firsts, `concludedFrom`'s "two calls share its highest ordinal" refuses too, so the case would not tell.
	it('⛔ B7 — two calls at ordinal 1 under ONE token are two runs sharing it: NOT PAIRABLE, said so — never concluded by the last call', () => {
		const token = 'work-product-floor:art_design:wpfloor_a';
		const shared = [
			call('INITIAL', 'REPAIR_REQUESTED', 1, { runToken: token, parse: 'JSON_EXTRACTION_FAILED' }),
			call('INITIAL', 'ACCEPTED', 1, { runToken: token }),
			call('REPAIR', 'ACCEPTED', 2, { runToken: token })
		];
		const p = pairRun(token, shared);
		expect([p.label, p.joinedBy, p.floorRuns, p.concludedBy, p.detail]).toEqual([
			'not-pairable',
			'run token',
			2,
			null,
			`2 calls at ordinal 1 carry the one floor-run token ${token}: two runs share it`
		]);
		const r = reportOf(aRun({ design: { reviewToken: token, review: shared.map((x) => ({ role: String(x.state.exchangeRole), disposition: String(x.state.disposition), ordinal: Number(x.state.attemptOrdinal), runToken: token })) } })).report;
		expect(r.pairing.rows.filter((row) => row.unit === 'design').map((row) => [row.label, row.joinedBy, row.concludedBy])).toEqual([
			['not-pairable', 'run token', null]
		]);
	});

	// ── ⭐⭐ `JAN-EXEC` P7-6 I5 READ TRUTHFULLY (`DESIGN-the-reviewer-isolated.md` §4d; `REG-F-552`) ─────────────────────────────
	// I5 repairs a reply that PARSED and answered no criterion, once, and the repair may only ADD a conclusion: when it answers
	// none, does not parse, or gets no reply, the review keeps the FIRST reply's judgement — yet the record ENDS on the repair.
	// ⛔ Read by "the highest ordinal concluded it", such a chain was reported a FAILED REPAIR (`REG-F-489`/`428`/`479`), or a
	// NO RESPONSE (`REG-F-499`), concluded by the repair — a review the record shows concluded on its first reply.
	// ⛔⛔ `p76-fix-c` C1 — AND TOLD BY THE MARKER THE VALIDATOR WRITES, ON RECORDS THE VALIDATOR WROTE. B2 told "the repair
	// answered none either" from "it did not parse" by whether the repair's detail held the FIRST reply's closing sentence —
	// which `P76F-A` A2 removed from a refused repair's record on purpose (it said of the repair that its own judgement was
	// kept). So, merged, a repair that parsed and answered none was reported "did not parse": a false cause. And these cases
	// passed throughout, because their details were HAND-TYPED in B's wording, which no validator writes any more.
	// ⭐ So every I5 record below is the product's own: a review run through the REAL validator, its model stubbed to reply as
	// each case scripts, each try projected to its stored shape by the floor's own recorder (`i5Chain`). A rewording of the
	// validator's details now reddens these cases instead of leaving them asserting on prose nobody writes.
	/** A reply that parses and answers no criterion — the measured run's own shape (`REG-F-552`). */
	const NO_ROWS = '{"findings":[],"recommendation":"SATISFIED","residualUncertainty":["x"]}';
	/** A reply answering every seeded criterion, met. */
	const ANSWERS = JSON.stringify({
		findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({ criterionId: c.id, failed: false, statement: 'met' })),
		recommendation: 'SATISFIED'
	});
	/** A reply that parses and answers none AGAIN — its one row names no criterion id (a cause of its own, A2). */
	const NONE_AGAIN = '{"findings":[{"failed":false,"statement":"met"}],"recommendation":"SATISFIED"}';
	/** A reply no JSON can be read from. */
	const PROSE = "I'll check the files the work product names first.";
	/**
	 * ⭐ `p76-fix-c` C1 — ONE REVIEW'S TRIES AS THE VALIDATOR RECORDS THEM: the real `createAgyReasoningReviewValidator`, its
	 * model stubbed (`AgyPrint`) to give each of `replies` in turn — an `Error` is a call that got no reply — and each record
	 * the sink drained projected by `toRecordModelExchange`, as the floor stores it, then read as the report reads a stored
	 * MODEL_EXCHANGE. Ids are `mex_<ROLE>_<ordinal>_run_1`, as `call` names them.
	 */
	const i5Chain = async (...replies: (string | Error)[]): Promise<StoredObject[]> => {
		let n = 0;
		const print: AgyPrint = async () => {
			const r = replies[n++] ?? '';
			if (r instanceof Error) throw r;
			return r;
		};
		const exchanges = createExchangeSink();
		await createAgyReasoningReviewValidator({ print, modelId: 'fixture-judge', exchanges }).evaluate(
			{
				subjectId: 'art_1',
				objectType: 'ARTIFACT',
				semanticVersion: 1,
				isAiProduced: true,
				producer: { actorType: 'AGENT', agentId: 'executor', modelId: 'executor-model', providerId: 'executor-provider' }
			},
			{
				reasoningReview: {
					criteria: SEEDED_REASONING_REVIEW_CRITERIA,
					framing: 'WORK_PRODUCT',
					prompt: 'Write the design',
					content: '# Design',
					narration: ''
				}
			}
		);
		const records = exchanges.drain();
		let minted = 0;
		const ids = mintIdsFor(records, () => `mex_${++minted}`);
		return records.map((rec) => {
			const p = toRecordModelExchange(
				rec,
				{
					runToken: 'run_1',
					plane: 'ASSURANCE',
					invokerId: 'floor.reasoning-review',
					assurancePolicyId: 'floor.reasoning-review',
					subjectObjectId: 'art_1',
					subjectObjectType: 'ARTIFACT',
					subjectSemanticVersion: 1,
					// The run's own mint, which the projection does not call: the ids are minted above, for the whole drain.
					newId: (prefix) => `${prefix}_unused`
				},
				ids
			);
			const state = { exchangeRole: p.exchangeRole, disposition: p.disposition, attemptOrdinal: p.attemptOrdinal, runToken: p.runToken, parseOutcome: p.parseOutcome };
			return exchange(state, `mex_${p.exchangeRole}_${p.attemptOrdinal}_run_1`);
		});
	};
	/** E-5's detail on a stored try. */
	const detailOf = (x: StoredObject | undefined): string => String((x?.state.parseOutcome as { detail?: unknown } | undefined)?.detail);

	it('⭐ I5 — a criterion repair that ANSWERS concludes the review: answered, by the repair — and SAID so, by the I5 reading alone', async () => {
		const chain = await i5Chain(NO_ROWS, ANSWERS);
		expect(chain.map((x) => `${x.state.exchangeRole}:${x.state.disposition}`), 'arrangement: an I5 chain').toEqual(['INITIAL:REPAIR_REQUESTED', 'REPAIR:ACCEPTED']);
		const p = pairReview('art_1', 1, chain);
		expect([p.label, p.concludedBy]).toEqual(['answered', 'mex_REPAIR_2_run_1']);
		// ⛔ `p76-fix-c` C9 (a): the general reading gives the same label and concluder (the repair is the last call), so only
		// the detail tells that the I5 reading made this row — without it, the row is "concluded by its REPAIR call".
		expect(p.detail).toBe('concluded by its REPAIR call, the criterion repair of a reply that answered no criterion (REG-F-552)');
	});

	it('⛔ I5 — a criterion repair that answers NONE either: concluded by the FIRST reply, REG-F-552’s case — never a failed repair, and never "did not parse"', async () => {
		const chain = await i5Chain(NO_ROWS, NONE_AGAIN);
		expect(chain.map((x) => `${x.state.exchangeRole}:${x.state.disposition}`), 'arrangement: an I5 chain').toEqual(['INITIAL:REPAIR_REQUESTED', 'REPAIR:REJECTED']);
		const p = pairReview('art_1', 1, chain);
		expect([p.label, p.refusal ?? null, p.concludedBy]).toEqual(['no-criterion-answered', null, 'mex_INITIAL_1_run_1']);
		expect(p.detail).toMatch(/answered no criterion, and its criterion repair answered none either \(REG-F-552\)/);
	});

	it('⛔ I5 — a criterion repair that does NOT PARSE: concluded by the FIRST reply, REG-F-552’s case — never a failed repair', async () => {
		const chain = await i5Chain(NO_ROWS, PROSE);
		expect(chain.map((x) => `${x.state.exchangeRole}:${x.state.disposition}`), 'arrangement: an I5 chain').toEqual(['INITIAL:REPAIR_REQUESTED', 'REPAIR:REJECTED']);
		const p = pairReview('art_1', 1, chain);
		expect([p.label, p.refusal ?? null, p.concludedBy]).toEqual(['no-criterion-answered', null, 'mex_INITIAL_1_run_1']);
		expect(p.detail).toMatch(/answered no criterion, and its criterion repair did not parse \(REG-F-552\)/);
	});

	it('⛔ I5 — a criterion repair that gets NO REPLY: concluded by the FIRST reply, REG-F-552’s case — never a no response', async () => {
		const chain = await i5Chain(NO_ROWS, new Error('devin invocation failed: connection reset'));
		expect(chain.map((x) => `${x.state.exchangeRole}:${x.state.disposition}`), 'arrangement: an I5 chain').toEqual(['INITIAL:REPAIR_REQUESTED', 'REPAIR:NO_RESPONSE']);
		const p = pairReview('art_1', 1, chain);
		expect([p.label, p.concludedBy]).toEqual(['no-criterion-answered', 'mex_INITIAL_1_run_1']);
		expect(p.detail).toMatch(/answered no criterion, and its criterion repair got no reply \(REG-F-552\)/);
		// ⭐ After a throw, the first reply is its RETRY: that reply concluded it. ⚠ Arranged by renumbering the validator's own
		// two records behind a call that threw — the stub validator runs no retry, since it declares no bound (`P7-2b`).
		const [first, repair] = chain;
		const at = (x: StoredObject, role: string, ordinal: number) =>
			exchange({ ...x.state, exchangeRole: role, attemptOrdinal: ordinal }, `mex_${role}_${ordinal}_run_1`);
		const retried = pairReview('art_1', 1, [call('INITIAL', 'NO_RESPONSE', 1, { parse: 'NOT_ATTEMPTED' }), at(first!, 'RETRY', 2), at(repair!, 'REPAIR', 3)]);
		expect([retried.label, retried.concludedBy]).toEqual(['no-criterion-answered', 'mex_RETRY_2_run_1']);
	});

	it('⭑ CONTROL — the I5 chain is told by the validator’s MARKER, never by SCHEMA_COERCION_FAILED, which a JSON repair’s first reply can carry too', async () => {
		const json = pairReview('art_1', 1, [
			call('INITIAL', 'REPAIR_REQUESTED', 1, { parse: 'SCHEMA_COERCION_FAILED', detail: 'The reply parsed and could not be coerced.' }),
			call('REPAIR', 'REJECTED', 2, { parse: 'JSON_PARSE_FAILED' })
		]);
		expect([json.label, json.refusal]).toEqual(['refused', 'failed-repair']);
		// ⛔ C1 — and the marker beside ANOTHER outcome is not the pair either: the key is both, each asked on its own (the
		// validator writes the marker only under SCHEMA_COERCION_FAILED, so this arrangement edits its record's outcome alone).
		const [asked, noneAgain] = await i5Chain(NO_ROWS, NONE_AGAIN);
		const otherOutcome = exchange(
			{ ...asked!.state, parseOutcome: { outcome: 'JSON_PARSE_FAILED', detail: detailOf(asked) } },
			asked!.id
		);
		const marker = pairReview('art_1', 1, [otherOutcome, noneAgain!]);
		expect([marker.label, marker.refusal, marker.concludedBy]).toEqual(['refused', 'failed-repair', 'mex_REPAIR_2_run_1']);
		// ⛔ And a criterion repair refused for WHO answered it is a substitute, as anywhere: the review failed on it.
		const [first] = await i5Chain(NO_ROWS, ANSWERS);
		const substitute = pairReview('art_1', 1, [first!, call('REPAIR', 'REJECTED', 2, { parse: 'NOT_ATTEMPTED' })]);
		expect([substitute.label, substitute.refusal, substitute.concludedBy]).toEqual(['refused', 'substitute', 'mex_REPAIR_2_run_1']);
	});

	it('⛔ I5 — the stage-4 cell names REG-F-552 for a review that concluded on a reply answering no criterion, and none of a failed repair’s or a no response’s ids', async () => {
		const [first] = await i5Chain(NO_ROWS, new Error('devin invocation failed: connection reset'));
		const r = reportOf(
			aRun({
				design: {
					workProductFloor: ['SATISFIED', 'SATISFIED', 'INCONCLUSIVE'],
					stepState: 'WAITING',
					unit: { lifecycle: 'EXECUTING', execution: 'WAITING', assurance: 'UNASSESSED' },
					review: [
						{ role: 'INITIAL', disposition: 'REPAIR_REQUESTED', ordinal: 1, parse: 'SCHEMA_COERCION_FAILED', detail: detailOf(first) },
						{ role: 'REPAIR', disposition: 'NO_RESPONSE', ordinal: 2, parse: 'NOT_ATTEMPTED' }
					]
				}
			})
		).report;
		const four = cellOf(r, '4', 'design');
		expect(four.value).toBe('broke');
		expect(four.registerIds).toContain('REG-F-552');
		for (const id of ['REG-F-489', 'REG-F-428', 'REG-F-479', 'REG-F-499']) expect(four.registerIds, id).not.toContain(id);
	});

	it('⭐ the MARKER the report tells an I5 chain by is the validator’s own export, and opens the request’s record and a repair’s that answered none — and no other', async () => {
		expect(typeof VALIDATOR_I5_MARKER, 'the validator exports no I5 marker').toBe('string');
		expect(NO_CRITERION_ANSWERED).toBe(VALIDATOR_I5_MARKER);
		const [asked, noneAgain] = await i5Chain(NO_ROWS, NONE_AGAIN);
		expect(detailOf(asked).startsWith(NO_CRITERION_ANSWERED), 'the request’s record').toBe(true);
		expect(detailOf(noneAgain).startsWith(NO_CRITERION_ANSWERED), 'a repair that answered none').toBe(true);
		const [, unparsed] = await i5Chain(NO_ROWS, PROSE);
		expect(detailOf(unparsed), 'a repair that did not parse').not.toContain(NO_CRITERION_ANSWERED);
	});

	it('⭐ only Reasoning Reviews are paired: a deterministic floor policy and every sign-off ask no model, BY DESIGN', () => {
		const r = reportOf(aRun({ implementation: { commands: 1 } })).report;
		expect(r.pairing.rows.map((p) => [p.unit, p.subjectKind, p.label])).toEqual([
			['requirements', 'work product', 'answered'],
			['design', 'work product', 'answered'],
			['implementation', 'work product', 'answered'],
			['implementation', 'command', 'answered'],
			['end-to-end', 'work product', 'answered']
		]);
		expect(
			Object.fromEntries(Object.entries(r.pairing.noModelAnswerByDesign).map(([k, ids]) => [k, ids.length]))
			// ⭐ E2 — the 14 declared verdicts each ASKED a reviewer now: listed with the declared verdicts, never as asking none.
		).toEqual({ 'deterministic floor policy': 10, 'declared-policy sign-off': 0, 'demo sign-off': 5, other: 0 });
		expect(r.pairing.counts['no-answer-recorded']).toBe(0);
	});
});

describe('⭐⭐ JAN-EXEC Phase 7 completion E2 — stage 5b read from the recorded criterion results (REG-F-523; design B8)', () => {
	it('⭐ a declared verdict is AS INTENDED when every criterion of its policy is answered and its verdict is the one they give', () => {
		const r = reportOf(aRun()).report;
		const row = r.declaredVerdicts.rows.find((d) => d.unit === 'design' && d.policyId === 'pol_architecture_coverage')!;
		expect([row.value, row.validatorId, row.criteria, row.followsFromAnswers, row.producer]).toEqual([
			'as intended',
			DECLARED_REVIEW_VALIDATORS[0],
			{ declared: 10, recorded: 10, answered: 10, undetermined: 0, stipulatedRows: 0 },
			true,
			'model:fixture-executor-model'
		]);
	});

	it('⛔ a mandatory criterion left UNANSWERED broke 5b (REG-F-489): the verdict follows, but not every criterion was judged', () => {
		const r = reportOf(aRun({ design: { declared: 'unanswered' } })).report;
		expect(shown(cellOf(r, '5b', 'design'))).toEqual(['broke', ['REG-F-489']]);
		expect(cellOf(r, '5b', 'design').basis.join(' ')).toMatch(/pol_assumption_disclosure: 1 of 6 criteria not answered/);
		expect(cellOf(r, '5b', 'requirements').value).toBe('as intended');
	});

	it('⛔ a verdict the answers do NOT give broke 5b, and no register entry names it (unregistered)', () => {
		const r = reportOf(aRun({ implementation: { declared: 'off-verdict' } })).report;
		const c = cellOf(r, '5b', 'implementation');
		expect([c.value, c.registerIds, c.unregistered]).toEqual(['broke', [], true]);
		expect(c.basis.join(' ')).toMatch(/pol_assumption_disclosure: recorded REJECTED, and its answers give SATISFIED/);
	});

	// ── ⛔ `E12F` F7 — A POLICY THAT DECLARES REQUIRED EVIDENCE: its ceiling may cap a verdict BELOW its answers, never above,
	// and never to a REJECTED (`supportedDisposition` answers SATISFIED, CONDITIONALLY_SATISFIED or INCONCLUSIVE). ⛔ No case
	// put required evidence on a policy, so `const capped = evidenced;` — any recorded verdict of such a policy read as
	// following from its answers — survived.
	it('⭐ E12F F7 — CONTROL: an evidenced policy capped BELOW its answers (CONDITIONALLY_SATISFIED over all met) is as intended', () => {
		const r = reportOf(aRun({ design: { evidenced: { policyId: 'pol_architecture_coverage', recorded: 'CONDITIONALLY_SATISFIED' } } })).report;
		const row = r.declaredVerdicts.rows.find((d) => d.unit === 'design' && d.policyId === 'pol_architecture_coverage')!;
		expect([row.state, row.followsFromAnswers, row.value]).toEqual(['CONDITIONALLY_SATISFIED', true, 'as intended']);
	});

	it('⛔ E12F F7 — an evidenced policy recorded ABOVE its answers (SATISFIED over a BLOCKING criterion NOT MET) broke 5b: a ceiling only lowers', () => {
		// ⛔ PREDICTED RED under `const capped = evidenced;`: as intended — the evidence read as excusing any verdict at all.
		const r = reportOf(aRun({ design: { evidenced: { policyId: 'pol_architecture_coverage', recorded: 'SATISFIED', unmet: true } } })).report;
		const row = r.declaredVerdicts.rows.find((d) => d.unit === 'design' && d.policyId === 'pol_architecture_coverage')!;
		expect([row.state, row.followsFromAnswers, row.value]).toEqual(['SATISFIED', false, 'broke']);
		expect(cellOf(r, '5b', 'design').basis.join(' ')).toMatch(/pol_architecture_coverage: recorded SATISFIED, and its answers give REJECTED/);
	});

	it('⛔ E12F F7 — an evidenced policy recorded REJECTED over answers that give SATISFIED broke 5b: no evidence ceiling rejects', () => {
		// ⛔ PREDICTED RED, read from the code: as intended — `capped` admitted any recorded verdict stricter than the answers'.
		const r = reportOf(aRun({ design: { evidenced: { policyId: 'pol_architecture_coverage', recorded: 'REJECTED' } } })).report;
		const row = r.declaredVerdicts.rows.find((d) => d.unit === 'design' && d.policyId === 'pol_architecture_coverage')!;
		expect([row.state, row.followsFromAnswers, row.value], 'a REJECTED read as an evidence cap').toEqual(['REJECTED', false, 'broke']);
	});

	// ── ⛔ E12’s re-review F5 — A REVIEW THAT ANSWERED NO CRITERION GIVES INCONCLUSIVE, as the sign-off computes it (`verdictOf`),
	// though the ladder over a policy none of whose criteria is mandatory would pass it.
	it('⛔ E12’s re-review F5 — a policy whose criteria are ALL non-mandatory, NONE answered: INCONCLUSIVE follows from its answers, SATISFIED does not', () => {
		// ⛔ PREDICTED RED, read from the code: the report's restatement read the ladder alone, so the sign-off's INCONCLUSIVE read
		// "recorded INCONCLUSIVE, and its answers give SATISFIED" — and a pre-fix archive's SATISFIED, with nothing checked,
		// followed from its answers.
		const HC = 'pol_historical_consistency';
		const criteria = POLICY_CRITERIA.get(HC)!;
		expect(criteria.length > 0 && criteria.every((c) => c.severityIfNotMet === 'MATERIAL'), 'arrangement: every criterion MATERIAL').toBe(true);
		const verdictOf = (state: string, met = 0) => {
			const run = aRun();
			let seq = 90_000;
			const object = (id: string, objectType: string, state: Record<string, unknown>): StoredObject => ({ id, objectType, state, firstSequence: ++seq });
			const event = (eventType: string, aggregateId: string, payload: Record<string, unknown>): StoredEvent => ({
				sequence: ++seq,
				eventType,
				aggregateType: '',
				aggregateId,
				commandId: null,
				payload
			});
			const store: StoreRows = {
				...run.store,
				objects: [
					...run.store.objects,
					object(HC, 'ASSURANCE_POLICY', { criteria: criteria.map((c) => ({ id: c.id, severityIfNotMet: c.severityIfNotMet })) }),
					object('asm_hc', 'ASSURANCE_ASSESSMENT', { assurancePolicyId: HC, subjectObjectIds: ['pwu_design'], assessmentState: state })
				],
				events: [
					...run.store.events,
					...criteria.map((c, i) =>
						event('AssuranceCriterionEvaluated', 'asm_hc', { assessmentId: 'asm_hc', criterionId: c.id, result: i < met ? 'MET' : 'UNABLE_TO_DETERMINE' })
					),
					event('AssuranceAssessmentCompleted', 'asm_hc', { assessmentId: 'asm_hc', validatorId: DECLARED_REVIEW_VALIDATORS[0] })
				]
			};
			const row = reportOf({ ...run, store }).report.declaredVerdicts.rows.find((d) => d.assessmentId === 'asm_hc')!;
			return [row.followsFromAnswers, row.registerIds, row.basis];
		};
		const unanswered = `${HC}: ${criteria.length} of ${criteria.length} criteria not answered (${criteria.map((c) => c.id).join(', ')})`;
		expect(verdictOf('INCONCLUSIVE'), 'the sign-off’s INCONCLUSIVE read as a verdict its answers do not give').toEqual([
			true,
			['REG-F-489'],
			[unanswered]
		]);
		expect(verdictOf('SATISFIED'), 'a SATISFIED with nothing checked read as following from its answers').toEqual([
			false,
			['REG-F-489'],
			[unanswered, `${HC}: recorded SATISFIED, and its answers give INCONCLUSIVE`]
		]);
		// ⭑ CONTROL — one criterion answered: the ladder decides, as before, and SATISFIED follows from it.
		const rest = criteria.slice(1);
		expect(verdictOf('SATISFIED', 1), 'one criterion answered').toEqual([
			true,
			['REG-F-489'],
			[`${HC}: ${rest.length} of ${criteria.length} criteria not answered (${rest.map((c) => c.id).join(', ')})`]
		]);
	});

	// ── ⛔⛔ E12’s polish (fix2’s F9; the lead’s delegated decision of 2026-10-15, to be registered) — 5b READS THE LATEST DECLARED
	// VERDICT PER (UNIT, POLICY), each superseded one listed as history beside it, as P7-6R's re-runs are listed.
	/**
	 * A complete run whose design unit's first declared policy was judged twice: a first review that answered nothing, made
	 * before the fixture's own, which stands as its re-run (REG-D-112 (a)) — `first`'s fields laid over the first review.
	 */
	const rerunOfDesign = (first: Record<string, unknown> = {}) => {
		const run = aRun();
		const policyId = PHASE7_UNITS[2]!.type.policyIds[0]!;
		let seq = 90_000;
		const event = (eventType: string, payload: Record<string, unknown>): StoredEvent => ({
			sequence: ++seq,
			eventType,
			aggregateType: '',
			aggregateId: 'asm_design_first',
			commandId: null,
			payload: { assessmentId: 'asm_design_first', ...payload }
		});
		const store: StoreRows = {
			...run.store,
			objects: [
				{
					id: 'asm_design_first',
					objectType: 'ASSURANCE_ASSESSMENT',
					state: { assurancePolicyId: policyId, subjectObjectIds: ['pwu_design'], assessmentState: 'INCONCLUSIVE', ...first },
					firstSequence: 0
				},
				...run.store.objects
			],
			events: [
				...run.store.events,
				...POLICY_CRITERIA.get(policyId)!.map((c) => event('AssuranceCriterionEvaluated', { criterionId: c.id, result: 'UNABLE_TO_DETERMINE' })),
				event('AssuranceAssessmentCompleted', { validatorId: DECLARED_REVIEW_VALIDATORS[0] })
			]
		};
		return { r: reportOf({ ...run, store }).report, policyId };
	};

	it('⛔ E12’s polish (fix2’s F9) — a unit the rule recovered by a re-run of its declared review reads as its LATEST verdict says: 5b as intended, the superseded review listed as history beside it, the heading 14 of 14', () => {
		// ⛔ PREDICTED RED, read from the code: every declared verdict was read as speaking — 5b broke (REG-F-489) from the review the
		// re-run replaced, and the heading read "15 of 14".
		const { r, policyId } = rerunOfDesign();
		const c = cellOf(r, '5b', 'design');
		expect([c.value, c.registerIds], 'the review the re-run replaced still speaks').toEqual(['as intended', []]);
		expect(c.basis.at(-1)).toBe(`listed as history: ${policyId} INCONCLUSIVE (asm_design_first, broke), superseded by asm_pwu_design_0`);
		expect([r.declaredVerdicts.rows.length, r.declaredVerdicts.history.map((d) => [d.assessmentId, d.supersededBy])]).toEqual([
			14,
			[['asm_design_first', 'asm_pwu_design_0']]
		]);
		const md = renderMarkdown(r);
		expect(md).toContain(
			'## The declared verdicts (P7-4g) — 14 of 14, each read from its recorded criterion results; 1 verdict superseded, each listed as history beside the one that superseded it (REG-D-112 (a))'
		);
		// ⭑ Beside it: the history row directly under the verdict that superseded it.
		const lines = md.split('\n');
		expect(lines[lines.findIndex((l) => l.startsWith('| asm_pwu_design_0 |')) + 1]).toBe(
			`| asm_design_first | design | ${policyId} | INCONCLUSIVE | 0 of 6 | yes | broke; history: superseded by asm_pwu_design_0 |`
		);
	});

	it('⭑ CONTROL (fix2’s F9) — "latest" is the product’s own reading, by updatedAt, ties to the last made: a review updated after the re-run’s speaks, and 5b reads it', () => {
		// ⭑ `latestDeclaredVerdicts` (`declared-policy-signoff.ts`) and the kernel's index read the same rule; a reading by the
		// order made alone would let the re-run speak here.
		const { r } = rerunOfDesign({ updatedAt: '2026-10-15T12:00:00.000Z' });
		expect([cellOf(r, '5b', 'design').value, r.declaredVerdicts.history.map((d) => [d.assessmentId, d.supersededBy])]).toEqual([
			'broke',
			[['asm_pwu_design_0', 'asm_design_first']]
		]);
	});

	it('⭑ CONTROL — a verdict the pre-E2 sign-off recorded is still read as it was: vacuous by construction (REG-F-523)', () => {
		const r = reportOf(aRun({ 'end-to-end': { declared: 'legacy' } })).report;
		expect(shown(cellOf(r, '5b', 'end-to-end'))).toEqual(['vacuous by construction', ['REG-F-406', 'REG-F-523']]);
		expect(cellOf(r, '5b', 'design').value).toBe('as intended');
	});
});

describe('JAN-EXEC P7-2 D9 — the audit of hand acts (P7-3)', () => {
	const success = (payload: Record<string, unknown>, commandId = 'ui-7'): StoredEvent => ({
		sequence: 10,
		eventType: 'ExecutionStepSucceeded',
		aggregateType: 'EXECUTION_PLAN',
		aggregateId: 'plan_1',
		commandId,
		payload
	});
	const hopAfter = (commandId = 'ui-8', unitId = 'pwu_1'): StoredEvent => ({
		sequence: 11,
		eventType: 'PwuStateChanged',
		aggregateType: 'PROFESSIONAL_WORK_UNIT',
		aggregateId: unitId,
		commandId,
		payload: { previousState: 'EXECUTING', newState: 'EXECUTING', executionState: 'SUCCEEDED', supportingObjectIds: ['plan_1'] }
	});
	const byModel = {
		outputArtifactIds: ['art_1'],
		proposedEvidenceIds: ['evd_1'],
		executionProvenance: { executedBy: { actorId: 'model:gpt', actorType: 'AGENT', displayName: MODEL_EXECUTOR_NAME } }
	};

	it('⭐ Begin & Execute’s two shapes, each beside its same-batch hop, are not hand acts', () => {
		expect(stepSuccessShape(success(byModel), hopAfter(), 'pwu_1')).toEqual({ beginExecute: true, why: 'the model path' });
		const root = { outputArtifactIds: [], proposedEvidenceIds: [], noOutputResult: { detail: ROOT_COMPLETION_DETAIL } };
		expect(stepSuccessShape(success(root), hopAfter(), 'pwu_1').beginExecute).toBe(true);
	});

	it('⛔ the model’s shape WITHOUT its same-batch hop is a hand completion — the batch is part of the shape', () => {
		expect(stepSuccessShape(success(byModel), undefined, 'pwu_1')).toEqual({
			beginExecute: false,
			why: "the model path's shape, without the same-batch execution hop to SUCCEEDED — not one of Begin & Execute's two shapes"
		});
		// A hop from a command that is not the next one of the batch is not the batch's.
		expect(stepSuccessShape(success(byModel), hopAfter('ui-9'), 'pwu_1').beginExecute).toBe(false);
		// Nor is a hop on another unit.
		expect(stepSuccessShape(success(byModel), hopAfter('ui-8', 'pwu_2'), 'pwu_1').beginExecute).toBe(false);
		// Nor one that cites another plan.
		const elsewhere = { ...hopAfter(), payload: { ...hopAfter().payload, supportingObjectIds: ['plan_2'] } };
		expect(stepSuccessShape(success(byModel), elsewhere, 'pwu_1').beginExecute).toBe(false);
	});

	it('⛔ the operator naming ONE output carries neither marker of the first maps — and is a hand completion all the same', () => {
		const byHand = {
			outputArtifactIds: ['art_1'],
			proposedEvidenceIds: [],
			executionProvenance: { executedBy: { actorId: 'local-professional', actorType: 'HUMAN', displayName: 'Operator' } }
		};
		expect(stepSuccessShape(success(byHand), hopAfter(), 'pwu_1')).toEqual({
			beginExecute: false,
			why: "executed by a HUMAN actor, naming 1 output(s), with the same-batch execution hop to SUCCEEDED — not one of Begin & Execute's two shapes"
		});
		const noOutput = { outputArtifactIds: [], proposedEvidenceIds: [], noOutputResult: { detail: OPERATOR_COMPLETION_DETAIL } };
		expect(stepSuccessShape(success(noOutput), undefined, 'pwu_1').why).toMatch(/with the operator's own no-output detail/);
	});

	it('⭐ a clean run: no hand act, and the demo policy’s creation counted as expected, never as an operator act', () => {
		const run = aRun();
		const created = { eventType: 'AssurancePolicyCreated', aggregateType: 'ASSURANCE_POLICY', aggregateId: DEMO_POLICY_ID, commandId: 'ui-1', payload: {} };
		const r = reportOf(aRun({}, { extraEvents: [created] })).report;
		expect(r.audit.acts.filter((a) => a.verdict === 'FOUND')).toEqual([]);
		expect(r.audit.forbiddenFound).toBe(0);
		expect(r.audit.expected.map((e) => [e.act, e.count])).toEqual([
			['CreateAssurancePolicy', 1],
			['ActivateAssurancePolicy', 0]
		]);
		expect(reportOf(run).report.audit.acts.map((a) => a.act).slice(0, 6)).toEqual([
			'completeStep',
			'skipStep',
			'retryStep',
			'waiver',
			'markSatisfied without recordAssurance',
			'abandon followed by re-proposing'
		]);
	});

	it('⛔ a step completed by hand, a retry and a skip are each FOUND, on their unit', () => {
		const at = (type: string, id: string) => ({ eventType: type, aggregateType: 'EXECUTION_PLAN', aggregateId: id, commandId: 'ui-900', payload: {} });
		const r = reportOf(
			aRun(
				{ implementation: { stepState: 'SUCCEEDED', completion: 'hand', unit: { lifecycle: 'EXECUTING', execution: 'RUNNING', assurance: 'UNASSESSED' } } },
				{ extraEvents: [at('ExecutionStepRetried', 'plan_design'), at('ExecutionStepSkipped', 'plan_design')] }
			)
		).report;
		const act = (name: string) => actOf(r, name);
		expect(act('completeStep').found.map((f) => [f.unit, f.eventType])).toEqual([['implementation', 'ExecutionStepSucceeded']]);
		expect([act('retryStep').verdict, act('retryStep').found[0]?.unit]).toEqual(['FOUND', 'design']);
		expect([act('skipStep').verdict, act('skipStep').found[0]?.unit]).toEqual(['FOUND', 'design']);
		expect(r.audit.forbiddenFound).toBe(3);
		// ⭐ `P76F-A` A5 — AND STAGE 7 STILL READS THAT UNIT AS STOPPED: its step completed by hand, its own execution still
		// RUNNING (`completion`; REG-F-511). ⚠ Held HERE now: the store test's operator can no longer complete a refused unit's
		// step by hand — the server refuses the Resume before it — so no hand completion reaches that store any more, and
		// PQ7-M168 survived it (re-measured 2026-10-10).
		expect(shown(cellOf(r, '7', 'implementation'))).toEqual(['broke', ['REG-F-511']]);
	});

	it('⛔ a waiver of any kind is FOUND — its request, grant or denial in the log, or its POST refused before any', () => {
		const at = (eventType: string) => ({ eventType, aggregateType: 'DECISION', aggregateId: `dec_${eventType}`, commandId: 'ui-960', payload: {} });
		for (const t of ['WaiverRequested', 'WaiverGranted', 'WaiverDenied']) {
			const waiver = actOf(reportOf(aRun({}, { extraEvents: [at(t)] })).report, 'waiver');
			expect([waiver.verdict, waiver.found.map((f) => f.eventType)], t).toEqual(['FOUND', [t]]);
		}
		const posts = (url: string, action?: string) => [{ seq: 1, url, ...(action ? { action } : {}), status: 200 }];
		const waived = (url: string, action?: string) => actOf(reportOf(aRun({}, { lane: { posts: posts(url, action) } })).report, 'waiver');
		expect([waived('http://h/undertakings/und_1?/recordWaiver').posted, waived('http://h/decisions/dec_1?/grant').posted]).toEqual([1, 1]);
		expect(waived('http://h/decisions/dec_1', 'deny').posted).toBe(1);
		// ⭐ A grant posted anywhere but the decisions page is no waiver.
		expect(waived('http://h/undertakings/und_1?/grant').posted).toBe(0);
	});

	it('⛔ a refused skip or retry leaves no event — and its POST is found in the lane’s own log', () => {
		const r = reportOf(
			aRun({}, { lane: { posts: [{ seq: 1, url: 'http://h/undertakings/und_1?/skipStep', status: 200 }, { seq: 2, url: 'http://h/undertakings/und_1?/retryStep', status: 200 }] } })
		).report;
		expect([actOf(r, 'skipStep').posted, actOf(r, 'retryStep').posted]).toEqual([1, 1]);
		expect([actOf(r, 'skipStep').verdict, actOf(r, 'retryStep').verdict]).toEqual(['FOUND', 'FOUND']);
		expect(r.audit.forbiddenFound).toBe(2);
	});

	it('⛔ a refused POST leaves no event — and is found in the lane’s own log; with no log, the count is unknown', () => {
		const r = reportOf(aRun({}, { lane: { posts: [{ seq: 1, url: 'http://h/undertakings/und_1?/completeStep', status: 200 }] } })).report;
		const complete = actOf(r, 'completeStep');
		expect([complete.verdict, complete.found.length, complete.posted]).toEqual(['FOUND', 0, 1]);
		const unknown = reportOf(aRun({}, { lane: { posts: undefined } })).report;
		expect(unknown.audit.acts.find((a) => a.act === 'completeStep')?.posted).toBeNull();
	});

	it('⛔ Mark Satisfied with no Record Assurance hop before it is FOUND — and pressed on an unassured unit, too', () => {
		const satisfied = {
			eventType: 'PwuStateChanged',
			aggregateType: 'PROFESSIONAL_WORK_UNIT',
			aggregateId: 'pwu_design',
			commandId: 'ui-901',
			payload: { previousState: 'UNDER_ASSURANCE', newState: 'SATISFIED', assuranceState: 'SATISFIED' }
		};
		const r = reportOf(
			aRun({ design: { signedOff: false } }, { extraEvents: [satisfied], lane: { actions: [{ file: '04-implementation-markSatisfied.json', action: 'markSatisfied', envelopeType: 'failure' }] } })
		).report;
		const act = actOf(r, 'markSatisfied without recordAssurance');
		expect([act.verdict, act.found.map((f) => f.unit), act.posted]).toEqual(['FOUND', ['design'], 1]);
		// ⭐ Each unit signed off in the fixture had its hop first: none of those is found.
		expect(reportOf(aRun()).report.audit.acts.find((a) => a.act === 'markSatisfied without recordAssurance')?.verdict).toBe('none');
	});

	it('⭐ E12F F3 — Mark Satisfied after the rule’s ACCEPTED re-run of the declared reviews is no forbidden act; after a refused one it is', () => {
		// ⛔ PREDICTED RED, read from the code: FOUND — only an accepted Record Assurance counted as the assurance Mark Satisfied
		// may follow, so the rule's sign-off (Record Assurance refused, its declared reviews re-run and accepted, REG-D-112 (a))
		// read as the act P7-3 forbids.
		const acts = (rerun: 'success' | 'failure') => [
			{ file: '03-design-recordAssurance.json', action: 'recordAssurance', envelopeType: 'failure' },
			{ file: '03-design-rerunDeclaredReviews.json', action: 'rerunDeclaredReviews', envelopeType: rerun },
			{ file: '03-design-markSatisfied.json', action: 'markSatisfied', envelopeType: 'success' }
		];
		const accepted = actOf(reportOf(aRun({}, { lane: { actions: acts('success') } })).report, 'markSatisfied without recordAssurance');
		expect([accepted.verdict, accepted.posted], 'Mark Satisfied after an accepted declared re-run read as forbidden').toEqual(['none', 0]);
		const refused = actOf(reportOf(aRun({}, { lane: { actions: acts('failure') } })).report, 'markSatisfied without recordAssurance');
		expect(refused.posted).toBe(1);
		// ⛔ E12’s re-review F6 — AND THE PRINTED NOTE SAYS WHAT IS COUNTED: since `E12F` F3 an accepted re-run of the declared
		// reviews is assurance too, so a Mark Satisfied after a REFUSED Record Assurance is no longer counted by itself.
		expect(accepted.note, 'the note describes a count it no longer makes').toBe(
			'POSTs counted from lane/actions: a Mark Satisfied pressed on a unit with no accepted Record Assurance and no accepted re-run of its declared reviews (REG-D-112 (a))'
		);
	});

	it('⭐ E12F F3 — a re-run of a unit’s declared reviews is LISTED among the other acts, by its Decision: the unit, and the assessments it re-ran', () => {
		const decided = {
			eventType: 'DecisionEffective',
			aggregateType: 'DECISION',
			aggregateId: 'dec_declared',
			commandId: 'ui-990',
			payload: { decisionType: 'REPLAN', selectedOption: DECLARED_RERUN_OPTION, subjectObjectIds: ['pwu_design', 'asm_pwu_design_1'] }
		};
		const listed = actOf(
			reportOf(aRun({}, { extraEvents: [decided], lane: { posts: [{ seq: 1, url: 'http://h/undertakings/und_1?/rerunDeclaredReviews', status: 200 }] } })).report,
			'rerunDeclaredReviews'
		);
		expect([listed.found.map((f) => [f.aggregateId, f.unit, f.why]), listed.posted]).toEqual([
			[['dec_declared', 'design', 'a person’s re-run of the declared reviews that did not conclude: 1 assessment re-run']],
			1
		]);
	});

	it('⛔ an abandon followed by a re-proposal is the forbidden act; a re-proposal alone is listed on its own', () => {
		const abandon = { eventType: 'PwuAbandoned', aggregateType: 'PROFESSIONAL_WORK_UNIT', aggregateId: 'pwu_design', commandId: 'ui-902', payload: {} };
		const propose = { eventType: 'PwuProposed', aggregateType: 'PROFESSIONAL_WORK_UNIT', aggregateId: 'pwu_design', commandId: 'ui-903', payload: {} };
		const both = reportOf(aRun({}, { extraEvents: [abandon, propose] })).report;
		const forbidden = actOf(both, 'abandon followed by re-proposing');
		expect([forbidden.verdict, forbidden.found.map((f) => f.unit)]).toEqual(['FOUND', ['design']]);
		const alone = reportOf(aRun({}, { extraEvents: [propose] })).report;
		expect(alone.audit.acts.find((a) => a.act === 'abandon followed by re-proposing')?.verdict).toBe('none');
		expect(alone.audit.acts.find((a) => a.act === 'proposePwu (re-proposal)')?.verdict).toBe('FOUND');
	});

	it('⛔ the hand acts P7-3 does not name are found too: a second start, a cancel, the operator’s evidence, a blocking finding', () => {
		const at = (eventType: string, aggregateId: string, payload: Record<string, unknown> = {}) => ({
			eventType,
			aggregateType: 'X',
			aggregateId,
			commandId: 'ui-950',
			payload
		});
		const r = reportOf(
			aRun({}, {
				extraEvents: [
					at('ExecutionStepStarted', 'plan_design', { stepId: 'step_design' }),
					at('ExecutionStepCancelled', 'plan_implementation'),
					at('EvidenceProposed', 'evd_hand', { scope: 'what I saw', producedBy: { actorId: 'local-professional', actorType: 'HUMAN' } }),
					at('AssuranceObservationRecorded', 'obs_1', { assessmentId: 'asm_x', findingCode: DEMO_FINDING_CODE, severity: 'BLOCKING' })
				]
			})
		).report;
		const found = (act: string) => actOf(r, act).found.map((f) => [f.aggregateId, f.unit]);
		expect(found('startStep')).toEqual([['plan_design', 'design']]);
		expect(found('cancelStep')).toEqual([['plan_implementation', 'implementation']]);
		expect(found('proposeEvidence')).toEqual([['evd_hand', null]]);
		expect(found('recordBlockingFinding')).toEqual([['obs_1', null]]);
		// ⭐ The join's own evidence, the plans' first starts and the floor's own findings are none of these.
		const clean = reportOf(aRun({ implementation: { commands: 2 } })).report;
		for (const act of ['startStep', 'cancelStep', 'proposeEvidence', 'recordBlockingFinding'])
			expect(clean.audit.acts.find((a) => a.act === act)?.verdict, act).toBe('none');
	});

	// ⭐⭐ `JAN-EXEC` P7-6R R-1 (`DESIGN-the-stopped-unit-recovery.md` RD2, RD5; `REG-D-104` (1)): from R-1 the page's Wait and
	// Cancel are no longer the only emitters of their events. Begin & Execute records a WAIT where the floor refuses a
	// completion, a re-run CANCELS the refused plan's waiting step, and abandoning a waiting unit cancels it too — each in
	// its own batch. Read as hand acts, every refused phase of the paid run would read as one the operator suspended.
	it('⛔ P7-6R R-1 — the route’s own wait and a recovery’s own cancellation are not hand acts; a lone Wait or Cancel still is; and each re-run is listed', () => {
		const ev = (eventType: string, aggregateId: string, commandId: string, payload: Record<string, unknown> = {}) => ({
			eventType,
			aggregateType: 'X',
			aggregateId,
			commandId,
			payload
		});
		const r = reportOf(
			aRun({}, {
				extraEvents: [
					// RD2 — the floor's refusal recorded as a wait: the step, then the unit's hop, one batch.
					ev('ExecutionStepWaiting', 'plan_design', 'ui-960', { stepId: 'step_design', stepState: 'WAITING' }),
					ev('PwuStateChanged', 'pwu_design', 'ui-961', { previousState: 'EXECUTING', newState: 'EXECUTING', executionState: 'WAITING', supportingObjectIds: ['plan_design'] }),
					// RD5 — a re-run: the person's Decision, then A superseded and its waiting step cancelled, one batch.
					ev('DecisionEffective', 'dec_rerun', 'ui-969', { decisionType: 'REPLAN', selectedOption: 'RERUN_REVIEW', subjectObjectIds: ['pwu_design', 'plan_design'] }),
					ev('ExecutionPlanSuperseded', 'plan_design', 'ui-970', { supersedingExecutionPlanId: 'plan_b', status: 'SUPERSEDED' }),
					ev('ExecutionStepCancelled', 'plan_design', 'ui-971', { stepId: 'step_design', stepState: 'CANCELLED' }),
					// R-1c — abandon from waiting: the waiting step cancelled, then the unit abandoned, one batch.
					ev('ExecutionStepCancelled', 'plan_implementation', 'ui-980', { stepId: 'step_implementation', stepState: 'CANCELLED' }),
					ev('PwuAbandoned', 'pwu_implementation', 'ui-981'),
					// The operator's own Wait and Cancel, each a lone command.
					ev('ExecutionStepWaiting', 'plan_requirements', 'ui-990', { stepId: 'step_requirements', stepState: 'WAITING' }),
					ev('ExecutionStepCancelled', 'plan_requirements', 'ui-992', { stepId: 'step_requirements', stepState: 'CANCELLED' })
				]
			})
		).report;
		const found = (act: string) => actOf(r, act).found.map((f) => [f.aggregateId, f.unit]);
		expect(found('enterWaitStep'), 'the route’s own wait was read as a hand Wait').toEqual([['plan_requirements', 'requirements']]);
		expect(found('cancelStep'), 'a recovery’s own cancellation was read as a hand Cancel').toEqual([['plan_requirements', 'requirements']]);
		expect(found('rerunReview')).toEqual([['dec_rerun', 'design']]);
		expect(actOf(r, 'rerunWork').verdict).toBe('none');
	});
});

// ── ⭐⭐ `JAN-EXEC` P7-6 B5 — THE ROADMAP'S B8: THE RUN REPORT AND ITS AUDIT KNOW THE RECOVERY ──────────────────────────────
// (`ROADMAP-undertaking-execution-sandbox.md` §9, B8; `DESIGN-the-stopped-unit-recovery.md` RD5, RD10.) A recovery act's
// completion is not a hand completion; each re-run is listed beside the Decision that made it; the limit is checked before
// each re-run (the lane's: `verif/phase7-live-spec.test.ts`). Its red: the audit over a run with a re-run of the review.
describe('JAN-EXEC P7-6 B5 (the roadmap’s B8) — the report and its audit know the recovery', () => {
	const ev = (eventType: string, aggregateId: string, commandId: string, payload: Record<string, unknown> = {}) => ({
		eventType,
		aggregateType: 'X',
		aggregateId,
		commandId,
		payload
	});
	const byModel = {
		actorId: 'model:fixture-executor',
		actorType: 'AGENT',
		displayName: MODEL_EXECUTOR_NAME
	};
	/**
	 * A run whose DESIGN phase was refused at its review, WAITED, and was recovered by a person's re-run of the review, its
	 * rows as the route writes them (RD2, RD4, RD5): the wait; the Decision; plan B proposed; plan A superseded by B and its
	 * waiting step cancelled; B approved and activated; the unit WAITING→RUNNING citing B; B started — then B completed naming
	 * A's work product, with the unit's hop to SUCCEEDED citing B, in one batch.
	 */
	function aRecoveredRun() {
		const run = aRun(
			{ design: { completion: 'none' } },
			{
				extraEvents: [
					ev('ExecutionStepWaiting', 'plan_design', 'ui-900', { stepId: 'step_design', stepState: 'WAITING' }),
					ev('PwuStateChanged', 'pwu_design', 'ui-901', { previousState: 'EXECUTING', newState: 'EXECUTING', executionState: 'WAITING', supportingObjectIds: ['plan_design'] }),
					ev('DecisionEffective', 'dec_rerun', 'ui-911', { decisionType: 'REPLAN', selectedOption: 'RERUN_REVIEW', subjectObjectIds: ['pwu_design', 'plan_design', 'art_design'] }),
					ev('ExecutionPlanProposed', 'plan_design_b', 'ui-912', { executionPlanId: 'plan_design_b', workUnitId: 'pwu_design' }),
					ev('ExecutionPlanSuperseded', 'plan_design', 'ui-913', { supersedingExecutionPlanId: 'plan_design_b', status: 'SUPERSEDED' }),
					ev('ExecutionStepCancelled', 'plan_design', 'ui-914', { stepId: 'step_design', stepState: 'CANCELLED' }),
					ev('ExecutionPlanApproved', 'plan_design_b', 'ui-915'),
					ev('ExecutionPlanActivated', 'plan_design_b', 'ui-916'),
					ev('PwuStateChanged', 'pwu_design', 'ui-917', { previousState: 'EXECUTING', newState: 'EXECUTING', executionState: 'RUNNING', supportingObjectIds: ['plan_design_b'] }),
					ev('ExecutionStepStarted', 'plan_design_b', 'ui-918', { stepId: 'step_design_b' }),
					ev('ExecutionStepSucceeded', 'plan_design_b', 'ui-930', {
						outputArtifactIds: ['art_design'],
						proposedEvidenceIds: [],
						executionProvenance: { originType: 'MODEL_GENERATION', producingExecutionAttemptId: 'step_design#1', executedBy: byModel }
					}),
					ev('PwuStateChanged', 'pwu_design', 'ui-931', { previousState: 'EXECUTING', newState: 'EXECUTING', executionState: 'SUCCEEDED', supportingObjectIds: ['plan_design_b'] })
				]
			}
		);
		const planB: StoredObject = {
			id: 'plan_design_b',
			objectType: 'EXECUTION_PLAN',
			state: { workUnitId: 'pwu_design', status: 'ACTIVE', steps: [{ id: 'step_design_b', stepState: 'SUCCEEDED' }] },
			firstSequence: Number.MAX_SAFE_INTEGER - 1
		};
		const objects = run.store.objects.map((o) =>
			o.id === 'plan_design'
				? { ...o, state: { workUnitId: 'pwu_design', status: 'SUPERSEDED', steps: [{ id: 'step_design', stepState: 'CANCELLED' }] } }
				: o
		);
		return { store: { ...run.store, objects: [...objects, planB] }, lane: run.lane };
	}

	it('⛔ B8 — a recovered unit is NOT "begun more than once": its plan B is the revision its re-run made, read from the supersession chain (RD10)', () => {
		const r = reportOf(aRecoveredRun()).report;
		expect(r.problems, 'a person’s re-run was read as a second Begin & Execute').toEqual([]);
		expect(r.units.find((u) => u.slug === 'design')?.step).toEqual({ planId: 'plan_design_b', stepState: 'SUCCEEDED', planStatus: 'ACTIVE' });
	});

	it('⭑ CONTROL — two plans of one unit that NO supersession joins are still a unit begun more than once', () => {
		const run = aRecoveredRun();
		const unjoined = { ...run.store, events: run.store.events.filter((e) => e.eventType !== 'ExecutionPlanSuperseded') };
		expect(reportOf({ store: unjoined, lane: run.lane }).report.problems).toEqual([
			'the design unit has 2 execution plans: it was begun more than once'
		]);
	});

	it('⛔ B8 — a recovery act’s completion, its start, its cancellation and its wait are none of them hand acts', () => {
		const r = reportOf(aRecoveredRun()).report;
		for (const act of ['completeStep', 'startStep', 'cancelStep', 'enterWaitStep'])
			expect([act, actOf(r, act).verdict, actOf(r, act).found.map((f) => f.why)]).toEqual([act, 'none', []]);
		expect(r.audit.forbiddenFound).toBe(0);
	});

	it('⛔ B8 — each re-run is listed BESIDE the Decision that made it: the Decision, and the plan it made, superseding the refused one', () => {
		const r = reportOf(aRecoveredRun()).report;
		expect(actOf(r, 'rerunReview').found.map((f) => [f.aggregateId, f.unit, f.why])).toEqual([
			['dec_rerun', 'design', 'a person’s re-run of the review: plan plan_design_b, superseding plan plan_design']
		]);
		// A Decision no plan revision follows is listed all the same, and says so.
		const run = aRecoveredRun();
		const decidedOnly = { ...run.store, events: run.store.events.filter((e) => e.eventType !== 'ExecutionPlanSuperseded') };
		expect(actOf(reportOf({ store: decidedOnly, lane: run.lane }).report, 'rerunReview').found.map((f) => f.why)).toEqual([
			'a person’s re-run of the review: no plan revision follows it in the record'
		]);
	});
});

describe('JAN-EXEC P7-2 D9 — the reviewer calls, a lower bound, and the paid limit (design D8)', () => {
	it('⭐ every ASSURANCE-plane call is counted, its NO_RESPONSE and RETRY calls apart, by unit', () => {
		const calls = reportOf(
			aRun({ design: { review: [{ role: 'INITIAL', disposition: 'NO_RESPONSE', ordinal: 1 }, { role: 'RETRY', disposition: 'ACCEPTED', ordinal: 2 }] } })
		).report.reviewerCalls;
		expect([calls.recorded, calls.noResponse, calls.retries, calls.repairs, calls.lowerBound]).toEqual([5, 1, 1, 0, true]);
		expect(calls.byUnit.design).toEqual({ recorded: 2, noResponse: 1, retries: 1, repairs: 0 });
	});

	// ⭐ P7-6R — the limit is 200 since `REG-D-105` (1), which amends `REG-D-102` (4)'s 150.
	// ⭑ `REG-D-108` — read against the lane's limit, not a copy of it: these cases pinned 200 and went red at 230.
	it('⛔ the three counts must total UNDER the limit: the limit less the 4 held for P7-4e, plus those 4, is not under it', () => {
		// The lane's own check names the prior spend; with none, the operator's variable as the lane inherited it.
		const at = (prior: number) =>
			reportOf(aRun({}, { lane: { boot: { inherited: { JPWB_PHASE7_PRIOR_REVIEWER_CALLS: String(prior) }, overlay: { JPWB_DEMO_DB: DEMO_DB } } } }))
				.report.reviewerCalls.limit;
		const L = PAID_LIMIT;
		expect(at(L - 9)).toEqual({ prior: L - 9, recorded: 4, reserve: 4, total: L - 1, limit: L, under: true });
		expect(at(L - 8)).toEqual({ prior: L - 8, recorded: 4, reserve: 4, total: L, limit: L, under: false });
		const run = aRun();
		const checked = { ...run.lane, run: { units: [{ slug: 'design', limitCheck: { prior: 7 } }] } };
		expect(buildRunReport(run.store, checked, { accountNames: NAMES }).report.reviewerCalls.limit.prior).toBe(7);
		expect(reportOf(aRun({}, { lane: { boot: {} } })).report.reviewerCalls.limit).toMatchObject({ prior: null, under: null });
	});
});

describe('JAN-EXEC P7-2 D9 — the stage matrix (§1)', () => {
	// ⭐⭐ E2 (`REG-F-523`; `REG-D-110` (3); design B8) — 5b MOVED: ~~vacuous by construction~~ AS INTENDED, every declared
	// policy JUDGED — each criterion answered, each verdict the one its answers give. ⛔ PREDICTED RED, observed against HEAD's
	// report: `["vacuous by construction", ["REG-F-406", "REG-F-523"]]` for every phase.
	it('⭐ a complete run: every reached cell as intended, 5b as intended (E2), 6 open and owed to P7-4', () => {
		const r = reportOf(aRun()).report;
		for (const c of r.matrix) expect(c.value === null || (CELL_VALUES as readonly string[]).includes(c.value), `${c.stage} ${c.row}`).toBe(true);
		for (const p of ['requirements', 'design', 'implementation', 'end-to-end']) {
			for (const s of ['3', '4', '5a', '7', '8']) expect(cellOf(r, s, p).value, `${s} ${p}`).toBe('as intended');
			expect(shown(cellOf(r, '5b', p)), `5b ${p}`).toEqual(['as intended', []]);
			expect([cellOf(r, '6', p).value, cellOf(r, '6', p).owedTo]).toEqual([null, 'P7-4a, P7-4b and P7-4c']);
		}
		expect([cellOf(r, '1', 'whole run').value, cellOf(r, '2', 'whole run').value, cellOf(r, '7', 'whole run').value]).toEqual([
			'not measured in this half',
			'as intended',
			'as intended'
		]);
		expect(r.declaredVerdicts.rows).toHaveLength(14);
		// ⭐ E2 — 4 phases × 6 reached stages (5b among them now), and the run's stages 2 and 7: 26 that could have failed;
		// stage 1 is half B's. ~~4 phases × 5 reached stages … 22~~
		expect(r.answer).toMatchObject({ open: 4, measured: 26 });
		expect(r.declaredVerdicts.rows.map((d) => d.value)).toEqual(r.declaredVerdicts.rows.map(() => 'as intended'));
	});

	it('⭐ a dry run, the root alone begun: every phase not reached, and so the run’s completion', () => {
		const r = reportOf(aRun({ requirements: { begun: false }, design: { begun: false }, implementation: { begun: false }, 'end-to-end': { begun: false } })).report;
		for (const p of ['requirements', 'design', 'implementation', 'end-to-end'])
			for (const s of ['3', '4', '5a', '5b', '6', '7', '8']) expect(cellOf(r, s, p).value, `${s} ${p}`).toBe('not reached');
		expect(cellOf(r, '7', 'whole run').value).toBe('not reached');
	});

	it('⛔ a phase that stopped broke completion (REG-F-511) — its own and the run’s', () => {
		const r = reportOf(aRun({ design: { stepState: 'RUNNING', unit: { lifecycle: 'EXECUTING', execution: 'RUNNING', assurance: 'UNASSESSED' } } })).report;
		expect(shown(cellOf(r, '7', 'design'))).toEqual(['broke', ['REG-F-511']]);
		expect(shown(cellOf(r, '7', 'whole run'))).toEqual(['broke', ['REG-F-511']]);
		expect(cellOf(r, '7', 'requirements').value).toBe('as intended');
	});

	it('⛔ runs past the 32nd: a completed step whose archive gained more captures than evidence broke stage 4 (REG-F-517)', () => {
		// ⭐ P5 package B (F5) — the causes its archive's K5 check leaves possible, as it records them for 32 runs recorded.
		const r = reportOf(aRun({ 'end-to-end': { commands: 32, captures: 33, k5: causes('cap', 'own') } })).report;
		const c = cellOf(r, '4', 'end-to-end');
		expect(shown(c)).toEqual(['broke', ['REG-F-517', 'REG-F-521']]);
		expect(c.basis).toContain(`1 captured run became no evidence: the archive’s K5 check leaves possible ${K5.cap}; or ${K5.own}`);
		expect(r.manifest.unrecordedRuns['end-to-end']).toBe(1);
	});

	it('⛔ captured runs with no evidence, the join short of 32: a stop dropped them from the record — stage 4 broke (REG-F-511)', () => {
		// ⭐ P5 package B (F5) — the cause its archive's K5 check left possible: a join the unit's refusal says was refused part-way.
		const stopped = { commands: 2, captures: 3, stepState: 'RUNNING', unit: { lifecycle: 'EXECUTING', execution: 'RUNNING', assurance: 'UNASSESSED' } };
		const r = reportOf(aRun({ design: { ...stopped, k5: causes('join', 'own') } })).report;
		const c = cellOf(r, '4', 'design');
		expect(shown(c)).toEqual(['broke', ['REG-F-511', 'REG-F-521']]);
		expect(c.basis.join(' ')).toMatch(/the archive’s K5 check leaves possible the evidence join refused part-way/);
	});

	it('⛔ a first try that got no answer after its commands ran: nothing was reviewed, and the runs it dropped broke stage 4 (REG-F-511)', () => {
		const stopped = { stepState: 'FAILED', unit: { lifecycle: 'EXECUTING', execution: 'RUNNING', assurance: 'UNASSESSED' }, workProducts: 0 as const };
		const dropped = reportOf(
			aRun({ design: { ...stopped, tries: [{ disposition: 'NO_RESPONSE', parse: { outcome: 'EMPTY_RESPONSE', detail: '' } }], captures: 3, k5: causes('stop', 'own') } })
		).report;
		const c = cellOf(dropped, '4', 'design');
		expect(shown(c)).toEqual(['broke', ['REG-F-511', 'REG-F-521']]);
		expect(c.basis).toContain('no work product was recorded, so nothing was reviewed');
		expect(dropped.units.find((u) => u.slug === 'design')?.runs).toMatchObject({ recorded: 0, captured: 3, unrecorded: 3 });
		// ⭐ With no run captured there is nothing it dropped: the stage was not reached.
		const none = reportOf(aRun({ design: { ...stopped, tries: [{ disposition: 'NO_RESPONSE' }], captures: 0 } })).report;
		expect(cellOf(none, '4', 'design').value).toBe('not reached');
	});

	it('⛔ K9 is read where the account was HANDED: a later try that got no answer reached no review, and is no REG-F-519', () => {
		// Design: try 1 answered and its work product was reviewed REJECTED; try 2's executor call failed.
		const thrown = { outcome: 'NOT_ATTEMPTED', detail: 'The model call itself failed: provider error' };
		const r = reportOf(
			aRun({
				design: {
					tries: [{ disposition: 'ACCEPTED' }, { disposition: 'NO_RESPONSE', parse: thrown }],
					workProductFloor: ['SATISFIED', 'SATISFIED', 'REJECTED'],
					stepState: 'FAILED',
					unit: { lifecycle: 'EXECUTING', execution: 'RUNNING', assurance: 'UNASSESSED' }
				}
			})
		).report;
		const c = cellOf(r, '4', 'design');
		expect(c.registerIds).not.toContain('REG-F-519');
		expect([c.value, c.owedTo]).toEqual([null, 'P7-4f, the adjudication table']);
		// ⛔ …and an earlier try whose answer did not parse handed ITS review no account, though a later one parsed.
		const narrated = { outcome: 'SCHEMA_COERCION_FAILED', detail: 'The answer is not a JSON object.' };
		const first = reportOf(aRun({ design: { tries: [{ disposition: 'ACCEPTED', parse: narrated }, { disposition: 'ACCEPTED' }] } })).report;
		const k9 = cellOf(first, '4', 'design');
		expect(shown(k9)).toEqual(['broke', ['REG-F-519']]);
		expect(k9.basis).toContain("try 1's answer did not parse (SCHEMA_COERCION_FAILED:not-an-object): its account reached its work product's review as not declared");
	});

	it('⛔ runs the archive cannot count are UNKNOWN, never none: stage 4 open, owed to a person (K5)', () => {
		const run = aRun({ 'end-to-end': { commands: 32, captures: 33, k5: causes('cap', 'own') } });
		const missing = (name: string) => ({
			...run.lane,
			archives: run.lane.archives.map((a) => (a.name === name ? { ...a, captures: null } : a))
		});
		// The phase before it holds no capture listing, so nothing can be subtracted…
		const before = buildRunReport(run.store, missing('04-implementation'), { accountNames: NAMES }).report;
		const c = cellOf(before, '4', 'end-to-end');
		expect([c.value, c.owedTo]).toEqual([null, K5_OWED]);
		expect(c.basis.join(' ')).toMatch(/whether a captured run became no evidence is unknown: the archive 04-implementation holds no capture listing/);
		expect(before.manifest.unrecordedRuns['end-to-end']).toBeNull();
		// …and the phase's own archive holds none.
		expect(cellOf(buildRunReport(run.store, missing('05-end-to-end'), { accountNames: NAMES }).report, '4', 'end-to-end').value).toBeNull();
		// ⭐ An archive whose checks.json records that the run had no process-output held no capture: known, and none.
		const recorded = {
			...run.lane,
			archives: run.lane.archives.map((a) =>
				a.name === '04-implementation' ? { ...a, captures: null, processOutputRecorded: false } : a
			)
		};
		expect(shown(cellOf(buildRunReport(run.store, recorded, { accountNames: NAMES }).report, '4', 'end-to-end'))).toEqual([
			'broke',
			['REG-F-517', 'REG-F-521']
		]);
	});

	it('⭐ the runs the executor’s tries list are a witness, and a list cut short is said so', () => {
		const run = aRun({ implementation: { commands: 1 } });
		const tried = run.store.objects.find((x) => x.id === 'mex_implementation_try0')!;
		const observed = {
			observation: 'OBSERVED',
			observedCount: 3,
			calls: [
				{ toolName: 'run_command', outcome: 'COMPLETED' },
				{ toolName: 'write_file', outcome: 'COMPLETED' }
			]
		};
		const store = {
			...run.store,
			objects: run.store.objects.map((x) => (x === tried ? { ...x, state: { ...x.state, observedToolCalls: observed } } : x))
		};
		const runs = buildRunReport(store, run.lane, { accountNames: NAMES }).report.units.find((u) => u.slug === 'implementation')?.runs;
		expect([runs?.observedCalls, runs?.observedCallsCut]).toEqual([1, true]);
	});

	it('⛔ an answer that narrated outside its JSON left the account undeclared for every review: stage 4 broke (REG-F-519)', () => {
		const narrated = {
			outcome: 'SCHEMA_COERCION_FAILED',
			detail: 'This one did not honour the execution contract — The answer is not a JSON object, so the execution contract’s envelope could not be read. — so the whole answer is treated as the work product.'
		};
		const r = reportOf(aRun({ design: { tries: [{ disposition: 'ACCEPTED', parse: narrated }] } })).report;
		expect(shown(cellOf(r, '4', 'design'))).toEqual(['broke', ['REG-F-519']]);
		expect(r.units.find((u) => u.slug === 'design')?.tries).toEqual(['ACCEPTED:SCHEMA_COERCION_FAILED:not-json']);
	});

	it('⛔ a review that passed beside a deterministic finding never sent back broke stage 3 (REG-F-515)', () => {
		const r = reportOf(
			aRun({ design: { workProductFloor: ['REJECTED', 'SATISFIED', 'SATISFIED'], stepState: 'RUNNING', unit: { lifecycle: 'EXECUTING', execution: 'RUNNING', assurance: 'UNASSESSED' } } })
		).report;
		expect(shown(cellOf(r, '3', 'design'))).toEqual(['broke', ['REG-F-515']]);
	});

	it('⛔ a review answered against the work is a person’s to classify: stage 4 open, owed to the adjudication', () => {
		const r = reportOf(
			aRun({ implementation: { commands: 1, commandFloor: ['SATISFIED', 'SATISFIED', 'REJECTED'], stepState: 'RUNNING', unit: { lifecycle: 'EXECUTING', execution: 'RUNNING', assurance: 'UNASSESSED' } } })
		).report;
		const c = cellOf(r, '4', 'implementation');
		expect([c.value, c.owedTo]).toEqual([null, 'P7-4f, the adjudication table']);
	});

	it('⛔ a review with no answer recorded, or one not pairable, broke the record (stage 8)', () => {
		const orphan = reportOf(aRun({ design: { review: [] } })).report;
		expect(shown(cellOf(orphan, '8', 'design'))).toEqual(['broke', ['REG-F-525']]);
		const twice = reportOf(
			aRun({ design: { review: [{ role: 'INITIAL', disposition: 'ACCEPTED', ordinal: 1, runToken: 'a' }, { role: 'INITIAL', disposition: 'ACCEPTED', ordinal: 1, runToken: 'b' }] } })
		).report;
		expect(shown(cellOf(twice, '8', 'design'))).toEqual(['broke', ['REG-F-433']]);
	});

	it('⭐ the markdown carries the matrix, every cell’s value, and the two gaps a "Yes" always states', () => {
		const md = renderMarkdown(reportOf(aRun({ design: { review: [] } })).report);
		expect(md).toContain('| 8 The record | as intended | broke (REG-F-525) | as intended | as intended |');
		expect(md).toContain('REG-F-510: the PWA had to name its product');
		// ⭐ E2 (design B8) — THE OPENING CAVEAT LOSES ITS `REG-F-523` LINE: the declared policies judge now.
		expect(md).not.toContain('REG-F-523: the declared policies were signed off with no criterion checked.');
	});

	/**
	 * ⭐ E12’s polish (fix2’s F10) — the caveat a run states whose root’s two declared reviews the model reviewer made.
	 * ⭐ Round 5 (`REG-D-115`) — ~~"every declared case of case set v5"~~: the current set is version six, and the claim holds of
	 * every declared case of every version (`materialize.ts` frames each PRODUCING_PROMPT), so it names none.
	 */
	const UNIT_PURPOSE =
		'UNIT_PURPOSE framing: the declared reviews of a unit composed of others (root: 2) were made in it — the unit’s own ' +
		'purpose, judged over the work it and every unit below it produced (REG-D-111 (2)) — and no reviewer-qualification case ' +
		'measures it: every declared case is in the PRODUCING_PROMPT framing.';

	it('⛔ E12F F10 — the REG-F-523 caveat is KEPT for a run whose declared verdicts carry no criterion result (a pre-E2 archive), and counted for one that mixes them', () => {
		// ⛔ PREDICTED RED, read from the code: E2 dropped the line for EVERY run, so a report over a pre-E2 archive — its 14
		// declared verdicts signed off from required evidence alone — opened without the gap it most needs to state.
		const legacy = { declared: 'legacy' } as const;
		const pre = reportOf(
			aRun({ requirements: legacy, design: legacy, implementation: legacy, 'end-to-end': legacy }, { rootDeclared: 'legacy' })
		).report;
		expect(pre.answer.alwaysStated).toEqual([...ALWAYS_STATED, 'REG-F-523: the declared policies were signed off with no criterion checked.']);
		// ⭐ E12’s polish (fix2’s F10) — a run whose root the model reviewer judged states the UNIT_PURPOSE line too (below).
		const mixed = reportOf(aRun({ 'end-to-end': legacy })).report;
		expect(mixed.answer.alwaysStated).toEqual([
			...ALWAYS_STATED,
			'REG-F-523: 3 of 14 declared verdicts were signed off with no criterion checked.',
			UNIT_PURPOSE
		]);
		// ⭑ CONTROL — every verdict judged, criterion by criterion: the line stays dropped.
		expect(reportOf(aRun()).report.answer.alwaysStated).toEqual([...ALWAYS_STATED, UNIT_PURPOSE]);
	});

	it('⛔ E12’s polish (fix2’s F10; the lead’s delegated decision of 2026-10-15) — the caveats say the root’s declared reviews were made in the UNIT_PURPOSE framing, which no qualification case measures — where the model reviewer made one', () => {
		// ⛔ PREDICTED RED, read from the code: no caveat named it — the root's two declared reviews rested on reviewer behaviour no
		// case of v5 measures (every declared case is in the PRODUCING_PROMPT framing), and the report opened as if they did not.
		expect(reportOf(aRun()).report.answer.alwaysStated, 'the UNIT_PURPOSE framing went unsaid').toContain(UNIT_PURPOSE);
		expect(renderMarkdown(reportOf(aRun()).report)).toContain(`  - ${UNIT_PURPOSE}`);
		// ⭑ CONTROLS — unsaid where the model reviewer made no such review: the root signed off before E2, or never signed off.
		const said = (o: Parameters<typeof aRun>[1]) =>
			reportOf(aRun({}, o)).report.answer.alwaysStated.some((s) => s.startsWith('UNIT_PURPOSE'));
		expect([said({ rootDeclared: 'legacy' }), said({ rootSignedOff: false })]).toEqual([false, false]);
	});

	// ── ⭐⭐ R3-A F2 (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (12)) — A REPLAYED DECLARED VERDICT
	// carries a validator id of its own, as the floor's replayed review does: the report knows it, and never counts it as live.
	it('⭐ R3-A F2 — a REPLAYED declared verdict is a declared verdict: stage 5b reads it as it reads a live one, and it is never listed among the assessments that asked no model', () => {
		// ⛔ RED BEFORE R3-A: the report knew no replayed declared validator, so a replay's declared verdicts were no declared
		// verdicts at all — 5b read "not reached", and the replay regression's matrix could never match its recording's.
		const r = reportOf(aRun({ requirements: { declared: 'replayed' } })).report;
		expect(shown(cellOf(r, '5b', 'requirements')), 'a replayed declared verdict was read as none').toEqual(['as intended', []]);
		const replayed = r.declaredVerdicts.rows.filter((d) => d.unit === 'requirements');
		expect(replayed.map((d) => d.validatorId)).toEqual([REPLAYED_DECLARED, REPLAYED_DECLARED]);
		const noModel = Object.values(r.pairing.noModelAnswerByDesign).flat();
		expect(
			replayed.filter((d) => noModel.includes(d.assessmentId)),
			'a replayed declared verdict listed as an assessment that asked no model'
		).toEqual([]);
	});

	it('⛔ R3-A F2 — a REPLAYED declared verdict is never counted as a live one: the UNIT_PURPOSE caveat names the root’s replayed reviews as replayed, never among those the model reviewer made', () => {
		// ⛔ RED BEFORE R3-A: a replay's declared verdicts were recorded under the live reviewer's id, so the caveat counted them
		// as reviews the model reviewer made; under an id the report did not know, it dropped them, and the caveat went unsaid.
		const caveat = (o: Parameters<typeof aRun>[1]) =>
			reportOf(aRun({}, o)).report.answer.alwaysStated.filter((s) => s.startsWith('UNIT_PURPOSE framing'));
		expect(caveat({ rootDeclared: 'replayed' }), 'the root’s replayed reviews').toEqual([UNIT_PURPOSE.replace('(root: 2)', '(root: 2 replayed)')]);
		// ⭑ CONTROL — the model reviewer's own, counted as before.
		expect(caveat({})).toEqual([UNIT_PURPOSE]);
	});

	it('⛔ a press that outlasted the allowance (D4) is read as cut there — never from its mid-unit archive as if it ended', () => {
		const running = { lifecycle: 'EXECUTING', execution: 'RUNNING', assurance: 'UNASSESSED' };
		const r = reportOf(
			aRun(
				{
					implementation: { commands: 2, stepState: 'RUNNING', unit: running, timedOutAfterMs: 38_160_000 },
					'end-to-end': { begun: false }
				},
				{ run: { end: { reason: 'allowance-exceeded' } } }
			)
		).report;
		expect(shown(cellOf(r, '3', 'implementation'))).toEqual(['broke', ['REG-F-521', 'REG-F-527']]);
		for (const s of ['4', '5a', '8']) {
			expect(cellOf(r, s, 'implementation').value, s).toBe('not reached');
			expect(cellOf(r, s, 'implementation').basis.join(' '), s).toMatch(/past the lane's allowance of 38160000 ms \(design D4\)/);
		}
		expect(shown(cellOf(r, '7', 'implementation'))).toEqual(['broke', ['REG-F-511', 'REG-F-527']]);
		expect(cellOf(r, '7', 'whole run').registerIds).toContain('REG-F-527');
		expect(r.units.find((u) => u.slug === 'implementation')?.lane?.beginExecute).toEqual({ status: null, envelopeType: null, timedOutAfterMs: 38_160_000 });
		expect([r.run.endReason, r.problems]).toEqual(['allowance-exceeded', []]);
		// ⛔ The end the lane recorded, with no unit it names, is a problem with the inputs.
		const unnamed = reportOf(aRun({}, { run: { end: { reason: 'allowance-exceeded' } } })).report;
		expect(unnamed.problems).toContain(
			'lane/run.json ended allowance-exceeded, and names no unit whose Begin & Execute, recovery act or sign-off act outlasted its allowance'
		);
	});

	it('⛔ E12’s re-review F1 (D4) — a run the lane ended at a SIGN-OFF act with no answer is read as cut there: its end is no problem, and that unit’s stage 7 broke, the act and its bound named', () => {
		// ⛔ PREDICTED RED, read from the code: the end's check asked only for a Begin & Execute that outlasted its allowance, so
		// the lane's own end read as a problem with the inputs; and stage 7 read the unit as a sign-off attempted and refused,
		// unexplained and unregistered.
		const completed = { lifecycle: 'EXECUTING', execution: 'SUCCEEDED', assurance: 'UNASSESSED' };
		const cut = { unit: completed, signedOff: false };
		const run = aRun(
			{ design: cut, implementation: cut, 'end-to-end': cut },
			{ rootSignedOff: false, run: { end: { reason: 'allowance-exceeded' } } }
		);
		const laneRun = run.lane.run as { units: Record<string, unknown>[] };
		const withDesign = (fields: Record<string, unknown>): LaneRows => ({
			...run.lane,
			run: { ...laneRun, units: laneRun.units.map((u) => (u.slug === 'design' ? { ...u, ...fields } : u)) }
		});
		const outlasted = (ms: number) => ({ status: null, envelopeType: null, timedOutAfterMs: ms, requestFailure: null, after: null });
		const signedOff = withDesign({
			signOff: {
				offered: true,
				limitCheck: null,
				recordAssurance: outlasted(4_140_000),
				rerunDeclared: null,
				rerunLimitCheck: null,
				markSatisfied: null,
				refused: { act: 'Record Assurance', reason: 'no answer within 4140000 ms' },
				notPressed: null
			}
		});
		const r = buildRunReport(run.store, signedOff, { accountNames: NAMES }).report;
		expect(r.problems, 'the lane’s own end read as a problem with the inputs').toEqual([]);
		const c = cellOf(r, '7', 'design');
		expect([c.value, c.registerIds, c.unregistered]).toEqual(['broke', ['REG-F-527'], true]);
		expect(c.basis).toEqual([
			'design: lifecycle EXECUTING, assurance UNASSESSED, step SUCCEEDED, read from an archive taken while its Record Assurance may still have been running',
			"its Record Assurance gave no answer within 4140000 ms (design D4): the run ended there, and the server is killed with the act unfinished (REG-F-527); no register entry names why it outlasted its bound"
		]);
		// ⭑ ~~The sign-offs after it were never attempted: not reached.~~ ⭐ R4 (the lead's round-4 item 3) — the sign-offs after it
		// are not attempted BECAUSE the lane stopped after that act: not reached, and said so (the next test's).
		expect(cellOf(r, '7', 'implementation').basis.at(-1)).toBe(
			'its sign-off was not attempted: the lane stopped after the design unit’s Record Assurance, which got no answer, and pressed no sign-off after it (D4)'
		);
		// ⭐ D4's general form — the rule's re-run of the declared reviews, and a Mark Satisfied, are each named the same way.
		for (const [field, act, ms] of [['rerunDeclared', 'Re-run the declared reviews', 4_140_000], ['markSatisfied', 'Mark Satisfied', 300_000]] as const) {
			const named = withDesign({
				signOff: { offered: true, recordAssurance: { status: 200, envelopeType: 'failure', after: null }, [field]: outlasted(ms), refused: null, notPressed: null }
			});
			const report = buildRunReport(run.store, named, { accountNames: NAMES }).report;
			expect([report.problems, cellOf(report, '7', 'design').basis.at(-1)?.split(' (design D4)')[0]], act).toEqual([
				[],
				`its ${act} gave no answer within ${ms} ms`
			]);
		}
		// ⭐ And a recovery act the rule pressed that outlasted its bound names the end too (D4: it ends the run there).
		const recovered = withDesign({ recovery: [{ act: 'rerunWork', timedOutAfterMs: 38_160_000, requestFailure: null }] });
		expect(buildRunReport(run.store, recovered, { accountNames: NAMES }).report.problems).toEqual([]);
	});

	// ── ⛔ R4 (the lead's round-4 item 3) — A SIGN-OFF THE LANE SKIPPED AFTER A UNIT'S SIGN-OFF ACT GOT NO ANSWER reads as not
	// attempted because the lane stopped after that act: the lane's sign-off loop ends there (D4: nothing is pressed beside an
	// act the server may still be running), as it ends at a limit check that holds one back (D8) — round 3's reading of a
	// limit stop (R3-B F4), given an unanswered act too.
	it('⛔ R4 (the lead’s round-4 item 3) — every later sign-off the lane skipped after a unit’s sign-off act got NO ANSWER, the root’s included, reads as not attempted because the lane stopped after that act — never as one never attempted', () => {
		// ⛔ PREDICTED RED, read from the code: "its sign-off was never attempted", the words a run cut short reads, for each unit
		// after the one whose act got no answer — whichever act it was, past its bound or lost in transit.
		const completed = { lifecycle: 'EXECUTING', execution: 'SUCCEEDED', assurance: 'UNASSESSED' };
		const cut = { unit: completed, signedOff: false };
		const run = aRun({ design: cut, implementation: cut, 'end-to-end': cut }, { rootSignedOff: false, run: { end: { reason: 'allowance-exceeded' } } });
		const laneRun = run.lane.run as { units: Record<string, unknown>[] };
		const designSigned = (field: string, act: Record<string, unknown>): LaneRows => ({
			...run.lane,
			run: {
				...laneRun,
				units: laneRun.units.map((u) =>
					u.slug === 'design'
						? { ...u, signOff: { offered: true, recordAssurance: { status: 200, envelopeType: 'success', after: null }, [field]: act, refused: null, notPressed: null } }
						: u
				)
			}
		});
		const outlasted = (ms: number) => ({ status: null, envelopeType: null, timedOutAfterMs: ms, requestFailure: null, after: null });
		const lost = { status: null, envelopeType: null, timedOutAfterMs: null, requestFailure: 'net::ERR_EMPTY_RESPONSE', after: null };
		const cases = [
			['recordAssurance', 'Record Assurance', outlasted(4_140_000)],
			['recordAssurance', 'Record Assurance', lost],
			['rerunDeclared', 'Re-run the declared reviews', outlasted(4_140_000)],
			['markSatisfied', 'Mark Satisfied', lost]
		] as const;
		for (const [field, act, pressed] of cases) {
			const r = buildRunReport(run.store, designSigned(field, pressed), { accountNames: NAMES }).report;
			const why = `its sign-off was not attempted: the lane stopped after the design unit’s ${act}, which got no answer, and pressed no sign-off after it (D4)`;
			const kind = `${act}, ${pressed.timedOutAfterMs === null ? 'lost in transit' : 'past its bound'}`;
			expect([cellOf(r, '7', 'implementation').basis.at(-1), cellOf(r, '7', 'end-to-end').basis.at(-1)], kind).toEqual([why, why]);
			expect(cellOf(r, '7', 'whole run').basis, `${kind}: the root’s sign-off, skipped, said nothing of why`).toContain(`root: not reached — ${why}`);
			// ⭑ CONTROL — the unit before the stop, signed off, is not said to have been skipped.
			expect(cellOf(r, '7', 'requirements').basis.join(' '), kind).not.toContain('was not attempted');
		}
	});

	it('⛔ a break no register entry names is marked so — the cell, the run’s completion over it, the counts and the markdown', () => {
		const r = reportOf(
			aRun({ design: { stepState: 'SUCCEEDED', completion: 'hand', commandFloor: ['SATISFIED', 'SATISFIED', 'REJECTED'], commands: 1 } })
		).report;
		const c = cellOf(r, '5a', 'design');
		expect([c.value, c.registerIds, c.unregistered]).toEqual(['broke', [], true]);
		expect(cellOf(r, '3', 'design').unregistered).toBeUndefined();
		expect(r.answer.brokeUnregistered).toBe(r.matrix.filter((m) => m.unregistered === true).length);
		expect(r.answer.brokeUnregistered).toBeGreaterThan(0);
		const md = renderMarkdown(r);
		expect(md).toContain('broke (unregistered: P7-5 owes an entry)');
		expect(md).toContain(`- **Breaks no register entry names yet:** ${r.answer.brokeUnregistered}; P7-5 owes each an entry before it reports it.`);
		// ⛔ A unit's unregistered break reaches the run's completion beside the ids of the others.
		const both = reportOf(
			aRun({
				design: { stepState: 'RUNNING', unit: { lifecycle: 'EXECUTING', execution: 'RUNNING', assurance: 'UNASSESSED' } },
				implementation: { unit: { lifecycle: 'UNDER_ASSURANCE', execution: 'SUCCEEDED', assurance: 'REJECTED' }, signedOff: false, signOffPressed: 'failure' }
			})
		).report;
		const whole = cellOf(both, '7', 'whole run');
		expect([whole.value, whole.registerIds, whole.unregistered]).toEqual(['broke', ['REG-F-511'], true]);
		expect(renderMarkdown(both)).toContain('| 7 Completion | broke (REG-F-511; unregistered: P7-5 owes an entry) |');
	});

	it('⛔ stage 3’s breaks: the executor gave no answer (REG-F-511), or Begin & Execute was refused before its plan', () => {
		const stopped = { stepState: 'FAILED', unit: { lifecycle: 'EXECUTING', execution: 'RUNNING', assurance: 'UNASSESSED' } };
		const noAnswer = reportOf(aRun({ design: { ...stopped, tries: [{ disposition: 'NO_RESPONSE' }], workProducts: 0 } })).report;
		const c = cellOf(noAnswer, '3', 'design');
		expect(shown(c)).toEqual(['broke', ['REG-F-511']]);
		expect(c.basis[0]).toBe("the executor's last try gave no answer: NO_RESPONSE:PARSED");
		// Pressed — the lane recorded its refusal — and no plan in the store.
		const run = aRun({ design: { begun: false } });
		const refused = {
			...run.lane,
			run: {
				...(run.lane.run as Record<string, unknown>),
				units: ((run.lane.run as { units: Record<string, unknown>[] }).units).map((u) =>
					u.slug === 'design' ? { ...u, beginExecute: { status: 200, envelopeType: 'failure', timedOutAfterMs: null } } : u
				)
			}
		};
		const before = cellOf(buildRunReport(run.store, refused, { accountNames: NAMES }).report, '3', 'design');
		expect([before.value, before.registerIds, before.unregistered, before.basis]).toEqual([
			'broke',
			[],
			true,
			['Begin & Execute was refused before its plan started (failure)']
		]);
	});

	it('⛔ E12F F1 (REG-D-112 (b)) — stage 7: a sign-off the lane held back BEFORE the reviewer call (a dry run’s, or the limit’s) is one never attempted — not reached, never broke', () => {
		// ⛔ PREDICTED RED, read from the code: broke — the lane's record of a sign-off read as attempted whenever one was
		// recorded, and a dry run's root, its sign-off rehearsed and not pressed, is not SATISFIED.
		const unbegun = { begun: false };
		const run = aRun(
			{ requirements: unbegun, design: unbegun, implementation: unbegun, 'end-to-end': unbegun },
			{ rootSignedOff: false, run: { mode: 'dry', end: { reason: 'dry-run-stop' }, dryRun: { modelExchanges: 0 } } }
		);
		const laneRun = run.lane.run as { units: Record<string, unknown>[] };
		const held = (notPressed: string): LaneRows => ({
			...run.lane,
			run: {
				...laneRun,
				units: laneRun.units.map((u) =>
					u.slug === 'root'
						? { ...u, stopped: false, signOff: { offered: true, limitCheck: null, recordAssurance: null, rerunDeclared: null, rerunLimitCheck: null, markSatisfied: null, refused: null, notPressed } }
						: u
				)
			}
		});
		for (const why of ['not reached in a dry run: Record Assurance asks the reviewer …', 'the limit: 234 of 230 reviewer calls …']) {
			const c = cellOf(buildRunReport(run.store, held(why), { accountNames: NAMES }).report, '7', 'whole run');
			// ⭐ P5 package B (F3, F6) — and the root's line says what held it back, as a skipped sign-off's says why.
			expect(c.basis[0], why).toBe(`root: not reached — its sign-off was held back before Record Assurance: ${why}`);
		}
	});

	it('⛔ E12F F2, F3 — stage 7: a sign-off whose Record Assurance WAS pressed, and refused, the rule’s re-run then held back by the limit, was attempted — broke, never not reached', () => {
		// ⛔ PREDICTED RED, read from the code: not reached — any `notPressed` read as a sign-off never attempted, though Record
		// Assurance was pressed, and refused, before the limit held the declared re-run back.
		const unbegun = { begun: false };
		const run = aRun(
			{ requirements: unbegun, design: unbegun, implementation: unbegun, 'end-to-end': unbegun },
			{ rootSignedOff: false, run: { end: { reason: 'paid-limit' } } }
		);
		const laneRun = run.lane.run as { units: Record<string, unknown>[] };
		const signOff = {
			offered: true,
			limitCheck: null,
			recordAssurance: { status: 400, envelopeType: 'failure', after: null },
			rerunDeclared: null,
			rerunLimitCheck: null,
			markSatisfied: null,
			refused: { act: 'Record Assurance', reason: 'a verdict that did not conclude leaves this PWU under assessment.' },
			notPressed: 'the limit: 232 of 230 reviewer calls …'
		};
		const lane: LaneRows = {
			...run.lane,
			run: { ...laneRun, units: laneRun.units.map((u) => (u.slug === 'root' ? { ...u, stopped: false, signOff } : u)) }
		};
		const c = cellOf(buildRunReport(run.store, lane, { accountNames: NAMES }).report, '7', 'whole run');
		expect([c.value, c.basis[0]], 'a pressed Record Assurance read as a sign-off never attempted').toEqual([
			'broke',
			'root: broke — its sign-off was held back before the rule’s re-run of its declared reviews: the limit: 232 of 230 reviewer calls …'
		]);
	});

	// ── ⛔⛔ E12’s polish (fix2’s F8; the lead’s delegated decision of 2026-10-15, to be registered) — THE REPORT DISCLOSES WHAT THE
	// LANE HELD BACK: nothing read the sign-off record's `notPressed`, `limitCheck` or `rerunLimitCheck`, so only the header's
	// "ended: paid-limit" said the limit had acted at all.
	/**
	 * What the lane read of the limit before an act, as `limitCheck` records it (`phase7-operator.ts`) — ⭐ by the one rule (the
	 * lead's delegated decision of 2026-10-16, registered as REG-D-114 (14)): what the act counts always recorded, and a total
	 * AT the limit let through. ~~`ahead` only when above 0; `allowed: total < limit`~~
	 */
	const read = (prior: number, recorded: number, ahead: number, limit = 230) => {
		const total = prior + recorded + 4 + ahead;
		return { prior, recorded, reserve: 4, ahead, total, limit, allowed: total <= limit };
	};
	/** A run the lane stopped at design's sign-off: its phases completed, nothing signed off, design's record `signOff`. */
	const heldAtDesign = (signOff: Record<string, unknown>, unit = { lifecycle: 'EXECUTING', execution: 'SUCCEEDED', assurance: 'UNASSESSED' }) => {
		const completed = { lifecycle: 'EXECUTING', execution: 'SUCCEEDED', assurance: 'UNASSESSED' };
		const run = aRun(
			{ requirements: { unit: completed, signedOff: false }, design: { unit, signedOff: false }, implementation: { unit: completed, signedOff: false }, 'end-to-end': { unit: completed, signedOff: false } },
			{ rootSignedOff: false, run: { end: { reason: 'paid-limit' } } }
		);
		const laneRun = run.lane.run as { units: Record<string, unknown>[] };
		const lane: LaneRows = { ...run.lane, run: { ...laneRun, units: laneRun.units.map((u) => (u.slug === 'design' ? { ...u, signOff } : u)) } };
		return buildRunReport(run.store, lane, { accountNames: NAMES }).report;
	};
	const unpressed = { recordAssurance: null, rerunDeclared: null, rerunLimitCheck: null, markSatisfied: null, refused: null };
	const OVER = "the limit: 234 of 230 reviewer calls, the sign-off's own 16 counted (D8; E12F F2)";

	it('⛔ E12’s polish (fix2’s F8) — stage 7: a sign-off the LIMIT held back reads as held back by the limit, its reason and its check — never as one never attempted', () => {
		// ⛔ PREDICTED RED, read from the code: "its sign-off was never attempted", the words a run cut short before its sign-offs
		// reads, and nothing of the 234 of 230 or the sign-off's own 16 calls.
		const r = heldAtDesign({ offered: true, limitCheck: read(210, 4, 16), ...unpressed, notPressed: OVER });
		const c = cellOf(r, '7', 'design');
		expect([c.value, c.basis], 'a sign-off the limit held back read as one never attempted').toEqual([
			'not reached',
			[
				'design: lifecycle EXECUTING, assurance UNASSESSED, step SUCCEEDED',
				`its sign-off was held back before Record Assurance: ${OVER}`,
				// ⭐ ONE RULE (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (14)) — ~~not under it~~.
				'the limit as the lane read it: 210 + 4 + 4 + 16 ahead = 234 of 230, past it'
			]
		]);
		// ~~⭑ CONTROL — a unit the lane never reached, the run stopped at design: never attempted, as before.~~ ⛔ R3-B F4 (the
		// lead's round-3 item 4): a sign-off the lane skipped after it stopped at
		// design's limit check is not attempted BECAUSE it stopped there — the next test's.
		expect(cellOf(r, '7', 'implementation').basis.at(-1)).toBe(
			'its sign-off was not attempted: the lane stopped at the design unit’s limit check, before Record Assurance, and pressed no sign-off after it (D8)'
		);
	});

	// ── ⛔ R3-B F4 (the lead's round-3 item 4) — A SIGN-OFF THE LANE SKIPPED AFTER IT
	// STOPPED AT A UNIT'S LIMIT CHECK reads as not attempted because the lane stopped there: the lane signs off the phases that
	// completed, in order, then the root, and a limit check that holds a sign-off back ends that loop (`runTheLane`, D8).
	it('⛔ R3-B F4 — every later sign-off the lane skipped after stopping at a unit’s limit check, the root’s included, reads as not attempted because the lane stopped there — never as one never attempted', () => {
		// ⛔ PREDICTED RED, read from the code: "its sign-off was never attempted", the words a run cut short reads, for each unit
		// after the one whose check held back; and the root's line in the whole run's stage 7 said only "not reached".
		const r = heldAtDesign({ offered: true, limitCheck: read(210, 4, 16), ...unpressed, notPressed: OVER });
		const why =
			'its sign-off was not attempted: the lane stopped at the design unit’s limit check, before Record Assurance, and pressed no sign-off after it (D8)';
		expect([cellOf(r, '7', 'implementation').basis.at(-1), cellOf(r, '7', 'end-to-end').basis.at(-1)]).toEqual([why, why]);
		expect(cellOf(r, '7', 'whole run').basis, 'the root’s sign-off, skipped, said nothing of why').toContain(`root: not reached — ${why}`);
		// ⭑ CONTROL — a unit BEFORE the stop whose record holds no sign-off is not said to have been skipped by it.
		expect(cellOf(r, '7', 'requirements').basis.at(-1)).toBe('its sign-off was never attempted');
	});

	it('⛔ R3-B F4 — and after the lane stopped at the limit check before the rule’s re-run of a unit’s declared reviews, the later sign-offs say that', () => {
		// ⛔ PREDICTED RED, read from the code: "its sign-off was never attempted".
		const r = heldAtDesign(
			{
				offered: true,
				limitCheck: read(206, 0, 16),
				...unpressed,
				recordAssurance: { status: 200, envelopeType: 'failure', timedOutAfterMs: null, requestFailure: null, refusal: 'not concluded', after: null },
				rerunLimitCheck: read(206, 12, 16),
				refused: { act: 'Record Assurance', reason: 'not concluded' },
				notPressed: "the limit: 238 of 230 reviewer calls, the sign-off's own 16 counted (D8; E12F F2)"
			},
			{ lifecycle: 'UNDER_ASSURANCE', execution: 'SUCCEEDED', assurance: 'ASSESSING' }
		);
		expect(cellOf(r, '7', 'implementation').basis.at(-1)).toBe(
			'its sign-off was not attempted: the lane stopped at the design unit’s limit check, before the rule’s re-run of its declared reviews, and pressed no sign-off after it (D8)'
		);
	});

	it('⛔ E12’s polish (fix2’s F8) — stage 7: the rule’s re-run of the declared reviews the limit held back is said beside the refused Record Assurance — broke, as before, the hold named', () => {
		// ⛔ PREDICTED RED, read from the code: a plain "its sign-off was attempted and the unit is not SATISFIED" — the limit's
		// part in leaving the unit under assessment said nowhere.
		const rerunOver = "the limit: 238 of 230 reviewer calls, the sign-off's own 16 counted (D8; E12F F2)";
		const r = heldAtDesign(
			{
				offered: true,
				limitCheck: read(206, 0, 16),
				...unpressed,
				recordAssurance: { status: 200, envelopeType: 'failure', timedOutAfterMs: null, requestFailure: null, refusal: 'not concluded', after: null },
				rerunLimitCheck: read(206, 12, 16),
				refused: { act: 'Record Assurance', reason: 'not concluded' },
				notPressed: rerunOver
			},
			{ lifecycle: 'UNDER_ASSURANCE', execution: 'SUCCEEDED', assurance: 'ASSESSING' }
		);
		expect(cellOf(r, '7', 'design').basis.slice(1), 'the hold of the declared re-run is said nowhere').toEqual([
			'its sign-off was attempted and the unit is not SATISFIED',
			`its sign-off was held back before the rule’s re-run of its declared reviews: ${rerunOver}`,
			// ⭐ ONE RULE (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (14)) — ~~not under it~~.
			'the limit as the lane read it: 206 + 12 + 4 + 16 ahead = 238 of 230, past it'
		]);
	});

	it('⛔ E12’s polish (fix2’s F8) — the reviewer calls list the lane’s own reads of the limit — before each phase, each re-run, each sign-off and each re-run of the declared reviews — and which held its act back', () => {
		// ⛔ PREDICTED RED, read from the code: the section printed the record's own count alone (prior + recorded + reserve);
		// the reads the lane made before each paid act, the one that held design's sign-off back among them, were nowhere.
		const run = aRun({}, { run: { end: { reason: 'paid-limit' } } });
		const laneRun = run.lane.run as { units: Record<string, unknown>[] };
		const at = (slug: string, fields: Record<string, unknown>) => (u: Record<string, unknown>) => (u.slug === slug ? { ...u, ...fields } : u);
		const units = laneRun.units
			.map(at('requirements', { limitCheck: read(200, 0, 0), recovery: [{ act: 'rerunReview', limitCheck: read(200, 2, 0) }, { act: 'abandonPwu', limitCheck: null }] }))
			.map(at('design', { limitCheck: read(200, 4, 0), signOff: { offered: true, limitCheck: read(210, 4, 16), ...unpressed, notPressed: OVER } }))
			.map(
				at('implementation', {
					signOff: {
						offered: true,
						limitCheck: read(205, 6, 12),
						...unpressed,
						recordAssurance: { status: 200, envelopeType: 'failure', after: null },
						rerunLimitCheck: read(205, 18, 12),
						notPressed: 'the limit: 239 of 230 …'
					}
				})
			);
		const r = buildRunReport(run.store, { ...run.lane, run: { ...laneRun, units } }, { accountNames: NAMES }).report;
		expect(r.reviewerCalls, 'the section carries none of the lane’s reads of the limit').toHaveProperty('laneLimitChecks');
		expect(r.reviewerCalls.laneLimitChecks.map((c) => [c.unit, c.before, c.total, c.allowed]), 'the lane’s reads of the limit').toEqual([
			['requirements', 'its Begin & Execute', 204, true],
			['requirements', 'the rule’s re-run of its review', 206, true],
			['design', 'its Begin & Execute', 208, true],
			['design', 'its sign-off', 234, false],
			['implementation', 'its sign-off', 227, true],
			['implementation', 'the rule’s re-run of its declared reviews', 239, false]
		]);
		const md = renderMarkdown(r);
		expect(md).toContain("- **The lane's own reads of the limit, each before a paid act (design D8; E12F F2):** 6.");
		// ⭐ ONE RULE (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (14)) — ~~not under it~~: past it.
		expect(md).toContain('  - design, before its sign-off: 210 + 4 + 4 + 16 ahead = 234 of 230, past it: held back.');
		expect(md).toContain('  - requirements, before its Begin & Execute: 200 + 0 + 4 = 204 of 230, under it.');
	});

	it('⛔ the merge’s fix round, F2 — each read’s figures are worded by their arithmetic: below the limit “under it”; AT it, let through by the rule that lets an act reach it, “at it”; at it under the rule that does not, ~~“not under it”~~ ⭐ “at it”, held back (the one rule’s words)', () => {
		// ⛔ PREDICTED RED, read from the code: `limitFigures` worded a read by its verdict alone — "under it" for every read the
		// lane let through — so a total EQUAL to the limit that `limitCheckAhead` lets through (Send, half B's root) read "under it".
		const run = aRun({}, { run: { end: { reason: 'paid-limit' } } });
		const laneRun = run.lane.run as { units: Record<string, unknown>[] };
		const at = (slug: string, fields: Record<string, unknown>) => (u: Record<string, unknown>) => (u.slug === slug ? { ...u, ...fields } : u);
		/** A read by ~~`limitCheckAhead`'s rule~~ ⭐ the one rule: the act's worst case counted, and a total that REACHES the limit let through. */
		const reaching = { prior: 196, recorded: 10, reserve: 4, ahead: 20, total: 230, limit: 230, allowed: true };
		/** ⭐ A read made before the one rule, by E12's `limitCheck`: a total AT the limit held back. */
		const heldAtTheLimit = { prior: 216, recorded: 10, reserve: 4, total: 230, limit: 230, allowed: false };
		const units = laneRun.units
			.map(at('root', { limitCheck: reaching }))
			.map(at('requirements', { limitCheck: read(215, 10, 0) }))
			.map(at('design', { limitCheck: heldAtTheLimit }));
		const md = renderMarkdown(buildRunReport(run.store, { ...run.lane, run: { ...laneRun, units } }, { accountNames: NAMES }).report);
		expect(md).toContain('  - root, before its Begin & Execute: 196 + 10 + 4 + 20 ahead = 230 of 230, at it, which this act may reach.');
		expect(md).toContain('  - requirements, before its Begin & Execute: 215 + 10 + 4 = 229 of 230, under it.');
		// ~~⭑ `limitCheck`'s rule: the same total held back — never "at it", which says the act may reach the limit.~~ ⭐ ONE RULE
		// (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (14)): a lane now lets every act reach the limit,
		// so the same total held back is a record made before the one rule — "at it", never one the act may reach.
		expect(md).toContain('  - design, before its Begin & Execute: 216 + 10 + 4 = 230 of 230, at it: held back.');
	});

	it('⛔ ONE RULE (the lead’s delegated decision of 2026-10-16, registered as REG-D-114 (14)) — the words follow it: a read PAST the limit reads “past it”', () => {
		// ⛔ PREDICTED RED, read from the code: the words were the old rule's, a total UNDER the limit or not — a read past the
		// limit "not under it".
		const run = aRun({}, { run: { end: { reason: 'paid-limit' } } });
		const laneRun = run.lane.run as { units: Record<string, unknown>[] };
		const past = { prior: 210, recorded: 4, reserve: 4, ahead: 16, total: 234, limit: 230, allowed: false };
		const units = laneRun.units.map((u) => (u.slug === 'design' ? { ...u, signOff: { offered: true, limitCheck: past } } : u));
		const md = renderMarkdown(buildRunReport(run.store, { ...run.lane, run: { ...laneRun, units } }, { accountNames: NAMES }).report);
		expect(md).toContain('  - design, before its sign-off: 210 + 4 + 4 + 16 ahead = 234 of 230, past it: held back.');
	});

	it('⛔ ONE RULE — the run’s own total AT the limit reads “at it”, which a run may reach; one past it, “PAST it”', () => {
		// ⛔ PREDICTED RED, read from the code: a run whose total reached the limit exactly read "NOT under it", as though it had
		// passed it.
		const L = PAID_LIMIT;
		const whole = (prior: number) =>
			renderMarkdown(
				reportOf(aRun({}, { lane: { boot: { inherited: { JPWB_PHASE7_PRIOR_REVIEWER_CALLS: String(prior) }, overlay: { JPWB_DEMO_DB: DEMO_DB } } } }))
					.report
			);
		expect(whole(L - 8)).toContain(`- **The limit (design D8):** ${L - 8} + 4 + 4 = ${L} of ${L}, at it, which the run may reach.`);
		expect(whole(L - 7)).toContain(`- **The limit (design D8):** ${L - 7} + 4 + 4 = ${L + 1} of ${L}, PAST it.`);
		expect(whole(L - 9)).toContain(`- **The limit (design D8):** ${L - 9} + 4 + 4 = ${L - 1} of ${L}, under it.`);
	});

	// ── ⛔ `REG-D-114` (14), AS AMENDED 2026-10-16 — THE REPORT SAYS WHAT EACH CHECK COUNTED, AND THAT A PHASE'S OWN SPEND CAN
	// CARRY THE TOTAL PAST THE LIMIT: the lane counts one try's reserve before a phase, the rule's re-run of its work or of its
	// review, and a MODEL root's press — an act's worst case before a sign-off, a re-run of its declared reviews and Send — and
	// checks before each press, never during one.
	it('⛔ REG-D-114 (14), as amended — each of the lane’s reads says what it counted ahead of its act, in the lane’s own words; a read recorded before the lane said so, its figures alone', () => {
		// ⛔ PREDICTED RED, read from the code: `limitFigures` printed `+ N ahead` alone, and nothing for a read that counted none,
		// so a reader could not tell one try's reserve from an act's worst case, nor a root that runs no model from a read of none.
		const run = aRun({}, { run: { end: { reason: 'paid-limit' } } });
		const laneRun = run.lane.run as { units: Record<string, unknown>[] };
		const at = (slug: string, fields: Record<string, unknown>) => (u: Record<string, unknown>) => (u.slug === slug ? { ...u, ...fields } : u);
		const said = (prior: number, recorded: number, ahead: number, counted: string) => ({ ...read(prior, recorded, ahead, 450), counted });
		const units = laneRun.units
			.map(at('root', { limitCheck: said(300, 3, 0, 'none: it runs no model') }))
			.map(
				at('requirements', {
					limitCheck: said(300, 3, 4, 'one try’s reserve'),
					recovery: [{ act: 'rerunWork', limitCheck: said(300, 9, 4, 'one try’s reserve') }]
				})
			)
			.map(
				at('design', {
					limitCheck: read(300, 12, 0, 450),
					signOff: { offered: true, limitCheck: said(300, 20, 16, 'its declared reviews’ worst case'), ...unpressed, notPressed: null }
				})
			);
		const md = renderMarkdown(buildRunReport(run.store, { ...run.lane, run: { ...laneRun, units } }, { accountNames: NAMES }).report);
		const lines = md.split('\n').filter((line) => line.startsWith('  - ') && line.includes(' of 450, '));
		expect(lines, 'a read of the limit does not say what it counted').toEqual([
			'  - root, before its Begin & Execute: 300 + 3 + 4 + 0 ahead (none: it runs no model) = 307 of 450, under it.',
			'  - requirements, before its Begin & Execute: 300 + 3 + 4 + 4 ahead (one try’s reserve) = 311 of 450, under it.',
			'  - requirements, before the rule’s re-run of its work: 300 + 9 + 4 + 4 ahead (one try’s reserve) = 317 of 450, under it.',
			// ⭑ CONTROL — a read recorded before the lane said what it counted: its figures alone, as before.
			'  - design, before its Begin & Execute: 300 + 12 + 4 = 316 of 450, under it.',
			'  - design, before its sign-off: 300 + 20 + 4 + 16 ahead (its declared reviews’ worst case) = 340 of 450, under it.'
		]);
	});

	it('⛔ REG-D-114 (14), as amended — the reviewer calls carry a plain caveat, in report.json and report.md: a phase’s own spend can carry the total past the limit, because the lane checks before each press, not during one', () => {
		// ⛔ PREDICTED RED, read from the code: the report said nothing of it, so a run whose reads each let a press through read
		// as a run held to the limit throughout.
		// ⭐ P5 package C (F2) — ~~the sponsor’s limit is "about 450", REG-D-110 (1)~~: the sponsor raised it to about 600
		// (`REG-D-117` Q10, raising `REG-D-110` (1)'s), and the caveat names the ruling that set it.
		// ⭐ P6 package L (F1) — ~~"about 600", REG-D-117 Q10~~: the sponsor raised it again, to about 650 (`REG-D-120` Q15,
		// raising `REG-D-110` (1)'s), and the caveat names that ruling.
		// ⭐ Package Q (F5) — ~~"about 650", REG-D-120 Q15~~: the sponsor raised it again, to about 800 (`REG-D-123` Q26, raising
		// `REG-D-110` (1)'s), and the caveat names that ruling.
		// ⭐ The review in parts, package C (B6) — ~~"about 800", REG-D-123 Q26~~: the sponsor raised it again, to about 900
		// (`REG-D-126` Q32, raising `REG-D-110` (1)'s), and the caveat names that ruling.
		// ⭐ The review in parts, package I (B8b) — ~~"about 900", REG-D-126 Q32~~: the sponsor raised it again, to about 1,000
		// (`REG-D-131` Q37, raising `REG-D-110` (1)'s), held by the lane as 1000, and the caveat names that ruling.
		const caveat =
			'A phase’s own spend can carry the total past the limit: the lane checks the limit before each press, not during one, ' +
			'and a model unit’s press may spend up to 140 reviewer calls after its check (REG-D-114 (14), as amended ' +
			'2026-10-16; the sponsor’s limit is "about 1000", REG-D-131 Q37, raising REG-D-110 (1)).';
		const r = reportOf(aRun({})).report;
		expect(renderMarkdown(r), 'report.md carries no caveat that a press can spend past the limit').toContain(`- **Caveat:** ${caveat}`);
		expect(r.reviewerCalls.limitCaveat, 'report.json carries no caveat that a press can spend past the limit').toBe(caveat);
	});

	it('⛔ stage 7’s sign-off: the lane’s dry run signs the root off (D11) — the root as intended, the run not reached; one never attempted, in a run cut short — not reached; one refused — broke', () => {
		// ⚠ `E12F` F1 — A DRY RUN BEFORE `REG-D-112` (b): its root signed off by the paid run's own acts. Kept, for an archive made
		// then; a dry run now rehearses the sign-off up to the reviewer call and presses nothing (the case above).
		const unbegun = { begun: false };
		// ⭐ THE LANE'S DRY RUN, AS D11 MAKES IT (design §6 P7-2): the root pressed, then signed off by the paid run's own
		// acts — each kept in lane/actions — and SATISFIED; the final archive taken, and read; the four phases never pressed.
		const run = aRun(
			{ requirements: unbegun, design: unbegun, implementation: unbegun, 'end-to-end': unbegun },
			{ run: { mode: 'dry', end: { reason: 'dry-run-stop' }, dryRun: { modelExchanges: 0 } } }
		);
		const after = (lifecycleState: string, assuranceState: string) => ({ lifecycleState, executionState: 'SUCCEEDED', assuranceState, planStepState: 'SUCCEEDED' });
		const laneRun = run.lane.run as { units: Record<string, unknown>[] };
		const dryLane: LaneRows = {
			...run.lane,
			run: {
				...laneRun,
				units: laneRun.units.map((u) =>
					u.slug === 'root'
						? {
								...u,
								after: after('EXECUTING', 'UNASSESSED'),
								stopped: false,
								signOff: {
									offered: true,
									recordAssurance: { status: 200, envelopeType: 'success', after: after('UNDER_ASSURANCE', 'SATISFIED') },
									markSatisfied: { status: 200, envelopeType: 'success', after: after('SATISFIED', 'SATISFIED') },
									refused: null
								}
							}
						: u
				)
			},
			actions: ['beginExecute', 'markSatisfied', 'recordAssurance'].map((action) => ({ file: `01-root-${action}.json`, action, envelopeType: 'success' })),
			archives: [...run.lane.archives, { name: '06-final', workspaceTree: null, captures: null, processOutputRecorded: false }]
		};
		const dry = buildRunReport(run.store, dryLane, { accountNames: NAMES }).report;
		// ⭐ P5 package B (F6) — its root's declared verdicts are recorded, and no phase below it holds a completion: its line
		// says what they were given (⭐ its check, finding 2: given, not judged over).
		const none = PHASE7_UNITS.slice(1).map((u) => `; ${u.title} contributed none, holding no completion (lifecycle PROPOSED, assurance UNASSESSED)`);
		expect(cellOf(dry, '7', 'whole run').basis.slice(0, 5)).toEqual([
			`root: as intended — its declared reviews were given the work of no unit below it${none.join('')}`,
			'requirements: not reached',
			'design: not reached',
			'implementation: not reached',
			'end-to-end: not reached'
		]);
		expect(cellOf(dry, '7', 'whole run').value, 'a run whose four phases never ran reads as complete').toBe('not reached');
		for (const p of ['requirements', 'design', 'implementation', 'end-to-end'])
			for (const s of ['3', '4', '5a', '5b', '6', '7', '8']) expect(cellOf(dry, s, p).value, `${s} ${p}`).toBe('not reached');
		expect([dry.units[0]!.state, dry.units[0]!.step?.stepState, dry.units[0]!.lane?.stopped]).toEqual([
			{ lifecycle: 'SATISFIED', execution: 'SUCCEEDED', assurance: 'SATISFIED' },
			'SUCCEEDED',
			false
		]);
		expect([dry.run.mode, dry.run.endReason, dry.run.archivesPresent, dry.run.archiveRead]).toEqual([
			'dry',
			'dry-run-stop',
			['01-root', '06-final'],
			'06-final'
		]);
		// The root's two declared verdicts, and its sign-off no forbidden act: Mark Satisfied after an accepted Record Assurance.
		expect([dry.declaredVerdicts.rows.map((d) => d.unit), dry.audit.forbiddenFound, dry.problems]).toEqual([['root', 'root'], 0, []]);
		// ⭐ Stage 2 alone was reached and could have failed: the dry run is no "Yes".
		expect(dry.answer).toMatchObject({ open: 0, measured: 1 });
		// ⛔ A unit that completed and whose sign-off was NEVER ATTEMPTED — a run cut short before its sign-offs (D4) — is not
		// reached, never broke: the rule the dry run's root held before D11.
		const completed = { lifecycle: 'EXECUTING', execution: 'SUCCEEDED', assurance: 'UNASSESSED' };
		const cut = reportOf(
			aRun(
				{
					requirements: { unit: completed, signedOff: false },
					design: { unit: completed, signedOff: false },
					implementation: { stepState: 'RUNNING', unit: { lifecycle: 'EXECUTING', execution: 'RUNNING', assurance: 'UNASSESSED' }, timedOutAfterMs: 38_160_000 },
					'end-to-end': unbegun
				},
				{ rootSignedOff: false, run: { end: { reason: 'allowance-exceeded' } } }
			)
		).report;
		expect([cellOf(cut, '7', 'design').value, cellOf(cut, '7', 'design').basis.at(-1)]).toEqual([
			'not reached',
			'its sign-off was never attempted'
		]);
		expect(cellOf(cut, '7', 'whole run').basis[0]).toBe('root: not reached');
		const assuredRefused = { lifecycle: 'UNDER_ASSURANCE', execution: 'SUCCEEDED', assurance: 'REJECTED' };
		const refused = reportOf(aRun({ design: { unit: assuredRefused, signedOff: false, signOffPressed: 'failure' } })).report;
		expect([cellOf(refused, '7', 'design').value, cellOf(refused, '7', 'design').basis.at(-1)]).toEqual([
			'broke',
			'its sign-off was attempted and the unit is not SATISFIED'
		]);
		const conditional = { lifecycle: 'UNDER_ASSURANCE', execution: 'SUCCEEDED', assurance: 'CONDITIONALLY_SATISFIED' };
		expect(shown(cellOf(reportOf(aRun({ design: { unit: conditional, signedOff: false } })).report, '7', 'design'))).toEqual([
			'broke',
			['REG-F-403']
		]);
	});

	it('⛔ stage 8 asks whether a person can READ each exchange: bytes that do not hash, bytes never retained, no content store', () => {
		const mismatch = cellOf(reportOf(aRun({ design: { content: 'mismatch' } })).report, '8', 'design');
		expect(mismatch.value).toBe('broke');
		expect(mismatch.basis).toContain('1 exchange does not hold what its record claims');
		const unretained = cellOf(reportOf(aRun({ design: { content: 'unretained' } })).report, '8', 'design');
		expect(unretained.value).toBe('broke');
		expect(unretained.basis.join(' ')).toMatch(/1 exchange retained no bytes of what was asked or what was answered \(PENDING_CONTENT_PLANE\)/);
		const absent = reportOf(aRun({}, { contentStore: false })).report;
		for (const p of ['requirements', 'design', 'implementation', 'end-to-end'])
			expect(cellOf(absent, '8', p).basis, p).toContain('the content store is not in the archive, so no stored content can be read');
		// ⭐ A call that got no answer has none to read: its asked bytes are enough.
		const thrown = reportOf(aRun({ design: { review: [{ role: 'INITIAL', disposition: 'NO_RESPONSE', ordinal: 1 }, { role: 'RETRY', disposition: 'ACCEPTED', ordinal: 2 }] } })).report;
		expect(cellOf(thrown, '8', 'design').value).toBe('as intended');
		// ⭐ And a phase that asked no model anything could not have failed here.
		const asked = reportOf(aRun({ design: { tries: [], workProducts: 0, stepState: 'FAILED', unit: { lifecycle: 'EXECUTING', execution: 'RUNNING', assurance: 'UNASSESSED' } } })).report;
		expect(cellOf(asked, '8', 'design').value).toBe('not reached');
	});

	it('⛔ an exchange’s reading, ref by ref: asked and answered VERIFIED; a disclosed absence is still not readable', () => {
		const row = (key: string): StoredContent => ({ storageKey: key, contentHash: 'sha256:aa', byteSize: 3, purged: false, actualHash: 'sha256:aa', actualSize: 3 });
		const content = new Map([['in', row('in')], ['ans', row('ans')]]);
		const ref = (key: string) => ({ status: 'STORED', storageKey: key, contentHash: 'sha256:aa', byteSize: 3 });
		const pending = { status: 'PENDING_CONTENT_PLANE' };
		const x = (state: Record<string, unknown>) => exchange({ disposition: 'ACCEPTED', ...state });
		expect(exchangeReading(x({ materializedInputRef: ref('in'), answerSpanRef: ref('ans') }), content)).toBe('readable');
		expect(exchangeReading(x({ materializedInputRef: ref('in'), answerSpanRef: pending }), content)).toBe('not retained');
		expect(exchangeReading(x({ materializedInputRef: pending, answerSpanRef: ref('ans') }), content)).toBe('not retained');
		expect(exchangeReading(x({ materializedInputRef: ref('in'), answerSpanRef: ref('gone') }), content)).toBe('does not hold what it claims');
		expect(exchangeReading(exchange({ disposition: 'NO_RESPONSE', materializedInputRef: ref('in'), answerSpanRef: pending }), content)).toBe('readable');
	});

	it('⭐ P7-6 I2 (REG-F-351) — a reply KEPT WHOLE because no answer span could be located in it is what was answered: readable', () => {
		// ⭐ `DESIGN-the-reviewer-isolated.md` §2 I2: *"A reply that does not parse is then readable, and stage 8 can be read
		// in full."* The reviewer's plane keeps such a reply under `rawOutputBeforeCoercionRef`, its answer span PENDING
		// (no span could be located), so a reader that asks only for the span reads it as never retained.
		const row = (key: string): StoredContent => ({ storageKey: key, contentHash: 'sha256:aa', byteSize: 3, purged: false, actualHash: 'sha256:aa', actualSize: 3 });
		const content = new Map([['in', row('in')], ['raw', row('raw')]]);
		const ref = (key: string) => ({ status: 'STORED', storageKey: key, contentHash: 'sha256:aa', byteSize: 3 });
		const pending = { status: 'PENDING_CONTENT_PLANE' };
		const kept = { materializedInputRef: ref('in'), answerSpanRef: pending, rawOutputBeforeCoercionRef: ref('raw') };
		// ⛔ THE MUTANT: the answer read off `answerSpanRef` alone — the kept reply reads `not retained`, as at HEAD.
		expect(exchangeReading(exchange({ disposition: 'REPAIR_REQUESTED', ...kept }), content)).toBe('readable');
		// ⭑ CONTROL — and a kept reply whose bytes are gone still does not hold what it claims.
		expect(exchangeReading(exchange({ disposition: 'REPAIR_REQUESTED', ...kept, rawOutputBeforeCoercionRef: ref('gone') }), content)).toBe(
			'does not hold what it claims'
		);
		// ⭑ CONTROL — and with neither the span nor the whole reply kept, nothing of what was answered can be read.
		expect(exchangeReading(exchange({ disposition: 'REPAIR_REQUESTED', ...kept, rawOutputBeforeCoercionRef: pending }), content)).toBe(
			'not retained'
		);
	});

	it('⛔ the ids a review that did not conclude bears on: a command’s (REG-F-520), a failed repair’s (REG-F-489, REG-F-428, REG-F-479)', () => {
		const transport = [
			{ role: 'INITIAL', disposition: 'NO_RESPONSE', ordinal: 1 },
			{ role: 'RETRY', disposition: 'NO_RESPONSE', ordinal: 2 }
		];
		const command = reportOf(aRun({ implementation: { commands: 1, commandReview: transport } })).report;
		expect(shown(cellOf(command, '4', 'implementation'))).toEqual(['broke', ['REG-F-499', 'REG-F-520']]);
		const repair = [
			{ role: 'INITIAL', disposition: 'REPAIR_REQUESTED', ordinal: 1, parse: 'JSON_PARSE_FAILED' },
			{ role: 'REPAIR', disposition: 'REJECTED', ordinal: 2, parse: 'JSON_PARSE_FAILED' }
		];
		expect(shown(cellOf(reportOf(aRun({ design: { review: repair } })).report, '4', 'design'))).toEqual([
			'broke',
			['REG-F-428', 'REG-F-479', 'REG-F-489']
		]);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7 P5, package C (F1; `REG-D-118` (4)) — A REVIEW THAT ENDED ON A REPLY THE TOOL CUT AT THE MODEL'S
	// OUTPUT-TOKEN LIMIT bears on `REG-F-563`, the entry that records the cap. ⛔ Since package A labelled such a review
	// `output-limit`, its stage-4 cell read broke with no id — unregistered — where the same failure, labelled `no-response`,
	// had cited `REG-F-499`.
	it('⛔ P5 C — a review that ended on a cut at the output-token limit broke stage 4 citing REG-F-563 — never unregistered', () => {
		/** A call the tool cut, as the floor projects it: REJECTED, NOT_ATTEMPTED, its output DECLARED cut, E-5 the class's. */
		const cutAt = (role: string, ordinal: number, clause: string) => ({
			role,
			disposition: 'REJECTED',
			ordinal,
			parse: 'NOT_ATTEMPTED',
			outputTruncation: 'DECLARED',
			detail: outputLimitDetail({
				facts: { outputTokens: 25_000 },
				partialChars: 0,
				elapsedMs: 90_010,
				clause,
				reported: 'reasoning-review backing tool invocation failed: devin invocation failed: (fixture)'
			})
		});
		const cut = [
			cutAt('INITIAL', 1, 'short of the tool’s 240000 ms bound, so it is run once more (REG-D-102)'),
			cutAt('RETRY', 2, 'it was itself the one further call a thrown call is given (REG-D-102), so this failure stands')
		];
		const workProduct = reportOf(aRun({ design: { review: cut } })).report;
		const reviewed = cellOf(workProduct, '4', 'design');
		expect(reviewed.basis, 'arrangement: the review reads as package A labels it').toContain('the review of work product art_design is output-limit');
		// ⛔ THE MUTANT: the label mapped to nothing — the cell broke, unregistered, as at package A's merge.
		expect(shown(reviewed), 'a cut review’s break cites no register entry').toEqual(['broke', ['REG-F-563']]);
		expect(reviewed.unregistered, 'a cut review’s break reads unregistered').toBeUndefined();
		const command = reportOf(aRun({ implementation: { commands: 1, commandReview: cut } })).report;
		expect(shown(cellOf(command, '4', 'implementation')), 'a cut command review').toEqual(['broke', ['REG-F-520', 'REG-F-563']]);
	});

	it('⛔ a command with no review broke stage 4, unregistered — however its other cells read', () => {
		const run = aRun({ implementation: { commands: 1 } });
		const store = {
			...run.store,
			objects: run.store.objects.filter((x) => x.id !== 'asmt_evd_implementation_1_2' && !x.id.startsWith('mex_evd_implementation_1'))
		};
		const c = cellOf(buildRunReport(store, run.lane, { accountNames: NAMES }).report, '4', 'implementation');
		expect([c.value, c.unregistered]).toEqual(['broke', true]);
		expect(c.basis).toContain('1 command has no review');
	});

	it('⛔ stage 2 broke when a type has no unit; stage 1 broke when the PWA is not PUBLISHED', () => {
		const run = aRun();
		const noDesign = { ...run.store, objects: run.store.objects.filter((x) => x.id !== 'pwu_design') };
		const two = cellOf(buildRunReport(noDesign, run.lane, { accountNames: NAMES }).report, '2', 'whole run');
		expect([two.value, two.basis]).toEqual(['broke', ['no work unit for design']]);
		const draft = {
			...run.store,
			objects: run.store.objects.map((x) => (x.id === 'pwa_1' ? { ...x, state: { ...x.state, publicationStatus: 'DRAFT' } } : x))
		};
		const one = cellOf(buildRunReport(draft, run.lane, { accountNames: NAMES }).report, '1', 'whole run');
		expect([one.value, one.basis]).toEqual(['broke', ['the PWA "CLI Product Realization" is DRAFT']]);
	});
});

describe('JAN-EXEC P7-2 D9 — content, and the parse classes', () => {
	const row = { storageKey: 'k', contentHash: 'sha256:aa', byteSize: 3, purged: false, actualHash: 'sha256:aa', actualSize: 3 };
	const ref = (o: Record<string, unknown> = {}) => ({ status: 'STORED', storageKey: 'k', contentHash: 'sha256:aa', byteSize: 3, ...o });

	it('⭐ a ref the stored bytes hash to is VERIFIED; ⛔ one they do not is a HASH_MISMATCH; one with no row UNRESOLVABLE', () => {
		const content = new Map([['k', row]]);
		expect(contentVerdict(ref(), content)).toBe('VERIFIED');
		expect(contentVerdict(ref({ contentHash: 'sha256:bb' }), content)).toBe('HASH_MISMATCH');
		expect(contentVerdict(ref({ byteSize: 4 }), content)).toBe('HASH_MISMATCH');
		expect(contentVerdict(ref({ storageKey: 'gone' }), content)).toBe('UNRESOLVABLE');
		expect(contentVerdict(ref(), null)).toBe('UNRESOLVABLE');
		expect(contentVerdict({ status: 'PENDING_CONTENT_PLANE' }, content)).toBe('NOT_CLAIMED');
		expect(contentVerdict(ref(), new Map([['k', { ...row, purged: true, actualHash: null }]]))).toBe('PURGED');
	});

	it('⭐ K9 tells the narration case from the not-an-object case, two sentences that part only at a comma', () => {
		expect(parseClass({ outcome: 'PARSED' })).toBe('PARSED');
		expect(parseClass({ outcome: 'SCHEMA_COERCION_FAILED', detail: '— The answer is not a JSON object. —' })).toBe(
			'SCHEMA_COERCION_FAILED:not-an-object'
		);
		expect(
			parseClass({ outcome: 'SCHEMA_COERCION_FAILED', detail: 'The answer is not a JSON object, so the execution contract’s envelope could not be read.' })
		).toBe('SCHEMA_COERCION_FAILED:not-json');
	});
});

describe('JAN-EXEC P7-2 D9 — the per-command re-run manifest (P7-4d)', () => {
	it('⭐ a path inside the workspace is made relative in either spelling, and a drive in either case; ⛔ one outside is not', () => {
		const ws = 'E:/runs/p7/demo.sqlite.workspaces/und_1-abc';
		expect(relativeToWorkspace('E:/runs/p7/demo.sqlite.workspaces/und_1-abc/test/a.test.js', ws)).toBe('test/a.test.js');
		expect(relativeToWorkspace(`e:${B}runs${B}p7${B}demo.sqlite.workspaces${B}und_1-abc${B}src`, ws)).toBe('src');
		expect(relativeToWorkspace(`${ws}/`, ws)).toBe('.');
		expect(relativeToWorkspace('E:/runs/p7/elsewhere/x.js', ws)).toBeUndefined();
		expect(relativeToWorkspace('E:/runs/p7/demo.sqlite.workspaces/und_1-abcdef/x.js', ws)).toBeUndefined();
		expect(relativeToWorkspace('file:///E:/runs/p7/demo.sqlite.workspaces/und_1-abc/x.js', ws)).toBeUndefined();
		expect(relativeToWorkspace('/home/ci/WS/x', '/home/ci/ws')).toBeUndefined();
	});

	it('⭐ an argv as the manifest may hold it: relative where it can be, ⛔ a placeholder where it cannot', () => {
		const ws = 'E:/runs/p7/ws';
		expect(manifestArgv(['node', '--test', 'E:/runs/p7/ws/test/a.test.js', `--test-reporter-destination=E:${B}runs${B}p7${B}ws${B}out.txt`], ws, NAMES)).toEqual({
			argv: ['node', '--test', 'test/a.test.js', '--test-reporter-destination=out.txt'],
			problems: []
		});
		expect(manifestArgv(['node', '--test', 'C:/elsewhere/x.js'], ws, NAMES)).toEqual({
			argv: ['node', '--test', OUTSIDE],
			problems: ['argv[2] names an absolute path outside the workspace']
		});
		expect(manifestArgv(['node', '-e', "console.log('jdoe')"], ws, NAMES)).toEqual({
			argv: ['node', '-e', REDACTED],
			problems: ['argv[2] names account-name (REG-F-536)']
		});
		expect(manifestArgv(['node', '--test', '--test-name-pattern', '/^reads/'], ws, NAMES).problems).toEqual([]);
	});

	it('⛔ REG-F-545 — an argv checked against NO account name is never checked: refused, never passed as clean', () => {
		// Checked against none, the argument naming the account below would be written as it is.
		expect(() => manifestArgv(['node', '-e', "console.log('jdoe')"], 'E:/runs/p7/ws', [])).toThrow(
			'no account name was given, so an argv cannot be checked for it (REG-F-536)'
		);
	});

	it('⛔ REG-F-545 — a report built with NO account name is refused though it has no command to check: an empty list is never reached silently', () => {
		// ⚠ No command: the argv's own refusal above is never reached here, so this is the report's refusal alone.
		const run = aRun();
		expect(() => buildRunReport(run.store, run.lane, { accountNames: [] })).toThrow(
			'no account name was given, so the report and its manifest cannot be checked for it (REG-F-536)'
		);
	});

	it('⛔ an argument is scanned as the JSON files will spell it too: one only that spelling names leaves out its command, never the report', () => {
		// ~~Raw, `\x\y` is one backslash a part — no share; escaped, as report.json writes it, `\\x\\y` reads as one.~~ ⭐ (The
		// re-review of E4's fix round: a share is now read by its runs' ratio, which escaping keeps, so no spelling of
		// `\x\y` is one.) Raw, `a:` and a newline is no drive; escaped, as report.json writes it, `a:\n` reads as one.
		expect(manifestArgv(['node', '-e', 'const o = { a:\n1 }'], null, NAMES)).toEqual({
			argv: ['node', '-e', REDACTED],
			problems: ['argv[2] names drive-path (REG-F-536)']
		});
		expect(
			manifestArgv(['node', '-e', `require('${B}x${B}y')`], null, NAMES),
			'a share in neither spelling'
		).toEqual({ argv: ['node', '-e', `require('${B}x${B}y')`], problems: [] });
		// ⭐ A relative path with backslashes is no absolute path in either spelling: it is written as it is.
		expect(manifestArgv(['node', '--test', `.${B}test${B}unit${B}x.test.js`], 'E:/runs/p7/ws', NAMES)).toEqual({
			argv: ['node', '--test', `.${B}test${B}unit${B}x.test.js`],
			problems: []
		});
	});

	it('⭐ the evidence verdict is the floor’s: SATISFIED, else the first policy not satisfied in the plan’s order', () => {
		const floor = (a: string, b: string, c: string) =>
			FLOOR_POLICIES.map((policyId, i) => ({ policyId, state: [a, b, c][i]! }));
		expect(evidenceVerdictOf(floor('SATISFIED', 'SATISFIED', 'SATISFIED'))).toBe('SATISFIED');
		expect(evidenceVerdictOf(floor('REJECTED', 'SATISFIED', 'INCONCLUSIVE'))).toBe('REJECTED');
		expect(evidenceVerdictOf(floor('SATISFIED', 'SATISFIED', 'MISSING'))).toBe('MISSING');
		expect(evidenceVerdictOf(floor('SATISFIED', 'ASSESSING', 'SATISFIED'))).toBeUndefined();
	});

	it('⭐ the manifest written: accepted by the re-runner’s own check, ordinals in completion order, each unit’s tree its archive’s', () => {
		const out = reportOf(aRun({ implementation: { commands: 2 }, 'end-to-end': { commands: 1 } }));
		expect(manifestProblems(out.manifest)).toEqual([]);
		expect(out.manifest.units).toEqual([
			{ unit: 'implementation', treeSha256: sha('implementation') },
			{ unit: 'end-to-end', treeSha256: sha('end-to-end') }
		]);
		expect(out.manifest.commands.map((c) => [c.unit, c.ordinal, c.argv[2], c.evidenceVerdict, c.cwd])).toEqual([
			['implementation', 1, 'test/implementation-1.test.js', 'SATISFIED', '.'],
			['implementation', 2, 'test/implementation-2.test.js', 'SATISFIED', '.'],
			['end-to-end', 1, 'test/end-to-end-1.test.js', 'SATISFIED', '.']
		]);
		expect(out.report.manifest.ordinal).toMatch(/^completion order/);
	});

	it('⛔ a unit whose archive holds no workspace leaves out ITS commands, with why — never the manifest', () => {
		const run = aRun({ implementation: { commands: 1 }, 'end-to-end': { commands: 1 } });
		const lane = { ...run.lane, archives: run.lane.archives.map((a) => (a.name === '04-implementation' ? { ...a, workspaceTree: null } : a)) };
		const out = buildRunReport(run.store, lane, { accountNames: NAMES });
		expect(out.manifest.commands.map((c) => c.unit)).toEqual(['end-to-end']);
		expect(out.excluded.excluded.map((e) => [e.unit, e.ordinal, e.reason])).toEqual([
			[
				'implementation',
				1,
				"the unit's archive 04-implementation holds no workspace copy, so the tree it is re-run on cannot be named"
			]
		]);
	});
});

describe('JAN-EXEC P7-2 D9 — the adjudication table’s rows (P7-4f): the truth, the account, the verdict — no class', () => {
	it('⭐ a command’s row: its exit and timing as recorded, the account the review was handed, the criteria it faulted', () => {
		const run = aRun({
			implementation: {
				commands: 1,
				commandFloor: ['SATISFIED', 'SATISFIED', 'REJECTED'],
				tries: [{ disposition: 'ACCEPTED' }, { disposition: 'ACCEPTED' }],
				stepState: 'RUNNING',
				unit: { lifecycle: 'EXECUTING', execution: 'RUNNING', assurance: 'UNASSESSED' }
			}
		});
		const assessment = 'asmt_evd_implementation_1_2';
		const judged = (eventType: string, payload: Record<string, unknown>) => ({ eventType, aggregateType: 'ASSURANCE_ASSESSMENT', aggregateId: assessment, commandId: null, payload: { assessmentId: assessment, ...payload } });
		const failing = {
			...run.store,
			objects: run.store.objects.map((x) =>
				x.id === 'evd_implementation_1'
					? { ...x, state: { ...x.state, contentReference: { ...(x.state.contentReference as object), exitCode: 1, timedOut: true, durationMs: 120_000 } } }
					: x
			),
			events: [
				...run.store.events,
				judged('AssuranceCriterionEvaluated', { criterionId: 'RR-01-claim-support', result: 'MET' }),
				judged('AssuranceCriterionEvaluated', { criterionId: 'RR-08-evidence-integrity', result: 'NOT_MET' }),
				judged('AssuranceObservationRecorded', { findingCode: 'RR-08-evidence-integrity', severity: 'BLOCKING' })
			].map((e, i) => ({ ...e, sequence: i + 1 }))
		};
		const r = buildRunReport(failing, run.lane, { accountNames: NAMES }).report;
		const row = r.adjudication.rows.find((a) => a.assessmentId === assessment);
		expect(row?.groundTruth).toMatchObject({ kind: 'command', evidenceId: 'evd_implementation_1', exitCode: 1, timedOut: true, durationMs: 120_000 });
		expect(row?.account).toMatchObject({ exchangeId: 'mex_implementation_try1', parse: 'PARSED', declared: true });
		expect(row?.verdict).toEqual({
			state: 'REJECTED',
			pairing: 'answered',
			criteria: [
				{ criterionId: 'RR-01-claim-support', result: 'MET' },
				{ criterionId: 'RR-08-evidence-integrity', result: 'NOT_MET' }
			],
			observations: [{ code: 'RR-08-evidence-integrity', severity: 'BLOCKING' }]
		});
		expect(row?.classification).toBe('');
		const md = renderMarkdown(r);
		expect(md).toContain('exit 1, timed out: node --test test/implementation-1.test.js');
		expect(md).toContain('| REJECTED, answered | RR-08-evidence-integrity NOT_MET | |');
	});

	it('⭐ a work product’s row: its bytes, and the try whose account its review was handed', () => {
		const r = reportOf(aRun()).report;
		const row = r.adjudication.rows.find((a) => a.subject.id === 'art_design');
		expect(row?.groundTruth).toEqual({ kind: 'work product', artifactId: 'art_design', bytes: { storageKey: 'k_art_design', contentHash: `sha256:${sha('art_design')}` } });
		expect(row?.account?.exchangeId).toBe('mex_design_try0');
	});
});

// ── THE COMMAND LINE, SPAWNED: bun:sqlite does not exist under Node, so the tests drive it as an operator does ──────────

/** `rows` written into a record store by the product's own driver, then turned to a rollback journal, as the lane archives. */
function writeStore(file: string, rows: StoreRows): void {
	const db = createSqliteDriver(file);
	try {
		db.exec(SCHEMA_SQL);
		const now = '2026-10-09T12:00:00.000Z';
		const putObject = db.prepare(
			'INSERT INTO professional_work_objects(id, object_type, aggregate_type, revision, semantic_version, state, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)'
		);
		for (const o of rows.objects) putObject.run(o.id, o.objectType, o.objectType, 1, 1, JSON.stringify(o.state), now, now);
		const putEvent = db.prepare(
			'INSERT INTO domain_events(event_id, event_type, aggregate_type, aggregate_id, aggregate_revision, correlation_id, command_id, occurred_at, recorded_at, payload) VALUES (?,?,?,?,?,?,?,?,?,?)'
		);
		for (const e of rows.events)
			putEvent.run(
				`evt_${e.sequence}`,
				e.eventType,
				e.aggregateType || 'X',
				e.aggregateId,
				e.sequence,
				'ui',
				e.commandId,
				now,
				now,
				JSON.stringify({ eventId: `evt_${e.sequence}`, eventType: e.eventType, aggregateType: e.aggregateType, aggregateId: e.aggregateId, commandId: e.commandId, payload: e.payload })
			);
		db.exec('PRAGMA journal_mode = DELETE');
	} finally {
		db.close();
	}
}

/** A run folder holding `rows` in the archive `archive`, and the lane's files. */
function runFolder(rows: StoreRows, archive = '06-final'): string {
	const run = tempDir('cli');
	mkdirSync(join(run, 'lane', 'archive', archive), { recursive: true });
	writeStore(join(run, 'lane', 'archive', archive, 'demo.sqlite'), rows);
	writeFileSync(join(run, 'lane', 'boot.json'), JSON.stringify({ startedAt: '2026-10-09T12:00:00.000Z', overlay: { JPWB_DEMO_DB: DEMO_DB } }));
	writeFileSync(join(run, 'lane', 'posts.jsonl'), '');
	return run;
}

function cli(args: readonly string[]): { code: number | null; out: string } {
	const r = spawnSync('bun', [RUN_REPORT, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
	return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/**
 * ⛔ `REG-F-545` — the command line run as the gate runs it: NO USERNAME and NO USERPROFILE, as turbo's default env mode
 * leaves a task — so that Bun 1.3.14 on Windows answers `os.userInfo().username` with `unknown` — and nothing else of
 * the environment but PATH and SYSTEMROOT, so bun runs. Set here, so it never hangs on how the runner was launched.
 * ⚠ NOT BY HANDING SPAWN AN ENV WITHOUT THEM: on Windows, Node's spawn and Bun's alike put USERNAME, USERPROFILE and the
 * other variables libuv requires back into the child's environment, read from the PARENT's own (driven 2026-10-10), so
 * an env that omits them strips nothing. A bun of its own removes them from ITS environment first, then runs the command
 * line — whatever process, pool or shell this test runs in — and says whether the two were absent where it ran.
 */
function cliStripped(args: readonly string[]): { stripped: unknown; code: number | null; out: string } {
	const driver = [
		'delete process.env.USERNAME;',
		'delete process.env.USERPROFILE;',
		"const { spawnSync } = require('node:child_process');",
		'const env = { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT };',
		"const probe = 'process.stdout.write(JSON.stringify([process.env.USERNAME === undefined, process.env.USERPROFILE === undefined]))';",
		"const seen = spawnSync(process.execPath, ['--eval', probe], { env, encoding: 'utf8' });",
		`const r = spawnSync(process.execPath, ${JSON.stringify([RUN_REPORT, ...args])}, { cwd: ${JSON.stringify(ROOT)}, env, encoding: 'utf8' });`,
		"process.stdout.write(JSON.stringify({ stripped: JSON.parse(seen.stdout), code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') }));"
	].join('\n');
	const r = spawnSync('bun', ['--eval', driver], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
	expect(r.status, `arrangement: the stripping driver ran: ${r.stderr}`).toBe(0);
	return JSON.parse(r.stdout) as { stripped: unknown; code: number | null; out: string };
}

/** The command line's own `main`, run in bun and handed `names` to scan for — a list no host's environment can hand it. */
function cliNamed(run: string, names: readonly string[]): { code: number | null; out: string } {
	const script =
		`const { main } = await import(${JSON.stringify(pathToFileURL(RUN_REPORT).href)});\n` +
		`process.exitCode = main([${JSON.stringify(run)}], (s) => process.stdout.write(s), ${JSON.stringify(names)});`;
	const r = spawnSync('bun', ['--eval', script], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
	return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function digestOf(dir: string): Record<string, string> {
	const out: Record<string, string> = {};
	const walk = (d: string) => {
		for (const name of readdirSync(d)) {
			const p = join(d, name);
			if (statSync(p).isDirectory()) walk(p);
			else out[relative(dir, p).split(B).join('/')] = createHash('sha256').update(readFileSync(p)).digest('hex');
		}
	};
	walk(dir);
	return out;
}

describe('JAN-EXEC P7-2 D9 — the command line', () => {
	it(
		'⭐ over a store archived as the lane archives one, it writes the four files once, and leaves the archive as it was',
		() => {
			const run = runFolder(aRun({ implementation: { commands: 1 } }).store);
			const before = digestOf(join(run, 'lane', 'archive'));
			const r = cli([run]);
			expect(r.code, r.out).toBe(0);
			expect(readdirSync(join(run, 'lane', 'report')).sort()).toEqual([
				'command-manifest.excluded.json',
				'command-manifest.json',
				'report.json',
				'report.md'
			]);
			expect(digestOf(join(run, 'lane', 'archive'))).toEqual(before);
			const report = JSON.parse(readFileSync(join(run, 'lane', 'report', 'report.json'), 'utf8')) as RunReport;
			expect(cellOf(report, '7', 'whole run').value).toBe('as intended');
		},
		120_000
	);

	it(
		'⛔ it writes NOTHING when its own output would name an absolute path, and names where (REG-F-536)',
		() => {
			const waiver = { eventType: 'WaiverRequested', aggregateType: 'DECISION', aggregateId: 'dec_C:/Users/someone/x', commandId: 'ui-1', payload: {} };
			const run = runFolder(aRun({}, { extraEvents: [waiver] }).store);
			const r = cli([run]);
			expect(r.code, r.out).toBe(1);
			expect(r.out).toContain("refused, and nothing was written: the report's own output names the account or an absolute path (REG-F-536)");
			expect(r.out).toMatch(/report\.json:\d+:\d+ drive-path/);
			expect(r.out).toMatch(/report\.md:\d+:\d+ drive-path/);
			expect(existsSync(join(run, 'lane', 'report'))).toBe(false);
		},
		120_000
	);

	it(
		'⛔ a relative path the model spelled with backslashes is no absolute path: the report is written, the command kept',
		() => {
			const run0 = aRun({ implementation: { commands: 1 } });
			const relativeArg = `.${B}test${B}unit${B}wordfreq.test.js`;
			const objects = run0.store.objects.map((x) =>
				x.id === 'evd_implementation_1'
					? { ...x, state: { ...x.state, contentReference: { ...(x.state.contentReference as object), command: ['node', '--test', relativeArg] } } }
					: x
			);
			const run = runFolder({ ...run0.store, objects });
			// The unit's own archive, holding the workspace its command is re-run on.
			mkdirSync(join(run, 'lane', 'archive', '04-implementation', 'workspace', 'test', 'unit'), { recursive: true });
			writeFileSync(join(run, 'lane', 'archive', '04-implementation', 'workspace', 'test', 'unit', 'wordfreq.test.js'), '// unit tests\n');
			const r = cli([run]);
			expect(r.code, r.out).toBe(0);
			const manifest = JSON.parse(readFileSync(join(run, 'lane', 'report', 'command-manifest.json'), 'utf8')) as {
				commands: { argv: string[] }[];
			};
			expect(manifest.commands.map((c) => c.argv)).toEqual([['node', '--test', relativeArg]]);
		},
		120_000
	);

	it(
		'⭐ an archive with no process-output whose checks.json records the run had none held no capture — K5 counted, not unknown',
		() => {
			const run = runFolder(aRun({ 'end-to-end': { commands: 32, captures: 33 } }).store);
			const archive = (name: string) => join(run, 'lane', 'archive', name);
			mkdirSync(archive('04-implementation'));
			writeFileSync(join(archive('04-implementation'), 'checks.json'), JSON.stringify({ archived: { processOutput: { present: false } } }));
			for (let i = 1; i <= 33; i++) mkdirSync(join(archive('05-end-to-end'), 'process-output', 'captures', `end-to-end-${i}`), { recursive: true });
			// ⭐ P5 package B (F5) — and its own K5 check, as the archive records it: the reader hands the report its causes.
			writeFileSync(join(archive('05-end-to-end'), 'checks.json'), JSON.stringify({ k5: { causes: causes('cap', 'own') } }));
			const r = cli([run]);
			expect(r.code, r.out).toBe(0);
			const report = JSON.parse(readFileSync(join(run, 'lane', 'report', 'report.json'), 'utf8')) as RunReport;
			expect(report.units.find((u) => u.slug === 'end-to-end')?.runs).toMatchObject({ captured: 33, unrecorded: 1 });
			expect(shown(cellOf(report, '4', 'end-to-end'))).toEqual(['broke', ['REG-F-517', 'REG-F-521']]);
		},
		120_000
	);

	it(
		'⛔ a content store in WAL mode is refused like the record store — nothing opened, the archive left as it was',
		() => {
			const run = runFolder(aRun().store);
			const contentStore = createSqliteDriver(join(run, 'lane', 'archive', '06-final', 'demo.sqlite.content.sqlite'));
			contentStore.exec('CREATE TABLE artifact_content (storage_key TEXT)');
			contentStore.close();
			const before = digestOf(join(run, 'lane', 'archive'));
			const r = cli([run]);
			expect(r.code, r.out).toBe(2);
			expect(r.out).toContain(
				'refused, and nothing was opened: lane/archive/06-final/demo.sqlite.content.sqlite is in WAL mode, and a read-only open of it could write its -shm and -wal beside it'
			);
			expect(digestOf(join(run, 'lane', 'archive'))).toEqual(before);
		},
		120_000
	);

	it(
		'⛔ it never replaces a report: an existing one refuses the run, untouched',
		() => {
			const run = runFolder(aRun().store);
			mkdirSync(join(run, 'lane', 'report'));
			writeFileSync(join(run, 'lane', 'report', 'report.md'), 'an earlier report\n');
			const r = cli([run]);
			expect(r.code, r.out).toBe(2);
			expect(r.out).toContain('refused: lane/report already holds report.md, which is left untouched: a report is written once');
			expect(readFileSync(join(run, 'lane', 'report', 'report.md'), 'utf8')).toBe('an earlier report\n');
		},
		120_000
	);

	it(
		'⭐ with no final archive it reads the last one present, and says which',
		() => {
			const run = runFolder(aRun({ 'end-to-end': { begun: false } }).store, '04-implementation');
			mkdirSync(join(run, 'lane', 'archive', '02-requirements'));
			writeStore(join(run, 'lane', 'archive', '02-requirements', 'demo.sqlite'), { objects: [], events: [], content: null });
			const r = cli([run]);
			expect(r.code, r.out).toBe(0);
			expect(r.out).toContain('read lane/archive/04-implementation;');
		},
		120_000
	);

	it(
		'⛔ a store with a journal beside it was not archived as the lane archives one: refused, and nothing opened',
		() => {
			const run = runFolder(aRun().store);
			writeFileSync(join(run, 'lane', 'archive', '06-final', 'demo.sqlite-journal'), '');
			const before = digestOf(join(run, 'lane', 'archive'));
			const r = cli([run]);
			expect(r.code, r.out).toBe(2);
			expect(r.out).toContain(
				'refused, and nothing was opened: lane/archive/06-final/demo.sqlite has a -journal file beside it'
			);
			expect(digestOf(join(run, 'lane', 'archive'))).toEqual(before);
		},
		120_000
	);

	it(
		'⛔ it refuses, opening nothing, with no folder, no archive, or a store that is not SQLite',
		() => {
			// ⛔ Each refusal by its own words: a flag is refused as a flag, never as a folder it does not name.
			for (const args of [[], ['--json']]) {
				const usage = cli(args);
				expect([usage.code, usage.out], args.join(' ')).toEqual([2, 'phase7/run-report — usage: bun scripts/phase7/run-report.ts <RUN>\n']);
			}
			expect(cli([join(tempDir('none'), 'missing')]).out).toContain('usage: <RUN> names no folder');
			expect(cli([tempDir('empty')]).out).toContain('refused: no archive under lane/archive holds a demo.sqlite');
			const run = tempDir('junk');
			mkdirSync(join(run, 'lane', 'archive', '06-final'), { recursive: true });
			writeFileSync(join(run, 'lane', 'archive', '06-final', 'demo.sqlite'), 'not a database');
			const r = cli([run]);
			expect([r.code, r.out.includes('lane/archive/06-final/demo.sqlite is not a SQLite database')]).toEqual([2, true]);
		},
		120_000
	);

	it(
		'⛔ REG-F-545 — run as the gate runs it, with no USERNAME and no USERPROFILE, it WRITES the report: the `unknown` its own cells print is no account name',
		() => {
			const run = runFolder(aRun({ implementation: { commands: 1 } }).store);
			const r = cliStripped([run]);
			expect(r.stripped, 'arrangement: the command line ran with USERNAME and USERPROFILE absent').toEqual([true, true]);
			expect(r.code, r.out).toBe(0);
			// The arrangement, read after the write: the report holds the very word Bun answered the user record's name with.
			expect(readFileSync(join(run, 'lane', 'report', 'report.md'), 'utf8')).toMatch(/(?<![A-Za-z0-9])unknown(?![A-Za-z0-9])/);
		},
		120_000
	);

	it(
		'⛔ REG-F-545 — with no account name to scan its output for, it writes NOTHING, and says why: exit 2',
		() => {
			const run = runFolder(aRun().store);
			expect(cliNamed(run, [])).toEqual({
				code: 2,
				out:
					"phase7/run-report — refused, and nothing was written: no account name could be found — not the user record's " +
					'name or home folder, nor USERPROFILE or USERNAME — so the output cannot be checked for it (REG-F-536)\n'
			});
			expect(existsSync(join(run, 'lane', 'report'))).toBe(false);
			// CONTROL: the same `main`, run the same way and handed a name, writes — the refusal is the empty list's.
			expect(cliNamed(run, NAMES).code).toBe(0);
		},
		120_000
	);
});

describe('JAN-EXEC P7-2 D6 — finalize-run: the whole run folder, copied once, after Playwright exits', () => {
	/** A run folder, and Playwright's results file: this run's own — its server's store in the folder — unless `of` says. */
	const aRunFolder = (of?: string) => {
		const parent = tempDir('final');
		const run = join(parent, 'p7-run');
		mkdirSync(join(run, 'lane', 'archive'), { recursive: true });
		for (const [f, text] of Object.entries({
			'demo.sqlite': 'db',
			'demo.sqlite-wal': 'committed records not yet checkpointed',
			'demo.sqlite-shm': 'shm',
			'lane/run.json': '{}'
		}))
			writeFileSync(join(run, f), text);
		const results = join(parent, 'results-live-exec.json');
		const text = JSON.stringify({ config: { webServer: { env: { JPWB_DEMO_DB: of ?? join(run, 'demo.sqlite') } } }, suites: [] });
		writeFileSync(results, text);
		return { parent, run, results, text };
	};
	const said = () => {
		const lines: string[] = [];
		return { lines, write: (s: string) => void lines.push(s) };
	};

	it('⭐ it copies the folder whole — the -wal and -shm included — and this run’s Playwright results into it, exit 0', () => {
		const { run, results, text } = aRunFolder();
		const out = said();
		expect(finalize([run], out.write, { results })).toBe(0);
		expect(digestOf(`${run}-final`)).toEqual({ ...digestOf(run), [RESULTS_NAME]: sha(text) });
		expect(out.lines.join('')).toMatch(/copied 4 file\(s\) of p7-run to p7-run-final, with results-live-exec\.json/);
		expect(existsSync(`${run}-final.partial`)).toBe(false);
	});

	it('⛔ another run’s results — the lane writes one file for every run — are not copied, and it says so: exit 1', () => {
		const { run, results } = aRunFolder(join(tmpdir(), 'jpwb-live-exec-other', 'demo.sqlite'));
		const out = said();
		expect(finalize([run], out.write, { results })).toBe(1);
		expect(out.lines.join('')).toContain(
			"results-live-exec.json is another run's: its server kept its store outside this run folder, so it was not copied into it"
		);
		expect(existsSync(join(`${run}-final`, RESULTS_NAME))).toBe(false);
		// ⛔ And a results file that names no store at all cannot be shown to be this run's.
		const fresh = aRunFolder();
		writeFileSync(fresh.results, '{"suites":[]}');
		const unnamed = said();
		expect(finalize([fresh.run], unnamed.write, { results: fresh.results })).toBe(1);
		expect(unnamed.lines.join('')).toContain(
			"results-live-exec.json names no server store (config.webServer.env.JPWB_DEMO_DB), so it cannot be shown to be this run's"
		);
	});

	it('⛔ a copy already taken is left untouched, and nothing is copied: exit 2', () => {
		const { run, results } = aRunFolder();
		mkdirSync(`${run}-final`);
		writeFileSync(join(`${run}-final`, 'demo.sqlite'), 'the first copy');
		const out = said();
		// ⛔ THE COMMAND'S OWN REFUSAL, ASKED FOR BY ITS MESSAGE: behind it the copy's `errorOnExist` still throws, so a throw
		// is caught and named by its kind alone — its message carries the folder's absolute path, which no failure here may
		// print (REG-F-536).
		const exit = (() => {
			try {
				return finalize([run], out.write, { results });
			} catch (e) {
				return `threw ${(e as NodeJS.ErrnoException).code || (e as Error).name}`;
			}
		})();
		expect(out.lines.join('')).toContain('refused, and nothing was copied: p7-run-final already exists, and is left untouched');
		expect(exit).toBe(2);
		expect(digestOf(`${run}-final`)).toEqual({ 'demo.sqlite': sha('the first copy') });
	});

	it('⛔ a copy that fails part-way makes no <RUN>-final, names where it failed, and leaves its .partial — which refuses the next', () => {
		const { run, results } = aRunFolder();
		const out = said();
		const failing: typeof cpSync = (from, to, opts) => {
			cpSync(from, to, opts);
			throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY', path: join(String(from), 'demo.sqlite-wal') });
		};
		expect(finalize([run], out.write, { results, copy: failing })).toBe(2);
		expect(out.lines.join('')).toContain(
			'refused: the copy failed part-way (EBUSY at demo.sqlite-wal), so no p7-run-final was made; p7-run-final.partial holds what was copied, and is left for a person'
		);
		expect([existsSync(`${run}-final`), existsSync(`${run}-final.partial`)]).toEqual([false, true]);
		const again = said();
		expect(finalize([run], again.write, { results })).toBe(2);
		expect(again.lines.join('')).toContain(
			'refused, and nothing was copied: p7-run-final.partial exists — an earlier copy failed part-way — and is left untouched'
		);
	});

	it('⛔ a link in the run is copied AS A LINK — never followed, never refused part-way — and the copy is whole: exit 0', () => {
		const { parent, run, results } = aRunFolder();
		const elsewhere = join(parent, 'elsewhere');
		mkdirSync(elsewhere);
		writeFileSync(join(elsewhere, 'outside.txt'), 'not the run’s');
		mkdirSync(join(run, 'lane', 'archive', '04-implementation', 'workspace'), { recursive: true });
		// A junction: what a model's `mklink /J` leaves, and what the archive's copy of it is on this host.
		symlinkSync(elsewhere, join(run, 'lane', 'archive', '04-implementation', 'workspace', 'linked'), 'junction');
		const out = said();
		expect(finalize([run], out.write, { results }), out.lines.join('')).toBe(0);
		const copied = join(`${run}-final`, 'lane', 'archive', '04-implementation', 'workspace', 'linked');
		expect([lstatSync(copied).isSymbolicLink(), readlinkSync(copied) === readlinkSync(join(run, 'lane', 'archive', '04-implementation', 'workspace', 'linked'))]).toEqual([true, true]);
		expect(out.lines.join('')).toContain('1 link(s) copied as links, never followed');
		expect(existsSync(join(`${run}-final`, 'lane', 'run.json'))).toBe(true);
	});

	it('⛔ a file that changed size while it was copied is reported, never smoothed: exit 1', () => {
		const { run, results } = aRunFolder();
		const out = said();
		const serverStillWriting = () => writeFileSync(join(run, 'demo.sqlite-wal'), 'committed records not yet checkpointed, and more');
		expect(finalize([run], out.write, { results, afterCopy: serverStillWriting })).toBe(1);
		expect(out.lines.join('')).toContain('1 file(s) changed size while they were copied — was the server still running? demo.sqlite-wal');
	});

	it('⛔ with no results file it still copies the run, and says the results are missing: exit 1', () => {
		const { parent, run } = aRunFolder();
		const out = said();
		expect(finalize([run], out.write, { results: join(parent, 'absent.json') })).toBe(1);
		expect(out.lines.join('')).toContain('results-live-exec.json was not found, so it was not copied into it');
		expect(existsSync(join(`${run}-final`, 'demo.sqlite-wal'))).toBe(true);
	});

	it('⛔ usage: one run folder, that exists — each refusal by its own words', () => {
		const out = said();
		expect(finalize([], out.write)).toBe(2);
		expect(finalize(['--x'], out.write)).toBe(2);
		expect(out.lines).toEqual([
			'phase7/finalize-run — usage: bun scripts/phase7/finalize-run.ts <RUN>\n',
			'phase7/finalize-run — usage: bun scripts/phase7/finalize-run.ts <RUN>\n'
		]);
		const missing = said();
		expect(finalize([join(tempDir('none'), 'missing')], missing.write)).toBe(2);
		expect(missing.lines.join('')).toContain('usage: no run folder named missing');
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7 P5, package B — THE REPORT READS A RUN AS P5 WENT ───────────────────────────────────────────────────
//
// P5's report read design's floor (5a) "broke" over a superseded plan's refused reviews; counted design's re-run's three runs
// as implementation's, captured and unrecorded, and named REG-F-511 from the count of runs recorded; said its root's reviews
// were "judged over the work it and every unit below it produced" with its end-to-end phase abandoned; and offered a person
// "transport failure (REG-F-499)" for reviews that ended at the reviewer's output-token limit. Each is driven here on rows.

describe('⭐⭐ P5 package B — the report reads a run as P5 went', () => {
	const ev = (eventType: string, aggregateId: string, commandId: string, payload: Record<string, unknown> = {}) => ({
		eventType,
		aggregateType: 'X',
		aggregateId,
		commandId,
		payload
	});
	/** An object recorded after the fixture's own: `k` orders those added together. */
	const late = (id: string, objectType: string, state: Record<string, unknown>, k: number): StoredObject => ({
		id,
		objectType,
		state,
		firstSequence: Number.MAX_SAFE_INTEGER - 100 + k
	});
	/** One command's evidence of `pwu_<slug>`, its run captured under `folder`, made by `attempt`. */
	const evidenceOf = (id: string, slug: string, folder: string, attempt: string, k: number): StoredObject =>
		late(
			id,
			'EVIDENCE',
			{
				scope: `${EVIDENCE_SCOPE_PREFIX}pwu_${slug}`,
				contentReference: {
					command: ['node', '--test', `test/${folder}.test.js`],
					exitCode: 0,
					timedOut: false,
					durationMs: 5,
					producingExecutionAttemptId: attempt,
					capture: { retained: true, stdoutPath: `captures/${folder}/stdout.txt`, stderrPath: `captures/${folder}/stderr.txt` }
				}
			},
			k
		);

	/**
	 * Design's plan A refused over its OWN command — its review REJECTED — and re-run by its WORK (RERUN_WORK), as P5's was: plan
	 * B completes with a work product and a command of its own, each of their floor assessments SATISFIED.
	 */
	function aReworkedRun() {
		const run = aRun(
			{ design: { commands: 1, commandFloor: ['SATISFIED', 'SATISFIED', 'REJECTED'], completion: 'none' } },
			{
				extraEvents: [
					ev('ExecutionStepWaiting', 'plan_design', 'ui-900', { stepId: 'step_design', stepState: 'WAITING' }),
					ev('DecisionEffective', 'dec_rework', 'ui-911', {
						decisionType: 'REPLAN',
						selectedOption: 'RERUN_WORK',
						subjectObjectIds: ['pwu_design', 'plan_design', 'art_design', 'evd_design_1']
					}),
					ev('ExecutionPlanProposed', 'plan_design_b', 'ui-912', { executionPlanId: 'plan_design_b', workUnitId: 'pwu_design' }),
					ev('ExecutionPlanSuperseded', 'plan_design', 'ui-913', { supersedingExecutionPlanId: 'plan_design_b', status: 'SUPERSEDED' }),
					ev('ExecutionStepCancelled', 'plan_design', 'ui-914', { stepId: 'step_design', stepState: 'CANCELLED' }),
					ev('ExecutionStepStarted', 'plan_design_b', 'ui-918', { stepId: 'step_design_b' }),
					ev('ExecutionStepSucceeded', 'plan_design_b', 'ui-930', {
						executionStepId: 'step_design_b',
						outputArtifactIds: ['art_design_b'],
						proposedEvidenceIds: ['evd_design_b1'],
						executionProvenance: { executedBy: { actorId: 'model:fixture-executor', actorType: 'AGENT', displayName: MODEL_EXECUTOR_NAME } }
					}),
					ev('PwuStateChanged', 'pwu_design', 'ui-931', {
						previousState: 'EXECUTING',
						newState: 'EXECUTING',
						executionState: 'SUCCEEDED',
						supportingObjectIds: ['plan_design_b']
					})
				]
			}
		);
		const added: StoredObject[] = [
			late('plan_design_b', 'EXECUTION_PLAN', { workUnitId: 'pwu_design', status: 'ACTIVE', steps: [{ id: 'step_design_b', stepState: 'SUCCEEDED' }] }, 0),
			late('art_design_b', 'ARTIFACT', { producingPwuId: 'pwu_design', storageKey: 'k_art_design_b', contentHash: `sha256:${sha('art_design_b')}` }, 1),
			evidenceOf('evd_design_b1', 'design', 'design-b1', 'step_design_b#1', 2),
			...['art_design_b', 'evd_design_b1'].flatMap((subject, j) =>
				FLOOR_POLICIES.map((p, i) =>
					late(`asmt_${subject}_${i}`, 'ASSURANCE_ASSESSMENT', { assurancePolicyId: p, subjectObjectIds: [subject], assessmentState: 'SATISFIED' }, 3 + j * 3 + i)
				)
			)
		];
		const objects = run.store.objects.map((o) =>
			o.id === 'plan_design'
				? { ...o, state: { workUnitId: 'pwu_design', status: 'SUPERSEDED', steps: [{ id: 'step_design', stepState: 'CANCELLED' }] } }
				: o
		);
		return { store: { ...run.store, objects: [...objects, ...added] }, lane: run.lane };
	}

	it('⛔ F4 (5a) — a step its re-run completed is read over the work its completion names: the superseded plan’s refused command never reads beside it', () => {
		// ⛔ RED BEFORE F4, driven: broke (unregistered) — "the step SUCCEEDED with its floor not satisfied", "command
		// evd_design_1: floor.reasoning-review REJECTED": plan A's command, read beside plan B's completion (P5's design 5a).
		const r = reportOf(aReworkedRun()).report;
		const c = cellOf(r, '5a', 'design');
		expect([c.value, c.registerIds, c.basis], 'the floor of the step that completed read a superseded plan’s review').toEqual([
			'as intended',
			[],
			['the step SUCCEEDED and all 6 floor assessments are SATISFIED']
		]);
	});

	it('⭑ F4 CONTROL — a step that completed over its OWN refused command still broke the floor, though its completion names none', () => {
		// The completion by hand names no evidence; the command its own attempt ran is read all the same.
		const r = reportOf(
			aRun({ design: { stepState: 'SUCCEEDED', completion: 'hand', commandFloor: ['SATISFIED', 'SATISFIED', 'REJECTED'], commands: 1 } })
		).report;
		expect(cellOf(r, '5a', 'design').basis).toEqual([
			'the step SUCCEEDED with its floor not satisfied',
			'command evd_design_1: floor.reasoning-review REJECTED'
		]);
	});

	it('⛔ check finding 4 (5a) — a step completed by hand NAMING NO OUTPUT, over its own refused work product: the work product its attempt made is read, and the floor broke', () => {
		// ⛔ RED BEFORE, driven: "as intended", its basis "the step SUCCEEDED and all 0 floor assessments are SATISFIED" — the
		// page's `completeStep` names no output by default, and no evidence, so nothing at all was read.
		const r = reportOf(
			aRun({ design: { stepState: 'SUCCEEDED', completion: 'hand-no-output', workProductFloor: ['SATISFIED', 'SATISFIED', 'REJECTED'] } })
		).report;
		const c = cellOf(r, '5a', 'design');
		expect([c.value, c.basis], 'a completion that names no output hid its own refused work product').toEqual([
			'broke',
			['the step SUCCEEDED with its floor not satisfied', 'work product art_design: floor.reasoning-review REJECTED']
		]);
	});

	it('⛔ check finding 4 (5a) — a completion that names nothing, over a record that says of nothing that its attempts made it: NOT REACHED, never all 0 SATISFIED', () => {
		const run = aRun({ design: { stepState: 'SUCCEEDED', completion: 'hand-no-output' } });
		// The work product's record does not say which attempt made it, as a record made before RD6 set the field does not.
		const unattributed = (o: StoredObject): StoredObject =>
			o.id === 'art_design'
				? { ...o, state: Object.fromEntries(Object.entries(o.state).filter(([k]) => k !== 'producingExecutionAttemptId')) }
				: o;
		const r = buildRunReport({ ...run.store, objects: run.store.objects.map(unattributed) }, run.lane, { accountNames: NAMES }).report;
		const c = cellOf(r, '5a', 'design');
		expect([c.value, c.basis], 'an empty subject list read as a satisfied floor').toEqual([
			'not reached',
			[
				'the step SUCCEEDED by a completion that names no work product and no command, and the record holds none that its ' +
					'own attempts made: there is no floor of it to read'
			]
		]);
	});

	it('⛔ F5 (4) — a phase’s re-run captured after its archive: the folders are ITS, by the evidence that names them — never the next phase’s unrecorded runs', () => {
		// ⛔ RED BEFORE F5, driven: implementation {recorded 1, captured 4, unrecorded 3}, its stage 4 broke (REG-F-511), and
		// design {recorded 5, captured 2} — the folders attributed by diffing each archive with the one before (P5's design re-run).
		const run = aRun({ design: { commands: 2 }, implementation: { commands: 1 } });
		const rerun = ['design-r1', 'design-r2', 'design-r3'];
		const store = {
			...run.store,
			objects: [...run.store.objects, ...rerun.map((f, i) => evidenceOf(`evd_${f}`, 'design', f, 'step_design_b#1', i))]
		};
		const lane: LaneRows = {
			...run.lane,
			archives: run.lane.archives.map((a) =>
				['04-implementation', '05-end-to-end'].includes(a.name) ? { ...a, captures: [...(a.captures ?? []), ...rerun] } : a
			)
		};
		const r = buildRunReport(store, lane, { accountNames: NAMES }).report;
		const runs = (slug: string) => r.units.find((u) => u.slug === slug)?.runs;
		expect(runs('implementation'), 'the next phase was charged the re-run’s runs').toMatchObject({ recorded: 1, captured: 1, unrecorded: 0 });
		expect(runs('design'), 'the re-run’s runs were not counted as design’s').toMatchObject({ recorded: 5, captured: 5, unrecorded: 0 });
		expect(shown(cellOf(r, '4', 'implementation'))).toEqual(['as intended', []]);
	});

	it('⛔ F5 (4) — the cause of a captured run no evidence names is the archive’s K5 check’s, never one read from how many runs the join recorded', () => {
		// ⛔ RED BEFORE F5, driven: broke (REG-F-511) — "the step stopped before its evidence join recorded them" — from the count
		// alone, though the archive's own K5 check left only a folder a command wrote itself possible (P5's implementation).
		const c = cellOf(reportOf(aRun({ implementation: { commands: 1, captures: 2, k5: causes('own') } })).report, '4', 'implementation');
		expect(shown(c), 'the cause was not the archive’s K5 check’s').toEqual(['broke', ['REG-F-521']]);
		expect(c.basis).toContain(`1 captured run became no evidence: the archive’s K5 check leaves possible ${K5.own}`);
		// ⭑ Each cause the check leaves possible, with the register ids it bears on: a stop or a join refused part-way drops the
		// commands it has not joined (REG-F-511), a run past the cap is kept as no evidence (REG-F-517).
		const both = cellOf(reportOf(aRun({ implementation: { commands: 1, captures: 2, k5: causes('stop', 'cap') } })).report, '4', 'implementation');
		expect(shown(both)).toEqual(['broke', ['REG-F-511', 'REG-F-517']]);
		expect(both.basis).toContain(`1 captured run became no evidence: the archive’s K5 check leaves possible ${K5.cap}; or ${K5.stop}`);
	});

	it('⛔ F5 (4) — with no K5 check recorded, why a captured run became no evidence is unknown: stage 4 OPEN, owed to a person', () => {
		const c = cellOf(reportOf(aRun({ implementation: { commands: 1, captures: 2 } })).report, '4', 'implementation');
		expect([c.value, c.owedTo], 'a cause was guessed where the archive records none').toEqual([null, K5_OWED]);
		expect(c.basis).toContain(
			'1 captured run became no evidence, and why is not recorded: the archive 04-implementation’s checks.json holds no K5 check'
		);
	});

	/** P5's end-to-end phase: refused, waiting, abandoned — its plan's step CANCELLED, no step of it ever completed. */
	const ABANDONED_E2E = {
		stepState: 'CANCELLED',
		completion: 'none' as const,
		unit: { lifecycle: 'ABANDONED', execution: 'WAITING', assurance: 'UNASSESSED' },
		signedOff: false
	};
	// ⭐ P5 package B's check (finding 2) — what the reviews were GIVEN, never "judged over": the prompt's own cut decides
	// what they were shown (its tests are the next block's), and these rows record no call of theirs.
	const SEEN =
		'its declared reviews were given the work of Requirements, Design, Implementation and unit tests; End-to-end ' +
		'verification contributed none, holding no completion (lifecycle ABANDONED, assurance UNASSESSED)';

	it('⛔ F6 (7) — a root signed off over an abandoned phase: its completion says what its reviews were given, and the phase that contributed no work', () => {
		// ⛔ RED BEFORE F6, driven: "root: as intended", and the caveat "judged over the work it and every unit below it produced
		// (REG-D-111 (2))" — of P5's root, whose reviews were given no work of its abandoned end-to-end phase.
		const r = reportOf(aRun({ 'end-to-end': ABANDONED_E2E })).report;
		expect(cellOf(r, '7', 'whole run').basis, 'the root’s line does not say what its reviews were given').toContain(`root: as intended — ${SEEN}`);
		const caveat = r.answer.alwaysStated.filter((s) => s.startsWith('UNIT_PURPOSE framing'));
		expect(caveat.join(' '), 'the caveat still says every unit below the root').not.toContain('every unit below it produced');
		expect(caveat).toEqual([
			'UNIT_PURPOSE framing: the declared reviews of a unit composed of others (root: 2) were made in it — the unit’s own ' +
				'purpose, given the work of the units below it that hold a completion (REG-D-111 (2); root: the work of ' +
				'Requirements, Design, Implementation and unit tests; End-to-end verification contributed none, holding no completion ' +
				'(lifecycle ABANDONED, assurance UNASSESSED)) — and no reviewer-qualification case measures it: every declared case is ' +
				'in the PRODUCING_PROMPT framing.'
		]);
	});

	it('⛔ F6 (7) — a root the lane HELD over an abandoned phase reads as held, its reason on its line — never a bare not reached', () => {
		// ⛔ RED BEFORE F6, driven: "root: not reached", nothing of why (P5 package B F3's hold).
		const reason =
			'the root is held, not signed off: End-to-end verification is ABANDONED, and the lane signs no root off while a phase ' +
			'is (the sponsor, 2026-10-18: "Yes, hold the root")';
		const run = aRun({ 'end-to-end': ABANDONED_E2E }, { rootSignedOff: false });
		const laneRun = run.lane.run as { units: Record<string, unknown>[] };
		const unpressed = { limitCheck: null, recordAssurance: null, rerunDeclared: null, rerunLimitCheck: null, markSatisfied: null, refused: null };
		const lane: LaneRows = {
			...run.lane,
			run: {
				...laneRun,
				units: laneRun.units.map((u) => (u.slug === 'root' ? { ...u, stopped: false, signOff: { offered: true, ...unpressed, notPressed: reason } } : u))
			}
		};
		const whole = cellOf(buildRunReport(run.store, lane, { accountNames: NAMES }).report, '7', 'whole run');
		expect(whole.basis[0], 'the held root reads as a bare not reached').toBe(
			`root: not reached — its sign-off was held back before Record Assurance: ${reason}`
		);
	});

	it('⭑ F6 CONTROL — a root over phases that all completed keeps its words: as intended, and every unit below it', () => {
		const r = reportOf(aRun()).report;
		expect(cellOf(r, '7', 'whole run').basis[0]).toBe('root: as intended');
		expect(r.answer.alwaysStated.filter((s) => s.startsWith('UNIT_PURPOSE framing')).join(' ')).toContain('every unit below it produced');
	});

	it('⛔ F6 (7) — a planned phase the store does not hold: the root’s line and the caveat name it as contributing none', () => {
		// ⭐ P5 package B's check (finding 5) — the branch for a planned unit the store lacks, which no test reached.
		const run = aRun({ 'end-to-end': { begun: false } });
		const store = { ...run.store, objects: run.store.objects.filter((o) => o.id !== 'pwu_end-to-end') };
		const r = buildRunReport(store, run.lane, { accountNames: NAMES }).report;
		const missing = '; End-to-end verification contributed none, the store holding no such unit';
		expect(cellOf(r, '7', 'whole run').basis[0], 'the root’s line does not name the phase the store lacks').toBe(
			`root: as intended — its declared reviews were given the work of Requirements, Design, Implementation and unit tests${missing}`
		);
		expect(r.answer.alwaysStated.filter((s) => s.startsWith('UNIT_PURPOSE framing')).join(' ')).toContain(missing);
	});

	it('⛔ F7 — the adjudication classes name a review that ended at the reviewer’s output-token limit, by the failure text it records — never a transport failure', () => {
		// ⛔ RED BEFORE F7, driven: the classes offered "transport failure (REG-F-499)", P5's seven truncations' class by the record.
		const { classes } = reportOf(aRun()).report.adjudication;
		expect(classes, 'a transport failure is still offered').not.toContain('transport failure (REG-F-499)');
		expect(classes.filter((c) => c.includes('"model hit max output token limit"')), 'no class names the truncation').toHaveLength(1);
		expect(renderMarkdown(reportOf(aRun()).report)).toContain('model hit max output token limit');
	});

	// ⭐⭐ `JAN-EXEC` Phase 7 P6, package L (F2; `REG-D-120` Q17) — THE MALFORMED-REPLY CLASS NAMES `REG-F-566`, beside `REG-F-489`,
	// `REG-F-428` and `REG-F-479`: GLM-5.3 Flash High filing a criterion's answer under an id the policy does not declare. Run-7's
	// four command reviews that filed RR-03's answer so were classified malformed reply (`REG-F-566`), and the class the report
	// offered named the older three alone.
	it('⛔ P6 L F2 — the malformed-reply class names REG-F-566, a criterion’s answer under an undeclared id, beside REG-F-489, REG-F-428 and REG-F-479', () => {
		const malformed = 'malformed reply (REG-F-489, REG-F-428, REG-F-479, REG-F-566)';
		const { report } = reportOf(aRun());
		expect(
			report.adjudication.classes.filter((c) => c.startsWith('malformed reply')),
			'the malformed-reply class does not name REG-F-566 beside the older three'
		).toEqual([malformed]);
		expect(renderMarkdown(report), 'report.md does not offer the class').toContain(`; ${malformed}.`);
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7 P5, package B's check, finding 2 — WHAT THE ROOT'S REVIEWS WERE GIVEN, AND WHAT THEIR PROMPTS SHOWED ──
//
// F6's root line said its reviews were "judged over the work of Requirements, Design, Implementation and unit tests". P5's
// two root prompts showed the work of Requirements and part of Design, and no command: the validator's head-only cut kept
// the first 21684 (or 21711) of 50586 code points. The route GIVES the work, and the prompt's own cut decides what it
// SHOWED, so the reader reads each declared review's prompt for that (`declaredWorkShown`), and the report says both.

/** A content store holding `rows`, in the product's schema (`sqlite-artifact-store.ts`), closed as a rollback journal. */
function writeContentStore(file: string, rows: readonly { readonly storageKey: string; readonly bytes: string }[]): void {
	const db = createSqliteDriver(file);
	try {
		db.exec(
			'CREATE TABLE artifact_content (storage_key TEXT PRIMARY KEY, content_hash TEXT NOT NULL, byte_size INTEGER NOT NULL, ' +
				'media_type TEXT NOT NULL, purgeability TEXT NOT NULL, purged INTEGER NOT NULL DEFAULT 0, bytes TEXT)'
		);
		const put = db.prepare(
			'INSERT INTO artifact_content(storage_key, content_hash, byte_size, media_type, purgeability, purged, bytes) VALUES (?,?,?,?,?,?,?)'
		);
		for (const r of rows) put.run(r.storageKey, `sha256:${sha(r.bytes)}`, Buffer.byteLength(r.bytes, 'utf8'), 'text/plain', 'PURGEABLE', 0, r.bytes);
		db.exec('PRAGMA journal_mode = DELETE');
	} finally {
		db.close();
	}
}

describe('⭐⭐ P5 package B’s check (finding 2) — what the root’s reviews were GIVEN, and what their prompts SHOWED of it', () => {
	const TITLES = PHASE7_UNITS.slice(1).map((u) => u.title);
	const THREE = TITLES.slice(0, 3);
	const ROOT: AssuranceSubject = {
		subjectId: 'pwu_root',
		objectType: 'PROFESSIONAL_WORK_UNIT',
		semanticVersion: 1,
		isAiProduced: true,
		producer: { actorType: 'AGENT', agentId: 'model:fixture-executor', modelId: 'fixture-executor-model', providerId: 'fixture' }
	};
	const POLICY = {
		policyId: 'pol_intent_preservation',
		name: 'Intent Preservation',
		purpose: 'Determine whether the work preserves the intent of the Undertaking.'
	};
	const MET = JSON.stringify({
		findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({ criterionId: c.id, failed: false, statement: 'met' })),
		recommendation: 'SATISFIED',
		residualUncertainty: []
	});
	/** The prompt the product's own validator builds for `input`, its model stubbed to answer every criterion met. */
	const promptOf = async (input: ReasoningReviewInput): Promise<string> => {
		const sent: string[] = [];
		const print: AgyPrint = async (p) => {
			sent.push(p);
			return MET;
		};
		await createAgyReasoningReviewValidator({ print, modelId: 'fixture-judge' }).evaluate(ROOT, { reasoningReview: input });
		expect(sent.length, 'arrangement: the validator sent its prompt').toBeGreaterThan(0);
		return sent[0]!;
	};
	const answer = (unit: string, size: number) => `${unit}: ${'w'.repeat(size)}`;
	const argv = (i: number) => ['node', '--test', `test/unit-${i}.test.js`];
	/** A root's declared review over `units`, each its own work product of `size` code points and its own one command. */
	const rootReview = (units: readonly string[], size: number, instruction = 'Realize wordfreq, requirements to verification.') =>
		declaredPolicyReviewInput({
			policy: POLICY,
			criteria: SEEDED_REASONING_REVIEW_CRITERIA,
			instruction,
			instructionIs: 'UNIT_PURPOSE',
			workProducts: units.map((unit) => ({ unit, answer: answer(unit, size) })),
			commands: units.map((unit, i) => ({ unit, argv: argv(i), exitCode: 0, timedOut: false }))
		});
	/** The work of `units` as one line of JSON, handed whole to the validator, which cuts it head-only — P5's builder, before F2. */
	const headCutReview = (units: readonly string[], size: number): ReasoningReviewInput => ({
		...rootReview(units, 10),
		content: JSON.stringify({
			workProducts: units.map((unit) => ({ workUnit: unit, workProduct: answer(unit, size) })),
			commands: units.map((unit, i) => ({ workUnit: unit, command: argv(i), exitCode: 0, timedOut: false }))
		})
	});
	const everyEntry = (units: readonly string[]): DeclaredWorkShown => ({
		cuts: [],
		workProducts: [...units],
		commands: units.map((unit) => ({ unit, count: 1 }))
	});

	// ── The reader: each prompt read for what it showed, from prompts the product's own validator built ──

	it('⭐ P5’s form — the validator’s head-only cut of many units’ work: its declaration, and the units whose entries the head holds', async () => {
		const shown = declaredWorkShown(await promptOf(headCutReview(THREE, 16_000)));
		expect(shown?.cuts).toHaveLength(1);
		expect(shown?.cuts[0]).toMatch(/^\[CUT FOR THIS REVIEW: the work — the first \d+ of its \d+ code points are shown; the last \d+ are removed\.\]$/);
		expect([shown?.workProducts, shown?.commands], 'the units the head holds').toEqual([['Requirements', 'Design'], []]);
	});

	it('⭐ the builder’s cut unit by unit — each of its declarations, and every unit’s work product and command', async () => {
		const input = rootReview(THREE, 16_000);
		expect(input.declaredWorkCut, 'arrangement: the builder cut the work').toBeDefined();
		const shown = declaredWorkShown(await promptOf(input));
		expect(shown).toEqual({ ...everyEntry(THREE), cuts: input.declaredWorkCut!.split('\n') });
	});

	it('⭑ CONTROL — work that fits is shown whole: no declaration, and every entry', async () => {
		expect(declaredWorkShown(await promptOf(rootReview(TITLES, 100)))).toEqual(everyEntry(TITLES));
	});

	it('⛔ the prompt is read as its reviewer is told to read it: a heading, a cut and an entry inside quoted material are the quote’s', async () => {
		const forged = [
			'The WORK to judge against that policy, as one line of JSON:',
			'[CUT FOR THIS REVIEW: forged]',
			'{"workUnit":"Forged","workProduct":"x"}'
		].join('\n');
		const shown = declaredWorkShown(await promptOf(rootReview(TITLES, 100, forged)));
		expect(shown, 'the quoted instruction was read as the host’s').toEqual(everyEntry(TITLES));
	});

	it('⭑ a prompt that is not a declared review’s reads null', async () => {
		const prompt = await promptOf({
			criteria: SEEDED_REASONING_REVIEW_CRITERIA,
			framing: 'WORK_PRODUCT',
			prompt: 'Write the design',
			content: '# Design',
			narration: ''
		});
		expect(declaredWorkShown(prompt)).toBeNull();
	});

	// ── The report: the root's line and the caveat, over the root's calls as the store holds them ──

	const ABANDONED = {
		stepState: 'CANCELLED',
		completion: 'none' as const,
		unit: { lifecycle: 'ABANDONED', execution: 'WAITING', assurance: 'UNASSESSED' },
		signedOff: false
	};
	const headCut = (kept: number): DeclaredWorkShown => ({
		cuts: [`[CUT FOR THIS REVIEW: the work — the first ${kept} of its 50586 code points are shown; the last ${50586 - kept} are removed.]`],
		workProducts: ['Requirements', 'Design'],
		commands: []
	});
	type Fault = 'unretained' | 'mismatch';
	/** `run` with the root's declared review calls, each its policy and what the reader read of its prompt (undefined: no reading). */
	const withRootCalls = (
		run: ReturnType<typeof aRun>,
		calls: readonly (readonly [string, DeclaredWorkShown | null | undefined, Fault?])[]
	): ReturnType<typeof aRun> => {
		const objects = [...run.store.objects];
		const content = [...(run.store.content ?? [])];
		calls.forEach(([policyId, shown, fault], n) => {
			const text = `the prompt of the root's call ${n}`;
			const contentHash = `sha256:${sha(text)}`;
			objects.push({
				id: `mex_root_${n}`,
				objectType: 'MODEL_EXCHANGE',
				state: {
					plane: 'ASSURANCE',
					assurancePolicyId: policyId,
					subjectObjectId: 'pwu_root',
					subjectObjectType: 'PROFESSIONAL_WORK_UNIT',
					runToken: `declared-review:pwu_root:${policyId}:${n}`,
					attemptOrdinal: 1,
					exchangeRole: 'INITIAL',
					disposition: 'ACCEPTED',
					parseOutcome: { outcome: 'PARSED', detail: '' },
					materializedInputRef:
						fault === 'unretained'
							? { status: 'PENDING_CONTENT_PLANE', reason: 'no content store was wired on this path' }
							: { status: 'STORED', storageKey: `k_root_${n}`, contentHash, byteSize: text.length }
				},
				firstSequence: Number.MAX_SAFE_INTEGER - 200 + n
			});
			content.push({
				storageKey: `k_root_${n}`,
				contentHash,
				byteSize: text.length,
				purged: false,
				actualHash: fault === 'mismatch' ? `sha256:${sha('other bytes')}` : contentHash,
				actualSize: text.length,
				...(shown === undefined ? {} : { declaredWork: shown })
			});
		});
		return { store: { ...run.store, objects, content }, lane: run.lane };
	};
	const rootLineOf = (run: ReturnType<typeof aRun>) => cellOf(reportOf(run).report, '7', 'whole run').basis[0];
	const caveatOf = (run: ReturnType<typeof aRun>) =>
		reportOf(run).report.answer.alwaysStated.filter((s) => s.startsWith('UNIT_PURPOSE framing')).join(' ');
	const GIVEN_P5 =
		'its declared reviews were given the work of Requirements, Design, Implementation and unit tests; End-to-end ' +
		'verification contributed none, holding no completion (lifecycle ABANDONED, assurance UNASSESSED)';

	it('⛔ P5’s root — its line says what its reviews were GIVEN, and what each prompt SHOWED of it: two units’ work products, no command, the host’s cut', () => {
		// ⛔ RED BEFORE, driven: "root: as intended — its declared reviews were judged over the work of Requirements, Design,
		// Implementation and unit tests; End-to-end verification contributed none, …", and no word of what either prompt showed.
		const run = withRootCalls(aRun({ 'end-to-end': ABANDONED }), [
			['pol_intent_preservation', headCut(21684)],
			['pol_fitness_for_purpose', headCut(21711)]
		]);
		const shown = (kept: number) =>
			`the work products of "Requirements", "Design" and no command, cut as the host declared: ${headCut(kept).cuts[0]}`;
		const seen =
			`${GIVEN_P5}; and what their prompts showed of it — pol_intent_preservation (1 call): ${shown(21684)}; ` +
			`pol_fitness_for_purpose (1 call): ${shown(21711)}`;
		expect(rootLineOf(run), 'the root’s line does not say what its prompts showed').toBe(`root: as intended — ${seen}`);
		expect(caveatOf(run), 'the caveat does not say what the prompts showed').toContain(
			`given the work of the units below it that hold a completion (REG-D-111 (2); root: ${seen.slice('its declared reviews were given '.length)})`
		);
	});

	it('⛔ every unit completed, and the prompts cut the work: the line names the cut and counts the calls — never "every unit below it produced"', () => {
		const perUnit: DeclaredWorkShown = {
			...everyEntry(TITLES),
			cuts: ['[CUT FOR THIS REVIEW: the work product of "Requirements" — the first 5000 of its 16014 code points are shown; the last 11014 are removed.]']
		};
		const run = withRootCalls(aRun(), [
			['pol_intent_preservation', perUnit],
			['pol_intent_preservation', perUnit]
		]);
		const quoted = TITLES.map((t) => JSON.stringify(t));
		expect(rootLineOf(run), 'a cut prompt read as one that showed every unit’s work').toBe(
			`root: as intended — its declared reviews were given the work of ${TITLES.join(', ')}; and what their prompts showed ` +
				`of it — pol_intent_preservation (2 calls): the work products of ${quoted.join(', ')} and the commands of ` +
				`${quoted.map((t) => `${t} (1)`).join(', ')}, cut as the host declared: ${perUnit.cuts[0]}`
		);
		expect(caveatOf(run)).not.toContain('every unit below it produced');
	});

	it('⭑ CONTROL — every unit completed, and every prompt showed all of it uncut: the old words stand', () => {
		const run = withRootCalls(aRun(), [
			['pol_intent_preservation', everyEntry(TITLES)],
			['pol_fitness_for_purpose', everyEntry(TITLES)]
		]);
		expect(rootLineOf(run)).toBe('root: as intended');
		expect(caveatOf(run)).toContain('judged over the work it and every unit below it produced (REG-D-111 (2))');
	});

	it('⛔ a prompt the report cannot read is said NOT READ, and why — never read as shown whole', () => {
		const run = withRootCalls(aRun(), [
			['pol_a', undefined],
			['pol_b', headCut(21684), 'unretained'],
			['pol_c', headCut(21684), 'mismatch'],
			['pol_d', null]
		]);
		expect(rootLineOf(run)).toBe(
			`root: as intended — its declared reviews were given the work of ${TITLES.join(', ')}; and what their prompts showed of it — ` +
				'pol_a (1 call): not read here: the report was handed no reading of its prompt; ' +
				'pol_b (1 call): not read here: its prompt is not retained; ' +
				'pol_c (1 call): not read here: its prompt does not hold what its record claims; ' +
				'pol_d (1 call): not read here: its prompt is not a declared review’s'
		);
		const bare = withRootCalls(aRun(), [['pol_a', headCut(21684)]]);
		expect(rootLineOf({ ...bare, store: { ...bare.store, content: null } }), 'with no content store, a prompt was read').toBe(
			`root: as intended — its declared reviews were given the work of ${TITLES.join(', ')}; and what their prompts showed of it — ` +
				'pol_a (1 call): not read here: the archive holds no content store'
		);
	});

	it(
		'⛔ the command line reads each prompt from the archived content store: a prompt the product’s validator cut, its cut on the root’s line',
		async () => {
			const prompt = await promptOf(headCutReview(THREE, 16_000));
			const cut = declaredWorkShown(prompt)!.cuts[0]!;
			const run0 = withRootCalls(aRun({ 'end-to-end': ABANDONED }), [['pol_intent_preservation', undefined]]);
			// The call's prompt is these bytes, stored as the content plane stores them.
			const objects = run0.store.objects.map((o) =>
				o.id === 'mex_root_0'
					? {
							...o,
							state: {
								...o.state,
								materializedInputRef: {
									status: 'STORED',
									storageKey: 'k_root_0',
									contentHash: `sha256:${sha(prompt)}`,
									byteSize: Buffer.byteLength(prompt, 'utf8')
								}
							}
						}
					: o
			);
			const run = runFolder({ ...run0.store, objects, content: null });
			writeContentStore(join(run, 'lane', 'archive', '06-final', 'demo.sqlite.content.sqlite'), [{ storageKey: 'k_root_0', bytes: prompt }]);
			const r = cli([run]);
			expect(r.code, r.out).toBe(0);
			const report = JSON.parse(readFileSync(join(run, 'lane', 'report', 'report.json'), 'utf8')) as RunReport;
			expect(cellOf(report, '7', 'whole run').basis[0], 'the reader handed the report no reading of the prompt').toBe(
				`root: as intended — ${GIVEN_P5}; and what their prompts showed of it — pol_intent_preservation (1 call): the work ` +
					`products of "Requirements", "Design" and no command, cut as the host declared: ${cut}`
			);
		},
		120_000
	);
});
