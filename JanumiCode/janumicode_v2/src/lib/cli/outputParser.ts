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
   * Parse a single line of stdout output into a ParsedEvent.
   */
  parseLine(line: string): ParsedEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Try JSON parse for stream-json format
    if (this.config.outputFormat === 'stream-json') {
      return this.parseStreamJson(trimmed);
    }

    // Fallback: treat as plain text reasoning step
    return this.createEvent('agent_reasoning_step', { text: trimmed }, false);
  }

  /**
   * Parse Claude Code CLI stream-json format.
   * Each line is a JSON object with a `type` field.
   */
  private parseStreamJson(line: string): ParsedEvent | null {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(line);
    } catch {
      // Not valid JSON — treat as raw text
      return this.createEvent('agent_reasoning_step', { text: line }, false);
    }

    const eventType = json.type as string;
    if (!eventType) return null;

    // Map to Governed Stream record type
    const recordType = this.config.recordMapping[eventType];
    if (!recordType) {
      // Unknown event type — skip
      return null;
    }

    // Self-correction detection
    const isSelfCorrection = this.detectSelfCorrection(recordType, json);

    return this.createEvent(recordType, json, isSelfCorrection);
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
  ): ParsedEvent {
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
