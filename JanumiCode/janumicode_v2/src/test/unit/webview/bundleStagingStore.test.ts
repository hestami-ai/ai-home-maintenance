// @vitest-environment happy-dom
/**
 * bundleStagingStore — local draft for composite decision bundles.
 *
 * The store sits on the submit path's critical edge: if it drops an
 * edit, swallows a menu selection, or lets Submit fire without a draft,
 * the user can accidentally ship a broken decision. These tests pin
 * the contract every DecisionBundleCard relies on.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { bundleStagingStore } from '../../../webview/stores/bundleStaging.svelte';

interface PostedMessage { type: string; [key: string]: unknown }

function fakeVscode(): { posted: PostedMessage[]; postMessage: (m: unknown) => void } {
  const posted: PostedMessage[] = [];
  return {
    posted,
    postMessage(m: unknown) { posted.push(m as PostedMessage); },
  };
}

describe('bundleStagingStore', () => {
  beforeEach(() => bundleStagingStore.reset());

  it('returns an empty draft for unknown bundle ids', () => {
    const draft = bundleStagingStore.getDraft('nope');
    expect(Object.keys(draft.mirror)).toHaveLength(0);
    expect(draft.menu).toHaveLength(0);
  });

  it('stages a Mirror accept and lets the user flip to reject before submit', () => {
    bundleStagingStore.stageMirror('b1', 'a1', 'accepted');
    expect(bundleStagingStore.getDraft('b1').mirror['a1'].action).toBe('accepted');
    bundleStagingStore.stageMirror('b1', 'a1', 'rejected');
    expect(bundleStagingStore.getDraft('b1').mirror['a1'].action).toBe('rejected');
  });

  it('stages Mirror edits with the final text buffered until submit', () => {
    bundleStagingStore.stageMirror('b1', 'a1', 'edited', 'draft 1');
    bundleStagingStore.stageMirror('b1', 'a1', 'edited', 'final');
    const decision = bundleStagingStore.getDraft('b1').mirror['a1'];
    expect(decision.action).toBe('edited');
    expect(decision.edited_text).toBe('final');
  });

  it('unsets a Mirror row when stageMirror is called with action=null', () => {
    bundleStagingStore.stageMirror('b1', 'a1', 'accepted');
    bundleStagingStore.stageMirror('b1', 'a1', null);
    expect(bundleStagingStore.getDraft('b1').mirror['a1']).toBeUndefined();
  });

  it('replaces selections on single-select menus', () => {
    bundleStagingStore.stageMenu('b1', 'sqlite', false);
    bundleStagingStore.stageMenu('b1', 'pg', false);
    const menu = bundleStagingStore.getDraft('b1').menu;
    expect(menu).toHaveLength(1);
    expect(menu[0].option_id).toBe('pg');
  });

  it('toggles selections on multi-select menus', () => {
    bundleStagingStore.stageMenu('b1', 'a', true);
    bundleStagingStore.stageMenu('b1', 'b', true);
    bundleStagingStore.stageMenu('b1', 'a', true); // toggle off
    const menu = bundleStagingStore.getDraft('b1').menu;
    expect(menu.map(s => s.option_id)).toEqual(['b']);
  });

  it('carries free_text on the _OTHER option', () => {
    bundleStagingStore.stageMenu('b1', '_OTHER', false, 'a custom answer');
    const menu = bundleStagingStore.getDraft('b1').menu;
    expect(menu[0]).toEqual({ option_id: '_OTHER', free_text: 'a custom answer' });
  });

  it('keeps drafts independent across bundles (no bleed)', () => {
    bundleStagingStore.stageMirror('b1', 'a1', 'accepted');
    bundleStagingStore.stageMirror('b2', 'a1', 'rejected');
    expect(bundleStagingStore.getDraft('b1').mirror['a1'].action).toBe('accepted');
    expect(bundleStagingStore.getDraft('b2').mirror['a1'].action).toBe('rejected');
  });

  it('submit posts decisionBundleSubmit with serialized decisions and clears the draft', () => {
    bundleStagingStore.stageMirror('b1', 'a1', 'accepted');
    bundleStagingStore.stageMirror('b1', 'a2', 'edited', 'revised');
    bundleStagingStore.stageMenu('b1', 'sqlite', false);

    const vscode = fakeVscode();
    const ok = bundleStagingStore.submit('b1', 'surface-1', vscode);
    expect(ok).toBe(true);
    expect(vscode.posted).toHaveLength(1);
    const msg = vscode.posted[0];
    expect(msg.type).toBe('decisionBundleSubmit');
    expect(msg.recordId).toBe('b1');
    expect(msg.surfaceId).toBe('surface-1');
    expect(Array.isArray(msg.mirror_decisions)).toBe(true);
    expect((msg.mirror_decisions as Array<{ item_id: string }>).map(d => d.item_id).sort()).toEqual(['a1', 'a2']);
    expect((msg.menu_selections as Array<{ option_id: string }>)[0].option_id).toBe('sqlite');

    // Draft cleared.
    expect(Object.keys(bundleStagingStore.getDraft('b1').mirror)).toHaveLength(0);
    expect(bundleStagingStore.getDraft('b1').menu).toHaveLength(0);
  });

  it('submit is a no-op on an empty draft — prevents accidental empty submissions', () => {
    const vscode = fakeVscode();
    const ok = bundleStagingStore.submit('b1', 'surface-1', vscode);
    expect(ok).toBe(false);
    expect(vscode.posted).toHaveLength(0);
  });

  it('clear(recordId) drops only the targeted draft', () => {
    bundleStagingStore.stageMirror('b1', 'a1', 'accepted');
    bundleStagingStore.stageMirror('b2', 'a1', 'accepted');
    bundleStagingStore.clear('b1');
    expect(Object.keys(bundleStagingStore.getDraft('b1').mirror)).toHaveLength(0);
    expect(bundleStagingStore.getDraft('b2').mirror['a1']).toBeDefined();
  });
});
