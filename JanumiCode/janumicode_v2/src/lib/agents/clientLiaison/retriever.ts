/**
 * Retriever — per-query-type retrieval for the Universal Router.
 *
 * Delegation policy:
 *   - Retrieval-type queries (historical_lookup, rationale_request,
 *     forward_implication, ambient_clarification, artifact_request,
 *     consistency_challenge) are routed to the Deep Memory Research Agent
 *     (§8.4). DMR's seven-stage process gives us materiality scoring,
 *     supersession analysis, contradiction detection, and gap detection
 *     — signals the synthesizer surfaces to the user in the response.
 *   - workflow_initiation: no retrieval (a new run starts fresh).
 *   - status_check: simple state query via ClientLiaisonDB (current run,
 *     recent records). No semantic retrieval needed; DMR would be overkill
 *     and add latency to a question as direct as "where are we?".
 *
 * Always merged into the result:
 *   - Records explicitly referenced via composer @mentions.
 *   - Any pending decisions on the active workflow run, so the synthesizer
 *     can answer "what should I pick?" style questions correctly.
 */

import type { GovernedStreamRecord } from '../../types/records';
import type { OrchestratorEngine } from '../../orchestrator/orchestratorEngine';
import type { ContextPacket, RetrievalBrief, ScopeTier } from '../deepMemoryResearch';
import type { ClientLiaisonDB } from './db';
import type { OpenQuery, Reference, RetrievalResult, QueryType } from './types';
import { getLogger } from '../../logging';

/** Query types that benefit from DMR's structured research. */
const DMR_DELEGATED: ReadonlySet<QueryType> = new Set<QueryType>([
  'historical_lookup',
  'rationale_request',
  'forward_implication',
  'ambient_clarification',
  'artifact_request',
  'consistency_challenge',
]);

export class Retriever {
  constructor(
    private readonly db: ClientLiaisonDB,
    /**
     * Optional engine handle. When present, DMR delegation is enabled.
     * When absent (legacy callers, unit tests that mock only the DB), the
     * retriever falls back to its pre-DMR per-type strategy table.
     */
    private readonly engine?: OrchestratorEngine,
  ) {}

  async retrieve(
    queryType: QueryType,
    query: OpenQuery,
    references: Reference[] = [],
  ): Promise<RetrievalResult> {
    // 1. Always include records explicitly referenced via @mentions.
    const referencedIds = references
      .filter(r => r.type !== 'file' && r.type !== 'symbol')
      .map(r => r.id);
    // Also parse inline `@bundle:<recordId>[:<section>[:<itemId>]]` tokens
    // the DecisionBundleCard's "Ask more" button prefills into the
    // composer. Pulling the bundle record into retrieval means the
    // synthesizer sees the full Mirror/Menu contents when answering a
    // follow-up, so its response can actually address the specific
    // option the user clicked. The inline item_id stays in the raw
    // prompt text for the synthesizer to interpret.
    const bundleRecordIds = extractBundleRecordIds(query.text);
    const allReferencedIds = [...new Set([...referencedIds, ...bundleRecordIds])];
    const referencedRecords =
      allReferencedIds.length > 0 ? this.db.getRecordsByIds(allReferencedIds) : [];

    // 2. Always include pending decisions for the current run.
    const pending = query.workflowRunId
      ? this.db.getPendingDecisions(query.workflowRunId)
      : [];

    // 3. Dispatch retrieval strategy.
    if (queryType === 'workflow_initiation') {
      const merged = this.dedupe([...referencedRecords, ...pending]);
      return { records: merged, strategy: 'no_retrieval' };
    }

    if (queryType === 'status_check') {
      const strategyResult = query.workflowRunId
        ? this.db.getRecentRecords(query.workflowRunId, 10)
        : [];
      const merged = this.dedupe([...referencedRecords, ...pending, ...strategyResult]);
      return { records: merged, strategy: 'workflow_state' };
    }

    if (this.engine && DMR_DELEGATED.has(queryType)) {
      const dmr = await this.researchViaDMR(queryType, query, allReferencedIds);
      if (dmr) {
        const strategyRecords = this.fetchRecordsForPacket(dmr);
        const merged = this.dedupe([...referencedRecords, ...pending, ...strategyRecords]);
        return {
          records: merged,
          strategy: `dmr:${queryType}`,
          contextPacket: dmr,
        };
      }
      // Fall through to legacy strategy if DMR itself failed.
    }

    // Legacy fallback — used when engine is not attached (unit tests) or
    // when DMR threw (we still want to return SOME records).
    const strategyResult = await this.legacyStrategy(queryType, query, allReferencedIds);
    const merged = this.dedupe([...referencedRecords, ...pending, ...strategyResult.records]);
    return { records: merged, strategy: strategyResult.strategy };
  }

  // ── DMR delegation ────────────────────────────────────────────────

