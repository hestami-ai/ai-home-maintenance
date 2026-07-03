/**
 * PA-11 regression — FR/NFR saturation surfaced-assumption category consistency.
 *
 * The audit found the FR + NFR saturation templates defined the assumption
 * `category` enum twice with conflicting values: the "Surfacing assumptions"
 * definition used the real `AssumptionCategory` (domain_regime | constraint |
 * compliance | scope | open_question), while the "category discipline" reminder
 * had drifted to TASK categories (dropped domain_regime/compliance, invented
 * `implementation_choice`, which is a `TaskAssumptionCategory`, not an
 * `AssumptionCategory`). That contradiction confused the model. These tests pin
 * the templates to the single canonical requirement-assumption taxonomy.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// AssumptionCategory (src/lib/types/records.ts) — the ONLY valid FR/NFR
// surfaced-assumption categories. `implementation_choice` is TaskAssumptionCategory.
const CANONICAL = ['domain_regime', 'constraint', 'compliance', 'scope', 'open_question'];
const TASK_ONLY = 'implementation_choice';

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');
const templates = [
  'prompts/phases/phase_02_requirements/fr_saturation/functional_requirements_decomposition.product.system.md',
  'prompts/phases/phase_02_requirements/nfr_saturation/nonfunctional_requirements_decomposition.product.system.md',
];

describe('PA-11 — FR/NFR saturation assumption-category consistency', () => {
  for (const rel of templates) {
    it(`${rel.split('/').slice(-2, -1)[0]} teaches only AssumptionCategory values`, () => {
      const body = fs.readFileSync(path.join(repoRoot, rel), 'utf-8');
      // No task-only category leaks into the requirement templates.
      expect(body).not.toContain(TASK_ONLY);
      // The categories the drifted section had dropped are present again.
      for (const c of CANONICAL) expect(body, `missing category '${c}'`).toContain(c);
    });
  }
});
