/**
 * ActionGuard — gates what the policy layer may send for a given screen state
 * (reference design §9). Prevents typing free text into a modal (where keys
 * are commands, not text) or pressing keys blindly while the agent is busy.
 * Violations are reported to the caller (logged as telemetry) and suppressed.
 */

import type { SpecialKey } from '../types';
import type { Detection } from './classifier';

export type GuardedAction =
  | { type: 'text'; text: string }
  | { type: 'key'; key: SpecialKey };

export interface GuardVerdict {
  allowed: boolean;
  reason?: string;
}

const MODAL_KEYS: ReadonlySet<SpecialKey> = new Set(['tab', 'enter', 'escape', 'left', 'right', 'up', 'down']);

export function checkAction(detection: Detection, action: GuardedAction): GuardVerdict {
  switch (detection.kind) {
    case 'busy':
      // While the agent works, only an interrupt is meaningful.
      if (action.type === 'key' && action.key === 'ctrl-c') return { allowed: true };
      return { allowed: false, reason: `agent busy — refusing ${describe(action)} (only ctrl-c allowed)` };
    case 'modal':
      if (action.type === 'key' && MODAL_KEYS.has(action.key)) return { allowed: true };
      // Single-word answers (y/yes/n/no/ok) are accepted by many TUI dialogs.
      if (action.type === 'text' && /^[a-z]{1,6}$/i.test(action.text.trim())) return { allowed: true };
      return { allowed: false, reason: `modal active — refusing free text ${describe(action)}` };
    case 'prompt':
    case 'idle':
      return { allowed: true };
    case 'normal':
    default:
      // No input box detected — typing would go nowhere useful.
      if (action.type === 'key' && (action.key === 'escape' || action.key === 'ctrl-c')) return { allowed: true };
      return { allowed: false, reason: `no input surface detected — refusing ${describe(action)}` };
  }
}

function describe(a: GuardedAction): string {
  return a.type === 'key' ? `key:${a.key}` : `text(${a.text.length} chars)`;
}
