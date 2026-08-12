import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';

import {
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
	type ArrowCommandCensusObservation
} from '../contracts/arrow-command-census.js';
import type {
	BuildCommandHandlerGraphRequest,
	CommandHandlerRegistrySelector
} from '../contracts/command-handler-graph.js';
import type {
	SemanticAstNodeRecord,
	SemanticDeclarationRecord,
	SemanticSourceRecord,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import { sha256 } from '../inventory/canonical.js';
import { normalizeArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/normalize-arrow-command-census.js';
import { attachFrozenSubjectBytes, readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import {
	buildCommandHandlerGraph,
	selectJpwbCommandHandlerRegistries,
	type BuildCommandHandlerGraphOptions,
	type CommandHandlerGraphProgressEvent
} from './build-command-handler-graph.js';
import {
	createCommandHandlerGraphFixture,
	createSharedDirectCommandHandlerGraphFixture,
	type CommandHandlerGraphFixture
} from './command-handler-graph-fixture.test-support.js';

const cleanups: Array<() => void> = [];

afterEach(() => {
	for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function fixture(shared = false): CommandHandlerGraphFixture {
	const value = shared
		? createSharedDirectCommandHandlerGraphFixture()
		: createCommandHandlerGraphFixture();
	cleanups.push(value.cleanup);
	return value;
}

function cloneSnapshot(value: CommandHandlerGraphFixture): StaticSemanticSnapshot {
	return structuredClone(value.snapshot) as StaticSemanticSnapshot;
}

function setPopulation<Key extends keyof StaticSemanticSnapshot>(
	snapshot: StaticSemanticSnapshot,
	key: Key,
	value: StaticSemanticSnapshot[Key]
): void {
	(snapshot as unknown as Record<Key, StaticSemanticSnapshot[Key]>)[key] = value;
}

function expectUnavailable(
	value: CommandHandlerGraphFixture,
	input: {
		readonly message: string;
		readonly observation?: ArrowCommandCensusObservation;
		readonly options?: BuildCommandHandlerGraphOptions;
		readonly request?: unknown;
		readonly snapshot?: StaticSemanticSnapshot;
	}
): void {
	const observation = input.observation ?? value.observation;
	const request =
		input.request ??
		(observation === value.observation
			? value.graphRequest
			: { ...value.graphRequest, arrowObservationId: observation.id });
	const outcome = buildCommandHandlerGraph(
		request,
		input.snapshot ?? value.snapshot,
		observation,
		value.subject,
		input.options
	);
	expect(outcome).toEqual({
		diagnostics: [
			{
				code: 'INPUT_INVALID',
				message: input.message,
				path: null,
				phase: 'CLASSIFY'
			}
		],
		outcome: 'unavailable'
	});
}

interface RegistryStructure {
	readonly declaration: SemanticDeclarationRecord;
	readonly initializerNode: SemanticAstNodeRecord;
	readonly memberAssignment: StaticSemanticSnapshot['assignments'][number];
	readonly nameNode: SemanticAstNodeRecord;
	readonly objectNode: SemanticAstNodeRecord;
	readonly propertyNode: SemanticAstNodeRecord;
	readonly valueNode: SemanticAstNodeRecord;
}

function registryStructure(
	snapshot: StaticSemanticSnapshot,
	selector: CommandHandlerRegistrySelector,
	memberName: string
): RegistryStructure {
	const declaration = snapshot.declarations.find((item) => item.id === selector.declarationId);
	if (declaration?.nodeId === null || declaration === undefined)
		throw new Error(`Fixture registry declaration ${selector.exportName} is absent.`);
	const initializer = snapshot.assignments.find(
		(item) =>
			item.nodeId === declaration.nodeId &&
			item.assignmentKind === 'INITIALIZER' &&
			item.valueNodeId !== null
	);
	if (initializer?.valueNodeId === null || initializer === undefined)
		throw new Error(`Fixture registry ${selector.exportName} has no initializer.`);
	const initializerNode = snapshot.astNodes.find((item) => item.id === initializer.valueNodeId);
	if (initializerNode === undefined) throw new Error('Fixture initializer node is absent.');
	const objectNode =
		initializerNode.kind === ts.SyntaxKind.ObjectLiteralExpression
			? initializerNode
			: snapshot.astNodes.find(
					(item) =>
						item.parentId === initializerNode.id &&
						item.kind === ts.SyntaxKind.ObjectLiteralExpression
				);
	if (objectNode === undefined) throw new Error('Fixture registry object node is absent.');
	const propertyNode = snapshot.astNodes.find(
		(item) =>
			item.parentId === objectNode.id &&
			item.kind === ts.SyntaxKind.PropertyAssignment &&
			snapshot.declarations.some(
				(declarationItem) =>
					declarationItem.nodeId === item.id && declarationItem.name === memberName
			)
	);
	if (propertyNode === undefined) throw new Error(`Fixture member ${memberName} is absent.`);
	const memberAssignment = snapshot.assignments.find(
		(item) =>
			item.nodeId === propertyNode.id &&
			item.assignmentKind === 'INITIALIZER' &&
			item.valueNodeId !== null
	);
	if (memberAssignment?.valueNodeId === null || memberAssignment === undefined)
		throw new Error(`Fixture member ${memberName} has no assignment.`);
	const nameNode = snapshot.astNodes.find((item) => item.id === memberAssignment.targetNodeId);
	const valueNode = snapshot.astNodes.find((item) => item.id === memberAssignment.valueNodeId);
	if (nameNode === undefined || valueNode === undefined)
		throw new Error(`Fixture member ${memberName} has dangling nodes.`);
	return {
		declaration,
		initializerNode,
		memberAssignment,
		nameNode,
		objectNode,
		propertyNode,
		valueNode
	};
}

function subjectBytes(value: CommandHandlerGraphFixture): Map<string, Uint8Array> {
	return new Map(
		value.subject.artifacts.map((artifact) => {
			const bytes = readFrozenSubjectArtifact(value.subject, artifact.path);
			if (bytes === undefined) throw new Error(`Fixture bytes are absent for ${artifact.path}.`);
			return [artifact.path, bytes] as const;
		})
	);
}

function utf16Bytes(text: string, endian: 'BE' | 'LE'): Uint8Array {
	const bytes = new Uint8Array(2 + text.length * 2);
	bytes[0] = endian === 'LE' ? 0xff : 0xfe;
	bytes[1] = endian === 'LE' ? 0xfe : 0xff;
	for (let index = 0; index < text.length; index += 1) {
		const code = text.charCodeAt(index);
		bytes[2 + index * 2] = endian === 'LE' ? code & 0xff : code >>> 8;
		bytes[3 + index * 2] = endian === 'LE' ? code >>> 8 : code & 0xff;
	}
	return bytes;
}

function observationAt(
	value: CommandHandlerGraphFixture,
	site: string
): ArrowCommandCensusObservation {
	const evidence = structuredClone(value.observation.rawEvidence);
	const arrow = evidence.declaredArrows[0];
	if (arrow === undefined) throw new Error('Fixture arrow evidence is absent.');
	(evidence as unknown as { declaredArrows: Array<typeof arrow> }).declaredArrows = [
		{ ...arrow, site }
	];
	return normalizeArrowCommandCensusObservation({
		artifactSet: value.arrowArtifactSet,
		evidence,
		executor: value.observation.executor,
		request: {
			artifactSetId: value.arrowArtifactSet.id,
			budgets: value.observation.budgets,
			operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
			schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
			subjectId: value.subject.descriptor.subjectId
		}
	}).observation;
}

describe('buildCommandHandlerGraph hostile and boundary coverage', () => {
	it('accepts null-prototype request records and rejects exact-shape violations with precise telemetry', () => {
		const value = fixture();
		const nullRecord = <Type extends object>(record: Type): Type =>
			Object.assign(Object.create(null) as Type, record);
		const acceptedRequest = nullRecord({
			...value.graphRequest,
			budgets: nullRecord({ ...value.graphRequest.budgets }),
			commandRegistry: nullRecord({ ...value.graphRequest.commandRegistry }),
			handlerRegistry: nullRecord({ ...value.graphRequest.handlerRegistry })
		});
		expect(
			buildCommandHandlerGraph(acceptedRequest, value.snapshot, value.observation, value.subject, {
				onProgress: 'not a function' as never
			})
		).toMatchObject({ outcome: 'partial' });

		const wrongPrototype = Object.assign(Object.create({ inherited: true }), value.graphRequest);
		const nonEnumerable = { ...value.graphRequest };
		Object.defineProperty(nonEnumerable, 'subjectId', {
			enumerable: false,
			value: value.graphRequest.subjectId
		});
		const cases: ReadonlyArray<readonly [unknown, string]> = [
			[wrongPrototype, '$request must have a plain prototype.'],
			[nonEnumerable, '$request.subjectId must be an enumerable data property.'],
			[
				{
					...value.graphRequest,
					handlerRegistry: { ...value.graphRequest.handlerRegistry, exportName: 'COMMANDS' }
				},
				'$request.handlerRegistry.exportName must be HANDLERS.'
			],
			[
				{
					...value.graphRequest,
					commandRegistry: { ...value.graphRequest.commandRegistry, logicalPath: '' }
				},
				'$request.commandRegistry.logicalPath must be nonempty text.'
			],
			[
				{ ...value.graphRequest, semanticSnapshotId: '' },
				'$request.semanticSnapshotId must be nonempty text.'
			],
			[
				{
					...value.graphRequest,
					budgets: { ...value.graphRequest.budgets, maxEdges: Number.MAX_SAFE_INTEGER + 1 }
				},
				'$request.budgets.maxEdges must be a positive safe integer.'
			]
		];
		for (const [request, message] of cases) {
			const events: CommandHandlerGraphProgressEvent[] = [];
			const outcome = buildCommandHandlerGraph(
				request,
				value.snapshot,
				value.observation,
				value.subject,
				{ onProgress: (event) => events.push(event) }
			);
			expect(outcome).toEqual({
				diagnostics: [{ code: 'REQUEST_INVALID', message, path: null, phase: 'REQUEST' }],
				outcome: 'unavailable'
			});
			expect(events).toMatchObject([
				{ phase: 'REQUEST_BIND', state: 'STARTED' },
				{
					details: { diagnosticCode: 'REQUEST_INVALID' },
					phase: 'REQUEST_BIND',
					state: 'FAILED'
				}
			]);
		}
	}, 30_000);

	it('independently rejects duplicate, dangling, and ambiguous semantic selector populations', () => {
		const value = fixture();
		const duplicateIdentity = cloneSnapshot(value);
		setPopulation(duplicateIdentity, 'sources', [
			...duplicateIdentity.sources,
			duplicateIdentity.sources[0]!
		]);
		expect(() => selectJpwbCommandHandlerRegistries(duplicateIdentity)).toThrowError(
			'Semantic input contains duplicate identities.'
		);

		const danglingNode = cloneSnapshot(value);
		const firstNode = danglingNode.astNodes[0]!;
		Object.assign(firstNode as unknown as { sourceId: string }, {
			sourceId: 'semantic:source-missing'
		});
		expect(() => selectJpwbCommandHandlerRegistries(danglingNode)).toThrowError(
			`AST node ${firstNode.id} has no source.`
		);

		const duplicateInvocation = cloneSnapshot(value);
		const invocation = duplicateInvocation.invocations[0];
		if (invocation === undefined) throw new Error('Fixture invocation is absent.');
		setPopulation(duplicateInvocation, 'invocations', [
			...duplicateInvocation.invocations,
			invocation
		]);
		expect(() => selectJpwbCommandHandlerRegistries(duplicateInvocation)).toThrowError(
			'Semantic invocation nodes are not unique.'
		);

		const absent = cloneSnapshot(value);
		const selected = absent.sources.find(
			(source) => source.id === value.graphRequest.commandRegistry.sourceId
		);
		if (selected === undefined) throw new Error('Selected fixture source is absent.');
		Object.assign(selected as unknown as { logicalPath: string }, {
			logicalPath: 'moved/messages.ts'
		});
		expect(() => selectJpwbCommandHandlerRegistries(absent)).toThrowError(
			'Expected exactly one deep-indexed source for the selected logical path; found 0.'
		);

		const ambiguous = cloneSnapshot(value);
		const original = ambiguous.sources.find(
			(source) => source.id === value.graphRequest.commandRegistry.sourceId
		);
		if (original === undefined) throw new Error('Selected fixture source is absent.');
		const duplicate = {
			...original,
			id: `${original.id}-distinct`
		} as SemanticSourceRecord;
		setPopulation(ambiguous, 'sources', [...ambiguous.sources, duplicate]);
		expect(() => selectJpwbCommandHandlerRegistries(ambiguous)).toThrowError(
			'Expected exactly one deep-indexed source for the selected logical path; found 2.'
		);

		const wrongDeclarationKind = cloneSnapshot(value);
		const selectedDeclaration = wrongDeclarationKind.declarations.find(
			(declaration) => declaration.id === value.graphRequest.commandRegistry.declarationId
		);
		if (selectedDeclaration === undefined) throw new Error('Selected declaration is absent.');
		Object.assign(selectedDeclaration as unknown as { kind: number }, {
			kind: ts.SyntaxKind.FunctionDeclaration
		});
		expect(() => selectJpwbCommandHandlerRegistries(wrongDeclarationKind)).toThrowError(
			'Expected exactly one selected registry declaration; found 0.'
		);
	}, 30_000);

	it('fails closed on unsupported normalized registry grammar and records the interrupted phase', () => {
		const value = fixture();
		const cases: ReadonlyArray<readonly [string, (snapshot: StaticSemanticSnapshot) => void]> = [
			[
				'Selected registry has no exact normalized initializer.',
				(snapshot) => {
					const structure = registryStructure(
						snapshot,
						value.graphRequest.commandRegistry,
						'StartWork'
					);
					setPopulation(
						snapshot,
						'assignments',
						snapshot.assignments.filter((item) => item.nodeId !== structure.declaration.nodeId)
					);
				}
			],
			[
				'Selected registry initializer is not a normalized object literal.',
				(snapshot) => {
					const structure = registryStructure(
						snapshot,
						value.graphRequest.commandRegistry,
						'StartWork'
					);
					Object.assign(structure.initializerNode as unknown as { kind: number }, {
						kind: ts.SyntaxKind.ArrayLiteralExpression
					});
				}
			],
			[
				'Selected registry initializer is not a normalized object literal.',
				(snapshot) => {
					const structure = registryStructure(
						snapshot,
						value.graphRequest.commandRegistry,
						'StartWork'
					);
					if (structure.initializerNode.kind === ts.SyntaxKind.ObjectLiteralExpression)
						throw new Error('Fixture initializer unexpectedly lacks a transparent wrapper.');
					Object.assign(structure.objectNode as unknown as { parentId: string }, {
						parentId: snapshot.sources.find(
							(source) => source.id === value.graphRequest.commandRegistry.sourceId
						)?.rootNodeId
					});
				}
			],
			[
				'Selected registry contains an unsupported member grammar.',
				(snapshot) => {
					const structure = registryStructure(
						snapshot,
						value.graphRequest.commandRegistry,
						'StartWork'
					);
					Object.assign(structure.propertyNode as unknown as { kind: number }, {
						kind: ts.SyntaxKind.ShorthandPropertyAssignment
					});
				}
			],
			[
				'Selected registry member has no exact normalized value binding.',
				(snapshot) => {
					const structure = registryStructure(
						snapshot,
						value.graphRequest.commandRegistry,
						'StartWork'
					);
					setPopulation(
						snapshot,
						'assignments',
						snapshot.assignments.filter((item) => item.nodeId !== structure.propertyNode.id)
					);
				}
			],
			[
				'Selected registry member has a dangling normalized endpoint.',
				(snapshot) => {
					const structure = registryStructure(
						snapshot,
						value.graphRequest.commandRegistry,
						'StartWork'
					);
					Object.assign(structure.memberAssignment as unknown as { valueNodeId: string }, {
						valueNodeId: 'semantic:node-missing'
					});
				}
			],
			[
				'Selected registry member has an unsupported computed name.',
				(snapshot) => {
					const structure = registryStructure(
						snapshot,
						value.graphRequest.commandRegistry,
						'StartWork'
					);
					Object.assign(structure.nameNode as unknown as { syntacticIdentifierText: null }, {
						syntacticIdentifierText: null
					});
					setPopulation(
						snapshot,
						'literals',
						snapshot.literals.filter((item) => item.nodeId !== structure.nameNode.id)
					);
				}
			],
			[
				'Selected registry member has ambiguous declarations.',
				(snapshot) => {
					const structure = registryStructure(
						snapshot,
						value.graphRequest.commandRegistry,
						'StartWork'
					);
					const declaration = snapshot.declarations.find(
						(item) => item.nodeId === structure.propertyNode.id
					);
					if (declaration === undefined) throw new Error('Fixture property declaration is absent.');
					setPopulation(snapshot, 'declarations', [
						...snapshot.declarations,
						{ ...declaration, id: `${declaration.id}-ambiguous` } as SemanticDeclarationRecord
					]);
				}
			]
		];

		for (const [message, mutate] of cases) {
			const snapshot = cloneSnapshot(value);
			mutate(snapshot);
			const events: CommandHandlerGraphProgressEvent[] = [];
			expectUnavailable(value, {
				message,
				options: { onProgress: (event) => events.push(event) },
				snapshot
			});
			expect(events.at(-1)).toMatchObject({
				details: { diagnosticCode: 'INPUT_INVALID' },
				phase: 'CONTRACT_PARSE',
				state: 'FAILED'
			});
		}
	}, 30_000);

	it('covers duplicate names, empty registries, missing registrations, and provenance rejection', () => {
		const shared = fixture(true);
		const duplicateName = cloneSnapshot(shared);
		const duplicateStructure = registryStructure(
			duplicateName,
			shared.graphRequest.commandRegistry,
			'ResumeWork'
		);
		Object.assign(duplicateStructure.nameNode as unknown as { syntacticIdentifierText: string }, {
			syntacticIdentifierText: 'StartWork'
		});
		expectUnavailable(shared, {
			message: 'Selected registry contains duplicate command names.',
			snapshot: duplicateName
		});

		const empty = fixture();
		const emptySnapshot = cloneSnapshot(empty);
		const onlyHandler = registryStructure(
			emptySnapshot,
			empty.graphRequest.handlerRegistry,
			'StartWork'
		);
		Object.assign(onlyHandler.propertyNode as unknown as { parentId: string }, {
			parentId: emptySnapshot.sources.find(
				(source) => source.id === empty.graphRequest.handlerRegistry.sourceId
			)?.rootNodeId
		});
		expectUnavailable(empty, {
			message: 'The selected JPWB HANDLERS registry is unexpectedly empty.',
			snapshot: emptySnapshot
		});

		const missing = fixture(true);
		const missingSnapshot = cloneSnapshot(missing);
		const removedHandler = registryStructure(
			missingSnapshot,
			missing.graphRequest.handlerRegistry,
			'ResumeWork'
		);
		Object.assign(removedHandler.propertyNode as unknown as { parentId: string }, {
			parentId: missingSnapshot.sources.find(
				(source) => source.id === missing.graphRequest.handlerRegistry.sourceId
			)?.rootNodeId
		});
		const missingOutcome = buildCommandHandlerGraph(
			missing.graphRequest,
			missingSnapshot,
			missing.observation,
			missing.subject
		);
		expect(missingOutcome.outcome, JSON.stringify(missingOutcome)).toBe('partial');
		if (missingOutcome.outcome !== 'partial') throw new Error('Expected a partial graph.');
		expect(missingOutcome.graph.coverage).toMatchObject({
			commandRegistryClosure: 'OPEN',
			missingHandlerRegistrations: 1
		});
		expect(
			missingOutcome.graph.nodes
				.filter((node) => node.kind === 'FRONTIER')
				.map((node) => node.frontierKind)
				.sort()
		).toEqual(['COMMAND_WITHOUT_DECLARED_ARROW_EVIDENCE', 'MISSING_HANDLER_REGISTRATION']);

		const badProvenance = fixture();
		const badProvenanceSnapshot = cloneSnapshot(badProvenance);
		const commandSource = badProvenanceSnapshot.sources.find(
			(source) => source.id === badProvenance.graphRequest.commandRegistry.sourceId
		);
		if (commandSource === undefined) throw new Error('Fixture command source is absent.');
		Object.assign(commandSource as unknown as { provenanceId: string }, {
			provenanceId: 'analysis:provenance-unknown'
		});
		expectUnavailable(badProvenance, {
			message: 'The graph references an unknown semantic provenance.',
			snapshot: badProvenanceSnapshot
		});
	}, 30_000);

	it('ignores a hostile telemetry-options descriptor trap', () => {
		const value = fixture();
		const options: BuildCommandHandlerGraphOptions = {};
		const original = Reflect.getOwnPropertyDescriptor;
		Reflect.getOwnPropertyDescriptor = (target, key) => {
			if (target === options && key === 'onProgress') throw new Error('hostile descriptor trap');
			return original(target, key);
		};
		try {
			expect(
				buildCommandHandlerGraph(
					value.graphRequest,
					value.snapshot,
					value.observation,
					value.subject,
					options
				)
			).toMatchObject({ outcome: 'partial' });
		} finally {
			Reflect.getOwnPropertyDescriptor = original;
		}
	});

	it('retains unresolved callable-declaration branches as explicit frontiers', () => {
		const value = fixture();
		for (const mutate of [
			(declaration: SemanticDeclarationRecord) => {
				Object.assign(declaration as unknown as { nodeId: null }, { nodeId: null });
			},
			(declaration: SemanticDeclarationRecord) => {
				Object.assign(declaration as unknown as { nodeId: string }, {
					nodeId: 'semantic:node-absent-callable'
				});
			},
			(declaration: SemanticDeclarationRecord, snapshot: StaticSemanticSnapshot) => {
				setPopulation(
					snapshot,
					'assignments',
					snapshot.assignments.filter((assignment) => assignment.nodeId !== declaration.nodeId)
				);
			}
		] as const) {
			const snapshot = cloneSnapshot(value);
			const structure = registryStructure(
				snapshot,
				value.graphRequest.handlerRegistry,
				'StartWork'
			);
			const reference = snapshot.references.find(
				(candidate) => candidate.nodeId === structure.valueNode.id
			);
			const symbol = snapshot.symbols.find(
				(candidate) => candidate.id === reference?.resolvedSymbolId
			);
			const declaration = snapshot.declarations.find((candidate) =>
				symbol?.declarationIds.includes(candidate.id)
			);
			if (declaration === undefined) throw new Error('Fixture callable declaration is absent.');
			mutate(declaration, snapshot);
			const outcome = buildCommandHandlerGraph(
				value.graphRequest,
				snapshot,
				value.observation,
				value.subject
			);
			expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
			if (outcome.outcome !== 'partial') throw new Error('Expected a partial graph.');
			expect(
				outcome.graph.nodes
					.filter((node) => node.kind === 'FRONTIER')
					.map((node) => node.frontierKind)
					.sort()
			).toEqual([
				'COMMAND_WITHOUT_DECLARED_ARROW_EVIDENCE',
				'SITE_OWNER_NOT_REGISTERED_HANDLER',
				'UNRESOLVED_HANDLER_TARGET'
			]);
		}
	}, 30_000);

	it('fails closed when selector and target source maps change between materialization phases', () => {
		const selected = fixture();
		const selectedBase = cloneSnapshot(selected);
		let selectedNodeReads = 0;
		let selectedSourceReads = 0;
		const selectedSnapshot = { ...selectedBase } as StaticSemanticSnapshot;
		Object.defineProperties(selectedSnapshot, {
			astNodes: {
				enumerable: true,
				get: () => {
					selectedNodeReads += 1;
					return selectedNodeReads <= 3 ? [] : selectedBase.astNodes;
				}
			},
			sources: {
				enumerable: true,
				get: () => {
					selectedSourceReads += 1;
					return selectedSourceReads <= 2 ? [] : selectedBase.sources;
				}
			}
		});
		expectUnavailable(selected, {
			message: 'A selected registry source is absent from the semantic snapshot.',
			snapshot: selectedSnapshot
		});

		const target = fixture();
		const targetBase = cloneSnapshot(target);
		const implementationSource = targetBase.sources.find(
			(source) => source.logicalPath === 'packages/rph-application/src/handlers/work.ts'
		);
		if (implementationSource === undefined)
			throw new Error('Fixture implementation source is absent.');
		const indexedSources = targetBase.sources.filter(
			(source) => source.id !== implementationSource.id
		);
		const indexedNodes = targetBase.astNodes.filter(
			(node) => node.sourceId !== implementationSource.id
		);
		let targetNodeReads = 0;
		let targetSourceReads = 0;
		const targetSnapshot = { ...targetBase } as StaticSemanticSnapshot;
		Object.defineProperties(targetSnapshot, {
			astNodes: {
				enumerable: true,
				get: () => {
					targetNodeReads += 1;
					return targetNodeReads === 3 ? indexedNodes : targetBase.astNodes;
				}
			},
			sources: {
				enumerable: true,
				get: () => {
					targetSourceReads += 1;
					return targetSourceReads <= 2 ? indexedSources : targetBase.sources;
				}
			}
		});
		expectUnavailable(target, {
			message: 'A resolved handler target source is absent.',
			snapshot: targetSnapshot
		});
	}, 30_000);

	it('parses a populated PWU lifecycle table before exact table attribution', () => {
		const value = fixture();
		const snapshot = cloneSnapshot(value);
		const sourceStructure = registryStructure(
			snapshot,
			value.graphRequest.commandRegistry,
			'StartWork'
		);
		const pwuSource = snapshot.sources.find(
			(source) => source.logicalPath === 'packages/rph-domain/src/pwu-lifecycle-command-spec.ts'
		);
		const pwuDeclaration = snapshot.declarations.find(
			(declaration) =>
				declaration.sourceId === pwuSource?.id && declaration.name === 'PWU_LIFECYCLE_COMMAND_SPECS'
		);
		const pwuAssignment = snapshot.assignments.find(
			(assignment) =>
				assignment.nodeId === pwuDeclaration?.nodeId && assignment.valueNodeId !== null
		);
		const pwuObject = snapshot.astNodes.find((node) => node.id === pwuAssignment?.valueNodeId);
		if (pwuSource === undefined || pwuObject === undefined)
			throw new Error('Fixture PWU table root is absent.');
		const suffix = '-pwu-table';
		const property = {
			...sourceStructure.propertyNode,
			id: `${sourceStructure.propertyNode.id}${suffix}`,
			parentId: pwuObject.id,
			sourceId: pwuSource.id
		} as SemanticAstNodeRecord;
		const name = {
			...sourceStructure.nameNode,
			id: `${sourceStructure.nameNode.id}${suffix}`,
			parentId: property.id,
			sourceId: pwuSource.id
		} as SemanticAstNodeRecord;
		const memberValue = {
			...sourceStructure.valueNode,
			id: `${sourceStructure.valueNode.id}${suffix}`,
			parentId: property.id,
			sourceId: pwuSource.id
		} as SemanticAstNodeRecord;
		setPopulation(snapshot, 'astNodes', [...snapshot.astNodes, property, name, memberValue]);
		setPopulation(snapshot, 'assignments', [
			...snapshot.assignments,
			{
				...sourceStructure.memberAssignment,
				nodeId: property.id,
				targetNodeId: name.id,
				valueNodeId: memberValue.id
			}
		]);
		const observation = observationAt(value, 'PWU_LIFECYCLE_COMMAND_SPECS.StartWork');
		const outcome = buildCommandHandlerGraph(
			{ ...value.graphRequest, arrowObservationId: observation.id },
			snapshot,
			observation,
			value.subject
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error('Expected a partial graph.');
		expect(outcome.graph.coverage).toMatchObject({
			commandsWithArrowEvidence: 1,
			tableCommandArrowSites: 1
		});
		expect(
			outcome.graph.edges.some(
				(edge) => edge.relationKind === 'COMMAND_REGISTRY_ENTRY_TO_TABLE_ARROW_SITE'
			)
		).toBe(true);
	}, 30_000);

	it('fails closed when hostile semantic mutations make constructed unresolved registrations irreproducible', () => {
		const value = fixture();
		const snapshots = [
			(snapshot: StaticSemanticSnapshot, structure: RegistryStructure) => {
				Object.assign(structure.valueNode as unknown as { syntacticIdentifierText: null }, {
					syntacticIdentifierText: null
				});
			},
			(snapshot: StaticSemanticSnapshot, structure: RegistryStructure) => {
				setPopulation(
					snapshot,
					'references',
					snapshot.references.filter((item) => item.nodeId !== structure.valueNode.id)
				);
			},
			(snapshot: StaticSemanticSnapshot, structure: RegistryStructure) => {
				const reference = snapshot.references.find(
					(item) => item.nodeId === structure.valueNode.id
				);
				if (reference === undefined) throw new Error('Fixture handler reference is absent.');
				Object.assign(reference as unknown as { resolvedSymbolId: string }, {
					resolvedSymbolId: 'semantic:symbol-missing'
				});
			},
			(snapshot: StaticSemanticSnapshot, structure: RegistryStructure) => {
				const reference = snapshot.references.find(
					(item) => item.nodeId === structure.valueNode.id
				);
				const symbol = snapshot.symbols.find((item) => item.id === reference?.resolvedSymbolId);
				if (symbol === undefined) throw new Error('Fixture handler symbol is absent.');
				Object.assign(symbol as unknown as { declarationIds: [] }, { declarationIds: [] });
			}
		] as const;

		for (const [index, mutate] of snapshots.entries()) {
			const snapshot = cloneSnapshot(value);
			const structure = registryStructure(
				snapshot,
				value.graphRequest.handlerRegistry,
				'StartWork'
			);
			mutate(snapshot, structure);
			const outcome = buildCommandHandlerGraph(
				value.graphRequest,
				snapshot,
				value.observation,
				value.subject
			);
			if (outcome.outcome !== 'partial') {
				expect(index).toBeGreaterThan(0);
				expect(outcome).toMatchObject({
					diagnostics: [expect.objectContaining({ code: 'GRAPH_VALIDATION_FAILED' })],
					outcome: 'unavailable'
				});
				continue;
			}
			expect(outcome.graph.coverage).toMatchObject({
				commandsWithArrowEvidence: 0,
				commandsWithoutArrowEvidence: 1,
				frontierNodes: 3,
				handlerTargets: 0
			});
			expect(
				outcome.graph.nodes
					.filter((node) => node.kind === 'FRONTIER')
					.map((node) => node.frontierKind)
					.sort()
			).toEqual([
				'COMMAND_WITHOUT_DECLARED_ARROW_EVIDENCE',
				'SITE_OWNER_NOT_REGISTERED_HANDLER',
				'UNRESOLVED_HANDLER_TARGET'
			]);
		}

		const shared = fixture(true);
		const snapshot = cloneSnapshot(shared);
		const command = registryStructure(snapshot, shared.graphRequest.commandRegistry, 'ResumeWork');
		Object.assign(command.propertyNode as unknown as { parentId: string }, {
			parentId: snapshot.sources.find(
				(source) => source.id === shared.graphRequest.commandRegistry.sourceId
			)?.rootNodeId
		});
		const handler = registryStructure(snapshot, shared.graphRequest.handlerRegistry, 'ResumeWork');
		setPopulation(
			snapshot,
			'references',
			snapshot.references.filter((item) => item.nodeId !== handler.valueNode.id)
		);
		const outcome = buildCommandHandlerGraph(
			shared.graphRequest,
			snapshot,
			shared.observation,
			shared.subject
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error('Expected a partial graph.');
		expect(outcome.graph.coverage).toMatchObject({
			commandRegistryClosure: 'OPEN',
			discoveredCommandRegistryEntries: 1,
			discoveredHandlerRegistryEntries: 2,
			undeclaredHandlerRegistrations: 1
		});
		expect(
			outcome.graph.nodes
				.filter((node) => node.kind === 'FRONTIER')
				.map((node) => node.frontierKind)
				.sort()
		).toEqual(['UNDECLARED_HANDLER_REGISTRATION', 'UNRESOLVED_HANDLER_TARGET']);
	}, 30_000);

	it('represents unresolved direct and table evidence as frontiers without promoting attribution', () => {
		const value = fixture();
		for (const [locator, expectedSource] of [
			['registry.ts:999', true],
			['work.ts:999', true],
			['STEP_COMMAND_SPECS.UnknownWork', true],
			['PWU_LIFECYCLE_COMMAND_SPECS.StartWork', true]
		] as const) {
			const observation = observationAt(value, locator);
			const outcome = buildCommandHandlerGraph(
				{ ...value.graphRequest, arrowObservationId: observation.id },
				value.snapshot,
				observation,
				value.subject
			);
			expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
			if (outcome.outcome !== 'partial') throw new Error('Expected a partial graph.');
			const site = outcome.graph.nodes.find((node) => node.kind === 'DECLARED_ARROW_SITE');
			expect(site).toMatchObject({
				attribution: 'UNRESOLVED',
				semanticSiteNodeId: null,
				sourceId: expectedSource ? expect.any(String) : null
			});
			expect(
				outcome.graph.nodes
					.filter((node) => node.kind === 'FRONTIER')
					.map((node) => node.frontierKind)
					.sort()
			).toEqual(['COMMAND_WITHOUT_DECLARED_ARROW_EVIDENCE', 'SITE_OWNER_NOT_REGISTERED_HANDLER']);
			expect(outcome.graph.edges.every((edge) => edge.attribution === 'EXACT')).toBe(true);
		}
	}, 30_000);

	it('enforces the two registry-entry budgets that are independent from graph-size budgets', () => {
		const value = fixture();
		for (const [budget, message] of [
			['maxCommandRegistryEntries', 'maxCommandRegistryEntries exceeded: 1 > 0.'],
			['maxHandlerRegistryEntries', 'maxHandlerRegistryEntries exceeded: 1 > 0.']
		] as const) {
			const request = structuredClone(value.graphRequest) as BuildCommandHandlerGraphRequest;
			Object.assign(request.budgets as unknown as Record<typeof budget, number>, { [budget]: 1 });
			const shared = fixture(true);
			const sharedRequest = {
				...shared.graphRequest,
				budgets: { ...shared.graphRequest.budgets, [budget]: 1 }
			};
			const outcome = buildCommandHandlerGraph(
				sharedRequest,
				shared.snapshot,
				shared.observation,
				shared.subject
			);
			expect(outcome).toEqual({
				diagnostics: [
					{
						code: 'BUDGET_EXCEEDED',
						message: message.replace('1 > 0', '2 > 1'),
						path: null,
						phase: 'CLASSIFY'
					}
				],
				outcome: 'unavailable'
			});
		}
	}, 30_000);

	it('fails closed on structurally impossible semantic source locations', () => {
		const invalidOffset = fixture();
		const snapshot = cloneSnapshot(invalidOffset);
		const source = snapshot.sources.find(
			(item) => item.logicalPath === 'packages/rph-application/src/handlers/work.ts'
		);
		if (source === undefined) throw new Error('Fixture handler implementation source is absent.');
		const invocation = snapshot.invocations.find((item) => item.sourceId === source.id);
		const invocationNode = snapshot.astNodes.find((item) => item.id === invocation?.nodeId);
		if (invocationNode === undefined) throw new Error('Fixture invocation node is absent.');
		Object.assign(invocationNode as unknown as { start: number }, { start: source.textLength + 1 });
		expectUnavailable(invalidOffset, {
			message: 'Semantic source offset is outside frozen source text.',
			snapshot
		});

		const missingParent = fixture();
		const missingParentSnapshot = cloneSnapshot(missingParent);
		const handlerSource = missingParentSnapshot.sources.find(
			(item) => item.logicalPath === 'packages/rph-application/src/handlers/work.ts'
		);
		const handlerInvocation = missingParentSnapshot.invocations.find(
			(item) => item.sourceId === handlerSource?.id
		);
		const handlerInvocationNode = missingParentSnapshot.astNodes.find(
			(item) => item.id === handlerInvocation?.nodeId
		);
		if (handlerInvocationNode === undefined) throw new Error('Fixture invocation node is absent.');
		Object.assign(handlerInvocationNode as unknown as { parentId: string }, {
			parentId: 'semantic:node-missing-parent'
		});
		expectUnavailable(missingParent, {
			message: 'AST parent semantic:node-missing-parent is absent.',
			snapshot: missingParentSnapshot
		});
	}, 30_000);

	it('decodes both compiler-supported UTF-16 byte orders before rejecting a changed manifest binding', () => {
		for (const endian of ['LE', 'BE'] as const) {
			const value = fixture();
			const snapshot = cloneSnapshot(value);
			const path = 'packages/rph-application/src/handlers/work.ts';
			const source = snapshot.sources.find((candidate) => candidate.logicalPath === path);
			const original = readFrozenSubjectArtifact(value.subject, path);
			if (source === undefined || original === undefined)
				throw new Error('Fixture handler implementation source is absent.');
			const bytes = utf16Bytes(new TextDecoder().decode(original), endian);
			const allBytes = subjectBytes(value);
			allBytes.set(path, bytes);
			let swapped = false;
			const outcome = buildCommandHandlerGraph(
				value.graphRequest,
				snapshot,
				value.observation,
				value.subject,
				{
					onProgress: (event) => {
						if (event.phase !== 'ARTIFACT_READ' || event.state !== 'STARTED') return;
						Object.assign(source as unknown as { bytes: number; contentSha256: string }, {
							bytes: bytes.byteLength,
							contentSha256: sha256(bytes)
						});
						attachFrozenSubjectBytes(value.subject, allBytes);
						swapped = true;
					}
				}
			);
			expect(swapped).toBe(true);
			expect(outcome).toMatchObject({
				diagnostics: [expect.objectContaining({ code: 'GRAPH_VALIDATION_FAILED' })],
				outcome: 'unavailable'
			});
		}
	}, 30_000);

	it('classifies a non-Error hostile semantic population without leaking it into diagnostics', () => {
		const value = fixture();
		const snapshot = {
			...value.snapshot,
			astNodes: new Proxy(value.snapshot.astNodes, {
				get() {
					throw 'hostile non-Error value';
				}
			})
		};
		expect(
			buildCommandHandlerGraph(value.graphRequest, snapshot, value.observation, value.subject)
		).toEqual({
			diagnostics: [
				{
					code: 'INPUT_INVALID',
					message: 'Command-handler graph construction failed.',
					path: null,
					phase: 'CLASSIFY'
				}
			],
			outcome: 'unavailable'
		});
	});
});
