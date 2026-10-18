// JAN-EXECSESS ES-01 — the producer's session, held for as long as the work unit is being worked on.
//
// ⭑ SPONSOR (2026-09-06): *"In JanumiCode v2 … the CLI session wasn't closed or released until the phase or
// sub-phase completed. Here the phase or sub-phase would or could be nearest thought of as a PWU. This approach
// allowed the assurance policies feedback to be fed back to the implementing agent before that phase or
// sub-phase was determined complete."*
//
// ⛔ THE SEAM HAD TO CHANGE SHAPE, NOT JUST BEHAVIOUR. `print: (prompt) => Promise<…>` is ONE-SHOT BY
// CONSTRUCTION: there is nowhere for a second turn to land, so `JAN-EXECLOOP` delivered the loop's state as a
// PROMPT SPLICE — re-rendering the template and appending the findings, which asks the model to produce the
// work again as though for the first time. A session can be told *"the reviewer said this about what you just
// produced"*, because the producer's own history holds what it produced.
//
// ── ⭐ JAN-EXEC PHASE 2 — THE SIGNATURE THAT MADE A CONTAINMENT DEFECT UNAVOIDABLE ───────────────────────────
// `OpenProducerSession` was ZERO-ARGUMENT, so there was no seam through which a working directory could reach
// an executing model — and `openPiExecutionSession` consequently hardcoded `process.cwd()` TWICE. A sandboxed
// step therefore ran in the SvelteKit SERVER'S OWN DIRECTORY, i.e. inside this repository. Widening the opener
// to take the Undertaking's sandbox is what closes it: the working directory now has exactly one source, and
// `producerWorkingDirectory` below is the only thing that may supply it.
import type { AdapterToolObservation, ToolInvocationResult } from '../tools/backing-tool.js';
import type { ProcessRunner, Workspace } from '@janumipwb/rph-ports';
import type { ProcessRunObservation } from '../tools/process-run-observer.js';
import { OBSERVED_PROCESS_RUN_LIMIT } from '../tools/process-run-observer.js';

