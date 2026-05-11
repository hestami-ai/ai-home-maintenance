/**
 * red_team.encoding_obfuscation_detector — deterministic (Wave 13).
 *
 * Per docs/design/wave13_red_team_harness.md §4.1.
 *
 * Flags zero-width characters, RTL/LTR overrides, large homoglyph runs,
 * and base64 blobs over a length threshold.
 */

import type { SourceAdmissionFinding, SourceAdmissionValidator } from '../types.js';

// Zero-width chars + bidi overrides + soft hyphen
const ZERO_WIDTH_RX = /[​-‏‪-‮⁠-⁤﻿­]/g;
// Long base64-like blob (≥80 chars of base64 charset)
const BASE64_RX = /[A-Za-z0-9+/]{80,}={0,2}/g;
// Homoglyph runs: Cyrillic letters interleaved with Latin
const CYRILLIC_RX = /[Ѐ-ӿ]/g;

export const encodingObfuscationDetector: SourceAdmissionValidator = {
  id: 'red_team.encoding_obfuscation_detector',
  attackFamily: 'encoding-obfuscation',
  description: 'Flags zero-width chars, bidi overrides, base64 blobs, and homoglyph runs.',
  kind: 'deterministic',
  validate: (input) => {
    const findings: Array<Omit<SourceAdmissionFinding, 'validatorId' | 'attackFamily'>> = [];

    // zero-width / bidi
    const zw = input.content.match(ZERO_WIDTH_RX);
    if (zw && zw.length > 0) {
      findings.push({
        severity: 'HIGH',
        type: 'zero_width_or_bidi_chars',
        message: `source contains ${zw.length} zero-width or bidi-override character(s) — encoding-level obfuscation`,
        evidence: { count: zw.length },
      });
    }

    // base64 blobs
    const b64 = input.content.match(BASE64_RX);
    if (b64 && b64.length > 0) {
      findings.push({
        severity: 'MEDIUM',
        type: 'embedded_base64_blob',
        message: `source contains ${b64.length} base64-like blob(s) ≥ 80 chars`,
        evidence: { count: b64.length, firstPrefix: b64[0].slice(0, 40) },
      });
    }

    // homoglyph runs — Cyrillic letters in an otherwise Latin doc
    const cyr = input.content.match(CYRILLIC_RX);
    if (cyr && cyr.length >= 3) {
      findings.push({
        severity: 'MEDIUM',
        type: 'homoglyph_run',
        message: `source contains ${cyr.length} Cyrillic character(s); possible Latin-Cyrillic homoglyph attack`,
        evidence: { count: cyr.length },
      });
    }

    return findings;
  },
};
