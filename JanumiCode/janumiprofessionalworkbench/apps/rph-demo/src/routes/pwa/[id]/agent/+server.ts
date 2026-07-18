// SSE relay for the PWA Designer's authoring agent. POST { instruction } starts a run scoped to this DRAFT PWA and
// streams normalized AuthoringAgentEvents (status / text / thinking / tool_start / tool_end / error / done) as
// Server-Sent Events. The browser reads the stream and re-renders a point-in-time candidate as tool calls land.
// Agent tools, transcript writes, and assurance run on an isolated EngineHandle fork. Canonical state changes only
// after a human accepts the exact assured candidate hash and guarded replay succeeds atomically.
import { error, json } from '@sveltejs/kit';
import {
	agentMode,
	isTestMode,
	makeAuthoringBroker,
	recordConversation
} from '$lib/server/workbench';
import { createAuthoringAgent, type AuthoringAgentEvent } from '$lib/server/agent';
import {
	isRecordable,
	narrationOf,
	TRANSCRIPT_KIND,
	type TranscriptEntry
} from '$lib/server/agent/transcript';
import {
	classifyFloorRemediation,
	runPwaFloor,
	type FloorObservationView,
	type FloorProducer,
	type FloorRemediation,
	type FloorView
} from '$lib/server/floor';
import { assurancePreflight } from '$lib/server/assurance/preflight';
import {
	beginAuthoringTurn,
	discardAuthoringTurn,
	hashAuthoringSubject,
	markAuthoringTurnAssured,
	markAuthoringTurnExternalBlock,
	markAuthoringTurnRevisionRequired,
	markAuthoringTurnValid,
	type AuthoringTurn
} from '$lib/server/authoring-turn';
import type { RequestHandler } from './$types';

type TurnEntry = TranscriptEntry;

/** Compact a tool's args for the transcript (mirrors the client log). */
function compactArgs(args: Record<string, unknown> | undefined): string {
	if (!args) return '';
	const fmt = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v));
	return Object.entries(args)
		.map(([k, v]) => `${k}=${fmt(v)}`)
		.join(', ');
}

/** A one-line status summary of a floor run for the agent log. */
function floorStatus(f: FloorView): string {
	if (f.satisfied) {
		return '⚖ Assurance floor SATISFIED — schema, provenance, and an independent reasoning review all pass.';
	}
	const validFindings = classifyFloorRemediation(f).findings.length;
	const gaps = validFindings ? ` · ${validFindings} valid reasoning finding(s)` : '';
	return `⚖ Assurance floor ${f.aggregate}${gaps}.`;
}

/** Turn the Reasoning Review's open findings into an auto-refinement directive for the executor. */
function refineDirective(prompt: string, findings: readonly FloorObservationView[]): string {
	const list = findings
		.slice(0, 6)
		.map((finding, i) => `${i + 1}. [${finding.code}] ${finding.statement}`)
		.join('\n');
	return [
		'An independent assurance Reasoning Review produced valid findings about the authored PWA subject.',
		'Revise the PWA graph and/or its recorded professional rationale as each coded finding requires; do not merely restate the intent:',
		list,
		'',
		`Original intent: ${prompt}`
	].join('\n');
}

interface FloorTurnResult {
	readonly floor?: FloorView;
	readonly remediation?: FloorRemediation;
	readonly subjectHash?: string;
	readonly externalDetail?: string;
}

/** Run and RECORD the floor entirely inside the staged candidate. The subject hash is computed immediately before
 * each review and carried into its observable input/correlation. A valid subject finding may cause one isolated
 * refinement/re-review; operational reviewer failures never become graph-edit instructions. */
