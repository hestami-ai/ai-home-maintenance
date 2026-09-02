import { resolveJudgeModel } from './agy-cli.js';

/**
 * ⚠ THIS UNION USED TO HAVE ONE MEMBER AND `ready` USED TO BE THE LITERAL `true`.
 * A preflight that cannot report NOT-ready is decorative — it was a control that could not fail, on the path
 * that decides whether the mandatory Reasoning Review can run at all. It gained a second member the day the
 * judge model stopped having an application default (`REG-F-331`, sponsor direction 2026-09-02).
 */
export type AssurancePreflightCode = 'READY' | 'JUDGE_MODEL_UNCONFIGURED';

export interface AssurancePreflightResult {
	readonly ready: boolean;
	readonly code: AssurancePreflightCode;
	readonly guidance: string;
	readonly judgeModel?: string;
}

/** Configuration-only preflight for an authoring turn. A real agy reviewer receives the explicitly configured
 * model or the turn does not begin — there is no application default (sponsor direction, 2026-09-02). This
 * deliberately does not invoke agy or claim that the external reviewer is healthy; it only establishes that an
 * evaluator identity EXISTS to record. */
export function assurancePreflight(input: {
	testMode: boolean;
	assessor: string | undefined;
	judgeModel: string | undefined;
}): AssurancePreflightResult {
	// Keep this selection rule aligned with createFloorRegistry: production always uses the real reviewer; test mode
	// uses it only when explicitly forced with JPWB_ASSESSOR=agy. A live Pi-agent E2E may intentionally retain the
	// deterministic mock reviewer, so authoring-agent mode alone is not a reliable proxy for reviewer capability.
	const requiresAgyReviewer = !input.testMode || input.assessor === 'agy';
	if (!requiresAgyReviewer) {
		return { ready: true, code: 'READY', guidance: '' };
	}
	const judgeModel = resolveJudgeModel(input.judgeModel);
	if (!judgeModel) {
		// FAIL CLOSED, and say what to do. Previously this path returned READY with a note that the application
		// default would be used — a default that the installed agy rejects, so the turn proceeded to an opaque
		// non-zero exit whose diagnostic is discarded (REG-F-331 / REG-F-326).
		return {
			ready: false,
			code: 'JUDGE_MODEL_UNCONFIGURED',
			guidance:
				'JPWB_JUDGE_MODEL is not set and there is no application default: the judge model is selected on ' +
				'performance parameters and must be configured explicitly. Set it to a label the installed agy ' +
				'recognises, or run in test mode with the deterministic reviewer.'
		};
	}
	return { ready: true, code: 'READY', guidance: '', judgeModel };
}
