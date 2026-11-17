// ⭐ TS5 (Pi 1.5.2; JAN-TOOLCUR roadmap §4 TS5) — WHAT PI HANDS THE EXECUTOR'S TWO TOOLS FOR A MALFORMED CALL, PINNED.
//
// ⭑ WHY. Pi validates a tool call's arguments against the tool's schema before the tool runs, and coerces what it can:
// since Pi 1.5.0 by `@earendil-works/pi-schema` (*"every schema gets the same coercion, the superset of TypeBox's
// `Value.Convert` rules (which only applied to TypeBox-built schemas) and pi-ai's own"*), on 0.80.6 by TypeBox. The
// executor's tools are TypeBox-built (`agent/pi-typebox.ts`), so they were coerced on 0.80.6 too. Measured 2026-11-17,
// these thirteen calls through `validateToolArguments` with the tools as `toPiExecutionTools` defines them: on Pi 0.80.6
// and on 1.5.2 each is accepted or refused alike, and each accepted call is handed the same arguments — `contents: null`
// as the text "null", an `argv` string as a one-element array. What changed is the refusal the model reads: on 0.80.6
// *"- contents: must have required properties contents"* and *"- path: must be string"*, on 1.5.2 *"- contents:
// missing"* and *"- path: expected string, got array"*. So a Pi upgrade that changes what these tools receive, or what a
// model is told, reddens here, and someone decides about it.
// ⛔ PREDICTED RED, observed 2026-11-17: this file run on TS4's tree, Pi 0.80.6, fails on the refusals alone — each of the
// two tests at its first refusal, after every accepted call's arguments had matched: *"contents missing: expected {
// Object (refused) } to deeply equal { refused: '- contents: missing' }"* and *"argv missing: expected { Object (refused)
// } to deeply equal { refused: '- argv: missing' }"*; the control passed.
// ⭑ NO MODEL, NO TOOL RUN: the tools are minted with ports that are never called, since only their definitions are read.
import { validateToolArguments } from '@earendil-works/pi-ai';
import { describe, expect, it } from 'vitest';
import { mintExecutionTools, type ExecutionToolPorts } from './execution-tool-surface.js';
import { toPiExecutionTools } from './pi-execution-tools.js';

const tools = Object.fromEntries(
	toPiExecutionTools(
		mintExecutionTools({
			ports: {} as unknown as ExecutionToolPorts,
			grantedCapabilities: ['file-system', 'process-execution'],
			bindingAuthorizationStatus: 'AUTHORIZED'
		})
	).map((t) => [t.name, { name: t.name, description: t.description, parameters: t.parameters }])
);

/** What Pi hands the tool: the arguments, or the refusal's first line of findings. */
function handed(name: string, args: Record<string, unknown>): unknown {
	try {
		return validateToolArguments(tools[name] as never, {
			type: 'toolCall',
			id: 'call-1',
			name,
			arguments: args
		} as never) as unknown;
	} catch (error) {
		const lines = String((error as Error).message).split('\n');
		return { refused: lines.find((line) => line.trim().startsWith('- '))?.trim() };
	}
}

describe('⭐ TS5 — what Pi hands the executor’s two tools for a malformed call', () => {
	it('⭑ CONTROL — the two tools are the minted ones, and a well-formed call is handed as it was made', () => {
		expect(Object.keys(tools)).toEqual(['write_file', 'run_command']);
		expect(handed('write_file', { path: 'a.txt', contents: 'x' })).toEqual({ path: 'a.txt', contents: 'x' });
		expect(handed('run_command', { argv: ['node', '--version'] })).toEqual({ argv: ['node', '--version'] });
	});

	it('⛔ write_file: what Pi coerces, what it passes through, and what it refuses', () => {
		expect(handed('write_file', { path: 'a.txt', contents: null }), 'contents null').toEqual({
			path: 'a.txt',
			contents: 'null'
		});
		expect(handed('write_file', { path: 'a.txt', contents: 123 }), 'contents a number').toEqual({
			path: 'a.txt',
			contents: '123'
		});
		expect(handed('write_file', { path: 'a.txt', contents: true }), 'contents a boolean').toEqual({
			path: 'a.txt',
			contents: 'true'
		});
		expect(handed('write_file', { path: 123, contents: 'x' }), 'path a number').toEqual({
			path: '123',
			contents: 'x'
		});
		expect(handed('write_file', { path: 'a.txt', contents: 'x', extra: 1 }), 'an extra property').toEqual({
			path: 'a.txt',
			contents: 'x',
			extra: 1
		});
		expect(handed('write_file', { path: 'a.txt' }), 'contents missing').toEqual({
			refused: '- contents: missing'
		});
		expect(handed('write_file', { path: ['a.txt'], contents: 'x' }), 'path an array').toEqual({
			refused: '- path: expected string, got array'
		});
	});

	it('⛔ run_command: what Pi coerces and what it refuses', () => {
		expect(handed('run_command', { argv: 'node --version' }), 'argv a string').toEqual({
			argv: ['node --version']
		});
		expect(handed('run_command', { argv: ['node', 1] }), 'argv holding a number').toEqual({
			argv: ['node', '1']
		});
		expect(handed('run_command', { argv: null }), 'argv null').toEqual({ argv: ['null'] });
		expect(handed('run_command', {}), 'argv missing').toEqual({ refused: '- argv: missing' });
	});
});
