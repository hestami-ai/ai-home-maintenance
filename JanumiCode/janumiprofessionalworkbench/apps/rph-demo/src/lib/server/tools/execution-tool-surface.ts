// ⭐⭐ JAN-EXEC PHASE 3 — CAPABILITY → TOOLS, BY ABSENCE. The seam where a GRANT becomes a model's HANDS.
//
// ── ⛔ THE RULE, AND WHY IT IS AN ABSENCE RATHER THAN A CHECK ────────────────────────────────────────────────
//
// **A tool the grant does not authorise is NEVER MINTED, so the model is never told it exists.** There is no
// call to intercept and no refusal path to get wrong. ⛔ A capability check INSIDE a tool handed to the model
// anyway is strictly weaker on two counts, and both are the shapes this repository keeps filing: it depends on
// the check FIRING (a convention, not a control — `B8`), and it ADVERTISES the privilege, so an untrusted party
// learns the host has a process-execution seam and merely declined this time.
//
// ── ⭐⭐ `R12` / `R13` (SPONSOR, 2026-09-15) — WHAT MINTING `run_command` ACTUALLY CONFERS ─────────────────────
//
// ⛔ **`process-execution` SUBSUMES `file-system` AND `network`.** DRIVEN: with `file-system` WITHHELD the model
// held only `run_command` and wrote a file OUTSIDE the workspace anyway, because **a child process is not
// confined by anything userspace can assert.** So "minted ["run_command"], withheld ["write_file"]" is a true
// statement about THIS HOST'S TOOL SURFACE and a false one about the model's REACH, and only the first is
// claimed anywhere. ⭑ The reverse narrowing — `file-system` granted, `process-execution` withheld — is the one
// that bounds anything, and it is the live precision control this phase turns on.
//
// ⛔ **`R13`: THE INTERPRETER IS NOT REFUSED.** `cmd.exe` / `powershell.exe` as `argv[0]` was driven and works
// (`namesABatchTarget` tests only `/\.(bat|cmd)$/`). A blocklist is REFUSED BY RULING: refusing `cmd.exe` while
// permitting `node -e` is theatre, and worse, a later reader would mistake the refusal for a containment
// property. **Minting this tool means ARBITRARY CODE AS THE SERVER USER**, and `R9`'s deployment tier —
// OpenSandbox / OpenShell / container isolation — is the only claimed boundary. Everything below bounds what
// this HOST does on the model's behalf; nothing below bounds the child.
//
// ── ⛔ `W-6` — THE TWO TOOLS DISAGREE UNDER A SWAPPED ROOT, AND PHASE 3 IS WHERE ONE PARTY SEES BOTH ──────────
//
// Both halves were disclosed separately and neither disclosure was wrong; what was missing is the JOINT
// statement, because until this file existed no single party held both tools. **With a junction standing where
// the Undertaking's deliverable directory was: `write_file` WRITES (into the junction's target, reported as an
// ordinary in-workspace path) while `run_command` REFUSES (the runner compares the RESOLVED `cwd` against the
// directory the host DECLARED, which is the one name a swap cannot move).** ⭑ THE ASYMMETRY IS A PROPERTY, NOT
// AN EFFORT GAP: the runner has a DECLARATION to compare against, and workspace containment is necessarily
// *is this child under that ROOT* — a swapped root resolves consistently for every child under it. ⚠ SO THE
// MODEL'S EXPERIENCE OF ONE SWAPPED WORKSPACE IS: writes succeed, commands refuse, and the record shows a step
// that produced files and could not run them. That is the honest description of the arrangement and it is
// stated here, once, rather than left to be assembled from two files. See `DESIGN …sandbox.md` §4.8.
//
// ⭐ AND IT IS HOW `RPH-EXE-004`'s OPERATION-LEVEL WORDING AND THE CODE'S STEP-LEVEL REFUSAL ARE RECONCILED
// RATHER THAN ONE BEING CHOSEN. The ratified rule says *"network OPERATIONS fail authorization"* — degradation
// of the operation, not of the step. Granting by absence IS that: the invocation proceeds with a narrower
// surface, and `governedToolCallReport` names the surface it had. See `step-binding.ts` for the REQUIRES/USES
// split that decides which capabilities may degrade and which may not.
//
// ── ⭐⭐ THE `R11`-OWED RULING: A HOST MAY NOT MINT A NAME THE RECORD PLANE CANNOT HOLD ────────────────────────
//
// `R11` bounded `ObservedToolCall.toolName` by `RecordPlaneNameSchema` (≤64 chars, `^[A-Za-z][A-Za-z0-9_.-]*$`)
// and recorded the consequence as OWED to the increment that first has a real tool surface — this one:
//
//   ⛔ **a host that mints a name the record plane cannot hold makes the WHOLE exchange record UNWRITABLE.**
//
// Three candidate answers were recorded, all of them at RECORD time, and each is refused here on its own terms:
//   (a) DROP THE SPELLING, KEEP `MINTED_BY_HOST` — the handler REFUSES that arrangement outright (a
//       `MINTED_BY_HOST` call with no `toolName` fails the provenance conjunct), so it is not available.
//   (b) CALL IT `NOT_MINTED` — **FALSE.** The host DID mint it. Writing a false provenance to escape a bound is
//       the fabricated-measurement defect with the record as its victim.
//   (c) ADD A THIRD PROVENANCE MEMBER — a change to a ratified, generated, PERMANENT (`PER-2`) contract, with no
//       ratification and no producer, to describe a state the host creates and can avoid.
//
// ⭐ **THE ANSWER TAKEN IS THE FOURTH: CONSTRAIN WHAT A HOST MAY MINT, AT MINTING TIME, SO AN UNHOLDABLE NAME
// CANNOT EXIST.** It is the only one that removes the state rather than describing it — at the single moment
// when the only party involved is the HOST and no model has been told anything, no call has been made, and no
// record is owed. `write_file` and `run_command` both satisfy the bound already, so nothing is being worked
// around; what is being removed is the possibility that a later tool does not.
//
// ⚠ AND IT IS THE WHOLE CATALOG THAT IS CHECKED, NOT ONLY THE MINTED SUBSET — deliberately. Checking only what a
// grant happened to authorise leaves an unholdable name dormant until the day a grant WIDENS, which is the worst
// possible moment to discover it: a live step, a model mid-turn, and an exchange record that cannot be written.
//
// ⚠ IT THROWS, matching `openPiExecutionSession` and `resolveExecutingModel` directly downstream, and for the
// reason `REG-D-052` gives: a producer identity — or here, a producer's tool surface — may not be a fiction. The
// caller records it as a failed step rather than letting it escape as a 500.
//
// ── ⭐⭐ THE RETENTION DISPOSITION THIS FILE OWES, BECAUSE IT BINDS `stderr` (`REG-Q-066`) ─────────────────────
//
// ⛔ THIS WAS NOT NOTICED BY READING. `verif/agy-stderr-unbound.test.ts` went RED the moment `run_command`
// existed, with its own instruction: *"Binding `stderr` CREATES the retention surface REG-Q-066 asks about …
// If this is deliberate, it needs a retention disposition and REG-Q-066 needs re-answering; it must not arrive
// as a debugging convenience."* Phase 2b earned the first disposition; this is the second, and it answers a
// DIFFERENT question — Phase 2b answered who CAPTURES the streams, this answers who HANDS THEM TO A MODEL.
//
// **WHAT IS NEW.** A command whose output the model cannot read is a command the model cannot act on, so both
// streams go back as the tool's result. That puts them in the model's CONTEXT, and therefore in the E-1
// composite `createMaterializedInputRecorder` captures — which `captureTry` stores as `materializedInputRef`
// under `RETAINED_BY_PARTICIPATION`.
//
// **WHY THAT CLASS IS THE HONEST ONE RATHER THAN THE CONVENIENT ONE.** `REG-D-050`: *participation is a
// property of USE, not of kind.* The model READ these bytes and its next work product rests on them — they
// participated in a judgement. Declaring them `PURGEABLE_AT_EXPIRY` to make the problem go away would be the
// false statement: an assessment would then rest on bytes the system says it may destroy.
//
// **WHICH PLANE THEY LAND ON, WHICH IS THE PART THAT MAKES IT LAWFUL.** `materializedInputRef` is a CONTENT-plane
// reference — a storage key and a hash. `PER-9` makes content-plane retention *"subject to recorded redaction"*
// (E-6) and, in the same sentence, makes record-plane omission illegal. So these bytes are on the plane that
// HAS a removal path. ⛔ AND NO BYTE OF EITHER STREAM REACHES THE RECORD PLANE: `ObservedToolCall` has no
// arguments field and no result field BY CONSTRUCTION (`R11`), so what the permanent record holds is an
// ordinal, a provenance, a name and an outcome. That guarantee needed no amendment to survive this phase.
//
// **THE DURABLE COPY IS UNCHANGED AND THIS FILE MINTS NO SECOND ONE.** `child-process-runner` already writes
// both streams into the Undertaking's SECOND workspace, `PURGEABLE_AT_EXPIRY`, named by
// `ProcessRunOutcome.retention` and reachable by `Workspace.purge` (`R7`). This seam re-transmits the TRANSIENT
// strings the port hands it and persists nothing of its own.
//
// ⚠ **THE RESIDUAL, STATED RATHER THAN SMOOTHED.** A build that echoes its environment — a host path, an
// operating username, a token printed by a careless script — puts those bytes in a `RETAINED_BY_PARTICIPATION`
// content object, where `purge` refuses and only an E-6 redaction can reach them, and **nothing in this
// repository performs an E-6 redaction today**. It is not new in KIND (a model's answer span can already quote
// a path it was shown) but it is new in VOLUME, because a build prints far more than a model writes.
// ⛔ AND FILTERING IS NOT THE ANSWER: a predicate deciding whether a line of build output "looks like a secret"
// is a normaliser over arbitrary bytes, which is the shape this seam has now refused in three consecutive
// rounds. The cut that IS applied is the runner's own bound, and it travels with its declaration.
import { RecordPlaneNameSchema } from '@janumipwb/rph-contracts';
import { canReuseBindingForNewAttempt, capabilityAuthorized } from '@janumipwb/rph-domain';
import { planProcessRun, type ProcessRunner, type Workspace } from '@janumipwb/rph-ports';
import type { ParamSpec, ToolRunResult } from '../agent/types.js';
import type { ProcessRunObserver } from './process-run-observer.js';

