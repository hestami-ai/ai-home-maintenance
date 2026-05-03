/**
 * Deterministic validator: ac_count_discipline
 *
 * FR-only (sample 10). Per story:
 *   - 0 ACs       -> HIGH (missing_acs)
 *   - 1-2 ACs     -> MEDIUM (under_count)
 *   - 3-7 ACs     -> clean
 *   - 8-10 ACs    -> LOW (high_count_warning)
 *   - >10 ACs     -> HIGH (hard_cap_exceeded)
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const SOFT_LOWER = 3;
const SOFT_UPPER = 7;
const HARD_CAP = 10;

export function validateAcCountDiscipline(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const out = params.outputContent;
  if (!out) return [];
  const stories = out.user_stories;
  if (!Array.isArray(stories)) return [];

  const findings: ValidatorFinding[] = [];
  stories.forEach((story, idx) => {
    if (!story || typeof story !== 'object') return;
    const s = story as Record<string, unknown>;
    const idLabel = typeof s.id === 'string' ? s.id : `index ${idx}`;
    const acs = s.acceptance_criteria;
    const count = Array.isArray(acs) ? acs.length : 0;
    const loc = `$.user_stories[${idx}].acceptance_criteria`;

    if (count === 0) {
      findings.push({
        validatorId: 'ac_count_discipline',
        severity: 'HIGH',
        type: 'missing_acs',
        summary: `Story ${idLabel} has no acceptance criteria`,
        location: loc,
        detail: `Enrichment pass requires 3-7 acceptance criteria per story.`,
        recommendation: `Author at least ${SOFT_LOWER} acceptance criteria for story ${idLabel}.`,
      });
    } else if (count > HARD_CAP) {
      findings.push({
        validatorId: 'ac_count_discipline',
        severity: 'HIGH',
        type: 'hard_cap_exceeded',
        summary: `Story ${idLabel} exceeds hard AC cap (${count} > ${HARD_CAP})`,
        location: loc,
        detail: `Per AC count discipline, no story may have more than ${HARD_CAP} acceptance criteria.`,
        recommendation: 'Split the story or fold redundant ACs.',
      });
    } else if (count < SOFT_LOWER) {
      findings.push({
        validatorId: 'ac_count_discipline',
        severity: 'MEDIUM',
        type: 'under_count',
        summary: `Story ${idLabel} has only ${count} AC(s)`,
        location: loc,
        detail: `Soft target is ${SOFT_LOWER}-${SOFT_UPPER} acceptance criteria.`,
        recommendation: `Add more ACs; aim for ${SOFT_LOWER}-${SOFT_UPPER}.`,
      });
    } else if (count > SOFT_UPPER) {
      findings.push({
        validatorId: 'ac_count_discipline',
        severity: 'LOW',
        type: 'high_count_warning',
        summary: `Story ${idLabel} has ${count} ACs (above soft target)`,
        location: loc,
        detail: `Soft target is ${SOFT_LOWER}-${SOFT_UPPER}; hard cap is ${HARD_CAP}.`,
        recommendation: 'Consider consolidating overlapping criteria.',
      });
    }
  });
  return findings;
}
