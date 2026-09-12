import type { ModuleDependencyGraphSnapshot } from '../contracts/graph.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import type { FrozenSubject, WorkspaceSubjectRecord } from '../contracts/subject.js';
import { compareText, sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	analyzeStructuralModuleGraph,
	type StructuralModuleGraphAnalysis,
	type StructuralModuleGraphAnalysisRequest
} from './analyze-structural-module-graph.js';
import { structuralSccNodeGroups } from './build-structural-scc-analysis.js';
import { validateModuleDependencyGraph } from './validate-graph.js';

export const STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION =
	'jan-csaa-structural-workspace-dependency-graph-request/0.1.0' as const;
export const STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_SCHEMA_VERSION =
	'jan-csaa-structural-workspace-dependency-graph/0.1.0' as const;
export const STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_OPERATION_VERSION =
	'jan-csaa-build-structural-workspace-dependency-graph/0.1.0' as const;
export const STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_STATUS =
	'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_AUTHORITY =
	'NON_AUTHORITATIVE_STRUCTURAL_PROJECTION' as const;
export const STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_GATE_EFFECT = 'NONE' as const;
export const STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_NONCLAIMS = Object.freeze([
	'ARCHITECTURE_RULE_COMPLIANCE',
	'BEHAVIORAL_REACHABILITY',
	'DEPENDENCY_CRUISER_EQUIVALENCE',
	'FULL_DWP_004_COMPLETION',
	'G4_PASS',
	'MANIFEST_DECLARED_DEPENDENCIES',
	'POLICY_VIOLATION',
	'SAFE_REMOVAL'
] as const);

export interface StructuralWorkspaceDependencyGraphBudgets {
	readonly analysis: StructuralModuleGraphAnalysisRequest['budgets'];
	readonly maxFrontiers: number;
	readonly maxResultBytes: number;
	readonly maxValidationIssues: number;
	readonly maxWorkspaceEdges: number;
	readonly maxWorkspaces: number;
}

export interface StructuralWorkspaceDependencyGraphRequest {
	readonly budgets: StructuralWorkspaceDependencyGraphBudgets;
	readonly expectCrossWorkspaceEdges: boolean;
	readonly moduleAnalysis: Omit<StructuralModuleGraphAnalysisRequest, 'budgets'>;
	readonly operationVersion: typeof STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_OPERATION_VERSION;
	readonly schemaVersion: typeof STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION;
}

export interface StructuralWorkspaceDependencyNode {
	readonly id: string;
	readonly kind: WorkspaceSubjectRecord['kind'];
	readonly manifestPath: string;
	readonly name: string;
	readonly path: string;
	readonly sourceNodeIds: readonly string[];
}

export interface StructuralWorkspaceDependencyEdge {
	readonly epistemic: ModuleDependencyGraphSnapshot['edges'][number]['epistemic'];
	readonly id: string;
	readonly moduleEdgeIds: readonly string[];
	readonly relationKinds: readonly ModuleDependencyGraphSnapshot['edges'][number]['relationKind'][];
	readonly sourceWorkspaceId: string;
	readonly targetWorkspaceId: string;
}

export interface StructuralWorkspaceDependencyIndexEntry {
	readonly edgeIds: readonly string[];
	readonly nodeId: string;
}

export interface StructuralWorkspaceDependencyComponent {
	readonly cycleKind: 'ACYCLIC_SINGLETON' | 'MULTI_NODE' | 'SELF_LOOP_SINGLETON';
	readonly internalEdgeIds: readonly string[];
	readonly nodeIds: readonly string[];
	readonly ordinal: number;
}

export type StructuralWorkspaceDependencyFrontierReason =
	| 'SOURCE_OUTSIDE_SELECTED_WORKSPACES'
	| 'TARGET_IS_NON_SOURCE_MODULE_ENDPOINT'
	| 'TARGET_OUTSIDE_SELECTED_WORKSPACES';

export interface StructuralWorkspaceDependencyEdgeFrontier {
	readonly moduleEdgeId: string;
	readonly reasons: readonly StructuralWorkspaceDependencyFrontierReason[];
	readonly sourceNodeId: string;
	readonly targetNodeId: string;
}

