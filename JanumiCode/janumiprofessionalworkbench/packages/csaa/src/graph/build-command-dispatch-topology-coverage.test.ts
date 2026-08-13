import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';

import type { CommandHandlerGraphSnapshot } from '../contracts/command-handler-graph.js';
import type { CommandDispatchTopologyBuildDiagnosticCode } from '../contracts/command-dispatch-topology.js';
import type {
	SemanticAstNodeRecord,
	SemanticDeclarationRecord,
	SemanticInvocationSiteRecord,
	SemanticReferenceRecord,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import {
	buildCommandDispatchTopology,
	COMMAND_DISPATCH_TOPOLOGY_PROGRESS_SCHEMA_VERSION,
	selectJpwbCommandDispatchTopology,
	type BuildCommandDispatchTopologyOptions,
	type CommandDispatchTopologyProgressEvent
} from './build-command-dispatch-topology.js';
import {
	createCommandDispatchTopologyFixture,
	type CommandDispatchTopologyFixture
} from './command-dispatch-topology-fixture.test-support.js';

const cleanups: Array<() => void> = [];

afterEach(() => {
	for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function fixture(): CommandDispatchTopologyFixture {
	const value = createCommandDispatchTopologyFixture();
	cleanups.push(value.cleanup);
	return value;
}

function cloneSnapshot(value: CommandDispatchTopologyFixture): StaticSemanticSnapshot {
	return structuredClone(value.snapshot) as StaticSemanticSnapshot;
}

function build(
	value: CommandDispatchTopologyFixture,
	input: {
		readonly graph?: CommandHandlerGraphSnapshot;
		readonly options?: BuildCommandDispatchTopologyOptions;
		readonly request?: unknown;
		readonly snapshot?: StaticSemanticSnapshot;
	} = {}
) {
	return buildCommandDispatchTopology(
		input.request === undefined ? value.dispatchRequest : input.request,
		input.snapshot ?? value.snapshot,
		input.graph ?? value.commandHandlerGraph,
		value.observation,
		value.subject,
		input.options
	);
}

function afterUpstreamValidation(mutate: () => void): BuildCommandDispatchTopologyOptions {
	return atProgress('UPSTREAM_GRAPH_VALIDATE', 'COMPLETED', mutate);
}

function atProgress(
	phase: CommandDispatchTopologyProgressEvent['phase'],
	state: CommandDispatchTopologyProgressEvent['state'],
	mutate: () => void
): BuildCommandDispatchTopologyOptions {
	let applied = false;
	return {
		onProgress: (event) => {
			if (!applied && event.phase === phase && event.state === state) {
				applied = true;
				mutate();
			}
		}
	};
}

function expectUnavailable(
	value: CommandDispatchTopologyFixture,
	code: CommandDispatchTopologyBuildDiagnosticCode,
	input: {
		readonly graph?: CommandHandlerGraphSnapshot;
		readonly message?: string;
		readonly options?: BuildCommandDispatchTopologyOptions;
		readonly request?: unknown;
		readonly snapshot?: StaticSemanticSnapshot;
	} = {}
): void {
	const outcome = build(value, input);
	expect(outcome).toMatchObject({
		diagnostics: [
			expect.objectContaining({
				code,
				...(input.message === undefined ? {} : { message: input.message })
			})
		],
		outcome: 'unavailable'
	});
}

function setPopulation<Key extends keyof StaticSemanticSnapshot>(
	snapshot: StaticSemanticSnapshot,
	key: Key,
	value: StaticSemanticSnapshot[Key]
): void {
	(snapshot as unknown as Record<Key, StaticSemanticSnapshot[Key]>)[key] = value;
}

interface DispatchParts {
	readonly commandDeclaration: SemanticDeclarationRecord;
	readonly commandNode: SemanticAstNodeRecord;
	readonly commandsAssignment: StaticSemanticSnapshot['assignments'][number];
	readonly commandsLookup: SemanticAstNodeRecord;
	readonly guardHandler: SemanticAstNodeRecord;
	readonly handlerArgument: SemanticAstNodeRecord;
	readonly handlerInvocation: SemanticInvocationSiteRecord;
	readonly handlerLookup: SemanticAstNodeRecord;
	readonly handlersAssignment: StaticSemanticSnapshot['assignments'][number];
	readonly method: SemanticAstNodeRecord;
	readonly parsedAssignment: StaticSemanticSnapshot['assignments'][number];
	readonly validationInvocation: SemanticInvocationSiteRecord;
}

function exactOne<Type>(values: readonly Type[], label: string): Type {
	if (values.length !== 1)
		throw new Error(`Expected one fixture ${label}; found ${values.length}.`);
	return values[0]!;
}

function dispatchParts(
	value: CommandDispatchTopologyFixture,
	snapshot: StaticSemanticSnapshot
): DispatchParts {
	const methodDeclaration = exactOne(
		snapshot.declarations.filter(
			(declaration) => declaration.id === value.commandBusSelector.declarationId
		),
		'dispatch declaration'
	);
	if (methodDeclaration.nodeId === null)
		throw new Error('Fixture dispatch declaration has no AST node.');
	const method = exactOne(
		snapshot.astNodes.filter((node) => node.id === methodDeclaration.nodeId),
		'dispatch method'
	);
	const descendants = new Set<string>([method.id]);
	let changed = true;
	while (changed) {
		changed = false;
		for (const node of snapshot.astNodes)
			if (node.parentId !== null && descendants.has(node.parentId) && !descendants.has(node.id)) {
				descendants.add(node.id);
				changed = true;
			}
	}
	const methodNodes = snapshot.astNodes.filter((node) => descendants.has(node.id));
	const assignmentFor = (name: string) =>
		exactOne(
			snapshot.assignments.filter(
				(assignment) =>
					descendants.has(assignment.nodeId) &&
					snapshot.astNodes.some(
						(node) => node.id === assignment.targetNodeId && node.syntacticIdentifierText === name
					)
			),
			`${name} assignment`
		);
	const commandsAssignment = assignmentFor('spec');
	const handlersAssignment = assignmentFor('handler');
	const parsedAssignment = assignmentFor('parsed');
	const commandsLookup = exactOne(
		methodNodes.filter((node) => node.id === commandsAssignment.valueNodeId),
		'COMMANDS lookup'
	);
	const handlerLookup = exactOne(
		methodNodes.filter((node) => node.id === handlersAssignment.valueNodeId),
		'HANDLERS lookup'
	);
	const validationInvocation = exactOne(
		snapshot.invocations.filter((invocation) => invocation.nodeId === parsedAssignment.valueNodeId),
		'validation invocation'
	);
	const handlerInvocation = exactOne(
		snapshot.invocations.filter(
			(invocation) =>
				descendants.has(invocation.nodeId) && invocation.nodeId !== validationInvocation.nodeId
		),
		'handler invocation'
	);
	const handlerCallee = exactOne(
		methodNodes.filter((node) => node.id === handlerInvocation.calleeNodeId),
		'handler callee'
	);
	const handlerArgument = exactOne(
		methodNodes.filter((node) => node.id === handlerInvocation.argumentNodeIds[1]),
		'handler command argument'
	);
	const guardHandler = exactOne(
		methodNodes.filter(
			(node) =>
				node.syntacticIdentifierText === 'handler' &&
				node.id !== handlerCallee.id &&
				node.start > handlersAssignment.nodeId.length &&
				snapshot.references.some(
					(reference) => reference.nodeId === node.id && reference.role === 'SYMBOL_USE'
				)
		),
		'guard handler'
	);
	const commandDeclaration = exactOne(
		snapshot.declarations.filter(
			(declaration) =>
				declaration.name === 'command' &&
				declaration.kind === ts.SyntaxKind.Parameter &&
				declaration.nodeId !== null &&
				descendants.has(declaration.nodeId)
		),
		'command declaration'
	);
	const commandNode = exactOne(
		methodNodes.filter((node) => node.id === commandDeclaration.nodeId),
		'command parameter node'
	);
	return {
		commandDeclaration,
		commandNode,
		commandsAssignment,
		commandsLookup,
		guardHandler,
		handlerArgument,
		handlerInvocation,
		handlerLookup,
		handlersAssignment,
		method,
		parsedAssignment,
		validationInvocation
	};
}

function directChildren(snapshot: StaticSemanticSnapshot, node: SemanticAstNodeRecord) {
	return snapshot.astNodes
		.filter((candidate) => candidate.parentId === node.id)
		.sort((left, right) => left.siblingOrdinal - right.siblingOrdinal || left.start - right.start);
}

function referenceAt(
	snapshot: StaticSemanticSnapshot,
	node: SemanticAstNodeRecord,
	role: SemanticReferenceRecord['role']
): SemanticReferenceRecord {
	return exactOne(
		snapshot.references.filter(
			(reference) => reference.nodeId === node.id && reference.role === role
		),
		`${role} reference`
	);
}

describe('buildCommandDispatchTopology hostile and boundary coverage', { timeout: 60_000 }, () => {
	it('materializes exact null-prototype requests and rejects hostile request shapes precisely', () => {
		const value = fixture();
		const nullRecord = <Type extends object>(record: Type): Type =>
			Object.assign(Object.create(null) as Type, record);
		expect(
			build(value, {
				request: nullRecord({
					...value.dispatchRequest,
					budgets: nullRecord({ ...value.dispatchRequest.budgets }),
					commandBus: nullRecord({ ...value.dispatchRequest.commandBus })
				})
			})
		).toMatchObject({ outcome: 'partial' });

		const inherited = Object.assign(Object.create({ inherited: true }), value.dispatchRequest);
		const nonEnumerable = { ...value.dispatchRequest };
		Object.defineProperty(nonEnumerable, 'subjectId', {
			enumerable: false,
			value: value.dispatchRequest.subjectId
		});
		for (const [request, message] of [
			[null, '$request must be an exact plain data record.'],
			[inherited, '$request must have a plain prototype.'],
			[{ ...value.dispatchRequest, extra: true }, '$request field population is not exact.'],
			[nonEnumerable, '$request.subjectId must be an enumerable data property.'],
			[
				{ ...value.dispatchRequest, budgets: { ...value.dispatchRequest.budgets, maxEdges: 0 } },
				'$request.budgets.maxEdges must be a positive safe integer.'
			],
			[
				{
					...value.dispatchRequest,
					commandBus: { ...value.dispatchRequest.commandBus, sourceId: '' }
				},
				'$request.commandBus.sourceId must be nonempty text.'
			],
			[
				{ ...value.dispatchRequest, semanticSnapshotId: '' },
				'$request.semanticSnapshotId must be nonempty text.'
			],
			[
				{ ...value.dispatchRequest, schemaVersion: 'wrong' },
				'Unsupported command-dispatch topology request schema version.'
			],
			[
				{ ...value.dispatchRequest, operationVersion: 'wrong' },
				'Unsupported command-dispatch topology operation version.'
			],
			[
				{
					...value.dispatchRequest,
					commandBus: { ...value.dispatchRequest.commandBus, logicalPath: 'other.ts' }
				},
				'The command-bus selector is outside the exact supported JPWB surface.'
			]
		] as const) {
			const outcome = build(value, { request });
			expect(outcome).toEqual({
				diagnostics: [{ code: 'REQUEST_INVALID', message, path: null, phase: 'REQUEST' }],
				outcome: 'unavailable'
			});
		}
	});

	it('emits bounded immutable progress while hostile option and sink behavior stays out of evidence', () => {
		const value = fixture();
		const baseline = build(value);
		const events: CommandDispatchTopologyProgressEvent[] = [];
		const observed = build(value, { options: { onProgress: (event) => events.push(event) } });
		expect(observed).toEqual(baseline);
		expect(events).toHaveLength(20);
		expect(events[0]).toMatchObject({ phase: 'REQUEST_BIND', state: 'STARTED' });
		expect(events.at(-1)).toMatchObject({ phase: 'GRAPH_VALIDATE', state: 'COMPLETED' });
		expect(
			events.every(
				(event) =>
					Object.isFrozen(event) &&
					Object.isFrozen(event.counts) &&
					event.schemaVersion === COMMAND_DISPATCH_TOPOLOGY_PROGRESS_SCHEMA_VERSION &&
					event.monotonicDurationMs >= 0 &&
					event.wallDurationMs >= 0 &&
					Object.keys(event.counts).length <= 16 &&
					Object.values(event.counts).every((count) => Number.isSafeInteger(count) && count >= 0)
			)
		).toBe(true);

		for (const options of [
			null,
			new Proxy({}, {}),
			Object.assign(Object.create({ inherited: true }), { onProgress: () => undefined }),
			{ extra: true, onProgress: () => undefined },
			{ onProgress: 'not a function' }
		] as const)
			expect(build(value, { options: options as never })).toEqual(baseline);
		expect(
			build(value, {
				options: {
					onProgress: () => {
						throw new Error('hostile sink');
					}
				}
			})
		).toEqual(baseline);
	});

	it('fails closed for unavailable capabilities, invalid predecessors, ambiguous roots, and source drift', () => {
		const value = fixture();
		const unsupported = cloneSnapshot(value);
		setPopulation(
			unsupported,
			'capabilities',
			unsupported.capabilities.map((capability) =>
				capability.capability === 'TS_SYMBOL'
					? { ...capability, state: 'UNSUPPORTED' as const }
					: capability
			)
		);
		expectUnavailable(value, 'SEMANTIC_CAPABILITY_UNAVAILABLE', { snapshot: unsupported });

		const invalidGraph = structuredClone(value.commandHandlerGraph) as CommandHandlerGraphSnapshot;
		(invalidGraph as { contentDigest: string }).contentDigest = '0'.repeat(64);
		expectUnavailable(value, 'COMMAND_HANDLER_GRAPH_INVALID', { graph: invalidGraph });

		const absent = cloneSnapshot(value);
		const declaration = absent.declarations.find(
			(candidate) => candidate.id === value.commandBusSelector.declarationId
		);
		if (declaration === undefined) throw new Error('Fixture dispatch declaration is absent.');
		Object.assign(declaration as unknown as { kind: number }, {
			kind: ts.SyntaxKind.FunctionDeclaration
		});
		expect(() => selectJpwbCommandDispatchTopology(absent)).toThrowError(
			'Expected exactly one normalized dispatchStamped method; found 0.'
		);
		const deferredAbsent = cloneSnapshot(value);
		expectUnavailable(value, 'COMMAND_BUS_SELECTOR_MISMATCH', {
			options: afterUpstreamValidation(() => {
				const selected = deferredAbsent.declarations.find(
					(candidate) => candidate.id === value.commandBusSelector.declarationId
				)!;
				Object.assign(selected as unknown as { kind: number }, {
					kind: ts.SyntaxKind.FunctionDeclaration
				});
			}),
			snapshot: deferredAbsent
		});

		const ambiguous = cloneSnapshot(value);
		expectUnavailable(value, 'COMMAND_BUS_SELECTOR_MISMATCH', {
			options: afterUpstreamValidation(() => {
				const selected = ambiguous.declarations.find(
					(candidate) => candidate.id === value.commandBusSelector.declarationId
				)!;
				setPopulation(ambiguous, 'declarations', [
					...ambiguous.declarations,
					{
						...selected,
						id: `${selected.id}-duplicate` as typeof selected.id,
						kind: ts.SyntaxKind.MethodDeclaration
					}
				]);
			}),
			snapshot: ambiguous
		});

		const drift = cloneSnapshot(value);
		const source = drift.sources.find(
			(candidate) => candidate.id === value.commandBusSelector.sourceId
		);
		if (source === undefined) throw new Error('Fixture command-bus source is absent.');
		expectUnavailable(value, 'COMMAND_BUS_SELECTOR_MISMATCH', {
			options: afterUpstreamValidation(() => {
				Object.assign(source as unknown as { bytes: number }, { bytes: source.bytes + 1 });
			}),
			snapshot: drift
		});
	});

	it('rejects malformed lookup syntax and exact-reference bindings', () => {
		const value = fixture();
		const cases: ReadonlyArray<readonly [string, (snapshot: StaticSemanticSnapshot) => void]> = [
			[
				'Expected one normalized spec initializer.',
				(snapshot) => {
					const parts = dispatchParts(value, snapshot);
					setPopulation(
						snapshot,
						'assignments',
						snapshot.assignments.filter((item) => item !== parts.commandsAssignment)
					);
				}
			],
			[
				'spec is not initialized by an element lookup.',
				(snapshot) => {
					Object.assign(dispatchParts(value, snapshot).commandsLookup as { kind: number }, {
						kind: ts.SyntaxKind.ObjectLiteralExpression
					});
				}
			],
			[
				'COMMANDS element access must have exactly two direct children.',
				(snapshot) => {
					const parts = dispatchParts(value, snapshot);
					const child = directChildren(snapshot, parts.commandsLookup)[1]!;
					Object.assign(child as { parentId: string }, { parentId: parts.method.id });
				}
			],
			[
				'Expected command.commandType as a direct property access.',
				(snapshot) => {
					const parts = dispatchParts(value, snapshot);
					const access = directChildren(snapshot, parts.commandsLookup)[1]!;
					Object.assign(access as { kind: number }, {
						kind: ts.SyntaxKind.ElementAccessExpression
					});
				}
			],
			[
				'command.commandType must have exactly two direct children.',
				(snapshot) => {
					const parts = dispatchParts(value, snapshot);
					const access = directChildren(snapshot, parts.commandsLookup)[1]!;
					const child = directChildren(snapshot, access)[1]!;
					Object.assign(child as { parentId: string }, { parentId: parts.method.id });
				}
			],
			[
				'command.commandType has noncanonical direct children.',
				(snapshot) => {
					const parts = dispatchParts(value, snapshot);
					const access = directChildren(snapshot, parts.commandsLookup)[1]!;
					Object.assign(
						directChildren(snapshot, access)[1]! as { syntacticIdentifierText: string },
						{
							syntacticIdentifierText: 'payload'
						}
					);
				}
			],
			[
				'COMMANDS has no exact SYMBOL_USE binding.',
				(snapshot) => {
					const parts = dispatchParts(value, snapshot);
					const registry = directChildren(snapshot, parts.commandsLookup)[0]!;
					setPopulation(
						snapshot,
						'references',
						snapshot.references.filter((item) => item.nodeId !== registry.id)
					);
				}
			],
			[
				'A required semantic alias has no terminal symbol identity.',
				(snapshot) => {
					const parts = dispatchParts(value, snapshot);
					const registry = directChildren(snapshot, parts.commandsLookup)[0]!;
					const reference = referenceAt(snapshot, registry, 'SYMBOL_USE');
					Object.assign(reference as unknown as { resolvedSymbolId: string }, {
						resolvedSymbolId: reference.symbolId
					});
					const alias = snapshot.aliases.find(
						(candidate) => candidate.aliasSymbolId === reference.symbolId
					)!;
					Object.assign(alias as unknown as { terminalSymbolId: null }, {
						terminalSymbolId: null
					});
				}
			],
			[
				'A transparent registry expression must have one expression child.',
				(snapshot) => {
					const parts = dispatchParts(value, snapshot);
					const registry = directChildren(snapshot, parts.commandsLookup)[0]!;
					Object.assign(registry as unknown as { kind: number; syntacticIdentifierText: null }, {
						kind: ts.SyntaxKind.AsExpression,
						syntacticIdentifierText: null
					});
				}
			],
			[
				'The lookup base is not the exact COMMANDS identifier.',
				(snapshot) => {
					const parts = dispatchParts(value, snapshot);
					const registry = directChildren(snapshot, parts.commandsLookup)[0]!;
					Object.assign(registry as { syntacticIdentifierText: string }, {
						syntacticIdentifierText: 'NOT_COMMANDS'
					});
				}
			]
		];
		for (const [message, mutate] of cases) {
			const snapshot = cloneSnapshot(value);
			expectUnavailable(value, 'UNSUPPORTED_DISPATCH_PIPELINE', {
				message,
				options: afterUpstreamValidation(() => mutate(snapshot)),
				snapshot
			});
		}
	});

	it('rejects malformed payload validation, guard, and handler invocation semantics', () => {
		const value = fixture();
		const cases: ReadonlyArray<readonly [string, (snapshot: StaticSemanticSnapshot) => void]> = [
			[
				'parsed must be initialized by one normalized call invocation.',
				(snapshot) => {
					const parts = dispatchParts(value, snapshot);
					setPopulation(
						snapshot,
						'invocations',
						snapshot.invocations.filter((item) => item !== parts.validationInvocation)
					);
				}
			],
			[
				'validateAgainst must have exactly three normalized arguments.',
				(snapshot) => {
					const invocation = dispatchParts(value, snapshot).validationInvocation;
					Object.assign(invocation as unknown as { argumentNodeIds: string[] }, {
						argumentNodeIds: invocation.argumentNodeIds.slice(0, 2)
					});
				}
			],
			[
				'The payload validator must be validateAgainst.',
				(snapshot) => {
					const invocation = dispatchParts(value, snapshot).validationInvocation;
					const callee = snapshot.astNodes.find((node) => node.id === invocation.calleeNodeId)!;
					Object.assign(callee as { syntacticIdentifierText: string }, {
						syntacticIdentifierText: 'otherValidator'
					});
				}
			],
			[
				'A validateAgainst argument is absent from the semantic snapshot.',
				(snapshot) => {
					const invocation = dispatchParts(value, snapshot).validationInvocation;
					Object.assign(invocation as unknown as { argumentNodeIds: string[] }, {
						argumentNodeIds: ['semantic:node-missing', ...invocation.argumentNodeIds.slice(1)]
					});
				}
			],
			[
				'validateAgainst does not consume the selected spec binding.',
				(snapshot) => {
					const parts = dispatchParts(value, snapshot);
					const schemaArgument = snapshot.astNodes.find(
						(node) => node.id === parts.validationInvocation.argumentNodeIds[0]
					)!;
					const schemaBase = directChildren(snapshot, schemaArgument)[0]!;
					const handlerRegistry = directChildren(snapshot, parts.handlerLookup)[0]!;
					const alternate = referenceAt(snapshot, handlerRegistry, 'SYMBOL_USE');
					Object.assign(
						referenceAt(snapshot, schemaBase, 'SYMBOL_USE') as unknown as {
							resolvedSymbolId: string;
						},
						{ resolvedSymbolId: alternate.resolvedSymbolId }
					);
				}
			],
			[
				'Expected one direct missing-handler guard.',
				(snapshot) => {
					Object.assign(
						dispatchParts(value, snapshot).guardHandler as { syntacticIdentifierText: string },
						{
							syntacticIdentifierText: 'other'
						}
					);
				}
			],
			[
				'The missing-handler guard does not consume the selected handler binding.',
				(snapshot) => {
					const parts = dispatchParts(value, snapshot);
					if (parts.commandDeclaration.symbolId === null)
						throw new Error('Fixture command parameter has no symbol.');
					Object.assign(
						referenceAt(snapshot, parts.guardHandler, 'SYMBOL_USE') as unknown as {
							resolvedSymbolId: string;
						},
						{ resolvedSymbolId: parts.commandDeclaration.symbolId }
					);
				}
			],
			[
				'Expected one normalized handler invocation.',
				(snapshot) => {
					const invocation = dispatchParts(value, snapshot).handlerInvocation;
					Object.assign(invocation as unknown as { invocationKind: string }, {
						invocationKind: 'CONSTRUCT'
					});
				}
			],
			[
				'The handler invocation must have exactly three normalized arguments.',
				(snapshot) => {
					const invocation = dispatchParts(value, snapshot).handlerInvocation;
					Object.assign(invocation as unknown as { argumentNodeIds: string[] }, {
						argumentNodeIds: invocation.argumentNodeIds.slice(0, 2)
					});
				}
			],
			[
				'The handler invocation arguments do not match ctx, command, parsed.value.',
				(snapshot) => {
					Object.assign(
						dispatchParts(value, snapshot).handlerArgument as { syntacticIdentifierText: string },
						{
							syntacticIdentifierText: 'other'
						}
					);
				}
			],
			[
				'The handler invocation does not consume the selected local bindings.',
				(snapshot) => {
					const argument = dispatchParts(value, snapshot).handlerArgument;
					const reference = referenceAt(snapshot, argument, 'SYMBOL_USE');
					Object.assign(reference as unknown as { resolvedSymbolId: string }, {
						resolvedSymbolId: 'semantic:symbol-other'
					});
				}
			]
		];
		for (const [message, mutate] of cases) {
			const snapshot = cloneSnapshot(value);
			expectUnavailable(value, 'UNSUPPORTED_DISPATCH_PIPELINE', {
				message,
				options: afterUpstreamValidation(() => mutate(snapshot)),
				snapshot
			});
		}
	});

	it('rejects key reconciliation, lexical ordering, target budgets, and predecessor topology holes', () => {
		const value = fixture();
		const handlerTarget = value.commandHandlerGraph.nodes.find(
			(node) => node.kind === 'HANDLER_TARGET'
		)!;
		const cases: ReadonlyArray<
			readonly [
				string,
				CommandDispatchTopologyBuildDiagnosticCode,
				(snapshot: StaticSemanticSnapshot, graph: CommandHandlerGraphSnapshot) => void,
				Partial<typeof value.dispatchRequest.budgets>?
			]
		> = [
			[
				'The selected dispatch method must have one semantic command parameter.',
				'UNSUPPORTED_DISPATCH_PIPELINE',
				(snapshot) => {
					Object.assign(dispatchParts(value, snapshot).commandDeclaration as { symbolId: null }, {
						symbolId: null
					});
				}
			],
			[
				'The HANDLERS lookup does not resolve to the predecessor registry.',
				'UNSUPPORTED_DISPATCH_PIPELINE',
				(_snapshot, graph) => {
					Object.assign(graph.handlerRegistry as { projectId: string }, {
						projectId: 'other-project'
					});
				}
			],
			[
				'The dispatch lookups are not keyed by one exact command.commandType binding.',
				'UNSUPPORTED_DISPATCH_PIPELINE',
				(snapshot) => {
					const parts = dispatchParts(value, snapshot);
					const handlersAccess = directChildren(snapshot, parts.handlerLookup)[1]!;
					const handlersCommand = directChildren(snapshot, handlersAccess)[0]!;
					const registry = directChildren(snapshot, parts.handlerLookup)[0]!;
					const alternate = referenceAt(snapshot, registry, 'SYMBOL_USE');
					Object.assign(
						referenceAt(snapshot, handlersCommand, 'SYMBOL_USE') as unknown as {
							resolvedSymbolId: string;
						},
						{ resolvedSymbolId: alternate.resolvedSymbolId }
					);
				}
			],
			[
				'The normalized dispatch pipeline is not in the required lexical order.',
				'UNSUPPORTED_DISPATCH_PIPELINE',
				(snapshot) => {
					const parts = dispatchParts(value, snapshot);
					const parsedCall = snapshot.astNodes.find(
						(node) => node.id === parts.parsedAssignment.valueNodeId
					)!;
					Object.assign(parsedCall as { start: number }, { start: 0 });
				}
			],
			[
				`Handler target ${handlerTarget.id} has no upstream registration edge.`,
				'UNSUPPORTED_DISPATCH_PIPELINE',
				(_snapshot, graph) => {
					(graph as unknown as { edges: unknown[] }).edges = graph.edges.filter(
						(edge) => edge.relationKind !== 'HANDLER_REGISTRATION_TO_TARGET'
					);
				}
			],
			[
				'An upstream target edge has no handler registration source.',
				'UNSUPPORTED_DISPATCH_PIPELINE',
				(_snapshot, graph) => {
					(graph as unknown as { nodes: unknown[] }).nodes = graph.nodes.filter(
						(node) => node.kind !== 'HANDLER_REGISTRATION'
					);
				}
			],
			[
				'The predecessor graph has no handler-target population to compose.',
				'UNSUPPORTED_DISPATCH_PIPELINE',
				(_snapshot, graph) => {
					(graph as unknown as { nodes: unknown[] }).nodes = graph.nodes.filter(
						(node) => node.kind !== 'HANDLER_TARGET'
					);
				}
			],
			[
				'maxHandlerTargets exceeded: 2 > 1.',
				'BUDGET_EXCEEDED',
				(_snapshot, graph) => {
					const target = graph.nodes.find((node) => node.kind === 'HANDLER_TARGET')!;
					(graph as unknown as { nodes: unknown[] }).nodes = [
						...graph.nodes,
						{ ...target, id: `${target.id}-budget-copy` }
					];
				},
				{ maxHandlerTargets: 1 }
			],
			[
				'maxEdges exceeded: 2 > 1.',
				'BUDGET_EXCEEDED',
				(_snapshot, graph) => {
					const target = graph.nodes.find((node) => node.kind === 'HANDLER_TARGET')!;
					(graph as unknown as { nodes: unknown[] }).nodes = [
						...graph.nodes,
						{ ...target, id: `${target.id}-edge-budget-copy` }
					];
				},
				{ maxEdges: 1 }
			]
		];
		for (const [message, code, mutate, budgets] of cases) {
			const snapshot = cloneSnapshot(value);
			const graph = structuredClone(value.commandHandlerGraph) as CommandHandlerGraphSnapshot;
			const request =
				budgets === undefined
					? value.dispatchRequest
					: {
							...value.dispatchRequest,
							budgets: { ...value.dispatchRequest.budgets, ...budgets }
						};
			expectUnavailable(value, code, {
				graph,
				message,
				options: afterUpstreamValidation(() => mutate(snapshot, graph)),
				request,
				snapshot
			});
		}
	});

	it('accepts a transparent registry wrapper before independent validation catches injected drift', () => {
		const value = fixture();
		const snapshot = cloneSnapshot(value);
		expectUnavailable(value, 'GRAPH_VALIDATION_FAILED', {
			options: afterUpstreamValidation(() => {
				const parts = dispatchParts(value, snapshot);
				const registry = directChildren(snapshot, parts.commandsLookup)[0]!;
				const inner = {
					...registry,
					id: `${registry.id}-transparent-inner` as typeof registry.id,
					parentId: registry.id,
					siblingOrdinal: 0
				};
				Object.assign(registry as unknown as { kind: number; syntacticIdentifierText: null }, {
					kind: ts.SyntaxKind.AsExpression,
					syntacticIdentifierText: null
				});
				const reference = referenceAt(snapshot, registry, 'SYMBOL_USE');
				Object.assign(reference as unknown as { nodeId: string }, { nodeId: inner.id });
				setPopulation(snapshot, 'astNodes', [...snapshot.astNodes, inner]);
			}),
			snapshot
		});
	});

	it('fails closed when a parsed projected reference disappears before composition', () => {
		const value = fixture();
		const snapshot = cloneSnapshot(value);
		const parts = dispatchParts(value, snapshot);
		const referenceId = referenceAt(snapshot, parts.guardHandler, 'SYMBOL_USE').id;
		expectUnavailable(value, 'UNSUPPORTED_DISPATCH_PIPELINE', {
			message: 'A projected reference identity is absent.',
			options: atProgress('TARGET_COMPOSE', 'STARTED', () => {
				setPopulation(
					snapshot,
					'references',
					snapshot.references.filter((reference) => reference.id !== referenceId)
				);
			}),
			snapshot
		});
	});

	it('classifies non-Error semantic hostility with the bounded generic diagnostic', () => {
		const value = fixture();
		const snapshot = cloneSnapshot(value);
		expectUnavailable(value, 'UNSUPPORTED_DISPATCH_PIPELINE', {
			message: 'Command-dispatch topology construction failed closed.',
			options: afterUpstreamValidation(() => {
				setPopulation(
					snapshot,
					'astNodes',
					new Proxy(snapshot.astNodes, {
						get() {
							throw 'hostile non-Error';
						}
					})
				);
			}),
			snapshot
		});
	});
});
