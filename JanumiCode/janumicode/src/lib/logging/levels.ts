/**
 * Log Levels
 * Defines severity levels for structured logging throughout the extension.
 */

/**
 * Log level enum — ordered by increasing severity.
 * Only messages at or above the configured minimum level are emitted.
 */
export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
	NONE = 4,
}

/**
 * Map from string config values to LogLevel enum.
 * Used when reading the `janumicode.logLevel` VS Code setting.
 */
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
	debug: LogLevel.DEBUG,
	info: LogLevel.INFO,
	warn: LogLevel.WARN,
	error: LogLevel.ERROR,
	none: LogLevel.NONE,
};

/**
 * Parse a string log level (from VS Code config) into a LogLevel enum value.
 * Falls back to INFO if the value is unrecognized.
 */
export function parseLogLevel(value: string | undefined): LogLevel {
	if (!value) {
		return LogLevel.INFO;
	}
	return LOG_LEVEL_MAP[value.toLowerCase()] ?? LogLevel.INFO;
}

/**
 * Human-readable label for a log level.
 */
export function logLevelLabel(level: LogLevel): string {
	switch (level) {
		case LogLevel.DEBUG:
			return 'DEBUG';
		case LogLevel.INFO:
			return 'INFO';
		case LogLevel.WARN:
			return 'WARN';
		case LogLevel.ERROR:
			return 'ERROR';
		case LogLevel.NONE:
			return 'NONE';
	}
}
