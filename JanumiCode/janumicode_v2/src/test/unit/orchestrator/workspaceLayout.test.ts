import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PROJECT_CODE_DIR, projectRootOf, ensureProjectRoot, toPosixPath } from '../../../lib/orchestrator/workspaceLayout';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { ConfigManager } from '../../../lib/config/configManager';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { copyEngineeringConstitution } from '../../../lib/orchestrator/phases/scaffoldSynthesis';

describe('workspaceLayout — control-plane / project-root split', () => {
  let ws: string;

  beforeEach(() => {
    ws = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-layout-'));
  });
  afterEach(() => {
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it('projectRootOf nests the code dir under the workspace, NOT alongside .janumicode', () => {
    const root = projectRootOf(ws);
    expect(root).toBe(path.join(ws, PROJECT_CODE_DIR));
    // The project root is a CHILD of the workspace; .janumicode is a sibling
    // of the project root, never inside it.
    expect(path.relative(root, path.join(ws, '.janumicode'))).toBe(path.join('..', '.janumicode'));
  });

  it('ensureProjectRoot creates the dir and a .gooseignore that excludes the control plane', () => {
    const root = ensureProjectRoot(ws);
    expect(fs.existsSync(root)).toBe(true);
    const ignore = fs.readFileSync(path.join(root, '.gooseignore'), 'utf8');
    expect(ignore).toContain('.janumicode/');
    // Idempotent — second call must not throw or duplicate.
    expect(() => ensureProjectRoot(ws)).not.toThrow();
  });

  it('a plain listing of the project root never exposes .janumicode', () => {
    fs.mkdirSync(path.join(ws, '.janumicode'), { recursive: true });
    const root = ensureProjectRoot(ws);
    const entries = fs.readdirSync(root);
    expect(entries).not.toContain('.janumicode');
  });

});

describe('toPosixPath — agent-facing path separator normalization', () => {
  it('converts native Windows backslashes to forward slashes', () => {
    expect(toPosixPath('E:\\Projects\\ws\\project')).toBe('E:/Projects/ws/project');
  });

  it('repairs a MIXED-separator path (the reported slice-150 bug)', () => {
    const mixed = 'E:\\Projects\\ws\\thin-slice-workspace-150/.janumicode/runs/abc/context/x.md';
    const fixed = toPosixPath(mixed);
    expect(fixed).toBe('E:/Projects/ws/thin-slice-workspace-150/.janumicode/runs/abc/context/x.md');
    expect(fixed).not.toMatch(/\\/);
  });

  it('mirrors the detail-file template construction → uniformly forward-slash, no mixed run', () => {
    // Reproduces phase9.ts:66: `${toPosixPath(workspacePath)}/.janumicode/...`
    const workspacePath = 'E:\\Projects\\ws\\thin-slice-workspace-150';
    const detail = `${toPosixPath(workspacePath)}/.janumicode/runs/run-1/context/9.1_task_x.md`;
    expect(detail).not.toMatch(/\\/);
    expect(detail.startsWith('E:/Projects/ws/')).toBe(true);
  });

  it('is a no-op for an already-POSIX path', () => {
    expect(toPosixPath('/e/Projects/ws/project')).toBe('/e/Projects/ws/project');
  });
});

describe('OrchestratorEngine.projectRoot', () => {
  let db: Database;
  let ws: string;

  beforeEach(() => {
    db = createTestDatabase();
    ws = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-engine-ws-'));
  });
  afterEach(() => {
    db.close();
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it('exposes projectRoot = <workspace>/project, distinct from workspacePath', () => {
    const engine = new OrchestratorEngine(db, new ConfigManager(), ws);
    expect(engine.workspacePath).toBe(ws);
    expect(engine.projectRoot).toBe(path.join(ws, PROJECT_CODE_DIR));
    expect(engine.projectRoot).not.toBe(engine.workspacePath);
  });
});

describe('copyEngineeringConstitution — control plane, absolute path', () => {
  let ws: string;
  let src: string;

  beforeEach(() => {
    ws = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-constitution-'));
    src = path.join(ws, 'source-constitution.md');
    fs.writeFileSync(src, '# craft standards', 'utf8');
  });
  afterEach(() => {
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it('writes under <controlRoot>/.janumicode and returns an ABSOLUTE path (agent cwd is projectRoot)', () => {
    const returned = copyEngineeringConstitution(ws, src);
    expect(returned).toBeDefined();
    expect(path.isAbsolute(returned!)).toBe(true);
    // Agent-facing path is POSIX-normalized (forward slashes, no backslashes).
    expect(returned!).not.toMatch(/\\/);
    expect(returned!).toBe(toPosixPath(path.join(ws, '.janumicode', 'engineering-constitution.md')));
    expect(fs.existsSync(returned!)).toBe(true);
    // It must NOT land inside the project root (where the agent works).
    expect(returned!.startsWith(toPosixPath(projectRootOf(ws)))).toBe(false);
  });
});
