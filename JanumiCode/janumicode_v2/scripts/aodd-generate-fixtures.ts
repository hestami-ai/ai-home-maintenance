/**
 * Generate AODD regression-test fixtures by running a known set of
 * synthetic events through the real emit() API, then copying the
 * captured trace into `src/test/regression/aodd-fixtures/<scenario>/`.
 *
 * Run with: `pnpm tsx scripts/aodd-generate-fixtures.ts`
 *
 * One-off — the produced fixture directories should be committed.
 * Re-running overwrites existing fixtures (it deletes the scenario
 * directory first).
 *
 * Scenarios:
 *   - happy-path: phase 1, single sub-phase, full LLM bracket, success
 *   - llm-failed: phase 1, sub-phase that exercises llm.failed +
 *                  decision.escalated
 *
 * The manifests are hand-written here (not stubbed by `aodd capture`)
 * so the spot_checks match what we actually emit.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  closeStreams,
  emit as aoddEmit,
  endRun,
  initialize,
  startRun,
} from '../src/lib/aodd';
import { withTraceContext } from '../src/lib/trace/traceContext';

const FIXTURES_ROOT = path.resolve(
  __dirname,
  '..',
  'src',
  'test',
  'regression',
  'aodd-fixtures',
);

// ── Fixture copy helpers (mirror scripts/aodd.js cmdCapture) ────────

function copyDirRecursive(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const sp = path.join(src, entry);
    const dp = path.join(dst, entry);
    if (fs.statSync(sp).isDirectory()) {
      copyDirRecursive(sp, dp);
    } else {
      fs.copyFileSync(sp, dp);
    }
  }
}

function rewriteRunIdInEvents(eventsPath: string, fromId: string, toId: string): void {
  if (!fs.existsSync(eventsPath)) return;
  const raw = fs.readFileSync(eventsPath, 'utf8');
  const out: string[] = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    try {
      const e = JSON.parse(line);
      if (e.run_id === fromId) e.run_id = toId;
      out.push(JSON.stringify(e));
    } catch {
      out.push(line);
    }
  }
  fs.writeFileSync(eventsPath, out.join('\n') + '\n', { encoding: 'utf8' });
}

function rewriteRunIdInJson(jsonPath: string, fromId: string, toId: string): void {
  if (!fs.existsSync(jsonPath)) return;
  try {
    const obj = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (obj?.run_id === fromId) obj.run_id = toId;
    fs.writeFileSync(jsonPath, JSON.stringify(obj, null, 2), { encoding: 'utf8' });
  } catch {
    // skip
  }
}

function copyTraceToFixture(
  workspaceRoot: string,
  runId: string,
  scenario: string,
): string {
  const srcAodd = path.join(workspaceRoot, '.janumicode', 'runs', runId, 'aodd');
  const fixtureDir = path.join(FIXTURES_ROOT, scenario);
  if (fs.existsSync(fixtureDir)) {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
  const fixtureRunDir = path.join(
    fixtureDir,
    '.janumicode',
    'runs',
    scenario,
    'aodd',
  );
  copyDirRecursive(srcAodd, fixtureRunDir);
  rewriteRunIdInEvents(
    path.join(fixtureRunDir, 'events.ndjson'),
    runId,
    scenario,
  );
  rewriteRunIdInJson(path.join(fixtureRunDir, 'index.json'), runId, scenario);
  const summariesDir = path.join(fixtureRunDir, 'summaries');
  if (fs.existsSync(summariesDir)) {
    const walk = (d: string): void => {
      for (const e of fs.readdirSync(d)) {
        const p = path.join(d, e);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.json')) rewriteRunIdInJson(p, runId, scenario);
      }
    };
    walk(summariesDir);
  }
  return fixtureDir;
}

// ── Scenario: happy-path ────────────────────────────────────────────

async function generateHappyPath(): Promise<void> {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-fix-hp-'));
  try {
    initialize({
      workspaceRoot,
      janumicodeVersionSha: 'fixture-gen',
      enabled: true,
    });
    startRun('happy-run');
    aoddEmit('run.started', { intent_brief: 'fixture: happy path' });

    await withTraceContext(
      { workflow_run_id: 'happy-run', phase_id: '1', sub_phase_id: null },
      async () => {
        aoddEmit('phase.entered', { phase_name: 'Intent Capture and Convergence' });
      },
    );

    await withTraceContext(
      { workflow_run_id: 'happy-run', phase_id: '1', sub_phase_id: 'entities_bloom' },
      async () => {
        aoddEmit('prompt.template_rendered', {
          template_key: 'phase01/entities_bloom',
          template_source_sha: 'unknown',
        });
        const matId = aoddEmit(
          'prompt.materialized',
          {
            invocation_id: 'inv-happy-1',
            final_prompt: 'You are a helpful requirements agent. Identify entities.',
          },
          { invocation_id: 'inv-happy-1' },
        );
        aoddEmit(
          'llm.invoked',
          {
            provider: 'anthropic',
            model: 'claude-sonnet-4-6',
            temperature: 0,
            prompt: 'You are a helpful requirements agent. Identify entities.',
          },
          {
            invocation_id: 'inv-happy-1',
            agent_role: 'requirements_agent',
            parent_event_id: matId ?? undefined,
          },
        );
        aoddEmit(
          'llm.returned',
          {
            text: '{"entities":[{"id":"user"}]}',
            thinking: null,
            input_tokens: 120,
            output_tokens: 25,
            duration_ms: 850,
            retry_attempts: 0,
          },
          {
            invocation_id: 'inv-happy-1',
            agent_role: 'requirements_agent',
            parent_event_id: matId ?? undefined,
          },
        );
        aoddEmit('validator.run', {
          validator_name: 'entity_completeness',
          target_record_id: 'rec-bloom-1',
          duration_ms: 8,
        });
      },
    );

    await withTraceContext(
      { workflow_run_id: 'happy-run', phase_id: '1', sub_phase_id: null },
      async () => {
        aoddEmit('phase.exited', {
          phase_name: 'Intent Capture and Convergence',
          status: 'success',
          duration_ms: 900,
          artifact_count: 1,
        });
      },
    );

    endRun({ status: 'success' });
    closeStreams();

    const fixtureDir = copyTraceToFixture(workspaceRoot, 'happy-run', 'happy-path');

    // Hand-crafted manifest: spot_checks reference values we know are
    // stable across captures (model name, status, template_key).
    const manifest = {
      scenario: 'happy-path',
      description:
        'Single phase 1 sub-phase (entities_bloom) with a full LLM bracket ' +
        '(template_rendered → materialized → invoked → returned) and a ' +
        'validator.run event. Completes successfully.',
      schema_version: 1,
      expected_sub_phases: [
        {
          phase_id: '1',
          sub_phase_id: 'entities_bloom',
          expected_status: 'success',
          must_answer_5wh: true,
          spot_checks: [
            { path: 'who.agent_role', equals: 'requirements_agent' },
            { path: 'who.model', equals: 'claude-sonnet-4-6' },
            { path: 'why.template_key', equals: 'phase01/entities_bloom' },
            { path: 'how.status', equals: 'success' },
            { path: 'how.retries', equals: 0 },
            { path: 'how.error', equals: null },
            { path: 'events.first_event_id', not_null: true },
            { path: 'events.last_event_id', not_null: true },
          ],
        },
      ],
    };
    fs.writeFileSync(
      path.join(fixtureDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
      { encoding: 'utf8' },
    );
    process.stdout.write(`✓ generated happy-path fixture at ${fixtureDir}\n`);
  } finally {
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

// ── Scenario: llm-failed ────────────────────────────────────────────

async function generateLlmFailed(): Promise<void> {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-fix-fail-'));
  try {
    initialize({
      workspaceRoot,
      janumicodeVersionSha: 'fixture-gen',
      enabled: true,
    });
    startRun('failed-run');
    aoddEmit('run.started', { intent_brief: 'fixture: llm failure path' });

    await withTraceContext(
      { workflow_run_id: 'failed-run', phase_id: '1', sub_phase_id: 'check' },
      async () => {
        aoddEmit('prompt.template_rendered', {
          template_key: 'phase01/check',
          template_source_sha: 'unknown',
        });
        aoddEmit(
          'prompt.materialized',
          {
            invocation_id: 'inv-fail-1',
            final_prompt: 'short prompt',
          },
          { invocation_id: 'inv-fail-1' },
        );
        aoddEmit(
          'llm.invoked',
          {
            provider: 'anthropic',
            model: 'claude-sonnet-4-6',
            prompt: 'short prompt',
          },
          { invocation_id: 'inv-fail-1', agent_role: 'requirements_agent' },
        );
        aoddEmit(
          'llm.failed',
          {
            error: { message: 'rate limited', code: 'rate_limit_error' },
            duration_ms: 1500,
            retry_attempts: 3,
          },
          { invocation_id: 'inv-fail-1' },
        );
      },
    );

    endRun({ status: 'failed', error: { message: 'phase 1 LLM exhausted retries' } });
    closeStreams();

    const fixtureDir = copyTraceToFixture(workspaceRoot, 'failed-run', 'llm-failed');

    const manifest = {
      scenario: 'llm-failed',
      description:
        'Single sub-phase that hits an LLM rate-limit and exhausts retries. ' +
        'Run ends in failure (run.failed emitted, status=failed).',
      schema_version: 1,
      expected_sub_phases: [
        {
          phase_id: '1',
          sub_phase_id: 'check',
          expected_status: 'failed',
          must_answer_5wh: true,
          spot_checks: [
            { path: 'who.model', equals: 'claude-sonnet-4-6' },
            { path: 'how.status', equals: 'failed' },
            { path: 'how.retries', equals: 3 },
            { path: 'how.error.message', matches: 'rate limited' },
          ],
        },
      ],
    };
    fs.writeFileSync(
      path.join(fixtureDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
      { encoding: 'utf8' },
    );
    process.stdout.write(`✓ generated llm-failed fixture at ${fixtureDir}\n`);
  } finally {
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

// ── main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  fs.mkdirSync(FIXTURES_ROOT, { recursive: true });
  await generateHappyPath();
  await generateLlmFailed();
  process.stdout.write('\nDone. Commit the generated fixture directories.\n');
}

main().catch((err) => {
  process.stderr.write(
    `fixture generation failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
