/**
 * Bake-off: replay 6 problem invocations from thin-slice-12 against
 * candidate models, comparing parse rate, schema conformance, and
 * content fidelity to the live qwen3.5:9b baseline.
 *
 * No JSON repair. maxRetries=1 (the LLMCaller default in runner.ts).
 * No sampling-parameter overrides — models use their Ollama defaults.
 *
 * Run: npx tsx scripts/bakeoff-thin-slice-12.ts
 *
 * Writes:
 *   test-and-evaluation/bakeoff-results/thin-slice-12-<timestamp>/
 *     raw/<invocation-slug>__<model-slug>.json
 *     bakeoff-report.md
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';

import { LLMCaller } from '../src/lib/llm/llmCaller';
import { OllamaProvider } from '../src/lib/llm/providers/ollama';
import { FixtureSchema, type Fixture } from '../src/test/regression/fixtureSchema';
import { checkT1Schema } from '../src/test/regression/assertions/t1Schema';
import { checkT2IdPreservation } from '../src/test/regression/assertions/t2IdPreservation';
import { checkT3Invariant } from '../src/test/regression/assertions/t3Invariants';
import {
  emit as aoddEmit,
  endRun as aoddEndRun,
  initialize as initializeAodd,
  startRun as aoddStartRun,
} from '../src/lib/aodd';
import { withTraceContext } from '../src/lib/trace/traceContext';

const REPO = resolve(__dirname, '..');
const TS12_DB = join(
  REPO,
  'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-12/.janumicode/test-harness/resume-1778807876090.db',
);
const FIXTURE_DIR = join(REPO, 'src/test/regression/fixtures');
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';

// Tagged invocations from the quality-check report.
interface BakeTarget {
  slug: string;            // human label used in filenames + report
  sub_phase_id: string;
  invocation_id: string;   // exact thin-slice-12 invocation
  fixture_id?: string;     // matching regression fixture for T1/T2/T3 (omit if none)
  note: string;            // why we picked this invocation
}

const TARGETS: BakeTarget[] = [
  {
    slug: 'entities_bloom_FAILED',
    sub_phase_id: 'entities_bloom',
    invocation_id: 'c8d0702f-5c40-406f-b899-c22f4954ebaa',
    fixture_id: 'phase01_entities_bloom__tinyurl-001',
    note: 'qwen3.5:9b hung 368s, 3 retries — runaway thinking',
  },
  {
    slug: 'coverage_verifier_FAILED',
    sub_phase_id: 'coverage_verifier',
    invocation_id: 'bfcc044d-9bf0-4bba-a38c-01a3786d4f3f',
    // No fixture — template is constructed in TS, not a .system.md file.
    note: 'qwen3.5:9b hung 368s, 3 retries — runaway thinking',
  },
  {
    slug: 'nfr_bloom_skeleton',
    sub_phase_id: 'nfr_bloom_skeleton',
    // Phase 2.2 — NFR Skeleton Bloom (Pass 1 of 3). 69,798-char prompt.
    // The previously-selected `6eddc511` was a DMR Stage 7 call running
    // *inside* the NFR sub-phase, not the NFR producer itself.
    invocation_id: 'a4b798f5-95d5-45d9-bab2-b8e83e7ae10b',
    fixture_id: 'phase02_nfr_bloom_skeleton__tinyurl-001',
    note: 'Emitted Pass-2 shape (threshold/measurement_method) instead of seed_threshold; ~70KB prompt exceeds granite\'s 11K-token ceiling on RTX 4090',
  },
  {
    slug: 'system_workflow_bloom',
    sub_phase_id: 'system_workflow_bloom',
    invocation_id: '754df327-b562-47f8-8c2a-7db07c1cd64d',
    fixture_id: 'phase01_system_workflow_bloom__tinyurl-001',
    note: 'Emitted 20 workflows with hallucinated domain IDs — all dropped by self-heal',
  },
  {
    slug: 'user_journey_bloom',
    sub_phase_id: 'user_journey_bloom',
    invocation_id: '80409f5b-3ecd-409f-8554-3e044a621fb2',
    fixture_id: 'phase01_user_journey_bloom__tinyurl-001',
    note: 'Emitted dual snake_case + camelCase keys on every journey object',
  },
  {
    slug: 'integrations_qa_bloom',
    sub_phase_id: 'integrations_qa_bloom',
    invocation_id: '7b344537-9abc-4e7a-8147-f899587f8761',
    fixture_id: 'phase01_integrations_qa_bloom__tinyurl-001',
    note: 'One INT- ID with mixed case (INT-Legal-Takedown) despite prompt strengthening',
  },
];

const CANDIDATE_MODELS = [
  // 'granite4.1:30b-q4_K_M',
  // 'gpt-oss:20b',
  'ServiceNow-AI/Apriel-1.6-15b-Thinker:Q4_K_M',
] as const;

// Filter to just the two prompts that timed out at the old 180s default.
const ONLY_TARGETS = new Set(['system_workflow_bloom', 'user_journey_bloom']);

interface ReplayInput {
  system: string;
  prompt: string;
  responseFormat: 'json' | 'text';
}

function loadReplayInput(db: Database.Database, target: BakeTarget): ReplayInput {
  const row = db
    .prepare(
      `SELECT content FROM governed_stream
       WHERE record_type='agent_invocation' AND id = ?`,
    )
    .get(target.invocation_id) as { content: string } | undefined;
  if (!row) throw new Error(`Invocation not found: ${target.invocation_id}`);
  const c = JSON.parse(row.content) as {
    system?: string;
    prompt?: string;
    response_format?: 'json' | 'text';
  };
  return {
    system: c.system ?? '',
    prompt: c.prompt ?? '',
    responseFormat: (c.response_format as 'json' | 'text') ?? 'json',
  };
}

interface BaselineSummary {
  invocation_id: string;
  status: 'success' | 'error';
  error_type?: string;
  duration_ms: number;
  output_chars: number;
  thinking_chars: number;
  retry_attempts: number;
  parse_ok: boolean;
}

function loadBaseline(db: Database.Database, invocationId: string): BaselineSummary {
  const row = db
    .prepare(
      `SELECT content FROM governed_stream
       WHERE record_type='agent_output' AND derived_from_record_ids LIKE ?
       LIMIT 1`,
    )
    .get(`%${invocationId}%`) as { content: string } | undefined;
  if (!row) {
    return {
      invocation_id: invocationId,
      status: 'error',
      duration_ms: 0,
      output_chars: 0,
      thinking_chars: 0,
      retry_attempts: 0,
      parse_ok: false,
    };
  }
  const c = JSON.parse(row.content) as {
    status?: string;
    error_type?: string;
    duration_ms?: number;
    text?: string;
    thinking?: string;
    retry_attempts?: number;
  };
  let parseOk = false;
  try { JSON.parse(c.text ?? ''); parseOk = true; } catch { /* not JSON */ }
  return {
    invocation_id: invocationId,
    status: (c.status as 'success' | 'error') ?? 'error',
    error_type: c.error_type,
    duration_ms: c.duration_ms ?? 0,
    output_chars: (c.text ?? '').length,
    thinking_chars: (c.thinking ?? '').length,
    retry_attempts: c.retry_attempts ?? 0,
    parse_ok: parseOk,
  };
}

