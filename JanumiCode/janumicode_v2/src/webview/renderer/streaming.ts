/**
 * Streaming renderer utilities for Phase 9 real-time execution cards.
 * Based on JanumiCode Spec v2.3, §17.4.
 *
 * During agent execution:
 * - agent_reasoning_step records appear as they are produced
 * - tool_call records show tool name and parameters
 * - tool_result records show summary (first 200 chars) with expand
 * - agent_self_correction records highlighted with orange accent
 */

import type { SerializedRecord } from '../stores/records.svelte';

export interface StreamingCardData {
  type: 'reasoning' | 'tool_call' | 'tool_result' | 'self_correction';
  content: string;
  toolName?: string;
  toolParams?: string;
  sequencePosition: number;
  truncated: boolean;
}

/**
 * Convert a streaming record into display data.
 */
export function toStreamingCard(record: SerializedRecord): StreamingCardData | null {
  const content = record.content as Record<string, unknown>;

  switch (record.record_type) {
    case 'agent_reasoning_step':
      return {
        type: 'reasoning',
        content: truncate((content.text ?? content.content ?? '') as string, 500),
        sequencePosition: (content.sequencePosition ?? 0) as number,
        truncated: ((content.text ?? content.content ?? '') as string).length > 500,
      };

    case 'agent_self_correction':
      return {
        type: 'self_correction',
        content: truncate((content.text ?? content.content ?? '') as string, 500),
        sequencePosition: (content.sequencePosition ?? 0) as number,
        truncated: false,
      };

    case 'tool_call':
      return {
        type: 'tool_call',
        content: '',
        toolName: (content.name ?? content.tool ?? '') as string,
        toolParams: truncate(JSON.stringify(content.input ?? content.params ?? {}), 200),
        sequencePosition: (content.sequencePosition ?? 0) as number,
        truncated: false,
      };

    case 'tool_result':
      return {
        type: 'tool_result',
        content: truncate((content.content ?? content.result ?? '') as string, 200),
        sequencePosition: (content.sequencePosition ?? 0) as number,
        truncated: ((content.content ?? content.result ?? '') as string).length > 200,
      };

    default:
      return null;
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}
