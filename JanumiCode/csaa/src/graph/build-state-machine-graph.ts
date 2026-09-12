import { isProxy } from 'node:util/types';
import {
	FULL_JAN_CSAA_008_CONFORMANCE,
	STATE_MACHINE_GRAPH_CANONICAL_PROFILE,
	STATE_MACHINE_GRAPH_CAPABILITY,
	STATE_MACHINE_GRAPH_CAPABILITY_STATUS,
	STATE_MACHINE_GRAPH_METHOD,
	STATE_MACHINE_GRAPH_OPERATION_VERSION,
	STATE_MACHINE_GRAPH_REGISTRY_STATUS,
	STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_SCOPE,
	STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY,
	type BuildStateMachineGraphRequest,
	type StateMachineGraphBuildDiagnostic,
	type StateMachineGraphBuildOutcome,
	type StateMachineGraphCoverage,
	type StateMachineGraphEdge,
	type StateMachineGraphEndpoint,
	type StateMachineGraphId,
	type StateMachineGraphIndexEntry,
	type StateMachineGraphLayerId,
	type StateMachineGraphLimitation,
	type StateMachineGraphNode,
	type StateMachineGraphRelationCode,
	type StateMachineGraphRelationKind,
	type StateMachineGraphSnapshot,
	type StateMachineGraphSourceLocation,
	type StateMachineSourceSpan,
	type StateMachineTopologyObservation
} from '../contracts/state-machine-graph.js';
import {
	FULL_JAN_CSAA_007_CONFORMANCE,
	type SemanticProvenanceId,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import { stateMachineGraphContentDigest } from './state-machine-graph-content.js';
import {
	stateMachineGraphCrossAxisFrontierNodeId,
	stateMachineGraphEdgeId,
	stateMachineGraphId,
	stateMachineGraphLayerId,
	stateMachineGraphMachineNodeId,
	stateMachineGraphStateNodeId
} from './state-machine-graph-ids.js';
import { stateMachineGraphInputDigest } from './state-machine-graph-input.js';
import { validateConstructedStateMachineGraph } from './validate-state-machine-graph.js';
import { validateStateMachineTopologyObservation } from '../providers/jpwb-state-machines/validate-state-machine-observation.js';

const REQUEST_KEYS = [
	'budgets',
	'observationId',
	'operationVersion',
	'schemaVersion',
	'semanticSnapshotId',
	'source',
	'subjectId'
] as const;
const BUDGET_KEYS = ['maxEdges', 'maxNodes'] as const;
const SOURCE_KEYS = ['logicalPath', 'programId', 'projectId', 'semanticSourceId'] as const;

const LIMITATIONS: readonly StateMachineGraphLimitation[] = [
	{
		kind: 'COMMAND_PERFORMABILITY_NOT_ANALYZED',
		reason: 'Command-handler performability and arrow-command census conclusions remain delegated.'
	},
	{
		kind: 'CROSS_AXIS_EFFECT_NOT_MODELED',
		reason:
			'Cross-axis declarations remain explicit frontiers rather than invented same-axis edges.'
	},
	{
		kind: 'GENERATED_TOPOLOGY_ONLY',
		reason:
			'This projection describes the exact generated transition table, not upstream vocabulary authority.'
	},
	{
		kind: 'GUARD_ENFORCEMENT_NOT_ANALYZED',
		reason: 'Guard text is retained, but runtime guard enforcement is not inferred.'
	},
	{
		kind: 'RELATION_REGISTRY_UNAVAILABLE',
		reason: 'JAN-CSAA-007 has no registered state-machine graph or relation family for these edges.'
	},
	{
		kind: 'WHOLE_PROGRAM_REACHABILITY_NOT_ANALYZED',
		reason: 'This declared topology is not a whole-program behavioral reachability analysis.'
	}
];

const RELATION_CODES: Readonly<
	Record<StateMachineGraphRelationKind, StateMachineGraphRelationCode>
> = {
	CONTAINS_STATE: 'IMPL-JPWB-SM-CONTAINS-STATE-001',
	DECLARES_CROSS_AXIS_RULE: 'IMPL-JPWB-SM-DECLARES-CROSS-AXIS-RULE-001',
	EXPLICITLY_ILLEGAL_TRANSITION: 'IMPL-JPWB-SM-EXPLICITLY-ILLEGAL-TRANSITION-001',
	GUARDED_LEGAL_TRANSITION: 'IMPL-JPWB-SM-GUARDED-LEGAL-TRANSITION-001',
	LEGAL_TRANSITION: 'IMPL-JPWB-SM-LEGAL-TRANSITION-001'
};

const GRAPH_EPISTEMIC = {
	capabilityCoverage: 'PARTIAL',
	conflictState: 'NOT_EVALUATED',
	executionHealth: 'PARTIAL',
	freshness: 'SUBJECT_AND_SNAPSHOT_BOUND',
	inferenceState: 'NONE',
	supportBasis: 'DECLARED_GENERATED_TOPOLOGY'
} as const;

/** A refusal outcome, or `null` when the checked condition holds. */
type GraphRefusal = StateMachineGraphBuildOutcome | null;

type MachineNode = Extract<StateMachineGraphNode, { kind: 'MACHINE' }>;
type StateNode = Extract<StateMachineGraphNode, { kind: 'STATE' }>;
type FrontierNode = Extract<StateMachineGraphNode, { kind: 'CROSS_AXIS_FRONTIER' }>;

interface ProjectionContext {
	readonly graphId: StateMachineGraphId;
	readonly layerId: StateMachineGraphLayerId;
	readonly location: (span: StateMachineSourceSpan) => StateMachineGraphSourceLocation[];
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly snapshot: StaticSemanticSnapshot;
}

type AddEdge = (
	relationKind: StateMachineGraphRelationKind,
	observationRecordId: string,
	sourceEndpoint: StateMachineGraphEndpoint,
	targetEndpoint: StateMachineGraphEndpoint,
	spans: readonly { readonly end: number; readonly start: number }[],
	fields: Pick<StateMachineGraphEdge, 'guard' | 'note' | 'reason' | 'trigger'>
) => void;

function diagnostic(
	code: StateMachineGraphBuildDiagnostic['code'],
	message: string,
	phase: StateMachineGraphBuildDiagnostic['phase'],
	path: string | null = null
): StateMachineGraphBuildDiagnostic {
	return { code, message, path, phase };
}

function unavailable(
	code: StateMachineGraphBuildDiagnostic['code'],
	message: string,
	phase: StateMachineGraphBuildDiagnostic['phase'],
	path: string | null = null
): StateMachineGraphBuildOutcome {
	return { diagnostics: [diagnostic(code, message, phase, path)], outcome: 'unavailable' };
}

/** Reproduces default `Array#sort` (UTF-16 code-unit) order without a locale. */
function compareText(left: string, right: string): number {
	return Number(left > right) - Number(left < right);
}

function materializeDataObject(
	value: unknown,
	keys: readonly string[],
	label: string
): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		throw new TypeError(`${label} must be a plain data object.`);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError(`${label} must have a plain prototype.`);
	const ownKeys = Reflect.ownKeys(value);
	if (ownKeys.some((key) => typeof key !== 'string'))
		throw new TypeError(`${label} rejects symbol keys.`);
	const actual = (ownKeys as string[]).sort(compareText);
	const expected = [...keys].sort(compareText);
	if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]))
		throw new TypeError(`${label} requires exactly ${expected.join(', ')}.`);
	const record = value as Record<string, unknown>;
	for (const key of expected) {
		const descriptor = Reflect.getOwnPropertyDescriptor(record, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError(`${label} field ${key} must be data.`);
	}
	return record;
}