export interface StructuralWorkspaceOwnershipFrontier {
	readonly logicalPath: string;
	readonly nodeId: string;
	readonly reason: 'SOURCE_OUTSIDE_SELECTED_WORKSPACES';
}

export interface StructuralWorkspaceDependencyGraphResult {
	readonly authority: typeof STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_AUTHORITY;
	readonly capabilityStatus: typeof STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_STATUS;
	readonly contentDigest: string;
	readonly coverage: {
		readonly crossWorkspaceModuleEdges: number;
		readonly frontierModuleEdges: number;
		readonly internalWorkspaceModuleEdges: number;
		readonly moduleEdgePartitionReconciles: true;
		readonly moduleEdges: number;
		readonly ownedSourceNodes: number;
		readonly packageEdges: number;
		readonly packageNodes: number;
		readonly sourceNodes: number;
		readonly subjectPopulationClosure: 'CLOSED' | 'OPEN';
		readonly unownedSourceNodes: number;
		readonly upstreamGraphClosure: 'CLOSED' | 'OPEN';
		readonly workspaceEdges: number;
		readonly workspaceNodes: number;
	};
	readonly currentness: {
		readonly basis: 'FROZEN_SUBJECT_AND_SOURCE_GRAPH_REFERENCES';
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT_ONLY';
	};
	readonly edgeFrontiers: readonly StructuralWorkspaceDependencyEdgeFrontier[];
	readonly gateEffect: typeof STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_GATE_EFFECT;
	readonly graphId: ModuleDependencyGraphSnapshot['id'];
	readonly internalWorkspaceModuleEdgeIds: readonly string[];
	readonly moduleAnalysis: StructuralModuleGraphAnalysis;
	readonly nonclaims: typeof STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_NONCLAIMS;
	readonly ownershipFrontiers: readonly StructuralWorkspaceOwnershipFrontier[];
	readonly packageComponents: readonly StructuralWorkspaceDependencyComponent[];
	readonly packageEdges: readonly StructuralWorkspaceDependencyEdge[];
	readonly packageForwardIndex: readonly StructuralWorkspaceDependencyIndexEntry[];
	readonly packageNodes: readonly StructuralWorkspaceDependencyNode[];
	readonly packageReverseIndex: readonly StructuralWorkspaceDependencyIndexEntry[];
	readonly schemaVersion: typeof STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_SCHEMA_VERSION;
	readonly semanticSnapshotId: StaticSemanticSnapshot['id'];
	readonly subjectId: string;
	readonly wireShape: 'CLOSED_EXACT';
	readonly workspaceComponents: readonly StructuralWorkspaceDependencyComponent[];
	readonly workspaceEdges: readonly StructuralWorkspaceDependencyEdge[];
	readonly workspaceForwardIndex: readonly StructuralWorkspaceDependencyIndexEntry[];
	readonly workspaceNodes: readonly StructuralWorkspaceDependencyNode[];
	readonly workspaceReverseIndex: readonly StructuralWorkspaceDependencyIndexEntry[];
}

export type StructuralWorkspaceDependencyGraphDiagnosticCode =
	| 'AMBIGUOUS_WORKSPACE_OWNERSHIP'
	| 'BUDGET_EXHAUSTED'
	| 'EMPTY_REQUIRED_POPULATION'
	| 'IDENTITY_MISMATCH'
	| 'REQUEST_INVALID'
	| 'SOURCE_GRAPH_INVALID'
	| 'SUBJECT_WORKSPACE_INVALID';

export interface StructuralWorkspaceDependencyGraphDiagnostic {
	readonly code: StructuralWorkspaceDependencyGraphDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'PROJECT' | 'REQUEST' | 'VALIDATE';
}

export type StructuralWorkspaceDependencyGraphOutcome =
	| {
			readonly diagnostics: readonly [];
			readonly graph: StructuralWorkspaceDependencyGraphResult;
			readonly outcome: 'complete' | 'partial';
	  }
	| {
			readonly diagnostics: readonly [StructuralWorkspaceDependencyGraphDiagnostic];
			readonly graph?: never;
			readonly outcome: 'unavailable';
	  };

