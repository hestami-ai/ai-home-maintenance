import { isProxy } from 'node:util/types';

import {
	STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER,
	STRUCTURAL_SCC_ANALYSIS_CANONICAL_PROFILE,
	STRUCTURAL_SCC_ANALYSIS_CAPABILITY,
	STRUCTURAL_SCC_ANALYSIS_CAPABILITY_STATUS,
	STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT,
	STRUCTURAL_SCC_ANALYSIS_METHOD,
	STRUCTURAL_SCC_ANALYSIS_NONCLAIMS,
	STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION,
	STRUCTURAL_SCC_ANALYSIS_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_SCC_ANALYSIS_SCHEMA_VERSION,
	STRUCTURAL_SCC_ANALYSIS_SELECTION,
	type StructuralSccAnalysisInputs,
	type StructuralSccAnalysisSnapshot,
	type StructuralSccComponent,
	type StructuralSccComponentIndexEntry,
	type StructuralSccValidationIssue,
	type StructuralSccValidationOptions,
	type StructuralSccValidationResult
} from '../contracts/structural-scc-analysis.js';
import { compareText } from '../inventory/canonical.js';
import { canonicalSemanticJson, isUnicodeScalarString } from '../semantic/canonical.js';
import {
	structuralSccAnalysisContentDigest,
	structuralSccAnalysisId,
	structuralSccAnalysisInputDigest,
	structuralSccComponentId,
	structuralSccLayerId
} from './structural-scc-analysis-canonical.js';
import { validateModuleDependencyGraph } from './validate-graph.js';

interface ClosedOptions {
	readonly maxDepth: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
	readonly maxIssues: number;
	readonly maxRecords: number;
	readonly maxStringCharacters: number;
}

const DEFAULT_OPTIONS: ClosedOptions = {
	maxDepth: 64,
	maxInputRecords: 2_000_000,
	maxInputStringCharacters: 20_000_000,
	maxIssues: 100,
	maxRecords: 1_000_000,
	maxStringCharacters: 10_000_000
};

const SNAPSHOT_KEYS = [
	'authorityTransfer',
	'budgets',
	'canonicalProfile',
	'capability',
	'capabilityStatus',
	'componentIndex',
	'components',
	'contentDigest',
	'coverage',
	'fullJanCsaa007Conformance',
	'fullJanCsaa008Conformance',
	'gateEffect',
	'graphAuthority',
	'health',
	'id',
	'inputDigest',
	'layers',
	'method',
	'nonclaims',
	'operationVersion',
	'schemaVersion',
	'selection',
	'semanticSnapshotId',
	'sourceGraph',
	'structuralClosure',
	'subjectId',
	'upstreamClosure'
] as const;

const CONSUMED_SEMANTIC_KEYS = [
	'astNodes',
	'capabilities',
	'expectedEmpty',
	'extractionVersion',
	'health',
	'id',
	'moduleResolutions',
	'provenances',
	'provider',
	'schemaVersion',
	'sources',
	'subjectId'
] as const;

function plainRecord(value: unknown): value is Record<string, unknown> {
	return (
		value !== null &&
		typeof value === 'object' &&
		!isProxy(value) &&
		Object.getPrototypeOf(value) === Object.prototype
	);
}

function safePositive(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
	const keys = Reflect.ownKeys(value);
	return (
		keys.length === expected.length &&
		keys.every((key) => typeof key === 'string' && expected.includes(key)) &&
		keys.every((key) => {
			const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
			return descriptor !== undefined && 'value' in descriptor && descriptor.enumerable;
		})
	);
}

function options(value: StructuralSccValidationOptions | undefined): ClosedOptions | null {
	if (value === undefined) return DEFAULT_OPTIONS;
	if (!plainRecord(value)) return null;
	const allowed = new Set([
		'maxDepth',
		'maxInputRecords',
		'maxInputStringCharacters',
		'maxIssues',
		'maxRecords',
		'maxStringCharacters'
	]);
	if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.has(key)))
		return null;
	for (const key of allowed) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor !== undefined && (!('value' in descriptor) || !safePositive(descriptor.value)))
			return null;
	}
	return {
		maxDepth: value.maxDepth ?? DEFAULT_OPTIONS.maxDepth,
		maxInputRecords: value.maxInputRecords ?? DEFAULT_OPTIONS.maxInputRecords,
		maxInputStringCharacters:
			value.maxInputStringCharacters ?? DEFAULT_OPTIONS.maxInputStringCharacters,
		maxIssues: value.maxIssues ?? DEFAULT_OPTIONS.maxIssues,
		maxRecords: value.maxRecords ?? DEFAULT_OPTIONS.maxRecords,
		maxStringCharacters: value.maxStringCharacters ?? DEFAULT_OPTIONS.maxStringCharacters
	} as ClosedOptions;
}