function materializeRequest(value: unknown): BuildStateMachineGraphRequest {
	const record = materializeDataObject(value, REQUEST_KEYS, 'State-machine graph request');
	for (const key of REQUEST_KEYS.filter((key) => key !== 'budgets' && key !== 'source'))
		if (typeof record[key] !== 'string' || record[key].length === 0)
			throw new TypeError(`State-machine graph request field ${key} must be nonempty text.`);
	const source = materializeDataObject(record.source, SOURCE_KEYS, 'State-machine graph source');
	const budgets = materializeDataObject(record.budgets, BUDGET_KEYS, 'State-machine graph budgets');
	for (const key of BUDGET_KEYS)
		if (!Number.isSafeInteger(budgets[key]) || (budgets[key] as number) < 1)
			throw new TypeError(`State-machine graph budget ${key} must be a positive safe integer.`);
	for (const key of SOURCE_KEYS)
		if (typeof source[key] !== 'string' || source[key].length === 0)
			throw new TypeError(`State-machine graph source field ${key} must be nonempty text.`);
	if (record.schemaVersion !== STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION)
		throw new TypeError('Unsupported state-machine graph request schema version.');
	if (record.operationVersion !== STATE_MACHINE_GRAPH_OPERATION_VERSION)
		throw new TypeError('Unsupported state-machine graph operation version.');
	return {
		...record,
		budgets: { ...budgets },
		source: { ...source }
	} as unknown as BuildStateMachineGraphRequest;
}

