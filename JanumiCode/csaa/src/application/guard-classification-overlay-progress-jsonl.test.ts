import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import {
	GUARD_CLASSIFICATION_OVERLAY_PROGRESS_MAX_BYTES,
	GUARD_CLASSIFICATION_OVERLAY_PROGRESS_MAX_EVENTS,
	GUARD_CLASSIFICATION_OVERLAY_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	createGuardClassificationOverlayProgressJsonlWriter
} from './guard-classification-overlay-progress-jsonl.js';
import {
	GUARD_CLASSIFICATION_OVERLAY_REPORT_PROGRESS_NONCLAIMS,
	type GuardClassificationOverlayReportProgressEvent
} from './run-guard-classification-overlay-report.js';

function event(detailCode: string, sequence = 1): GuardClassificationOverlayReportProgressEvent {
	return {
		deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
		detailCode,
		elapsedMs: 0,
		guardProgress: null,
		kind: 'REPORT_STAGE',
		nonclaims: GUARD_CLASSIFICATION_OVERLAY_REPORT_PROGRESS_NONCLAIMS,
		observations: [],
		operationVersion: 'jan-csaa-report-guard-classification-overlay/0.1.0',
		overlayProgress: null,
		phase: 'REQUEST_BIND',
		predecessorProgress: null,
		protocolRole: 'PRELIMINARY_TYPESCRIPT_GUARD_CLASSIFICATION_OVERLAY_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: 'jan-csaa-guard-classification-overlay-report-progress/0.1.0',
		sequence,
		stage: 'REQUEST',
		state: 'STARTED',
		wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET'
	};
}

describe('guard-classification overlay progress JSONL transport', () => {
	it('emits canonical newline-delimited events and reserves one bounded event-limit marker', () => {
		const lines: string[] = [];
		const writer = createGuardClassificationOverlayProgressJsonlWriter({
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
			nonclaims: GUARD_CLASSIFICATION_OVERLAY_REPORT_PROGRESS_NONCLAIMS,
			protocolRole:
				'PRELIMINARY_TYPESCRIPT_GUARD_CLASSIFICATION_OVERLAY_REPORT_TELEMETRY_TRANSPORT',
			reason: 'EVENT_LIMIT',
			schemaVersion: GUARD_CLASSIFICATION_OVERLAY_PROGRESS_TRANSPORT_SCHEMA_VERSION,
			state: 'TRUNCATED'
		});
		expect(writer.stats()).toMatchObject({ emittedEvents: 3, truncated: true });
		expect(Buffer.byteLength(lines.join(''), 'utf8')).toBeLessThanOrEqual(65_536);
	});

	it('uses bounded markers for byte exhaustion and serialization failure', () => {
		const byteLines: string[] = [];
		const byteWriter = createGuardClassificationOverlayProgressJsonlWriter({
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
		const serializationWriter = createGuardClassificationOverlayProgressJsonlWriter({
			write: (line) => serializationLines.push(line)
		});
		serializationWriter.emit(cyclic as unknown as GuardClassificationOverlayReportProgressEvent);
		expect(JSON.parse(serializationLines[0]!)).toMatchObject({
			reason: 'SERIALIZATION_FAILED',
			state: 'TRUNCATED'
		});
	});

	it('isolates throwing, rejecting, hostile-thenable, and backpressured sinks', async () => {
		const throwing = createGuardClassificationOverlayProgressJsonlWriter({
			write: () => {
				throw new Error('transport failure');
			}
		});
		expect(() => throwing.emit(event('THROW'))).not.toThrow();
		expect(throwing.stats()).toEqual({ emittedBytes: 0, emittedEvents: 0, truncated: true });

		const backpressureLines: string[] = [];
		const backpressured = createGuardClassificationOverlayProgressJsonlWriter({
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

		const rejecting = createGuardClassificationOverlayProgressJsonlWriter({
			write: () => Promise.reject(new Error('asynchronous transport failure'))
		});
		expect(() => rejecting.emit(event('REJECTED'))).not.toThrow();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(rejecting.stats()).toMatchObject({ emittedEvents: 1, truncated: true });

		const hostileThenable = createGuardClassificationOverlayProgressJsonlWriter({
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
			createGuardClassificationOverlayProgressJsonlWriter({
				maxBytes: GUARD_CLASSIFICATION_OVERLAY_PROGRESS_MAX_BYTES + 1,
				write: () => true
			})
		).toThrow('equal-or-stricter safe integer');
		expect(() =>
			createGuardClassificationOverlayProgressJsonlWriter({
				maxEvents: GUARD_CLASSIFICATION_OVERLAY_PROGRESS_MAX_EVENTS + 1,
				write: () => true
			})
		).toThrow('equal-or-stricter safe integer');
	});
});
