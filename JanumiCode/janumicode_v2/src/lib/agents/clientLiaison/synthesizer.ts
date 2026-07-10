/**
 * Synthesizer — final-response synthesis with native tool-calling.
 *
 * Algorithm:
 *   1. Render the synthesis template with retrieval context and pending decisions.
 *   2. Call the LLM in the user_query priority lane with the registry's tool
 *      definitions (Anthropic tool_use / Ollama tools / Gemini functionDeclarations).
 *   3. If the LLM returned tool_calls, validate parameters against each
 *      capability's JSONSchema, run preconditions, execute, and aggregate.
 *   4. If the LLM returned plain text, that text IS the response.
 *   5. Malformed tool calls are surfaced to the user as part of the response —
 *      no silent fallback (per the user's explicit choice).
 */

import type { PriorityLLMCaller } from '../../llm/priorityLLMCaller';
import type { TemplateLoader } from '../../orchestrator/templateLoader';
import type { LLMCallResult, ToolCall, ToolDefinition, LLMTraceContext } from '../../llm/llmCaller';
import type { GovernedStreamRecord } from '../../types/records';
import { renderRecordExcerpt } from '../../orchestrator/phases/dmrHydration';
import type {
  CapabilityCallResult,
  OpenQuery,
  QueryClassification,
  RetrievalResult,
  SynthesisResult,
} from './types';
import type { ConversationTurn } from './db';
import type { CapabilityRegistry, CapabilityContext } from './capabilities/index';
import { CapabilityBroker } from './capabilities/broker';
import { getLogger } from '../../logging';

const TEMPLATE_KEY = 'cross_cutting/client_liaison_synthesis.system';

const PENDING_TYPES = new Set([
  'mirror_presented',
  'decision_bundle_presented',
  'phase_gate_evaluation',
]);

/**
 * Maximum ReAct loop iterations per user turn. The common case (a status
 * report or a single ASK) resolves in one iteration = today's cost; extra
 * iterations occur only when the model genuinely needs to chain tool calls.
 * The final iteration is always a forced, tool-free turn (toolChoice:'none')
 * so the turn can never dead-end without a coherent answer.
 */
const MAX_LOOP_ITERATIONS = 4;

export interface SynthesizerConfig {
  provider: string;
  model: string;
}

/**
 * Mutable accumulator threaded through the bounded ReAct loop. Every field
 * is a reference type shared across iterations so helpers can append
 * observations, provenance, and executed-call records in place.
 */
interface ReactLoopState {
  transcript: string[];
  provenance: Set<string>;
  capabilityCalls: CapabilityCallResult[];
  seenCalls: Set<string>;
}

/** Outcome of a single ReAct iteration. */
interface ReactStep {
  /** When set, the turn is complete and this is the final result. */
  result?: SynthesisResult;
  /** When true, the next iteration must be a forced, tool-free final turn. */
  forceFinalNext?: boolean;
}

export class Synthesizer {
  private readonly broker: CapabilityBroker;

  constructor(
    private readonly llm: PriorityLLMCaller,
    private readonly templates: TemplateLoader,
    private readonly registry: CapabilityRegistry,
    private readonly config: SynthesizerConfig,
  ) {
    this.broker = new CapabilityBroker(registry);
  }