/**
 * How long a model-chosen command may run before the runner kills it.
 *
 * ⛔ THE HOST'S, NOT THE MODEL'S, AND IT IS NOT A TOOL PARAMETER. An untrusted party choosing its own deadline
 * is an untrusted party choosing how long it may hold the host — §22.1 classifies model output as untrusted
 * external input, and a resource bound under that party's control is not a bound. ⚠ AUTHORED, and said to be:
 * nothing measured says 120 seconds. What is argued is that a bound must exist and must belong to the host.
 */
const EXECUTION_COMMAND_TIMEOUT_MS = 120_000;

/**
 * The ports one minted tool acts through — the Undertaking's sandbox, exactly as `workspace-host.ts` built it.
 *
 * ⭑ THE WHOLE PORT, NOT A `Pick`, AND THAT IS A CHANGE FROM `ProducerSessionContext`'s DECLARATIONS-ONLY SHAPE.
 * Deciding WHERE a session runs needs only what a workspace DECLARES; ACTING needs what it can DO. A narrower
 * type here would have to be widened at the one call site that matters, which is how a type stops describing
 * anything.
 */
export interface ExecutionToolPorts {
	readonly workspace: Workspace;
	readonly runner: ProcessRunner;
	/**
	 * ⭐⭐ `JAN-EXEC` PHASE 5 — WHERE A COMMAND'S OUTCOME GOES SO SOMETHING OUTSIDE THIS CLOSURE CAN SEE IT.
	 *
	 * ⛔ WITHOUT IT THE EXIT CODE OF A MODEL-RUN TEST SUITE EXISTED NOWHERE AFTER THE TURN ENDED, and that is
	 * measured rather than argued: this file built its `ToolRunResult.data` from four scalars and dropped
	 * `ProcessRunOutcome.retention` — the ONLY field naming the durable capture — on the floor, while the
	 * tool-call observer's `since()` returns `{ name, outcome }` alone. So a test result could not become
	 * evidence because nothing downstream could say what ran or what it exited with.
	 *
	 * ⚠ OPTIONAL, AND FOR A REASON THAT IS NOT CONVENIENCE: a host may legitimately mint `run_command` with no
	 * intention of turning its results into evidence, and requiring the instrument would make every such caller
	 * construct one to throw away. What is NOT optional is the honesty of the absence — a step that mints the
	 * tool and supplies no observer produces no process evidence, rather than empty evidence.
	 */
	readonly processRuns?: ProcessRunObserver;
}

