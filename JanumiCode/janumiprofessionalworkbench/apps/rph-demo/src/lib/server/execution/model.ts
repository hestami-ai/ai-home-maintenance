// JAN-EXECRUN XR-03 — which model runs an execution step.
//
// ⭑ THE SAME SHAPE THE ASSURANCE SEAM ALREADY USES, AND FOR THE SAME RECORDED REASON. `assurance/index.ts`
// selects a deterministic backend ONLY inside test mode, because a mock that could be switched on in any
// environment once let the floor record SATISFIED while nothing reviewed anything. That mistake is not
// repeated here: outside test mode there is exactly one option, and it is the real call.
//
// ⚠ AND `modelSelectionPolicy` IS DELIBERATELY NOT CONSULTED YET. `RUNTIME_BINDING` carries that field and it
// is an ungrounded string with no vocabulary; resolving a model FROM it would mean inventing one, which walks
// through `REG-Q-056`'s door for no gain. This increment reuses the host's configured judge model — the same
// configuration, the same refusal when nothing is set — and the binding gets its meaning when it gets an editor.
import { agyPrint } from '../assurance/agy-cli.js';
import { executorToolId, resolveExecutorToolId, selectBackingTool } from '../tools/backing-tool.js';
import { oneShotSession, type OpenProducerSession } from './producer-session.js';

const TEST_MODE = process.env.RPH_DEMO_MODE === 'test';

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
 * The model an execution step invokes.
 *
 * ⛔ FAILS CLOSED OUTSIDE TEST MODE. `agyPrint` refuses when no judge model is configured, and that refusal is
 * recorded as a failed try (`runModelInvocationStep`) rather than swallowed — a step that could not run says
 * so, and the work unit does not advance as though it had.
 */
export function getExecutionSession(): OpenProducerSession {
	// ⭑⭑ THE EXECUTOR IS LIVE EXACTLY WHEN IT HAS BEEN CONFIGURED — no borrowed switch.
	//
	// ⛔ THIS LINE USED TO READ THE **ASSURANCE** SWITCH: `JPWB_ASSESSOR !== 'agy'` selected the fixture, so
	// running the executor live required setting the ASSESSOR variable to the literal string `'agy'` — while
	// also setting `JPWB_ASSURANCE_TOOL=devin`, a configuration that reads as a contradiction. `JAN-TOOLSUITE`
	// gave the executor its own MODEL and its own TOOL and left this behind: the same borrowed-configuration
	// defect, one layer over, and it was found by trying to use the thing rather than by reasoning about it.
	//
	// ⚠ FAIL-CLOSED IS PRESERVED, NOT WEAKENED. The rule `createFloorRegistry` records is that a deterministic
	// stand-in may be chosen ONLY inside test mode — because a switch honoured in any environment once let the
	// floor record SATISFIED while nothing reviewed anything. Outside test mode there is still exactly one
	// option and it is the real call; this condition only decides which way INSIDE test mode.
	if (TEST_MODE && !resolveExecutorToolId())
		// ⚠ ONE-SHOT BY NATURE, AND IT SAYS SO. The fixture has no memory; wrapping it in a session that
		// CLAIMED history would be the fabricated-capability defect.
		//
		// ⭑ AND IT TAKES NO SANDBOX, WHICH IS A STATEMENT RATHER THAN AN OMISSION. A fixture that echoes a
		// fragment of its own prompt touches no filesystem and needs no working directory; accepting one and
		// ignoring it would advertise a containment guarantee it does not provide. `OpenProducerSession` accepts
		// a narrower function precisely so this stays honest.
		return async () => oneShotSession(deterministicExecutionPrint);

	// ⭑⭑ THE EXECUTOR NOW NAMES ITS OWN TOOL, WHICH IS THE WHOLE POINT OF `JAN-TOOLSUITE`. Until this line the
	// function returned `agyPrint` unconditionally, so the producing tool and model were the ASSURANCE tool and
	// model — producer and reviewer identical BY CONSTRUCTION, and `checkIndependence('DIFFERENT_MODEL', …)`
	// could only ever refuse. `REG-F-356` recorded that refusal happening.
	//
	// ⛔ REFUSES WHEN UNCONFIGURED rather than defaulting to agy. A default would silently restore the collision
	// while every test still passed — which is exactly how it arrived the first time.
	const tool = selectBackingTool(executorToolId(), 'EXECUTION');
	if (tool.toolId === 'pi')
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
		// ⭐ AND IT NOW HANDS THE ADAPTER THE UNDERTAKING'S SANDBOX (JAN-EXEC Phase 2). This was the ONLY seam
		// through which a working directory could reach the executing model, and it was zero-argument — so the
		// adapter had nowhere to get one and hardcoded the SERVER's. Threading the context is what makes the
		// containment fix reachable from production at all.
		return async (context) =>
			(await import('../tools/pi-executor.js')).openPiExecutionSession(context);
	// ⚠ `agy --print` is a fresh process per call: no memory, and the session says so.
	if (tool.toolId === 'agy') return async () => oneShotSession((prompt: string) => agyPrint(prompt));
	throw new Error(
		`Backing tool '${tool.toolId}' declares the EXECUTION role but this host has no adapter wired for it yet.`
	);
}
