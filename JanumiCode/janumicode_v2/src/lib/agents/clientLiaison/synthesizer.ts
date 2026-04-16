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
import type { LLMCallResult } from '../../llm/llmCaller';
import type { GovernedStreamRecord } from '../../types/records';
import type {
  CapabilityCallResult,
  OpenQuery,
  QueryClassification,
  RetrievalResult,
  SynthesisResult,
} from './types';
import type { ConversationTurn } from './db';
import type { CapabilityRegistry, CapabilityContext } from './capabilities/index';
import { getLogger } from '../../logging';

const TEMPLATE_KEY = 'cross_cutting/client_liaison_synthesis.system';

const PENDING_TYPES = new Set([
  'mirror_presented',
  'decision_bundle_presented',
  'phase_gate_evaluation',
]);

export interface SynthesizerConfig {
  provider: string;
  model: string;
}

export class Synthesizer {
  constructor(
    private readonly llm: PriorityLLMCaller,
    private readonly templates: TemplateLoader,
    private readonly registry: CapabilityRegistry,
    private readonly config: SynthesizerConfig,
  ) {}

  async synthesize(
    query: OpenQuery,
    classification: QueryClassification,
    retrieval: RetrievalResult,
    ctx: CapabilityContext,
    conversationHistory: ConversationTurn[] = [],
  ): Promise<SynthesisResult> {
    const template = this.templates.getTemplate(TEMPLATE_KEY);
    if (!template) {
      return this.fallbackResponse(query, retrieval);
    }

    let renderedPrompt: string;
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
      renderedPrompt = rendered.rendered;
    } catch (err) {
      getLogger().warn('agent', 'Synthesizer template render failed', { error: String(err) });
      return this.fallbackResponse(query, retrieval);
    }

    let result: LLMCallResult;
    try {
      result = await this.llm.call(
        {
          provider: this.config.provider,
          model: this.config.model,
          prompt: renderedPrompt,
          tools: this.registry.asToolDefinitions(),
          toolChoice: 'auto',
          temperature: 0.3,
        },
        { priority: 'user_query' },
      );
    } catch (err) {
      getLogger().warn('agent', 'Synthesizer LLM call failed', { error: String(err) });
      return {
        responseText: `Client Liaison call failed: ${String(err)}`,
        provenanceRecordIds: [],
        capabilityCalls: [],
        escalatedToOrchestrator: false,
      };
    }

    if (result.toolCalls && result.toolCalls.length > 0) {
      return await this.handleToolCalls(result.toolCalls, ctx, retrieval);
    }

    if (result.text && result.text.trim().length > 0) {
      return {
        responseText: result.text,
        provenanceRecordIds: this.extractProvenanceFromText(result.text, retrieval.records),
        capabilityCalls: [],
        escalatedToOrchestrator: false,
      };
    }

    // Neither text nor tool calls — surface the failure visibly.
    return {
      responseText:
        'The local model returned neither text nor a valid tool call. ' +
        'Try rephrasing your question, or use a slash command (e.g. `/status`, `/help`).',
      provenanceRecordIds: [],
      capabilityCalls: [],
      escalatedToOrchestrator: false,
    };
  }

  private async handleToolCalls(
    calls: NonNullable<LLMCallResult['toolCalls']>,
    ctx: CapabilityContext,
    retrieval: RetrievalResult,
  ): Promise<SynthesisResult> {
    const results: CapabilityCallResult[] = [];

    for (const call of calls) {
      const cap = this.registry.get(call.name);
      if (!cap) {
        results.push({
          name: call.name,
          error: `Unknown capability "${call.name}" — the model hallucinated a tool name.`,
          formatted: `**Error:** Unknown capability \`${call.name}\``,
        });
        continue;
      }

      const precond = cap.preconditions?.(ctx);
      if (precond !== true && precond !== undefined) {
        results.push({
          name: call.name,
          error: precond,
          formatted: `**Cannot run \`${call.name}\`:** ${precond}`,
        });
        continue;
      }

      // Destructive-capability confirmation ritual. On the first
      // invocation (confirmed absent or false), return the prompt to the
      // user and do NOT execute. The LLM must re-invoke with
      // `confirmed: true` after the user agrees.
      if (cap.confirmation) {
        const paramsRec = call.params;
        const confirmed = paramsRec.confirmed === true;
        if (!confirmed) {
          const prompt = cap.confirmation.prompt(call.params, ctx);
          results.push({
            name: call.name,
            formatted:
              `**Confirmation required for \`${call.name}\`:** ${prompt}\n\n` +
              `Re-invoke \`${call.name}\` with \`confirmed: true\` once the user agrees.`,
          });
          continue;
        }
      }

      try {
        const out = await cap.execute(call.params, ctx);
        results.push({
          name: call.name,
          result: out,
          formatted: cap.formatResponse(out),
          recordIds: this.extractRecordIdsFromResult(out),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          name: call.name,
          error: msg,
          formatted: `**Error in \`${call.name}\`:** ${msg}`,
        });
      }
    }

    const aggregated = results.map(r => r.formatted).join('\n\n');
    const provenance = new Set<string>();
    for (const r of results) {
      for (const id of r.recordIds ?? []) provenance.add(id);
    }
    // Also harvest [ref:...] markers from the aggregated text.
    for (const id of this.extractProvenanceFromText(aggregated, retrieval.records)) {
      provenance.add(id);
    }

    return {
      responseText: aggregated || '_(no response)_',
      provenanceRecordIds: [...provenance],
      capabilityCalls: results,
      escalatedToOrchestrator: results.some(r => r.name === 'escalateInconsistency'),
    };
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
    return p.supersessionChains
      .map(sc => {
        const current = sc.chain.find(e => e.position === 'current_governing');
        const superseded = sc.chain.filter(e => e.position === 'superseded');
        const currentStr = current ? `current: [${current.recordId}]` : 'no current';
        const supItems = superseded.map(e => `[${e.recordId}]`).join(', ');
        const supStr = supItems.length > 0 ? `superseded: ${supItems}` : 'nothing superseded';
        return `- Subject "${sc.subject}": ${currentStr}; ${supStr}`;
      })
      .join('\n');
  }

  private summarizeContradictions(retrieval: RetrievalResult): string {
    const p = retrieval.contextPacket;
    if (!p || p.contradictions.length === 0) return '(none detected)';
    return p.contradictions
      .map(c => {
        const idList = c.recordIds.map(id => `[${id}]`);
        const ids = idList.join(' vs ');
        return `- ${ids} (${c.resolutionStatus}): ${c.explanation}`;
      })
      .join('\n');
  }

  private summarizeActiveConstraints(retrieval: RetrievalResult): string {
    const p = retrieval.contextPacket;
    if (!p || p.activeConstraints.length === 0) return '(none)';
    return p.activeConstraints
      .map(c => `- [${c.id}] (authority ${c.authorityLevel}): ${c.statement}`)
      .join('\n');
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

  private extractRecordIdsFromResult(result: unknown): string[] {
    if (!result || typeof result !== 'object') return [];
    const ids = new Set<string>();
    const visit = (v: unknown) => {
      if (!v) return;
      if (Array.isArray(v)) {
        for (const item of v) visit(item);
        return;
      }
      if (typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        if (typeof obj.id === 'string' && obj.record_type) ids.add(obj.id);
        for (const key of Object.keys(obj)) visit(obj[key]);
      }
    };
    visit(result);
    return [...ids];
  }
}