const REQUEST_KEYS = [
	'budgets',
	'expectCrossWorkspaceEdges',
	'moduleAnalysis',
	'operationVersion',
	'schemaVersion'
] as const;
const BUDGET_KEYS = [
	'analysis',
	'maxFrontiers',
	'maxResultBytes',
	'maxValidationIssues',
	'maxWorkspaceEdges',
	'maxWorkspaces'
] as const;

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
	if (value === null || typeof value !== 'object' || seen.has(value)) return value;
	seen.add(value);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor !== undefined && 'value' in descriptor) deepFreeze(descriptor.value, seen);
	}
	return Object.freeze(value);
}

function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
	return (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		Reflect.ownKeys(value).every((key) => typeof key === 'string') &&
		Reflect.ownKeys(value).length === keys.length &&
		keys.every((key) => Object.prototype.propertyIsEnumerable.call(value, key)) &&
		Object.keys(value).every((key) => keys.includes(key))
	);
}

function safePositive(value: unknown, maximum: number): value is number {
	return (
		typeof value === 'number' &&
		Number.isSafeInteger(value) &&
		value > 0 &&
		value <= maximum &&
		!Object.is(value, -0)
	);
}

function validRequest(value: unknown): value is StructuralWorkspaceDependencyGraphRequest {
	if (!exactRecord(value, REQUEST_KEYS) || !exactRecord(value.budgets, BUDGET_KEYS)) return false;
	if (
		value.schemaVersion !== STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION ||
		value.operationVersion !== STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_OPERATION_VERSION ||
		typeof value.expectCrossWorkspaceEdges !== 'boolean'
	)
		return false;
	const budgets = value.budgets;
	return (
		safePositive(budgets.maxFrontiers, 10_000_000) &&
		safePositive(budgets.maxResultBytes, 1_000_000_000) &&
		safePositive(budgets.maxValidationIssues, 100_000) &&
		safePositive(budgets.maxWorkspaceEdges, 10_000_000) &&
		safePositive(budgets.maxWorkspaces, 1_000_000) &&
		value.moduleAnalysis !== null &&
		typeof value.moduleAnalysis === 'object' &&
		budgets.analysis !== null &&
		typeof budgets.analysis === 'object'
	);
}

function unavailable(
	code: StructuralWorkspaceDependencyGraphDiagnosticCode,
	message: string,
	phase: StructuralWorkspaceDependencyGraphDiagnostic['phase'],
	path: string | null = null
): StructuralWorkspaceDependencyGraphOutcome {
	return deepFreeze({ diagnostics: [{ code, message, path, phase }], outcome: 'unavailable' });
}

function validLogicalPath(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length > 0 &&
		value !== '.' &&
		!value.startsWith('/') &&
		!value.endsWith('/') &&
		!value.includes('\\') &&
		!value.split('/').some((part) => part.length === 0 || part === '.' || part === '..')
	);
}

function validateWorkspaces(
	subject: FrozenSubject,
	maximum: number
): readonly WorkspaceSubjectRecord[] | StructuralWorkspaceDependencyGraphOutcome {
	if (!Array.isArray(subject?.workspaces) || subject.workspaces.length > maximum)
		return unavailable(
			'BUDGET_EXHAUSTED',
			'The selected workspace population is absent or exceeds maxWorkspaces.',
			'PROJECT',
			'$inputs.frozenSubject.workspaces'
		);
	if (subject.workspaces.length === 0)
		return unavailable(
			'EMPTY_REQUIRED_POPULATION',
			'The structural workspace dependency projection requires a nonempty workspace population.',
			'PROJECT',
			'$inputs.frozenSubject.workspaces'
		);
	const paths = new Set<string>();
	const names = new Set<string>();
	for (const workspace of subject.workspaces) {
		if (
			!validLogicalPath(workspace?.path) ||
			typeof workspace.name !== 'string' ||
			workspace.name.length === 0 ||
			typeof workspace.manifestPath !== 'string' ||
			workspace.manifestPath.length === 0 ||
			!['APP', 'PACKAGE'].includes(workspace.kind) ||
			paths.has(workspace.path) ||
			names.has(workspace.name)
		)
			return unavailable(
				'SUBJECT_WORKSPACE_INVALID',
				'Workspace paths and names must be unique canonical records.',
				'PROJECT',
				'$inputs.frozenSubject.workspaces'
			);
		paths.add(workspace.path);
		names.add(workspace.name);
	}
	return [...subject.workspaces].sort((left, right) => compareText(left.path, right.path));
}