function inputShellIssue(
	value: unknown,
	limits: ClosedOptions
): StructuralSccValidationIssue | null {
	if (!plainRecord(value)) return issue('INPUT_INVALID', 'The input shell is invalid.', '$inputs');
	const keys = Reflect.ownKeys(value);
	const expected = new Set(['graph', 'request', 'semanticSnapshot']);
	if (
		keys.length !== expected.size ||
		keys.some((key) => typeof key !== 'string' || !expected.has(key))
	)
		return issue('INPUT_INVALID', 'The input shell must be exact.', '$inputs');
	for (const key of expected) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			return issue(
				'INPUT_INVALID',
				'The input shell must contain data properties only.',
				`$inputs.${key}`
			);
	}
	const requestDescriptor = Reflect.getOwnPropertyDescriptor(value, 'request')!;
	const graphDescriptor = Reflect.getOwnPropertyDescriptor(value, 'graph')!;
	const semanticDescriptor = Reflect.getOwnPropertyDescriptor(value, 'semanticSnapshot')!;
	if (!plainRecord(graphDescriptor.value) || !plainRecord(semanticDescriptor.value))
		return issue('INPUT_INVALID', 'The predecessor shells are invalid.', '$inputs');
	const semanticProjection: Record<string, unknown> = {};
	for (const key of CONSUMED_SEMANTIC_KEYS) {
		const descriptor = Reflect.getOwnPropertyDescriptor(semanticDescriptor.value, key);
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			return issue(
				'INPUT_INVALID',
				'The consumed semantic projection must contain enumerable data properties.',
				`$inputs.semanticSnapshot.${key}`
			);
		semanticProjection[key] = descriptor.value;
	}
	const inputTreeIssue = plainTreeIssue(
		{
			graph: graphDescriptor.value,
			request: requestDescriptor.value,
			semanticSnapshot: semanticProjection
		},
		{
			...limits,
			maxRecords: limits.maxInputRecords,
			maxStringCharacters: limits.maxInputStringCharacters
		},
		true
	);
	if (inputTreeIssue !== null)
		return {
			...inputTreeIssue,
			code: inputTreeIssue.code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID',
			path: inputTreeIssue.path.replace('$', '$inputs')
		};
	return null;
}

function issue(
	code: StructuralSccValidationIssue['code'],
	message: string,
	path = '$'
): StructuralSccValidationIssue {
	return { code, message, path };
}

interface TreeVisit {
	readonly depth: number;
	readonly kind: 'VISIT';
	readonly path: string;
	readonly value: unknown;
}

type TreePending = TreeVisit | { readonly kind: 'LEAVE'; readonly value: object };

interface TreeWalk {
	readonly active: WeakSet<object>;
	characters: number;
	readonly pending: TreePending[];
	records: number;
	readonly seen: WeakSet<object>;
}

function isAcceptedTreeScalar(value: unknown): boolean {
	if (typeof value === 'boolean') return true;
	return typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0);
}

function treeStringIssue(
	value: string,
	path: string,
	limits: ClosedOptions,
	walk: TreeWalk
): StructuralSccValidationIssue | null {
	if (!isUnicodeScalarString(value))
		return issue('SHAPE_INVALID', 'Strings must contain Unicode scalar text.', path);
	walk.characters += value.length;
	if (walk.characters > limits.maxStringCharacters)
		return issue('BUDGET_EXHAUSTED', 'The string-character budget was exhausted.', path);
	return null;
}

function treeAliasIssue(
	target: object,
	path: string,
	allowSharedAliases: boolean,
	walk: TreeWalk
): StructuralSccValidationIssue | null {
	if (isProxy(target)) return issue('SHAPE_INVALID', 'Proxy values are not accepted.', path);
	if (walk.active.has(target)) return issue('SHAPE_INVALID', 'Cycles are not accepted.', path);
	if (!allowSharedAliases && walk.seen.has(target))
		return issue('SHAPE_INVALID', 'Shared object aliases are not accepted.', path);
	return null;
}