/**
 * A tool the host may mint for an executing model — Pi-agnostic, exactly as `AuthoringToolDescriptor` is.
 *
 * ⚠ `run` IS ASYNC AND THE AUTHORING ONE IS NOT, WHICH IS WHY THIS IS ITS OWN TYPE RATHER THAN A REUSE. An
 * authoring tool proposes a command into an in-process engine; these two touch a filesystem and a child
 * process. `ParamSpec` and `ToolRunResult` ARE reused, because those parts genuinely are the same — `REG-F-318`'s
 * adopt-don't-derive, applied to the halves where it holds rather than to the whole.
 */
export interface ExecutionToolDescriptor {
	readonly name: string;
	readonly description: string;
	readonly parameters: ParamSpec;
	/** ⛔ The capability the GRANT must carry for this tool to be minted AT ALL. Not a label: see `mintExecutionTools`. */
	readonly capability: string;
	run(args: Record<string, unknown>): Promise<ToolRunResult>;
}

/** One tool the host knows how to mint, before it is bound to a particular Undertaking's ports. */
export interface ExecutionToolTemplate {
	readonly name: string;
	readonly capability: string;
	readonly description: string;
	readonly parameters: ParamSpec;
	mint(ports: ExecutionToolPorts): (args: Record<string, unknown>) => Promise<ToolRunResult>;
}

