/**
 * PA-9 regression — id-namespace unification between the saturation/skeleton
 * templates and the ids the orchestrator actually mints + injects.
 *
 * The discovery phase mints slug ids `TECH-<UPPER-SLUG>` (a running-number
 * `-2`/`-3` suffix ONLY on collision) and `formatTechnicalConstraints` injects
 * the REAL id (e.g. `TECH-BUN`) into the SAME prompt. Several saturation
 * templates taught a `-1`-suffixed example FORM (`TECH-BUN-1`) that the model
 * then copied into `active_constraints`/citations/`traces_to` → join-keys that
 * miss the registry. Likewise the data-model template taught `ent-*` entity ids
 * while entities are minted `DM-<comp>-<name>` (dataModelIdMinter) and the
 * injected ancestor/depth-0 blocks render the real `DM-*` ids.
 *
 * This pins the LLM-facing EXAMPLE to the minted/injected canonical id — the
 * "fix the prompt not the matcher" pattern. NO runtime bridge: `-2`/`-3` are
 * legitimate distinct collision-disambiguated ids, so a suffix-stripping
 * resolver would be semantically wrong; the orchestrator already owns the
 * canonical axis (minter + injected menu), so only the example must align.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mintEntityId } from '../../../../lib/orchestrator/phases/phase5/dataModelIdMinter';

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');

// The five saturation/skeleton templates that hardcoded `-1`-suffixed TECH
// example ids, each paired with the canonical TECH slugs it is expected to
// teach after the fix (drop the `-1`; keep whatever techs that template cites).
const TECH_TEMPLATES: { rel: string; expectCanonical: string[] }[] = [
  {
    rel: 'prompts/phases/phase_06_implementation_planning/task_saturation/task_decomposition.system.md',
    expectCanonical: ['TECH-BUN', 'TECH-POSTGRES', 'TECH-DBOS', 'TECH-SVELTEKIT'],
  },
  {
    rel: 'prompts/phases/phase_04_architecture/component_saturation/component_decomposition.product.system.md',
    expectCanonical: ['TECH-BUN', 'TECH-POSTGRES', 'TECH-DBOS', 'TECH-SVELTEKIT'],
  },
  {
    rel: 'prompts/phases/phase_05_technical_specification/data_model_saturation/data_model_decomposition.system.md',
    expectCanonical: ['TECH-POSTGRES'],
  },
  {
    rel: 'prompts/phases/phase_07_test_planning/test_case_saturation/test_decomposition.system.md',
    expectCanonical: ['TECH-BUN', 'TECH-POSTGRES'],
  },
  {
    rel: 'prompts/phases/phase_06_implementation_planning/implementation_task_decomposition.system.md',
    expectCanonical: ['TECH-POSTGRES', 'TECH-BETTER-AUTH'],
  },
];

// The `-1`-suffixed collision-form ids that must NOT appear (the minter uses a
// slug, never a running `-1`).
const FORBIDDEN_TECH = ['TECH-BUN-1', 'TECH-POSTGRES-1', 'TECH-DBOS-1', 'TECH-SVELTEKIT-1'];

const DATA_MODEL_REL =
  'prompts/phases/phase_05_technical_specification/data_model_saturation/data_model_decomposition.system.md';

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf-8');
}

/** Every distinct `TECH-…` token in the body (regex used for extraction only). */
function techTokens(body: string): string[] {
  return Array.from(new Set(body.match(/TECH-[A-Z0-9_-]+/g) ?? []));
}

describe('PA-9 — TECH id namespace: example ids match the minted slug form', () => {
  for (const { rel, expectCanonical } of TECH_TEMPLATES) {
    const name = rel.split('/').slice(-1)[0];
    it(`${name} teaches canonical TECH slugs, no -1 collision form`, () => {
      const body = read(rel);
      const tokens = techTokens(body);

      // (1) No `-1`-suffixed collision form of the well-known techs anywhere.
      for (const forbidden of FORBIDDEN_TECH) {
        expect(tokens, `forbidden ${forbidden} present in ${name}`).not.toContain(forbidden);
      }

      // (1) The canonical slugs this template cites are present as EXACT tokens.
      //     (A substring check would pass on the old `TECH-POSTGRES-1` too, so
      //     exact-token membership is what makes this fail pre-fix.)
      for (const canonical of expectCanonical) {
        expect(tokens, `missing canonical ${canonical} in ${name}`).toContain(canonical);
      }

      // (2) Structural (regex-free intent): reuse the discovery slug shape
      //     `^TECH-[A-Z0-9_-]+$`, and assert no TECH placeholder ends in a bare
      //     `-1` running-number. Version slugs like `TECH-POSTGRES-16` are fine —
      //     they do not end in `-1`; only the collision-running-number `-1` is banned.
      for (const tok of tokens) {
        expect(/^TECH-[A-Z0-9_-]+$/.test(tok), `bad TECH shape: ${tok}`).toBe(true);
        expect(/-1$/.test(tok), `TECH token ends in -1 collision form: ${tok}`).toBe(false);
      }
    });
  }
});

describe('PA-9 — data-model entity ids use the minted DM- form, not ent-', () => {
  it('data_model_decomposition teaches DM- entity ids (no ent- placeholders)', () => {
    const body = read(DATA_MODEL_REL);
    // (3) No `ent-*` entity id or relationship-target placeholders survive.
    expect(body).not.toContain('"id": "ent-');
    expect(body).not.toContain('"target_entity_id": "ent-');
    // (3) Entity id + relationship-target examples start with the minted DM- prefix.
    expect(body).toContain('"id": "DM-');
    expect(body).toContain('"target_entity_id": "DM-');
  });

  it('example DM- prefix is pinned to the minter (single-source guard)', () => {
    // (4) The example prefix is anchored to the actual minter, so if the minter
    //     ever changes prefix this fails and the template example is updated in
    //     lockstep rather than silently drifting apart again.
    expect(mintEntityId('comp-x', 'Y').startsWith('DM-')).toBe(true);
  });
});
