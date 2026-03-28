/**
 * Validate Phase — HYPOTHESIZING sub-state
 *
 * Launches three specialized hypothesizer agents in parallel and merges
 * their outputs into a deduplicated RawHypothesis[] list.
 */

import { invokeHypothesizer } from '../roles/validationHypothesizer';
import type { CLIActivityEvent } from '../cli/types';
import type { RawHypothesis } from '../types/validate';
import { getLogger, isLoggerInitialized } from '../logging';
import { isValidationParallelAgentsEnabled } from '../config/manager';

/**
 * Run all three hypothesizer agents against the assembled context.
 * Runs sequentially by default; set `janumicode.validation.parallelAgents = true`
 * in VS Code settings to run in parallel.
 */
export async function runHypothesizers(
	context: string,
	onEvent?: (event: CLIActivityEvent) => void,
): Promise<RawHypothesis[]> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'validateHypothesizer' })
		: null;

	const parallel = isValidationParallelAgentsEnabled();
	log?.info(`Launching 3 hypothesizer agents (${parallel ? 'parallel' : 'sequential'})`);

	let securityResult, logicResult, bestPracticesResult;

	if (parallel) {
		[securityResult, logicResult, bestPracticesResult] = await Promise.all([
			invokeHypothesizer('security', context, onEvent),
			invokeHypothesizer('logic', context, onEvent),
			invokeHypothesizer('best_practices', context, onEvent),
		]);
	} else {
		securityResult = await invokeHypothesizer('security', context, onEvent);
		logicResult = await invokeHypothesizer('logic', context, onEvent);
		bestPracticesResult = await invokeHypothesizer('best_practices', context, onEvent);
	}

	const allHypotheses: RawHypothesis[] = [
		...securityResult.hypotheses,
		...logicResult.hypotheses,
		...bestPracticesResult.hypotheses,
	];

	log?.info('Hypothesizers complete', {
		mode: parallel ? 'parallel' : 'sequential',
		security: securityResult.hypotheses.length,
		logic: logicResult.hypotheses.length,
		bestPractices: bestPracticesResult.hypotheses.length,
		total: allHypotheses.length,
	});

	// Lightweight deduplication: remove hypotheses with near-identical text
	return deduplicateHypotheses(allHypotheses);
}

/**
 * Remove obvious duplicates: two hypotheses are considered duplicates if
 * their normalized text shares ≥ 80% of 5-gram tokens.
 */
function deduplicateHypotheses(hypotheses: RawHypothesis[]): RawHypothesis[] {
	const seen: RawHypothesis[] = [];
	for (const h of hypotheses) {
		const isDuplicate = seen.some(s => textSimilarity(h.text, s.text) >= 0.8);
		if (!isDuplicate) {
			seen.push(h);
		}
	}
	return seen;
}

function textSimilarity(a: string, b: string): number {
	const tokensA = new Set(tokenize(a));
	const tokensB = new Set(tokenize(b));
	if (tokensA.size === 0 || tokensB.size === 0) { return 0; }
	let intersection = 0;
	for (const t of tokensA) {
		if (tokensB.has(t)) { intersection++; }
	}
	return intersection / Math.max(tokensA.size, tokensB.size);
}

function tokenize(text: string): string[] {
	return text.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.split(/\s+/)
		.filter(t => t.length > 2);
}
