// ⭐ `JAN-EXEC` Phase 7, P7-2 D9 (DESIGN-the-live-end-to-end-run.md §1, §2, §6 P7-2, P7-3, P7-4d/f/g) — THE RUN REPORT,
// DECIDED AS PURE FUNCTIONS OVER THE ROWS THE ARCHIVED STORES HOLD. `run-report.ts` opens the stores read-only, reads the
// lane's own files and writes what this module returns; nothing here touches a file, a clock or a store.
//
// What it decides, each from the record and never from the page:
//   · §1's MATRIX — the four model-run phases at stages 3 to 8, and whole-run rows for stages 1, 2 and 7, the root in
//     stage 7. ⛔ A cell holds exactly one of §1's five values, and a `broke` that no register entry names is marked so
//     (`unregistered`). ⚠ A cell this report cannot decide is left OPEN, `null`, and names who decides it — stage 6 is
//     P7-4's checks, a review that concluded against the work is the adjudication's (P7-4f), and runs the archive
//     cannot count (K5) are a person's — rather than being given one of the five on a guess. ⛔ A unit whose Begin &
//     Execute outlasted the lane's allowance (D4) is read as cut there, never from its mid-unit archive as if it ended;
//     ⭐ E12's re-review F1 — and one whose sign-off act outlasted its bound, at stage 7, the act and its bound named.
//   · THE PAIRING (§2 stage 8; `REG-F-433`) — every Reasoning Review of an execution-plane subject, paired with the
//     ASSURANCE-plane call that concluded it: answered, no response, refused (a substitute, or a failed repair), no
//     answer recorded, or not pairable when its subject had more than one floor run. A deterministic floor policy and a
//     sign-off are listed as making no model call BY DESIGN — never as "no answer recorded". ⭐ P7-6 B7: each review is
//     joined to ITS OWN floor run's calls by the run's token, so a re-reviewed subject is paired review by review; only a
//     record with no token falls back to the subject, and keeps its refusal. ⭐ P7-6 B2: an I5 chain whose criterion repair
//     added nothing concluded on its FIRST reply, `REG-F-552`'s case — never a failed repair nor a no response.
//   · THE AUDIT (P7-3) — each hand act the log can show, the forbidden six first. ⛔ A hand completion is ANY step
//     success that is not one of Begin & Execute's two shapes (the critic's corrected rule: an operator completion that
//     names ONE output carries neither of the markers the maps first listed).
//   · REVIEWER CALLS — a lower bound; the 14 DECLARED VERDICTS, ~~each vacuous by construction (`REG-F-523`)~~ ⭐ E2: each read
//     from its recorded criterion results — as intended when every criterion is answered and its verdict is the one they
//     give (`REG-D-110` (3); design B8), a pre-E2 sign-off's still vacuous by construction; the
//     ADJUDICATION TABLE's rows with the classification left for a person (P7-4f); and the per-command RE-RUN MANIFEST
//     v1, exactly as `rerun-commands.ts` reads it (P7-4d).
//
// ⛔ NOTHING HERE QUOTES CONTENT. A model's answer, a command's output and a reviewer's prose stay in the archive (design
// §10; `REG-F-521` W-3): the report carries ids, states, counts, hashes and storage keys, and the CLI scans everything it
// writes for the account name and absolute paths before writing a byte (`REG-F-536`).
import { createHash } from 'node:crypto';
import { posix } from 'node:path';
// ⭐ E2 (design B8) — the kernel's own ladder, so "the verdict the answers give" is decided by the rule the sign-off computes
// it with (`declared-policy-signoff.ts` `verdictOf`), never a restated copy of it. Pure, store-free. ⚠ E12's re-review F5 —
// save the one limb `verdictOf` applies before the ladder, a review that answered no criterion, which `judgedVerdict` restates.
import { BLOCKING_SEVERITIES, dispositionFromFindings } from '@janumipwb/rph-assurance';
import {
	PHASE7_NEGATIVE_CONTROL_RESERVE,
	PHASE7_PAID_LIMIT,
	PHASE7_PRIOR_CALLS_VARIABLE,
	PHASE7_REVIEWED_COMMANDS
} from '../../apps/rph-demo/e2e-live-exec/lane-config.js';
import { scanText } from './archive-scan.js';
import {
	PHASE7_DESIGN,
	PHASE7_E2E,
	PHASE7_IMPLEMENTATION,
	PHASE7_REQUIREMENTS,
	PHASE7_ROOT,
	PHASE7_PWA,
	type Phase7TypeDeclaration
} from './pwa-content.js';
import {
	MANIFEST_VERSION,
	manifestProblems,
	type CommandManifest,
	type EvidenceVerdict,
	type RecordedCommand,
	type UnitTree
} from './rerun-commands.js';

// ── WHAT THE PRODUCT WRITES, RESTATED — each held to its source by `verif/phase7-run-report.test.ts` ─────────────────

/** The floor's three policies, in the plan's order (`rph-assurance` `deMinimisFloorPlan`). */
export const FLOOR_POLICIES = [
	'floor.schema-invariant',
	'floor.identity-provenance',
	'floor.reasoning-review'
] as const;
export const REASONING_REVIEW = 'floor.reasoning-review';
/** The demo sign-off's policy (`assurance/demo-policy.ts` `DEMO_POLICY_ID`), created by the first Record Assurance. */
export const DEMO_POLICY_ID = 'pol_01ARZ3NDEKTSV4RRFFQ69GDEM0';
/** The finding code Record Blocking Finding records (`DEMO_FINDING_CODE`). */
export const DEMO_FINDING_CODE = 'DEMO_UNFIT';
/** ~~The declared-policy sign-off's validator~~ ⭐ E2 — the PRE-E2 sign-off's validator (`declared-policy-signoff.ts`
 *  `DEMO_REVIEW_VALIDATOR_ID`): a record made before the declared policies were judged carries it, and reads vacuous. */
export const DECLARED_SIGNOFF_VALIDATOR = 'workbench.independent-review';
/**
 * ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (`REG-F-523`; `REG-D-110` (3)) — THE VALIDATORS A DECLARED VERDICT IS RECORDED UNDER
 * NOW: the model reviewer, the gate lane's stand-in, a refused selection, and a policy nobody reviewed
 * (`declared-policy-review.ts`, `declared-policy-signoff.ts`). ⛔ RESTATED, NOT IMPORTED: those modules load the reviewer's
 * chain, which reads tool variables at load (`REG-D-072` D12); `verif/phase7-run-report.test.ts` holds each to its source.
 */
export const DECLARED_REVIEW_VALIDATORS = [
	'reviewer.declared-policy',
	'standin.declared-policy-review',
	'declared-policy-review.unconfigured',
	'declared-policy-review.missing'
] as const;
/** Begin & Execute's root completion (`undertakings/[id]/+page.server.ts`, the TRANSFORMATION path's detail). */
export const ROOT_COMPLETION_DETAIL =
	'Demo lifecycle step: it demonstrates the execution axis and authors no artifact.';
/** The page's hand completion with no output (`completeStep`'s `noOutputResult.detail`). */
export const OPERATOR_COMPLETION_DETAIL = 'Operator completed the step without naming a produced output.';
/** The page's hand failure, when the operator gives no reason (`failStep`'s default `failureReason`). */
export const OPERATOR_FAILURE_REASON = 'Operator marked the step failed.';
/** ⭐ E2 — the operator's actor id (`identity.ts`, the session principal): a declared verdict naming it as producer is
 *  `REG-F-514`'s shape on a model unit. */
export const OPERATOR_ACTOR_ID = 'local-professional';
/** The model path's executor, as Begin & Execute names it (`executionProvenance.executedBy.displayName`). */
export const MODEL_EXECUTOR_NAME = 'Execution model';
/** Every evidence object of a unit carries this scope, and nothing else ties it to the unit (`+page.server.ts`). */
export const EVIDENCE_SCOPE_PREFIX = 'commands run by the executing model for work unit ';
/**
 * ⭐ P7-6 I5 (`p76-fix-c` C1) — THE MARKER E-5's detail OPENS WITH on every reply that PARSED and answered no criterion: the
 * try that requested the criterion repair, and a criterion repair that answered none either (`reasoning-review-validator.ts`
 * `NO_CRITERION_ANSWERED`, `P76F-A` A2; held equal to this by `verif/phase7-run-report.test.ts`). ⛔ RESTATED, NOT IMPORTED:
 * the validator's module loads the reviewer's whole chain, which reads tool variables at load (`REG-D-072` D12), and this
 * report reads an archive with no reviewer anywhere. ⚠ The marker beside the outcome, never the outcome alone:
 * `classifyParse` gives a JSON repair's first reply `SCHEMA_COERCION_FAILED` too.
 * ⛔ IT REPLACES B2's `NO_CRITERION_ANSWERED_NOTE`, the request's CLOSING sentence, which A2 removed from a refused repair's
 * record on purpose (it said of the repair that its own judgement was kept) — so, keyed on it, a repair that parsed and
 * answered none read "did not parse", a false cause. ⚠ No fallback for the older wording: I5 has never run against a
 * model, so no stored record carries it.
 */
export const NO_CRITERION_ANSWERED = 'The reply answered no criterion (REG-F-552).';
// ⛔ THE LANE'S OWN FIGURES, DERIVED BY REFERENCE, NEVER RESTATED: the limit the report states is the one the lane checked
// before each phase, so the two can never part (`e2e-live-exec/lane-config.ts`, which imports nothing).
/** The runs one unit's observer keeps (`tools/process-run-observer.ts` `OBSERVED_PROCESS_RUN_LIMIT`; `REG-F-517`). */
export const RECORDED_RUN_LIMIT = PHASE7_REVIEWED_COMMANDS;
/** The sponsor's paid limit, in reviewer calls (`REG-D-102` (4)), and the calls held back for P7-4e (design D8). */
export const PAID_LIMIT = PHASE7_PAID_LIMIT;
export const NEGATIVE_CONTROL_RESERVE = PHASE7_NEGATIVE_CONTROL_RESERVE;
/** The declared verdicts a complete run signs off: the five units' declared policies, 2 + 2 + 4 + 3 + 3 (§3.2). */
export const DECLARED_VERDICTS_EXPECTED = 14;

/** §1's five cell values — and no other. */
export const CELL_VALUES = [
	'as intended',
	'broke',
	'not reached',
	'vacuous by construction',
	'not measured in this half'
] as const;
export type CellValue = (typeof CELL_VALUES)[number];

/**
 * ~~The two gaps no Phase 7 run can close, which a "Yes" always states (§1).~~ ⭐⭐ E2 (`DESIGN-phase-7-completion.md` B8,
 * §1) — THE GAP NO PHASE 7 RUN CAN CLOSE, which a "Yes" always states. ⛔ The `REG-F-523` line is gone ⭐ `E12F` F10: FROM
 * WHAT IS ALWAYS STATED, and stated per run instead (`uncheckedCaveat`) — the declared policies are judged now, criterion by
 * criterion (`REG-D-110` (3)), and stage 5b says, per run, whether they were; a run whose verdicts carry no criterion result
 * (a pre-E2 archive) still opens with it.
 * ~~'REG-F-523: the declared policies were signed off with no criterion checked.'~~
 */
export const ALWAYS_STATED = [
	'REG-F-510: the PWA had to name its product, because an Undertaking cannot tell its phases what to build (§3.3).'
] as const;

/**
 * ⛔⛔ `E12F` F10 — ~~THE `REG-F-523` LINE IS GONE~~ FOR EVERY RUN: true of a run whose declared verdicts were judged, and false
 * of one whose verdicts carry no criterion result — a pre-E2 archive, signed off from required evidence alone, or a verdict
 * of a policy that declares no criterion. So the caveat is STATED PER RUN, from its declared verdicts: the line whole when
 * none of them carries a criterion result, counted when some do not, and absent when every one does (or none was recorded).
 */
export function uncheckedCaveat(declared: readonly { readonly criterionResults: number }[]): readonly string[] {
	const unchecked = declared.filter((d) => d.criterionResults === 0).length;
	if (unchecked === 0) return [];
	if (unchecked === declared.length)
		return ['REG-F-523: the declared policies were signed off with no criterion checked.'];
	return [`REG-F-523: ${unchecked} of ${declared.length} declared verdicts were signed off with no criterion checked.`];
}

/** The classifications a person gives each adjudication row (P7-4f). This report leaves the field blank. */
export const ADJUDICATION_CLASSES = [
	'reviewer right',
	'reviewer wrong',
	'join defect (REG-F-485, REG-F-486)',
	'transport failure (REG-F-499)',
	'malformed reply (REG-F-489, REG-F-428, REG-F-479)'
] as const;

export interface UnitSpec {
	readonly order: number;
	readonly slug: string;
	readonly type: Phase7TypeDeclaration;
}

/** The units, in the order the run starts them (`pwa-content.ts`: the root, then the four phases). */
export const PHASE7_UNITS: readonly UnitSpec[] = [
	{ order: 1, slug: 'root', type: PHASE7_ROOT },
	{ order: 2, slug: 'requirements', type: PHASE7_REQUIREMENTS },
	{ order: 3, slug: 'design', type: PHASE7_DESIGN },
	{ order: 4, slug: 'implementation', type: PHASE7_IMPLEMENTATION },
	{ order: 5, slug: 'end-to-end', type: PHASE7_E2E }
];
/** A unit's archive folder, `<NN>-<slug>`. */
export const archiveNameOf = (order: number, slug: string): string => `${String(order).padStart(2, '0')}-${slug}`;
/** The archive taken after the sign-offs. */
export const FINAL_ARCHIVE = '06-final';

// ── THE ROWS ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** One row of `professional_work_objects`, with the global sequence of its aggregate's first event (listByType's order). */
export interface StoredObject {
	readonly id: string;
	readonly objectType: string;
	readonly state: Readonly<Record<string, unknown>>;
	readonly firstSequence: number;
}

/** One event of `domain_events`: the envelope's fields, and the DOMAIN payload (the envelope's `payload`). */
export interface StoredEvent {
	readonly sequence: number;
	readonly eventType: string;
	readonly aggregateType: string;
	readonly aggregateId: string;
	readonly commandId: string | null;
	/**
	 * ⭐ P7-6 B7 (`REG-F-433`) — the envelope's `correlationId`. A floor run's assessments carry their run's token here, the
	 * token its reviewer calls carry as `runToken` (`floor-over-subject.ts`, `floorRunToken`): the key the pairing joins
	 * by. Optional: a row read without it is a record whose review names no run.
	 */
	readonly correlationId?: string | null;
	readonly payload: Readonly<Record<string, unknown>>;
}

/** One row of the content store's `artifact_content`, with what the READER recomputed from its bytes — never the bytes. */
export interface StoredContent {
	readonly storageKey: string;
	readonly contentHash: string;
	readonly byteSize: number;
	readonly purged: boolean;
	/** `sha256:<hex>` of the stored bytes, as the reader recomputed it; null when the row holds none. */
	readonly actualHash: string | null;
	readonly actualSize: number | null;
}

export interface StoreRows {
	readonly objects: readonly StoredObject[];
	readonly events: readonly StoredEvent[];
	/** null when the archive holds no content store. */
	readonly content: readonly StoredContent[] | null;
}

/** One line of `lane/posts.jsonl`: a POST the page sent. */
export interface PostLine {
	readonly seq?: number;
	readonly url?: string;
	readonly action?: string;
	readonly status?: number;
}

/** One `lane/actions/<NN>-<slug>-<action>.json`, without its body. */
export interface ActionRecord {
	readonly file: string;
	readonly action?: string;
	readonly envelopeType?: string | null;
}

/** What the reader found in one `lane/archive/<NN>-<slug>/`. */
export interface ArchiveFacts {
	readonly name: string;
	/** `workspaceTreeSha256` of its `workspace/`, or null when it holds none. */
	readonly workspaceTree: string | null;
	/** The folder names under its `process-output/captures/`, or null when it holds no `process-output/`. */
	readonly captures: readonly string[] | null;
	/**
	 * What its `checks.json` records of the run's process-output when the archive was taken (`run-archive.ts`,
	 * `archived.processOutput.present`): false — the run had none, so there was no capture to copy — or null when no
	 * `checks.json` says, as in an archive cut short.
	 */
	readonly processOutputRecorded?: boolean | null;
}

export interface LaneRows {
	/** `lane/run.json`, parsed; undefined when it is absent. */
	readonly run: unknown;
	/** `lane/boot.json`, parsed; undefined when it is absent. */
	readonly boot: unknown;
	/** `lane/posts.jsonl`'s lines; undefined when it is absent. */
	readonly posts: readonly PostLine[] | undefined;
	readonly actions: readonly ActionRecord[];
	readonly archives: readonly ArchiveFacts[];
	/** The archive whose stores were read. */
	readonly archiveRead: string;
	/** What the reader could not read, by name. */
	readonly problems: readonly string[];
}

// ── THE REPORT ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type StageId = '1' | '2' | '3' | '4' | '5a' | '5b' | '6' | '7' | '8';
export const STAGES: Readonly<Record<StageId, string>> = {
	'1': 'Build and publish',
	'2': 'Create the Undertaking',
	'3': 'Run each phase',
	'4': 'Evidence and review',
	'5a': 'The floor',
	'5b': 'Declared policies',
	'6': 'The product',
	'7': 'Completion',
	'8': 'The record'
};
export const PHASE_STAGES: readonly StageId[] = ['3', '4', '5a', '5b', '6', '7', '8'];
export const WHOLE_RUN_STAGES: readonly StageId[] = ['1', '2', '7'];
export const WHOLE_RUN = 'whole run';

export interface MatrixCell {
	readonly stage: StageId;
	/** A phase's slug, or `whole run`. */
	readonly row: string;
	/** One of §1's five, or null: this report cannot decide the cell, and `owedTo` says what does. */
	readonly value: CellValue | null;
	readonly registerIds: readonly string[];
	readonly basis: readonly string[];
	readonly owedTo?: string;
	/**
	 * ⛔ Set on a break no register entry names yet — §1's value is "broke (with its register id)", so P7-5 owes one before
	 * it reports the cell. Set by `cell` itself on every `broke` with no id, so no path can print a bare "broke".
	 */
	readonly unregistered?: true;
}

/**
 * How a review's pairing reads. ⭐ P7-6 B2 — `no-criterion-answered`: the review concluded on a reply that PARSED and
 * answered no criterion, after its one criterion repair (P7-6 I5) answered none, did not parse or got no reply —
 * `REG-F-552`'s case, never a failed repair nor a no response, which the record's last call would otherwise say.
 */
export type PairingLabel =
	| 'answered'
	| 'no-criterion-answered'
	| 'no-response'
	| 'refused'
	| 'no-answer-recorded'
	| 'not-pairable';
export const PAIRING_LABELS: readonly PairingLabel[] = [
	'answered',
	'no-criterion-answered',
	'no-response',
	'refused',
	'no-answer-recorded',
	'not-pairable'
];

export interface PairingRow {
	readonly assessmentId: string;
	readonly subjectId: string | null;
	readonly subjectKind: 'work product' | 'command';
	readonly unit: string | null;
	readonly assessmentState: string;
	readonly label: PairingLabel;
	/** Set on a `refused` row: which refusal it was. */
	readonly refusal?: 'substitute' | 'failed-repair';
	readonly detail: string;
	/**
	 * ⭐ P7-6 B7 — what joined the review to its calls: its floor run's token, which its assessment and its calls both carry
	 * (`REG-F-433`'s key), or — for a record that carries none, a run's before the key — its subject alone.
	 */
	readonly joinedBy: 'run token' | 'subject';
	/**
	 * How many floor runs the pairing had to tell apart: 1 for a review joined by its run's token; for one joined by its
	 * subject, the subject's runs no token names — the condition the subject rule holds under is exactly one.
	 */
	readonly floorRuns: number;
	/** The exchange that concluded it, or null. */
	readonly concludedBy: string | null;
	/** Each recorded call, `<ROLE>:<DISPOSITION>`, in ordinal order. */
	readonly calls: readonly string[];
}