/**
 * A required string argument, or a stated refusal.
 *
 * ⛔ REFUSAL, NOT COERCION, AND THE STANDING INSTRUCTION ON THIS SEAM IS WHY: *prefer refusal and structure over
 * sanitisation — three rounds showed every new normaliser is itself attackable.* `String(v)` on a missing
 * argument yields `'undefined'`, which is a plausible relative path; on an object it yields `[object Object]`.
 * Both are values the model never chose, arriving through the one place that was trying to be helpful.
 */
function requiredString(args: Record<string, unknown>, field: string): string | undefined {
	const v = args[field];
	return typeof v === 'string' && v !== '' ? v : undefined;
}

/**
 * A required array-of-strings argument, or `undefined`.
 *
 * ⚠ EVERY ELEMENT IS CHECKED, not just the array-ness. A single non-string element reaching `argv` would be
 * coerced by the runtime at spawn time, which is the same fabrication one layer lower down.
 */
function requiredStringArray(args: Record<string, unknown>, field: string): string[] | undefined {
	const v = args[field];
	if (!Array.isArray(v) || v.length === 0) return undefined;
	if (!v.every((e) => typeof e === 'string' && e !== '')) return undefined;
	return v as string[];
}

/**
 * ⭑ `write_file` — bound to the Undertaking's DELIVERABLE workspace and to nothing else.
 *
 * ⛔ THE PATH IS NOT CHECKED HERE, AND THAT IS DELIBERATE. `Workspace.writeFile` is documented to REFUSE rather
 * than throw on a path that escapes, and `containedWorkspacePath` is exported from the port precisely so *"a
 * second adapter cannot quietly implement a weaker one"*. A containment predicate written again in this file
 * would be that second, weaker implementation — with a model on the other end of it.
 */
