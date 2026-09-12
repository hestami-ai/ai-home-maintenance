import { Buffer } from 'node:buffer';

import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	COMMAND_DISPATCH_TOPOLOGY_REPORT_PROGRESS_NONCLAIMS,
	type CommandDispatchTopologyReportProgressEvent
} from './run-command-dispatch-topology-report.js';

export const COMMAND_DISPATCH_TOPOLOGY_PROGRESS_TRANSPORT_SCHEMA_VERSION =
	'jan-csaa-command-dispatch-topology-progress-transport/0.1.0' as const;
export const COMMAND_DISPATCH_TOPOLOGY_PROGRESS_MAX_BYTES = 8 * 1024 * 1024;
export const COMMAND_DISPATCH_TOPOLOGY_PROGRESS_MAX_EVENTS = 2_048;

const TRUNCATION_MARKER_RESERVE_BYTES = 16 * 1024;

export interface CommandDispatchTopologyProgressTransportTruncation {
	readonly emittedBytes: number;
	readonly emittedEvents: number;
	readonly kind: 'PROGRESS_TRANSPORT';
	readonly maxBytes: number;
	readonly maxEvents: number;
	readonly nonclaims: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_PROGRESS_NONCLAIMS;
	readonly protocolRole: 'PRELIMINARY_TYPESCRIPT_COMMAND_DISPATCH_TOPOLOGY_REPORT_TELEMETRY_TRANSPORT';
	readonly reason: 'BACKPRESSURE' | 'BYTE_LIMIT' | 'EVENT_LIMIT' | 'SERIALIZATION_FAILED';
	readonly schemaVersion: typeof COMMAND_DISPATCH_TOPOLOGY_PROGRESS_TRANSPORT_SCHEMA_VERSION;
	readonly state: 'TRUNCATED';
}

export interface CommandDispatchTopologyProgressJsonlWriter {
	emit(event: CommandDispatchTopologyReportProgressEvent): void;
	stats(): {
		readonly emittedBytes: number;
		readonly emittedEvents: number;
		readonly truncated: boolean;
	};
}

export interface CommandDispatchTopologyProgressJsonlWriterOptions {
	readonly maxBytes?: number;
	readonly maxEvents?: number;
	readonly write: (line: string) => unknown;
}

function boundedLimit(value: number | undefined, ceiling: number, minimum: number): number {
	if (value === undefined) return ceiling;
	if (!Number.isSafeInteger(value) || value < minimum || value > ceiling)
		throw new Error('Progress transport limit must be an equal-or-stricter safe integer.');
	return value;
}

/** @internal Trusted-host writer used by the command adapter; not package-root exported. */
export function createCommandDispatchTopologyProgressJsonlWriter(
	options: CommandDispatchTopologyProgressJsonlWriterOptions
): CommandDispatchTopologyProgressJsonlWriter {
	const maxBytes = boundedLimit(
		options.maxBytes,
		COMMAND_DISPATCH_TOPOLOGY_PROGRESS_MAX_BYTES,
		TRUNCATION_MARKER_RESERVE_BYTES * 2
	);
	const maxEvents = boundedLimit(
		options.maxEvents,
		COMMAND_DISPATCH_TOPOLOGY_PROGRESS_MAX_EVENTS,
		2
	);
	let emittedBytes = 0;
	let emittedEvents = 0;
	let truncated = false;

	const writeLine = (line: string): 'BACKPRESSURE' | 'FAILED' | 'WRITTEN' => {
		try {
			const result = options.write(line);
			if (result !== undefined)
				void Promise.resolve(result).catch(() => {
					truncated = true;
				});
			return result === false ? 'BACKPRESSURE' : 'WRITTEN';
		} catch {
			return 'FAILED';
		}
	};
	const truncate = (reason: CommandDispatchTopologyProgressTransportTruncation['reason']): void => {
		if (truncated) return;
		truncated = true;
		const marker: CommandDispatchTopologyProgressTransportTruncation = Object.freeze({
			emittedBytes,
			emittedEvents,
			kind: 'PROGRESS_TRANSPORT',
			maxBytes,
			maxEvents,
			nonclaims: COMMAND_DISPATCH_TOPOLOGY_REPORT_PROGRESS_NONCLAIMS,
			protocolRole: 'PRELIMINARY_TYPESCRIPT_COMMAND_DISPATCH_TOPOLOGY_REPORT_TELEMETRY_TRANSPORT',
			reason,
			schemaVersion: COMMAND_DISPATCH_TOPOLOGY_PROGRESS_TRANSPORT_SCHEMA_VERSION,
			state: 'TRUNCATED'
		});
		const line = `${canonicalSemanticJson(marker)}\n`;
		const bytes = Buffer.byteLength(line, 'utf8');
		if (
			bytes > TRUNCATION_MARKER_RESERVE_BYTES ||
			emittedBytes + bytes > maxBytes ||
			emittedEvents + 1 > maxEvents
		)
			return;
		const writeState = writeLine(line);
		if (writeState === 'FAILED') return;
		emittedBytes += bytes;
		emittedEvents += 1;
	};

	return {
		emit(event): void {
			if (truncated) return;
			let line: string;
			try {
				line = `${canonicalSemanticJson(event)}\n`;
			} catch {
				truncate('SERIALIZATION_FAILED');
				return;
			}
			const bytes = Buffer.byteLength(line, 'utf8');
			if (emittedEvents + 1 >= maxEvents) {
				truncate('EVENT_LIMIT');
				return;
			}
			if (emittedBytes + bytes > maxBytes - TRUNCATION_MARKER_RESERVE_BYTES) {
				truncate('BYTE_LIMIT');
				return;
			}
			const writeState = writeLine(line);
			if (writeState === 'FAILED') {
				truncated = true;
				return;
			}
			emittedBytes += bytes;
			emittedEvents += 1;
			if (writeState === 'BACKPRESSURE') truncate('BACKPRESSURE');
		},
		stats() {
			return Object.freeze({ emittedBytes, emittedEvents, truncated });
		}
	};
}
