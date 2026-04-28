/**
 * Regression tests for Phase 5's sysReqSummary parameter threading.
 *
 * Background — scope leak that crashed the workflow at Phase 5.1:
 *   Phase 5's `execute()` method declares `sysReqSummary` from
 *   `prior.systemRequirements?.summary`. Each of the four sub-phase
 *   helpers (data_models, api_definitions, error_handling,
 *   configuration_parameters) renders its prompt template with
 *   `system_requirements_summary: sysReqSummary`.
 *
 *   The helpers were originally referencing `sysReqSummary` from the
 *   outer `execute()` scope — but they're DIFFERENT methods on the
 *   class, not nested closures. JavaScript happily compiled the file
 *   (no compile-time error) and crashed at runtime with
 *   `ReferenceError: sysReqSummary is not defined` the moment the LLM
 *   call happened. The fix is to thread sysReqSummary as an explicit
 *   parameter on each of the four helpers.
 *
 * This test file pins both halves of the contract:
 *   1. Each helper signature accepts `sysReqSummary` as a parameter.
 *   2. Each helper passes that parameter through as
 *      `system_requirements_summary` when rendering the template.
 *   3. The four prompt templates referenced by those helpers actually
 *      consume `system_requirements_summary` as a variable, so a
 *      future rename on either side is caught.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const PHASE5_SOURCE = path.resolve(PROJECT_ROOT, 'src', 'lib', 'orchestrator', 'phases', 'phase5.ts');

const HELPER_NAMES = [
  'runDataModelSpecification',
  'runApiDefinition',
  'runErrorHandlingStrategy',
  'runConfigurationParameters',
] as const;

const TEMPLATE_PATHS = [
  '.janumicode/prompts/phases/phase_05_technical_specification/sub_phase_05_1_data_models/data_models.system.md',
  '.janumicode/prompts/phases/phase_05_technical_specification/sub_phase_05_2_api_definitions/api_definitions.system.md',
  '.janumicode/prompts/phases/phase_05_technical_specification/sub_phase_05_3_error_handling/error_handling_strategies.system.md',
  '.janumicode/prompts/phases/phase_05_technical_specification/sub_phase_05_4_configuration_parameters/configuration_parameters.system.md',
];

describe('phase5 — sysReqSummary parameter threading', () => {
  const source = fs.readFileSync(PHASE5_SOURCE, 'utf8');

  // Regex for the helper signature is intentionally loose on whitespace
  // / newlines (Prettier may rewrap), but strict that the param name
  // appears between `private async <name>(` and the closing `)` of the
  // signature.
  for (const helper of HELPER_NAMES) {
    it(`${helper} accepts sysReqSummary as a parameter`, () => {
      const sigPattern = new RegExp(
        `private\\s+async\\s+${helper}\\s*\\(([\\s\\S]*?)\\)\\s*:`,
        'm',
      );
      const match = source.match(sigPattern);
      expect(match, `${helper} signature not found`).not.toBeNull();
      const params = match![1];
      expect(params).toMatch(/\bsysReqSummary\b/);
    });

    it(`${helper} passes sysReqSummary as system_requirements_summary in the template render`, () => {
      // Capture the helper body. Match from the helper's opening signature
      // up to the next top-level method declaration or end of class.
      const bodyPattern = new RegExp(
        `private\\s+async\\s+${helper}[\\s\\S]*?(?=\\n\\s{2}private\\s|\\n\\s{2}\\/\\*\\*|\\n\\}\\s*$)`,
        'm',
      );
      const bodyMatch = source.match(bodyPattern);
      expect(bodyMatch, `${helper} body not found`).not.toBeNull();
      const body = bodyMatch![0];
      // Must reference sysReqSummary AND wire it to the template var.
      expect(body).toMatch(/system_requirements_summary\s*:\s*sysReqSummary/);
    });
  }

  it('every Phase 5 prompt template consumes the system_requirements_summary variable', () => {
    // If the template doesn't ask for system_requirements_summary, the
    // wiring on the TS side is dead and the SR layer never reaches the
    // model. Catches the inverse drift: someone removes the variable
    // from the template but leaves it in the helper.
    for (const rel of TEMPLATE_PATHS) {
      const tpl = fs.readFileSync(path.resolve(PROJECT_ROOT, rel), 'utf8');
      expect(tpl, `template ${rel} missing system_requirements_summary`).toMatch(
        /\{\{\s*system_requirements_summary\s*\}\}|<system_requirements_summary>|system_requirements_summary/,
      );
    }
  });
});
