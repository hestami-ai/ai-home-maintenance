/**
 * Per-config result.json + rolling cross-config bakeoff-report.md.
 * The markdown is rewritten after every completed config so partial
 * results are inspectable mid-sweep (overnight runs).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { CandidateSpec } from './bakeoffConfig';
import type { ConfigMetrics } from './metricsCollector';

export function writeConfigResult(outputDir: string, metrics: ConfigMetrics): string {
  const dir = join(outputDir, 'results');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${metrics.configSlug}.result.json`);
  writeFileSync(path, JSON.stringify(metrics, null, 2), 'utf-8');
  return path;
}

function fmtMs(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function fmtPct(frac: number | null): string {
  return frac === null ? '—' : `${Math.round(frac * 100)}%`;
}

function fmtNum(n: number | null): string {
  return n === null ? '—' : String(n);
}

function serverDims(c: CandidateSpec | undefined): { ctxLen: string; fa: string; kv: string } {
  return {
    ctxLen: c?.server.contextLength !== undefined ? String(c.server.contextLength) : 'def',
    fa: c?.server.flashAttention === undefined ? 'def' : c.server.flashAttention ? 'on' : 'off',
    kv: c?.server.kvCacheType ?? 'def',
  };
}

export function buildCrossConfigReport(opts: {
  sweepId: string;
  generatedAt: string;
  referenceWorkspace: string;
  candidates: CandidateSpec[];
  results: ConfigMetrics[];
}): string {
  const bySlug = new Map(opts.candidates.map((c) => [c.slug, c]));
  const lines: string[] = [];
  lines.push(`# Phase-9 Executor Model Bakeoff — ${opts.sweepId}`);
  lines.push('');
  lines.push(`Generated: ${opts.generatedAt}`);
  lines.push(`Reference workspace: ${opts.referenceWorkspace}`);
  lines.push(`Configs completed: ${opts.results.length}/${opts.candidates.length}`);
  lines.push('');
  lines.push('Chars/s is output bytes over wall time — a tokens/sec PROXY, comparable across configs only.');
  lines.push('');
  lines.push('## Tier-1 summary');
  lines.push('');
  lines.push(
    '| Config | Model | num_ctx | GooseCtx | FA | KV | Ollama | Pass% | TSC | Mean | P95 | Chars/s | Retry | Stall | TO | VRAM peak | Fit |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of opts.results) {
    const c = bySlug.get(r.configSlug);
    const d = serverDims(c);
    const vram =
      r.vramPeakMb !== null && r.vramTotalMb !== null ? `${r.vramPeakMb}/${r.vramTotalMb}MB` : '—';
    lines.push(
      `| ${r.configSlug} | ${r.modelTag} | ${fmtNum(r.effectiveNumCtx)} | ${fmtNum(c?.goose?.contextLimit ?? null)} ` +
      `| ${d.fa} | ${d.kv} | ${r.ollamaVersion} | ${fmtPct(r.taskPassRate)} | ${fmtNum(r.tscErrorCount)} ` +
      `| ${fmtMs(r.meanTaskWallMs)} | ${fmtMs(r.p95TaskWallMs)} ` +
      `| ${r.meanCharsPerSec === null ? '—' : Math.round(r.meanCharsPerSec)} ` +
      `| ${r.totalRetries} | ${r.stallCount} | ${r.timeoutCount} | ${vram} | ${r.contextFit} |`,
    );
  }
  lines.push('');

  for (const r of opts.results) {
    lines.push(`## ${r.configSlug}`);
    lines.push('');
    const c = bySlug.get(r.configSlug);
    if (c?.notes) lines.push(`> ${c.notes}`);
    lines.push(`- Phase-10 overall pass: ${r.phase10OverallPass === null ? '—' : r.phase10OverallPass}`);
    lines.push(`- Divergent duplicates: ${fmtNum(r.divergentDuplicateCount)}, layout violations: ${fmtNum(r.layoutViolationCount)}`);
    lines.push(`- CLI exit code: ${fmtNum(r.cliExitCode)}`);
    for (const n of r.notes) lines.push(`- NOTE: ${n}`);
    lines.push('');
    if (r.tasks.length > 0) {
      lines.push('| Task | Outcome | Wall | Tests (p/f) | Exit | Error |');
      lines.push('|---|---|---|---|---|---|');
      for (const t of r.tasks) {
        const tests =
          t.testPassedCount === null ? '—' : `${t.testPassedCount}/${t.testFailedCount ?? 0}`;
        const err = t.errorMessage ? t.errorMessage.slice(0, 60).replace(/\|/g, '\\|') : '—';
        lines.push(`| ${t.taskId} | ${t.outcome} | ${fmtMs(t.durationMs)} | ${tests} | ${fmtNum(t.exitCode)} | ${err} |`);
      }
    } else {
      lines.push('_No executor tasks recorded._');
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function writeCrossConfigReport(
  outputDir: string,
  report: string,
): string {
  mkdirSync(outputDir, { recursive: true });
  const path = join(outputDir, 'bakeoff-report.md');
  writeFileSync(path, report, 'utf-8');
  return path;
}