interface ReplayResult {
  model: string;
  status: 'success' | 'error';
  error_type?: string;
  error_message?: string;
  duration_ms: number;
  output_chars: number;
  thinking_chars: number;
  retry_attempts: number;
  raw_text: string;
  thinking: string;
  parse_ok: boolean;
  t1_passed?: boolean;
  t1_fails?: string[];
  t2_passed?: boolean;
  t2_fails?: string[];
  t3_passed?: boolean;
  t3_fails?: string[];
}

async function runReplay(
  caller: LLMCaller,
  model: string,
  input: ReplayInput,
): Promise<ReplayResult> {
  const started = Date.now();
  try {
    const r = await caller.call({
      provider: 'ollama',
      model,
      system: input.system.length > 0 ? input.system : undefined,
      prompt: input.prompt,
      responseFormat: input.responseFormat,
      // No temperature / no maxTokens — Ollama defaults from the modelfile.
    });
    let parseOk = false;
    let parsed: unknown = null;
    if (input.responseFormat === 'json') {
      try { parsed = JSON.parse(r.text); parseOk = true; } catch { /* parse fail */ }
    }
    return {
      model,
      status: 'success',
      duration_ms: Date.now() - started,
      output_chars: r.text.length,
      thinking_chars: (r.thinking ?? '').length,
      retry_attempts: r.retryAttempts,
      raw_text: r.text,
      thinking: r.thinking ?? '',
      parse_ok: parseOk,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      model,
      status: 'error',
      error_message: msg,
      duration_ms: Date.now() - started,
      output_chars: 0,
      thinking_chars: 0,
      retry_attempts: 1,
      raw_text: '',
      thinking: '',
      parse_ok: false,
    };
  }
}

