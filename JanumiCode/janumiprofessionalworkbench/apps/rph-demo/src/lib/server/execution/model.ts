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
import { executorToolId, selectBackingTool } from '../tools/backing-tool.js';

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
	return JSON.stringify({
		workProduct: 'Assessment complete.',
		basis: seen
	});
}

/**
 * The model an execution step invokes.
 *
 * ⛔ FAILS CLOSED OUTSIDE TEST MODE. `agyPrint` refuses when no judge model is configured, and that refusal is
 * recorded as a failed try (`runModelInvocationStep`) rather than swallowed — a step that could not run says
 * so, and the work unit does not advance as though it had.
 */
export function getExecutionPrint(): (prompt: string) => Promise<string> {
	const forced = TEST_MODE ? process.env.JPWB_ASSESSOR : undefined;
	if (TEST_MODE && forced !== 'agy') return deterministicExecutionPrint;

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
		return async (prompt: string) => (await import('../tools/pi-executor.js')).piExecute(prompt).then((r) => r.answerText);
	if (tool.toolId === 'agy') return (prompt: string) => agyPrint(prompt);
	throw new Error(
		`Backing tool '${tool.toolId}' declares the EXECUTION role but this host has no adapter wired for it yet.`
	);
}
