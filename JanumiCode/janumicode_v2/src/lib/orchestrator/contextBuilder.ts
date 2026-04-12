/**
 * ContextBuilder — constructs two-channel Context Payloads for CLI-backed agents.
 * Based on JanumiCode Spec v2.3, §7.2 and §7.3.
 *
 * Channel 1 — Stdin Directive: governing constraints, required output spec,
 *             summary context, detail file reference. Token-budgeted.
 * Channel 2 — Detail File: full context packet, narrative memories,
 *             decision traces, technical specs, compliance context.
 *
 * Also constructs Trace Selections for Reasoning Review (§7.3).
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// ── Types ───────────────────────────────────────────────────────────

export interface StdinDirective {
  /** The assembled stdin text to pipe to the CLI agent */
  text: string;
  /** Approximate token count */
  tokenCount: number;
  /** Whether governing constraints were truncated (should never happen) */
  governingConstraintsTruncated: boolean;
  /** Whether summary context was truncated */
  summaryContextTruncated: boolean;
}

export interface DetailFile {
  /** Filesystem path where the detail file was written */
  path: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Whether content was truncated due to size limit */
  truncated: boolean;
}

export interface ContextPayload {
  stdin: StdinDirective;
  detailFile: DetailFile | null;
}

export interface ContextBuilderOptions {
  /** Maximum tokens for stdin directive */
  stdinMaxTokens: number;
  /** Maximum bytes for detail file */
  detailFileMaxBytes: number;
  /** Path template for detail files */
  detailFilePathTemplate: string;
  /** Workspace root path */
  workspacePath: string;
}

export interface StdinContent {
  /** Governing constraints — Authority Level 6+ (NEVER truncated) */
  governingConstraints: string;
  /** Required output specification from prompt template */
  requiredOutputSpec: string;
  /** Summary context from Context Packet */
  summaryContext: string;
  /** Detail file path and description */
  detailFileReference: string;
  /** Invariant violation findings from prior retry (if any) */
  invariantViolations?: string;
  /** Reasoning review findings from prior retry (if any) */
  reasoningReviewFindings?: string;
}

export interface DetailFileContent {
  /** Full Context Packet from Deep Memory Research */
  contextPacket?: string;
  /** Narrative Memories from all prior phases */
  narrativeMemories?: { phaseId: string; phaseName: string; content: string }[];
  /** Decision Traces relevant to this Sub-Phase */
  decisionTraces?: string;
  /** Technical Specifications for referenced Components */
  technicalSpecs?: { componentId: string; content: string }[];
  /** Full compliance context */
  complianceContext?: string;
  /** Unsticking resolution records */
  unstickingResolutions?: string;
}

// ── Trace Selection Types (§7.3) ────────────────────────────────────

export interface TraceRecord {
  id: string;
  type: 'agent_reasoning_step' | 'agent_self_correction' | 'tool_call' | 'tool_result';
  sequencePosition: number;
  content: string;
  tokenCount: number;
}

export interface TraceSelection {
  /** Record IDs included in the selection */
  selectedRecordIds: string[];
  /** Whether stride sampling was applied */
  samplingApplied: boolean;
  /** Stride N if sampling was applied */
  strideN: number | null;
  /** Total tokens in the selection */
  totalTokens: number;
}

// ── ContextBuilder ──────────────────────────────────────────────────

export class ContextBuilder {
  constructor(private readonly options: ContextBuilderOptions) {}

  /**
   * Build the full two-channel Context Payload.
   */
  buildContextPayload(
    subPhaseId: string,
    invocationId: string,
    stdinContent: StdinContent,
    detailFileContent?: DetailFileContent,
  ): ContextPayload {
    // Build detail file first (so we have the path for stdin reference)
    let detailFile: DetailFile | null = null;
    if (detailFileContent) {
      const detailPath = this.resolveDetailFilePath(subPhaseId, invocationId);
      detailFile = this.writeDetailFile(detailPath, detailFileContent);
    }

    // Build stdin directive
    const stdin = this.buildStdinDirective(stdinContent);

    return { stdin, detailFile };
  }

