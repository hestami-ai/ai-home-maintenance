/**
 * red_team.privilege_marker_attack_detector — deterministic (Wave 13).
 *
 * Per docs/design/wave13_red_team_harness.md §4.1.
 *
 * Flags strings inside source content that look like privilege markers
 * the platform might mis-interpret if a downstream component is sloppy
 * about classification provenance.
 *
 * The platform's own privilege classification flows from the writer's
 * declaredClassification, NOT from text in source bodies — so these
 * markers should not actually cause mis-classification, but their
 * presence is a strong signal of an attack attempt.
 */

import type { SourceAdmissionFinding, SourceAdmissionValidator } from '../types.js';

const MARKER_PATTERNS: ReadonlyArray<{ rx: RegExp; type: string }> = [
  { rx: /\[ATTORNEY[_\s]CLIENT\]|\[ATTORNEY-CLIENT\]/i, type: 'attorney_client_marker' },
  { rx: /\[WORK[_\s]PRODUCT\]|<work_product>/i, type: 'work_product_marker' },
  { rx: /\[(APPROVED|VERIFIED|CONFIRMED)[_\s]?(BY[_\s]ATTORNEY|FOR[_\s]FILING)\]/i, type: 'approval_marker' },
  { rx: /classification\s*[:=]\s*['"]?(attorney_client|work_product_mental|approved_for[_\w]+)/i, type: 'classification_assertion' },
  { rx: /<system[^>]*>|<\/?prompt>|<\/?instructions?>/i, type: 'pseudo_system_tag' },
];

export const privilegeMarkerAttackDetector: SourceAdmissionValidator = {
  id: 'red_team.privilege_marker_attack_detector',
  attackFamily: 'privilege-confusion',
  description: 'Flags privilege-marker patterns that look like classification spoofing attempts.',
  kind: 'deterministic',
  validate: (input) => {
    const findings: Array<Omit<SourceAdmissionFinding, 'validatorId' | 'attackFamily'>> = [];
    for (const p of MARKER_PATTERNS) {
      const m = p.rx.exec(input.content);
      if (m) {
        findings.push({
          severity: 'HIGH',
          type: p.type,
          message: `source contains classification-spoofing pattern '${m[0]}'`,
          evidence: { span: m[0], offset: m.index },
        });
      }
    }
    return findings;
  },
};
