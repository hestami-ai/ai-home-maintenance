import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import {
	SEMANTIC_SOURCE_QUERY_PROGRESS_MAX_BYTES,
	SEMANTIC_SOURCE_QUERY_PROGRESS_MAX_EVENTS,
	SEMANTIC_SOURCE_QUERY_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	createSemanticSourceQueryProgressJsonlWriter
} from './semantic-source-query-progress-jsonl.js';
import {
	SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_NONCLAIMS,
	type SemanticSourceQueryReportProgressEvent
} from './run-semantic-source-query-report.js';

function event(detailCode: string, sequence = 1): SemanticSourceQueryReportProgressEvent {
	return {
		deliverySemantics: 'DEFERRED_UNTIL_TERMINAL_EVIDENCE',
		detailCode,
		kind: 'REPORT_STAGE',
		nonclaims: SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_NONCLAIMS,
		observations: [],
		operationVersion: 'jan-csaa-report-semantic-source-query/0.1.0',
		phase: 'REQUEST_BIND',
		protocolRole: 'PRELIMINARY_SEMANTIC_SOURCE_QUERY_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: 'jan-csaa-semantic-source-query-report-progress/0.1.0',
		sequence,
		stage: 'REQUEST',
		state: 'STARTED'
	} as SemanticSourceQueryReportProgressEvent;
}

describe('semantic-source-query progress JSONL transport', () => {
	it('emits canonical JSONL and reserves one bounded event-limit marker', () => {
		const lines: string[] = [];
		const writer = createSemanticSourceQueryProgressJsonlWriter({
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
			nonclaims: SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_NONCLAIMS,
			protocolRole: 'PRELIMINARY_SEMANTIC_SOURCE_QUERY_REPORT_TELEMETRY_TRANSPORT',
			reason: 'EVENT_LIMIT',
			schemaVersion: SEMANTIC_SOURCE_QUERY_PROGRESS_TRANSPORT_SCHEMA_VERSION,
			state: 'TRUNCATED'
		});
		expect(writer.stats()).toMatchObject({ emittedEvents: 3, truncated: true });
		expect(Buffer.byteLength(lines.join(''), 'utf8')).toBeLessThanOrEqual(65_536);
	});

	it('uses bounded markers for byte exhaustion and serialization failure', () => {
		const byteLines: string[] = [];
		const byteWriter = createSemanticSourceQueryProgressJsonlWriter({
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
		const serializationWriter = createSemanticSourceQueryProgressJsonlWriter({
			write: (line) => serializationLines.push(line)
		});
		serializationWriter.emit(cyclic as unknown as SemanticSourceQueryReportProgressEvent);
		expect(JSON.parse(serializationLines[0]!)).toMatchObject({
			reason: 'SERIALIZATION_FAILED',
			state: 'TRUNCATED'
		});
	});

	it('contains EPIPE, rejecting, hostile-thenable, and backpressured sinks', async () => {
		const epipe = createSemanticSourceQueryProgressJsonlWriter({
			write: () => {
				throw Object.assign(new Error('closed pipe'), { code: 'EPIPE' });
			}
		});
		expect(() => epipe.emit(event('EPIPE'))).not.toThrow();
		expect(epipe.stats()).toEqual({ emittedBytes: 0, emittedEvents: 0, truncated: true });

		const backpressureLines: string[] = [];
		const backpressured = createSemanticSourceQueryProgressJsonlWriter({
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

		const rejecting = createSemanticSourceQueryProgressJsonlWriter({
			write: () => Promise.reject(new Error('asynchronous transport failure'))
		});
		expect(() => rejecting.emit(event('REJECTED'))).not.toThrow();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(rejecting.stats()).toMatchObject({ emittedEvents: 1, truncated: true });

		const hostileThenable = createSemanticSourceQueryProgressJsonlWriter({
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
			createSemanticSourceQueryProgressJsonlWriter({
				maxBytes: SEMANTIC_SOURCE_QUERY_PROGRESS_MAX_BYTES + 1,
				write: () => true
			})
		).toThrow('equal-or-stricter safe integer');
		expect(() =>
			createSemanticSourceQueryProgressJsonlWriter({
				maxEvents: SEMANTIC_SOURCE_QUERY_PROGRESS_MAX_EVENTS + 1,
				write: () => true
			})
		).toThrow('equal-or-stricter safe integer');
	});
});
