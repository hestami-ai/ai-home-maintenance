import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	type BuildProjectContextGraphOptions,
	type ProjectContextGraphBuildInputs,
	type ProjectContextGraphDiagnosticCode,
	type ProjectContextGraphSnapshot,
	type ProjectContextGraphValidationIssueCode,
	type ProjectContextGraphValidationOptions
} from '../contracts/project-context-graph.js';
import { isUnicodeScalarString } from '../semantic/canonical.js';
import { buildProjectContextGraph } from './build-project-context-graph.js';
import {
	createProjectContextGraphFixture,
	projectContextGraphInputs,
	type ProjectContextGraphFixture
} from './project-context-graph-fixture.test-support.js';
import {
	projectContextGraphContentDigest,
	projectContextGraphId,
	projectContextGraphInputDigest,
	projectContextMembershipId,
	projectContextProgramId,
	projectContextProjectId,
	projectContextReferenceId,
	projectContextSourceId
} from './project-context-graph-canonical.js';
import {
	validateConstructedProjectContextGraph,
	validateProjectContextGraph
} from './validate-project-context-graph.js';

let fixture: ProjectContextGraphFixture;
let inputs: ProjectContextGraphBuildInputs;
let graph: ProjectContextGraphSnapshot;

beforeAll(() => {
	fixture = createProjectContextGraphFixture();
	inputs = projectContextGraphInputs(fixture);
	const outcome = buildProjectContextGraph(inputs);
	if (outcome.outcome !== 'partial')
		throw new Error(`Project-context fixture construction failed: ${JSON.stringify(outcome)}`);
	graph = outcome.graph;
});

afterAll(() => fixture.cleanup());

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
			if (!isUnicodeScalarString(frame.value))
				throw new Error('Fixture text is not scalar Unicode.');
			stringCharacters += frame.value.length;
			continue;
		}
		if (frame.value === null || typeof frame.value === 'boolean' || typeof frame.value === 'number')
			continue;
		if (typeof frame.value !== 'object' || active.has(frame.value))
			throw new Error('Expected an acyclic plain-data fixture.');
		active.add(frame.value);
		pending.push({ state: 'LEAVE', value: frame.value });
		const children: unknown[] = [];
		for (const key of Reflect.ownKeys(frame.value)) {
			if (Array.isArray(frame.value) && key === 'length') continue;
			if (typeof key !== 'string' || !isUnicodeScalarString(key))
				throw new Error('Fixture key is not scalar Unicode text.');
			stringCharacters += key.length;
			const descriptor = Reflect.getOwnPropertyDescriptor(frame.value, key);
			if (descriptor === undefined || !('value' in descriptor))
				throw new Error('Expected fixture data properties.');
			children.push(descriptor.value);
		}
		for (let index = children.length - 1; index >= 0; index -= 1)
			pending.push({ depth: frame.depth + 1, state: 'VISIT', value: children[index] });
	}
	return { depth, records, stringCharacters };
}

function expectValidationIssue(
	candidate: unknown,
	inputValue: unknown,
	code: ProjectContextGraphValidationIssueCode,
	options?: ProjectContextGraphValidationOptions
): void {
	const result = validateProjectContextGraph(
		candidate,
		inputValue as ProjectContextGraphBuildInputs,
		options
	);
	expect(result).toMatchObject({
		issues: expect.arrayContaining([expect.objectContaining({ code })]),
		state: code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INVALID'
	});
}

function expectBuildIssue(value: unknown, code: ProjectContextGraphDiagnosticCode): void {
	expect(buildProjectContextGraph(value)).toMatchObject({
		diagnostics: [expect.objectContaining({ code })],
		outcome: 'unavailable'
	});
}

function withBudget(
	base: ProjectContextGraphBuildInputs,
	key: keyof ProjectContextGraphBuildInputs['request']['budgets'],
	maximum: number
): ProjectContextGraphBuildInputs {
	return {
		...base,
		request: {
			...base.request,
			budgets: { ...base.request.budgets, [key]: maximum }
		}
	};
}

