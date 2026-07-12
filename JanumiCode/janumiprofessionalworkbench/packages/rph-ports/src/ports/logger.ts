// Logger port — the ONLY diagnostic logging seam the engine uses (Constitution §Debugging/Observability,
// library interpretation in tracker §11.2). The engine emits STRUCTURED, LEVELED records here; the HOST
// wires the sink (console / pino / OTel bridge). Default is a no-op — the library never picks a sink.
//
// The engine's DURABLE observability is its domain events + AssuranceObservations (event sourcing); this
// port is for diagnostic tracing at boundaries, state transitions, and decisions. Records must be
// structured (an `event` name + typed fields), never prose, and MUST NOT carry secrets / PII / raw payloads.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** Numeric ordering for level-threshold filtering. */
export const LOG_LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
	fatal: 50
};

export interface LogFields {
	readonly [key: string]: unknown;
}

export interface Logger {
	/** Emit a structured record at `level` under the stable `event` name. */
	log(level: LogLevel, event: string, fields?: LogFields): void;
	debug(event: string, fields?: LogFields): void;
	info(event: string, fields?: LogFields): void;
	warn(event: string, fields?: LogFields): void;
	error(event: string, fields?: LogFields): void;
	fatal(event: string, fields?: LogFields): void;
	/** A child logger whose `bindings` (e.g. correlationId, aggregateId) merge into every record. */
	child(bindings: LogFields): Logger;
}
