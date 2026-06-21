/**
 * Sweep-matrix types + validation for the Phase-9 executor model bakeoff.
 *
 * A sweep compares local Ollama-hosted models as the Goose-driven Phase-9
 * coding executor across Ollama server configurations (flash attention,
 * KV-cache quantization, context length, ...) and Goose context-management
 * settings, on a single GPU where weights + KV cache must fit in VRAM.
 *
 * The matrix is a JSON file (see sweep-matrix.smoke.json). Everything here
 * is pure — no I/O beyond what the caller hands in.
 */

/**
 * ADVISORY only. The harness no longer spawns its own ollama server (it uses
 * the running system server), so these per-candidate server knobs are NOT
 * applied as `ollama serve` env. Only `contextLength` is still consulted — by
 * {@link effectiveNumCtx}, to choose the num_ctx the VRAM fit-check requests.
 */
export interface OllamaServerConfig {
  /** OLLAMA_CONTEXT_LENGTH — server-side default num_ctx (advisory; feeds the fit check). */
  contextLength?: number;
  /** OLLAMA_FLASH_ATTENTION=1 */
  flashAttention?: boolean;
  /** OLLAMA_KV_CACHE_TYPE */
  kvCacheType?: 'q4_0' | 'q8_0' | 'f16';
  /** OLLAMA_NUM_PARALLEL */
  numParallel?: number;
  /** OLLAMA_MAX_LOADED_MODELS */
  maxLoadedModels?: number;
}

/**
 * Goose-side context dimensions (see janumicode/docs/Goose CLI Environment
 * Variables.md). `inputLimit` maps to Ollama `num_ctx` per request and is
 * the primary per-candidate context-window lever.
 */
export interface GooseEnvConfig {
  /** GOOSE_INPUT_LIMIT → ollama num_ctx per request. */
  inputLimit?: number;
  /** GOOSE_CONTEXT_LIMIT — Goose's own token accounting. */
  contextLimit?: number;
  /** GOOSE_AUTO_COMPACT_THRESHOLD (0.0–1.0). */
  autoCompactThreshold?: number;
  /** GOOSE_MAX_TOOL_RESPONSE_SIZE (chars). */
  maxToolResponseSize?: number;
  /** GOOSE_TOOL_CALL_CUTOFF. */
  toolCallCutoff?: number;
  /** GOOSE_MAX_TOKENS. */
  maxTokens?: number;
  /** GOOSE_TEMPERATURE. */
  temperature?: number;
}

/**
 * Modelfile-defined candidate (Ollama 0.30 GGUF imports, Unsloth quants,
 * baked-in PARAMETER num_ctx, ...). The harness renders this to a
 * Modelfile and runs `ollama create <modelTag> -f <file>` on the system server.
 */
export interface ModelfileSpec {
  /** FROM line: a GGUF file/dir path or a base model tag. */
  from: string;
  /** PARAMETER lines, e.g. { num_ctx: 65536, temperature: 0.7 }. */
  parameters?: Record<string, string | number>;
}

export interface CandidateSpec {
  /** Filename-safe label, e.g. "gemma4-12b-64k-fa-q8kv". */
  slug: string;
  /** Ollama tag to run (and to create, when `modelfile` is present). */
  modelTag: string;
  modelfile?: ModelfileSpec;
  /** Advisory server knobs (only `contextLength` is consulted, for the fit
   *  check). Optional now that the harness never spawns its own server. */
  server?: OllamaServerConfig;
  goose?: GooseEnvConfig;
  /**
   * Executor LANGUAGE-sweep lever. When set, the run exports
   * JANUMICODE_FORCE_STACK so Phase-9 recon pins every area to this stack
   * (topology preserved) — isolating language as the only variable across
   * candidates. One of node|python|go|rust|java; omit for "recon decides".
   */
  forceStack?: string;
  notes?: string;
}

/** Stacks a candidate may force (mirrors KNOWN_FORCED_STACKS in phase9Recon). */
export const FORCEABLE_STACKS = ['node', 'python', 'go', 'rust', 'java'] as const;

