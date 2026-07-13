// The LIVE authoring agent, backed by the Pi coding-agent SDK (in-process AgentSession — cloud models, no GPU).
// This module is the ONLY place Pi is imported; the factory dynamic-imports it, so the mock path (and the whole
// gate) never loads Pi's heavy Node deps. It maps our Pi-agnostic tool descriptors onto Pi `defineTool`s and Pi's
// event stream onto our normalized AuthoringAgentEvent stream. The agent runs with the built-in coding tools
// DISABLED (noTools: "builtin") — it can ONLY touch the workbench through our authoring tools.
import {
	AuthStorage,
	createAgentSession,
	DefaultResourceLoader,
	defineTool,
	getAgentDir,
	ModelRegistry,
	SessionManager,
	SettingsManager
} from '@earendil-works/pi-coding-agent';
import { Type, type TSchema } from 'typebox';
import type { AuthoringAgent, AuthoringToolDescriptor, EmitFn, ParamSpec } from './types.js';

/** Map our flat param spec onto a TypeBox object schema (optional wrapper for non-required params). */
function toTypeBox(spec: ParamSpec): TSchema {
	const props: Record<string, TSchema> = {};
	for (const [key, def] of Object.entries(spec)) {
		let t: TSchema;
		if (def.type === 'boolean') t = Type.Boolean({ description: def.description });
		else if (def.type === 'string[]')
			t = Type.Array(Type.String(), { description: def.description });
		else t = Type.String({ description: def.description });
		props[key] = def.required ? t : Type.Optional(t);
	}
	return Type.Object(props);
}

/** Wrap our descriptors as Pi custom tools. Each returns the tool's human summary as the model-visible content. */
function toPiTools(descriptors: AuthoringToolDescriptor[]) {
	return descriptors.map((d) =>
		defineTool({
			name: d.name,
			label: d.name,
			description: d.description,
			parameters: toTypeBox(d.parameters),
			execute: async (_toolCallId: string, params: Record<string, unknown>) => {
				const result = d.run(params ?? {});
				return {
					content: [{ type: 'text' as const, text: result.summary }],
					details: { ok: result.ok, data: result.data }
				};
			}
		})
	);
}

/**
 * Resolve the model to run with. Prefer models that actually have valid credentials (getAvailable) — modelRegistry
 * .find() returns a catalog entry even with NO key, which would then fail at session time, so we must not trust it
 * blindly. Order: the requested model IF it is authenticated → else the first authenticated model → else the
 * requested catalog entry as a last resort (surfaces Pi's own "no API key" message, which is the right diagnostic).
 */
async function resolveModel(modelRegistry: ModelRegistry) {
	const spec = process.env.JPWB_AGENT_MODEL ?? 'anthropic/claude-opus-4-5';
	const [provider, id] = spec.includes('/') ? spec.split('/') : ['anthropic', spec];
	const available = await modelRegistry.getAvailable();
	const requestedAvailable = available.find((m) => m.provider === provider && m.id === id);
	const model =
		requestedAvailable ?? available[0] ?? modelRegistry.find(provider!, id!) ?? undefined;
	if (!model)
		throw new Error(
			'No Pi model available. Configure Pi credentials (pi login), or set JPWB_AGENT_MODEL to an available provider/id.'
		);
	return model;
}

export class PiAuthoringAgent implements AuthoringAgent {
	constructor(
		private readonly tools: AuthoringToolDescriptor[],
		private readonly systemPrompt: string
	) {}

	async run(instruction: string, emit: EmitFn, signal?: AbortSignal): Promise<void> {
		emit({ kind: 'status', text: 'pi agent' });
		let session: Awaited<ReturnType<typeof createAgentSession>>['session'] | undefined;
		let unsubscribe: (() => void) | undefined;
		try {
			const authStorage = AuthStorage.create();
			const modelRegistry = ModelRegistry.create(authStorage);
			const model = await resolveModel(modelRegistry);

			const loader = new DefaultResourceLoader({
				cwd: process.cwd(),
				agentDir: getAgentDir(),
				systemPromptOverride: () => this.systemPrompt
			});
			await loader.reload();
			const settingsManager = SettingsManager.inMemory({
				compaction: { enabled: false },
				retry: { enabled: true, maxRetries: 2 }
			});

			const created = await createAgentSession({
				model,
				thinkingLevel: 'low',
				noTools: 'builtin',
				customTools: toPiTools(this.tools),
				resourceLoader: loader,
				sessionManager: SessionManager.inMemory(),
				settingsManager,
				authStorage,
				modelRegistry
			});
			session = created.session;

			unsubscribe = session.subscribe((event) => {
				switch (event.type) {
					case 'message_update':
						if (event.assistantMessageEvent.type === 'text_delta')
							emit({ kind: 'text', text: event.assistantMessageEvent.delta });
						else if (event.assistantMessageEvent.type === 'thinking_delta')
							emit({ kind: 'thinking', text: event.assistantMessageEvent.delta });
						break;
					case 'tool_execution_start':
						emit({ kind: 'tool_start', tool: event.toolName, args: event.args ?? {} });
						break;
					case 'tool_execution_end': {
						const text = summarize(event.result);
						emit({ kind: 'tool_end', tool: event.toolName, ok: !event.isError, summary: text });
						break;
					}
					default:
						break;
				}
			});

			if (signal) signal.addEventListener('abort', () => void session?.abort(), { once: true });

			await session.prompt(instruction);
			emit({ kind: 'done' });
		} catch (e) {
			emit({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
		} finally {
			unsubscribe?.();
			session?.dispose();
		}
	}
}

/** Pull a short human summary out of a Pi tool result (its first text content block). */
function summarize(result: unknown): string {
	const content = (result as { content?: Array<{ type?: string; text?: string }> } | undefined)
		?.content;
	const first = content?.find((c) => c.type === 'text');
	return first?.text ?? '';
}
