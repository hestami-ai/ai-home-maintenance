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
	resolveCliModel,
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
		else if (def.type === 'object[]' && def.items)
			t = Type.Array(toTypeBox(def.items), { description: def.description });
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
 * Resolve the model to run with, honoring the SAME configuration the Pi TUI uses. Priority:
 *   1. JPWB_AGENT_MODEL ("provider/id") — an explicit override for this app.
 *   2. The user's configured DEFAULT model+provider from Pi's real settings (what the TUI shows).
 *   3. The first model that actually has valid credentials.
 * (Never hardcode a provider — a plain modelRegistry.find() would return a keyless catalog entry that fails at
 * session time, and assuming "anthropic" is wrong when the user is on, e.g., OpenAI/Codex.)
 */
async function resolveModel(modelRegistry: ModelRegistry, settingsManager: SettingsManager) {
	const override = process.env.JPWB_AGENT_MODEL;
	if (override) {
		const r = resolveCliModel({ cliModel: override, modelRegistry });
		if (r.model) return r.model;
	} else {
		const defaultModelId = settingsManager.getDefaultModel();
		if (defaultModelId) {
			const r = resolveCliModel({
				cliProvider: settingsManager.getDefaultProvider(),
				cliModel: defaultModelId,
				modelRegistry
			});
			if (r.model) return r.model;
		}
	}
	const available = await modelRegistry.getAvailable();
	if (available[0]) return available[0];
	throw new Error(
		'No Pi model available. Configure a model in Pi (run `pi` and log in, or the TUI), or set JPWB_AGENT_MODEL to a provider/id.'
	);
}

export class PiAuthoringAgent implements AuthoringAgent {
	constructor(
		private readonly tools: AuthoringToolDescriptor[],
		private readonly systemPrompt: string
	) {}

	async run(instruction: string, emit: EmitFn, signal?: AbortSignal): Promise<void> {
		let session: Awaited<ReturnType<typeof createAgentSession>>['session'] | undefined;
		let unsubscribe: (() => void) | undefined;
		try {
			const authStorage = AuthStorage.create();
			const modelRegistry = ModelRegistry.create(authStorage);
			// Read the user's REAL Pi settings (same agent dir the TUI uses) so we inherit their default model.
			const settingsManager = SettingsManager.create(process.cwd(), getAgentDir());
			const model = await resolveModel(modelRegistry, settingsManager);
			emit({ kind: 'status', text: `pi agent · ${model.provider}/${model.id}` });

			const loader = new DefaultResourceLoader({
				cwd: process.cwd(),
				agentDir: getAgentDir(),
				settingsManager,
				systemPromptOverride: () => this.systemPrompt
			});
			await loader.reload();

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
