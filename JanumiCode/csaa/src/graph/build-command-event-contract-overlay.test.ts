import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
	COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
	COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_EMISSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_PERFORMABILITY,
	type CommandEventContractOverlayBuildInputs,
	type CommandEventContractOverlayDiagnosticCode,
	type CommandEventContractOverlaySnapshot
} from '../contracts/command-event-contract-overlay.js';
import { buildCommandEventContractOverlay } from './build-command-event-contract-overlay.js';
import { commandEventContractOverlayContentDigest } from './command-event-contract-overlay-canonical.js';
import {
	createCommandEventContractOverlayFixture,
	type CommandEventContractOverlayFixture
} from './command-event-contract-overlay-fixture.test-support.js';
import { validateCommandEventContractOverlay } from './validate-command-event-contract-overlay.js';

let fixture: CommandEventContractOverlayFixture;

beforeAll(() => {
	fixture = createCommandEventContractOverlayFixture();
}, 120_000);

afterAll(() => {
	fixture.cleanup();
});

function build(inputs: CommandEventContractOverlayBuildInputs = fixture.inputs) {
	return buildCommandEventContractOverlay(inputs);
}

function overlay(): CommandEventContractOverlaySnapshot {
	const outcome = build();
	if (outcome.outcome !== 'partial')
		throw new Error(`Fixture overlay construction failed: ${JSON.stringify(outcome)}`);
	return outcome.overlay;
}

function expectUnavailable(
	inputs: CommandEventContractOverlayBuildInputs | unknown,
	code?: CommandEventContractOverlayDiagnosticCode
): void {
	const outcome = buildCommandEventContractOverlay(
		inputs as CommandEventContractOverlayBuildInputs
	);
	expect(outcome.outcome).toBe('unavailable');
	if (code !== undefined && outcome.outcome === 'unavailable')
		expect(outcome.diagnostics[0]?.code).toBe(code);
}

function redigested(
	base: CommandEventContractOverlaySnapshot,
	mutate: (draft: CommandEventContractOverlaySnapshot) => void
): CommandEventContractOverlaySnapshot {
	const draft = structuredClone(base) as CommandEventContractOverlaySnapshot;
	mutate(draft);
	(draft as { contentDigest: string }).contentDigest =
		commandEventContractOverlayContentDigest(draft);
	return draft;
}

