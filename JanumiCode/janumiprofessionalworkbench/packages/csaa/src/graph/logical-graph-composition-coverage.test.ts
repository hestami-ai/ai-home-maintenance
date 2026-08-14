import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	type BuildLogicalGraphCompositionOptions,
	type LogicalGraphCompositionDiagnosticCode,
	type LogicalGraphCompositionInputs,
	type LogicalGraphCompositionSnapshot,
	type LogicalGraphCompositionValidationIssueCode,
	type LogicalGraphCompositionValidationOptions
} from '../contracts/logical-graph-composition.js';
import { isUnicodeScalarString } from '../semantic/canonical.js';
import { buildLogicalGraphComposition } from './build-logical-graph-composition.js';
import {
	createLogicalGraphCompositionFixture,
	type LogicalGraphCompositionFixture
} from './logical-graph-composition-fixture.test-support.js';
import {
	logicalGraphCompositionContentDigest,
	logicalGraphCompositionCrossLinkId,
	logicalGraphCompositionId,
	logicalGraphCompositionInputDigest,
	logicalGraphCompositionLayerId
} from './logical-graph-composition-canonical.js';
import {
	validateConstructedLogicalGraphComposition,
	validateLogicalGraphComposition
} from './validate-logical-graph-composition.js';

let value: LogicalGraphCompositionFixture;
let composition: LogicalGraphCompositionSnapshot;

beforeAll(() => {
	value = createLogicalGraphCompositionFixture();
	const outcome = buildLogicalGraphComposition(value.inputs);
	if (outcome.outcome !== 'partial')
		throw new Error(`Fixture composition failed: ${JSON.stringify(outcome)}`);
	composition = outcome.composition;
});

afterAll(() => value.cleanup());

function usage(root: unknown): {
	readonly depth: number;
	readonly records: number;
	readonly stringCharacters: number;
} {
	type Frame =
		| { readonly depth: number; readonly state: 'VISIT'; readonly value: unknown }
		| { readonly state: 'LEAVE'; readonly value: object };
	const pending: Frame[] = [{ depth: 0, state: 'VISIT', value: root }];
	const active = new WeakSet<object>();
	let depth = 0;
	let records = 0;
	let stringCharacters = 0;
	while (pending.length > 0) {
		const frame = pending.pop()!;
		if (frame.state === 'LEAVE') {
			active.delete(frame.value);
			continue;
		}
		depth = Math.max(depth, frame.depth);
		records += 1;
		if (typeof frame.value === 'string') {
			if (!isUnicodeScalarString(frame.value)) throw new Error('Non-scalar fixture text.');
			stringCharacters += frame.value.length;
			continue;
		}
		if (frame.value === null || typeof frame.value === 'boolean' || typeof frame.value === 'number')
			continue;
		if (typeof frame.value !== 'object' || active.has(frame.value))
			throw new Error('Expected an acyclic plain-data fixture.');
		active.add(frame.value);
		pending.push({ state: 'LEAVE', value: frame.value });
		const children = Array.isArray(frame.value)
			? Reflect.ownKeys(frame.value)
					.filter((key) => key !== 'length')
					.map((key) => {
						if (typeof key !== 'string' || !isUnicodeScalarString(key))
							throw new Error('Non-scalar fixture array key.');
						stringCharacters += key.length;
						const descriptor = Reflect.getOwnPropertyDescriptor(frame.value as object, key);
						if (descriptor === undefined || !('value' in descriptor))
							throw new Error('Non-data fixture array member.');
						return descriptor.value;
					})
			: Object.keys(frame.value).map((key) => {
					if (!isUnicodeScalarString(key)) throw new Error('Non-scalar fixture key.');
					stringCharacters += key.length;
					return (frame.value as Record<string, unknown>)[key];
				});
		for (let index = children.length - 1; index >= 0; index -= 1)
			pending.push({ depth: frame.depth + 1, state: 'VISIT', value: children[index] });
	}
	return { depth, records, stringCharacters };
}