  /**
   * Build the stdin directive with token budgeting.
   * Governing constraints are NEVER truncated — hard stop if they overflow.
   */
  buildStdinDirective(content: StdinContent): StdinDirective {
    const sections: string[] = [];
    let governingConstraintsTruncated = false;
    let summaryContextTruncated = false;

    // 1. Governing Constraints (never omitted, never truncated)
    if (content.governingConstraints) {
      sections.push(
        'GOVERNING CONSTRAINTS (apply without exception):\n' +
        content.governingConstraints,
      );
    }

    // 1b. Invariant violations from prior retry
    if (content.invariantViolations) {
      sections.push(
        '[JC:INVARIANT VIOLATION]\n' + content.invariantViolations,
      );
    }

    // 1c. Reasoning review findings from prior retry
    if (content.reasoningReviewFindings) {
      sections.push(
        '[JC:REASONING REVIEW FINDINGS]\n' + content.reasoningReviewFindings,
      );
    }

    // 2. Required Output Specification
    if (content.requiredOutputSpec) {
      sections.push(
        'REQUIRED OUTPUT:\n' + content.requiredOutputSpec,
      );
    }

    // Check governing constraints fit within 90% of budget
    const governingTokens = this.approximateTokens(sections.join('\n\n'));
    const budgetLimit = this.options.stdinMaxTokens;

    if (governingTokens > budgetLimit * 0.9) {
      governingConstraintsTruncated = true;
      // Hard stop — caller should escalate to human
    }

    // 3. Summary Context (truncatable)
    if (content.summaryContext) {
      const remainingBudget = budgetLimit - governingTokens;
      const summaryTokens = this.approximateTokens(content.summaryContext);

      if (summaryTokens <= remainingBudget * 0.8) {
        sections.push('CONTEXT SUMMARY:\n' + content.summaryContext);
      } else {
        // Truncate summary context
        const truncated = this.truncateToTokens(
          content.summaryContext,
          Math.floor(remainingBudget * 0.7),
        );
        sections.push(
          'CONTEXT SUMMARY:\n' + truncated +
          '\n[NOTE: Summary context was truncated due to token limit. ' +
          'Full context is available in the detail file.]',
        );
        summaryContextTruncated = true;
      }
    }

    // 4. Detail File Reference
    if (content.detailFileReference) {
      sections.push(content.detailFileReference);
    }

    const text = sections.join('\n\n');
    const tokenCount = this.approximateTokens(text);

    return {
      text,
      tokenCount,
      governingConstraintsTruncated,
      summaryContextTruncated,
    };
  }

  /**
   * Write the detail file to disk.
   */
  writeDetailFile(
    filePath: string,
    content: DetailFileContent,
  ): DetailFile {
    const sections: string[] = [];

    sections.push(
      `# JanumiCode Context Detail File\n` +
      `Generated: ${new Date().toISOString()}\n`,
    );

    if (content.contextPacket) {
      sections.push(
        '## Deep Memory Research — Full Context Packet\n\n' +
        '```json\n' + content.contextPacket + '\n```',
      );
    }

    if (content.narrativeMemories?.length) {
      sections.push('## Narrative Memories — All Prior Phases');
      for (const nm of content.narrativeMemories) {
        sections.push(`### Phase ${nm.phaseId}: ${nm.phaseName}\n\n${nm.content}`);
      }
    }

    if (content.decisionTraces) {
      sections.push(
        '## Decision Traces — Relevant to This Sub-Phase\n\n' +
        content.decisionTraces,
      );
    }

    if (content.technicalSpecs?.length) {
      sections.push('## Technical Specifications — Referenced Components');
      for (const spec of content.technicalSpecs) {
        sections.push(`### Component: ${spec.componentId}\n\n${spec.content}`);
      }
    }

    if (content.complianceContext) {
      sections.push(
        '## Compliance Context — Full Detail\n\n' +
        content.complianceContext,
      );
    }

    if (content.unstickingResolutions) {
      sections.push(
        '## Unsticking Resolutions — Relevant Problem Classes\n\n' +
        content.unstickingResolutions,
      );
    }

    let markdown = sections.join('\n\n');
    let truncated = false;

    // Enforce size limit
    const bytes = Buffer.byteLength(markdown, 'utf-8');
    if (bytes > this.options.detailFileMaxBytes) {
      // Truncate from the end (lowest priority content last)
      markdown = markdown.slice(0, this.options.detailFileMaxBytes - 100);
      markdown += '\n\n[TRUNCATED — detail file exceeded size limit]';
      truncated = true;
    }

    // Write to disk
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, markdown, 'utf-8');

