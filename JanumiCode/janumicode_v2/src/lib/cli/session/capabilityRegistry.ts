/**
 * CLI capability registry + executor-adapter selection.
 *
 * Records, per `backing_tool`, which interactivity tiers a coding-agent CLI
 * supports and how to construct its adapter. The Phase-9 executor uses
 * {@link selectExecutorAdapter} to pick the right adapter: for Phase-9 tasks the
 * DEFAULT is the highest interactive tier the CLI supports (the mandatory
 * filesystem research/plan step is TUI-resident since phases 1–8 are FS-blind);
 * the Tier-1 structured (one-shot) path is the fallback — used when the CLI has
 * no interactive adapter yet, or when the PTY substrate (`node-pty`) is
 * unavailable.
 */

import { NodePtySpawner, isNodePtyAvailable } from './nodePtySpawner';
import { GooseTuiAdapter, type GooseTuiConfig } from './adapters/gooseTuiAdapter';
import { MimoServerAdapter } from './adapters/mimoServerAdapter';
import type { ExecutorAdapter } from './adapter';
import type { SessionLogEvent } from './sessionDriver';
import type { ExecutorEscalation, SessionResponder } from './responder';

export interface AdapterBuildContext {
  cwd: string;
  env?: Record<string, string>;
  /** Forwarded to the SessionDriver for governed-stream ingestion of turns. */
  onLog?: (e: SessionLogEvent) => void;
  /**
   * LLM-backed answerer for the agent's clarifying questions + contextual
   * nudges (built by the AgentInvoker, which owns LLMCaller + routing).
   * Optional: adapters fall back to canned responses without it.
   */
  responder?: SessionResponder;
  /**
   * Whether a human is in the loop this run (= !unattendedSkipPermissions).
   * Governs the mimo `question` policy + agent-prompt framing so the adapter's
   * runtime behavior matches the execution-mode directive. Default false.
   */
  attended?: boolean;
  /**
   * Human-escalation sink for a genuinely-blocking clarification the responder
   * could not resolve. Present only in ATTENDED sessions; absent headless (the
   * executor self-resolves). Adapters degrade to spec-grounded best judgment
   * when it is absent or returns null — never a deadlock.
   */
  onEscalate?: ExecutorEscalation;
}

/** A CLI's interactive capability — null `makeInteractive` ⇒ structured-only. */
export interface CliCapability {
  backingTool: string;
  /** Build the interactive (Tier-2/3) executor adapter, or null if none yet. */
  makeInteractive: ((ctx: AdapterBuildContext) => ExecutorAdapter) | null;
  /** Whether the adapter needs the node-pty substrate. HTTP/SSE adapters don't. */
  requiresPty?: boolean;
}

/**
 * Registry. mimo (HTTP/SSE `compose` agent) is the DEFAULT executor; goose
 * (Tier-3 `/plan` PTY TUI) is the fallback. Claude Code / Codex / Gemini are
 * structured-only for now; their adapters slot in here without touching dispatch.
 */
const REGISTRY: Record<string, CliCapability> = {
  mimo_cli: {
    backingTool: 'mimo_cli',
    // HTTP/SSE — no PTY substrate required.
    requiresPty: false,
    // Thread the responder + attended flag + escalation sink (previously DROPPED
    // here — mimo silently ran with no voice-of-intent). mimo's compose API is
    // non-conversational, so the responder can't type an answer back the way
    // goose's PTY does; the adapter uses these to SURFACE + escalate a question
    // (attended) rather than answer-and-inject. See mimoServerAdapter.
    makeInteractive: (ctx) => new MimoServerAdapter({
      onLog: ctx.onLog,
      responder: ctx.responder,
      attended: ctx.attended,
      onEscalate: ctx.onEscalate,
    }),
  },
  goose_cli: {
    backingTool: 'goose_cli',
    requiresPty: true,
    makeInteractive: (ctx) =>
      new GooseTuiAdapter(new NodePtySpawner(), {
        onLog: ctx.onLog,
        responder: ctx.responder,
        // The PTY can TYPE the human's answer back — so goose gets the escalation
        // sink for genuine answer-injection (mimo only surfaces + records it).
        onEscalate: ctx.onEscalate,
        config: GOOSE_INTERACTIVE_CONFIG,
      }),
  },
  claude_code_cli: { backingTool: 'claude_code_cli', makeInteractive: null },
  codex_cli: { backingTool: 'codex_cli', makeInteractive: null },
  gemini_cli: { backingTool: 'gemini_cli', makeInteractive: null },
};

/** Goose-specific interactive config override (command + session args). */
const GOOSE_INTERACTIVE_CONFIG: Partial<GooseTuiConfig> = {
  command: 'goose',
  sessionArgs: ['session'],
};

export interface ExecutorAdapterSelection {
  /** When non-null, the executor runs this adapter (interactive). */
  adapter: ExecutorAdapter | null;
  /** Why structured was chosen, for telemetry (null when interactive). */
  fallbackReason: 'no_interactive_adapter' | 'pty_unavailable' | null;
}

/**
 * Select the executor adapter for a Phase-9 task. Returns an interactive
 * adapter when the CLI supports one AND the PTY substrate is available;
 * otherwise `{ adapter: null }` and the caller uses the structured one-shot
 * path. `ptyAvailableOverride` is for tests.
 */
export function selectExecutorAdapter(
  backingTool: string,
  ctx: AdapterBuildContext,
  ptyAvailableOverride?: boolean,
): ExecutorAdapterSelection {
  const cap = REGISTRY[backingTool];
  if (!cap?.makeInteractive) {
    return { adapter: null, fallbackReason: 'no_interactive_adapter' };
  }
  // PTY adapters (goose) need the node-pty substrate; HTTP/SSE adapters (mimo) don't.
  if (cap.requiresPty !== false) {
    const ptyOk = ptyAvailableOverride ?? isNodePtyAvailable();
    if (!ptyOk) {
      return { adapter: null, fallbackReason: 'pty_unavailable' };
    }
  }
  return { adapter: cap.makeInteractive(ctx), fallbackReason: null };
}

/** Test/introspection helper. */
export function isInteractiveCapable(backingTool: string): boolean {
  return REGISTRY[backingTool]?.makeInteractive != null;
}