function workspaceNodeId(subjectId: string, workspace: WorkspaceSubjectRecord): string {
	return `structural-workspace:${sha256(
		canonicalSemanticJson({ kind: workspace.kind, name: workspace.name, path: workspace.path, subjectId })
	)}`;
}

function owns(workspacePath: string, logicalPath: string): boolean {
	return logicalPath === workspacePath || logicalPath.startsWith(`${workspacePath}/`);
}

function edgeEpistemic(
	edges: readonly ModuleDependencyGraphSnapshot['edges'][number][]
): ModuleDependencyGraphSnapshot['edges'][number]['epistemic'] {
	for (const state of ['CONFLICTING', 'UNSUPPORTED', 'UNKNOWN', 'SUPPORTED'] as const)
		if (edges.some((edge) => edge.epistemic === state)) return state;
	return 'UNKNOWN';
}

function makeIndexes(
	nodes: readonly StructuralWorkspaceDependencyNode[],
	edges: readonly StructuralWorkspaceDependencyEdge[],
	direction: 'FORWARD' | 'REVERSE'
): readonly StructuralWorkspaceDependencyIndexEntry[] {
	const edgeIdsByNode = new Map(nodes.map((node) => [node.id, [] as string[]]));
	for (const edge of edges) {
		const nodeId = direction === 'FORWARD' ? edge.sourceWorkspaceId : edge.targetWorkspaceId;
		edgeIdsByNode.get(nodeId)?.push(edge.id);
	}
	return nodes.map((node) => ({
		edgeIds: edgeIdsByNode.get(node.id)!.sort(compareText),
		nodeId: node.id
	}));
}

function components(
	nodes: readonly StructuralWorkspaceDependencyNode[],
	edges: readonly StructuralWorkspaceDependencyEdge[]
): readonly StructuralWorkspaceDependencyComponent[] {
	const groups = structuralSccNodeGroups({
		edges: edges.map((edge) => ({
			id: edge.id as ModuleDependencyGraphSnapshot['edges'][number]['id'],
			source: edge.sourceWorkspaceId as ModuleDependencyGraphSnapshot['nodes'][number]['id'],
			target: edge.targetWorkspaceId as ModuleDependencyGraphSnapshot['nodes'][number]['id']
		})),
		nodeIds: nodes.map(
			(node) => node.id as ModuleDependencyGraphSnapshot['nodes'][number]['id']
		)
	});
	return groups.map((nodeIds, ordinal) => {
		const members = new Set(nodeIds);
		const internalEdgeIds = edges
			.filter(
				(edge) => members.has(edge.sourceWorkspaceId) && members.has(edge.targetWorkspaceId)
			)
			.map((edge) => edge.id)
			.sort(compareText);
		const selfLoop =
			nodeIds.length === 1 &&
			edges.some(
				(edge) => edge.sourceWorkspaceId === nodeIds[0] && edge.targetWorkspaceId === nodeIds[0]
			);
		return {
			cycleKind:
				nodeIds.length > 1
					? ('MULTI_NODE' as const)
					: selfLoop
						? ('SELF_LOOP_SINGLETON' as const)
						: ('ACYCLIC_SINGLETON' as const),
			internalEdgeIds,
			nodeIds: [...nodeIds],
			ordinal
		};
	});
}

function contentDigest(
	value: Omit<StructuralWorkspaceDependencyGraphResult, 'contentDigest'>
): string {
	return sha256(canonicalSemanticJson(value));
}

