/**
 * Gap Report Enhancer - Enhance gap reports with detailed diagnostics.
 *
 * Wave 4 enhancements:
 *   - Detailed missing record analysis
 *   - Schema violation categorization
 *   - Assertion failure context
 *   - Suggested fixes with code snippets
 *   - Spec reference links
 */

import type { Database } from '../../lib/database/init';
import type { LLMCaller } from '../../lib/llm/llmCaller';
import type { GapReport, MissingRecord, SchemaViolation, AssertionFailure } from './types';

export interface EnhancedGapReport extends GapReport {
  /** Detailed analysis of each missing record */
  missing_record_analysis: Array<{
    record_type: string;
    phase: string;
    reason: string;
    impact: 'blocking' | 'degraded' | 'informational';
    suggested_fix: string;
    code_snippet?: string;
  }>;
  /** Categorized schema violations */
  violation_categories: {
    authority: SchemaViolation[];
    schema: SchemaViolation[];
    semantic: SchemaViolation[];
  };
  /** Assertion failures with context */
  assertion_context: Array<{
    failure: AssertionFailure;
    expected_behavior: string;
    actual_behavior: string;
    root_cause_hypothesis: string;
  }>;
  /** AI spend analysis */
  ai_spend_analysis?: {
    total_input_tokens: number;
    total_output_tokens: number;
    estimated_cost_usd: number;
    by_phase: Record<string, { input: number; output: number }>;
    cost_breakdown: Array<{ phase: string; provider: string; cost: number }>;
  };
  /** CI failsafe triggers */
  ci_failsafe_triggers: FailsafeTrigger[];
}

export interface FailsafeTrigger {
  type: 'max_cost_exceeded' | 'max_duration_exceeded' | 'error_rate_exceeded' | 'phase_stuck';
  threshold: number;
  actual: number;
  message: string;
  action: 'abort' | 'warn' | 'pause_for_human';
}

/**
 * Enhance a gap report with detailed diagnostics.
 */
export function enhanceGapReport(
  db: Database,
  workflowRunId: string,
  baseReport: GapReport,
): EnhancedGapReport {
  const missingRecordAnalysis = analyzeMissingRecords(db, workflowRunId, baseReport.missing_records);
  const violationCategories = categorizeViolations(baseReport.schema_violations);
  const assertionContext = analyzeAssertionFailures(db, workflowRunId, baseReport.assertion_failures);
  const aiSpendAnalysis = analyzeAISpend(db, workflowRunId);
  const failsafeTriggers = checkFailsafes(db, workflowRunId);

  return {
    ...baseReport,
    missing_record_analysis: missingRecordAnalysis,
    violation_categories: violationCategories,
    assertion_context: assertionContext,
    ai_spend_analysis: aiSpendAnalysis,
    ci_failsafe_triggers: failsafeTriggers,
  };
}

function analyzeMissingRecords(
  _db: Database,
  _workflowRunId: string,
  missingRecords: MissingRecord[],
): EnhancedGapReport['missing_record_analysis'] {
  return missingRecords.map(missing => {
    const impact = determineImpact(missing.record_type);
    const fix = generateFix(missing);
    const snippet = generateCodeSnippet(missing);

    return {
      record_type: missing.record_type,
      phase: missing.phase,
      reason: missing.reason,
      impact,
      suggested_fix: fix,
      code_snippet: snippet,
    };
  });
}

function determineImpact(recordType: string): 'blocking' | 'degraded' | 'informational' {
  const blockingRecords = [
    'intent_received',
    'intent_classified',
    'requirements_extracted',
    'architecture_proposed',
    'execution_completed',
    'review_decision',
  ];

  const degradedRecords = [
    'requirements_prioritized',
    'historical_synthesis_produced',
    'commit_created',
  ];

  if (blockingRecords.includes(recordType)) {
    return 'blocking';
  }
  if (degradedRecords.includes(recordType)) {
    return 'degraded';
  }
  return 'informational';
}

function generateFix(missing: MissingRecord): string {
  const fixes: Record<string, string> = {
    intent_received: 'Ensure the workflow starts with a user intent submission.',
    intent_classified: 'Check that the liaison agent correctly classifies the intent.',
    requirements_extracted: 'Verify the requirements extraction phase runs and produces output.',
    architecture_proposed: 'Ensure the architecture phase handler is registered and executes.',
    execution_completed: 'Check execution phase for errors or missing steps.',
    review_decision: 'Ensure the review gate is presented and a decision is made.',
  };

  return fixes[missing.record_type] ?? `Implement handler to produce ${missing.record_type} records.`;
}

