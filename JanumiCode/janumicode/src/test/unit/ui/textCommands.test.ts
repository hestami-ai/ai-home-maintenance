import { describe, it, expect } from 'vitest';
import { parseTextCommand } from '../../../lib/ui/governedStream/textCommands';

describe('Text Command Parser', () => {
	it('parses "retry" command', () => {
		const result = parseTextCommand('retry');
		expect(result).not.toBeNull();
		expect(result!.command).toBe('retry');
		expect(result!.args).toBe('');
	});

	it('parses "/retry" with slash prefix', () => {
		const result = parseTextCommand('/retry');
		expect(result).not.toBeNull();
		expect(result!.command).toBe('retry');
	});

	it('parses aliases: redo -> retry', () => {
		expect(parseTextCommand('redo')!.command).toBe('retry');
		expect(parseTextCommand('rerun')!.command).toBe('retry');
	});

	it('parses approve with args', () => {
		const result = parseTextCommand('Approve looks good');
		expect(result).not.toBeNull();
		expect(result!.command).toBe('approve');
		expect(result!.args).toBe('looks good');
	});

	it('parses aliases: ok -> approve, accept -> approve', () => {
		expect(parseTextCommand('ok')!.command).toBe('approve');
		expect(parseTextCommand('accept')!.command).toBe('approve');
	});

	it('parses reframe/replan commands', () => {
		expect(parseTextCommand('reframe')!.command).toBe('reframe');
		expect(parseTextCommand('replan')!.command).toBe('reframe');
	});

	it('parses override/skip commands', () => {
		expect(parseTextCommand('override')!.command).toBe('override');
		expect(parseTextCommand('skip')!.command).toBe('override');
	});

	it('returns null for non-command text', () => {
		expect(parseTextCommand('Hello world')).toBeNull();
		expect(parseTextCommand('please fix the bug')).toBeNull();
	});

	it('returns null for empty input', () => {
		expect(parseTextCommand('')).toBeNull();
		expect(parseTextCommand('   ')).toBeNull();
	});

	it('is case-insensitive', () => {
		expect(parseTextCommand('RETRY')!.command).toBe('retry');
		expect(parseTextCommand('Approve')!.command).toBe('approve');
		expect(parseTextCommand('REPLAN')!.command).toBe('reframe');
	});

	it('preserves raw input text', () => {
		const result = parseTextCommand('retry with context');
		expect(result).not.toBeNull();
		expect(result!.raw).toBe('retry with context');
	});
});
