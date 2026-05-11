/**
 * CliBackedAgent tests.
 *
 * The tests use a tiny mock-CLI binary (a Node script) to exercise the
 * subprocess flow without depending on Goose/Claude/Codex/Gemini being
 * installed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, ClvDal, PromptTemplateDal } from '../lib/database/index.js';
import { DbBackedCLV, loadCLVv1 } from '../lib/clv/index.js';
import { PromptTemplateRegistry } from '../lib/promptTemplates/registry.js';
import { CliBackedAgent } from '../lib/agents/cliBackedAgent.js';

const FIRM = 'f1', CLIENT = 'c1', MATTER = 'm1';

describe('CliBackedAgent', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let mockCliPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-cli-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));

    // Write a tiny Node script that simulates a Goose-like CLI:
    // reads --instructions <file>, writes ./output/result.json.
    mockCliPath = path.join(dir, 'mock-cli.cjs');
    fs.writeFileSync(mockCliPath, `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
let instructionsFile = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--instructions') instructionsFile = args[++i];
}
if (!instructionsFile) { console.error('mock-cli: missing --instructions'); process.exit(2); }
if (!fs.existsSync(instructionsFile)) { console.error('mock-cli: file not found'); process.exit(3); }
fs.mkdirSync('output', { recursive: true });
fs.writeFileSync(path.join('output', 'result.json'), JSON.stringify({ ok: true, instructions_bytes: fs.readFileSync(instructionsFile).length }));
process.exit(0);
`);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('runs a mock CLI in a sandboxed working dir, reads output/result.json, returns parsed object', async () => {
    const clv = new DbBackedCLV(new ClvDal(db));
    const registry = new PromptTemplateRegistry(new PromptTemplateDal(db), clv);
    registry.register({
      templateId: 'cli.test', templateVersion: 'v1',
      lensId: 'test_lens', stateId: 'TestState',
      body: 'Test prompt body. Reference: {{clv:clv.core.matter.v1}}.',
      clvBindings: ['clv.core.matter.v1'],
    });

    const agent = new CliBackedAgent({
      agentId: 'cli_test_agent.v1',
      templateId: 'cli.test', templateVersion: 'v1',
      cli: 'goose',
      cliBinary: 'node',
      // Override args to invoke the mock-cli node script in --instructions mode.
      // We can't use the default `goose run --instructions` because we override binary;
      // CliBackedAgent passes cliArgs based on cli kind. To make the mock work, we
      // pass cli='goose' so the agent generates ['run','--instructions',promptPath]
      // and then we call `node mock-cli.cjs run --instructions promptPath`.
      // The mock script ignores 'run' and reads --instructions.
      clv, templateRegistry: registry,
      sandboxRoot: path.join(dir, 'sandbox'),
    });

    // Override agent's cliBinary indirectly: spawnSync runs `cliBinary || cli`. We pass
    // cliBinary='node' so the executable is node; args come from cliArgs which for goose
    // is ['run','--instructions',<promptPath>]. The mock-cli script needs to be the
    // first arg. Wrap by making cliBinary 'node' and prepending the script path via PATH.
    // Simpler: construct a goose-like wrapper. We instead replace the cliBinary with a
    // small wrapper script.
    const wrapperPath = path.join(dir, 'goose-wrapper.cjs');
    fs.writeFileSync(wrapperPath, `#!/usr/bin/env node
require(${JSON.stringify(mockCliPath)});`);

    const wrappedAgent = new CliBackedAgent({
      agentId: 'cli_test_agent.v1',
      templateId: 'cli.test', templateVersion: 'v1',
      cli: 'goose',
      cliBinary: process.execPath, // use actual node executable
      clv, templateRegistry: registry,
      sandboxRoot: path.join(dir, 'sandbox'),
    });
    // Patch via subclass for the test: wrap `node` so that the args become
    // `node mock-cli.cjs run --instructions <prompt>`.
    const out = await new (class extends CliBackedAgent {
      constructor() {
        super({
          agentId: 'cli_test_agent.v1',
          templateId: 'cli.test', templateVersion: 'v1',
          cli: 'goose',
          cliBinary: process.execPath,
          clv, templateRegistry: registry,
          sandboxRoot: path.join(dir, 'sandbox'),
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      protected cliArgs(promptPath: string): string[] {
        return [mockCliPath, 'run', '--instructions', promptPath];
      }
    })().execute({
      envelope: {
        firmId: FIRM, clientId: CLIENT, matterId: MATTER,
        lensId: 'test_lens', lensVersion: 'v1', stateId: 'TestState',
        privilegeFrame: { snapshotHash: 'h', version: 1 },
        authorizedSources: [], authorizedPriorArtifacts: [], authorizedMMP: [], forbiddenScopes: [],
      },
      input: { hello: 'world' },
    });

    expect(out.status).toBe('completed');
    expect((out.output as { ok: boolean }).ok).toBe(true);
    expect((out.output as { instructions_bytes: number }).instructions_bytes).toBeGreaterThan(0);

    void wrappedAgent; // unused; created earlier for type-only sanity
  });

  it('escalates when the CLI exits without writing output/result.json', async () => {
    const failingCliPath = path.join(dir, 'failing-cli.cjs');
    fs.writeFileSync(failingCliPath, `#!/usr/bin/env node
process.exit(0);
`);
    const clv = new DbBackedCLV(new ClvDal(db));
    const registry = new PromptTemplateRegistry(new PromptTemplateDal(db), clv);
    registry.register({
      templateId: 'cli.test', templateVersion: 'v1',
      lensId: 'test_lens', stateId: 'TestState',
      body: 'x',
      clvBindings: [],
    });

    const out = await new (class extends CliBackedAgent {
      constructor() {
        super({
          agentId: 'cli_test_agent.v1',
          templateId: 'cli.test', templateVersion: 'v1',
          cli: 'goose',
          cliBinary: process.execPath,
          clv, templateRegistry: registry,
          sandboxRoot: path.join(dir, 'sandbox2'),
        });
      }
      protected cliArgs(_p: string): string[] {
        return [failingCliPath];
      }
    })().execute({
      envelope: {
        firmId: FIRM, clientId: CLIENT, matterId: MATTER,
        lensId: 'test_lens', lensVersion: 'v1', stateId: 'TestState',
        privilegeFrame: { snapshotHash: 'h', version: 1 },
        authorizedSources: [], authorizedPriorArtifacts: [], authorizedMMP: [], forbiddenScopes: [],
      },
      input: {},
    });
    expect(out.status).toBe('escalated');
    expect(out.escalationReason).toMatch(/result.json/);
  });
});
