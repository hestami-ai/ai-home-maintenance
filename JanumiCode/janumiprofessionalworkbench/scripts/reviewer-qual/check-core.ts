// ⭐ `JAN-CRITREAD` J2-3 — THE CORE OF `reviewer:qual:check` (DESIGN-what-the-tests-prove.md §5.6; ROADMAP J2-3 + J2-4).
//
// A STATIC CHECK THAT RUNS NO MODEL. Every record not SUPERSEDED is in its population, whatever fingerprint it carries —
// so whether a failure has been written up is a property of the record that holds it, not of the definition currently
// in force, and no later change of definition, acknowledgement or re-run can retire it. Three limbs:
//   1. COVERAGE — every current case, by TODAY's prompt hashes, MEASURED (answered, or failed at the transport ⭐ or cut by
//      the tool at the model's output-token limit, P5 package A's class, `noReplyToScore`) in a RUN,
//      or a RESCORED record, carrying today's fingerprint. A scoring-only move is discharged by RESCORED lines; a move
//      of the prompt side (the probe set, the budget, the criteria) that no recorded case prompt shows owes an
//      ACKNOWLEDGED line besides, WHATEVER RUNS EXIST under the new fingerprint; a case whose prompt changed owes a
//      model call. A record stamped with today's fingerprint under another scoring digest is refused and counts for
//      nothing: nothing this tree records can carry both.
//      ⭐ AND A RUN MUST FINISH WITHIN ONE SERVER-CLOCK DAY (§5.3; `REG-F-429`): an Ollama run whose calls fall on two
//      of the server's calendar days counts for nothing. The server's own date is the recorded `Date` header (GMT)
//      shifted by the UTC offset the run recorded from `/api/ps` (`REG-D-074`).
//   2. REPRODUCTION — for records carrying today's fingerprint, and the sources of today's RESCORED lines: each case
//      still in the set recomputes to the prompt it recorded, and, wherever the scoring digest is today's, each
//      re-scorable evaluation re-scores to the outcome recorded at run time. A mismatch is discharged only by a
//      SUPERSEDED line citing a register finding — accepted only for a record that really fails this limb, and only once
//      its material failures are cited; a struck record then counts for nothing.
//   3. ESCALATION — every material failure (§5.1) in every record not struck, intermediate runs included, cited by an
//      ESCALATION line naming an OPEN finding the register holds — a struck heading (`### ~~REG-F-NNN~~`) is closed.
//      ⭐ THE PASS BAR IS THE RIGHT VERDICT (`JAN-CRITREAD` J2-6; `REG-D-080`; §5.1 as amended): the material classes
//      are the verdict-level ones (`record.ts`). Which criterion a planted case faults — against its oracle's
//      `faulted` list — is ATTRIBUTION, and the criterion-level transitions (a planted criterion no longer faulted, an
//      answered criterion now UNABLE_TO_DETERMINE) are informational: both REPORTED for every record this limb reads,
//      and never escalated. An ESCALATION line already citing what is now reported stays valid history: nothing
//      requires a line to cite a material failure, and the record is append-only.
// ⭐⭐ `E12F` F5 (`REG-D-073`) — AND A LIMB BEFORE THE THREE, CONFERRAL: today's oracles must be CONFERRED. A current oracle
// set whose `conferral` carries `ORACLES_PROPOSED` is a CONFERRAL problem, whatever the record holds — a run over oracles
// their author alone has judged measures the reviewer against the author's word, and must not turn the check green.
// ⛔ It was a comment's promise only (`oracles-v5.ts`: "read by the check"): nothing here read the conferral, so a run over
// version five made before the sponsor conferred its fourteen declared oracles would have been green.
// ⭐ B8a (`REG-D-127`) — and one whose `conferral` carries `ORACLES_RESTATEMENT_UNCONFIRMED` is a CONFERRAL problem of its own
// (`RESTATEMENT_NOT_CONFIRMED`): conferred verdicts on cases restated since, the sponsor's confirmation of the restatement owed.
// ⭐ `JAN-SELREV` SR-4 — THE GATE HOLDS THE SELECTED REVIEWER TO TODAY'S DEFINITION (`REG-D-086`; DESIGN-the-selected-
// reviewer.md §5 Q1). The LAST SELECTION line in the record is in force. With one in force, limb 1 asks its own
// question — covered, in exactly its sense (`coveredBy`) — again of the selected candidate's runs alone, and a case no
// run or re-stamp OF IT covers is a COVERAGE problem naming the candidate and its ruling. With none in force, nothing
// here runs: the check is what it was before SR-4.
// And the cross-file references `REG-D-074` left here: a run id is declared once across the record; a RESCORED line's
// source evaluation, an ESCALATION's run and cases, a SUPERSEDED line's record, an ACKNOWLEDGED line's cases all exist;
// every cited finding is an entry of the register, and every SELECTION's ruling. Two runs of one candidate on one date
// are ordered by the record. ⭐⭐ D3c (`REG-D-132`; `REG-F-576`) — an ACKNOWLEDGED line's cases ~~exist in today's case set~~
// are all held by ONE committed case set, today's included (`acknowledgedRefs`): a line keeps the cases it was written over.
//
// ⚠ PURE: records, today's fingerprint, the cases, the oracles and the register's findings are handed in, and the one
// operation that needs the product — re-scoring — is a function handed in (`rescore.ts` in the CLI). It reads no file.
// ⚠ "CONTENT UNCHANGED" IS THE CASE ID: a case that changes gets a new id (`cases.ts`), so a case id still in today's set
// is the same case. A case edited in place under its id reads here as a non-reproduction — which it is. ⚠ Version nine's 35
// part cases are the exception `cases.ts` states: carried under their ids with their inputs moved (`REG-D-127`), so a
// record of version eight's, under its earlier fingerprint, covers none of them — their prompts are not today's.
// ⚠ ⭐ B8b (`REG-D-130`; package I's check, finding 1) — version ten ~~carries~~ carried version nine's 19 bridge part cases so
// too, but under an UNMOVED fingerprint: version nine's run of them carries today's, so limb 2 read each as a non-reproduction —
// which, by this file's rule, it was — discharged only by a SUPERSEDED line, which strikes the whole run. ~~The check test's
// B8b describe pins it; how it is discharged is the lead's to settle.~~ ⭐ Settled by `REG-D-132` (D3b (8); `REG-F-575`): the 19
// take new ids, their content unchanged, so version nine's run records no current id whose prompt moved, and this rule holds
// again with no exception for version ten. The check test's B8b describe pins the new state.
import {
	ORACLES_PROPOSED,
	ORACLES_RESTATEMENT_UNCONFIRMED,
	type Oracle,
	type OracleSet,
	type QualificationCase
} from './cases.js';
import { canonicalJson, reviewerFingerprintOf, type FingerprintComponents } from './digest.js';
import {
	callPromptIsToday,
	MATERIAL_FAILURE_CLASSES,
	noReplyToScore,
	promptsAreToday,
	recordProblems,
	restampable,
	serverDayOf,
	type AcknowledgedLine,
	type CallLine,
	type CasePromptHashes,
	type CriterionRepairPromptOf,
	type EscalationLine,
	type HeldOutLine,
	type MaterialFailureClass,
	type RecordLine,
	type RescoredLine,
	type RunLine,
	type ScoredOutcome,
	type SelectedCandidate,
	type SelectionLine,
	type SupersededLine
} from './record.js';

/** ⭐⭐ D3c (`REG-D-132`) — one committed case set, as the check reads it: its version and its cases' ids, in its order. */
export interface CommittedCaseSet {
	readonly caseSetVersion: number;
	readonly caseIds: readonly string[];
}

/** Today's reviewer, as `fingerprint.ts` computes it. */
export interface CurrentReviewer {
	readonly reviewer: string;
	readonly scoring: string;
	readonly caseSet: string;
	readonly components: FingerprintComponents;
	// ⭐ P7-6 I5 — each call role's hash, the criterion repair's among them (`record.ts` `CALL_ROLES`), so a recorded call is
	// held to the prompt today's reviewer sends for the repair it was.
	readonly casePrompts: CasePromptHashes;
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7, package L — D13 (`REG-D-135` (3)) — the criterion repair today's reviewer sends after a recorded
	 * reply (`fingerprint.ts` `criterionRepairAfter`): D13's repair prompt depends on the reply before it. ⚠ Absent, only the
	 * per-case hashes are today's, and a recorded missing-criterion repair owes a model call — the safe side.
	 */
	readonly criterionRepairAfter?: CriterionRepairPromptOf;
}
export interface CheckInputs {
	/** The record's top-level `*.ndjson` files git tracks, by name, as they stand. */
	readonly files: readonly { readonly name: string; readonly text: string }[];
	/**
	 * ⭐ `JAN-CRITREAD` J2-3 — the record files the CLI would NOT read, and why: untracked, changed since they were
	 * staged, or staged but gone. Each is a RECORD problem, so the check a person runs locally says what the committed
	 * record would say (`check.ts`). ⭐ Package J's check, item 2 — and the committed case-set files it would not read, so
	 * (D3c), each named by its path in the repository: an untracked or edited case set holds no ACKNOWLEDGED line.
	 */
	readonly refusedFiles?: readonly { readonly name: string; readonly why: string }[];
	readonly current: CurrentReviewer;
	/** Today's case set. */
	readonly cases: readonly QualificationCase[];
	/** Today's oracles — material failures are judged against the current oracle version (§5.1). */
	readonly oracles: readonly Oracle[];
	/**
	 * ⭐ `E12F` F5 — today's oracle set's `conferral` statement, as its file carries it: a statement carrying
	 * `ORACLES_PROPOSED` is refused (`ORACLES_NOT_CONFERRED`). Required, so a caller cannot leave the question unasked.
	 */
	readonly conferral: string;
	/**
	 * ⭐ `JAN-CRITREAD` J2-6 — EVERY oracle version on file, today's among them. Nothing is judged against them: they say
	 * only which of a record's cases OUTSIDE today's set its own oracle version planted, so the attribution report
	 * counts those evaluations out aloud instead of shrinking in silence (`REG-D-080`).
	 */
	readonly oracleSets: readonly OracleSet[];
	/**
	 * ⭐⭐ D3c (`REG-D-132`; `REG-F-576`) — EVERY CASE SET VERSION ON FILE, today's among them, as the CLI reads them from the
	 * committed case directory ⭐ as git tracks it, each file exactly as staged (package J's check, item 2): each one's version
	 * and its cases' ids. An ACKNOWLEDGED line carries no case set (`record.ts`), so
	 * its `addedCaseIds` are held to these — all of them to ONE — and to today's set (`cases`), which counts as one of them
	 * whether it is listed here or not. Required, so a caller cannot leave the question unasked: handed none, the check holds a
	 * line to today's set alone, as it did before D3c.
	 */
	readonly caseSets: readonly CommittedCaseSet[];
	/** The register findings that have an entry (`### REG-F-NNN`, struck or not — `registerFindings`). */
	readonly findings: ReadonlySet<string>;
	/** ⭐ Those among them whose heading is STRUCK (`### ~~REG-F-NNN~~`) — closed. A struck finding escalates nothing. */
	readonly struck: ReadonlySet<string>;
	/** ⭐ `JAN-SELREV` SR-4 — the register rulings that have an entry (`### REG-D-NNN`, struck or not — `registerRulings`). */
	readonly rulings: ReadonlySet<string>;
	/** ⭐ Those among them whose heading is STRUCK (`### ~~REG-D-NNN~~`) — withdrawn. A withdrawn ruling selects nothing. */
	readonly struckRulings: ReadonlySet<string>;
	/** Re-score one recorded evaluation through TODAY's path under `scoringDigest`, with no model call; throws when it
	 *  cannot be re-scored. */
	readonly rescore: (
		run: RunLine,
		c: QualificationCase,
		calls: readonly CallLine[],
		scoringDigest: string
	) => Promise<ScoredOutcome>;
}
export type CheckLimb = 'RECORD' | 'CONFERRAL' | 'COVERAGE' | 'REPRODUCTION' | 'ESCALATION';

