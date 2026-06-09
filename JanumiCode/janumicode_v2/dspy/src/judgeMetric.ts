/**
 * LLM-judge metric layer for the fr_saturation pilot.
 *
 * Runs the REAL review-harness LLM validators headless — same prompt templates,
 * same parsing — against a local judge model via ollama. Reuses runLLMValidator
 * so the metric equals the production grounding/citation gate, not a re-implementation.
 *
 * Judge model is configurable via JUDGE_MODEL (default qwen3.5:9b). It SHOULD differ
 * from the model under test (gpt-oss:20b) to avoid self-grading bias.
 *
 * Throughput note: each call loads/uses the judge model. During a DSPy run this
 * fires per candidate × per example × per judge — on a single GPU, prefer a small
 * judge and a light optimizer config. See dspy/reports/fr_saturation.findings.md.
 */

import { join } from 'path';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { LLMCaller } from '../../src/lib/llm/llmCaller';
import { OllamaProvider } from '../../src/lib/llm/providers/ollama';
import { TemplateLoader } from '../../src/lib/orchestrator/templateLoader';
import type { ValidatorFinding, ValidatorRuntimeParams } from '../../src/lib/review/harness/validatorRegistry';
import { invokeGroundingValidator } from '../../src/lib/review/harness/validators/llm/groundingValidator';
import { invokeAssumptionCitationValidator } from '../../src/lib/review/harness/validators/llm/assumptionCitationValidator';
import { scoreCandidate, SEVERITY_WEIGHT, PENALTY_CAP, type ScoreInput } from './metric';
import type { ScoreResult, ValidatorRollup } from './types';

const PROJECT_ROOT = join(__dirname, '..', '..');

export const JUDGE_MODEL = process.env.JUDGE_MODEL ?? 'qwen3.5:9b';
export const JUDGE_PROVIDER = 'ollama';
// De-noising: judge at temp 0 by default (more deterministic findings).
export const JUDGE_TEMPERATURE = Number(process.env.JUDGE_TEMPERATURE ?? '0.0');
// De-noising: average N judge passes per (output, prompt) for a lower-variance
// penalty estimate, then freeze it in a disk cache so the SAME output always
// scores identically across the run (the optimizer compares apples to apples
// instead of chasing judge sampling noise). 1 = off.
export const JUDGE_PASSES = Math.max(1, parseInt(process.env.JUDGE_PASSES ?? '3', 10));
const JUDGE_CACHE_DIR = join(PROJECT_ROOT, 'dspy', '.judge_cache');

// Metric scoping: only charge the saturation prompt for what it CONTROLS.
// For an atomic_leaf parent, the prompt's contract is to MIRROR the parent's
// acceptance criteria verbatim — so a grounding defect on a mirrored child AC is
// INHERITED from the upstream bloom phase, not fixable here. We drop those so the
// optimizer isn't chasing an immovable target (and so grounding is enforced at the
// producer, fr_bloom_enrichment, per the project's "fix-at-producer" principle).
// Kept (saturation-owned): assumption_citation on surfaced_assumptions, and
// grounding on NEW children in the decomposable branch. Toggle with SCOPE_INHERITED=0.
export const SCOPE_INHERITED = process.env.SCOPE_INHERITED !== '0';

function isInheritedFinding(f: ValidatorFinding, outputContent: Record<string, unknown> | null): boolean {
  if (!SCOPE_INHERITED) return false;
  const cls = outputContent?.parent_branch_classification;
  if (cls !== 'atomic_leaf') return false;            // decomposable/invalid → authored here → owned
  // atomic_leaf child ACs are verbatim mirrors of the parent → grounding on them is inherited
  return f.validatorId === 'grounding_validator'
    && /children\[\d+\]\.acceptance_criteria/.test(f.location ?? '');
}

let _loader: TemplateLoader | null = null;
let _caller: LLMCaller | null = null;

function loader(): TemplateLoader {
  if (!_loader) _loader = new TemplateLoader(PROJECT_ROOT);
  return _loader;
}
function caller(): LLMCaller {
  if (!_caller) {
    _caller = new LLMCaller({ maxRetries: 1 });
    _caller.registerProvider(new OllamaProvider());
  }
  return _caller;
}

const JUDGES: Array<{ id: string; invoke: typeof invokeGroundingValidator }> = [
  { id: 'grounding_validator', invoke: invokeGroundingValidator },
  { id: 'assumption_citation_validator', invoke: invokeAssumptionCitationValidator },
];