export type NoModelAnswerKind =
	| 'deterministic floor policy'
	| 'declared-policy sign-off'
	| 'demo sign-off'
	| 'other';

export interface PairingReport {
	readonly rule: string;
	readonly rows: readonly PairingRow[];
	readonly counts: Readonly<Record<PairingLabel, number>>;
	/** Every other assessment: no model call by design, by kind — never "no answer recorded". */
	readonly noModelAnswerByDesign: Readonly<Record<NoModelAnswerKind, readonly string[]>>;
	/** Reasoning Reviews of a subject that is neither a work product nor a command — another plane's, not paired here. */
	readonly outsideTheExecutionPlane: readonly string[];
}

export interface ReviewerCallCount {
	readonly recorded: number;
	readonly noResponse: number;
	readonly retries: number;
	readonly repairs: number;
}

export interface ReviewerCalls extends ReviewerCallCount {
	readonly lowerBound: true;
	readonly byUnit: Readonly<Record<string, ReviewerCallCount>>;
	/** Design D8's check, restated over the record: prior + recorded + reserve, under the limit. */
	readonly limit: {
		readonly prior: number | null;
		readonly recorded: number;
		readonly reserve: number;
		readonly total: number | null;
		readonly limit: number;
		readonly under: boolean | null;
	};
	/**
	 * ⭐ E12's polish (fix2's F8; the lead's delegated decision of 2026-10-15, to be registered) — THE LANE'S OWN READS OF THE
	 * LIMIT, each before a paid act (D8; `E12F` F2): before each phase, each of the rule's re-runs, each sign-off and each re-run
	 * of the declared reviews, unit by unit — and which held its act back. Read from `lane/run.json`.
	 */
	readonly laneLimitChecks: readonly LaneLimitCheck[];
}

export interface AuditFinding {
	readonly sequence: number;
	readonly eventType: string;
	readonly aggregateId: string;
	readonly unit: string | null;
	readonly why: string;
}

export interface AuditAct {
	readonly act: string;
	/** One of P7-3's six. */
	readonly forbidden: boolean;
	/** Whether the log can tell this act from Begin & Execute's own. */
	readonly auditable: boolean;
	readonly found: readonly AuditFinding[];
	/** POSTs of this act in `lane/posts.jsonl` (refused ones included: a refused act leaves no event); null when absent. */
	readonly posted: number | null;
	readonly verdict: 'none' | 'FOUND' | 'not auditable from the log';
	readonly note?: string;
}

export interface AuditReport {
	readonly acts: readonly AuditAct[];
	/** Forbidden acts the log or the lane's POSTs show. */
	readonly forbiddenFound: number;
	readonly expected: readonly { readonly act: string; readonly count: number; readonly note: string }[];
	/** Every event type in the store, with its count — what the audit was read from. */
	readonly eventTypes: Readonly<Record<string, number>>;
}

export interface DeclaredVerdict {
	readonly assessmentId: string;
	readonly unit: string | null;
	readonly policyId: string;
	readonly state: string;
	readonly criterionResults: number;
	/**
	 * ~~`'vacuous by construction'`~~ ⭐ E2 (design B8): `as intended` when every criterion of the policy is answered and the
	 * recorded verdict is the one those answers give; `broke` otherwise; a pre-E2 sign-off's `vacuous by construction`.
	 */
	readonly value: 'as intended' | 'broke' | 'vacuous by construction';
	readonly registerIds: readonly string[];
	/** ⭐ E2 — who the verdict is recorded under: the declared reviewer, its stand-in, or the pre-E2 sign-off. */
	readonly validatorId: string;
	/**
	 * ⭐ E2 — the policy's criteria (`declared`), the rows recorded against it (`recorded`, latest per criterion), and of
	 * those, how many a reviewer answered, came back undetermined, and carried a test's stipulation.
	 */
	readonly criteria: {
		readonly declared: number;
		readonly recorded: number;
		readonly answered: number;
		readonly undetermined: number;
		readonly stipulatedRows: number;
	};
	/** ⭐ E2 — whether the recorded verdict is the one the recorded answers give; `null` for a pre-E2 sign-off. */
	readonly followsFromAnswers: boolean | null;
	/** ⭐ E2 — the producer the verdict checked independence against (`REG-F-514`), as the assessment records it. */
	readonly producer: string | null;
	/** ⭐ E2 — why, in the record's own terms: what was unanswered, or what the answers give. */
	readonly basis: readonly string[];
}

export interface ContentPointer {
	readonly storageKey: string;
	readonly contentHash: string;
}

export type GroundTruth =
	| {
			readonly kind: 'command';
			readonly evidenceId: string;
			readonly argv: readonly string[];
			readonly exitCode: number | null;
			readonly timedOut: boolean | null;
			readonly durationMs: number | null;
			readonly output: ContentPointer | null;
			readonly capture: { readonly stdout: string; readonly stderr: string } | null;
	  }
	| { readonly kind: 'work product'; readonly artifactId: string; readonly bytes: ContentPointer | null };

export interface AdjudicationRow {
	readonly assessmentId: string;
	readonly unit: string | null;
	readonly subject: { readonly kind: 'work product' | 'command'; readonly id: string | null };
	/** The ground truth: a command's exit and where its output is; a work product's bytes. Pointers, never content. */
	readonly groundTruth: GroundTruth | null;
	/** What the account said: the executor's try whose account the review was handed, and whether it declared one (K9). */
	readonly account: {
		readonly exchangeId: string;
		readonly parse: string;
		readonly declared: boolean;
		readonly answerSpan: ContentPointer | null;
	} | null;
	readonly verdict: {
		readonly state: string;
		readonly pairing: PairingLabel;
		readonly criteria: readonly { readonly criterionId: string; readonly result: string }[];
		readonly observations: readonly { readonly code: string; readonly severity: string }[];
	};
	/** ⛔ Left blank: one of `ADJUDICATION_CLASSES`, given by a person. */
	readonly classification: '';
}

/** K5 (`REG-F-517`): what the record and the archive say of a unit's runs. */
export interface UnitRuns {
	/** Runs that became evidence. */
	readonly recorded: number;
	/** Capture folders the unit's archive gained — one per run the runner completed; null when an archive is missing. */
	readonly captured: number | null;
	/** Captured runs no evidence names; null when `captured` is. */
	readonly unrecorded: number | null;
	/** Why the captured runs became no evidence, read from how many the join recorded (`unrecordedCause`). */
	readonly cause: string | null;
	/** ⛔ When `captured` is null, why: which archive holds no capture listing. Unknown is never read as zero. */
	readonly unknownBecause: string | null;
	/** `run_command` calls the executor's tries list as COMPLETED — a witness, and a lower bound when a try's list was cut. */
	readonly observedCalls: number;
	readonly observedCallsCut: boolean;
}

export interface UnitSummary {
	readonly order: number;
	readonly slug: string;
	readonly title: string;
	readonly unitId: string | null;
	readonly state: { readonly lifecycle: string; readonly execution: string; readonly assurance: string } | null;
	readonly step: { readonly planId: string; readonly stepState: string; readonly planStatus: string } | null;
	/** The executor's tries, each `<DISPOSITION>:<parse>`, in order. */
	readonly tries: readonly string[];
	readonly workProducts: number;
	readonly evidence: number;
	readonly runs: UnitRuns;
	readonly lane: {
		readonly beginExecute: LanePress | null;
		readonly stopped: boolean | null;
		readonly upstreamNotAssured: boolean | null;
	} | null;
}

export interface ExcludedCommand {
	readonly unit: string;
	readonly ordinal: number;
	readonly evidenceId: string;
	readonly reason: string;
	/** The argv with every argument the report may not write replaced by a placeholder. */
	readonly argv: readonly string[];
}

export interface ExcludedCommands {
	readonly tool: 'phase7/run-report';
	readonly note: string;
	readonly excluded: readonly ExcludedCommand[];
}

export interface RunReport {
	readonly tool: 'phase7/run-report';
	readonly reportVersion: 1;
	/** Design §6 P7-2b: the run measures HEAD with the one fix the sponsor chose. */
	readonly basis: 'HEAD plus P7-2b';
	readonly run: {
		readonly mode: string | null;
		readonly startedAt: string | null;
		readonly endReason: string | null;
		readonly archiveRead: string;
		readonly archivesPresent: readonly string[];
		readonly events: number;
		readonly objects: number;
		readonly contentRows: number | null;
	};
	readonly answer: {
		readonly alwaysStated: readonly string[];
		readonly counts: Readonly<Record<CellValue, number>>;
		readonly open: number;
		/**
		 * Cells that were reached and could have failed — as intended, or broke. A "Yes" may count only these (§1); a cell
		 * vacuous by construction or not measured in this half never counts, and an open or unreached one is not yet a Yes.
		 */
		readonly measured: number;
		/** Breaks no register entry names yet: each owes one before P7-5 reports it (`MatrixCell.unregistered`). */
		readonly brokeUnregistered: number;
	};
	readonly matrix: readonly MatrixCell[];
	readonly units: readonly UnitSummary[];
	readonly pairing: PairingReport;
	readonly reviewerCalls: ReviewerCalls;
	readonly audit: AuditReport;
	readonly declaredVerdicts: { readonly expected: number; readonly rows: readonly DeclaredVerdict[] };
	readonly adjudication: { readonly classes: readonly string[]; readonly rows: readonly AdjudicationRow[] };
	readonly manifest: {
		readonly commands: number;
		readonly excluded: number;
		readonly ordinal: string;
		readonly unrecordedRuns: Readonly<Record<string, number | null>>;
	};
	readonly problems: readonly string[];
}

export interface RunReportOutput {
	readonly report: RunReport;
	readonly manifest: CommandManifest;
	readonly excluded: ExcludedCommands;
}

// ── SMALL READERS: a stored field read as the type it should be, or its empty value ──────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const rec = (v: unknown): Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isSafeInteger(v) ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const bySequence = (a: StoredObject, b: StoredObject): number => a.firstSequence - b.firstSequence;
const byCodeUnit = (a: string, b: string): number => Number(a > b) - Number(a < b);
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
/** ` (text)`, or nothing when there is no text. */
const inParens = (text: string | null | undefined): string => (text ? ` (${text})` : '');

/** The Undertaking workspace's directory, as `workspace-host.ts` derives it from `JPWB_DEMO_DB` and the owner id. */
export function workspaceDirectoryFor(demoDb: string, undertakingId: string): string {
	const fingerprint = createHash('sha256').update(undertakingId, 'utf8').digest('hex').slice(0, 16);
	return `${demoDb}.workspaces/${undertakingId}-${fingerprint}`;
}

/** Whether `text` names an absolute path as the manifest format reads one (`rerun-commands.ts` `absolutePath`). */
const absolutePath = (text: string): boolean =>
	/^[A-Za-z]:/.test(text) || /^[\\/]/.test(text) || /^file:/i.test(text);

/** The options whose value is a test-name pattern, never a path (`rerun-commands.ts` `PATTERN_OPTIONS`). */
const PATTERN_OPTIONS: ReadonlySet<string> = new Set(['--test-name-pattern', '--test-skip-pattern']);

/** A path with `/` for every separator, normalized, with no trailing `/`. */
function normalizedPath(path: string): string {
	let n = posix.normalize(path.replaceAll('\\', '/'));
	while (n.length > 1 && n.endsWith('/')) n = n.slice(0, -1);
	return n;
}

/**
 * ⭐ `text`, an absolute path, made relative to the workspace `root` — `/`-separated, `.` for the root itself — or undefined
 * when it lies outside it. Both separators, and a drive letter in either case: Pi prints the working directory with `/`
 * (`REG-F-536`), Node's own messages use `\`, and Windows reads `e:` and `E:` alike. ⚠ A drive path is compared without
 * case, as Windows compares it; a POSIX one with case.
 */
export function relativeToWorkspace(text: string, root: string): string | undefined {
	if (/^file:/i.test(text)) return undefined;
	const path = normalizedPath(text);
	const base = normalizedPath(root);
	const key = (p: string): string => (/^[A-Za-z]:/.test(base) ? p.toLowerCase() : p);
	if (key(path) === key(base)) return '.';
	if (!key(path).startsWith(`${key(base)}/`)) return undefined;
	return path.slice(base.length + 1);
}

/** The five shortfalls of the execution envelope, by their whole sentences (`execution-contract.ts`). */
const SHORTFALLS: readonly (readonly [string, string])[] = [
	// ⚠ The first two share their first seven words and part at the next character — a comma, a full stop — so each is
	// matched WHOLE, punctuation included: a prefix would read the narration case (`REG-F-519`) as the other.
	['The answer is not a JSON object, so the execution contract’s envelope could not be read.', 'not-json'],
	['The answer is not a JSON object.', 'not-an-object'],
	['The answer carries no `workProduct` field', 'no-work-product'],
	['The envelope declared no `rationale`', 'no-rationale'],
	['A `rationale` object was returned with no account in it.', 'empty-account']
];

/** The K9 class of an EXECUTION exchange's parse: its outcome, and for a shortfall which of the five it was. */
export function parseClass(parseOutcome: unknown): string {
	const p = rec(parseOutcome);
	const outcome = str(p.outcome) || 'UNKNOWN';
	if (outcome !== 'SCHEMA_COERCION_FAILED') return outcome;
	const detail = str(p.detail);
	return `${outcome}:${SHORTFALLS.find(([sentence]) => detail.includes(sentence))?.[1] ?? 'other'}`;
}

// ── THE INDEX ────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Index {
	readonly byId: ReadonlyMap<string, StoredObject>;
	readonly ofType: (type: string) => readonly StoredObject[];
	readonly events: readonly StoredEvent[];
	readonly eventsOfType: (type: string) => readonly StoredEvent[];
	readonly completionOf: ReadonlyMap<string, StoredEvent>;
	/** ⭐ P7-6 B7 — each aggregate's correlation: its first event's that carries one (a floor run's token, for a review). */
	readonly correlationOf: ReadonlyMap<string, string>;
	readonly criteriaOf: ReadonlyMap<string, readonly { criterionId: string; result: string }[]>;
	readonly observationsOf: ReadonlyMap<string, readonly { code: string; severity: string }[]>;
	readonly content: ReadonlyMap<string, StoredContent> | null;
}

/** `map[key]`, with `value` appended. */
function append<K, V>(map: Map<K, V[]>, key: K, value: V): void {
	const list = map.get(key);
	if (list === undefined) map.set(key, [value]);
	else list.push(value);
}

function indexOf(store: StoreRows): Index {
	const byType = new Map<string, StoredObject[]>();
	for (const o of store.objects) append(byType, o.objectType, o);
	for (const list of byType.values()) list.sort(bySequence);
	const events = [...store.events].sort((a, b) => a.sequence - b.sequence);
	const byEventType = new Map<string, StoredEvent[]>();
	const completionOf = new Map<string, StoredEvent>();
	const correlationOf = new Map<string, string>();
	const criteriaOf = new Map<string, { criterionId: string; result: string }[]>();
	const observationsOf = new Map<string, { code: string; severity: string }[]>();
	for (const e of events) {
		append(byEventType, e.eventType, e);
		if (str(e.correlationId) !== '' && !correlationOf.has(e.aggregateId)) correlationOf.set(e.aggregateId, str(e.correlationId));
		const assessmentId = str(e.payload.assessmentId);
		if (e.eventType === 'AssuranceAssessmentCompleted') completionOf.set(assessmentId || e.aggregateId, e);
		else if (e.eventType === 'AssuranceCriterionEvaluated')
			append(criteriaOf, assessmentId, { criterionId: str(e.payload.criterionId), result: str(e.payload.result) });
		else if (e.eventType === 'AssuranceObservationRecorded')
			append(observationsOf, assessmentId, { code: str(e.payload.findingCode), severity: str(e.payload.severity) });
	}
	return {
		byId: new Map(store.objects.map((o) => [o.id, o])),
		ofType: (type) => byType.get(type) ?? [],
		events,
		eventsOfType: (type) => byEventType.get(type) ?? [],
		completionOf,
		correlationOf,
		criteriaOf,
		observationsOf,
		content: store.content === null ? null : new Map(store.content.map((c) => [c.storageKey, c]))
	};
}

// ── THE LANE'S OWN RECORD (`lane/run.json`), read loosely: every field may be missing ────────────────────────────────

/** What the lane kept of one Begin & Execute: its answer, or — `timedOutAfterMs` set — that none came within the allowance. */
export interface LanePress {
	readonly status: number | null;
	readonly envelopeType: string | null;
	readonly timedOutAfterMs: number | null;
}

interface LaneUnit {
	readonly slug: string;
	readonly unitId: string | null;
	readonly beginExecute: LanePress | null;
	readonly stopped: boolean | null;
	readonly upstreamNotAssured: boolean | null;
	readonly limitPrior: number | null;
	readonly signOffAttempted: boolean;
	/**
	 * ⭐ E12's re-review F1 (D4) — the sign-off act that gave no answer within its bound, by its button's name, and the bound:
	 * the run ended there. null when none did, and for a record written before E12's re-review, which kept no act's bound.
	 */
	readonly signOffOutlasted: { readonly act: string; readonly ms: number } | null;
	/** ⭐ E12's re-review F1 (D4) — a recovery act the rule pressed gave no answer within its bound: the run ended there. */
	readonly recoveryOutlasted: boolean;
	/**
	 * ⭐ E12's polish (fix2's F8; the lead's delegated decision of 2026-10-15, to be registered) — WHAT THE LANE HELD BACK OF THE
	 * SIGN-OFF: before which act, why in the lane's own words (`notPressed`), and the limit check it read first — before Record
	 * Assurance (a dry run's rehearsal, `REG-D-112` (b), or the limit, D8), or before the rule's re-run of the declared reviews
	 * (the limit). null when it held nothing back, and for a record written before E12F, which kept no such field.
	 */
	readonly signOffHeldBack: {
		readonly before: string;
		readonly reason: string;
		readonly check: LaneLimitCheck | null;
	} | null;
	/** ⭐ E12's polish (the same decision) — every read of the limit the lane recorded for the unit, in the order it made them. */
	readonly limitChecks: readonly LaneLimitCheck[];
}

/**
 * ⭐ E12's polish (fix2's F8) — ONE READ OF THE LIMIT THE LANE RECORDED BEFORE A PAID ACT (D8; `E12F` F2): prior + recorded +
 * reserve + the act's own worst case (`ahead`, 0 where it counted none), and whether that total stayed under the limit — the
 * act pressed — or not, the act held back (`phase7-operator.ts` `limitCheck`).
 */
export interface LaneLimitCheck {
	readonly unit: string;
	/** What it was read before: the unit's Begin & Execute, a re-run of it, its sign-off, or a re-run of its declared reviews. */
	readonly before: string;
	readonly prior: number;
	readonly recorded: number;
	readonly reserve: number;
	readonly ahead: number;
	readonly total: number;
	readonly limit: number;
	readonly allowed: boolean;
}

/** A limit check the lane recorded, read loosely: null when it holds no total, limit or verdict to read. */
function laneLimitCheck(unit: string, before: string, v: unknown): LaneLimitCheck | null {
	const c = rec(v);
	const [prior, recorded, reserve, total, limit, allowed] = [int(c.prior), int(c.recorded), int(c.reserve), int(c.total), int(c.limit), bool(c.allowed)];
	if (prior === null || recorded === null || reserve === null || total === null || limit === null || allowed === null) return null;
	return { unit, before, prior, recorded, reserve, ahead: int(c.ahead) ?? 0, total, limit, allowed };
}

