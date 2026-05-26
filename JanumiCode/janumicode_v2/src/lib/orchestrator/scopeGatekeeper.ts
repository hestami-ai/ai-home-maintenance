/**
 * Scope Gatekeeper — LLM-backed auto-prune for expansive bloom outputs.
 *
 * Problem this addresses:
 *   The bloom-style prompt templates deliberately instruct the LLM to
 *   "PROPOSE EXPANSIVELY" because they assume a human will Accept/Reject
 *   each item on a decision card. In thin-slice / `--auto-approve` runs
 *   there's no human, so the expansive proposal is accepted wholesale.
 *   ts-21 produced 26 business domains for a tinyurl spec; ts-22 produced
 *   18. The intent's explicit out-of-scope items (rate limiting, vanity
 *   slugs, etc.) leaked through.
 *
 * Solution:
 *   After every bloom artifact lands, the gatekeeper makes a SECOND LLM
 *   call (the "scope gatekeeper") with three inputs:
 *     - the intent doc
 *     - the bloom output items (id + label + description, per item)
 *     - a focused prune prompt
 *   The gatekeeper returns kept_ids + per-dropped-id rationales. We
 *   filter the bloom, supersede the original artifact, and write a
 *   scope_prune_decision audit record so every prune is forensically
 *   inspectable.
 *
 * Modes (per the design discussion that led to this module):
 *   - Calibrated (the only mode for now): drop items that are EITHER
 *     explicitly in the intent's Out-of-Scope section, OR cannot be
 *     traced to any FR/NFR/tech-constraint in the intent. Keep items
 *     that derive from constraints even if no FR mentions them.
 *
 * The gatekeeper is configured to be ALWAYS-ON (user decision in the
 * Path D design): production runs get it too, with the human's
 * downstream decision card seeing the pruned set rather than the raw
 * expansive proposal.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LLMCaller } from '../llm/llmCaller';
import { getLogger } from '../logging';
import type { AgentRole, PhaseId } from '../types/records';
import { tryParseJson } from '../llm/jsonRecovery';

export interface BloomItemForPrune {
  /** Stable id within the bloom output (e.g., 'DOM-RATE-LIMIT'). */
  id: string;
  /** One-line label (e.g., '[Domain] Rate Limiting'). */
  label: string;
  /** Optional fuller description. */
  description?: string;
  /** Optional rationale / source attribution from the bloom proposer. */
  tradeoffs?: string;
}

/**
 * Distilled context from upstream Phase 1 extraction sub-phases.
 * The gatekeeper uses these as ground truth, not the raw intent doc.
 * Rationale: Phase 1.0a/b/c/d/e/f already extracted the substantive
 * scope information (constraints, compliance, V&V, vocabulary, OOS
 * mentioned in the analysis summary). Re-running that extraction in
 * the gatekeeper would duplicate work AND risk diverging from the
 * canonical upstream extraction.
 *
 * Any field may be undefined — the gatekeeper degrades gracefully
 * (falls back to the intent doc when the structured context is empty).
 */