function applyAssertions(fixture: Fixture, parsed: unknown): {
  t1_passed: boolean; t1_fails: string[];
  t2_passed: boolean; t2_fails: string[];
  t3_passed: boolean; t3_fails: string[];
} {
  const reqJson = fixture.assertions.require_json_parse
    ?? fixture.invocation_params.response_format === 'json';

  const t1Fails: string[] = [];
  let t1Passed = true;
  if (fixture.assertions.t1_schema) {
    const checks = checkT1Schema(fixture.assertions.t1_schema, parsed, '', reqJson);
    for (const c of checks) {
      if (!c.passed) { t1Passed = false; t1Fails.push(`${c.name}: ${c.detail}`); }
    }
  }

  const t2Fails: string[] = [];
  let t2Passed = true;
  for (const a of fixture.assertions.t2_id_preservation) {
    const c = checkT2IdPreservation(a, fixture, parsed);
    if (!c.passed) { t2Passed = false; t2Fails.push(`${c.name}: ${c.detail}`); }
  }

  const t3Fails: string[] = [];
  let t3Passed = true;
  for (const a of fixture.assertions.t3_invariants) {
    const c = checkT3Invariant(a, parsed);
    if (!c.passed) { t3Passed = false; t3Fails.push(`${c.name}: ${c.detail}`); }
  }

  return { t1_passed: t1Passed, t1_fails: t1Fails, t2_passed: t2Passed, t2_fails: t2Fails, t3_passed: t3Passed, t3_fails: t3Fails };
}