/** The rule's re-run a recovery act's limit check was read before, by its act. */
const RECOVERY_READ: Readonly<Record<string, string>> = {
	rerunReview: 'the rule’s re-run of its review',
	rerunWork: 'the rule’s re-run of its work'
};
/** ⭐ E12's polish — what a sign-off's hold, and its limit check, was read before. */
const BEFORE_RECORD_ASSURANCE = 'Record Assurance';
const BEFORE_DECLARED_RERUN = 'the rule’s re-run of its declared reviews';

/** ⭐ E12's re-review F1 — the sign-off's acts, by the field the lane records each in and the button's name. */
const SIGN_OFF_ACTS = [
	['recordAssurance', 'Record Assurance'],
	['rerunDeclared', 'Re-run the declared reviews'],
	['markSatisfied', 'Mark Satisfied']
] as const;

/** The sign-off act that outlasted its bound, and the bound, or null (`LaneUnit.signOffOutlasted`). */
function signOffOutlasted(signOff: Record<string, unknown>): LaneUnit['signOffOutlasted'] {
	for (const [field, act] of SIGN_OFF_ACTS) {
		const ms = int(rec(signOff[field]).timedOutAfterMs);
		if (ms !== null) return { act, ms };
	}
	return null;
}

function laneUnits(run: unknown): LaneUnit[] {
	const units = rec(run).units;
	return (Array.isArray(units) ? (units as unknown[]) : []).map((u) => {
		const r = rec(u);
		const pressed = r.beginExecute !== null && r.beginExecute !== undefined;
		const be = rec(r.beginExecute);
		const signOff = rec(r.signOff);
		return {
			slug: str(r.slug),
			unitId: str(r.unitId) || null,
			// ⛔ D4 — `timedOutAfterMs` IS KEPT: a press that outlasted its allowance ended the run there, and its unit's
			// archive was taken while the server was still running it (`phase7.live.ts`; `REG-F-527`).
			beginExecute: pressed
				? { status: int(be.status), envelopeType: str(be.envelopeType) || null, timedOutAfterMs: int(be.timedOutAfterMs) }
				: null,
			stopped: bool(r.stopped),
			upstreamNotAssured: bool(r.upstreamNotAssured),
			limitPrior: int(rec(r.limitCheck).prior),
			// ⛔ `E12F` F1, F2 — a sign-off the lane HELD BACK before Record Assurance (a dry run's, `REG-D-112` (b), or the
			// limit's, D8) records why in `notPressed` and pressed nothing: never attempted. One whose Record Assurance was
			// pressed was attempted, whatever was held back after it. ⚠ A record written before E12F carries no such field.
			signOffAttempted:
				r.signOff !== null &&
				r.signOff !== undefined &&
				(str(signOff.notPressed) === '' || (signOff.recordAssurance ?? null) !== null),
			signOffOutlasted: signOffOutlasted(signOff),
			recoveryOutlasted: (Array.isArray(r.recovery) ? (r.recovery as unknown[]) : []).some(
				(x) => int(rec(x).timedOutAfterMs) !== null
			),
			signOffHeldBack: heldBackOf(str(r.slug), signOff),
			limitChecks: limitChecksOf(str(r.slug), r, signOff)
		};
	});
}

/**
 * ⭐ E12's polish (fix2's F8) — the sign-off's hold, from its record (`LaneUnit.signOffHeldBack`): with Record Assurance
 * pressed, what the lane held back was the rule's re-run of the declared reviews, read before it; else the sign-off itself.
 */
function heldBackOf(slug: string, signOff: Record<string, unknown>): LaneUnit['signOffHeldBack'] {
	const reason = str(signOff.notPressed);
	if (reason === '') return null;
	if ((signOff.recordAssurance ?? null) !== null)
		return { before: BEFORE_DECLARED_RERUN, reason, check: laneLimitCheck(slug, BEFORE_DECLARED_RERUN, signOff.rerunLimitCheck) };
	return { before: BEFORE_RECORD_ASSURANCE, reason, check: laneLimitCheck(slug, 'its sign-off', signOff.limitCheck) };
}

/** ⭐ E12's polish (fix2's F8) — every read of the limit the lane recorded for one unit, in its order (`LaneUnit.limitChecks`). */
function limitChecksOf(slug: string, r: Record<string, unknown>, signOff: Record<string, unknown>): LaneLimitCheck[] {
	const recovery = Array.isArray(r.recovery) ? (r.recovery as unknown[]) : [];
	return [
		laneLimitCheck(slug, 'its Begin & Execute', r.limitCheck),
		...recovery.map((x) => laneLimitCheck(slug, RECOVERY_READ[str(rec(x).act)] ?? `the rule’s ${str(rec(x).act)}`, rec(x).limitCheck)),
		laneLimitCheck(slug, 'its sign-off', signOff.limitCheck),
		laneLimitCheck(slug, BEFORE_DECLARED_RERUN, signOff.rerunLimitCheck)
	].filter((c): c is LaneLimitCheck => c !== null);
}

// ── THE UNITS ────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Unit extends UnitSpec {
	readonly object: StoredObject | null;
	readonly lane: LaneUnit | null;
	readonly plan: StoredObject | null;
	readonly tries: readonly StoredObject[];
	readonly artifacts: readonly StoredObject[];
	readonly evidence: readonly StoredObject[];
}

/** What stage 2 measures: a unit per type, none twice, each phase a child of the root. */
interface UnitStructure {
	readonly missing: readonly string[];
	readonly duplicated: readonly string[];
	readonly orphaned: readonly string[];
}

/** The run's Undertaking: the one the lane's units belong to, else the store's only one. */
function undertakingOf(ix: Index, lane: readonly LaneUnit[], problems: string[]): string | null {
	const named = new Set(lane.map((u) => u.unitId).filter((id): id is string => id !== null));
	const owners = [...new Set([...named].map((id) => str(ix.byId.get(id)?.state.undertakingId)).filter((o) => o !== ''))];
	if (owners.length === 1) return owners[0]!;
	if (owners.length > 1) {
		problems.push(`lane/run.json names units of ${owners.length} Undertakings`);
		return null;
	}
	const undertakings = ix.ofType('UNDERTAKING');
	if (undertakings.length === 1) return undertakings[0]!.id;
	problems.push(`the store holds ${undertakings.length} Undertakings and lane/run.json names none of their units`);
	return null;
}

/** One unit of the run, with what the record holds of it. */
function unitOf(ix: Index, spec: UnitSpec, undertakingId: string | null, lane: readonly LaneUnit[], problems: string[]) {
	const laneUnit = lane.find((u) => u.slug === spec.slug) ?? null;
	const candidates = ix
		.ofType('PROFESSIONAL_WORK_UNIT')
		.filter((p) => str(p.state.undertakingId) === undertakingId && str(p.state.title) === spec.type.name);
	if (candidates.length > 1)
		problems.push(`${candidates.length} work units are titled "${spec.type.name}" in the Undertaking: a re-proposal`);
	const named = laneUnit?.unitId ? candidates.find((p) => p.id === laneUnit.unitId) : undefined;
	const object = named ?? candidates[0] ?? null;
	if (laneUnit?.unitId && object?.id !== laneUnit.unitId)
		problems.push(`lane/run.json's ${spec.slug} unit is not the store's "${spec.type.name}" unit`);
	const id = object?.id;
	const plans = ix.ofType('EXECUTION_PLAN').filter((p) => id !== undefined && str(p.state.workUnitId) === id);
	// ⭐⭐ `JAN-EXEC` P7-6 B5 (the roadmap's B8) — A PERSON'S RE-RUN IS A PLAN REVISION, NOT A SECOND BEGIN (RD5): it proposes
	// plan B and supersedes the refused plan A citing it. ⛔ Counted as plans, every recovered unit read "begun more than
	// once". So the plans a supersession NAMES as successor are the re-runs' own, and only the rest were begun. ⭑ Read from
	// `ExecutionPlanSuperseded.supersedingExecutionPlanId` (RD10: no `ReviseExecutionPlan` exists, and the plan's own state
	// does not keep the successor) — never from plan count or order.
	const successors = new Set(
		ix
			.eventsOfType('ExecutionPlanSuperseded')
			.filter((e) => plans.some((p) => p.id === e.aggregateId))
			.map((e) => str(e.payload.supersedingExecutionPlanId))
	);
	const begun = plans.filter((p) => !successors.has(p.id));
	if (begun.length > 1)
		problems.push(`the ${spec.slug} unit has ${begun.length} execution plans: it was begun more than once`);
	const unit: Unit = {
		...spec,
		object,
		lane: laneUnit,
		plan: plans.at(-1) ?? null,
		tries: ix
			.ofType('MODEL_EXCHANGE')
			.filter((x) => id !== undefined && str(x.state.plane) === 'EXECUTION' && str(x.state.subjectObjectId) === id),
		artifacts: ix.ofType('ARTIFACT').filter((a) => id !== undefined && str(a.state.producingPwuId) === id),
		evidence: ix.ofType('EVIDENCE').filter((e) => id !== undefined && str(e.state.scope) === `${EVIDENCE_SCOPE_PREFIX}${id}`)
	};
	return { unit, duplicated: candidates.length > 1 };
}

function resolveUnits(
	ix: Index,
	lane: readonly LaneUnit[],
	problems: string[]
): { undertakingId: string | null; units: Unit[]; structure: UnitStructure } {
	const undertakingId = undertakingOf(ix, lane, problems);
	const resolved = PHASE7_UNITS.map((spec) => unitOf(ix, spec, undertakingId, lane, problems));
	const units = resolved.map((r) => r.unit);
	const root = units[0]!.object;
	const orphaned = units
		.slice(1)
		.filter((u) => u.object !== null && root !== null && str(u.object.state.parentWorkUnitId) !== root.id)
		.map((u) => u.slug);
	for (const slug of orphaned) problems.push(`the ${slug} unit is not a child of the root`);
	return {
		undertakingId,
		units,
		structure: {
			missing: units.filter((u) => u.object === null).map((u) => u.slug),
			duplicated: resolved.filter((r) => r.duplicated).map((r) => r.unit.slug),
			orphaned
		}
	};
}

/** The id of the unit a floor subject belongs to: a work product's producing unit, a command's by its scope. */
function ownerOf(subject: StoredObject): string {
	if (subject.objectType === 'ARTIFACT') return str(subject.state.producingPwuId);
	// ⭐ E2 — a declared review's subject is the work unit itself: its calls are that unit's.
	if (subject.objectType === 'PROFESSIONAL_WORK_UNIT') return subject.id;
	const scope = str(subject.state.scope);
	return scope.startsWith(EVIDENCE_SCOPE_PREFIX) ? scope.slice(EVIDENCE_SCOPE_PREFIX.length) : '';
}

/** The slug of the unit a floor subject belongs to, or null. */
function unitOfSubject(ix: Index, units: readonly Unit[], subjectId: string): string | null {
	const subject = ix.byId.get(subjectId);
	if (subject === undefined) return null;
	const owner = ownerOf(subject);
	return units.find((u) => u.object !== null && u.object.id === owner)?.slug ?? null;
}

/** Each floor policy's latest assessment of `subjectId`, by policy, in plan order — MISSING where there is none. */
function floorOf(ix: Index, subjectId: string): { policyId: string; state: string }[] {
	const mine = ix.ofType('ASSURANCE_ASSESSMENT').filter((a) => strs(a.state.subjectObjectIds)[0] === subjectId);
	return FLOOR_POLICIES.map((policyId) => {
		const latest = mine.filter((a) => str(a.state.assurancePolicyId) === policyId).at(-1);
		return { policyId, state: latest === undefined ? 'MISSING' : str(latest.state.assessmentState) };
	});
}

// ── THE PAIRING (§2 stage 8; `REG-F-433`) ────────────────────────────────────────────────────────────────────────────

export const PAIRING_RULE =
	'A Reasoning Review of an execution-plane subject is paired with the ASSURANCE-plane, floor.reasoning-review exchanges ' +
	'its own floor run made, joined by that run’s token: the review’s assessment carries it as its correlation, and each ' +
	'call as its runToken (REG-F-433). The call with the highest attemptOrdinal among them concluded the review — save a ' +
	'P7-6 I5 chain, a reply that parsed and answered no criterion, whose one criterion repair answered none, did not parse ' +
	'or got no reply: that first reply concluded it (REG-F-552). A record that carries no token, a run’s before the key, ' +
	'is paired by its subject, and only while that subject had exactly one floor run no token names: its ordinals restart ' +
	'at 1 in each run. A deterministic floor policy and every sign-off make no model call, by design.';

const callOf = (x: StoredObject): string => `${str(x.state.exchangeRole)}:${str(x.state.disposition)}`;
const ordinalOf = (x: StoredObject): number => int(x.state.attemptOrdinal) ?? 0;
const runOf = (x: StoredObject): string => str(x.state.runToken);

type Pairing = Pick<PairingRow, 'label' | 'refusal' | 'detail' | 'joinedBy' | 'floorRuns' | 'concludedBy' | 'calls'>;
type Conclusion = Pick<Pairing, 'label' | 'refusal' | 'detail' | 'concludedBy'>;

/** What the call that concluded a review says of it, by its disposition. */
function concludedBy(top: StoredObject): Conclusion {
	const role = str(top.state.exchangeRole);
	const disposition = str(top.state.disposition);
	if (disposition === 'ACCEPTED') return { label: 'answered', detail: `concluded by its ${role} call`, concludedBy: top.id };
	if (disposition === 'NO_RESPONSE')
		return {
			label: 'no-response',
			detail:
				role === 'RETRY'
					? 'both calls threw: the call and its one retry (REG-D-102)'
					: `its ${role} call threw and was not run again — at or past its tool's bound, or under a tool that declares none`,
			concludedBy: top.id
		};
	if (disposition === 'REJECTED') {
		// A substitute is refused before any parse (`reasoning-review-validator.ts`, `timed`); a failed repair after one.
		const substitute = str(rec(top.state.parseOutcome).outcome) === 'NOT_ATTEMPTED';
		return {
			label: 'refused',
			refusal: substitute ? 'substitute' : 'failed-repair',
			detail: substitute
				? `its ${role} call was answered by a model other than the one configured, and refused unread`
				: `its ${role} call's reply could not be read after its repair`,
			concludedBy: top.id
		};
	}
	return {
		label: 'no-answer-recorded',
		detail: `its last recorded call is ${role}:${disposition}, which concludes no review: the call that concluded it is not in the record`,
		concludedBy: null
	};
}

/**
 * ⭐⭐ `JAN-EXEC` P7-6 B2 (the fix round) — A P7-6 I5 CHAIN, READ AS IT CONCLUDED (`DESIGN-the-reviewer-isolated.md` §4d;
 * `REG-F-552`), or undefined for any other chain. I5 repairs a reply that PARSED and answered no criterion, once, and the
 * repair may only ADD a conclusion: answering, it concludes the review; answering none, not parsing, or getting no reply,
 * the review keeps the FIRST reply's judgement — while the record ENDS on the repair.
 * ⛔ READ BY "THE HIGHEST ORDINAL CONCLUDED IT", such a chain was a FAILED REPAIR (`REG-F-489`/`428`/`479`) or a NO RESPONSE
 * (`REG-F-499`) concluded by the repair — a review the record shows concluded on its first reply.
 * ⭑ TOLD BY THE VALIDATOR'S OWN MARKER (`NO_CRITERION_ANSWERED`, `p76-fix-c` C1), which OPENS E-5's detail beside the
 * outcome `SCHEMA_COERCION_FAILED` (`i5Marked`): on the first reply that got one (the call's, or its retry's after a throw),
 * recorded `REPAIR_REQUESTED`, it is the I5 repair-request — never the outcome alone, which a JSON repair's first reply can
 * carry too. On the repair, recorded `REJECTED`, the same pair says it answered none either; a repair refused with any
 * other outcome (or without the marker) did not parse; one recorded `NO_RESPONSE` got no reply.
 * ⛔ B2 told the last two apart by whether the repair's detail held the request's CLOSING sentence, which `P76F-A` A2
 * removed from a refused repair's record on purpose — so a repair that parsed and answered none read "did not parse".
 * ⚠ Undefined — the general reading stands — when the repair is not in the record (nothing concluded it there), or was
 * refused for WHO answered it: a substitute fails the review wherever it answers.
 */
function criterionRepairConclusion(sorted: readonly StoredObject[]): Conclusion | undefined {
	// ⭐ C1 — the I5 pair, both halves: the outcome AND the marker opening the detail (the validator writes both, together).
	const i5Marked = (x: StoredObject | undefined): boolean =>
		str(rec(x?.state.parseOutcome).outcome) === 'SCHEMA_COERCION_FAILED' &&
		str(rec(x?.state.parseOutcome).detail).startsWith(NO_CRITERION_ANSWERED);
	const asked = sorted.find((x) => str(x.state.disposition) !== 'NO_RESPONSE');
	if (asked === undefined || str(asked.state.disposition) !== 'REPAIR_REQUESTED' || !i5Marked(asked)) return undefined;
	const after = sorted.filter((x) => ordinalOf(x) > ordinalOf(asked));
	const answered = after.find((x) => str(x.state.disposition) === 'ACCEPTED');
	if (answered !== undefined)
		return {
			label: 'answered',
			detail: `concluded by its ${str(answered.state.exchangeRole)} call, the criterion repair of a reply that answered no criterion (REG-F-552)`,
			concludedBy: answered.id
		};
	const last = after.at(-1);
	const repairEnded = str(last?.state.disposition);
	let how: string;
	if (repairEnded === 'NO_RESPONSE') how = 'got no reply';
	else if (repairEnded === 'REJECTED' && str(rec(last?.state.parseOutcome).outcome) !== 'NOT_ATTEMPTED')
		how = i5Marked(last) ? 'answered none either' : 'did not parse';
	else return undefined;
	return {
		label: 'no-criterion-answered',
		detail:
			`its ${str(asked.state.exchangeRole)} reply answered no criterion, and its criterion repair ${how} (REG-F-552): ` +
			"the review kept that reply's judgement, its recommendation recorded (REG-D-090)",
		concludedBy: asked.id
	};
}

/** ⭐ The pairing of calls already known to be ONE run's: the call that concluded the review (see `PAIRING_RULE`). */
function concludedFrom(
	sorted: readonly StoredObject[],
	o: { readonly joinedBy: Pairing['joinedBy']; readonly floorRuns: number; readonly calls: readonly string[] }
): Pairing {
	const unpaired = (label: PairingLabel, detail: string): Pairing => ({ label, detail, ...o, concludedBy: null });
	const top = sorted.at(-1);
	if (top === undefined) return unpaired('no-answer-recorded', 'no ASSURANCE-plane exchange names the subject (REG-F-525)');
	if (sorted.filter((x) => ordinalOf(x) === ordinalOf(top)).length > 1)
		return unpaired('not-pairable', `two of the subject's calls share its highest ordinal, ${ordinalOf(top)}`);
	return { ...(criterionRepairConclusion(sorted) ?? concludedBy(top)), ...o };
}

/**
 * ⭐ One Reasoning Review of `subjectId` whose record carries NO run token — a run's before `REG-F-433`'s key — paired by
 * its subject: only while the subject had exactly one floor run (see `PAIRING_RULE`).
 */
export function pairReview(subjectId: string, reviewsOfSubject: number, exchanges: readonly StoredObject[]): Pairing {
	const sorted = [...exchanges].sort((a, b) => ordinalOf(a) - ordinalOf(b));
	const calls = sorted.map(callOf);
	// ⛔ THREE WITNESSES OF A SECOND RUN, and any one is enough: a second review recorded on the subject, a second runToken
	// among its calls, or a second call at ordinal 1 — the validator's counter restarts with every floor run.
	const floorRuns = Math.max(
		reviewsOfSubject,
		new Set(exchanges.map(runOf)).size,
		exchanges.filter((x) => ordinalOf(x) === 1).length
	);
	if (floorRuns > 1)
		return {
			label: 'not-pairable',
			detail: `the subject ${subjectId} had ${floorRuns} floor runs, and no recorded key joins a review to its own run's calls (REG-F-433)`,
			joinedBy: 'subject',
			floorRuns,
			concludedBy: null,
			calls
		};
	return concludedFrom(sorted, { joinedBy: 'subject', floorRuns, calls });
}

