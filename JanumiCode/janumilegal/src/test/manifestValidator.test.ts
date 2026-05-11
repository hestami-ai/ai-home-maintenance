import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, ClvDal } from '../lib/database/index.js';
import { DbBackedCLV, loadCLVv1 } from '../lib/clv/index.js';
import { AgentRegistry } from '../lib/registry/agentRegistry.js';
import { validateManifest } from '../lib/orchestrator/manifestValidator.js';
import {
  trivialManifest,
  stateOneAgentRegistration,
  stateTwoAgentRegistration,
} from './fixtures/trivialLens.js';

describe('manifest validator', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let registry: AgentRegistry;
  let clv: DbBackedCLV;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-mv-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    const clvDal = new ClvDal(db);
    loadCLVv1(clvDal);
    clv = new DbBackedCLV(clvDal);
    registry = new AgentRegistry();
    registry.register(stateOneAgentRegistration);
    registry.register(stateTwoAgentRegistration);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('accepts a clean manifest', () => {
    const v = validateManifest(trivialManifest, { clv, agentRegistry: registry });
    expect(v.ok, v.errors.join('; ')).toBe(true);
  });

  it('rejects a manifest with an unknown CLV term in clvBindings', () => {
    const bad = { ...trivialManifest, clvBindings: ['clv.core.does_not_exist.v1'] };
    const v = validateManifest(bad, { clv, agentRegistry: registry });
    expect(v.ok).toBe(false);
    expect(v.errors.join(';')).toMatch(/does_not_exist/);
  });

  it('rejects a manifest with an unknown CLV term in a state clvScope', () => {
    const bad = {
      ...trivialManifest,
      states: trivialManifest.states.map((s, i) =>
        i === 0 ? { ...s, clvScope: ['clv.core.bogus.v1'] } : s,
      ),
    };
    const v = validateManifest(bad, { clv, agentRegistry: registry });
    expect(v.ok).toBe(false);
    expect(v.errors.join(';')).toMatch(/clv\.core\.bogus\.v1/);
  });

  it('rejects a manifest referencing an unregistered agent', () => {
    const bad = {
      ...trivialManifest,
      states: trivialManifest.states.map((s, i) =>
        i === 0 ? { ...s, permittedAgents: ['ghost_agent.v1'] } : s,
      ),
    };
    const v = validateManifest(bad, { clv, agentRegistry: registry });
    expect(v.ok).toBe(false);
    expect(v.errors.join(';')).toMatch(/ghost_agent/);
  });

  it('rejects a manifest with a forward predecessor', () => {
    const bad = {
      ...trivialManifest,
      states: trivialManifest.states.map((s, i) =>
        i === 0 ? { ...s, predecessors: ['StateTwo'] } : s,
      ),
    };
    const v = validateManifest(bad, { clv, agentRegistry: registry });
    expect(v.ok).toBe(false);
    expect(v.errors.join(';')).toMatch(/predecessor/);
  });
});
