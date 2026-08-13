import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { ArrowCommandCensusObservation } from '../contracts/arrow-command-census.js';
import {
	COMMAND_DISPATCH_TOPOLOGY_AUTHORITY_TRANSFER,
	COMMAND_DISPATCH_TOPOLOGY_BASELINE_CHANGE,
	COMMAND_DISPATCH_TOPOLOGY_COMMAND_HANDLER_POPULATION_TREATMENT,
	COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_007_CONFORMANCE,
	COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_008_CONFORMANCE,
	COMMAND_DISPATCH_TOPOLOGY_GATE_EFFECT,
	COMMAND_DISPATCH_TOPOLOGY_GRAPH_AUTHORITY,
	COMMAND_DISPATCH_TOPOLOGY_ORACLE_CHANGE,
	COMMAND_DISPATCH_TOPOLOGY_REPLACEMENT_EQUIVALENCE,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_EXECUTION,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_VERIFIER_AUTHORITY,
	COMMAND_DISPATCH_TOPOLOGY_RUNTIME_DISPATCH_CLOSURE,
	COMMAND_DISPATCH_TOPOLOGY_RUNTIME_PERFORMABILITY,
	type CommandDispatchTopologyBuildDiagnosticCode,
	type CommandDispatchTopologySnapshot,
	type CommandDispatchTopologyValidationIssueCode
} from '../contracts/command-dispatch-topology.js';
import type { FrozenSubject } from '../contracts/subject.js';
import { attachFrozenSubjectBytes, readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import { buildCommandDispatchTopology } from './build-command-dispatch-topology.js';
import { commandDispatchTopologyContentDigest } from './command-dispatch-topology-canonical.js';
import {
	createCommandDispatchTopologyFixture,
	type CommandDispatchTopologyFixture
} from './command-dispatch-topology-fixture.test-support.js';
import { validateCommandDispatchTopology } from './validate-command-dispatch-topology.js';

const cleanups: Array<() => void> = [];

afterEach(() => {
	for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function fixture(): CommandDispatchTopologyFixture {
	const value = createCommandDispatchTopologyFixture();
	cleanups.push(value.cleanup);
	return value;
}

function build(
	value: CommandDispatchTopologyFixture,
	request: unknown = value.dispatchRequest,
	observation: ArrowCommandCensusObservation = value.observation,
	subject: FrozenSubject = value.subject
): CommandDispatchTopologySnapshot {
	const outcome = buildCommandDispatchTopology(
		request,
		value.snapshot,
		value.commandHandlerGraph,
		observation,
		subject
	);
	if (outcome.outcome !== 'partial')
		throw new Error(`Fixture topology construction failed: ${JSON.stringify(outcome)}`);
	return outcome.graph;
}

function redigested(
	graph: CommandDispatchTopologySnapshot,
	mutate: (draft: CommandDispatchTopologySnapshot) => void
): CommandDispatchTopologySnapshot {
	const draft = structuredClone(graph) as CommandDispatchTopologySnapshot;
	mutate(draft);
	(draft as { contentDigest: string }).contentDigest = commandDispatchTopologyContentDigest(draft);
	return draft;
}

function expectInvalid(
	value: CommandDispatchTopologyFixture,
	graph: unknown,
	code: CommandDispatchTopologyValidationIssueCode
): void {
	expect(
		validateCommandDispatchTopology(
			graph,
			value.dispatchRequest,
			value.snapshot,
			value.commandHandlerGraph,
			value.observation,
			value.subject
		)
	).toMatchObject({
		issues: expect.arrayContaining([expect.objectContaining({ code })]),
		state: 'INVALID'
	});
}

function expectUnavailable(
	value: CommandDispatchTopologyFixture,
	code: CommandDispatchTopologyBuildDiagnosticCode,
	request: unknown = value.dispatchRequest,
	observation: ArrowCommandCensusObservation = value.observation,
	subject: FrozenSubject = value.subject
): void {
	expect(
		buildCommandDispatchTopology(
			request,
			value.snapshot,
			value.commandHandlerGraph,
			observation,
			subject
		)
	).toMatchObject({
		diagnostics: expect.arrayContaining([expect.objectContaining({ code })]),
		outcome: 'unavailable'
	});
}

describe('buildCommandDispatchTopology', { timeout: 15_000 }, () => {
	it('builds the exact static pipeline overlay, preserves candidate attribution, and passes public validation', () => {
		const value = fixture();
		const outcome = buildCommandDispatchTopology(
			value.dispatchRequest,
			value.snapshot,
			value.commandHandlerGraph,
			value.observation,
			value.subject
		);
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'GRAPH_PARTIAL', path: null, phase: 'VALIDATE' }],
			outcome: 'partial'
		});
		if (outcome.outcome !== 'partial') throw new Error('Expected a partial topology.');
		const { graph } = outcome;

		expect(graph.nodes).toHaveLength(1);
		expect(graph.nodes[0]).toMatchObject({
			attribution: 'EXACT_STATIC_SYNTAX',
			commandBusDeclarationId: value.commandBusSelector.declarationId,
			kind: 'STATIC_DISPATCH_PIPELINE',
			methodName: 'dispatchStamped',
			programId: value.commandBusSelector.programId,
			projectId: value.commandBusSelector.projectId,
			sourceId: value.commandBusSelector.sourceId
		});
		expect(graph.nodes[0]!.commandsLookup.registryName).toBe('COMMANDS');
		expect(graph.nodes[0]!.handlersLookup.registryName).toBe('HANDLERS');
		expect(graph.edges).toHaveLength(1);
		expect(graph.edges[0]).toMatchObject({
			attribution: 'CANDIDATE',
			registeredCommandNames: ['StartWork'],
			relationCode: 'IMPL-JPWB-CD-DISPATCH-TARGET-001',
			relationKind: 'STATIC_DISPATCH_PIPELINE_TO_HANDLER_TARGET',
			source: { kind: 'STATIC_DISPATCH_PIPELINE' },
			target: { kind: 'HANDLER_TARGET' }
		});
		expect(graph.edges[0]!.inferenceBasis.limitationKinds).toEqual([
			'HANDLER_TARGET_EDGES_ARE_CANDIDATE_ONLY',
			'CONTROL_FLOW_AND_PATH_FEASIBILITY_NOT_ANALYZED',
			'RUNTIME_DISPATCH_NOT_CLAIMED'
		]);
		expect(graph.coverage).toMatchObject({
			candidateHandlerTargetEdges: 1,
			commandHandlerGraphHandlerTargets: 1,
			commandsLookupAssignments: 1,
			duplicatedCommandHandlerNodes: 0,
			duplicatedCommandRegistryEntries: 0,
			duplicatedHandlerRegistrations: 0,
			handlerInvocations: 1,
			handlersLookupAssignments: 1,
			missingHandlerGuards: 1,
			payloadValidationInvocations: 1,
			pipelineNodes: 1,
			reconciles: true,
			referencedHandlerTargets: 1,
			representedPipelineFacts: 5,
			unresolvedHandlerTargets: 0
		});
		expect(graph.commandHandlerPopulationTreatment).toBe(
			COMMAND_DISPATCH_TOPOLOGY_COMMAND_HANDLER_POPULATION_TREATMENT
		);
		expect(graph.retainedCommandDispatchCensus).toMatchObject({
			artifactContentSha256: value.subject.artifacts.find(
				(artifact) => artifact.path === COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH
			)?.sha256,
			artifactPath: COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH,
			authorityTransfer: COMMAND_DISPATCH_TOPOLOGY_AUTHORITY_TRANSFER,
			execution: COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_EXECUTION,
			gateEffect: COMMAND_DISPATCH_TOPOLOGY_GATE_EFFECT,
			integration: COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION,
			oracleChange: COMMAND_DISPATCH_TOPOLOGY_ORACLE_CHANGE,
			replacementEquivalence: COMMAND_DISPATCH_TOPOLOGY_REPLACEMENT_EQUIVALENCE,
			verifierAuthority: COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_VERIFIER_AUTHORITY
		});
		expect(graph).toMatchObject({
			authorityTransfer: COMMAND_DISPATCH_TOPOLOGY_AUTHORITY_TRANSFER,
			baselineChange: COMMAND_DISPATCH_TOPOLOGY_BASELINE_CHANGE,
			fullJanCsaa007Conformance: COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_007_CONFORMANCE,
			fullJanCsaa008Conformance: COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_008_CONFORMANCE,
			gateEffect: COMMAND_DISPATCH_TOPOLOGY_GATE_EFFECT,
			graphAuthority: COMMAND_DISPATCH_TOPOLOGY_GRAPH_AUTHORITY,
			health: 'PARTIAL',
			oracleChange: COMMAND_DISPATCH_TOPOLOGY_ORACLE_CHANGE,
			replacementEquivalence: COMMAND_DISPATCH_TOPOLOGY_REPLACEMENT_EQUIVALENCE,
			runtimeDispatchClosure: COMMAND_DISPATCH_TOPOLOGY_RUNTIME_DISPATCH_CLOSURE,
			runtimePerformability: COMMAND_DISPATCH_TOPOLOGY_RUNTIME_PERFORMABILITY
		});
		expect(
			validateCommandDispatchTopology(
				graph,
				value.dispatchRequest,
				value.snapshot,
				value.commandHandlerGraph,
				value.observation,
				value.subject
			)
		).toEqual({ issues: [], state: 'VALID' });
	});

	it('is deterministic for the same exact inputs', () => {
		const value = fixture();
		expect(build(value)).toEqual(build(value));
	});

	it('fails closed at one below the consumed AST and source-byte populations', () => {
		const value = fixture();
		const selectedSource = value.snapshot.sources.find(
			(source) => source.id === value.commandBusSelector.sourceId
		)!;
		const selectedAstNodes = value.snapshot.astNodes.length;
		const sourceBytes = value.subject.artifacts.find(
			(artifact) => artifact.path === selectedSource.logicalPath
		)!.bytes;
		for (const budgets of [
			{ ...value.dispatchRequest.budgets, maxAstNodes: selectedAstNodes - 1 },
			{ ...value.dispatchRequest.budgets, maxSourceBytes: sourceBytes - 1 }
		])
			expectUnavailable(value, 'BUDGET_EXCEEDED', {
				...value.dispatchRequest,
				budgets
			});
	});

	it('rejects stale request identities and a mismatched exact selector', () => {
		const value = fixture();
		for (const [code, request] of [
			[
				'SUBJECT_ID_MISMATCH',
				{ ...value.dispatchRequest, subjectId: `stale-${value.dispatchRequest.subjectId}` }
			],
			[
				'SEMANTIC_SNAPSHOT_ID_MISMATCH',
				{
					...value.dispatchRequest,
					semanticSnapshotId: `stale-${value.dispatchRequest.semanticSnapshotId}`
				}
			],
			[
				'COMMAND_HANDLER_GRAPH_ID_MISMATCH',
				{
					...value.dispatchRequest,
					commandHandlerGraphId: `stale-${value.dispatchRequest.commandHandlerGraphId}`
				}
			],
			[
				'COMMAND_BUS_SELECTOR_MISMATCH',
				{
					...value.dispatchRequest,
					commandBus: { ...value.dispatchRequest.commandBus, contentSha256: 'f'.repeat(64) }
				}
			]
		] as const)
			expectUnavailable(value, code, request);
	});

	it('detects a corrupted digest even when all other populations are unchanged', () => {
		const value = fixture();
		const graph = structuredClone(build(value)) as CommandDispatchTopologySnapshot;
		(graph as { contentDigest: string }).contentDigest = '0'.repeat(64);
		expectInvalid(value, graph, 'CONTENT_DIGEST_MISMATCH');
	});

	it('independently rejects repaired semantic population, index, layer, and coverage corruption', () => {
		const value = fixture();
		const graph = build(value);
		expectInvalid(
			value,
			redigested(graph, (draft) => {
				(draft.nodes[0]!.commandsLookup as { targetNodeId: string }).targetNodeId =
					draft.nodes[0]!.handlersLookup.targetNodeId;
			}),
			'POPULATION_MISMATCH'
		);
		expectInvalid(
			value,
			redigested(graph, (draft) => {
				(draft.forwardIndex[0]!.edgeIds as unknown as string[]).splice(0);
			}),
			'NONCANONICAL_ORDER'
		);
		expectInvalid(
			value,
			redigested(graph, (draft) => {
				(draft.layers[1].edgeIds as unknown as string[]).splice(0);
			}),
			'RECONCILIATION_MISMATCH'
		);
		expectInvalid(
			value,
			redigested(graph, (draft) => {
				(draft.coverage as { referencedHandlerTargets: number }).referencedHandlerTargets = 0;
			}),
			'RECONCILIATION_MISMATCH'
		);
	});

	it('rejects a dropped candidate even after its derived views and digest are repaired', () => {
		const value = fixture();
		const graph = redigested(build(value), (draft) => {
			const removedId = draft.edges[0]!.id;
			(draft as unknown as { edges: unknown[] }).edges = [];
			for (const index of [...draft.forwardIndex, ...draft.reverseIndex])
				(index.edgeIds as unknown as string[]).splice(
					0,
					index.edgeIds.length,
					...index.edgeIds.filter((id) => id !== removedId)
				);
			(draft.layers[1].edgeIds as unknown as string[]).splice(0);
			(draft.layers[1].provenanceIds as unknown as string[]).splice(0);
			Object.assign(draft.coverage as object, {
				candidateHandlerTargetEdges: 0,
				referencedHandlerTargets: 0,
				unresolvedHandlerTargets: 1
			});
			for (const layer of draft.layers)
				(layer as unknown as { coverage: typeof draft.coverage }).coverage = draft.coverage;
		});
		expectInvalid(value, graph, 'POPULATION_MISMATCH');
	});

	it('rejects promotion of a candidate handler-target edge to exact attribution', () => {
		const value = fixture();
		const graph = redigested(build(value), (draft) => {
			(draft.edges[0] as unknown as { attribution: string }).attribution = 'EXACT';
		});
		expectInvalid(value, graph, 'INVALID_VALUE');
	});

	it('rejects a mismatched predecessor arrow observation', () => {
		const value = fixture();
		const observation = {
			...value.observation,
			id: `stale-${value.observation.id}`
		} as ArrowCommandCensusObservation;
		expectUnavailable(value, 'ARROW_OBSERVATION_MISMATCH', value.dispatchRequest, observation);
	});

	it('rejects a retained census whose frozen metadata no longer matches its exact bytes', () => {
		const value = fixture();
		const subject = structuredClone(value.subject) as FrozenSubject;
		attachFrozenSubjectBytes(
			subject,
			new Map(
				value.subject.artifacts.map((artifact) => {
					const bytes = readFrozenSubjectArtifact(value.subject, artifact.path);
					if (bytes === undefined) throw new Error(`Missing frozen bytes for ${artifact.path}.`);
					return [artifact.path, bytes] as const;
				})
			)
		);
		const artifact = subject.artifacts.find(
			(candidate) => candidate.path === COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH
		)!;
		(artifact as { sha256: string }).sha256 = 'f'.repeat(64);
		expectUnavailable(
			value,
			'RETAINED_CENSUS_ARTIFACT_MISMATCH',
			value.dispatchRequest,
			value.observation,
			subject
		);
	});

	it('never executes the retained census module', () => {
		const value = fixture();
		const marker = join(value.root, 'retained-census-executed');
		writeFileSync(
			join(value.root, ...COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH.split('/')),
			`import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, 'executed');\nthrow new Error('retained census executed');\n`,
			'utf8'
		);
		expect(() => build(value)).not.toThrow();
		expect(existsSync(marker)).toBe(false);
	});
});
