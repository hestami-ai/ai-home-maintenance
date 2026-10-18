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
//     ⭐ In half B the phases are the agent's, and a root that declares MODEL is one of them, at stages 3 to 8 too (the
//     lead's delegated decision of 2026-10-15, to be registered). ⭐ R3-B F6 (the lead's round-3 item 6) — and so is a root
//     whose type cannot be read, its cells failed closed: broke, or not determined, each with why (`failedClosed`).
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
// ⭐ R3-B F3 — the kernel's own reading of the policies a unit declares, for half B's count of declared verdicts. Pure.
import { declaredAssurancePolicyIds } from '@janumipwb/rph-domain';
import {
	PHASE7_NEGATIVE_CONTROL_RESERVE,
	PHASE7_PAID_LIMIT,
	PHASE7_PRIOR_CALLS_VARIABLE,
	PHASE7_REVIEWED_COMMANDS,
	PHASE7_UNIT_REVIEWER_CALLS
} from '../../apps/rph-demo/e2e-live-exec/lane-config.js';
import { scanText } from './archive-scan.js';
// ⭐ P5 package B (F5) — the causes the archive's K5 check names, in the words it writes them (`run-archive.ts`).
import { K5_JOIN_CAUSE, K5_STOP_CAUSE } from './k5-causes.js';
import {
	PHASE7_DESIGN,
	PHASE7_E2E,
	PHASE7_IMPLEMENTATION,
	PHASE7_REQUIREMENTS,
	PHASE7_ROOT,
	PHASE7_PWA,
	type Phase7TypeDeclaration
} from './pwa-content.js';
// ⭐ E3 (C2, C5) — half B's units, read from the published PWA in the tree's order, and its authoring floor.
import { floorDispositions, treeAgainstPlan, TURN_SETTLED, unitsInTreeOrder } from './half-b.js';
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
 * ⭐ R3-A F2 (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (12)) — the id a REPLAYED declared verdict
 * is recorded under (`declared-policy-review.ts` `REPLAY_DECLARED_REVIEW_VALIDATOR_ID`), as the floor's replayed review has one
 * of its own: a declared verdict, and never one the model reviewer made in the run the report reads.
 */
export const REPLAYED_DECLARED_REVIEW_VALIDATOR = 'replay.declared-policy';
/**
 * ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (`REG-F-523`; `REG-D-110` (3)) — THE VALIDATORS A DECLARED VERDICT IS RECORDED UNDER
 * NOW: the model reviewer, the gate lane's stand-in, a refused selection, and a policy nobody reviewed
 * (`declared-policy-review.ts`, `declared-policy-signoff.ts`) — ⭐ R3-A F2: and a replay of the model reviewer's.
 * ⛔ RESTATED, NOT IMPORTED: those modules load the reviewer's chain, which reads tool variables at load (`REG-D-072` D12);
 * `verif/phase7-run-report.test.ts` holds each to its source. ⚠ The first is the LIVE model reviewer's, the one the
 * UNIT_PURPOSE caveat counts as the model reviewer's reviews (`unitPurposeCaveat`); a replayed one is never counted with it.
 */