export interface ProducerSession {
	/** One turn. Turn 1 carries the rendered instruction; later turns carry review findings. */
	turn(text: string): Promise<string | ToolInvocationResult>;
	/**
	 * ⭐⭐ `B-2` — WHAT THIS ADAPTER OBSERVED ON THE TURN THAT JUST **FAILED**.
	 *
	 * ⛔ IT EXISTS BECAUSE A THROW LOSES A MEASUREMENT THAT WAS ALREADY TAKEN. `turn` reports its observation
	 * through `ToolInvocationResult` on the way out — and when the call throws there is no way out, so the
	 * caller's catch arm recorded `NOT_OBSERVABLE` with the reason *"nothing was in a position to observe tool
	 * calls."* **FALSE for the Pi adapter**, whose observer is session-scoped, is subscribed INSIDE `turn()` and
	 * unsubscribed in a `finally`: it HAS the calls, including the ones the model made before the failure.
	 *
	 * ⚠ `R11` created `NOT_OBSERVABLE` to mean *"nothing could look"*. Using it for *"the call failed"* collapses
	 * two facts the discriminator exists to separate — and the collapse runs in the worse direction, because a
	 * step that failed mid-command is exactly when a reader most needs to know which commands ran.
	 *
	 * ⛔ IT IS A REQUIRED MEMBER AND NOT AN OPTIONAL ONE. An adapter that genuinely cannot see must SAY so, in
	 * its own words and for its own reason — `oneShotSession` does — rather than expressing it by leaving a
	 * method out and letting the caller pick a sentence on its behalf. That is the `REG-F-364` dodge shape, and
	 * the sentence it would pick is the false one this member exists to delete.
	 *
	 * ⚠ IT ANSWERS ABOUT THE LAST TURN **ATTEMPTED**, not the last that succeeded, and callers use it only on
	 * the failure path. On a successful turn the observation rides out on the result, which is what the record
	 * is built from.
	 */
	lastTurnObservation(): AdapterToolObservation;
	/**
	 * ⭐⭐ `JAN-EXEC` PHASE 5 — WHAT THE HOST RAN ON THE MODEL'S BEHALF, SO A COMMAND'S RESULT CAN BECOME EVIDENCE.
	 *
	 * ⛔ REQUIRED, FOR THE REASON `lastTurnObservation` IS: an adapter that runs no commands must SAY it ran
	 * none rather than express it by leaving a method out and letting the caller pick a sentence on its behalf.
	 *
	 * ⭐ AND UNLIKE TOOL CALLS, THERE IS NO BLIND CASE HERE, WHICH IS WHY THIS RETURNS A MEASUREMENT AND NOT A
	 * CAN-OBSERVE UNION. Tool calls are dispatched by the model's SDK and the host WATCHES an event stream, so
	 * *"nothing was in a position to look"* is a real state `R11` minted a discriminator for. A process run goes
	 * THROUGH this host's own `ProcessRunner` port: if no run was recorded, no run happened. `observedCount: 0`
	 * is therefore an observed absence and never an absence of observation — the one place in this seam where
	 * those two genuinely coincide, and it is said here so nobody later assumes the discriminator was forgotten.
	 * ⭐ `JAN-MHX` MH-1 (D14a, D14b) — ⚠ FOR A CLI EXECUTOR, ONLY ON A TURN THAT PASSED BOTH CHECKS. A CLI has a shell of its
	 * own, which only its configuration withholds, so "no run recorded" means "none happened" only where the turn's record
	 * proved the CLI's tool surface and the workspace changed only inside the host's calls. A turn that failed either is
	 * CALL_FAILED (`tools/cli-executor-session.ts`), and its absence of runs is not an observed one.
	 */
	processRuns(): ProcessRunObservation;
	/** Released when the work unit stops being worked on — satisfied, escalated, or out of tries. */
	dispose(): void;
	/**
	 * ⚠ DOES THIS PRODUCER ACTUALLY REMEMBER? Declared, because two of the three adapters DO NOT, and a caller
	 * that assumed otherwise would send a bare findings turn to a model with no idea what it is about.
	 *
	 * ⛔ Retrofitting memory onto `agy` or the fixture would be the fabricated-capability defect: they have
	 * none. They implement this interface with INDEPENDENT turns and say so here.
	 */
	readonly retainsHistory: boolean;
}

/**
 * What DECIDES WHERE a session may run: the two ports' own declarations, and nothing else.
 *
 * ⭑ `Pick`, NOT THE WHOLE PORT, AND IT MIRRORS `ProcessRunPlanInput` DELIBERATELY. What decides where a session
 * runs is the workspace's DECLARATIONS, not its ability to store bytes — so the type says which declarations
 * are read, and a test can arrange the case it means without standing up an implementation.
 *
 * ⚠ SPLIT OUT OF `ProducerSessionContext` BY JAN-EXEC PHASE 3 rather than widened along with it. Phase 3 hands
 * the opener the WHOLE ports, because minting `write_file` and `run_command` needs what a workspace can DO and
 * not only what it declares — but `producerWorkingDirectory` still answers its question from the declarations
 * alone, and saying so in the type is what keeps that true for the next reader.
 */
export interface ProducerSessionPorts {
	readonly workspace: Pick<
		Workspace,
		'ownerId' | 'ownerKind' | 'materialization' | 'directoryPath'
	>;
	readonly runner: Pick<ProcessRunner, 'kind'>;
}

/**
 * What an opener is given: the Undertaking's sandbox, and what the step's binding CURRENTLY grants.
 *
 * ── ⭐⭐ JAN-EXEC PHASE 3 — THE GRANT IS PART OF THE CONTEXT, AND IT IS REQUIRED ───────────────────────────────
 *
 * `grantedCapabilities` decides which tools are MINTED, and an ungranted tool is never minted at all — so this
 * field is what stands between a model and a shell. ⛔ IT IS REQUIRED, WITH NO DEFAULT, for the reason
 * `RunModelStepInput.binding` is: an optional grant makes *"open a session and skip the capability question"*
 * expressible by OMISSION, which is the dodge shape `REG-F-364` records. And there is no honest default —
 * `[]` would silently disarm every step whose caller merely forgot, while anything wider would silently arm
 * one. A required field makes the caller say which case it is in.
 *
 * ⚠ AND IT IS THE STORED GRANT, NOT THE REQUEST. The caller reads it from the RUNTIME_BINDING at invocation
 * time — §22.1's *"revoked bindings cannot be used for new attempts"* — so a revocation between tries changes
 * which tools the next session is given. Passing the request back would be a check that cannot fail.
 *
 * ⭑ THE PORTS ARE WHOLE HERE, and an `UndertakingSandbox` still satisfies that half as-is.
 */