function generateCodeSnippet(missing: MissingRecord): string | undefined {
  const snippets: Record<string, string> = {
    intent_received: `// In headlessLiaisonAdapter.ts
await this.emitRecord({
  record_type: 'intent_received',
  phase_id: '0',
  content: { text: intent }
});`,
    intent_classified: `// In Phase0Handler.ts
const classification = await this.classifyIntent(intent);
await this.emitRecord({
  record_type: 'intent_classified',
  phase_id: '0',
  content: classification
});`,
  };

  return snippets[missing.record_type];
}

function categorizeViolations(
  violations: SchemaViolation[],
): EnhancedGapReport['violation_categories'] {
  return {
    authority: violations.filter(v => v.field === 'authority_level'),
    schema: violations.filter(v => v.field !== 'authority_level' && v.field !== 'semantic'),
    semantic: violations.filter(v => v.field === 'semantic'),
  };
}

function analyzeAssertionFailures(
  db: Database,
  workflowRunId: string,
  failures: AssertionFailure[],
): EnhancedGapReport['assertion_context'] {
  return failures.map(failure => {
    const context = getFailureContext(db, workflowRunId, failure);
    return {
      failure,
      expected_behavior: context.expected,
      actual_behavior: context.actual,
      root_cause_hypothesis: context.hypothesis,
    };
  });
}

function getFailureContext(
  _db: Database,
  _workflowRunId: string,
  failure: AssertionFailure,
): { expected: string; actual: string; hypothesis: string } {
  const contexts: Record<string, { expected: string; actual: string; hypothesis: string }> = {
    validateIntentText: {
      expected: 'Intent text should be non-empty string',
      actual: 'Intent text was empty or missing',
      hypothesis: 'Intent submission may have failed or been truncated',
    },
    validateClassificationCategory: {
      expected: 'Classification should have a valid category',
      actual: 'Classification category was missing or invalid',
      hypothesis: 'LLM response parsing may have failed',
    },
    validateArchitectureComponents: {
      expected: 'Architecture should define at least one component',
      actual: 'No components defined in architecture',
      hypothesis: 'Architecture proposal may have been incomplete',
    },
  };

  return contexts[failure.assertion] ?? {
    expected: 'Assertion should pass',
    actual: 'Assertion failed',
    hypothesis: 'Unknown cause',
  };
}

function analyzeAISpend(
  db: Database,
  workflowRunId: string,
): EnhancedGapReport['ai_spend_analysis'] | undefined {
  // Query LLM call records
  const llmCalls = db.prepare(`
    SELECT 
      phase_id,
      content->>'$.provider' as provider,
      content->>'$.inputTokens' as input_tokens,
      content->>'$.outputTokens' as output_tokens
    FROM governed_stream
    WHERE workflow_run_id = ?
      AND record_type = 'agent_invocation'
  `).all(workflowRunId) as Array<{
    phase_id: string | null;
    provider: string | null;
    input_tokens: string | null;
    output_tokens: string | null;
  }>;

  if (llmCalls.length === 0) {
    return undefined;
  }

  let totalInput = 0;
  let totalOutput = 0;
  const byPhase: Record<string, { input: number; output: number }> = {};
  const costBreakdown: Array<{ phase: string; provider: string; cost: number }> = [];

  // Pricing per 1M tokens (approximate)
  const pricing: Record<string, { input: number; output: number }> = {
    anthropic: { input: 3.0, output: 15.0 },
    openai: { input: 2.5, output: 10.0 },
    google: { input: 1.25, output: 5.0 },
    ollama: { input: 0, output: 0 },
    mock: { input: 0, output: 0 },
  };

  for (const call of llmCalls) {
    const input = Number.parseInt(call.input_tokens ?? '0', 10) || 0;
    const output = Number.parseInt(call.output_tokens ?? '0', 10) || 0;
    const phase = call.phase_id ?? 'unknown';
    const provider = call.provider ?? 'unknown';

    totalInput += input;
    totalOutput += output;

    if (!byPhase[phase]) {
      byPhase[phase] = { input: 0, output: 0 };
    }
    byPhase[phase].input += input;
    byPhase[phase].output += output;

    const rates = pricing[provider] ?? { input: 0, output: 0 };
    const cost = (input * rates.input + output * rates.output) / 1_000_000;
    if (cost > 0) {
      costBreakdown.push({ phase, provider, cost });
    }
  }

  const totalCost = costBreakdown.reduce((sum, c) => sum + c.cost, 0);

  return {
    total_input_tokens: totalInput,
    total_output_tokens: totalOutput,
    estimated_cost_usd: totalCost,
    by_phase: byPhase,
    cost_breakdown: costBreakdown,
  };
}

