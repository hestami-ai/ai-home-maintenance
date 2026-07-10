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
  /**
   * Optional pre-formatted multi-line detail block rendered verbatim by
   * prompt builders that need MORE than the one-line label/tradeoffs —
   * e.g. the release_plan gatekeeper, whose DROP rules require the actual
   * contained artifact ids (not just their counts) to id-match against
   * the accepted sets. Kept generic so other custom-prompt gatekeepers
   * can carry structured evidence the flat fields can't hold.
   */
  detail?: string;
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
  /**
   * Downstream-phase accepted sets (post-gatekeeper). Populated when
   * the gatekeeper runs at Phase 2+ exits, so each later phase's
   * gatekeeper has the canonical pruned upstream set to cross-check
   * against (e.g., Phase 4 component gatekeeper checks that each
   * component's `traces_to` US ids appear in `acceptedUserStories`).
   *
   * Each field is optional — only the phases that have completed
   * their gatekeeper pass populate them.
   */
  acceptedUserStories?: Array<{ id: string; action: string; role?: string; outcome?: string }>;
  acceptedNfrs?: Array<{ id: string; category?: string; description?: string; threshold?: string }>;
  acceptedComponents?: Array<{ id: string; name: string; domain_id?: string }>;
  /**
   * Phase 4.1 software domains (ids like `domain-shortening`). DISTINCT
   * from `acceptedDomains` (Phase 1 BUSINESS domains, ids like
   * `DOM-URL_SHORTENING`). Phase 4.2 components reference SOFTWARE-domain
   * ids in their `domain_id`, so the component gatekeeper must validate
   * `domain_id` membership against THIS set, not the business-domain set
   * (ts-113: checking against business domains dropped every component —
   * `domain-shortening` ∉ `{DOM-URL_SHORTENING…}`). Software domains are
   * already scope-bounded (4.1 only derives them from accepted business
   * domains), so membership here is a sufficient scope check.
   */
  acceptedSoftwareDomains?: Array<{ id: string; name: string }>;
}

/**
 * Map of gatekeeper sub-phase id → the `accepted*` upstream-context
 * field(s) that THAT sub-phase's own bloom produces.
 *
 * Why this exists: every gatekeeper's bloom artifact is written to the
 * governed stream BEFORE its gatekeeper runs. The upstream-context
 * collectors read the latest current-version artifact for each kind, so
 * a gatekeeper would otherwise receive its OWN un-pruned proposal as the
 * "## Accepted X (kept by <this> gatekeeper)" section — a circular
 * "you already accepted all of these" signal that biases the LLM toward
 * keep-all and overrides its Pass-1/Pass-2 drop reasoning. (ts-112
 * business_domains_bloom: proposer over-bloomed 40 domains incl.
 * Kubernetes/Docker/CI-CD; the gatekeeper reasoned "drop X, drop Y" then
 * reversed to keep all 49 because its prompt listed all 40 as already
 * accepted. ts-110 resisted it nondeterministically.)
 *
 * The `accepted*` sets are meant to carry forward what EARLIER
 * (already-pruned) gatekeepers accepted — never the current sub-phase's
 * own output. `stripSelfProducedAcceptedSets` nulls the owned field(s)
 * so the gatekeeper grounds its decision on the spec extractions + truly
 * upstream accepted sets, not on itself.
 */
export const SELF_PRODUCED_ACCEPTED_FIELDS: Record<string, Array<keyof GatekeeperUpstreamContext>> = {
  // Phase 1 member-drop blooms.
  business_domains_bloom: ['acceptedDomains', 'acceptedPersonas'],
  user_journey_bloom: ['acceptedJourneys'],
  system_workflow_bloom: ['acceptedWorkflows'],
  entities_bloom: ['acceptedEntities'],
  // Phase 2/4 downstream blooms (Phase 6 task_skeleton / Phase 7
  // test_case_skeleton produce no `accepted*` field, so no self-ref).
  fr_bloom_skeleton: ['acceptedUserStories'],
  nfr_bloom_skeleton: ['acceptedNfrs'],
  component_skeleton: ['acceptedComponents'],
};

/**
 * Return a copy of the upstream context with the `accepted*` field(s)
 * produced by `subPhaseId`'s own bloom removed, so a gatekeeper never
 * sees its own un-pruned proposal as an already-accepted set. No-op for
 * sub-phases not in {@link SELF_PRODUCED_ACCEPTED_FIELDS}.
 */
