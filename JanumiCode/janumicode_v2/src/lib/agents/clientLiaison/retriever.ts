/**
 * Retriever — per-query-type retrieval strategies for the Universal Router.
 *
 * Always includes:
 *   - records explicitly referenced via composer @mentions (guaranteed)
 *   - any pending decisions on the active workflow run (so the synthesizer
 *     can answer "what should I pick?" type questions correctly)
 *
 * Then dispatches to a per-type strategy for the bulk of relevant records.
 */

import type { GovernedStreamRecord } from '../../types/records';
import type { ClientLiaisonDB } from './db';
import type { OpenQuery, Reference, RetrievalResult, QueryType } from './types';

export class Retriever {
  constructor(private readonly db: ClientLiaisonDB) {}

  async retrieve(
    queryType: QueryType,
    query: OpenQuery,
    references: Reference[] = [],
  ): Promise<RetrievalResult> {
    // 1. Always include records explicitly referenced via @mentions.
    const referencedIds = references
      .filter(r => r.type !== 'file' && r.type !== 'symbol')
      .map(r => r.id);
    const referencedRecords =
      referencedIds.length > 0 ? this.db.getRecordsByIds(referencedIds) : [];

    // 2. Always include pending decisions for the current run.
    const pending = query.workflowRunId
      ? this.db.getPendingDecisions(query.workflowRunId)
      : [];

    // 3. Dispatch per query type.
    let strategyResult: GovernedStreamRecord[] = [];
    let strategy = 'unknown';

    switch (queryType) {
      case 'workflow_initiation':
        strategy = 'no_retrieval';
        strategyResult = [];
        break;

      case 'historical_lookup':
        strategy = 'hybrid_fts_vector';
        strategyResult = await this.db.hybridSearch(query.text, {
          workflowRunId: query.workflowRunId,
          limit: 10,
        });
        break;

      case 'consistency_challenge':
        strategy = 'consistency_compare';
        strategyResult = await this.db.hybridSearch(query.text, {
          workflowRunId: query.workflowRunId,
          limit: 15,
        });
        break;

      case 'forward_implication':
        strategy = 'memory_edge_traversal';
        strategyResult = this.traverseFromMentioned(referencedIds);
        if (strategyResult.length === 0) {
          // Fallback to FTS when no anchor entity was mentioned.
          strategyResult = this.db.ftsSearch(query.text, {
            workflowRunId: query.workflowRunId,
            limit: 10,
          });
        }
        break;

      case 'rationale_request':
        strategy = 'decision_trace_fetch';
        strategyResult = query.workflowRunId
          ? this.db.getRecordsByType('decision_trace', query.workflowRunId)
          : [];
        break;

      case 'ambient_clarification':
        strategy = 'artifact_fetch';
        strategyResult = await this.db.hybridSearch(query.text, {
          workflowRunId: query.workflowRunId,
          limit: 5,
        });
        break;

      case 'status_check':
        strategy = 'workflow_state';
        strategyResult = query.workflowRunId
          ? this.db.getRecentRecords(query.workflowRunId, 10)
          : [];
        break;

      case 'artifact_request':
        strategy = 'artifact_type_query';
        strategyResult = await this.db.hybridSearch(query.text, {
          workflowRunId: query.workflowRunId,
          limit: 10,
        });
        break;
    }

    const merged = this.dedupe([...referencedRecords, ...pending, ...strategyResult]);
    return { records: merged, strategy };
  }

  private traverseFromMentioned(referencedIds: string[]): GovernedStreamRecord[] {
    const result: GovernedStreamRecord[] = [];
    for (const id of referencedIds) {
      result.push(...this.db.getDownstreamDependencies(id));
    }
    return result;
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
