import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
	type ObserveArrowCommandCensusRequest
} from '../contracts/arrow-command-census.js';
import type { CommandHandlerGraphSnapshot } from '../contracts/command-handler-graph.js';
import {
	type GuardClassificationOverlayBuildInputs,
	type GuardClassificationOverlaySnapshot
} from '../contracts/guard-classification-overlay.js';
import {
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	type GuardEnforcementLedgerObservation,
	type GuardEnforcementLedgerRawEvidence,
	type ObserveGuardEnforcementLedgerRequest
} from '../contracts/guard-enforcement-ledger.js';
import { normalizeArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/normalize-arrow-command-census.js';
import { normalizeGuardEnforcementLedgerObservation } from '../providers/jpwb-guard-enforcement-ledger/normalize-guard-enforcement-ledger.js';
import { buildCommandHandlerGraph } from './build-command-handler-graph.js';
import { buildGuardClassificationOverlay } from './build-guard-classification-overlay.js';
import {
	createFactoryGuardClassificationOverlayPredecessorFixture,
	createGuardClassificationOverlayPredecessorFixture,
	createHelperGuardClassificationOverlayPredecessorFixture,
	createNestedDirectGuardClassificationOverlayPredecessorFixture,
	createNestedFactoryGuardClassificationOverlayPredecessorFixture,
	createTableGuardClassificationOverlayPredecessorFixture,
	type GuardClassificationOverlayPredecessorFixture
} from './guard-classification-overlay-fixture.test-support.js';
import { validateGuardClassificationOverlay } from './validate-guard-classification-overlay.js';

let value: GuardClassificationOverlayPredecessorFixture;
let baseline: GuardClassificationOverlaySnapshot;

beforeAll(() => {
	value = createGuardClassificationOverlayPredecessorFixture();
	const outcome = buildGuardClassificationOverlay(value.inputs);
	if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
	baseline = outcome.overlay;
});

afterAll(() => value.cleanup());

function unavailable(inputs: unknown) {
	const outcome = buildGuardClassificationOverlay(inputs as GuardClassificationOverlayBuildInputs);
	expect(outcome.outcome).toBe('unavailable');
	return outcome;
}

function guardRequest(): ObserveGuardEnforcementLedgerRequest {
	return {
		artifactSetId: value.guardObservation.artifactSet.id,
		budgets: value.guardObservation.budgets,
		operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
		subjectId: value.guardObservation.subjectId
	};
}

function normalizeGuard(
	evidence: GuardEnforcementLedgerRawEvidence
): GuardEnforcementLedgerObservation {
	return normalizeGuardEnforcementLedgerObservation({
		artifactSet: value.guardObservation.artifactSet,
		evidence,
		executor: value.guardObservation.executor,
		request: guardRequest(),
		transportOutputBytes: new Uint8Array([1])
	});
}

function guardInputs(
	evidence: GuardEnforcementLedgerRawEvidence
): GuardClassificationOverlayBuildInputs {
	const guardObservation = normalizeGuard(evidence);
	return {
		...value.inputs,
		guardObservation,
		request: { ...value.request, guardObservationId: guardObservation.id }
	};
}

function staleUnclassifiedInputs(): GuardClassificationOverlayBuildInputs {
	const raw = structuredClone(value.guardObservation.rawEvidence);
	const staleText = 'retired retained guard';
	Object.assign(raw, {
		audit: {
			...raw.audit,
			counts: [],
			stale: [staleText],
			unclassified: [...raw.guardTexts]
		},
		ledgerRows: [
			{
				disposition: 'UNENFORCED' as const,
				enforcingAnchor: null,
				enforcingSite: null,
				evidence: 'Retired row retained only as stale evidence.',
				guardText: staleText
			}
		]
	});
	return guardInputs(raw);
}

function arrowRequest(): ObserveArrowCommandCensusRequest {
	return {
		artifactSetId: value.arrowObservation.artifactSet.id,
		budgets: value.arrowObservation.budgets,
		operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
		schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
		subjectId: value.arrowObservation.subjectId
	};
}

function withoutDeclaredCommandEvidence(): GuardClassificationOverlayBuildInputs {
	const key = value.arrowObservation.declaredArrows[0]!.arrowKey;
	const raw = structuredClone(value.arrowObservation.rawEvidence);
	Object.assign(raw, {
		baseline: { ...raw.baseline, uncovered: [key] },
		census: { ...raw.census, uncovered: [key] },
		declaredArrows: []
	});
	const arrowObservation = normalizeArrowCommandCensusObservation({
		artifactSet: value.arrowObservation.artifactSet,
		evidence: raw,
		executor: value.arrowObservation.executor,
		request: arrowRequest()
	}).observation;
	const commandHandlerRequest = {
		...value.commandHandlerRequest,
		arrowObservationId: arrowObservation.id
	};
	const graphOutcome = buildCommandHandlerGraph(
		commandHandlerRequest,
		value.snapshot,
		arrowObservation,
		value.subject
	);
	if (graphOutcome.outcome !== 'partial') throw new Error(JSON.stringify(graphOutcome));
	const commandHandlerGraph = graphOutcome.graph;
	const request = {
		...value.request,
		arrowObservationId: arrowObservation.id,
		commandHandlerGraphId: commandHandlerGraph.id
	};
	return {
		...value.inputs,
		arrowObservation,
		commandHandlerGraph,
		commandHandlerRequest,
		request
	};
}

describe('guard-classification overlay hostile-path coverage', { timeout: 30_000 }, () => {
	it('preserves candidate-only factory, helper-frontier, and table-evidence boundaries', () => {
		for (const [make, expected] of [
			[
				createFactoryGuardClassificationOverlayPredecessorFixture,
				{
					attribution: 'CANDIDATE',
					frontier: 'FACTORY_HANDLER_ATTRIBUTION_CANDIDATE',
					site: 'FACTORY_SHARED'
				}
			],
			[
				createNestedFactoryGuardClassificationOverlayPredecessorFixture,
				{
					attribution: 'CANDIDATE',
					frontier: 'FACTORY_HANDLER_ATTRIBUTION_CANDIDATE',
					site: 'FACTORY_SHARED'
				}
			],
			[
				createHelperGuardClassificationOverlayPredecessorFixture,
				{ attribution: null, frontier: 'HELPER_CALL_FLOW_UNRESOLVED', site: 'DIRECT_HANDLER' }
			],
			[
				createNestedDirectGuardClassificationOverlayPredecessorFixture,
				{ attribution: 'EXACT', frontier: null, site: 'DIRECT_HANDLER' }
			],
			[
				createTableGuardClassificationOverlayPredecessorFixture,
				{ attribution: 'EXACT', frontier: null, site: 'TABLE_COMMAND' }
			]
		] as const) {
			const fixture = make();
			try {
				const outcome = buildGuardClassificationOverlay(fixture.inputs);
				expect(outcome.outcome).toBe('partial');
				if (outcome.outcome !== 'partial') continue;
				expect(outcome.overlay.commandEvidenceLinks[0]!.siteAttribution).toBe(expected.site);
				expect(outcome.overlay.handlerLinks[0]?.attribution ?? null).toBe(expected.attribution);
				expect(outcome.overlay.frontiers[0]?.frontierKind ?? null).toBe(expected.frontier);
				const handlerLinkId = outcome.overlay.handlerLinks[0]?.id;
				expect(outcome.overlay.layers[0]!.handlerLinkIds).toEqual(
					expected.attribution === 'EXACT' && handlerLinkId !== undefined ? [handlerLinkId] : []
				);
				expect(outcome.overlay.layers[1]!.handlerLinkIds).toEqual(
					expected.attribution === 'CANDIDATE' && handlerLinkId !== undefined ? [handlerLinkId] : []
				);
				if (make === createNestedFactoryGuardClassificationOverlayPredecessorFixture) {
					const link = outcome.overlay.handlerLinks[0]!;
					expect(link.attribution).toBe('CANDIDATE');
					if (link.attribution === 'CANDIDATE')
						expect(link.factoryCallableNodeId).not.toBe(
							outcome.overlay.anchorSites[0]!.callableNodeId
						);
				}
				if (make === createNestedDirectGuardClassificationOverlayPredecessorFixture) {
					const target = fixture.commandHandlerGraph.nodes.find(
						(node) => node.id === outcome.overlay.handlerLinks[0]!.targetNodeIds[0]
					);
					expect(target?.kind).toBe('HANDLER_TARGET');
					if (target?.kind === 'HANDLER_TARGET')
						expect(target.nodeId).not.toBe(outcome.overlay.anchorSites[0]!.callableNodeId);
				}
				expect(validateGuardClassificationOverlay(outcome.overlay, fixture.inputs)).toEqual({
					issues: [],
					state: 'VALID'
				});
			} finally {
				fixture.cleanup();
			}
		}
	});

	it('materializes stale and unclassified ledger frontiers from independently normalized evidence', () => {
		const inputs = staleUnclassifiedInputs();
		const outcome = buildGuardClassificationOverlay(inputs);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') return;
		expect(outcome.overlay.classifications.map((record) => record.ledgerState).sort()).toEqual([
			'STALE',
			'UNCLASSIFIED'
		]);
		expect(outcome.overlay.frontiers.map((frontier) => frontier.frontierKind).sort()).toEqual([
			'STALE_LEDGER_ROW',
			'UNCLASSIFIED_GUARD_TEXT'
		]);
		expect(outcome.overlay.anchorSites).toHaveLength(0);
		expect(validateGuardClassificationOverlay(outcome.overlay, inputs)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('retains an explicit no-command-evidence frontier without making a dead-code claim', () => {
		const inputs = withoutDeclaredCommandEvidence();
		const outcome = buildGuardClassificationOverlay(inputs);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') return;
		expect(outcome.overlay.commandEvidenceLinks).toHaveLength(0);
		expect(outcome.overlay.handlerLinks).toHaveLength(0);
		expect(outcome.overlay.frontiers.map((frontier) => frontier.frontierKind).sort()).toEqual([
			'HELPER_CALL_FLOW_UNRESOLVED',
			'NO_RETAINED_DECLARED_ARROW_EVIDENCE'
		]);
		expect(outcome.overlay.coverage).toMatchObject({
			noCommandEvidenceFrontiers: 1,
			reconciles: true
		});
		expect(validateGuardClassificationOverlay(outcome.overlay, inputs)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('fails closed for valid retained citations with unsupported syntax or absent anchors', () => {
		for (const row of [
			{ ...value.guardObservation.rawEvidence.ledgerRows[0]!, enforcingSite: 'outside.ts:1' },
			{
				...value.guardObservation.rawEvidence.ledgerRows[0]!,
				enforcingAnchor: 'return definitelyAbsentAnchor();'
			}
		]) {
			const raw = structuredClone(value.guardObservation.rawEvidence);
			(raw as unknown as { ledgerRows: unknown[] }).ledgerRows = [row];
			const inputs = guardInputs(raw);
			expect(unavailable(inputs)).toMatchObject({
				diagnostics: [expect.objectContaining({ code: 'UNSUPPORTED_HANDLER_CORRELATION' })]
			});
			expect(validateGuardClassificationOverlay(baseline, inputs)).toMatchObject({
				issues: [expect.objectContaining({ code: 'POPULATION_MISMATCH' })],
				state: 'INVALID'
			});
		}
	});

	it('enforces derived classification, occurrence, command-link, and frontier guards', () => {
		const staleInputs = staleUnclassifiedInputs();
		for (const budget of ['maxGuardRecords', 'maxFrontiers'] as const)
			expect(
				unavailable({
					...staleInputs,
					request: {
						...staleInputs.request,
						budgets: { ...staleInputs.request.budgets, [budget]: 1 }
					}
				})
			).toMatchObject({ diagnostics: [expect.objectContaining({ code: 'BUDGET_EXCEEDED' })] });

		const raw = structuredClone(value.guardObservation.rawEvidence);
		(raw as unknown as { guardedArrows: unknown[] }).guardedArrows = [
			...raw.guardedArrows,
			...structuredClone(raw.guardedArrows)
		];
		(raw.audit as { arrowCount: number }).arrowCount = 2;
		const duplicateInputs = guardInputs(raw);
		for (const budget of ['maxGuardOccurrences', 'maxCommandEvidenceLinks'] as const)
			expect(
				unavailable({
					...duplicateInputs,
					request: {
						...duplicateInputs.request,
						budgets: { ...duplicateInputs.request.budgets, [budget]: 1 }
					}
				})
			).toMatchObject({ diagnostics: [expect.objectContaining({ code: 'BUDGET_EXCEEDED' })] });
		const duplicateOutcome = buildGuardClassificationOverlay(duplicateInputs);
		expect(duplicateOutcome.outcome).toBe('partial');
		if (duplicateOutcome.outcome === 'partial')
			expect(duplicateOutcome.overlay.coverage.stateEvidenceRefs).toBe(4);
	});

	it('reports every independently invalid predecessor family fail closed', () => {
		const cases: Array<[GuardClassificationOverlayBuildInputs, string]> = [
			[
				{
					...value.inputs,
					guardObservation: { ...value.guardObservation, contentDigest: '0'.repeat(64) }
				} as GuardClassificationOverlayBuildInputs,
				'GUARD_OBSERVATION_INVALID'
			],
			[
				{
					...value.inputs,
					stateObservation: { ...value.stateObservation, contentDigest: '0'.repeat(64) }
				} as GuardClassificationOverlayBuildInputs,
				'STATE_OBSERVATION_INVALID'
			],
			[
				{
					...value.inputs,
					stateGraph: { ...value.stateGraph, graphInputDigest: '0'.repeat(64) }
				} as GuardClassificationOverlayBuildInputs,
				'STATE_GRAPH_INVALID'
			],
			[
				{
					...value.inputs,
					arrowObservation: { ...value.arrowObservation, contentDigest: '0'.repeat(64) }
				} as GuardClassificationOverlayBuildInputs,
				'ARROW_OBSERVATION_INVALID'
			],
			[
				{
					...value.inputs,
					commandHandlerGraph: {
						...value.commandHandlerGraph,
						graphInputDigest: '0'.repeat(64)
					} as CommandHandlerGraphSnapshot
				},
				'COMMAND_HANDLER_GRAPH_INVALID'
			]
		];
		for (const [inputs, code] of cases)
			expect(unavailable(inputs)).toMatchObject({
				diagnostics: [expect.objectContaining({ code })]
			});
	});

	it('public validation independently rejects every invalid predecessor family', () => {
		for (const inputs of [
			{
				...value.inputs,
				stateObservation: { ...value.stateObservation, contentDigest: '0'.repeat(64) }
			},
			{
				...value.inputs,
				stateGraph: { ...value.stateGraph, contentDigest: '0'.repeat(64) }
			},
			{
				...value.inputs,
				arrowObservation: { ...value.arrowObservation, contentDigest: '0'.repeat(64) }
			},
			{
				...value.inputs,
				commandHandlerGraph: { ...value.commandHandlerGraph, contentDigest: '0'.repeat(64) }
			}
		] as GuardClassificationOverlayBuildInputs[])
			expect(validateGuardClassificationOverlay(baseline, inputs)).toMatchObject({
				issues: [expect.objectContaining({ code: 'INPUT_INVALID' })],
				state: 'INVALID'
			});
	});

	it('validator fails closed when independently derived semantic populations are internally hostile', () => {
		const duplicateNode = structuredClone(value.snapshot.astNodes[0]!);
		const missingSourceNode = {
			...structuredClone(value.snapshot.astNodes[0]!),
			id: `${value.snapshot.astNodes[0]!.id}-missing-source` as (typeof value.snapshot.astNodes)[0]['id'],
			sourceId: 'semantic:source-absent' as (typeof value.snapshot.astNodes)[0]['sourceId']
		};
		const badSpanNode = {
			...structuredClone(value.snapshot.astNodes[0]!),
			id: `${value.snapshot.astNodes[0]!.id}-bad-span` as (typeof value.snapshot.astNodes)[0]['id'],
			start: -1
		};
		const wrongOwner = {
			...structuredClone(value.snapshot.sources[0]!),
			id: `${value.snapshot.sources[0]!.id}-wrong-owner` as (typeof value.snapshot.sources)[0]['id'],
			projectId: value.snapshot.projects.find(
				(project) => project.id !== value.snapshot.sources[0]!.projectId
			)!.id
		};
		for (const semanticSnapshot of [
			{ ...value.snapshot, astNodes: [...value.snapshot.astNodes, duplicateNode] },
			{ ...value.snapshot, astNodes: [...value.snapshot.astNodes, missingSourceNode] },
			{ ...value.snapshot, astNodes: [...value.snapshot.astNodes, badSpanNode] },
			{ ...value.snapshot, sources: [...value.snapshot.sources, wrongOwner] }
		])
			expect(
				validateGuardClassificationOverlay(baseline, { ...value.inputs, semanticSnapshot })
			).toMatchObject({
				issues: [expect.objectContaining({ code: 'INPUT_INVALID' })],
				state: 'INVALID'
			});
	});

	it('charges multiple distinct anchors in one frozen source once for maxSourceBytes', () => {
		const raw = structuredClone(value.guardObservation.rawEvidence);
		const secondAnchor = "advanceStatus({ machine: 'Work.status', target: 'STARTED' })";
		const secondText = 'retired operator start authorization';
		Object.assign(raw, {
			audit: {
				...raw.audit,
				stale: [secondText]
			},
			ledgerRows: [
				...raw.ledgerRows,
				{
					disposition: 'ENFORCED' as const,
					enforcingAnchor: secondAnchor,
					enforcingSite: 'packages/rph-application/src/handlers/work.ts:999',
					evidence: 'Second distinct anchor remains in the same frozen source.',
					guardText: secondText
				}
			].sort((left, right) => left.guardText.localeCompare(right.guardText))
		});
		const inputs = guardInputs(raw);
		const sourceBytes = value.subject.artifacts.find(
			(artifact) => artifact.path === 'packages/rph-application/src/handlers/work.ts'
		)!.bytes;
		const exactInputs = {
			...inputs,
			request: {
				...inputs.request,
				budgets: { ...inputs.request.budgets, maxSourceBytes: sourceBytes }
			}
		};
		const outcome = buildGuardClassificationOverlay(exactInputs);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome === 'partial') {
			expect(outcome.overlay.anchorSites).toHaveLength(2);
			expect(validateGuardClassificationOverlay(outcome.overlay, exactInputs)).toEqual({
				issues: [],
				state: 'VALID'
			});
		}
	});

	it('rejects unavailable semantic capability and further one-below output guards', () => {
		const snapshot = {
			...value.snapshot,
			capabilities: value.snapshot.capabilities.map((capability) =>
				capability.capability === 'TS_SYMBOL'
					? { ...capability, state: 'UNSUPPORTED' as const }
					: capability
			)
		};
		expect(unavailable({ ...value.inputs, semanticSnapshot: snapshot })).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'STATE_GRAPH_INVALID' })]
		});
		for (const [key, actual] of [
			['maxCommandEvidenceLinks', baseline.commandEvidenceLinks.length],
			['maxGuardOccurrences', baseline.occurrences.length],
			['maxGuardRecords', baseline.classifications.length],
			['maxHandlerLinks', baseline.handlerLinks.length]
		] as const) {
			const maximum = actual - 1;
			if (maximum < 1) continue;
			unavailable({
				...value.inputs,
				request: {
					...value.request,
					budgets: { ...value.request.budgets, [key]: maximum }
				}
			});
		}
	});

	it('rejects exact-shape traps before reading attacker-controlled input members', () => {
		const inherited = Object.assign(Object.create({ inherited: true }), value.inputs);
		const symbolInput = { ...value.inputs } as GuardClassificationOverlayBuildInputs & {
			[Symbol.iterator]?: () => void;
		};
		Object.defineProperty(symbolInput, Symbol.iterator, {
			enumerable: true,
			value: () => undefined
		});
		const accessor = { ...value.inputs } as Record<string, unknown>;
		Object.defineProperty(accessor, 'request', { enumerable: true, get: () => value.request });
		const requestAccessor = { ...value.request } as Record<string, unknown>;
		Object.defineProperty(requestAccessor, 'subjectId', {
			enumerable: true,
			get: () => value.request.subjectId
		});
		for (const hostile of [
			inherited,
			symbolInput,
			accessor,
			{ ...value.inputs, request: requestAccessor },
			{ ...value.inputs, request: null },
			{ ...value.inputs, request: { ...value.request, subjectId: 1 } },
			{ ...value.inputs, request: { ...value.request, budgets: [] } },
			{
				...value.inputs,
				request: { ...value.request, budgets: { ...value.request.budgets, extra: 1 } }
			}
		])
			expect(unavailable(hostile)).toMatchObject({
				diagnostics: [expect.objectContaining({ code: 'REQUEST_INVALID' })]
			});
	});

	it('ignores malformed telemetry options and deeply freezes every returned outcome', async () => {
		for (const options of [
			null,
			new Proxy({ onProgress: () => undefined }, {}),
			{ onProgress: 'not callable' },
			{ extra: true, onProgress: () => undefined }
		] as never[]) {
			const outcome = buildGuardClassificationOverlay(value.inputs, options);
			expect(outcome.outcome).toBe('partial');
			expect(Object.isFrozen(outcome)).toBe(true);
			if (outcome.outcome === 'partial') {
				expect(Object.isFrozen(outcome.overlay)).toBe(true);
				expect(Object.isFrozen(outcome.overlay.limitations)).toBe(true);
				expect(Object.isFrozen(outcome.overlay.limitations[0])).toBe(true);
			}
		}
		await Promise.resolve();
	});

	it('bounds and rejects hostile validator candidate containers without invoking accessors', () => {
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		const sparse = new Array(2);
		sparse[1] = 1;
		const extraArray = [1] as unknown[] & { extra?: number };
		extraArray.extra = 1;
		const symbolObject = { value: 1 } as Record<PropertyKey, unknown>;
		symbolObject[Symbol.iterator] = 1;
		const nonEnumerable = {};
		Object.defineProperty(nonEnumerable, 'hidden', { enumerable: false, value: 1 });
		const getter = {};
		let invoked = false;
		Object.defineProperty(getter, 'data', {
			enumerable: true,
			get: () => {
				invoked = true;
				return 1;
			}
		});
		for (const hostile of [
			undefined,
			Symbol('value'),
			BigInt(1),
			Number.NaN,
			-0,
			() => undefined,
			new Proxy({}, {}),
			cyclic,
			Object.create({ inherited: true }),
			sparse,
			extraArray,
			symbolObject,
			nonEnumerable,
			getter
		])
			expect(validateGuardClassificationOverlay(hostile, value.inputs).state).not.toBe('VALID');
		expect(invoked).toBe(false);
	});

	it('rejects hostile input and semantic record/array shells before independent derivation', () => {
		const symbolInput = { ...value.inputs } as Record<PropertyKey, unknown>;
		symbolInput[Symbol.iterator] = 1;
		const inputAccessor = { ...value.inputs } as Record<string, unknown>;
		Object.defineProperty(inputAccessor, 'request', {
			enumerable: false,
			value: value.request
		});
		for (const inputs of [null, [], new Proxy(value.inputs, {}), symbolInput, inputAccessor])
			expect(
				validateGuardClassificationOverlay(
					baseline,
					inputs as GuardClassificationOverlayBuildInputs
				)
			).toMatchObject({ issues: [expect.objectContaining({ code: 'SHAPE_INVALID' })] });

		const semanticSymbol = structuredClone(value.snapshot) as unknown as Record<
			PropertyKey,
			unknown
		>;
		semanticSymbol[Symbol.iterator] = 1;
		const semanticAccessor = structuredClone(value.snapshot) as unknown as Record<string, unknown>;
		Object.defineProperty(semanticAccessor, 'sources', {
			enumerable: false,
			value: value.snapshot.sources
		});
		const sparse = new Array(value.snapshot.sources.length + 1);
		for (const [index, source] of value.snapshot.sources.entries()) sparse[index] = source;
		const extra = [...value.snapshot.sources] as unknown[] & { extra?: number };
		extra.extra = 1;
		const symbolPopulation = [...value.snapshot.sources] as unknown as Record<PropertyKey, unknown>;
		delete symbolPopulation[String(value.snapshot.sources.length - 1)];
		symbolPopulation[Symbol('hostile')] = value.snapshot.sources.at(-1);
		const accessorPopulation = [...value.snapshot.sources];
		Object.defineProperty(accessorPopulation, '0', {
			enumerable: true,
			get: () => value.snapshot.sources[0]
		});
		for (const semanticSnapshot of [
			semanticSymbol,
			semanticAccessor,
			{ ...value.snapshot, sources: null },
			{ ...value.snapshot, sources: sparse },
			{ ...value.snapshot, sources: extra },
			{ ...value.snapshot, sources: symbolPopulation },
			{ ...value.snapshot, sources: accessorPopulation }
		])
			expect(
				validateGuardClassificationOverlay(baseline, {
					...value.inputs,
					semanticSnapshot: semanticSnapshot as unknown as typeof value.snapshot
				})
			).toMatchObject({ issues: [expect.objectContaining({ code: 'SHAPE_INVALID' })] });
	});

	it('bounds candidate and input depth, records, strings, arrays, and option shape independently', () => {
		for (const options of [
			null,
			[],
			new Proxy({}, {}),
			{ unknown: 1 },
			{ maxDepth: 0 },
			{ maxDepth: Number.MAX_SAFE_INTEGER + 1 }
		] as never[])
			expect(validateGuardClassificationOverlay(baseline, value.inputs, options)).toMatchObject({
				issues: [expect.objectContaining({ code: 'SHAPE_INVALID' })],
				state: 'INVALID'
			});

		const accessorOptions = {};
		Object.defineProperty(accessorOptions, 'maxDepth', { enumerable: true, get: () => 1 });
		expect(
			validateGuardClassificationOverlay(baseline, value.inputs, accessorOptions)
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'SHAPE_INVALID' })]
		});
		for (const options of [
			{ maxDepth: 1 },
			{ maxRecords: 1 },
			{ maxStringCharacters: 1 },
			{ maxInputRecords: 1 },
			{ maxInputStringCharacters: 1 }
		])
			expect(validateGuardClassificationOverlay(baseline, value.inputs, options)).toMatchObject({
				issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })],
				state: 'BUDGET_EXHAUSTED'
			});

		expect(
			validateGuardClassificationOverlay('long candidate', value.inputs, {
				maxStringCharacters: 1
			})
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED', path: '$' })],
			state: 'BUDGET_EXHAUSTED'
		});
		expect(
			validateGuardClassificationOverlay([null], value.inputs, { maxRecords: 1 })
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED', path: '$' })],
			state: 'BUDGET_EXHAUSTED'
		});
	});

	it('rejects inputs whose cloned subject has lost its frozen-byte capability', () => {
		const cloned = structuredClone(value.inputs) as GuardClassificationOverlayBuildInputs;
		expect(validateGuardClassificationOverlay(baseline, cloned)).toEqual({
			issues: [
				{
					code: 'INPUT_INVALID',
					message: 'FrozenSubject bytes capability is unavailable.',
					path: '$inputs.subject'
				}
			],
			state: 'INVALID'
		});
	});

	it('fails closed for independently malformed validator inputs and operation guards', () => {
		const candidates: GuardClassificationOverlayBuildInputs[] = [
			{ ...value.inputs, unexpected: true } as GuardClassificationOverlayBuildInputs,
			{ ...value.inputs, request: { ...value.request, schemaVersion: 'wrong' } } as never,
			{
				...value.inputs,
				request: {
					...value.request,
					budgets: { ...value.request.budgets, maxAstNodes: 0 }
				}
			} as GuardClassificationOverlayBuildInputs,
			{
				...value.inputs,
				request: { ...value.request, subjectId: 'stale-subject' }
			} as GuardClassificationOverlayBuildInputs,
			{
				...value.inputs,
				semanticSnapshot: {
					...value.snapshot,
					capabilities: value.snapshot.capabilities.filter(
						(capability) => capability.capability !== 'TS_SYMBOL'
					)
				}
			} as GuardClassificationOverlayBuildInputs,
			{
				...value.inputs,
				guardObservation: { ...value.guardObservation, contentDigest: 'f'.repeat(64) }
			} as GuardClassificationOverlayBuildInputs
		];
		for (const inputs of candidates)
			expect(validateGuardClassificationOverlay(baseline, inputs).state).not.toBe('VALID');

		for (const [budget, actual] of [
			['maxAstNodes', value.snapshot.astNodes.length],
			[
				'maxSourceBytes',
				value.subject.artifacts.find((artifact) => artifact.path === baseline.anchorSites[0]!.path)!
					.bytes
			],
			['maxStateEvidenceRefs', baseline.coverage.stateEvidenceRefs]
		] as const) {
			const inputs = {
				...value.inputs,
				request: {
					...value.request,
					budgets: { ...value.request.budgets, [budget]: actual - 1 }
				}
			};
			expect(validateGuardClassificationOverlay(baseline, inputs)).toMatchObject({
				issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })],
				state: 'BUDGET_EXHAUSTED'
			});
		}
	});
});