function loadFixture(fixtureId: string): Fixture | null {
  const path = join(FIXTURE_DIR, `${fixtureId}.fixture.json`);
  if (!existsSync(path)) return null;
  const parsed = FixtureSchema.parse(JSON.parse(readFileSync(path, 'utf-8')));
  return parsed;
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function fmtChars(n: number): string {
  if (n < 1000) return `${n}`;
  return `${(n / 1000).toFixed(1)}K`;
}

function row(model: string, parseOk: string, t1: string, t2: string, t3: string,
             duration: string, output: string, thinking: string, notes: string): string {
  return `| ${model} | ${parseOk} | ${t1} | ${t2} | ${t3} | ${duration} | ${output} | ${thinking} | ${notes} |`;
}

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = join(REPO, 'test-and-evaluation/bakeoff-results', `thin-slice-12-${stamp}`);
  mkdirSync(join(outDir, 'raw'), { recursive: true });
  console.log(`[bakeoff] output dir: ${outDir}`);

  // Adopt this bakeoff invocation as an AODD-traced "run" (design memo
  // §10). The bakeoff's workspace is its outDir so the trace lands
  // alongside the bakeoff artifacts under
  //   <outDir>/.janumicode/runs/<runId>/aodd/
  const bakeoffRunId = `bakeoff-${stamp}`;
  initializeAodd({
    workspaceRoot: outDir,
    janumicodeVersionSha: 'bakeoff',
    enabled: true,
  });
  aoddStartRun(bakeoffRunId);
  aoddEmit('run.started', {
    intent_brief: `bakeoff thin-slice-12 (models: ${CANDIDATE_MODELS.join(', ')})`,
  });

  const db = new Database(TS12_DB, { readonly: true });
  const caller = new LLMCaller({ maxRetries: 1 });
  caller.registerProvider(new OllamaProvider(OLLAMA_URL));

  const reportLines: string[] = [];
  reportLines.push(`# Bake-off Report — thin-slice-12 problem prompts\n`);
  reportLines.push(`Generated: ${new Date().toISOString()}`);
  reportLines.push(`Baseline source: ${TS12_DB}`);
  reportLines.push(`Models tested: ${CANDIDATE_MODELS.join(', ')}`);
  reportLines.push(`Configuration: no sampling overrides, maxRetries=1, JSON repair OFF, response_format from invocation\n`);
  reportLines.push(`## Per-prompt results\n`);

  // Track totals
  const tally: Record<string, { parse_ok: number; t1: number; t2: number; t3: number; total: number; durations: number[]; }> = {};
  for (const m of CANDIDATE_MODELS) tally[m] = { parse_ok: 0, t1: 0, t2: 0, t3: 0, total: 0, durations: [] };
  tally['qwen3.5:9b (baseline)'] = { parse_ok: 0, t1: 0, t2: 0, t3: 0, total: 0, durations: [] };

  for (const target of TARGETS) {
    if (ONLY_TARGETS.size > 0 && !ONLY_TARGETS.has(target.sub_phase_id)) continue;
    console.log(`\n[bakeoff] === ${target.slug} ===`);
    reportLines.push(`### ${target.slug}`);
    reportLines.push(`- **sub_phase**: \`${target.sub_phase_id}\``);
    reportLines.push(`- **invocation_id**: \`${target.invocation_id}\``);
    reportLines.push(`- **fixture**: ${target.fixture_id ? `\`${target.fixture_id}\`` : 'none (TS-built template)'}`);
    reportLines.push(`- **observed issue**: ${target.note}\n`);

    const input = loadReplayInput(db, target);
    const fixture = target.fixture_id ? loadFixture(target.fixture_id) : null;
    const baseline = loadBaseline(db, target.invocation_id);

    // Apply assertions to baseline output (qwen3.5:9b)
    let baselineAssert: ReturnType<typeof applyAssertions> | null = null;
    if (fixture && baseline.status === 'success') {
      const row = db.prepare(
        `SELECT content FROM governed_stream WHERE record_type='agent_output' AND derived_from_record_ids LIKE ? LIMIT 1`,
      ).get(`%${target.invocation_id}%`) as { content: string } | undefined;
      const text = row ? (JSON.parse(row.content).text as string) : '';
      let parsed: unknown = null;
      try { parsed = JSON.parse(text); } catch { /* parse fail */ }
      if (parsed !== null) baselineAssert = applyAssertions(fixture, parsed);
    }

    // Sweep candidate models
    const results: ReplayResult[] = [];
    for (const model of CANDIDATE_MODELS) {
      console.log(`[bakeoff]   model=${model} ...`);
      const r = await runReplay(caller, model, input);
      console.log(`[bakeoff]   model=${model} → ${r.status} | ${fmtMs(r.duration_ms)} | out=${fmtChars(r.output_chars)} | thinking=${fmtChars(r.thinking_chars)} | parse=${r.parse_ok ? 'OK' : 'FAIL'}`);
      if (fixture && r.parse_ok) {
        let parsed: unknown = null;
        try { parsed = JSON.parse(r.raw_text); } catch { /* unreachable */ }
        const a = applyAssertions(fixture, parsed);
        r.t1_passed = a.t1_passed; r.t1_fails = a.t1_fails;
        r.t2_passed = a.t2_passed; r.t2_fails = a.t2_fails;
        r.t3_passed = a.t3_passed; r.t3_fails = a.t3_fails;
      }
      results.push(r);
      // Save raw output
      const slug = `${target.slug}__${model.replace(/[:/]/g, '_')}`;
      writeFileSync(
        join(outDir, 'raw', `${slug}.json`),
        JSON.stringify({ target, input_lengths: { system: input.system.length, prompt: input.prompt.length }, result: r }, null, 2),
        'utf-8',
      );
      // Track
      tally[model].total += 1;
      if (r.parse_ok) tally[model].parse_ok += 1;
      if (r.t1_passed) tally[model].t1 += 1;
      if (r.t2_passed) tally[model].t2 += 1;
      if (r.t3_passed) tally[model].t3 += 1;
      tally[model].durations.push(r.duration_ms);
    }

    // Track baseline in same tally
    tally['qwen3.5:9b (baseline)'].total += 1;
    if (baseline.parse_ok) tally['qwen3.5:9b (baseline)'].parse_ok += 1;
    if (baselineAssert?.t1_passed) tally['qwen3.5:9b (baseline)'].t1 += 1;
    if (baselineAssert?.t2_passed) tally['qwen3.5:9b (baseline)'].t2 += 1;
    if (baselineAssert?.t3_passed) tally['qwen3.5:9b (baseline)'].t3 += 1;
    tally['qwen3.5:9b (baseline)'].durations.push(baseline.duration_ms);

    // Per-prompt table
    reportLines.push(`| model | parse_ok | T1 | T2 | T3 | duration | output | thinking | notes |`);
    reportLines.push(`|---|---|---|---|---|---|---|---|---|`);

    // Baseline row
    const baseFlag = (b: boolean | null | undefined): string => b === true ? '✅' : b === false ? '❌' : 'n/a';
    const baseNotes = baseline.status === 'error'
      ? `**${baseline.error_type ?? 'error'}** after ${baseline.retry_attempts} retries`
      : 'live thin-slice-12 output';
    reportLines.push(row(
      'qwen3.5:9b (baseline)',
      baseFlag(baseline.parse_ok),
      baselineAssert ? baseFlag(baselineAssert.t1_passed) : 'n/a',
      baselineAssert ? baseFlag(baselineAssert.t2_passed) : 'n/a',
      baselineAssert ? baseFlag(baselineAssert.t3_passed) : 'n/a',
      fmtMs(baseline.duration_ms),
      fmtChars(baseline.output_chars),
      fmtChars(baseline.thinking_chars),
      baseNotes,
    ));

    for (const r of results) {
      const notes = r.status === 'error'
        ? `**call error**: ${(r.error_message ?? '').slice(0, 80)}`
        : (r.parse_ok ? '—' : 'unparseable JSON');
      reportLines.push(row(
        r.model,
        baseFlag(r.parse_ok),
        r.parse_ok && fixture ? baseFlag(r.t1_passed) : 'n/a',
        r.parse_ok && fixture ? baseFlag(r.t2_passed) : 'n/a',
        r.parse_ok && fixture ? baseFlag(r.t3_passed) : 'n/a',
        fmtMs(r.duration_ms),
        fmtChars(r.output_chars),
        fmtChars(r.thinking_chars),
        notes,
      ));
    }

    // Failure details
    for (const r of results) {
      if (r.t1_fails?.length || r.t2_fails?.length || r.t3_fails?.length) {
        reportLines.push(`\n**${r.model} assertion failures:**`);
        for (const f of r.t1_fails ?? []) reportLines.push(`  - [T1] ${f}`);
        for (const f of r.t2_fails ?? []) reportLines.push(`  - [T2] ${f}`);
        for (const f of r.t3_fails ?? []) reportLines.push(`  - [T3] ${f}`);
      }
    }
    reportLines.push('');
  }

  // Summary
  reportLines.push(`\n## Summary across all ${TARGETS.length} prompts\n`);
  reportLines.push(`| model | parse_ok | T1 pass | T2 pass | T3 pass | avg duration |`);
  reportLines.push(`|---|---|---|---|---|---|`);
  for (const m of ['qwen3.5:9b (baseline)', ...CANDIDATE_MODELS]) {
    const t = tally[m];
    const avg = t.durations.length > 0 ? t.durations.reduce((a, b) => a + b, 0) / t.durations.length : 0;
    reportLines.push(`| ${m} | ${t.parse_ok}/${t.total} | ${t.t1}/${t.total} | ${t.t2}/${t.total} | ${t.t3}/${t.total} | ${fmtMs(avg)} |`);
  }

  const reportPath = join(outDir, 'bakeoff-report.md');
  const reportContent = reportLines.join('\n');
  writeFileSync(reportPath, reportContent, 'utf-8');
  // Link the report into the AODD trace + close the run.
  await withTraceContext(
    { workflow_run_id: bakeoffRunId, phase_id: null, sub_phase_id: null },
    async () => {
      aoddEmit('context.detail_file_written', {
        path: reportPath,
        bytes: Buffer.byteLength(reportContent, 'utf-8'),
      });
    },
  );
  aoddEndRun({ status: 'success' });
  console.log(`\n[bakeoff] done — report at ${reportPath}`);
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
