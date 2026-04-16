// @vitest-environment happy-dom
/**
 * streamingStore — transient buffer for live LLM/CLI output that used to
 * be persisted as `agent_output_chunk` rows. Pinning the API contract
 * because the AgentInvocationCard reads from it directly via $derived,
 * and any silent regression (e.g. mutation-based updates that don't
 * trigger reactivity) would make the live-stream UI go dark again.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { streamingStore } from '../../../webview/stores/streaming.svelte';

describe('streamingStore', () => {
  beforeEach(() => {
    streamingStore.reset();
  });

  it('returns an empty buffer for unknown invocations without throwing', () => {
    const buf = streamingStore.get('nope');
    expect(buf.response).toBe('');
    expect(buf.thinking).toBe('');
    expect(buf.stdout).toBe('');
    expect(buf.stderr).toBe('');
  });

  it('appends chunks per channel and concatenates in arrival order', () => {
    streamingStore.append('inv-1', 'response', 'Hello');
    streamingStore.append('inv-1', 'response', ', ');
    streamingStore.append('inv-1', 'response', 'world');
    streamingStore.append('inv-1', 'thinking', 'I am thinking…');
    expect(streamingStore.get('inv-1').response).toBe('Hello, world');
    expect(streamingStore.get('inv-1').thinking).toBe('I am thinking…');
  });

  it('keeps buffers per invocation so concurrent calls do not bleed', () => {
    streamingStore.append('inv-a', 'response', 'A1');
    streamingStore.append('inv-b', 'response', 'B1');
    streamingStore.append('inv-a', 'response', 'A2');
    expect(streamingStore.get('inv-a').response).toBe('A1A2');
    expect(streamingStore.get('inv-b').response).toBe('B1');
  });

  it('routes stdout and stderr to separate channels (CLI invocations)', () => {
    streamingStore.append('inv-cli', 'stdout', 'line-1\n');
    streamingStore.append('inv-cli', 'stderr', 'warn: low memory\n');
    streamingStore.append('inv-cli', 'stdout', 'line-2\n');
    const buf = streamingStore.get('inv-cli');
    expect(buf.stdout).toBe('line-1\nline-2\n');
    expect(buf.stderr).toBe('warn: low memory\n');
  });

  it('clear() drops only the targeted invocation', () => {
    streamingStore.append('inv-a', 'response', 'A');
    streamingStore.append('inv-b', 'response', 'B');
    streamingStore.clear('inv-a');
    expect(streamingStore.get('inv-a').response).toBe('');
    expect(streamingStore.get('inv-b').response).toBe('B');
  });

  it('reset() drops everything (used on snapshot reload)', () => {
    streamingStore.append('inv-a', 'response', 'A');
    streamingStore.append('inv-b', 'thinking', 'B');
    streamingStore.reset();
    expect(streamingStore.get('inv-a').response).toBe('');
    expect(streamingStore.get('inv-b').thinking).toBe('');
  });

  it('append replaces the whole buffer object so $derived in Svelte reacts', () => {
    // The store is a $state record; mutating in place would silently break
    // reactivity. Identity check guards against that regression.
    streamingStore.append('inv-1', 'response', 'A');
    const ref1 = streamingStore.get('inv-1');
    streamingStore.append('inv-1', 'response', 'B');
    const ref2 = streamingStore.get('inv-1');
    expect(ref2).not.toBe(ref1);
  });
});