  private async researchViaDMR(
    queryType: QueryType,
    query: OpenQuery,
    knownRelevantRecordIds: string[],
  ): Promise<ContextPacket | null> {
    if (!this.engine) return null;
    const brief: RetrievalBrief = {
      requestingAgentRole: 'client_liaison_agent',
      scopeTier: this.scopeTierFor(queryType),
      query: this.briefQueryFor(queryType, query.text),
      knownRelevantRecordIds,
      workflowRunId: query.workflowRunId,
      phaseId: query.currentPhaseId,
      subPhaseId: `liaison:${queryType}`,
    };
    try {
      return await this.engine.deepMemoryResearch.research(brief);
    } catch (err) {
      getLogger().warn('agent', 'DMR delegation failed; falling back to legacy strategy', {
        queryType,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Scope tier selection per query type. The principle: user questions
   * asking about "this run" (status_check, ambient clarification of a
   * current artifact) stay in current_run; anything historical or
   * cross-cutting reaches across all runs so superseded decisions from
   * prior runs surface correctly.
   */
  private scopeTierFor(queryType: QueryType): ScopeTier {
    switch (queryType) {
      case 'ambient_clarification':
      case 'artifact_request':
      case 'forward_implication':
      case 'consistency_challenge':
        // Might reference current-run artifacts but may cross prior runs
        // if the user mentions a record that predates the current run.
        return 'all_runs';
      case 'historical_lookup':
      case 'rationale_request':
        // Explicitly historical — cross all runs.
        return 'all_runs';
      default:
        return 'all_runs';
    }
  }

  /**
   * Shape the user's raw query into a DMR-friendly brief query string.
   * DMR's Stage 1 decomposes this into topic entities; a clearer brief
   * gives it less to guess at.
   */
  private briefQueryFor(queryType: QueryType, userText: string): string {
    const t = userText.trim().slice(0, 800);
    switch (queryType) {
      case 'historical_lookup':
        return `Historical lookup: ${t}`;
      case 'rationale_request':
        return `Decision rationale and governing ADRs for: ${t}`;
      case 'forward_implication':
        return `Downstream dependencies and impacted artifacts for: ${t}`;
      case 'ambient_clarification':
        return `Explain and contextualize: ${t}`;
      case 'artifact_request':
        return `Locate and describe artifact: ${t}`;
      case 'consistency_challenge':
        return `Detect contradictions and supersessions relevant to: ${t}`;
      default:
        return t;
    }
  }

  /**
   * Convert a ContextPacket's material findings into GovernedStreamRecord
   * shapes by fetching each by id from the DB. The synthesizer still wants
   * full records (content, derivation, phase) so it can cite provenance;
   * material findings alone are summaries.
   */
  private fetchRecordsForPacket(packet: ContextPacket): GovernedStreamRecord[] {
    const ids = packet.materialFindings.map(f => f.id);
    if (ids.length === 0) return [];
    return this.db.getRecordsByIds(ids);
  }

  // ── Legacy per-type strategy (fallback path) ──────────────────────

  private async legacyStrategy(
    queryType: QueryType,
    query: OpenQuery,
    referencedIds: string[],
  ): Promise<{ records: GovernedStreamRecord[]; strategy: string }> {
    switch (queryType) {
      case 'historical_lookup':
      case 'consistency_challenge':
      case 'ambient_clarification':
      case 'artifact_request': {
        const records = await this.db.hybridSearch(query.text, {
          workflowRunId: query.workflowRunId,
          limit: queryType === 'consistency_challenge' ? 15 : 10,
        });
        return { records, strategy: `legacy_hybrid:${queryType}` };
      }
      case 'forward_implication': {
        let records: GovernedStreamRecord[] = [];
        for (const id of referencedIds) {
          records.push(...this.db.getDownstreamDependencies(id));
        }
        if (records.length === 0) {
          records = this.db.ftsSearch(query.text, {
            workflowRunId: query.workflowRunId,
            limit: 10,
          });
        }
        return { records, strategy: 'legacy_memory_edge_traversal' };
      }
      case 'rationale_request': {
        const records = query.workflowRunId
          ? this.db.getRecordsByType('decision_trace', query.workflowRunId)
          : [];
        return { records, strategy: 'legacy_decision_trace_fetch' };
      }
      default:
        return { records: [], strategy: `legacy_unhandled:${queryType}` };
    }
  }

  private dedupe(records: GovernedStreamRecord[]): GovernedStreamRecord[] {
    const seen = new Set<string>();
    const out: GovernedStreamRecord[] = [];
    for (const r of records) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        out.push(r);
      }
    }
    return out;
  }
}

/**
 * Parse `@bundle:<recordId>[:<section>[:<itemId>]]` tokens out of raw
 * query text. Returns the unique set of bundle record ids referenced.
 *
 * The format is produced by DecisionBundleCard.askMore(). We accept
 * UUID-shaped ids as well as opaque ids (tests seed synthetic ids).
 * The :section:itemId suffix stays in the raw text so the synthesizer
 * can read it and tailor its answer to the specific row/option the
 * user is asking about.
 *
 * Exported for unit tests. The regex uses a word-boundary start so
 * `@bundler` doesn't match — kept strict to avoid false-positive
 * retrievals from adjacent text.
 */
export function extractBundleRecordIds(text: string): string[] {
  if (!text) return [];
  const ids = new Set<string>();
  const re = /@bundle:([\w-]+)(?::[\w-]+)*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    ids.add(match[1]);
  }
  return [...ids];
}
