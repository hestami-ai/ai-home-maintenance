/**
 * Deterministic regression tests — fast, no Ollama. Runs in the default
 * vitest config alongside unit tests.
 *
 * Anti-rot purpose: a template change that breaks a fixture's
 * required-variables contract fails here, immediately, with no LLM in
 * the loop.
 *
 * For each fixture:
 *   1. Zod validation (already happened in loadFixtures — guaranteed pass).
 *   2. Template lookup via TemplateLoader.findTemplate must succeed.
 *   3. Render with fixture variables must produce no missing variables.
 *   4. Applying the fixture's own assertions to its baseline.parsed_json
 *      must pass (sanity: the historical response satisfies its own
 *      assertions).
 */
import { describe, it, expect } from 'vitest';

import { loadFixtures, parseTemplateFilter } from './loadFixtures.js';
import { renderFromFixture, applyAssertions, formatFailureReport } from './runner.js';

const filter = parseTemplateFilter(process.env.JANUMICODE_REGRESSION_TEMPLATES);
const fixtures = loadFixtures(filter);

describe('regression deterministic layer', () => {
  if (fixtures.size === 0) {
    it.skip('no fixtures found (set JANUMICODE_REGRESSION_TEMPLATES filter or extract fixtures first)', () => { /* noop */ });
    return;
  }

  for (const { fixture, path } of fixtures.values()) {
    describe(fixture.fixture_id, () => {
      it('template resolves via TemplateLoader.findTemplate', () => {
        const r = renderFromFixture(fixture);
        expect(r.template_found, `template not found for ${fixture.template_ref.agent_role}/${fixture.template_ref.sub_phase} (fixture at ${path})`).toBe(true);
      });

      it('rendering with fixture variables has no missing variables', () => {
        const r = renderFromFixture(fixture);
        expect(r.missingVariables, `fixture is missing required variables: ${r.missingVariables.join(', ')}`).toEqual([]);
      });

      it('baseline response satisfies its own assertion block', () => {
        const result = applyAssertions(
          fixture,
          fixture.baseline.response_text,
          fixture.baseline.parsed_json,
        );
        if (!result.passed) {
          throw new Error(`Baseline does not satisfy assertions:\n${formatFailureReport(result)}`);
        }
        expect(result.passed).toBe(true);
      });
    });
  }
});
