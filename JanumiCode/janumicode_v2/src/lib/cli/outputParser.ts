/**
 * OutputParser — maps CLI tool stdout events to Governed Stream record types.
 * Based on JanumiCode Spec v2.3, §16.2.
 *
 * Configurable per backing tool. Each tool has its own output format
 * and record mapping rules, including self-correction detection.
 */

// ── Types ───────────────────────────────────────────────────────────

export interface ParsedEvent {
  /** Mapped Governed Stream record type */
  recordType: string;
  /** Raw event data */
  data: Record<string, unknown>;
  /** Whether this event represents a self-correction */
  isSelfCorrection: boolean;
  /** Sequence position (auto-incremented) */
  sequencePosition: number;
}


export interface OutputParserConfig {
  /** Output format identifier. `stream-json` unlocks envelope unwrapping. */
  outputFormat: string;
  /**
   * Mapping from tool event types to Governed Stream record types.
   * Keys match either an outer-envelope type (e.g. `result` for Claude
   * Code's final marker) or an inner content-block type (`text`,
   * `tool_use`, `thinking`, `tool_result`). Unknown keys are skipped.
   */
  recordMapping: Record<string, string>;
  /**
   * Outer `type` values that carry `message.content[]` — the parser
   * unwraps each content item into its own event. Claude Code emits
   * `assistant` / `user`; Goose emits `message`. Defaults to
   * `['assistant', 'user']` for backward compat when omitted.
   */
  envelopeTypes?: string[];
  /**
   * Outer `type` value for the run's terminal marker. Claude Code
   * uses `result`; Goose uses `complete`. When set, the parser emits
   * one event per terminal marker mapped through `recordMapping[type]`.
   */
  terminalType?: string;
}

// ── OutputParser ────────────────────────────────────────────────────

export class OutputParser {
  private sequenceCounter = 0;
  private recentToolCalls: { name: string; target?: string }[] = [];
  private config: OutputParserConfig;

  constructor(config: OutputParserConfig) {
    this.config = config;
  }

  /**
   * Parse a single line of stdout output into zero or more ParsedEvents.
   *
   * Claude Code's real stream-json emits envelopes like
   * `{"type":"assistant","message":{"content":[{"type":"text",…},
   * {"type":"tool_use",…}]}}` — one envelope can carry several logical
   * events (a text block plus N tool calls). Returning an array lets
   * the invoker attribute them individually to the governed stream
   * without losing order.
   *
   * For the legacy flat shape (`{type:'tool_use', …}`) the parser
   * still emits one event — callers treat a length-1 array the same
   * as the old scalar return.
   */
  parseLine(line: string): ParsedEvent[] {
    const trimmed = line.trim();
    if (!trimmed) return [];

    if (this.config.outputFormat === 'stream-json') {
      return this.parseStreamJson(trimmed);
    }

    // Non-stream-json parsers treat every non-empty line as reasoning.
    const event = this.createEvent('agent_reasoning_step', { text: trimmed }, false);
    return event ? [event] : [];
  }

  /**
   * Parse one line of stream-json. Handles three agent flavours:
   *
   *   1. Claude Code — outer `type: 'assistant'|'user'` wraps
   *      `message.content[]`; final marker `type: 'result'`.
   *   2. Goose — outer `type: 'message'` wraps `message.content[]`
   *      with an additional `message.role` field; final marker
   *      `type: 'complete'`.
   *   3. Flat / test fixture shape — `{type:'tool_use', …}` with no
   *      envelope.
   *
   * Envelope types are data-driven via `config.envelopeTypes`. The
   * terminal marker comes from `config.terminalType`. Unknown outer
   * types silently yield [] so a newly added envelope kind doesn't
   * crash the pipeline — add it to `envelopeTypes` / `recordMapping`
   * to surface it.
   */
  private parseStreamJson(line: string): ParsedEvent[] {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(line);
    } catch {
      const event = this.createEvent('agent_reasoning_step', { text: line }, false);
      return event ? [event] : [];
    }

    const eventType = json.type as string | undefined;
    if (!eventType) return [];

    const envelopeTypes = this.config.envelopeTypes ?? ['assistant', 'user'];
    if (envelopeTypes.includes(eventType) && isObject(json.message)) {
      return this.unwrapEnvelope(json.message);
    }

    // Final-run marker (`result` for Claude Code, `complete` for Goose)
    // surfaces as a single artifact-producing event.
    if (this.config.terminalType && eventType === this.config.terminalType) {
      const recordType = this.config.recordMapping[eventType];
      if (!recordType) return [];
      const event = this.createEvent(recordType, json, false);
      return event ? [event] : [];
    }

    // `system` / `init` envelopes carry no semantic content we want
    // in the governed stream.
    if (eventType === 'system') return [];