/**
 * ⭐⭐ `JAN-EXEC` P7-6 B7 — ONE REVIEW, JOINED TO THE CALLS ITS OWN FLOOR RUN MADE, by the token the run's assessment carries
 * as its correlation and its calls as their `runToken` (`REG-F-433`'s key; `floor-over-subject.ts`, `floor.ts`). ⛔ Its
 * subject may have had other runs — a re-review is one — and none of their calls is this review's.
 * ⚠ Two calls at ordinal 1 under one token would be two runs sharing it, which the floor never mints: not pairable, said so.
 */
export function pairRun(token: string, exchanges: readonly StoredObject[]): Pairing {
	const sorted = [...exchanges].sort((a, b) => ordinalOf(a) - ordinalOf(b));
	const calls = sorted.map(callOf);
	const firsts = sorted.filter((x) => ordinalOf(x) === 1).length;
	if (firsts > 1)
		return {
			label: 'not-pairable',
			detail: `${firsts} calls at ordinal 1 carry the one floor-run token ${token}: two runs share it`,
			joinedBy: 'run token',
			floorRuns: firsts,
			concludedBy: null,
			calls
		};
	return concludedFrom(sorted, { joinedBy: 'run token', floorRuns: 1, calls });
}

/**
 * ⭐⭐ P7-6 B7 — ONE REVIEW'S PAIRING, AMONG ITS SUBJECT'S REVIEWS AND CALLS (`PAIRING_RULE`):
 *   · its token names calls → those calls, and no other run's (`pairRun`);
 *   · its token names none, and every call of the subject is another review's by token → its run recorded no call;
 *   · ⛔ otherwise the SUBJECT RULE, over the reviews whose token names no call and the calls no review's token names — a
 *     record from before the key keeps exactly the refusal it had (`pairReview`): honest, never paired on a guess.
 */
function pairingOf(ix: Index, review: StoredObject, reviewsOfSubject: readonly StoredObject[], calls: readonly StoredObject[]): Pairing {
	const subjectId = strs(review.state.subjectObjectIds)[0] ?? '';
	const tokenOf = (a: StoredObject): string => ix.correlationOf.get(a.id) ?? '';
	const token = tokenOf(review);
	const own = token === '' ? [] : calls.filter((x) => runOf(x) === token);
	if (own.length > 0) return pairRun(token, own);
	const named = new Set(reviewsOfSubject.map(tokenOf).filter((t) => t !== '' && calls.some((x) => runOf(x) === t)));
	const loose = calls.filter((x) => !named.has(runOf(x)));
	if (token !== '' && loose.length === 0)
		return {
			label: 'no-answer-recorded',
			detail: `no call is recorded under its floor run's token, and every call of its subject is another review's (REG-F-525)`,
			joinedBy: 'run token',
			floorRuns: 1,
			concludedBy: null,
			calls: []
		};
	return pairReview(subjectId, reviewsOfSubject.filter((r) => !named.has(tokenOf(r))).length, loose);
}

/** Why an assessment other than a Reasoning Review asked no model: what made it. */
function noModelKind(policyId: string, validatorId: string): NoModelAnswerKind {
	if (policyId.startsWith('floor.')) return 'deterministic floor policy';
	if (validatorId === DECLARED_SIGNOFF_VALIDATOR) return 'declared-policy sign-off';
	if (policyId === DEMO_POLICY_ID) return 'demo sign-off';
	return 'other';
}

/** One Reasoning Review's row, or undefined when its subject is not on the execution plane. */
function reviewRow(
	ix: Index,
	units: readonly Unit[],
	a: StoredObject,
	reviewsOf: ReadonlyMap<string, readonly StoredObject[]>,
	exchangesOf: ReadonlyMap<string, readonly StoredObject[]>
): PairingRow | undefined {
	const subjects = strs(a.state.subjectObjectIds);
	const subjectId = subjects[0] ?? '';
	const subjectType = ix.byId.get(subjectId)?.objectType;
	if (subjectType !== 'ARTIFACT' && subjectType !== 'EVIDENCE') return undefined;
	const pairing: Pairing =
		subjects.length === 1
			? pairingOf(ix, a, reviewsOf.get(subjectId) ?? [], exchangesOf.get(subjectId) ?? [])
			: {
					label: 'not-pairable',
					detail: `the review names ${subjects.length} subjects`,
					joinedBy: 'subject',
					floorRuns: 0,
					concludedBy: null,
					calls: []
				};
	return {
		assessmentId: a.id,
		subjectId,
		subjectKind: subjectType === 'ARTIFACT' ? 'work product' : 'command',
		unit: unitOfSubject(ix, units, subjectId),
		assessmentState: str(a.state.assessmentState),
		...pairing
	};
}

function buildPairing(ix: Index, units: readonly Unit[]): PairingReport {
	const assessments = ix.ofType('ASSURANCE_ASSESSMENT');
	const reviews = assessments.filter((a) => str(a.state.assurancePolicyId) === REASONING_REVIEW);
	const exchangesOf = new Map<string, StoredObject[]>();
	for (const x of ix.ofType('MODEL_EXCHANGE'))
		if (str(x.state.plane) === 'ASSURANCE' && str(x.state.assurancePolicyId) === REASONING_REVIEW)
			append(exchangesOf, str(x.state.subjectObjectId), x);
	const reviewsOf = new Map<string, StoredObject[]>();
	for (const r of reviews) append(reviewsOf, strs(r.state.subjectObjectIds)[0] ?? '', r);
	const rows: PairingRow[] = [];
	const outside: string[] = [];
	for (const a of reviews) {
		const row = reviewRow(ix, units, a, reviewsOf, exchangesOf);
		if (row === undefined) outside.push(a.id);
		else rows.push(row);
	}
	const noModel: Record<NoModelAnswerKind, string[]> = {
		'deterministic floor policy': [],
		'declared-policy sign-off': [],
		'demo sign-off': [],
		other: []
	};
	for (const a of assessments) {
		const validatorId = str(ix.completionOf.get(a.id)?.payload.validatorId);
		// ⭐ E2 — a declared review ASKED a reviewer: it is listed with the declared verdicts, its calls counted there, and
		// never as an assessment that asked no model by design.
		if ((DECLARED_REVIEW_VALIDATORS as readonly string[]).includes(validatorId)) continue;
		if (str(a.state.assurancePolicyId) !== REASONING_REVIEW)
			noModel[noModelKind(str(a.state.assurancePolicyId), validatorId)].push(a.id);
	}
	const counts = Object.fromEntries(PAIRING_LABELS.map((l) => [l, rows.filter((r) => r.label === l).length]));
	return {
		rule: PAIRING_RULE,
		rows,
		counts: counts as Record<PairingLabel, number>,
		noModelAnswerByDesign: noModel,
		outsideTheExecutionPlane: outside
	};
}

// ── REVIEWER CALLS (design D8) ───────────────────────────────────────────────────────────────────────────────────────

function countCalls(calls: readonly StoredObject[]): ReviewerCallCount {
	return {
		recorded: calls.length,
		noResponse: calls.filter((x) => str(x.state.disposition) === 'NO_RESPONSE').length,
		retries: calls.filter((x) => str(x.state.exchangeRole) === 'RETRY').length,
		repairs: calls.filter((x) => str(x.state.exchangeRole) === 'REPAIR').length
	};
}

/** The operator's count of calls spent before the run (P7-3a's): as the lane checked it, else as the environment gave it. */
function priorSpend(lane: LaneRows): number | null {
	const checked = laneUnits(lane.run)
		.map((u) => u.limitPrior)
		.filter((p): p is number => p !== null);
	const given = str(rec(rec(lane.boot).inherited)[PHASE7_PRIOR_CALLS_VARIABLE]).trim();
	return checked.at(-1) ?? (/^\d+$/.test(given) ? Number(given) : null);
}

function buildReviewerCalls(ix: Index, units: readonly Unit[], lane: LaneRows): ReviewerCalls {
	const calls = ix.ofType('MODEL_EXCHANGE').filter((x) => str(x.state.plane) === 'ASSURANCE');
	const byUnit: Record<string, ReviewerCallCount> = {};
	for (const slug of [...units.map((u) => u.slug), 'unattributed'])
		byUnit[slug] = countCalls(
			calls.filter((x) => (unitOfSubject(ix, units, str(x.state.subjectObjectId)) ?? 'unattributed') === slug)
		);
	const prior = priorSpend(lane);
	const total = prior === null ? null : prior + calls.length + NEGATIVE_CONTROL_RESERVE;
	return {
		...countCalls(calls),
		lowerBound: true,
		byUnit,
		limit: {
			prior,
			recorded: calls.length,
			reserve: NEGATIVE_CONTROL_RESERVE,
			total,
			limit: PAID_LIMIT,
			under: total === null ? null : total < PAID_LIMIT
		},
		laneLimitChecks: laneUnits(lane.run).flatMap((u) => u.limitChecks)
	};
}

// ── THE AUDIT (P7-3) ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The `ui-<n>` command that follows `commandId` in one batch, or undefined for an id of another form. */
function nextUiCommand(commandId: string | null): string | undefined {
	const m = /^ui-(\d+)$/.exec(commandId ?? '');
	return m ? `ui-${Number(m[1]) + 1}` : undefined;
}

/** Whether `next` is the unit's execution hop to SUCCEEDED, citing `planId`, from the next command of one batch. */
function isSameBatchHop(success: StoredEvent, next: StoredEvent | undefined, unitId: string | null): boolean {
	return (
		next?.eventType === 'PwuStateChanged' &&
		next.aggregateId === unitId &&
		next.commandId !== null &&
		next.commandId === nextUiCommand(success.commandId) &&
		str(next.payload.previousState) === 'EXECUTING' &&
		str(next.payload.newState) === 'EXECUTING' &&
		str(next.payload.executionState) === 'SUCCEEDED' &&
		strs(next.payload.supportingObjectIds).includes(success.aggregateId)
	);
}

/** How a step success that is not Begin & Execute's reads — its shape, never the operator's free text. */
function describeSuccess(model: boolean, root: boolean, by: Record<string, unknown>, outputs: number, detail: string): string {
	if (model) return "the model path's shape";
	if (root) return "the root path's shape";
	const named = str(by.actorId).startsWith('model:') ? ' named as a model' : '';
	const own = detail === OPERATOR_COMPLETION_DETAIL ? ", with the operator's own no-output detail" : '';
	return `executed by a ${str(by.actorType) || 'unnamed'} actor${named}, naming ${outputs} output(s)${own}`;
}

/**
 * ⭐⭐ WHETHER A STEP SUCCESS IS ONE OF BEGIN & EXECUTE'S TWO SHAPES — and so, if not, a hand completion (P7-3).
 *   · THE MODEL PATH: executed by `model:<id>`, an AGENT named 'Execution model', naming exactly its one work product;
 *   · THE ROOT'S MODEL-FREE PATH: no output, with the TRANSFORMATION path's own detail;
 * ⛔ EACH COMMITTED IN ONE BATCH WITH THE UNIT'S EXECUTION HOP TO SUCCEEDED, citing the plan — the next event, from the
 * next command of the batch. ⚠ The page's `completeStep` can name ONE output under the operator's own HUMAN identity
 * and carry neither marker the first maps listed (the critic's correction), so the test is for Begin & Execute's
 * shapes, never for the hand's.
 */
export function stepSuccessShape(
	success: StoredEvent,
	next: StoredEvent | undefined,
	unitId: string | null
): { readonly beginExecute: boolean; readonly why: string } {
	const p = success.payload;
	const by = rec(rec(p.executionProvenance).executedBy);
	const outputs = strs(p.outputArtifactIds);
	const detail = str(rec(p.noOutputResult).detail);
	const model =
		str(by.actorId).startsWith('model:') &&
		str(by.actorType) === 'AGENT' &&
		str(by.displayName) === MODEL_EXECUTOR_NAME &&
		outputs.length === 1 &&
		p.noOutputResult === undefined;
	const root = detail === ROOT_COMPLETION_DETAIL && outputs.length === 0 && strs(p.proposedEvidenceIds).length === 0;
	const hop = isSameBatchHop(success, next, unitId);
	if ((model || root) && hop) return { beginExecute: true, why: model ? 'the model path' : "the root's model-free path" };
	const shape = describeSuccess(model, root, by, outputs.length, detail);
	const batch = hop ? 'with' : 'without';
	return {
		beginExecute: false,
		why: `${shape}, ${batch} the same-batch execution hop to SUCCEEDED — not one of Begin & Execute's two shapes`
	};
}

/** A POST's action: as the lane named it, else the `?/<action>` its URL ends in. */
const actionOf = (p: PostLine): string => str(p.action) || (/\?\/(\w+)$/.exec(str(p.url))?.[1] ?? '');

/** The POSTs of `actions` in `posts.jsonl` (optionally only on a page whose URL holds `page`), or null when absent. */
function posted(lane: LaneRows, actions: readonly string[], page?: string): number | null {
	if (lane.posts === undefined) return null;
	return lane.posts.filter((p) => actions.includes(actionOf(p)) && (page === undefined || str(p.url).includes(page)))
		.length;
}

/** `<NN>-<slug>` of an action file's name: the unit it was pressed on. */
const actionUnit = (file: string): string =>
	/^(\d{2}-[a-z-]+?)-[a-zA-Z]+\.json$/.exec(file.split(/[\\/]/).at(-1) ?? '')?.[1] ?? '';

/** The audit's view of the run: who each event belongs to. */
interface AuditView {
	readonly ix: Index;
	readonly unitOfPlan: (planId: string) => Unit | undefined;
	readonly unitOfObject: (id: string) => string | null;
}

const findingOf = (e: StoredEvent, unit: string | null, why: string): AuditFinding => ({
	sequence: e.sequence,
	eventType: e.eventType,
	aggregateId: e.aggregateId,
	unit,
	why
});

function act(
	name: string,
	forbidden: boolean,
	found: readonly AuditFinding[],
	posts: number | null,
	o: { readonly auditable?: boolean; readonly note?: string } = {}
): AuditAct {
	const auditable = o.auditable ?? true;
	let verdict: AuditAct['verdict'] = auditable ? 'none' : 'not auditable from the log';
	if (found.length > 0 || (posts ?? 0) > 0) verdict = 'FOUND';
	return { act: name, forbidden, auditable, found, posted: posts, verdict, ...(o.note ? { note: o.note } : {}) };
}

/** 1. Every step success that is not one of Begin & Execute's two shapes: a hand completion. */
function handCompletions(v: AuditView): AuditFinding[] {
	const found: AuditFinding[] = [];
	v.ix.events.forEach((e, i) => {
		if (e.eventType !== 'ExecutionStepSucceeded') return;
		const unit = v.unitOfPlan(e.aggregateId);
		const shape = stepSuccessShape(e, v.ix.events[i + 1], unit?.object?.id ?? null);
		if (!shape.beginExecute) found.push(findingOf(e, unit?.slug ?? null, shape.why));
	});
	return found;
}

/** 5. Every SATISFIED that no Record Assurance hop on its unit came before: Mark Satisfied without Record Assurance. */
function unassuredSatisfactions(v: AuditView): AuditFinding[] {
	const hops = v.ix
		.eventsOfType('PwuStateChanged')
		.filter(
			(r) =>
				str(r.payload.previousState) === 'UNDER_ASSURANCE' &&
				str(r.payload.newState) === 'UNDER_ASSURANCE' &&
				str(r.payload.assuranceState) === 'SATISFIED' &&
				strs(r.payload.supportingObjectIds).length > 0
		);
	return v.ix
		.eventsOfType('PwuStateChanged')
		.filter((e) => str(e.payload.newState) === 'SATISFIED')
		.filter((e) => !hops.some((r) => r.sequence < e.sequence && r.aggregateId === e.aggregateId))
		.map((e) => findingOf(e, v.unitOfObject(e.aggregateId), 'SATISFIED with no Record Assurance hop before it'));
}

/** 6. Every PwuProposed in the run's Undertaking after the creation batch — whose proposals are one contiguous block. */
function reproposals(v: AuditView, undertakingId: string | null): AuditFinding[] {
	const first = v.ix.events.findIndex((e) => e.eventType === 'PwuProposed');
	let last = first;
	while (last >= 0 && v.ix.events[last + 1]?.eventType === 'PwuProposed') last += 1;
	const inTheRun = (e: StoredEvent) =>
		undertakingId === null || str(v.ix.byId.get(e.aggregateId)?.state.undertakingId) === undertakingId;
	return v.ix.events
		.filter((e, i) => e.eventType === 'PwuProposed' && (i < first || i > last) && inTheRun(e))
		.map((e) => findingOf(e, v.unitOfObject(e.aggregateId), 'a work unit proposed after the creation batch'));
}

/** Every start of a plan's step after its first: Begin & Execute starts its plan's one step once, in its own batch. */
function handStarts(v: AuditView): AuditFinding[] {
	const startsOf = new Map<string, number>();
	const found: AuditFinding[] = [];
	for (const e of v.ix.eventsOfType('ExecutionStepStarted')) {
		const n = (startsOf.get(e.aggregateId) ?? 0) + 1;
		startsOf.set(e.aggregateId, n);
		if (n > 1) found.push(findingOf(e, v.unitOfPlan(e.aggregateId)?.slug ?? null, `start ${n} of the plan's step`));
	}
	return found;
}

/** Evidence the evidence join did not propose: not the executing model's, or not a unit's commands. */
function handEvidence(v: AuditView): AuditFinding[] {
	return v.ix
		.eventsOfType('EvidenceProposed')
		.filter((e) => {
			const by = rec(e.payload.producedBy);
			const joined =
				str(e.payload.scope).startsWith(EVIDENCE_SCOPE_PREFIX) &&
				str(by.actorId).startsWith('model:') &&
				str(by.actorType) === 'AGENT';
			return !joined;
		})
		.map((e) => findingOf(e, null, "evidence the evidence join did not propose: not the executing model's, or not a unit's commands"));
}

/**
 * ⭐⭐ `JAN-EXEC` P7-6R R-1 — WHETHER A STEP'S WAIT OR CANCELLATION IS THE ROUTE'S OWN, NOT THE PAGE'S HAND ACT
 * (`DESIGN-the-stopped-unit-recovery.md` RD2, RD5; `REG-D-104` (1)). From R-1 the page's Wait and Cancel are no longer the
 * only emitters of their events:
 *   · the floor's refusal of a completion records a WAIT (RD2): `ExecutionStepWaiting`, then — the next command of the one
 *     batch — the unit's execution hop to WAITING, citing the plan;
 *   · a person's re-run supersedes the refused plan, then CANCELS its waiting step (RD5): `ExecutionPlanSuperseded` on the
 *     same plan is the command before the cancellation;
 *   · abandoning a waiting unit cancels its step, then abandons the unit: `PwuAbandoned` is the command after.
 * ⛔ TOLD APART BY THE BATCH, NEVER BY THE REASON'S PROSE — as `stepSuccessShape` reads a completion. A Wait or a Cancel
 * pressed by hand is a lone command, and is still found.
 */
