export type AssurancePreflightCode = 'READY' | 'REASONING_REVIEW_MODEL_UNCONFIGURED';

export interface AssurancePreflightResult {
	readonly ready: boolean;
	readonly code: AssurancePreflightCode;
	readonly guidance: string;
}

/** Pure host-capability preflight for an authoring turn. The live authoring agent must not begin mutating a PWA when
 * its mandatory independent Reasoning Review is already known to be unexecutable. This checks configuration only;
 * it deliberately does not invoke agy or otherwise claim that the external reviewer is healthy. */
export function assurancePreflight(input: {
	testMode: boolean;
	assessor: string | undefined;
	judgeModel: string | undefined;
}): AssurancePreflightResult {
	// Keep this selection rule aligned with createFloorRegistry: production always uses the real reviewer; test mode
	// uses it only when explicitly forced with JPWB_ASSESSOR=agy. A live Pi-agent E2E may intentionally retain the
	// deterministic mock reviewer, so authoring-agent mode alone is not a reliable proxy for reviewer capability.
	const requiresAgyReviewer = !input.testMode || input.assessor === 'agy';
	if (!requiresAgyReviewer || input.judgeModel?.trim()) {
		return { ready: true, code: 'READY', guidance: '' };
	}
	return {
		ready: false,
		code: 'REASONING_REVIEW_MODEL_UNCONFIGURED',
		guidance:
			'The authoring turn was not started and no PWA changes were made because the mandatory independent Reasoning Review is not configured. Set JPWB_JUDGE_MODEL to the permitted agy reviewer model id, restart or refresh the host configuration, and retry the authoring request.'
	};
}
