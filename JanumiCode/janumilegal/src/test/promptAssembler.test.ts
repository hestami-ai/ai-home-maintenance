import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, ClvDal } from '../lib/database/index.js';
import { DbBackedCLV, loadCLVv1 } from '../lib/clv/index.js';
import { PromptAssembler, PromptAssemblyError } from '../lib/agents/promptAssembler.js';
import type { AgentInvocationScope } from '../lib/scope/agentInvocationScope.js';

describe('PromptAssembler — envelope-only access', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let assembler: PromptAssembler;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-pa-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));
    const clv = new DbBackedCLV(new ClvDal(db));
    assembler = new PromptAssembler({ clv });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function makeEnvelope(overrides: Partial<AgentInvocationScope> = {}): AgentInvocationScope {
    return {
      firmId: 'f1',
      clientId: 'c1',
      matterId: 'm1',
      lensId: 'test_lens',
      lensVersion: 'v1',
      stateId: 'StateOne',
      privilegeFrame: { snapshotHash: 'h', version: 1 },
      authorizedSources: [],
      authorizedPriorArtifacts: [],
      authorizedMMP: [],
      forbiddenScopes: [],
      ...overrides,
    };
  }

  it('expands CLV term placeholders against the CLV', () => {
    const out = assembler.assemble(makeEnvelope(), {
      templateBody: 'Identify each {{clv:clv.core.issue.v1}} not as a {{clv:clv.core.claim.v1}}.',
    });
    expect(out.user).toBe('Identify each issue not as a claim.');
  });

  it('expands an authorized source reference', () => {
    const env = makeEnvelope({
      authorizedSources: [{ sourceId: 'src1', documentType: 'court_order', contentHash: 'h1' }],
    });
    const out = assembler.assemble(env, {
      templateBody: 'See {{source:src1}}.',
      resolveSource: (ref) => `<doc ${ref.sourceId} type=${ref.documentType}>`,
    });
    expect(out.user).toBe('See <doc src1 type=court_order>.');
  });

  it('THROWS when template references a source NOT in the envelope', () => {
    const env = makeEnvelope({
      authorizedSources: [{ sourceId: 'src1', documentType: 'court_order', contentHash: 'h1' }],
    });
    expect(() =>
      assembler.assemble(env, { templateBody: 'See {{source:other_matter_doc}}.' }),
    ).toThrow(PromptAssemblyError);
  });

  it('THROWS when template references an artifact NOT in the envelope', () => {
    expect(() =>
      assembler.assemble(makeEnvelope(), { templateBody: 'See {{artifact:other_artifact}}.' }),
    ).toThrow(/ARTIFACT_NOT_AUTHORIZED|not authorized/);
  });

  it('THROWS when template references an unknown CLV term', () => {
    expect(() =>
      assembler.assemble(makeEnvelope(), { templateBody: 'X {{clv:clv.core.fake.v1}}.' }),
    ).toThrow(/CLV term .* not found/);
  });
});