async function runFloorAfterTurn(ctx: {
	pwaId: string;
	instruction: string;
	transcript: TurnEntry[];
	turn: AuthoringTurn;
	agent: Awaited<ReturnType<typeof createAuthoringAgent>>;
	mode: 'mock' | 'pi';
	/** The ACTUAL producer this run resolved to; undefined if the run never got that far. */
	producer: FloorProducer | undefined;
	onEvent: (ev: AuthoringAgentEvent) => void;
	send: (ev: AuthoringAgentEvent) => void;
	signal: AbortSignal;
}): Promise<FloorTurnResult> {
	const { pwaId, instruction, transcript, turn, agent, mode, producer, onEvent, send, signal } =
		ctx;
	// Fail closed (§8.12): with no resolved model/provider the Reasoning Review's independence cannot be
	// established, and an Assessment that cannot establish independence must not be recorded as if it had.
	if (!producer) {
		const text =
			'⚖ Assurance floor not run — the producing model/provider never resolved, so reviewer independence cannot be established. PublishPwa remains blocked; retry the producing run or repair its model/provider configuration before rerunning assurance.';
		send({
			kind: 'status',
			text
		});
		transcript.push({ role: 'SYSTEM', kind: 'message', text });
		return { externalDetail: text };
	}
	const planText = () => narrationOf(transcript);
	const noteFloor = (f: FloorView) => {
		const t = floorStatus(f);
		send({ kind: 'status', text: t });
		transcript.push({ role: 'SYSTEM', kind: 'message', text: t });
	};
	try {
		send({ kind: 'status', text: '⚖ Running the assurance floor (independent reasoning review)…' });
		// §9.7's two halves: the account the producer RETURNED, and its observable narration.
		let subjectHash = hashAuthoringSubject(turn);
		let floor = await runPwaFloor(
			pwaId,
			{
				prompt: instruction,
				producer,
				rationale: agent.rationale(),
				narration: planText(),
				candidateSubjectHash: subjectHash
			},
			turn.engine
		);
		if (!floor) return { externalDetail: 'The candidate graph could not be loaded for assurance.' };
		noteFloor(floor);
		let remediation = classifyFloorRemediation(floor);
		if (mode !== 'mock' && remediation.autoRefine) {
			transcript.push({
				role: 'SYSTEM',
				kind: 'message',
				text: '↻ Auto-refinement pass (addressing valid reviewer subject findings)'
			});
			send({
				kind: 'status',
				text: '↻ Auto-refinement pass (addressing valid reviewer subject findings)…'
			});
			await agent.run(refineDirective(instruction, remediation.findings), onEvent, signal);
			subjectHash = hashAuthoringSubject(turn);
			floor = await runPwaFloor(
				pwaId,
				{
					prompt: instruction,
					producer,
					// Re-read after the refinement pass: the producer may have declared a revised account.
					rationale: agent.rationale(),
					narration: planText(),
					priorGaps: remediation.findings.map((finding) => finding.statement),
					candidateSubjectHash: subjectHash
				},
				turn.engine
			);
			if (floor) {
				noteFloor(floor);
				remediation = classifyFloorRemediation(floor);
			}
		}
		if (floor && !floor.satisfied) {
			const text = `⚠ ${remediation.guidance}`;
			send({ kind: 'status', text });
			transcript.push({ role: 'SYSTEM', kind: 'message', text });
		}
		return { floor, remediation, subjectHash };
	} catch (error_) {
		const detail = error_ instanceof Error ? error_.message : String(error_);
		const text = `⚖ Assurance floor could not run: ${detail} PublishPwa remains blocked; configure or retry the independent reviewer, or change to a permitted independent validator, then rerun assurance. Do not revise the PWA or record a waiver in response to this execution failure.`;
		send({
			kind: 'status',
			text
		});
		transcript.push({ role: 'SYSTEM', kind: 'message', text });
		return { externalDetail: text };
	}
}