export interface ProducerSessionContext extends ProducerSessionPorts {
	readonly workspace: Workspace;
	readonly runner: ProcessRunner;
	readonly grantedCapabilities: readonly string[];
	/**
	 * ⭐⭐ `B-1` — THE BINDING'S CURRENT `authorizationStatus`, BECAUSE A CAPABILITY LIST IS NOT AN AUTHORIZATION.
	 *
	 * ⛔ DRIVEN: `RevokeRuntimeCapability` advances the status to REVOKED and **deliberately does not clear**
	 * `grantedCapabilities` — its handler says so, because the revocation event is derived from the set the
	 * binding held. So a context carrying only the LIST was identical before and after a revocation, and the
	 * session minted the full tool surface for a binding whose authorization had been withdrawn. §22.1:
	 * *"Revoked bindings cannot be used for new attempts."*
	 *
	 * ⛔ REQUIRED, WITH NO DEFAULT, for the same reason `grantedCapabilities` is: an optional status makes
	 * *"open a session without asking whether the binding still stands"* expressible by OMISSION, and there is
	 * no honest default — `'AUTHORIZED'` would silently arm every caller that forgot.
	 */
	readonly bindingAuthorizationStatus: string;
}

/**
 * A directory a producer session may lawfully run in, or a stated reason there is none.
 *
 * ⛔ A UNION FOR THE SAME REASON `ProcessRunPlan` IS ONE: a shape with an optional error would let a caller read
 * `directoryPath` off a refusal, and the value it would read is the one nobody could supply — which is the
 * failure this function exists to prevent.
 */
export type ProducerWorkingDirectory =
	| { readonly resolved: true; readonly directoryPath: string }
	| { readonly resolved: false; readonly refusedBecause: string };

export type OpenProducerSession = (context: ProducerSessionContext) => Promise<ProducerSession>;

/**
 * The ONLY sanctioned source of a producer session's working directory.
 *
 * ⛔⛔ THERE IS NO FALLBACK ARM, AND ITS ABSENCE IS THE GUARANTEE. Every refusal below has an obvious
 * "reasonable" repair — use the server's directory — and that repair is precisely the defect: an execution step
 * would write its product into the SvelteKit server's own source tree, i.e. into this repository, while the
 * record said it ran in the Undertaking's workspace. `planProcessRun` states the same rule for a command's
 * `cwd`; this states it for a session's.
 *
 * ⚠ THE TWO IN_MEMORY REFUSALS DIFFER ON PURPOSE, exactly as `planProcessRun`'s do. With a REFUSING runner the
 * combination is the library's own hermetic default — the demo with no durable root configured — and the
 * refusal is expected. With a REAL one it is a HOST WIRING ERROR whose unguarded consequence is a model
 * operating somewhere nobody chose. One message for both would make a misconfiguration read exactly like the
 * default, and once that wording is normal noise the real misconfiguration is invisible.
 */
