/**
 * Live regression tests — re-invokes Ollama against current template
 * + historical variables, then runs T1+T2+T3 against the fresh response.
 *
 * Filter by sub_phase via env var:
 *   JANUMICODE_REGRESSION_TEMPLATES=task_skeleton,fr_bloom_skeleton
 *
 * The `pnpm test:regression -- --templates X` CLI flag is wired by
 * mapping `--templates` to this env var (handled in package scripts).
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { loadFixtures, parseTemplateFilter } from './loadFixtures.js';
import {
  renderFromFixture,
  invokeFromFixture,
  applyAssertions,
  formatFailureReport,
} from './runner.js';
import { ensureOllamaReachable } from './ollamaPrecheck.js';

const filter = parseTemplateFilter(process.env.JANUMICODE_REGRESSION_TEMPLATES);
const fixtures = loadFixtures(filter);

describe('regression live layer', () => {
  beforeAll(async () => {
    await ensureOllamaReachable();
  });

  if (fixtures.size === 0) {
    it.skip('no fixtures found (set JANUMICODE_REGRESSION_TEMPLATES filter or extract fixtures first)', () => { /* noop */ });
    return;
  }

  for (const { fixture } of fixtures.values()) {
    it(`${fixture.fixture_id} — fresh response satisfies T1+T2+T3`, async () => {
      const r = renderFromFixture(fixture);
      expect(r.template_found, 'template lookup failed').toBe(true);
      expect(r.missingVariables, `missing variables: ${r.missingVariables.join(', ')}`).toEqual([]);

      const run = await invokeFromFixture(fixture, r.rendered);
      const result = applyAssertions(fixture, run.fresh_response_text, run.fresh_parsed_json);
      if (!result.passed) {
        throw new Error(
          `Fresh response failed regression assertions (${run.fresh_duration_ms} ms):\n${formatFailureReport(result)}\n\nfresh_text preview:\n${run.fresh_response_text.slice(0, 600)}`,
        );
      }
      expect(result.passed).toBe(true);
    });
  }
});
