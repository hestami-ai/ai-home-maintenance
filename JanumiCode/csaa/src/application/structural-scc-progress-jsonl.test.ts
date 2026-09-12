import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
	STRUCTURAL_SCC_REPORT_PROGRESS_NONCLAIMS,
	type StructuralSccReportProgressEvent
} from './run-structural-scc-report.js';
import {
	createStructuralSccProgressJsonlWriter,
	STRUCTURAL_SCC_PROGRESS_TRANSPORT_SCHEMA_VERSION
} from './structural-scc-progress-jsonl.js';

function event(detailCode: string): StructuralSccReportProgressEvent {
	return {
		deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
		detailCode,
		elapsedMs: 0,
		kind: 'REPORT_STAGE',
		nonclaims: STRUCTURAL_SCC_REPORT_PROGRESS_NONCLAIMS,
		observations: [],
		operationVersion: 'jan-csaa-report-structural-scc/0.1.0',
		phase: 'REQUEST_BIND',
		protocolRole: 'PRELIMINARY_CAP_027_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: 'jan-csaa-structural-scc-report-progress/0.1.0',
		sequence: 1,
		stage: 'REQUEST',
		state: 'STARTED',
		wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET'
	};
}

describe('structural SCC progress JSONL transport', () => {
	it('reserves one bounded marker when the event limit is reached', () => {
		const lines: string[] = [];
		const writer = createStructuralSccProgressJsonlWriter({
			maxBytes: 16_384,
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
			maxBytes: 16_384,
			maxEvents: 3,
			nonclaims: STRUCTURAL_SCC_REPORT_PROGRESS_NONCLAIMS,
			protocolRole: 'PRELIMINARY_CAP_027_REPORT_TELEMETRY_TRANSPORT',
			reason: 'EVENT_LIMIT',
			schemaVersion: STRUCTURAL_SCC_PROGRESS_TRANSPORT_SCHEMA_VERSION,
			state: 'TRUNCATED'
		});
		expect(writer.stats()).toMatchObject({ emittedEvents: 3, truncated: true });
		expect(Buffer.byteLength(lines.join(''), 'utf8')).toBeLessThanOrEqual(16_384);
	});

	it('emits a bounded byte-limit marker instead of an oversized event', () => {
		const lines: string[] = [];
		const writer = createStructuralSccProgressJsonlWriter({
			maxBytes: 4_096,
			maxEvents: 10,
			write: (line) => lines.push(line)
		});
		writer.emit(event('x'.repeat(3_000)));
		expect(lines).toHaveLength(1);
		expect(JSON.parse(lines[0]!)).toMatchObject({
			kind: 'PROGRESS_TRANSPORT',
			reason: 'BYTE_LIMIT',
			state: 'TRUNCATED'
		});
		expect(Buffer.byteLength(lines.join(''), 'utf8')).toBeLessThanOrEqual(4_096);
	});

	it('isolates a throwing output sink', () => {
		const writer = createStructuralSccProgressJsonlWriter({
			write: () => {
				throw new Error('transport failure');
			}
		});
		expect(() => writer.emit(event('FAIL'))).not.toThrow();
		expect(writer.stats()).toEqual({ emittedBytes: 0, emittedEvents: 0, truncated: true });
	});

	it('replaces an unserializable event with one bounded marker', () => {
		const lines: string[] = [];
		const writer = createStructuralSccProgressJsonlWriter({
			write: (line) => lines.push(line)
		});
		const hostile = {
			...event('HOSTILE'),
			observations: new Proxy([], {})
		} as StructuralSccReportProgressEvent;
		writer.emit(hostile);
		expect(lines).toHaveLength(1);
		expect(JSON.parse(lines[0]!)).toMatchObject({
			emittedBytes: 0,
			emittedEvents: 0,
			reason: 'SERIALIZATION_FAILED',
			state: 'TRUNCATED'
		});
	});

	it('counts an accepted backpressured record, emits one marker, and then stops', () => {
		const lines: string[] = [];
		const writer = createStructuralSccProgressJsonlWriter({
			write: (line) => {
				lines.push(line);
				return false;
			}
		});
		writer.emit(event('BACKPRESSURE'));
		writer.emit(event('IGNORED'));
		expect(lines).toHaveLength(2);
		expect(JSON.parse(lines[1]!)).toMatchObject({
			emittedEvents: 1,
			kind: 'PROGRESS_TRANSPORT',
			reason: 'BACKPRESSURE',
			state: 'TRUNCATED'
		});
		expect(writer.stats()).toEqual({
			emittedBytes: Buffer.byteLength(lines.join(''), 'utf8'),
			emittedEvents: 2,
			truncated: true
		});
	});

	it('contains a rejected asynchronous output result', async () => {
		const writer = createStructuralSccProgressJsonlWriter({
			write: () => Promise.reject(new Error('asynchronous transport failure'))
		});
		expect(() => writer.emit(event('REJECTED'))).not.toThrow();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(writer.stats()).toMatchObject({ emittedEvents: 1, truncated: true });
	});
});