function compareId(left: { readonly id: string }, right: { readonly id: string }): number {
	return compareText(left.id, right.id);
}

function makeIndexes(
	nodes: readonly StateMachineGraphNode[],
	edges: readonly StateMachineGraphEdge[],
	direction: 'FORWARD' | 'REVERSE'
): StateMachineGraphIndexEntry[] {
	const byNode = new Map(nodes.map((node) => [node.id, [] as StateMachineGraphEdge['id'][]]));
	for (const edge of edges) {
		const nodeId = direction === 'FORWARD' ? edge.source.nodeId : edge.target.nodeId;
		byNode.get(nodeId)?.push(edge.id);
	}
	const entries = [...byNode.entries()].map(([nodeId, edgeIds]) => {
		edgeIds.sort(compareText);
		return { edgeIds, nodeId };
	});
	entries.sort((left, right) => compareText(left.nodeId, right.nodeId));
	return entries;
}

function coverageFor(
	observation: StateMachineTopologyObservation,
	nodes: readonly StateMachineGraphNode[],
	edges: readonly StateMachineGraphEdge[]
): StateMachineGraphCoverage {
	const count = (kind: StateMachineGraphRelationKind): number =>
		edges.filter((edge) => edge.relationKind === kind).length;
	const coverage = {
		crossAxisRuleEdges: count('DECLARES_CROSS_AXIS_RULE'),
		expectedCrossAxisRules: observation.crossAxisRules.length,
		expectedExplicitlyIllegalTransitions: observation.explicitlyIllegalTransitions.length,
		expectedGuardedTransitions: observation.guardedTransitions.length,
		expectedLegalTransitions:
			observation.legalTransitions.length -
			new Set(observation.guardedTransitions.map((item) => item.legalTransitionId)).size,
		expectedMachines: observation.machines.length,
		expectedStates: observation.states.length,
		explicitlyIllegalTransitionEdges: count('EXPLICITLY_ILLEGAL_TRANSITION'),
		guardedLegalTransitionEdges: count('GUARDED_LEGAL_TRANSITION'),
		legalTransitionEdges: count('LEGAL_TRANSITION'),
		machineNodes: nodes.filter((node) => node.kind === 'MACHINE').length,
		reconciles: false,
		stateContainmentEdges: count('CONTAINS_STATE'),
		stateNodes: nodes.filter((node) => node.kind === 'STATE').length
	};
	return {
		...coverage,
		reconciles:
			coverage.crossAxisRuleEdges === coverage.expectedCrossAxisRules &&
			coverage.explicitlyIllegalTransitionEdges === coverage.expectedExplicitlyIllegalTransitions &&
			coverage.guardedLegalTransitionEdges === coverage.expectedGuardedTransitions &&
			coverage.legalTransitionEdges === coverage.expectedLegalTransitions &&
			coverage.machineNodes === coverage.expectedMachines &&
			coverage.stateContainmentEdges === coverage.expectedStates &&
			coverage.stateNodes === coverage.expectedStates
	};
}