export function stripSelfProducedAcceptedSets(
  ctx: GatekeeperUpstreamContext,
  subPhaseId: string,
): GatekeeperUpstreamContext {
  const owned = SELF_PRODUCED_ACCEPTED_FIELDS[subPhaseId];
  if (!owned || owned.length === 0) return ctx;
  const out: GatekeeperUpstreamContext = { ...ctx };
  for (const field of owned) delete out[field];
  return out;
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
    const line = renderUpstreamItemLine(it);
    if (line !== null) lines.push(line);
  }
  return lines.join('\n') + '\n';
}

/**
 * Render one upstream-context item to a bullet line, or `null` when the
 * item is not a renderable object (so the caller skips it). Reads the
 * loosely-typed shape shared across the upstream sections: `id`, `text`
 * (falling back to `target`), `type`, and `threshold`.
 */
function renderUpstreamItemLine(it: unknown): string | null {
  if (!it || typeof it !== 'object') return null;
  const o = it as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  const text =
    (typeof o.text === 'string' && o.text) ||
    (typeof o.target === 'string' && o.target) ||
    '';
  const type = typeof o.type === 'string' ? ` [${o.type}]` : '';
  const threshold = typeof o.threshold === 'string' ? `  (threshold: ${o.threshold})` : '';
  const idStr = id ? `${id}: ` : '';
  return `  - ${idStr}${type ? type + ' ' : ''}${text}${threshold}`;
}

/**
 * Build the gatekeeper prompt. The prompt anchors the LLM in the
 * DISTILLED upstream extraction artifacts (Phase 1.0a-f outputs) so
 * the gatekeeper doesn't have to re-extract scope information from
 * the raw intent doc. The raw intent is included as a last-resort
 * cross-check when the structured context isn't enough.
 */
export function buildGatekeeperPrompt(cfg: GatekeeperConfig): string {
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
    renderUpstreamSection('Accepted Software Domains (Phase 4.1 — components reference THESE domain_id values, e.g. domain-shortening; NOT the business DOM-* ids above)', u.acceptedSoftwareDomains),
    renderUpstreamSection('Accepted User Journeys (kept by user_journey_bloom gatekeeper)', u.acceptedJourneys?.map(j => ({ id: j.id, text: j.title + (j.personaId ? ` [persona: ${j.personaId}]` : '') }))),
    renderUpstreamSection('Accepted System Workflows (kept by system_workflow_bloom gatekeeper)', u.acceptedWorkflows?.map(w => ({ id: w.id, text: w.name + (w.businessDomainId ? ` [domain: ${w.businessDomainId}]` : '') }))),
    renderUpstreamSection('Accepted Entities (kept by entities_bloom gatekeeper)', u.acceptedEntities?.map(e => ({ id: e.id, text: e.name + (e.businessDomainId ? ` [domain: ${e.businessDomainId}]` : '') }))),
    renderUpstreamSection('Accepted User Stories (kept by Phase 2.1 fr_bloom_skeleton gatekeeper)', u.acceptedUserStories?.map(s => ({ id: s.id, text: s.action + (s.role ? ` [role: ${s.role}]` : '') + (s.outcome ? ` → ${s.outcome}` : '') }))),
    renderUpstreamSection('Accepted NFRs (kept by Phase 2.2 nfr_bloom_skeleton gatekeeper)', u.acceptedNfrs?.map(n => ({ id: n.id, text: (n.category ? `[${n.category}] ` : '') + (n.description ?? '') + (n.threshold ? ` (threshold: ${n.threshold})` : '') }))),
    renderUpstreamSection('Accepted Components (kept by Phase 4.2 component_skeleton gatekeeper)', u.acceptedComponents?.map(c => ({ id: c.id, text: c.name + (c.domain_id ? ` [domain: ${c.domain_id}]` : '') }))),
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
      error: gatekeeperErrorMessage(err),
    });
    return {
      kept_ids: cfg.items.map((it) => it.id),
      dropped: [],
      rationale_summary: 'gatekeeper LLM call failed; keeping all items',
      provider: routing.provider,
      model: routing.model,
      duration_ms: Date.now() - started,
      error: gatekeeperErrorMessage(err),
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

  return reconcileGatekeeperDecision(parsed, cfg, result.provider, result.model, duration_ms);
}

/** Normalize a thrown value to a message string (Error.message or String). */
function gatekeeperErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Parse the LLM's raw `dropped[]` array into validated {id, reason}
 * entries, skipping any entry that is not an object or is missing a
 * string `id` / `reason`.
 */