  async synthesize(
    query: OpenQuery,
    classification: QueryClassification,
    retrieval: RetrievalResult,
    ctx: CapabilityContext,
    conversationHistory: ConversationTurn[] = [],
  ): Promise<SynthesisResult> {
    const renderedPrompt = this.renderSynthesisPrompt(
      query,
      classification,
      retrieval,
      ctx,
      conversationHistory,
    );
    if (renderedPrompt === null) {
      return this.fallbackResponse(query, retrieval);
    }

    const traceContext = this.buildTraceContext(query, ctx);
    const toolDefs = this.registry.asToolDefinitions();

    // ── Bounded ReAct loop ──────────────────────────────────────────
    // The model calls tools; the CapabilityBroker executes each under a
    // tier-scoped context and returns an observation that is fed back into
    // the prompt; the model iterates until it writes a final answer or the
    // iteration budget forces a final, tool-free turn. Every failure is an
    // observation, not a user-facing error — so the model self-repairs. On
    // budget exhaustion the forced final turn (toolChoice:'none') guarantees
    // a coherent natural-language answer: a turn can never dead-end.
    const state: ReactLoopState = {
      transcript: [],
      provenance: new Set<string>(),
      capabilityCalls: [],
      seenCalls: new Set<string>(),
    };

    let forcedFinal = false;
    for (let i = 0; i < MAX_LOOP_ITERATIONS; i++) {
      const isLast = forcedFinal || i === MAX_LOOP_ITERATIONS - 1;
      const step = await this.runReactIteration(
        isLast,
        renderedPrompt,
        toolDefs,
        traceContext,
        ctx,
        state,
        retrieval,
      );
      if (step.result) return step.result;
      if (step.forceFinalNext) forcedFinal = true;
    }

    // Unreachable in practice (the last iteration always returns), but keeps
    // the control flow total for the type checker.
    return this.finalizeResult(
      this.bestEffortFromTranscript(state.transcript, retrieval),
      state,
      retrieval,
    );
  }

  /**
   * Render the synthesis template with retrieval context and pending
   * decisions. Returns null when the template is missing or rendering
   * throws — the caller emits the fallback response in that case. Missing
   * template variables are logged but non-fatal.
   */
  private renderSynthesisPrompt(
    query: OpenQuery,
    classification: QueryClassification,
    retrieval: RetrievalResult,
    ctx: CapabilityContext,
    conversationHistory: ConversationTurn[],
  ): string | null {
    const template = this.templates.getTemplate(TEMPLATE_KEY);
    if (!template) return null;

    try {
      const rendered = this.templates.render(template, {
        query_text: query.text,
        query_type: classification.queryType,
        relevant_records: this.summarizeRecords(retrieval.records),
        pending_decisions: this.summarizePending(retrieval.records.filter(r => PENDING_TYPES.has(r.record_type))),
        // Multi-turn conversation memory — gives the LLM the last few
        // Q/A pairs so follow-ups like "what about the previous one?"
        // resolve correctly.
        conversation_history: this.summarizeConversation(conversationHistory),
        // DMR quality signals — surfaced whenever the retrieval was
        // delegated to DMR. When the packet is absent (workflow_initiation,
        // status_check), these render as "(none available)" so the template
        // doesn't have to special-case.
        dmr_completeness: this.summarizeCompleteness(retrieval),
        dmr_supersession_chains: this.summarizeSupersession(retrieval),
        dmr_contradictions: this.summarizeContradictions(retrieval),
        dmr_active_constraints: this.summarizeActiveConstraints(retrieval),
        dmr_open_questions: this.summarizeOpenQuestions(retrieval),
        janumicode_version_sha: ctx.orchestrator.janumiCodeVersionSha,
      });
      if (rendered.missing_variables.length > 0) {
        getLogger().warn('agent', 'Synthesizer template missing variables', {
          missing: rendered.missing_variables,
        });
      }
      return rendered.rendered;
    } catch (err) {
      getLogger().warn('agent', 'Synthesizer template render failed', { error: String(err) });
      return null;
    }
  }

  /**
   * Trace context for the synthesis LLM call. Turns on invocation
   * instrumentation + live token streaming (llm:stream_chunk). Guarded on
   * an active run so we never pass an empty workflow_run_id (FK); returns
   * undefined when no run is active.
   */
  private buildTraceContext(
    query: OpenQuery,
    ctx: CapabilityContext,
  ): LLMTraceContext | undefined {
    if (!ctx.activeRun) return undefined;
    return {
      workflowRunId: ctx.activeRun.id,
      phaseId: ctx.currentPhase ?? query.currentPhaseId ?? null,
      agentRole: 'client_liaison',
      label: 'Client Liaison — response',
    };
  }

  /**
   * Compose the prompt for one ReAct iteration: the base rendered prompt on
   * the first turn, or the base prompt plus the accumulated tool
   * observations on subsequent turns.
   */
  private buildIterationPrompt(renderedPrompt: string, transcript: string[]): string {
    if (transcript.length === 0) return renderedPrompt;
    return (
      `${renderedPrompt}\n\n## Tool results so far (this turn)\n${transcript.join('\n\n')}\n\n` +
      'Using the results above, either call another tool if you still need ' +
      'information, or write your final answer to the user now.'
    );
  }