function requestRefusal(error: unknown): StateMachineGraphBuildOutcome {
	return unavailable(
		'REQUEST_INVALID',
		error instanceof Error ? error.message : 'Invalid state-machine graph request.',
		'REQUEST'
	);
}

function projectionRefusal(error: unknown): StateMachineGraphBuildOutcome {
	return unavailable(
		'GRAPH_VALIDATION_FAILED',
		error instanceof Error
			? `State-machine graph projection failed closed: ${error.message}`
			: 'State-machine graph projection failed closed.',
		'PROJECT'
	);
}

function capabilityRefusal(snapshot: StaticSemanticSnapshot): GraphRefusal {
	for (const capability of ['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL'] as const) {
		const state = snapshot.capabilities.find((record) => record.capability === capability)?.state;
		if (state === undefined || state === 'UNSUPPORTED')
			return unavailable(
				'SEMANTIC_CAPABILITY_UNAVAILABLE',
				`${capability} is required.`,
				'PROJECT',
				'$.capabilities'
			);
	}
	return null;
}

function bindingRefusal(
	request: BuildStateMachineGraphRequest,
	snapshot: StaticSemanticSnapshot,
	observation: StateMachineTopologyObservation
): GraphRefusal {
	if (request.semanticSnapshotId !== snapshot.id)
		return unavailable(
			'SEMANTIC_SNAPSHOT_ID_MISMATCH',
			'The semantic snapshot IDs do not match.',
			'REQUEST',
			'$.semanticSnapshotId'
		);
	if (request.subjectId !== snapshot.subjectId || observation.subjectId !== snapshot.subjectId)
		return unavailable(
			'SUBJECT_ID_MISMATCH',
			'The subject IDs do not match.',
			'REQUEST',
			'$.subjectId'
		);
	if (request.observationId !== observation.id)
		return unavailable(
			'OBSERVATION_ID_MISMATCH',
			'The observation ID does not match.',
			'REQUEST',
			'$.observationId'
		);
	const observationValidation = validateStateMachineTopologyObservation(observation);
	if (observationValidation.state !== 'VALID')
		return unavailable(
			'OBSERVATION_INVALID',
			observationValidation.issues[0]?.message ?? 'The topology observation is invalid.',
			'VALIDATE',
			observationValidation.issues[0]?.path ?? '$.observation'
		);
	return capabilityRefusal(snapshot);
}

function budgetRefusal(
	request: BuildStateMachineGraphRequest,
	observation: StateMachineTopologyObservation
): GraphRefusal {
	const guardedLegalTransitionIds = new Set(
		observation.guardedTransitions.map((item) => item.legalTransitionId)
	);
	const prospectiveNodeCount =
		observation.machines.length + observation.states.length + observation.crossAxisRules.length;
	const prospectiveEdgeCount =
		observation.states.length +
		observation.legalTransitions.length -
		guardedLegalTransitionIds.size +
		observation.guardedTransitions.length +
		observation.explicitlyIllegalTransitions.length +
		observation.crossAxisRules.length;
	if (
		prospectiveNodeCount > request.budgets.maxNodes ||
		prospectiveEdgeCount > request.budgets.maxEdges
	)
		return unavailable(
			'BUDGET_EXHAUSTED',
			'State-machine graph population exceeds the caller-supplied operation budget.',
			'REQUEST',
			'$.budgets'
		);
	return null;
}

/** The one semantic source that binds exactly to both the request and the observation. */
function boundSource(
	request: BuildStateMachineGraphRequest,
	snapshot: StaticSemanticSnapshot,
	observation: StateMachineTopologyObservation
): StaticSemanticSnapshot['sources'][number] | undefined {
	const source = snapshot.sources.find(
		(candidate) => candidate.id === request.source.semanticSourceId
	);
	if (source === undefined) return undefined;
	if (
		source.logicalPath !== request.source.logicalPath ||
		source.projectId !== request.source.projectId ||
		source.programId !== request.source.programId ||
		source.logicalPath !== observation.artifact.path ||
		source.bytes !== observation.artifact.bytes ||
		source.contentSha256 !== observation.artifact.sha256 ||
		source.origin !== 'GENERATED'
	)
		return undefined;
	return source;
}

