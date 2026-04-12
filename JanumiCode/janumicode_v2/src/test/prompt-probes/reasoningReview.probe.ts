/**
 * Prompt probe: Reasoning Review (cross-cutting)
 *
 * Two test cases:
 *   1. Clean trace — model should produce overall_pass: true, flaws: []
 *   2. Convergent trace — model should detect premature_convergence and
 *      unsupported_assumption flaws
 *
 * Both tests run an Ollama judge as a second-stage assessment.
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama, type ProbeResult } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Reasoning Review', () => {
  it('produces valid review finding no flaws in genuinely clean trace', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'reasoning_review_clean',
      templateKey: 'cross_cutting/reasoning_review.system',
      variables: {
        // Clean trace where the agent's reasoning matches its output exactly.
        // The agent assesses each required field and records the result.
        trace_selection: `[REASONING] (seq 0):
I need to analyze the raw intent to identify what is being built, who it serves, and what problem it solves.

[REASONING] (seq 1):
The intent says: "Build a task management application for small software teams." This explicitly states what is being built (task management application), who it serves (small software teams), and the implicit problem it solves (managing tasks for that audience).

[TOOL CALL] (seq 2):
No tools called — this is an Orchestrator LLM call, not a CLI agent.

[REASONING] (seq 3):
Each required completeness field is present in the intent. No conflicting elements detected. The product concept is internally consistent. I will report all three completeness fields as present and leave consistency_findings and coherence_findings empty since no issues were found (these arrays list ISSUES, not assessments).`,
        final_output: `{"completeness_findings": [{"field": "what_is_being_built", "status": "present"}, {"field": "who_it_serves", "status": "present"}, {"field": "problem_it_solves", "status": "present"}], "consistency_findings": [], "coherence_findings": [], "overall_status": "pass"}`,
        required_output_specification: 'A JSON object matching intent_quality_report schema with completeness_findings (array of {field, status}), consistency_findings (array of issues — empty if none), coherence_findings (array of issues — empty if none), overall_status.',
        phase_gate_criteria: 'intent_quality_report schema-valid, overall_status is pass or requires_input, no blocking contradictions.',
        governing_adrs: '',
        completion_criteria: '',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (typeof parsed.overall_pass !== 'boolean') errors.push('Missing overall_pass boolean');
        if (!Array.isArray(parsed.flaws)) errors.push('Missing flaws array');
        const flaws = (parsed.flaws as { flaw_type: string }[]) ?? [];

        // Strict: clean trace must produce overall_pass: true with empty flaws array
        if (parsed.overall_pass !== true) {
          errors.push(`Clean trace must produce overall_pass: true, got ${parsed.overall_pass} with flaws: [${flaws.map(f => f.flaw_type).join(', ')}]`);
        }
        if (flaws.length !== 0) {
          errors.push(`Clean trace must have empty flaws array, got: [${flaws.map(f => f.flaw_type).join(', ')}]`);
        }
        // Logical consistency: overall_pass = true ⇔ flaws is empty
        if (parsed.overall_pass === true && flaws.length > 0) {
          errors.push(`Logical contradiction: overall_pass=true but flaws array has ${flaws.length} items`);
        }
        if (parsed.overall_pass === false && flaws.length === 0) {
          errors.push('Logical contradiction: overall_pass=false but flaws array is empty');
        }

        return errors;
      },
      // Judge rubric: independent second-stage assessment of the review
      judgeRubric: {
        name: 'Reasoning Review of Clean Trace',
        criteria: [
          'overall_pass is true',
          'flaws array is empty',
          'No false positives — the trace is genuinely clean and the reviewer should not have invented flaws',
          'The output is the reviewer\'s flaw-report schema (overall_pass + flaws), NOT a copy of the reviewed agent\'s schema',
        ],
        reasoningCriteria: [
          'The reviewer correctly identified that consistency_findings/coherence_findings as empty arrays represents "no issues found", not missing data',
          'The reviewer did not waste reasoning cycles disambiguating its own output format vs the reviewed agent\'s output format',
          'The reviewer scanned all 13 flaw types from the taxonomy before concluding clean',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);

  it('detects flaws in a trace that collapses options prematurely', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'reasoning_review_convergence',
      templateKey: 'cross_cutting/reasoning_review.system',
      variables: {
        // This trace contains MULTIPLE flaws:
        //   - premature_convergence: collapsed React/PostgreSQL/enterprise without exploration
        //   - unsupported_assumption: claimed React/PostgreSQL are "best" without evidence
        //   - unsupported_assumption: claimed users are "obviously enterprise" without evidence
        trace_selection: `[REASONING] (seq 0):
The user wants a task management app. I'll design it as a web application using React and PostgreSQL.

[REASONING] (seq 1):
Since React is clearly the best choice, I won't consider other frameworks. PostgreSQL is the only database worth using for this.

[REASONING] (seq 2):
The target users are obviously enterprise teams, so I'll scope this for large organizations with SSO integration.`,
        final_output: `{"candidate_product_concepts": [{"id": "c1", "name": "Enterprise Task Manager", "description": "A React+PostgreSQL enterprise task management solution with SSO", "who_it_serves": "Large enterprise teams", "problem_it_solves": "Enterprise task coordination", "assumptions": [], "constraints": ["Must use React", "Must use PostgreSQL"], "open_questions": []}]}`,
        required_output_specification: 'intent_bloom with MULTIPLE candidate_product_concepts (at least 3 to demonstrate bloom-and-prune), surfaced assumptions for every inferred fact, open questions for every ambiguity.',
        phase_gate_criteria: 'At least 3 candidate concepts generated. All assumptions surfaced. No premature convergence.',
        governing_adrs: '',
        completion_criteria: '',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (typeof parsed.overall_pass !== 'boolean') errors.push('Missing overall_pass');
        if (!Array.isArray(parsed.flaws)) errors.push('Missing flaws array');

        const flaws = (parsed.flaws as { flaw_type: string; severity: string }[]) ?? [];

        // Strict: this trace MUST be flagged
        if (parsed.overall_pass !== false) {
          errors.push(`Convergent trace must produce overall_pass: false (the trace contains premature_convergence and unsupported_assumption violations)`);
        }
        if (flaws.length === 0) {
          errors.push('Convergent trace must have at least one flaw — none were detected');
        }

        // The trace has THREE distinct flaw signals; the reviewer should catch at least one of:
        // - premature_convergence (the agent collapsed options without exploring alternatives)
        // - unsupported_assumption (claimed React is "clearly best" with no evidence)
        // - completeness_shortcut (only 1 candidate concept produced, spec required >=3)
        const expectedFlawTypes = ['premature_convergence', 'unsupported_assumption', 'completeness_shortcut'];
        const detectedTypes = flaws.map(f => f.flaw_type);
        const matched = expectedFlawTypes.filter(t => detectedTypes.includes(t));
        if (matched.length === 0) {
          errors.push(`Expected at least one of [${expectedFlawTypes.join(', ')}], got: [${detectedTypes.join(', ')}]`);
        }

        // premature_convergence MUST be severity: high per template rules
        const pcFlaws = flaws.filter(f => f.flaw_type === 'premature_convergence');
        for (const pc of pcFlaws) {
          if (pc.severity !== 'high') {
            errors.push(`premature_convergence must be severity: high (template rule), got: ${pc.severity}`);
          }
        }

        return errors;
      },
      judgeRubric: {
        name: 'Reasoning Review of Convergent Trace',
        criteria: [
          'overall_pass is false',
          'flaws array contains at least one entry',
          'At least one flaw is premature_convergence, unsupported_assumption, or completeness_shortcut',
          'Every flaw cites specific evidence from the provided trace (not invented)',
          'Any premature_convergence flaw has severity: high',
        ],
        reasoningCriteria: [
          'The reviewer noticed the agent collapsed options without exploring alternatives',
          'The reviewer noticed phrases like "clearly the best", "only ... worth using", "obviously" as evidence of unsupported assumptions',
          'The reviewer did not flag legitimate decisions as flaws (no false positives)',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
