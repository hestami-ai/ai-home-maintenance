// JPWB-SPEC-001-DR-002 W-4 — the risk profile a professional declares, parsed once and refused when absent.
//
// Every surface that creates a PWU used to write the same five literals — MEDIUM, MEDIUM, MEDIUM, MEDIUM, LOW —
// into canonical state, where they are indistinguishable from a judgement. That is roadmap finding F-D, and it is
// not cosmetic: `riskProfile` selects the assurance profile (`rph-assurance/src/applicability.ts` resolves
// `$.riskProfile`), and HIGH_ASSURANCE gates on `RISK_AT_LEAST(CONSEQUENCE,HIGH) OR
// RISK_AT_LEAST(SECURITY_SENSITIVITY,HIGH) OR RISK_AT_LEAST(IRREVERSIBILITY,HIGH) OR
// RISK_AT_LEAST(REGULATORY_EXPOSURE,HIGH)`. Five MEDIUMs and a LOW fail every disjunct, so the surface silently
// placed every PWU a professional created below the high-assurance floor, whatever the work was.
//
// ── WHY THERE IS NO DEFAULT ─────────────────────────────────────────────────────────────────────────────────
//
// The fix for a fabricated value is not a better-chosen one. A default is the same defect with a different
// literal: it is still the surface answering a question that was put to the professional, and it is still
// indistinguishable downstream from an answer. So an absent or unrecognised declaration yields an ERROR, and the
// caller refuses — the fail-closed posture §16 takes elsewhere.
//
// THE DIMENSIONS DO NOT SHARE A SCALE, and assuming they did is the mistake this module exists to prevent.
// `consequence`, `uncertainty` and `irreversibility` are LOW|MEDIUM|HIGH|CRITICAL; `securitySensitivity` and
// `regulatoryExposure` are NONE|LOW|MEDIUM|HIGH — **no CRITICAL**. A form offering CRITICAL for security
// sensitivity produces a value the engine rejects with "Schema validation failed", which reads like a wiring
// fault and is not one. The legal sets are declared here, next to the parser that enforces them.
import type { WorkRiskProfile } from '@janumipwb/rph-contracts';

/** The five dimensions, each with the ONLY levels its contract admits. Order is the order a form presents them. */
export const RISK_DIMENSIONS = [
	{ field: 'consequence', label: 'Consequence', levels: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
	{ field: 'uncertainty', label: 'Uncertainty', levels: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
	{
		field: 'irreversibility',
		label: 'Irreversibility',
		levels: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
	},
	{
		field: 'securitySensitivity',
		label: 'Security sensitivity',
		levels: ['NONE', 'LOW', 'MEDIUM', 'HIGH']
	},
	{
		field: 'regulatoryExposure',
		label: 'Regulatory exposure',
		levels: ['NONE', 'LOW', 'MEDIUM', 'HIGH']
	}
] as const satisfies readonly {
	field: keyof WorkRiskProfile;
	label: string;
	levels: readonly string[];
}[];

/** The form field name for a dimension. One place, so the markup and the parser cannot drift apart. */
export function riskFieldName(field: keyof WorkRiskProfile): string {
	return `risk.${field}`;
}

export type RiskProfileResult =
	| { readonly ok: true; readonly profile: WorkRiskProfile }
	| { readonly ok: false; readonly error: string };

/**
 * Read a declared risk profile from submitted form data.
 *
 * Refuses on the first dimension that is missing or carries a level its contract does not admit, and NAMES it —
 * "a risk judgement is required" with no indication of which of five selects is at fault is a message that sends
 * the reader guessing, which is how the malformed-id diagnosis was lost in W-2.
 */
export function parseRiskProfile(read: (name: string) => string | null): RiskProfileResult {
	const profile: Record<string, string> = {};
	for (const { field, label, levels } of RISK_DIMENSIONS) {
		const raw = (read(riskFieldName(field)) ?? '').trim();
		if (raw === '')
			return {
				ok: false,
				error: `A risk judgement is required: ${label} was not declared. The assurance profile is selected from these five, so the surface cannot choose one on your behalf.`
			};
		if (!(levels as readonly string[]).includes(raw))
			return {
				ok: false,
				error: `${label} must be one of ${levels.join(', ')} — received "${raw}".`
			};
		profile[field] = raw;
	}
	return { ok: true, profile: profile as unknown as WorkRiskProfile };
}