export interface BakeoffSweepConfig {
  /** Phase-8-complete reference workspace (Tier 1 resume source). */
  referenceWorkspace: string;
  /** Phase-8-complete reference DB (passed to --resume-from-db). */
  referenceDb: string;
  /** Sweep output root, e.g. test-and-evaluation/bakeoff-results/<name>. */
  outputDir: string;
  /** Port the running system Ollama listens on. Default 11434. The harness
   *  ALWAYS uses this server — it never spawns its own. */
  systemOllamaPort?: number;
  candidates: CandidateSpec[];
  tier1?: {
    /** Per-run wall clock cap for the whole resumed pipeline (seconds). */
    globalTimeoutSeconds?: number;
    /**
     * Cap the implemented leaf set to the first N (JANUMICODE_BAKEOFF_MAX_LEAVES).
     * A full ~20-leaf Phase 9 is hours per candidate; a few representative leaves
     * give the per-language code-quality signal far faster. Omit for no cap.
     */
    maxLeaves?: number;
    /**
     * Per-attempt no-progress stream timeout in seconds
     * (JANUMICODE_LLM_NO_PROGRESS_SECONDS). The default 90s kills REASONING
     * models (e.g. gpt-oss) mid-thought — they emit no stream chunk for minutes
     * while reasoning, so context-prep/codegen calls abort + retry to failure.
     * Raise it for reasoning candidates. Omit to keep the product default.
     */
    noProgressSeconds?: number;
    /**
     * Wall-clock cap per llmCaller attempt in seconds
     * (JANUMICODE_LLM_MAX_CALL_SECONDS). The 600s default also cuts long
     * reasoning generations. Omit to keep the product default.
     */
    maxCallSeconds?: number;
    /**
     * Total per-leaf EXECUTOR (goose) process cap in seconds
     * (JANUMICODE_CLI_TIMEOUT_SECONDS). The 600s default quarantines a slow
     * reasoning model's leaves as "Process timed out" — measuring speed, not
     * code quality. Raise to give capable-but-slow models room to finish.
     */
    cliTimeoutSeconds?: number;
    /** Executor idle cap in seconds (JANUMICODE_CLI_IDLE_TIMEOUT_SECONDS); the
     *  120s default is short for a model that reasons silently between chunks. */
    cliIdleTimeoutSeconds?: number;
  };
  /** Slugs promoted to Tier-2 full-slice runs. */
  tier2Finalists?: string[];
  /** Intent file for Tier-2 fresh runs (defaults to the reference one). */
  intentFile?: string;
}

export const DEFAULT_SYSTEM_PORT = 11434;
export const DEFAULT_TIER1_TIMEOUT_SECONDS = 4 * 60 * 60;

const SLUG_RE = /^[a-z0-9][a-z0-9._-]*$/i;
const KV_CACHE_TYPES = new Set(['q4_0', 'q8_0', 'f16']);

export interface ValidationResult {
  config: BakeoffSweepConfig | null;
  errors: string[];
  warnings: string[];
}

/** Effective num_ctx the executor will run with (and the fit pre-check must use). */
export function effectiveNumCtx(candidate: CandidateSpec): number | null {
  return candidate.goose?.inputLimit
    ?? numCtxFromModelfile(candidate)
    ?? candidate.server?.contextLength
    ?? null;
}

