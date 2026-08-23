import { describe, expect, it } from 'vitest';

import {
	COMMAND_HANDLER_GRAPH_REPORT_PROGRESS_NONCLAIMS,
	type CommandHandlerGraphReportProgressEvent
} from './run-command-handler-graph-report.js';
import { createCommandHandlerGraphProgressJsonlWriter } from './command-handler-graph-progress-jsonl.js';

function event(sequence = 1): CommandHandlerGraphReportProgressEvent {
	return {
		adapterProgress: null,
		deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
		detailCode: null,
		elapsedMs: 0,
		kind: 'REPORT_STAGE',
		nonclaims: COMMAND_HANDLER_GRAPH_REPORT_PROGRESS_NONCLAIMS,
		observations: [],
		operationVersion: 'jan-csaa-report-command-handler-graph/0.1.0',
		phase: 'REQUEST_BIND',
		protocolRole: 'PRELIMINARY_TYPESCRIPT_COMMAND_HANDLER_GRAPH_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: 'jan-csaa-command-handler-graph-report-progress/0.1.0',
		sequence,
		stage: 'REQUEST',
		state: 'STARTED',
		wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET'
	};
}

describe('command-handler graph progress JSONL transport', () => {
	it('emits canonical newline-delimited events and reports statistics', () => {
		const lines: string[] = [];
		const writer = createCommandHandlerGraphProgressJsonlWriter({
			write: (line) => lines.push(line)
		});
		writer.emit(event());
		expect(lines).toHaveLength(1);
		expect(lines[0]!.endsWith('\n')).toBe(true);
		expect(JSON.parse(lines[0]!)).toMatchObject({ sequence: 1, state: 'STARTED' });
		expect(writer.stats()).toMatchObject({ emittedEvents: 1, truncated: false });
	});

	it('emits one bounded marker on event exhaustion', () => {
		const lines: string[] = [];
		const writer = createCommandHandlerGraphProgressJsonlWriter({
			maxEvents: 2,
			write: (line) => lines.push(line)
		});
		writer.emit(event());
		writer.emit(event(2));
		expect(lines).toHaveLength(2);
		expect(JSON.parse(lines.at(-1)!)).toMatchObject({
			kind: 'PROGRESS_TRANSPORT',
			reason: 'EVENT_LIMIT',
			state: 'TRUNCATED'
		});
		expect(writer.stats()).toMatchObject({ emittedEvents: 2, truncated: true });
	});

	it('contains backpressure, sink exceptions, rejected thenables, and serialization failure', async () => {
		const backpressure: string[] = [];
		const backpressured = createCommandHandlerGraphProgressJsonlWriter({
			write(line) {
				backpressure.push(line);
				return backpressure.length !== 1;
			}
		});
		backpressured.emit(event());
		expect(backpressured.stats().truncated).toBe(true);
		expect(backpressure.map((line) => JSON.parse(line).state)).toEqual(['STARTED', 'TRUNCATED']);

		const throwing = createCommandHandlerGraphProgressJsonlWriter({
			write: () => {
				throw new Error('closed sink');
			}
		});
		expect(() => throwing.emit(event())).not.toThrow();
		expect(throwing.stats().truncated).toBe(true);

		const rejecting = createCommandHandlerGraphProgressJsonlWriter({
			write: () => Promise.reject(new Error('rejected sink'))
		});
		rejecting.emit(event());
		await Promise.resolve();
		expect(rejecting.stats().truncated).toBe(true);

		const cyclic = event() as unknown as { cyclic?: unknown };
		cyclic.cyclic = cyclic;
		const serialized: string[] = [];
		const serializing = createCommandHandlerGraphProgressJsonlWriter({
			write: (line) => serialized.push(line)
		});
		serializing.emit(cyclic as unknown as CommandHandlerGraphReportProgressEvent);
		expect(JSON.parse(serialized[0]!)).toMatchObject({
			reason: 'SERIALIZATION_FAILED',
			state: 'TRUNCATED'
		});
	});
});
