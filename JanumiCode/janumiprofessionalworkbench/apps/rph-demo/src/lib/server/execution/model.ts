// JAN-EXECRUN XR-03 — which model runs an execution step.
//
// ⭑ THE SAME SHAPE THE ASSURANCE SEAM ALREADY USES, AND FOR THE SAME RECORDED REASON. `assurance/index.ts`
// selects a deterministic backend ONLY inside test mode, because a mock that could be switched on in any
// environment once let the floor record SATISFIED while nothing reviewed anything. That mistake is not
// repeated here: outside test mode there is exactly one option, and it is the real call.
//
// ⚠ AND `modelSelectionPolicy` IS DELIBERATELY NOT CONSULTED YET. `RUNTIME_BINDING` carries that field and it
// is an ungrounded string with no vocabulary; resolving a model FROM it would mean inventing one, which walks
// through `REG-Q-056`'s door for no gain. ~~This increment reuses the host's configured judge model — the same
// configuration, the same refusal when nothing is set — and the binding gets its meaning when it gets an editor.~~
// ⭐ `JAN-SELRES` RS-1 (D4) — CORRECTED: the executor has its own configuration (`JPWB_EXECUTOR`,
// `JPWB_EXECUTOR_MODEL`), read ONCE by the executor selector (`executor-selection.ts`) before dispatch, and this module
// opens what that selection names; it reads no environment and no test-mode constant of its own. The binding still
// gets its meaning when it gets an editor.
import { agyPrintWithModel, type AgyExec } from '../assurance/agy-cli.js';
import type { RunnableExecutorSelection } from './executor-selection.js';
import {
	oneShotSession,
	type OpenProducerSession,
	type ProducerSession,
	type ProducerSessionContext
} from './producer-session.js';

// ~~`const TEST_MODE = process.env.RPH_DEMO_MODE === 'test';`~~ ⭐ `JAN-SELRES` RS-1 (D4) — GONE, and design G4 with
// it. This module kept its own load-time test-mode read beside the routes' `isTestMode()`, so a test could switch one
// and not the other. The only test-mode read is now the CALLER's, handed to `selectExecutor`, and only test mode yields
// the STAND-IN.

/**
 * The deterministic answer used in E2E.
 *
 * ⭑ IT IS DELIMITED, AND THAT IS THE POINT RATHER THAN A CONVENIENCE. `REG-F-351` records the discovery: the
 * §9.7 retention split locates a JSON object, so an UNDELIMITED prose answer is blocked from retention and a
 * step's work product is never kept. A demo whose fixture returned prose would therefore exercise the blocked
 * path and quietly prove the opposite of what it claims — so the fixture answers the way a template with a
 * stated `outputContract` asks a real model to answer.
 */
