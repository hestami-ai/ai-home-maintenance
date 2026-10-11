// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D2; `REG-D-111` (5); `REG-F-530`) — THE FOURTH
// `ProducerSession`: the executor, answering from a committed recording (the roadmap's Phase 8, as `REG-F-530` restated it).
//
// ⭑ WHAT A TURN DOES, IN ORDER:
//   1. the turn's text, scrubbed of this host's directories, must hash to the recorded `turnSha256` — else REPLAY_STALE,
//      naming the try and both hashes, and no tool runs;
//   2. each recorded tool call runs, IN THE ORDER THE MODEL MADE THEM AND ONE AT A TIME, through the REAL tools this
//      host minted for the step's grant (`mintExecutionTools`) — `write_file` into the Undertaking's FILESYSTEM workspace,
//      `run_command` through the REPLAYED runner, so the deliverable is rebuilt by the product's own code and every run
//      reaches the host's own process-run observer, as a live one does;
//   3. each call's outcome, as the host observes it, must be the recorded one — else REPLAY_STALE: a write the workspace
//      now refuses, or a command the runner now refuses, is a run that has diverged from the recording;
//   4. the recorded answer is returned, with the recorded producer — graded HOST_CONFIGURED.
// ⛔ ONE AT A TIME, NOT AS PI RAN THEM (`REG-F-518`): Pi starts one message's calls together, so a recorded run may hold a
// command that started before a write landed. The replay runs the recorded order sequentially; the recording keeps that
// order (`executor.jsonl`) and the recorded outcomes, so a race that mattered shows as an outcome that differs.
// ⛔ NEVER PROVIDER_REPORTED. A replayed exchange that re-reported the recorded `PROVIDER_REPORTED` identity would say a
// provider reported a call that did not happen (`REG-F-530`, "Identity"); the host asserts the recorded producer.
// ⚠ WHAT IT DOES NOT REPRODUCE: the composite payload Pi would have sent (`materializedInput`). The replay has none, and
// says nothing: the exchange records the turn text, as a one-shot producer's does.
import {
	producerWorkingDirectory,
	type ProducerSession,
	type ProducerSessionContext
} from '../execution/producer-session.js';
import { toPiToolResult } from '../agent/pi-tool-result.js';
import { mintExecutionTools } from '../tools/execution-tool-surface.js';
import type {
	AdapterAnswer,
	AdapterToolObservation,
	ToolInvocationResult
} from '../tools/backing-tool.js';
import { createProcessRunObserver } from '../tools/process-run-observer.js';
import { createToolCallObserver } from '../tools/tool-call-observer.js';
import type { RecordedAnswer } from './recording.js';
import type { ReplayRun } from './replay-run.js';

/** The recorded answer, its text expanded to this host's directories — `AdapterAnswer`'s shape, as the run's adapter gave it. */
function answerOf(recorded: RecordedAnswer, expand: (s: string) => string): AdapterAnswer {
	if (recorded.arrived) return { arrived: true, text: expand(recorded.text) };
	if (recorded.cause === 'CALL_FAILED')
		return {
			arrived: false,
			cause: 'CALL_FAILED',
			reportedBy: 'PROVIDER',
			message: recorded.message ?? ''
		};
	if (recorded.cause === 'CALL_ABORTED')
		return {
			arrived: false,
			cause: 'CALL_ABORTED',
			...(recorded.message === undefined ? {} : { message: recorded.message })
		};
	return { arrived: false, cause: 'ENDED_WITHOUT_ANSWER' };
}

/**
 * ⭐ OPEN THE REPLAY'S SESSION over the Undertaking's sandbox, drawing on `run`.
 * ⛔ Refused — thrown, and recorded by the caller as a failed step, as every opener's refusal is — when the workspace has
 * no directory (`producerWorkingDirectory`), and when the runner is not REPLAYED: a replay's commands run through the
 * REPLAYED runner and never a real one, which would re-run them where the recording says what they did.
 */
export async function openReplayExecutionSession(
	context: ProducerSessionContext,
	run: ReplayRun
): Promise<ProducerSession> {
	const working = producerWorkingDirectory(context);
	if (!working.resolved) throw new Error(working.refusedBecause);
	if (context.runner.kind !== 'REPLAYED')
		throw new Error(
			`A replay runs its commands through the REPLAYED runner only, and this sandbox wired a ${context.runner.kind} one: a ` +
				'command a replay ran for real would not be the recorded command, and its review would be asked about another run.'
		);
	const processRuns = createProcessRunObserver();
	// ⭑ THE REAL TOOLS, MINTED FOR THE STEP'S CURRENT GRANT — so a grant that changed since the recording mints another
	// surface, and a recorded call to a tool no longer minted is observed FAILED, as Pi reports an unknown tool, and stales.
	const tools = mintExecutionTools({
		ports: { workspace: context.workspace, runner: context.runner, processRuns },
		grantedCapabilities: context.grantedCapabilities,
		bindingAuthorizationStatus: context.bindingAuthorizationStatus
	});
	const mintedToolNames = tools.map((t) => t.name);
	const observer = createToolCallObserver();
	let callIds = 0;
	let lastTurn: AdapterToolObservation = {
		canObserve: false,
		reason:
			'This replayed session has taken no turn yet, so there is no turn to report an observation about. It is not ' +
			'evidence that no tool ran.'
	};

	return {
		// ⭑ The recorded session held its history (Pi's); a replay returns the recorded answer to each turn in order.
		retainsHistory: true,
		lastTurnObservation: () => lastTurn,
		processRuns: () => processRuns.observed(),
		dispose: () => undefined,
		async turn(text: string): Promise<ToolInvocationResult> {
			const callsBefore = observer.count();
			try {
				const recorded = run.nextExecutorTry(text);
				for (const [index, call] of recorded.toolCalls.entries()) {
					callIds += 1;
					const id = `replay-call-${callIds}`;
					observer.started(id, call.name);
					const tool = tools.find((t) => t.name === call.name);
					// ⛔ ONE AT A TIME: each call awaited before the next starts (`REG-F-518`).
					if (tool === undefined) observer.ended(id, undefined, true);
					else
						observer.ended(
							id,
							toPiToolResult(await tool.run(run.expandArguments(call.arguments))),
							false
						);
					const observed = observer.since(callsBefore).at(-1)?.outcome;
					if (observed !== call.outcome)
						throw run.stale(
							`executor try ${run.consumed().executor} (unit ${recorded.unit}), tool call ${index + 1} (${call.name}): the ` +
								`recorded run observed ${call.outcome}, and this replay observed ${observed ?? 'nothing'}. The run has ` +
								'diverged from the recording.'
						);
				}
				const answer = answerOf(recorded.answer, run.expand);
				return {
					answer,
					rawOutput: answer.arrived ? answer.text : '',
					producer: { ...recorded.producer },
					// ⛔ NEVER PROVIDER_REPORTED — see the header.
					identityEvidence: 'HOST_CONFIGURED',
					observedToolCalls: {
						canObserve: true,
						mintedToolNames,
						calls: observer.since(callsBefore)
					}
				};
			} finally {
				// ⛔ IN THE `finally`, as Pi's adapter does (`B-2`): a turn that failed mid-replay still says which calls ran.
				lastTurn = { canObserve: true, mintedToolNames, calls: observer.since(callsBefore) };
			}
		}
	};
}