function buildMachineNodes(
	context: ProjectionContext,
	observation: StateMachineTopologyObservation
): StateMachineGraphNode[] {
	const { graphId, layerId, location, provenanceIds, snapshot } = context;
	return observation.machines.map((machine) => ({
		epistemic: GRAPH_EPISTEMIC,
		graphId,
		id: stateMachineGraphMachineNodeId(graphId, machine.id),
		initialState: machine.initialState,
		kind: 'MACHINE',
		layerId,
		name: machine.name,
		observationMachineId: machine.id,
		provenanceIds,
		semanticSnapshotId: snapshot.id,
		sourceLocations: location(machine.span),
		sourceSection: machine.sourceSection,
		subjectId: snapshot.subjectId,
		terminalStates: machine.terminalStates
	}));
}

function machineNodeIndex(nodes: readonly StateMachineGraphNode[]) {
	const index = new Map<MachineNode['observationMachineId'], MachineNode>();
	for (const node of nodes) {
		if (node.kind === 'MACHINE') index.set(node.observationMachineId, node);
	}
	return index;
}

function stateNodeIndex(nodes: readonly StateMachineGraphNode[]) {
	const index = new Map<StateNode['observationStateId'], StateNode>();
	for (const node of nodes) {
		if (node.kind === 'STATE') index.set(node.observationStateId, node);
	}
	return index;
}

function frontierNodeIndex(nodes: readonly StateMachineGraphNode[]) {
	const index = new Map<FrontierNode['observationRuleId'], FrontierNode>();
	for (const node of nodes) {
		if (node.kind === 'CROSS_AXIS_FRONTIER') index.set(node.observationRuleId, node);
	}
	return index;
}

function appendStateNodes(
	context: ProjectionContext,
	observation: StateMachineTopologyObservation,
	machineNodeByObservationId: ReadonlyMap<MachineNode['observationMachineId'], MachineNode>,
	nodes: StateMachineGraphNode[]
): void {
	const { graphId, layerId, location, provenanceIds, snapshot } = context;
	for (const state of observation.states) {
		const machine = machineNodeByObservationId.get(state.machineId);
		if (machine === undefined) throw new Error(`State ${state.id} has no machine.`);
		nodes.push({
			epistemic: GRAPH_EPISTEMIC,
			graphId,
			id: stateMachineGraphStateNodeId(graphId, state.id),
			initial: state.initial,
			kind: 'STATE',
			layerId,
			machineNodeId: machine.id,
			name: state.name,
			observationStateId: state.id,
			ordinal: state.ordinal,
			provenanceIds,
			semanticSnapshotId: snapshot.id,
			sourceLocations: location(state.span),
			subjectId: snapshot.subjectId,
			terminal: state.terminal
		});
	}
}

function appendCrossAxisFrontierNodes(
	context: ProjectionContext,
	observation: StateMachineTopologyObservation,
	nodes: StateMachineGraphNode[]
): void {
	const { graphId, layerId, location, provenanceIds, snapshot } = context;
	for (const rule of observation.crossAxisRules)
		nodes.push({
			epistemic: GRAPH_EPISTEMIC,
			from: rule.from,
			graphId,
			id: stateMachineGraphCrossAxisFrontierNodeId(graphId, rule.id),
			kind: 'CROSS_AXIS_FRONTIER',
			layerId,
			machineName: rule.machineName,
			observationRuleId: rule.id,
			provenanceIds,
			reason: rule.reason,
			semanticSnapshotId: snapshot.id,
			sourceLocations: location(rule.span),
			subjectId: snapshot.subjectId,
			to: rule.to
		});
}

