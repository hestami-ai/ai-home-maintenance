import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, ClvDal, PromptTemplateDal } from '../lib/database/index.js';
import { DbBackedCLV, loadCLVv1 } from '../lib/clv/index.js';
import { PromptTemplateRegistry } from '../lib/promptTemplates/registry.js';
import { registerFamilyLawTemplates } from '../layer2_lens_packs/familyLawProduction/agentFactory.js';
import { FAMILY_LAW_PROMPT_TEMPLATES } from '../layer2_lens_packs/familyLawProduction/promptTemplates.js';

describe('Family Law prompt templates', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-pt-fl-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('all 11 templates load with valid CLV bindings', () => {
    const clv = new DbBackedCLV(new ClvDal(db));
    const registry = new PromptTemplateRegistry(new PromptTemplateDal(db), clv);
    expect(() => registerFamilyLawTemplates(registry)).not.toThrow();
    expect(FAMILY_LAW_PROMPT_TEMPLATES).toHaveLength(11);
  });

  it('each template covers its declared state', () => {
    const expectedStates = [
      'MatterContextNormalize', 'JurisdictionCapture', 'FactExtraction', 'ExistingOrderExtract',
      'IssueBloom', 'IssuePrune', 'AuthorityVerification', 'DirectLegalConclusionDraft',
      'ClientAdviceDraft', 'CourtFilingDraftGenerate', 'ReleaseStatusDetermine',
    ];
    const states = FAMILY_LAW_PROMPT_TEMPLATES.map((t) => t.stateId).sort();
    expect(states).toEqual(expectedStates.sort());
  });

  it('release_status_determine template enforces external_release_blocked default', () => {
    const t = FAMILY_LAW_PROMPT_TEMPLATES.find((x) => x.stateId === 'ReleaseStatusDetermine');
    expect(t?.body).toMatch(/external_release_blocked/);
    expect(t?.body).toMatch(/draft_court_filing/);
  });

  it('direct_legal_conclusion template forbids attorney_confirmed and certainty language', () => {
    const t = FAMILY_LAW_PROMPT_TEMPLATES.find((x) => x.stateId === 'DirectLegalConclusionDraft');
    expect(t?.body).toMatch(/attorney_review_required: true/i);
    expect(t?.body).toMatch(/NEVER.*certainty|guaranteed/i);
  });

  it('issue_prune template forbids silent pruning', () => {
    const t = FAMILY_LAW_PROMPT_TEMPLATES.find((x) => x.stateId === 'IssuePrune');
    expect(t?.body).toMatch(/non-empty reason/);
    expect(t?.body).toMatch(/silent pruning/);
  });
});