/**
 * ⭐⭐ `E12F` F5 (`REG-D-073`) — THE CONFERRAL PROBLEM: today's oracles are proposed, not conferred, so no run over today's
 * case set can qualify a reviewer against them. Named once, here, so the check and its test say the same words.
 * ⚠ It fires on every set with oracles awaiting the sponsor, so it names no one version's step: it sends the operator to the
 * current oracle file's conferral statement, which names them (package P's check, N5).
 * ⭐ The review in parts, package D (design §8, the conferral message) — AND IT SAYS ONLY WHAT THE CHECK READ: the oracle
 * file's statement, never the register. ⛔ It said *"their author proposed them and the sponsor has not conferred them"*,
 * false from `REG-D-124`'s ruling until its code record: a conferral can stand in the register while the record lags. So it
 * names both things that can be owed.
 */
export const ORACLES_NOT_CONFERRED =
	`today’s oracle file records oracles as ${ORACLES_PROPOSED}, and records no conferral of them, so no run over today’s ` +
	'case set can qualify a reviewer against them — owed: the sponsor’s conferral, or, where the register already holds it, ' +
	'its record in the current oracle file’s conferral statement (REG-D-073; the current oracle file’s conferral statement ' +
	'names what is owed)';
/**
 * ⭐⭐ B8a (`REG-D-127`) — THE CONFERRAL PROBLEM OF A RESTATEMENT: today's oracle file records verdicts the sponsor conferred, on
 * cases whose inputs were restated since, and the sponsor's confirmation of the restatement as owed
 * (`ORACLES_RESTATEMENT_UNCONFIRMED`). ⛔ Never `ORACLES_NOT_CONFERRED`'s words, which would say the verdicts were never
 * conferred: it says only what the check read — the verdicts recorded conferred, the restatement's confirmation owed.
 */
export const RESTATEMENT_NOT_CONFIRMED =
	`today’s oracle file records verdicts the sponsor conferred, on cases restated since, as ${ORACLES_RESTATEMENT_UNCONFIRMED}, ` +
	'so no run over today’s case set can qualify a reviewer against them — owed: the sponsor’s confirmation of the restated ' +
	'cases, or, where the register already holds it, its record in the current oracle file’s conferral statement (REG-D-127; ' +
	'the current oracle file’s conferral statement names the restated cases)';
export interface CheckProblem {
	readonly limb: CheckLimb;
	readonly message: string;
}
export interface CheckReport {
	/** Empty means green. */
	readonly problems: readonly CheckProblem[];
	/** What the check saw but does not redden on — confounds, runs that count for nothing. */
	readonly notes: readonly string[];
	/**
	 * ⭐ `JAN-CRITREAD` J2-6 (`REG-D-080`) — ATTRIBUTION, one entry per record limb 3 reads that measured a planted case
	 * or moved at the criterion level: the planted criterion named in N of M answered planted evaluations, against
	 * today's oracles' `faulted` lists, with the answered planted evaluations of cases outside today's set counted OUT
	 * ALOUD; each evaluation that did not name it, with its verdict and what it faulted; and the criterion-level
	 * transitions since the same candidate's previous run — a planted criterion no longer faulted (`FAULT_LOST`), an
	 * answered criterion now UNABLE_TO_DETERMINE (`ANSWERED_NOW_UNDETERMINED`). Reported, NEVER a material failure — it
	 * never reddens. A miss under a wrong verdict is listed as such: that verdict is what limb 3 escalates.
	 */
	readonly attribution: readonly string[];
	/**
	 * ⭐ `JAN-SELREV` SR-4 — the SELECTION in force, if any: the selected candidate, the ruling it rests on, where its line
	 * is, and how that ruling stands in the register (`RulingStanding`) — so a SELECTION whose ruling is withdrawn, or
	 * not held, is never reported in force unqualified. Undefined when the record holds none — and then the check is
	 * exactly what it was before SR-4.
	 */
	readonly selection:
		| {
				readonly candidate: SelectedCandidate;
				readonly ruling: string;
				readonly at: string;
				readonly standing: RulingStanding;
		  }
		| undefined;
}

/** Every entry of one series the register's headings name (`### REG-X-NNN`), and those whose heading is struck
 *  (`### ~~REG-X-NNN~~`). An id with a live heading anywhere is live. */
function registerHeadings(register: string, series: 'F' | 'D'): { entries: Set<string>; struck: Set<string> } {
	const live = new Set([...register.matchAll(new RegExp(`^### (REG-${series}-\\d+)\\b`, 'gm'))].map((m) => m[1]!));
	const struck = new Set(
		[...register.matchAll(new RegExp(`^### ~~(REG-${series}-\\d+)\\b`, 'gm'))].map((m) => m[1]!).filter((id) => !live.has(id))
	);
	return { entries: new Set([...live, ...struck]), struck };
}

/**
 * ⭐ `JAN-CRITREAD` J2-3 — THE REGISTER'S FINDINGS, as its headings name them: every `### REG-F-NNN` entry, and those
 * whose heading is struck (`### ~~REG-F-NNN~~`, a closed finding). An id with a live heading anywhere is live.
 */
export function registerFindings(register: string): { findings: Set<string>; struck: Set<string> } {
	const { entries, struck } = registerHeadings(register, 'F');
	return { findings: entries, struck };
}

/**
 * ⭐ `JAN-SELREV` SR-4 — THE REGISTER'S RULINGS, read as its findings are: every `### REG-D-NNN` entry, and those whose
 * heading is struck (`### ~~REG-D-NNN~~`, a withdrawn ruling). A SELECTION's ruling must be one of them.
 */
export function registerRulings(register: string): { rulings: Set<string>; struck: Set<string> } {
	const { entries, struck } = registerHeadings(register, 'D');
	return { rulings: entries, struck };
}

// ── the record, read ────────────────────────────────────────────────────────────────────────────────────────────────

interface At<L> {
	readonly line: L;
	/** `file:line`. */
	readonly at: string;
}
/** One case repetition's calls in one run, in order. */
interface Evaluation {
	readonly caseId: string;
	readonly repetition: number;
	readonly calls: CallLine[];
}
interface Run {
	readonly run: RunLine;
	readonly file: string;
	readonly at: string;
	/** Its place in the record — files by name, lines in order: what orders two runs of one date. */
	readonly order: number;
	readonly evaluations: Map<string, Evaluation>;
}
const evaluationKey = (caseId: string, repetition: number) => `${caseId}#${repetition}`;
const lastOf = (e: Evaluation): CallLine => e.calls[e.calls.length - 1]!;
/** An evaluation is complete when its last call carries the outcome — a run stopped part-way leaves one that is not. */
const complete = (e: Evaluation): boolean => lastOf(e).scored !== null;
/**
 * An evaluation with a call that left no reply to score: cut at the transport — ⭐ or (P5 package A, F2) cut by the tool at
 * the model's output-token limit (`noReplyToScore`), read alike: measured, never re-scored, a Boundedness failure.
 */
const transportFailed = (e: Evaluation): boolean => e.calls.some((c) => noReplyToScore(c.reply));
const scoredOf = (e: Evaluation): ScoredOutcome => lastOf(e).scored!;

interface Parsed {
	readonly runs: Map<string, Run>;
	readonly rescored: At<RescoredLine>[];
	readonly escalations: At<EscalationLine>[];
	readonly acknowledged: At<AcknowledgedLine>[];
	readonly superseded: At<SupersededLine>[];
	readonly heldOut: At<HeldOutLine>[];
	/** ⭐ `JAN-SELREV` SR-4 — in record order: the last is in force (`selectionInForce`). */
	readonly selections: At<SelectionLine>[];
}
type Refuse = (message: string) => void;

