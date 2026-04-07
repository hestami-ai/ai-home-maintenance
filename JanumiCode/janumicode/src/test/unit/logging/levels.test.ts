import { describe, it, expect } from 'vitest';
import { LogLevel, parseLogLevel, logLevelLabel } from '../../../lib/logging/levels';

describe('Log Levels', () => {
	describe('LogLevel enum', () => {
		it('defines DEBUG as 0', () => {
			expect(LogLevel.DEBUG).toBe(0);
		});

		it('defines INFO as 1', () => {
			expect(LogLevel.INFO).toBe(1);
		});

		it('defines WARN as 2', () => {
			expect(LogLevel.WARN).toBe(2);
		});

		it('defines ERROR as 3', () => {
			expect(LogLevel.ERROR).toBe(3);
		});

		it('defines NONE as 4', () => {
			expect(LogLevel.NONE).toBe(4);
		});

		it('orders levels by increasing severity', () => {
			expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);
			expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);
			expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);
			expect(LogLevel.ERROR).toBeLessThan(LogLevel.NONE);
		});
	});

	describe('parseLogLevel', () => {
		it('parses "debug" to DEBUG', () => {
			expect(parseLogLevel('debug')).toBe(LogLevel.DEBUG);
		});

		it('parses "info" to INFO', () => {
			expect(parseLogLevel('info')).toBe(LogLevel.INFO);
		});

		it('parses "warn" to WARN', () => {
			expect(parseLogLevel('warn')).toBe(LogLevel.WARN);
		});

		it('parses "error" to ERROR', () => {
			expect(parseLogLevel('error')).toBe(LogLevel.ERROR);
		});

		it('parses "none" to NONE', () => {
			expect(parseLogLevel('none')).toBe(LogLevel.NONE);
		});

		it('handles uppercase input', () => {
			expect(parseLogLevel('DEBUG')).toBe(LogLevel.DEBUG);
			expect(parseLogLevel('INFO')).toBe(LogLevel.INFO);
			expect(parseLogLevel('WARN')).toBe(LogLevel.WARN);
			expect(parseLogLevel('ERROR')).toBe(LogLevel.ERROR);
			expect(parseLogLevel('NONE')).toBe(LogLevel.NONE);
		});

		it('handles mixed case input', () => {
			expect(parseLogLevel('DeBuG')).toBe(LogLevel.DEBUG);
			expect(parseLogLevel('WaRn')).toBe(LogLevel.WARN);
		});

		it('returns INFO for undefined input', () => {
			expect(parseLogLevel(undefined)).toBe(LogLevel.INFO);
		});

		it('returns INFO for empty string', () => {
			expect(parseLogLevel('')).toBe(LogLevel.INFO);
		});

		it('returns INFO for unrecognized input', () => {
			expect(parseLogLevel('invalid')).toBe(LogLevel.INFO);
			expect(parseLogLevel('trace')).toBe(LogLevel.INFO);
			expect(parseLogLevel('verbose')).toBe(LogLevel.INFO);
		});

		it('handles whitespace gracefully', () => {
			expect(parseLogLevel('  debug  ')).toBe(LogLevel.INFO);
		});
	});

	describe('logLevelLabel', () => {
		it('returns "DEBUG" for DEBUG level', () => {
			expect(logLevelLabel(LogLevel.DEBUG)).toBe('DEBUG');
		});

		it('returns "INFO" for INFO level', () => {
			expect(logLevelLabel(LogLevel.INFO)).toBe('INFO');
		});

		it('returns "WARN" for WARN level', () => {
			expect(logLevelLabel(LogLevel.WARN)).toBe('WARN');
		});

		it('returns "ERROR" for ERROR level', () => {
			expect(logLevelLabel(LogLevel.ERROR)).toBe('ERROR');
		});

		it('returns "NONE" for NONE level', () => {
			expect(logLevelLabel(LogLevel.NONE)).toBe('NONE');
		});

		it('returns consistent labels for all levels', () => {
			const levels = [
				LogLevel.DEBUG,
				LogLevel.INFO,
				LogLevel.WARN,
				LogLevel.ERROR,
				LogLevel.NONE,
			];

			for (const level of levels) {
				const label = logLevelLabel(level);
				expect(label).toBeTruthy();
				expect(typeof label).toBe('string');
			}
		});
	});

	describe('edge cases', () => {
		it('parseLogLevel handles null as undefined', () => {
			expect(parseLogLevel(null as any)).toBe(LogLevel.INFO);
		});

		it('parseLogLevel handles numbers as strings', () => {
			expect(parseLogLevel('0' as any)).toBe(LogLevel.INFO);
			expect(parseLogLevel('1' as any)).toBe(LogLevel.INFO);
		});

		it('logLevelLabel handles numeric enum values', () => {
			expect(logLevelLabel(0)).toBe('DEBUG');
			expect(logLevelLabel(1)).toBe('INFO');
			expect(logLevelLabel(2)).toBe('WARN');
			expect(logLevelLabel(3)).toBe('ERROR');
			expect(logLevelLabel(4)).toBe('NONE');
		});
	});
});