function checkFailsafes(
  db: Database,
  workflowRunId: string,
): FailsafeTrigger[] {
  const triggers: FailsafeTrigger[] = [];

  // Check max cost
  const maxCostUsd = Number(process.env.JANUMICODE_MAX_COST_USD ?? '1');
  const spend = analyzeAISpend(db, workflowRunId);
  if (spend && spend.estimated_cost_usd > maxCostUsd) {
    triggers.push({
      type: 'max_cost_exceeded',
      threshold: maxCostUsd,
      actual: spend.estimated_cost_usd,
      message: `AI spend $${spend.estimated_cost_usd.toFixed(4)} exceeds limit $${maxCostUsd}`,
      action: 'abort',
    });
  }

  // Check max duration
  const maxDurationMs = Number(process.env.JANUMICODE_MAX_DURATION_MS ?? '300000'); // 5 min
  const runRecord = db.prepare(`
    SELECT 
      initiated_at,
      completed_at
    FROM workflow_runs
    WHERE id = ?
  `).get(workflowRunId) as { initiated_at: string; completed_at: string | null } | undefined;

  if (runRecord) {
    const startTime = new Date(runRecord.initiated_at).getTime();
    const endTime = runRecord.completed_at
      ? new Date(runRecord.completed_at).getTime()
      : Date.now();
    const duration = endTime - startTime;

    if (duration > maxDurationMs) {
      triggers.push({
        type: 'max_duration_exceeded',
        threshold: maxDurationMs,
        actual: duration,
        message: `Workflow duration ${duration}ms exceeds limit ${maxDurationMs}ms`,
        action: 'warn',
      });
    }
  }

  // Check error rate
  const totalRecords = db.prepare(`
    SELECT COUNT(*) as count FROM governed_stream WHERE workflow_run_id = ?
  `).get(workflowRunId) as { count: number };

  const errorRecords = db.prepare(`
    SELECT COUNT(*) as count FROM governed_stream 
    WHERE workflow_run_id = ? AND record_type = 'error'
  `).get(workflowRunId) as { count: number };

  if (totalRecords.count > 0) {
    const errorRate = errorRecords.count / totalRecords.count;
    const maxErrorRate = 0.1;

    if (errorRate > maxErrorRate) {
      triggers.push({
        type: 'error_rate_exceeded',
        threshold: maxErrorRate,
        actual: errorRate,
        message: `Error rate ${(errorRate * 100).toFixed(1)}% exceeds limit ${(maxErrorRate * 100)}%`,
        action: 'pause_for_human',
      });
    }
  }

  return triggers;
}

/**
 * Format an enhanced gap report for human reading.
 */
export function formatEnhancedGapReport(report: EnhancedGapReport): string {
  const lines: string[] = [];

  lines.push(`# Gap Report: Phase ${report.phase}`);
  lines.push('');

  if (report.missing_record_analysis.length > 0) {
    lines.push('## Missing Records');
    for (const missing of report.missing_record_analysis) {
      lines.push(`- **${missing.record_type}** (${missing.impact})`);
      lines.push(`  - Reason: ${missing.reason}`);
      lines.push(`  - Fix: ${missing.suggested_fix}`);
      if (missing.code_snippet) {
        lines.push(`  \`\`\`typescript`);
        lines.push(`  ${missing.code_snippet}`);
        lines.push(`  \`\`\``);
      }
    }
    lines.push('');
  }

  if (report.violation_categories.authority.length > 0 ||
      report.violation_categories.schema.length > 0 ||
      report.violation_categories.semantic.length > 0) {
    lines.push('## Schema Violations');
    for (const v of report.violation_categories.authority) {
      lines.push(`- Authority: ${v.record_type} - ${v.error}`);
    }
    for (const v of report.violation_categories.schema) {
      lines.push(`- Schema: ${v.record_type}.${v.field} - ${v.error}`);
    }
    lines.push('');
  }

  if (report.assertion_context.length > 0) {
    lines.push('## Assertion Failures');
    for (const ctx of report.assertion_context) {
      lines.push(`- **${ctx.failure.assertion}**`);
      lines.push(`  - Expected: ${ctx.expected_behavior}`);
      lines.push(`  - Actual: ${ctx.actual_behavior}`);
      lines.push(`  - Hypothesis: ${ctx.root_cause_hypothesis}`);
    }
    lines.push('');
  }

  if (report.ai_spend_analysis) {
    lines.push('## AI Spend Analysis');
    lines.push(`- Total input tokens: ${report.ai_spend_analysis.total_input_tokens}`);
    lines.push(`- Total output tokens: ${report.ai_spend_analysis.total_output_tokens}`);
    lines.push(`- Estimated cost: $${report.ai_spend_analysis.estimated_cost_usd.toFixed(4)}`);
    lines.push('');
  }

  if (report.ci_failsafe_triggers.length > 0) {
    lines.push('## CI Failsafe Triggers');
    for (const trigger of report.ci_failsafe_triggers) {
      lines.push(`- **${trigger.type}**: ${trigger.message}`);
      lines.push(`  - Action: ${trigger.action}`);
    }
    lines.push('');
  }

  lines.push('## Suggested Fix');
  lines.push(report.suggested_fix);
  lines.push('');

  lines.push('## Spec References');
  for (const ref of report.spec_references) {
    lines.push(`- ${ref}`);
  }

  return lines.join('\n');
}