function addRun(line: RunLine, file: string, at: string, p: Parsed, refuse: Refuse): void {
	const first = p.runs.get(line.runId);
	if (first) refuse(`${at}: RUN ${line.runId} is declared again — first at ${first.at}; a run id is used once across the record`);
	else p.runs.set(line.runId, { run: line, file, at, order: p.runs.size, evaluations: new Map() });
}
function addCall(line: CallLine, file: string, p: Parsed): void {
	// `recordProblems` holds a CALL to an earlier RUN of its own file; a run id declared first in another file is
	// refused above, and its calls are read with it.
	const run = p.runs.get(line.runId);
	if (!run || run.file !== file) return;
	const key = evaluationKey(line.caseId, line.repetition);
	const e = run.evaluations.get(key) ?? { caseId: line.caseId, repetition: line.repetition, calls: [] };
	e.calls.push(line);
	run.evaluations.set(key, e);
}
function addLine(line: RecordLine, file: string, at: string, p: Parsed, refuse: Refuse): void {
	switch (line.kind) {
		case 'RUN':
			return addRun(line, file, at, p, refuse);
		case 'CALL':
			return addCall(line, file, p);
		case 'RESCORED':
			return void p.rescored.push({ line, at });
		case 'ESCALATION':
			return void p.escalations.push({ line, at });
		case 'ACKNOWLEDGED':
			return void p.acknowledged.push({ line, at });
		case 'SUPERSEDED':
			return void p.superseded.push({ line, at });
		case 'HELD_OUT':
			return void p.heldOut.push({ line, at });
		case 'SELECTION':
			return void p.selections.push({ line, at });
	}
}
function parse(i: CheckInputs, problems: CheckProblem[]): Parsed {
	const p: Parsed = { runs: new Map(), rescored: [], escalations: [], acknowledged: [], superseded: [], heldOut: [], selections: [] };
	const refuse: Refuse = (message) => problems.push({ limb: 'RECORD', message });
	for (const f of i.refusedFiles ?? []) refuse(`${f.name}: not read — ${f.why}`);
	for (const f of i.files) {
		const own = recordProblems(f.text, { tracked: true });
		// ⛔ A file the record refuses is read no further: its lines would be checked on terms it has already failed.
		if (own.length > 0) {
			for (const m of own) refuse(`${f.name}: ${m}`);
			continue;
		}
		const rows = f.text === '' ? [] : f.text.slice(0, -1).split('\n');
		rows.forEach((row, n) => addLine(JSON.parse(row) as RecordLine, f.name, `${f.name}:${n + 1}`, p, refuse));
	}
	return p;
}

// ── the cross-file references ───────────────────────────────────────────────────────────────────────────────────

/** A RESCORED line with its source resolved — the only form the limbs read. */
interface Rescore {
	readonly line: RescoredLine;
	readonly at: string;
	readonly source: Run;
	readonly evaluation: Evaluation;
}

function heldOutIds(p: Parsed, refuse: Refuse): Set<string> {
	const ids = new Set<string>();
	for (const { line, at } of p.heldOut) {
		if (p.runs.has(line.runId) || ids.has(line.runId))
			refuse(`${at}: HELD_OUT ${line.runId} reuses a run id — a run id is used once across the record`);
		ids.add(line.runId);
	}
	return ids;
}

/** Why a RESCORED line has no evaluation to stand on, or its resolved form. */
function resolveRescore(x: At<RescoredLine>, p: Parsed, taken: ReadonlySet<string>): Rescore | string {
	const { line, at } = x;
	const label = `${line.caseId}#${line.repetition}`;
	if (taken.has(line.rescoreId))
		return `${at}: RESCORED ${line.rescoreId} reuses a run id — a SUPERSEDED line could not tell them apart`;
	const source = p.runs.get(line.sourceRunId);
	if (!source) return `${at}: RESCORED names source run ${line.sourceRunId}, which no RUN line declares`;
	const evaluation = source.evaluations.get(evaluationKey(line.caseId, line.repetition));
	if (!evaluation || !complete(evaluation))
		return `${at}: RESCORED names ${label}, which run ${line.sourceRunId} holds no complete evaluation of`;
	if (transportFailed(evaluation))
		return `${at}: RESCORED re-stamps ${label}, a call cut at the transport or at the model’s output-token limit — never re-scorable`;
	return { line, at, source, evaluation };
}

function rescoreRefs(p: Parsed, heldOut: ReadonlySet<string>, refuse: Refuse): Rescore[] {
	const taken = new Set([...p.runs.keys(), ...heldOut]);
	const restamped = new Set<string>();
	const out: Rescore[] = [];
	for (const x of p.rescored) {
		const r = resolveRescore(x, p, taken);
		const key = `${x.line.rescoreId}|${x.line.caseId}#${x.line.repetition}`;
		if (typeof r === 'string') refuse(r);
		else if (restamped.has(key)) refuse(`${x.at}: RESCORED ${x.line.rescoreId} re-stamps ${x.line.caseId}#${x.line.repetition} twice`);
		else {
			restamped.add(key);
			out.push(r);
		}
	}
	return out;
}

/** The cases a record measured — a run's, or a RESCORED record's — or undefined for a record nobody declared. */
function measuredBy(id: string, p: Parsed, rescores: readonly Rescore[]): ReadonlySet<string> | undefined {
	const run = p.runs.get(id);
	if (run) return new Set(run.run.caseIds);
	const lines = rescores.filter((r) => r.line.rescoreId === id);
	return lines.length > 0 ? new Set(lines.map((r) => r.line.caseId)) : undefined;
}

/** Why a finding cannot carry an ESCALATION, or undefined: it has no entry, or its entry's heading is struck. */
function unescalatable(i: CheckInputs, finding: string): string | undefined {
	if (!i.findings.has(finding)) return `${finding}, which the register does not hold`;
	if (i.struck.has(finding))
		return `${finding}, whose register heading is struck — a closed finding escalates nothing; cite an open one`;
	return undefined;
}

function escalationRef(
	x: At<EscalationLine>,
	measured: ReadonlySet<string> | undefined,
	isHeldOut: boolean,
	i: CheckInputs,
	refuse: Refuse
): void {
	const { line, at } = x;
	const cannot = unescalatable(i, line.finding);
	if (cannot) refuse(`${at}: ESCALATION cites ${cannot}`);
	if (!measured && !isHeldOut)
		return refuse(`${at}: ESCALATION names ${line.runId}, which no RUN, RESCORED or HELD_OUT line declares`);
	if (line.caseIds && !measured) refuse(`${at}: ESCALATION names cases of ${line.runId}, a HELD_OUT run, which carries counts only`);
	if (line.heldOutCount !== undefined && measured)
		refuse(`${at}: ESCALATION gives a held-out count for ${line.runId}, which is not a HELD_OUT run`);
	for (const c of (measured && line.caseIds) || [])
		if (!measured!.has(c)) refuse(`${at}: ESCALATION names case ${c}, which ${line.runId} did not measure`);
}

function references(p: Parsed, i: CheckInputs, problems: CheckProblem[]): Rescore[] {
	const refuse: Refuse = (message) => problems.push({ limb: 'RECORD', message });
	const heldOut = heldOutIds(p, refuse);
	const rescores = rescoreRefs(p, heldOut, refuse);
	for (const x of p.escalations)
		escalationRef(x, measuredBy(x.line.runId, p, rescores), heldOut.has(x.line.runId), i, refuse);
	for (const { line, at } of p.superseded) {
		if (!i.findings.has(line.finding)) refuse(`${at}: SUPERSEDED cites ${line.finding}, which the register does not hold`);
		if (!measuredBy(line.record, p, rescores))
			refuse(`${at}: SUPERSEDED names ${line.record}, which no RUN or RESCORED line declares`);
	}
	acknowledgedRefs(p, i, refuse);
	selectionRefs(p, i, refuse);
	return rescores;
}

/**
 * ⭐⭐ D3c (`REG-D-132`; `REG-F-576`; DESIGN-authoring-review-in-parts.md D3c) — AN ACKNOWLEDGED LINE JUDGED AGAINST ITS OWN CASE
 * SET: one committed case set — some version's committed JSON (`caseSets`), today's included (`cases`) — must hold the line's
 * whole `addedCaseIds` list. ~~Each id held to today's case set~~: so a case renamed or retired since it was acknowledged — the
 * 19 bridge part cases D3b (8) renamed, on the record's lines 1013 and 1182 — left a RECORD problem no later line could
 * discharge. ⛔ The guard against a mistyped id stays: an id no committed version holds is refused, by name. ⛔ And ids collected
 * across versions, none holding them all, are no one case set: refused too.
 */
function acknowledgedRefs(p: Parsed, i: CheckInputs, refuse: Refuse): void {
	const sets: readonly ReadonlySet<string>[] = [new Set(i.cases.map((c) => c.id)), ...i.caseSets.map((s) => new Set(s.caseIds))];
	for (const { line, at } of p.acknowledged) {
		const ids = line.addedCaseIds ?? [];
		const unheld = ids.filter((c) => !sets.some((s) => s.has(c)));
		for (const c of unheld)
			refuse(`${at}: ACKNOWLEDGED adds ${c}, which no committed case set holds — today’s or any earlier version’s`);
		if (unheld.length === 0 && !sets.some((s) => ids.every((c) => s.has(c))))
			refuse(
				`${at}: ACKNOWLEDGED adds ${ids.join(', ')}, which no one committed case set holds together — each is held by some version, none by one alone, and an acknowledgement names one case set’s cases (design D3c)`
			);
	}
}

/** ⭐ `JAN-SELREV` SR-4 — THE SELECTION IN FORCE: the LAST in the record, its files by name and their lines in order. */
const selectionInForce = (p: Parsed): At<SelectionLine> | undefined => p.selections.at(-1);

/**
 * ⭐ `JAN-SELREV` SR-4 — A SELECTION'S RULING, held as an ESCALATION's finding is (`unescalatable`): every SELECTION cites
 * an entry the register holds, and the one in force a ruling whose heading is not struck. An earlier SELECTION selects
 * nothing, so a ruling withdrawn since does not redden it — the append-only record could never discharge that.
 */
function selectionRefs(p: Parsed, i: CheckInputs, refuse: Refuse): void {
	const inForce = selectionInForce(p);
	for (const x of p.selections) {
		if (!i.rulings.has(x.line.ruling)) refuse(`${x.at}: SELECTION cites ${x.line.ruling}, which the register does not hold`);
		else if (x === inForce && i.struckRulings.has(x.line.ruling))
			refuse(
				`${x.at}: the SELECTION in force cites ${x.line.ruling}, whose register heading is struck — a withdrawn ruling selects nothing; append a SELECTION citing a ruling in force`
			);
	}
}

