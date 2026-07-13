// A deterministic, network-free authoring agent. It drives the SAME tool descriptors the Pi agent uses, so the
// whole loop (instruction -> tool calls -> engine mutations -> streamed events -> graph re-render) is verifiable in
// the gate without any model. It is also the graceful fallback when Pi is not configured, so a human can still see
// the agent build a graph.
//
// Two instruction protocols:
//  • A JSON plan  {"plan":[{"tool":"define_from_template","args":{...}}, ...]}  is executed verbatim — the E2E uses
//    this for precise, reproducible assertions (and it lets the UI script exact demos).
//  • Otherwise the instruction is treated as free text and a small canned script builds a minimal Product
//    Realization graph from the catalog (root + architecture + a permits edge), so free-text prompts still do
//    something sensible against the mock.
import type { AuthoringToolDescriptor, AuthoringAgent, EmitFn, ToolRunResult } from './types.js';

interface PlanStep {
	readonly tool: string;
	readonly args?: Record<string, unknown>;
	readonly say?: string;
}

function parsePlan(instruction: string): PlanStep[] | null {
	const trimmed = instruction.trim();
	if (!trimmed.startsWith('{')) return null;
	try {
		const parsed = JSON.parse(trimmed) as { plan?: PlanStep[] };
		return Array.isArray(parsed.plan) ? parsed.plan : null;
	} catch {
		return null;
	}
}

export class MockAuthoringAgent implements AuthoringAgent {
	private readonly byName: Map<string, AuthoringToolDescriptor>;

	constructor(private readonly tools: AuthoringToolDescriptor[]) {
		this.byName = new Map(tools.map((t) => [t.name, t]));
	}

	async run(instruction: string, emit: EmitFn, signal?: AbortSignal): Promise<void> {
		const steps = parsePlan(instruction) ?? this.cannedScript();
		emit({ kind: 'status', text: 'mock agent' });
		emit({
			kind: 'text',
			text: `Working on: “${instruction.slice(0, 120)}”. I’ll orient, then build the graph.`
		});
		try {
			for (const step of steps) {
				if (signal?.aborted) {
					emit({ kind: 'error', message: 'aborted' });
					return;
				}
				const tool = this.byName.get(step.tool);
				if (!tool) {
					emit({ kind: 'tool_end', tool: step.tool, ok: false, summary: 'unknown tool' });
					continue;
				}
				if (step.say) emit({ kind: 'text', text: step.say });
				const args = step.args ?? {};
				emit({ kind: 'tool_start', tool: step.tool, args });
				let result: ToolRunResult;
				try {
					result = tool.run(args);
				} catch (e) {
					result = { ok: false, summary: e instanceof Error ? e.message : String(e) };
				}
				emit({ kind: 'tool_end', tool: step.tool, ok: result.ok, summary: result.summary });
			}
			emit({ kind: 'text', text: 'Done — review the graph on the canvas.' });
			emit({ kind: 'done' });
		} catch (e) {
			emit({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
		}
	}

	/** A minimal, safe default demo: a root + one child + a link, all from the catalog. */
	private cannedScript(): PlanStep[] {
		return [
			{ tool: 'get_pwa', say: 'Reading the DRAFT PWA.' },
			{ tool: 'get_catalog', say: 'Checking the PWU catalog.' },
			{
				tool: 'define_from_template',
				args: { templateKey: 'product-realization', isRoot: true },
				say: 'Adding the Product Realization root.'
			},
			{
				tool: 'define_from_template',
				args: { templateKey: 'architecture' },
				say: 'Adding Architecture Definition.'
			},
			{ tool: 'list_pwu_types', say: 'Confirming the two nodes exist so I can link them.' }
		];
	}
}