export interface GatekeeperUpstreamContext {
  /**
   * The Phase 1.0b intent_discovery analysisSummary — narrative
   * description of scope including informal out-of-scope mentions.
   */
  analysisSummary?: string;
  /** Positive constraints from intent_discovery.constraints. */
  intentConstraints?: Array<{ id?: string; text: string }>;
  /** Positive requirements from intent_discovery.requirements. */
  intentRequirements?: Array<{ id?: string; text: string }>;
  /** Open questions from intent_discovery.openQuestions. */
  intentOpenQuestions?: Array<{ id?: string; text: string }>;
  /** Phase 1.0c technical constraints (Postgres, HTTPS, etc.). */
  technicalConstraints?: Array<{ id?: string; text: string }>;
  /** Phase 1.0d compliance items (GDPR, encryption-at-rest, etc.). */
  complianceItems?: Array<{ id?: string; text: string; type?: string }>;
  /** Phase 1.0e V&V requirements. */
  vvRequirements?: Array<{ id?: string; target?: string; threshold?: string }>;
  /** Phase 1.1b scope_classification (breadth/depth). */
  scopeClassification?: { breadth?: string; depth?: string };
  /**
   * Last-resort raw intent doc text — for verification only. The
   * gatekeeper is instructed to prefer the structured context above.
   */
  rawIntentDoc?: string;
  /**
   * Accepted member-drop outputs from prior bloom sub-phases. These
   * are populated incrementally as each Phase 1.2-1.5 member-drop
   * bloom completes its gatekeeper prune. A downstream bloom's
   * gatekeeper uses these as the "accepted upstream set" — e.g., the
   * journey gatekeeper checks that each journey's persona is in
   * `acceptedPersonas`, the workflow gatekeeper checks each workflow
   * traces to an `acceptedJourney`, etc.
   *
   * Without this, downstream gatekeepers would re-derive "accepted"
   * from the Analysis Summary's narrative mentions, which is
   * narrower than the bloom-gatekeeper kept set and produces false
   * drops (ts-23 seq=11: journey gatekeeper dropped API journeys
   * because Analysis Summary names only 2 personas while
   * business_domains_bloom kept P-API_USER).
   *
   * Each field is optional; only populate sub-phases that have run.
   */
  acceptedDomains?: Array<{ id: string; name: string; description?: string }>;
  acceptedPersonas?: Array<{ id: string; name: string; description?: string }>;
  acceptedJourneys?: Array<{ id: string; title: string; personaId?: string }>;
  acceptedWorkflows?: Array<{ id: string; name: string; businessDomainId?: string }>;
  acceptedEntities?: Array<{ id: string; name: string; businessDomainId?: string }>;
}

export interface GatekeeperConfig {
  workflowRunId: string;
  phaseId: PhaseId;
  subPhaseId: string;
  /** Short human-readable description of what's being pruned. */
  bloomDescription: string;
  /** Items the gatekeeper should KEEP-or-DROP. */
  items: BloomItemForPrune[];
  /** Distilled upstream-extraction context (preferred ground truth). */
  upstreamContext: GatekeeperUpstreamContext;
  /**
   * LLM routing — defaults to the orchestrator's `domain_interpreter`
   * role (same routing as the bloom proposer). Callers can override to
   * a different routing if they want.
   */
  agentRole?: AgentRole;
  /**
   * Optional sub-phase-specific overlay spliced into the prompt
   * between the base criteria and the upstream context. Used to add
   * artifact-shape-specific guidance (e.g., vendor-specificity for
   * integrations, role-definition for personas) without bloating the
   * shared base prompt.
   *
   * Architecture: the base prompt defines the universal procedure
   * (Pass 1 literal-match + Pass 2 grounding default-keep). Overlays
   * add narrow guidance for shapes whose grounding semantics differ
   * (e.g., "vendor-named items require a literal vendor mention
   * upstream"). Overlays are additive; they cannot override the
   * universal procedure.
   *
   * For sub-phases whose operation is fundamentally different (e.g.,
   * release_plan ordering + coverage), use `customPromptBuilder`
   * rather than an overlay — overlays cannot redefine the base
   * procedure.
   */
  overlay?: string;
  /**
   * Optional fully-custom prompt builder. When provided, replaces
   * `buildGatekeeperPrompt` for this invocation. Use this when a
   * sub-phase needs an operation that is fundamentally different
   * from the shared member-drop procedure (Option A in the
   * per-sub-phase architecture).
   *
   * The post-processing (parsing, contradiction detection, fallback
   * to "keep all") is shared regardless of which builder is used.
   * The output contract on the JSON shape returned by the LLM is
   * still expected to be { kept_ids, dropped, rationale_summary }
   * — custom builders should preserve that contract.
   */
  customPromptBuilder?: (cfg: GatekeeperConfig) => string;
}

export interface GatekeeperResult {
  /** IDs the gatekeeper kept. May be all of `items`. */
  kept_ids: string[];
  /** IDs the gatekeeper dropped, each with a rationale. */
  dropped: Array<{ id: string; reason: string }>;
  /** Overall one-paragraph justification. */
  rationale_summary: string;
  /** Provider/model used. */
  provider: string;
  model: string;
  /** Wall-clock for the LLM call. */
  duration_ms: number;
  /** When the LLM call failed and we couldn't prune, this is set. */
  error?: string;
}