function makeAddEdge(context: ProjectionContext, edges: StateMachineGraphEdge[]): AddEdge {
	const { graphId, layerId, location, provenanceIds, snapshot } = context;
	return (relationKind, observationRecordId, sourceEndpoint, targetEndpoint, spans, fields) => {
		const edge = {
			...fields,
			epistemic: GRAPH_EPISTEMIC,
			graphId,
			layerId,
			method: STATE_MACHINE_GRAPH_METHOD,
			observationRecordId,
			provenanceIds,
			relationCode: RELATION_CODES[relationKind],
			relationKind,
			semanticSnapshotId: snapshot.id,
			source: sourceEndpoint,
			sourceLocations: spans.flatMap(location),
			subjectId: snapshot.subjectId,
			target: targetEndpoint
		};
		edges.push({
			...edge,
			id: stateMachineGraphEdgeId({
				graph: graphId,
				observationRecordId,
				relationKind,
				source: sourceEndpoint,
				target: targetEndpoint
			})
		});
	};
}

function appendContainmentEdges(
	observation: StateMachineTopologyObservation,
	machineNodeByObservationId: ReadonlyMap<MachineNode['observationMachineId'], MachineNode>,
	stateNodeByObservationId: ReadonlyMap<StateNode['observationStateId'], StateNode>,
	addEdge: AddEdge
): void {
	for (const state of observation.states) {
		const machine = machineNodeByObservationId.get(state.machineId)!;
		const target = stateNodeByObservationId.get(state.id)!;
		addEdge(
			'CONTAINS_STATE',
			state.id,
			{ kind: 'MACHINE', nodeId: machine.id },
			{ kind: 'STATE', nodeId: target.id },
			[state.span],
			{ guard: null, note: null, reason: null, trigger: null }
		);
	}
}

function appendTransitionEdges(
	observation: StateMachineTopologyObservation,
	stateNodeByObservationId: ReadonlyMap<StateNode['observationStateId'], StateNode>,
	addEdge: AddEdge
): void {
	const guardedByLegalId = new Map<
		StateMachineTopologyObservation['legalTransitions'][number]['id'],
		StateMachineTopologyObservation['guardedTransitions'][number][]
	>();
	for (const guarded of observation.guardedTransitions) {
		const records = guardedByLegalId.get(guarded.legalTransitionId) ?? [];
		records.push(guarded);
		guardedByLegalId.set(guarded.legalTransitionId, records);
	}
	for (const transition of observation.legalTransitions) {
		const guardedRecords = guardedByLegalId.get(transition.id) ?? [];
		const sourceEndpoint = {
			kind: 'STATE' as const,
			nodeId: stateNodeByObservationId.get(transition.fromStateId)!.id
		};
		const targetEndpoint = {
			kind: 'STATE' as const,
			nodeId: stateNodeByObservationId.get(transition.toStateId)!.id
		};
		if (guardedRecords.length === 0)
			addEdge(
				'LEGAL_TRANSITION',
				transition.id,
				sourceEndpoint,
				targetEndpoint,
				[transition.span],
				{
					guard: transition.guard,
					note: transition.note,
					reason: null,
					trigger: transition.trigger
				}
			);
		else
			for (const guarded of guardedRecords)
				addEdge(
					'GUARDED_LEGAL_TRANSITION',
					guarded.id,
					sourceEndpoint,
					targetEndpoint,
					[transition.span, guarded.span],
					{
						guard: transition.guard,
						note: transition.note,
						reason: guarded.reason,
						trigger: transition.trigger
					}
				);
	}
}

function appendIllegalTransitionEdges(
	observation: StateMachineTopologyObservation,
	stateNodeByObservationId: ReadonlyMap<StateNode['observationStateId'], StateNode>,
	addEdge: AddEdge
): void {
	for (const transition of observation.explicitlyIllegalTransitions)
		addEdge(
			'EXPLICITLY_ILLEGAL_TRANSITION',
			transition.id,
			{ kind: 'STATE', nodeId: stateNodeByObservationId.get(transition.fromStateId)!.id },
			{ kind: 'STATE', nodeId: stateNodeByObservationId.get(transition.toStateId)!.id },
			[transition.span],
			{ guard: null, note: null, reason: transition.reason, trigger: null }
		);
}

