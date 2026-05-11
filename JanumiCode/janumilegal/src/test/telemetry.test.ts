import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, FirmDal, OpStreamDal } from '../lib/database/index.js';
import { TelemetryAuditor } from '../lib/telemetry/auditor.js';

const FIRM = 'firm_test';

describe('Telemetry auditor', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let opStream: OpStreamDal;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-tel-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    new FirmDal(db).insertFirm(FIRM, 'Test', 'MD');
    opStream = new OpStreamDal(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports zero metrics on a clean firm', () => {
    const r = new TelemetryAuditor(opStream).audit(FIRM);
    expect(r.metrics.requiredStateCompletionRate).toBe(1);
    expect(r.metrics.stateStartedCount).toBe(0);
    expect(r.auditCounts.matterContextSwitches).toBe(0);
  });

  it('completion rate < 1 when states started but not all completed', () => {
    opStream.write({ eventType: 'state_started', firmId: FIRM, payload: {} });
    opStream.write({ eventType: 'state_started', firmId: FIRM, payload: {} });
    opStream.write({ eventType: 'state_completed', firmId: FIRM, payload: {} });
    const r = new TelemetryAuditor(opStream).audit(FIRM);
    expect(r.metrics.requiredStateCompletionRate).toBeCloseTo(0.5);
    expect(r.metrics.stateStartedCount).toBe(2);
    expect(r.metrics.stateCompletedCount).toBe(1);
  });

  it('counts matter context switches and exports', () => {
    for (let i = 0; i < 3; i++) opStream.write({ eventType: 'matter_context_switched', firmId: FIRM, payload: {} });
    opStream.write({ eventType: 'export_recorded', firmId: FIRM, payload: {} });
    const r = new TelemetryAuditor(opStream).audit(FIRM);
    expect(r.auditCounts.matterContextSwitches).toBe(3);
    expect(r.auditCounts.crossMatterOperations).toBe(1);
  });
});
