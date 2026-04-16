/**
 * Transient streaming store for live LLM/CLI output.
 *
 * Streaming chunks no longer get persisted as `agent_output_chunk` records
 * (that approach made the governed_stream table balloon to ~20K rows per
 * phase, which then overflowed the SharedArrayBuffer used by the sidecar
 * RPC bridge on webview restore). Instead, the extension host emits each
 * chunk as a postMessage and we accumulate them here, keyed by the
 * agent_invocation record id.
 *
 * Once the authoritative `agent_output` record lands in the records store,
 * the AgentInvocationCard switches to reading from there and this buffer
 * becomes effectively unused — but we leave it in place so reopening the
 * card mid-stream still shows progress. Buffers do not survive a page
 * reload (they're transient by design); persisted state is the
 * `agent_output` record's `text` and `thinking` fields.
 */

export interface StreamBuffer {
  response: string;
  thinking: string;
  stdout: string;
  stderr: string;
}

const EMPTY: StreamBuffer = { response: '', thinking: '', stdout: '', stderr: '' };

class StreamingStore {
  buffers = $state<Record<string, StreamBuffer>>({});

  /**
   * Append a chunk to the buffer for an in-flight invocation.
   * Replaces the whole record at the invocation id so Svelte's runes
   * track the change.
   */
  append(invocationId: string, channel: keyof StreamBuffer, text: string): void {
    const current = this.buffers[invocationId] ?? EMPTY;
    this.buffers = {
      ...this.buffers,
      [invocationId]: { ...current, [channel]: current[channel] + text },
    };
  }

  /** Get the buffer for an invocation, or an empty one if none exists. */
  get(invocationId: string): StreamBuffer {
    return this.buffers[invocationId] ?? EMPTY;
  }

  /** Drop a buffer (call after the agent_output record arrives). */
  clear(invocationId: string): void {
    if (!(invocationId in this.buffers)) return;
    const next = { ...this.buffers };
    delete next[invocationId];
    this.buffers = next;
  }

  reset(): void {
    this.buffers = {};
  }
}

export const streamingStore = new StreamingStore();
