// SSE relay for the PWA Designer's authoring agent. POST { instruction } starts a run scoped to this DRAFT PWA and
// streams normalized AuthoringAgentEvents (status / text / thinking / tool_start / tool_end / error / done) as
// Server-Sent Events. The browser reads the stream and re-renders the node graph as tool calls land. The engine is
// the source of truth: the agent only proposes through the broker's tools, so a client disconnect (which aborts the
// run) can never leave the DRAFT in a bad state — each accepted command already committed atomically.
import { error, json } from '@sveltejs/kit';
import { agentMode, makeAuthoringBroker, recordConversation } from '$lib/server/workbench';
import { createAuthoringAgent, type AuthoringAgentEvent } from '$lib/server/agent';
import {
	isRecordable,
	narrationOf,
	TRANSCRIPT_KIND,
	type TranscriptEntry
} from '$lib/server/agent/transcript';
import { runPwaFloor, type FloorProducer, type FloorView } from '$lib/server/floor';
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
	const gaps = f.reasoningGaps.length ? ` · ${f.reasoningGaps.length} reasoning finding(s)` : '';
	return `⚖ Assurance floor ${f.aggregate}${gaps}.`;
}

/** Turn the Reasoning Review's open findings into an auto-refinement directive for the executor. */
function refineDirective(prompt: string, gaps: string[]): string {
	const list = gaps
		.slice(0, 6)
		.map((g, i) => `${i + 1}. ${g}`)
		.join('\n');
	return [
		'An independent assurance Reasoning Review flagged these gaps between your PWU-Type graph and the intent.',
		'Revise the graph to genuinely address them (do not merely restate the intent):',
		list,
		'',
		`Original intent: ${prompt}`
	].join('\n');
}

/** After an authoring turn: run + RECORD the de minimis assurance floor (§8.4) over the DRAFT graph, and — non-mock
 *  only (the offline mock would mutate the graph off the NL directive) — auto-refine ONCE against the Reasoning
 *  Review findings and re-run. A still-unsatisfied floor blocks PublishPwa (the gate) until the human revises the
 *  graph or records a waiver. Guarded so an agy hiccup never nukes a turn whose authoring already committed. */
async function runFloorAfterTurn(ctx: {
	pwaId: string;
	instruction: string;
	transcript: TurnEntry[];
	agent: Awaited<ReturnType<typeof createAuthoringAgent>>;
	mode: 'mock' | 'pi';
	/** The ACTUAL producer this run resolved to; undefined if the run never got that far. */
	producer: FloorProducer | undefined;
	onEvent: (ev: AuthoringAgentEvent) => void;
	send: (ev: AuthoringAgentEvent) => void;
	signal: AbortSignal;
}): Promise<void> {
	const { pwaId, instruction, transcript, agent, mode, producer, onEvent, send, signal } = ctx;
	// Fail closed (§8.12): with no resolved model/provider the Reasoning Review's independence cannot be
	// established, and an Assessment that cannot establish independence must not be recorded as if it had.
	if (!producer) {
		send({
			kind: 'status',
			text: '⚖ Assurance floor not run — the producing model/provider never resolved, so reviewer independence cannot be established.'
		});
		return;
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
		let floor = await runPwaFloor(pwaId, {
			prompt: instruction,
			producer,
			rationale: agent.rationale(),
			narration: planText()
		});
		if (!floor) return;
		noteFloor(floor);
		if (!floor.satisfied && mode !== 'mock') {
			transcript.push({
				role: 'SYSTEM',
				kind: 'message',
				text: '↻ Auto-refinement pass (addressing reviewer findings)'
			});
			send({ kind: 'status', text: '↻ Auto-refinement pass (addressing reviewer findings)…' });
			await agent.run(refineDirective(instruction, floor.reasoningGaps), onEvent, signal);
			floor = await runPwaFloor(pwaId, {
				prompt: instruction,
				producer,
				// Re-read after the refinement pass: the producer may have declared a revised account.
				rationale: agent.rationale(),
				narration: planText(),
				priorGaps: floor.reasoningGaps
			});
			if (floor) noteFloor(floor);
		}
		if (floor && !floor.satisfied) {
			send({
				kind: 'status',
				text: '⚠ PublishPwa is blocked until you revise the graph or record a waiver.'
			});
		}
	} catch (error_) {
		send({
			kind: 'status',
			text: `⚖ Assurance floor skipped: ${error_ instanceof Error ? error_.message : String(error_)}`
		});
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
			const send = (event: AuthoringAgentEvent) => {
				if (closed) return;
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
			};
			// Build the durable transcript for this turn as the run streams. It opens with the user's instruction,
			// then accumulates the agent's messages / tool calls / results — persisted to the engine on completion.
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
				const agent = await createAuthoringAgent(broker, mode);
				// The run declares its ACTUAL resolved model/provider; the floor binds independence to that, never
				// to a role label (§8.12).
				let producer: FloorProducer | undefined;
				const onEvent = (ev: AuthoringAgentEvent) => {
					if (ev.kind === 'producer') producer = ev.producer;
					send(ev);
					record(ev);
				};
				await agent.run(instruction, onEvent, request.signal);

				// After the turn: run + record the de minimis assurance floor, and (non-mock) auto-refine once.
				await runFloorAfterTurn({
					pwaId: params.id,
					instruction,
					transcript,
					agent,
					mode,
					producer,
					onEvent,
					send,
					signal: request.signal
				});
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				send({ kind: 'error', message });
				send({ kind: 'done' });
				record({ kind: 'error', message });
			} finally {
				// Persist the turn as event-sourced domain state (survives reloads; the client disconnecting mid-run
				// still records what was said). Only DRAFT PWAs are authored, so only they carry a transcript.
				if (pwa.publicationStatus === 'DRAFT') {
					try {
						recordConversation(params.id, transcript);
					} catch {
						// persistence best-effort — never break the stream teardown
					}
				}
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
