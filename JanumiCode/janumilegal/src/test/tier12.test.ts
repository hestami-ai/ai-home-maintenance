/**
 * Wave 4 gate: Tier 12 governance agents.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, FirmDal, ManifestDal, ActivationDal } from '../lib/database/index.js';
import { LensCompletenessAuditor } from '../lib/agents/governance/lensCompletenessAuditor.js';
import { IntentDriftDetector } from '../lib/agents/governance/intentDriftDetector.js';
import { ShortcutDetector } from '../lib/agents/governance/shortcutDetector.js';
import { TooCleverDetector } from '../lib/agents/governance/tooCleverDetector.js';
import type { LensPhaseManifest } from '../lib/orchestrator/types.js';

const FIRM = 'f1', CLIENT = 'c1', MATTER = 'm1';
const scope = { firmId: FIRM, clientId: CLIENT, matterId: MATTER };

function manifest(lensId: string, requiredStates: string[]): LensPhaseManifest {
  return {
    lensId, lensVersion: 'v1', practiceArea: 'family_law', applicableJurisdictions: ['MD'],
    states: requiredStates.map((s, i) => ({
      stateId: s, required: true, predecessors: i > 0 ? [requiredStates[i - 1]] : [],
      permittedAgents: [], inputSchema: 'x', outputSchema: 'y', validators: [],
      escalationConditions: [], clvScope: [], artifactsProduced: [],
    })),
    requiredArtifacts: [], validators: [], escalationTriggers: [], releasePolicies: [],
    clvBindings: [], dependencies: [],
  };
}

describe('Lens Completeness Auditor', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let manifestDal: ManifestDal;
  let activationDal: ActivationDal;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-lca-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    const firmDal = new FirmDal(db);
    firmDal.insertFirm(FIRM, 'JC Law', 'MD');
    firmDal.insertClient(FIRM, CLIENT, 'C');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT, matterId: MATTER, matterName: 'M', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    manifestDal = new ManifestDal(db);
    activationDal = new ActivationDal(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports ZERO findings when all required states are completed', () => {
    const m = manifest('lensA', ['S1', 'S2', 'S3']);
    manifestDal.insert(m);
    activationDal.insertActivation({ scope, activationId: 'a1', lensId: 'lensA', lensVersion: 'v1', activatedBy: 'u' });
    for (const s of ['S1', 'S2', 'S3']) {
      activationDal.insertStateOutput({ scope, activationId: 'a1', stateId: s, outputJson: '{}', outputHash: 'h' });
    }
    const audit = new LensCompletenessAuditor(manifestDal, activationDal).audit({ scope, activationId: 'a1' });
    expect(audit.summary.block).toBe(0);
    expect(audit.findings).toHaveLength(0);
  });

  it('FLAGS each missing required state', () => {
    const m = manifest('lensA', ['S1', 'S2', 'S3']);
    manifestDal.insert(m);
    activationDal.insertActivation({ scope, activationId: 'a1', lensId: 'lensA', lensVersion: 'v1', activatedBy: 'u' });
    activationDal.insertStateOutput({ scope, activationId: 'a1', stateId: 'S1', outputJson: '{}', outputHash: 'h' });
    const audit = new LensCompletenessAuditor(manifestDal, activationDal).audit({ scope, activationId: 'a1' });
    expect(audit.summary.block).toBe(2);
    const ids = audit.findings.map((f) => f.subject?.id).sort();
    expect(ids).toEqual(['S2', 'S3']);
  });

  it('blocks when activation does not exist', () => {
    const audit = new LensCompletenessAuditor(manifestDal, activationDal).audit({ scope, activationId: 'nope' });
    expect(audit.summary.block).toBeGreaterThanOrEqual(1);
  });
});

describe('Intent Drift Detector', () => {
  it('FLAGS when an originally requested artifact type was not produced', () => {
    const r = new IntentDriftDetector().detect({
      intent: {
        governingObjective: 'enforce custody order',
        acceptedMirrorAssumptions: [],
        menuSelections: [],
        requestedArtifactTypes: ['client_advice_draft', 'court_filing_draft'],
        requestedJurisdictions: ['MD'],
      },
      finalArtifacts: [
        { artifactId: 'a1', artifactType: 'research_memo', metadataKeywords: [], jurisdictionsReferenced: ['MD'] },
      ],
    });
    expect(r.findings.some((f) => f.category === 'artifact_type_missing' && f.message.includes('client_advice_draft'))).toBe(true);
    expect(r.findings.some((f) => f.category === 'artifact_type_missing' && f.message.includes('court_filing_draft'))).toBe(true);
  });

  it('FLAGS posture drift when attorney chose conservative but artifact reads aggressive', () => {
    const r = new IntentDriftDetector().detect({
      intent: {
        governingObjective: 'enforce',
        acceptedMirrorAssumptions: [],
        menuSelections: [{ question: 'posture?', chosenOptionLabel: 'Conservative' }],
        requestedArtifactTypes: ['client_advice_draft'],
        requestedJurisdictions: ['MD'],
      },
      finalArtifacts: [
        { artifactId: 'a1', artifactType: 'client_advice_draft', metadataKeywords: ['aggressive', 'novel'], jurisdictionsReferenced: ['MD'] },
      ],
    });
    expect(r.findings.some((f) => f.category === 'posture_drift')).toBe(true);
    expect(r.summary.block).toBeGreaterThanOrEqual(1);
  });

  it('WARNS on jurisdiction drift', () => {
    const r = new IntentDriftDetector().detect({
      intent: {
        governingObjective: 'enforce',
        acceptedMirrorAssumptions: [],
        menuSelections: [],
        requestedArtifactTypes: ['research_memo'],
        requestedJurisdictions: ['MD', 'VA'],
      },
      finalArtifacts: [
        { artifactId: 'a1', artifactType: 'research_memo', metadataKeywords: [], jurisdictionsReferenced: ['MD'] },
      ],
    });
    expect(r.findings.some((f) => f.category === 'jurisdiction_drift' && f.message.includes('VA'))).toBe(true);
  });

  it('emits NO findings on a clean run', () => {
    const r = new IntentDriftDetector().detect({
      intent: {
        governingObjective: 'enforce',
        acceptedMirrorAssumptions: ['custody_visitation_enforcement'],
        menuSelections: [{ question: 'posture?', chosenOptionLabel: 'Conservative' }],
        requestedArtifactTypes: ['client_advice_draft'],
        requestedJurisdictions: ['MD'],
      },
      finalArtifacts: [
        { artifactId: 'a1', artifactType: 'client_advice_draft', metadataKeywords: ['cautious', 'standard procedural relief'], jurisdictionsReferenced: ['MD'] },
      ],
    });
    expect(r.summary.block).toBe(0);
    expect(r.summary.warn).toBe(0);
  });
});

describe('Shortcut Detector', () => {
  it('FLAGS client advice produced without existing-order extract', () => {
    const r = new ShortcutDetector().detect({
      completedStateIds: ['ClientAdviceDraft', 'FactExtraction'],
      stateOutputs: {},
    });
    expect(r.findings.some((f) => f.category === 'shortcut' && f.message.includes('ExistingOrderExtract'))).toBe(true);
  });

  it('FLAGS conclusion produced without fact extraction', () => {
    const r = new ShortcutDetector().detect({
      completedStateIds: ['DirectLegalConclusionDraft'],
      stateOutputs: {},
    });
    expect(r.findings.some((f) => f.category === 'shortcut' && f.message.includes('FactExtraction'))).toBe(true);
  });

  it('emits NO findings on a complete workflow', () => {
    const r = new ShortcutDetector().detect({
      completedStateIds: [
        'FactExtraction',
        'ExistingOrderExtract',
        'ProceduralPostureCapture',
        'AuthorityVerification',
        'DirectLegalConclusionDraft',
        'ClientAdviceDraft',
        'CourtFilingDraftGenerate',
        'ReleaseStatusDetermine',
      ],
      stateOutputs: {},
    });
    expect(r.summary.block).toBe(0);
    expect(r.summary.warn).toBe(0);
  });
});

describe('Too-Clever-By-Half Detector', () => {
  it('BLOCKS guarantee language', () => {
    const r = new TooCleverDetector().detect([
      { artifactId: 'a1', artifactType: 'client_advice_draft', keywords: ['guaranteed to win', 'standard'] },
    ]);
    expect(r.findings.some((f) => f.category === 'overconfident')).toBe(true);
    expect(r.summary.block).toBeGreaterThanOrEqual(1);
  });

  it('WARNS on novel-theory language', () => {
    const r = new TooCleverDetector().detect([
      { artifactId: 'a1', artifactType: 'court_filing_draft', keywords: ['novel theory', 'jurisdictional argument'] },
    ]);
    expect(r.findings.some((f) => f.category === 'overaggressive')).toBe(true);
  });

  it('passes clean artifacts', () => {
    const r = new TooCleverDetector().detect([
      { artifactId: 'a1', artifactType: 'client_advice_draft', keywords: ['standard relief', 'enforcement'] },
    ]);
    expect(r.findings).toHaveLength(0);
  });
});
