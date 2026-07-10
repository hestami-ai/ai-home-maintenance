/**
 * chunkedCoverageBloom — the reusable "chunk the reasoning, let deterministic
 * code own 100% coverage" pattern, extracted verbatim from the Phase 6.1
 * task_skeleton fix (phase6.ts `runTaskDecomposition`, ~674–770).
 *
 * WHY: the P1–8 core LLM (gpt-oss:20b) is easily exceeded by a monolithic
 * SKELETON prompt that asks one response to enumerate/cover N independent items
 * (255 requirement ids, 46 components, 307 ACs). The proven remedy is to chunk
 * generation per primary item and have the ORCHESTRATOR own the completeness
 * guarantee via a bounded iterate-until-covered reconciliation loop. This module
 * is that loop, generalized over injectable callbacks so P3 system_requirements,
 * P5 data_model_skeleton and P7 test_case_skeleton (and P6 itself) share one
 * source of truth.
 *
 * House rules preserved (see feedback_small_model_decompose_skeletons):
 *  - NO fabrication — an unmet target is reported honestly via `onResidual`,
 *    never invented. The caller keeps at most ONE final fallback for the
 *    zero-output case.
 *  - Each phase normalizes its OWN output before it reaches `coveredBy`/`idOf`
 *    (deterministic bridges live in the producer, not here).
 *  - NO regex id resolution — callers pass structural id sets.
 *  - Fan-out is SEQUENTIAL: the local Ollama provider is one-model-one-request,
 *    so concurrent generation calls are not permitted.
 *  - A single chunk/batch failure must never sink the bloom — the callbacks are
 *    contracted to return [] on error, and this loop also guards defensively.
 */

import { getLogger } from '../../logging';

export interface ChunkedCoverageBloomConfig<TChunk, TProduced> {
  /** Primary items to fan out over — ONE focused LLM call each
   *  (e.g. leaf components, business domains, release cohorts). */
  chunks: TChunk[];

  /** One focused generation call for a chunk → produced items. Contracted to
   *  catch its own LLM/parse errors and return [] (a chunk failure is recovered
   *  by the reconciliation loop; it never sinks the phase). */
  generateForChunk: (chunk: TChunk, index: number) => Promise<TProduced[]>;

  /** Stable id for cross-chunk + cross-pass dedup (e.g. task.id, DM-*, suite_id).
   *  Return '' to opt an item out of dedup (always kept). */
  idOf: (produced: TProduced) => string;

  /** The deterministic coverage oracle: the full id set that MUST be covered
   *  (leaf FR∪NFR ids / component ids / leaf-AC ids). An EMPTY set ⇒ no
   *  reconciliation (pure per-chunk fan-out, e.g. SD-2 ADR). */
  targetCoverageSet: Set<string>;

  /** Which target ids a produced item covers — read every binding field the
   *  model uses interchangeably (traces_to ∪ CC.verifies, array-safe). Drives
   *  BOTH uncovered computation AND recon crediting. Ids outside the target set
   *  are ignored. */
  coveredBy: (produced: TProduced) => Iterable<string>;

  /** Partition the still-uncovered set into BOUNDED batches (typically a thin
   *  wrapper over chunkUncoveredByStory). Only called when there is uncovered
   *  work and maxReconPasses > 0. */
  chunkUncovered?: (uncovered: Set<string>) => Array<Set<string>>;

  /** One focused reconciliation call per uncovered batch → produced items.
   *  Contracted to catch its own errors and return []. Required only when a
   *  non-empty coverage set + maxReconPasses > 0 can drive reconciliation. */
  reconcileBatch?: (
    batch: Set<string>,
    passInfo: { pass: number; batchIndex: number; batchCount: number },
  ) => Promise<TProduced[]>;

  /** Bounded reconciliation passes (env-driven per phase; 0 ⇒ generation only). */
  maxReconPasses: number;