  /**
   * Run one iteration of the bounded ReAct loop: call the model, then either
   * execute the returned tool calls (feeding observations back for the next
   * turn) or finalize on a text answer. Returns a ReactStep carrying either
   * the final result or a signal to force the next (tool-free) turn.
   */
  private async runReactIteration(
    isLast: boolean,
    renderedPrompt: string,
    toolDefs: ToolDefinition[],
    traceContext: LLMTraceContext | undefined,
    ctx: CapabilityContext,
    state: ReactLoopState,
    retrieval: RetrievalResult,
  ): Promise<ReactStep> {
    const prompt = this.buildIterationPrompt(renderedPrompt, state.transcript);

    let result: LLMCallResult;
    try {
      result = await this.llm.call(
        {
          provider: this.config.provider,
          model: this.config.model,
          prompt,
          // The forced final turn offers no tools so the model must answer.
          tools: isLast ? undefined : toolDefs,
          toolChoice: isLast ? 'none' : 'auto',
          temperature: 0.3,
          traceContext,
        },
        { priority: 'user_query' },
      );
    } catch (err) {
      getLogger().warn('agent', 'Synthesizer LLM call failed', { error: String(err) });
      // Fall back to what we already gathered rather than dead-ending.
      return {
        result: this.finalizeResult(
          this.bestEffortFromTranscript(state.transcript, retrieval),
          state,
          retrieval,
        ),
      };
    }

    const toolCalls = result.toolCalls ?? [];

    if (!isLast && toolCalls.length > 0) {
      const confirmed = await this.dispatchToolCalls(toolCalls, ctx, state, retrieval);
      // A GOVERN confirmation is terminal; otherwise observe → next turn.
      return confirmed ? { result: confirmed } : {};
    }

    if (result.text && result.text.trim().length > 0) {
      return { result: this.finalizeResult(result.text, state, retrieval) };
    }

    // Neither text nor tool calls. On a non-final turn, force a final,
    // tool-free turn next iteration rather than burning the budget.
    if (!isLast) {
      state.transcript.push(
        '(No tool call or answer was produced. Write your final answer to the user now.)',
      );
      return { forceFinalNext: true };
    }

    // Last turn still empty → assemble a best-effort answer from the
    // observations so the turn never dead-ends.
    return {
      result: this.finalizeResult(
        this.bestEffortFromTranscript(state.transcript, retrieval),
        state,
        retrieval,
      ),
    };
  }

  /**
   * Execute each tool call under the tier-scoped broker, appending an
   * observation to the transcript and accumulating provenance. Duplicate
   * calls are surfaced (not re-run) to stop weak-model thrash. Returns a
   * terminal SynthesisResult when a call needs a GOVERN confirmation (that
   * prompt becomes the answer); otherwise returns null to continue the loop.
   */
  private async dispatchToolCalls(
    toolCalls: ToolCall[],
    ctx: CapabilityContext,
    state: ReactLoopState,
    retrieval: RetrievalResult,
  ): Promise<SynthesisResult | null> {
    for (const call of toolCalls) {
      const key = `${call.name}:${JSON.stringify(call.params ?? {})}`;
      if (state.seenCalls.has(key)) {
        // No-progress / duplicate-call guard — stops weak-model thrash.
        state.transcript.push(
          `### ${call.name} (repeat)\n(You already ran this exact call. ` +
            'Use the earlier result, or write your final answer now.)',
        );
        continue;
      }
      state.seenCalls.add(key);
      const obs = await this.broker.dispatch(call, ctx);
      state.capabilityCalls.push(obs);
      for (const id of obs.recordIds ?? []) state.provenance.add(id);
      state.transcript.push(
        `### ${call.name}(${this.summarizeParams(call.params)})\n${obs.formatted}`,
      );
      // A GOVERN confirmation is a terminal turn: surface the prompt as
      // the answer and end; the user confirms on the next turn.
      if (obs.needsConfirmation) {
        return this.finalizeResult(obs.formatted, state, retrieval);
      }
    }
    return null;
  }