function redigested(
	mutate: (draft: ProjectContextGraphSnapshot) => void
): ProjectContextGraphSnapshot {
	const draft = structuredClone(graph) as ProjectContextGraphSnapshot;
	mutate(draft);
	(draft as { contentDigest: string }).contentDigest = projectContextGraphContentDigest(draft);
	return draft;
}

describe('project-context graph public boundary coverage', () => {
	it('derives every canonical identity domain independently and deterministically', () => {
		const inputDigest = projectContextGraphInputDigest(inputs);
		const graphId = projectContextGraphId(inputDigest);
		const semanticProjectId = inputs.semanticSnapshot.projects[0]!.id;
		const semanticProgramId = inputs.semanticSnapshot.programs[0]!.id;
		const semanticSourceId = inputs.semanticSnapshot.sources[0]!.id;
		const projectId = projectContextProjectId(graphId, semanticProjectId);
		const programId = projectContextProgramId(graphId, semanticProgramId);
		const sourceId = projectContextSourceId(graphId, semanticSourceId);
		expect(graphId).toBe(graph.id);
		expect(projectId).not.toBe(projectContextProjectId(graphId, `${semanticProjectId}-other`));
		expect(programId).not.toBe(projectContextProgramId(graphId, `${semanticProgramId}-other`));
		expect(sourceId).not.toBe(projectContextSourceId(graphId, `${semanticSourceId}-other`));
		expect(
			projectContextMembershipId(graphId, 'PROJECT_HAS_PROGRAM', projectId, programId)
		).not.toBe(projectContextMembershipId(graphId, 'PROGRAM_HAS_SOURCE', programId, sourceId));
		expect(projectContextReferenceId(graphId, projectId, 'a/tsconfig.json')).not.toBe(
			projectContextReferenceId(graphId, projectId, 'b/tsconfig.json')
		);
		expect(projectContextGraphContentDigest(graph)).toBe(graph.contentDigest);
	});

	it('enforces public signatures, constructed digest binding, and closed options', () => {
		const publicCall = validateProjectContextGraph as unknown as (...args: unknown[]) => unknown;
		const constructedCall = validateConstructedProjectContextGraph as unknown as (
			...args: unknown[]
		) => unknown;
		expect(publicCall()).toMatchObject({ state: 'INVALID' });
		expect(publicCall(graph, inputs, undefined, 'extra')).toMatchObject({ state: 'INVALID' });
		expect(constructedCall(graph, inputs)).toMatchObject({ state: 'INVALID' });
		expect(constructedCall(graph, inputs, graph.inputDigest, undefined, 'extra')).toMatchObject({
			state: 'INVALID'
		});
		expect(constructedCall(graph, inputs, 1)).toMatchObject({ state: 'INVALID' });
		expect(validateConstructedProjectContextGraph(graph, inputs, 'bad')).toMatchObject({
			state: 'INVALID'
		});
		expect(validateConstructedProjectContextGraph(graph, inputs, 'f'.repeat(64))).toMatchObject({
			issues: [expect.objectContaining({ code: 'INPUT_INVALID' })],
			state: 'INVALID'
		});
		expect(
			validateConstructedProjectContextGraph(graph, inputs, graph.inputDigest, { maxIssues: 1 })
		).toEqual({ issues: [], state: 'VALID' });

		const optionSymbol = { maxIssues: 1 } as Record<PropertyKey, unknown>;
		optionSymbol[Symbol('hostile')] = true;
		const optionAccessor = {};
		Object.defineProperty(optionAccessor, 'maxIssues', {
			enumerable: true,
			get: () => 1
		});
		for (const options of [
			null,
			new Proxy({ maxIssues: 1 }, {}),
			Object.create({ maxIssues: 1 }),
			{ extra: 1 },
			{ maxDepth: 0 },
			{ maxInputRecords: -0 },
			{ maxIssues: 100_001 },
			{ maxRecords: Number.MAX_SAFE_INTEGER + 1 },
			optionSymbol,
			optionAccessor
		])
			expectValidationIssue(graph, inputs, 'SHAPE_INVALID', options as never);
	});

	it('honors exact descriptor limits and rejects every one-below public boundary', () => {
		const inputUsage = usage(inputs);
		const exactInputs = withBudget(
			withBudget(inputs, 'maxInputRecords', inputUsage.records),
			'maxInputStringCharacters',
			inputUsage.stringCharacters
		);
		const exactOutcome = buildProjectContextGraph(exactInputs);
		if (exactOutcome.outcome !== 'partial')
			throw new Error(`Exact-limit build failed: ${JSON.stringify(exactOutcome)}`);
		const exactGraph = exactOutcome.graph;
		const candidateUsage = usage(exactGraph);
		expect(
			validateProjectContextGraph(exactGraph, exactInputs, {
				maxDepth: Math.max(candidateUsage.depth, inputUsage.depth),
				maxInputRecords: inputUsage.records,
				maxInputStringCharacters: inputUsage.stringCharacters,
				maxIssues: 1,
				maxRecords: candidateUsage.records,
				maxStringCharacters: candidateUsage.stringCharacters
			})
		).toEqual({ issues: [], state: 'VALID' });
		for (const options of [
			{ maxDepth: Math.max(candidateUsage.depth, inputUsage.depth) - 1 },
			{ maxInputRecords: inputUsage.records - 1 },
			{ maxInputStringCharacters: inputUsage.stringCharacters - 1 },
			{ maxRecords: candidateUsage.records - 1 },
			{ maxStringCharacters: candidateUsage.stringCharacters - 1 }
		])
			expectValidationIssue(exactGraph, exactInputs, 'BUDGET_EXHAUSTED', options);

		expectValidationIssue([1, 2], inputs, 'BUDGET_EXHAUSTED', { maxRecords: 1 });
		expectValidationIssue({ a: 1, b: 2 }, inputs, 'BUDGET_EXHAUSTED', { maxRecords: 1 });
		expectValidationIssue({ nested: { nested: {} } }, inputs, 'BUDGET_EXHAUSTED', {
			maxDepth: 1
		});
		expectValidationIssue({ long: 'xxxxxxxx' }, inputs, 'BUDGET_EXHAUSTED', {
			maxStringCharacters: 4
		});
		expectValidationIssue({ ['x'.repeat(64)]: null }, inputs, 'BUDGET_EXHAUSTED', {
			maxStringCharacters: 4
		});
		expectValidationIssue(
			exactGraph,
			withBudget(exactInputs, 'maxInputRecords', inputUsage.records - 1),
			'BUDGET_EXHAUSTED',
			{ maxInputRecords: inputUsage.records }
		);
		expectValidationIssue(
			exactGraph,
			withBudget(exactInputs, 'maxInputStringCharacters', inputUsage.stringCharacters - 1),
			'BUDGET_EXHAUSTED',
			{ maxInputStringCharacters: inputUsage.stringCharacters }
		);
	});

	it('rejects hostile descriptor trees without executing accessors', () => {
		const cycle: Record<string, unknown> = {};
		cycle.self = cycle;
		const symbolRecord = { value: 1 } as Record<PropertyKey, unknown>;
		symbolRecord[Symbol('hostile')] = true;
		const sparse: unknown[] = [];
		sparse.length = 2;
		sparse[1] = true;
		const expando = [true] as unknown[] & { extra?: boolean };
		expando.extra = true;
		const noncanonicalIndex = [] as unknown as unknown[] & Record<string, unknown>;
		noncanonicalIndex.length = 1;
		noncanonicalIndex['01'] = true;
		const exotic = Object.create({ inherited: true }) as Record<string, unknown>;
		exotic.value = true;
		const nonenumerable = {};
		Object.defineProperty(nonenumerable, 'value', { enumerable: false, value: true });
		let getterCalls = 0;
		const accessor = {};
		Object.defineProperty(accessor, 'value', {
			enumerable: true,
			get() {
				getterCalls += 1;
				return true;
			}
		});
		for (const candidate of [
			undefined,
			() => undefined,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			-0,
			Number.MAX_SAFE_INTEGER + 1,
			'\ud800',
			new Proxy({}, {}),
			cycle,
			symbolRecord,
			sparse,
			expando,
			noncanonicalIndex,
			exotic,
			nonenumerable,
			accessor,
			{ ['\ud800']: true }
		])
			expectValidationIssue(candidate, inputs, 'SHAPE_INVALID');
		expect(getterCalls).toBe(0);
		expectValidationIssue({}, inputs, 'SHAPE_INVALID');
		expectValidationIssue(graph, null, 'INPUT_INVALID');
		expectValidationIssue(graph, { ...inputs, request: null }, 'INPUT_INVALID');
		const inputCycle = { ...inputs, extra: null } as Record<string, unknown>;
		inputCycle.extra = inputCycle;
		expectValidationIssue(graph, inputCycle, 'INPUT_INVALID');
	});

	it('rejects hostile builder shells while isolating all telemetry observers', async () => {
		const cycle: Record<string, unknown> = {};
		cycle.self = cycle;
		const symbolInputs = { ...inputs } as Record<PropertyKey, unknown>;
		symbolInputs[Symbol('hostile')] = true;
		const exotic = Object.assign(Object.create({ inherited: true }), inputs);
		const nestedExoticSnapshot = Object.assign(
			Object.create({ inherited: true }),
			inputs.semanticSnapshot
		);
		const nestedSymbolSnapshot = { ...inputs.semanticSnapshot } as Record<PropertyKey, unknown>;
		nestedSymbolSnapshot[Symbol('hostile')] = true;
		for (const value of [
			null,
			[],
			exotic,
			new Proxy(inputs, {}),
			{ ...inputs, extra: true },
			{ ...inputs, request: null },
			{ ...inputs, semanticSnapshot: cycle },
			{ ...inputs, semanticSnapshot: nestedExoticSnapshot },
			{ ...inputs, semanticSnapshot: nestedSymbolSnapshot },
			{ ...inputs, semanticSnapshot: { ...inputs.semanticSnapshot, bad: '\ud800' } },
			{ ...inputs, semanticSnapshot: { ...inputs.semanticSnapshot, ['\ud800']: true } },
			{ ...inputs, semanticSnapshot: { ...inputs.semanticSnapshot, bad: Number.NaN } },
			symbolInputs
		])
			expectBuildIssue(value, 'REQUEST_INVALID');

		const sparseSources = [...inputs.semanticSnapshot.sources] as unknown[];
		delete sparseSources[0];
		expectBuildIssue(
			{ ...inputs, semanticSnapshot: { ...inputs.semanticSnapshot, sources: sparseSources } },
			'REQUEST_INVALID'
		);
		const expandoSources = [...inputs.semanticSnapshot.sources] as unknown[] & { extra?: boolean };
		expandoSources.extra = true;
		expectBuildIssue(
			{ ...inputs, semanticSnapshot: { ...inputs.semanticSnapshot, sources: expandoSources } },
			'REQUEST_INVALID'
		);
		const symbolSources = [...inputs.semanticSnapshot.sources] as unknown[] &
			Record<PropertyKey, unknown>;
		symbolSources[Symbol('hostile')] = true;
		expectBuildIssue(
			{ ...inputs, semanticSnapshot: { ...inputs.semanticSnapshot, sources: symbolSources } },
			'REQUEST_INVALID'
		);
		const exoticSources = [...inputs.semanticSnapshot.sources];
		Reflect.setPrototypeOf(exoticSources, null);
		expectBuildIssue(
			{ ...inputs, semanticSnapshot: { ...inputs.semanticSnapshot, sources: exoticSources } },
			'REQUEST_INVALID'
		);
		const accessorSources = [...inputs.semanticSnapshot.sources];
		let sourceGetterCalls = 0;
		Object.defineProperty(accessorSources, '0', {
			enumerable: true,
			get() {
				sourceGetterCalls += 1;
				return inputs.semanticSnapshot.sources[0];
			}
		});
		expectBuildIssue(
			{ ...inputs, semanticSnapshot: { ...inputs.semanticSnapshot, sources: accessorSources } },
			'REQUEST_INVALID'
		);
		expect(sourceGetterCalls).toBe(0);
		const unicodeKeySources = [...inputs.semanticSnapshot.sources] as unknown[] &
			Record<string, unknown>;
		unicodeKeySources['\ud800'] = true;
		expectBuildIssue(
			{ ...inputs, semanticSnapshot: { ...inputs.semanticSnapshot, sources: unicodeKeySources } },
			'REQUEST_INVALID'
		);
		const longKeySources = [...inputs.semanticSnapshot.sources] as unknown[] &
			Record<string, unknown>;
		longKeySources['x'.repeat(10_000)] = true;
		const baselineStrings = usage(inputs).stringCharacters;
		expectBuildIssue(
			{
				...withBudget(inputs, 'maxInputStringCharacters', baselineStrings + 1),
				semanticSnapshot: { ...inputs.semanticSnapshot, sources: longKeySources }
			},
			'BUDGET_EXCEEDED'
		);
		const oversizedSources = Array.from({ length: 10_000 }, () => null);
		expectBuildIssue(
			{
				...withBudget(inputs, 'maxInputRecords', 1_000),
				semanticSnapshot: { ...inputs.semanticSnapshot, sources: oversizedSources }
			},
			'BUDGET_EXCEEDED'
		);
		const oversizedSnapshot = { ...inputs.semanticSnapshot } as Record<string, unknown>;
		for (let index = 0; index < 1_000; index += 1) oversizedSnapshot[`extra${index}`] = null;
		expectBuildIssue(
			{
				...withBudget(inputs, 'maxInputRecords', 500),
				semanticSnapshot: oversizedSnapshot as never
			},
			'BUDGET_EXCEEDED'
		);

		let optionGetterCalls = 0;
		const optionAccessor = {};
		Object.defineProperty(optionAccessor, 'onProgress', {
			enumerable: true,
			get() {
				optionGetterCalls += 1;
				return () => undefined;
			}
		});
		for (const options of [
			null,
			new Proxy({ onProgress: () => undefined }, {}),
			{ extra: true },
			optionAccessor
		])
			expect(
				buildProjectContextGraph(inputs, options as BuildProjectContextGraphOptions).outcome
			).toBe('partial');
		expect(optionGetterCalls).toBe(0);
		const outcome = buildProjectContextGraph(inputs, {
			onProgress() {
				throw new Error('observer failure');
			}
		});
		expect(outcome.outcome).toBe('partial');
		await Promise.resolve();

		const failedEvents: unknown[] = [];
		expectBuildIssue(
			{ ...inputs, request: { ...inputs.request, subjectId: 'stale' } },
			'INPUT_IDENTITY_MISMATCH'
		);
		const unavailable = buildProjectContextGraph(
			{ ...inputs, request: { ...inputs.request, subjectId: 'stale' } },
			{ onProgress: (event) => failedEvents.push(event) }
		);
		expect(unavailable.outcome).toBe('unavailable');
		await Promise.resolve();
		expect(failedEvents).toEqual([
			expect.objectContaining({
				detailCode: null,
				phase: 'REQUEST_BIND',
				state: 'STARTED'
			}),
			expect.objectContaining({
				detailCode: 'INPUT_IDENTITY_MISMATCH',
				phase: 'REQUEST_BIND',
				state: 'FAILED'
			})
		]);
	});

	it('closes builder and validator request, identity, and population boundaries', () => {
		const invalidRequests: unknown[] = [
			{ ...inputs, request: { ...inputs.request, extra: true } },
			{ ...inputs, request: { ...inputs.request, subjectId: '' } },
			{ ...inputs, request: { ...inputs.request, semanticSnapshotId: '' } },
			{ ...inputs, request: { ...inputs.request, schemaVersion: 'stale' } },
			{ ...inputs, request: { ...inputs.request, operationVersion: 'stale' } },
			withBudget(inputs, 'maxDiagnostics', 100_001),
			withBudget(inputs, 'maxInputRecords', 0),
			withBudget(inputs, 'maxInputStringCharacters', 0),
			withBudget(inputs, 'maxProjects', 0),
			withBudget(inputs, 'maxSources', -0),
			{
				...inputs,
				request: {
					...inputs.request,
					selection: { ...inputs.request.selection, variantPolicy: 'INFER_VARIANTS' }
				}
			}
		];
		for (const value of invalidRequests) {
			expectBuildIssue(value, 'REQUEST_INVALID');
			expectValidationIssue(graph, value, 'INPUT_INVALID');
		}

		const unattached = { ...inputs, frozenSubject: structuredClone(inputs.frozenSubject) };
		expectBuildIssue(unattached, 'REQUEST_INVALID');
		expectValidationIssue(graph, unattached, 'INPUT_INVALID');
		const stale = { ...inputs, request: { ...inputs.request, subjectId: 'stale' } };
		expectBuildIssue(stale, 'INPUT_IDENTITY_MISMATCH');
		expectValidationIssue(graph, stale, 'INPUT_INVALID');

		const noProjects = {
			...inputs,
			semanticSnapshot: { ...inputs.semanticSnapshot, projects: 'invalid' as never }
		};
		expectValidationIssue(graph, noProjects, 'INPUT_INVALID');
		const malformedIdentity = {
			...inputs,
			semanticSnapshot: { ...inputs.semanticSnapshot, id: 1 as never }
		};
		expectValidationIssue(graph, malformedIdentity, 'INPUT_INVALID');
		const invalidReferences = structuredClone(inputs.semanticSnapshot);
		(invalidReferences.projects[0] as unknown as { projectReferences: unknown }).projectReferences =
			'invalid';
		expectValidationIssue(
			graph,
			{ ...inputs, semanticSnapshot: invalidReferences },
			'INPUT_INVALID'
		);

		for (const key of [
			'maxConfigurationClosureRecords',
			'maxMemberships',
			'maxOutputRecords',
			'maxPrograms',
			'maxProjectReferences',
			'maxProjects',
			'maxSources',
			'maxTraversalSteps'
		] as const)
			expectValidationIssue(
				graph,
				withBudget(inputs, key, inputs.request.budgets[key] - 1),
				'BUDGET_EXHAUSTED'
			);

		const invalidSnapshot = structuredClone(inputs.semanticSnapshot);
		const invalidProject = invalidSnapshot.projects[0] as unknown as {
			programRecipe: { compilerOptions: Record<string, unknown> };
		};
		invalidProject.programRecipe.compilerOptions = {
			...invalidProject.programRecipe.compilerOptions,
			strict: false
		};
		expectValidationIssue(graph, { ...inputs, semanticSnapshot: invalidSnapshot }, 'INPUT_INVALID');
	});

	it('distinguishes content corruption from redigested population corruption', () => {
		const badDigest = { ...graph, contentDigest: '0'.repeat(64) };
		expectValidationIssue(badDigest, inputs, 'CONTENT_DIGEST_MISMATCH');
		expectValidationIssue(
			redigested((draft) => {
				(draft.coverage as { projectedProjects: number }).projectedProjects += 1;
			}),
			inputs,
			'POPULATION_MISMATCH'
		);
		expectValidationIssue(
			redigested((draft) => {
				(draft as unknown as { currentness: string }).currentness = 'x'.repeat(70_000);
			}),
			inputs,
			'POPULATION_MISMATCH'
		);
	});
});