function treeArrayIssue(
	target: object,
	depth: number,
	path: string,
	limits: ClosedOptions,
	walk: TreeWalk
): StructuralSccValidationIssue | null {
	if (Object.getPrototypeOf(target) !== Array.prototype)
		return issue('SHAPE_INVALID', 'Arrays must use Array.prototype.', path);
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(target, 'length');
	const lengthValue =
		lengthDescriptor !== undefined && 'value' in lengthDescriptor
			? lengthDescriptor.value
			: undefined;
	if (!Number.isSafeInteger(lengthValue) || (lengthValue as number) < 0)
		return issue('SHAPE_INVALID', 'Array length is invalid.', path);
	const length = lengthValue as number;
	if (walk.records + length > limits.maxRecords)
		return issue('BUDGET_EXHAUSTED', 'The array population exceeds the record budget.', path);
	const keys = Reflect.ownKeys(target);
	if (keys.length !== length + 1 || keys.some((key) => typeof key === 'symbol'))
		return issue('SHAPE_INVALID', 'Arrays must be dense exact data arrays.', path);
	for (let index = length - 1; index >= 0; index -= 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(target, String(index));
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			return issue('SHAPE_INVALID', 'Arrays must contain enumerable data elements.', path);
		walk.pending.push({
			depth: depth + 1,
			kind: 'VISIT',
			path: `${path}[${index}]`,
			value: descriptor.value
		});
	}
	return null;
}

function treeRecordIssue(
	target: object,
	depth: number,
	path: string,
	limits: ClosedOptions,
	walk: TreeWalk
): StructuralSccValidationIssue | null {
	if (Object.getPrototypeOf(target) !== Object.prototype)
		return issue('SHAPE_INVALID', 'Records must use Object.prototype.', path);
	const keys = Reflect.ownKeys(target);
	if (keys.some((key) => typeof key !== 'string'))
		return issue('SHAPE_INVALID', 'Symbol record keys are not accepted.', path);
	if (walk.records + keys.length > limits.maxRecords)
		return issue('BUDGET_EXHAUSTED', 'The property population exceeds the record budget.', path);
	keys.reverse();
	for (const key of keys) {
		if (typeof key !== 'string')
			return issue('SHAPE_INVALID', 'Symbol record keys are not accepted.', path);
		const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			return issue('SHAPE_INVALID', 'Records must contain enumerable data properties.', path);
		walk.pending.push({
			depth: depth + 1,
			kind: 'VISIT',
			path: `${path}.${key}`,
			value: descriptor.value
		});
	}
	return null;
}

function treeVisitIssue(
	item: TreeVisit,
	limits: ClosedOptions,
	allowSharedAliases: boolean,
	walk: TreeWalk
): StructuralSccValidationIssue | null {
	if (walk.records > limits.maxRecords)
		return issue('BUDGET_EXHAUSTED', 'The record budget was exhausted.', item.path);
	if (item.depth > limits.maxDepth)
		return issue('BUDGET_EXHAUSTED', 'The validation depth budget was exhausted.', item.path);
	if (typeof item.value === 'string') return treeStringIssue(item.value, item.path, limits, walk);
	if (item.value === null || isAcceptedTreeScalar(item.value)) return null;
	if (typeof item.value !== 'object')
		return issue('SHAPE_INVALID', 'Only JSON-compatible data properties are accepted.', item.path);
	const aliasIssue = treeAliasIssue(item.value, item.path, allowSharedAliases, walk);
	if (aliasIssue !== null) return aliasIssue;
	walk.seen.add(item.value);
	walk.active.add(item.value);
	walk.pending.push({ kind: 'LEAVE', value: item.value });
	if (Array.isArray(item.value))
		return treeArrayIssue(item.value, item.depth, item.path, limits, walk);
	return treeRecordIssue(item.value, item.depth, item.path, limits, walk);
}

function plainTreeIssue(
	value: unknown,
	limits: ClosedOptions,
	allowSharedAliases = false
): StructuralSccValidationIssue | null {
	const pending: TreePending[] = [{ depth: 0, kind: 'VISIT', path: '$', value }];
	const walk: TreeWalk = {
		active: new WeakSet<object>(),
		characters: 0,
		pending,
		records: 0,
		seen: new WeakSet<object>()
	};
	while (pending.length > 0) {
		const item = pending.pop()!;
		if (item.kind === 'LEAVE') {
			walk.active.delete(item.value);
			continue;
		}
		walk.records += 1;
		const visitIssue = treeVisitIssue(item, limits, allowSharedAliases, walk);
		if (visitIssue !== null) return visitIssue;
	}
	return null;
}