function routesOwnStepAct(
	e: StoredEvent,
	prev: StoredEvent | undefined,
	next: StoredEvent | undefined,
	unitId: string | null
): boolean {
	const nextInBatch = (n: StoredEvent | undefined, type: string): boolean =>
		n?.eventType === type && n.aggregateId === unitId && n.commandId !== null && n.commandId === nextUiCommand(e.commandId);
	if (e.eventType === 'ExecutionStepWaiting')
		return (
			nextInBatch(next, 'PwuStateChanged') &&
			str(next?.payload.executionState) === 'WAITING' &&
			strs(next?.payload.supportingObjectIds).includes(e.aggregateId)
		);
	if (e.eventType === 'ExecutionStepCancelled')
		return (
			(prev?.eventType === 'ExecutionPlanSuperseded' &&
				prev.aggregateId === e.aggregateId &&
				e.commandId !== null &&
				nextUiCommand(prev.commandId) === e.commandId) ||
			nextInBatch(next, 'PwuAbandoned')
		);
	return false;
}

/** The events of `type` that are hand acts: every one, save the route's own (`routesOwnStepAct`). */
function handEventsOf(v: AuditView, type: string): StoredEvent[] {
	const found: StoredEvent[] = [];
	v.ix.events.forEach((e, i) => {
		if (e.eventType !== type) return;
		const unitId = v.unitOfPlan(e.aggregateId)?.object?.id ?? null;
		if (!routesOwnStepAct(e, v.ix.events[i - 1], v.ix.events[i + 1], unitId)) found.push(e);
	});
	return found;
}

/**
 * ⭐ `E12F` F3 — THE OPTION A PERSON'S RE-RUN OF A UNIT'S DECLARED REVIEWS SELECTS (`declared-policy-signoff.ts`
 * `RERUN_DECLARED_REVIEWS`), restated — this report loads no product module — and held to its source by the restatement test.
 */
export const DECLARED_RERUN_OPTION = 'RERUN_DECLARED_REVIEWS';

/**
 * ⭐ `E12F` F3 (`REG-D-112` (a)) — EACH RE-RUN OF A UNIT'S DECLARED REVIEWS THAT DID NOT CONCLUDE, by its Decision: the unit, and
 * the INCONCLUSIVE assessments it re-ran. ⚠ No plan is revised (`reruns` reads one): each re-run is a new assessment.
 */
function declaredReruns(v: AuditView): AuditFinding[] {
	return v.ix
		.eventsOfType('DecisionEffective')
		.filter((e) => str(e.payload.decisionType) === 'REPLAN' && str(e.payload.selectedOption) === DECLARED_RERUN_OPTION)
		.map((e) => {
			const [unitId, ...rerun] = strs(e.payload.subjectObjectIds);
			return findingOf(
				e,
				v.unitOfObject(unitId ?? ''),
				`a person’s re-run of the declared reviews that did not conclude: ${plural(rerun.length, 'assessment', 'assessments')} re-run`
			);
		});
}

/**
 * ⭐ P7-6R R-1c — THE PERSON'S RE-RUNS, each an EFFECTIVE `REPLAN` Decision whose selected option names it (RD4). Listed
 * because each changes what the run measures, and none is forbidden: the paid run's rule makes them (`REG-D-105` (4)).
 * ⭐⭐ `JAN-EXEC` P7-6 B5 (the roadmap's B8) — AND EACH IS LISTED BESIDE THE DECISION THAT MADE IT: the finding is the
 * Decision, and its line names the re-run itself — the plan B the Decision's batch made, read from the supersession of the
 * refused plan it names (RD4: its subjects are the unit, then the refused plan; RD5: A superseded citing B, after the
 * Decision). ⛔ Listed as the Decision alone, a reader had the choice and not what it made. A Decision no revision follows
 * — the batch refused after it, which the route rolls back whole — is still listed, and says so.
 */
function reruns(v: AuditView, option: string, what: string): AuditFinding[] {
	return v.ix
		.eventsOfType('DecisionEffective')
		.filter((e) => str(e.payload.decisionType) === 'REPLAN' && str(e.payload.selectedOption) === option)
		.map((e) => {
			const [unitId, refusedPlan] = strs(e.payload.subjectObjectIds);
			const revision = v.ix
				.eventsOfType('ExecutionPlanSuperseded')
				.find((s) => s.sequence > e.sequence && s.aggregateId === refusedPlan);
			const made =
				revision === undefined
					? 'no plan revision follows it in the record'
					: `plan ${str(revision.payload.supersedingExecutionPlanId)}, superseding plan ${refusedPlan}`;
			return findingOf(e, v.unitOfObject(unitId ?? ''), `${what}: ${made}`);
		});
}

/** The hand acts each of whose events has the page's action as its only emitter — save the route's own R-1 acts. */
const PAGE_ONLY_ACTS: readonly (readonly [string, string])[] = [
	['cancelStep', 'ExecutionStepCancelled'],
	['pruneStep', 'ExecutionStepPruned'],
	['enterWaitStep', 'ExecutionStepWaiting'],
	['resolveWaitStep', 'ExecutionStepWaitResolved'],
	['cancelPlan', 'ExecutionTerminated'],
	['completePlan', 'ExecutionPlanCompleted'],
	['failPlan', 'ExecutionPlanFailed'],
	['admitEvidence', 'EvidenceAdmitted'],
	['submitEvidence', 'AssuranceEvidenceReceived'],
	['rejectPwu', 'PwuRejected']
];

/** P7-3's six forbidden acts, each confirmed from the log and reconciled with the lane's own POSTs. */
function forbiddenActs(v: AuditView, undertakingId: string | null, lane: LaneRows): AuditAct[] {
	const onPlan = (e: StoredEvent) => v.unitOfPlan(e.aggregateId)?.slug ?? null;
	const waivers = ['WaiverRequested', 'WaiverGranted', 'WaiverDenied'].flatMap((t) =>
		v.ix.eventsOfType(t).map((e) => findingOf(e, null, 'a waiver act'))
	);
	const waiverPosts = [posted(lane, ['recordWaiver']), posted(lane, ['grant', 'deny'], '/decisions')];
	// ⭐ `E12F` F3 — AND THE RULE'S ACCEPTED RE-RUN OF THE DECLARED REVIEWS THAT DID NOT CONCLUDE (`REG-D-112` (a)): the
	// assurance a Mark Satisfied may follow when Record Assurance was refused and its reviews then concluded.
	const assured = new Set(
		lane.actions
			.filter((a) => (a.action === 'recordAssurance' || a.action === 'rerunDeclaredReviews') && a.envelopeType === 'success')
			.map((a) => actionUnit(a.file))
	);
	const unassuredPresses = lane.actions.filter((a) => a.action === 'markSatisfied' && !assured.has(actionUnit(a.file)));
	const abandons = v.ix.eventsOfType('PwuAbandoned');
	return [
		act('completeStep', true, handCompletions(v), posted(lane, ['completeStep'])),
		act('skipStep', true, v.ix.eventsOfType('ExecutionStepSkipped').map((e) => findingOf(e, onPlan(e), 'a step skipped')), posted(lane, ['skipStep'])),
		act('retryStep', true, v.ix.eventsOfType('ExecutionStepRetried').map((e) => findingOf(e, onPlan(e), 'a failed step re-queued')), posted(lane, ['retryStep'])),
		act('waiver', true, waivers, waiverPosts.includes(null) ? null : waiverPosts.reduce<number>((n, p) => n + (p ?? 0), 0)),
		act('markSatisfied without recordAssurance', true, unassuredSatisfactions(v), unassuredPresses.length, {
			// ⭐ E12's re-review F6 — the note says what is counted: since `E12F` F3, an accepted re-run of the declared reviews
			// is the assurance a Mark Satisfied may follow too.
			note:
				'POSTs counted from lane/actions: a Mark Satisfied pressed on a unit with no accepted Record Assurance and no ' +
				'accepted re-run of its declared reviews (REG-D-112 (a))'
		}),
		act(
			'abandon followed by re-proposing',
			true,
			reproposals(v, undertakingId).filter((r) => abandons.some((a) => a.sequence < r.sequence)),
			null,
			{ note: 'the two acts are listed below, each on its own' }
		)
	];
}

/** The other hand acts, which change what the run measures though P7-3 does not name them. */
function otherActs(v: AuditView, undertakingId: string | null, lane: LaneRows): AuditAct[] {
	const onPlan = (e: StoredEvent) => v.unitOfPlan(e.aggregateId)?.slug ?? null;
	const fails = v.ix.eventsOfType('ExecutionStepFailed');
	return [
		act('abandonPwu', false, v.ix.eventsOfType('PwuAbandoned').map((e) => findingOf(e, v.unitOfObject(e.aggregateId), 'a work unit abandoned')), posted(lane, ['abandonPwu'])),
		act('proposePwu (re-proposal)', false, reproposals(v, undertakingId), posted(lane, ['proposePwu'])),
		act('startStep', false, handStarts(v), posted(lane, ['startStep'])),
		act(
			'failStep',
			false,
			fails
				.filter((e) => str(e.payload.failureReason) === OPERATOR_FAILURE_REASON)
				.map((e) => findingOf(e, onPlan(e), "the operator's own failure reason")),
			posted(lane, ['failStep']),
			{
				auditable: false,
				note:
					`${plural(fails.length, 'step failure', 'step failures')} in the log: Begin & Execute fails a step itself on ` +
					"three paths, so only the operator's default reason is told apart"
			}
		),
		act('rerunReview', false, reruns(v, 'RERUN_REVIEW', 'a person’s re-run of the review'), posted(lane, ['rerunReview'])),
		act('rerunWork', false, reruns(v, 'RERUN_WORK', 'a person’s re-run of the work'), posted(lane, ['rerunWork'])),
		// ⭐ `E12F` F3 — the rule's re-run of a unit's declared reviews that did not conclude (`REG-D-112` (a)).
		act('rerunDeclaredReviews', false, declaredReruns(v), posted(lane, ['rerunDeclaredReviews'])),
		...PAGE_ONLY_ACTS.map(([name, type]) =>
			act(name, false, handEventsOf(v, type).map((e) => findingOf(e, onPlan(e), type)), posted(lane, [name]))
		),
		act('proposeEvidence', false, handEvidence(v), posted(lane, ['proposeEvidence'])),
		act(
			'recordBlockingFinding',
			false,
			v.ix
				.eventsOfType('AssuranceObservationRecorded')
				.filter((e) => str(e.payload.findingCode) === DEMO_FINDING_CODE)
				.map((e) => findingOf(e, null, `a ${DEMO_FINDING_CODE} finding`)),
			posted(lane, ['recordBlockingFinding'])
		)
	];
}

function buildAudit(ix: Index, units: readonly Unit[], undertakingId: string | null, lane: LaneRows): AuditReport {
	const v: AuditView = {
		ix,
		unitOfPlan: (planId) => units.find((u) => u.object !== null && u.object.id === str(ix.byId.get(planId)?.state.workUnitId)),
		unitOfObject: (id) => units.find((u) => u.object?.id === id)?.slug ?? null
	};
	const acts = [...forbiddenActs(v, undertakingId, lane), ...otherActs(v, undertakingId, lane)];
	const demoPolicy = (type: string) => ix.eventsOfType(type).filter((e) => e.aggregateId === DEMO_POLICY_ID).length;
	const eventTypes: Record<string, number> = {};
	for (const e of ix.events) eventTypes[e.eventType] = (eventTypes[e.eventType] ?? 0) + 1;
	return {
		acts,
		forbiddenFound: acts.filter((a) => a.forbidden && a.verdict === 'FOUND').length,
		expected: [
			{
				act: 'CreateAssurancePolicy',
				count: demoPolicy('AssurancePolicyCreated'),
				note: `the demo policy ${DEMO_POLICY_ID}, created by the first Record Assurance: expected once, not an operator act`
			},
			{
				act: 'ActivateAssurancePolicy',
				count: demoPolicy('AssurancePolicyActivated'),
				note: 'the same policy, activated in the same batch: expected once'
			}
		],
		eventTypes: Object.fromEntries(Object.entries(eventTypes).sort(([a], [b]) => byCodeUnit(a, b)))
	};
}

// ── CONTENT (stage 8: can a person read what each model was asked and answered?) ─────────────────────────────────────

/** The refs a record makes of its content. ⛔ `volunteeredReasoningRef` is never read: it is `REG-Q-077`'s. */
const CONTENT_REFS = ['materializedInputRef', 'rawOutputBeforeCoercionRef', 'answerSpanRef', 'inputRedactionManifestRef'] as const;

export type ContentVerdict = 'VERIFIED' | 'NOT_CLAIMED' | 'UNRESOLVABLE' | 'PURGED' | 'HASH_MISMATCH';

/** ⭐ Whether one content ref of a record holds what the record claims — re-hashed by the reader, never trusted. */
export function contentVerdict(ref: unknown, content: ReadonlyMap<string, StoredContent> | null): ContentVerdict {
	const r = rec(ref);
	if (str(r.status) !== 'STORED') return 'NOT_CLAIMED';
	const row = content?.get(str(r.storageKey));
	if (row === undefined) return 'UNRESOLVABLE';
	if (row.purged || row.actualHash === null) return 'PURGED';
	const size = int(r.byteSize);
	const sizeDiffers = size !== null && size !== row.actualSize;
	if (row.actualHash !== str(r.contentHash) || row.contentHash !== row.actualHash || sizeDiffers) return 'HASH_MISMATCH';
	return 'VERIFIED';
}

/** What a person can read of one exchange (§2 stage 8). */
export type ExchangeReading = 'readable' | 'not retained' | 'does not hold what it claims';

/**
 * ⭐ STAGE 8's QUESTION, OF ONE EXCHANGE: can a person read what the model was asked, and what it answered?
 *   · ⛔ what it was asked (`materializedInputRef`) and what it answered (`answerSpanRef`) must each be VERIFIED. A ref
 *     that claims nothing is a disclosed absence (`PENDING_CONTENT_PLANE`, which `PER-9` permits) — and a person still
 *     cannot read it, so it is NOT RETAINED, never "holds what it claims". ⚠ Save the answer of a call that got none
 *     (`NO_RESPONSE`): there is nothing to read;
 *   · every other ref the record claims must hold what it claims.
 *   · ⭐ `JAN-EXEC` Phase 7 P7-6 I2 (`DESIGN-the-reviewer-isolated.md` §2; `REG-F-351`) — what it answered is its answer
 *     span, OR, where no span could be located in the reply and the reviewer's plane kept the reply whole, the whole
 *     reply (`rawOutputBeforeCoercionRef`, its span PENDING): *"A reply that does not parse is then readable, and stage 8
 *     can be read in full."* ⛔ Asked of the span alone, every kept unparsed reply read `not retained`, as at HEAD.
 */
export function exchangeReading(x: StoredObject, content: ReadonlyMap<string, StoredContent> | null): ExchangeReading {
	const verdicts = CONTENT_REFS.map((f) => [f, contentVerdict(x.state[f], content)] as const);
	if (verdicts.some(([, v]) => v === 'UNRESOLVABLE' || v === 'PURGED' || v === 'HASH_MISMATCH'))
		return 'does not hold what it claims';
	const verified = (f: string): boolean => verdicts.some(([g, v]) => g === f && v === 'VERIFIED');
	// ⭐ P7-6 I2 — the ref that holds what it answered: the span, unless only the whole reply was kept.
	const answered = !verified('answerSpanRef') && verified('rawOutputBeforeCoercionRef') ? 'rawOutputBeforeCoercionRef' : 'answerSpanRef';
	const needed: readonly string[] =
		str(x.state.disposition) === 'NO_RESPONSE' ? ['materializedInputRef'] : ['materializedInputRef', answered];
	return verdicts.every(([f, v]) => v === 'VERIFIED' || !needed.includes(f)) ? 'readable' : 'not retained';
}

// ── THE MANIFEST (P7-4d) ─────────────────────────────────────────────────────────────────────────────────────────────

/** The evidence's own floor, as the join concluded it: SATISFIED, or the first unsatisfied policy's state, plan order. */
export function evidenceVerdictOf(floor: readonly { policyId: string; state: string }[]): EvidenceVerdict | undefined {
	const unsatisfied = floor.find((f) => f.state !== 'SATISFIED');
	if (unsatisfied === undefined) return 'SATISFIED';
	const verdicts: readonly string[] = ['CONDITIONALLY_SATISFIED', 'REJECTED', 'INCONCLUSIVE', 'ESCALATED', 'MISSING'];
	return verdicts.includes(unsatisfied.state) ? (unsatisfied.state as EvidenceVerdict) : undefined;
}

export const OUTSIDE = '<absolute path outside the workspace>';
export const REDACTED = '<redacted: it names the account or an absolute path (REG-F-536)>';

/** One argument after the program, any absolute path in it made relative to the workspace — or the problem. */
function relativeArgument(arg: string, index: number, workspace: string | null): { value: string; problem?: string } {
	const eq = arg.startsWith('-') ? arg.indexOf('=') : -1;
	const head = eq === -1 ? '' : arg.slice(0, eq + 1);
	const path = eq === -1 ? arg : arg.slice(eq + 1);
	if (PATTERN_OPTIONS.has(head.slice(0, -1)) || !absolutePath(path)) return { value: arg };
	const relative = workspace === null ? undefined : relativeToWorkspace(path, workspace);
	if (relative !== undefined) return { value: `${head}${relative}` };
	return {
		value: `${head}${OUTSIDE}`,
		problem:
			workspace === null
				? `argv[${index}] names an absolute path, and no workspace path is recorded to make it relative`
				: `argv[${index}] names an absolute path outside the workspace`
	};
}

/**
 * ⭐ One recorded argv as the manifest may hold it: every absolute path inside the workspace made relative to it, and
 * — ⛔ — a problem for each argument that cannot be written: an absolute path outside the workspace, or one that names
 * the account or an absolute path anywhere in its text. `argv` beside the problems is the version that CAN be written,
 * each such argument replaced by a placeholder.
 * ⛔ EACH ARGUMENT IS SCANNED IN BOTH SPELLINGS IT WILL BE WRITTEN IN — as `report.md` prints it, and as the three JSON
 * files escape it — because the CLI's last scan reads the JSON text: a spelling only that scan saw would refuse the whole
 * report over one argument, where this leaves out its command alone.
 * ⛔ THROWS ON NO ACCOUNT NAME (`REG-F-545`): an argument checked against no name is not checked, and would be written as
 * clean.
 */
export function manifestArgv(
	argv: readonly string[],
	workspace: string | null,
	names: readonly string[]
): { readonly argv: readonly string[]; readonly problems: readonly string[] } {
	if (names.length === 0) throw new Error('no account name was given, so an argv cannot be checked for it (REG-F-536)');
	const problems: string[] = [];
	const out = argv.map((arg, index) => {
		const pathArgument = index > 0 && !PATTERN_OPTIONS.has(argv[index - 1] ?? '');
		const relative = pathArgument ? relativeArgument(arg, index, workspace) : { value: arg };
		if (relative.problem !== undefined) {
			problems.push(relative.problem);
			return relative.value;
		}
		const hits = [relative.value, JSON.stringify(relative.value)].flatMap((spelling) =>
			scanText(spelling, `argv[${index}]`, names)
		);
		if (hits.length === 0) return relative.value;
		problems.push(`argv[${index}] names ${[...new Set(hits.map((h) => h.kind))].join(' and ')} (REG-F-536)`);
		return REDACTED;
	});
	return { argv: out, problems };
}

const archiveFacts = (lane: LaneRows, u: UnitSpec): ArchiveFacts | undefined =>
	lane.archives.find((a) => a.name === archiveNameOf(u.order, u.slug));

