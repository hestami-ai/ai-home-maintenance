// SSE relay for the PWA Designer's authoring agent. POST { instruction } starts a run scoped to this DRAFT PWA and
// streams normalized AuthoringAgentEvents (status / text / thinking / tool_start / tool_end / error / done) as
// Server-Sent Events. The browser reads the stream and re-renders the node graph as tool calls land. The engine is
// the source of truth: the agent only proposes through the broker's tools, so a client disconnect (which aborts the
// run) can never leave the DRAFT in a bad state — each accepted command already committed atomically.
import { error, json } from '@sveltejs/kit';
import { agentMode, makeAuthoringBroker } from '$lib/server/workbench';
import { createAuthoringAgent, type AuthoringAgentEvent } from '$lib/server/agent';
import type { RequestHandler } from './$types';

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
			try {
				if (pwa.publicationStatus !== 'DRAFT') {
					send({
						kind: 'error',
						message: `This PWA is ${pwa.publicationStatus}, not DRAFT — authoring is closed (a published version is immutable).`
					});
					send({ kind: 'done' });
					return;
				}
				const agent = await createAuthoringAgent(broker, agentMode());
				await agent.run(instruction, send, request.signal);
			} catch (e) {
				send({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
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
