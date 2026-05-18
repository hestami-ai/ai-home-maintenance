/**
 * `pnpm regression:rebaseline <fixture-id> --reason "<text>"`
 *
 * Renders + invokes Ollama for a single fixture, requires assertions
 * pass on the fresh response, then rewrites the fixture's baseline.
 * Audit-logged in `rebaseline-log.md`.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadFixtures } from '../loadFixtures.js';
import { renderFromFixture, invokeFromFixture, applyAssertions, formatFailureReport } from '../runner.js';
import { ensureOllamaReachable } from '../ollamaPrecheck.js';
import { FixtureSchema } from '../fixtureSchema.js';

const LOG_PATH = resolve(__dirname, '..', 'rebaseline-log.md');

function parseArgs(argv: string[]): { id?: string; reason?: string } {
  const out: { id?: string; reason?: string } = {};
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--reason') out.reason = argv[++i];
    else rest.push(a);
  }
  out.id = rest[0];
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.id || !args.reason) {
    console.error('Usage: pnpm regression:rebaseline <fixture-id> --reason "<text>"');
    process.exit(2);
  }
  await ensureOllamaReachable();

  const fixtures = loadFixtures();
  const loaded = fixtures.get(args.id);
  if (!loaded) {
    console.error(`Fixture not found: ${args.id}`);
    process.exit(2);
  }

  const r = renderFromFixture(loaded.fixture);
  if (!r.template_found) {
    console.error(`Template not found for ${loaded.fixture.template_ref.agent_role}/${loaded.fixture.template_ref.sub_phase}`);
    process.exit(1);
  }
  if (r.missingVariables.length > 0) {
    console.error(`Missing template variables: ${r.missingVariables.join(', ')}`);
    process.exit(1);
  }

  console.log(`Invoking Ollama for ${args.id}...`);
  const run = await invokeFromFixture(loaded.fixture, r.rendered);
  const result = applyAssertions(loaded.fixture, run.fresh_response_text, run.fresh_parsed_json);
  if (!result.passed) {
    console.error('Fresh response failed assertions; aborting rebaseline.');
    console.error(formatFailureReport(result));
    process.exit(1);
  }

  const now = new Date().toISOString();
  const updated = {
    ...loaded.fixture,
    last_rebaselined_at: now,
    baseline: {
      response_text: run.fresh_response_text,
      parsed_json: run.fresh_parsed_json,
      duration_ms: run.fresh_duration_ms,
      thinking: loaded.fixture.baseline.thinking,
    },
  };
  const validated = FixtureSchema.parse(updated);
  writeFileSync(loaded.path, JSON.stringify(validated, null, 2) + '\n', 'utf-8');

  let existing = '';
  try {
    existing = readFileSync(LOG_PATH, 'utf-8');
  } catch { /* ignore */ }
  if (!existing) {
    appendFileSync(LOG_PATH, '# Regression Rebaseline Log\n\n');
  }
  appendFileSync(LOG_PATH, `- ${now} — ${args.id} — ${args.reason}\n`);
  console.log(`Rebaselined ${args.id} (duration ${run.fresh_duration_ms} ms).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