export function buildStructuralWorkspaceDependencyGraph(
	requestValue: unknown,
	frozenSubject: FrozenSubject,
	semanticSnapshot: StaticSemanticSnapshot,
	moduleGraph: ModuleDependencyGraphSnapshot
): StructuralWorkspaceDependencyGraphOutcome {
	try {
		if (!validRequest(requestValue))
			return unavailable('REQUEST_INVALID', 'The request is not an exact supported record.', 'REQUEST');
		const request = requestValue;
		if (
			frozenSubject?.descriptor?.subjectId !== semanticSnapshot?.subjectId ||
			semanticSnapshot?.subjectId !== moduleGraph?.subjectId ||
			semanticSnapshot?.id !== moduleGraph?.semanticSnapshotId
		)
			return unavailable(
				'IDENTITY_MISMATCH',
				'Frozen subject, semantic snapshot, and module graph identities must match.',
				'PROJECT',
				'$inputs'
			);

		const moduleAnalysisOutcome = analyzeStructuralModuleGraph({
			graph: moduleGraph,
			request: { budgets: request.budgets.analysis, ...request.moduleAnalysis }
		});
		if (moduleAnalysisOutcome.outcome === 'unavailable') {
			const diagnostic = moduleAnalysisOutcome.diagnostics[0];
			return unavailable(
				diagnostic.code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'SOURCE_GRAPH_INVALID',
				diagnostic.message,
				'VALIDATE',
				diagnostic.path
			);
		}
		const graphValidation = validateModuleDependencyGraph(moduleGraph, semanticSnapshot, {
			maxIssues: request.budgets.maxValidationIssues
		});
		if (graphValidation.state !== 'VALID')
			return unavailable(
				'SOURCE_GRAPH_INVALID',
				graphValidation.issues[0]?.message ?? 'Module graph validation failed.',
				'VALIDATE',
				graphValidation.issues[0]?.path ?? '$inputs.moduleGraph'
			);

		const workspaces = validateWorkspaces(frozenSubject, request.budgets.maxWorkspaces);
		if ('outcome' in workspaces) return workspaces;
		const sourceNodes = moduleGraph.nodes.filter((node) => node.kind === 'SOURCE');
		if (sourceNodes.length === 0 || moduleGraph.edges.length === 0)
			return unavailable(
				'EMPTY_REQUIRED_POPULATION',
				'Module source and edge populations must both be nonempty.',
				'PROJECT',
				'$inputs.moduleGraph'
			);

		const workspaceById = new Map<string, WorkspaceSubjectRecord>();
		const sourceIdsByWorkspace = new Map<string, string[]>();
		for (const workspace of workspaces) {
			const id = workspaceNodeId(moduleGraph.subjectId, workspace);
			workspaceById.set(id, workspace);
			sourceIdsByWorkspace.set(id, []);
		}
		const ownerBySourceNode = new Map<string, string>();
		const ownershipFrontiers: StructuralWorkspaceOwnershipFrontier[] = [];
		for (const source of sourceNodes) {
			const matches = [...workspaceById.entries()].filter(([, workspace]) =>
				owns(workspace.path, source.logicalPath)
			);
			if (matches.length > 1)
				return unavailable(
					'AMBIGUOUS_WORKSPACE_OWNERSHIP',
					`Source ${source.logicalPath} matches multiple selected workspace roots.`,
					'PROJECT',
					'$inputs.frozenSubject.workspaces'
				);
			if (matches.length === 0) {
				ownershipFrontiers.push({
					logicalPath: source.logicalPath,
					nodeId: source.id,
					reason: 'SOURCE_OUTSIDE_SELECTED_WORKSPACES'
				});
				continue;
			}
			const ownerId = matches[0]![0];
			ownerBySourceNode.set(source.id, ownerId);
			sourceIdsByWorkspace.get(ownerId)!.push(source.id);
		}
		ownershipFrontiers.sort(
			(left, right) => compareText(left.logicalPath, right.logicalPath) || compareText(left.nodeId, right.nodeId)
		);
		const workspaceNodes: StructuralWorkspaceDependencyNode[] = [...workspaceById.entries()]
			.map(([id, workspace]) => ({
				id,
				kind: workspace.kind,
				manifestPath: workspace.manifestPath,
				name: workspace.name,
				path: workspace.path,
				sourceNodeIds: sourceIdsByWorkspace.get(id)!.sort(compareText)
			}))
			.sort((left, right) => compareText(left.id, right.id));

		const nodeById = new Map(moduleGraph.nodes.map((node) => [node.id, node]));
		const grouped = new Map<string, ModuleDependencyGraphSnapshot['edges'][number][]>();
		const internalWorkspaceModuleEdgeIds: string[] = [];
		const edgeFrontiers: StructuralWorkspaceDependencyEdgeFrontier[] = [];
		for (const edge of moduleGraph.edges) {
			const sourceOwner = ownerBySourceNode.get(edge.source.nodeId);
			const targetNode = nodeById.get(edge.target.nodeId)!;
			const targetOwner =
				targetNode.kind === 'SOURCE' ? ownerBySourceNode.get(targetNode.id) : undefined;
			const reasons: StructuralWorkspaceDependencyFrontierReason[] = [];
			if (sourceOwner === undefined) reasons.push('SOURCE_OUTSIDE_SELECTED_WORKSPACES');
			if (targetNode.kind !== 'SOURCE') reasons.push('TARGET_IS_NON_SOURCE_MODULE_ENDPOINT');
			else if (targetOwner === undefined) reasons.push('TARGET_OUTSIDE_SELECTED_WORKSPACES');
			if (reasons.length > 0) {
				edgeFrontiers.push({
					moduleEdgeId: edge.id,
					reasons,
					sourceNodeId: edge.source.nodeId,
					targetNodeId: edge.target.nodeId
				});
				continue;
			}
			if (sourceOwner === targetOwner) {
				internalWorkspaceModuleEdgeIds.push(edge.id);
				continue;
			}
			const key = `${sourceOwner}\0${targetOwner}`;
			const edges = grouped.get(key) ?? [];
			edges.push(edge);
			grouped.set(key, edges);
		}
		edgeFrontiers.sort((left, right) => compareText(left.moduleEdgeId, right.moduleEdgeId));
		internalWorkspaceModuleEdgeIds.sort(compareText);
		if (
			edgeFrontiers.length + ownershipFrontiers.length > request.budgets.maxFrontiers ||
			grouped.size > request.budgets.maxWorkspaceEdges
		)
			return unavailable(
				'BUDGET_EXHAUSTED',
				'The workspace edge or frontier population exceeds its caller budget.',
				'PROJECT',
				'$.budgets'
			);
		if (request.expectCrossWorkspaceEdges && grouped.size === 0)
			return unavailable(
				'EMPTY_REQUIRED_POPULATION',
				'The request required a nonempty cross-workspace dependency population.',
				'PROJECT',
				'$.expectCrossWorkspaceEdges'
			);

		const workspaceEdges: StructuralWorkspaceDependencyEdge[] = [...grouped.entries()]
			.map(([key, edges]) => {
				const [sourceWorkspaceId, targetWorkspaceId] = key.split('\0') as [string, string];
				return {
					epistemic: edgeEpistemic(edges),
					id: `structural-workspace-edge:${sha256(
						canonicalSemanticJson({ graphId: moduleGraph.id, sourceWorkspaceId, targetWorkspaceId })
					)}`,
					moduleEdgeIds: edges.map((edge) => edge.id).sort(compareText),
					relationKinds: [...new Set(edges.map((edge) => edge.relationKind))].sort(compareText),
					sourceWorkspaceId,
					targetWorkspaceId
				};
			})
			.sort((left, right) => compareText(left.id, right.id));
		const packageNodes = workspaceNodes.filter((node) => node.kind === 'PACKAGE');
		const packageNodeIds = new Set(packageNodes.map((node) => node.id));
		const packageEdges = workspaceEdges.filter(
			(edge) =>
				packageNodeIds.has(edge.sourceWorkspaceId) && packageNodeIds.has(edge.targetWorkspaceId)
		);
		const subjectPopulationClosure =
			frozenSubject.population?.reconciles === true && frozenSubject.population.failed === 0
				? ('CLOSED' as const)
				: ('OPEN' as const);
		const moduleEdgePartition =
			internalWorkspaceModuleEdgeIds.length + edgeFrontiers.length +
			workspaceEdges.reduce((total, edge) => total + edge.moduleEdgeIds.length, 0);
		if (moduleEdgePartition !== moduleGraph.edges.length)
			return unavailable(
				'SOURCE_GRAPH_INVALID',
				'The module-edge projection did not form an exact partition.',
				'VALIDATE',
				'$projection'
			);

		const content: Omit<StructuralWorkspaceDependencyGraphResult, 'contentDigest'> = {
			authority: STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_AUTHORITY,
			capabilityStatus: STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_STATUS,
			coverage: {
				crossWorkspaceModuleEdges: workspaceEdges.reduce(
					(total, edge) => total + edge.moduleEdgeIds.length,
					0
				),
				frontierModuleEdges: edgeFrontiers.length,
				internalWorkspaceModuleEdges: internalWorkspaceModuleEdgeIds.length,
				moduleEdgePartitionReconciles: true,
				moduleEdges: moduleGraph.edges.length,
				ownedSourceNodes: ownerBySourceNode.size,
				packageEdges: packageEdges.length,
				packageNodes: packageNodes.length,
				sourceNodes: sourceNodes.length,
				subjectPopulationClosure,
				unownedSourceNodes: ownershipFrontiers.length,
				upstreamGraphClosure: moduleGraph.coverage.closure,
				workspaceEdges: workspaceEdges.length,
				workspaceNodes: workspaceNodes.length
			},
			currentness: {
				basis: 'FROZEN_SUBJECT_AND_SOURCE_GRAPH_REFERENCES',
				state: 'CURRENT_FOR_CAPTURED_SUBJECT_ONLY'
			},
			edgeFrontiers,
			gateEffect: STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_GATE_EFFECT,
			graphId: moduleGraph.id,
			internalWorkspaceModuleEdgeIds,
			moduleAnalysis: moduleAnalysisOutcome.analysis,
			nonclaims: STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_NONCLAIMS,
			ownershipFrontiers,
			packageComponents: components(packageNodes, packageEdges),
			packageEdges,
			packageForwardIndex: makeIndexes(packageNodes, packageEdges, 'FORWARD'),
			packageNodes,
			packageReverseIndex: makeIndexes(packageNodes, packageEdges, 'REVERSE'),
			schemaVersion: STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_SCHEMA_VERSION,
			semanticSnapshotId: semanticSnapshot.id,
			subjectId: moduleGraph.subjectId,
			wireShape: 'CLOSED_EXACT',
			workspaceComponents: components(workspaceNodes, workspaceEdges),
			workspaceEdges,
			workspaceForwardIndex: makeIndexes(workspaceNodes, workspaceEdges, 'FORWARD'),
			workspaceNodes,
			workspaceReverseIndex: makeIndexes(workspaceNodes, workspaceEdges, 'REVERSE')
		};
		const graph: StructuralWorkspaceDependencyGraphResult = {
			...content,
			contentDigest: contentDigest(content)
		};
		if (Buffer.byteLength(canonicalSemanticJson(graph), 'utf8') > request.budgets.maxResultBytes)
			return unavailable(
				'BUDGET_EXHAUSTED',
				'The structural workspace dependency result exceeds maxResultBytes.',
				'PROJECT',
				'$.budgets.maxResultBytes'
			);
		const complete =
			moduleAnalysisOutcome.outcome === 'complete' &&
			moduleGraph.coverage.closure === 'CLOSED' &&
			subjectPopulationClosure === 'CLOSED' &&
			ownershipFrontiers.length === 0 &&
			edgeFrontiers.length === 0;
		return deepFreeze({ diagnostics: [], graph, outcome: complete ? 'complete' : 'partial' });
	} catch {
		return unavailable(
			'SOURCE_GRAPH_INVALID',
			'The structural workspace dependency projection failed closed on invalid input.',
			'VALIDATE'
		);
	}
}