export function producerWorkingDirectory(
	// ⚠ THE DECLARATIONS, NOT THE WHOLE CONTEXT. Phase 3 widened `ProducerSessionContext` to carry the live
	// ports and the grant; taking the narrower type here states that NONE of that may influence WHERE a session
	// runs — and makes an attempt to read it a compile error rather than a review comment.
	context: ProducerSessionPorts
): ProducerWorkingDirectory {
	const named = `${context.workspace.ownerKind} '${context.workspace.ownerId}'`;
	if (context.workspace.materialization !== 'FILESYSTEM')
		return {
			resolved: false,
			refusedBecause:
				context.runner.kind === 'REAL'
					? `The workspace of ${named} is ${context.workspace.materialization} and has no directory on disk, but the wired ProcessRunner is REAL. This is a HOST WIRING ERROR and the session is refused before a single turn is taken: the alternative to refusing is that the producer operates in some other directory — the server's own source tree — while the record says it worked in the Undertaking's workspace.`
					: // ⭐ `JAN-EXEC` Phase 8 (D2, D3) — the REPLAYED runner's own true sentence: the replay host pairs it with a
						// FILESYSTEM workspace only (`workspace-host.ts`), so this is its wiring error, and nothing runs live.
						context.runner.kind === 'REPLAYED'
						? `The workspace of ${named} is ${context.workspace.materialization} and has no directory on disk, but the wired ProcessRunner is REPLAYED. This is a HOST WIRING ERROR and the session is refused before a single turn is taken: a replay is wired against a FILESYSTEM workspace only, where its recorded tool calls write, and here they have nowhere to go. Nothing runs live in a replay, so no producer operated anywhere.`
						: `The workspace of ${named} is ${context.workspace.materialization} and has no directory on disk, and the wired ProcessRunner is REFUSING. This is the host's default rather than a misconfiguration: nothing durable is configured, so no producer that needs a working directory can be opened. Configure JPWB_DEMO_DB so the Undertaking gets a durable workspace root.`
		};
	// A FILESYSTEM workspace with no directory contradicts its own declaration. Trusting the enum and reading
	// `directoryPath!` would hand `undefined` to an adapter, and every adapter in reach resolves that to the
	// parent process's cwd — the exact escape this function exists to close, arriving through the arm that was
	// supposed to be safe.
	const directoryPath = context.workspace.directoryPath;
	if (directoryPath === undefined || directoryPath === '')
		return {
			resolved: false,
			refusedBecause: `The workspace of ${named} declares materialization FILESYSTEM but carries no directoryPath, so there is no directory to run in. The declaration and the field disagree, and a producer handed no directory inherits the server's — which is the containment failure this check exists to prevent.`
		};
	return { resolved: true, directoryPath };
}

/**
 * Wrap a one-shot call as a session whose turns are independent.
 *
 * ⭑ THIS IS AN HONEST ADAPTER, NOT A SHIM. `agy --print` and the deterministic fixture genuinely have no
 * memory: every invocation is a fresh process with a fresh context. Presenting them through the session
 * interface lets one caller drive every backing tool, while `retainsHistory: false` keeps the difference
 * VISIBLE rather than papering over it.
 */
export function oneShotSession(
	call: (prompt: string) => Promise<string | ToolInvocationResult>
): ProducerSession {
	return {
		turn: (text) => call(text),
		// ⛔ THE HONEST ANSWER, AND IT IS THIS ADAPTER'S OWN. A one-shot call has no session, no tool surface and
		// no subscriber: there genuinely was nothing in a position to look, on a failed turn as on a successful
		// one. ⚠ THE REASON IS SPELLED HERE RATHER THAN IN THE CALLER because it is a fact about THIS adapter —
		// a caller writing one sentence for every adapter is exactly how `B-2`'s false statement was produced.
		lastTurnObservation: () => ({
			canObserve: false,
			reason:
				'This producer is a ONE-SHOT call with no held session: it mints no tools, subscribes to no tool ' +
				'events, and had no observer running when the turn failed. Nothing was in a position to observe ' +
				'tool calls, so this record is not evidence that none ran.'
		}),
		// ⭐ PHASE 5 — A ONE-SHOT CALL MINTS NO TOOLS, SO IT RAN NO COMMANDS, AND THAT IS A MEASUREMENT.
		// ⚠ CONTRAST IT WITH `lastTurnObservation` DIRECTLY ABOVE, WHICH REFUSES TO ANSWER. The difference is
		// not inconsistency: a tool CALL would be dispatched by a session this adapter does not have and could
		// not watch, while a process RUN would go through this host's own port — and this adapter never hands
		// that port to anyone. Zero here is what happened, not what could not be seen.
		processRuns: () => ({ runs: [], observedCount: 0, recordedLimit: OBSERVED_PROCESS_RUN_LIMIT }),
		dispose: () => undefined,
		retainsHistory: false
	};
}
