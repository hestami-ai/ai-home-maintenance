// The authoring-agent factory — the seam the SSE route calls. It builds the tool descriptors from the broker and
// returns either the deterministic MockAuthoringAgent or the live Pi-backed agent. Pi is DYNAMIC-imported so the
// mock path (and the whole gate) never loads it. Selection: the caller passes an explicit mode; the SSE route uses
// 'mock' under E2E (RPH_DEMO_MODE=test) and 'pi' only when JPWB_AGENT=pi is set (Pi credentials configured).
import type { PwaAuthoringBroker } from '@janumipwb/rph-authoring';
import { buildAuthoringTools } from './tools.js';
import { buildSystemPrompt } from './system-prompt.js';
import { MockAuthoringAgent } from './mock-agent.js';
import { createRationaleSink } from './rationale.js';
import type { AuthoringAgent } from './types.js';

export type AgentMode = 'mock' | 'pi';

export async function createAuthoringAgent(
	broker: PwaAuthoringBroker,
	mode: AgentMode
): Promise<AuthoringAgent> {
	// One sink per agent: the declare_rationale tool writes the §9.7 deliverable into it, and the agent RETURNS
	// it from rationale(). Per-agent rather than per-module so concurrent runs cannot cross-contaminate.
	const rationale = createRationaleSink();
	const tools = buildAuthoringTools(broker, rationale);
	if (mode === 'mock') return new MockAuthoringAgent(tools, rationale);

	// Live path: load Pi lazily so its heavy Node deps never touch the mock/gate runtime.
	const pwa = broker.getPwa();
	const systemPrompt = buildSystemPrompt({
		id: pwa?.id ?? '(unknown)',
		name: pwa?.name ?? '(unknown)',
		domain: pwa?.domain ?? '',
		publicationStatus: pwa?.publicationStatus ?? 'DRAFT'
	});
	const { PiAuthoringAgent } = await import('./pi-agent.js');
	return new PiAuthoringAgent(tools, systemPrompt, rationale);
}

export type { AuthoringAgent, AuthoringAgentEvent, EmitFn } from './types.js';
