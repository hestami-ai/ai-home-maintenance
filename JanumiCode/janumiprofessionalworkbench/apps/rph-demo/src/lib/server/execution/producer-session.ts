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
import type { ToolInvocationResult } from '../tools/backing-tool.js';
import type { ProcessRunner, Workspace } from '@janumipwb/rph-ports';

export interface ProducerSession {
	/** One turn. Turn 1 carries the rendered instruction; later turns carry review findings. */
	turn(text: string): Promise<string | ToolInvocationResult>;
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
 * What an opener is given: the two ports of the Undertaking's sandbox.
 *
 * ⭑ `Pick`, NOT THE WHOLE PORT, AND IT MIRRORS `ProcessRunPlanInput` DELIBERATELY. What decides where a session
 * runs is the workspace's DECLARATIONS, not its ability to store bytes — so the type says which declarations
 * are read, and a test can arrange the case it means without standing up an implementation. An
 * `UndertakingSandbox` satisfies it as-is.
 */
export interface ProducerSessionContext {
	readonly workspace: Pick<
		Workspace,
		'ownerId' | 'ownerKind' | 'materialization' | 'directoryPath'
	>;
	readonly runner: Pick<ProcessRunner, 'kind'>;
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

export type OpenProducerSession = (
	context: ProducerSessionContext
) => Promise<ProducerSession>;

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
	context: ProducerSessionContext
): ProducerWorkingDirectory {
	const named = `${context.workspace.ownerKind} '${context.workspace.ownerId}'`;
	if (context.workspace.materialization !== 'FILESYSTEM')
		return {
			resolved: false,
			refusedBecause:
				context.runner.kind === 'REAL'
					? `The workspace of ${named} is ${context.workspace.materialization} and has no directory on disk, but the wired ProcessRunner is REAL. This is a HOST WIRING ERROR and the session is refused before a single turn is taken: the alternative to refusing is that the producer operates in some other directory — the server's own source tree — while the record says it worked in the Undertaking's workspace.`
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
		dispose: () => undefined,
		retainsHistory: false
	};
}
