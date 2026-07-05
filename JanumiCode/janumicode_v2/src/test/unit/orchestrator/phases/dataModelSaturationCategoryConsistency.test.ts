/**
 * PA-11 (data_model) regression — the data_model_saturation "category discipline"
 * reminder had drifted to FR/NFR categories (`constraint`, `scope`), which are NOT
 * members of its own defined enum. The data-model surfaced-assumption enum is
 * `identity | ownership | cardinality | lifecycle | consistency | storage_choice |
 * open_question` (template "Surfacing assumptions" section). This pins the
 * discipline section to that taxonomy so the model isn't told to emit a category
 * its own schema doesn't define.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');
const rel =
  'prompts/phases/phase_05_technical_specification/data_model_saturation/data_model_decomposition.system.md';

// The data-model surfaced-assumption enum (template line ~89).
const DM_ENUM = ['identity', 'ownership', 'cardinality', 'lifecycle', 'consistency', 'storage_choice', 'open_question'];
// Category tokens from OTHER taxonomies that must not appear as data-model category values.
const FOREIGN = ['constraint', 'scope', 'domain_regime', 'compliance', 'implementation_choice', 'sequencing'];

describe('PA-11 — data_model_saturation category discipline matches its own enum', () => {
  const body = fs.readFileSync(path.join(repoRoot, rel), 'utf-8');

  it('exposes the "category discipline" section', () => {
    expect(body).toContain('Surfaced-assumption novelty + category discipline');
  });

  it('the discipline section references ONLY data-model enum categories (no FR/NFR drift)', () => {
    const start = body.indexOf('Surfaced-assumption novelty + category discipline');
    const rest = body.slice(start + 20);
    // Bound the section to the next bold subsection header.
    const endIdx = rest.indexOf('\n**');
    const section = endIdx > -1 ? rest.slice(0, endIdx) : rest.slice(0, 1200);

    for (const f of FOREIGN) {
      expect(section, `foreign category token \`${f}\` leaked into the data-model discipline section`)
        .not.toContain(`\`${f}\``);
    }
    // The data-model taxonomy is taught in the discipline section.
    for (const c of DM_ENUM) {
      expect(section, `data-model category '${c}' missing from discipline section`).toContain(c);
    }
  });
});

/**
 * PA-11 (data_model branch literal) — the data_model_saturation parent-branch
 * enum is `atomic_value | decomposable | invalid_parent` (contractSchemaValidator
 * S(data_model) + parentBranchClassificationCheck). The template's Step-1 branch
 * uses `atomic_value`, but the fanout-discipline section had drifted to the
 * FR/NFR/component literal `atomic_leaf` — a self-contradiction the model
 * classifies against. This pins the whole template to its own `atomic_value`.
 */
describe('PA-11 — data_model_saturation branch literal is atomic_value (not atomic_leaf)', () => {
  const body = fs.readFileSync(path.join(repoRoot, rel), 'utf-8');

  it('uses the canonical `atomic_value` and never the foreign `atomic_leaf`', () => {
    expect(body).toContain('atomic_value');
    expect(body, 'data_model template must not use the FR/NFR/component literal `atomic_leaf`')
      .not.toContain('atomic_leaf');
  });
});
