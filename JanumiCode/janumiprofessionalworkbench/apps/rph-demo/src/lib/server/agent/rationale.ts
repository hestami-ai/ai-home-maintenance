// The §9.7 professional rationale summary — the half of the AI execution contract that was never built.
//
// §9.7 requires the producer to RETURN "proposed entities/Commands, professional rationale summary, Evidence used,
// Assumptions, Claims, limitations, unresolved Questions, residual uncertainty, validation results, and provenance".
// The proposals arrived (as broker tool calls); the account never did. Nothing asked the agent for one and no schema
// received one — so the route scraped the agent's narration AND its thinking deltas to fill the reviewer's `plan`.
// The chain-of-thought leak was not a sloppy filter. Something had to stand in for a missing deliverable.
//
// The fix is to ask for the real thing. §3 fixes what it is: "a contracted deliverable addressed to the governed
// system, not a byproduct of a provider's runtime. It is not private chain-of-thought." So it arrives the way every
// other contracted thing arrives here — as a structured tool call the producer chooses to make, captured verbatim,
// and attributable to the producer rather than harvested from its runtime.
//
// Absence is NOT inferred away. A producer that never declares has not discharged its contract; the Validator
// records that as a limitation on its result (§8.11: existence is not proof, and neither is silence).
import type { ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';

/** Collects the declaration a run makes, so the agent can RETURN it per §9.7 and the route can bind it to the floor. */
export interface RationaleSink {
	declare(summary: ProfessionalRationaleSummary): void;
	/** The summary this run returned, or undefined if the producer never declared one. */
	get(): ProfessionalRationaleSummary | undefined;
}

export function createRationaleSink(): RationaleSink {
	let summary: ProfessionalRationaleSummary | undefined;
	return {
		declare: (s) => {
			summary = s;
		},
		get: () => summary
	};
}

/** Render the contracted account for the independent reviewer. Constant shape: the section is always present, and
 *  an undeclared account says so plainly rather than vanishing — §9.7 forbids treating presence as a signal, and a
 *  reviewer that cannot see the difference between "declared nothing" and "was never asked" cannot judge either. */
export function renderRationale(summary: ProfessionalRationaleSummary | undefined): string {
	if (!summary) {
		return '(NOT DECLARED — the producer returned no professional rationale summary. Section 9.7 requires one; judge the artifact on its own terms and treat the omission itself as a completeness shortcut.)';
	}
	const list = (label: string, xs: readonly string[]) => {
		if (!xs.length) return `${label}: (none declared)`;
		const items = xs.map((x) => `  - ${x}`).join('\n');
		return `${label}:\n${items}`;
	};
	return [
		summary.rationale,
		'',
		list('Assumptions relied on', summary.assumptions),
		list('Limitations the producer declares', summary.limitations),
		list('Residual uncertainty', summary.residualUncertainty)
	].join('\n');
}
