/**
 * AODD trace-completeness regression test.
 *
 * Per design memo §9: discovers fixtures under
 * `src/test/regression/aodd-fixtures/<scenario>/`, loads each manifest,
 * and runs the completeness assertions:
 *
 *   1. Each expected sub-phase summary exists and validates against the
 *      5W+H schema.
 *   2. Every `parent_event_id` / `caused_by_event_id` chain terminates
 *      in a real event (no dangling pointers).
 *   3. Forbidden event types are not present.
 *   4. Spot checks (equals / matches / not_null over dotted paths) pass.
 *
 * The principle "trace completeness is a regression test" becomes
 * literal here: a refactor that breaks reconstructability fails the
 * test even if product outputs are unchanged.
 *
 * Adding new fixtures: see `src/test/regression/aodd-fixtures/README.md`.
 */

import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  discoverFixtures,
  loadManifest,
  runFixture,
} from '../../lib/aodd';

const FIXTURES_DIR = path.resolve(__dirname, 'aodd-fixtures');

const fixtures = discoverFixtures(FIXTURES_DIR);

describe('AODD trace-completeness regression', () => {
  it('discovers at least one fixture', () => {
    // Guard: if the fixture directory accidentally becomes empty, the
    // regression test would silently pass with zero coverage. Fail
    // loudly instead so the engineer notices.
    expect(fixtures.length).toBeGreaterThan(0);
  });

  if (fixtures.length === 0) return;

  describe.each(fixtures.map((f) => [f.scenario, f]))(
    'fixture: %s',
    (_scenario, fixture) => {
      it('passes manifest assertions', () => {
        const manifest = loadManifest(fixture.manifestPath);
        // Note: fixture.fixtureRoot is the `<scenario>/` directory which
        // contains a `.janumicode/runs/<scenario>/aodd/` subtree. The
        // completeness runner expects `workspaceRoot` to be the parent
        // of `.janumicode/`, i.e. the scenario directory itself.
        const result = runFixture(fixture.fixtureRoot, manifest);
        if (!result.passed) {
          const detail = result.failures.map((f) => `  - ${f}`).join('\n');
          expect.fail(
            `fixture ${result.scenario} failed completeness assertions:\n${detail}`,
          );
        }
      });
    },
  );
});
