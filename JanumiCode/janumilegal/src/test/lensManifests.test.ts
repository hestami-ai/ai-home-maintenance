/**
 * Wave 6 gate: all MVP lens packs load and validate.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, ClvDal, ManifestDal } from '../lib/database/index.js';
import { DbBackedCLV, loadCLVv1 } from '../lib/clv/index.js';
import { AgentRegistry } from '../lib/registry/agentRegistry.js';
import { validateManifest } from '../lib/orchestrator/manifestValidator.js';
import { MVP_LENS_MANIFESTS } from '../layer2_lens_packs/index.js';
import { registerAllMvpAgents } from '../layer2_lens_packs/registrations.js';

describe('MVP lens manifests', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let clv: DbBackedCLV;
  let registry: AgentRegistry;
  let manifestDal: ManifestDal;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-lens-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    const clvDal = new ClvDal(db);
    loadCLVv1(clvDal);
    clv = new DbBackedCLV(clvDal);
    registry = new AgentRegistry();
    registerAllMvpAgents(registry);
    manifestDal = new ManifestDal(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('all 7 MVP lens manifests are present', () => {
    const ids = MVP_LENS_MANIFESTS.map((m) => m.lensId).sort();
    expect(ids).toEqual([
      'authority_verification_lens',
      'client_advice_draft_lens',
      'court_filing_draft_lens',
      'direct_legal_conclusion_lens',
      'family_law_production_lens',
      'legal_research_memo_lens',
      'redline_lens',
    ]);
  });

  it('every MVP lens manifest validates against CLV + agent registry', () => {
    for (const m of MVP_LENS_MANIFESTS) {
      const v = validateManifest(m, { clv, agentRegistry: registry });
      if (!v.ok) {
        throw new Error(`manifest ${m.lensId} failed validation:\n  ${v.errors.join('\n  ')}`);
      }
      expect(v.ok).toBe(true);
    }
  });

  it('every MVP lens manifest persists in the catalog', () => {
    for (const m of MVP_LENS_MANIFESTS) manifestDal.insert(m);
    for (const m of MVP_LENS_MANIFESTS) {
      const got = manifestDal.get(m.lensId, m.lensVersion);
      expect(got, `lens ${m.lensId} round-trip`).toBeDefined();
      expect(got!.lensId).toBe(m.lensId);
    }
  });
});