  /** Honest residual reporter — NO fabrication (usually wraps
   *  summarizeResidualDivergence). Called once, only if residual is non-empty. */
  onResidual?: (residual: Set<string>) => void;

  /** Structured-log tag, e.g. 'Phase 5.1'. */
  logLabel: string;
}

export interface ChunkedCoverageBloomResult<TProduced> {
  /** Deduped, merged across all chunks + reconciliation passes. */
  produced: TProduced[];
  /** 100 when targetCoverageSet is empty or fully covered. */
  coveragePct: number;
  /** Uncovered target ids after the pass budget is spent (empty ⇒ full coverage). */
  residual: Set<string>;
}

type BloomLog = ReturnType<typeof getLogger>;

/**
 * Append items not already `seen` (by `idOf`) to `produced`; return how many
 * were newly added. Mutates `produced` and `seen` in place. An empty id ('')
 * opts an item out of dedup (always kept). Extracted verbatim from the former
 * inner `pushUnique` closure.
 */
function pushUniqueProduced<TProduced>(
  items: TProduced[],
  produced: TProduced[],
  seen: Set<string>,
  idOf: (produced: TProduced) => string,
): number {
  let added = 0;
  for (const item of items) {
    const id = idOf(item);
    if (id && seen.has(id)) continue; // dedup across chunks + passes
    if (id) seen.add(id);
    produced.push(item);
    added++;
  }
  return added;
}

/** Recompute the still-uncovered target ids from everything produced so far. */
function computeUncoveredTargets<TChunk, TProduced>(
  cfg: ChunkedCoverageBloomConfig<TChunk, TProduced>,
  produced: TProduced[],
): Set<string> {
  if (cfg.targetCoverageSet.size === 0) return new Set<string>();
  const remaining = new Set(cfg.targetCoverageSet);
  for (const item of produced) {
    for (const id of cfg.coveredBy(item)) {
      remaining.delete(id);
    }
  }
  return remaining;
}