/**
 * Render a single upstream-context section. Returns an empty string
 * when the list is empty, so the prompt stays compact when a section
 * has nothing to contribute.
 */
function renderUpstreamSection(label: string, items: Array<unknown> | undefined): string {
  if (!items || items.length === 0) return '';
  const lines: string[] = [`## ${label}`];
  for (const it of items) {
    if (it && typeof it === 'object') {
      const o = it as Record<string, unknown>;
      const id = typeof o.id === 'string' ? o.id : '';
      const text =
        (typeof o.text === 'string' && o.text) ||
        (typeof o.target === 'string' && o.target) ||
        '';
      const type = typeof o.type === 'string' ? ` [${o.type}]` : '';
      const threshold = typeof o.threshold === 'string' ? `  (threshold: ${o.threshold})` : '';
      const idStr = id ? `${id}: ` : '';
      lines.push(`  - ${idStr}${type ? type + ' ' : ''}${text}${threshold}`);
    }
  }
  return lines.join('\n') + '\n';
}

/**
 * Build the gatekeeper prompt. The prompt anchors the LLM in the
 * DISTILLED upstream extraction artifacts (Phase 1.0a-f outputs) so
 * the gatekeeper doesn't have to re-extract scope information from
 * the raw intent doc. The raw intent is included as a last-resort
 * cross-check when the structured context isn't enough.
 */