function expectIssue(
	candidate: unknown,
	inputs: unknown,
	code: LogicalGraphCompositionValidationIssueCode,
	options?: LogicalGraphCompositionValidationOptions
): void {
	const result = validateLogicalGraphComposition(
		candidate,
		inputs as LogicalGraphCompositionInputs,
		options
	);
	expect(result).toMatchObject({
		issues: expect.arrayContaining([expect.objectContaining({ code })]),
		state: code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INVALID'
	});
}

function redigested(
	mutate: (draft: LogicalGraphCompositionSnapshot) => void
): LogicalGraphCompositionSnapshot {
	const draft = structuredClone(composition) as LogicalGraphCompositionSnapshot;
	mutate(draft);
	(draft as { contentDigest: string }).contentDigest = logicalGraphCompositionContentDigest(draft);
	return draft;
}

function withBudget(key: string, maximum: number): LogicalGraphCompositionInputs {
	return {
		...value.inputs,
		request: {
			...value.request,
			budgets: { ...value.request.budgets, [key]: maximum }
		}
	} as LogicalGraphCompositionInputs;
}

function expectBuildIssue(inputs: unknown, code: LogicalGraphCompositionDiagnosticCode): void {
	expect(buildLogicalGraphComposition(inputs)).toMatchObject({
		diagnostics: [expect.objectContaining({ code })],
		outcome: 'unavailable'
	});
}