  /**
   * Assemble the final SynthesisResult from the accumulated loop state:
   * substitutes a best-effort answer for empty text, merges provenance
   * cited in the answer with provenance from executed tools, and flags
   * whether the turn escalated an inconsistency to the orchestrator.
   */
  private finalizeResult(
    text: string,
    state: ReactLoopState,
    retrieval: RetrievalResult,
  ): SynthesisResult {
    const clean =
      text && text.trim().length > 0
        ? text
        : this.bestEffortFromTranscript(state.transcript, retrieval);
    const prov = new Set(state.provenance);
    for (const id of this.extractProvenanceFromText(clean, retrieval.records)) {
      prov.add(id);
    }
    return {
      responseText: clean,
      provenanceRecordIds: [...prov],
      capabilityCalls: state.capabilityCalls,
      escalatedToOrchestrator: state.capabilityCalls.some(
        c => c.name === 'escalateInconsistency' && !c.error,
      ),
    };
  }

  /**
   * Assemble a readable answer from the accumulated tool observations when
   * the model failed to produce final prose even on the forced final turn.
   * Guarantees the user sees the gathered results rather than a dead-end.
   */
  private bestEffortFromTranscript(transcript: string[], retrieval: RetrievalResult): string {
    if (transcript.length > 0) {
      return transcript.join('\n\n');
    }
    if (retrieval.records.length > 0) {
      return (
        'I could not compose a narrative answer, but here is what I retrieved:\n\n' +
        this.summarizeRecords(retrieval.records)
      );
    }
    return (
      "I wasn't able to produce an answer. Try rephrasing your question, " +
      'or use a slash command (e.g. `/status`, `/help`).'
    );
  }

  private summarizeParams(params: Record<string, unknown> | undefined): string {
    if (!params || Object.keys(params).length === 0) return '';
    return JSON.stringify(params).slice(0, 120);
  }

  private fallbackResponse(query: OpenQuery, retrieval: RetrievalResult): SynthesisResult {
    return {
      responseText: `Synthesis template missing. Query: "${query.text}". Retrieved ${retrieval.records.length} records via strategy "${retrieval.strategy}".`,
      provenanceRecordIds: retrieval.records.map(r => r.id),
      capabilityCalls: [],
      escalatedToOrchestrator: false,
    };
  }

  private summarizeRecords(records: GovernedStreamRecord[]): string {
    if (records.length === 0) return '(no records found)';
    return records
      .slice(0, 20)
      .map(r => {
        const preview = JSON.stringify(r.content).slice(0, 200);
        return `[${r.id}] (${r.record_type}, phase ${r.phase_id ?? '-'}, authority ${r.authority_level}): ${preview}`;
      })
      .join('\n\n');
  }

  private summarizePending(records: GovernedStreamRecord[]): string {
    if (records.length === 0) return '(none)';
    return records
      .map(r => `- [${r.id}] ${r.record_type}: ${JSON.stringify(r.content).slice(0, 200)}`)
      .join('\n');
  }

  // ── DMR Context Packet surface helpers ──────────────────────────

  private summarizeCompleteness(retrieval: RetrievalResult): string {
    const p = retrieval.contextPacket;
    if (!p) return '(not applicable — retrieval did not use DMR)';
    const gaps = p.coverageAssessment.knownGaps;
    const unavail = p.unavailableSources;
    const parts: string[] = [
      `Status: ${p.completenessStatus}`,
      `Confidence: ${p.coverageAssessment.confidence.toFixed(2)}`,
      `Narrative: ${p.completenessNarrative}`,
    ];
    if (unavail.length > 0) {
      const unavailList = unavail.map(s => `${s.source} (${s.materiality})`).join(', ');
      parts.push(`Unavailable sources: ${unavailList}`);
    }
    if (gaps.length > 0) {
      parts.push(`Known gaps: ${gaps.join('; ')}`);
    }
    return parts.join('\n');
  }

