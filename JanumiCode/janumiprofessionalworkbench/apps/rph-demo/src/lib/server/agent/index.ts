// The authoring-agent factory — the seam the SSE route calls. It builds the tool descriptors from the broker and
// returns either the deterministic MockAuthoringAgent or the live Pi-backed agent. Pi is DYNAMIC-imported so the
// mock path (and the whole gate) never loads it. Selection: the caller passes an explicit mode; the SSE route uses
// 'mock' under E2E (RPH_DEMO_MODE=test) and 'pi' only when JPWB_AGENT=pi is set (Pi credentials configured).
import type { PwaAuthoringBroker } from '@janumipwb/rph-authoring';
import { buildAuthoringTools } from './tools.js';
import { buildSystemPrompt } from './system-prompt.js';
import { MockAuthoringAgent } from './mock-agent.js';
import type { AuthoringAgent } from './types.js';

export type AgentMode = 'mock' | 'pi';

export async function createAuthoringAgent(
	broker: PwaAuthoringBroker,
	mode: AgentMode
): Promise<AuthoringAgent> {
	const tools = buildAuthoringTools(broker);
	if (mode === 'mock') return new MockAuthoringAgent(tools);

	// Live path: load Pi lazily so its heavy Node deps never touch the mock/gate runtime.
	const pwa = broker.getPwa();
	const systemPrompt = buildSystemPrompt({
		id: pwa?.id ?? '(unknown)',
		name: pwa?.name ?? '(unknown)',
		domain: pwa?.domain ?? '',
		publicationStatus: pwa?.publicationStatus ?? 'DRAFT'
	});
	const { PiAuthoringAgent } = await import('./pi-agent.js');
	return new PiAuthoringAgent(tools, systemPrompt);
}

export type { AuthoringAgent, AuthoringAgentEvent, EmitFn } from './types.js';
