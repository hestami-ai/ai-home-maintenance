import { Buffer } from 'node:buffer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
	COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
	type CommandEventContractArtifactSelector,
	type CommandEventContractOverlayBuildInputs,
	type CommandEventContractOverlayDiagnosticCode,
	type CommandEventContractOverlaySnapshot
} from '../contracts/command-event-contract-overlay.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import type { FrozenSubject } from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';
import { attachFrozenSubjectBytes, readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import {
	buildCommandEventContractOverlay,
	selectJpwbCommandEventContractOverlayInputs
} from './build-command-event-contract-overlay.js';
import { buildCommandHandlerGraph } from './build-command-handler-graph.js';
import {
	commandEventContractRetainedCensusArtifactSelector,
	commandEventContractVocabArtifactSelector
} from './command-event-contract-overlay-canonical.js';
import {
	createCommandEventContractOverlayFixture,
	createCommandEventContractOverlayFixtureWithRegistrySourceTransform,
	createTwoCommandEventContractOverlayFixture,
	createUnresolvedHandlerCommandEventContractOverlayFixture,
	type CommandEventContractOverlayFixture
} from './command-event-contract-overlay-fixture.test-support.js';
import { validateCommandEventContractOverlay } from './validate-command-event-contract-overlay.js';

let fixture: CommandEventContractOverlayFixture;
let baseline: CommandEventContractOverlaySnapshot;

beforeAll(() => {
	fixture = createCommandEventContractOverlayFixture();
	const outcome = buildCommandEventContractOverlay(fixture.inputs);
	if (outcome.outcome !== 'partial')
		throw new Error(`Baseline overlay build failed: ${JSON.stringify(outcome)}`);
	baseline = outcome.overlay;
}, 120_000);

afterAll(() => {
	fixture.cleanup();
});

function expectUnavailable(
	inputs: unknown,
	code: CommandEventContractOverlayDiagnosticCode,
	message?: string
): void {
	const outcome = buildCommandEventContractOverlay(
		inputs as CommandEventContractOverlayBuildInputs
	);
	expect(outcome.outcome).toBe('unavailable');
	if (outcome.outcome !== 'unavailable') return;
	expect(outcome.diagnostics[0]?.code).toBe(code);
	if (message !== undefined) expect(outcome.diagnostics[0]?.message).toContain(message);
}

function expectTransformedRegistryUnavailable(transform: (source: string) => string): void {
	const transformed =
		createCommandEventContractOverlayFixtureWithRegistrySourceTransform(transform);
	try {
		expectUnavailable(transformed.inputs, 'UNSUPPORTED_GENERATED_REGISTRY');
		expectValidatorPopulationMismatch(transformed.inputs);
	} finally {
		transformed.cleanup();
	}
}

function expectValidatorPopulationMismatch(inputs: CommandEventContractOverlayBuildInputs): void {
	const validation = validateCommandEventContractOverlay(baseline, inputs);
	expect(validation.state).toBe('INVALID');
	expect(validation.issues.map((issue) => issue.code)).toContain('POPULATION_MISMATCH');
}

function selectedArtifactBytes(path: string): Uint8Array {
	const bytes = readFrozenSubjectArtifact(fixture.subject, path);
	if (bytes === undefined) throw new Error(`Fixture artifact ${path} is absent.`);
	return bytes;
}

function textArtifact(path: string): string {
	return new TextDecoder().decode(selectedArtifactBytes(path));
}

function inputsWithArtifact(
	path:
		| typeof COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH
		| typeof COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
	contents: string | Uint8Array,
	sourceFixture: CommandEventContractOverlayFixture = fixture
): CommandEventContractOverlayBuildInputs {
	const replacement =
		typeof contents === 'string' ? new TextEncoder().encode(contents) : contents.slice();
	const subject = structuredClone(sourceFixture.subject) as FrozenSubject;
	const allBytes = new Map<string, Uint8Array>();
	for (const artifact of sourceFixture.subject.artifacts) {
		const bytes = readFrozenSubjectArtifact(sourceFixture.subject, artifact.path);
		if (bytes === undefined) throw new Error(`Fixture artifact ${artifact.path} is absent.`);
		allBytes.set(artifact.path, bytes);
	}
	allBytes.set(path, replacement);
	const artifacts = subject.artifacts.map((artifact) =>
		artifact.path === path
			? { ...artifact, bytes: replacement.byteLength, sha256: sha256(replacement) }
			: artifact
	);
	Object.assign(subject as unknown as { artifacts: FrozenSubject['artifacts'] }, { artifacts });
	attachFrozenSubjectBytes(subject, allBytes);
	const selector: CommandEventContractArtifactSelector = {
		artifactBytes: replacement.byteLength,
		artifactContentSha256: sha256(replacement),
		artifactPath: path
	};
	return {
		...sourceFixture.inputs,
		request:
			path === COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH
				? { ...sourceFixture.request, vocabArtifact: selector }
				: { ...sourceFixture.request, retainedCensusArtifact: selector },
		subject
	};
}

function inputsWithUnrecordedArtifactBytes(
	path:
		| typeof COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH
		| typeof COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
	contents: Uint8Array
): CommandEventContractOverlayBuildInputs {
	const subject = structuredClone(fixture.subject) as FrozenSubject;
	const allBytes = new Map<string, Uint8Array>();
	for (const artifact of fixture.subject.artifacts)
		allBytes.set(artifact.path, selectedArtifactBytes(artifact.path));
	allBytes.set(path, contents.slice());
	attachFrozenSubjectBytes(subject, allBytes);
	return { ...fixture.inputs, subject };
}

function setSnapshotPopulation<Key extends keyof StaticSemanticSnapshot>(
	snapshot: StaticSemanticSnapshot,
	key: Key,
	value: StaticSemanticSnapshot[Key]
): void {
	(snapshot as unknown as Record<Key, StaticSemanticSnapshot[Key]>)[key] = value;
}

function inputsWithRebuiltCommandHandlerGraph(
	semanticSnapshot: StaticSemanticSnapshot
): CommandEventContractOverlayBuildInputs {
	const graphOutcome = buildCommandHandlerGraph(
		fixture.graphRequest,
		semanticSnapshot,
		fixture.observation,
		fixture.subject
	);
	if (graphOutcome.outcome !== 'partial')
		throw new Error(`Mutated predecessor graph failed: ${JSON.stringify(graphOutcome)}`);
	return {
		...fixture.inputs,
		commandHandlerGraph: graphOutcome.graph,
		request: { ...fixture.request, commandHandlerGraphId: graphOutcome.graph.id },
		semanticSnapshot
	};
}

function expectSemanticMutationRejected(
	semanticSnapshot: StaticSemanticSnapshot,
	code: CommandEventContractOverlayDiagnosticCode
): void {
	const inputs = inputsWithRebuiltCommandHandlerGraph(semanticSnapshot);
	expectUnavailable(inputs, code);
	expectValidatorPopulationMismatch(inputs);
}

describe('buildCommandEventContractOverlay public branch coverage', { timeout: 300_000 }, () => {
	it('selects exact registry/artifact identities and rejects ambiguous selector populations', () => {
		expect(selectJpwbCommandEventContractOverlayInputs(fixture.snapshot, fixture.subject)).toEqual({
			commandRegistry: fixture.request.commandRegistry,
			eventRegistry: fixture.request.eventRegistry,
			retainedCensusArtifact: fixture.request.retainedCensusArtifact,
			vocabArtifact: fixture.request.vocabArtifact
		});

		const ambiguousProject = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		setSnapshotPopulation(ambiguousProject, 'projects', [
			...ambiguousProject.projects,
			{
				...ambiguousProject.projects.find(
					(project) => project.configPath === COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH
				)!,
				id: 'semantic:project-duplicate' as never
			}
		]);
		expect(() =>
			selectJpwbCommandEventContractOverlayInputs(ambiguousProject, fixture.subject)
		).toThrow('Generated-registry semantic project must have exactly one member; found 2.');

		const missingProgram = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const project = missingProgram.projects.find(
			(candidate) => candidate.configPath === COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH
		)!;
		Object.assign(project as unknown as { programId: string }, {
			programId: 'semantic:program-missing'
		});
		expect(() =>
			selectJpwbCommandEventContractOverlayInputs(missingProgram, fixture.subject)
		).toThrow('Generated-registry semantic Program must have exactly one member; found 0.');

		const wrongOwnership = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const selectedProject = wrongOwnership.projects.find(
			(candidate) => candidate.configPath === COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH
		)!;
		const selectedProgram = wrongOwnership.programs.find(
			(candidate) => candidate.id === selectedProject.programId
		)!;
		Object.assign(selectedProgram as unknown as { projectId: string }, {
			projectId: 'semantic:project-wrong-owner'
		});
		expect(() =>
			selectJpwbCommandEventContractOverlayInputs(wrongOwnership, fixture.subject)
		).toThrow('Generated-registry semantic project/program ownership is inconsistent.');

		const missingSource = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		setSnapshotPopulation(
			missingSource,
			'sources',
			missingSource.sources.filter(
				(source) => source.logicalPath !== COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH
			)
		);
		expect(() =>
			selectJpwbCommandEventContractOverlayInputs(missingSource, fixture.subject)
		).toThrow('Generated-registry deep semantic source must have exactly one member; found 0.');

		const missingArtifact = structuredClone(fixture.subject) as FrozenSubject;
		Object.assign(missingArtifact as unknown as { artifacts: FrozenSubject['artifacts'] }, {
			artifacts: missingArtifact.artifacts.filter(
				(artifact) => artifact.path !== COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH
			)
		});
		expect(() => commandEventContractVocabArtifactSelector(missingArtifact)).toThrow(
			'Expected exactly one packages/rph-contracts/vocab/m3-commands-events.json artifact; found 0.'
		);
		const duplicateArtifact = structuredClone(fixture.subject) as FrozenSubject;
		const censusArtifact = duplicateArtifact.artifacts.find(
			(artifact) => artifact.path === COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH
		)!;
		Object.assign(duplicateArtifact as unknown as { artifacts: FrozenSubject['artifacts'] }, {
			artifacts: [...duplicateArtifact.artifacts, censusArtifact]
		});
		expect(() => commandEventContractRetainedCensusArtifactSelector(duplicateArtifact)).toThrow(
			'Expected exactly one verif/event-surface-census.test.ts artifact; found 2.'
		);
	});

	it('rejects exact request, selector, artifact, and predecessor-request shell violations', () => {
		const wrongPrototype = Object.assign(Object.create({ inherited: true }), fixture.inputs);
		const accessorObservation = { ...fixture.observation };
		Object.defineProperty(accessorObservation, 'contentDigest', {
			enumerable: true,
			get: () => fixture.observation.contentDigest
		});
		const symbolObservation = {
			...fixture.observation,
			[Symbol('unexpected')]: true
		};
		const cases: unknown[] = [
			null,
			wrongPrototype,
			{ ...fixture.inputs, extra: true },
			{ ...fixture.inputs, subject: structuredClone(fixture.subject) },
			{ ...fixture.inputs, arrowObservation: null },
			{
				...fixture.inputs,
				arrowObservation: Object.assign(Object.create({ inherited: true }), fixture.observation)
			},
			{ ...fixture.inputs, arrowObservation: accessorObservation },
			{ ...fixture.inputs, arrowObservation: symbolObservation },
			{
				...fixture.inputs,
				semanticSnapshot: {
					...fixture.snapshot,
					astNodes: new Proxy([...fixture.snapshot.astNodes], {})
				}
			},
			{ ...fixture.inputs, request: { ...fixture.request, extra: true } },
			{
				...fixture.inputs,
				request: {
					...fixture.request,
					budgets: { ...fixture.request.budgets, maxDiagnostics: 0 }
				}
			},
			{
				...fixture.inputs,
				request: {
					...fixture.request,
					budgets: { ...fixture.request.budgets, maxCommands: -1 }
				}
			},
			{ ...fixture.inputs, request: { ...fixture.request, subjectId: '' } },
			{ ...fixture.inputs, request: { ...fixture.request, schemaVersion: 'unsupported' } },
			{ ...fixture.inputs, request: { ...fixture.request, operationVersion: 'unsupported' } },
			{
				...fixture.inputs,
				request: {
					...fixture.request,
					commandRegistry: { ...fixture.request.commandRegistry, sourceId: '' }
				}
			},
			{
				...fixture.inputs,
				request: {
					...fixture.request,
					eventRegistry: { ...fixture.request.eventRegistry, exportName: 'COMMANDS' }
				}
			},
			{
				...fixture.inputs,
				request: {
					...fixture.request,
					commandRegistry: { ...fixture.request.commandRegistry, logicalPath: 'moved/messages.ts' }
				}
			},
			{
				...fixture.inputs,
				request: {
					...fixture.request,
					eventRegistry: {
						...fixture.request.eventRegistry,
						projectConfigPath: 'moved/tsconfig.json'
					}
				}
			},
			{
				...fixture.inputs,
				request: {
					...fixture.request,
					commandRegistry: { ...fixture.request.commandRegistry, contentSha256: 'NOT-A-DIGEST' }
				}
			},
			{
				...fixture.inputs,
				request: {
					...fixture.request,
					vocabArtifact: { ...fixture.request.vocabArtifact, artifactBytes: -1 }
				}
			},
			{
				...fixture.inputs,
				request: {
					...fixture.request,
					retainedCensusArtifact: {
						...fixture.request.retainedCensusArtifact,
						artifactContentSha256: 'NOT-A-DIGEST'
					}
				}
			},
			{
				...fixture.inputs,
				request: {
					...fixture.request,
					vocabArtifact: {
						...fixture.request.vocabArtifact,
						artifactPath: COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH
					}
				}
			},
			{
				...fixture.inputs,
				commandHandlerRequest: { ...fixture.graphRequest, extra: true }
			}
		];
		for (const input of cases) expectUnavailable(input, 'REQUEST_INVALID');
	});

	it('classifies semantic, arrow, command-handler, source-selector, and source-budget failures', () => {
		const unsupportedSnapshot = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const symbolCapability = unsupportedSnapshot.capabilities.find(
			(capability) => capability.capability === 'TS_SYMBOL'
		)!;
		Object.assign(symbolCapability as unknown as { state: string }, { state: 'UNSUPPORTED' });
		expectUnavailable(
			{ ...fixture.inputs, semanticSnapshot: unsupportedSnapshot },
			'SEMANTIC_CAPABILITY_UNAVAILABLE'
		);

		expectUnavailable(
			{
				...fixture.inputs,
				arrowObservation: { ...fixture.observation, contentDigest: '0'.repeat(64) }
			},
			'ARROW_OBSERVATION_INVALID'
		);
		expectUnavailable(
			{
				...fixture.inputs,
				commandHandlerGraph: { ...fixture.commandHandlerGraph, graphInputDigest: '0'.repeat(64) }
			},
			'COMMAND_HANDLER_GRAPH_INVALID'
		);
		expectUnavailable(
			{
				...fixture.inputs,
				commandHandlerGraph: { ...fixture.commandHandlerGraph, contentDigest: '0'.repeat(64) }
			},
			'COMMAND_HANDLER_GRAPH_INVALID'
		);

		expectUnavailable(
			{
				...fixture.inputs,
				request: {
					...fixture.request,
					eventRegistry: {
						...fixture.request.eventRegistry,
						declarationId: 'semantic:declaration-stale' as never
					}
				}
			},
			'UNSUPPORTED_GENERATED_REGISTRY'
		);
		expectUnavailable(
			{
				...fixture.inputs,
				request: {
					...fixture.request,
					eventRegistry: {
						...fixture.request.eventRegistry,
						sourceId: 'semantic:source-stale' as never
					}
				}
			},
			'INPUT_POPULATION_MISMATCH',
			'Generated-registry selector, semantic source, and frozen bytes differ'
		);
		expectUnavailable(
			inputsWithUnrecordedArtifactBytes(
				COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
				new TextEncoder().encode('{}')
			),
			'INPUT_POPULATION_MISMATCH',
			'bytes do not reproduce their exact artifact identity'
		);

		const sourceBytes = [
			COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
			COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
			COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH
		].reduce((sum, path) => sum + selectedArtifactBytes(path).byteLength, 0);
		expectUnavailable(
			{
				...fixture.inputs,
				request: {
					...fixture.request,
					budgets: { ...fixture.request.budgets, maxSourceBytes: sourceBytes - 1 }
				}
			},
			'BUDGET_EXCEEDED'
		);
	});

	it('independently rejects project/program ownership changed after predecessor validation', () => {
		const semanticSnapshot = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const project = semanticSnapshot.projects.find(
			(candidate) => candidate.configPath === COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH
		)!;
		const program = semanticSnapshot.programs.find(
			(candidate) => candidate.id === project.programId
		)!;
		const byteLength = Buffer.byteLength;
		let mutated = false;
		const measurement = vi.spyOn(Buffer, 'byteLength').mockImplementation((value, encoding) => {
			if (!mutated && typeof value === 'string' && value.includes('registryFacts')) {
				Object.assign(program as unknown as { projectId: string }, {
					projectId: 'semantic:project-post-validation-mismatch'
				});
				mutated = true;
			}
			return byteLength(value, encoding);
		});
		try {
			const outcome = buildCommandEventContractOverlay({
				...fixture.inputs,
				semanticSnapshot
			});
			expect(mutated).toBe(true);
			expect(outcome).toMatchObject({
				diagnostics: [
					{
						code: 'INPUT_POPULATION_MISMATCH',
						message: 'Generated-registry semantic project/program ownership is inconsistent.'
					}
				],
				outcome: 'unavailable'
			});
		} finally {
			measurement.mockRestore();
		}
	});

	it('rejects compiler-backed generated-registry grammar variants ignored by the predecessor graph', () => {
		const eventsBlock = /export const EVENTS = \{[\s\S]*?\} as const;/u;
		const shifted = createCommandEventContractOverlayFixtureWithRegistrySourceTransform(
			(source) => `void 0;\n${source}`
		);
		try {
			const shiftedOutcome = buildCommandEventContractOverlay(shifted.inputs);
			expect(shiftedOutcome.outcome).toBe('partial');
			expectValidatorPopulationMismatch(shifted.inputs);
		} finally {
			shifted.cleanup();
		}
		for (const transform of [
			(source: string) => source.replace('export const EVENTS =', 'export let EVENTS ='),
			(source: string) => source.replace(eventsBlock, 'export declare const EVENTS: unknown;'),
			(source: string) => source.replace(eventsBlock, 'export const EVENTS = 1 as const;'),
			(source: string) =>
				source.replace('export const EVENTS = {', 'export const EVENTS = {\n\t...{},'),
			(source: string) => source.replace('\tRuntimeOnly:', "\t['RuntimeOnly']:"),
			(source: string) =>
				source.replace(
					'\tRuntimeOnly: { payload: RuntimeOnlyPayloadSchema, aggregateType:',
					"\t['Runtime' + 'Only']: { payload: RuntimeOnlyPayloadSchema, aggregateType:"
				),
			(source: string) =>
				source.replace(
					"\tRuntimeOnly: { payload: RuntimeOnlyPayloadSchema, aggregateType: 'Work' },",
					'\tRuntimeOnly: [],'
				),
			(source: string) =>
				source.replace(
					"\tRuntimeOnly: { payload: RuntimeOnlyPayloadSchema, aggregateType: 'Work' },",
					"\tRuntimeOnly: { aggregateType: 'Work' },"
				),
			(source: string) =>
				source.replace('payload: RuntimeOnlyPayloadSchema', 'payload: RuntimeOnlyPayloadSchema()'),
			(source: string) =>
				source.replace(
					"\tRuntimeOnly: { payload: RuntimeOnlyPayloadSchema, aggregateType: 'Work' },",
					"\tRuntimeOnly: { payload: RuntimeOnlyPayloadSchema, aggregateType: 'Work' },\n\tRuntimeOnly: { payload: RuntimeOnlyPayloadSchema, aggregateType: 'Work' },"
				),
			(source: string) => source.replace("aggregateType: 'Work'", 'aggregateType: Work'),
			(source: string) => source.replace("aggregateType: 'Work'", "aggregateType: ''"),
			(source: string) => source.replace("\t\temitsEvent: 'WorkStarted',\n", ''),
			(source: string) => source.replace("alsoEmitsEvents: ['WorkAudited']", 'alsoEmitsEvents: 1'),
			(source: string) =>
				source.replace("alsoEmitsEvents: ['WorkAudited']", 'alsoEmitsEvents: [,]'),
			(source: string) =>
				source.replace(
					"alsoEmitsEvents: ['WorkAudited']",
					"alsoEmitsEvents: ['WorkAudited', 'WorkAudited']"
				),
			(source: string) =>
				source.replace("alsoEmitsEvents: ['WorkAudited']", "alsoEmitsEvents: ['WorkStarted']"),
			(source: string) => source.replace(/StartWork: \{[\s\S]*?\n\t\}/u, 'StartWork: 1')
		] as const)
			expectTransformedRegistryUnavailable(transform);
	}, 300_000);

	it('rejects event-only semantic identity corruptions after validating the predecessor graph', () => {
		const eventDeclaration = fixture.snapshot.declarations.find(
			(declaration) =>
				declaration.sourceId === fixture.request.eventRegistry.sourceId &&
				declaration.name === 'RuntimeOnlyPayloadSchema'
		);
		if (
			eventDeclaration === undefined ||
			eventDeclaration.symbolId === null ||
			eventDeclaration.nodeId === null
		)
			throw new Error('Fixture event payload declaration is unavailable.');
		const eventDeclarationId = eventDeclaration.id;
		const eventSymbolId = eventDeclaration.symbolId;
		const eventReference = fixture.snapshot.references.find(
			(reference) =>
				reference.sourceId === fixture.request.eventRegistry.sourceId &&
				reference.resolvedSymbolId === eventSymbolId &&
				reference.role === 'SYMBOL_USE'
		);
		if (eventReference === undefined)
			throw new Error('Fixture event payload reference is unavailable.');

		const duplicateReference = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const selectedReference = duplicateReference.references.find(
			(reference) => reference.id === eventReference.id
		)!;
		setSnapshotPopulation(duplicateReference, 'references', [
			...duplicateReference.references,
			{ ...selectedReference, id: 'semantic:reference-duplicate-node' as never }
		]);
		expectSemanticMutationRejected(duplicateReference, 'UNSUPPORTED_GENERATED_REGISTRY');

		const missingSymbol = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		setSnapshotPopulation(
			missingSymbol,
			'symbols',
			missingSymbol.symbols.filter((symbol) => symbol.id !== eventSymbolId)
		);
		expectSemanticMutationRejected(missingSymbol, 'INPUT_POPULATION_MISMATCH');

		const danglingDeclaration = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const dangling = danglingDeclaration.declarations.find(
			(declaration) => declaration.id === eventDeclarationId
		)!;
		Object.assign(dangling as unknown as { nodeId: string }, {
			nodeId: 'semantic:node-missing' as never
		});
		expectSemanticMutationRejected(danglingDeclaration, 'INPUT_POPULATION_MISMATCH');

		const wrongTextLength = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const selectedSource = wrongTextLength.sources.find(
			(source) => source.id === fixture.request.eventRegistry.sourceId
		)!;
		Object.assign(selectedSource as unknown as { textLength: number }, {
			textLength: selectedSource.textLength + 1
		});
		expectSemanticMutationRejected(wrongTextLength, 'UNSUPPORTED_GENERATED_REGISTRY');
	});

	it('preserves an unresolved predecessor handler without inventing a target', () => {
		const unresolved = createUnresolvedHandlerCommandEventContractOverlayFixture();
		try {
			const outcome = buildCommandEventContractOverlay(unresolved.inputs);
			expect(outcome.outcome).toBe('partial');
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			expect(outcome.overlay.commands[0]?.handlerReferences).toEqual([
				expect.objectContaining({ targetNodeId: null, upstreamAttribution: 'UNRESOLVED' })
			]);
			expectValidatorPopulationMismatch(unresolved.inputs);
		} finally {
			unresolved.cleanup();
		}
	}, 30_000);

	it('preserves a compiler-backed command with no handler registration as an empty reference set', () => {
		const unregistered = createCommandEventContractOverlayFixtureWithRegistrySourceTransform(
			(source) =>
				source.replace(
					'export const COMMANDS = {',
					`export const COMMANDS = {
	UnregisteredWork: {
		payload: StartWorkPayloadSchema,
		targetAggregateType: 'WORK',
		emitsEvent: 'WorkStarted',
		firstSlice: false
	},`
				)
		);
		try {
			const vocabBytes = readFrozenSubjectArtifact(
				unregistered.subject,
				COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH
			);
			if (vocabBytes === undefined) throw new Error('Fixture vocab artifact is absent.');
			const vocab = JSON.parse(new TextDecoder().decode(vocabBytes)) as {
				commands: Record<string, unknown>[];
			};
			vocab.commands.push({
				commandType: 'UnregisteredWork',
				emitsEvent: 'WorkStarted',
				payloadFields: [],
				targetAggregateType: 'WORK'
			});
			const outcome = buildCommandEventContractOverlay(
				inputsWithArtifact(
					COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
					JSON.stringify(vocab),
					unregistered
				)
			);
			expect(outcome.outcome).toBe('partial');
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			expect(
				outcome.overlay.commands.find((command) => command.commandName === 'UnregisteredWork')
			).toMatchObject({ handlerReferences: [] });
		} finally {
			unregistered.cleanup();
		}
	}, 60_000);

	it('orders two compiler-backed command contracts deterministically', () => {
		const twoCommands = createTwoCommandEventContractOverlayFixture();
		try {
			const outcome = buildCommandEventContractOverlay(twoCommands.inputs);
			expect(outcome.outcome).toBe('partial');
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			expect(outcome.overlay.commands.map((command) => command.commandName)).toEqual([
				'ResumeWork',
				'StartWork'
			]);
			expectValidatorPopulationMismatch(twoCommands.inputs);
		} finally {
			twoCommands.cleanup();
		}
	}, 30_000);

	it('rejects malformed vocab bytes and exposes no-binding reconciliation frontiers', () => {
		const vocab = JSON.parse(textArtifact(COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH)) as {
			bindings: unknown[];
			commands: unknown[];
			events: unknown[];
		};
		const firstCommand = vocab.commands[0] as Record<string, unknown>;
		const firstEvent = vocab.events[0] as Record<string, unknown>;
		const firstBinding = vocab.bindings[0]!;
		for (const malformed of [
			new Uint8Array([0xff]),
			'{',
			'{}',
			'[]',
			'{"commands":[],"events":[],"bindings":[],"bindings":[]}',
			JSON.stringify({ ...vocab, commands: [null] }),
			JSON.stringify({
				...vocab,
				commands: [{ ...firstCommand, alsoEmitsEvents: 'WorkAudited' }]
			}),
			JSON.stringify({
				...vocab,
				commands: [{ ...firstCommand, alsoEmitsEvents: [''] }]
			}),
			JSON.stringify({
				...vocab,
				commands: [{ ...firstCommand, alsoEmitsEvents: ['WorkAudited', 'WorkAudited'] }]
			}),
			JSON.stringify({
				...vocab,
				commands: [{ ...firstCommand, alsoEmitsEvents: ['WorkStarted'] }]
			}),
			JSON.stringify({ ...vocab, commands: [{ ...firstCommand, commandType: ' ' }] }),
			JSON.stringify({ ...vocab, commands: [{ ...firstCommand, drivesFrom: 1 }] }),
			JSON.stringify({ ...vocab, commands: [...vocab.commands, firstCommand] }),
			JSON.stringify({ ...vocab, events: [null] }),
			JSON.stringify({ ...vocab, events: [...vocab.events, vocab.events[0]] }),
			JSON.stringify({
				...vocab,
				commands: [{ ...firstCommand, emitsEvent: 'MissingEvent' }]
			}),
			JSON.stringify({ ...vocab, bindings: [null] }),
			JSON.stringify({ ...vocab, bindings: [...vocab.bindings, firstBinding] }),
			JSON.stringify({
				...vocab,
				bindings: [{ commandType: 'MissingCommand', eventType: 'WorkStarted' }]
			}),
			JSON.stringify({
				...vocab,
				bindings: [{ commandType: 'StartWork', eventType: 'MissingEvent' }]
			}),
			JSON.stringify({
				...vocab,
				bindings: [{ commandType: 'StartWork', eventType: 'RuntimeOnly' }]
			})
		])
			expectUnavailable(
				inputsWithArtifact(COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH, malformed),
				'UNSUPPORTED_VOCAB'
			);

		for (const mismatch of [
			{ ...vocab, bindings: [], commands: [] },
			{
				...vocab,
				commands: [
					{
						...firstCommand,
						alsoEmitsEvents: ['WorkStarted'],
						emitsEvent: 'WorkAudited'
					}
				]
			},
			{ ...vocab, events: [...vocab.events, { ...firstEvent, eventType: 'ExtraEvent' }] }
		])
			expectUnavailable(
				inputsWithArtifact(COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH, JSON.stringify(mismatch)),
				'INPUT_POPULATION_MISMATCH'
			);

		const noBindings = buildCommandEventContractOverlay(
			inputsWithArtifact(
				COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
				JSON.stringify({ ...vocab, bindings: [] })
			)
		);
		expect(noBindings.outcome).toBe('partial');
		if (noBindings.outcome !== 'partial') throw new Error(JSON.stringify(noBindings));
		expect(noBindings.overlay.frontiers.map((frontier) => frontier.frontierKind)).toEqual(
			expect.arrayContaining([
				'COMMAND_WITHOUT_TRANSITION_BINDING',
				'GENERATED_RETAINED_BOUND_SET_MISMATCH',
				'PINNED_EMITTED_NOT_RETAINED_BOUND'
			])
		);
		expect(noBindings.overlay.coverage.reconciles).toBe(false);
	});

	it('accepts a UTF-8 BOM on a retained JSON artifact without changing its population', () => {
		const vocabBytes = selectedArtifactBytes(COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH);
		const withBom = new Uint8Array(vocabBytes.byteLength + 3);
		withBom.set([0xef, 0xbb, 0xbf]);
		withBom.set(vocabBytes, 3);
		const outcome = buildCommandEventContractOverlay(
			inputsWithArtifact(COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH, withBom)
		);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome.overlay.coverage).toEqual(baseline.coverage);
		expect(outcome.overlay.commands.map((command) => command.commandName)).toEqual(
			baseline.commands.map((command) => command.commandName)
		);
	});

	it('deep-freezes shared semantically equal constructed containers exactly once', () => {
		const stringifyJson = JSON.stringify;
		let aliased = false;
		const serializer = vi.spyOn(JSON, 'stringify').mockImplementation((value: unknown) => {
			if (
				!aliased &&
				value !== null &&
				typeof value === 'object' &&
				'layers' in value &&
				'contentDigest' in value
			) {
				const overlay = value as CommandEventContractOverlaySnapshot;
				const inference = overlay.layers[1]!;
				Object.assign(inference as unknown as { eventIds: typeof inference.eventIds }, {
					eventIds: inference.commandIds
				});
				aliased = true;
			}
			return stringifyJson(value);
		});
		try {
			const outcome = buildCommandEventContractOverlay(fixture.inputs);
			expect(aliased).toBe(true);
			expect(outcome.outcome).toBe('partial');
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			expect(outcome.overlay.layers[1]?.eventIds).toBe(outcome.overlay.layers[1]?.commandIds);
			expect(Object.isFrozen(outcome.overlay.layers[1]?.eventIds)).toBe(true);
		} finally {
			serializer.mockRestore();
		}
	});

	it('fails closed when the serialized constructed overlay does not validate', () => {
		const stringifyJson = JSON.stringify;
		let corrupted = false;
		const serializer = vi.spyOn(JSON, 'stringify').mockImplementation((value: unknown) => {
			if (
				!corrupted &&
				value !== null &&
				typeof value === 'object' &&
				'coverage' in value &&
				'contentDigest' in value
			) {
				corrupted = true;
				((value as CommandEventContractOverlaySnapshot).coverage as { commands: number }).commands =
					0;
			}
			return stringifyJson(value);
		});
		try {
			const outcome = buildCommandEventContractOverlay(fixture.inputs);
			expect(corrupted).toBe(true);
			expect(outcome).toMatchObject({
				diagnostics: [
					{
						code: 'OVERLAY_VALIDATION_FAILED',
						phase: 'VALIDATE'
					}
				],
				outcome: 'unavailable'
			});
		} finally {
			serializer.mockRestore();
		}
	});

	it('rejects malformed retained census grammar and exposes bound-not-pinned frontiers', () => {
		const census = textArtifact(COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH);
		const emitted =
			"const EMITTED_2026_08_04 = new Set(['RuntimeOnly', 'WorkAudited', 'WorkStarted']);";
		const commandConditional = 'command.emitsEvent ? [command.emitsEvent] : []';
		for (const malformed of [
			new Uint8Array([0xff]),
			'const BOUND = ;',
			census.replace('const BOUND =', 'let BOUND ='),
			census.replace('vocab.bindings ?? []', 'vocab.commands ?? []'),
			census.replace('.flatMap((command)', '.map((command)'),
			census.replace(
				'(command) =>\n\t\tcommand.emitsEvent ? [command.emitsEvent] : []',
				'(command) => {\n\t\treturn command.emitsEvent ? [command.emitsEvent] : [];\n\t}'
			),
			census.replace(commandConditional, '[command.emitsEvent]'),
			census.replace('new Set<string>([', 'new Set<number>(['),
			census.replace('const EMITTED_2026_08_04', 'let EMITTED_2026_08_04'),
			census.replace("new Set(['RuntimeOnly'", "new Set<string>(['RuntimeOnly'"),
			census.replace("'WorkAudited', 'WorkStarted'", "'WorkAudited', 'WorkAudited', 'WorkStarted'"),
			census.replace(emitted, "const EMITTED_2026_08_04 = new Set([...['RuntimeOnly']]);"),
			census.replace(emitted, "const EMITTED_2026_08_04 = new Map([['RuntimeOnly', true]]);"),
			census.replace(emitted, 'const EMITTED_2026_08_04 = new Set();'),
			census.replace(emitted, "const EMITTED_2026_08_04 = new Set('RuntimeOnly');"),
			census.replace("'RuntimeOnly', 'WorkAudited'", "1, 'WorkAudited'"),
			census.replace("'RuntimeOnly', 'WorkAudited'", "'', 'WorkAudited'")
		])
			expectUnavailable(
				inputsWithArtifact(COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH, malformed),
				'UNSUPPORTED_RETAINED_CENSUS'
			);

		const onePinned = buildCommandEventContractOverlay(
			inputsWithArtifact(
				COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
				census.replace(emitted, "const EMITTED_2026_08_04 = new Set(['WorkAudited']);")
			)
		);
		expect(onePinned.outcome).toBe('partial');
		if (onePinned.outcome !== 'partial') throw new Error(JSON.stringify(onePinned));
		expect(onePinned.overlay.frontiers.map((frontier) => frontier.frontierKind)).toContain(
			'RETAINED_BOUND_NOT_PINNED_EMITTED'
		);
		expect(onePinned.overlay.coverage.retainedBoundNotPinnedEmitted).toBe(1);
	});
});