/**
 * ⭐ `JAN-SELREV` SR-4 — HOW A SELECTION'S RULING STANDS IN THE REGISTER: an entry whose heading is live (`IN_FORCE`),
 * one whose heading is struck — withdrawn (`STRUCK`) — or no entry at all (`NOT_HELD`). The SELECTION in force on
 * either of the last two is refused (`selectionRefs`), and the record is red; coverage is still held to its candidate
 * meanwhile. The report, the COVERAGE problem and the CLI's header each say how its ruling stands, so such a SELECTION
 * is never named in force unqualified.
 */
export type RulingStanding = 'IN_FORCE' | 'STRUCK' | 'NOT_HELD';
function rulingStanding(i: CheckInputs, ruling: string): RulingStanding {
	if (!i.rulings.has(ruling)) return 'NOT_HELD';
	return i.struckRulings.has(ruling) ? 'STRUCK' : 'IN_FORCE';
}
/** What is said beside a SELECTION's ruling that is not in force (`RulingStanding`) — nothing when it is. */
export function rulingCaveat(standing: RulingStanding): string {
	if (standing === 'STRUCK') return ', WITHDRAWN — its register heading is struck';
	if (standing === 'NOT_HELD') return ', NOT HELD — the register has no entry for it';
	return '';
}

/**
 * ⛔ `JAN-CRITREAD` J2-3 — A RECORD STAMPED WITH TODAY'S FINGERPRINT UNDER ANOTHER SCORING DIGEST. No run or re-scoring
 * this tree makes can carry both: the fingerprint hashes the scoring digest (`digest.ts`). So such a record is refused,
 * counts for nothing in limb 1, and is not re-scored as today's in limb 2 — its outcomes would be compared under a
 * digest it only claims. It stays in limb 3: a failure it holds still owes its ESCALATION.
 */
function inconsistentStamps(p: Parsed, rescores: readonly Rescore[], F: string, S: string, refuse: Refuse): Set<string> {
	const refused = new Set<string>();
	const stamp = (kind: string, id: string, at: string, fingerprint: string, digest: string) => {
		if (fingerprint !== F || digest === S || refused.has(id)) return;
		refused.add(id);
		refuse(
			`${at}: ${kind} ${id} carries today’s reviewer fingerprint ${F} but scoring digest ${digest}, not today’s ${S} — ` +
				'the fingerprint hashes the scoring digest, so nothing this tree records can carry both; it counts for nothing'
		);
	};
	for (const r of p.runs.values()) stamp('RUN', r.run.runId, r.at, r.run.reviewerFingerprint, r.run.scoringDigest);
	for (const x of rescores) stamp('RESCORED', x.line.rescoreId, x.at, x.line.reviewerFingerprint, x.line.scoringDigest);
	return refused;
}

// ── one server-clock day (§5.3; REG-F-429) ──────────────────────────────────────────────────────────────────────

/** The server's calendar days a run's calls fell on — or the call whose clock cannot be read. The day is the one
 *  function the runner stops a run by (`record.ts` `serverDayOf`), so the two cannot place midnight differently. */
function serverDays(r: Run, offset: string): Set<string> | CallLine {
	const days = new Set<string>();
	for (const call of [...r.evaluations.values()].flatMap((e) => e.calls)) {
		if (!call.served) continue;
		const day = serverDayOf(call.served.serverClock, offset);
		if (day === undefined) return call;
		days.add(day);
	}
	return days;
}

/**
 * Why a run counts for nothing under the one-server-clock-day rule, or undefined. Only an Ollama run records what the
 * server served; the product's tools serve nothing a run can see, and their dates are not the harness's to know.
 */
function dayProblem(r: Run): string | undefined {
	const offset = r.run.candidate.serverUtcOffset;
	if (r.run.candidate.transport !== 'ollama' || offset === null) return undefined;
	const days = serverDays(r, offset);
	if (!(days instanceof Set))
		return `run ${r.run.runId} counts for nothing: ${days.caseId}#${days.repetition} recorded a server clock that is not an HTTP date (${JSON.stringify(days.served!.serverClock)}), so its day cannot be known`;
	if (days.size <= 1) return undefined;
	return (
		`run ${r.run.runId} counts for nothing: its calls fall on server-clock days ${[...days].sort().join(' and ')} ` +
		`(UTC${offset}; REG-F-429) — a run must finish within one server-clock day (§5.3)`
	);
}

// ── material failures (§5.1) ────────────────────────────────────────────────────────────────────────────────────

type Failures = Map<string, Set<MaterialFailureClass>>;
const add = (f: Failures, caseId: string, k: MaterialFailureClass) => {
	const s = f.get(caseId) ?? new Set<MaterialFailureClass>();
	s.add(k);
	f.set(caseId, s);
};
const outcomeOf = (s: ScoredOutcome, criterionId: string) => s.criteria.find(([k]) => k === criterionId)?.[1];

/** One scored evaluation, as the failure rules read it. */
interface Outcome {
	readonly caseId: string;
	readonly repetition: number;
	readonly scored: ScoredOutcome;
	readonly failedAtTransport: boolean;
	/** The oracle version its record was measured under — a RESCORED line's is its source run's. */
	readonly oracleVersion: number;
}

/**
 * ⭐ `JAN-CRITREAD` J2-6 — THE PASS BAR (`REG-D-080`): *"right verdict is selected and approved"*. An evaluation meets
 * it when its disposition IS the oracle's — SATISFIED for a clean case, REJECTED for a planted one. Anything else is
 * not the verdict: an INCONCLUSIVE, or a BOUNDARY_REJECTED the floor returns for a reply that faults the planted
 * criterion and still recommends SATISFIED, misses the bar though it named the defect. ⭑ E12's polish — a declared case's
 * disposition is the declared sign-off's verdict, which reads no recommendation (`runner.ts` `scoreDeclared`): that reply
 * scores REJECTED there, as the sign-off records it.
 */
const rightVerdict = (o: Oracle, s: ScoredOutcome): boolean => s.disposition === o.disposition;
/** The oracle's planted criteria an evaluation did NOT fault — its attribution, against the `faulted` list. */
const unnamedIn = (o: Oracle, s: ScoredOutcome): string[] => o.faulted.filter((k) => outcomeOf(s, k) !== 'NOT_MET');

/** §5.1's absolute failures for one scored evaluation, judged against today's oracle — at the grain of the VERDICT. */
function absolute(o: Oracle | undefined, x: Outcome): MaterialFailureClass[] {
	if (x.failedAtTransport) return ['BOUNDEDNESS'];
	if (!o || rightVerdict(o, x.scored)) return [];
	return [o.disposition === 'SATISFIED' ? 'CLEAN_NOT_SATISFIED' : 'PLANTED_DEFECT_NOT_REJECTED'];
}

/** The case a renamed copy renames, when today's set holds it (`<base>-R<n>`, pinned by the case set's shape limb). */
const renamedFrom = (id: string, ids: ReadonlySet<string>): string | undefined => {
	const base = /^(.+)-R\d+$/.exec(id)?.[1];
	return base && ids.has(base) ? base : undefined;
};

/** The absolute failures, and a verdict that changes with the name: per repetition, a renamed copy whose disposition is
 *  not its base's. */
function outcomeFailures(outcomes: readonly Outcome[], oracles: ReadonlyMap<string, Oracle>, ids: ReadonlySet<string>): Failures {
	const f: Failures = new Map();
	const at = new Map(outcomes.map((x) => [evaluationKey(x.caseId, x.repetition), x]));
	for (const x of outcomes) {
		for (const k of absolute(oracles.get(x.caseId), x)) add(f, x.caseId, k);
		const base = renamedFrom(x.caseId, ids);
		const b = base ? at.get(evaluationKey(base, x.repetition)) : undefined;
		if (b && !b.failedAtTransport && !x.failedAtTransport && b.scored.disposition !== x.scored.disposition)
			add(f, x.caseId, 'VERDICT_CHANGES_WITH_NAME');
	}
	return f;
}

const candidateKey = (r: RunLine) =>
	JSON.stringify([r.candidate.provider, r.candidate.modelLabel, r.candidate.servedModelDigest]);

/** One case, in the previous run and this one — its complete evaluations, and the scored ones among them. */
interface CasePair {
	readonly before: readonly Evaluation[];
	readonly now: readonly Evaluation[];
	readonly aBefore: readonly ScoredOutcome[];
	readonly aNow: readonly ScoredOutcome[];
}
const allFaulted = (ss: readonly ScoredOutcome[], k: string) => ss.every((s) => outcomeOf(s, k) === 'NOT_MET');
const allSatisfied = (ss: readonly ScoredOutcome[]) => ss.every((s) => s.disposition === 'SATISFIED');
const wellFormed = (es: readonly Evaluation[]) => es.every((e) => e.calls.every((c) => c.malformations.length === 0));
const agree = (ss: readonly ScoredOutcome[]) => new Set(ss.map((s) => s.disposition)).size === 1;
const answeredIn = (ss: readonly ScoredOutcome[], k: string) =>
	ss.every((s) => (outcomeOf(s, k) ?? 'UNABLE_TO_DETERMINE') !== 'UNABLE_TO_DETERMINE');

/** §5.1's MATERIAL transitions for one case, each asked only where both runs answered it — every one but the
 *  criterion-level two, `faultsLost` and `undeterminedNow`. */
function pairTransitions(x: CasePair, o: Oracle | undefined): MaterialFailureClass[] {
	const out: MaterialFailureClass[] = [];
	const answered = x.aBefore.length > 0 && x.aNow.length > 0;
	if (answered && o?.disposition === 'SATISFIED' && allSatisfied(x.aBefore) && !allSatisfied(x.aNow)) out.push('SATISFIED_LOST');
	if (wellFormed(x.before) && !wellFormed(x.now)) out.push('MALFORMATION_GAINED');
	if (x.aBefore.length >= 2 && agree(x.aBefore) && x.aNow.length >= 2 && !agree(x.aNow)) out.push('REPETITIONS_NOW_DISAGREE');
	if (!x.before.some(transportFailed) && x.now.some(transportFailed)) out.push('BOUND_NOW_EXCEEDED');
	return out;
}

