/**
 * Client Liaison UI — Open Query input and response rendering.
 * Based on JanumiCode Spec v2.3, §8.11.
 *
 * Handles the human-facing side of the Client Liaison Agent:
 * - Query input panel
 * - Response rendering with provenance statements (clickable record IDs)
 */

import type { SerializedRecord } from './stores/records.svelte';

export interface QuerySubmission {
  text: string;
  workflowRunId: string;
  currentPhaseId: string;
}

export interface LiaisonResponseDisplay {
  queryId: string;
  queryType: string;
  responseText: string;
  provenanceLinks: { recordId: string; label: string }[];
  escalated: boolean;
}

/**
 * Parse a liaison response record into display data.
 */
export function toLiaisonResponseDisplay(record: SerializedRecord): LiaisonResponseDisplay {
  const content = record.content as Record<string, unknown>;

  const responseText = (content.response_text as string) ?? '';
  const provenanceIds = (content.provenance_record_ids as string[]) ?? [];

  // Extract inline citations from response text
  const provenanceLinks = provenanceIds.map(id => ({
    recordId: id,
    label: id.slice(0, 8), // Short display label
  }));

  return {
    queryId: (content.query_id as string) ?? record.id,
    queryType: (content.query_type as string) ?? 'unknown',
    responseText,
    provenanceLinks,
    escalated: (content.escalated_to_orchestrator as boolean) ?? false,
  };
}

/**
 * Format a provenance link for display in the response text.
 * Replaces [record-id] patterns with clickable spans.
 */
export function formatProvenanceLinks(text: string): string {
  return text.replace(
    /\[([a-zA-Z0-9-]{8,})\]/g,
    '<span class="provenance-link" data-record-id="$1" role="link" tabindex="0">[$1]</span>',
  );
}