function appendCrossAxisEdges(
	observation: StateMachineTopologyObservation,
	machineNodeByObservationId: ReadonlyMap<MachineNode['observationMachineId'], MachineNode>,
	frontierByRuleId: ReadonlyMap<FrontierNode['observationRuleId'], FrontierNode>,
	addEdge: AddEdge
): void {
	for (const rule of observation.crossAxisRules) {
		const machine = machineNodeByObservationId.get(rule.machineId)!;
		const frontier = frontierByRuleId.get(rule.id)!;
		addEdge(
			'DECLARES_CROSS_AXIS_RULE',
			rule.id,
			{ kind: 'MACHINE', nodeId: machine.id },
			{ kind: 'CROSS_AXIS_FRONTIER', nodeId: frontier.id },
			[rule.span],
			{ guard: null, note: null, reason: rule.reason, trigger: null }
		);
	}
}

function graphLimitations(snapshot: StaticSemanticSnapshot) {
	if (snapshot.health === 'PARTIAL')
		return [
			...LIMITATIONS,
			{
				kind: 'SEMANTIC_INPUT_PARTIAL' as const,
				reason: 'The selected semantic snapshot is partial.'
			}
		];
	return [...LIMITATIONS];
}

function graphValidationRefusal(
	graph: StateMachineGraphSnapshot,
	request: BuildStateMachineGraphRequest,
	snapshot: StaticSemanticSnapshot,
	observation: StateMachineTopologyObservation
): GraphRefusal {
	const validation = validateConstructedStateMachineGraph(graph, request, snapshot, observation);
	if (validation.state !== 'VALID')
		return unavailable(
			'GRAPH_VALIDATION_FAILED',
			validation.issues[0]?.message ?? 'State-machine graph validation failed.',
			'VALIDATE',
			validation.issues[0]?.path ?? null
		);
	return null;
}