describe('buildCommandEventContractOverlay', { timeout: 30_000 }, () => {
	it('builds and independently validates the exact partial declaration overlay', () => {
		const outcome = build();
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		const result = outcome.overlay;
		expect(result.contentDigest).toBe(commandEventContractOverlayContentDigest(result));
		expect(validateCommandEventContractOverlay(result, fixture.inputs)).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(result.coverage).toEqual(fixture.expectedCoverage);
		expect(result.commands).toHaveLength(1);
		expect(result.eventContracts).toHaveLength(4);
		expect(result.declaredLinks.map((link) => link.role)).toEqual(['PRIMARY', 'ADDITIONAL']);
		expect(result.boundContributions).toHaveLength(3);
		expect(result.pinnedEmissions).toHaveLength(3);
		expect(result.frontiers.map((frontier) => frontier.frontierKind).sort()).toEqual([
			'DECLARED_NEITHER_BOUND_NOR_PINNED_EMITTED',
			'PINNED_EMITTED_NOT_RETAINED_BOUND'
		]);
		expect(result.layers[0]).toMatchObject({
			capability: 'JAN-CSAA-CAP-027',
			kind: 'JPWB_COMMAND_EVENT_CONTRACT_DERIVATION'
		});
		expect(result.layers[1]).toMatchObject({
			boundContributionIds: [],
			capability: 'JAN-CSAA-CAP-028',
			commandIds: [],
			declaredLinkIds: [],
			eventIds: [],
			frontierIds: [],
			kind: 'JPWB_COMMAND_EVENT_CONTRACT_INFERENCE',
			pinnedEmissionIds: []
		});
		expect(result.retainedCensus).toMatchObject({
			authorityTransfer: 'NONE',
			execution: 'NOT_EXECUTED_BY_CSAA',
			gateEffect: 'NONE',
			integration: 'NOT_INTEGRATED',
			oracleChange: 'NONE',
			replacementEquivalence: 'NOT_CLAIMED',
			verifierAuthority: 'RETAINED_DELEGATED'
		});
		expect(result.runtimeEmission).toBe(COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_EMISSION);
		expect(result.runtimePerformability).toBe(
			COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_PERFORMABILITY
		);
		expect(result.fullJanCsaa007Conformance).toBe(
			COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE
		);
		expect(result.fullJanCsaa008Conformance).toBe(
			COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE
		);
	});

	it('is deterministic, deeply frozen, and keeps deferred hostile telemetry inert', async () => {
		const expected = build();
		expect(build()).toEqual(expected);
		const events: unknown[] = [];
		const observed = buildCommandEventContractOverlay(fixture.inputs, {
			onProgress: (event) => events.push(event)
		});
		expect(observed).toEqual(expected);
		expect(events).toHaveLength(0);
		expect(Object.isFrozen(observed)).toBe(true);
		if (observed.outcome === 'partial')
			expect(Object.isFrozen(observed.overlay.coverage)).toBe(true);
		await Promise.resolve();
		expect(events.length).toBeGreaterThan(20);

		const hostile = buildCommandEventContractOverlay(fixture.inputs, {
			onProgress: () => {
				throw new Error('hostile telemetry sink');
			}
		});
		expect(hostile).toEqual(expected);
		await Promise.resolve();
	});

	it('fails closed for stale request, predecessor, and retained-artifact identities', () => {
		for (const request of [
			{ ...fixture.request, subjectId: `stale-${fixture.request.subjectId}` },
			{
				...fixture.request,
				semanticSnapshotId:
					`${fixture.request.semanticSnapshotId}-stale` as typeof fixture.request.semanticSnapshotId
			},
			{
				...fixture.request,
				arrowObservationId:
					`${fixture.request.arrowObservationId}-stale` as typeof fixture.request.arrowObservationId
			},
			{
				...fixture.request,
				commandHandlerGraphId:
					`${fixture.request.commandHandlerGraphId}-stale` as typeof fixture.request.commandHandlerGraphId
			},
			{
				...fixture.request,
				vocabArtifact: {
					...fixture.request.vocabArtifact,
					artifactContentSha256: '0'.repeat(64)
				}
			}
		])
			expectUnavailable({ ...fixture.inputs, request });

		expectUnavailable({
			...fixture.inputs,
			commandHandlerGraph: {
				...fixture.commandHandlerGraph,
				id: `${fixture.commandHandlerGraph.id}-stale` as typeof fixture.commandHandlerGraph.id
			}
		});
	});

	it('rejects redigested population, indexes, layers, coverage, authority, and content corruption', () => {
		const base = overlay();
		for (const candidate of [
			redigested(base, (draft) => {
				(draft as unknown as { commands: unknown[] }).commands = [];
			}),
			redigested(base, (draft) => {
				(draft as unknown as { declaredLinks: unknown[] }).declaredLinks = [];
			}),
			redigested(base, (draft) => {
				(draft as unknown as { forwardIndex: unknown[] }).forwardIndex = [];
			}),
			redigested(base, (draft) => {
				(draft.layers[0].eventIds as unknown as string[]).splice(0);
			}),
			redigested(base, (draft) => {
				(draft.coverage as { commands: number }).commands = 0;
			}),
			redigested(base, (draft) => {
				(draft as { runtimeEmission: string }).runtimeEmission = 'CLAIMED';
			})
		])
			expect(validateCommandEventContractOverlay(candidate, fixture.inputs)).toMatchObject({
				issues: [{ code: 'POPULATION_MISMATCH' }],
				state: 'INVALID'
			});
		const corruptDigest = structuredClone(base) as CommandEventContractOverlaySnapshot;
		(corruptDigest as { contentDigest: string }).contentDigest = '0'.repeat(64);
		expect(validateCommandEventContractOverlay(corruptDigest, fixture.inputs)).toMatchObject({
			issues: [{ code: 'CONTENT_DIGEST_MISMATCH' }],
			state: 'INVALID'
		});
	});

	it('enforces exact one-below operation budgets', () => {
		const base = overlay();
		for (const [key, actual] of [
			['maxAstNodes', fixture.snapshot.astNodes.length],
			['maxBoundContributions', base.boundContributions.length],
			['maxCommands', base.commands.length],
			['maxDeclaredLinks', base.declaredLinks.length],
			['maxEventContracts', base.eventContracts.length],
			['maxFrontiers', base.frontiers.length],
			['maxPinnedEmissions', base.pinnedEmissions.length]
		] as const) {
			expect(actual).toBeGreaterThan(0);
			expectUnavailable(
				{
					...fixture.inputs,
					request: {
						...fixture.request,
						budgets: { ...fixture.request.budgets, [key]: actual - 1 }
					}
				},
				'BUDGET_EXCEEDED'
			);
		}
	});

	it('rejects hostile shells before invoking accessors', () => {
		let hits = 0;
		const hostileRequest = { ...fixture.request } as Record<string, unknown>;
		Object.defineProperty(hostileRequest, 'subjectId', {
			enumerable: true,
			get() {
				hits += 1;
				return fixture.request.subjectId;
			}
		});
		expectUnavailable({ ...fixture.inputs, request: hostileRequest });
		expect(hits).toBe(0);

		const candidate = new Proxy(overlay(), {});
		expect(validateCommandEventContractOverlay(candidate, fixture.inputs)).toMatchObject({
			issues: [{ code: 'SHAPE_INVALID' }],
			state: 'INVALID'
		});
	});
});