function buildGatekeeperPrompt(cfg: GatekeeperConfig): string {
  const itemList = cfg.items
    .map((it) => {
      const desc = it.description ? `\n      description: ${it.description.slice(0, 400)}` : '';
      const tradeoffs = it.tradeoffs ? `\n      tradeoffs: ${it.tradeoffs.slice(0, 200)}` : '';
      return `  - id: ${it.id}\n      label: ${it.label}${desc}${tradeoffs}`;
    })
    .join('\n');

  const u = cfg.upstreamContext;

  const upstreamBlocks = [
    u.analysisSummary
      ? `## Upstream Analysis Summary (Phase 1.0b — narrative, includes informal out-of-scope mentions)\n\n${u.analysisSummary}\n`
      : '',
    u.scopeClassification
      ? `## Upstream Scope Classification (Phase 1.1b)\n\n  - breadth: ${u.scopeClassification.breadth ?? '?'}\n  - depth:   ${u.scopeClassification.depth ?? '?'}\n`
      : '',
    renderUpstreamSection('Upstream Intent Constraints (Phase 1.0b positive constraints)', u.intentConstraints),
    renderUpstreamSection('Upstream Intent Requirements (Phase 1.0b positive requirements)', u.intentRequirements),
    renderUpstreamSection('Upstream Intent Open Questions (Phase 1.0b)', u.intentOpenQuestions),
    renderUpstreamSection('Upstream Technical Constraints (Phase 1.0c — Postgres, HTTPS, etc.)', u.technicalConstraints),
    renderUpstreamSection('Upstream Compliance Items (Phase 1.0d — GDPR, encryption, etc.)', u.complianceItems),
    renderUpstreamSection('Upstream V&V Requirements (Phase 1.0e — NFR-1/2/3 derivations)', u.vvRequirements),
    // Accepted sets from prior member-drop blooms. These are the
    // AUTHORITATIVE list of upstream-accepted items downstream
    // gatekeepers should reference (e.g., the journey gatekeeper
    // checks that a journey's persona appears in acceptedPersonas).
    renderUpstreamSection('Accepted Domains (kept by business_domains_bloom gatekeeper)', u.acceptedDomains),
    renderUpstreamSection('Accepted Personas (kept by business_domains_bloom gatekeeper)', u.acceptedPersonas),
    renderUpstreamSection('Accepted User Journeys (kept by user_journey_bloom gatekeeper)', u.acceptedJourneys?.map(j => ({ id: j.id, text: j.title + (j.personaId ? ` [persona: ${j.personaId}]` : '') }))),
    renderUpstreamSection('Accepted System Workflows (kept by system_workflow_bloom gatekeeper)', u.acceptedWorkflows?.map(w => ({ id: w.id, text: w.name + (w.businessDomainId ? ` [domain: ${w.businessDomainId}]` : '') }))),
    renderUpstreamSection('Accepted Entities (kept by entities_bloom gatekeeper)', u.acceptedEntities?.map(e => ({ id: e.id, text: e.name + (e.businessDomainId ? ` [domain: ${e.businessDomainId}]` : '') }))),
  ].filter((b) => b.length > 0).join('\n');

  const rawIntentBlock = u.rawIntentDoc
    ? `\n# Raw Intent Document (last-resort cross-check only)\n\nDo NOT re-extract scope from this — prefer the upstream extractions above. Use this only to disambiguate edge cases.\n\n\`\`\`\n${u.rawIntentDoc.slice(0, 8000)}\n\`\`\`\n`
    : '';

  return `[JC:SYSTEM SCOPE]
You are the SCOPE GATEKEEPER for a multi-phase software workflow.

A prior phase produced an EXPANSIVE list of ${cfg.bloomDescription} from
a bloom-style proposer that was instructed to over-generate. Your job
is to prune that list to ONLY the items properly in-scope for the
product, using the DISTILLED upstream extraction artifacts below as
ground truth.

# Calibrated criteria

You evaluate each input item in TWO passes. Pass 1 is the HARD DROP
rule — items contradicted by explicit upstream constraints. Pass 2 is
the soft keep/drop based on upstream grounding.

## Pass 1 — MUST DROP (explicit constraint contradictions)

If an upstream Intent Constraint, Technical Constraint, or Analysis
Summary contains a "no X" / "X out of scope" / "X not in scope" /
"X forbidden" / "X not supported" statement, and an input item IS
that X, the item MUST be dropped.

### Two valid Pass 1 drop patterns

Pattern 1 — **Literal match**: an upstream constraint forbids X,
and the item IS X (explicitly named X or a near-synonym such as
"X management", "X registry").

Pattern 2 — **Inherent requirement**: an upstream constraint
forbids X, and the item by definition requires X — meaning a
coherent version of the item cannot exist when X is absent.

Items that *commonly pair with* the forbidden feature but do not
*require* it are NOT Pass 1 cases. Pass 2 may still drop them on
upstream-grounding grounds, but the contradiction is not direct
enough to qualify as a hard drop.

### Procedure for Pattern 2 (the inherent-requirement test)

For each input item, after the literal-match check:

  1. Scan the upstream constraints for any "no <X>" / "out of
     scope" statement.
  2. Read the item's label and description.
  3. Ask: would this item's definition still describe a coherent
     thing if X were absent from the system?
       - If NO (the item's identity hinges on X) → DROP (Pattern 2).
       - If YES (the item could exist in a coherent form without
         X) → this is a common pairing, not an inherent requirement.
         Not a Pass 1 case; defer to Pass 2.

Apply this test conservatively. Default to "could exist without X"
(KEEP for Pass 1 purposes) unless you can articulate why the
item's identity collapses without X.

### Rationale requirement

For every Pass 1 drop, the rationale MUST:
  - QUOTE the constraint text verbatim.
  - Identify which pattern was used (literal-match or
    inherent-requirement).
  - For inherent-requirement drops, briefly explain why the item
    cannot coherently exist without the forbidden feature.

### Anti-pattern: implication-chain drops (do not use)

Do NOT drop in Pass 1 using inference chains of the form:
  "Item enables auth/API/UI/dashboards/...,
   therefore it requires user accounts/multi-tenancy/...,
   therefore the 'no X' constraint forbids it."

These chains are usually wrong. Public APIs do not require user
accounts. Request-level authentication is not the same as identified
users. A dashboard reading a single counter is not 'advanced
analytics'. If you find yourself constructing such a chain, the item
is not a Pass 1 candidate — pass it through to Pass 2.

## Pass 2 — soft keep/drop (upstream grounding)

For items that survive Pass 1, the default is KEEP. Drop only when
there is a clear, articulable reason. False keeps are cheap (a
downstream phase reads one extra item). False drops are expensive
(a downstream phase silently misses a concept the spec needed).

### KEEP an item when ANY of these holds

  - It maps to an upstream Intent Requirement or Intent Constraint.
  - It is the infrastructure that satisfies an upstream Technical
    Constraint (the constraint mandates a technology / property; the
    item provides it).
  - It addresses an upstream Compliance Item.
  - It is required to satisfy an upstream V&V Requirement.
  - It appears (even informally) in any upstream user journey,
    scenario, persona description, vocabulary entry, or analysis
    summary. Passing mentions count — the concept being present in
    the upstream story is enough.
  - It supports a feature whose grounding the proposer cited in the
    item's own tradeoffs / description field. Read those before
    deciding.

### DROP an item only when

  - It is a generic industry-standard adjacency with NO upstream
    text supporting it. The pattern: the proposer added it because
    "products like this usually have one", and a literal scan of
    every upstream artifact (constraints, requirements, journeys,
    personas, vocabulary, V&V, compliance, analysis summary) turns
    up zero mention of the concept.
  - It conflicts with the upstream Scope Classification
    (breadth × depth). Example shape: an enterprise-scale concern
    proposed when breadth=single_product and depth=prototype.

### Required final check before any Pass 2 drop

Before dropping an item, scan the upstream artifacts one more time
for the concept's name AND its common synonyms. If you find ANY
upstream mention — formal or informal, primary or secondary — KEEP.
A drop is justified only when truly nothing upstream supports the
item.

When genuinely ambiguous in Pass 2, KEEP. (Pass 1 contradictions are
never ambiguous — those always drop.)
${cfg.overlay ? `\n# Sub-phase-specific guidance (overlay)\n\n${cfg.overlay}\n` : ''}
# Upstream Extraction Context (ground truth)

${upstreamBlocks}
${rawIntentBlock}

# Proposed Items to Prune (${cfg.items.length} total)

${itemList}

# Output Contract

Return a SINGLE valid JSON object with this exact shape — no markdown,
no prose, no code fences, no trailing commas:

{
  "kept_ids": ["<id>", "<id>", ...],
  "dropped": [
    { "id": "<id>", "reason": "<one-sentence rationale citing a specific upstream artifact>" }
  ],
  "rationale_summary": "<one paragraph explaining the overall pruning approach for this list>"
}

Every id in the input MUST appear in EITHER kept_ids OR dropped.
Every dropped id MUST have a reason that cites a specific upstream
artifact entry (e.g., "Analysis Summary excludes rate limiting" or
"No upstream Technical Constraint mentions CI/CD").
`;
}

/**
 * Invoke the gatekeeper LLM and return a parsed result. On any failure
 * (LLM throw, JSON parse fail, schema mismatch), returns a degenerate
 * result that keeps ALL items so the workflow doesn't lose data.
 */
export async function runScopeGatekeeperPrune(
  llmCaller: LLMCaller,
  routing: { provider: string; model: string; baseUrl?: string },
  cfg: GatekeeperConfig,
): Promise<GatekeeperResult> {
  if (cfg.items.length === 0) {
    return {
      kept_ids: [],
      dropped: [],
      rationale_summary: 'no items to prune',
      provider: routing.provider,
      model: routing.model,
      duration_ms: 0,
    };
  }

  const prompt = (cfg.customPromptBuilder ?? buildGatekeeperPrompt)(cfg);
  const started = Date.now();
  let result;
  try {
    result = await llmCaller.call({
      provider: routing.provider,
      model: routing.model,
      baseUrl: routing.baseUrl,
      prompt,
      responseFormat: 'json',
      temperature: 0.2,
      traceContext: {
        workflowRunId: cfg.workflowRunId,
        phaseId: cfg.phaseId,
        subPhaseId: cfg.subPhaseId,
        agentRole: cfg.agentRole ?? 'domain_interpreter',
        label: `Scope Gatekeeper — ${cfg.subPhaseId}`,
      },
    });
  } catch (err) {
    getLogger().warn('workflow', 'Scope gatekeeper LLM call failed — keeping all items as fallback', {
      workflow_run_id: cfg.workflowRunId,
      sub_phase_id: cfg.subPhaseId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      kept_ids: cfg.items.map((it) => it.id),
      dropped: [],
      rationale_summary: 'gatekeeper LLM call failed; keeping all items',
      provider: routing.provider,
      model: routing.model,
      duration_ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  const duration_ms = Date.now() - started;

  // Parse — tolerant of LLM wrapping the JSON in some envelope.
  let parsed = result.parsed as Record<string, unknown> | null;
  if (!parsed && typeof result.text === 'string' && result.text.trim().length > 0) {
    const recovered = tryParseJson(result.text);
    parsed = recovered.parsed;
  }
  if (!parsed) {
    getLogger().warn('workflow', 'Scope gatekeeper returned unparseable JSON — keeping all items', {
      workflow_run_id: cfg.workflowRunId,
      sub_phase_id: cfg.subPhaseId,
    });
    return {
      kept_ids: cfg.items.map((it) => it.id),
      dropped: [],
      rationale_summary: 'gatekeeper response unparseable; keeping all items',
      provider: result.provider,
      model: result.model,
      duration_ms,
      error: 'unparseable_json',
    };
  }

  const kept_ids = Array.isArray(parsed.kept_ids)
    ? (parsed.kept_ids as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const droppedRaw = Array.isArray(parsed.dropped) ? (parsed.dropped as unknown[]) : [];
  const dropped: Array<{ id: string; reason: string }> = [];
  for (const d of droppedRaw) {
    if (d && typeof d === 'object') {
      const o = d as Record<string, unknown>;
      if (typeof o.id === 'string' && typeof o.reason === 'string') {
        dropped.push({ id: o.id, reason: o.reason });
      }
    }
  }
  const rationale_summary = typeof parsed.rationale_summary === 'string'
    ? parsed.rationale_summary
    : 'no summary provided';

  // Defensive: ensure every input item is accounted for. Items missing
  // from BOTH kept and dropped get kept (calibrated mode favours keeping).
  const inputIds = new Set(cfg.items.map((it) => it.id));
  const accountedFor = new Set([...kept_ids, ...dropped.map((d) => d.id)]);
  const unaccounted = [...inputIds].filter((id) => !accountedFor.has(id));
  // Strip drops that reference unknown ids (the LLM may have hallucinated).
  const finalDropped = dropped.filter((d) => inputIds.has(d.id));
  const droppedSet = new Set(finalDropped.map((d) => d.id));
  // DEFECT-2 fix: when an id appears in BOTH kept_ids AND dropped[],
  // prefer drop. The LLM emitted an explicit rationale for dropping;
  // honor that signal over the membership in kept_ids (which the model
  // may have populated as "every id" without filtering). Without this,
  // ts-23 seq=12 kept `DOM-RESOURCE-ALLOCATION` despite the gatekeeper
  // emitting a valid drop rationale citing no upstream support.
  const contradictions = kept_ids.filter((id) => droppedSet.has(id));
  const finalKept = [...new Set([...kept_ids, ...unaccounted])]
    .filter((id) => inputIds.has(id))
    .filter((id) => !droppedSet.has(id));

  if (unaccounted.length > 0) {
    getLogger().info('workflow', 'Scope gatekeeper omitted some ids; defaulting to keep', {
      workflow_run_id: cfg.workflowRunId,
      sub_phase_id: cfg.subPhaseId,
      unaccounted_count: unaccounted.length,
    });
  }
  if (contradictions.length > 0) {
    getLogger().warn('workflow', 'Scope gatekeeper emitted contradictory keep+drop for same ids; preferring drop', {
      workflow_run_id: cfg.workflowRunId,
      sub_phase_id: cfg.subPhaseId,
      contradicted_ids: contradictions,
    });
  }

  return {
    kept_ids: finalKept,
    dropped: finalDropped,
    rationale_summary,
    provider: result.provider,
    model: result.model,
    duration_ms,
  };
}

/**
 * Dedicated prompt builder for release_plan_bloom. The operation here
 * is fundamentally different from the other Phase 1 blooms:
 *
 *   - Other blooms = "drop items that do not ground in upstream"
 *   - release_plan = "drop releases that are malformed, mis-ordered,
 *     or reference artifacts not in the upstream-accepted set"
 *
 * The shared base prompt's "Pass 1 / Pass 2 / KEEP-by-default"
 * procedure doesn't quite fit: a release is rarely "ungrounded" in
 * the same sense (it's a temporal slice, not a domain concept). The
 * meaningful drops are structural (empty contains, duplicated
 * ordinals, references to dropped artifacts, etc.).
 *
 * Output contract is preserved: { kept_ids, dropped, rationale_summary }
 * so the shared post-processing applies unchanged.
 */
export function buildReleasePlanGatekeeperPrompt(cfg: GatekeeperConfig): string {
  const itemList = cfg.items
    .map((it) => {
      const desc = it.description ? `\n      description: ${it.description.slice(0, 600)}` : '';
      const tradeoffs = it.tradeoffs ? `\n      tradeoffs: ${it.tradeoffs.slice(0, 400)}` : '';
      return `  - id: ${it.id}\n      label: ${it.label}${desc}${tradeoffs}`;
    })
    .join('\n');

  const u = cfg.upstreamContext;
  const upstreamBlocks = [
    u.analysisSummary
      ? `## Upstream Analysis Summary\n\n${u.analysisSummary}\n`
      : '',
    u.scopeClassification
      ? `## Upstream Scope Classification\n\n  - breadth: ${u.scopeClassification.breadth ?? '?'}\n  - depth:   ${u.scopeClassification.depth ?? '?'}\n`
      : '',
    renderUpstreamSection('Upstream Intent Constraints', u.intentConstraints),
    renderUpstreamSection('Upstream Intent Requirements', u.intentRequirements),
    renderUpstreamSection('Upstream Compliance Items', u.complianceItems),
  ].filter((b) => b.length > 0).join('\n');

  return `[JC:SYSTEM RELEASE-PLAN GATEKEEPER]
You are evaluating a proposed RELEASE PLAN for a software product.
Each release slices the accepted upstream artifacts (journeys,
workflows, entities, integrations, compliance items, vocabulary) into
an ordered sequence of deliverables, with a cross-cutting bucket for
artifacts that span multiple releases.

Your role here is narrower than a scope gatekeeper: you drop releases
that are MALFORMED, structurally invalid, or whose scope is obviously
out of bounds. The downstream deterministic 1.8 verifier handles
ordinal sequencing, dependency direction, and exact coverage; you do
NOT need to verify those.

# When to DROP a release

Drop a release when ANY of these holds:

  - The release's contains lists reference upstream artifacts that do
    not exist (the proposer hallucinated an id).
  - The release's description describes features that EXPLICITLY
    contradict an upstream Intent Constraint (e.g., a release that
    introduces "user accounts" when CON-N forbids user accounts).
    Cite the constraint in the rationale.
  - The release is empty (no contained artifacts AND not cross-cutting).
  - The release's name/description is generic placeholder text
    ("TBD release", "future release", "miscellaneous") with no
    discernible scope tied to upstream artifacts.

# When to KEEP a release

Default to KEEP. Releases that are structurally well-formed and whose
contained artifacts trace to the upstream-accepted set are in scope,
even if their ordering looks suboptimal — the deterministic verifier
handles ordering.

# Anti-patterns (do NOT drop for these)

  - Do NOT drop a release for being "too small" or "too large".
  - Do NOT drop a release because its ordinal seems wrong relative to
    its dependencies. The deterministic 1.8 verifier handles that.
  - Do NOT drop a release because cross_cutting could absorb its
    artifacts. Release-vs-cross-cutting placement is a human/
    deterministic concern.
  - Do NOT use implication chains. "This release implies X which
    requires Y which violates Z" is invalid here just as in the
    member-drop gatekeepers.

# Upstream Extraction Context

${upstreamBlocks}

# Proposed Releases to Evaluate (${cfg.items.length} total)

${itemList}

# Output Contract

Return a SINGLE valid JSON object with this exact shape — no markdown,
no prose, no code fences, no trailing commas:

{
  "kept_ids": ["<release_id>", ...],
  "dropped": [
    { "id": "<release_id>", "reason": "<one-sentence structural rationale>" }
  ],
  "rationale_summary": "<one paragraph on the overall evaluation>"
}

Every input release id MUST appear in EITHER kept_ids OR dropped.
`;
}

/**
 * Convenience helper: load the intent doc from the workspace's
 * .janumicode/intent.md file. Returns empty string when not present
 * (which makes the gatekeeper degrade to "keep all" — useful for
 * test scenarios where there's no intent doc).
 */
export function loadIntentDoc(workspacePath: string): string {
  const p = path.join(workspacePath, '.janumicode', 'intent.md');
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}