export const DECLARED_REVIEW_VALIDATORS = [
	'reviewer.declared-policy',
	'standin.declared-policy-review',
	'declared-policy-review.unconfigured',
	'declared-policy-review.missing',
	REPLAYED_DECLARED_REVIEW_VALIDATOR
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
/**
 * ⭐ `REG-D-114` (14), as amended 2026-10-16 — THE CAVEAT THE REVIEWER CALLS CARRY, PLAINLY: the lane checks the limit before
 * each press and never during one, counting one try's reserve ahead of a phase, the rule's re-run of its work or of its
 * review, and a MODEL root's press, so what such a press spends after its check is not held to the limit until the next
 * check. ⚠ Stated for every run: it is a property of the lane, never of what a run happened to spend.
 */
export const LIMIT_CAVEAT =
	`A phase’s own spend can carry the total past the limit: the lane checks the limit before each press, not during one, ` +
	`and a model unit’s press may spend up to ${PHASE7_UNIT_REVIEWER_CALLS} reviewer calls after its check (REG-D-114 (14), as ` +
	`amended 2026-10-16; the sponsor’s limit is "about ${PAID_LIMIT}", REG-D-110 (1)).`;
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

/**
 * ⭐ E12's polish (fix2's F10; the lead's delegated decision of 2026-10-15, to be registered) — THE UNIT_PURPOSE FRAMING, STATED
 * PER RUN. A unit composed of others (the root) has its declared policies judged over ~~its children's work~~ ⭐ R3-A F1 (the
 * lead's delegated decision of 2026-10-16, registered as REG-D-114 (11)): the work it and every unit below it produced, its
 * reviewer given the unit's own purpose (`UNIT_PURPOSE`; the route's `declaredReviewWorkOf`), and no reviewer-qualification
 * case measures that framing: every declared case ~~of case set v5~~ is in the PRODUCING_PROMPT framing
 * (`scripts/reviewer-qual/materialize.ts` frames each so, of every version; ⭐ round 5, `REG-D-115`: the line names no version,
 * since the current set is version six). So the line names each such unit and the reviews the model reviewer made of it,
 * among the verdicts that speak; it is absent where there are none — a root signed off before E2, or never. No case set
 * changes. ⭐ R3-A F2 — and the reviews a REPLAY served it (`replayed`), named as replayed: they stand on the same framing,
 * and are never counted among the model reviewer's.
 */
export function unitPurposeCaveat(
	composites: readonly {
		readonly unit: string;
		readonly reviews: number;
		readonly replayed: number;
		/** ⭐ P5 package B (F6) — what its reviews were judged over, where a unit below it contributed no work (`workSeenOf`). */
		readonly seen?: string | null;
	}[]
): readonly string[] {
	const made = composites.filter((c) => c.reviews > 0 || c.replayed > 0);
	if (made.length === 0) return [];
	const counted = (c: (typeof made)[number]): string =>
		[...(c.reviews > 0 ? [`${c.reviews}`] : []), ...(c.replayed > 0 ? [`${c.replayed} replayed`] : [])].join(' and ');
	// ⛔ P5 package B (F6) — "judged over the work it and every unit below it produced" only where it was: P5's root was
	// judged with its abandoned end-to-end phase contributing no work, and the caveat said every unit.
	const partial = made.filter((c) => c.seen);
	const judged =
		partial.length === 0
			? 'judged over the work it and every unit below it produced (REG-D-111 (2))'
			: `judged over the work of the units below it that hold a completion (REG-D-111 (2); ${partial.map((c) => `${c.unit}: ${c.seen}`).join('; ')})`;
	return [
		`UNIT_PURPOSE framing: the declared reviews of a unit composed of others (${made.map((c) => `${c.unit}: ${counted(c)}`).join('; ')}) ` +
			`were made in it — the unit’s own purpose, ${judged} — and ` +
			'no reviewer-qualification case measures it: every declared case is in the PRODUCING_PROMPT framing.'
	];
}

/**
 * ⭐ P5 package B (F7) — THE WORDS A REVIEW'S RECORDED FAILURE CARRIES when the reviewer's reply ended at its output-token limit:
 * devin's own, in every one of P5's seven reviews recorded with no response, and in every such review of the runs before it.
 */
export const REVIEWER_OUTPUT_LIMIT_TEXT = 'model hit max output token limit';

/**
 * The classifications a person gives each adjudication row (P7-4f). This report leaves the field blank. ⛔ P5 package B (F7) —
 * ~~'transport failure (REG-F-499)'~~: none of the reviews recorded with no response so far was one — each ended at the
 * reviewer's output-token limit — so the class is named by the failure text such a review records (`REVIEWER_OUTPUT_LIMIT_TEXT`).
 */
export const ADJUDICATION_CLASSES = [
	'reviewer right',
	'reviewer wrong',
	'join defect (REG-F-485, REG-F-486)',
	`output-token truncation: the reviewer’s reply ended at its output-token limit, its recorded failure reading "${REVIEWER_OUTPUT_LIMIT_TEXT}"`,
	'malformed reply (REG-F-489, REG-F-428, REG-F-479)'
] as const;

export interface UnitSpec {
	readonly order: number;
	readonly slug: string;
	/** ⭐ E3 (C2) — the unit's title, which instantiation copies from its type's name: the store's unit is found by it. */
	readonly title: string;
	/** Half A's declaration of the unit's type (§3.2); absent in half B, whose types are the agent's. */
	readonly type?: Phase7TypeDeclaration;
	/** ⭐ E3 (C5) — half B: the type the unit was instantiated from, which the candidate checks name (`candidate-checks.ts`). */
	readonly typeId?: string;
	/** ⭐ E3 (C2) — half B: the store's unit itself, so two units of one title are never read as one. */
	readonly unitId?: string;
}

/** Half A's unit: one of §3.2's five, with its type's declaration. */
export interface DeclaredUnitSpec extends UnitSpec {
	readonly type: Phase7TypeDeclaration;
}

/**
 * HALF A's units, in the order the run starts them (`pwa-content.ts`: the root, then the four phases). ⭐ E3 (C2): half
 * B's are READ FROM THE PUBLISHED PWA instead (`halfBUnitSpecs`), the agent's own, root first, then the tree's order.
 */
export const PHASE7_UNITS: readonly DeclaredUnitSpec[] = [
	{ order: 1, slug: 'root', title: PHASE7_ROOT.name, type: PHASE7_ROOT },
	{ order: 2, slug: 'requirements', title: PHASE7_REQUIREMENTS.name, type: PHASE7_REQUIREMENTS },
	{ order: 3, slug: 'design', title: PHASE7_DESIGN.name, type: PHASE7_DESIGN },
	{ order: 4, slug: 'implementation', title: PHASE7_IMPLEMENTATION.name, type: PHASE7_IMPLEMENTATION },
	{ order: 5, slug: 'end-to-end', title: PHASE7_E2E.name, type: PHASE7_E2E }
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
	/**
	 * ⭐ P5 package B (F5) — what its `checks.json` records of K5's causes of a capture folder no evidence names
	 * (`run-archive.ts`, `k5.causes`; worded by `k5-causes.ts`), each whether the record leaves it possible — or null when no
	 * `checks.json` records a K5 check.
	 */
	readonly k5Causes?: readonly { readonly cause: string; readonly possible: boolean }[] | null;
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
	/**
	 * Design D8's check, restated over the record: prior + recorded + reserve~~, under the limit~~ ⭐ against the limit (R3-B's
	 * fix round): `under` is the fact total < limit, and report.md words the total by the one rule (`runStanding`).
	 */
	readonly limit: {
		readonly prior: number | null;
		readonly recorded: number;
		readonly reserve: number;
		readonly total: number | null;
		readonly limit: number;
		/**
		 * Whether the total is BELOW the limit — a fact, kept as it was. ⚠ Not the one rule's verdict (the lead's delegated
		 * decision of 2026-10-16, registered as REG-D-114 (14)), under which a run may reach the limit: report.md words the
		 * total by it (`runStanding`).
		 */
		readonly under: boolean | null;
	};
	/**
	 * ⭐ E12's polish (fix2's F8; the lead's delegated decision of 2026-10-15, to be registered) — THE LANE'S OWN READS OF THE
	 * LIMIT, each before a paid act (D8; `E12F` F2): before each phase, each of the rule's re-runs, each sign-off and each re-run
	 * of the declared reviews, unit by unit — and which held its act back. Read from `lane/run.json`. ⛔ The merge's fix round,
	 * F3 — half B's read before Send first: kept on the authoring record, not a unit's, it was in no list.
	 */
	readonly laneLimitChecks: readonly LaneLimitCheck[];
	/**
	 * ⭐ `REG-D-114` (14), as amended 2026-10-16 — the plain caveat those reads carry (`LIMIT_CAVEAT`): a phase's own spend can
	 * carry the total past the limit, for the lane checks before each press, not during one.
	 */
	readonly limitCaveat: string;
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
	/**
	 * ⭐ E12's polish (fix2's F9; the lead's delegated decision of 2026-10-15, to be registered) — the verdict that speaks for this
	 * one's (unit, policy) when it is a later one — a re-run of its declared review (`REG-D-112` (a)) — or null when this one
	 * speaks; read as the product reads it (`supersessions`).
	 */
	readonly supersededBy: string | null;
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
	/**
	 * ~~Capture folders the unit's archive gained~~ ⭐ P5 package B (F5): the capture folders that are the unit's — those its
	 * own evidence names that an archive of the run lists, and those its archive gained that no evidence names — one per run
	 * the runner completed; null when an archive is missing.
	 */
	readonly captured: number | null;
	/** Captured runs ~~no evidence names~~ ⭐ F5: its archive gained, that no evidence of the run names; null when `captured` is. */
	readonly unrecorded: number | null;
	/**
	 * Why the captured runs became no evidence, ~~read from how many the join recorded~~ ⭐ F5: the causes the unit's archive's
	 * K5 check leaves possible, in its words (`unrecordedCause`); null when none became no evidence, or when that is not
	 * recorded (`causeNotRecorded`).
	 */
	readonly cause: string | null;
	/** ⭐ F5 — the register ids those causes bear on. */
	readonly causeIds: readonly string[];
	/** ⭐ F5 — why the cause is not recorded: the archive holds no K5 check, or one that leaves no cause possible. */
	readonly causeNotRecorded: string | null;
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
	/** ⭐ E3 (C5) — whether a model ran for the unit: an execution try of it answered (`REG-F-505`'s false "Yes"). */
	readonly modelRan: boolean;
	/**
	 * ⭐ E3 (C5) — half B: what the candidate checks found on the unit's type before Submit (`candidate-checks.ts`), each
	 * `<check> (<register ids>)`, shown beside what the unit then did. Empty in half A, which authors no candidate.
	 */
	readonly candidateFindings: readonly string[];
}

/** ⭐ E3 (C4, C5) — what the run report says of half B's authoring, from the lane's record and the store. */
export interface AuthoringSummary {
	readonly pwaId: string | null;
	/** The candidate as the lane last read it before acceptance. */
	readonly candidate: { readonly status: string | null; readonly hash: string | null; readonly detail: string | null };
	/** The authoring floor's dispositions of the PWA, as the STORE holds them once the commit replayed them. */
	readonly floor: readonly { readonly policyId: string; readonly state: string }[];
	/**
	 * ⭐ C3 — the author's model, as configured, and ~~as the floor recorded the producer it judged~~ ⭐ `REG-D-112` (finding 8)
	 * as THE TURN'S OWN STREAM named it, its `producer` event (`phase7-operator.ts`, `producerOfStream`): the floor's
	 * assessments name no producer, so the store records no author for a turn.
	 */
	readonly author: { readonly configured: string | null; readonly resolved: string | null };
	readonly reviewer: string | null;
	/**
	 * The hash of the candidate accepted — named by an acceptance that answered success (`acceptedHashIn`), else null — from
	 * the lane's record, the store keeping none (`REG-F-504`).
	 */
	readonly acceptedHash: string | null;
	/**
	 * ⭐ R3-B F5 (the lead's round-3 item 5) — how the acceptance went unanswered (`unansweredAcceptance`), or null: with no
	 * answer, the hash above is none RECORDED, and the server may still have accepted one.
	 */
	readonly unanswered: string | null;
	/** ⭐ C4 — every finding of the candidate checks, recorded before Submit, none of which refused anything. */
	readonly findings: readonly {
		readonly check: string;
		readonly typeName: string;
		readonly registerIds: readonly string[];
		readonly detail: string;
	}[];
	/** What a "Yes" from half B carries, measured as it is (`HALF_B_CAVEATS`). */
	readonly caveats: readonly string[];
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
		/** ⭐ E3 — the half the run was: `A`, the operator's PWA; `B`, the agent's. */
		readonly half: RunHalf;
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
	/** ⭐ E3 (C4, C5) — half B's authoring; null in half A. */
	readonly authoring: AuthoringSummary | null;
	readonly pairing: PairingReport;
	readonly reviewerCalls: ReviewerCalls;
	readonly audit: AuditReport;
	/**
	 * ⭐ E12's polish (fix2's F9) — `rows`, the verdict that speaks per (unit, policy), the latest; `history`, each one a later
	 * one superseded, its `supersededBy` naming the verdict that speaks.
	 */
	readonly declaredVerdicts: {
		readonly expected: number;
		readonly rows: readonly DeclaredVerdict[];
		readonly history: readonly DeclaredVerdict[];
	};
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
	/**
	 * ⭐ R3-B F4 (the lead's round-3 item 4) — WHERE THE LANE STOPPED, when it
	 * skipped this unit's sign-off after stopping at ANOTHER unit's limit check: that unit's slug, and the act its check was
	 * read before (`signOffsSkipped`). ⭐ R4 (the lead's round-4 item 3) — or after another unit's sign-off act that got no
	 * answer: that unit's slug, and the act (`unanswered`). null when the lane did not skip it so.
	 */
	readonly signOffSkippedAt:
		| { readonly slug: string; readonly before: string }
		| { readonly slug: string; readonly unanswered: string }
		| null;
}

/**
 * ⭐ E12's polish (fix2's F8) — ONE READ OF THE LIMIT THE LANE RECORDED BEFORE A PAID ACT (D8; `E12F` F2): prior + recorded +
 * reserve + ~~the act's own worst case~~ ⭐ what the act counts (`ahead`, 0 where it counted none; `REG-D-114` (14), as
 * amended 2026-10-16), and whether the lane let the act through
 * (`allowed`) or held it back. ⛔ The merge's fix round, F2 — ~~BY ONE OF TWO RULES (`phase7-operator.ts`): `limitCheck`, before a
 * phase, a re-run of one, a sign-off or a re-run of its declared reviews, lets an act through only with the total UNDER the
 * limit; `limitCheckAhead`, before half B's Send and before half B's root's press, lets it through AT the limit too.~~
 * ⭐ ONE RULE since (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (14)): every check lets an act
 * through with its total AT MOST the limit, what it counts of the act always recorded (`ahead`: ~~a phase's and a re-run's
 * first call~~ ~~⭐ R3-B's fix round, F1: the act's worst case, a phase's and a re-run's too~~ ⭐ `REG-D-114` (14), as amended
 * 2026-10-16: one try's reserve before a phase, a re-run of its work or of its review, and a MODEL root's press; an act's
 * worst case before a sign-off, a re-run of its declared reviews and Send — and, since, what it counted, in words,
 * `counted`). ⚠ A record made before it may hold a total AT the limit held back, by the first rule.
 */
export interface LaneLimitCheck {
	/** The unit's slug; `authoring` for half B's read before Send (`AUTHORING_READ`). */
	readonly unit: string;
	/**
	 * What it was read before: the unit's Begin & Execute, a re-run of it, its sign-off, or a re-run of its declared reviews —
	 * or Send.
	 */
	readonly before: string;
	readonly prior: number;
	readonly recorded: number;
	readonly reserve: number;
	readonly ahead: number;
	/**
	 * ⭐ `REG-D-114` (14), as amended 2026-10-16 — what `ahead` counted, in the lane's own words (`phase7-operator.ts`,
	 * `COUNTED_AHEAD`): one try's reserve, an act's worst case, or none; null for a read recorded before the lane said it.
	 */
	readonly counted: string | null;
	readonly total: number;
	readonly limit: number;
	readonly allowed: boolean;
}

/** A limit check the lane recorded, read loosely: null when it holds no total, limit or verdict to read. */
function laneLimitCheck(unit: string, before: string, v: unknown): LaneLimitCheck | null {
	const c = rec(v);
	const [prior, recorded, reserve, total, limit, allowed] = [int(c.prior), int(c.recorded), int(c.reserve), int(c.total), int(c.limit), bool(c.allowed)];
	if (prior === null || recorded === null || reserve === null || total === null || limit === null || allowed === null) return null;
	return { unit, before, prior, recorded, reserve, ahead: int(c.ahead) ?? 0, counted: str(c.counted) || null, total, limit, allowed };
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

/**
 * ⭐ R3-B F4 (the lead's round-3 item 4) — THE SIGN-OFFS THE LANE SKIPPED AFTER
 * IT STOPPED AT A LIMIT CHECK, each with where it stopped. The lane signs off the phases that did not stop, in order, then the
 * root, the record's first unit; a sign-off whose limit check — before Record Assurance, or before the rule's re-run of the
 * declared reviews — held its act back ends that loop (`runTheLane`, D8). So every unit after it in that order whose record
 * holds no sign-off was skipped there. ⚠ A unit the record does not say stopped is taken to be in the order: one never
 * pressed is read as never begun before its sign-off is (`completion`).
 * ⭐ R4 (the lead's round-4 item 3) — AND A SIGN-OFF ACT THAT GOT NO ANSWER ENDS THAT LOOP TOO (D4: nothing is pressed beside
 * an act the server may still be running) — past its bound, or lost in transit, whichever act it was (`SIGN_OFF_ACTS`) — so
 * every later unit whose record holds no sign-off was skipped after it. ⛔ Each read "its sign-off was never attempted".
 */
function signOffsSkipped(rows: readonly Record<string, unknown>[]): Map<Record<string, unknown>, LaneUnit['signOffSkippedAt']> {
	const heldBefore = (r: Record<string, unknown>): string | null => {
		const signOff = rec(r.signOff);
		if (bool(rec(signOff.limitCheck).allowed) === false) return BEFORE_RECORD_ASSURANCE;
		return bool(rec(signOff.rerunLimitCheck).allowed) === false ? BEFORE_DECLARED_RERUN : null;
	};
	/** ⭐ R4 (the lead's round-4 item 3) — the sign-off act of `r` that got no answer, by its button's name, or null. */
	const unansweredAct = (r: Record<string, unknown>): string | null => {
		const signOff = rec(r.signOff);
		const act = SIGN_OFF_ACTS.find(([field]) => {
			const pressed = rec(signOff[field]);
			return int(pressed.timedOutAfterMs) !== null || str(pressed.requestFailure) !== '';
		});
		return act === undefined ? null : act[1];
	};
	const skipped = new Map<Record<string, unknown>, LaneUnit['signOffSkippedAt']>();
	let stop: LaneUnit['signOffSkippedAt'] = null;
	for (const r of [...rows.slice(1).filter((x) => bool(x.stopped) !== true), ...rows.slice(0, 1)]) {
		if (stop !== null) {
			if (r.signOff === null || r.signOff === undefined) skipped.set(r, stop);
			continue;
		}
		const before = heldBefore(r);
		if (before !== null) stop = { slug: str(r.slug), before };
		const unanswered = unansweredAct(r);
		if (unanswered !== null) stop = { slug: str(r.slug), unanswered };
	}
	return skipped;
}

function laneUnits(run: unknown): LaneUnit[] {
	const units = rec(run).units;
	const rows = (Array.isArray(units) ? (units as unknown[]) : []).map(rec);
	// ⭐ R3-B F4 — where the lane stopped its sign-offs, for each unit it skipped after.
	const skipped = signOffsSkipped(rows);
	return rows.map((r) => {
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
			limitChecks: limitChecksOf(str(r.slug), r, signOff),
			signOffSkippedAt: skipped.get(r) ?? null
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
	/**
	 * ⭐ E3 (C2) — half B: the units, and the conditional children the published PWA declares, which instantiation offers to
	 * no one (`REG-F-516`). Absent in half A, whose children are all M1 (§3.2).
	 */
	readonly halfB?: {
		readonly units: number;
		readonly conditional: readonly string[];
		/** ⭐ `REG-D-112` (finding 4) — units the plan does not make under their parent: each slug, and its parent's title. */
		readonly unplanned: readonly { readonly slug: string; readonly parentTitle: string }[];
		/** ⭐ `REG-D-112` (finding 4) — permitted children the plan cannot resolve: instantiation refuses such a PWA. */
		readonly unresolved: readonly string[];
	};
}

/** ⭐ E3 — the half a run was, by its own record: `B` when the lane says so, else `A`, as every run before E3 was. */
export type RunHalf = 'A' | 'B';
export function halfOf(lane: LaneRows): RunHalf {
	return str(rec(lane.run).half) === 'B' || str(rec(lane.boot).half) === 'B' ? 'B' : 'A';
}

/** ⭐ E3 — the lane's record of half B's authoring (`phase7-operator.ts`, `AuthoringRecord`), read loosely. */
const authoringOf = (lane: LaneRows): Record<string, unknown> => rec(rec(lane.run).authoring);

/** ⛔ The merge's fix round, F3 — what half B's read of the limit before Send is listed as among the lane's reads. */
const AUTHORING_READ = { unit: 'authoring', before: 'Send' } as const;

/**
 * ⛔ The merge's fix round, F3 — HALF B'S FIRST READ OF THE LIMIT, kept on the lane's authoring record (`AuthoringRecord.limitCheck`):
 * read before Send, the authoring floor's worst case counted. None in half A, and none in a dry run, which stops before Send.
 */
function authoringLimitChecks(lane: LaneRows): LaneLimitCheck[] {
	const c = laneLimitCheck(AUTHORING_READ.unit, AUTHORING_READ.before, authoringOf(lane).limitCheck);
	return c === null ? [] : [c];
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
		.filter((p) => str(p.state.undertakingId) === undertakingId && str(p.state.title) === spec.title);
	// ⭐ `REG-D-112` (finding 5) — a repeated title is a re-proposal only where units are found BY title (half A): half B
	// reads each unit by its id, and a type more than one parent permits gives its title to a unit under each.
	if (candidates.length > 1 && spec.unitId === undefined)
		problems.push(`${candidates.length} work units are titled "${spec.title}" in the Undertaking: a re-proposal`);
	// ⭐ E3 (C2) — half B names the store's unit itself: the agent may give two units one title.
	const own = spec.unitId ? candidates.find((p) => p.id === spec.unitId) : undefined;
	const named = own ?? (laneUnit?.unitId ? candidates.find((p) => p.id === laneUnit.unitId) : undefined);
	const object = named ?? candidates[0] ?? null;
	if (laneUnit?.unitId && object?.id !== laneUnit.unitId)
		problems.push(`lane/run.json's ${spec.slug} unit is not the store's "${spec.title}" unit`);
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
	problems: string[],
	half: RunHalf = 'A',
	pwaId = ''
): { undertakingId: string | null; units: Unit[]; structure: UnitStructure } {
	const undertakingId = undertakingOf(ix, lane, problems);
	if (half === 'B') return resolveHalfBUnits(ix, lane, problems, undertakingId, pwaId);
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

/**
 * ⭐⭐ E3 (C2) — HALF B'S UNITS, READ FROM THE PUBLISHED PWA, never from §3.2's five: the Undertaking's units in the tree's
 * order, the root first (`half-b.ts`, `unitsInTreeOrder` — the order the lane pressed them in), each found by its own id.
 * Stage 2 then holds them to ~~the PWA's MANDATORY tree (`mandatoryTypes`)~~ ⭐ `REG-D-112` (E3's review, finding 4) THE
 * PLAN INSTANTIATION MAKES OF IT, PER (PARENT, TYPE) (`treeAgainstPlan`, the product's `planComposition`): a planned unit
 * none was built for is missing, a second under one parent a duplicate, a unit with no parent in the Undertaking an
 * orphan, one the plan does not put under its parent unplanned; and the conditional children the PWA declares are named,
 * never offered (`REG-F-516`). ⭐ A title more than one unit bears is said, each unit read by its id (finding 5).
 */
function resolveHalfBUnits(
	ix: Index,
	lane: readonly LaneUnit[],
	problems: string[],
	undertakingId: string | null,
	pwaId: string
): { undertakingId: string | null; units: Unit[]; structure: UnitStructure } {
	const stored = ix
		.ofType('PROFESSIONAL_WORK_UNIT')
		.filter((p) => undertakingId !== null && str(p.state.undertakingId) === undertakingId);
	const types = ix
		.ofType('PWU_TYPE')
		.filter((t) => str(t.state.pwaId) === pwaId && str(t.state.status) !== 'REMOVED');
	const tree = unitsInTreeOrder(stored, types);
	problems.push(...tree.problems);
	const resolved = tree.units.map((t) =>
		unitOf(ix, { order: t.order, slug: t.slug, title: t.title, typeId: t.typeId, unitId: t.unitId }, undertakingId, lane, problems)
	);
	const units = resolved.map((r) => r.unit);
	const titles = tree.units.map((t) => t.title);
	for (const title of new Set(titles.filter((t, i) => titles.indexOf(t) !== i)))
		problems.push(
			`${titles.filter((t) => t === title).length} work units are titled ${JSON.stringify(title)}, each read by its own id: ` +
				'a type more than one parent permits is built once under each (REG-D-112)'
		);
	const plan = treeAgainstPlan(stored, types);
	const slugOf = (unitId: string): string => tree.units.find((t) => t.unitId === unitId)?.slug ?? unitId;
	return {
		undertakingId,
		units,
		structure: {
			missing: plan.missing,
			duplicated: plan.duplicated,
			orphaned: plan.orphaned.map(slugOf),
			halfB: {
				units: units.length,
				conditional: plan.conditional,
				unplanned: plan.unplanned.map((u) => ({ slug: slugOf(u.unitId), parentTitle: u.parentTitle })),
				unresolved: plan.unresolved
			}
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
		laneLimitChecks: [...authoringLimitChecks(lane), ...laneUnits(lane.run).flatMap((u) => u.limitChecks)],
		limitCaveat: LIMIT_CAVEAT
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

/** The register ids a K5 cause bears on: those its words name, and `REG-F-511` for a stop or a join refused part-way. */
const k5CauseIds = (cause: string): string[] => [
	...(cause.match(/REG-F-\d+/g) ?? []),
	...(cause === K5_STOP_CAUSE || cause === K5_JOIN_CAUSE ? ['REG-F-511'] : [])
];

/**
 * ⭐ WHY A UNIT'S CAPTURED RUNS BECAME NO EVIDENCE — ~~read from how many its join recorded: … 32 recorded means the rest ran
 * past the cap (`REG-F-517`), and fewer means the join never ran, or was refused part-way (`REG-F-511`)~~ ⭐⭐ P5 package B
 * (F5): the causes the unit's archive's own K5 check leaves possible (`run-archive.ts` `causesOf`), in its words, and the
 * register ids each bears on. ⛔ The count named P5's implementation REG-F-511, though its archive's K5 check had ruled both
 * of REG-F-511's limbs out. ⚠ Not recorded when the archive holds no K5 check, or one that leaves no cause possible.
 */
export function unrecordedCause(
	a: ArchiveFacts | undefined,
	archive: string
): { readonly cause: string; readonly registerIds: readonly string[] } | { readonly notRecorded: string } {
	const causes = a?.k5Causes;
	if (causes === undefined || causes === null) return { notRecorded: `the archive ${archive}’s checks.json holds no K5 check` };
	const possible = causes.filter((c) => c.possible).map((c) => c.cause);
	if (possible.length === 0) return { notRecorded: `the archive ${archive}’s K5 check leaves none of its causes possible` };
	return {
		cause: `the archive’s K5 check leaves possible ${possible.join('; or ')}`,
		registerIds: [...new Set(possible.flatMap(k5CauseIds))]
	};
}

/**
 * K5 for one unit: its runs, recorded and captured. ⭐⭐ P5 package B (F5) — A CAPTURE FOLDER IS ATTRIBUTED BY THE EVIDENCE
 * THAT NAMES IT (its `stdoutPath`), of every unit of the run, and is an unrecorded run only when no evidence names it; only
 * such a folder is charged to the unit whose archive gained it. ⛔ Every folder an archive gained over the one before was
 * charged to that archive's unit, so the three runs of design's re-run, made after design's archive was taken, read as
 * implementation's runs that became no evidence (P5).
 */
function unitRuns(u: Unit, units: readonly Unit[], lane: LaneRows, ix: Index): UnitRuns {
	const folders = (es: readonly StoredObject[]) => new Set(es.map(captureFolder).filter((f): f is string => f !== undefined));
	const named = folders(ix.ofType('EVIDENCE'));
	const listed = new Set(lane.archives.flatMap((a) => a.captures ?? []));
	const own = [...folders(u.evidence)].filter((f) => listed.has(f)).length;
	const { added, unknownBecause } = capturesAdded(u, units, lane);
	const unrecorded = added === null ? null : added.filter((c) => !named.has(c)).length;
	const why = unrecorded ? unrecordedCause(archiveFacts(lane, u), archiveNameOf(u.order, u.slug)) : undefined;
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
		captured: unrecorded === null ? null : own + unrecorded,
		unrecorded,
		cause: why !== undefined && 'cause' in why ? why.cause : null,
		causeIds: why !== undefined && 'cause' in why ? why.registerIds : [],
		causeNotRecorded: why !== undefined && 'notRecorded' in why ? why.notRecorded : null,
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
	/** ⭐ E12's polish (fix2's F9) — its declared verdicts that speak, the latest per policy (`supersessions`). */
	readonly declared: readonly DeclaredVerdict[];
	/** ⭐ E12's polish (fix2's F9) — its declared verdicts a later one superseded, listed as history. */
	readonly superseded: readonly DeclaredVerdict[];
	readonly signOffAttempted: boolean;
	/** ⭐ E12's polish (fix2's F8) — what the lane held back of its sign-off, and why (`LaneUnit.signOffHeldBack`). */
	readonly heldBack: LaneUnit['signOffHeldBack'];
	/** Its exchanges, both planes, by what a person can read of each (`exchangeReading`). */
	readonly exchanges: { readonly total: number; readonly broken: number; readonly unretained: number };
	readonly contentStore: boolean;
	/**
	 * ⭐ `REG-D-112` (E3's re-review, finding 1) — the units the tree BUILT under it, by slug (`childrenOf`): none, and it is a
	 * LEAF, whose work is a model's to do (`REG-F-505`). Instantiation builds the plan (`planComposition`), as C4 reads a type
	 * the plan gives a child (`candidate-checks.ts`). ⛔ ~~Its type permits a child type of its PWA~~: a type whose permitted
	 * children are all conditional permits them, and its unit has none (`REG-F-516`).
	 */
	readonly children: readonly string[];
	/**
	 * ⭐ P5 package B (F6) — for a unit composed of others whose declared reviews were made, what they were judged over — the
	 * work of whom — where a unit below it contributed no work (`workSeenOf`); null otherwise.
	 */
	readonly workSeen: string | null;
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
	// ⭐⭐ E3 (C5) — A LEAF NO MODEL RAN IS NOT DONE, WHATEVER ITS STATE READS: SATISFIED in lifecycle and assurance with its
	// step SUCCEEDED is what a TRANSFORMATION the press completed, signed off on vacuous verdicts, reads too — `REG-F-505`'s
	// false "Yes". ⚠ §3.2's root runs no model by design, its run the press's (P7-1b (b)): a composite, its work its phases'.
	if (noModelRan(v))
		return cell('7', row, 'broke', ['REG-F-505'], [
			facts,
			'no model ran for this unit: no execution try is recorded and the tree built nothing under it, so it completed as ' +
				'a TRANSFORMATION with nothing produced, and is not counted done (REG-F-505)'
		]);
	// ⭐ P5 package B (F6) — and what a composite's declared reviews were judged over, where a unit below it contributed none.
	const line = seenLine(v);
	const seen = line === null ? [] : [line];
	if (s?.lifecycle === 'SATISFIED' && s.assurance === 'SATISFIED' && v.stepState === 'SUCCEEDED')
		return cell('7', row, 'as intended', [], [facts, ...seen]);
	// ⚠ THE UNIT'S OWN EXECUTION, NOT ONLY ITS STEP: a step completed by hand leaves the unit EXECUTING, as stopped as before.
	if (v.stepState !== 'SUCCEEDED' || s?.execution !== 'SUCCEEDED')
		return cell('7', row, 'broke', ['REG-F-511'], [
			`${facts}, execution ${s?.execution ?? '?'}`,
			'a unit that stops can never be run again, only abandoned'
		]);
	if (s.assurance === 'CONDITIONALLY_SATISFIED')
		return cell('7', row, 'broke', ['REG-F-403'], [facts, 'a CONDITIONALLY_SATISFIED unit can never be marked satisfied', ...seen]);
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
	return cell('7', row, 'broke', [], [facts, 'its sign-off was attempted and the unit is not SATISFIED', ...heldBackOr(v), ...seen]);
}

/**
 * ⛔ The merge's fix round, F2 — WHERE A READ'S TOTAL STANDS AGAINST THE LIMIT, by its arithmetic: below it, "under it"; AT it and
 * let through, "at it, which this act may reach" ~~— only `limitCheckAhead`'s rule lets a total reach the limit (`LaneLimitCheck`);
 * anything else, "not under it"~~. ⭐ THE WORDS FOLLOW THE ONE RULE (the lead's delegated decision of 2026-10-16,
 * registered as REG-D-114 (14)): every check lets an act reach the limit and none lets it pass, so ~~"not under it"~~ a total above
 * the limit is "past it". ⚠ A total AT it held back is a record made before the one rule: "at it", never one the act may reach.
 */
function standingOf(c: LaneLimitCheck): string {
	if (c.total < c.limit) return 'under it';
	if (c.total > c.limit) return 'past it';
	return c.allowed ? 'at it, which this act may reach' : 'at it';
}

/**
 * ⭐ WHERE THE RUN'S OWN TOTAL STANDS, as `standingOf` words a read, by the one rule (the lead's delegated decision of
 * 2026-10-16, registered as REG-D-114 (14)): a run may reach the limit, and never pass it. ⛔ ~~", NOT under it"~~: a total
 * equal to the limit read as though it had passed it.
 */
function runStanding(total: number, limit: number): string {
	if (total < limit) return 'under it';
	return total === limit ? 'at it, which the run may reach' : 'PAST it';
}

/**
 * ⭐ E12's polish (fix2's F8) — the figures of one read of the limit, as the reviewer-calls section prints the record's own.
 * ⛔ The merge's fix round, F2 — ~~worded by the verdict alone, every read the lane let through "under it"~~: by its arithmetic
 * (`standingOf`), so a read at the limit that ~~`limitCheckAhead`~~ ⭐ the lane let through is never said to be under it.
 * ⭐ `REG-D-114` (14), as amended 2026-10-16 — AND WHAT THE READ COUNTED AHEAD, in the lane's words (`counted`), a read of none
 * included: one try's reserve and an act's worst case read alike as figures. ⚠ A read recorded before the lane said it keeps
 * its figures alone.
 */
const limitFigures = (c: LaneLimitCheck): string => {
	const ahead = c.counted === null ? (c.ahead > 0 ? ` + ${c.ahead} ahead` : '') : ` + ${c.ahead} ahead (${c.counted})`;
	return `${c.prior} + ${c.recorded} + ${c.reserve}${ahead} = ${c.total} of ${c.limit}, ${standingOf(c)}`;
};

/**
 * ⭐ E12's polish (fix2's F8; the lead's delegated decision of 2026-10-15, to be registered) — WHAT THE LANE HELD BACK OF A
 * UNIT'S SIGN-OFF, as stage 7 says it: before which act, why in the lane's own words, and the limit it read; else `otherwise`.
 * ⛔ A sign-off held back before Record Assurance read "its sign-off was never attempted", the words a run cut short reads, and
 * a declared re-run held back beside a refused Record Assurance left the limit's part said nowhere.
 * ⭐ R3-B F4 (the lead's round-3 item 4) — AND A SIGN-OFF THE LANE SKIPPED after
 * stopping at another unit's limit check says where it stopped (`skippedWhy`), never `otherwise`. ⛔ Each such unit read "its
 * sign-off was never attempted", the root's included.
 */
function heldBackOr(v: UnitView, ...otherwise: string[]): string[] {
	const h = v.heldBack;
	if (h === null) {
		const skipped = skippedWhy(v);
		return skipped === null ? otherwise : [skipped];
	}
	return [heldWhy(h), ...(h.check === null ? [] : [`the limit as the lane read it: ${limitFigures(h.check)}`])];
}

/** What the lane held back of a unit's sign-off, before which act, and why in its own words (`heldBackOr`'s first line). */
const heldWhy = (h: NonNullable<UnitView['heldBack']>): string => `its sign-off was held back before ${h.before}: ${h.reason}`;

/**
 * ⭐ R3-B F4 (the lead's round-3 item 4) — WHY THE LANE DID NOT ATTEMPT A SIGN-OFF
 * IT SKIPPED after stopping at another unit's limit check (`LaneUnit.signOffSkippedAt`): that unit, and the act its check was
 * read before; ⭐ R4 (the lead's round-4 item 3) — or after another unit's sign-off act that got no answer: that unit, and
 * the act; null for a unit it did not skip so.
 */
function skippedWhy(v: UnitView): string | null {
	const at = v.unit.lane?.signOffSkippedAt ?? null;
	if (at === null) return null;
	if ('unanswered' in at)
		return `its sign-off was not attempted: the lane stopped after the ${at.slug} unit’s ${at.unanswered}, which got no answer, and pressed no sign-off after it (D4)`;
	return `its sign-off was not attempted: the lane stopped at the ${at.slug} unit’s limit check, before ${at.before}, and pressed no sign-off after it (D8)`;
}

/**
 * ⭐ E3 (C5) — a unit whose step SUCCEEDED with no execution try ACCEPTED: no model ran for it (`REG-F-505`). ⭐⭐
 * `REG-D-112` (E3's review, finding 3) — ONLY A LEAF, as C4's check holds only leaves (`candidate-checks.ts`,
 * `model-leaf`): a composite runs no model by design — its work is its children's. ⭐⭐ `REG-D-112` (E3's re-review,
 * finding 1) — A LEAF OF THE TREE INSTANTIATION BUILT (`childrenOf`): ~~one whose type permits no child type of its PWA~~
 * — a type whose permitted children are all conditional is given none, and its unit read "its work is theirs" with no one
 * to do it — ~~and never the root, by its place~~: the root too, for §3.2's runs no model because its work is its four
 * phases', and a root the plan gives no child is the Undertaking's one unit.
 */
const noModelRan = (v: UnitView): boolean =>
	v.children.length === 0 && v.stepState === 'SUCCEEDED' && !modelRanFor(v.unit);

/** ⭐ `REG-D-112` (finding 3) — a composite of the tree whose press completed its step with no model run: by design. */
const compositeDone = (v: UnitView): boolean =>
	v.children.length > 0 && v.stepState === 'SUCCEEDED' && !modelRanFor(v.unit);

/**
 * ⭐ `REG-D-112` (E3's re-review, finding 1) — the units of the Undertaking that name `u` as their parent, the tree
 * instantiation built: each by its slug, or its title when the report lists it under none. ⚠ A unit the store does not
 * hold has none.
 */
function childrenOf(ix: Index, u: Unit, units: readonly Unit[]): string[] {
	const id = u.object?.id;
	return id === undefined
		? []
		: ix
				.ofType('PROFESSIONAL_WORK_UNIT')
				.filter((p) => str(p.state.parentWorkUnitId) === id)
				.map((p) => units.find((x) => x.object?.id === p.id)?.slug ?? str(p.state.title));
}

/** ⭐ E3 (C5) — did a model run for the unit: an execution try of it answered (`ACCEPTED`). */
const modelRanFor = (u: Unit): boolean => u.tries.some((t) => str(t.state.disposition) === 'ACCEPTED');

/**
 * ⭐ R3-B F3 (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (16)) — THE POLICIES A UNIT DECLARES, by the
 * kernel's own reading (`declaredAssurancePolicyIds`, rph-domain): its `assurancePolicyIds` and its type's
 * `requiredAssurancePolicyIds`, each once — the set the lane counts a sign-off's limit by (`declaredPolicyIdsOf`). ⛔ The
 * unit's own list alone left out a policy only its type requires, and counted a repeat twice. ⚠ An upper bound of the
 * verdicts its sign-off records: the server reviews those that also exist, are ACTIVE and admit the unit.
 */
const declaredPoliciesOf = (ix: Index, u: Unit): readonly string[] =>
	declaredAssurancePolicyIds(
		{ assurancePolicyIds: strs(u.object?.state.assurancePolicyIds) },
		{ requiredAssurancePolicyIds: strs(ix.byId.get(u.typeId ?? str(u.object?.state.pwuTypeId))?.state.requiredAssurancePolicyIds) }
	);

/**
 * ⭐ The lead's delegated decision of 2026-10-15, to be registered — the discharge the unit's TYPE declares, read as the
 * lane reads it before half B's root is pressed (`phase7-operator.ts`, `dischargeOf`): §3.2's declaration in half A, the
 * agent's type in the store in half B, and `UNDECLARED` when neither names one.
 */
const dischargeOf = (ix: Index, u: Unit): string =>
	u.type?.workDischarge ??
	(str(ix.ofType('PWU_TYPE').find((t) => t.id === (u.typeId ?? str(u.object?.state.pwuTypeId)))?.state.workDischarge) ||
		'UNDECLARED');

/**
 * ⭐ R3-B F6 (the lead's round-3 item 6) — WHY A UNIT'S TYPE CANNOT BE READ, or
 * null when it can. Half A's is §3.2's declaration, always read. Half B's is the store's PWU_TYPE the unit names: unreadable
 * when the unit names none, when the store holds no type of that id, or when its `workDischarge` is there and no string.
 * ⚠ A type read that names no discharge is READ — `UNDECLARED` (`dischargeOf`), which keeps a root's reading.
 */
function typeUnreadable(ix: Index, u: Unit): string | null {
	if (u.type !== undefined) return null;
	const typeId = u.typeId ?? str(u.object?.state.pwuTypeId);
	if (typeId === '') return 'the unit names no type';
	const type = ix.ofType('PWU_TYPE').find((t) => t.id === typeId);
	if (type === undefined) return `${typeId} is not in the store`;
	const declared = type.state.workDischarge;
	return declared === undefined || declared === null || typeof declared === 'string'
		? null
		: `${typeId} declares a workDischarge that is no word: ${JSON.stringify(declared)}`;
}

/**
 * ⭐ R3-B F6 (the lead's round-3 item 6) — THE CELLS OF A ROOT WHOSE TYPE CANNOT
 * BE READ, FAILED CLOSED: whether its press ran a model, and so which of its stages apply, cannot be decided, so each is
 * reported — a break as it was found, the reason beside it; any other value not determined, OPEN and owed to a person, the
 * reason first. ⛔ Read as UNDECLARED, such a root was skipped by its place: its own cells at stages 3 to 8 were reported
 * nowhere, and its completion only as its line in the whole run's stage 7 (`stageSevenWhole`).
 */
function failedClosed(cells: readonly MatrixCell[], slug: string, why: string): MatrixCell[] {
	const reason =
		`the ${slug} unit’s type cannot be read (${why}): whether its press ran a model, and so which of its stages apply, ` +
		'cannot be decided, so each is reported, never skipped';
	const owedTo = `a person: the ${slug} unit’s type cannot be read`;
	return cells.map((c) =>
		c.value === 'broke'
			? { ...c, basis: [...c.basis, reason] }
			: cell(c.stage, c.row, null, [], [reason, ...c.basis], { owedTo: c.owedTo ? `${c.owedTo}; ${owedTo}` : owedTo })
	);
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
	// ⭐ E3 (C5) — THE STEP SUCCEEDED AND NO MODEL RAN: the unit's type ran as a TRANSFORMATION, which the operator's press
	// completes with nothing produced — an agent following its system prompt declares no discharge (`REG-F-505`).
	if (noModelRan(v))
		return cell('3', row, 'broke', ['REG-F-505'], [
			'its step SUCCEEDED and no model ran: no execution try is recorded for this unit, and the tree built nothing under ' +
				'it, so its type ran as a TRANSFORMATION, completed by the press with nothing produced (REG-F-505)'
		]);
	// ⭐ `REG-D-112` (finding 3) — A COMPOSITE OF THE TREE RUNS NO MODEL BY DESIGN: its work is its children's, and its press
	// completed its step. Never `REG-F-505`'s, which holds LEAVES only. ⭐ (E3's re-review, finding 1) — and the children it
	// HAS are named: the units the tree built under it (`childrenOf`), never the types its own type permits.
	if (compositeDone(v))
		return cell('3', row, 'as intended', [], [
			`a composite of the tree, the parent of ${v.children.join(', ')}: its work is theirs, and its press completed its ` +
				'step with no model run (REG-D-112)',
			...(u.lane?.upstreamNotAssured === true ? ['its upstream phase was not assured (the lane’s record)'] : [])
		]);
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
		// ⭐ E3 — half A's prompts are §3.2's, which name the product; half B's are the agent's, and the checks say whether.
		u.type === undefined
			? "the prompt is the agent's: whether it names the product is the candidate checks' record (namesProduct; REG-F-510)"
			: 'the prompt names the product, as §3.3 records (REG-F-510)',
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
	const runs = plural(unrecorded, 'captured run', 'captured runs');
	// ⭐ P5 package B (F5) — the cause the archive's K5 check left possible; ⛔ and where it records none, the cell is owed.
	if (v.runs.cause === null)
		return { ids: [], owed: [K5_OWED], basis: [`${runs} became no evidence, and why is not recorded: ${v.runs.causeNotRecorded}`] };
	return { ids: [...v.runs.causeIds], owed: [], basis: [`${runs} became no evidence: ${v.runs.cause}`] };
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
 *     OPEN, never read as none; ⭐ P5 package B (F5) — and so do runs whose cause the archive does not record;
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

/**
 * ⭐⭐ P5 package B (F4) — THE SUBJECTS OF THE FLOOR OF A STEP THAT COMPLETED: what its completion names (`ExecutionStepSucceeded`
 * on the unit's last plan: its output work products and the commands it proposed as evidence), and every command its own
 * attempts ran, which a completion by hand names none of. ⛔ Every command of the unit was read, so a superseded plan's
 * refused reviews were read beside the step its re-run completed: P5's design 5a broke over plan A's two. ⚠ Undefined when
 * the record holds no completion of that plan: every command of the unit is read then, as before.
 */
function completedSubjects(ix: Index, u: Unit): StoredObject[] | undefined {
	const plan = u.plan;
	if (plan === null) return undefined;
	const done = ix.eventsOfType('ExecutionStepSucceeded').filter((e) => e.aggregateId === plan.id).at(-1);
	if (done === undefined) return undefined;
	const steps = plan.state.steps;
	const stepId = str(rec(Array.isArray(steps) ? steps[0] : undefined).id);
	const attempted = u.evidence.filter(
		(e) => stepId !== '' && str(rec(e.state.contentReference).producingExecutionAttemptId).startsWith(`${stepId}#`)
	);
	const ids = [...strs(done.payload.outputArtifactIds), ...strs(done.payload.proposedEvidenceIds), ...attempted.map((e) => e.id)];
	return [...new Set(ids)].flatMap((id) => {
		const subject = ix.byId.get(id);
		return subject === undefined ? [] : [subject];
	});
}

/** Stage 5a — a phase completes only when its three checks pass, for the work product and for each command. */
function stageFiveA(v: UnitView, ix: Index): MatrixCell {
	const u = v.unit;
	const row = u.slug;
	const lastArtifact = u.artifacts.at(-1);
	if (v.timedOut !== null) return cell('5a', row, 'not reached', [], [midUnit(v.timedOut)]);
	if (u.plan === null || lastArtifact === undefined) return cell('5a', row, 'not reached', [], ['no work product reached the floor']);
	const subjects = (v.stepState === 'SUCCEEDED' ? completedSubjects(ix, u) : undefined) ?? [lastArtifact, ...u.evidence];
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
			`${plural(vacuous.length, 'declared verdict', 'declared verdicts')} signed off before E2, each computed from the policy's required evidence alone (REG-D-102 (6))`,
			...historyOf(v)
		]);
	const broke = v.declared.filter((d) => d.value === 'broke');
	if (broke.length > 0)
		return cell(
			'5b',
			v.unit.slug,
			'broke',
			broke.flatMap((d) => d.registerIds),
			[...broke.flatMap((d) => d.basis), ...historyOf(v)],
			{ unregistered: broke.some((d) => d.registerIds.length === 0) }
		);
	return cell('5b', v.unit.slug, 'as intended', [], [
		`${plural(v.declared.length, 'declared verdict', 'declared verdicts')}, each with every criterion of its policy answered and its verdict the one its answers give (REG-D-110 (3))`,
		`verdicts: ${v.declared.map((d) => `${d.policyId} ${d.state}`).join('; ')}`,
		...historyOf(v)
	]);
}

/**
 * ⭐ E12's polish (fix2's F9; the lead's delegated decision of 2026-10-15, to be registered) — the unit's superseded declared
 * verdicts, LISTED AS HISTORY beside the verdicts that speak, as P7-6R's re-runs are listed beside the Decision that made each:
 * 5b reads the latest per (unit, policy) alone (`supersessions`).
 */
const historyOf = (v: UnitView): string[] =>
	v.superseded.length === 0
		? []
		: [
				`listed as history: ${v.superseded
					.map((d) => `${d.policyId} ${d.state} (${d.assessmentId}, ${d.value}), superseded by ${String(d.supersededBy)}`)
					.join('; ')}`
			];

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

/**
 * ⭐ E3 (C5) — WHAT A "YES" FROM HALF B CARRIES AT STAGE 1, measured as they are and disclosed (design §4: *"Measured as
 * they are, and disclosed"*).
 */
export const HALF_B_CAVEATS = [
	'REG-F-503: the authoring floor’s reviewer is not shown the PWA’s declared policies, its prompts’ text or output ' +
		'contracts, its child cardinalities or its types’ purposes, so its SATISFIED says nothing of them; the fix needs a ' +
		'new graph case set and its conferral.',
	'REG-F-504: a person’s acceptance of the candidate leaves no record in the store: the accepted hash here is the lane’s ' +
		'own record of the action’s answer, and nothing names who accepted.',
	'REG-F-516: conditional children are never instantiated: a C1 or C+ child the agent declared is offered to no one.'
] as const;

/**
 * ⭐⭐ E3 (C5) — STAGE 1 OF A HALF-B RUN, MEASURED: the agent authored the PWA, a person's acceptance was pressed, and it was
 * published — so the stage the design reads as *"the PWA is PUBLISHED, and its authoring is assured"* (§2) can fail here.
 * AS INTENDED only when all four hold: the authoring floor's three policies SATISFIED on the PWA, as the store holds them
 * after the commit replayed them; its reasoning review naming its reviewer; an accepted hash, the candidate's own; and the
 * PWA PUBLISHED. ⛔ A break here is the run's to register (`unregistered` until P7-5 names it): a candidate the floor did
 * not assure is a result, not a fault of the lane. ⚠ The caveats (`HALF_B_CAVEATS`) are stated beside it, never folded
 * into its value.
 */
function stageOneHalfB(ix: Index, lane: LaneRows): MatrixCell {
	const authoring = authoringOf(lane);
	const pwaId = str(authoring.pwaId);
	const pwa = pwaId === '' ? undefined : ix.byId.get(pwaId);
	const candidate = rec(authoring.candidate);
	if (pwa === undefined)
		return cell('1', WHOLE_RUN, 'not reached', [], [
			`no PWA the lane authored into is in the store (lane/run.json names ${pwaId === '' ? 'none' : pwaId})`
		]);
	// ⭐ `REG-D-112` (E3's review, finding 7) — A REQUEST NEVER SENT AUTHORED NOTHING: the dry rehearsal stops before Send
	// (C6), and so does a paid run the limit refuses there. Its draft is no candidate the floor failed: NOT REACHED.
	if (authoring.sent !== true)
		return cell('1', WHOLE_RUN, 'not reached', [], [
			`the request was never sent — the run ended ${str(rec(rec(lane.run).end).reason) || 'with no end recorded'} ` +
				'before Send — so no candidate was authored for the floor to judge'
		]);
	const floor = floorDispositions(ix.ofType('ASSURANCE_ASSESSMENT'), pwaId);
	const reviewer = floor.find((f) => f.policyId === REASONING_REVIEW)?.evaluator ?? null;
	// ⭐ The check of 241158f4, finding 1 — ONE READING OF THE ACCEPTANCE (`acceptedHashIn`) for every line and fault below;
	// and a refused one is said in the server's own words, as the lane kept them (`DesignerActRecord.refusal`).
	const accepted = acceptedHashIn(authoring);
	const refusal = str(rec(authoring.accept).refusal);
	const staged = str(candidate.candidateHash) || null;
	const status = str(pwa.state.publicationStatus) || 'unpublished';
	// ⭐ C3 — THE AUTHOR, AS THE LANE READ IT OFF THE PAGE: the store records none (the floor's assessments name no producer).
	const author = rec(authoring.authorModel);
	const resolved = str(author.resolved) || null;
	const configured = str(author.configured) || null;
	// ⭐ `REG-D-112` (E3's re-review, finding 2) — THE LANE ASKS THE TURN'S STREAM ONLY ONCE ITS CANDIDATE HAS SETTLED
	// (`recordTheFloor`): a turn that never settled — no candidate staged, or the allowance outlasted — was never asked.
	const settled = TURN_SETTLED.has(str(candidate.status));
	const authorRead = settled
		? `the author, as the page's turn named it: ${resolved ?? 'none recorded'}`
		: 'the author: not asked — the turn never settled, so the lane never read its stream';
	const faults = [
		...floor.filter((f) => f.state !== 'SATISFIED').map((f) => `the authoring floor's ${f.policyId} reads ${f.state}`),
		...(reviewer === null ? ['the floor’s reasoning review names no reviewer'] : []),
		...(accepted === null ? [noAcceptanceFault(authoring)] : []),
		...(refusal === '' ? [] : [`the acceptance was refused: ${refusal}`]),
		...(accepted !== null && staged !== null && accepted !== staged
			? [`the hash accepted, ${accepted}, is not the staged candidate's, ${staged}`]
			: []),
		...(status === 'PUBLISHED' ? [] : [`the PWA is ${status}`])
	];
	const authorFaults = authorShortfalls(configured, resolved, settled);
	const value: CellValue = faults.length + authorFaults.faults.length === 0 ? 'as intended' : 'broke';
	return cell(
		'1',
		WHOLE_RUN,
		value,
		authorFaults.registerIds,
		[
			authorshipLine(pwa, status, accepted, authoring, lane),
			`the authoring floor: ${floor.map((f) => `${f.policyId} ${f.state}`).join(', ')}`,
			`the reviewer: ${reviewer ?? 'none recorded'}; ${authorRead} (configured: ${configured ?? 'unset'})`,
			`the accepted hash: ${accepted ?? noHashAccepted(unansweredAcceptance(authoring))}; ` +
				`the candidate as the lane last read it: ${str(candidate.status) || 'none'}`,
			...faults,
			...authorFaults.faults,
			...HALF_B_CAVEATS.slice(0, 2).map((c) => `caveat ${c}`)
		],
		// ⚠ A floor, hash or publication fault is the run's to register (P7-5); an author's fault names its entry — save a
		// producer the lane could not read, which names none, and so is unregistered too (`cell`).
		{ unregistered: faults.length > 0 }
	);
}

/**
 * ⭐ The lead's delegated decision of 2026-10-15, to be registered (E3's polish), HELD BY EVERY READER (the check of
 * 241158f4, finding 1) — THE HASH OF THE CANDIDATE ACCEPTED: an acceptance that answered success and named its hash; else
 * null. One reading for stage 1's lines and faults, and for the authoring summary that report.json and report.md print.
 * ⛔ ~~Any hash recorded~~: a record the lane wrote before that check can hold a hash beside a refused acceptance, read
 * out of the refusal's words (`acceptedHashOf`), and only stage 1's first line took it as no acceptance — its fourth line,
 * its faults and the summary printed it as accepted.
 */
function acceptedHashIn(authoring: Record<string, unknown>): string | null {
	const accept = rec(authoring.accept);
	const hash = str(accept.acceptedHash);
	return hash !== '' && str(accept.envelopeType) === 'success' ? hash : null;
}

/**
 * ⭐ R3-B F5 (the lead's round-3 item 5) — HOW AN ACCEPTANCE THAT GOT NO ANSWER
 * WENT UNANSWERED, as the lane kept it (`DesignerActRecord`): no answer within its bound, or its request failed in transit,
 * in the words the lane's `refusalOf` gives each; null for an acceptance answered, and for none pressed.
 */
function unansweredAcceptance(authoring: Record<string, unknown>): string | null {
	const accept = rec(authoring.accept);
	const ms = int(accept.timedOutAfterMs);
	if (ms !== null) return `no answer within ${ms} ms`;
	const failure = str(accept.requestFailure);
	return failure === '' ? null : `no answer: the request failed in transit (${failure})`;
}

/**
 * ⭐ R3-B F5 — stage 1's fault when no hash was accepted. ⛔ An acceptance that got NO ANSWER read "no one accepted a
 * candidate": the server may still have accepted it, and the lane never heard. It reads as no answer.
 */
function noAcceptanceFault(authoring: Record<string, unknown>): string {
	const noAnswer = unansweredAcceptance(authoring);
	return noAnswer === null
		? 'the lane recorded no accepted hash: no one accepted a candidate'
		: `the acceptance got ${noAnswer}: the server may still have accepted it, and the lane recorded no hash`;
}

/**
 * ⭐ R3-B F5 — the accepted hash when none was accepted: "none", or, for an acceptance that got NO ANSWER
 * (`unansweredAcceptance`), none RECORDED and why. ⛔ A bare "none" said no hash was accepted, of a press whose answer never
 * came.
 */
function noHashAccepted(unanswered: string | null): string {
	return unanswered === null ? 'none' : `none recorded — the acceptance got ${unanswered}`;
}

/** ⭐ R3-B F5 — report.md's accepted hash when none was accepted: stage 1's reading, and that the server may have one. */
const acceptedNone = (unanswered: string | null): string =>
	unanswered === null ? 'none' : `${noHashAccepted(unanswered)}, and the server may still have accepted it`;

/**
 * ⭐ The lead's delegated decision of 2026-10-15, to be registered (E3's polish; the confirm of 60c8a828) — STAGE 1'S
 * FIRST LINE: THE AGENT AUTHORED THE PWA ONLY WHEN A CANDIDATE OF ITS WAS ACCEPTED, the acceptance answered success and
 * named its hash. ⛔ ~~Said whatever the authoring came to~~: a turn the server refused before it began read "authored
 * by the agent", in the cell that says the turn never settled. Otherwise the PWA is still the lane's draft, and the line
 * says what the authoring came to: its candidate as the lane last read it, and the run's end. ⚠ A hash alone is no
 * acceptance: `accepted` is stage 1's one reading of it (`acceptedHashIn`).
 * ⭐ R3-B F5 (the lead's round-3 item 5) — AN ACCEPTANCE THAT GOT NO ANSWER
 * (`unansweredAcceptance`) READS AS NO ANSWER, which the server may still have accepted. ⛔ It read "still the draft the lane
 * created: no candidate of the agent’s was accepted into it" — of a press whose answer never came.
 */
function authorshipLine(
	pwa: StoredObject,
	status: string,
	accepted: string | null,
	authoring: Record<string, unknown>,
	lane: LaneRows
): string {
	const named = `the PWA "${str(pwa.state.name)}" is ${status}`;
	if (accepted !== null) return `${named}, authored by the agent from the request (design §4 C1)`;
	const turn = str(rec(authoring.candidate).status);
	const came = turn === '' ? 'no staged candidate' : `a candidate ${turn}`;
	const end = str(rec(rec(lane.run).end).reason) || 'with no end recorded';
	const noAnswer = unansweredAcceptance(authoring);
	const accepting =
		noAnswer === null
			? ', still the draft the lane created: no candidate of the agent’s was accepted into it'
			: `: its acceptance of a candidate got ${noAnswer}, and the server may still have accepted it`;
	return `${named}${accepting} — the authoring came to ${came}, and the run ended ${end}`;
}

/**
 * ⭐⭐ `REG-D-112` (E3's review, finding 6) — THE AUTHOR'S MODEL IS PINNED, AND HELD TO THE PIN: stage 1 BREAKS when the
 * model the turn's own stream named is not the one `JPWB_AGENT_MODEL` pinned — Pi substitutes another, unannounced
 * (`REG-F-509`). ⛔ It read as intended, with a warning beside it: a pin that is recorded and not enforced. ⭑ A pin is met
 * by the model named in full, or, pinned as a bare id, by that id under any provider — as `resolveModel` resolves one.
 * ⭐⭐ `REG-D-112` (E3's re-review, finding 2) — `REG-F-509` ONLY FOR A PRODUCER READ AND NOT THE PIN. ~~Or when the lane
 * read none~~: a producer the lane could not read is no substitution Pi made — the stream did not come within the lane's
 * bound, could not be read, or named none — so the LANE'S READ is the unknown, and the break names no entry: it reaches
 * P7-5 unregistered, never counted as a known product entry. ⚠ AND NO CHECK BEFORE THE TURN SETTLED (`settled`): the lane
 * asks the stream only then (`recordTheFloor`). ⭑ No pin at all is `REG-F-531`'s, whatever the stream named.
 */
function authorShortfalls(
	configured: string | null,
	resolved: string | null,
	settled: boolean
): { readonly faults: readonly string[]; readonly registerIds: readonly string[] } {
	if (configured === null)
		return {
			faults: ['no author model was pinned: half B requires JPWB_AGENT_MODEL, and the record names none (design §4 C3)'],
			registerIds: ['REG-F-531']
		};
	if (!settled) return { faults: [], registerIds: [] };
	if (resolved === null)
		return {
			faults: [
				'the lane read no producer from the turn’s stream — it did not come within the lane’s bound, could not be read, ' +
					`or named none — so which model authored the PWA is unknown, and the pin, ${configured}, is not shown met`
			],
			registerIds: []
		};
	if (resolved === configured || resolved.endsWith(`/${configured}`)) return { faults: [], registerIds: [] };
	return {
		faults: [
			`the author that ran, ${resolved}, is not the model pinned, ${configured}: Pi substituted another, ` +
				'unannounced (REG-F-509)'
		],
		registerIds: ['REG-F-509']
	};
}

/** Stage 1 — the PWA is PUBLISHED; whether its authoring is assured is half B's (P7-7). ⭐ E3 (C5): and half B measures it. */
function stageOne(ix: Index, half: RunHalf = 'A', lane?: LaneRows): MatrixCell {
	if (half === 'B' && lane !== undefined) return stageOneHalfB(ix, lane);
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
	const halfB = structure.halfB;
	const faults = [
		// ⭐ `REG-D-112` (finding 4) — half B's tree is held to the plan instantiation makes of it, per (parent, type).
		...(halfB?.unresolved ?? []).map((s) => `the published PWA’s tree does not resolve, ${s}: instantiation refuses it`),
		...structure.missing.map((s) => `no work unit for ${s}`),
		...structure.duplicated.map((s) => `more than one work unit for ${s}`),
		...structure.orphaned.map((s) =>
			halfB === undefined ? `the ${s} unit is not a child of the root` : `the ${s} unit’s parent is no unit of the Undertaking`
		),
		...(halfB?.unplanned ?? []).map(
			(u) => `the ${u.slug} unit is not one the published PWA’s plan makes under its parent, ${u.parentTitle}`
		)
	];
	if (faults.length > 0) return cell('2', WHOLE_RUN, 'broke', [], faults);
	// ⭐ E3 (C2) — HALF B'S TREE IS THE AGENT'S: its count, and the conditional children it declares, said as they are.
	if (structure.halfB !== undefined)
		return cell('2', WHOLE_RUN, 'as intended', [], [
			`${plural(structure.halfB.units, 'work unit', 'work units')}, one for each mandatory child under each parent, as ` +
				'instantiation plans the published PWA (planComposition), the root over them all',
			structure.halfB.conditional.length === 0
				? 'the PWA declares no conditional child, so none went unoffered (REG-F-516)'
				: `${plural(structure.halfB.conditional.length, 'conditional child was', 'conditional children were')} never ` +
					`offered (REG-F-516): ${structure.halfB.conditional.join(', ')}`
		]);
	return cell('2', WHOLE_RUN, 'as intended', [], [
		'five work units, one per mandatory type, the four phases children of the root',
		'every child is M1, so the conditional children REG-F-516 names were never offered'
	]);
}

/**
 * Stage 7 for the whole run — every unit, the root included (`REG-F-533`). ⭐ R4 (the lead's round-4 item 4) — the root as its
 * OWN stage-7 cell reads it: failed closed when its type cannot be read (`rootUnreadable`; `failedClosed`, R3-B F6), so the
 * run's stage 7 never contradicts it. A unit not determined leaves the run not determined, owed where it is, unless a unit
 * broke: a break decides the run whatever the others read. ⛔ It read the root by `completion` alone: as intended, beside
 * the root's own cell, not determined.
 */
function stageSevenWhole(views: readonly UnitView[], rootUnreadable: string | null): MatrixCell {
	// ⛔ E3 (C5) — A RUN WITH NO UNIT HAS COMPLETED NOTHING. Half A always reads §3.2's five; half B reads the Undertaking's,
	// and a half-B run that stopped before it — a dry rehearsal, a candidate no one accepted — has none, which every-of-none
	// would read as intended: a "Yes" with nothing run.
	if (views.length === 0)
		return cell('7', WHOLE_RUN, 'not reached', [], ['the run holds no work unit: no Undertaking of the run was instantiated']);
	// ⚠ The root is the first unit in both halves, as `buildRunReport` reads it (`cellsOf`).
	const perUnit = views.map((v, i) => {
		const own = completion(v, v.unit.slug);
		return i === 0 && rootUnreadable !== null ? failedClosed([own], v.unit.slug, rootUnreadable)[0]! : own;
	});
	const broke = perUnit.filter((c) => c.value === 'broke');
	const undetermined = perUnit.filter((c) => c.value === null);
	let value: CellValue | null = 'as intended';
	if (broke.length > 0) value = 'broke';
	else if (undetermined.length > 0) value = null;
	else if (perUnit.some((c) => c.value === 'not reached')) value = 'not reached';
	/**
	 * ⭐ R3-B F4 (the lead's round-3 item 4) — a unit whose sign-off the lane
	 * skipped, and whose cell reads it so, says why on its line: the root has no row of its own in half A, and its line was all
	 * a reader had of its skipped sign-off.
	 */
	const lineOf = (c: MatrixCell, v: UnitView): string => {
		// ⭐ R4 (the lead's round-4 item 4) — a unit not determined says why on its line: its reason comes first (`failedClosed`).
		if (c.value === null) return `${c.row}: not determined — ${c.basis[0]}`;
		// ⭐ P5 package B (F3, F6) — and so does a unit whose sign-off the lane HELD BACK, and a composite whose declared reviews
		// a unit below it contributed no work to: the root's line is all half A has of either.
		const why = [skippedWhy(v), v.heldBack === null ? null : heldWhy(v.heldBack), seenLine(v)].find(
			(w): w is string => w !== null && c.basis.includes(w)
		);
		return why === undefined ? `${c.row}: ${c.value}` : `${c.row}: ${c.value} — ${why}`;
	};
	return cell(
		'7',
		WHOLE_RUN,
		value,
		broke.flatMap((c) => c.registerIds),
		[
			...perUnit.map((c, i) => lineOf(c, views[i]!)),
			'measured as every unit, the root included, SATISFIED in lifecycle and assurance, its plan step SUCCEEDED: an ' +
				'Undertaking has no completion state (REG-F-533)'
		],
		{ unregistered: broke.some((c) => c.unregistered === true), owedTo: value === null ? undetermined[0]?.owedTo : undefined }
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
function judgedVerdict(
	ix: Index,
	a: StoredObject
): Omit<DeclaredVerdict, 'assessmentId' | 'unit' | 'validatorId' | 'supersededBy'> {
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
	const verdicts = ix.ofType('ASSURANCE_ASSESSMENT').flatMap((a): DeclaredVerdict[] => {
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
					basis: ['signed off before E2, from the policy’s required evidence alone (REG-F-523)'],
					supersededBy: null
				}
			];
		if (!judged.includes(validatorId)) return [];
		return [{ assessmentId: a.id, unit, validatorId, ...judgedVerdict(ix, a), supersededBy: null }];
	});
	return supersessions(ix, verdicts);
}

/**
 * ⭐⭐ E12's polish (fix2's F9; the lead's delegated decision of 2026-10-15, to be registered) — WHICH DECLARED VERDICT SPEAKS
 * for each (subject, policy): the latest, read as the product reads it — by the assessment's `updatedAt`, ties to the last made
 * (`declared-policy-signoff.ts` `latestDeclaredVerdicts`, the kernel's `latestAssessmentByPolicy`) — and each earlier one names
 * it (`supersededBy`). ⛔ Every verdict was read as speaking: `REG-D-112` (a) keeps the INCONCLUSIVE review beside its re-run,
 * so a unit the rule recovered still read 5b broke from the review the re-run replaced, and the heading counted 15 of 14.
 */
function supersessions(ix: Index, verdicts: readonly DeclaredVerdict[]): DeclaredVerdict[] {
	const keyOf = (d: DeclaredVerdict): string =>
		`${strs(ix.byId.get(d.assessmentId)?.state.subjectObjectIds)[0] ?? ''} ${d.policyId}`;
	const speaks = new Map<string, { readonly id: string; readonly at: string }>();
	// ⚠ In the order made: `ofType` sorts by each assessment's first event, the order `listAssessments` reads them in.
	for (const d of verdicts) {
		const at = str(ix.byId.get(d.assessmentId)?.state.updatedAt);
		const prev = speaks.get(keyOf(d));
		if (prev === undefined || at >= prev.at) speaks.set(keyOf(d), { id: d.assessmentId, at });
	}
	return verdicts.map((d) => {
		const id = speaks.get(keyOf(d))!.id;
		return id === d.assessmentId ? d : { ...d, supersededBy: id };
	});
}

function unitView(
	ix: Index,
	u: Unit,
	units: readonly Unit[],
	lane: LaneRows,
	pairing: PairingReport,
	declared: readonly DeclaredVerdict[],
	history: readonly DeclaredVerdict[]
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
		runs: unitRuns(u, units, lane, ix),
		declared: declared.filter((d) => d.unit === u.slug),
		superseded: history.filter((d) => d.unit === u.slug),
		signOffAttempted:
			u.lane?.signOffAttempted === true ||
			actions.some((a) => a.action === 'recordAssurance' || a.action === 'markSatisfied'),
		heldBack: u.lane?.signOffHeldBack ?? null,
		exchanges: {
			total: exchanges.length,
			broken: readings.filter((r) => r === 'does not hold what it claims').length,
			unretained: readings.filter((r) => r === 'not retained').length
		},
		contentStore: ix.content !== null,
		children: childrenOf(ix, u, units),
		workSeen: declared.some((d) => d.unit === u.slug) ? workSeenOf(ix, u, units) : null
	};
}

/**
 * ⭐⭐ P5 package B (F6) — WHAT A UNIT COMPOSED OF OTHERS HAD ITS DECLARED REVIEWS JUDGED OVER, as the route gathers it
 * (`declaredReviewWorkOf`): the work of each unit below it that holds a completion — and each that holds none, with its
 * lifecycle and assurance states, contributed none; and, for the root, each planned unit the store does not hold. Null
 * when every unit below it holds a completion and none is missing, and for a unit with none below it. ⛔ P5's root read
 * "judged over the work it and every unit below it produced" with its end-to-end phase abandoned and none of it shown.
 */
function workSeenOf(ix: Index, u: Unit, units: readonly Unit[]): string | null {
	const id = u.object?.id;
	if (id === undefined) return null;
	const all = ix.ofType('PROFESSIONAL_WORK_UNIT');
	const completed = (unitId: string): boolean => {
		const plans = new Set(ix.ofType('EXECUTION_PLAN').filter((p) => str(p.state.workUnitId) === unitId).map((p) => p.id));
		return ix.eventsOfType('ExecutionStepSucceeded').some((e) => plans.has(e.aggregateId));
	};
	const below: StoredObject[] = [];
	const walk = (parent: string): void => {
		for (const child of all.filter((p) => str(p.state.parentWorkUnitId) === parent)) {
			below.push(child);
			walk(child.id);
		}
	};
	walk(id);
	if (below.length === 0) return null;
	const missing = u === units[0] ? units.slice(1).filter((x) => x.object === null).map((x) => x.title) : [];
	const none = below.filter((p) => !completed(p.id));
	if (none.length === 0 && missing.length === 0) return null;
	const given = below.filter((p) => completed(p.id)).map((p) => str(p.state.title));
	return (
		`the work of ${given.join(', ') || 'no unit below it'}` +
		none
			.map(
				(p) =>
					`; ${str(p.state.title)} contributed none, holding no completion (lifecycle ${str(p.state.workLifecycleState)}, ` +
					`assurance ${str(p.state.assuranceState)})`
			)
			.join('') +
		missing.map((t) => `; ${t} contributed none, the store holding no such unit`).join('')
	);
}

/** ⭐ P5 package B (F6) — the line a composite's completion carries of what its declared reviews were judged over, or null. */
const seenLine = (v: UnitView): string | null =>
	v.workSeen === null ? null : `its declared reviews were judged over ${v.workSeen}`;

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

function unitSummary(v: UnitView, findings: ReadonlyMap<string, readonly string[]>): UnitSummary {
	const u = v.unit;
	return {
		order: u.order,
		slug: u.slug,
		title: u.title,
		unitId: u.object?.id ?? null,
		state: v.state,
		step: u.plan ? { planId: u.plan.id, stepState: v.stepState, planStatus: str(u.plan.state.status) } : null,
		tries: triesOf(u),
		workProducts: u.artifacts.length,
		evidence: u.evidence.length,
		runs: v.runs,
		lane: u.lane
			? { beginExecute: u.lane.beginExecute, stopped: u.lane.stopped, upstreamNotAssured: u.lane.upstreamNotAssured }
			: null,
		modelRan: modelRanFor(u),
		candidateFindings: findings.get(u.typeId ?? str(u.object?.state.pwuTypeId)) ?? []
	};
}

/** ⭐ E3 (C5) — the candidate checks' findings, by the type each was found on: `<check> (<register ids>)`, in order. */
function findingsByType(lane: LaneRows): Map<string, string[]> {
	const byType = new Map<string, string[]>();
	for (const f of findingsOf(lane)) {
		const ids = f.registerIds.join(', ');
		append(byType, f.typeId, ids === '' ? f.check : `${f.check} (${ids})`);
	}
	return byType;
}

/** ⭐ E3 (C4) — the candidate checks' findings, as the lane recorded them, read loosely. */
function findingsOf(lane: LaneRows): { typeId: string; typeName: string; check: string; registerIds: string[]; detail: string }[] {
	const findings = rec(authoringOf(lane).checks).findings;
	return (Array.isArray(findings) ? (findings as unknown[]) : []).map((f) => {
		const r = rec(f);
		return {
			typeId: str(r.typeId),
			typeName: str(r.typeName),
			check: str(r.check),
			registerIds: strs(r.registerIds),
			detail: str(r.detail)
		};
	});
}

/** ⭐ E3 (C4, C5) — half B's authoring, as the report states it; null in half A. */
function authoringSummary(ix: Index, lane: LaneRows, half: RunHalf): AuthoringSummary | null {
	if (half !== 'B') return null;
	const a = authoringOf(lane);
	const pwaId = str(a.pwaId) || null;
	const floor = pwaId === null ? [] : floorDispositions(ix.ofType('ASSURANCE_ASSESSMENT'), pwaId);
	const candidate = rec(a.candidate);
	return {
		pwaId,
		candidate: {
			status: str(candidate.status) || null,
			hash: str(candidate.candidateHash) || null,
			detail: str(candidate.detail) || null
		},
		floor: floor.map((f) => ({ policyId: f.policyId, state: f.state })),
		author: {
			configured: str(rec(a.authorModel).configured) || null,
			// ⭐ C3 — as the page's turn named it: the store records no author for a turn.
			resolved: str(rec(a.authorModel).resolved) || floor.find((f) => f.producer !== null)?.producer || null
		},
		reviewer: floor.find((f) => f.policyId === REASONING_REVIEW)?.evaluator ?? (str(a.reviewer) || null),
		// ⭐ The check of 241158f4, finding 1 — the hash ACCEPTED, as stage 1 reads it: never a refused acceptance's.
		acceptedHash: acceptedHashIn(a),
		// ⭐ R3-B F5 — and how an acceptance that got no answer went unanswered, which stage 1 reads too.
		unanswered: unansweredAcceptance(a),
		findings: findingsOf(lane).map(({ typeId: _typeId, ...f }) => f),
		caveats: HALF_B_CAVEATS
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
	// ⭐ E3 — THE HALF THE RUN WAS, and in half B the PWA the lane authored into, whose units are read from it (C2).
	const half = halfOf(lane);
	const { undertakingId, units, structure } = resolveUnits(
		ix,
		laneUnits(lane.run),
		problems,
		half,
		str(authoringOf(lane).pwaId)
	);
	const pairing = buildPairing(ix, units);
	// ⭐ E12's polish (fix2's F9) — the verdicts that speak, the latest per (unit, policy), and the history beside them.
	const verdicts = declaredVerdicts(ix, units);
	const declared = verdicts.filter((d) => d.supersededBy === null);
	const history = verdicts.filter((d) => d.supersededBy !== null);
	const demoDb = str(rec(rec(lane.boot).overlay).JPWB_DEMO_DB);
	if (demoDb === '')
		problems.push('lane/boot.json names no JPWB_DEMO_DB: no recorded path can be made relative to the workspace');
	const workspace = demoDb === '' || undertakingId === null ? null : workspaceDirectoryFor(demoDb, undertakingId);
	const views = units.map((u) => unitView(ix, u, units, lane, pairing, declared, history));
	// ⭐ E12's polish (fix2's F10) — each unit composed of others, and the verdicts that speak the model reviewer made of it;
	// ⭐ R3-A F2 — and, apart from them, those a replay served it.
	const parents = new Set(ix.ofType('PROFESSIONAL_WORK_UNIT').map((p) => str(p.state.parentWorkUnitId)));
	const composites = units
		.filter((u) => u.object !== null && parents.has(u.object.id))
		.map((u) => ({
			unit: u.slug,
			reviews: declared.filter((d) => d.unit === u.slug && d.validatorId === DECLARED_REVIEW_VALIDATORS[0]).length,
			replayed: declared.filter((d) => d.unit === u.slug && d.validatorId === REPLAYED_DECLARED_REVIEW_VALIDATOR).length,
			// ⭐ P5 package B (F6) — what its reviews were judged over, as its completion says it (`workSeenOf`), its own words.
			seen: views.find((v) => v.unit === u)?.workSeen ?? null
		}));
	const endReason = str(rec(rec(lane.run).end).reason) || null;
	// ⛔ D4 — ~~every act the lane presses ends the run when it outlasts its bound~~ ⭐ E12's polish (fix3's F2): every act
	// the lane presses through `pressFormAction` (`phase7-operator.ts`) ends the run `allowance-exceeded` when it outlasts
	// its bound: a Begin & Execute, ⭐ E12's re-review F1 — a recovery act the rule pressed, and a sign-off act. So that end
	// names one of them. ⭐ `REG-D-112` (E3's review, finding 1) — but a half-B run whose AUTHORING outlasted its allowance
	// has no unit to name: that end is the turn's (`authoring-stopped`'s sibling), read from its own archive, `00-authoring`.
	const outlasted = (v: UnitView): boolean =>
		v.timedOut !== null || v.signOffOutlasted !== null || v.unit.lane?.recoveryOutlasted === true;
	if (endReason === 'allowance-exceeded' && views.length > 0 && !views.some(outlasted))
		problems.push(
			'lane/run.json ended allowance-exceeded, and names no unit whose Begin & Execute, recovery act or sign-off act outlasted its allowance'
		);
	// ⭐ The lead's delegated decision of 2026-10-15, to be registered (E3's polish; the confirm of 60c8a828) — THE
	// PHASES, whose cells stages 3 to 8 report: every unit after the root, which both halves put first; and THE ROOT
	// ITSELF when its type declares MODEL, as half B's agent may (the lane counts ~~its worst case~~ ⭐ one try's reserve before
	// its press, `rootLimitCheck`; `REG-D-114` (14), as amended 2026-10-16): its press runs a model, so its tries, reviews and exchanges are measured like any phase's.
	// ⛔ ~~Every root skipped by its place~~: a MODEL root that broke a stage read as intended. ⭑ §3.2's root declares
	// HUMAN and keeps its reading, in the whole run's stage 7.
	// ⭐ R3-B F6 (the lead's round-3 item 6) — AND A ROOT WHOSE TYPE CANNOT BE
	// READ FAILS CLOSED: measured as a phase, its cells reported, broke or not determined, each with why (`failedClosed`).
	// ⛔ Read as UNDECLARED, it was skipped by its place.
	const rootUnreadable = units[0] === undefined ? null : typeUnreadable(ix, units[0]);
	const phases = views.filter((v, i) => i > 0 || rootUnreadable !== null || dischargeOf(ix, v.unit) === 'MODEL');
	const cellsOf = (v: UnitView): MatrixCell[] =>
		v.unit === units[0] && rootUnreadable !== null
			? failedClosed(phaseCells(v, ix), v.unit.slug, rootUnreadable)
			: phaseCells(v, ix);
	const matrix: MatrixCell[] = [
		stageOne(ix, half, lane),
		stageTwo(undertakingId, structure),
		stageSevenWhole(views, rootUnreadable),
		...phases.flatMap(cellsOf)
	];
	const counts = Object.fromEntries(CELL_VALUES.map((value) => [value, matrix.filter((c) => c.value === value).length]));
	const mode = str(rec(lane.run).mode) || str(rec(lane.boot).mode) || null;
	const startedAt = str(rec(lane.boot).startedAt) || null;
	const runNote =
		`phase7 run (${mode ?? 'mode unrecorded'}${startedAt ? ', started ' + startedAt : ''}): ordinals are completion order, ` +
		`not start order (REG-F-518); runs past the ${RECORDED_RUN_LIMIT}nd are counted in report.json, not listed (REG-F-517)`;
	const { manifest, excluded } = buildManifest(ix, units, lane, workspace, o.accountNames, runNote);
	const cellCounts = counts as Record<CellValue, number>;
	const findings = findingsByType(lane);
	const report: RunReport = {
		tool: 'phase7/run-report',
		reportVersion: 1,
		basis: 'HEAD plus P7-2b',
		run: {
			mode,
			half,
			startedAt,
			endReason,
			archiveRead: lane.archiveRead,
			archivesPresent: lane.archives.map((a) => a.name),
			events: store.events.length,
			objects: store.objects.length,
			contentRows: store.content === null ? null : store.content.length
		},
		answer: {
			// ⭐ `E12F` F10 — and the `REG-F-523` line where this run's declared verdicts carry no criterion result; ⭐ E12's polish
			// (fix2's F10) — and the UNIT_PURPOSE line where the model reviewer judged a unit composed of others.
			alwaysStated: [...ALWAYS_STATED, ...uncheckedCaveat(declared), ...unitPurposeCaveat(composites)],
			counts: cellCounts,
			open: matrix.filter((c) => c.value === null).length,
			measured: cellCounts['as intended'] + cellCounts.broke,
			brokeUnregistered: matrix.filter((c) => c.unregistered === true).length
		},
		matrix,
		units: views.map((v) => unitSummary(v, findings)),
		authoring: authoringSummary(ix, lane, half),
		pairing,
		reviewerCalls: buildReviewerCalls(ix, units, lane),
		audit: buildAudit(ix, units, undertakingId, lane),
		// ⭐ E3 — half B's declared verdicts are the agent's policies: each unit's, as instantiation copied them from its type.
		// ⭐ R3-B F3 (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (16)) — ~~each unit's own list~~: THE
		// KERNEL'S DECLARED SET of each unit (`declaredPoliciesOf`), the set the lane counts its limit by (J1).
		declaredVerdicts: {
			expected:
				half === 'B'
					? units.reduce((n, u) => n + declaredPoliciesOf(ix, u).length, 0)
					: DECLARED_VERDICTS_EXPECTED,
			rows: declared,
			history
		},
		adjudication: {
			classes: ADJUDICATION_CLASSES,
			rows: pairing.rows.map((row) => adjudicationRow(ix, units, row, workspace, o.accountNames))
		},
		manifest: {
			commands: manifest.commands.length,
			excluded: excluded.length,
			ordinal:
				'completion order: the order the host recorded each run as finished, which is not the order it started them (REG-F-518)',
			unrecordedRuns: Object.fromEntries(phases.map((v) => [v.unit.slug, v.runs.unrecorded]))
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
	// ⭐ E3 (C2) — the run's own phases: §3.2's four in half A, the agent's in half B. ⭐ The lead's delegated decision of
	// 2026-10-15, to be registered — read off the matrix, the units it holds cells for: a root that declares MODEL is one
	// (`buildRunReport`), never dropped by its place.
	const phases = r.units.map((u) => u.slug).filter((slug) => r.matrix.some((c) => c.row === slug));
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
	// ⭐ By the one rule (`runStanding`): ~~limit.under ? ', under it' : ', NOT under it'~~.
	const under = limit.total === null ? '' : `, ${runStanding(limit.total, limit.limit)}`;
	return [
		'## The units',
		'',
		...(r.run.half === 'B'
			? halfBUnitTable(r)
			: [
					'| # | Unit | Lifecycle | Assurance | Execution | Step | Tries | Evidence | Unrecorded runs |',
					'|---|---|---|---|---|---|---|---|---|',
					...r.units.map(
						(u) =>
							`| ${u.order} | ${u.slug} | ${u.state?.lifecycle ?? '—'} | ${u.state?.assurance ?? '—'} | ` +
							`${u.state?.execution ?? '—'} | ${u.step?.stepState ?? '—'} | ${u.tries.length} | ${u.evidence} | ` +
							`${u.runs.unrecorded ?? 'unknown'} |`
					)
				]),
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
		),
		// ⭐ `REG-D-114` (14), as amended 2026-10-16 — the reads' plain caveat (`LIMIT_CAVEAT`).
		`- **Caveat:** ${r.reviewerCalls.limitCaveat}`
	];
}

/**
 * ⭐ E3 (C5) — HALF B'S UNITS TABLE: half A's columns, and beside them whether a model ran for the unit and what the
 * candidate checks found on its type before Submit — so a trap's finding stands next to what the unit then did.
 */
function halfBUnitTable(r: RunReport): string[] {
	return [
		'| # | Unit | Title | Lifecycle | Assurance | Execution | Step | Tries | Model ran | Candidate findings |',
		'|---|---|---|---|---|---|---|---|---|---|',
		...r.units.map(
			(u) =>
				`| ${u.order} | ${u.slug} | ${esc(u.title)} | ${u.state?.lifecycle ?? '—'} | ${u.state?.assurance ?? '—'} | ` +
				`${u.state?.execution ?? '—'} | ${u.step?.stepState ?? '—'} | ${u.tries.length} | ${u.modelRan ? 'yes' : 'no'} | ` +
				`${esc(u.candidateFindings.join('; ') || 'none')} |`
		)
	];
}

/** ⭐ E3 (C4, C5) — half B's authoring section: the floor, the reviewer, the author, the accepted hash, the checks. */
function authoringLines(r: RunReport): string[] {
	const a = r.authoring;
	if (a === null) return [];
	return [
		'## Half B — the authoring (design §4 C1 to C5)',
		'',
		`- **The PWA:** ${a.pwaId ?? 'none'}; the candidate as last read: ${a.candidate.status ?? 'none'}` +
			`${inParens(a.candidate.detail)}, ${a.candidate.hash ?? 'no hash'}.`,
		`- **The authoring floor, as the store holds it:** ${a.floor.map((f) => `${f.policyId} ${f.state}`).join(', ') || 'none'}.`,
		`- **The reviewer:** ${a.reviewer ?? 'none recorded'}. **The author:** ${a.author.resolved ?? 'none recorded'} ` +
			`(configured: ${a.author.configured ?? 'unset'}).`,
		// ⭐ R3-B F5 — ~~${a.acceptedHash ?? 'none'}~~: with no answer, none RECORDED, and the server may still have accepted one.
		`- **The accepted hash:** ${a.acceptedHash ?? acceptedNone(a.unanswered)}.`,
		`- **The candidate checks (C4), recorded before Submit, refusing nothing (REG-D-110 (4)):** ` +
			`${plural(a.findings.length, 'finding', 'findings')}.`,
		...a.findings.map(
			(f) => `  - ${f.check} on "${f.typeName}"${f.registerIds.length === 0 ? '' : ` (${f.registerIds.join(', ')})`}: ${f.detail}.`
		),
		'- **Measured as they are, and disclosed:**',
		...a.caveats.map((c) => `  - ${c}`)
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
	// ⭐ E12's polish (fix2's F9) — a superseded verdict is history: its value said, and the verdict that superseded it.
	const value = d.supersededBy === null ? d.value : `${d.value}; history: superseded by ${d.supersededBy}`;
	return (
		`| ${d.assessmentId} | ${d.unit ?? '—'} | ${d.policyId} | ${d.state} | ${d.criteria.answered} of ${d.criteria.declared} | ` +
		`${follows} | ${value} |`
	);
}

function verdictLines(r: RunReport): string[] {
	const unrecorded = Object.entries(r.manifest.unrecordedRuns)
		.map(([u, n]) => `${u} ${n ?? 'unknown'}`)
		.join('; ');
	const history = r.declaredVerdicts.history;
	return [
		// ⭐ E2 (design B8) — ~~"each vacuous by construction"~~: each read from its recorded criterion results. ⭐ E12's polish
		// (fix2's F9) — the count is of the verdicts that speak; each one superseded is listed under the verdict that superseded it.
		`## The declared verdicts (P7-4g) — ${r.declaredVerdicts.rows.length} of ${r.declaredVerdicts.expected}, each read from its recorded criterion results` +
			(history.length === 0
				? ''
				: `; ${plural(history.length, 'verdict', 'verdicts')} superseded, each listed as history beside the one that superseded it (REG-D-112 (a))`),
		'',
		'| Assessment | Unit | Policy | State | Criteria answered | Follows from its answers | Value |',
		'|---|---|---|---|---|---|---|',
		...r.declaredVerdicts.rows.flatMap((d) => [
			declaredLine(d),
			...history.filter((h) => h.supersededBy === d.assessmentId).map(declaredLine)
		]),
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
		// ⭐ E3 (C5) — half B's authoring, after the matrix whose stage 1 it measured; nothing in half A.
		...(r.authoring === null ? [] : [...authoringLines(r), '']),
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
