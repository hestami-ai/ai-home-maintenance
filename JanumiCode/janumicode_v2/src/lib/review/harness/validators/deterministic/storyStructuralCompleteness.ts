/**
 * Deterministic validator: story_structural_completeness
 *
 * Per validator_catalog.md §5.1 + sample 09 §4.2 (FR-only): every entry in
 * userStories[] must have non-empty id, role, action, outcome, priority.
 *
 * Severity: missing required field on a story -> HIGH (spine break);
 * empty-string or whitespace-only -> HIGH; priority outside known set -> MEDIUM.
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const REQUIRED_FIELDS = ['id', 'role', 'action', 'outcome', 'priority'] as const;
const PRIORITY_VALUES: ReadonlySet<string> = new Set([
  'must',
  'should',
  'could',
  'wont',
  'high',
  'medium',
  'low',
]);

export function validateStoryStructuralCompleteness(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const out = params.outputContent;
  if (!out) return [];
  const stories = out.user_stories;
  if (!Array.isArray(stories)) return [];

  const findings: ValidatorFinding[] = [];
  stories.forEach((story, idx) => {
    if (!story || typeof story !== 'object') {
      findings.push({
        validatorId: 'story_structural_completeness',
        severity: 'HIGH',
        type: 'malformed_story',
        summary: `user_stories[${idx}] is not an object`,
        location: `$.user_stories[${idx}]`,
        detail: 'Each user story must be an object with id/role/action/outcome/priority.',
        recommendation: 'Replace with a structured story object.',
      });
      return;
    }
    const s = story as Record<string, unknown>;
    const idLabel = typeof s.id === 'string' ? s.id : `index ${idx}`;

    for (const field of REQUIRED_FIELDS) {
      const value = s[field];
      if (value === undefined || value === null) {
        findings.push({
          validatorId: 'story_structural_completeness',
          severity: 'HIGH',
          type: 'missing_field',
          summary: `Story ${idLabel} missing field '${field}'`,
          location: `$.user_stories[${idx}].${field}`,
          detail: `Story '${idLabel}' has no '${field}' field.`,
          recommendation: `Populate '${field}' for story ${idLabel}.`,
        });
        continue;
      }
      if (typeof value === 'string' && value.trim() === '') {
        findings.push({
          validatorId: 'story_structural_completeness',
          severity: 'HIGH',
          type: 'empty_field',
          summary: `Story ${idLabel} has empty '${field}'`,
          location: `$.user_stories[${idx}].${field}`,
          detail: `Story '${idLabel}' has whitespace-only '${field}' value.`,
          recommendation: `Provide a substantive '${field}' value.`,
        });
      }
    }

    if (typeof s.priority === 'string' && !PRIORITY_VALUES.has(s.priority.toLowerCase())) {
      findings.push({
        validatorId: 'story_structural_completeness',
        severity: 'MEDIUM',
        type: 'unknown_priority',
        summary: `Story ${idLabel} has unrecognised priority '${s.priority}'`,
        location: `$.user_stories[${idx}].priority`,
        detail: `Priority '${s.priority}' not in standard MoSCoW or high/medium/low set.`,
        recommendation: 'Use one of must/should/could/wont or high/medium/low.',
      });
    }
  });
  return findings;
}
