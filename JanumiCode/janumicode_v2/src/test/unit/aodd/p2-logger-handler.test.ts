/**
 * P2 wiring tests for Logger ↔ AODD.
 *
 * Covers:
 *   - Logger.addHandler() / removeHandler() additive seam
 *   - AoddLogHandler translation of LogEntry → log.<level> events
 *   - End-to-end: Logger.info(...) → events.ndjson line
 *   - registerAoddLogHandler() idempotency
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AoddLogHandler,
  closeStreams,
  endRun,
  initialize,
  registerAoddLogHandler,
  startRun,
  unregisterAoddLogHandler,
} from '../../../lib/aodd';
import type { LogEntry } from '../../../lib/logging/formatters';
import type { LogHandler } from '../../../lib/logging/handlers';
import { Logger } from '../../../lib/logging/logger';
import { withTraceContext } from '../../../lib/trace/traceContext';

function readEvents(workspaceRoot: string, runId: string): unknown[] {
  const filepath = path.join(
    workspaceRoot,
    '.janumicode',
    'runs',
    runId,
    'aodd',
    'events.ndjson',
  );
  if (!fs.existsSync(filepath)) return [];
  return fs
    .readFileSync(filepath, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

class CapturingHandler implements LogHandler {
  public entries: LogEntry[] = [];
  handle(entry: LogEntry): void {
    this.entries.push(entry);
  }
  setLevel(): void {
    /* unused */
  }
}

describe('Logger.addHandler / removeHandler', () => {
  it('appends a handler and routes entries to it', () => {
    const logger = new Logger({ level: 'DEBUG', consoleEnabled: false });
    const cap = new CapturingHandler();
    logger.addHandler(cap);

    logger.info('workflow', 'hello');
    expect(cap.entries).toHaveLength(1);
    expect(cap.entries[0].level).toBe('INFO');
    expect(cap.entries[0].message).toBe('hello');
  });

  it('returns a dispose function that detaches the handler', () => {
    const logger = new Logger({ level: 'DEBUG', consoleEnabled: false });
    const cap = new CapturingHandler();
    const dispose = logger.addHandler(cap);

    logger.info('workflow', 'first');
    dispose();
    logger.info('workflow', 'second');

    expect(cap.entries.map((e) => e.message)).toEqual(['first']);
  });

  it('removeHandler is a no-op for an unregistered handler', () => {
    const logger = new Logger({ level: 'DEBUG', consoleEnabled: false });
    const cap = new CapturingHandler();
    expect(() => logger.removeHandler(cap)).not.toThrow();
  });
});

describe('AoddLogHandler', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-p2-'));
  });

  afterEach(() => {
    unregisterAoddLogHandler();
    closeStreams();
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('translates LogEntry into log.<level> AODD events when a run is active', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-log');

    const logger = new Logger({ level: 'DEBUG', consoleEnabled: false });
    const handler = new AoddLogHandler();
    logger.addHandler(handler);

    await withTraceContext(
      { workflow_run_id: 'wf-log', phase_id: '1', sub_phase_id: 'sub_a' },
      async () => {
        logger.info('workflow', 'orchestrator entered phase 1', { foo: 'bar' });
        logger.warn('llm', 'retry scheduled', { attempt: 2 });
        logger.error('error', 'boom');
      },
    );

    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-log') as Array<
      Record<string, unknown>
    >;
    const logEvents = events.filter((e) =>
      String(e.event_type).startsWith('log.'),
    );

    expect(logEvents.length).toBe(3);
    expect(logEvents[0].event_type).toBe('log.info');
    expect(logEvents[1].event_type).toBe('log.warn');
    expect(logEvents[2].event_type).toBe('log.error');

    const first = logEvents[0];
    expect(first.run_id).toBe('wf-log');
    expect(first.phase_id).toBe('1');
    expect(first.sub_phase_id).toBe('sub_a');
    const payload = first.payload as Record<string, unknown>;
    expect(payload.category).toBe('workflow');
    expect(payload.message).toBe('orchestrator entered phase 1');
    expect(payload.data).toEqual({ foo: 'bar' });
  });

  it('is silent when no AODD run is active', () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    // No startRun.

    const logger = new Logger({ level: 'DEBUG', consoleEnabled: false });
    logger.addHandler(new AoddLogHandler());
    expect(() => logger.info('workflow', 'should not write')).not.toThrow();
  });

  it('honors the level set via constructor / setLevel', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-level');

    const logger = new Logger({ level: 'DEBUG', consoleEnabled: false });
    const handler = new AoddLogHandler('WARN');
    logger.addHandler(handler);

    await withTraceContext(
      { workflow_run_id: 'wf-level', phase_id: '1', sub_phase_id: 'x' },
      async () => {
        logger.debug('workflow', 'd');
        logger.info('workflow', 'i');
        logger.warn('workflow', 'w');
        logger.error('error', 'e');
      },
    );

    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-level') as Array<
      Record<string, unknown>
    >;
    const logEvents = events.filter((e) =>
      String(e.event_type).startsWith('log.'),
    );
    // Only WARN + ERROR pass the handler's level filter.
    expect(logEvents.map((e) => e.event_type)).toEqual([
      'log.warn',
      'log.error',
    ]);
  });
});

describe('registerAoddLogHandler idempotency', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-p2reg-'));
  });

  afterEach(() => {
    unregisterAoddLogHandler();
    closeStreams();
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('returns the same dispose on a second registration with the same logger', () => {
    const logger = new Logger({ level: 'DEBUG', consoleEnabled: false });
    const dispose1 = registerAoddLogHandler(logger);
    const dispose2 = registerAoddLogHandler(logger);
    expect(dispose1).toBe(dispose2);
  });

  it('does NOT add a duplicate handler on the second call', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-dup');

    const logger = new Logger({ level: 'DEBUG', consoleEnabled: false });
    registerAoddLogHandler(logger);
    registerAoddLogHandler(logger);

    await withTraceContext(
      { workflow_run_id: 'wf-dup', phase_id: '1', sub_phase_id: 'x' },
      async () => {
        logger.info('workflow', 'one entry');
      },
    );

    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-dup') as Array<
      Record<string, unknown>
    >;
    const logEvents = events.filter((e) => e.event_type === 'log.info');
    // If a duplicate handler were registered, we'd see two log.info events.
    expect(logEvents).toHaveLength(1);
  });
});
