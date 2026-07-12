/**
 * Tier-2 engine-replay fixture V&V (gated on JANUMICODE_CAL40_EXPORT).
 *
 * Two questions the fixture map must answer well for engine replay to be safe:
 *   1. FIDELITY — does the ReplayLLMProvider return each recorded call's exact
 *      recorded output? (exact-key hit rate on the real recorded prompts)
 *   2. NORMALIZER SAFETY — does scrubbing timestamps/UUIDs make DIFFERENT
 *      recorded prompts collide on the same normalized key? A collision means a
 *      drifted re-render could replay the WRONG output. We want ~0 collisions.
 *
 * Point JANUMICODE_CAL40_EXPORT at the dir from `prep-replay-db.mjs
 * --export-json`. Skips cleanly when absent.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { ReplayFixtureMap } from '../../../lib/replay/replayFixtureMap';
import { ReplayLLMProvider } from '../../../lib/replay/replayLLMProvider';
import type { LLMCallOptions } from '../../../lib/llm/llmCaller';

const EXPORT = process.env.JANUMICODE_CAL40_EXPORT;
const ndjson = EXPORT ? path.join(EXPORT, 'governed_stream.ndjson') : '';
const run = EXPORT && fs.existsSync(ndjson) ? describe : describe.skip;

function normalize(s: string): string {
  return s
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g, '<TS>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>');
}

run('cal-40 fixture integrity (gated on JANUMICODE_CAL40_EXPORT)', () => {
  // Setup runs in beforeAll, NOT at describe-collection time, so the default
  // skipped path (JANUMICODE_CAL40_EXPORT unset → describe.skip) never reads the
  // absent ndjson. A collection-time fs.readFileSync('') throws ENOENT and fails
  // the whole file even though every test is meant to be skipped.
  let llmPairs: Array<{ inv: Record<string, unknown>; out: Record<string, unknown> }>;
  let map: ReplayFixtureMap;
  beforeAll(() => {
    // Load raw rows once and reconstruct LLM invocation→output pairs.
    const rows = fs.readFileSync(ndjson, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const outByInv = new Map<string, Record<string, unknown>>();
    for (const r of rows) {
      if (r.record_type !== 'agent_output') continue;
      const content = JSON.parse(r.content);
      if ((content.status ?? 'success') !== 'success') continue;
      for (const inv of JSON.parse(r.derived_from_record_ids ?? '[]')) {
        if (!outByInv.has(inv)) outByInv.set(inv, content);
      }
    }
    llmPairs = [];
    for (const r of rows) {
      if (r.record_type !== 'agent_invocation') continue;
      const out = outByInv.get(r.id);
      if (!out) continue;
      const inv = JSON.parse(r.content);
      if (inv.provider && inv.prompt != null && typeof inv.command !== 'string') {
        llmPairs.push({ inv, out });
      }
    }
    map = ReplayFixtureMap.fromNdjson(ndjson);
  });

  it('loads a non-trivial LLM + CLI corpus', () => {
    // eslint-disable-next-line no-console
    console.log(`[cal-40 fixture] llm=${map.stats.llm} cli=${map.stats.cli} rows=${map.stats.rows} pairs=${llmPairs.length}`);
    expect(map.stats.llm).toBeGreaterThan(50);
  });

  it('FIDELITY: replay returns each recorded call\'s exact recorded output', async () => {
    let exact = 0;
    for (const { inv, out } of llmPairs) {
      const p = new ReplayLLMProvider(String(inv.provider), map, true);
      const opts = {
        provider: String(inv.provider), model: String(inv.model ?? ''),
        responseFormat: String(inv.response_format ?? 'text'),
        temperature: (inv.temperature as number | null) ?? null,
        maxTokens: (inv.max_tokens as number | null) ?? null,
        system: (inv.system as string | null) ?? null,
        prompt: String(inv.prompt), tools: inv.tools ?? [], toolChoice: null,
      } as unknown as LLMCallOptions;
      const r = await p.call(opts);
      if (r.text === String(out.text ?? '')) exact++;
    }
    const rate = exact / llmPairs.length;
    // eslint-disable-next-line no-console
    console.log(`[cal-40 fixture] FIDELITY: ${exact}/${llmPairs.length} exact-output replays (${(rate * 100).toFixed(1)}%)`);
    expect(rate).toBeGreaterThan(0.98); // recorded prompts must replay their own outputs
  });

  it('NORMALIZER SAFETY: near-zero normalized-key collisions to distinct outputs', () => {
    // Group recorded outputs by normalized key; a key mapping to >1 DISTINCT
    // output text is an ambiguous replay (a drifted re-render could get wrong data).
    const byNorm = new Map<string, Set<string>>();
    for (const { inv, out } of llmPairs) {
      const nk = createHash('sha256').update([
        normalize(String(inv.prompt)), normalize(String(inv.system ?? '')),
        String(inv.provider), String(inv.model ?? ''), String(inv.response_format ?? 'text'),
      ].join(' ')).digest('hex');
      const set = byNorm.get(nk) ?? new Set<string>();
      set.add(String(out.text ?? ''));
      byNorm.set(nk, set);
    }
    let collisions = 0;
    for (const outputs of byNorm.values()) if (outputs.size > 1) collisions++;
    const total = byNorm.size;
    // eslint-disable-next-line no-console
    console.log(`[cal-40 fixture] NORMALIZER: ${collisions}/${total} normalized keys map to >1 distinct output (${(collisions / total * 100).toFixed(1)}% ambiguous)`);
    // Some collisions are expected (identical prompts that legitimately produced
    // different sampled outputs across retries). Guard against the normalizer
    // being pathologically over-aggressive.
    expect(collisions / total).toBeLessThan(0.15);
  });
});