function parseDroppedEntries(droppedRaw: unknown[]): Array<{ id: string; reason: string }> {
  const dropped: Array<{ id: string; reason: string }> = [];
  for (const d of droppedRaw) {
    if (!d || typeof d !== 'object') continue;
    const o = d as Record<string, unknown>;
    if (typeof o.id === 'string' && typeof o.reason === 'string') {
      dropped.push({ id: o.id, reason: o.reason });
    }
  }
  return dropped;
}

/**
 * Deterministic literal-match safety net for ids the LLM omitted from
 * BOTH kept_ids and dropped. For each unaccounted id, force-drop it when
 * `deterministicLiteralDrop` finds a matching negative upstream
 * constraint. Preserves `unaccounted` ordering.
 */
function computeSafetyNetDrops(
  unaccounted: string[],
  items: BloomItemForPrune[],
  ctx: GatekeeperUpstreamContext,
): Array<{ id: string; reason: string }> {
  const drops: Array<{ id: string; reason: string }> = [];
  for (const id of unaccounted) {
    const item = items.find((it) => it.id === id);
    if (!item) continue;
    const hit = deterministicLiteralDrop(item, ctx);
    if (hit) drops.push({ id, reason: hit });
  }
  return drops;
}

/**
 * Shared post-processing for a successfully-parsed gatekeeper response:
 * extracts kept/dropped/rationale, reconciles unaccounted ids (safety
 * net + default-keep), resolves keep/drop contradictions (drop wins),
 * and assembles the final GatekeeperResult.
 */
