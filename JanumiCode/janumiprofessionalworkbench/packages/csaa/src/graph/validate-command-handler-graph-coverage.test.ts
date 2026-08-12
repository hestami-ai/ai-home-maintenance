import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
	CommandHandlerGraphNode,
	CommandHandlerGraphSnapshot
} from '../contracts/command-handler-graph.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import type { FrozenSubject } from '../contracts/subject.js';
import { compareText } from '../inventory/canonical.js';
import { buildCommandHandlerGraph } from './build-command-handler-graph.js';
import { commandHandlerGraphContentDigest } from './command-handler-graph-canonical.js';
import {
	createCommandHandlerGraphFixture,
	createFactoryCommandHandlerGraphFixture,
	createSharedDirectCommandHandlerGraphFixture,
	type CommandHandlerGraphFixture
} from './command-handler-graph-fixture.test-support.js';
import {
	type CommandHandlerGraphValidationIssueCode,
	type CommandHandlerGraphValidationOptions,
	validateCommandHandlerGraph,
	validateConstructedCommandHandlerGraph
} from './validate-command-handler-graph.js';

let direct: CommandHandlerGraphFixture;
let directGraph: CommandHandlerGraphSnapshot;
let factory: CommandHandlerGraphFixture;
let factoryGraph: CommandHandlerGraphSnapshot;
let shared: CommandHandlerGraphFixture;
let sharedGraph: CommandHandlerGraphSnapshot;

function buildGraph(value: CommandHandlerGraphFixture): CommandHandlerGraphSnapshot {
	const outcome = buildCommandHandlerGraph(
		value.graphRequest,
		value.snapshot,
		value.observation,
		value.subject
	);
	if (outcome.outcome !== 'partial')
		throw new Error(`Fixture graph construction failed: ${JSON.stringify(outcome)}`);
	return outcome.graph;
}

beforeAll(() => {
	direct = createCommandHandlerGraphFixture();
	directGraph = buildGraph(direct);
	factory = createFactoryCommandHandlerGraphFixture();
	factoryGraph = buildGraph(factory);
	shared = createSharedDirectCommandHandlerGraphFixture();
	sharedGraph = buildGraph(shared);
}, 60_000);

afterAll(() => {
	shared.cleanup();
	factory.cleanup();
	direct.cleanup();
});

function finalized(
	graph: CommandHandlerGraphSnapshot,
	mutate: (draft: CommandHandlerGraphSnapshot) => void
): CommandHandlerGraphSnapshot {
	const draft = structuredClone(graph) as CommandHandlerGraphSnapshot;
	mutate(draft);
	(draft as { contentDigest: string }).contentDigest = commandHandlerGraphContentDigest(draft);
	return draft;
}

function expectIssue(
	graph: unknown,
	code: CommandHandlerGraphValidationIssueCode,
	value: CommandHandlerGraphFixture = direct,
	options?: CommandHandlerGraphValidationOptions
): void {
	const result = validateCommandHandlerGraph(
		graph,
		value.snapshot,
		value.observation,
		value.subject,
		options
	);
	expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
}

function expectSnapshotRejected(snapshot: StaticSemanticSnapshot): void {
	const result = validateCommandHandlerGraph(
		directGraph,
		snapshot,
		direct.observation,
		direct.subject
	);
	expect(result).toMatchObject({
		issues: expect.arrayContaining([expect.objectContaining({ code: 'SHAPE_INVALID' })]),
		state: 'INVALID'
	});
}