function requestIssue(inputs: StructuralSccAnalysisInputs): StructuralSccValidationIssue | null {
	const request = inputs?.request;
	if (!plainRecord(request) || !plainRecord(request.budgets) || !plainRecord(request.sourceGraph))
		return issue('INPUT_INVALID', 'The request shell is invalid.', '$inputs.request');
	if (
		!exactKeys(request, [
			'budgets',
			'operationVersion',
			'schemaVersion',
			'selection',
			'semanticSnapshotId',
			'sourceGraph',
			'subjectId'
		]) ||
		!exactKeys(request.budgets, [
			'maxComponents',
			'maxDiagnostics',
			'maxEdges',
			'maxInputRecords',
			'maxInputStringCharacters',
			'maxNodes',
			'maxTraversalSteps'
		]) ||
		!exactKeys(request.sourceGraph, [
			'contentDigest',
			'graphId',
			'graphInputDigest',
			'graphKind'
		]) ||
		!plainRecord(request.selection) ||
		!exactKeys(request.selection, [
			'direction',
			'edgePopulation',
			'nodePopulation',
			'parallelEdges',
			'selfLoops'
		])
	)
		return issue(
			'INPUT_INVALID',
			'The request must contain exact data properties.',
			'$inputs.request'
		);
	const budgetValues = [
		request.budgets.maxComponents,
		request.budgets.maxEdges,
		request.budgets.maxNodes,
		request.budgets.maxTraversalSteps
	];
	if (
		budgetValues.some(
			(value) =>
				!Number.isSafeInteger(value) || (value as number) < 0 || Object.is(value as number, -0)
		) ||
		!safePositive(request.budgets.maxDiagnostics) ||
		!safePositive(request.budgets.maxInputRecords) ||
		!safePositive(request.budgets.maxInputStringCharacters) ||
		request.budgets.maxDiagnostics > 100_000 ||
		request.operationVersion !== STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION ||
		request.schemaVersion !== STRUCTURAL_SCC_ANALYSIS_REQUEST_SCHEMA_VERSION ||
		request.selection.direction !== STRUCTURAL_SCC_ANALYSIS_SELECTION.direction ||
		request.selection.edgePopulation !== STRUCTURAL_SCC_ANALYSIS_SELECTION.edgePopulation ||
		request.selection.nodePopulation !== STRUCTURAL_SCC_ANALYSIS_SELECTION.nodePopulation ||
		request.selection.parallelEdges !== STRUCTURAL_SCC_ANALYSIS_SELECTION.parallelEdges ||
		request.selection.selfLoops !== STRUCTURAL_SCC_ANALYSIS_SELECTION.selfLoops
	)
		return issue(
			'INPUT_INVALID',
			'The request constants or budgets are invalid.',
			'$inputs.request'
		);
	if (
		request.sourceGraph.graphKind !== 'TYPESCRIPT_MODULE_DEPENDENCY' ||
		inputs.graph.id !== request.sourceGraph.graphId ||
		inputs.graph.contentDigest !== request.sourceGraph.contentDigest ||
		inputs.graph.graphInputDigest !== request.sourceGraph.graphInputDigest ||
		inputs.graph.subjectId !== request.subjectId ||
		inputs.graph.semanticSnapshotId !== request.semanticSnapshotId ||
		inputs.semanticSnapshot.id !== request.semanticSnapshotId ||
		inputs.semanticSnapshot.subjectId !== request.subjectId
	)
		return issue('INPUT_INVALID', 'The request and predecessor identities differ.', '$inputs');
	if (
		!Array.isArray(inputs.graph.nodes) ||
		!Array.isArray(inputs.graph.edges) ||
		inputs.graph.nodes.length > request.budgets.maxNodes ||
		inputs.graph.edges.length > request.budgets.maxEdges ||
		inputs.graph.nodes.length + inputs.graph.edges.length > request.budgets.maxTraversalSteps
	)
		return issue('BUDGET_EXHAUSTED', 'The graph exceeds an operation budget.', '$inputs.graph');
	return null;
}