function reconcileGatekeeperDecision(
  parsed: Record<string, unknown>,
  cfg: GatekeeperConfig,
  provider: string,
  model: string,
  duration_ms: number,
): GatekeeperResult {
  const kept_ids = Array.isArray(parsed.kept_ids)
    ? (parsed.kept_ids as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const droppedRaw = Array.isArray(parsed.dropped) ? (parsed.dropped as unknown[]) : [];
  const dropped = parseDroppedEntries(droppedRaw);
  const rationale_summary = typeof parsed.rationale_summary === 'string'
    ? parsed.rationale_summary
    : 'no summary provided';

  // Defensive: ensure every input item is accounted for. Items missing
  // from BOTH kept and dropped get a deterministic literal-match safety
  // net (see `deterministicLiteralDrop` below); anything still
  // unmatched defaults to KEEP — calibrated mode favours keeping when
  // the model and the safety net are both unsure.
  const inputIds = new Set(cfg.items.map((it) => it.id));
  const accountedFor = new Set([...kept_ids, ...dropped.map((d) => d.id)]);
  const unaccounted = [...inputIds].filter((id) => !accountedFor.has(id));
  // Strip drops that reference unknown ids (the LLM may have hallucinated).
  const finalDropped = dropped.filter((d) => inputIds.has(d.id));

  // ts-110 defect: gpt-oss:20b silently omitted DOM-RATE_LIMITING from
  // both kept_ids AND dropped — the prior default-to-keep behaviour
  // sneaked it past the gatekeeper despite CON-3 ("No rate limiting on
  // URL submission") being a textbook Pass-1 literal match. We now run
  // a deterministic literal-match pass over every unaccounted item:
  // if any upstream constraint contains a "no X / X out of scope / X
  // forbidden / X not supported" pattern that matches the item's id or
  // label, force-drop it with an explicit safety-net rationale.
  const safetyNetDrops = computeSafetyNetDrops(unaccounted, cfg.items, cfg.upstreamContext);
  for (const drop of safetyNetDrops) finalDropped.push(drop);

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
    getLogger().info('workflow', 'Scope gatekeeper omitted some ids; literal-match safety net applied', {
      workflow_run_id: cfg.workflowRunId,
      sub_phase_id: cfg.subPhaseId,
      unaccounted_count: unaccounted.length,
      safety_net_dropped: safetyNetDrops.length,
      defaulted_to_keep: unaccounted.length - safetyNetDrops.length,
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
    provider,
    model,
    duration_ms,
  };
}

/**
 * Deterministic literal-match safety net for the post-processor.
 *
 * Scans the upstream context's negative-constraint sources
 * (intentConstraints + technicalConstraints + analysisSummary) for
 * "no X" / "X out of scope" / "X forbidden" / "X not supported" /
 * "X not allowed" patterns. If any such phrase has a meaningful
 * overlap with the input item's id or label tokens, returns a
 * drop rationale string. Otherwise returns null.
 *
 * Conservative on purpose — only acts on EXPLICIT negative phrases.
 * A constraint that says "we support X" doesn't trigger drops, and
 * generic mentions of X without a negative qualifier don't trigger.
 * The intent is to catch the textbook Pass-1 cases the LLM silently
 * skipped (ts-110 DOM-RATE_LIMITING + CON-3 "No rate limiting" was
 * the canonical example).
 */
function deterministicLiteralDrop(
  item: BloomItemForPrune,
  ctx: GatekeeperUpstreamContext,
): string | null {
  const negativePhrases = /\b(?:no|not|never|without|forbidden|out[- ]of[- ]scope|not[- ]allowed|not[- ]supported|excluded|prohibited|do not|don't|cannot)\b/i;
  const candidates: string[] = [];
  for (const c of ctx.intentConstraints ?? []) if (c.text) candidates.push(c.text);
  for (const c of ctx.technicalConstraints ?? []) if (c.text) candidates.push(c.text);
  if (ctx.analysisSummary) candidates.push(ctx.analysisSummary);

  // Tokenize the item's id+label into meaningful keywords (≥4 chars,
  // alphanumeric, lower-cased). Skip generic stopwords that would
  // false-positive on any constraint.
  const stopwords = new Set(['domain', 'persona', 'feature', 'workflow', 'integration', 'system', 'service', 'component', 'requirement', 'support', 'management']);
  const itemText = `${item.id} ${item.label} ${item.description ?? ''}`.toLowerCase();
  const tokens = itemText
    .replace(/[[\](){}]/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 4 && !stopwords.has(t));
  if (tokens.length === 0) return null;

  // For each candidate constraint, check (a) it contains a negative
  // phrase, AND (b) it mentions one of the item's keyword tokens.
  for (const text of candidates) {
    const lower = text.toLowerCase();
    if (!negativePhrases.test(lower)) continue;
    const matched = tokens.find(t => lower.includes(t));
    if (!matched) continue;
    return `Deterministic safety-net Pass-1 literal match: upstream constraint "${text.slice(0, 200)}" contains negative phrase + item keyword "${matched}". LLM omitted this item from its decisions; the safety net force-drops it.`;
  }
  return null;
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
  // ── Fail-closed assembly invariant ──────────────────────────────
  // This gatekeeper's DROP rules can ONLY act by id-matching each
  // release's contained member ids against the accepted sets. If a
  // release CLAIMS members (non-zero counts in `tradeoffs`) but no member
  // ids were rendered into the item (`detail` missing or all-empty), the
  // gatekeeper would run BLIND and silently rubber-stamp KEEP — a
  // prompt-assembly defect masquerading as a clean verdict (slice-138).
  // Refuse to build a blind prompt; surface the wiring bug loudly rather
  // than emitting a confident decision from absent evidence.
  //
  // Note: the regex here parses our OWN fixed count token ("…contains
  // 6j/3w/1e/0c/0i/0v") and asserts a populated `detail` category — it is
  // a structural sanity check, NOT id reduction/resolution.
  for (const it of cfg.items) {
    const m = /contains\s+(\d+)j\/(\d+)w\/(\d+)e\/(\d+)c\/(\d+)i\/(\d+)v/i.exec(it.tradeoffs ?? '');
    const claimedMembers = m ? m.slice(1, 7).reduce((n, x) => n + Number(x), 0) : 0;
    const hasRenderedIds = !!it.detail && /\([1-9]\d*\):/.test(it.detail);
    if (claimedMembers > 0 && !hasRenderedIds) {
      throw new Error(
        `release_plan gatekeeper assembly defect: release '${it.id}' claims ${claimedMembers} contained ` +
        `artifact(s) but no member ids were rendered into the prompt — the gatekeeper cannot id-match and ` +
        `would blindly KEEP. Populate BloomItemForPrune.detail with the contained ids ` +
        `(see phase1.ts release_plan mapItems).`,
      );
    }
  }

  const itemList = cfg.items
    .map((it) => {
      const desc = it.description ? `\n      description: ${it.description.slice(0, 600)}` : '';
      const tradeoffs = it.tradeoffs ? `\n      tradeoffs: ${it.tradeoffs.slice(0, 400)}` : '';
      // The `detail` block carries the release's ACTUAL contained ids
      // (journeys/workflows/entities/…) so the id-matching DROP rules
      // below have the ids they require. Rendered verbatim, generous cap.
      const detail = it.detail ? `\n${it.detail.slice(0, 2000)}` : '';
      return `  - id: ${it.id}\n      label: ${it.label}${desc}${tradeoffs}${detail}`;
    })
    .join('\n');

  const u = cfg.upstreamContext;

  // Render the accepted artifact id sets the deterministic 1.8 verifier
  // will count against. Without these the gatekeeper has been
  // hallucinating upstream counts ("3 journeys defined upstream" when
  // 8 journeys were accepted — ts-105 seq=14 dropped the only release
  // that actually populated artifacts because the LLM compared the
  // proposed counts against its own invented baseline).
  const renderIdList = (label: string, items: Array<{ id: string; name?: string; title?: string }> | undefined): string => {
    if (!items || items.length === 0) return '';
    const lines = items.map(i => `  - ${i.id}: ${i.title ?? i.name ?? ''}`.trim()).join('\n');
    return `## ${label} (${items.length} total — these are the upstream-accepted ids; do NOT invent counts or alternate totals)\n${lines}\n`;
  };

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
    renderIdList('Accepted Journeys', u.acceptedJourneys),
    renderIdList('Accepted Workflows', u.acceptedWorkflows),
    renderIdList('Accepted Entities', u.acceptedEntities),
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

# Ground-truth id sets

The 'Accepted Journeys', 'Accepted Workflows', and 'Accepted Entities'
blocks below are the AUTHORITATIVE upstream sets. The deterministic 1.8
verifier checks that every accepted id appears in exactly one release
(or cross_cutting for workflow/integration/compliance/vocabulary).

Each release lists its ACTUAL contained ids under a 'contains:' block
(grouped by journeys / workflows / entities / compliance / integrations
/ vocabulary). The 'tradeoffs' line additionally gives the counts
(shape: "5j/2w/3e/1c/0i/4v") as a quick summary — but judge from the
EXPLICIT ids in the 'contains:' block, not the counts:
  - You can ONLY judge "hallucinated" by id-matching: every id in a
    release's 'contains:' block must appear VERBATIM in the
    corresponding accepted set above. If an id does not, cite it and
    drop the release.
  - You can ONLY judge "too many" by checking each contained id against
    the accepted sets. A release listing 5 journeys is FINE if those 5
    ids are all accepted — even when it's the ONLY release claiming them.
  - A release whose 'contains:' ids ALL match the accepted sets is
    structurally valid; KEEP it.

# When to DROP a release

Drop a release when ANY of these holds:

  - The release's contains lists reference upstream artifact ids that
    do NOT appear in the Accepted Journeys / Workflows / Entities lists
    above (the proposer hallucinated an id). Cite the specific bad id
    in the rationale.
  - The release's description describes features that EXPLICITLY
    contradict an upstream Intent Constraint (e.g., a release that
    introduces "user accounts" when CON-N forbids user accounts).
    Cite the constraint id in the rationale.
  - The release is empty (zero contained artifacts AND not cross-cutting).
    A 'tradeoffs' line of '0j/0w/0e/0c/0i/0v' is the empty-release
    signature.
  - The release's name/description is generic placeholder text
    ("TBD release", "future release", "miscellaneous") with no
    discernible scope tied to upstream artifacts.

# When to KEEP a release

Default to KEEP. Releases that are structurally well-formed and whose
contained artifacts trace to the upstream-accepted set are in scope,
even if their ordering looks suboptimal — the deterministic verifier
handles ordering. A release with NON-EMPTY contains lists whose ids
all match the accepted sets MUST be kept.

# Anti-patterns (do NOT drop for these)

  - Do NOT drop a release for "having more artifacts than expected"
    based on a count you invented. The accepted-set blocks above ARE
    the upstream totals; if a release claims fewer than or equal to
    those totals AND all its ids match, it is structurally valid.
  - Do NOT drop a release for being "too small" or "too large".
  - Do NOT drop a release because its ordinal seems wrong relative to
    its dependencies. The deterministic 1.8 verifier handles that.
  - Do NOT drop a release because cross_cutting could absorb its
    artifacts. Release-vs-cross-cutting placement is a human/
    deterministic concern.
  - Do NOT use implication chains. "This release implies X which
    requires Y which violates Z" is invalid here just as in the
    member-drop gatekeepers.
  - Do NOT prefer a near-empty release ("0j/0w/0e") over a
    well-populated one ("5j/2w/3e") just because the populated one
    looks risky — coverage failures are the deterministic verifier's
    concern. The empty release is the structural defect (per the DROP
    rule above), not the populated one.

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