  private summarizeSupersession(retrieval: RetrievalResult): string {
    const p = retrieval.contextPacket;
    if (!p || p.supersessionChains.length === 0) return '(none detected)';
    const byId = this.recordsById(retrieval);
    const label = (id: string): string => {
      const rec = byId.get(id);
      return rec ? `[${id.slice(0, 8)}] ${this.excerpt(rec, 120)}` : `[${id}]`;
    };
    return p.supersessionChains
      .map(sc => {
        const current = sc.chain.find(e => e.position === 'current_governing');
        const superseded = sc.chain.filter(e => e.position === 'superseded');
        const currentStr = current ? `current: ${label(current.recordId)}` : 'no current';
        const supItems = superseded.map(e => label(e.recordId)).join('; ');
        const supStr = supItems.length > 0 ? `superseded: ${supItems}` : 'nothing superseded';
        return `- Subject "${sc.subject}": ${currentStr}; ${supStr}`;
      })
      .join('\n');
  }

  private summarizeContradictions(retrieval: RetrievalResult): string {
    const p = retrieval.contextPacket;
    if (!p || p.contradictions.length === 0) return '(none detected)';
    const byId = this.recordsById(retrieval);
    return p.contradictions
      .map(c => {
        const ids = c.recordIds.map(id => {
          const rec = byId.get(id);
          return rec ? `[${id.slice(0, 8)}] ${this.excerpt(rec, 100)}` : `[${id}]`;
        }).join(' vs ');
        return `- ${ids} (${c.resolutionStatus}): ${c.explanation}`;
      })
      .join('\n');
  }

  private summarizeActiveConstraints(retrieval: RetrievalResult): string {
    const p = retrieval.contextPacket;
    if (!p || p.activeConstraints.length === 0) return '(none)';
    const byId = this.recordsById(retrieval);
    return p.activeConstraints
      .map(c => {
        // Resolve `[label]`-only placeholder statements to the referenced
        // record's actual content so the response carries real governing
        // detail, not a bare type label + UUID.
        let statement = c.statement;
        if (/^\[[^\]]+\]$/.test(statement.trim())) {
          const rec = byId.get(c.sourceRecordIds[0] ?? '');
          if (rec) statement = `${statement.trim()} — ${this.excerpt(rec, 300)}`;
        }
        return `- [${c.id}] (authority ${c.authorityLevel}): ${statement}`;
      })
      .join('\n');
  }

  /** Index the retrieval's fetched records by id for placeholder resolution. */
  private recordsById(retrieval: RetrievalResult): Map<string, GovernedStreamRecord> {
    const m = new Map<string, GovernedStreamRecord>();
    for (const r of retrieval.records) m.set(r.id, r);
    return m;
  }

  private excerpt(rec: GovernedStreamRecord, cap: number): string {
    return renderRecordExcerpt(
      { record_type: rec.record_type, content: (rec.content ?? {}) as Record<string, unknown> },
      cap,
    ).replace(/\s+/g, ' ').trim();
  }

  private summarizeOpenQuestions(retrieval: RetrievalResult): string {
    const p = retrieval.contextPacket;
    if (!p || p.openQuestions.length === 0) return '(none unresolved)';
    return p.openQuestions
      .map(q => `- [${q.sourceRecordId}] ${q.question}${q.stillUnresolved ? ' (unresolved)' : ''}`)
      .join('\n');
  }

  private summarizeConversation(history: ConversationTurn[]): string {
    if (history.length === 0) return '(no prior turns in this session)';
    return history
      .map((t, i) => {
        const qText = this.extractQueryText(t.queryRecord);
        const rText = this.extractResponseText(t.responseRecord);
        return `### Turn ${i + 1}\n**User:** ${qText}\n**You answered:** ${rText}`;
      })
      .join('\n\n');
  }

  private extractQueryText(record: GovernedStreamRecord): string {
    const content = record.content;
    const text = typeof content.text === 'string' ? content.text : JSON.stringify(content);
    return text.slice(0, 300);
  }

  private extractResponseText(record: GovernedStreamRecord): string {
    const content = record.content;
    const text = typeof content.response_text === 'string'
      ? content.response_text
      : JSON.stringify(content);
    return text.slice(0, 400);
  }

  private extractProvenanceFromText(text: string, records: GovernedStreamRecord[]): string[] {
    const ids = new Set<string>();
    const validIds = new Set(records.map(r => r.id));
    // Look for [ref:abc-123] markers and bare uuid-ish references.
    const refRegex = /\[ref:([\w-]+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = refRegex.exec(text)) !== null) {
      if (validIds.has(m[1])) ids.add(m[1]);
    }
    return [...ids];
  }
}