interface Projection {
	readonly edges: readonly {
		readonly id: StructuralSccAnalysisInputs['graph']['edges'][number]['id'];
		readonly source: StructuralSccAnalysisInputs['graph']['nodes'][number]['id'];
		readonly target: StructuralSccAnalysisInputs['graph']['nodes'][number]['id'];
	}[];
	readonly nodeIds: readonly StructuralSccAnalysisInputs['graph']['nodes'][number]['id'][];
}

function projection(inputs: StructuralSccAnalysisInputs): Projection {
	return {
		edges: inputs.graph.edges.map((edge) => ({
			id: edge.id,
			source: edge.source.nodeId,
			target: edge.target.nodeId
		})),
		nodeIds: inputs.graph.nodes.map((node) => node.id).sort(compareText)
	};
}

function sccVisitForward(
	root: string,
	forward: ReadonlyMap<string, string[]>,
	visited: Set<string>,
	finish: string[]
): void {
	const stack: { nodeId: string; next: number }[] = [{ nodeId: root, next: 0 }];
	visited.add(root);
	while (stack.length > 0) {
		const frame = stack.at(-1)!;
		const neighbors = forward.get(frame.nodeId)!;
		if (frame.next < neighbors.length) {
			const next = neighbors[frame.next++]!;
			if (!visited.has(next)) {
				visited.add(next);
				stack.push({ nodeId: next, next: 0 });
			}
		} else {
			finish.push(frame.nodeId);
			stack.pop();
		}
	}
}

function sccComponentFrom(
	root: string,
	reverse: ReadonlyMap<string, string[]>,
	assigned: Set<string>
): string[] {
	const component: string[] = [];
	const stack = [root];
	assigned.add(root);
	while (stack.length > 0) {
		const nodeId = stack.pop()!;
		component.push(nodeId);
		for (const next of reverse.get(nodeId)!)
			if (!assigned.has(next)) {
				assigned.add(next);
				stack.push(next);
			}
	}
	component.sort(compareText);
	return component;
}

function kosaraju(projected: Projection): readonly (readonly string[])[] {
	const forward = new Map<string, string[]>(
		projected.nodeIds.map((nodeId) => [nodeId, [] as string[]])
	);
	const reverse = new Map<string, string[]>(
		projected.nodeIds.map((nodeId) => [nodeId, [] as string[]])
	);
	for (const edge of projected.edges) {
		forward.get(edge.source)!.push(edge.target);
		reverse.get(edge.target)!.push(edge.source);
	}
	for (const values of [...forward.values(), ...reverse.values()]) values.sort(compareText);
	const visited = new Set<string>();
	const finish: string[] = [];
	for (const root of projected.nodeIds) {
		if (visited.has(root)) continue;
		sccVisitForward(root, forward, visited, finish);
	}
	const assigned = new Set<string>();
	const components: string[][] = [];
	for (let index = finish.length - 1; index >= 0; index -= 1) {
		const root = finish[index]!;
		if (assigned.has(root)) continue;
		components.push(sccComponentFrom(root, reverse, assigned));
	}
	return components.sort((left, right) => compareText(left.join('\0'), right.join('\0')));
}

function componentCycleKind(
	nodeCount: number,
	isSelfLoopSingleton: boolean
): StructuralSccComponent['cycleKind'] {
	if (nodeCount > 1) return 'MULTI_NODE';
	if (isSelfLoopSingleton) return 'SELF_LOOP_SINGLETON';
	return 'ACYCLIC_SINGLETON';
}

