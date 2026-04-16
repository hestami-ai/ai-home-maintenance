/**
 * IdentifierNormalizer - Canonical ID format normalization.
 * 
 * Ensures consistent identifier formats across:
 * - Runtime phase/sub-phase IDs (canonical "X.Y" dotted format)
 * - Decision override keys in HarnessConfig
 * - Semantic fixture keys (zero-padded format)
 * 
 * Prevents dictionary lookup failures due to format variations
 * like "1.3", "1_3", "01_3", etc.
 */

import type { PhaseId } from '../lib/types/records';

// Format patterns
const DOTTED_PATTERN = /^(\d+(?:\.\d+)?)\.(\d+)$/;      // "1.3", "0.5.1"
const UNDERSCORE_PATTERN = /^(\d+)[_.](\d+)$/;           // "1_3", "1-3"
const PADDED_PATTERN = /^0*(\d+)[_.]0*(\d+)$/;          // "01_03", "01_3"

/**
 * Normalizes various sub-phase ID formats to canonical dotted format.
 * 
 * @example
 * normalizeSubPhaseId("1_3")    // => "1.3"
 * normalizeSubPhaseId("01_3")   // => "1.3"
 * normalizeSubPhaseId("1.3")    // => "1.3"
 * normalizeSubPhaseId("0.5.1")  // => "0.5.1" (multi-level preserved)
 */
export function normalizeSubPhaseId(input: string): string {
  // Handle multi-level IDs like "0.5.1"
  if (input.includes('.') && input.split('.').length > 2) {
    // Preserve multi-level format, just strip leading zeros
    return input.split('.').map(p => String(Number.parseInt(p, 10))).join('.');
  }

  // Try underscore pattern
  let match = UNDERSCORE_PATTERN.exec(input);
  if (match) {
    const [, phase, sub] = match;
    return `${Number.parseInt(phase, 10)}.${Number.parseInt(sub, 10)}`;
  }

  // Try padded pattern
  match = PADDED_PATTERN.exec(input);
  if (match) {
    const [, phase, sub] = match;
    return `${Number.parseInt(phase, 10)}.${Number.parseInt(sub, 10)}`;
  }

  // Already dotted format - just normalize leading zeros
  match = DOTTED_PATTERN.exec(input);
  if (match) {
    const [, phase, sub] = match;
    return `${Number.parseInt(phase, 10)}.${Number.parseInt(sub, 10)}`;
  }

  // Return as-is if no pattern matches (e.g., "1.1b" for special sub-phases)
  return input;
}

/**
 * Converts canonical sub-phase ID to zero-padded fixture key format.
 * 
 * @param agentRole - Agent role (e.g., "requirements_agent")
 * @param subPhaseId - Canonical sub-phase ID (e.g., "1.3")
 * @param sequence - Call sequence number (1-indexed)
 * @returns Fixture key (e.g., "requirements_agent__01_3__01")
 * 
 * @example
 * toFixtureKey("requirements_agent", "1.3", 1)  // => "requirements_agent__01_3__01"
 * toFixtureKey("orchestrator", "0.5.1", 2)      // => "orchestrator__00_5_1__02"
 */
export function toFixtureKey(
  agentRole: string,
  subPhaseId: string,
  sequence: number,
): string {
  // Convert "1.3" to "01_3", "0.5.1" to "00_5_1"
  const paddedPhase = subPhaseId
    .split('.')
    .map(p => p.padStart(2, '0'))
    .join('_');

  const paddedSequence = String(sequence).padStart(2, '0');

  return `${agentRole}__${paddedPhase}__${paddedSequence}`;
}

/**
 * Parses a fixture key back into its components.
 * 
 * @param fixtureKey - Fixture key (e.g., "requirements_agent__01_3__01")
 * @returns Parsed components or null if invalid format
 * 
 * @example
 * parseFixtureKey("requirements_agent__01_3__01")
 * // => { agentRole: "requirements_agent", subPhaseId: "1.3", sequence: 1 }
 */
export function parseFixtureKey(fixtureKey: string): {
  agentRole: string;
  subPhaseId: string;
  sequence: number;
} | null {
  const parts = fixtureKey.split('__');
  if (parts.length !== 3) return null;

  const [agentRole, paddedPhase, paddedSequence] = parts;

  // Convert "01_3" back to "1.3"
  const subPhaseId = paddedPhase
    .split('_')
    .map(p => String(Number.parseInt(p, 10)))
    .join('.');

  const sequence = Number.parseInt(paddedSequence, 10);
  if (Number.isNaN(sequence)) return null;

  return { agentRole, subPhaseId, sequence };
}

/**
 * Validates that a sub-phase ID exists in the canonical SUB_PHASE_NAMES.
 * 
 * @param phaseId - Phase ID (e.g., "1")
 * @param subPhaseId - Sub-phase ID in any format
 * @param subPhaseNames - Canonical SUB_PHASE_NAMES from records.ts
 * @returns True if the sub-phase exists in the canonical list
 */
export function isValidSubPhaseId(
  phaseId: PhaseId,
  subPhaseId: string,
  subPhaseNames: Record<PhaseId, Record<string, string>>,
): boolean {
  const canonical = normalizeSubPhaseId(subPhaseId);
  const phaseSubPhases = subPhaseNames[phaseId];
  if (!phaseSubPhases) return false;
  return canonical in phaseSubPhases;
}

/**
 * Gets all canonical sub-phase IDs for a phase.
 * 
 * @param phaseId - Phase ID
 * @param subPhaseNames - Canonical SUB_PHASE_NAMES from records.ts
 * @returns Array of canonical sub-phase IDs
 */
export function getCanonicalSubPhaseIds(
  phaseId: PhaseId,
  subPhaseNames: Record<PhaseId, Record<string, string>>,
): string[] {
  const phaseSubPhases = subPhaseNames[phaseId];
  if (!phaseSubPhases) return [];
  return Object.keys(phaseSubPhases);
}

/**
 * Normalizes a decision override key (used in HarnessConfig).
 * Accepts both "1.3" and "1_3" formats, returns canonical "1.3".
 * 
 * @param key - Decision override key
 * @returns Canonical sub-phase ID
 */
export function normalizeDecisionOverrideKey(key: string): string {
  return normalizeSubPhaseId(key);
}

/**
 * Creates a lookup map with normalized keys.
 * Useful for converting HarnessConfig.decisionOverrides to a canonical lookup.
 * 
 * @param overrides - Decision overrides with potentially non-canonical keys
 * @returns Map with canonical sub-phase IDs as keys
 */
export function normalizeDecisionOverrides<T>(
  overrides: Record<string, T>,
): Map<string, T> {
  const result = new Map<string, T>();
  for (const [key, value] of Object.entries(overrides)) {
    const canonical = normalizeSubPhaseId(key);
    result.set(canonical, value);
  }
  return result;
}
