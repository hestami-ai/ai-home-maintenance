/**
 * Unsticking session renderer — thread layout with purple accent.
 * Based on JanumiCode Spec v2.3, §17.2.
 */

import type { SerializedRecord } from '../stores/records.svelte';

export interface UnstickingThreadEntry {
  type: 'session_open' | 'hypothesis' | 'socratic_turn' | 'specialist_task' | 'resolution' | 'escalation';
  content: string;
  timestamp: string;
}

/**
 * Convert unsticking records into a thread for display.
 */
export function toUnstickingThread(records: SerializedRecord[]): UnstickingThreadEntry[] {
  return records
    .filter(r => r.record_type.startsWith('unsticking_'))
    .sort((a, b) => a.produced_at.localeCompare(b.produced_at))
    .map(r => {
      const content = r.content as Record<string, unknown>;
      const typeMap: Record<string, UnstickingThreadEntry['type']> = {
        'unsticking_session_open': 'session_open',
        'unsticking_hypothesis': 'hypothesis',
        'unsticking_socratic_turn': 'socratic_turn',
        'unsticking_specialist_task': 'specialist_task',
        'unsticking_resolution': 'resolution',
        'unsticking_escalation': 'escalation',
      };

      return {
        type: typeMap[r.record_type] ?? 'session_open',
        content: (content.text ?? content.content ?? content.question ?? JSON.stringify(content)) as string,
        timestamp: r.produced_at,
      };
    });
}
