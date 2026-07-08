/**
 * SessionResponder — the LLM half of the policy layer.
 *
 * The perception stack (classifier → Detection) tells the adapter WHEN the
 * coding agent is asking something; the responder decides WHAT to say back.
 * Reference design: StateClassifier → LLM/policy → ActionGuard → PTY input —
 * canned strings covered the protocol prompts (act-on-plan, clear-history)
 * but live calibration showed the generic cases need actual answers:
 *
 *   - the 566s `/plan` session ended awaiting NUMBERED clarification answers;
 *     "proceed with the most reasonable interpretation" is a non-answer that
 *     leaves a small model flailing — the spec contains the real answers;
 *   - the mid-thought stall wanted contextual steering, not a generic
 *     "continue working" cattle prod.
 *
 * The responder is an injected async callback so the session layer stays free
 * of orchestrator/LLM dependencies: the AgentInvoker (which owns LLMCaller +
 * routing) builds the closure and threads it through the capability registry.
 * `null` from the responder means "no answer" — the adapter falls back to its
 * canned response, so the system degrades to today's behavior when the
 * responder is unconfigured, slow, or erroring. The ActionGuard still gates
 * every send the responder produces.
 */

export interface ResponderInput {
  /** Why the adapter is asking: a detected question vs. an idle-settle nudge. */
  kind: 'question' | 'nudge';
  /** The detected prompt/question line ('' for nudges). */
  question: string;
  /** Recent echo-excluded agent output (tail) — what the agent just said. */
  agentContext: string;
  /** The task specification the session is executing (may be excerpted). */
  taskSpec: string;
}

/** Returns the reply to type into the session, or null to use the canned fallback. */
export type SessionResponder = (input: ResponderInput) => Promise<string | null>;

/**
 * A genuinely-blocking clarification the voice-of-intent responder could NOT
 * resolve from the spec, raised to a human for a decision. Distinct from
 * {@link ResponderInput} (which the responder answers autonomously): escalation
 * is the fall-through when spec-grounded answering is not enough.
 */
export interface EscalationInput {
  /** The blocking question, verbatim from the coding agent. */
  question: string;
  /** Recent agent output (tail) — what led to the block. */
  agentContext: string;
  /** The task specification the session is executing (may be excerpted). */
  taskSpec: string;
}

/**
 * Escalate a blocking question to a human and await their answer, or null when
 * no human is reachable / the channel is absent, slow, or errors — callers then
 * fall back to spec-grounded best judgment, NEVER a deadlock. Wired only in
 * ATTENDED sessions; headless runs (calibration/CI) leave it undefined so the
 * executor self-resolves per the execution-mode directive. The `null`-degrades-
 * gracefully contract mirrors {@link SessionResponder}.
 */
export type ExecutorEscalation = (input: EscalationInput) => Promise<string | null>;

/** Hard cap on a single typed line — TUI inputs are not a place for essays. */
export const MAX_RESPONDER_REPLY_CHARS = 1200;

/**
 * Make an LLM reply safe to type into a TUI input line:
 *   - collapse to ONE line (multi-line pastes fragment at every newline —
 *     the same finding that forced file-based task delivery);
 *   - strip a leading slash (a reply must never become a slash command);
 *   - strip the completion sentinel (only the AGENT may declare completion;
 *     an echo-exempted sentinel typed by US would end the task instantly);
 *   - cap length.
 * Returns null for empty/whitespace results so callers fall back to canned.
 */
export function sanitizeResponderReply(raw: string | null, completionMarker?: string): string | null {
  if (!raw) return null;
  let text = raw.replace(/\s*\r?\n\s*/g, ' ').trim();
  if (completionMarker) {
    text = text.split(completionMarker).join(' ').replace(/\s{2,}/g, ' ').trim();
  }
  text = text.replace(/^\/+/, '').trim();
  if (!text) return null;
  return text.length > MAX_RESPONDER_REPLY_CHARS ? text.slice(0, MAX_RESPONDER_REPLY_CHARS) : text;
}
