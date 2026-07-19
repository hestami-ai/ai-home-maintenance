import { resolveJudgeModel } from './agy-cli.js';

export type AssurancePreflightCode = 'READY';

export interface AssurancePreflightResult {
	readonly ready: true;
	readonly code: AssurancePreflightCode;
	readonly guidance: string;
	readonly judgeModel?: string;
	readonly usingDefaultJudgeModel: boolean;
}

/** Configuration-only preflight for an authoring turn. A real agy reviewer always receives either the explicit
 * environment override or the application-owned default. This deliberately does not invoke agy or claim that the
 * external reviewer is healthy. */
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
		return {
			ready: true,
			code: 'READY',
			guidance: '',
			usingDefaultJudgeModel: false
		};
	}
	const configuredModel = input.judgeModel?.trim();
	const judgeModel = resolveJudgeModel(configuredModel);
	const usingDefaultJudgeModel = !configuredModel;
	return {
		ready: true,
		code: 'READY',
		guidance: usingDefaultJudgeModel
			? `JPWB_JUDGE_MODEL is not set; the independent Reasoning Review will use the application default ${judgeModel}.`
			: '',
		judgeModel,
		usingDefaultJudgeModel
	};
}