export async function deterministicExecutionPrint(prompt: string): Promise<string> {
	// Echoes a fragment of the prompt so a test can prove the MODEL SAW THE RENDERED TEMPLATE, rather than
	// proving only that some string came back.
	const seen = prompt.slice(0, 120).replace(/["\\\n]/g, ' ').trim();
	// ⭑ IT NOW RETURNS THE EXECUTION CONTRACT'S ENVELOPE, because a fixture that does not model a COMPLIANT
	// answer exercises the non-compliant path forever. `JAN-EXECRAT` requires `{workProduct, rationale}`;
	// the old shape happened to carry a top-level `workProduct` key and would have been read as a
	// MALFORMED envelope — green, and silently taking the shortfall branch on every single run.
	return JSON.stringify({
		workProduct: { finding: 'Assessment complete.', basis: seen },
		rationale: {
			rationale: 'The instruction asked for an assessment and the finding states one.',
			assumptions: ['The rendered instruction is complete.'],
			limitations: ['This fixture performs no analysis.'],
			residualUncertainty: []
		}
	});
}

/**
 * ⭐ `JAN-SELRES` RS-1 (D4) — the two seams `getExecutionSession` opens through, injectable ONLY so the gate can reach
 * both runnable branches: the `AgyExec` precedent (`agy-cli.ts`).
 *   · `agyExec` — handed to `agyPrintWithModel`, so a test sees the argv (the model agy is asked to run) and a failure's
 *     sanitised text, and nothing is spawned.
 *   · `openPi` — the Pi opener. ⚠ Its default is the LAZY import below, so the gate never loads Pi's SDK; a test hands
 *     in its own and so never opens a real Pi session.
 */
export interface ExecutionSessionDeps {
	readonly agyExec?: AgyExec;
	readonly openPi?: (context: ProducerSessionContext, modelId: string) => Promise<ProducerSession>;
}

/**
 * The producer an execution step invokes — opened for what the executor SELECTION names.
 *
 * ~~⛔ FAILS CLOSED OUTSIDE TEST MODE. `agyPrint` refuses when no judge model is configured, and that refusal is
 * recorded as a failed try (`runModelInvocationStep`) rather than swallowed — a step that could not run says
 * so, and the work unit does not advance as though it had.~~ ⭐ `JAN-SELRES` RS-1 (D4) — CORRECTED: the agy executor
 * no longer asks for the JUDGE model, and a misconfigured executor never reaches here. `beginExecute` asks
 * `selectExecutor` before its dispatch batch and returns a refusal with its guidance, so this takes only a RUNNABLE
 * selection — a refusal cannot reach an executor by type. ⛔ What still fails here, after dispatch, is recorded as a
 * failed step rather than swallowed: an unresolvable Pi model (resolving one needs Pi's SDK, which the gate never
 * loads), a sandbox refusal, and an agy call that fails.
 */
export function getExecutionSession(
	selection: RunnableExecutorSelection,
	deps: ExecutionSessionDeps = {}
): OpenProducerSession {
	// ⭑⭑ THE EXECUTOR IS LIVE EXACTLY WHEN IT HAS BEEN CONFIGURED — no borrowed switch.
	//
	// ⛔ THIS FUNCTION USED TO READ THE **ASSURANCE** SWITCH: `JPWB_ASSESSOR !== 'agy'` selected the fixture, so
	// running the executor live required setting the ASSESSOR variable to the literal string `'agy'` — while
	// also setting `JPWB_ASSURANCE_TOOL=devin`, a configuration that reads as a contradiction. `JAN-TOOLSUITE`
	// gave the executor its own MODEL and its own TOOL and left this behind: the same borrowed-configuration
	// defect, one layer over, and it was found by trying to use the thing rather than by reasoning about it.
	//
	// ⚠ FAIL-CLOSED IS PRESERVED, NOT WEAKENED. The rule `createFloorRegistry` records is that a deterministic
	// stand-in may be chosen ONLY inside test mode — because a switch honoured in any environment once let the
	// floor record SATISFIED while nothing reviewed anything. ⭐ `JAN-SELRES` D4: the selector holds that rule now — it
	// answers STAND_IN only in test mode with no tool named — so this branch opens what it was told to.
	if (selection.kind === 'STAND_IN')
		// ⚠ ONE-SHOT BY NATURE, AND IT SAYS SO. The fixture has no memory; wrapping it in a session that
		// CLAIMED history would be the fabricated-capability defect.
		//
		// ⭑ AND IT TAKES NO SANDBOX, WHICH IS A STATEMENT RATHER THAN AN OMISSION. A fixture that echoes a
		// fragment of its own prompt touches no filesystem and needs no working directory; accepting one and
		// ignoring it would advertise a containment guarantee it does not provide. `OpenProducerSession` accepts
		// a narrower function precisely so this stays honest.
		return async () => oneShotSession(deterministicExecutionPrint);

	// ⭑⭑ THE EXECUTOR NAMES ITS OWN TOOL, WHICH IS THE WHOLE POINT OF `JAN-TOOLSUITE`. Until then this function
	// returned `agyPrint` unconditionally, so the producing tool and model were the ASSURANCE tool and
	// model — producer and reviewer identical BY CONSTRUCTION, and `checkIndependence('DIFFERENT_MODEL', …)`
	// could only ever refuse. `REG-F-356` recorded that refusal happening.
	//
	// ⛔ AN UNCONFIGURED HOST IS REFUSED rather than defaulted to agy — by the selector, before dispatch. A default
	// would silently restore the collision while every test still passed — which is exactly how it arrived the first
	// time.
	if (selection.kind === 'PI') {
		// Loaded lazily so the gate never pulls Pi's heavy Node deps — the rule `agent/index.ts` already follows.
		//
		// ⛔ RETURNS THE WHOLE RESULT, AND IT USED TO SAY `.then((r) => r.answerText)`. `TS-04` widened this seam
		// precisely so a tool could report WHO ANSWERED — and this line, written before that, threw the identity
		// away and handed back a bare string. The record then fell to the host-configured fallback and wrote
		// `resolvedModel: "unresolved"` while a real model had in fact answered.
		//
		// ⚠ NO UNIT TEST COULD HAVE CAUGHT IT. Every test of `runModelInvocationStep` INJECTS its own `print`
		// returning a rich result, so the one adapter that narrows it was never on any tested path. The LIVE
		// lane found it on its second run — which is the argument for the lane, in one line.
		//
		// ⭐ AND IT HANDS THE ADAPTER THE UNDERTAKING'S SANDBOX (JAN-EXEC Phase 2). This was the ONLY seam
		// through which a working directory could reach the executing model, and it was zero-argument — so the
		// adapter had nowhere to get one and hardcoded the SERVER's. Threading the context is what makes the
		// containment fix reachable from production at all.
		//
		// ⭐ `JAN-SELRES` RS-1 (D4) — AND THE SELECTION'S MODEL. Pi used to read `JPWB_EXECUTOR_MODEL` itself when it
		// opened (`executorModel()`), a third read of the configuration; it is now handed the one the selection holds,
		// which is also the one the record names. ⚠ `openPi` is not called until the returned opener is: selecting Pi
		// costs nothing and loads nothing.
		const openPi =
			deps.openPi ??
			(async (context: ProducerSessionContext, modelId: string) =>
				(await import('../tools/pi-executor.js')).openPiExecutionSession(context, modelId));
		return async (context) => openPi(context, selection.modelId);
	}
	// ⚠ `agy --print` is a fresh process per call: no memory, and the session says so.
	// ⭐ `JAN-SELRES` RS-1 (D2; `REG-F-458`) — AND IT RUNS THE SELECTION'S MODEL. This called `agyPrint`, which pins
	// `JPWB_JUDGE_MODEL`, while the step recorded `JPWB_EXECUTOR_MODEL`: with agy on both sides, both calls ran one model
	// and the record showed two. `agyPrintWithModel` shares `agyPrint`'s argv, bounds and sanitising catch.
	if (selection.kind === 'AGY')
		return async () =>
			oneShotSession((prompt: string) => agyPrintWithModel(prompt, selection.modelId, deps.agyExec));
	// ⛔ EXHAUSTIVE, AND A SELECTION NOBODY WIRED OPENS NOTHING. The type admits no other kind, so this is unreachable
	// today; it exists so that a new kind — or a refusal that reached here past the type — is refused when opened,
	// rather than falling through to whichever tool happened to be written last.
	const unwired: never = selection;
	return async () => {
		throw new Error(
			`No executor is wired for the selection ${JSON.stringify(unwired)}; refusing rather than substituting one.`
		);
	};
}
