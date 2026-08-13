import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CommandHandlerGraphSnapshot } from '../contracts/command-handler-graph.js';
import type {
	BuildCommandDispatchTopologyRequest,
	CommandDispatchTopologySnapshot,
	CommandDispatchTopologyValidationIssueCode,
	CommandDispatchTopologyValidationOptions,
	CommandDispatchTopologyValidationResult
} from '../contracts/command-dispatch-topology.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import type { FrozenSubject } from '../contracts/subject.js';
import { attachFrozenSubjectBytes, readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import { buildCommandDispatchTopology } from './build-command-dispatch-topology.js';
import { commandDispatchTopologyContentDigest } from './command-dispatch-topology-canonical.js';
import {
	createCommandDispatchTopologyFixture,
	type CommandDispatchTopologyFixture
} from './command-dispatch-topology-fixture.test-support.js';
import {
	validateCommandDispatchTopology,
	validateConstructedCommandDispatchTopology
} from './validate-command-dispatch-topology.js';

let fixture: CommandDispatchTopologyFixture;
let graph: CommandDispatchTopologySnapshot;

beforeAll(() => {
	fixture = createCommandDispatchTopologyFixture();
	const outcome = buildCommandDispatchTopology(
		fixture.dispatchRequest,
		fixture.snapshot,
		fixture.commandHandlerGraph,
		fixture.observation,
		fixture.subject
	);
	if (outcome.outcome !== 'partial')
		throw new Error(`Topology fixture construction failed: ${JSON.stringify(outcome)}`);
	graph = outcome.graph;
});

afterAll(() => fixture.cleanup());

interface ValidationInputs {
	readonly commandHandlerGraph?: CommandHandlerGraphSnapshot;
	readonly options?: CommandDispatchTopologyValidationOptions;
	readonly request?: BuildCommandDispatchTopologyRequest;
	readonly snapshot?: StaticSemanticSnapshot;
	readonly subject?: FrozenSubject;
}

function validate(
	value: unknown,
	inputs: ValidationInputs = {}
): CommandDispatchTopologyValidationResult {
	return validateCommandDispatchTopology(
		value,
		'request' in inputs ? inputs.request! : fixture.dispatchRequest,
		inputs.snapshot ?? fixture.snapshot,
		inputs.commandHandlerGraph ?? fixture.commandHandlerGraph,
		fixture.observation,
		inputs.subject ?? fixture.subject,
		inputs.options
	);
}

function redigested(
	mutate: (draft: CommandDispatchTopologySnapshot) => void
): CommandDispatchTopologySnapshot {
	const draft = structuredClone(graph) as CommandDispatchTopologySnapshot;
	mutate(draft);
	(draft as { contentDigest: string }).contentDigest = commandDispatchTopologyContentDigest(draft);
	return draft;
}

function expectIssue(
	value: unknown,
	code: CommandDispatchTopologyValidationIssueCode,
	inputs: ValidationInputs = {}
): void {
	const result = validate(value, inputs);
	expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
}

function expectIndependentFailure(snapshot: StaticSemanticSnapshot): void {
	expectIssue(graph, 'POPULATION_MISMATCH', { snapshot });
}

function detachedSubject(): FrozenSubject {
	return structuredClone(fixture.subject) as FrozenSubject;
}

function attachedSubjectClone(): FrozenSubject {
	const subject = detachedSubject();
	attachFrozenSubjectBytes(
		subject,
		new Map(
			fixture.subject.artifacts.map((artifact) => {
				const bytes = readFrozenSubjectArtifact(fixture.subject, artifact.path);
				if (bytes === undefined) throw new Error(`Missing fixture bytes for ${artifact.path}.`);
				return [artifact.path, bytes] as const;
			})
		)
	);
	return subject;
}

describe('command-dispatch topology validator defensive coverage', { timeout: 30_000 }, () => {
	it('requires exact plain validation options and accepts a null-prototype record', () => {
		const hidden = Object.defineProperty({}, 'maxIssues', {
			enumerable: false,
			value: 10
		});
		const accessor = Object.defineProperty({}, 'maxIssues', {
			enumerable: true,
			get: () => 10
		});
		const symbolOptions = { maxIssues: 10 } as Record<PropertyKey, unknown>;
		symbolOptions[Symbol('unsupported')] = true;
		for (const options of [
			null,
			new Proxy({}, {}),
			{ unsupported: true },
			hidden,
			accessor,
			symbolOptions,
			{ maxIssues: 0 },
			{ maxRecords: Number.NaN },
			{ maxStringCharacters: 1.5 }
		]) {
			const result = validate(graph, {
				options: options as CommandDispatchTopologyValidationOptions
			});
			expect(result).toMatchObject({
				issues: [expect.objectContaining({ code: 'INVALID_SHAPE', path: '$options' })],
				state: 'INVALID'
			});
		}

		const nullPrototypeOptions = Object.assign(Object.create(null) as object, {
			maxIssues: 1_000,
			maxRecords: 1_000_000,
			maxStringCharacters: 100_000_000
		}) as CommandDispatchTopologyValidationOptions;
		expect(validate(graph, { options: nullPrototypeOptions })).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('rejects non-JSON, proxy, cyclic, exotic, sparse, accessor, and symbol-bearing data', () => {
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		const symbolValue = structuredClone(graph) as unknown as Record<PropertyKey, unknown>;
		symbolValue[Symbol('hostile')] = true;
		const sparse: unknown[] = [];
		sparse.length = 3;
		const extraArrayProperty = structuredClone(graph) as CommandDispatchTopologySnapshot;
		Object.defineProperty(extraArrayProperty.edges, 'extra', { enumerable: true, value: true });
		const accessorProperty = structuredClone(graph) as CommandDispatchTopologySnapshot;
		Object.defineProperty(accessorProperty, 'id', {
			enumerable: true,
			get: () => graph.id
		});

		for (const hostile of [
			undefined,
			Number.NaN,
			1n,
			() => undefined,
			new Proxy(graph, {}),
			cyclic,
			Object.create({ hostile: true }),
			symbolValue,
			sparse,
			extraArrayProperty,
			accessorProperty
		]) {
			const result = validate(hostile);
			expect(result).toMatchObject({
				issues: [expect.objectContaining({ code: 'INVALID_SHAPE' })],
				state: 'INVALID'
			});
		}
	});

	it('reports both structural and string traversal budget exhaustion paths', () => {
		for (const [value, options] of [
			['long string', { maxStringCharacters: 1 }],
			[{ longPropertyName: null }, { maxStringCharacters: 1 }],
			[Array.from({ length: 10 }, () => null), { maxRecords: 5 }],
			[graph, { maxRecords: 1 }]
		] as const) {
			expect(validate(value, { options })).toMatchObject({
				issues: [expect.objectContaining({ code: 'VALIDATION_BUDGET_EXHAUSTED' })],
				state: 'BUDGET_EXHAUSTED'
			});
		}
	});

	it('exercises the builder-facing validator alias on hostile and valid data', () => {
		expect(
			validateConstructedCommandDispatchTopology(
				'long string',
				fixture.dispatchRequest,
				fixture.snapshot,
				fixture.commandHandlerGraph,
				fixture.observation,
				fixture.subject,
				{ maxStringCharacters: 1 }
			)
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'VALIDATION_BUDGET_EXHAUSTED' })],
			state: 'BUDGET_EXHAUSTED'
		});
		expect(
			validateConstructedCommandDispatchTopology(
				graph,
				fixture.dispatchRequest,
				fixture.snapshot,
				fixture.commandHandlerGraph,
				fixture.observation,
				fixture.subject
			)
		).toEqual({ issues: [], state: 'VALID' });
	});

	it('rejects invalid request, top-level, and nested tuple or field shapes', () => {
		expectIssue(graph, 'INVALID_SHAPE', {
			request: null as unknown as BuildCommandDispatchTopologyRequest
		});
		expectIssue({ ...graph, unexpected: true }, 'INVALID_SHAPE');

		for (const mutation of [
			(draft: CommandDispatchTopologySnapshot) => {
				(draft as unknown as { nodes: null }).nodes = null;
			},
			(draft: CommandDispatchTopologySnapshot) => {
				(draft as unknown as { nodes: readonly [] }).nodes = [];
			},
			(draft: CommandDispatchTopologySnapshot) => {
				(draft.nodes[0] as unknown as Record<string, unknown>).unexpected = true;
			},
			(draft: CommandDispatchTopologySnapshot) => {
				(draft.nodes[0]!.sourceLocations[0] as unknown as Record<string, unknown>).unexpected =
					true;
			},
			(draft: CommandDispatchTopologySnapshot) => {
				(draft.edges[0] as unknown as Record<string, unknown>).unexpected = true;
			},
			(draft: CommandDispatchTopologySnapshot) => {
				(draft.edges[0]!.source as unknown as Record<string, unknown>).unexpected = true;
			},
			(draft: CommandDispatchTopologySnapshot) => {
				(draft as unknown as { layers: readonly unknown[] }).layers = draft.layers.slice(0, 1);
			},
			(draft: CommandDispatchTopologySnapshot) => {
				(draft.forwardIndex[0] as unknown as Record<string, unknown>).unexpected = true;
			}
		])
			expectIssue(redigested(mutation), 'INVALID_SHAPE');
	});

	it('checks schema, upstream validity, request versions, and every identity binding', () => {
		expectIssue(
			redigested((draft) => {
				(draft as { schemaVersion: string }).schemaVersion = 'wrong-schema';
			}),
			'UNSUPPORTED_SCHEMA_VERSION'
		);

		const invalidPredecessor = structuredClone(
			fixture.commandHandlerGraph
		) as CommandHandlerGraphSnapshot;
		(invalidPredecessor as { contentDigest: string }).contentDigest = '0'.repeat(64);
		expectIssue(graph, 'INPUT_BINDING_MISMATCH', { commandHandlerGraph: invalidPredecessor });

		expectIssue(graph, 'INVALID_VALUE', {
			request: {
				...fixture.dispatchRequest,
				operationVersion: 'wrong-operation'
			} as unknown as BuildCommandDispatchTopologyRequest
		});

		for (const mutation of [
			(draft: CommandDispatchTopologySnapshot) => {
				(draft as { subjectId: string }).subjectId = 'subject:stale';
			},
			(draft: CommandDispatchTopologySnapshot) => {
				(draft as { semanticSnapshotId: string }).semanticSnapshotId = 'semantic:stale';
			},
			(draft: CommandDispatchTopologySnapshot) => {
				(draft as { commandHandlerGraphContentDigest: string }).commandHandlerGraphContentDigest =
					'0'.repeat(64);
			},
			(draft: CommandDispatchTopologySnapshot) => {
				(draft as { arrowObservationContentDigest: string }).arrowObservationContentDigest =
					'0'.repeat(64);
			}
		])
			expectIssue(redigested(mutation), 'INPUT_BINDING_MISMATCH');
	});

	it('re-derives selector, retained census, input digest, graph ID, and constant metadata', () => {
		expectIssue(graph, 'SELECTOR_MISMATCH', {
			request: {
				...fixture.dispatchRequest,
				commandBus: {
					...fixture.dispatchRequest.commandBus,
					contentSha256: '0'.repeat(64)
				}
			}
		});
		expectIssue(
			redigested((draft) => {
				(draft.retainedCommandDispatchCensus as { artifactBytes: number }).artifactBytes += 1;
			}),
			'INPUT_BINDING_MISMATCH'
		);
		expectIssue(
			redigested((draft) => {
				(draft as { graphInputDigest: string }).graphInputDigest = '0'.repeat(64);
			}),
			'INPUT_BINDING_MISMATCH'
		);
		expectIssue(
			redigested((draft) => {
				(draft as { id: string }).id = 'dispatch-topology:stale';
			}),
			'GRAPH_ID_MISMATCH'
		);
		expectIssue(
			redigested((draft) => {
				(draft as { gateEffect: string }).gateEffect = 'MUTATED';
			}),
			'INVALID_VALUE'
		);
	});

	it('detects duplicated graph population and recorded caller-guard exhaustion', () => {
		expectIssue(
			redigested((draft) => {
				(draft as unknown as { edges: readonly (typeof draft.edges)[number][] }).edges = [
					...draft.edges,
					structuredClone(draft.edges[0]!)
				];
			}),
			'POPULATION_DUPLICATION'
		);

		const guarded = redigested((draft) => {
			(draft.budgets as { maxAstNodes: number }).maxAstNodes = 1;
		});
		const result = validate(guarded);
		expect(result).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({ code: 'VALIDATION_BUDGET_EXHAUSTED' }),
				expect.objectContaining({ code: 'INPUT_BINDING_MISMATCH' })
			]),
			state: 'BUDGET_EXHAUSTED'
		});
	});

	it('fails closed for duplicate semantic identities, provenance, and dangling AST sources', () => {
		const duplicateNode = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		(duplicateNode as unknown as { astNodes: StaticSemanticSnapshot['astNodes'] }).astNodes = [
			...duplicateNode.astNodes,
			structuredClone(duplicateNode.astNodes[0]!)
		];
		expectIndependentFailure(duplicateNode);

		const duplicateProvenance = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		(
			duplicateProvenance as unknown as {
				provenances: StaticSemanticSnapshot['provenances'];
			}
		).provenances = [
			...duplicateProvenance.provenances,
			structuredClone(duplicateProvenance.provenances[0]!)
		];
		expectIndependentFailure(duplicateProvenance);

		const danglingSource = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		(danglingSource.astNodes[0] as { sourceId: string }).sourceId = 'source:absent';
		expectIndependentFailure(danglingSource);
	});

	it('fails closed for ambiguous method selection and malformed exact method identity', () => {
		const duplicateSource = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const selectedSource = duplicateSource.sources.find(
			(source) => source.id === fixture.commandBusSelector.sourceId
		);
		if (selectedSource === undefined) throw new Error('Expected the selected command-bus source.');
		(
			duplicateSource as unknown as {
				sources: StaticSemanticSnapshot['sources'];
			}
		).sources = [
			...duplicateSource.sources,
			{ ...selectedSource, id: `${selectedSource.id}:duplicate` as typeof selectedSource.id }
		];
		expectIndependentFailure(duplicateSource);

		const wrongMethodNode = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const methodDeclaration = wrongMethodNode.declarations.find(
			(declaration) => declaration.id === fixture.commandBusSelector.declarationId
		);
		const nonMethodNode = wrongMethodNode.astNodes.find(
			(node) => node.id !== methodDeclaration?.nodeId && node.kind !== methodDeclaration?.kind
		);
		if (methodDeclaration === undefined || nonMethodNode === undefined)
			throw new Error('Expected method and non-method semantic nodes.');
		(methodDeclaration as { nodeId: string }).nodeId = nonMethodNode.id;
		expectIndependentFailure(wrongMethodNode);
	});

	it('fails closed for missing frozen bytes and source or retained-census identity divergence', () => {
		expectIssue(graph, 'POPULATION_MISMATCH', { subject: detachedSubject() });

		const sourceMismatch = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const source = sourceMismatch.sources.find(
			(candidate) => candidate.id === fixture.commandBusSelector.sourceId
		);
		if (source === undefined) throw new Error('Expected selected command-bus source.');
		(source as { bytes: number }).bytes += 1;
		expectIndependentFailure(sourceMismatch);

		const censusMismatch = attachedSubjectClone();
		const census = censusMismatch.artifacts.find(
			(artifact) => artifact.path === 'verif/command-dispatch-census.test.ts'
		);
		if (census === undefined) throw new Error('Expected retained command-dispatch census.');
		(census as { bytes: number }).bytes += 1;
		expectIssue(graph, 'POPULATION_MISMATCH', { subject: censusMismatch });
	});

	it('fails closed for command parameter and semantic reference-resolution corruption', () => {
		const noCommandSymbol = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const methodNodeId = noCommandSymbol.declarations.find(
			(declaration) => declaration.id === fixture.commandBusSelector.declarationId
		)?.nodeId;
		const methodNodeIds = new Set<string>();
		if (methodNodeId === null || methodNodeId === undefined)
			throw new Error('Expected selected method declaration node.');
		const pending = [methodNodeId];
		while (pending.length > 0) {
			const nodeId = pending.pop()!;
			if (methodNodeIds.has(nodeId)) continue;
			methodNodeIds.add(nodeId);
			for (const node of noCommandSymbol.astNodes)
				if (node.parentId === nodeId) pending.push(node.id);
		}
		const commandParameter = noCommandSymbol.declarations.find(
			(declaration) =>
				declaration.name === 'command' &&
				declaration.nodeId !== null &&
				methodNodeIds.has(declaration.nodeId)
		);
		if (commandParameter === undefined) throw new Error('Expected dispatch command parameter.');
		(commandParameter as { symbolId: null }).symbolId = null;
		expectIndependentFailure(noCommandSymbol);

		const unresolvedMember = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const memberReference = unresolvedMember.references.find(
			(reference) => reference.id === graph.nodes[0]!.commandsLookup.commandTypeReferenceId
		);
		if (memberReference === undefined) throw new Error('Expected COMMANDS commandType reference.');
		(memberReference as { resolvedSymbolId: null }).resolvedSymbolId = null;
		expectIndependentFailure(unresolvedMember);

		for (const [referenceId, description] of [
			[graph.nodes[0]!.commandsLookup.registryReferenceId, 'COMMANDS registry'],
			[graph.nodes[0]!.payloadValidationInvocation.calleeReferenceId, 'validateAgainst callee']
		] as const) {
			const unresolved = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
			const reference = unresolved.references.find((candidate) => candidate.id === referenceId);
			if (reference === undefined) throw new Error(`Expected ${description} reference.`);
			(reference as { resolutionState: string }).resolutionState = 'UNRESOLVED';
			expectIndependentFailure(unresolved);
		}
	});

	it('independently enforces every cross-stage resolved-symbol equality', () => {
		const pipeline = graph.nodes[0]!;
		const directChild = (
			snapshot: StaticSemanticSnapshot,
			parentId: string,
			identifier: string
		) => {
			const node = snapshot.astNodes.find(
				(candidate) =>
					candidate.parentId === parentId && candidate.syntacticIdentifierText === identifier
			);
			if (node === undefined) throw new Error(`Expected ${identifier} below ${parentId}.`);
			return node;
		};
		const referenceAt = (snapshot: StaticSemanticSnapshot, nodeId: string) => {
			const reference = snapshot.references.find(
				(candidate) => candidate.nodeId === nodeId && candidate.resolvedSymbolId !== null
			);
			if (reference === undefined) throw new Error(`Expected resolved reference at ${nodeId}.`);
			return reference;
		};

		const mutations: Array<(snapshot: StaticSemanticSnapshot) => void> = [
			(snapshot) => {
				const reference = referenceAt(snapshot, pipeline.handlerInvocation.commandArgumentNodeId);
				(reference as { resolvedSymbolId: string }).resolvedSymbolId = 'symbol:wrong-command';
			},
			(snapshot) => {
				const reference = snapshot.references.find(
					(candidate) => candidate.id === pipeline.handlersLookup.commandTypeReferenceId
				);
				if (reference === undefined) throw new Error('Expected HANDLERS commandType reference.');
				(reference as { resolvedSymbolId: string }).resolvedSymbolId = 'symbol:wrong-member';
			},
			(snapshot) => {
				const base = directChild(
					snapshot,
					pipeline.payloadValidationInvocation.schemaArgumentNodeId,
					'spec'
				);
				(referenceAt(snapshot, base.id) as { resolvedSymbolId: string }).resolvedSymbolId =
					'symbol:wrong-spec';
			},
			(snapshot) => {
				const base = directChild(
					snapshot,
					pipeline.handlerInvocation.parsedPayloadArgumentNodeId,
					'parsed'
				);
				(referenceAt(snapshot, base.id) as { resolvedSymbolId: string }).resolvedSymbolId =
					'symbol:wrong-parsed';
			},
			(snapshot) => {
				const reference = snapshot.references.find(
					(candidate) => candidate.id === pipeline.missingHandlerGuard.guardedHandlerReferenceId
				);
				if (reference === undefined) throw new Error('Expected guarded handler reference.');
				(reference as { resolvedSymbolId: string }).resolvedSymbolId = 'symbol:wrong-handler';
			},
			(snapshot) => {
				const reference = snapshot.references.find(
					(candidate) => candidate.id === pipeline.handlersLookup.registryReferenceId
				);
				if (reference === undefined) throw new Error('Expected HANDLERS registry reference.');
				(reference as { resolvedSymbolId: string }).resolvedSymbolId = 'symbol:wrong-registry';
			}
		];
		for (const mutate of mutations) {
			const snapshot = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
			mutate(snapshot);
			expectIndependentFailure(snapshot);
		}
	});

	it('fails closed for malformed property-access grammar and candidate filtering', () => {
		const pipeline = graph.nodes[0]!;
		const malformedKind = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const schemaArgument = malformedKind.astNodes.find(
			(node) => node.id === pipeline.payloadValidationInvocation.schemaArgumentNodeId
		);
		if (schemaArgument === undefined) throw new Error('Expected payload schema argument.');
		(schemaArgument as { kind: number }).kind = 9_999;
		expectIndependentFailure(malformedKind);

		const malformedGrammar = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const specBase = malformedGrammar.astNodes.find(
			(node) =>
				node.parentId === pipeline.payloadValidationInvocation.schemaArgumentNodeId &&
				node.syntacticIdentifierText === 'spec'
		);
		if (specBase === undefined) throw new Error('Expected spec property-access base.');
		(specBase as { syntacticIdentifierText: string | null }).syntacticIdentifierText = 'wrongSpec';
		expectIndependentFailure(malformedGrammar);

		const wrongCallee = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const callee = wrongCallee.astNodes.find(
			(node) => node.id === pipeline.payloadValidationInvocation.calleeNodeId
		);
		if (callee === undefined) throw new Error('Expected validateAgainst callee.');
		(callee as { syntacticIdentifierText: string | null }).syntacticIdentifierText = 'wrongCallee';
		expectIndependentFailure(wrongCallee);

		const shortArguments = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const invocation = shortArguments.invocations.find(
			(item) => item.id === pipeline.payloadValidationInvocation.invocationId
		);
		if (invocation?.invocationKind !== 'CALL') throw new Error('Expected payload CALL invocation.');
		(invocation as unknown as { argumentNodeIds: readonly [] }).argumentNodeIds = [];
		expectIndependentFailure(shortArguments);

		const extraArguments = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const extraArgumentInvocation = extraArguments.invocations.find(
			(item) => item.id === pipeline.payloadValidationInvocation.invocationId
		);
		if (extraArgumentInvocation?.invocationKind !== 'CALL')
			throw new Error('Expected payload CALL invocation.');
		(
			extraArgumentInvocation as {
				argumentNodeIds: readonly string[];
			}
		).argumentNodeIds = [
			...extraArgumentInvocation.argumentNodeIds,
			extraArgumentInvocation.argumentNodeIds[2]!
		];
		expectIndependentFailure(extraArguments);

		const missingArgument = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const missingInvocation = missingArgument.invocations.find(
			(item) => item.id === pipeline.payloadValidationInvocation.invocationId
		);
		if (missingInvocation?.invocationKind !== 'CALL')
			throw new Error('Expected payload CALL invocation.');
		(missingInvocation as { argumentNodeIds: readonly string[] }).argumentNodeIds = [
			'node:absent',
			'node:also-absent'
		];
		expectIndependentFailure(missingArgument);
	});

	it('requires every consumed semantic capability during independent validation', () => {
		for (const required of ['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL'] as const) {
			const snapshot = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
			const capability = snapshot.capabilities.find((item) => item.capability === required);
			if (capability === undefined) throw new Error(`Expected ${required} capability evidence.`);
			(capability as { state: 'UNSUPPORTED' }).state = 'UNSUPPORTED';
			expect(validate(graph, { snapshot })).toMatchObject({
				issues: [
					expect.objectContaining({
						code: 'INPUT_BINDING_MISMATCH',
						path: '$input.semanticSnapshot.capabilities'
					})
				],
				state: 'INVALID'
			});
		}
	});

	it('fails closed for malformed lookup, guard, and invocation candidates', () => {
		const pipeline = graph.nodes[0]!;
		const skippedAssignments = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const assignment = structuredClone(skippedAssignments.assignments[0]!);
		(assignment as { assignmentKind: 'BINARY' }).assignmentKind = 'BINARY';
		(
			skippedAssignments as unknown as {
				assignments: StaticSemanticSnapshot['assignments'];
			}
		).assignments = [...skippedAssignments.assignments, assignment];
		expectIssue(graph, 'INPUT_BINDING_MISMATCH', { snapshot: skippedAssignments });

		const missingLookupChild = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const lookupChildren = missingLookupChild.astNodes.filter(
			(node) => node.parentId === pipeline.commandsLookup.valueNodeId
		);
		if (lookupChildren.length !== 2)
			throw new Error('Expected two COMMANDS element-access children.');
		(
			missingLookupChild as unknown as {
				astNodes: StaticSemanticSnapshot['astNodes'];
			}
		).astNodes = missingLookupChild.astNodes.filter((node) => node.id !== lookupChildren[1]!.id);
		expectIndependentFailure(missingLookupChild);

		const wrongRegistry = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const registryIdentifier = wrongRegistry.astNodes.find(
			(node) =>
				node.syntacticIdentifierText === 'COMMANDS' &&
				(() => {
					let parentId = node.parentId;
					while (parentId !== null) {
						if (parentId === pipeline.commandsLookup.valueNodeId) return true;
						parentId =
							wrongRegistry.astNodes.find((candidate) => candidate.id === parentId)?.parentId ??
							null;
					}
					return false;
				})()
		);
		if (registryIdentifier === undefined) throw new Error('Expected COMMANDS lookup identifier.');
		(registryIdentifier as { syntacticIdentifierText: string | null }).syntacticIdentifierText =
			'WRONG_COMMANDS';
		expectIndependentFailure(wrongRegistry);

		const guard = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const guardCondition = guard.astNodes.find(
			(node) => node.id === pipeline.missingHandlerGuard.conditionNodeId
		);
		if (guardCondition === undefined) throw new Error('Expected missing-handler guard condition.');
		(guardCondition as { kind: number }).kind = 9_999;
		expectIndependentFailure(guard);

		const invocationCandidate = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const contextArgument = invocationCandidate.astNodes.find(
			(node) => node.id === pipeline.handlerInvocation.contextArgumentNodeId
		);
		if (contextArgument === undefined) throw new Error('Expected handler context argument.');
		(contextArgument as { syntacticIdentifierText: string | null }).syntacticIdentifierText =
			'wrongCtx';
		expectIndependentFailure(invocationCandidate);

		const parsedGrammar = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const parsedArgument = parsedGrammar.astNodes.find(
			(node) => node.id === pipeline.handlerInvocation.parsedPayloadArgumentNodeId
		);
		if (parsedArgument === undefined) throw new Error('Expected handler parsed-value argument.');
		(parsedArgument as { kind: number }).kind = 9_999;
		expectIndependentFailure(parsedGrammar);
	});

	it('fails closed for noncanonical lexical ordering and unknown provenance', () => {
		const lexical = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const assignmentNode = lexical.astNodes.find(
			(node) => node.id === graph.nodes[0]!.commandsLookup.assignmentNodeId
		);
		if (assignmentNode === undefined) throw new Error('Expected COMMANDS assignment node.');
		(assignmentNode as { start: number }).start = Number.MAX_SAFE_INTEGER;
		expectIndependentFailure(lexical);

		const provenance = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const selectedSource = provenance.sources.find(
			(source) => source.id === fixture.commandBusSelector.sourceId
		);
		if (selectedSource === undefined) throw new Error('Expected selected source provenance.');
		(
			provenance as unknown as {
				provenances: StaticSemanticSnapshot['provenances'];
			}
		).provenances = provenance.provenances.filter(
			(item) => item.id !== selectedSource.provenanceId
		);
		expectIndependentFailure(provenance);
	});

	it('fails closed when predecessor targets or registration support are absent', () => {
		const noTargets = structuredClone(fixture.commandHandlerGraph) as CommandHandlerGraphSnapshot;
		(noTargets as unknown as { nodes: CommandHandlerGraphSnapshot['nodes'] }).nodes =
			noTargets.nodes.filter((node) => node.kind !== 'HANDLER_TARGET');
		expectIssue(graph, 'POPULATION_MISMATCH', { commandHandlerGraph: noTargets });

		const noRegistrationSupport = structuredClone(
			fixture.commandHandlerGraph
		) as CommandHandlerGraphSnapshot;
		(noRegistrationSupport as unknown as { edges: CommandHandlerGraphSnapshot['edges'] }).edges =
			noRegistrationSupport.edges.filter(
				(edge) => edge.relationKind !== 'HANDLER_REGISTRATION_TO_TARGET'
			);
		expectIssue(graph, 'POPULATION_MISMATCH', {
			commandHandlerGraph: noRegistrationSupport
		});

		const unsupportedTarget = structuredClone(
			fixture.commandHandlerGraph
		) as CommandHandlerGraphSnapshot;
		const support = unsupportedTarget.edges.find(
			(edge) => edge.relationKind === 'HANDLER_REGISTRATION_TO_TARGET'
		);
		if (support === undefined) throw new Error('Expected registration-target support.');
		(support.target as { nodeId: string }).nodeId = 'graph-node:unsupported-target';
		expectIssue(graph, 'POPULATION_MISMATCH', { commandHandlerGraph: unsupportedTarget });

		const unsupportedRegistration = structuredClone(
			fixture.commandHandlerGraph
		) as CommandHandlerGraphSnapshot;
		const registrationSupport = unsupportedRegistration.edges.find(
			(edge) => edge.relationKind === 'HANDLER_REGISTRATION_TO_TARGET'
		);
		if (registrationSupport === undefined) throw new Error('Expected registration-target support.');
		(registrationSupport.source as { nodeId: string }).nodeId =
			'graph-node:unsupported-registration';
		expectIssue(graph, 'POPULATION_MISMATCH', {
			commandHandlerGraph: unsupportedRegistration
		});
	});
});