    // Flat shape fallback: map the outer type directly.
    const recordType = this.config.recordMapping[eventType];
    if (!recordType) return [];
    const isSelf = this.detectSelfCorrection(recordType, json);
    const event = this.createEvent(recordType, json, isSelf);
    return event ? [event] : [];
  }

  /**
   * Flatten a `message.content[]` array (Claude Code + Goose share
   * this inner shape) into per-item events. Normalises `text` /
   * `thinking` content so downstream consumers don't have to reach
   * into both `data.text` and `data.thinking`.
   */
  private unwrapEnvelope(message: Record<string, unknown>): ParsedEvent[] {
    const content = message.content;
    if (!Array.isArray(content)) return [];
    const events: ParsedEvent[] = [];
    for (const item of content) {
      if (!isObject(item)) continue;
      const itemType = (item as { type?: string }).type;
      if (!itemType) continue;
      const recordType = this.config.recordMapping[itemType];
      if (!recordType) continue;
      const data: Record<string, unknown> = { ...item };
      if (itemType === 'thinking' && typeof data.thinking === 'string') {
        data.content = data.thinking;
        data.text = data.thinking;
      } else if (itemType === 'text' && typeof data.text === 'string') {
        data.content = data.text;
      }
      const isSelf = this.detectSelfCorrection(recordType, data);
      const event = this.createEvent(recordType, data, isSelf);
      if (event) events.push(event);
    }
    return events;
  }

  /**
   * Detect self-correction patterns per spec §16.2.
   */
  private detectSelfCorrection(recordType: string, data: Record<string, unknown>): boolean {
    if (recordType === 'tool_call') {
      const toolName = (data.name ?? data.tool ?? '') as string;
      const target = this.extractToolTarget(data);

      // Pattern: two consecutive tool_use targeting the same file
      if (this.recentToolCalls.length > 0) {
        const last = this.recentToolCalls[this.recentToolCalls.length - 1];
        if (last.name === toolName && last.target === target && target) {
          this.recentToolCalls.push({ name: toolName, target });
          return true;
        }
      }

      this.recentToolCalls.push({ name: toolName, target });

      // Keep only last 5 tool calls
      if (this.recentToolCalls.length > 5) {
        this.recentToolCalls.shift();
      }
    }

    // Pattern: agent explicitly states correction
    if (recordType === 'agent_reasoning_step') {
      const text = ((data.text ?? data.content ?? '') as string).toLowerCase();
      if (text.includes('i need to fix') ||
          text.includes('that was wrong') ||
          text.includes('let me correct') ||
          text.includes('i made a mistake')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract the target (e.g., file path) from a tool call.
   */
  private extractToolTarget(data: Record<string, unknown>): string | undefined {
    // Claude Code: tool_use events have input.path or input.file_path
    const input = data.input as Record<string, unknown> | undefined;
    if (input) {
      return (input.path ?? input.file_path ?? input.command) as string | undefined;
    }
    return undefined;
  }

  private createEvent(
    recordType: string,
    data: Record<string, unknown>,
    isSelfCorrection: boolean,
  ): ParsedEvent | null {
    return {
      recordType: isSelfCorrection ? 'agent_self_correction' : recordType,
      data,
      isSelfCorrection,
      sequencePosition: this.sequenceCounter++,
    };
  }

  /**
   * Reset parser state between invocations.
   */
  reset(): void {
    this.sequenceCounter = 0;
    this.recentToolCalls = [];
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ── Pre-configured Parsers ──────────────────────────────────────────

/** Claude Code CLI output parser */
export function createClaudeCodeParser(): OutputParser {
  return new OutputParser({
    outputFormat: 'stream-json',
    envelopeTypes: ['assistant', 'user'],
    terminalType: 'result',
    recordMapping: {
      'assistant': 'agent_reasoning_step',
      'thinking': 'agent_reasoning_step',
      'tool_use': 'tool_call',
      'tool_result': 'tool_result',
      'result': 'artifact_produced',
      'text': 'agent_reasoning_step',
    },
  });
}

/** Gemini CLI output parser */
export function createGeminiCliParser(): OutputParser {
  return new OutputParser({
    outputFormat: 'stream-json',
    recordMapping: {
      'text': 'agent_reasoning_step',
      'functionCall': 'tool_call',
      'functionResponse': 'tool_result',
      'result': 'artifact_produced',
    },
  });
}

/**
 * Goose CLI output parser.
 *
 * Goose's `--output-format stream-json` wraps every agent frame in
 *   `{"type":"message","message":{"id","role","created","content":[…],"metadata":{…}}}`
 * with inner content items identical to Claude Code's shape (`text`,
 * `thinking`, `tool_use`, `tool_result`). The final marker is
 *   `{"type":"complete","total_tokens":…}`.
 *
 * Design note: we don't switch on `message.role` — routing by role
 * (user vs assistant vs tool) is already distinguished per-content-item
 * via the inner `type` field (`tool_use` vs `tool_result`). Collapsing
 * the role axis keeps the mapping table flat and makes Goose vs Claude
 * Code traces diffable on content structure alone.
 */
export function createGooseCliParser(): OutputParser {
  return new OutputParser({
    outputFormat: 'stream-json',
    envelopeTypes: ['message'],
    terminalType: 'complete',
    recordMapping: {
      'message': 'agent_reasoning_step',
      'tool_use': 'tool_call',
      'tool_result': 'tool_result',
      'thinking': 'agent_reasoning_step',
      'complete': 'artifact_produced',
      'text': 'agent_reasoning_step',
    },
  });
}

/** Generic line-based parser (fallback) */
export function createGenericParser(): OutputParser {
  return new OutputParser({
    outputFormat: 'text',
    recordMapping: {},
  });
}