function numCtxFromModelfile(candidate: CandidateSpec): number | null {
  const raw = candidate.modelfile?.parameters?.['num_ctx'];
  if (raw === undefined) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** A model under test in a language sweep: a base candidate (model + server +
 *  goose config) WITHOUT a forceStack — the cross-product adds that. */
export type SweepModel = Omit<CandidateSpec, 'forceStack' | 'slug'> & { slug: string };

/**
 * Cross {models} × {languages} into one candidate per combination, deriving
 * `slug = <modelSlug>__<lang>` and `forceStack = <lang>`. Pure — the live
 * runner consumes the result. Languages are validated against FORCEABLE_STACKS;
 * an unknown language throws (a sweep typo would otherwise silently no-op the
 * force and measure recon's own pick).
 *
 * Ordering is LANGUAGE-MAJOR (outer loop = language, inner = model): all models
 * for `node`, then all for `python`, … — so a cross-model comparison for each
 * language completes as early as possible, rather than finishing one model
 * across every language first.
 */
export function expandLanguageSweep(models: SweepModel[], languages: string[]): CandidateSpec[] {
  for (const lang of languages) {
    if (!(FORCEABLE_STACKS as readonly string[]).includes(lang)) {
      throw new Error(`expandLanguageSweep: unknown language "${lang}" (allowed: ${FORCEABLE_STACKS.join(', ')})`);
    }
  }
  const out: CandidateSpec[] = [];
  for (const lang of languages) {
    for (const m of models) {
      out.push({ ...m, slug: `${m.slug}__${lang}`, forceStack: lang });
    }
  }
  return out;
}

/**
 * Validate a parsed sweep-matrix object. Returns the typed config when there
 * are no errors; warnings never block.
 */
export function validateSweepConfig(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { config: null, errors: ['sweep config must be a JSON object'], warnings };
  }
  const cfg = raw as BakeoffSweepConfig;

  for (const field of ['referenceWorkspace', 'referenceDb', 'outputDir'] as const) {
    if (typeof cfg[field] !== 'string' || cfg[field].length === 0) {
      errors.push(`missing or empty required field: ${field}`);
    }
  }
  if (!Array.isArray(cfg.candidates) || cfg.candidates.length === 0) {
    errors.push('candidates must be a non-empty array');
    return { config: null, errors, warnings };
  }

  const seenSlugs = new Set<string>();
  for (const [i, c] of cfg.candidates.entries()) {
    const where = `candidates[${i}]`;
    if (typeof c.slug !== 'string' || !SLUG_RE.test(c.slug)) {
      errors.push(`${where}: slug must match ${SLUG_RE} (got ${JSON.stringify(c.slug)})`);
      continue;
    }
    if (seenSlugs.has(c.slug)) errors.push(`${where}: duplicate slug "${c.slug}"`);
    seenSlugs.add(c.slug);

    if (typeof c.modelTag !== 'string' || c.modelTag.length === 0) {
      errors.push(`${where} (${c.slug}): modelTag is required`);
    }
    if (c.server !== undefined && (c.server === null || typeof c.server !== 'object')) {
      errors.push(`${where} (${c.slug}): server, when present, must be an object`);
      continue;
    }
    if (c.server?.kvCacheType !== undefined && !KV_CACHE_TYPES.has(c.server.kvCacheType)) {
      errors.push(`${where} (${c.slug}): kvCacheType must be one of ${[...KV_CACHE_TYPES].join(', ')}`);
    }
    if (c.modelfile !== undefined && (typeof c.modelfile.from !== 'string' || c.modelfile.from.length === 0)) {
      errors.push(`${where} (${c.slug}): modelfile.from is required when modelfile is present`);
    }
    const thr = c.goose?.autoCompactThreshold;
    if (thr !== undefined && (typeof thr !== 'number' || thr < 0 || thr > 1)) {
      errors.push(`${where} (${c.slug}): goose.autoCompactThreshold must be in [0, 1]`);
    }
    if (c.forceStack !== undefined && !(FORCEABLE_STACKS as readonly string[]).includes(c.forceStack)) {
      errors.push(`${where} (${c.slug}): forceStack must be one of ${FORCEABLE_STACKS.join(', ')} (got ${JSON.stringify(c.forceStack)})`);
    }

    // Context-window agreement: GOOSE_INPUT_LIMIT (per-request num_ctx),
    // Modelfile num_ctx, and OLLAMA_CONTEXT_LENGTH (server default) should
    // not silently disagree — the smallest one wins at inference time and
    // the fit pre-check would otherwise validate the wrong size.
    const sources = [
      ['goose.inputLimit', c.goose?.inputLimit],
      ['modelfile num_ctx', numCtxFromModelfile(c)],
      ['server.contextLength', c.server?.contextLength],
    ].filter((s): s is [string, number] => typeof s[1] === 'number');
    const distinct = new Set(sources.map(([, v]) => v));
    if (distinct.size > 1) {
      warnings.push(
        `${c.slug}: context sizes disagree (${sources.map(([k, v]) => `${k}=${v}`).join(', ')}); ` +
        `effective num_ctx will be ${effectiveNumCtx(c)}`,
      );
    }
    if (effectiveNumCtx(c) === null) {
      warnings.push(`${c.slug}: no context length specified anywhere — model/ollama defaults apply and the fit pre-check runs at the model default`);
    }
  }

  for (const slug of cfg.tier2Finalists ?? []) {
    if (!seenSlugs.has(slug)) errors.push(`tier2Finalists: unknown slug "${slug}"`);
  }

  return { config: errors.length === 0 ? cfg : null, errors, warnings };
}