/** Run the two LLM judges over one candidate. Returns all findings. */
export async function runJudges(params: ValidatorRuntimeParams): Promise<ValidatorFinding[]> {
  const ctx = {
    workflowRunId: 'dspy-pilot',
    phaseId: '2' as unknown as null, // trace only; not persisted (no writer attached)
    subPhaseId: params.subPhaseId,
    harnessProvider: JUDGE_PROVIDER,
    harnessModel: JUDGE_MODEL,
    harnessTemperature: JUDGE_TEMPERATURE,
    pushFailure: (_id: string, _err: string) => {},
    recordLLMUsage: () => {},
  };
  const all: ValidatorFinding[] = [];
  for (const j of JUDGES) {
    try {
      const findings = await j.invoke(params, caller() as any, loader() as any, ctx as any);
      all.push(...(findings ?? []));
    } catch (err) {
      all.push({
        validatorId: j.id, severity: 'LOW', type: 'judge_unavailable',
        summary: `judge errored: ${err instanceof Error ? err.message : String(err)}`,
        location: '', detail: '', recommendation: '',
      });
    }
  }
  return all;
}

/** Disk-cache key: same (judge model, temp, passes, prompt, output) → same score. */
function judgeCacheKey(input: ScoreInput): string {
  return createHash('sha256').update(JSON.stringify({
    m: JUDGE_MODEL, t: JUDGE_TEMPERATURE, n: JUDGE_PASSES, scope: SCOPE_INHERITED,
    prompt: input.prompt ?? '', out: input.outputText ?? '',
  })).digest('hex');
}

interface JudgeCacheEntry { judgePenalty: number; passes: number; byValidator: ValidatorRollup[]; judgeFindingCount: number; }

/**
 * Judge-inclusive score with two de-noising mechanisms:
 *   1. Average JUDGE_PASSES independent judge runs → lower-variance penalty estimate.
 *   2. Freeze the averaged result in a disk cache keyed on (model, temp, passes,
 *      prompt, output). The SAME output then scores identically for the rest of the
 *      run, so MIPRO compares candidates on a stable metric instead of chasing the
 *      judge's sampling noise (the failure mode that made the first run flat).
 *
 * Deterministic validators run with the citation proxy OFF (the real
 * assumption_citation judge covers it). Penalties fold into one score with the
 * same severity weights / cap as the deterministic metric.
 */
export async function scoreWithJudges(input: ScoreInput): Promise<ScoreResult> {
  const det = scoreCandidate(input, { includeCitationProxy: false });
  // Unparseable output already floors to 0; no point spending judge time on it.
  if (!det.parseOk) return det;

  const cachePath = join(JUDGE_CACHE_DIR, judgeCacheKey(input) + '.json');
  let cached: JudgeCacheEntry | null = null;
  if (existsSync(cachePath)) {
    try { cached = JSON.parse(readFileSync(cachePath, 'utf-8')) as JudgeCacheEntry; } catch { cached = null; }
  }

  let judgePenalty: number;
  let judgeRollups: ValidatorRollup[];
  let judgeFindingCount: number;

  if (cached) {
    judgePenalty = cached.judgePenalty;
    judgeRollups = cached.byValidator;
    judgeFindingCount = cached.judgeFindingCount;
  } else {
    const params: ValidatorRuntimeParams = {
      agentRole: input.agentRole,
      subPhaseId: input.subPhaseId,
      agentOutputId: 'candidate',
      outputText: input.outputText ?? '',
      outputContent: null,
      outputThinking: null,
      originalPrompt: input.prompt ?? '',
      originalSystem: input.system ?? null,
    };
    try { params.outputContent = JSON.parse(input.outputText); } catch { /* leave null */ }

    // Average N independent judge passes.
    let penaltySum = 0;
    let findingCountSum = 0;
    const rollups = new Map<string, ValidatorRollup>();
    for (let pass = 0; pass < JUDGE_PASSES; pass++) {
      const raw = await runJudges(params);
      // Drop inherited findings the saturation prompt can't fix (see isInheritedFinding).
      const findings = raw.filter((f) => !isInheritedFinding(f, params.outputContent));
      for (const f of findings) {
        penaltySum += SEVERITY_WEIGHT[f.severity] ?? 0;
        findingCountSum++;
        let r = rollups.get(f.validatorId);
        if (!r) { r = { validatorId: f.validatorId, high: 0, medium: 0, low: 0, summaries: [] }; rollups.set(f.validatorId, r); }
        if (f.severity === 'HIGH') r.high++; else if (f.severity === 'MEDIUM') r.medium++; else r.low++;
        if (r.summaries.length < 5) r.summaries.push(`[${f.severity}] ${f.summary}`);
      }
    }
    judgePenalty = penaltySum / JUDGE_PASSES;          // average penalty per pass
    judgeFindingCount = findingCountSum / JUDGE_PASSES;
    judgeRollups = [...rollups.values()];

    try {
      mkdirSync(JUDGE_CACHE_DIR, { recursive: true });
      writeFileSync(cachePath, JSON.stringify(
        { judgePenalty, passes: JUDGE_PASSES, byValidator: judgeRollups, judgeFindingCount } as JudgeCacheEntry));
    } catch { /* cache is best-effort */ }
  }

  const penalty = det.penalty + judgePenalty;
  return {
    score: Math.max(0, 1 - penalty / PENALTY_CAP),
    parseOk: true,
    penalty,
    byValidator: [...det.byValidator, ...judgeRollups],
    totalFindings: det.totalFindings + Math.round(judgeFindingCount),
  };
}
