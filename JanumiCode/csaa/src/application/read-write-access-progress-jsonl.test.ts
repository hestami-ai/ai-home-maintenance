import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import {
	createReadWriteAccessProgressJsonlWriter,
	READ_WRITE_ACCESS_PROGRESS_TRANSPORT_SCHEMA_VERSION
} from './read-write-access-progress-jsonl.js';
import {
	READ_WRITE_ACCESS_REPORT_PROGRESS_NONCLAIMS,
	type ReadWriteAccessReportProgressEvent
} from './run-read-write-access-report.js';

function event(detailCode: string): ReadWriteAccessReportProgressEvent {
	return {
		deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
		detailCode,
		elapsedMs: 0,
		kind: 'REPORT_STAGE',
		nonclaims: READ_WRITE_ACCESS_REPORT_PROGRESS_NONCLAIMS,
		observations: [],
		operationVersion: 'jan-csaa-report-read-write-access/0.1.0',
		phase: 'REQUEST_BIND',
		protocolRole: 'PRELIMINARY_TYPESCRIPT_READ_WRITE_ACCESS_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: 'jan-csaa-read-write-access-report-progress/0.1.0',
		sequence: 1,
		stage: 'REQUEST',
		state: 'STARTED',
		wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET'
	};
}

describe('read/write-access progress JSONL transport', () => {
	it('reserves one bounded marker when the event limit is reached', () => {
		const lines: string[] = [];
		const writer = createReadWriteAccessProgressJsonlWriter({
			maxBytes: 65_536,
			maxEvents: 3,
			write: (line) => lines.push(line)
		});
		writer.emit(event('FIRST'));
		writer.emit(event('SECOND'));
		writer.emit(event('THIRD'));
		writer.emit(event('IGNORED'));

		expect(lines).toHaveLength(3);
		expect(JSON.parse(lines.at(-1)!)).toEqual({
			emittedBytes: Buffer.byteLength(lines[0]! + lines[1]!, 'utf8'),
			emittedEvents: 2,
			kind: 'PROGRESS_TRANSPORT',
			maxBytes: 65_536,
			maxEvents: 3,
			nonclaims: READ_WRITE_ACCESS_REPORT_PROGRESS_NONCLAIMS,
			protocolRole: 'PRELIMINARY_TYPESCRIPT_READ_WRITE_ACCESS_REPORT_TELEMETRY_TRANSPORT',
			reason: 'EVENT_LIMIT',
			schemaVersion: READ_WRITE_ACCESS_PROGRESS_TRANSPORT_SCHEMA_VERSION,
			state: 'TRUNCATED'
		});
		expect(writer.stats()).toMatchObject({ emittedEvents: 3, truncated: true });
		expect(Buffer.byteLength(lines.join(''), 'utf8')).toBeLessThanOrEqual(65_536);
	});

	it('uses a bounded marker for byte exhaustion and unserializable events', () => {
		const byteLines: string[] = [];
		const byteWriter = createReadWriteAccessProgressJsonlWriter({
			maxBytes: 32_768,
			maxEvents: 10,
			write: (line) => byteLines.push(line)
		});
		byteWriter.emit(event('x'.repeat(20_000)));
		expect(JSON.parse(byteLines[0]!)).toMatchObject({ reason: 'BYTE_LIMIT', state: 'TRUNCATED' });

		const serializationLines: string[] = [];
		const serializationWriter = createReadWriteAccessProgressJsonlWriter({
			write: (line) => serializationLines.push(line)
		});
		serializationWriter.emit({
			...event('HOSTILE'),
			observations: new Proxy([], {})
		} as ReadWriteAccessReportProgressEvent);
		expect(JSON.parse(serializationLines[0]!)).toMatchObject({
			reason: 'SERIALIZATION_FAILED',
			state: 'TRUNCATED'
		});
	});

	it('isolates throwing, rejecting, and backpressured sinks', async () => {
		const throwing = createReadWriteAccessProgressJsonlWriter({
			write: () => {
				throw new Error('transport failure');
			}
		});
		expect(() => throwing.emit(event('FAIL'))).not.toThrow();
		expect(throwing.stats()).toEqual({ emittedBytes: 0, emittedEvents: 0, truncated: true });

		const backpressureLines: string[] = [];
		const backpressured = createReadWriteAccessProgressJsonlWriter({
			write: (line) => {
				backpressureLines.push(line);
				return false;
			}
		});
		backpressured.emit(event('BACKPRESSURE'));
		backpressured.emit(event('IGNORED'));
		expect(backpressureLines).toHaveLength(2);
		expect(JSON.parse(backpressureLines[1]!)).toMatchObject({
			reason: 'BACKPRESSURE',
			state: 'TRUNCATED'
		});

		const rejecting = createReadWriteAccessProgressJsonlWriter({
			write: () => Promise.reject(new Error('asynchronous transport failure'))
		});
		expect(() => rejecting.emit(event('REJECTED'))).not.toThrow();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(rejecting.stats()).toMatchObject({ emittedEvents: 1, truncated: true });
	});
});