const WRITE_FILE: ExecutionToolTemplate = {
	name: 'write_file',
	capability: 'file-system',
	// ⛔ THE DESCRIPTION IS A STATEMENT TO AN UNTRUSTED PARTY AND IT MUST STILL BE TRUE (`B-7`). It used to end
	// *"Writing the same path again replaces it"*, which a model reads as *"a different path is a different
	// file"* — and on this host it is not: `write_file('Report.md')` then `write_file('REPORT.MD')` each
	// answered "Wrote N bytes to X" while `list()` reported ONE entry. The adapter now answers with the spelling
	// the workspace HOLDS, and the sentence says so, so the two statements about one file became one.
	description:
		'Write UTF-8 text to a file in this work unit’s workspace. The path is workspace-relative; a path that ' +
		'escapes the workspace is refused and the refusal says so. Writing the same file again replaces it. ' +
		'The outcome names the path AS THIS WORKSPACE HOLDS IT, which may differ from the spelling you gave — on ' +
		'a case-insensitive filesystem "Report.md" and "REPORT.MD" are ONE file, not two. Use the path the ' +
		'outcome reports.',
	parameters: {
		path: {
			type: 'string',
			description:
				'Workspace-relative path, forward-slashed. Never absolute and never containing "..".',
			required: true
		},
		contents: { type: 'string', description: 'The complete UTF-8 text to write.', required: true }
	},
	mint:
		({ workspace, processRuns }) =>
		async (args) => {
			const path = requiredString(args, 'path');
			const contents = typeof args.contents === 'string' ? args.contents : undefined;
			if (path === undefined || contents === undefined)
				return {
					ok: false,
					summary:
						'write_file needs both `path` (a non-empty workspace-relative string) and `contents` (a ' +
						'string, possibly empty). Nothing was written: an argument that is missing or not a string is ' +
						'refused rather than coerced, because a coerced path names a file nobody chose.'
				};
			const outcome = await workspace.writeFile(path, contents);
			// ⭐⭐ `JAN-EXEC` Phase 7, package L — D8 (`REG-D-135`; design D8) — THE HOST RECORDS THE WRITE IT COMPLETED, its
			// path as the workspace HOLDS it, taking the next number of the step's ONE host sequence, which `run_command` shares
			// (`process-run-observer.ts`). ⛔ ONLY THE `written` ARM: a refused write wrote nothing, and takes no number. ⛔ On
			// the content plane only, never the record plane (`R11`): the step's host renders it (package N).
			if (outcome.written) processRuns?.wrote({ path: outcome.path });
			return outcome.written
				? {
						ok: true,
						summary: `Wrote ${outcome.byteSize} UTF-8 bytes to ${outcome.path}.`,
						data: { path: outcome.path, byteSize: outcome.byteSize }
					}
				: { ok: false, summary: `Refused: ${outcome.refusedBecause}` };
		}
};

/**
 * ⭑ `run_command` — bound to the Undertaking's `ProcessRunner`, which was CONSTRUCTED against its workspace.
 *
 * ⛔ THE `cwd` IS NOT A PARAMETER AND CANNOT BE ONE. `planProcessRun` derives it from the workspace's own
 * `directoryPath` — the port's documented rule that *"a lawful caller never has to name a directory at all"* —
 * and Phase 2b's `B8` correction means the runner itself refuses any other `cwd` even if one were supplied. Two
 * independent refusals, and the model is offered no field through which to try.
 *
 * ⚠ `planProcessRun` IS THE EARLY, CHEAP REFUSAL AND NOT THE CONTROL — the port says so in those words. It is
 * called because it is where a `cwd` nobody chose comes from, not because anything downstream relies on it.
 */
