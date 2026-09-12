import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import {
	LOGICAL_GRAPH_COMPOSITION_PROGRESS_MAX_BYTES,
	LOGICAL_GRAPH_COMPOSITION_PROGRESS_MAX_EVENTS,
	LOGICAL_GRAPH_COMPOSITION_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	createLogicalGraphCompositionProgressJsonlWriter
} from './logical-graph-composition-progress-jsonl.js';
import {
	LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_NONCLAIMS,
	type LogicalGraphCompositionReportProgressEvent
} from './run-logical-graph-composition-report.js';

function event(detailCode: string, sequence = 1): LogicalGraphCompositionReportProgressEvent {
	return {
		deliverySemantics: 'DEFERRED_UNTIL_TERMINAL_EVIDENCE',
		detailCode,
		kind: 'REPORT_STAGE',
		nonclaims: LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_NONCLAIMS,
		observations: [],
		operationVersion: 'jan-csaa-report-logical-graph-composition/0.1.0',
		phase: 'REQUEST_BIND',
		protocolRole: 'PRELIMINARY_TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: 'jan-csaa-logical-graph-composition-report-progress/0.1.0',
		sequence,
		stage: 'REQUEST',
		state: 'STARTED'
	};
}

describe('logical-graph-composition progress JSONL transport', () => {
	it('emits canonical newline-delimited events and reserves one bounded event-limit marker', () => {
		const lines: string[] = [];
		const writer = createLogicalGraphCompositionProgressJsonlWriter({
			maxBytes: 65_536,
			maxEvents: 3,
			write: (line) => lines.push(line)
		});
		writer.emit(event('FIRST'));
		writer.emit(event('SECOND', 2));
		writer.emit(event('THIRD', 3));
		writer.emit(event('IGNORED', 4));

		expect(lines).toHaveLength(3);
		expect(lines.every((line) => line.endsWith('\n'))).toBe(true);
		expect(JSON.parse(lines[0]!)).toMatchObject({ detailCode: 'FIRST', sequence: 1 });
		expect(JSON.parse(lines.at(-1)!)).toEqual({
			emittedBytes: Buffer.byteLength(lines[0]! + lines[1]!, 'utf8'),
			emittedEvents: 2,
			kind: 'PROGRESS_TRANSPORT',
			maxBytes: 65_536,
			maxEvents: 3,
			nonclaims: LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_NONCLAIMS,
			protocolRole: 'PRELIMINARY_TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_REPORT_TELEMETRY_TRANSPORT',
			reason: 'EVENT_LIMIT',
			schemaVersion: LOGICAL_GRAPH_COMPOSITION_PROGRESS_TRANSPORT_SCHEMA_VERSION,
			state: 'TRUNCATED'
		});
		expect(writer.stats()).toMatchObject({ emittedEvents: 3, truncated: true });
		expect(Buffer.byteLength(lines.join(''), 'utf8')).toBeLessThanOrEqual(65_536);
	});

	it('uses bounded markers for byte exhaustion and serialization failure', () => {
		const byteLines: string[] = [];
		const byteWriter = createLogicalGraphCompositionProgressJsonlWriter({
			maxBytes: 32_768,
			maxEvents: 10,
			write: (line) => byteLines.push(line)
		});
		byteWriter.emit(event('x'.repeat(20_000)));
		expect(JSON.parse(byteLines[0]!)).toMatchObject({
			reason: 'BYTE_LIMIT',
			state: 'TRUNCATED'
		});
		expect(Buffer.byteLength(byteLines.join(''), 'utf8')).toBeLessThanOrEqual(32_768);

		const cyclic = event('HOSTILE') as unknown as { cyclic?: unknown };
		cyclic.cyclic = cyclic;
		const serializationLines: string[] = [];
		const serializationWriter = createLogicalGraphCompositionProgressJsonlWriter({
			write: (line) => serializationLines.push(line)
		});
		serializationWriter.emit(cyclic as unknown as LogicalGraphCompositionReportProgressEvent);
		expect(JSON.parse(serializationLines[0]!)).toMatchObject({
			reason: 'SERIALIZATION_FAILED',
			state: 'TRUNCATED'
		});
	});

	it('contains EPIPE, rejecting, hostile-thenable, and backpressured sinks', async () => {
		const epipe = createLogicalGraphCompositionProgressJsonlWriter({
			write: () => {
				throw Object.assign(new Error('closed pipe'), { code: 'EPIPE' });
			}
		});
		expect(() => epipe.emit(event('EPIPE'))).not.toThrow();
		expect(epipe.stats()).toEqual({ emittedBytes: 0, emittedEvents: 0, truncated: true });

		const backpressureLines: string[] = [];
		const backpressured = createLogicalGraphCompositionProgressJsonlWriter({
			write: (line) => {
				backpressureLines.push(line);
				return backpressureLines.length !== 1;
			}
		});
		backpressured.emit(event('BACKPRESSURE'));
		backpressured.emit(event('IGNORED'));
		expect(backpressureLines).toHaveLength(2);
		expect(JSON.parse(backpressureLines[1]!)).toMatchObject({
			reason: 'BACKPRESSURE',
			state: 'TRUNCATED'
		});

		const rejecting = createLogicalGraphCompositionProgressJsonlWriter({
			write: () => Promise.reject(new Error('asynchronous transport failure'))
		});
		expect(() => rejecting.emit(event('REJECTED'))).not.toThrow();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(rejecting.stats()).toMatchObject({ emittedEvents: 1, truncated: true });

		const hostileThenable = createLogicalGraphCompositionProgressJsonlWriter({
			write: () =>
				Object.defineProperty({}, 'then', {
					get() {
						throw new Error('hostile then getter');
					}
				})
		});
		expect(() => hostileThenable.emit(event('HOSTILE_THENABLE'))).not.toThrow();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(hostileThenable.stats()).toMatchObject({ emittedEvents: 1, truncated: true });
	});

	it('rejects transport limits outside the fixed ceilings', () => {
		expect(() =>
			createLogicalGraphCompositionProgressJsonlWriter({
				maxBytes: LOGICAL_GRAPH_COMPOSITION_PROGRESS_MAX_BYTES + 1,
				write: () => true
			})
		).toThrow('equal-or-stricter safe integer');
		expect(() =>
			createLogicalGraphCompositionProgressJsonlWriter({
				maxEvents: LOGICAL_GRAPH_COMPOSITION_PROGRESS_MAX_EVENTS + 1,
				write: () => true
			})
		).toThrow('equal-or-stricter safe integer');
	});
});