/** One evidence object as a manifest command, or why it cannot be one. */
function recordedCommand(
	ix: Index,
	u: Unit,
	evidence: StoredObject,
	ordinal: number,
	written: ReturnType<typeof manifestArgv>,
	tree: string | null
): RecordedCommand | { readonly reason: string } {
	const ref = rec(evidence.state.contentReference);
	const argv = strs(ref.command);
	if (argv.length === 0 || argv[0] === '') return { reason: 'its evidence records no command' };
	if (written.problems.length > 0) return { reason: written.problems.join('; ') };
	if (tree === null)
		return {
			reason: `the unit's archive ${archiveNameOf(u.order, u.slug)} holds no workspace copy, so the tree it is re-run on cannot be named`
		};
	const evidenceVerdict = evidenceVerdictOf(floorOf(ix, evidence.id));
	if (evidenceVerdict === undefined) return { reason: 'its floor holds a state no evidence verdict names: the floor did not conclude' };
	const exitCode = ref.exitCode === null ? null : int(ref.exitCode);
	const timedOut = bool(ref.timedOut);
	if ((ref.exitCode !== null && exitCode === null) || timedOut === null)
		return { reason: 'its evidence records no exit code or no timing-out' };
	return { unit: u.slug, ordinal, argv: written.argv, cwd: '.', exitCode, timedOut, evidenceId: evidence.id, evidenceVerdict };
}

function buildManifest(
	ix: Index,
	units: readonly Unit[],
	lane: LaneRows,
	workspace: string | null,
	names: readonly string[],
	runNote: string
): { manifest: CommandManifest; excluded: ExcludedCommand[] } {
	const commands: RecordedCommand[] = [];
	const excluded: ExcludedCommand[] = [];
	const trees: UnitTree[] = [];
	for (const u of units) {
		const tree = archiveFacts(lane, u)?.workspaceTree ?? null;
		const included: RecordedCommand[] = [];
		u.evidence.forEach((e, i) => {
			// ⚠ THE ORDINAL IS COMPLETION ORDER: the join proposes evidence in the order the observer kept the runs, as each
			// FINISHED (`REG-F-518`) — not the order they started, which the manifest format names and nothing records.
			const ordinal = i + 1;
			const written = manifestArgv(strs(rec(e.state.contentReference).command), workspace, names);
			const command = recordedCommand(ix, u, e, ordinal, written, tree);
			if ('reason' in command)
				excluded.push({ unit: u.slug, ordinal, evidenceId: e.id, reason: command.reason, argv: written.argv });
			else included.push(command);
		});
		if (included.length > 0 && tree !== null) {
			trees.push({ unit: u.slug, treeSha256: tree });
			commands.push(...included);
		}
	}
	const manifest: CommandManifest = { manifestVersion: MANIFEST_VERSION, run: runNote, units: trees, commands };
	// ⛔ THE RE-RUNNER'S OWN CHECK, ON WHAT IS ABOUT TO BE WRITTEN: a manifest it would refuse runs nothing at all.
	const problems = manifestProblems(manifest);
	if (problems.length > 0)
		throw new Error(`the manifest built would be refused by rerun-commands:\n  ${problems.join('\n  ')}`);
	return { manifest, excluded };
}

// ── RUNS PAST THE 32ND (K5; `REG-F-517`) ─────────────────────────────────────────────────────────────────────────────

/** The capture folder an evidence object names, or undefined when its output was not retained. */
function captureFolder(e: StoredObject): string | undefined {
	const capture = rec(rec(e.state.contentReference).capture);
	return capture.retained === true ? str(capture.stdoutPath).split('/')[1] : undefined;
}

/**
 * An archive's capture folders: those it holds — or none, when its `checks.json` records that the run had no
 * process-output to copy. ⛔ Null when neither says: an archive cut short holds no listing, and that is not "none".
 */
function capturesIn(a: ArchiveFacts | undefined): readonly string[] | null {
	if (a === undefined) return null;
	return a.captures ?? (a.processOutputRecorded === false ? [] : null);
}

/** The capture folders a unit's archive gained over the one before — or, null, why that cannot be known. */
function capturesAdded(
	u: Unit,
	units: readonly Unit[],
	lane: LaneRows
): { readonly added: readonly string[] | null; readonly unknownBecause: string | null } {
	const listing = (o: UnitSpec) =>
		archiveFacts(lane, o) === undefined
			? `there is no archive ${archiveNameOf(o.order, o.slug)}`
			: `the archive ${archiveNameOf(o.order, o.slug)} holds no capture listing, and no checks.json says the run had none`;
	const mine = capturesIn(archiveFacts(lane, u));
	if (mine === null) return { added: null, unknownBecause: listing(u) };
	const before = units.filter((o) => o.order < u.order).at(-1);
	// The root's archive holds no process-output: the first model unit's predecessor left no capture.
	let prior: readonly string[] | null = [];
	if (before !== undefined) prior = capturesIn(archiveFacts(lane, before)) ?? (before.order === 1 ? [] : null);
	if (prior === null) return { added: null, unknownBecause: `${listing(before!)}, so nothing can be subtracted` };
	return { added: mine.filter((c) => !prior.includes(c)), unknownBecause: null };
}

/**
 * ⭐ WHY A UNIT'S CAPTURED RUNS BECAME NO EVIDENCE, read from how many its join recorded: the join records every run the
 * observer kept — the first 32 — so 32 recorded means the rest ran past the cap (`REG-F-517`), and fewer means the join
 * never ran, or was refused part-way: a stop drops the commands it has not joined (`REG-F-511`, its last limb).
 */
export function unrecordedCause(
	unrecorded: number | null,
	recorded: number
): { readonly cause: string; readonly registerId: 'REG-F-517' | 'REG-F-511' } | null {
	if (unrecorded === null || unrecorded === 0) return null;
	return recorded >= RECORDED_RUN_LIMIT
		? {
				cause: `runs past the ${RECORDED_RUN_LIMIT}nd (REG-F-517): the evidence join recorded the ${RECORDED_RUN_LIMIT} runs the observer keeps, and no more`,
				registerId: 'REG-F-517'
			}
		: {
				cause:
					'the step stopped before its evidence join recorded them, or the join was refused part-way: a stop drops ' +
					'the commands it has not joined from the record (REG-F-511)',
				registerId: 'REG-F-511'
			};
}

function unitRuns(u: Unit, units: readonly Unit[], lane: LaneRows): UnitRuns {
	const named = new Set(u.evidence.map(captureFolder).filter((f): f is string => f !== undefined));
	const { added, unknownBecause } = capturesAdded(u, units, lane);
	const unrecorded = added === null ? null : added.filter((c) => !named.has(c)).length;
	let observedCalls = 0;
	let observedCallsCut = false;
	for (const t of u.tries) {
		const report = rec(t.state.observedToolCalls);
		if (str(report.observation) !== 'OBSERVED') continue;
		const calls = Array.isArray(report.calls) ? report.calls.map(rec) : [];
		observedCalls += calls.filter((c) => str(c.toolName) === 'run_command' && str(c.outcome) === 'COMPLETED').length;
		if ((int(report.observedCount) ?? 0) > calls.length) observedCallsCut = true;
	}
	return {
		recorded: u.evidence.length,
		captured: added === null ? null : added.length,
		unrecorded,
		cause: unrecordedCause(unrecorded, u.evidence.length)?.cause ?? null,
		unknownBecause,
		observedCalls,
		observedCallsCut
	};
}

// ── THE MATRIX (§1) ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One cell. ⛔ A `broke` with no register id is marked `unregistered` HERE, for every path at once: §1's value is "broke
 * (with its register id)", and a bare "broke" would reach P7-5 with nothing saying an entry is owed. `unregistered`
 * also carries a whole-run cell's break that one of its units has with no id.
 */
function cell(
	stage: StageId,
	row: string,
	value: CellValue | null,
	registerIds: readonly string[],
	basis: readonly string[],
	o: { readonly owedTo?: string; readonly unregistered?: boolean } = {}
): MatrixCell {
	const ids = [...new Set(registerIds)].sort(byCodeUnit);
	const unregistered = o.unregistered === true || (value === 'broke' && ids.length === 0);
	return {
		stage,
		row,
		value,
		registerIds: ids,
		basis,
		...(o.owedTo ? { owedTo: o.owedTo } : {}),
		...(unregistered ? { unregistered: true as const } : {})
	};
}

/** One unit, with what each stage's rule reads of it. */
interface UnitView {
	readonly unit: Unit;
	readonly state: { lifecycle: string; execution: string; assurance: string } | null;
	readonly stepState: string;
	/** Begin & Execute was pressed: a plan exists, or the lane recorded the press. */
	readonly pressed: boolean;
	/** ⛔ D4 — the allowance its Begin & Execute outlasted, in ms; null when it answered. The run ended at this unit. */
	readonly timedOut: number | null;
	/** ⛔ E12's re-review F1 (D4) — its sign-off act that outlasted its bound, and the bound; null when none did. */
	readonly signOffOutlasted: LaneUnit['signOffOutlasted'];
	readonly reviews: readonly PairingRow[];
	readonly runs: UnitRuns;
	readonly declared: readonly DeclaredVerdict[];
	readonly signOffAttempted: boolean;
	/** ⭐ E12's polish (fix2's F8) — what the lane held back of its sign-off, and why (`LaneUnit.signOffHeldBack`). */
	readonly heldBack: LaneUnit['signOffHeldBack'];
	/** Its exchanges, both planes, by what a person can read of each (`exchangeReading`). */
	readonly exchanges: { readonly total: number; readonly broken: number; readonly unretained: number };
	readonly contentStore: boolean;
}

/** Why a stage after 3 never concluded for a unit whose Begin & Execute outlasted the lane's allowance (D4). */
const midUnit = (ms: number): string =>
	`the run ended while this unit's Begin & Execute was still running, past the lane's allowance of ${ms} ms (design ` +
	'D4): its archive was taken mid-unit, so this stage never concluded, and what was in flight when the server was ' +
	'killed left no record (REG-F-527)';

/** The tries whose answer arrived, in order: each one's work product was reviewed with its account (K9). */
const answeredTries = (u: Unit): StoredObject[] => u.tries.filter((t) => str(t.state.disposition) !== 'NO_RESPONSE');

/** Stage 7 for one unit, the root included: SATISFIED in lifecycle and assurance, its plan step SUCCEEDED (`REG-F-533`). */
function completion(v: UnitView, row: string): MatrixCell {
	const name = v.unit.slug;
	if (!v.pressed) return cell('7', row, 'not reached', [], [`the ${name} unit was never begun`]);
	const s = v.state;
	const facts = `${name}: lifecycle ${s?.lifecycle ?? '?'}, assurance ${s?.assurance ?? '?'}, step ${v.stepState || 'none'}`;
	if (v.timedOut !== null)
		return cell('7', row, 'broke', ['REG-F-511', 'REG-F-527'], [
			`${facts}, execution ${s?.execution ?? '?'}, read from an archive taken mid-unit`,
			`its Begin & Execute outlasted the lane's allowance of ${v.timedOut} ms (design D4): the run ended there, and the ` +
				'server is killed with the unit still running (REG-F-527), which nothing can run again (REG-F-511)'
		]);
	if (s?.lifecycle === 'SATISFIED' && s.assurance === 'SATISFIED' && v.stepState === 'SUCCEEDED')
		return cell('7', row, 'as intended', [], [facts]);
	// ⚠ THE UNIT'S OWN EXECUTION, NOT ONLY ITS STEP: a step completed by hand leaves the unit EXECUTING, as stopped as before.
	if (v.stepState !== 'SUCCEEDED' || s?.execution !== 'SUCCEEDED')
		return cell('7', row, 'broke', ['REG-F-511'], [
			`${facts}, execution ${s?.execution ?? '?'}`,
			'a unit that stops can never be run again, only abandoned'
		]);
	if (s.assurance === 'CONDITIONALLY_SATISFIED')
		return cell('7', row, 'broke', ['REG-F-403'], [facts, 'a CONDITIONALLY_SATISFIED unit can never be marked satisfied']);
	// ⛔ E12's re-review F1 (D4) — A SIGN-OFF ACT THAT GAVE NO ANSWER WITHIN ITS BOUND: the run ended there, its final archive
	// taken while the server may still have been running the act, which is killed unfinished (REG-F-527). Why it outlasted its
	// bound, no register entry names.
	const outlasted = v.signOffOutlasted;
	if (outlasted !== null)
		return cell(
			'7',
			row,
			'broke',
			['REG-F-527'],
			[
				`${facts}, read from an archive taken while its ${outlasted.act} may still have been running`,
				`its ${outlasted.act} gave no answer within ${outlasted.ms} ms (design D4): the run ended there, and the server is ` +
					'killed with the act unfinished (REG-F-527); no register entry names why it outlasted its bound'
			],
			{ unregistered: true }
		);
	if (!v.signOffAttempted) return cell('7', row, 'not reached', [], [facts, ...heldBackOr(v, 'its sign-off was never attempted')]);
	return cell('7', row, 'broke', [], [facts, 'its sign-off was attempted and the unit is not SATISFIED', ...heldBackOr(v)]);
}

/** ⭐ E12's polish (fix2's F8) — the figures of one read of the limit, as the reviewer-calls section prints the record's own. */
const limitFigures = (c: LaneLimitCheck): string =>
	`${c.prior} + ${c.recorded} + ${c.reserve}${c.ahead > 0 ? ` + ${c.ahead} ahead` : ''} = ${c.total} of ${c.limit}, ` +
	(c.allowed ? 'under it' : 'not under it');

/**
 * ⭐ E12's polish (fix2's F8; the lead's delegated decision of 2026-10-15, to be registered) — WHAT THE LANE HELD BACK OF A
 * UNIT'S SIGN-OFF, as stage 7 says it: before which act, why in the lane's own words, and the limit it read; else `otherwise`.
 * ⛔ A sign-off held back before Record Assurance read "its sign-off was never attempted", the words a run cut short reads, and
 * a declared re-run held back beside a refused Record Assurance left the limit's part said nowhere.
 */
function heldBackOr(v: UnitView, ...otherwise: string[]): string[] {
	const h = v.heldBack;
	if (h === null) return otherwise;
	return [
		`its sign-off was held back before ${h.before}: ${h.reason}`,
		...(h.check === null ? [] : [`the limit as the lane read it: ${limitFigures(h.check)}`])
	];
}

const triesOf = (u: Unit): string[] => u.tries.map((t) => `${str(t.state.disposition)}:${parseClass(t.state.parseOutcome)}`);

/** Stage 3 — the phase does the work, and a review's findings reach its next try. */
function stageThree(v: UnitView, ix: Index): MatrixCell {
	const u = v.unit;
	const row = u.slug;
	// ⛔ D4 — A PRESS THAT OUTLASTED ITS ALLOWANCE: the phase never finished, and nothing bounds how long a unit runs.
	if (v.timedOut !== null)
		return cell('3', row, 'broke', ['REG-F-521', 'REG-F-527'], [
			`Begin & Execute gave no answer within the lane's allowance of ${v.timedOut} ms (design D4), and the run ended there`,
			"nothing bounds a unit's wall-clock time (REG-F-521, W-2), and the server is killed mid-unit (REG-F-527)"
		]);
	if (u.plan === null) {
		if (!v.pressed) return cell('3', row, 'not reached', [], ['Begin & Execute was never pressed on this phase']);
		const envelope = u.lane?.beginExecute?.envelopeType ?? 'no envelope';
		return cell('3', row, 'broke', [], [`Begin & Execute was refused before its plan started (${envelope})`]);
	}
	const tries = triesOf(u);
	if (str(u.tries.at(-1)?.state.disposition) !== 'ACCEPTED')
		return cell('3', row, 'broke', ['REG-F-511'], [
			`the executor's last try gave no answer: ${tries.join(', ') || 'no try recorded, so the step was refused before the model was called'}`,
			'the unit stopped there, and a unit that stops can never be run again (REG-F-511)'
		]);
	const upstream = u.lane?.upstreamNotAssured === true ? ['its upstream phase was not assured (the lane’s record)'] : [];
	const lastArtifact = u.artifacts.at(-1);
	const floor = lastArtifact === undefined ? [] : floorOf(ix, lastArtifact.id);
	const reviewPassed = floor.find((f) => f.policyId === REASONING_REVIEW)?.state === 'SATISFIED';
	const deterministic = floor.filter((f) => f.policyId !== REASONING_REVIEW && f.state !== 'SATISFIED');
	if (reviewPassed && deterministic.length > 0)
		return cell('3', row, 'broke', ['REG-F-515'], [
			`the last try's review passed and ${deterministic.map((d) => d.policyId + ' reads ' + d.state).join(', ')}: ` +
				'a deterministic finding is never sent back, and the loop stopped',
			...upstream
		]);
	return cell('3', row, 'as intended', [], [
		`${plural(u.tries.length, 'try', 'tries')}: ${tries.join(', ')}`,
		'the prompt names the product, as §3.3 records (REG-F-510)',
		...upstream
	]);
}

/** The register ids a review that did not conclude with an answer bears on, by why it did not. */
function idsOfUnconcluded(r: PairingRow): string[] {
	const ids: string[] = [];
	// ⭐ P7-6 B2 — a review that concluded on a reply answering no criterion is `REG-F-552`'s, whatever its repair came to.
	if (r.label === 'no-criterion-answered') ids.push('REG-F-552');
	if (r.label === 'no-response') ids.push('REG-F-499');
	if (r.refusal === 'failed-repair') ids.push('REG-F-489', 'REG-F-428', 'REG-F-479');
	if (r.label === 'no-answer-recorded') ids.push('REG-F-525');
	if (r.label === 'not-pairable') ids.push('REG-F-433');
	if (r.subjectKind === 'command') ids.push('REG-F-520');
	return ids;
}

/** Who decides a stage-4 cell whose capture listing is missing (K5). */
export const K5_OWED = "a person, from the run folder's own capture folders (K5; design D6, D7)";

/** K5, for stage 4: the id a unit's dropped runs bear on — or, ⛔ when they cannot be counted, the cell owed, never none. */
function runsDropped(v: UnitView): { readonly ids: string[]; readonly owed: string[]; readonly basis: string[] } {
	const { unrecorded } = v.runs;
	if (unrecorded === null)
		return v.unit.tries.length === 0
			? { ids: [], owed: [], basis: [] }
			: { ids: [], owed: [K5_OWED], basis: [`whether a captured run became no evidence is unknown: ${v.runs.unknownBecause}`] };
	if (unrecorded === 0) return { ids: [], owed: [], basis: [] };
	return {
		ids: [unrecordedCause(unrecorded, v.unit.evidence.length)!.registerId],
		owed: [],
		basis: [`${plural(unrecorded, 'captured run', 'captured runs')} became no evidence: ${v.runs.cause}`]
	};
}

/** K9 (`REG-F-519`): each answered try whose account reached a review as not declared — its basis, one line a try. */
function undeclaredAccounts(u: Unit): string[] {
	const answered = answeredTries(u);
	return answered.flatMap((t, i) => {
		const parse = parseClass(t.state.parseOutcome);
		if (parse === 'PARSED') return [];
		const commands = i === answered.length - 1 && u.evidence.length > 0 ? ' and every command’s review' : '';
		return [`try ${u.tries.indexOf(t) + 1}'s answer did not parse (${parse}): its account reached its work product's review${commands} as not declared`];
	});
}

/**
 * Stage 4 — every command becomes evidence, and every piece of evidence is reviewed.
 *   · K5: captured runs no evidence names broke it, by `unrecordedCause` — ⛔ and runs that cannot be counted leave it
 *     OPEN, never read as none;
 *   · K9: ⛔ an account is judged where it was HANDED — each answered try's to its work product's review, the last one's
 *     to every command's — and a try that got no answer reached no review, so its parse says nothing here;
 *   · a review not answered broke it; one answered against the work is the adjudication's (P7-4f).
 */