const RUN_COMMAND: ExecutionToolTemplate = {
	name: 'run_command',
	capability: 'process-execution',
	description:
		'Run one command in this work unit’s workspace directory and return its exit code and output. No shell ' +
		'is involved, so no quoting rules apply: give the program and each argument as separate array elements. ' +
		'The working directory is fixed to the workspace and cannot be chosen.',
	parameters: {
		argv: {
			type: 'string[]',
			description:
				'The program followed by each argument as its own element, e.g. ["node","--version"]. Not a shell string.',
			required: true
		}
	},
	mint:
		({ workspace, runner, processRuns }) =>
		async (args) => {
			const argv = requiredStringArray(args, 'argv');
			if (argv === undefined)
				return {
					ok: false,
					summary:
						'run_command needs `argv` as a non-empty array of non-empty strings — the program followed by ' +
						'each argument separately. Nothing was run: an argv that is not that is refused rather than ' +
						'coerced, because coercing one produces a command nobody wrote.'
				};
			const plan = planProcessRun({
				runner,
				workspace,
				argv,
				timeoutMs: EXECUTION_COMMAND_TIMEOUT_MS
			});
			if (!plan.planned) return { ok: false, summary: `Refused: ${plan.refusedBecause}` };
			const outcome = await runner.run(plan.request);
			// ⛔ A REFUSED RUN IS `ok: false` AND A NON-ZERO EXIT IS `ok: true`, AND THE DIFFERENCE IS THE WHOLE
			// POINT. The TOOL CALL either happened or it did not; whether the COMMAND passed is the datum it
			// returns. Folding a failing test suite into "the tool failed" would make an honest red result
			// indistinguishable from a seam that refused to run anything — `ProcessRunOutcome`'s founding
			// distinction, one layer up.
			if (!outcome.ran) return { ok: false, summary: `Refused: ${outcome.refusedBecause}` };
			// ⭐⭐ PHASE 5 — THE HOST RECORDS WHAT IT JUST RAN, BEFORE THE MODEL IS TOLD ANYTHING ABOUT IT.
			//
			// ⛔ ONLY THE `ran` ARM, AND THE POSITION IS THE ARGUMENT. A refusal produced no result, so there is
			// nothing to evidence — reporting one would put the host's own refusal into the record as though a
			// command had produced it, which inverts `ProcessRunOutcome`'s founding distinction.
			//
			// ⚠ THE STREAMS ARE PASSED THROUGH AS THE RUNNER BOUNDED THEM, never re-trimmed and never re-declared.
			// They are the TRANSIENT copy; the durable PURGEABLE_AT_EXPIRY one is `outcome.retention`'s, carried
			// beside them so a later mint can name BOTH and a purge can reach one. See `process-run-observer.ts`
			// for why holding them here adds no retention surface that `materializedInputRef` did not already
			// create — and for the bound this instrument puts on itself.
			processRuns?.ran({
				argv,
				exitCode: outcome.exitCode,
				timedOut: outcome.timedOut,
				durationMs: outcome.durationMs,
				outputComplete: outcome.outputComplete,
				omittedRegions: outcome.omittedRegions,
				retention: outcome.retention,
				stdout: outcome.stdout,
				stderr: outcome.stderr
			});
			// ⚠ THE STREAMS GO BACK AS THE RUNNER BOUNDED THEM, WITH ITS OWN DECLARED CUTS — never re-trimmed
			// here. A second bound applied on top would be a second truncation with no declaration beside it,
			// which is the fabricated-completeness defect `omittedRegions` exists to prevent.
			const cuts = outcome.omittedRegions
				.map(
					(r) =>
						`[${r.stream} TRUNCATED: ${r.byteSize} UTF-8 bytes removed from byte offset ${r.byteOffset}]`
				)
				.join(' ');
			return {
				ok: true,
				summary: [
					// ⚠ `null` IS REPORTED AS WHAT THE PORT SAYS IT MEANS — terminated by a signal — rather than as
					// the word `null`, which a model would read as "no information". It is never folded into 0.
					`exit ${outcome.exitCode ?? 'null (terminated by a signal)'}` +
						`${outcome.timedOut ? ' TIMED OUT' : ''} in ${outcome.durationMs}ms`,
					outcome.outputComplete
						? ''
						: '[OUTPUT INCOMPLETE: a descendant still held the streams when the child exited, so more may have been coming]',
					cuts,
					`--- stdout ---\n${outcome.stdout}`,
					`--- stderr ---\n${outcome.stderr}`
				]
					.filter((s) => s !== '')
					.join('\n'),
				data: {
					exitCode: outcome.exitCode,
					timedOut: outcome.timedOut,
					durationMs: outcome.durationMs,
					outputComplete: outcome.outputComplete
				}
			};
		}
};

/**
 * Every tool this host knows how to mint, and the one capability each requires.
 *
 * ⛔ ONE CAPABILITY PER TOOL, NOT A LIST. A tool authorised by *any one of* several capabilities would make the
 * grant unable to say what it authorised, and a tool requiring *all of* several would make an ungranted one
 * invisible in the record. The narrow shape is what keeps `mintedToolNames` a faithful statement of the grant.
 */
export const EXECUTION_TOOL_CATALOG: readonly ExecutionToolTemplate[] = Object.freeze([
	WRITE_FILE,
	RUN_COMMAND
]);