/**
 * ⭐ `JAN-CRITREAD` J2-6 — §5.1's other CRITERION-LEVEL transition, `ANSWERED_NOW_UNDETERMINED`: the criteria answered in
 * every answered repetition of the previous run and UNABLE_TO_DETERMINE in one of this. REPORTED, never escalated —
 * `REG-D-080`: *"Criterion-level classes that do not change the verdict become informational."* Where it DOES change
 * the verdict, the verdict-level class escalates it: every Reasoning Review criterion is mandatory, so an undetermined
 * one leaves a clean case INCONCLUSIVE — CLEAN_NOT_SATISFIED, and SATISFIED_LOST — and a planted case INCONCLUSIVE
 * unless another criterion is faulted — PLANTED_DEFECT_NOT_REJECTED.
 */
function undeterminedNow(x: CasePair): string[] {
	if (x.aBefore.length === 0 || x.aNow.length === 0) return [];
	return x.aBefore[0]!.criteria
		.map(([k]) => k)
		.filter((k) => answeredIn(x.aBefore, k) && x.aNow.some((s) => outcomeOf(s, k) === 'UNABLE_TO_DETERMINE'));
}

/**
 * ⭐ `JAN-CRITREAD` J2-6 — §5.1's CRITERION-LEVEL transition, `FAULT_LOST`: the planted criteria faulted in every
 * answered repetition of the previous run and not in every one of this. REPORTED, never escalated (`REG-D-080`). Where
 * the verdict moved too, the absolute class — PLANTED_DEFECT_NOT_REJECTED, on each evaluation now not REJECTED — is
 * what limb 3 escalates, so no verdict the old transition caught goes unescalated.
 */
function faultsLost(x: CasePair, o: Oracle | undefined): string[] {
	if (x.aBefore.length === 0 || x.aNow.length === 0 || o?.disposition !== 'REJECTED') return [];
	return o.faulted.filter((k) => allFaulted(x.aBefore, k) && !allFaulted(x.aNow, k));
}

/** A criterion id as the report names it — `RR-04`. */
const short = (k: string): string => k.slice(0, 5);

/**
 * §5.1's TRANSITIONS — only when a run repeats a candidate, keyed on (provider, model label, served-model digest), and
 * only against that candidate's previous run (the latest earlier-dated), case by case where the case is unchanged.
 * The material ones go to `f`; the criterion-level ones to `reported`, as lines of the attribution report.
 */
function transitions(r: Run, prev: Run, oracles: ReadonlyMap<string, Oracle>, f: Failures, reported: string[]): void {
	const of = (run: Run, caseId: string) => [...run.evaluations.values()].filter((e) => e.caseId === caseId && complete(e));
	const answered = (es: readonly Evaluation[]) => es.filter((e) => !transportFailed(e)).map(scoredOf);
	for (const caseId of r.run.caseIds) {
		const now = of(r, caseId);
		const before = of(prev, caseId);
		if (now.length === 0 || before.length === 0) continue;
		const pair: CasePair = { before, now, aBefore: answered(before), aNow: answered(now) };
		for (const k of pairTransitions(pair, oracles.get(caseId))) add(f, caseId, k);
		const gone = faultsLost(pair, oracles.get(caseId));
		if (gone.length > 0)
			reported.push(
				`${caseId} — FAULT_LOST against run ${prev.run.runId}: ${gone.map(short).join(', ')} faulted in every repetition there, not in every repetition here`
			);
		const undetermined = undeterminedNow(pair);
		if (undetermined.length > 0)
			reported.push(
				`${caseId} — ANSWERED_NOW_UNDETERMINED against run ${prev.run.runId}: ${undetermined.map(short).join(', ')} answered in every repetition there, UNABLE_TO_DETERMINE in a repetition here`
			);
	}
}

// ── attribution (`JAN-CRITREAD` J2-6; `REG-D-080`) ──

/** One answered planted evaluation that did not fault every planted criterion. */
interface Miss {
	readonly caseId: string;
	readonly repetition: number;
	readonly disposition: string;
	/** Whether its disposition is the oracle's — if not, limb 3 escalates it; the attribution line only says so. */
	readonly rightVerdict: boolean;
	readonly unnamed: readonly string[];
	/** Every criterion it faulted. */
	readonly faulted: readonly string[];
}
/** What one record says about attribution. */
interface Attribution {
	/** The ANSWERED planted evaluations today's oracles judge — one cut at the bound answered nothing to attribute. */
	readonly planted: number;
	readonly misses: readonly Miss[];
	/** ⭐ The answered evaluations of cases OUTSIDE today's set that the record's own oracle version planted — not in
	 *  `planted`, and counted out aloud rather than dropped in silence. */
	readonly leftOut: number;
	/** The answered evaluations of cases outside today's set under an oracle version the check does not hold — whether
	 *  they were planted cannot be said — by that version. */
	readonly unheld: ReadonlyMap<number, number>;
	/** The criterion-level transitions, as report lines (`transitions`). */
	readonly reported: readonly string[];
}
/** Every oracle version on file, by version: case id → its oracle there. */
type OracleHistory = ReadonlyMap<number, ReadonlyMap<string, Oracle>>;

const byCaseThenRepetition = (a: Miss, b: Miss): number =>
	a.caseId === b.caseId ? a.repetition - b.repetition : Number(a.caseId > b.caseId) - Number(a.caseId < b.caseId);

/** ⭐ Which answered planted evaluations named the planted criterion — attribution, against the oracles' `faulted`. */
function attributionOf(
	outcomes: readonly Outcome[],
	oracles: ReadonlyMap<string, Oracle>,
	history: OracleHistory,
	reported: readonly string[]
): Attribution {
	const planted = outcomes.filter((x) => !x.failedAtTransport && oracles.get(x.caseId)?.disposition === 'REJECTED');
	const outside = outcomes.filter((x) => !x.failedAtTransport && !oracles.has(x.caseId));
	const leftOut = outside.filter((x) => history.get(x.oracleVersion)?.get(x.caseId)?.disposition === 'REJECTED').length;
	const unheld = new Map<number, number>();
	for (const x of outside.filter((y) => !history.has(y.oracleVersion)))
		unheld.set(x.oracleVersion, (unheld.get(x.oracleVersion) ?? 0) + 1);
	const misses = planted.flatMap((x): Miss[] => {
		const o = oracles.get(x.caseId)!;
		const unnamed = unnamedIn(o, x.scored);
		return unnamed.length === 0
			? []
			: [
					{
						caseId: x.caseId,
						repetition: x.repetition,
						disposition: x.scored.disposition,
						rightVerdict: rightVerdict(o, x.scored),
						unnamed,
						faulted: x.scored.criteria.filter(([, v]) => v === 'NOT_MET').map(([k]) => k)
					}
				];
	});
	return { planted: planted.length, misses: misses.sort(byCaseThenRepetition), leftOut, unheld, reported };
}

const missLine = (m: Miss): string =>
	`${m.caseId}#${m.repetition} — ${m.disposition}` +
	(m.rightVerdict ? ', the right verdict' : ', not the oracle’s REJECTED: material (limb 3)') +
	`; ${m.unnamed.map(short).join(', ')} not faulted (it faulted ${m.faulted.map(short).join(', ') || 'nothing'})`;

/** ⭐ What M leaves out, said aloud: the evaluations of cases outside today's set — planted by the record's own
 *  oracle version, or of a version the check does not hold. Empty when M left nothing out. */
const notCounted = (a: Attribution): string => {
	const parts = [
		...(a.leftOut > 0 ? [`${a.leftOut} answered planted evaluation(s) of cases not in the current set are not counted`] : []),
		...[...a.unheld]
			.sort(([x], [y]) => x - y)
			.map(
				([v, n]) =>
					`${n} answered evaluation(s) of cases not in the current set are not counted: oracles v${v}, which say which were planted, are not held`
			)
	];
	return parts.length > 0 ? ` (${parts.join('; ')})` : '';
};

/** A record's attribution entry — or undefined for a record that measured no planted case, left none out, and moved at
 *  no criterion. */
function attributionEntry(kind: string, id: string, a: Attribution): string | undefined {
	if (a.planted === 0 && a.leftOut === 0 && a.unheld.size === 0 && a.reported.length === 0) return undefined;
	return [
		`${kind} ${id}: the planted criterion named in ${a.planted - a.misses.length} of ${a.planted} answered planted evaluation(s), against today’s oracles${notCounted(a)}`,
		...a.misses.map(missLine),
		...a.reported
	].join('\n    ');
}

// ── the check ───────────────────────────────────────────────────────────────────────────────────────────────────

/** An outcome, for a person reading a mismatch. */
const summarise = (s: ScoredOutcome): string => {
	const unmet = s.criteria.filter(([, o]) => o !== 'MET').map(([k, o]) => `${k.slice(0, 5)} ${o}`);
	return `${s.disposition}${s.independenceOk ? '' : ' (independence failed)'} [${unmet.join(', ') || 'every criterion MET'}]`;
};
const sameOutcome = (a: ScoredOutcome, b: ScoredOutcome) => canonicalJson(a) === canonicalJson(b);

/** What every phase of the check reads. */
interface Ctx {
	readonly i: CheckInputs;
	readonly p: Parsed;
	readonly rescores: readonly Rescore[];
	/** Today's reviewer fingerprint and scoring digest. */
	readonly F: string;
	readonly S: string;
	readonly caseById: ReadonlyMap<string, QualificationCase>;
	readonly caseIds: ReadonlySet<string>;
	readonly oracles: ReadonlyMap<string, Oracle>;
	/** Every oracle version on file (`CheckInputs.oracleSets`) — read by the attribution report alone. */
	readonly history: OracleHistory;
	/** Records refused for a stamp nothing this tree makes (`inconsistentStamps`): run ids and rescore ids. */
	readonly refused: ReadonlySet<string>;
	/** ⭐ `JAN-SELREV` SR-4 — the SELECTION in force (`selectionInForce`), or undefined when the record holds none. */
	readonly selection: At<SelectionLine> | undefined;
	readonly problems: CheckProblem[];
	readonly notes: string[];
}
/** Whether each call of `e` recorded the prompt today's reviewer sends — none does for a case gone from the set. The ONE
 *  predicate (`record.ts` `promptsAreToday`) that `restampable` reads too, for the writer of RESCORED lines and the check
 *  that demands them whole (`restampsWhole`). */
const promptsMatch = (ctx: Ctx, e: Evaluation) =>
	promptsAreToday(e.calls, ctx.i.current.casePrompts, ctx.i.current.criterionRepairAfter);

// ── limb 2 ──
type Fail = (id: string, message: string) => void;