/** Per-chunk generation: ONE bounded call per primary item (SEQUENTIAL). */
async function runPerChunkGeneration<TChunk, TProduced>(
  cfg: ChunkedCoverageBloomConfig<TChunk, TProduced>,
  produced: TProduced[],
  seen: Set<string>,
  log: BloomLog,
): Promise<void> {
  for (let i = 0; i < cfg.chunks.length; i++) {
    try {
      const items = await cfg.generateForChunk(cfg.chunks[i], i);
      pushUniqueProduced(items, produced, seen, cfg.idOf);
    } catch (err) {
      // A single chunk's failure must not sink the bloom — the reconciliation
      // pass below recovers any targets it would have covered.
      log.warn('workflow', `${cfg.logLabel} per-chunk generation failed — continuing`, {
        chunk_index: i, error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/** Coverage-driven reconciliation is only possible with a non-empty target set,
 *  a positive pass budget, and BOTH reconciliation callbacks supplied. */
function canReconcile<TChunk, TProduced>(
  cfg: ChunkedCoverageBloomConfig<TChunk, TProduced>,
): boolean {
  return cfg.targetCoverageSet.size > 0
    && cfg.maxReconPasses > 0
    && !!cfg.chunkUncovered
    && !!cfg.reconcileBatch;
}

/** Robust crediting: keep only recon items that cover a still-uncovered target
 *  in THIS batch (matches P6.1 taskCoversAny). */
function filterBatchCovering<TProduced>(
  reconItems: TProduced[],
  batch: Set<string>,
  coveredBy: (produced: TProduced) => Iterable<string>,
): TProduced[] {
  return reconItems.filter((item) => {
    for (const id of coveredBy(item)) {
      if (batch.has(id)) return true;
    }
    return false;
  });
}

/** One reconciliation batch: generate → credit only batch-intersecting items →
 *  merge. Returns how many items were newly added to `produced`. */
async function runReconciliationBatch<TChunk, TProduced>(
  cfg: ChunkedCoverageBloomConfig<TChunk, TProduced>,
  produced: TProduced[],
  seen: Set<string>,
  log: BloomLog,
  batch: Set<string>,
  passInfo: { pass: number; batchIndex: number; batchCount: number },
): Promise<number> {
  let reconItems: TProduced[] = [];
  try {
    reconItems = await cfg.reconcileBatch!(batch, passInfo);
  } catch (err) {
    log.warn('workflow', `${cfg.logLabel} reconciliation batch failed — continuing`, {
      pass: passInfo.pass, batch_index: passInfo.batchIndex,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  const useful = filterBatchCovering(reconItems, batch, cfg.coveredBy);
  return pushUniqueProduced(useful, produced, seen, cfg.idOf);
}

/** Coverage-driven reconciliation: the orchestrator owns the 100% guarantee. */
async function runReconciliation<TChunk, TProduced>(
  cfg: ChunkedCoverageBloomConfig<TChunk, TProduced>,
  produced: TProduced[],
  seen: Set<string>,
  log: BloomLog,
): Promise<void> {
  for (let pass = 1; pass <= cfg.maxReconPasses; pass++) {
    const uncovered = computeUncoveredTargets(cfg, produced);
    if (uncovered.size === 0) break;
    const batches = cfg.chunkUncovered!(uncovered);
    log.info('workflow', `${cfg.logLabel} reconciliation pass — covering orphan targets in bounded batches`, {
      pass, uncovered: uncovered.size, total: cfg.targetCoverageSet.size, batches: batches.length,
    });
    let addedThisPass = 0;
    for (let b = 0; b < batches.length; b++) {
      addedThisPass += await runReconciliationBatch(
        cfg, produced, seen, log,
        batches[b], { pass, batchIndex: b + 1, batchCount: batches.length },
      );
    }
    if (addedThisPass === 0) break; // whole pass made no forward progress → stop (residual logged)
  }
}

/** Honest residual reporter — NO fabrication. Emits onResidual + a warn when
 *  targets remain, else a completion info when the target set was non-empty. */
function reportResidual<TChunk, TProduced>(
  cfg: ChunkedCoverageBloomConfig<TChunk, TProduced>,
  produced: TProduced[],
  residual: Set<string>,
  log: BloomLog,
): void {
  if (residual.size > 0) {
    cfg.onResidual?.(residual);
    log.warn('workflow', `${cfg.logLabel} residual uncovered targets after reconciliation (honest gap — not fabricated)`, {
      residual: residual.size, total: cfg.targetCoverageSet.size,
    });
  } else if (cfg.targetCoverageSet.size > 0) {
    log.info('workflow', `${cfg.logLabel} coverage complete (100%)`, {
      total: cfg.targetCoverageSet.size, produced: produced.length,
    });
  }
}

/**
 * Run the chunked-coverage bloom. Pure orchestration — all LLM/template/parse
 * work lives in the injected callbacks. A faithful generalization of
 * phase6.ts:674–770.
 */
export async function chunkedCoverageBloom<TChunk, TProduced>(
  cfg: ChunkedCoverageBloomConfig<TChunk, TProduced>,
): Promise<ChunkedCoverageBloomResult<TProduced>> {
  const log = getLogger();
  const produced: TProduced[] = [];
  const seen = new Set<string>();

  // ── Per-chunk generation: ONE bounded call per primary item (SEQUENTIAL) ──
  await runPerChunkGeneration(cfg, produced, seen, log);

  // ── Coverage-driven reconciliation: the orchestrator owns the 100% guarantee ──
  if (canReconcile(cfg)) {
    await runReconciliation(cfg, produced, seen, log);
  }

  // ── Honest residual — NO fabrication ──
  const residual = computeUncoveredTargets(cfg, produced);
  reportResidual(cfg, produced, residual, log);

  const total = cfg.targetCoverageSet.size;
  const coveragePct = total === 0 ? 100 : Math.round(((total - residual.size) / total) * 100);
  return { produced, coveragePct, residual };
}
