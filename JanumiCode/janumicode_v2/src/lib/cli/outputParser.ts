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
  /** Output format identifier */
  outputFormat: string;
  /** Mapping from tool event types to Governed Stream record types */
  recordMapping: Record<string, string>;
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
   * Parse one line of Claude Code stream-json. Handles both shapes:
   *
   *   1. Nested envelope (real Claude Code CLI output):
   *        { type: 'assistant' | 'user',
   *          message: { content: [{ type: 'text'|'tool_use'|'tool_result', … }] } }
   *        { type: 'result', result: '...', session_id: '...' }
   *        { type: 'system', subtype: 'init', … }  (skipped)
   *
   *   2. Flat shape (stubs, test fixtures, pre-unwrapped streams):
   *        { type: 'assistant'|'tool_use'|'tool_result'|'result'|'text', … }
   *
   * Unknown outer types silently yield [] so a newly added Claude Code
   * envelope kind doesn't crash the pipeline; add it to recordMapping
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

    // Nested envelope: unwrap `message.content[]` into one event per item.
    if ((eventType === 'assistant' || eventType === 'user') && isObject(json.message)) {
      const content = (json.message as { content?: unknown[] }).content;
      if (Array.isArray(content)) {
        const events: ParsedEvent[] = [];
        for (const item of content) {
          if (!isObject(item)) continue;
          const itemType = (item as { type?: string }).type;
          if (!itemType) continue;
          const recordType = this.config.recordMapping[itemType];
          if (!recordType) continue;
          // Flatten common Claude Code shapes so downstream consumers
          // don't have to reach into `input` / `text` fields.
          const data: Record<string, unknown> = { ...(item as Record<string, unknown>) };
          if (itemType === 'text' && typeof data.text === 'string') {
            data.content = data.text;
          }
          const isSelf = this.detectSelfCorrection(recordType, data);
          const event = this.createEvent(recordType, data, isSelf);
          if (event) events.push(event);
        }
        return events;
      }
    }

    // `result` envelope at the end of a run — carries the final summary.
    if (eventType === 'result') {
      const recordType = this.config.recordMapping[eventType];
      if (!recordType) return [];
      const event = this.createEvent(recordType, json, false);
      return event ? [event] : [];
    }

    // `system` / `init` envelopes are skipped — they carry no semantic
    // content we want in the governed stream.
    if (eventType === 'system') return [];

    // Flat shape fallback: map the outer type directly.
    const recordType = this.config.recordMapping[eventType];
    if (!recordType) return [];
    const isSelf = this.detectSelfCorrection(recordType, json);
    const event = this.createEvent(recordType, json, isSelf);
    return event ? [event] : [];
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
    recordMapping: {
      'assistant': 'agent_reasoning_step',
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

/** Generic line-based parser (fallback) */
export function createGenericParser(): OutputParser {
  return new OutputParser({
    outputFormat: 'text',
    recordMapping: {},
  });
}