// ── LLM-powered gap suggestions ────────────────────────────────────

export interface LLMGapEnhancementOptions {
  /** Provider name (e.g. 'ollama', 'anthropic'). */
  provider: string;
  /** Model name. */
  model: string;
  /** Max chars of governed-stream context to include. Default 4000. */
  contextChars?: number;
}

/**
 * Call an LLM to produce a specific, actionable "why this broke / what
 * to fix" suggestion for the gap report. Reads the tail of the
 * governed_stream (last ~20 records before the failure) and frames a
 * tight prompt so the model grounds its suggestion in what actually
 * happened rather than spec-reciting.
 *
 * The result is returned as a string the caller can splice onto the
 * base report (either replacing or augmenting `suggested_fix`). On any
 * failure — provider down, parse error, empty response — returns null
 * and the caller falls back to the rule-based suggestion. The gap
 * report path must never block on LLM availability; this is a
 * best-effort enhancement.
 */
export async function generateLLMGapSuggestion(
  db: Database,
  workflowRunId: string,
  baseReport: GapReport,
  llmCaller: LLMCaller,
  opts: LLMGapEnhancementOptions,
): Promise<string | null> {
  const contextChars = opts.contextChars ?? 4000;
  const contextText = sampleGovernedStreamTail(db, workflowRunId, contextChars);
  const prompt = buildGapSuggestionPrompt(baseReport, contextText);
  try {
    const result = await llmCaller.call({
      provider: opts.provider,
      model: opts.model,
      prompt,
      responseFormat: 'text',
      temperature: 0.2,
    });
    const text = result.text?.trim();
    if (!text) return null;
    return text;
  } catch {
    // Best-effort: LLM failure must not break the pipeline output.
    return null;
  }
}

function sampleGovernedStreamTail(
  db: Database,
  workflowRunId: string,
  maxChars: number,
): string {
  interface Row {
    record_type: string;
    phase_id: string | null;
    sub_phase_id: string | null;
    content: string | null;
    produced_at: string;
  }
  const rows = db.prepare(
    `SELECT record_type, phase_id, sub_phase_id, content, produced_at
     FROM governed_stream
     WHERE workflow_run_id = ?
     ORDER BY produced_at DESC
     LIMIT 40`,
  ).all(workflowRunId) as Row[];

  // Render newest-first, then reverse so oldest is first in the prompt
  // (natural reading order). Trim content payloads hard — the full
  // artifact bodies would blow the context window before we hit the
  // interesting tail.
  const lines: string[] = [];
  for (const r of rows.slice().reverse()) {
    const trimmed = (r.content ?? '').slice(0, 200);
    lines.push(
      `[${r.produced_at}] (P${r.phase_id ?? '?'}/${r.sub_phase_id ?? '?'}) ` +
        `${r.record_type}: ${trimmed}`,
    );
  }
  return lines.join('\n').slice(-maxChars);
}

function buildGapSuggestionPrompt(report: GapReport, contextText: string): string {
  const missingSummary = report.missing_records.length > 0
    ? report.missing_records
        .slice(0, 5)
        .map((m) => `- ${m.record_type} at Phase ${m.phase}.${m.sub_phase ?? '?'}: ${m.reason}`)
        .join('\n')
    : '(none)';
  const assertionSummary = report.assertion_failures.length > 0
    ? report.assertion_failures
        .slice(0, 5)
        .map((a) => `- ${a.assertion} at ${a.phase}.${a.sub_phase} (expected ${a.expected}, got ${a.actual})`)
        .join('\n')
    : '(none)';

  return [
    'You are a diagnostic assistant for the JanumiCode workflow harness.',
    'A pipeline run produced the following gap report. Given the tail of',
    'its governed_stream, produce a concise 2–4 sentence suggested fix',
    'that names the specific handler / prompt / validator most likely to',
    'need changes. Cite record types or phase ids where possible. Do not',
    'restate the gap — assume the reader has already seen it.',
    '',
    `# Failed at phase: ${report.failed_at_phase}` +
      (report.failed_at_sub_phase ? ` (sub-phase ${report.failed_at_sub_phase})` : ''),
    '',
    '# Missing records',
    missingSummary,
    '',
    '# Assertion failures',
    assertionSummary,
    '',
    '# Governed stream tail (oldest → newest)',
    contextText,
    '',
    '# Your suggested fix (plain text, 2–4 sentences):',
  ].join('\n');
}
