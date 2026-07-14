// SSE relay for the PWA Designer's authoring agent. POST { instruction } starts a run scoped to this DRAFT PWA and
// streams normalized AuthoringAgentEvents (status / text / thinking / tool_start / tool_end / error / done) as
// Server-Sent Events. The browser reads the stream and re-renders the node graph as tool calls land. The engine is
// the source of truth: the agent only proposes through the broker's tools, so a client disconnect (which aborts the
// run) can never leave the DRAFT in a bad state — each accepted command already committed atomically.
import { error, json } from '@sveltejs/kit';
import { agentMode, makeAuthoringBroker, recordConversation } from '$lib/server/workbench';
import { createAuthoringAgent, type AuthoringAgentEvent } from '$lib/server/agent';
import { runAssessmentLoop, type AssessmentStreamEvent } from '$lib/server/assess/loop';
import type { RequestHandler } from './$types';

// A mutable transcript entry (text is accumulated as deltas stream); assignable to the readonly ConversationEntry.
type TurnEntry = { role: string; kind: string; text: string; success?: boolean };

/** Compact a tool's args for the transcript (mirrors the client log). */
function compactArgs(args: Record<string, unknown> | undefined): string {
	if (!args) return '';
	return Object.entries(args)
		.map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
		.join(', ');
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
			const send = (event: AuthoringAgentEvent | AssessmentStreamEvent) => {
				if (closed) return;
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
			};
			// Build the durable transcript for this turn as the run streams. It opens with the user's instruction,
			// then accumulates the agent's messages / tool calls / results — persisted to the engine on completion.
			const transcript: TurnEntry[] = [{ role: 'USER', kind: 'message', text: instruction }];
			const record = (ev: AuthoringAgentEvent) => {
				if (ev.kind === 'text' || ev.kind === 'thinking') {
					const kind = ev.kind === 'text' ? 'message' : 'thinking';
					const last = transcript[transcript.length - 1];
					if (last && last.role === 'AGENT' && last.kind === kind) last.text += ev.text;
					else transcript.push({ role: 'AGENT', kind, text: ev.text });
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
				const onEvent = (ev: AuthoringAgentEvent) => {
					send(ev);
					record(ev);
				};
				await agent.run(instruction, onEvent, request.signal);

				// After the turn: the bounded assess -> auto-refine -> escalate loop (Layer B, in-product).
				// A judge distinct from the executor scores faithfulness; one automatic refinement re-runs the
				// executor against the gaps; a still-unfaithful result escalates to the human-in-the-loop.
				await runAssessmentLoop({
					pwaId: params.id,
					prompt: instruction,
					planText: () =>
						transcript
							.filter((e) => e.role === 'AGENT' && (e.kind === 'message' || e.kind === 'thinking'))
							.map((e) => e.text)
							.join('\n'),
					runExecutor: async (directive) => {
						transcript.push({
							role: 'SYSTEM',
							kind: 'message',
							text: '↻ Auto-refinement pass (addressing reviewer gaps)'
						});
						await agent.run(directive, onEvent, request.signal);
					},
					autoRefine: mode !== 'mock',
					emit: send,
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
