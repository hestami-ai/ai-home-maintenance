// Assessor selection — mirrors workbench.agentMode(): JPWB_ASSESSOR forces a backend; otherwise TEST_MODE gets the
// deterministic mock and everything else gets the agy (Gemini) judge. Keeps the whole assess/ module behind one seam.
import { createAgyAssessor } from './agy-assessor.js';
import { createMockAssessor } from './mock-assessor.js';
import type { FaithfulnessAssessor } from './types.js';

export function selectAssessor(opts: { testMode: boolean }): FaithfulnessAssessor {
	const forced = process.env.JPWB_ASSESSOR;
	if (forced === 'mock') return createMockAssessor();
	if (forced === 'agy') return createAgyAssessor();
	return opts.testMode ? createMockAssessor() : createAgyAssessor();
}

export { createAgyAssessor } from './agy-assessor.js';
export { createMockAssessor } from './mock-assessor.js';
export type {
	AssessmentInput,
	AssessmentResult,
	CriterionScore,
	FaithfulnessAssessor,
	FaithfulnessVerdict
} from './types.js';
