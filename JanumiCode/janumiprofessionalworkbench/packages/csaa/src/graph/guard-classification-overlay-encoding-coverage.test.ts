import { expect, it } from 'vitest';

import { buildGuardClassificationOverlay } from './build-guard-classification-overlay.js';
import { createInitializerFactoryGuardClassificationOverlayPredecessorFixture } from './guard-classification-overlay-fixture.test-support.js';
import { validateGuardClassificationOverlay } from './validate-guard-classification-overlay.js';

it('keeps a const-initializer factory callable behind the explicit helper frontier', () => {
	const fixture = createInitializerFactoryGuardClassificationOverlayPredecessorFixture();
	try {
		const outcome = buildGuardClassificationOverlay(fixture.inputs);
		expect(outcome).toMatchObject({ diagnostics: [], outcome: 'partial' });
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(validateGuardClassificationOverlay(outcome.overlay, fixture.inputs)).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(outcome.overlay.anchorSites).toHaveLength(1);
		expect(outcome.overlay.handlerLinks).toHaveLength(0);
		expect(outcome.overlay.frontiers).toEqual([
			expect.objectContaining({
				anchorSiteId: outcome.overlay.anchorSites[0]!.id,
				frontierKind: 'HELPER_CALL_FLOW_UNRESOLVED'
			})
		]);
		expect(outcome.overlay.coverage).toMatchObject({
			candidateFactoryHandlerLinks: 0,
			directHandlerLinks: 0,
			helperFrontiers: 1,
			reconciles: true
		});
		expect(
			fixture.commandHandlerGraph.nodes.filter((node) => node.kind === 'HANDLER_TARGET')
		).toEqual([expect.objectContaining({ bodyKind: 'FACTORY_CALL_RESULT_CANDIDATE' })]);
	} finally {
		fixture.cleanup();
	}
});