    return {
      path: filePath,
      sizeBytes: Buffer.byteLength(markdown, 'utf-8'),
      truncated,
    };
  }

  // ── Trace Selection Construction (§7.3) ────────────────────────

  /**
   * Construct a Trace Selection from execution trace records.
   * Deterministic — no LLM call required.
   */
  buildTraceSelection(
    traceRecords: TraceRecord[],
    isExecutorAgent: boolean,
    traceMaxTokens: number,
  ): TraceSelection {
    const selected = new Set<string>();
    let totalTokens = 0;

    // Always include: all self-corrections
    for (const r of traceRecords) {
      if (r.type === 'agent_self_correction') {
        selected.add(r.id);
        totalTokens += r.tokenCount;
      }
    }

    // Always include: all tool calls (invocation only, not results)
    for (const r of traceRecords) {
      if (r.type === 'tool_call') {
        selected.add(r.id);
        totalTokens += r.tokenCount;
      }
    }

    // Always EXCLUDE: tool results
    // (available in Governed Stream for Unsticking Agent)

    // Reasoning steps: first, last, pre-tool-call, pre-self-correction
    const reasoningSteps = traceRecords.filter(r => r.type === 'agent_reasoning_step');

    if (reasoningSteps.length > 0) {
      // First step
      selected.add(reasoningSteps[0].id);
      totalTokens += reasoningSteps[0].tokenCount;

      // Last step
      if (reasoningSteps.length > 1) {
        const last = reasoningSteps[reasoningSteps.length - 1];
        selected.add(last.id);
        totalTokens += last.tokenCount;
      }

      // Steps preceding tool calls and self-corrections
      for (let i = 1; i < traceRecords.length; i++) {
        const curr = traceRecords[i];
        if (curr.type === 'tool_call' || curr.type === 'agent_self_correction') {
          const prev = traceRecords[i - 1];
          if (prev.type === 'agent_reasoning_step' && !selected.has(prev.id)) {
            selected.add(prev.id);
            totalTokens += prev.tokenCount;
          }
        }
      }
    }

    // Executor Agent only: uniform stride sampling for remaining steps
    let samplingApplied = false;
    let strideN: number | null = null;

    if (isExecutorAgent) {
      const unselectedSteps = reasoningSteps.filter(r => !selected.has(r.id));

      if (unselectedSteps.length > 0) {
        const remainingBudget = traceMaxTokens - totalTokens;

        if (remainingBudget > 0) {
          const totalUnselectedTokens = unselectedSteps.reduce((sum, r) => sum + r.tokenCount, 0);

          if (totalUnselectedTokens <= remainingBudget) {
            // All fit
            for (const r of unselectedSteps) {
              selected.add(r.id);
              totalTokens += r.tokenCount;
            }
          } else {
            // Uniform stride sampling
            samplingApplied = true;
            const avgTokens = totalUnselectedTokens / unselectedSteps.length;
            const availableSlots = Math.floor(remainingBudget / avgTokens);
            strideN = Math.ceil(unselectedSteps.length / Math.max(availableSlots, 1));

            for (let i = 0; i < unselectedSteps.length; i += strideN) {
              const r = unselectedSteps[i];
              selected.add(r.id);
              totalTokens += r.tokenCount;
            }

            // Always include steps adjacent to self-corrections
            for (const r of traceRecords) {
              if (r.type === 'agent_self_correction') {
                const idx = traceRecords.indexOf(r);
                if (idx > 0) {
                  const before = traceRecords[idx - 1];
                  if (before.type === 'agent_reasoning_step' && !selected.has(before.id)) {
                    selected.add(before.id);
                    totalTokens += before.tokenCount;
                  }
                }
                if (idx < traceRecords.length - 1) {
                  const after = traceRecords[idx + 1];
                  if (after.type === 'agent_reasoning_step' && !selected.has(after.id)) {
                    selected.add(after.id);
                    totalTokens += after.tokenCount;
                  }
                }
              }
            }
          }
        }
      }
    }

    return {
      selectedRecordIds: Array.from(selected),
      samplingApplied,
      strideN,
      totalTokens,
    };
  }

  // ── Token Approximation ────────────────────────────────────────

  /**
   * Approximate token count using character-based estimation.
   * 4 chars ≈ 1 token with 10% safety margin.
   */
  approximateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4 * 1.1);
  }

  /**
   * Truncate text to approximate token count.
   */
  private truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = Math.floor(maxTokens * 4 / 1.1);
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars);
  }

  /**
   * Resolve the detail file path from template.
   */
  private resolveDetailFilePath(subPhaseId: string, invocationId: string): string {
    return this.options.detailFilePathTemplate
      .replace('{sub_phase_id}', subPhaseId)
      .replace('{invocation_id}', invocationId);
  }
}