describe('command-handler graph validator defensive coverage', () => {
	it('requires exact plain validation options and admits a null-prototype option record', () => {
		const hidden = Object.defineProperty({}, 'maxIssues', {
			enumerable: false,
			value: 10
		});
		const accessor = Object.defineProperty({}, 'maxIssues', {
			enumerable: true,
			get: () => 10
		});
		const symbolKey = { maxIssues: 10 } as Record<PropertyKey, unknown>;
		symbolKey[Symbol('unsupported')] = true;

		for (const options of [
			null,
			new Proxy({}, {}),
			{ unsupported: true },
			hidden,
			accessor,
			symbolKey,
			{ maxIssues: 0 },
			{ maxRecords: Number.NaN },
			{ maxStringCharacters: 1.5 }
		]) {
			const result = validateCommandHandlerGraph(
				directGraph,
				direct.snapshot,
				direct.observation,
				direct.subject,
				options as CommandHandlerGraphValidationOptions
			);
			expect(result).toMatchObject({
				issues: [expect.objectContaining({ code: 'SHAPE_INVALID' })],
				state: 'INVALID'
			});
		}

		const nullPrototypeOptions = Object.assign(Object.create(null) as object, {
			maxIssues: 1_000,
			maxRecords: 1_000_000,
			maxStringCharacters: 100_000_000
		}) as CommandHandlerGraphValidationOptions;
		expect(
			validateCommandHandlerGraph(
				directGraph,
				direct.snapshot,
				direct.observation,
				direct.subject,
				nullPrototypeOptions
			)
		).toEqual({ issues: [], state: 'VALID' });
	});

	it('rejects non-JSON, cyclic, exotic, sparse, accessor, and symbol-bearing graph data', () => {
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		const symbolGraph = structuredClone(directGraph) as unknown as Record<PropertyKey, unknown>;
		symbolGraph[Symbol('hostile')] = true;
		const sparse: unknown[] = [];
		sparse.length = 3;
		const arrayWithProperty = structuredClone(directGraph) as CommandHandlerGraphSnapshot;
		Object.defineProperty(arrayWithProperty.nodes, 'extra', { enumerable: true, value: true });
		const hiddenProperty = structuredClone(directGraph) as CommandHandlerGraphSnapshot;
		Object.defineProperty(hiddenProperty, 'hidden', { enumerable: false, value: true });
		const accessorProperty = structuredClone(directGraph) as CommandHandlerGraphSnapshot;
		Object.defineProperty(accessorProperty, 'id', {
			enumerable: true,
			get: () => directGraph.id
		});

		for (const hostile of [
			undefined,
			Number.NaN,
			1n,
			() => undefined,
			cyclic,
			Object.create({ hostile: true }),
			symbolGraph,
			sparse,
			arrayWithProperty,
			hiddenProperty,
			accessorProperty
		]) {
			const result = validateCommandHandlerGraph(
				hostile,
				direct.snapshot,
				direct.observation,
				direct.subject
			);
			expect(result.state).toBe('INVALID');
			expect(result.issues[0]?.code).toBe('SHAPE_INVALID');
		}

		expect(
			validateCommandHandlerGraph('too long', direct.snapshot, direct.observation, direct.subject, {
				maxStringCharacters: 1
			})
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })],
			state: 'BUDGET_EXHAUSTED'
		});
		expect(
			validateCommandHandlerGraph(
				{ longPropertyName: null },
				direct.snapshot,
				direct.observation,
				direct.subject,
				{ maxStringCharacters: 1 }
			)
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })],
			state: 'BUDGET_EXHAUSTED'
		});
	});

	it('exercises constructed-graph inspection and fail-closed exception paths directly', () => {
		expect(
			validateConstructedCommandHandlerGraph(
				'too long',
				direct.snapshot,
				direct.observation,
				direct.subject,
				directGraph.graphInputDigest,
				{ maxStringCharacters: 1 }
			)
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })],
			state: 'BUDGET_EXHAUSTED'
		});
		expect(
			validateConstructedCommandHandlerGraph(
				null,
				direct.snapshot,
				direct.observation,
				direct.subject,
				directGraph.graphInputDigest
			)
		).toMatchObject({ issues: [expect.objectContaining({ code: 'SHAPE_INVALID' })] });
		expect(
			validateConstructedCommandHandlerGraph(
				{},
				direct.snapshot,
				direct.observation,
				direct.subject,
				directGraph.graphInputDigest
			)
		).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'FIELD_SET_INVALID' })])
		});

		const throwingSnapshot = new Proxy(direct.snapshot, {
			get: () => {
				throw 'non-error hostile snapshot';
			}
		});
		expect(
			validateConstructedCommandHandlerGraph(
				directGraph,
				throwingSnapshot,
				direct.observation,
				direct.subject,
				directGraph.graphInputDigest
			)
		).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'SHAPE_INVALID',
					message: 'Validation failed closed on hostile or malformed input.'
				})
			])
		});
	});

	it('fails closed when semantic identities and references are internally inconsistent', () => {
		const duplicateIdentity = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		(duplicateIdentity as unknown as { astNodes: StaticSemanticSnapshot['astNodes'] }).astNodes = [
			...duplicateIdentity.astNodes,
			structuredClone(duplicateIdentity.astNodes[0]!)
		];
		expectSnapshotRejected(duplicateIdentity);

		const duplicateProvenance = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		(
			duplicateProvenance as unknown as {
				provenances: StaticSemanticSnapshot['provenances'];
			}
		).provenances = [
			...duplicateProvenance.provenances,
			structuredClone(duplicateProvenance.provenances[0]!)
		];
		expectSnapshotRejected(duplicateProvenance);

		const danglingNodeSource = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		(danglingNodeSource.astNodes[0] as { sourceId: string }).sourceId = 'source:absent';
		expectSnapshotRejected(danglingNodeSource);

		const danglingParent = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		const child = danglingParent.astNodes.find((node) => node.parentId !== null);
		if (child === undefined) throw new Error('Expected a child AST node.');
		(child as { parentId: string }).parentId = 'node:absent';
		expectSnapshotRejected(danglingParent);

		const danglingDeclaration = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		(danglingDeclaration.declarations[0] as { sourceId: string }).sourceId = 'source:absent';
		expectSnapshotRejected(danglingDeclaration);

		const danglingReference = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		(danglingReference.references[0] as { nodeId: string }).nodeId = 'node:absent';
		expectSnapshotRejected(danglingReference);
	});

	it('independently rejects malformed registry extraction facts', () => {
		const commandNode = directGraph.nodes.find((node) => node.kind === 'COMMAND_REGISTRY_ENTRY');
		if (commandNode === undefined) throw new Error('Expected a command node.');
		const declaration = direct.snapshot.declarations.find(
			(candidate) => candidate.id === directGraph.commandRegistry.declarationId
		);
		if (declaration?.nodeId === null || declaration?.nodeId === undefined)
			throw new Error('Expected a registry declaration node.');
		const declarationAssignment = direct.snapshot.assignments.find(
			(assignment) =>
				assignment.nodeId === declaration.nodeId && assignment.assignmentKind === 'INITIALIZER'
		);
		if (
			declarationAssignment?.valueNodeId === null ||
			declarationAssignment?.valueNodeId === undefined
		)
			throw new Error('Expected a registry initializer.');

		const missingInitializer = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		(
			missingInitializer as unknown as { assignments: StaticSemanticSnapshot['assignments'] }
		).assignments = missingInitializer.assignments.filter(
			(assignment) =>
				assignment.nodeId !== declaration.nodeId || assignment.assignmentKind !== 'INITIALIZER'
		);
		expectSnapshotRejected(missingInitializer);

		const nonObjectInitializer = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		const initializerNode = nonObjectInitializer.astNodes.find(
			(node) => node.id === declarationAssignment.valueNodeId
		);
		if (initializerNode === undefined) throw new Error('Expected an initializer node.');
		(initializerNode as { kind: number }).kind = 9_999;
		expectSnapshotRejected(nonObjectInitializer);

		const unsupportedMember = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		const property = unsupportedMember.astNodes.find(
			(node) => node.id === commandNode.propertyNodeId
		);
		if (property === undefined) throw new Error('Expected a registry property node.');
		(property as { kind: number }).kind = 9_999;
		expectSnapshotRejected(unsupportedMember);

		const missingBinding = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		(
			missingBinding as unknown as { assignments: StaticSemanticSnapshot['assignments'] }
		).assignments = missingBinding.assignments.filter(
			(assignment) => assignment.nodeId !== commandNode.propertyNodeId
		);
		expectSnapshotRejected(missingBinding);

		const propertyAssignment = direct.snapshot.assignments.find(
			(assignment) =>
				assignment.nodeId === commandNode.propertyNodeId &&
				assignment.assignmentKind === 'INITIALIZER'
		);
		if (propertyAssignment === undefined) throw new Error('Expected a property binding.');
		const danglingBinding = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		const clonedBinding = danglingBinding.assignments.find(
			(assignment) =>
				assignment.nodeId === propertyAssignment.nodeId &&
				assignment.targetNodeId === propertyAssignment.targetNodeId &&
				assignment.valueNodeId === propertyAssignment.valueNodeId
		);
		if (clonedBinding === undefined) throw new Error('Expected the cloned property binding.');
		(clonedBinding as { targetNodeId: string }).targetNodeId = 'node:absent';
		expectSnapshotRejected(danglingBinding);

		const computedName = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		const nameNode = computedName.astNodes.find(
			(node) => node.id === propertyAssignment.targetNodeId
		);
		if (nameNode === undefined) throw new Error('Expected a registry member name node.');
		(nameNode as { syntacticIdentifierText: null }).syntacticIdentifierText = null;
		(computedName as unknown as { literals: StaticSemanticSnapshot['literals'] }).literals =
			computedName.literals.filter((literal) => literal.nodeId !== nameNode.id);
		expectSnapshotRejected(computedName);

		const ambiguousDeclaration = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		const memberDeclaration = ambiguousDeclaration.declarations.find(
			(candidate) => candidate.nodeId === commandNode.propertyNodeId
		);
		if (memberDeclaration === undefined) throw new Error('Expected a member declaration.');
		(
			ambiguousDeclaration as unknown as {
				declarations: StaticSemanticSnapshot['declarations'];
			}
		).declarations = [
			...ambiguousDeclaration.declarations,
			{
				...memberDeclaration,
				id: `${memberDeclaration.id}:duplicate` as typeof memberDeclaration.id
			}
		];
		expectSnapshotRejected(ambiguousDeclaration);
	});

	it('rejects duplicate semantic registry names and frozen-source divergence', () => {
		const commands = sharedGraph.nodes.filter((node) => node.kind === 'COMMAND_REGISTRY_ENTRY');
		if (commands.length !== 2) throw new Error('Expected two shared-fixture commands.');
		const duplicateName = structuredClone(shared.snapshot) as StaticSemanticSnapshot;
		const firstName = duplicateName.astNodes.find((node) => node.id === commands[0]!.nameNodeId);
		const secondName = duplicateName.astNodes.find((node) => node.id === commands[1]!.nameNodeId);
		if (firstName === undefined || secondName === undefined)
			throw new Error('Expected both registry name nodes.');
		(secondName as { syntacticIdentifierText: string | null }).syntacticIdentifierText =
			firstName.syntacticIdentifierText;
		expect(
			validateCommandHandlerGraph(sharedGraph, duplicateName, shared.observation, shared.subject)
		).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'SHAPE_INVALID' })])
		});

		const selectedPath = directGraph.commandRegistry.logicalPath;
		const artifact = direct.subject.artifacts.find((candidate) => candidate.path === selectedPath);
		if (artifact === undefined) throw new Error('Expected the command-registry artifact.');
		const duplicateArtifact = {
			...direct.subject,
			artifacts: [...direct.subject.artifacts, artifact]
		} as FrozenSubject;
		expect(
			validateCommandHandlerGraph(
				directGraph,
				direct.snapshot,
				direct.observation,
				duplicateArtifact
			)
		).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'SHAPE_INVALID' })])
		});

		const mismatchedSource = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		const source = mismatchedSource.sources.find(
			(candidate) => candidate.id === directGraph.commandRegistry.sourceId
		);
		if (source === undefined) throw new Error('Expected the command-registry source.');
		(source as { bytes: number }).bytes += 1;
		expectSnapshotRejected(mismatchedSource);
	});

	it('re-derives unresolved handler populations from semantic facts', () => {
		const registration = directGraph.nodes.find((node) => node.kind === 'HANDLER_REGISTRATION');
		if (registration === undefined) throw new Error('Expected a handler registration.');

		const unsupportedValue = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		const valueNode = unsupportedValue.astNodes.find(
			(node) => node.id === registration.targetNodeId
		);
		if (valueNode === undefined) throw new Error('Expected the handler value node.');
		(valueNode as { syntacticIdentifierText: null }).syntacticIdentifierText = null;
		expectIssue(directGraph, 'REGISTRY_POPULATION_MISMATCH', {
			...direct,
			snapshot: unsupportedValue
		});

		const unresolvedReference = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		for (const reference of unresolvedReference.references)
			if (reference.nodeId === registration.targetNodeId)
				(reference as { resolvedSymbolId: null }).resolvedSymbolId = null;
		expectIssue(directGraph, 'REGISTRY_POPULATION_MISMATCH', {
			...direct,
			snapshot: unresolvedReference
		});

		const missingTerminal = structuredClone(direct.snapshot) as StaticSemanticSnapshot;
		const reference = missingTerminal.references.find(
			(candidate) =>
				candidate.nodeId === registration.targetNodeId && candidate.resolvedSymbolId !== null
		);
		if (reference?.resolvedSymbolId === null || reference?.resolvedSymbolId === undefined)
			throw new Error('Expected a resolved handler reference.');
		(missingTerminal as unknown as { symbols: StaticSemanticSnapshot['symbols'] }).symbols =
			missingTerminal.symbols.filter((symbol) => symbol.id !== reference.resolvedSymbolId);
		expectIssue(directGraph, 'REGISTRY_POPULATION_MISMATCH', {
			...direct,
			snapshot: missingTerminal
		});
	});

	it('checks top-level bindings, metadata, authority, limitations, selectors, and budgets', () => {
		const malformedPopulations = structuredClone(directGraph) as unknown as { nodes: null };
		malformedPopulations.nodes = null;
		expectIssue(malformedPopulations, 'SHAPE_INVALID');

		const mutations: Array<
			readonly [
				CommandHandlerGraphValidationIssueCode,
				(draft: CommandHandlerGraphSnapshot) => void
			]
		> = [
			[
				'SNAPSHOT_BINDING_MISMATCH',
				(draft) => {
					(draft as { semanticSnapshotId: string }).semanticSnapshotId = 'semantic:stale';
				}
			],
			[
				'FIELD_SET_INVALID',
				(draft) => {
					(draft as unknown as { budgets: Record<string, unknown> }).budgets = {
						...draft.budgets,
						unexpected: true
					};
				}
			],
			[
				'SHAPE_INVALID',
				(draft) => {
					(draft.budgets as { maxNodes: number }).maxNodes = 0;
				}
			],
			[
				'SOURCE_BINDING_MISMATCH',
				(draft) => {
					(draft.commandRegistry as unknown as Record<string, unknown>).unexpected = true;
				}
			],
			[
				'IDENTITY_MISMATCH',
				(draft) => {
					(draft as { canonicalProfile: string }).canonicalProfile = 'wrong-profile';
				}
			],
			[
				'AUTHORITY_MISMATCH',
				(draft) => {
					(draft as { gateEffect: string }).gateEffect = 'MUTATED';
				}
			],
			[
				'LIMITATION_MISMATCH',
				(draft) => {
					(draft as unknown as { limitations: [] }).limitations = [];
				}
			],
			[
				'IDENTITY_MISMATCH',
				(draft) => {
					(draft as { graphInputDigest: string }).graphInputDigest = '0'.repeat(64);
				}
			],
			[
				'IDENTITY_MISMATCH',
				(draft) => {
					(draft as { id: string }).id = 'graph:wrong';
				}
			],
			[
				'SNAPSHOT_BINDING_MISMATCH',
				(draft) => {
					(draft as unknown as { producer: Record<string, unknown> }).producer = {
						...draft.producer,
						providerVersion: 'wrong'
					};
				}
			]
		];
		for (const [code, mutate] of mutations) expectIssue(finalized(directGraph, mutate), code);

		const invalidObservation = structuredClone(direct.observation);
		(invalidObservation as { contentDigest: string }).contentDigest = '0'.repeat(64);
		expect(
			validateCommandHandlerGraph(directGraph, direct.snapshot, invalidObservation, direct.subject)
		).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({ code: 'ARROW_OBSERVATION_INVALID' })
			])
		});
	});

	it('checks node fields, semantic locations, and duplicate represented identities', () => {
		expectIssue(
			finalized(directGraph, (draft) => {
				const node = draft.nodes[0] as unknown as Record<string, unknown>;
				delete node.graphId;
			}),
			'FIELD_SET_INVALID'
		);
		expectIssue(
			finalized(directGraph, (draft) => {
				(draft.nodes[0] as { graphId: string }).graphId = 'graph:wrong';
			}),
			'IDENTITY_MISMATCH'
		);
		expectIssue(
			finalized(directGraph, (draft) => {
				const node = draft.nodes.find((candidate) => candidate.sourceLocations.length > 0);
				if (node === undefined) throw new Error('Expected a located node.');
				(node.sourceLocations[0] as { start: number }).start = -1;
			}),
			'DANGLING_SEMANTIC_REFERENCE'
		);

		for (const kind of [
			'HANDLER_REGISTRATION',
			'DECLARED_ARROW_SITE',
			'DECLARED_ARROW_OCCURRENCE'
		] as const) {
			expectIssue(
				finalized(directGraph, (draft) => {
					const node = draft.nodes.find((candidate) => candidate.kind === kind);
					if (node === undefined) throw new Error(`Expected a ${kind} node.`);
					const duplicate = {
						...structuredClone(node),
						id: `${node.id}:duplicate`
					} as CommandHandlerGraphNode;
					(draft as unknown as { nodes: CommandHandlerGraphNode[] }).nodes = [
						...draft.nodes,
						duplicate
					].sort((left, right) => compareText(left.id, right.id));
				}),
				'DUPLICATE_ID'
			);
		}

		expectIssue(
			finalized(directGraph, (draft) => {
				const site = draft.nodes.find((node) => node.kind === 'DECLARED_ARROW_SITE');
				if (site === undefined) throw new Error('Expected an arrow site.');
				(site.observationSource as unknown as Record<string, unknown>).unexpected = true;
			}),
			'FIELD_SET_INVALID'
		);
	});

	it('checks edge, index, coverage, layer, source, and recorded operation-guard integrity', () => {
		expectIssue(
			finalized(directGraph, (draft) => {
				(draft.edges[0] as unknown as Record<string, unknown>).unexpected = true;
			}),
			'FIELD_SET_INVALID'
		);
		expectIssue(
			finalized(directGraph, (draft) => {
				(draft.edges[0]!.source as unknown as Record<string, unknown>).unexpected = true;
			}),
			'FIELD_SET_INVALID'
		);
		expectIssue(
			finalized(directGraph, (draft) => {
				(draft.edges[0]!.target as { kind: string }).kind = 'FRONTIER';
			}),
			'DANGLING_ENDPOINT'
		);
		expectIssue(
			finalized(directGraph, (draft) => {
				(draft.edges[0] as { id: string }).id = 'edge:wrong';
			}),
			'IDENTITY_MISMATCH'
		);
		expectIssue(
			finalized(factoryGraph, (draft) => {
				const edge = draft.edges.find((candidate) => candidate.attribution === 'CANDIDATE');
				if (edge === undefined) throw new Error('Expected a candidate edge.');
				(edge as unknown as { inferenceBasis: null }).inferenceBasis = null;
			}),
			'FIELD_SET_INVALID',
			factory
		);
		expectIssue(
			finalized(directGraph, (draft) => {
				(draft.forwardIndex[0] as unknown as Record<string, unknown>).unexpected = true;
			}),
			'FIELD_SET_INVALID'
		);
		expectIssue(
			finalized(directGraph, (draft) => {
				(draft.coverage as unknown as Record<string, unknown>).unexpected = true;
			}),
			'FIELD_SET_INVALID'
		);
		expectIssue(
			finalized(directGraph, (draft) => {
				(
					draft as unknown as { layers: readonly CommandHandlerGraphSnapshot['layers'][number][] }
				).layers = draft.layers.slice(0, 1);
			}),
			'FIELD_SET_INVALID'
		);

		const selectedPath = directGraph.commandRegistry.logicalPath;
		const artifact = direct.subject.artifacts.find((candidate) => candidate.path === selectedPath);
		if (artifact === undefined) throw new Error('Expected the selected frozen artifact.');
		const duplicateArtifact = {
			...direct.subject,
			artifacts: [...direct.subject.artifacts, artifact]
		} as FrozenSubject;
		const sourceResult = validateCommandHandlerGraph(
			directGraph,
			direct.snapshot,
			direct.observation,
			duplicateArtifact
		);
		expect(sourceResult.issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'SHAPE_INVALID' })])
		);

		const guarded = structuredClone(directGraph) as CommandHandlerGraphSnapshot;
		(guarded.budgets as { maxNodes: number }).maxNodes = 1;
		(guarded as { contentDigest: string }).contentDigest =
			commandHandlerGraphContentDigest(guarded);
		const guardResult = validateCommandHandlerGraph(
			guarded,
			direct.snapshot,
			direct.observation,
			direct.subject
		);
		expect(guardResult).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })]),
			state: 'BUDGET_EXHAUSTED'
		});
	});
});
