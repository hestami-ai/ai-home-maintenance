import { describe, expect, it, vi } from 'vitest';
import type { LogRecord } from './logger.js';
import { NoopLogger, StructuredLogger, consoleLogger } from './logger.js';

describe('StructuredLogger', () => {
	it('routes structured records to the sink', () => {
		const records: LogRecord[] = [];
		const log = new StructuredLogger((r) => records.push(r), 'debug');
		log.info('command.received', { commandId: 'cmd_1' });
		expect(records).toEqual([{ level: 'info', event: 'command.received', commandId: 'cmd_1' }]);
	});

	it('drops records below the level threshold', () => {
		const records: LogRecord[] = [];
		const log = new StructuredLogger((r) => records.push(r), 'warn');
		log.debug('noise');
		log.info('noise');
		log.warn('kept');
		log.error('kept');
		expect(records.map((r) => r.event)).toEqual(['kept', 'kept']);
	});

	it('merges child bindings into every record and stacks across children', () => {
		const records: LogRecord[] = [];
		const root = new StructuredLogger((r) => records.push(r), 'debug', { service: 'engine' });
		const child = root.child({ correlationId: 'corr_1' }).child({ aggregateId: 'pwu_1' });
		child.error('invariant.violation', { invariant: 'INV-5' });
		expect(records[0]).toEqual({
			level: 'error',
			event: 'invariant.violation',
			service: 'engine',
			correlationId: 'corr_1',
			aggregateId: 'pwu_1',
			invariant: 'INV-5'
		});
	});

	it('lets per-call fields override bindings', () => {
		const records: LogRecord[] = [];
		const log = new StructuredLogger((r) => records.push(r), 'debug', { region: 'a' });
		log.info('e', { region: 'b' });
		expect(records[0]?.region).toBe('b');
	});
});

describe('NoopLogger', () => {
	it('discards everything and returns itself as child', () => {
		const log = new NoopLogger();
		expect(() => log.fatal('x', { a: 1 })).not.toThrow();
		expect(log.child({ a: 1 })).toBe(log);
	});
});

describe('consoleLogger', () => {
	it('writes info to stdout and error to stderr as JSON lines', () => {
		const out = vi.spyOn(console, 'log').mockImplementation(() => {});
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		const log = consoleLogger('debug');
		log.info('a', { x: 1 });
		log.error('b');
		expect(out).toHaveBeenCalledWith('{"level":"info","event":"a","x":1}');
		expect(err).toHaveBeenCalledWith('{"level":"error","event":"b"}');
		out.mockRestore();
		err.mockRestore();
	});
});
