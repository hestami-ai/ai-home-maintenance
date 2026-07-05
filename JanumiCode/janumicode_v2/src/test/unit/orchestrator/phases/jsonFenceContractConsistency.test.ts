/**
 * PA-12 — decomposition/saturation templates must NOT wrap their full-output
 * example in a ```json markdown fence while ALSO ordering "No markdown fences.
 * Response starts with {". The model pattern-matches the ```json wrapper and
 * emits fenced output (audit C4), which trips jsonOutputDisciplineCheck's
 * markdown_fence_wrapper at HIGH and can trigger json_repair latency.
 *
 * The fix strips the ```json opening + its closing ``` around the single
 * full-object example, replacing them with a raw-JSON lead-in; the legitimate
 * plain ``` shape-illustration blocks (enum menus, GOOD/BAD path examples) are
 * left untouched. This pins the invariant so the C4 contradiction can't recur.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');

const TEMPLATES: Array<{ rel: string; survive: string }> = [
  { rel: 'prompts/phases/phase_02_requirements/fr_saturation/functional_requirements_decomposition.product.system.md', survive: 'parent_branch_classification' },
  { rel: 'prompts/phases/phase_06_implementation_planning/implementation_task_decomposition.system.md', survive: '"tasks"' },
  { rel: 'prompts/phases/phase_02_requirements/nfr_saturation/nonfunctional_requirements_decomposition.product.system.md', survive: 'parent_branch_classification' },
  { rel: 'prompts/phases/phase_05_technical_specification/data_model_saturation/data_model_decomposition.system.md', survive: 'parent_branch_classification' },
  { rel: 'prompts/phases/phase_06_implementation_planning/task_saturation/task_decomposition.system.md', survive: 'parent_branch_classification' },
  { rel: 'prompts/phases/phase_07_test_planning/test_case_saturation/test_decomposition.system.md', survive: 'parent_branch_classification' },
];

describe('PA-12 — decomposition templates: no self-contradicting ```json fence', () => {
  for (const t of TEMPLATES) {
    const name = t.rel.split('/').slice(-1)[0];
    it(`${name}: strips the \`\`\`json fence, keeps a raw-JSON instruction + the example body`, () => {
      const body = fs.readFileSync(path.join(repoRoot, t.rel), 'utf-8');
      // (1) the self-contradicting output-example fence is gone.
      expect(body, 'the ```json full-output-example fence must be stripped').not.toContain('```json');
      // (2) the correct raw-JSON instruction survives (the stripped lead-in).
      expect(body).toContain('NO surrounding markdown code fences');
      // (3) the example body was not accidentally deleted with its fence.
      expect(body).toContain(t.survive);
    });
  }
});