function stageFour(v: UnitView, ix: Index): MatrixCell {
	const u = v.unit;
	const row = u.slug;
	if (v.timedOut !== null) return cell('4', row, 'not reached', [], [midUnit(v.timedOut)]);
	if (u.plan === null) return cell('4', row, 'not reached', [], ['the phase never ran']);
	const dropped = runsDropped(v);
	const ids: string[] = [...dropped.ids];
	const owed: string[] = [...dropped.owed];
	const basis: string[] = [`${plural(u.evidence.length, 'command', 'commands')} became evidence`, ...dropped.basis];
	const undeclared = undeclaredAccounts(u);
	if (undeclared.length > 0) ids.push('REG-F-519');
	basis.push(...undeclared);
	if (u.artifacts.length === 0) basis.push('no work product was recorded, so nothing was reviewed');
	const unreviewed = u.evidence.filter((e) => floorOf(ix, e.id).find((f) => f.policyId === REASONING_REVIEW)?.state === 'MISSING');
	if (unreviewed.length > 0) basis.push(`${plural(unreviewed.length, 'command has', 'commands have')} no review`);
	const failed = v.reviews.filter((r) => r.label !== 'answered');
	for (const r of failed) {
		basis.push(`the review of ${r.subjectKind} ${r.subjectId} is ${r.label}${inParens(r.refusal)}`);
		ids.push(...idsOfUnconcluded(r));
	}
	if (ids.length > 0 || unreviewed.length > 0 || failed.length > 0) return cell('4', row, 'broke', ids, basis);
	if (u.artifacts.length === 0 && owed.length === 0) return cell('4', row, 'not reached', [], basis);
	const against = v.reviews.filter((r) => r.assessmentState !== 'SATISFIED');
	if (against.length > 0) {
		basis.push(
			...against.map((r) => `the reviewer concluded ${r.assessmentState} on ${r.subjectKind} ${r.subjectId}`),
			'whether the reviewer was right is a person’s classification; a refused command review refuses the step (REG-F-520)'
		);
		owed.push('P7-4f, the adjudication table');
	}
	if (owed.length > 0) return cell('4', row, null, [], basis, { owedTo: owed.join('; ') });
	return cell('4', row, 'as intended', [], [...basis, `${plural(v.reviews.length, 'review', 'reviews')}, each answered SATISFIED`]);
}

/** Stage 5a — a phase completes only when its three checks pass, for the work product and for each command. */
function stageFiveA(v: UnitView, ix: Index): MatrixCell {
	const u = v.unit;
	const row = u.slug;
	const lastArtifact = u.artifacts.at(-1);
	if (v.timedOut !== null) return cell('5a', row, 'not reached', [], [midUnit(v.timedOut)]);
	if (u.plan === null || lastArtifact === undefined) return cell('5a', row, 'not reached', [], ['no work product reached the floor']);
	const subjects = [lastArtifact, ...u.evidence];
	const unsatisfied = subjects.flatMap((s) =>
		floorOf(ix, s.id)
			.filter((f) => f.state !== 'SATISFIED')
			.map((f) => `${s.objectType === 'ARTIFACT' ? 'work product' : 'command'} ${s.id}: ${f.policyId} ${f.state}`)
	);
	if (v.stepState === 'SUCCEEDED' && unsatisfied.length > 0)
		return cell('5a', row, 'broke', [], ['the step SUCCEEDED with its floor not satisfied', ...unsatisfied]);
	let why = `the step SUCCEEDED and all ${subjects.length * FLOOR_POLICIES.length} floor assessments are SATISFIED`;
	if (v.stepState !== 'SUCCEEDED')
		why = unsatisfied.length > 0 ? 'the step did not complete, and the floor refused it' : 'the step did not complete, for a reason other than its floor';
	return cell('5a', row, 'as intended', [], [why, ...unsatisfied]);
}

/**
 * Stage 5b — ~~the declared policies, signed off with no criterion checked~~ ⭐⭐ E2 (`REG-F-523`; `REG-D-110` (3); design B8):
 * the declared policies JUDGED, read from what each verdict recorded — AS INTENDED when every one of the unit's declared
 * verdicts has every criterion of its policy answered and is the verdict those answers give (`DeclaredVerdict.value`).
 *   · ⛔ a criterion left unanswered breaks it (`REG-F-489`'s shape: a review that did not answer every criterion);
 *   · ⛔ a verdict the answers do not give breaks it, and no register entry names that;
 *   · ⚠ a verdict the pre-E2 sign-off recorded is still vacuous by construction (`REG-F-523`, `REG-D-102` (6)).
 * ⭑ A verdict against the work is AS INTENDED here when its answers give it: 5b asks whether the policies judged, and
 * stage 7 whether the unit then completed.
 */
function stageFiveB(v: UnitView): MatrixCell {
	if (v.declared.length === 0) return cell('5b', v.unit.slug, 'not reached', [], ['no declared verdict was signed off']);
	const vacuous = v.declared.filter((d) => d.value === 'vacuous by construction');
	if (vacuous.length > 0)
		return cell('5b', v.unit.slug, 'vacuous by construction', ['REG-F-523', 'REG-F-406'], [
			`${plural(vacuous.length, 'declared verdict', 'declared verdicts')} signed off before E2, each computed from the policy's required evidence alone (REG-D-102 (6))`
		]);
	const broke = v.declared.filter((d) => d.value === 'broke');
	if (broke.length > 0)
		return cell(
			'5b',
			v.unit.slug,
			'broke',
			broke.flatMap((d) => d.registerIds),
			broke.flatMap((d) => d.basis),
			{ unregistered: broke.some((d) => d.registerIds.length === 0) }
		);
	return cell('5b', v.unit.slug, 'as intended', [], [
		`${plural(v.declared.length, 'declared verdict', 'declared verdicts')}, each with every criterion of its policy answered and its verdict the one its answers give (REG-D-110 (3))`,
		`verdicts: ${v.declared.map((d) => `${d.policyId} ${d.state}`).join('; ')}`
	]);
}

/** Stage 6 — the product: our checks (P7-4), never this report. */
function stageSix(v: UnitView): MatrixCell {
	if (v.unit.plan === null) return cell('6', v.unit.slug, 'not reached', [], ['the phase never ran']);
	return cell('6', v.unit.slug, null, [], ["the product's checks run on the archived workspace, outside the record"], {
		owedTo: 'P7-4a, P7-4b and P7-4c'
	});
}

/**
 * Stage 8 — a person can read what each model was asked and answered, and what each reviewer said. ⛔ Read as the stage
 * asks it (`exchangeReading`): an exchange that retained nothing of what it was asked or answered cannot be read, however
 * lawfully it says so, and a phase in which no model was asked anything could not have failed here.
 */
function stageEight(v: UnitView): MatrixCell {
	const row = v.unit.slug;
	if (v.timedOut !== null) return cell('8', row, 'not reached', [], [midUnit(v.timedOut)]);
	if (v.unit.plan === null) return cell('8', row, 'not reached', [], ['the phase never ran']);
	const { total, broken, unretained } = v.exchanges;
	if (total === 0) return cell('8', row, 'not reached', [], ['no model was asked anything for this phase']);
	const ids: string[] = [];
	const basis = [
		`${total - broken - unretained} of ${total} exchange(s) can be read: what each model was asked and what it answered, ` +
			'each holding what its record claims',
		// ⭐ E2 (`REG-F-514`) — ~~"and every declared verdict names the operator as producer"~~: the sign-off records the
		// unit's executor now, so the standing names REG-F-514 only for a verdict that still records the operator.
		'standing: the bytes are readable only from the content store (REG-F-528)' +
			(v.declared.some((d) => d.producer === OPERATOR_ACTOR_ID)
				? ', and a declared verdict names the operator as producer (REG-F-514)'
				: '')
	];
	if (broken > 0)
		basis.push(
			v.contentStore
				? `${plural(broken, 'exchange does', 'exchanges do')} not hold what its record claims`
				: 'the content store is not in the archive, so no stored content can be read'
		);
	if (unretained > 0)
		basis.push(
			`${plural(unretained, 'exchange retained', 'exchanges retained')} no bytes of what was asked or what was answered ` +
				'(PENDING_CONTENT_PLANE): a disclosed absence, and a person still cannot read it'
		);
	const orphans = v.reviews.filter((r) => r.label === 'no-answer-recorded').length;
	const ambiguous = v.reviews.filter((r) => r.label === 'not-pairable').length;
	if (orphans > 0) {
		ids.push('REG-F-525');
		basis.push(`${plural(orphans, 'review has', 'reviews have')} no answer recorded`);
	}
	if (ambiguous > 0) {
		ids.push('REG-F-433');
		basis.push(`${plural(ambiguous, 'review is', 'reviews are')} not pairable`);
	}
	return cell('8', row, ids.length > 0 || broken > 0 || unretained > 0 ? 'broke' : 'as intended', ids, basis);
}

function phaseCells(v: UnitView, ix: Index): MatrixCell[] {
	return [
		stageThree(v, ix),
		stageFour(v, ix),
		stageFiveA(v, ix),
		stageFiveB(v),
		stageSix(v),
		completion(v, v.unit.slug),
		stageEight(v)
	];
}

/** Stage 1 — the PWA is PUBLISHED; whether its authoring is assured is half B's (P7-7). */
function stageOne(ix: Index): MatrixCell {
	const pwas = ix.ofType('PROFESSIONAL_WORK_ARCHITECTURE').filter((p) => str(p.state.name) === PHASE7_PWA.name);
	if (pwas.some((p) => str(p.state.publicationStatus) === 'PUBLISHED'))
		return cell('1', WHOLE_RUN, 'not measured in this half', [], [
			`the PWA "${PHASE7_PWA.name}" is PUBLISHED, typed by the operator`,
			'the authoring floor and the publish gate are half B (P7-7): half A authors no candidate'
		]);
	if (pwas.length === 0) return cell('1', WHOLE_RUN, 'not reached', [], [`no PWA named "${PHASE7_PWA.name}" is in the store`]);
	const status = str(pwas.at(-1)!.state.publicationStatus) || 'unpublished';
	return cell('1', WHOLE_RUN, 'broke', [], [`the PWA "${PHASE7_PWA.name}" is ${status}`]);
}

/** Stage 2 — one work unit per mandatory type, the phases children of the root. */
function stageTwo(undertakingId: string | null, structure: UnitStructure): MatrixCell {
	if (undertakingId === null) return cell('2', WHOLE_RUN, 'not reached', [], ['no Undertaking of the run is in the store']);
	const faults = [
		...structure.missing.map((s) => `no work unit for ${s}`),
		...structure.duplicated.map((s) => `more than one work unit for ${s}`),
		...structure.orphaned.map((s) => `the ${s} unit is not a child of the root`)
	];
	if (faults.length > 0) return cell('2', WHOLE_RUN, 'broke', [], faults);
	return cell('2', WHOLE_RUN, 'as intended', [], [
		'five work units, one per mandatory type, the four phases children of the root',
		'every child is M1, so the conditional children REG-F-516 names were never offered'
	]);
}

/** Stage 7 for the whole run — every unit, the root included (`REG-F-533`). */
function stageSevenWhole(views: readonly UnitView[]): MatrixCell {
	const perUnit = views.map((v) => completion(v, v.unit.slug));
	const broke = perUnit.filter((c) => c.value === 'broke');
	let value: CellValue = 'as intended';
	if (broke.length > 0) value = 'broke';
	else if (perUnit.some((c) => c.value === 'not reached')) value = 'not reached';
	return cell(
		'7',
		WHOLE_RUN,
		value,
		broke.flatMap((c) => c.registerIds),
		[
			...perUnit.map((c) => `${c.row}: ${c.value}`),
			'measured as every unit, the root included, SATISFIED in lifecycle and assurance, its plan step SUCCEEDED: an ' +
				'Undertaking has no completion state (REG-F-533)'
		],
		{ unregistered: broke.some((c) => c.unregistered === true) }
	);
}

// ── THE REPORT ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** The criterion outcomes a reviewer GAVE — every recorded result but the one that says nobody determined it. */
const ANSWERED = new Set(['MET', 'NOT_MET', 'PARTIALLY_MET', 'NOT_APPLICABLE']);
/** §28.2's ladder, strictest first — how two verdicts are compared. */
const STRICTEST_FIRST = ['REJECTED', 'INCONCLUSIVE', 'CONDITIONALLY_SATISFIED', 'SATISFIED'];
/**
 * ⭐ `E12F` F7 — the verdicts a policy's own evidence can CAP a verdict to (`supportedDisposition`'s two answers short of
 * SATISFIED, `declared-policy-signoff.ts`): never REJECTED, which only answers can reach.
 */
const EVIDENCE_CEILINGS: ReadonlySet<string> = new Set(['CONDITIONALLY_SATISFIED', 'INCONCLUSIVE']);

/**
 * ⭐⭐ E2 (design B8) — WHETHER A DECLARED VERDICT IS THE ONE ITS ANSWERS GIVE, and why: the kernel's ladder
 * (`dispositionFromFindings`) over the recorded rows — the LATEST per criterion, each mandatory by its POLICY's stakes, a
 * criterion with no row undetermined — and the assessment's OPEN findings. ⚠ A policy that declares required evidence can
 * cap a verdict below its answers (`supportedDisposition`'s ceiling); such a verdict is read as following when it is the
 * stricter of the two. ⭑ An engine built for tests counts a stipulated row as met; no run this report reads is one.
 * ⭐ E12's re-review F5 — and a review that answered NO criterion gives INCONCLUSIVE, as `verdictOf` computes it.
 */
function judgedVerdict(ix: Index, a: StoredObject): Omit<DeclaredVerdict, 'assessmentId' | 'unit' | 'validatorId'> {
	const policyId = str(a.state.assurancePolicyId);
	const state = str(a.state.assessmentState);
	const policyState = ix.byId.get(policyId)?.state ?? {};
	const declared = (Array.isArray(policyState.criteria) ? policyState.criteria : []).map((c) => ({
		id: str(rec(c).id),
		mandatory: BLOCKING_SEVERITIES.has(str(rec(c).severityIfNotMet) as never)
	}));
	// ⚠ `claimed`, never `stipulated`: this report READS a row's stipulation, and the census of who writes one
	// (`verif/stipulation-writers.test.ts`) counts every property named so.
	const latest = new Map<string, { result: string; claimed: boolean }>();
	for (const e of ix.eventsOfType('AssuranceCriterionEvaluated'))
		if (str(e.payload.assessmentId) === a.id)
			latest.set(str(e.payload.criterionId), { result: str(e.payload.result), claimed: str(e.payload.stipulated) === 'MET' });
	const rows = [...latest.values()];
	const criteria = {
		declared: declared.length,
		recorded: rows.length,
		answered: rows.filter((r) => ANSWERED.has(r.result)).length,
		undetermined: rows.filter((r) => r.result === 'UNABLE_TO_DETERMINE').length,
		stipulatedRows: rows.filter((r) => r.claimed).length
	};
	const open = ix
		.ofType('ASSURANCE_OBSERVATION')
		.filter((o) => str(o.state.assessmentId) === a.id && str(o.state.disposition) === 'OPEN')
		.map((o) => ({ severity: str(o.state.severity) as never, open: true }));
	// ⛔ E12's re-review F5 — the sign-off's limb before the ladder (`verdictOf`): a review that answered NO criterion of the
	// policy gives INCONCLUSIVE, which the ladder alone, reading mandatory criteria only, does not for a policy none of whose
	// criteria is mandatory.
	const noneAnswered = declared.every((c) => !ANSWERED.has(latest.get(c.id)?.result ?? ''));
	const given: string = noneAnswered
		? 'INCONCLUSIVE'
		: dispositionFromFindings({
				findings: open,
				criteria: declared.map((c) => ({
					mandatory: c.mandatory,
					outcome: (latest.get(c.id)?.result ?? 'UNABLE_TO_DETERMINE') as never
				}))
			});
	const evidenced = Array.isArray(policyState.requiredEvidence) && policyState.requiredEvidence.length > 0;
	// ⛔ `E12F` F7 — A CAP IS A CEILING'S VALUE: `supportedDisposition` answers SATISFIED, CONDITIONALLY_SATISFIED or
	// INCONCLUSIVE, so a verdict below its answers follows from them only as one of the two a ceiling can impose. ⛔ Any
	// stricter verdict was read as capped, a REJECTED over answers that give SATISFIED among them — and no ceiling rejects.
	const capped =
		evidenced &&
		EVIDENCE_CEILINGS.has(state) &&
		STRICTEST_FIRST.indexOf(state) < STRICTEST_FIRST.indexOf(given);
	const followsFromAnswers = declared.length > 0 && (state === given || capped);
	const unanswered = declared.filter((c) => !ANSWERED.has(latest.get(c.id)?.result ?? ''));
	const basis: string[] = [];
	const registerIds: string[] = [];
	if (unanswered.length > 0) {
		registerIds.push('REG-F-489');
		basis.push(
			`${policyId}: ${unanswered.length} of ${declared.length} criteria not answered (${unanswered.map((c) => c.id).join(', ')})`
		);
	}
	if (!followsFromAnswers)
		basis.push(
			declared.length === 0
				? `${policyId}: the policy's criteria are not in the store, so the verdict cannot be read against them`
				: `${policyId}: recorded ${state}, and its answers give ${given}`
		);
	return {
		policyId,
		state,
		criterionResults: ix.criteriaOf.get(a.id)?.length ?? 0,
		value: unanswered.length === 0 && followsFromAnswers ? 'as intended' : 'broke',
		registerIds,
		criteria,
		followsFromAnswers,
		producer: str(rec(a.state.producer).actorId) || null,
		basis
	};
}

/**
 * ⭐ THE DECLARED VERDICTS (P7-4g), each read as design B8 reads it (`judgedVerdict`) — ⚠ or, signed off before E2 (the
 * sign-off's own validator), vacuous by construction, as `REG-D-102` (6) had the report mark all 14.
 */
function declaredVerdicts(ix: Index, units: readonly Unit[]): DeclaredVerdict[] {
	const judged = DECLARED_REVIEW_VALIDATORS as readonly string[];
	return ix.ofType('ASSURANCE_ASSESSMENT').flatMap((a): DeclaredVerdict[] => {
		const validatorId = str(ix.completionOf.get(a.id)?.payload.validatorId);
		const unit = units.find((u) => u.object !== null && u.object.id === strs(a.state.subjectObjectIds)[0])?.slug ?? null;
		const results = ix.criteriaOf.get(a.id)?.length ?? 0;
		if (validatorId === DECLARED_SIGNOFF_VALIDATOR)
			return [
				{
					assessmentId: a.id,
					unit,
					policyId: str(a.state.assurancePolicyId),
					state: str(a.state.assessmentState),
					criterionResults: results,
					value: 'vacuous by construction',
					registerIds: ['REG-F-523', 'REG-F-406'],
					validatorId,
					criteria: { declared: 0, recorded: results, answered: 0, undetermined: 0, stipulatedRows: 0 },
					followsFromAnswers: null,
					producer: str(rec(a.state.producer).actorId) || null,
					basis: ['signed off before E2, from the policy’s required evidence alone (REG-F-523)']
				}
			];
		if (!judged.includes(validatorId)) return [];
		return [{ assessmentId: a.id, unit, validatorId, ...judgedVerdict(ix, a) }];
	});
}

