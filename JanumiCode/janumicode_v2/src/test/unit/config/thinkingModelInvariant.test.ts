/**
 * Invariant: every LLM model configured for reasoning in JanumiCode v2
 * must be a thinking / reasoning model.
 *
 * Motivation: JanumiCode's governance design (phase handlers, Intent
 * Quality Check, Reasoning Review, Consistency Checker, Narrative Memory,
 * Failure Handler socratic dialogs, Client Liaison synthesis) assumes the
 * model can expose a reasoning chain in its `thinking` channel so humans
 * can audit how decisions were reached. A non-thinking model silently
 * collapses that channel to empty strings and the audit surface goes
 * dark — users can't tell whether the model "thought" about a thing or
 * just guessed, and `agent_output.thinking` becomes null across the board.
 *
 * This also regression-tests the ollama `think: true` fix: if anyone ever
 * adds a non-thinking model (e.g. `llama3.2:3b`) to production code, the
 * test fails and forces a deliberate decision rather than silently
 * disabling the reasoning-chain UX.
 *
 * Embedding models (`*-embedding:*`) are exempt — they don't reason, they
 * vectorize.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Known thinking/reasoning model families ──────────────────────────
//
// Patterns are matched case-insensitively against the model string. A
// model is considered a reasoning model if ANY pattern matches. Add new
// families here when adopting them — never widen a pattern to let a
// non-thinking model slip through.
const REASONING_MODEL_PATTERNS: RegExp[] = [
  // Qwen3 family — all variants (qwen3, qwen3.5, qwen3-coder, qwen3-30b-a3b,
  // etc.) are trained with thinking-mode. Qwen2 and older are NOT.
  /^qwen3/i,
  // Google Gemma 3n+ — multimodal thinking-capable edge models. The
  // `:e2b` / `:e4b` suffixes denote effective-parameter size in
  // Ollama's tag format. Gemma 2 and Gemma 1 are NOT reasoning models.
  /^gemma[34]/i,
  // Google Gemini thinking tier. The `-thinking` suffix is explicit;
  // `gemini-2.5-pro` and `gemini-2.5-flash` both default to reasoning
  // mode (thinking tokens enabled by default per Google's Gemini 2.5
  // release notes). Gemini 3+ is assumed reasoning.
  /^gemini-[2-9][.-][0-9].*thinking/i,
  /^gemini-2\.5-(pro|flash)/i,
  /^gemini-[3-9]/i,
  // Anthropic Claude thinking-capable tiers. Sonnet 3.7+ and Opus 4+
  // support extended thinking.
  /^claude-3\.7/i,
  /^claude-(opus|sonnet|haiku)-4/i,
  /^claude-4/i,
  // OpenAI o-series + GPT-5 are reasoning models.
  /^o[1-9]([-_.]|$)/i,
  /^gpt-5/i,
  // DeepSeek R-series are reasoning models. V3 (non-R) is not.
  /^deepseek-r[1-9]/i,
];

function isReasoningModel(model: string): boolean {
  return REASONING_MODEL_PATTERNS.some((p) => p.test(model));
}

// Models that are intentionally NOT used for reasoning. Currently only
// embedding models.
function isReasoningExempt(model: string): boolean {
  return /embedding/i.test(model);
}

// ── Production source roots ──────────────────────────────────────────
//
// We scan only production code — tests use stubbed models (`'test'`,
// `'m'`, `'x'`, `'qwen3.5:9b'` for fixtures) that don't affect the
// shipping product. The goal is to prevent a shipping config from
// routing real reasoning work through a non-thinking model.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const PRODUCTION_ROOTS = [
  path.join(REPO_ROOT, 'src', 'lib'),
  path.join(REPO_ROOT, 'src', 'extension.ts'),
];

/**
 * Walk all `.ts` files under the given roots and extract every literal
 * `model: 'xxx'` or `model: "xxx"` occurrence, plus known fallback
 * expressions like `process.env.X ?? 'xxx'` used right after a `model:`
 * key. Returns an array of `{ file, line, model }` tuples.
 */
