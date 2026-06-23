/**
 * Capability registry — executor adapter SELECTION (M4).
 */
import { describe, it, expect } from 'vitest';
import { selectExecutorAdapter, isInteractiveCapable } from '../../../../lib/cli/session/capabilityRegistry';

describe('selectExecutorAdapter', () => {
  it('selects the interactive adapter for goose_cli when the PTY substrate is available', () => {
    const sel = selectExecutorAdapter('goose_cli', { cwd: '/ws' }, /* ptyAvailable */ true);
    expect(sel.adapter).not.toBeNull();
    expect(sel.adapter!.tier).toBe('full_tui');
    expect(sel.fallbackReason).toBeNull();
  });

  it('falls back to structured (no adapter) when node-pty is unavailable', () => {
    const sel = selectExecutorAdapter('goose_cli', { cwd: '/ws' }, /* ptyAvailable */ false);
    expect(sel.adapter).toBeNull();
    expect(sel.fallbackReason).toBe('pty_unavailable');
  });

  it('falls back to structured for CLIs without an interactive adapter yet', () => {
    const sel = selectExecutorAdapter('claude_code_cli', { cwd: '/ws' }, true);
    expect(sel.adapter).toBeNull();
    expect(sel.fallbackReason).toBe('no_interactive_adapter');
  });

  it('selects the mimo adapter even when node-pty is UNavailable (HTTP/SSE, no PTY)', () => {
    const sel = selectExecutorAdapter('mimo_cli', { cwd: '/ws' }, /* ptyAvailable */ false);
    expect(sel.adapter).not.toBeNull();
    expect(sel.adapter!.tier).toBe('agentic_server');
    expect(sel.fallbackReason).toBeNull();
  });

  it('reports interactive capability per tool', () => {
    expect(isInteractiveCapable('mimo_cli')).toBe(true);
    expect(isInteractiveCapable('goose_cli')).toBe(true);
    expect(isInteractiveCapable('claude_code_cli')).toBe(false);
    expect(isInteractiveCapable('unknown_cli')).toBe(false);
  });
});
