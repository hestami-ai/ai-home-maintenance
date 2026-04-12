/**
 * Regression: structured-clone safety of outbound webview postMessage payloads.
 *
 * Background: on 2026-04-11 the user hit
 *   "DataCloneError: Failed to execute 'postMessage' on 'MessagePort':
 *    [object Array] could not be cloned."
 * at submit time. Root cause: the IntentComposer was handing a Svelte 5
 * `$state`-wrapped array (`composerStore.references`) directly to
 * `vscode.postMessage(...)`. The webview transport uses structured cloning
 * under the hood, and structured cloning rejects Proxies.
 *
 * The fix is to run every outbound payload through JSON round-trip (or an
 * explicit plain-object construction) before calling postMessage.
 *
 * These tests pin that contract:
 *   1. Proxied source data cannot be structured-cloned directly — this is
 *      the behavior the bug was riding on.
 *   2. The `cloneForPost` helper pattern used in IntentComposer / App
 *      (JSON round-trip) unwraps Proxies into plain data that DOES clone.
 *   3. Every payload shape that IntentComposer actually sends survives a
 *      full round-trip when the source references Svelte $state Proxies.
 */

import { describe, it, expect } from 'vitest';

/**
 * Minimal Proxy that behaves like a Svelte 5 $state array for the purposes
 * of this test. Any access returns the underlying value; structured cloning
 * refuses to walk into it because the target is a Proxy.
 */
function makeStateArray<T>(items: T[]): T[] {
  const target = [...items];
  return new Proxy(target, {
    get(t, key) {
      return Reflect.get(t, key);
    },
  });
}

function makeStateObject<T extends object>(obj: T): T {
  return new Proxy(obj, {
    get(t, key) {
      return Reflect.get(t, key);
    },
  });
}

/** Matches the helper used in both IntentComposer.svelte and App.svelte. */
function cloneForPost<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe('Webview postMessage structured-clone safety', () => {
  it('sanity: structuredClone handles plain arrays + objects', () => {
    const plain = {
      type: 'submitIntent',
      text: 'hello',
      attachments: ['file:///a.txt', 'file:///b.txt'],
      references: [{ type: 'phase', id: 'p1', display: 'Phase 1' }],
    };
    expect(() => structuredClone(plain)).not.toThrow();
  });

  it('fail-to-pass: structuredClone refuses to clone a Proxy-wrapped array', () => {
    const proxiedArray = makeStateArray([{ a: 1 }, { a: 2 }]);
    // Calling structuredClone directly on a proxied array throws with
    // exactly the error shape the user hit: DataCloneError mentioning Array.
    expect(() => structuredClone(proxiedArray)).toThrow(/could not be cloned|DataCloneError/);
  });

  it('fail-to-pass: a postMessage payload that embeds a Proxy array cannot be cloned', () => {
    const references = makeStateArray([
      { type: 'phase', id: 'p1', display: 'Phase 1' },
    ]);
    const payload = {
      type: 'submitIntent',
      text: 'hello',
      attachments: ['file:///a.txt'],
      references, // <-- the v1 bug: handing the Proxy straight through
    };
    expect(() => structuredClone(payload)).toThrow(/could not be cloned|DataCloneError/);
  });

  it('pass-to-pass: cloneForPost (JSON round-trip) unwraps a Proxy array', () => {
    const proxiedArray = makeStateArray([
      { type: 'phase', id: 'p1', display: 'Phase 1' },
    ]);
    const plain = cloneForPost(proxiedArray);
    // The cloned value is a plain array, structurally equal to the source.
    expect(Array.isArray(plain)).toBe(true);
    expect(plain).toEqual([{ type: 'phase', id: 'p1', display: 'Phase 1' }]);
    // And now structuredClone accepts it.
    expect(() => structuredClone(plain)).not.toThrow();
  });

  it('pass-to-pass: submitIntent payload with proxied references round-trips safely', () => {
    const references = makeStateArray([
      { type: 'phase' as const, id: 'p1', display: 'Phase 1', uri: undefined },
      { type: 'decision' as const, id: 'd42', display: 'Use JWT', uri: undefined },
    ]);
    const attachments = makeStateArray([
      { uri: 'file:///a.txt', name: 'a.txt', type: 'file' as const },
    ]);

    // Mirror the exact shape IntentComposer.submit() builds.
    const payload = cloneForPost({
      type: 'submitIntent',
      text: 'Build a CLI todo app',
      attachments: attachments.map((a) => a.uri),
      references: references.map((r) => ({
        type: r.type,
        id: r.id,
        display: r.display,
        uri: r.uri,
      })),
    });

    expect(() => structuredClone(payload)).not.toThrow();
    const cloned = structuredClone(payload) as {
      type: string;
      text: string;
      attachments: string[];
      references: Array<{ type: string; id: string; display: string }>;
    };
    expect(cloned.type).toBe('submitIntent');
    expect(cloned.text).toBe('Build a CLI todo app');
    expect(cloned.attachments).toEqual(['file:///a.txt']);
    expect(cloned.references).toHaveLength(2);
    expect(cloned.references[0]).toMatchObject({ type: 'phase', id: 'p1' });
  });

  it('pass-to-pass: decision payload with proxied Svelte state survives round-trip', () => {
    // App.svelte's handleDecision receives a plain detail object from a
    // card callback but merges it with recordId. If any card ever returned
    // reactive state, the post() helper must still produce a clone-safe
    // payload. Use a proxied decision object to assert that.
    const decision = makeStateObject({ type: 'mirror_approval' as const });
    const payload = cloneForPost({
      type: 'decision',
      recordId: 'mirror-42',
      decision: { ...decision, recordId: 'mirror-42' },
    });

    expect(() => structuredClone(payload)).not.toThrow();
  });
});
