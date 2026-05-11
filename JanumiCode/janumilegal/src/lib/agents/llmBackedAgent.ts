/**
 * LlmBackedAgent — single-shot LLM provider call wrapped as an Agent.
 *
 * Per Wave 10:
 *   1. Loads the prompt template registered for (lensId, stateId).
 *   2. Assembles the prompt via PromptAssembler against the envelope.
 *   3. Calls the configured LLMProvider.
 *   4. Parses the completion as JSON and validates against the state's
 *      output schema (Wave 10 ships shape-tolerant parsing; Wave 11+ adds
 *      JSON-Schema runtime validation).
 *   5. Returns AgentExecutionOutput with the parsed object.
 *
 * Logging: the agent emits matter-track events `prompt_assembled` and
 * `completion_received` when an `InvocationLogger` is supplied. Op-track
 * already records agent_invoked / agent_completed via AgentRuntime.
 */

import { cacheKeyForScope, type LLMProvider, type LLMRequest } from '../llm/provider.js';
import type { Agent, AgentExecutionInput, AgentExecutionOutput } from './agent.js';
import { PromptAssembler } from './promptAssembler.js';
import type { CLV } from '../clv/types.js';
import type { PromptTemplateRegistry } from '../promptTemplates/registry.js';
import type { InvocationLogger } from '../llm/invocationLogger.js';

export interface LlmBackedAgentOptions {
  readonly agentId: string;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly provider: LLMProvider;
  readonly clv: CLV;
  readonly templateRegistry: PromptTemplateRegistry;
  readonly invocationLogger?: InvocationLogger;
  /** Optional: sampling controls passed through to the provider. */
  readonly sampling?: { temperature?: number; maxTokens?: number; model?: string };
  /**
   * Optional JSON-repair retry budget. When the first completion does not
   * parse as JSON, the agent re-invokes the provider up to `repairAttempts`
   * times with a corrective message asking for valid JSON only. Default: 1.
   */
  readonly repairAttempts?: number;
}

export class LlmBackedAgent implements Agent {
  readonly agentId: string;
  private readonly assembler: PromptAssembler;

  constructor(private readonly options: LlmBackedAgentOptions) {
    this.agentId = options.agentId;
    this.assembler = new PromptAssembler({ clv: options.clv });
  }

  async execute(input: AgentExecutionInput): Promise<AgentExecutionOutput> {
    const tpl = this.options.templateRegistry.get(this.options.templateId, this.options.templateVersion);
    if (!tpl) {
      return { status: 'blocked', blockReason: `prompt template ${this.options.templateId}@${this.options.templateVersion} not found` };
    }

    const assembled = this.assembler.assemble(input.envelope, { templateBody: tpl.body });

    // Append the state input to the user prompt so the LLM sees the structured input.
    const userText =
      assembled.user +
      '\n\n## State input\n```json\n' +
      JSON.stringify(input.input ?? {}, null, 2) +
      '\n```\n\nReturn ONLY a JSON object. No prose, no markdown fences.';

    const request: LLMRequest = {
      system: assembled.system,
      messages: [{ role: 'user', content: userText }],
      cacheNamespace: cacheKeyForScope(input.envelope),
      temperature: this.options.sampling?.temperature,
      maxTokens: this.options.sampling?.maxTokens,
      model: this.options.sampling?.model,
    };

    if (this.options.invocationLogger) {
      this.options.invocationLogger.logPromptAssembled({
        envelope: input.envelope,
        agentId: this.agentId,
        templateId: this.options.templateId,
        templateVersion: this.options.templateVersion,
        systemBytes: Buffer.byteLength(assembled.system, 'utf8'),
        userBytes: Buffer.byteLength(userText, 'utf8'),
        // Full prompt content goes to matter track (work_product_factual).
        systemText: assembled.system,
        userText,
      });
    }

    let resp;
    try {
      resp = await this.options.provider.invoke(request);
    } catch (err) {
      return {
        status: 'blocked',
        blockReason: `llm provider error: ${(err as Error).message}`,
      };
    }

    if (this.options.invocationLogger) {
      this.options.invocationLogger.logCompletionReceived({
        envelope: input.envelope,
        agentId: this.agentId,
        templateId: this.options.templateId,
        templateVersion: this.options.templateVersion,
        completionText: resp.content,
        stopReason: resp.stopReason,
        usage: resp.usage,
      });
    }

    let parsed = parseJsonLoose(resp.content);
    let lastCompletion = resp.content;
    const maxRepairs = Math.max(0, this.options.repairAttempts ?? 1);
    let repairs = 0;
    while (parsed === undefined && repairs < maxRepairs) {
      repairs += 1;
      const repairRequest: LLMRequest = {
        system: assembled.system,
        messages: [
          { role: 'user', content: userText },
          { role: 'assistant', content: lastCompletion },
          {
            role: 'user',
            content:
              'Your previous response was not parseable as a single JSON object. Re-emit the same answer as a SINGLE valid JSON object. No prose, no markdown fences, no commentary.',
          },
        ],
        cacheNamespace: cacheKeyForScope(input.envelope),
        temperature: this.options.sampling?.temperature,
        maxTokens: this.options.sampling?.maxTokens,
        model: this.options.sampling?.model,
      };
      try {
        const repairResp = await this.options.provider.invoke(repairRequest);
        lastCompletion = repairResp.content;
        if (this.options.invocationLogger) {
          this.options.invocationLogger.logCompletionReceived({
            envelope: input.envelope,
            agentId: this.agentId,
            templateId: this.options.templateId,
            templateVersion: this.options.templateVersion,
            completionText: repairResp.content,
            stopReason: `${repairResp.stopReason ?? 'unknown'}_repair${repairs}`,
            usage: repairResp.usage,
          });
        }
        parsed = parseJsonLoose(repairResp.content);
      } catch (err) {
        return {
          status: 'blocked',
          blockReason: `llm provider error during JSON repair: ${(err as Error).message}`,
        };
      }
    }
    if (parsed === undefined) {
      return {
        status: 'escalated',
        escalationReason: `completion did not contain a parseable JSON object after ${repairs} repair attempt(s)`,
        metrics: { stopReason: resp.stopReason ?? 'unknown', repairs: String(repairs) },
      };
    }
    return {
      status: 'completed',
      output: parsed,
      metrics: repairs > 0 ? { repairs: String(repairs) } : undefined,
    };
  }
}

/**
 * Tolerant JSON extractor: strips markdown fences and locates the first
 * balanced JSON object in the completion. Wave 11+ adds repair-loop.
 */
function parseJsonLoose(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  // direct attempt
  try { return JSON.parse(cleaned); } catch {
    // locate first {...} or [...] balanced span
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let start = -1;
    if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) start = firstBrace;
    else if (firstBracket >= 0) start = firstBracket;
    if (start < 0) return undefined;
    const open = cleaned[start];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    for (let i = start; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(cleaned.slice(start, i + 1)); } catch { return undefined; }
        }
      }
    }
    return undefined;
  }
}