/** Re-score `e` of `run` today and compare it with what `recorded` says, failing `id` on a mismatch. */
async function compareRescored(
	ctx: Ctx,
	run: RunLine,
	e: Evaluation,
	recorded: { readonly outcome: ScoredOutcome; readonly as: (s: string) => string },
	id: string,
	prefix: string,
	fail: Fail
): Promise<void> {
	let today: ScoredOutcome;
	try {
		today = await ctx.i.rescore(run, ctx.caseById.get(e.caseId)!, e.calls, ctx.S);
	} catch (err) {
		return fail(id, `${prefix} — cannot be re-scored: ${err instanceof Error ? err.message : String(err)}`);
	}
	if (!sameOutcome(today, recorded.outcome))
		fail(id, `${prefix} — re-scored through today’s path it is ${summarise(today)}, but ${recorded.as(summarise(recorded.outcome))}`);
}
const AT_RUN_TIME = (s: string) => `${s} was recorded at run time`;
const ON_THE_LINE = (s: string) => `the line records ${s}`;

/** A run carrying today's fingerprint — and so, unless refused (`inconsistentStamps`), today's scoring digest. */
async function reproduceRun(ctx: Ctx, r: Run, fail: Fail): Promise<void> {
	const id = r.run.runId;
	for (const e of r.evaluations.values()) {
		if (!ctx.caseIds.has(e.caseId) || !complete(e)) continue;
		// ⭐ Package L — D13: each call by the one predicate (`callPromptIsToday`), a criterion repair against the reply before it.
		for (const [i, c] of e.calls.entries())
			if (!callPromptIsToday(e.calls, i, ctx.i.current.casePrompts, ctx.i.current.criterionRepairAfter))
				fail(
					id,
					`run ${id}: ${e.caseId}#${e.repetition} ${c.role} — the prompt it recorded is not the one today’s reviewer sends, though the fingerprint did not move`
				);
		if (!transportFailed(e))
			await compareRescored(ctx, r.run, e, { outcome: scoredOf(e), as: AT_RUN_TIME }, id, `run ${id}: ${e.caseId}#${e.repetition}`, fail);
	}
}

/** A RESCORED line carrying today's fingerprint — and so, unless refused, today's scoring digest. */
async function reproduceRescore(ctx: Ctx, x: Rescore, fail: Fail): Promise<void> {
	const { line, source, evaluation } = x;
	const label = `${line.caseId}#${line.repetition}`;
	if (!promptsMatch(ctx, evaluation))
		return fail(
			line.rescoreId,
			`RESCORED ${line.rescoreId}: ${label} — re-stamps an evaluation whose prompt has changed since run ${source.run.runId}: a model call is owed, not a re-scoring`
		);
	await compareRescored(ctx, source.run, evaluation, { outcome: line.scored, as: ON_THE_LINE }, line.rescoreId, `RESCORED ${line.rescoreId}: ${label}`, fail);
	// Its source, where the source's scoring is today's: the run-time outcome must still reproduce.
	if (source.run.scoringDigest === ctx.S && source.run.reviewerFingerprint !== ctx.F)
		await compareRescored(ctx, source.run, evaluation, { outcome: scoredOf(evaluation), as: AT_RUN_TIME }, source.run.runId, `run ${source.run.runId}: ${label}`, fail);
}

/** Limb 2 for every record in its scope, before any SUPERSEDED line is weighed: record id → what does not reproduce. */
async function reproduction(ctx: Ctx): Promise<Map<string, string[]>> {
	const repro = new Map<string, string[]>();
	const fail: Fail = (id, message) => void repro.set(id, [...(repro.get(id) ?? []), message]);
	const today = (fingerprint: string, id: string) => fingerprint === ctx.F && !ctx.refused.has(id);
	for (const r of ctx.p.runs.values()) if (today(r.run.reviewerFingerprint, r.run.runId)) await reproduceRun(ctx, r, fail);
	for (const x of ctx.rescores)
		if (today(x.line.reviewerFingerprint, x.line.rescoreId) && ctx.caseIds.has(x.line.caseId))
			await reproduceRescore(ctx, x, fail);
	return repro;
}

// ── limb 3's material failures ──
interface RecordFailures {
	readonly kind: 'run' | 'RESCORED';
	/** The MATERIAL failures only — what limb 3 escalates and a SUPERSEDED line waits on. */
	readonly failures: Failures;
	/** What it reports and never escalates (`REG-D-080`). */
	readonly attribution: Attribution;
}

/** Earlier in the record's time: by date, and two runs of one date by their order in the record. */
const before = (a: Run, b: Run): boolean => a.run.date < b.run.date || (a.run.date === b.run.date && a.order < b.order);

function previousRun(r: Run, sameCandidate: readonly Run[]): Run | undefined {
	return sameCandidate
		.filter((q) => before(q, r))
		.sort((a, b) => (before(a, b) ? -1 : 1))
		.at(-1);
}

/** §5.1: changes of served template, server version or options are reported as confounds, not as a new candidate. */
function confounds(r: Run, prev: Run, notes: string[]): void {
	const differs = (what: string) =>
		notes.push(`confound: run ${r.run.runId} differs from ${prev.run.runId}, the same candidate’s previous run, in ${what}`);
	if (prev.run.candidate.servedTemplateSha256 !== r.run.candidate.servedTemplateSha256) differs('servedTemplateSha256');
	if (prev.run.candidate.serverVersion !== r.run.candidate.serverVersion) differs('serverVersion');
	if (canonicalJson(prev.run.candidate.options) !== canonicalJson(r.run.candidate.options)) differs('its options');
}

function runFailures(ctx: Ctx, r: Run, sameCandidate: readonly Run[]): RecordFailures {
	const outcomes = [...r.evaluations.values()].filter(complete).map((e) => ({
		caseId: e.caseId,
		repetition: e.repetition,
		scored: scoredOf(e),
		failedAtTransport: transportFailed(e),
		oracleVersion: r.run.oracleVersion
	}));
	const f = outcomeFailures(outcomes, ctx.oracles, ctx.caseIds);
	const reported: string[] = [];
	const prev = previousRun(r, sameCandidate);
	if (prev) {
		transitions(r, prev, ctx.oracles, f, reported);
		confounds(r, prev, ctx.notes);
	}
	return { kind: 'run', failures: f, attribution: attributionOf(outcomes, ctx.oracles, ctx.history, reported) };
}

/** Every record's material failures, and its attribution: each run's, and each RESCORED record's. */
function materialFailures(ctx: Ctx): Map<string, RecordFailures> {
	const out = new Map<string, RecordFailures>();
	const byCandidate = new Map<string, Run[]>();
	for (const r of ctx.p.runs.values()) byCandidate.set(candidateKey(r.run), [...(byCandidate.get(candidateKey(r.run)) ?? []), r]);
	for (const r of ctx.p.runs.values())
		out.set(r.run.runId, runFailures(ctx, r, byCandidate.get(candidateKey(r.run))!));
	const groups = new Map<string, Rescore[]>();
	for (const x of ctx.rescores) groups.set(x.line.rescoreId, [...(groups.get(x.line.rescoreId) ?? []), x]);
	for (const [id, xs] of groups) {
		const outcomes = xs.map((x) => ({
			caseId: x.line.caseId,
			repetition: x.line.repetition,
			scored: x.line.scored,
			failedAtTransport: false,
			oracleVersion: x.source.run.oracleVersion
		}));
		out.set(id, {
			kind: 'RESCORED',
			failures: outcomeFailures(outcomes, ctx.oracles, ctx.caseIds),
			attribution: attributionOf(outcomes, ctx.oracles, ctx.history, [])
		});
	}
	return out;
}

/** A record's failures no ESCALATION line cites, with an OPEN finding the register holds, as `case — classes`. */
function uncitedIn(ctx: Ctx, failures: ReadonlyMap<string, RecordFailures>, id: string): string[] {
	const cited = (caseId: string) =>
		ctx.p.escalations.some(
			(e) =>
				e.line.runId === id && (e.line.caseIds ?? []).includes(caseId) && unescalatable(ctx.i, e.line.finding) === undefined
		);
	return [...(failures.get(id)?.failures ?? new Map<string, Set<MaterialFailureClass>>())]
		.filter(([caseId]) => !cited(caseId))
		.map(([caseId, ks]) => `${caseId} — ${MATERIAL_FAILURE_CLASSES.filter((k) => ks.has(k)).join(', ')}`);
}

// ── the SUPERSEDED lines ──

/** Why a SUPERSEDED line naming `record` is refused, or undefined when it strikes it. */
function supersessionRefusal(
	ctx: Ctx,
	record: string,
	repro: ReadonlyMap<string, readonly string[]>,
	failures: ReadonlyMap<string, RecordFailures>
): string | undefined {
	const inScope =
		ctx.p.runs.get(record)?.run.reviewerFingerprint === ctx.F ||
		ctx.rescores.some((x) => x.line.reviewerFingerprint === ctx.F && (x.line.rescoreId === record || x.source.run.runId === record));
	if (uncitedIn(ctx, failures, record).length > 0)
		return `SUPERSEDED names ${record}, which still has an un-cited material failure — refused until it is escalated (§5.4)`;
	if (ctx.refused.has(record))
		return `SUPERSEDED names ${record}, which is refused for its stamps and already counts for nothing — refused: there is nothing to strike`;
	if (!inScope)
		return `SUPERSEDED names ${record}, which carries an earlier fingerprint and is not compared with today’s reviewer — refused: nothing there fails reproduction (§5.6 limb 2)`;
	if (!repro.has(record))
		return `SUPERSEDED names ${record}, which reproduces — refused: a record is struck only when it really fails reproduction (§5.6 limb 2)`;
	return undefined;
}

function weighSupersessions(
	ctx: Ctx,
	repro: ReadonlyMap<string, readonly string[]>,
	failures: ReadonlyMap<string, RecordFailures>
): Set<string> {
	const struck = new Set<string>();
	for (const { line, at } of ctx.p.superseded) {
		if (!failures.has(line.record)) continue; // refused as a reference above
		const refusal = supersessionRefusal(ctx, line.record, repro, failures);
		if (refusal) ctx.problems.push({ limb: 'REPRODUCTION', message: `${at}: ${refusal}` });
		else struck.add(line.record);
	}
	return struck;
}

