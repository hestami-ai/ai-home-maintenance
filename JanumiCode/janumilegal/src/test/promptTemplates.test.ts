/**
 * Wave 1 gate: prompt-template binding validation.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 1 gate:
 *   "Loading any artifact that references an unknown CLV term fails closed."
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, ClvDal, PromptTemplateDal } from '../lib/database/index.js';
import { DbBackedCLV, loadCLVv1 } from '../lib/clv/index.js';
import { PromptTemplateRegistry } from '../lib/promptTemplates/registry.js';

describe('PromptTemplateRegistry', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let registry: PromptTemplateRegistry;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-pt-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    const clvDal = new ClvDal(db);
    loadCLVv1(clvDal);
    const ptDal = new PromptTemplateDal(db);
    const clv = new DbBackedCLV(clvDal);
    registry = new PromptTemplateRegistry(ptDal, clv);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('accepts a template that binds known CLV terms', () => {
    const result = registry.register({
      templateId: 'issue_bloom_seed_prompt',
      templateVersion: 'v1',
      lensId: 'family_law_production_lens',
      stateId: 'IssueBloom',
      body: 'Identify each {{clv:clv.core.issue.v1}} in this matter without conflating it with a {{clv:clv.core.claim.v1}}.',
      clvBindings: ['clv.core.issue.v1', 'clv.core.claim.v1'],
    });
    expect(result.ok, result.errors.join('; ')).toBe(true);
  });

  it('rejects a declared binding to an unknown CLV term', () => {
    const result = registry.register({
      templateId: 'bogus_template',
      templateVersion: 'v1',
      body: 'irrelevant',
      clvBindings: ['clv.core.issue.v1', 'clv.core.does_not_exist.v1'],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(';')).toMatch(/clv\.core\.does_not_exist\.v1/);
  });

  it('rejects a placeholder pointing to an unknown CLV term', () => {
    const result = registry.register({
      templateId: 'placeholder_template',
      templateVersion: 'v1',
      body: 'Reference {{clv:clv.core.unknown_thing.v1}} fails.',
      clvBindings: ['clv.core.unknown_thing.v1'], // declared but does not exist
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(';')).toMatch(/unknown_thing/);
  });

  it('rejects a placeholder that is not declared in clvBindings', () => {
    const result = registry.register({
      templateId: 'undeclared_template',
      templateVersion: 'v1',
      body: 'Reference {{clv:clv.core.fact.v1}} but no binding declared.',
      clvBindings: ['clv.core.issue.v1'], // does not include clv.core.fact.v1
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(';')).toMatch(/not in clvBindings/);
  });

  it('persists and retrieves a registered template', () => {
    registry.register({
      templateId: 'persist_test',
      templateVersion: 'v1',
      body: 'no placeholders',
      clvBindings: [],
    });
    const fetched = registry.get('persist_test', 'v1');
    expect(fetched).toBeDefined();
    expect(fetched!.body).toBe('no placeholders');
  });
});