function unitView(
	ix: Index,
	u: Unit,
	units: readonly Unit[],
	lane: LaneRows,
	pairing: PairingReport,
	declared: readonly DeclaredVerdict[]
): UnitView {
	const state = u.object
		? {
				lifecycle: str(u.object.state.workLifecycleState),
				execution: str(u.object.state.executionState),
				assurance: str(u.object.state.assuranceState)
			}
		: null;
	const steps = u.plan?.state.steps;
	const stepState = str(rec(Array.isArray(steps) ? steps[0] : undefined).stepState);
	const subjects = new Set([...u.artifacts, ...u.evidence].map((s) => s.id));
	const exchanges = ix
		.ofType('MODEL_EXCHANGE')
		.filter(
			(x) =>
				(str(x.state.plane) === 'EXECUTION' && u.object !== null && str(x.state.subjectObjectId) === u.object.id) ||
				(str(x.state.plane) === 'ASSURANCE' && subjects.has(str(x.state.subjectObjectId)))
		);
	const actions = lane.actions.filter((a) => actionUnit(a.file) === archiveNameOf(u.order, u.slug));
	const readings = exchanges.map((x) => exchangeReading(x, ix.content));
	return {
		unit: u,
		state,
		stepState,
		pressed: u.plan !== null || (u.lane?.beginExecute ?? null) !== null,
		timedOut: u.lane?.beginExecute?.timedOutAfterMs ?? null,
		signOffOutlasted: u.lane?.signOffOutlasted ?? null,
		reviews: pairing.rows.filter((r) => r.unit === u.slug),
		runs: unitRuns(u, units, lane),
		declared: declared.filter((d) => d.unit === u.slug),
		signOffAttempted:
			u.lane?.signOffAttempted === true ||
			actions.some((a) => a.action === 'recordAssurance' || a.action === 'markSatisfied'),
		heldBack: u.lane?.signOffHeldBack ?? null,
		exchanges: {
			total: exchanges.length,
			broken: readings.filter((r) => r === 'does not hold what it claims').length,
			unretained: readings.filter((r) => r === 'not retained').length
		},
		contentStore: ix.content !== null
	};
}

const pointerOf = (r: unknown): ContentPointer | null => {
	const x = rec(r);
	return str(x.storageKey) === '' ? null : { storageKey: str(x.storageKey), contentHash: str(x.contentHash) };
};

/** One review's row for the adjudication table (P7-4f): pointers to the truth and the account, the verdict, no class. */
function adjudicationRow(
	ix: Index,
	units: readonly Unit[],
	row: PairingRow,
	workspace: string | null,
	names: readonly string[]
): AdjudicationRow {
	const subject = row.subjectId === null ? undefined : ix.byId.get(row.subjectId);
	const unit = units.find((u) => u.slug === row.unit);
	let groundTruth: GroundTruth | null = null;
	let accountTry: StoredObject | undefined;
	if (subject?.objectType === 'EVIDENCE') {
		const ref = rec(subject.state.contentReference);
		const capture = rec(ref.capture);
		groundTruth = {
			kind: 'command',
			evidenceId: subject.id,
			argv: manifestArgv(strs(ref.command), workspace, names).argv,
			exitCode: int(ref.exitCode),
			timedOut: bool(ref.timedOut),
			durationMs: int(ref.durationMs),
			output: pointerOf(ref.mint),
			capture: capture.retained === true ? { stdout: str(capture.stdoutPath), stderr: str(capture.stderrPath) } : null
		};
		// The join hands every command's review the account of the unit's last try that ran (`+page.server.ts`): a try that
		// got no answer returns before the join, so no command of it was ever reviewed.
		accountTry = unit === undefined ? undefined : answeredTries(unit).at(-1);
	} else if (subject?.objectType === 'ARTIFACT') {
		groundTruth = { kind: 'work product', artifactId: subject.id, bytes: pointerOf(subject.state) };
		const key = str(subject.state.storageKey);
		accountTry = unit?.tries.find((t) => str(rec(t.state.workProductDerivation).storageKey) === key);
	}
	const parse = accountTry === undefined ? '' : parseClass(accountTry.state.parseOutcome);
	return {
		assessmentId: row.assessmentId,
		unit: row.unit,
		subject: { kind: row.subjectKind, id: row.subjectId },
		groundTruth,
		account:
			accountTry === undefined
				? null
				: { exchangeId: accountTry.id, parse, declared: parse === 'PARSED', answerSpan: pointerOf(accountTry.state.answerSpanRef) },
		verdict: {
			state: row.assessmentState,
			pairing: row.label,
			criteria: ix.criteriaOf.get(row.assessmentId) ?? [],
			observations: ix.observationsOf.get(row.assessmentId) ?? []
		},
		classification: ''
	};
}

function unitSummary(v: UnitView): UnitSummary {
	const u = v.unit;
	return {
		order: u.order,
		slug: u.slug,
		title: u.type.name,
		unitId: u.object?.id ?? null,
		state: v.state,
		step: u.plan ? { planId: u.plan.id, stepState: v.stepState, planStatus: str(u.plan.state.status) } : null,
		tries: triesOf(u),
		workProducts: u.artifacts.length,
		evidence: u.evidence.length,
		runs: v.runs,
		lane: u.lane
			? { beginExecute: u.lane.beginExecute, stopped: u.lane.stopped, upstreamNotAssured: u.lane.upstreamNotAssured }
			: null
	};
}

/**
 * ⭐ THE RUN REPORT, its re-run manifest and the commands the manifest leaves out — from the archived stores' rows and the
 * lane's own files. `accountNames` are what the manifest's argv may not carry (`archive-scan.ts`). ⛔ Throws if the
 * manifest it built would be refused by the re-runner: a report whose manifest runs nothing must not be written.
 * ⛔ And throws on NO account name (`REG-F-545`), though the run holds no command to check: an empty list is never
 * reached silently.
 */
export function buildRunReport(
	store: StoreRows,
	lane: LaneRows,
	o: { readonly accountNames: readonly string[] }
): RunReportOutput {
	if (o.accountNames.length === 0)
		throw new Error('no account name was given, so the report and its manifest cannot be checked for it (REG-F-536)');
	const problems = [...lane.problems];
	const ix = indexOf(store);
	if (lane.run === undefined) problems.push('lane/run.json is absent: the lane’s own record of each unit is not read');
	const { undertakingId, units, structure } = resolveUnits(ix, laneUnits(lane.run), problems);
	const pairing = buildPairing(ix, units);
	const declared = declaredVerdicts(ix, units);
	const demoDb = str(rec(rec(lane.boot).overlay).JPWB_DEMO_DB);
	if (demoDb === '')
		problems.push('lane/boot.json names no JPWB_DEMO_DB: no recorded path can be made relative to the workspace');
	const workspace = demoDb === '' || undertakingId === null ? null : workspaceDirectoryFor(demoDb, undertakingId);
	const views = units.map((u) => unitView(ix, u, units, lane, pairing, declared));
	const endReason = str(rec(rec(lane.run).end).reason) || null;
	// ⛔ D4 — every act the lane presses ends the run when it outlasts its bound: a Begin & Execute, ⭐ E12's re-review F1 —
	// a recovery act the rule pressed, and a sign-off act. So the end names one of them.
	const outlasted = (v: UnitView): boolean =>
		v.timedOut !== null || v.signOffOutlasted !== null || v.unit.lane?.recoveryOutlasted === true;
	if (endReason === 'allowance-exceeded' && !views.some(outlasted))
		problems.push(
			'lane/run.json ended allowance-exceeded, and names no unit whose Begin & Execute, recovery act or sign-off act outlasted its allowance'
		);
	const matrix: MatrixCell[] = [
		stageOne(ix),
		stageTwo(undertakingId, structure),
		stageSevenWhole(views),
		...views.slice(1).flatMap((v) => phaseCells(v, ix))
	];
	const counts = Object.fromEntries(CELL_VALUES.map((value) => [value, matrix.filter((c) => c.value === value).length]));
	const mode = str(rec(lane.run).mode) || str(rec(lane.boot).mode) || null;
	const startedAt = str(rec(lane.boot).startedAt) || null;
	const runNote =
		`phase7 run (${mode ?? 'mode unrecorded'}${startedAt ? ', started ' + startedAt : ''}): ordinals are completion order, ` +
		`not start order (REG-F-518); runs past the ${RECORDED_RUN_LIMIT}nd are counted in report.json, not listed (REG-F-517)`;
	const { manifest, excluded } = buildManifest(ix, units, lane, workspace, o.accountNames, runNote);
	const cellCounts = counts as Record<CellValue, number>;
	const report: RunReport = {
		tool: 'phase7/run-report',
		reportVersion: 1,
		basis: 'HEAD plus P7-2b',
		run: {
			mode,
			startedAt,
			endReason,
			archiveRead: lane.archiveRead,
			archivesPresent: lane.archives.map((a) => a.name),
			events: store.events.length,
			objects: store.objects.length,
			contentRows: store.content === null ? null : store.content.length
		},
		answer: {
			// ⭐ `E12F` F10 — and the `REG-F-523` line where this run's declared verdicts carry no criterion result.
			alwaysStated: [...ALWAYS_STATED, ...uncheckedCaveat(declared)],
			counts: cellCounts,
			open: matrix.filter((c) => c.value === null).length,
			measured: cellCounts['as intended'] + cellCounts.broke,
			brokeUnregistered: matrix.filter((c) => c.unregistered === true).length
		},
		matrix,
		units: views.map(unitSummary),
		pairing,
		reviewerCalls: buildReviewerCalls(ix, units, lane),
		audit: buildAudit(ix, units, undertakingId, lane),
		declaredVerdicts: { expected: DECLARED_VERDICTS_EXPECTED, rows: declared },
		adjudication: {
			classes: ADJUDICATION_CLASSES,
			rows: pairing.rows.map((row) => adjudicationRow(ix, units, row, workspace, o.accountNames))
		},
		manifest: {
			commands: manifest.commands.length,
			excluded: excluded.length,
			ordinal:
				'completion order: the order the host recorded each run as finished, which is not the order it started them (REG-F-518)',
			unrecordedRuns: Object.fromEntries(views.slice(1).map((v) => [v.unit.slug, v.runs.unrecorded]))
		},
		problems
	};
	return {
		report,
		manifest,
		excluded: {
			tool: 'phase7/run-report',
			note:
				'Commands left out of command-manifest.json, each with why: an argument outside the workspace, or naming the ' +
				'account or an absolute path, cannot be written (REG-F-536), and leaves out ITS command, never the manifest.',
			excluded
		}
	};
}

// ── THE MARKDOWN ─────────────────────────────────────────────────────────────────────────────────────────────────────

const esc = (s: string): string => s.replaceAll('|', String.raw`\|`);

/** A cell as the tables print it: its value and ids — and a break no entry names yet, said so — or what it is owed to. */
function shown(c: MatrixCell | undefined): string {
	if (c === undefined) return '—';
	if (c.value === null) return `open: ${c.owedTo ?? ''}`;
	const ids = c.registerIds.join(', ');
	if (c.unregistered === true) return `${c.value} (${ids === '' ? '' : `${ids}; `}unregistered: P7-5 owes an entry)`;
	return ids === '' ? c.value : `${c.value} (${ids})`;
}

function headerLines(r: RunReport): string[] {
	const started = r.run.startedAt ? `, started ${r.run.startedAt}` : '';
	const values = CELL_VALUES.map((v) => `${r.answer.counts[v]} ${v}`).join('; ');
	return [
		'# Phase 7 run report',
		'',
		`- **Basis:** ${r.basis}.`,
		`- **Run:** ${r.run.mode ?? 'mode unrecorded'}${started}; ended: ${r.run.endReason ?? 'unrecorded'}.`,
		`- **Read from:** lane/archive/${r.run.archiveRead} (${r.run.events} events, ${r.run.objects} objects, ` +
			`${r.run.contentRows ?? 'no'} content rows).`,
		'- **A "Yes" always states:**',
		...r.answer.alwaysStated.map((s) => `  - ${s}`),
		`- **Cells:** ${values}; ${r.answer.open} open. A "Yes" may count only the ${r.answer.measured} reached that could have failed.`,
		`- **Breaks no register entry names yet:** ${r.answer.brokeUnregistered}; P7-5 owes each an entry before it reports it.`
	];
}

function matrixLines(r: RunReport): string[] {
	const phases = PHASE7_UNITS.slice(1).map((u) => u.slug);
	const at = (stage: StageId, row: string) => r.matrix.find((c) => c.stage === stage && c.row === row);
	return [
		'## The stage matrix (§1)',
		'',
		`| Stage | ${phases.join(' | ')} |`,
		`|---|${phases.map(() => '---').join('|')}|`,
		...PHASE_STAGES.map((s) => `| ${s} ${STAGES[s]} | ${phases.map((p) => esc(shown(at(s, p)))).join(' | ')} |`),
		'',
		'| Whole run | |',
		'|---|---|',
		...WHOLE_RUN_STAGES.map((s) => `| ${s} ${STAGES[s]} | ${esc(shown(at(s, WHOLE_RUN)))} |`),
		'',
		'### Why each cell reads as it does',
		'',
		...r.matrix.flatMap((c) => [`- **${c.stage} ${STAGES[c.stage]}, ${c.row}:** ${shown(c)}.`, ...c.basis.map((b) => `  - ${b}`)])
	];
}

function unitLines(r: RunReport): string[] {
	const limit = r.reviewerCalls.limit;
	let under = '';
	if (limit.under !== null) under = limit.under ? ', under it' : ', NOT under it';
	return [
		'## The units',
		'',
		'| # | Unit | Lifecycle | Assurance | Execution | Step | Tries | Evidence | Unrecorded runs |',
		'|---|---|---|---|---|---|---|---|---|',
		...r.units.map(
			(u) =>
				`| ${u.order} | ${u.slug} | ${u.state?.lifecycle ?? '—'} | ${u.state?.assurance ?? '—'} | ` +
				`${u.state?.execution ?? '—'} | ${u.step?.stepState ?? '—'} | ${u.tries.length} | ${u.evidence} | ` +
				`${u.runs.unrecorded ?? 'unknown'} |`
		),
		'',
		'## Reviewer calls — a lower bound',
		'',
		`- **Recorded:** ${r.reviewerCalls.recorded} (${r.reviewerCalls.noResponse} with no response, ` +
			`${r.reviewerCalls.retries} retries, ${r.reviewerCalls.repairs} repairs).`,
		`- **The limit (design D8):** ${limit.prior ?? 'prior spend not given'} + ${limit.recorded} + ${limit.reserve} = ` +
			`${limit.total ?? '?'} of ${limit.limit}${under}.`,
		// ⭐ E12's polish (fix2's F8; the lead's delegated decision of 2026-10-15, to be registered) — and the lane's own reads.
		`- **The lane's own reads of the limit, each before a paid act (design D8; E12F F2):** ${r.reviewerCalls.laneLimitChecks.length}.`,
		...r.reviewerCalls.laneLimitChecks.map(
			(c) => `  - ${c.unit}, before ${c.before}: ${limitFigures(c)}${c.allowed ? '' : ': held back'}.`
		)
	];
}

function pairingLines(r: RunReport): string[] {
	const byDesign = Object.entries(r.pairing.noModelAnswerByDesign)
		.map(([k, ids]) => `${ids.length} ${k}`)
		.join('; ');
	const counts = PAIRING_LABELS.map((l) => `${r.pairing.counts[l]} ${l}`).join('; ');
	return [
		'## The pairing (stage 8; REG-F-433)',
		'',
		r.pairing.rule,
		'',
		`- ${counts}.`,
		`- No model answer by design: ${byDesign}.`,
		'',
		// ⭐ P7-6 B7 — and what joined each review to its calls: its run's token, or its subject alone.
		'| Assessment | Unit | Subject | State | Pairing | Joined by | Calls |',
		'|---|---|---|---|---|---|---|',
		...r.pairing.rows.map(
			(p) =>
				`| ${p.assessmentId} | ${p.unit ?? '—'} | ${p.subjectKind} ${p.subjectId ?? ''} | ${p.assessmentState} | ` +
				`${p.label}${inParens(p.refusal)} | ${p.joinedBy} | ${p.calls.join(', ')} |`
		)
	];
}

function auditLines(r: RunReport): string[] {
	return [
		'## The audit of hand acts (P7-3)',
		'',
		`${r.audit.forbiddenFound} forbidden act(s) found.`,
		'',
		'| Act | Forbidden | Verdict | In the log | POSTed |',
		'|---|---|---|---|---|',
		...r.audit.acts.map(
			(a) => `| ${a.act} | ${a.forbidden ? 'yes' : 'no'} | ${a.verdict} | ${a.found.length} | ${a.posted ?? 'unknown'} |`
		),
		'',
		...r.audit.acts.flatMap((a) => [
			...a.found.map(
				(f) => `- ${a.act}: event ${f.sequence} ${f.eventType} on ${f.aggregateId}${inParens(f.unit)}: ${f.why}.`
			),
			...(a.note ? [`- ${a.act}: ${a.note}.`] : [])
		]),
		...r.audit.expected.map((e) => `- Expected: ${e.act} ×${e.count} — ${e.note}.`)
	];
}

function adjudicationLine(a: AdjudicationRow): string {
	let truth = '—';
	if (a.groundTruth?.kind === 'command') {
		const timedOut = a.groundTruth.timedOut ? ', timed out' : '';
		truth = `exit ${a.groundTruth.exitCode ?? 'none'}${timedOut}: ${a.groundTruth.argv.join(' ')}`;
	} else if (a.groundTruth?.kind === 'work product') truth = `bytes ${a.groundTruth.bytes?.contentHash ?? '—'}`;
	const faulted = a.verdict.criteria.filter((c) => c.result !== 'MET').map((c) => `${c.criterionId} ${c.result}`);
	const account = a.account ? `${a.account.exchangeId} (${a.account.parse})` : '—';
	return (
		`| ${a.assessmentId} | ${a.unit ?? '—'} | ${a.subject.kind} | ${esc(truth)} | ${account} | ` +
		`${a.verdict.state}, ${a.verdict.pairing} | ${esc(faulted.join(', ') || 'none')} | |`
	);
}

/** ⭐ E2 — one declared verdict's line: its answers counted, whether its verdict follows from them, and its value. */
function declaredLine(d: DeclaredVerdict): string {
	let follows = '—';
	if (d.followsFromAnswers !== null) follows = d.followsFromAnswers ? 'yes' : 'no';
	return (
		`| ${d.assessmentId} | ${d.unit ?? '—'} | ${d.policyId} | ${d.state} | ${d.criteria.answered} of ${d.criteria.declared} | ` +
		`${follows} | ${d.value} |`
	);
}

function verdictLines(r: RunReport): string[] {
	const unrecorded = Object.entries(r.manifest.unrecordedRuns)
		.map(([u, n]) => `${u} ${n ?? 'unknown'}`)
		.join('; ');
	return [
		// ⭐ E2 (design B8) — ~~"each vacuous by construction"~~: each read from its recorded criterion results.
		`## The declared verdicts (P7-4g) — ${r.declaredVerdicts.rows.length} of ${r.declaredVerdicts.expected}, each read from its recorded criterion results`,
		'',
		'| Assessment | Unit | Policy | State | Criteria answered | Follows from its answers | Value |',
		'|---|---|---|---|---|---|---|',
		...r.declaredVerdicts.rows.map(declaredLine),
		'',
		'## The adjudication table’s rows (P7-4f) — classification left for a person',
		'',
		`Classes: ${r.adjudication.classes.join('; ')}.`,
		'',
		'| Assessment | Unit | Subject | Ground truth | Account | Verdict | Faulted criteria | Classification |',
		'|---|---|---|---|---|---|---|---|',
		...r.adjudication.rows.map(adjudicationLine),
		'',
		'## The per-command re-run manifest (P7-4d)',
		'',
		`- ${r.manifest.commands} command(s) in command-manifest.json; ${r.manifest.excluded} left out, each with why, in ` +
			'command-manifest.excluded.json.',
		`- The ordinal: ${r.manifest.ordinal}.`,
		`- Captured runs that became no evidence, by phase: ${unrecorded}.`
	];
}

/** ⭐ The report as a person reads it — the same facts as report.json, nothing added. */
export function renderMarkdown(r: RunReport): string {
	return [
		...headerLines(r),
		'',
		...matrixLines(r),
		'',
		...unitLines(r),
		'',
		...pairingLines(r),
		'',
		...auditLines(r),
		'',
		...verdictLines(r),
		'',
		'## Problems with the inputs',
		'',
		...(r.problems.length === 0 ? ['None.'] : r.problems.map((p) => `- ${p}`)),
		''
	].join('\n');
}
