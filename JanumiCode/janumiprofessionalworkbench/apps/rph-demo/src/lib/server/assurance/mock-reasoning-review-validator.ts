// Deterministic, offline Reasoning-Review Validator for TEST_MODE. It derives its judgement from the Layer-A
// structural report over the subject's graph export, so the floor RUNS reproducibly in the gate (a well-formed graph
// passes; an invalid one is REJECTED; dead-end outputs are a MATERIAL proxy-satisfaction finding). It is honest about
// its limits — it judges STRUCTURE, not deep semantics (that is what the agy Validator provides in dev/prod).
import { analyzePwaGraph, type PwaGraphExport } from '@janumipwb/rph-projections';
import {
	FLOOR_POLICY_IDS,
	reasoningReviewResultFromJudgement,
	type Identity,
	type ReasoningReviewFinding,
	type ReasoningReviewJudgement,
	type Validator
} from '@janumipwb/rph-assurance';

const EVALUATOR: Identity = {
	actorType: 'AGENT',
	agentId: 'mock-judge',
	modelId: 'mock-reasoning-review',
	providerId: 'jpwb'
};

function judge(content: string): ReasoningReviewJudgement {
	let ex: PwaGraphExport | undefined;
	try {
		ex = JSON.parse(content) as PwaGraphExport;
	} catch {
		return { findings: [], recommendation: 'SATISFIED' };
	}
	if (!ex?.nodes) return { findings: [], recommendation: 'SATISFIED' };
	const report = analyzePwaGraph(ex);
	const findings: ReasoningReviewFinding[] = [];
	if (!report.valid)
		findings.push({
			criterionId: 'RR-09-no-completeness-from-existence',
			failed: true,
			statement: 'The graph is not well-formed; completeness cannot be claimed from its existence.',
			severity: 'BLOCKING'
		});
	if (report.metrics.unusedOutputs > 0)
		findings.push({
			criterionId: 'RR-04-no-proxy-satisfaction',
			failed: true,
			statement: `${report.metrics.unusedOutputs} produced output(s) feed no consumer (dead-end).`,
			severity: 'MATERIAL'
		});
	let recommendation: ReasoningReviewJudgement['recommendation'] = 'SATISFIED';
	if (!report.valid) recommendation = 'REJECTED';
	else if (findings.length > 0) recommendation = 'CONDITIONALLY_SATISFIED';
	return { findings, recommendation };
}

export function createMockReasoningReviewValidator(): Validator {
	return {
		policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
		validatorId: 'mock.reasoning-review',
		evaluate: (subject, ctx) =>
			Promise.resolve(
				reasoningReviewResultFromJudgement(
					subject,
					EVALUATOR,
					'mock.reasoning-review',
					judge(ctx.reasoningReview?.content ?? '')
				)
			)
	};
}