export function buildStateMachineGraph(
	requestValue: unknown,
	snapshot: StaticSemanticSnapshot,
	observation: StateMachineTopologyObservation
): StateMachineGraphBuildOutcome {
	let request: BuildStateMachineGraphRequest;
	try {
		request = materializeRequest(requestValue);
	} catch (error) {
		return requestRefusal(error);
	}
	const bindingRefused = bindingRefusal(request, snapshot, observation);
	if (bindingRefused !== null) return bindingRefused;
	try {
		const budgetRefused = budgetRefusal(request, observation);
		if (budgetRefused !== null) return budgetRefused;
		const source = boundSource(request, snapshot, observation);
		if (source === undefined)
			return unavailable(
				'SOURCE_BINDING_MISMATCH',
				'The observation and selected semantic source do not bind exactly.',
				'PROJECT',
				'$.source'
			);
		const provenanceIds = [source.provenanceId, source.syntaxProvenanceId]
			.filter((id): id is SemanticProvenanceId => id !== null)
			.sort(compareText);
		const graphInputDigest = stateMachineGraphInputDigest(request, snapshot, observation);
		const graphId = stateMachineGraphId({
			canonicalProfile: STATE_MACHINE_GRAPH_CANONICAL_PROFILE,
			graphInputDigest,
			graphKind: 'JPWB_GENERATED_STATE_MACHINE_TOPOLOGY',
			method: STATE_MACHINE_GRAPH_METHOD,
			observationId: observation.id,
			operationVersion: STATE_MACHINE_GRAPH_OPERATION_VERSION,
			schemaVersion: STATE_MACHINE_GRAPH_SCHEMA_VERSION,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		});
		const layerId = stateMachineGraphLayerId(graphId, 'JPWB_GENERATED_STATE_MACHINE_TOPOLOGY', 0);
		const context: ProjectionContext = {
			graphId,
			layerId,
			location: (span) => [{ end: span.end, sourceId: source.id, start: span.start }],
			provenanceIds,
			snapshot
		};
		const nodes = buildMachineNodes(context, observation);
		const machineNodeByObservationId = machineNodeIndex(nodes);
		appendStateNodes(context, observation, machineNodeByObservationId, nodes);
		appendCrossAxisFrontierNodes(context, observation, nodes);
		nodes.sort(compareId);
		const stateNodeByObservationId = stateNodeIndex(nodes);
		const frontierByRuleId = frontierNodeIndex(nodes);
		const edges: StateMachineGraphEdge[] = [];
		const addEdge = makeAddEdge(context, edges);
		appendContainmentEdges(
			observation,
			machineNodeByObservationId,
			stateNodeByObservationId,
			addEdge
		);
		appendTransitionEdges(observation, stateNodeByObservationId, addEdge);
		appendIllegalTransitionEdges(observation, stateNodeByObservationId, addEdge);
		appendCrossAxisEdges(observation, machineNodeByObservationId, frontierByRuleId, addEdge);
		edges.sort(compareId);
		const limitations = graphLimitations(snapshot);
		const coverage = coverageFor(observation, nodes, edges);
		if (!coverage.reconciles) throw new Error('State-machine graph coverage failed to reconcile.');
		const layer = {
			capability: STATE_MACHINE_GRAPH_CAPABILITY,
			capabilityStatus: STATE_MACHINE_GRAPH_CAPABILITY_STATUS,
			coverage,
			edgeIds: edges.map((edge) => edge.id),
			epistemic: GRAPH_EPISTEMIC,
			graphId,
			id: layerId,
			kind: 'JPWB_GENERATED_STATE_MACHINE_TOPOLOGY' as const,
			limitations,
			method: STATE_MACHINE_GRAPH_METHOD,
			nodeIds: nodes.map((node) => node.id),
			ordinal: 0 as const,
			producer: snapshot.provider,
			provenanceIds,
			semanticSnapshotId: snapshot.id,
			scope: STATE_MACHINE_GRAPH_SCOPE,
			subjectId: snapshot.subjectId
		};
		const content = {
			budgets: request.budgets,
			canonicalProfile: STATE_MACHINE_GRAPH_CANONICAL_PROFILE,
			capability: STATE_MACHINE_GRAPH_CAPABILITY,
			capabilityStatus: STATE_MACHINE_GRAPH_CAPABILITY_STATUS,
			closure: 'OPEN' as const,
			coverage,
			edges,
			epistemic: GRAPH_EPISTEMIC,
			forwardIndex: makeIndexes(nodes, edges, 'FORWARD'),
			fullJanCsaa007Conformance: FULL_JAN_CSAA_007_CONFORMANCE,
			fullJanCsaa008Conformance: FULL_JAN_CSAA_008_CONFORMANCE,
			graphInputDigest,
			graphKind: 'JPWB_GENERATED_STATE_MACHINE_TOPOLOGY' as const,
			health: 'PARTIAL' as const,
			id: graphId,
			layers: [layer] as const,
			limitations,
			method: STATE_MACHINE_GRAPH_METHOD,
			nodes,
			observationId: observation.id,
			operationVersion: STATE_MACHINE_GRAPH_OPERATION_VERSION,
			producer: snapshot.provider,
			registryStatus: STATE_MACHINE_GRAPH_REGISTRY_STATUS,
			reverseIndex: makeIndexes(nodes, edges, 'REVERSE'),
			schemaVersion: STATE_MACHINE_GRAPH_SCHEMA_VERSION,
			semanticExtractionVersion: snapshot.extractionVersion,
			semanticSchemaVersion: snapshot.schemaVersion,
			semanticSnapshotId: snapshot.id,
			scope: STATE_MACHINE_GRAPH_SCOPE,
			source: request.source,
			subjectId: snapshot.subjectId,
			verifierAuthority: STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY
		};
		const graph: StateMachineGraphSnapshot = {
			...content,
			contentDigest: stateMachineGraphContentDigest(content)
		};
		const validationRefused = graphValidationRefusal(graph, request, snapshot, observation);
		if (validationRefused !== null) return validationRefused;
		return {
			diagnostics: [
				diagnostic(
					'GRAPH_PARTIAL',
					'Generated runtime topology is projected with explicit authority and behavioral limitations.',
					'PROJECT'
				)
			],
			graph,
			outcome: 'partial'
		};
	} catch (error) {
		return projectionRefusal(error);
	}
}
