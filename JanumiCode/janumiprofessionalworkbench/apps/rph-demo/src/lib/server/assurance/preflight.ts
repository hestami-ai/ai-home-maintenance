import {
	refusalMessage,
	selectReviewer,
	type ReviewerEnvironment,
	type ReviewerRefusalCode
} from './reviewer-selection.js';

/**
 * ⚠ THIS UNION USED TO HAVE ONE MEMBER AND `ready` USED TO BE THE LITERAL `true`.
 * A preflight that cannot report NOT-ready is decorative — it was a control that could not fail, on the path
 * that decides whether the mandatory Reasoning Review can run at all. It gained a second member the day the
 * judge model stopped having an application default (`REG-F-331`, sponsor direction 2026-09-02), and its refusal
 * codes now name each way the reviewer can be refused (`JAN-SELREV` SR-1).
 */
export type AssurancePreflightCode = 'READY' | ReviewerRefusalCode;

export interface AssurancePreflightResult {
	readonly ready: boolean;
	readonly code: AssurancePreflightCode;
	readonly guidance: string;
	/** The real reviewer the floor will run, when one is configured — absent for the declared stand-in. */
	readonly reviewer?: { readonly toolId: 'agy' | 'devin'; readonly modelId: string };
}

/**
 * Configuration-only preflight for work the mandatory Reasoning Review will judge: an authoring turn, and a model
 * step's execution (`beginExecute`). A real reviewer receives its explicitly configured tool and model or the work
 * does not begin — there is no application default (sponsor direction, 2026-09-02; `REG-D-052`). This deliberately
 * does not invoke the reviewer or claim that it is healthy; it only establishes that an evaluator identity EXISTS to
 * record.
 *
 * ⭐ `JAN-SELREV` SR-1 (D3, D5) — IT ASKS THE SELECTOR THE FLOOR REGISTRY ASKS, so the preflight and the registry
 * cannot disagree (`REG-F-443`). It used to choose by the retired `JPWB_ASSESSOR` and check only `JPWB_JUDGE_MODEL`,
 * so a devin-only host — the selected reviewer's own configuration (`REG-D-084`) — was refused on every turn.
 */
export function assurancePreflight(input: {
	readonly testMode: boolean;
	readonly env?: ReviewerEnvironment;
}): AssurancePreflightResult {
	const selection = selectReviewer(input);
	switch (selection.kind) {
		case 'REFUSED':
			// FAIL CLOSED, and say what to do. Previously an unconfigured judge returned READY with a note that the
			// application default would be used — a default that the installed agy rejects, so the turn proceeded to
			// an opaque non-zero exit whose diagnostic is discarded (REG-F-331 / REG-F-326).
			return { ready: false, code: selection.code, guidance: refusalMessage(selection) };
		// ⭐ `JAN-EXEC` Phase 8 (D2) — a replay is ready as the stand-in is: no real reviewer is configured to name. Whether its
		// recording can be read is found when the floor opens it, and a recording that cannot be is a refusal it records.
		case 'STAND_IN':
		case 'REPLAY':
			return { ready: true, code: 'READY', guidance: '' };
		case 'AGY':
			return {
				ready: true,
				code: 'READY',
				guidance: '',
				reviewer: { toolId: 'agy', modelId: selection.modelId }
			};
		case 'DEVIN':
			return {
				ready: true,
				code: 'READY',
				guidance: '',
				reviewer: { toolId: 'devin', modelId: selection.modelId }
			};
	}
}
