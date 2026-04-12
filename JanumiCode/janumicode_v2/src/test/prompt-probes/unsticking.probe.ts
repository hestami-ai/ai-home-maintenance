/**
 * Prompt probes: Unsticking Agent (socratic_turn + tool_result_review)
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Unsticking Socratic Turn', () => {
  it('generates a focused Socratic question for stuck agent', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'unsticking_socratic_scope_blind',
      templateKey: 'cross_cutting/unsticking_socratic_turn.system',
      variables: {
        loop_status: 'SCOPE_BLIND',
        sub_phase_id: '04_2_component_decomposition',
        reasoning_review_findings: 'unsupported_assumption: Agent assumed web-only architecture without checking Intent Statement which mentions mobile clients',
        stuck_agent_trace_summary: 'Agent generated 3 components but did not call Read tool to inspect intent_statement.json',
        turn_number: '1',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output', // Socratic turn returns plain text, no schema validation
      structuralAssertions: () => {
        // Socratic turn returns plain text, not JSON — only check it produced output
        return [];
      },
    });

    logResult(result);
    // Plain text response is fine — only check we got something
    expect(result.response).not.toBeNull();
  }, 300000);
});

describe('Probe: Unsticking Tool Result Review', () => {
  it('detects tool result misinterpretation', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'unsticking_tool_review_misinterpretation',
      templateKey: 'cross_cutting/unsticking_tool_result_review.system',
      variables: {
        stuck_agent_trace: `[REASONING] I need to read the config file
[TOOL CALL] Read({path: "config.json"})
[REASONING] The config file is empty, so I'll use defaults`,
        tool_results: `Tool: Read
Result: {"max_connections": 100, "timeout": 30, "retry_count": 3}`,
        reasoning_review_findings: 'tool_result_misinterpretation_suspected: Agent claimed config was empty but tool returned 3 fields',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (typeof parsed.misinterpretation_confirmed !== 'boolean') {
          errors.push('Missing misinterpretation_confirmed boolean');
        }
        return errors;
      },
      judgeRubric: {
        name: 'Unsticking Tool Result Review — config misinterpretation',
        criteria: [
          'misinterpretation_confirmed is true (the agent clearly misread the tool result)',
          'discrepancy field describes the agent saying "empty" vs actual 3 fields',
          'correction field provides the actual configuration values (max_connections=100, timeout=30, retry_count=3)',
          'No invented tool results',
        ],
        reasoningCriteria: [
          'The reviewer compared the agent\'s stated conclusion ("config file is empty") with the actual tool output',
          'The reviewer identified the specific factual discrepancy',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
