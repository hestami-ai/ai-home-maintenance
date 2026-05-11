/**
 * Active Matter Context.
 *
 * Per docs/janumilegal_multi_matter_isolation_addendum.md §3.2 §8.
 *
 * Exactly one active matter context is in force in a session at any moment.
 * Switching is deliberate, confirmed, and recorded. Mismatch between the
 * active matter context and an action's target matter is an alarm condition.
 */

import type { Scope } from '../database/types.js';

export interface SwitchEvent {
  readonly fromMatter: Scope | null;
  readonly toMatter: Scope | null;
  readonly switchedAt: string;
  readonly userId: string;
  readonly sessionId: string;
}

export type SwitchListener = (event: SwitchEvent) => void;

export class ActiveMatterContext {
  private current: Scope | null = null;
  private readonly listeners = new Set<SwitchListener>();

  constructor(
    private readonly userId: string,
    private readonly sessionId: string,
  ) {}

  get(): Scope | null {
    return this.current;
  }

  /** Switch to a new matter. Recording / persistence is a callback responsibility. */
  switchTo(scope: Scope): SwitchEvent {
    const event: SwitchEvent = {
      fromMatter: this.current,
      toMatter: scope,
      switchedAt: new Date().toISOString(),
      userId: this.userId,
      sessionId: this.sessionId,
    };
    this.current = scope;
    for (const listener of this.listeners) listener(event);
    return event;
  }

  /** Clear the active matter (e.g., on session end). */
  clear(): SwitchEvent {
    const event: SwitchEvent = {
      fromMatter: this.current,
      toMatter: null,
      switchedAt: new Date().toISOString(),
      userId: this.userId,
      sessionId: this.sessionId,
    };
    this.current = null;
    for (const listener of this.listeners) listener(event);
    return event;
  }

  onSwitch(listener: SwitchListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Assert the supplied scope matches the active context.
   * Mismatch is an alarm condition per privilege design §6.4.
   */
  assertMatches(scope: Scope): void {
    if (!this.current) {
      throw new Error('no active matter context');
    }
    if (
      this.current.firmId !== scope.firmId ||
      this.current.clientId !== scope.clientId ||
      this.current.matterId !== scope.matterId
    ) {
      throw new Error(
        `active matter context mismatch: active=${formatScope(this.current)} attempted=${formatScope(scope)}`,
      );
    }
  }
}

function formatScope(s: Scope): string {
  return `${s.firmId}/${s.clientId}/${s.matterId}`;
}