function expectedAnalysis(
	inputs: StructuralSccAnalysisInputs
): StructuralSccAnalysisSnapshot | null {
	const projected = projection(inputs);
	const groups = kosaraju(projected);
	if (groups.length > inputs.request.budgets.maxComponents) return null;
	const inputDigest = structuralSccAnalysisInputDigest(inputs);
	const id = structuralSccAnalysisId({
		inputDigest,
		semanticSnapshotId: inputs.request.semanticSnapshotId,
		subjectId: inputs.request.subjectId
	});
	const componentByNode = new Map<string, ReturnType<typeof structuralSccComponentId>>();
	const componentIds = groups.map((nodeIds) => structuralSccComponentId(id, nodeIds));
	for (const [index, nodeIds] of groups.entries())
		for (const nodeId of nodeIds) componentByNode.set(nodeId, componentIds[index]!);
	const internalEdgeIdsByComponent = new Map(
		componentIds.map((componentId) => [componentId, [] as Projection['edges'][number]['id'][]])
	);
	const selfLoopComponents = new Set<(typeof componentIds)[number]>();
	const incidentNodes = new Set<string>();
	let internalEdges = 0;
	for (const edge of projected.edges) {
		incidentNodes.add(edge.source);
		incidentNodes.add(edge.target);
		const sourceComponent = componentByNode.get(edge.source)!;
		if (sourceComponent !== componentByNode.get(edge.target)) continue;
		internalEdgeIdsByComponent.get(sourceComponent)!.push(edge.id);
		internalEdges += 1;
		if (edge.source === edge.target) selfLoopComponents.add(sourceComponent);
	}
	const components: StructuralSccComponent[] = groups.map((nodeIds, ordinal) => {
		const componentId = componentIds[ordinal]!;
		const internalEdgeIds = internalEdgeIdsByComponent.get(componentId)!.sort(compareText);
		return {
			cycleKind: componentCycleKind(nodeIds.length, selfLoopComponents.has(componentId)),
			id: componentId,
			internalEdgeIds,
			nodeIds: nodeIds as StructuralSccComponent['nodeIds'],
			ordinal
		};
	});
	const componentIndex: StructuralSccComponentIndexEntry[] = projected.nodeIds.map((nodeId) => ({
		componentId: componentByNode.get(nodeId)!,
		nodeId
	}));
	const withoutDigest = {
		authorityTransfer: STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER,
		budgets: { ...inputs.request.budgets },
		canonicalProfile: STRUCTURAL_SCC_ANALYSIS_CANONICAL_PROFILE,
		capability: STRUCTURAL_SCC_ANALYSIS_CAPABILITY,
		capabilityStatus: STRUCTURAL_SCC_ANALYSIS_CAPABILITY_STATUS,
		componentIndex,
		components,
		coverage: {
			chargedTraversalSteps: projected.nodeIds.length + projected.edges.length,
			components: components.length,
			crossComponentEdges: projected.edges.length - internalEdges,
			cyclicComponents: components.filter(
				(component) => component.cycleKind !== 'ACYCLIC_SINGLETON'
			).length,
			edgeAccountingReconciles: true,
			inputEdges: projected.edges.length,
			inputNodes: projected.nodeIds.length,
			internalEdges,
			isolatedSingletons: components.filter(
				(component) => component.nodeIds.length === 1 && !incidentNodes.has(component.nodeIds[0]!)
			).length,
			multiNodeComponents: components.filter((component) => component.cycleKind === 'MULTI_NODE')
				.length,
			partitionReconciles: true,
			selfLoopSingletons: components.filter(
				(component) => component.cycleKind === 'SELF_LOOP_SINGLETON'
			).length
		},
		fullJanCsaa007Conformance: 'NOT_CLAIMED' as const,
		fullJanCsaa008Conformance: 'NOT_CLAIMED' as const,
		gateEffect: STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT,
		graphAuthority: 'NONE' as const,
		health: 'PARTIAL' as const,
		id,
		inputDigest,
		layers: [
			{
				analysisId: id,
				capability: STRUCTURAL_SCC_ANALYSIS_CAPABILITY,
				capabilityStatus: STRUCTURAL_SCC_ANALYSIS_CAPABILITY_STATUS,
				componentIds: components.map((component) => component.id),
				id: structuralSccLayerId(id),
				kind: 'STRUCTURAL_STRONG_CONNECTIVITY' as const,
				ordinal: 0 as const,
				sourceGraph: { ...inputs.request.sourceGraph }
			}
		] as const,
		method: STRUCTURAL_SCC_ANALYSIS_METHOD,
		nonclaims: STRUCTURAL_SCC_ANALYSIS_NONCLAIMS,
		operationVersion: STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION,
		schemaVersion: STRUCTURAL_SCC_ANALYSIS_SCHEMA_VERSION,
		selection: { ...STRUCTURAL_SCC_ANALYSIS_SELECTION },
		semanticSnapshotId: inputs.request.semanticSnapshotId,
		sourceGraph: { ...inputs.request.sourceGraph },
		structuralClosure: 'EXACT_FOR_SELECTED_VALIDATED_GRAPH' as const,
		subjectId: inputs.request.subjectId,
		upstreamClosure: inputs.graph.coverage.closure
	};
	return { ...withoutDigest, contentDigest: structuralSccAnalysisContentDigest(withoutDigest) };
}

