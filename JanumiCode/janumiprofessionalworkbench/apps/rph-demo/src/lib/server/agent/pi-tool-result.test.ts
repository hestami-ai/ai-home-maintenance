import { describe, expect, it } from 'vitest';
import { buildPwuLifecycleTopologyTool } from './tools.js';
import { piToolExecutionSucceeded, toPiToolResult } from './pi-tool-result.js';

describe('toPiToolResult', () => {
	it('places structured topology in model-visible content instead of details only', () => {
		const descriptorResult = buildPwuLifecycleTopologyTool().run({});
		const result = toPiToolResult(descriptorResult);
		const modelText = result.content[0].text;

		expect(modelText).toContain('Structured result:');
		expect(modelText).toContain('"sourceMachine":"PWU.workLifecycleState"');
		expect(modelText).toContain('"states"');
		expect(modelText).toContain('"transitions"');
		expect(modelText).toContain('"requiresAuthoritativeCommand":true');
		expect(result.details.data).toBe(descriptorResult.data);
	});

	it('does not add an empty structured-result section when a descriptor returns no data', () => {
		expect(toPiToolResult({ ok: true, summary: 'done' }).content[0].text).toBe('done');
	});
});

describe('piToolExecutionSucceeded', () => {
	it('reports a domain rejection even when Pi completed the tool transport successfully', () => {
		// Regression lock: the old mapping used only `!event.isError`, which turned this rejected proposal into
		// tool_end.ok=true in the SSE stream, transcript, and UI.
		expect(piToolExecutionSucceeded({ details: { ok: false } }, false)).toBe(false);
	});

	it('reports a domain acceptance when the transport also succeeded', () => {
		expect(piToolExecutionSucceeded({ details: { ok: true } }, false)).toBe(true);
	});

	it('never turns a Pi transport failure into success', () => {
		expect(piToolExecutionSucceeded({ details: { ok: true } }, true)).toBe(false);
	});

	it('preserves transport-success semantics for results without our structured domain details', () => {
		expect(piToolExecutionSucceeded({ content: [{ type: 'text', text: 'done' }] }, false)).toBe(
			true
		);
	});
});
