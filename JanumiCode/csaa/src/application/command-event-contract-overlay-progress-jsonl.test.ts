import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import {
	COMMAND_EVENT_CONTRACT_OVERLAY_PROGRESS_MAX_BYTES,
	COMMAND_EVENT_CONTRACT_OVERLAY_PROGRESS_MAX_EVENTS,
	COMMAND_EVENT_CONTRACT_OVERLAY_PROGRESS_TRANSPORT_SCHEMA_VERSION,
	createCommandEventContractOverlayProgressJsonlWriter
} from './command-event-contract-overlay-progress-jsonl.js';
import {
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROGRESS_NONCLAIMS,
	type CommandEventContractOverlayReportProgressEvent
} from './run-command-event-contract-overlay-report.js';

function event(detailCode: string, sequence = 1): CommandEventContractOverlayReportProgressEvent {
	return {
		deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
		detailCode,
		elapsedMs: 0,
		kind: 'REPORT_STAGE',
		nonclaims: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROGRESS_NONCLAIMS,
		observations: [],
		operationVersion: 'jan-csaa-report-command-event-contract-overlay/0.1.0',
		overlayProgress: null,
		phase: 'REQUEST_BIND',
		predecessorProgress: null,
		protocolRole: 'PRELIMINARY_TYPESCRIPT_COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: 'jan-csaa-command-event-contract-overlay-report-progress/0.1.0',
		sequence,
		stage: 'REQUEST',
		state: 'STARTED',
		wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET'
	};
}

describe('command-event-contract overlay progress JSONL transport', () => {
	it('emits canonical newline-delimited events and reserves one bounded event-limit marker', () => {
		const lines: string[] = [];
		const writer = createCommandEventContractOverlayProgressJsonlWriter({
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
			nonclaims: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROGRESS_NONCLAIMS,
			protocolRole:
				'PRELIMINARY_TYPESCRIPT_COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_TELEMETRY_TRANSPORT',
			reason: 'EVENT_LIMIT',
			schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_PROGRESS_TRANSPORT_SCHEMA_VERSION,
			state: 'TRUNCATED'
		});
		expect(writer.stats()).toMatchObject({ emittedEvents: 3, truncated: true });
		expect(Buffer.byteLength(lines.join(''), 'utf8')).toBeLessThanOrEqual(65_536);
	});

	it('uses bounded markers for byte exhaustion and serialization failure', () => {
		const byteLines: string[] = [];
		const byteWriter = createCommandEventContractOverlayProgressJsonlWriter({
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
		const serializationWriter = createCommandEventContractOverlayProgressJsonlWriter({
			write: (line) => serializationLines.push(line)
		});
		serializationWriter.emit(cyclic as unknown as CommandEventContractOverlayReportProgressEvent);
		expect(JSON.parse(serializationLines[0]!)).toMatchObject({
			reason: 'SERIALIZATION_FAILED',
			state: 'TRUNCATED'
		});
	});

	it('isolates throwing, rejecting, hostile-thenable, and backpressured sinks', async () => {
		const throwing = createCommandEventContractOverlayProgressJsonlWriter({
			write: () => {
				throw new Error('transport failure');
			}
		});
		expect(() => throwing.emit(event('THROW'))).not.toThrow();
		expect(throwing.stats()).toEqual({ emittedBytes: 0, emittedEvents: 0, truncated: true });

		const backpressureLines: string[] = [];
		const backpressured = createCommandEventContractOverlayProgressJsonlWriter({
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

		const rejecting = createCommandEventContractOverlayProgressJsonlWriter({
			write: () => Promise.reject(new Error('asynchronous transport failure'))
		});
		expect(() => rejecting.emit(event('REJECTED'))).not.toThrow();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(rejecting.stats()).toMatchObject({ emittedEvents: 1, truncated: true });

		const hostileThenable = createCommandEventContractOverlayProgressJsonlWriter({
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
			createCommandEventContractOverlayProgressJsonlWriter({
				maxBytes: COMMAND_EVENT_CONTRACT_OVERLAY_PROGRESS_MAX_BYTES + 1,
				write: () => true
			})
		).toThrow('equal-or-stricter safe integer');
		expect(() =>
			createCommandEventContractOverlayProgressJsonlWriter({
				maxEvents: COMMAND_EVENT_CONTRACT_OVERLAY_PROGRESS_MAX_EVENTS + 1,
				write: () => true
			})
		).toThrow('equal-or-stricter safe integer');
	});
});