function issueResult(reported: StructuralSccValidationIssue): StructuralSccValidationResult {
	return {
		issues: [reported],
		state: reported.code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INVALID'
	};
}

function requestBudgetShellIssue(
	inputs: StructuralSccAnalysisInputs,
	closedOptions: ClosedOptions
): StructuralSccValidationIssue | null {
	const budgets = inputs.request.budgets;
	if (
		budgets.maxInputRecords >= closedOptions.maxInputRecords &&
		budgets.maxInputStringCharacters >= closedOptions.maxInputStringCharacters
	)
		return null;
	return inputShellIssue(inputs, {
		...closedOptions,
		maxInputRecords: Math.min(closedOptions.maxInputRecords, budgets.maxInputRecords),
		maxInputStringCharacters: Math.min(
			closedOptions.maxInputStringCharacters,
			budgets.maxInputStringCharacters
		)
	});
}

function validateStructuralSccAnalysisInternal(
	value: unknown,
	inputs: StructuralSccAnalysisInputs,
	validationOptions?: StructuralSccValidationOptions
): StructuralSccValidationResult {
	const closedOptions = options(validationOptions);
	if (closedOptions === null)
		return {
			issues: [issue('SHAPE_INVALID', 'Validation options are invalid.', '$options')],
			state: 'INVALID'
		};
	const shapeIssue = plainTreeIssue(value, closedOptions);
	if (shapeIssue !== null) return issueResult(shapeIssue);
	if (!plainRecord(value) || !exactKeys(value, SNAPSHOT_KEYS))
		return {
			issues: [issue('SHAPE_INVALID', 'The SCC analysis snapshot shell must be exact.')],
			state: 'INVALID'
		};
	const shellIssue = inputShellIssue(inputs, closedOptions);
	if (shellIssue !== null) return issueResult(shellIssue);
	const inputIssue = requestIssue(inputs);
	if (inputIssue !== null) return issueResult(inputIssue);
	const budgetShellIssue = requestBudgetShellIssue(inputs, closedOptions);
	if (budgetShellIssue !== null) return issueResult(budgetShellIssue);
	const graphValidation = validateModuleDependencyGraph(inputs.graph, inputs.semanticSnapshot, {
		maxIssues: Math.min(closedOptions.maxIssues, inputs.request.budgets.maxDiagnostics)
	});
	if (graphValidation.state !== 'VALID')
		return {
			issues: [
				issue('INPUT_INVALID', 'The source graph is not independently valid.', '$inputs.graph')
			],
			state: 'INVALID'
		};
	const expected = expectedAnalysis(inputs);
	if (expected === null)
		return {
			issues: [
				issue(
					'BUDGET_EXHAUSTED',
					'The component population exceeds maxComponents.',
					'$inputs.request.budgets.maxComponents'
				)
			],
			state: 'BUDGET_EXHAUSTED'
		};
	const candidate = value as unknown as StructuralSccAnalysisSnapshot;
	if (candidate.inputDigest !== expected.inputDigest || candidate.id !== expected.id)
		return {
			issues: [
				issue(
					'IDENTITY_MISMATCH',
					'The candidate analysis identity does not match its inputs.',
					'$.id'
				)
			],
			state: 'INVALID'
		};
	if (candidate.contentDigest !== structuralSccAnalysisContentDigest(candidate))
		return {
			issues: [
				issue(
					'CONTENT_DIGEST_MISMATCH',
					'The candidate content digest is invalid.',
					'$.contentDigest'
				)
			],
			state: 'INVALID'
		};
	if (canonicalSemanticJson(candidate) !== canonicalSemanticJson(expected))
		return {
			issues: [
				issue(
					'POPULATION_MISMATCH',
					'The candidate differs from the independently derived SCC analysis.'
				)
			],
			state: 'INVALID'
		};
	return { issues: [], state: 'VALID' };
}

export function validateStructuralSccAnalysis(
	value: unknown,
	inputs: StructuralSccAnalysisInputs,
	validationOptions?: StructuralSccValidationOptions
): StructuralSccValidationResult {
	try {
		return validateStructuralSccAnalysisInternal(value, inputs, validationOptions);
	} catch {
		return {
			issues: [issue('SHAPE_INVALID', 'SCC validation failed closed on hostile input.')],
			state: 'INVALID'
		};
	}
}

export const validateConstructedStructuralSccAnalysis = validateStructuralSccAnalysis;