describe('logical graph composition public boundary coverage', () => {
	it('derives every canonical identity domain deterministically', () => {
		const inputDigest = logicalGraphCompositionInputDigest(value.inputs);
		const compositionId = logicalGraphCompositionId({
			inputDigest,
			semanticSnapshotId: value.snapshot.id,
			subjectId: value.snapshot.subjectId
		});
		expect(compositionId).toBe(composition.id);
		expect(logicalGraphCompositionInputDigest(value.inputs)).toBe(inputDigest);
		expect(logicalGraphCompositionLayerId(compositionId, 'MODULE_DEPENDENCY')).not.toBe(
			logicalGraphCompositionLayerId(compositionId, 'CALL')
		);
		expect(logicalGraphCompositionCrossLinkId(compositionId, 'source-a')).not.toBe(
			logicalGraphCompositionCrossLinkId(compositionId, 'source-b')
		);
		expect(logicalGraphCompositionContentDigest(composition)).toBe(composition.contentDigest);
	});

	it('enforces public signatures, constructed-digest binding, and hostile options', () => {
		const publicCall = validateLogicalGraphComposition as unknown as (
			...args: unknown[]
		) => unknown;
		const constructedCall = validateConstructedLogicalGraphComposition as unknown as (
			...args: unknown[]
		) => unknown;
		expect(publicCall()).toMatchObject({ state: 'INVALID' });
		expect(publicCall(composition, value.inputs, undefined, 'extra')).toMatchObject({
			state: 'INVALID'
		});
		expect(constructedCall(composition, value.inputs)).toMatchObject({ state: 'INVALID' });
		expect(
			constructedCall(composition, value.inputs, composition.inputDigest, undefined, 'extra')
		).toMatchObject({ state: 'INVALID' });
		expect(
			validateConstructedLogicalGraphComposition(composition, value.inputs, 'bad')
		).toMatchObject({
			state: 'INVALID'
		});
		expect(
			validateConstructedLogicalGraphComposition(composition, value.inputs, 'f'.repeat(64))
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'INPUT_INVALID' })],
			state: 'INVALID'
		});
		expect(
			validateConstructedLogicalGraphComposition(composition, value.inputs, composition.inputDigest)
		).toEqual({ issues: [], state: 'VALID' });

		const optionSymbol = { maxIssues: 1 } as Record<PropertyKey, unknown>;
		optionSymbol[Symbol('hostile')] = true;
		const hostileOptions: unknown[] = [
			null,
			new Proxy({ maxIssues: 1 }, {}),
			{ extra: 1 },
			{ maxDepth: 0 },
			{ maxInputRecords: -0 },
			{ maxIssues: 100_001 },
			{ maxRecords: Number.MAX_SAFE_INTEGER + 1 },
			optionSymbol
		];
		const accessor = {};
		Object.defineProperty(accessor, 'maxIssues', { enumerable: true, get: () => 1 });
		hostileOptions.push(accessor);
		for (const options of hostileOptions)
			expectIssue(
				composition,
				value.inputs,
				'SHAPE_INVALID',
				options as LogicalGraphCompositionValidationOptions
			);
	});

	it('accepts exact descriptor limits and rejects every one-below boundary', () => {
		const candidateUsage = usage(composition);
		const inputUsage = usage(value.inputs);
		expect(
			validateLogicalGraphComposition(composition, value.inputs, {
				maxDepth: Math.max(candidateUsage.depth, inputUsage.depth),
				maxInputRecords: inputUsage.records,
				maxInputStringCharacters: inputUsage.stringCharacters,
				maxIssues: 1,
				maxRecords: candidateUsage.records,
				maxStringCharacters: candidateUsage.stringCharacters
			})
		).toEqual({ issues: [], state: 'VALID' });
		for (const options of [
			{ maxRecords: candidateUsage.records - 1 },
			{ maxStringCharacters: candidateUsage.stringCharacters - 1 },
			{ maxInputRecords: inputUsage.records - 1 },
			{ maxInputStringCharacters: inputUsage.stringCharacters - 1 },
			{ maxDepth: Math.max(candidateUsage.depth, inputUsage.depth) - 1 }
		])
			expectIssue(composition, value.inputs, 'BUDGET_EXHAUSTED', options);
		expectIssue([1, 2], value.inputs, 'BUDGET_EXHAUSTED', { maxRecords: 1 });
		expectIssue(composition, value.inputs, 'BUDGET_EXHAUSTED', { maxRecords: 1 });

		const requestRecordTight = withBudget('maxInputRecords', inputUsage.records - 1);
		expectIssue(composition, requestRecordTight, 'BUDGET_EXHAUSTED', {
			maxInputRecords: inputUsage.records
		});
		const requestStringTight = withBudget(
			'maxInputStringCharacters',
			inputUsage.stringCharacters - 1
		);
		expectIssue(composition, requestStringTight, 'BUDGET_EXHAUSTED', {
			maxInputStringCharacters: inputUsage.stringCharacters
		});
	});

	it('rejects malformed builder request shells and containers before construction', () => {
		const variants: unknown[] = [
			null,
			Object.assign(Object.create({ inherited: true }), value.inputs),
			{ ...value.inputs, extra: true },
			{ ...value.inputs, request: { ...value.request, extra: true } },
			{ ...value.inputs, request: { ...value.request, subjectId: '' } },
			{ ...value.inputs, request: { ...value.request, semanticSnapshotId: '' } },
			{ ...value.inputs, request: { ...value.request, schemaVersion: 'stale' } },
			{ ...value.inputs, request: { ...value.request, operationVersion: 'stale' } },
			{
				...value.inputs,
				request: {
					...value.request,
					selection: { ...value.request.selection, conflictTreatment: 'stale' }
				}
			},
			{ ...value.inputs, request: { ...value.request, sourceLayers: [] } },
			{
				...value.inputs,
				request: {
					...value.request,
					sourceLayers: [
						{ ...value.request.sourceLayers[0], role: 'CALL' },
						value.request.sourceLayers[1]
					]
				}
			},
			withBudget('maxDiagnostics', 0),
			withBudget('maxDiagnostics', 100_001),
			withBudget('maxInputRecords', 0),
			withBudget('maxInputStringCharacters', 0),
			withBudget('maxLinks', -1),
			{
				...value.inputs,
				semanticSnapshot: []
			},
			{
				...value.inputs,
				request: {
					...value.request,
					selection: { ...value.request.selection, consistencyFields: {} }
				}
			},
			{
				...value.inputs,
				request: {
					...value.request,
					sourceLayers: [
						value.request.sourceLayers[0],
						{ ...value.request.sourceLayers[1], ordinal: 0 }
					]
				}
			}
		];
		const customNested = structuredClone(value.inputs);
		Object.setPrototypeOf(customNested.semanticSnapshot.sources[0]!, { hostile: true });
		variants.push(customNested);
		const nonScalarValue = structuredClone(value.inputs);
		(nonScalarValue.semanticSnapshot.sources[0] as { logicalPath: string }).logicalPath = '\ud800';
		variants.push(nonScalarValue);
		const nonScalarKey = structuredClone(value.inputs) as unknown as Record<string, unknown>;
		Object.defineProperty(nonScalarKey, '\ud800', { enumerable: true, value: null });
		variants.push(nonScalarKey);
		const nestedNonScalarKey = structuredClone(value.inputs);
		Object.defineProperty(nestedNonScalarKey.semanticSnapshot.sources[0]!, '\ud800', {
			enumerable: true,
			value: null
		});
		variants.push(nestedNonScalarKey);
		const nestedSymbol = structuredClone(value.inputs);
		(nestedSymbol.semanticSnapshot.sources[0]! as unknown as Record<PropertyKey, unknown>)[
			Symbol('hostile')
		] = true;
		variants.push(nestedSymbol);
		const arraySymbol = structuredClone(value.inputs);
		(arraySymbol.request.sourceLayers as unknown as Record<PropertyKey, unknown>)[
			Symbol('hostile')
		] = true;
		variants.push(arraySymbol);
		const arrayNonScalarKey = structuredClone(value.inputs);
		Object.defineProperty(arrayNonScalarKey.request.sourceLayers, '\ud800', {
			enumerable: true,
			value: null
		});
		variants.push(arrayNonScalarKey);
		const extraArray = structuredClone(value.inputs);
		(extraArray.request.sourceLayers as unknown as Record<string, unknown>).extra = true;
		variants.push(extraArray);
		const exoticArray = structuredClone(value.inputs);
		Object.setPrototypeOf(exoticArray.request.sourceLayers, null);
		variants.push(exoticArray);
		let getterCalls = 0;
		const accessorArray = structuredClone(value.inputs);
		Object.defineProperty(accessorArray.request.sourceLayers, '0', {
			enumerable: true,
			get(): never {
				getterCalls += 1;
				throw new Error('must not execute');
			}
		});
		variants.push(accessorArray);
		for (const variant of variants) expectBuildIssue(variant, 'REQUEST_INVALID');
		expect(getterCalls).toBe(0);
	});

	it('classifies descriptor population budgets before element traversal', () => {
		expectBuildIssue(withBudget('maxInputRecords', 1), 'BUDGET_EXCEEDED');
		expectBuildIssue(withBudget('maxInputRecords', 40), 'BUDGET_EXCEEDED');
	});

	it('rejects predecessor extraction identity drift before upstream validation', () => {
		const staleExtractionVersion = 'stale-semantic-extraction';
		const staleModuleGraph = {
			...value.moduleDependencyGraph,
			semanticExtractionVersion: staleExtractionVersion
		};
		expectBuildIssue(
			{
				...value.inputs,
				moduleDependencyGraph: staleModuleGraph,
				request: {
					...value.request,
					sourceLayers: [
						{
							...value.request.sourceLayers[0],
							semanticExtractionVersion: staleExtractionVersion
						},
						value.request.sourceLayers[1]
					]
				}
			},
			'INPUT_IDENTITY_MISMATCH'
		);
	});

	it('rejects hostile candidate trees without invoking accessors', () => {
		const hostiles: unknown[] = [
			null,
			new Proxy(composition, {}),
			{ ...composition, extra: true },
			{ ...composition, sequence: -0 },
			{ ...composition, health: () => 'PARTIAL' },
			{ ...composition, health: '\ud800' },
			Object.assign(Object.create({ inherited: true }), composition)
		];
		const sparse = structuredClone(composition) as unknown as Record<string, unknown>;
		sparse.crossLinks = new Array(2);
		hostiles.push(sparse);
		const extraArrayProperty = structuredClone(composition) as LogicalGraphCompositionSnapshot;
		(extraArrayProperty.crossLinks as unknown as Record<string, unknown>).extra = true;
		hostiles.push(extraArrayProperty);
		const sameCountArrayExpando = structuredClone(composition) as LogicalGraphCompositionSnapshot;
		const malformedCrossLinks: unknown[] = [sameCountArrayExpando.crossLinks[0]];
		malformedCrossLinks.length = 2;
		(malformedCrossLinks as unknown as Record<string, unknown>).extra = null;
		(sameCountArrayExpando as unknown as { crossLinks: unknown[] }).crossLinks =
			malformedCrossLinks;
		hostiles.push(sameCountArrayExpando);
		const candidateNonScalarKey = structuredClone(composition) as LogicalGraphCompositionSnapshot;
		Object.defineProperty(candidateNonScalarKey.coverage, '\ud800', {
			enumerable: true,
			value: null
		});
		hostiles.push(candidateNonScalarKey);
		const cyclic = structuredClone(composition) as LogicalGraphCompositionSnapshot;
		(cyclic.conflicts as unknown as Array<unknown>).push(cyclic);
		hostiles.push(cyclic);
		const symbol = structuredClone(composition) as unknown as Record<PropertyKey, unknown>;
		symbol[Symbol('hostile')] = true;
		hostiles.push(symbol);
		let getterCalls = 0;
		const accessor = structuredClone(composition) as LogicalGraphCompositionSnapshot;
		Object.defineProperty(accessor.layers[0].sourceGraph, 'graphId', {
			enumerable: true,
			get(): string {
				getterCalls += 1;
				throw new Error('must not execute');
			}
		});
		hostiles.push(accessor);
		for (const candidate of hostiles) expectIssue(candidate, value.inputs, 'SHAPE_INVALID');
		expect(getterCalls).toBe(0);

		const baselineCharacters = usage(composition).stringCharacters;
		const candidateKeyBudget = structuredClone(composition) as LogicalGraphCompositionSnapshot;
		(candidateKeyBudget.coverage as unknown as Record<string, unknown>)[
			'x'.repeat(baselineCharacters + 1)
		] = null;
		expectIssue(candidateKeyBudget, value.inputs, 'BUDGET_EXHAUSTED', {
			maxStringCharacters: baselineCharacters
		});
	});

	it('rejects hostile input wrappers before reading nested values', () => {
		const hostiles: unknown[] = [
			null,
			new Proxy(value.inputs, {}),
			{ ...value.inputs, extra: true },
			{ ...value.inputs, request: [] },
			Object.assign(Object.create({ inherited: true }), value.inputs)
		];
		const sparse = structuredClone(value.inputs);
		(sparse.callGraph.nodes[0]!.sourceLocations as unknown as Array<unknown>).length = 2;
		hostiles.push(sparse);
		const cyclic = structuredClone(value.inputs);
		(cyclic.semanticSnapshot.sources as unknown as Array<unknown>).push(cyclic);
		hostiles.push(cyclic);
		const symbol = structuredClone(value.inputs) as unknown as Record<PropertyKey, unknown>;
		symbol[Symbol('hostile')] = true;
		hostiles.push(symbol);
		let getterCalls = 0;
		const accessor = structuredClone(value.inputs);
		Object.defineProperty(accessor.request, 'subjectId', {
			enumerable: true,
			get(): string {
				getterCalls += 1;
				throw new Error('must not execute');
			}
		});
		hostiles.push(accessor);
		for (const inputs of hostiles) expectIssue(composition, inputs, 'INPUT_INVALID');
		expect(getterCalls).toBe(0);
	});

	it('enforces request constants and every meaningful operation budget', () => {
		for (const inputs of [
			withBudget('maxDiagnostics', 0),
			withBudget('maxDiagnostics', 100_001),
			withBudget('maxLinks', -0),
			withBudget('maxConflictRecords', 1),
			withBudget('maxUnmatchedRecords', 1),
			{
				...value.inputs,
				request: { ...value.request, schemaVersion: 'stale' }
			},
			{
				...value.inputs,
				request: { ...value.request, operationVersion: 'stale' }
			},
			{
				...value.inputs,
				request: {
					...value.request,
					selection: { ...value.request.selection, relation: 'stale' }
				}
			}
		])
			expectIssue(composition, inputs, 'INPUT_INVALID');

		const inputRecords =
			value.moduleDependencyGraph.nodes.length +
			value.moduleDependencyGraph.edges.length +
			value.callGraph.nodes.length +
			value.callGraph.edges.length;
		const eligibleSources = value.snapshot.sources.length * 2;
		const outputRecords =
			1 +
			2 +
			value.moduleDependencyGraph.limitations.length +
			value.callGraph.limitations.length +
			value.snapshot.sources.length;
		for (const [key, exact] of [
			['maxModuleDependencyNodes', value.moduleDependencyGraph.nodes.length],
			['maxModuleDependencyEdges', value.moduleDependencyGraph.edges.length],
			['maxCallNodes', value.callGraph.nodes.length],
			['maxCallEdges', value.callGraph.edges.length],
			['maxEligibleSourceNodes', eligibleSources],
			['maxTraversalSteps', inputRecords + eligibleSources],
			['maxLinks', value.snapshot.sources.length],
			['maxOutputRecords', outputRecords]
		] as const) {
			const exactInputs = withBudget(key, exact);
			const exactOutcome = buildLogicalGraphComposition(exactInputs);
			expect(exactOutcome.outcome).toBe('partial');
			if (exactOutcome.outcome !== 'partial') throw new Error(`Exact ${key} budget failed.`);
			expect(validateLogicalGraphComposition(exactOutcome.composition, exactInputs)).toEqual({
				issues: [],
				state: 'VALID'
			});
			expectIssue(composition, withBudget(key, exact - 1), 'BUDGET_EXHAUSTED');
		}
	});

	it('rejects empty request identities and incorrect fixed layer roles', () => {
		expectIssue(
			composition,
			{ ...value.inputs, request: { ...value.request, subjectId: '' } },
			'INPUT_INVALID'
		);
		expectIssue(
			composition,
			{
				...value.inputs,
				request: {
					...value.request,
					sourceLayers: [
						{ ...value.request.sourceLayers[0], role: 'CALL' },
						value.request.sourceLayers[1]
					]
				}
			},
			'INPUT_INVALID'
		);
	});

	it('rejects missing layer populations, stale bindings, and invalid predecessors', () => {
		for (const inputs of [
			{ ...value.inputs, moduleDependencyGraph: { ...value.moduleDependencyGraph, nodes: null } },
			{ ...value.inputs, callGraph: { ...value.callGraph, edges: null } },
			{ ...value.inputs, moduleDependencyGraph: { ...value.moduleDependencyGraph, layers: [] } },
			{ ...value.inputs, callGraph: { ...value.callGraph, layers: [] } }
		])
			expectIssue(composition, inputs, 'INPUT_INVALID');
		expectIssue(
			composition,
			{ ...value.inputs, request: { ...value.request, subjectId: 'stale-subject' } },
			'INPUT_INVALID'
		);
		expectIssue(
			composition,
			{
				...value.inputs,
				request: {
					...value.request,
					sourceLayers: [
						{ ...value.request.sourceLayers[0], contentDigest: 'f'.repeat(64) },
						value.request.sourceLayers[1]
					]
				}
			},
			'INPUT_INVALID'
		);
		const invalidModule = { ...value.moduleDependencyGraph, contentDigest: 'f'.repeat(64) };
		expectIssue(
			composition,
			{
				...value.inputs,
				moduleDependencyGraph: invalidModule,
				request: {
					...value.request,
					sourceLayers: [
						{ ...value.request.sourceLayers[0], contentDigest: invalidModule.contentDigest },
						value.request.sourceLayers[1]
					]
				}
			},
			'INPUT_INVALID'
		);
		const invalidCall = { ...value.callGraph, contentDigest: 'f'.repeat(64) };
		expectIssue(
			composition,
			{
				...value.inputs,
				callGraph: invalidCall,
				request: {
					...value.request,
					sourceLayers: [
						value.request.sourceLayers[0],
						{ ...value.request.sourceLayers[1], contentDigest: invalidCall.contentDigest }
					]
				}
			},
			'INPUT_INVALID'
		);
	});

	it('independently rejects redigested identity and all output-population corruption', () => {
		expectIssue(
			redigested((draft) => {
				(draft as { inputDigest: string }).inputDigest = 'f'.repeat(64);
			}),
			value.inputs,
			'IDENTITY_MISMATCH'
		);
		expectIssue(
			redigested((draft) => {
				(draft as { id: string }).id = `logical-graph-composition-${'f'.repeat(64)}`;
			}),
			value.inputs,
			'IDENTITY_MISMATCH'
		);
		const mutators: Array<(draft: LogicalGraphCompositionSnapshot) => void> = [
			(draft) =>
				((draft as { closure: string }).closure =
					'CLOSED_WITHIN_SELECTED_CONTRIBUTING_LAYER_METHODS'),
			(draft) => ((draft as { health: string }).health = 'COMPLETE'),
			(draft) => ((draft.budgets as { maxLinks: number }).maxLinks += 1),
			(draft) => ((draft.coverage as { crossLinks: number }).crossLinks -= 1),
			(draft) => ((draft.crossLinks[0] as { ordinal: number }).ordinal = 1),
			(draft) =>
				((draft.crossLinks[0]!.sourceIdentity as { logicalPath: string }).logicalPath = 'stale.ts'),
			(draft) => (draft.crossLinks as unknown as unknown[]).reverse(),
			(draft) => (draft.layers as unknown as unknown[]).reverse(),
			(draft) => (draft.layers[0].sourceNodeIds as unknown as string[]).splice(0, 1),
			(draft) => (draft.layers[1].sourceEdgeIds as unknown as string[]).splice(0, 1),
			(draft) => ((draft.layers[0].sourceGraph as { graphId: string }).graphId = 'stale'),
			(draft) => ((draft.layers[1].sourceCoverage as { closure: string }).closure = 'stale'),
			(draft) => (draft.layers[1].sourceLimitations as unknown as unknown[]).splice(0, 1),
			(draft) => (draft.inheritedLimitations as unknown as unknown[]).splice(0, 1),
			(draft) => (draft.sourceLayers as unknown as unknown[]).reverse(),
			(draft) => (draft.nonclaims as unknown as string[]).splice(0, 1),
			(draft) => ((draft.truncation as { state: string }).state = 'TRUNCATED'),
			(draft) => (draft.conflicts as unknown as unknown[]).push({ id: 'conflict' }),
			(draft) => (draft.unmatchedSources as unknown as unknown[]).push({ id: 'unmatched' })
		];
		for (const mutate of mutators)
			expectIssue(redigested(mutate), value.inputs, 'POPULATION_MISMATCH');

		const staleDigest = structuredClone(composition) as LogicalGraphCompositionSnapshot;
		(staleDigest as { contentDigest: string }).contentDigest = '0'.repeat(64);
		expectIssue(staleDigest, value.inputs, 'CONTENT_DIGEST_MISMATCH');
	});

	it('keeps hostile telemetry options out of the evidence path', () => {
		let getterCalls = 0;
		const accessor = {};
		Object.defineProperty(accessor, 'onProgress', {
			enumerable: true,
			get(): () => void {
				getterCalls += 1;
				return () => undefined;
			}
		});
		const symbol = { onProgress: () => undefined } as Record<PropertyKey, unknown>;
		symbol[Symbol('hostile')] = true;
		for (const options of [null, {}, { extra: true }, new Proxy({}, {}), accessor, symbol])
			expect(
				buildLogicalGraphComposition(
					value.inputs,
					options as unknown as BuildLogicalGraphCompositionOptions
				).outcome
			).toBe('partial');
		expect(getterCalls).toBe(0);
	});
});
