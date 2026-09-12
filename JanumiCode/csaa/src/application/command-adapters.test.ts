import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runCallGraphCommand } from './run-call-graph-command.js';
import { runModuleDependencyCommand } from './run-module-dependency-command.js';
import { runReadWriteAccessCommand } from './run-read-write-access-command.js';
import { runStateMachineGraphCommand } from './run-state-machine-graph-command.js';

interface CommandOptions {
	readonly repositoryRoot: string;
	readonly writeProgress: (line: string) => unknown;
	readonly writeTerminal: (line: string) => unknown;
}

type CommandAdapter = (request: unknown, options: CommandOptions) => 2 | 3 | 4;

const COMMANDS: readonly (readonly [string, CommandAdapter])[] = [
	['call graph', runCallGraphCommand],
	['module dependency', runModuleDependencyCommand],
	['read/write access', runReadWriteAccessCommand],
	['state-machine graph', runStateMachineGraphCommand]
];

describe('portable report command adapters', () => {
	for (const [name, run] of COMMANDS) {
		it(`serializes the ${name} refusal and preserves progress framing`, () => {
			const progress: string[] = [];
			const terminal: string[] = [];
			const exitCode = run(
				{},
				{
					repositoryRoot: resolve('.'),
					writeProgress: (line) => progress.push(line),
					writeTerminal: (line) => terminal.push(line)
				}
			);

			expect(exitCode).toBe(2);
			expect(terminal).toHaveLength(1);
			expect(terminal[0]?.endsWith('\n')).toBe(true);
			expect(JSON.parse(terminal[0] ?? 'null')).toMatchObject({
				outcome: 'unavailable',
				state: 'incompatible'
			});
			expect(progress.length).toBeGreaterThanOrEqual(2);
			for (const line of progress) {
				expect(line.endsWith('\n')).toBe(true);
				expect(JSON.parse(line)).toMatchObject({ kind: 'REPORT_STAGE' });
			}
		});
	}
});