export const POST: RequestHandler = async ({ params, request }) => {
	const broker = makeAuthoringBroker(params.id);
	const pwa = broker.getPwa();
	if (!pwa) throw error(404, 'PWA not found');

	let instruction = '';
	try {
		const body = (await request.json()) as { instruction?: unknown };
		instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
	} catch {
		instruction = '';
	}
	if (!instruction) return json({ error: 'An instruction is required.' }, { status: 400 });

	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			let closed = false;
			let turn: AuthoringTurn | undefined;
			let conversationRecorded = false;
			const send = (event: AuthoringAgentEvent) => {
				if (closed) return;
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
			};
			// Build the candidate transcript as the run streams. It becomes canonical only with the accepted turn.
			const transcript: TurnEntry[] = [{ role: 'USER', kind: 'message', text: instruction }];
			// §9.7 write boundary: volunteered reasoning material is never admitted to the durable transcript.
			// Events are immutable and permanent (§9.4), so anything recorded here could never be purged — the
			// drop has to happen before the write, not after. See $lib/server/agent/transcript.
			const record = (ev: AuthoringAgentEvent) => {
				if (!isRecordable(TRANSCRIPT_KIND[ev.kind] ?? '')) return;
				if (ev.kind === 'text') {
					const last = transcript.at(-1);
					if (last?.role === 'AGENT' && last.kind === 'message') last.text += ev.text;
					else transcript.push({ role: 'AGENT', kind: 'message', text: ev.text });
				} else if (ev.kind === 'tool_start') {
					transcript.push({
						role: 'AGENT',
						kind: 'tool_call',
						text: `${ev.tool}(${compactArgs(ev.args)})`
					});
				} else if (ev.kind === 'tool_end') {
					transcript.push({
						role: 'AGENT',
						kind: 'tool_result',
						text: `${ev.tool}: ${ev.summary}`,
						success: ev.ok
					});
				} else if (ev.kind === 'error') {
					transcript.push({ role: 'SYSTEM', kind: 'error', text: ev.message });
				}
			};
			try {
				if (pwa.publicationStatus !== 'DRAFT') {
					send({
						kind: 'error',
						message: `This PWA is ${pwa.publicationStatus}, not DRAFT — authoring is closed (a published version is immutable).`
					});
					send({ kind: 'done' });
					return;
				}
				const mode = agentMode();
				// Do not begin even an isolated candidate when its mandatory independent reviewer is already
				// known to be unconfigured. This is a configuration-only preflight; it never invokes agy.
				const preflight = assurancePreflight({
					testMode: isTestMode(),
					assessor: process.env.JPWB_ASSESSOR,
					judgeModel: process.env.JPWB_JUDGE_MODEL
				});
				if (!preflight.ready) {
					const text = `⚖ Assurance preflight blocked (${preflight.code}). ${preflight.guidance}`;
					send({ kind: 'status', text });
					transcript.push({ role: 'SYSTEM', kind: 'message', text });
					send({ kind: 'done' });
					return;
				}
				turn = beginAuthoringTurn(params.id);
				const agent = await createAuthoringAgent(turn.broker, mode);
				// The run declares its ACTUAL resolved model/provider; the floor binds independence to that, never
				// to a role label (§8.12).
				let producer: FloorProducer | undefined;
				const onEvent = (ev: AuthoringAgentEvent) => {
					if (ev.kind === 'producer') producer = ev.producer;
					// Pi/mock runs may emit `done` before the mandatory floor. The route owns the one terminal event.
					if (ev.kind !== 'done') send(ev);
					record(ev);
				};
				await agent.run(instruction, onEvent, request.signal);

				markAuthoringTurnValid(turn);
				// Run + record the de minimis floor over the same isolated candidate and auto-refine at most once.
				const floorResult = await runFloorAfterTurn({
					pwaId: params.id,
					instruction,
					transcript,
					turn,
					agent,
					mode,
					producer,
					onEvent,
					send,
					signal: request.signal
				});

				// The transcript is part of the same candidate/command package, never an early canonical side effect.
				recordConversation(params.id, transcript, turn.engine, turn.id);
				conversationRecorded = true;

				if (floorResult.floor?.satisfied && floorResult.subjectHash) {
					const candidateHash = markAuthoringTurnAssured(turn, floorResult.subjectHash);
					const text = `✓ Assured candidate ${candidateHash} is staged. Canonical DRAFT is unchanged until you accept this exact preview.`;
					send({ kind: 'status', text });
				} else {
					const remediation = floorResult.remediation;
					const operational =
						floorResult.externalDetail ||
						remediation?.action === 'RETRY_OR_CONFIGURE_REVIEWER' ||
						remediation?.action === 'CHANGE_REVIEWER' ||
						remediation?.action === 'ESCALATE_REVIEW';
					const detail =
						floorResult.externalDetail ||
						remediation?.guidance ||
						'The candidate did not satisfy the authoring assurance floor.';
					if (operational) markAuthoringTurnExternalBlock(turn, detail);
					else markAuthoringTurnRevisionRequired(turn, detail);
					send({
						kind: 'status',
						text: 'The candidate remains staged for inspection or discard; canonical DRAFT is unchanged.'
					});
				}
				send({ kind: 'done' });
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				record({ kind: 'error', message });
				if (turn) {
					if (request.signal.aborted) {
						try {
							discardAuthoringTurn(params.id);
						} catch {
							// Canonical state is still unchanged; cleanup is best effort on disconnect.
						}
					} else if (turn.status === 'COLLECTING' || turn.status === 'ASSURING') {
						try {
							if (!conversationRecorded) {
								recordConversation(params.id, transcript, turn.engine, turn.id);
								conversationRecorded = true;
							}
							markAuthoringTurnRevisionRequired(turn, message);
						} catch {
							// Preserve the isolated candidate for inspection; never fall back to canonical persistence.
						}
					}
				}
				send({ kind: 'error', message });
				send({ kind: 'done' });
			} finally {
				closed = true;
				try {
					controller.close();
				} catch {
					// already closed (e.g. client disconnected) — nothing to do
				}
			}
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive'
		}
	});
};