/**
 * Mint exactly the tools this step's GRANT authorises — and refuse, before anything is minted, a catalog name a
 * permanent record could not hold.
 *
 * ⭑ EXACT MEMBERSHIP, VIA THE KERNEL'S OWN PREDICATE. `capabilityAuthorized` is `granted.includes(required)` —
 * no prefix, no case folding, no normalisation — so `file`, `file-syste`, `file-system-extra` and `FILE-SYSTEM`
 * all mint NOTHING. Re-deriving that comparison here would be a second spelling of a rule a prior programme
 * already proved exact, and the second spelling is always the loose one.
 *
 * ⚠ THE CATALOG IS INJECTABLE **ONLY SO THE MINTING-TIME REFUSAL IS REACHABLE IN THE GATE** — the reason
 * `selectBackingTool` gives for the same parameter, in the same words: with the catalog hard-wired, every name
 * in it satisfies the bound and the refusal below could never be entered, so its test would assert nothing.
 * "A control that cannot fail", which this repository has shipped before.
 *
 * ── ⛔⛔ `B-1` — §22.1 IS ENFORCED HERE TOO, BECAUSE A LIST IS NOT AN AUTHORIZATION ───────────────────────────
 *
 * DRIVEN END TO END: `RevokeRuntimeCapability` advances `authorizationStatus` to REVOKED and **deliberately does
 * not clear `grantedCapabilities`** — its handler says so, because the revocation EVENT is derived from the set
 * the binding held. Every reader in the Phase 3 path took the LIST and never the STATUS, so a revoked binding
 * minted the **full tool surface**: a model handed a filesystem and a child process by an authorization that had
 * been withdrawn. §22.1 verbatim: *"Revoked bindings cannot be used for new attempts."*
 *
 * ⛔ THE STATUS IS A REQUIRED PARAMETER AND NOT AN OPTIONAL ONE, for the reason `RunModelStepInput.binding` is
 * required with an explicit `NONE`: an optional status makes *"mint without asking whether the binding still
 * stands"* expressible by OMISSION, which is the dodge shape `REG-F-364` records.
 *
 * ⚠ AND IT IS ENFORCED **HERE**, not only in the caller that computes it. `stepCapabilityRefusal` applies the
 * same kernel predicate one plane over, and that is not duplication: one asks *may this step take another try*,
 * this asks *what may be built and named to a model*. What would be duplication is re-deriving
 * `status !== 'REVOKED'` instead of calling `canReuseBindingForNewAttempt`, and neither site does.
 */
export function mintExecutionTools(
	input: {
		readonly ports: ExecutionToolPorts;
		readonly grantedCapabilities: readonly string[];
		/** The binding's CURRENT `authorizationStatus`, read from the store. ⛔ Never the request's. */
		readonly bindingAuthorizationStatus: string;
	},
	catalog: readonly ExecutionToolTemplate[] = EXECUTION_TOOL_CATALOG
): readonly ExecutionToolDescriptor[] {
	for (const template of catalog) {
		const holdable = RecordPlaneNameSchema.safeParse(template.name);
		if (!holdable.success)
			throw new Error(
				`This host cannot mint a tool named '${template.name}': the record plane cannot hold that name ` +
					`(${holdable.error.issues.map((i) => i.message).join('; ')}). ⛔ R11 bounded ObservedToolCall.toolName ` +
					'by RecordPlaneNameSchema, and a call to a tool the host DID mint is recorded MINTED_BY_HOST with its ' +
					'spelling — so a name the bound refuses makes the WHOLE exchange record unwritable, which is a step ' +
					'that ran with no admissible record of what it did. Refusing at MINTING time removes that state ' +
					'instead of describing it: dropping the spelling is refused by the handler, calling it NOT_MINTED is ' +
					'false, and a third provenance member is an unratified change to a permanent contract. Rename the tool.'
			);
	}
	// ⛔⛔ §22.1 — AND IT IS CHECKED **AFTER** THE NAME BOUND, DELIBERATELY. The catalog check is about what this
	// HOST may ever mint and is a property of the host, not of one grant; returning early above it would make an
	// unholdable name dormant for every revoked binding, which is `P3-d`'s dormancy defect reached by a new road.
	if (!canReuseBindingForNewAttempt(input.bindingAuthorizationStatus)) return [];
	return catalog
		.filter(
			(template) =>
				capabilityAuthorized({
					grantedCapabilities: input.grantedCapabilities,
					requiredCapability: template.capability
				}).ok
		)
		.map((template) => ({
			name: template.name,
			description: template.description,
			parameters: template.parameters,
			capability: template.capability,
			run: template.mint(input.ports)
		}));
}
