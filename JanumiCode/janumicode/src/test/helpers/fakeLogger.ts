/**
 * Fake Logger Helper
 * Initializes the logger singleton with an OutputChannel mock.
 * Call in beforeEach for any test that imports modules using getLogger().
 *
 * By default uses a no-op channel. Set environment variables to enable output:
 *   JANUMICODE_TEST_LOGGER=stdout    → mirror to stdout (often buffered by vitest)
 *   JANUMICODE_TEST_LOG_FILE=/path   → append to a file in real time (recommended
 *                                      for long-running integration tests; tail -f
 *                                      from outside vitest's stdout capture)
 * Both may be set simultaneously.
 */

import * as fs from 'node:fs';
import { initializeLogger, resetLogger } from '../../lib/logging';

let _logFileFd: number | null = null;

function openLogFileIfNeeded(): void {
	const filePath = process.env.JANUMICODE_TEST_LOG_FILE;
	if (!filePath) { _logFileFd = null; return; }
	try {
		// Append mode, sync write — bypasses buffering so tail -f sees lines immediately.
		_logFileFd = fs.openSync(filePath, 'a');
		const banner = `\n=== test logger init @ ${new Date().toISOString()} ===\n`;
		fs.writeSync(_logFileFd, banner);
	} catch (err) {
		process.stderr.write(`[fakeLogger] failed to open ${filePath}: ${String(err)}\n`);
		_logFileFd = null;
	}
}

function closeLogFile(): void {
	if (_logFileFd !== null) {
		try { fs.closeSync(_logFileFd); } catch { /* ignore */ }
		_logFileFd = null;
	}
}

/**
 * Initialize the logger. Honors JANUMICODE_TEST_LOGGER=stdout and
 * JANUMICODE_TEST_LOG_FILE=<path>. Safe to call multiple times — resets first.
 */
export function initTestLogger(): void {
	resetLogger();
	closeLogFile();
	openLogFileIfNeeded();

	const useStdout = process.env.JANUMICODE_TEST_LOGGER === 'stdout';

	const writeLine = (msg: string): void => {
		if (useStdout) { process.stdout.write(msg + '\n'); }
		if (_logFileFd !== null) {
			try { fs.writeSync(_logFileFd, msg + '\n'); } catch { /* ignore */ }
		}
	};
	const writeRaw = (msg: string): void => {
		if (useStdout) { process.stdout.write(msg); }
		if (_logFileFd !== null) {
			try { fs.writeSync(_logFileFd, msg); } catch { /* ignore */ }
		}
	};

	const mockOutputChannel = {
		name: 'JanumiCode Test',
		append: writeRaw,
		appendLine: writeLine,
		clear: () => {},
		show: () => {},
		hide: () => {},
		dispose: () => {},
		replace: () => {},
	};

	initializeLogger(mockOutputChannel as never);
}

/**
 * Tear down the logger. Call in afterEach to avoid cross-test contamination.
 */
export function teardownTestLogger(): void {
	resetLogger();
	closeLogFile();
}
