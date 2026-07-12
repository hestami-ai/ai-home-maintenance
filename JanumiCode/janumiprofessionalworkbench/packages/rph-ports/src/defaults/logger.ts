// Host-agnostic default Logger implementations. These carry no domain vocabulary and no host
// assumptions, so they ship with the ports package as convenience: NoopLogger is the safe default
// (the library never logs unless the host opts in); StructuredLogger routes records to an injected sink.
import { type LogFields, type Logger, type LogLevel, LOG_LEVEL_ORDER } from '../ports/logger.js';

abstract class BaseLogger implements Logger {
	abstract log(level: LogLevel, event: string, fields?: LogFields): void;
	abstract child(bindings: LogFields): Logger;

	debug(event: string, fields?: LogFields): void {
		this.log('debug', event, fields);
	}
	info(event: string, fields?: LogFields): void {
		this.log('info', event, fields);
	}
	warn(event: string, fields?: LogFields): void {
		this.log('warn', event, fields);
	}
	error(event: string, fields?: LogFields): void {
		this.log('error', event, fields);
	}
	fatal(event: string, fields?: LogFields): void {
		this.log('fatal', event, fields);
	}
}

/** The default: discards everything. The library logs nothing unless the host injects a real Logger. */
export class NoopLogger extends BaseLogger {
	override log(_level: LogLevel, _event: string, _fields?: LogFields): void {
		/* intentionally empty — the library logs nothing by default */
	}
	override child(_bindings: LogFields): Logger {
		return this;
	}
}

export interface LogRecord extends LogFields {
	readonly level: LogLevel;
	readonly event: string;
}

export type LogSink = (record: LogRecord) => void;

/** Routes structured records to an injected sink, applying a level threshold and merged bindings. */
export class StructuredLogger extends BaseLogger {
	constructor(
		private readonly sink: LogSink,
		private readonly minLevel: LogLevel = 'info',
		private readonly bindings: LogFields = {}
	) {
		super();
	}

	override log(level: LogLevel, event: string, fields?: LogFields): void {
		if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.minLevel]) return;
		this.sink({ level, event, ...this.bindings, ...fields });
	}

	override child(bindings: LogFields): Logger {
		return new StructuredLogger(this.sink, this.minLevel, { ...this.bindings, ...bindings });
	}
}

/** Convenience structured-JSON-to-console logger (one JSON object per line; errors to stderr). */
export function consoleLogger(minLevel: LogLevel = 'info'): StructuredLogger {
	return new StructuredLogger((record) => {
		const line = JSON.stringify(record);
		if (record.level === 'error' || record.level === 'fatal') {
			console.error(line);
		} else {
			console.log(line);
		}
	}, minLevel);
}