// ── ⭐ `JAN-ESCREC` ER-2 — a RESCORED record re-stamps the whole of its source run ──

/** Whether a re-scoring of `run` re-stamps `e`: `restampable` (`record.ts`) — its prompts today's among its legs, limb 2's
 *  first question (`promptsMatch`) — then re-scorable as limb 2 asks it. */
async function owedARestamp(ctx: Ctx, run: RunLine, e: Evaluation): Promise<boolean> {
	if (!restampable(e.calls, (caseId) => ctx.caseIds.has(caseId), ctx.i.current.casePrompts, ctx.i.current.criterionRepairAfter))
		return false;
	try {
		await ctx.i.rescore(run, ctx.caseById.get(e.caseId)!, e.calls, ctx.S);
	} catch {
		return false;
	}
	return true;
}

/**
 * ⭐ `JAN-ESCREC` ER-2 (the ER-2 verifier's finding [1]) — A RESCORED RECORD RE-STAMPS EXACTLY WHAT A RE-SCORING OF ITS
 * SOURCE RUN YIELDS. Unlike a run, it is derivable from what its source recorded: `rescoredLines` writes one line for
 * each evaluation `restampable` admits — the ONE predicate both read — that today's path re-scores. Coverage asks per
 * case, limb 2 re-scores the lines present, limb 3 reads the outcomes present: without this, a record that left out
 * one repetition, the one carrying its material failure among them, passed all three. So a record limb 2 reads
 * (today's fingerprint, not refused) and not struck must re-stamp each such evaluation of its source run, and no other
 * of a current case: one left out, or one too many, is a RECORD problem naming it. ⭐ Re-scorability is asked as limb 2
 * asks it, in its order (the ER-2 fix round's re-verifier's finding [0]): FIRST whether its recorded prompts are today's
 * (`promptsMatch`, a leg of `restampable`) — limb 2 refuses one whose prompt changed, "a model call is owed, not a
 * re-scoring", so it is owed no line: the rest of its source run is re-stamped without it, and its case is owed a RUN,
 * as limb 1's hint says — THEN whether today's path re-scores it (`ctx.i.rescore`).
 * ⚠ NOT ASKED OF A RECORD UNDER AN EARLIER FINGERPRINT: whether its evaluations were re-scorable was its own day's
 * path's question, which today's cannot replay — the check of its day asked it. Nor of a refused or a struck one: each
 * counts for nothing. Nor of a line of a case gone from today's set, which limb 2 does not re-score either.
 * ⭐ COMPLETED BY APPENDING (ruled; the ER-2 fix round's re-verifier's finding [6]): the record is append-only, and a
 * RESCORED record that leaves an owed evaluation out MAY be completed later by appending that line under the same
 * rescore id — the comparison groups the lines by rescore id and source run wherever they stand in the record. It is RED
 * until then; nothing refuses a RESCORED record that grows after its first commit.
 */
async function restampsWhole(ctx: Ctx, struck: ReadonlySet<string>): Promise<void> {
	const asked = ctx.rescores.filter(
		(x) => x.line.reviewerFingerprint === ctx.F && !ctx.refused.has(x.line.rescoreId) && !struck.has(x.line.rescoreId)
	);
	// By record AND source, never by record alone (`ER2-V51`): `rescoredLines` writes one source run per rescore id, so each
	// pair is one re-scoring — and another run's line for the same case and repetition never stands in for its source's.
	const records = new Map<string, Rescore[]>();
	for (const x of asked) {
		const key = `${x.line.rescoreId}|${x.source.run.runId}`;
		records.set(key, [...(records.get(key) ?? []), x]);
	}
	for (const xs of records.values()) {
		const { line, at, source } = xs[0]!;
		const restamped = new Map(xs.map((x) => [evaluationKey(x.line.caseId, x.line.repetition), x]));
		for (const e of source.evaluations.values()) {
			const owed = await owedARestamp(ctx, source.run, e);
			const x = restamped.get(evaluationKey(e.caseId, e.repetition));
			const label = `${e.caseId}#${e.repetition}`;
			if (owed && !x)
				ctx.problems.push({
					limb: 'RECORD',
					// ⭐ P5 package C (F4) — ~~"not cut at the transport"~~: nor cut by the tool at the model's output-token limit,
					// which `restampable` refuses too (`record.ts`).
					message: `${at}: RESCORED ${line.rescoreId} leaves out ${label} of run ${source.run.runId}, which a re-scoring of that run re-stamps (\`rescoredLines\`) — complete, cut neither at the transport nor at the model’s output-token limit, of a current case and re-scorable today: a RESCORED record re-stamps the whole of its source run, or what it covers and escalates rests on the repetitions it kept`
				});
			else if (!owed && x && ctx.caseIds.has(e.caseId))
				ctx.problems.push({
					limb: 'RECORD',
					// ⭐ `JAN-PRQUAL` `PQ-1` (design D6; `REG-D-093`'s owed pin ER2-V102) — THE CAUSE IS NAMED. Since `restampable`
					// took limb 2's prompt leg, a line too many is one of TWO evaluations a re-scoring never yields: one today's
					// path cannot re-score, or one whose recorded prompt is not today's — which today's path CAN re-score, so
					// ~~"today’s path cannot re-score it"~~ was false of it: limb 2 refuses that line for its prompt before it
					// re-scores anything, and its case is owed a model call.
					message: `${x.at}: RESCORED ${line.rescoreId} re-stamps ${label} of run ${source.run.runId}, which a re-scoring of that run does not (\`rescoredLines\`) — ${promptsMatch(ctx, e) ? 'today’s path cannot re-score it' : 'its recorded prompt is not the one today’s reviewer sends: a model call is owed, not a re-scoring'}`
				});
		}
	}
}

// ── limb 1 ──

/** The cases today's RESCORED lines cover. */
function rescoreCoverage(ctx: Ctx, counted: ReadonlySet<string>, struck: ReadonlySet<string>, covered: Set<string>): void {
	for (const x of ctx.rescores) {
		if (x.line.reviewerFingerprint !== ctx.F || ctx.refused.has(x.line.rescoreId) || struck.has(x.line.rescoreId)) continue;
		if (!counted.has(x.source.run.runId) || !promptsMatch(ctx, x.evaluation)) continue;
		covered.add(x.line.caseId);
	}
}

/** A record that carries a fingerprint and its scoring digest, with the calls it recorded — what limb 1 compares. */
interface Stamped {
	readonly what: string;
	readonly fingerprint: string;
	readonly scoringDigest: string;
	readonly calls: readonly CallLine[];
}

/**
 * ⭐ §5.6 LIMB 1 — A MOVE OF THE PROMPT SIDE THAT NO CASE PROMPT SHOWS OWES AN ACKNOWLEDGED LINE, WHATEVER RUNS EXIST
 * UNDER THE NEW FINGERPRINT. A move "only in the probe set" (a branch no case exercises: the process-result arm, an
 * oversize budget, an unrendered criterion field) "reddens until an ACKNOWLEDGED line names the new fingerprint" —
 * re-running cases that never exercised the change says nothing about it, which is what the line forces someone to
 * state. So: for each earlier counted record, its PROMPT SIDE (probes, budget, criteria) moved exactly when today's
 * prompt-side components with its own scoring digest do not reproduce its fingerprint (`digest.ts`); the move reached
 * a case prompt exactly when some prompt recorded under that fingerprint, for a case still in the set, is not today's.
 * An ACKNOWLEDGED line discharges it when it names today's fingerprint — or one an earlier record carries with today's
 * prompt side, since only the scoring has moved since that one was acknowledged. Returns what owes it, or undefined.
 */
function acknowledgementOwed(ctx: Ctx, counted: readonly Run[], struck: ReadonlySet<string>): string | undefined {
	const countedIds = new Set(counted.map((r) => r.run.runId));
	const earlier: Stamped[] = [
		...counted.map((r) => ({
			what: `run ${r.run.runId}`,
			fingerprint: r.run.reviewerFingerprint,
			scoringDigest: r.run.scoringDigest,
			calls: [...r.evaluations.values()].filter(complete).flatMap((e) => e.calls)
		})),
		...ctx.rescores
			.filter((x) => countedIds.has(x.source.run.runId) && !struck.has(x.line.rescoreId) && !ctx.refused.has(x.line.rescoreId))
			.map((x) => ({
				what: `RESCORED ${x.line.rescoreId}`,
				fingerprint: x.line.reviewerFingerprint,
				scoringDigest: x.line.scoringDigest,
				calls: x.evaluation.calls
			}))
	].filter((s) => s.fingerprint !== ctx.F);
	const samePromptSide = (s: Stamped) =>
		reviewerFingerprintOf({ ...ctx.i.current.components, scoring: s.scoringDigest }) === s.fingerprint;
	const discharging = new Set([ctx.F, ...earlier.filter(samePromptSide).map((s) => s.fingerprint)]);
	if (ctx.p.acknowledged.some((a) => discharging.has(a.line.reviewerFingerprint))) return undefined;
	const moved = earlier.filter((s) => !samePromptSide(s));
	const reachedACasePrompt = (fingerprint: string) =>
		moved
			.filter((s) => s.fingerprint === fingerprint)
			.some((s) =>
				s.calls.some(
					(c, i) =>
						ctx.caseIds.has(c.caseId) &&
						!callPromptIsToday(s.calls, i, ctx.i.current.casePrompts, ctx.i.current.criterionRepairAfter)
				)
			);
	return moved.find((s) => !reachedACasePrompt(s.fingerprint))?.what;
}

/**
 * For each case not covered: an earlier run that recorded today's prompts for it, if one did.
 * ⭐ `JAN-PRQUAL` `PQ-1` — ~~"RESCORED lines discharge those if only the scoring moved"~~: a RESCORED line re-stamps an
 * evaluation whose recorded prompts are today's (`restampable`, the prompt leg `promptsAreToday`), whatever else moved —
 * the scoring, or the probe set alone (§5.6 limb 1: "until a RESCORED record re-stamps the unchanged cases under it"),
 * where the ACKNOWLEDGED line is owed besides. So every hint and coverage message says WHERE NO CASE PROMPT CHANGED.
 */
