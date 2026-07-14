// Deterministic, offline assessor — derives a faithfulness verdict purely from the Layer-A structural report
// (analyzePwaGraph over the export). It calls NO model, so it is reproducible and free: the TEST_MODE default
// and the safe fallback when no judge backend is configured. It is honest about its limits — it can only judge
// STRUCTURE (connectivity, data-flow sanity, decomposition shape), not semantic faithfulness to the prompt.
// That semantic judgement is exactly what the agy (Gemini) adapter and the Claude oracle exist to provide.
import { analyzePwaGraph } from '@janumipwb/rph-projections';
import type {
	AssessmentInput,
	AssessmentResult,
	CriterionScore,
	FaithfulnessAssessor
} from './types.js';

const mean = (xs: number[]): number =>
	xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
const round2 = (x: number): number => Math.round(x * 100) / 100;
const dedup = (xs: string[]): string[] => [...new Set(xs)];

export function createMockAssessor(): FaithfulnessAssessor {
	return {
		kind: 'mock',
		assess(input: AssessmentInput): Promise<AssessmentResult> {
			const report = analyzePwaGraph(input.graphExport);
			const m = report.metrics;

			const gaps: string[] = [];
			for (const inv of report.invariants) if (!inv.ok) gaps.push(`${inv.name}: ${inv.detail}`);
			if (m.orphanCount > 0)
				gaps.push(`${m.orphanCount} node(s) are orphaned (unreachable from the root).`);
			if (m.danglingInputs > 0)
				gaps.push(
					`${m.danglingInputs} required input(s) have no producing node (dangling data-flow).`
				);
			if (m.unusedOutputs > 0)
				gaps.push(`${m.unusedOutputs} produced output(s) feed no consumer (dead-end artifacts).`);
			gaps.push(...report.findings);

			const connectivity = m.orphanCount === 0 && report.valid ? 1 : 0.4;
			const dataFlow = m.danglingInputs === 0 && m.unusedOutputs === 0 ? 1 : 0.5;
			const decomposition = m.rootCount === 1 && m.cycleCount === 0 && m.nodeCount > 2 ? 0.9 : 0.4;
			const criteria: CriterionScore[] = [
				{
					name: 'structure',
					score: report.valid ? 0.9 : 0.2,
					rationale: report.valid ? 'single-root, acyclic, connected' : 'hard invariant(s) violated'
				},
				{ name: 'connectivity', score: connectivity },
				{ name: 'data-flow', score: dataFlow },
				{ name: 'decomposition', score: decomposition }
			];

			const overallScore = round2(mean(criteria.map((c) => c.score)));
			const verdict: AssessmentResult['verdict'] = !report.valid
				? 'POOR'
				: gaps.length === 0
					? 'FAITHFUL'
					: 'PARTIAL';
			const recommendation =
				verdict === 'FAITHFUL'
					? 'Structurally well-formed with no dangling data-flow; no structural refinement required. (Structural check only — semantic faithfulness not judged.)'
					: `Structurally ${verdict.toLowerCase()}: ${gaps.length} structural gap(s) to address. (Structural check only — semantic faithfulness not judged.)`;

			return Promise.resolve({
				verdict,
				overallScore,
				criteria,
				gaps: dedup(gaps),
				recommendation,
				assessorModel: 'mock:layer-a'
			});
		}
	};
}