function collectModelLiterals(roots: string[]): Array<{ file: string; line: number; model: string }> {
  const results: Array<{ file: string; line: number; model: string }> = [];

  const visit = (target: string): void => {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(target)) {
        visit(path.join(target, entry));
      }
      return;
    }
    if (!target.endsWith('.ts')) return;

    const source = fs.readFileSync(target, 'utf-8');
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // `model: '...'` or `model: "..."` — the common form.
      const direct = /\bmodel\s*:\s*['"]([^'"\n]+)['"]/g;
      let m: RegExpExecArray | null;
      while ((m = direct.exec(line))) {
        results.push({ file: path.relative(REPO_ROOT, target), line: i + 1, model: m[1] });
      }
      // `model: process.env.X ?? 'fallback'` — capture the fallback literal.
      const envFallback = /\bmodel\s*:\s*process\.env\.[A-Z0-9_]+\s*\?\?\s*['"]([^'"\n]+)['"]/g;
      while ((m = envFallback.exec(line))) {
        results.push({ file: path.relative(REPO_ROOT, target), line: i + 1, model: m[1] });
      }
    }
  };

  for (const root of roots) {
    if (fs.existsSync(root)) visit(root);
  }
  return results;
}

describe('Model policy — every configured LLM must be a thinking/reasoning model', () => {
  const literals = collectModelLiterals(PRODUCTION_ROOTS);

  it('collects at least one model literal from production code', () => {
    // Guard against the scanner accidentally skipping the source tree
    // and trivially passing the invariant below.
    expect(literals.length).toBeGreaterThan(0);
  });

  it('only configures reasoning models (or embedding-exempt) across production code', () => {
    const offenders = literals.filter((lit) => {
      if (isReasoningExempt(lit.model)) return false;
      return !isReasoningModel(lit.model);
    });

    // Build a descriptive failure message so the reviewer knows exactly
    // which file to fix without grep-diving.
    if (offenders.length > 0) {
      const detail = offenders
        .map((o) => `  ${o.file}:${o.line} → ${o.model}`)
        .join('\n');
      expect.fail(
        `Non-reasoning models found in production code:\n${detail}\n` +
        'Either pick a thinking model (see REASONING_MODEL_PATTERNS) or ' +
        'add a new pattern with clear justification in ' +
        'src/test/unit/config/thinkingModelInvariant.test.ts.',
      );
    }
  });

  it('recognizes known thinking-model strings used in production today', () => {
    // Sanity check: these are the strings we EXPECT to see. If a production
    // model literal ever changes, this list should be updated so we don't
    // regress on coverage.
    const expectedSeen = ['qwen3.5:9b', 'gemini-2.5-flash'];
    const found = new Set(literals.map((l) => l.model));
    for (const name of expectedSeen) {
      expect(found.has(name), `Expected to see production model ${name}`).toBe(true);
      expect(isReasoningModel(name)).toBe(true);
    }
  });

  it('rejects plausible-looking non-reasoning models (negative controls)', () => {
    // Pin the pattern logic so a loose regex change can't accidentally
    // start admitting random llama/gpt-4/gemini-1.5 checkpoints.
    const shouldReject = [
      'llama3.2:3b',
      'llama3.1:8b',
      'gpt-4-turbo',
      'gpt-4o',
      'gpt-3.5-turbo',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-2.0-flash', // no -thinking suffix → not reasoning
      'qwen2.5:7b',
      'claude-3-opus',
      'claude-3.5-sonnet',
      'mistral:7b',
      'deepseek-v3',
      'gemma:7b',   // Gemma 1 — no thinking mode
      'gemma2:9b',  // Gemma 2 — no thinking mode
    ];
    for (const m of shouldReject) {
      expect(
        isReasoningModel(m),
        `${m} should NOT be classified as a reasoning model`,
      ).toBe(false);
    }
  });

  it('accepts the full known thinking-model catalog (positive controls)', () => {
    const shouldAccept = [
      'qwen3:8b',
      'qwen3.5:9b',
      'qwen3-coder:7b',
      'qwen3-30b-a3b',
      'gemma3n:e4b',
      'gemma4:e4b',
      'gemma4:e2b',
      'gemini-2.0-flash-thinking',
      'gemini-2.5-pro',
      'gemini-3',
      'claude-3.7-sonnet',
      'claude-opus-4.5',
      'claude-sonnet-4.5',
      'claude-haiku-4.5',
      'o1-preview',
      'o3-mini',
      'gpt-5',
      'deepseek-r1',
    ];
    for (const m of shouldAccept) {
      expect(
        isReasoningModel(m),
        `${m} SHOULD be classified as a reasoning model`,
      ).toBe(true);
    }
  });
});