function coverageHints(ctx: Ctx, counted: readonly Run[], missing: readonly string[]): string[] {
	const earlier = (id: string) =>
		counted.find(
			(r) =>
				r.run.reviewerFingerprint !== ctx.F &&
				[...r.evaluations.values()].some((e) => e.caseId === id && complete(e) && !transportFailed(e) && promptsMatch(ctx, e))
		)?.run.runId;
	return [...new Set(missing.map(earlier).filter((x): x is string => x !== undefined))].map(
		(runId) =>
			`same prompts under an earlier fingerprint in ${runId}: ${missing.filter((id) => earlier(id) === runId).join(', ')} — RESCORED lines discharge those where no case prompt changed (§5.6 limb 1)`
	);
}

/** The current cases `covered` does not hold, in the case set's order. */
const uncovered = (ctx: Ctx, covered: ReadonlySet<string>): string[] =>
	ctx.i.cases.map((c) => c.id).filter((id) => !covered.has(id));

/**
 * ⭐ WHAT "COVERED" MEANS (§5.6 limb 1) — ONE DEFINITION, asked of every counted run and, since `JAN-SELREV` SR-4, of the
 * SELECTED candidate's alone: a current case, by today's prompts, in a complete evaluation of one of `counted` carrying
 * today's fingerprint, or re-stamped under it by a RESCORED line whose source is one of `counted`.
 */
function coveredBy(ctx: Ctx, counted: readonly Run[], struck: ReadonlySet<string>): Set<string> {
	const covered = new Set<string>();
	for (const r of counted.filter((q) => q.run.reviewerFingerprint === ctx.F))
		for (const e of r.evaluations.values()) if (complete(e) && promptsMatch(ctx, e)) covered.add(e.caseId);
	rescoreCoverage(ctx, new Set(counted.map((r) => r.run.runId)), struck, covered);
	return covered;
}

/** A run of the selected candidate: its transport and its model label, the two fields that name it (`record.ts`
 *  `SelectedCandidate`). */
const isSelected = (r: RunLine, c: SelectedCandidate): boolean =>
	r.candidate.transport === c.transport && r.candidate.modelLabel === c.modelLabel;

/**
 * ⭐ `JAN-SELREV` SR-4 — THE GATE HOLDS THE SELECTED REVIEWER TO TODAY'S DEFINITION (`REG-D-086`; DESIGN-the-selected-
 * reviewer.md §5 Q1). With a SELECTION in force, every current case must ALSO be covered — `coveredBy`, the one
 * definition — by the selected candidate's own counted runs: a RUN of it under today's fingerprint, or a RESCORED record
 * of one ~~where only the scoring moved~~ where no case prompt changed (`JAN-PRQUAL` `PQ-1`: `restampable` keys on the
 * recorded prompts, not on which component moved). Another candidate's coverage says nothing of the reviewer the product
 * runs.
 * A run of it is DEPLOYABLE without asking: a SELECTION names only a deployable transport, and a RUN's `deployable` is
 * its transport's (`record.ts`). With no SELECTION in force, nothing here runs. A SELECTION whose ruling is not in
 * force is still held here, and its problem says how the ruling stands (`rulingCaveat`).
 */
function selectedCoverage(ctx: Ctx, counted: readonly Run[], struck: ReadonlySet<string>): void {
	const selection = ctx.selection;
	if (!selection) return;
	const { candidate, ruling } = selection.line;
	const selected = counted.filter((r) => isSelected(r.run, candidate));
	const missing = uncovered(ctx, coveredBy(ctx, selected, struck));
	if (missing.length === 0) return;
	const cited = ruling + rulingCaveat(rulingStanding(ctx.i, ruling));
	ctx.problems.push({
		limb: 'COVERAGE',
		message: [
			`${missing.length} of ${ctx.i.cases.length} current case(s) are not MEASURED under today’s reviewer fingerprint ${ctx.F} by the SELECTED candidate ${candidate.transport} / ${candidate.modelLabel} (${cited}; the SELECTION in force, ${selection.at}): ${missing.join(', ')} — owed: a run of the selected candidate over them, or RESCORED lines of its runs where no case prompt changed (§5.6 limb 1; REG-D-086)`,
			...coverageHints(ctx, selected, missing)
		].join('\n    ')
	});
}

function coverage(ctx: Ctx, struck: ReadonlySet<string>): void {
	const outsideOneDay: string[] = [];
	const counted = [...ctx.p.runs.values()].filter((r) => {
		if (struck.has(r.run.runId) || ctx.refused.has(r.run.runId)) return false;
		const day = dayProblem(r);
		if (day) outsideOneDay.push(day);
		return day === undefined;
	});
	ctx.notes.push(...outsideOneDay);
	const covered = coveredBy(ctx, counted, struck);
	const owed = acknowledgementOwed(ctx, counted, struck);
	if (owed)
		ctx.problems.push({
			limb: 'COVERAGE',
			message:
				`the reviewer fingerprint moved outside every case prompt since ${owed} — the probe set, the budget or the ` +
				`criteria moved, and no case prompt recorded under it differs from today’s: an ACKNOWLEDGED line naming ${ctx.F} ` +
				'is owed, with the case added to exercise the change or the reason none is needed, whatever runs exist under ' +
				'it (§5.6 limb 1)'
		});
	const missing = uncovered(ctx, covered);
	if (missing.length > 0)
		ctx.problems.push({
			limb: 'COVERAGE',
			message: [
				`${missing.length} of ${ctx.i.cases.length} current case(s) are not MEASURED under today’s reviewer fingerprint ${ctx.F}: ${missing.join(', ')} — owed: a RUN over them, or RESCORED lines where no case prompt changed (§5.6 limb 1)`,
				...coverageHints(ctx, counted, missing),
				...outsideOneDay
			].join('\n    ')
		});
	// ⭐ `JAN-SELREV` SR-4 — and, with a SELECTION in force, the same question of the selected candidate's runs alone —
	// asked whether or not the question above found a case uncovered: each problem names what it owes.
	selectedCoverage(ctx, counted, struck);
}

// ── limb 3 ──
function escalation(ctx: Ctx, failures: ReadonlyMap<string, RecordFailures>, struck: ReadonlySet<string>): void {
	for (const [id, { kind }] of failures)
		for (const u of struck.has(id) ? [] : uncitedIn(ctx, failures, id))
			ctx.problems.push({
				limb: 'ESCALATION',
				message: `${kind} ${id}: ${u} — no ESCALATION line cites a register finding for it (§5.6 limb 3)`
			});
	// A HELD_OUT line counts only material classes — since `REG-D-080` the verdict-level ones (`record.ts`) — so its
	// total is what it owes an ESCALATION for; attribution has no count there to owe one.
	for (const { line } of ctx.p.heldOut) {
		const total = Object.values(line.counts).reduce((a, b) => a + b, 0);
		const cited = ctx.p.escalations.some(
			(e) =>
				e.line.runId === line.runId && e.line.heldOutCount === total && unescalatable(ctx.i, e.line.finding) === undefined
		);
		if (total > 0 && !cited)
			ctx.problems.push({
				limb: 'ESCALATION',
				message: `HELD_OUT ${line.runId}: ${total} material failure(s) — no ESCALATION line cites a register finding for the count (§5.6 limb 3)`
			});
	}
}

const LIMB_ORDER: readonly CheckLimb[] = ['RECORD', 'CONFERRAL', 'COVERAGE', 'REPRODUCTION', 'ESCALATION'];

/** ⭐ THE CHECK: every problem in the record, by limb — empty when green. Each limb is its own phase above. */
export async function checkQualification(i: CheckInputs): Promise<CheckReport> {
	const problems: CheckProblem[] = [];
	const p = parse(i, problems);
	const caseById = new Map(i.cases.map((c) => [c.id, c]));
	const rescores = references(p, i, problems);
	const refuse: Refuse = (message) => problems.push({ limb: 'RECORD', message });
	// ⭐ `E12F` F5 — CONFERRAL, asked whatever the record holds: oracles nobody conferred qualify no reviewer (`REG-D-073`).
	if (i.conferral.includes(ORACLES_PROPOSED)) problems.push({ limb: 'CONFERRAL', message: ORACLES_NOT_CONFERRED });
	// ⭐ B8a (`REG-D-127`) — and conferred verdicts on restated cases qualify no reviewer until the sponsor confirms the restatement.
	if (i.conferral.includes(ORACLES_RESTATEMENT_UNCONFIRMED))
		problems.push({ limb: 'CONFERRAL', message: RESTATEMENT_NOT_CONFIRMED });
	const ctx: Ctx = {
		i,
		p,
		rescores,
		F: i.current.reviewer,
		S: i.current.scoring,
		caseById,
		caseIds: new Set(caseById.keys()),
		oracles: new Map(i.oracles.map((o) => [o.caseId, o])),
		history: new Map(i.oracleSets.map((s) => [s.oracleVersion, new Map(s.oracles.map((o) => [o.caseId, o]))])),
		refused: inconsistentStamps(p, rescores, i.current.reviewer, i.current.scoring, refuse),
		selection: selectionInForce(p),
		problems,
		notes: []
	};
	const repro = await reproduction(ctx);
	const failures = materialFailures(ctx);
	const struck = weighSupersessions(ctx, repro, failures);
	await restampsWhole(ctx, struck);
	coverage(ctx, struck);
	for (const [id, messages] of repro)
		if (!struck.has(id))
			problems.push({
				limb: 'REPRODUCTION',
				message: `${messages.join('\n    ')}\n    — does not reproduce: discharged only by a SUPERSEDED line citing a register finding (§5.6 limb 2)`
			});
	escalation(ctx, failures, struck);
	// ⭐ `REG-D-080` — attribution, for the records limb 3 reads: every one not struck.
	const attribution = [...failures]
		.filter(([id]) => !struck.has(id))
		.map(([id, x]) => attributionEntry(x.kind, id, x.attribution))
		.filter((a): a is string => a !== undefined);
	const s = ctx.selection;
	return {
		problems: problems.sort((a, b) => LIMB_ORDER.indexOf(a.limb) - LIMB_ORDER.indexOf(b.limb)),
		notes: ctx.notes,
		attribution,
		selection: s && { candidate: s.line.candidate, ruling: s.line.ruling, at: s.at, standing: rulingStanding(i, s.line.ruling) }
	};
}
