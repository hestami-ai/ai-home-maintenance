import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
	type CommandEventContractArtifactSelector,
	type CommandEventContractOverlayBuildInputs,
	type CommandEventContractOverlaySnapshot,
	type CommandEventContractOverlayValidationOptions
} from '../contracts/command-event-contract-overlay.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import type { FrozenSubject } from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';
import { attachFrozenSubjectBytes, readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import { buildCommandEventContractOverlay } from './build-command-event-contract-overlay.js';
import { buildCommandHandlerGraph } from './build-command-handler-graph.js';
import {
	createCommandEventContractOverlayFixture,
	type CommandEventContractOverlayFixture
} from './command-event-contract-overlay-fixture.test-support.js';
import { validateCommandEventContractOverlay } from './validate-command-event-contract-overlay.js';

let fixture: CommandEventContractOverlayFixture;
let baseline: CommandEventContractOverlaySnapshot;

beforeAll(() => {
	fixture = createCommandEventContractOverlayFixture();
	const outcome = buildCommandEventContractOverlay(fixture.inputs);
	if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
	baseline = outcome.overlay;
}, 120_000);

afterAll(() => fixture.cleanup());

function validate(
	candidate: unknown = baseline,
	inputs: CommandEventContractOverlayBuildInputs = fixture.inputs,
	options?: CommandEventContractOverlayValidationOptions
) {
	return validateCommandEventContractOverlay(candidate, inputs, options);
}

function expectIssue(
	result: ReturnType<typeof validateCommandEventContractOverlay>,
	state: 'BUDGET_EXHAUSTED' | 'INVALID',
	code:
		| 'BUDGET_EXHAUSTED'
		| 'CONTENT_DIGEST_MISMATCH'
		| 'INPUT_INVALID'
		| 'POPULATION_MISMATCH'
		| 'SHAPE_INVALID',
	path?: string
): void {
	expect(result).toMatchObject({
		issues: [expect.objectContaining({ code, ...(path === undefined ? {} : { path }) })],
		state
	});
}

function artifactBytes(path: string): Uint8Array {
	const bytes = readFrozenSubjectArtifact(fixture.subject, path);
	if (bytes === undefined) throw new Error(`Fixture artifact ${path} is absent.`);
	return bytes;
}

function artifactText(path: string): string {
	return new TextDecoder().decode(artifactBytes(path));
}

function inputsWithArtifact(
	path:
		| typeof COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH
		| typeof COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
	contents: string | Uint8Array
): CommandEventContractOverlayBuildInputs {
	const replacement =
		typeof contents === 'string' ? new TextEncoder().encode(contents) : contents.slice();
	const subject = structuredClone(fixture.subject) as FrozenSubject;
	const bytesByPath = new Map<string, Uint8Array>();
	for (const artifact of fixture.subject.artifacts)
		bytesByPath.set(artifact.path, artifactBytes(artifact.path));
	bytesByPath.set(path, replacement);
	const artifacts = subject.artifacts.map((artifact) =>
		artifact.path === path
			? { ...artifact, bytes: replacement.byteLength, sha256: sha256(replacement) }
			: artifact
	);
	Object.assign(subject as unknown as { artifacts: FrozenSubject['artifacts'] }, { artifacts });
	attachFrozenSubjectBytes(subject, bytesByPath);
	const selector: CommandEventContractArtifactSelector = {
		artifactBytes: replacement.byteLength,
		artifactContentSha256: sha256(replacement),
		artifactPath: path
	};
	return {
		...fixture.inputs,
		request:
			path === COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH
				? { ...fixture.request, vocabArtifact: selector }
				: { ...fixture.request, retainedCensusArtifact: selector },
		subject
	};
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

describe('command-event overlay public-validator coverage', { timeout: 120_000 }, () => {
	it('rejects malformed option records without reading hostile accessors', () => {
		let getterHits = 0;
		const accessor = {};
		Object.defineProperty(accessor, 'maxDepth', {
			enumerable: true,
			get: () => {
				getterHits += 1;
				return 1;
			}
		});
		for (const options of [
			null,
			[],
			new Proxy({}, {}),
			{ extra: 1 },
			{ maxDepth: 0 },
			{ maxDepth: Number.MAX_SAFE_INTEGER + 1 },
			accessor
		] as never[])
			expectIssue(
				validate(baseline, fixture.inputs, options),
				'INVALID',
				'SHAPE_INVALID',
				'$options'
			);
		expect(getterHits).toBe(0);
	});

	it('bounds candidate depth, records, strings, arrays, and hostile JSON containers', () => {
		for (const [candidate, options] of [
			[baseline, { maxDepth: 1 }],
			[baseline, { maxRecords: 1 }],
			['xx', { maxStringCharacters: 1 }],
			[[null, null], { maxRecords: 1 }]
		] as const)
			expectIssue(
				validate(candidate, fixture.inputs, options),
				'BUDGET_EXHAUSTED',
				'BUDGET_EXHAUSTED'
			);

		const cycle: Record<string, unknown> = {};
		cycle.self = cycle;
		const sparse = new Array(2);
		sparse[1] = null;
		const extraArray = [null] as unknown[] & { extra?: null };
		extraArray.extra = null;
		const symbolRecord = { value: null } as Record<PropertyKey, unknown>;
		symbolRecord[Symbol('hostile')] = null;
		const nonEnumerable = {};
		Object.defineProperty(nonEnumerable, 'hidden', { enumerable: false, value: null });
		const getter = {};
		let getterHits = 0;
		Object.defineProperty(getter, 'value', {
			enumerable: true,
			get: () => {
				getterHits += 1;
				return null;
			}
		});
		for (const candidate of [
			null,
			Symbol('value'),
			BigInt(1),
			Number.NaN,
			-0,
			() => undefined,
			new Proxy({}, {}),
			cycle,
			Object.create({ inherited: true }),
			sparse,
			extraArray,
			symbolRecord,
			nonEnumerable,
			getter
		])
			expectIssue(validate(candidate), 'INVALID', 'SHAPE_INVALID');
		expect(getterHits).toBe(0);
	});

	it('rejects hostile input shells and cloned subjects before canonicalization', () => {
		const symbolInput = { ...fixture.inputs } as Record<PropertyKey, unknown>;
		symbolInput[Symbol('hostile')] = null;
		const accessorInput = { ...fixture.inputs } as Record<string, unknown>;
		Object.defineProperty(accessorInput, 'request', {
			enumerable: true,
			get: () => fixture.request
		});
		for (const inputs of [
			null,
			[],
			new Proxy(fixture.inputs, {}),
			{ ...fixture.inputs, extra: null },
			symbolInput,
			accessorInput
		])
			expectIssue(
				validate(baseline, inputs as CommandEventContractOverlayBuildInputs),
				'INVALID',
				'SHAPE_INVALID'
			);

		const cloned = structuredClone(fixture.inputs) as CommandEventContractOverlayBuildInputs;
		expectIssue(validate(baseline, cloned), 'INVALID', 'INPUT_INVALID', '$inputs.subject');
	});

	it('rejects hostile semantic record and population shells descriptor-first', () => {
		const symbolSnapshot = structuredClone(fixture.snapshot) as unknown as Record<
			PropertyKey,
			unknown
		>;
		symbolSnapshot[Symbol('hostile')] = null;
		const accessorSnapshot = structuredClone(fixture.snapshot) as unknown as Record<
			string,
			unknown
		>;
		Object.defineProperty(accessorSnapshot, 'sources', {
			enumerable: true,
			get: () => fixture.snapshot.sources
		});
		for (const semanticSnapshot of [null, [], symbolSnapshot, accessorSnapshot])
			expectIssue(
				validate(baseline, {
					...fixture.inputs,
					semanticSnapshot: semanticSnapshot as never
				}),
				'INVALID',
				'SHAPE_INVALID'
			);

		const sparse = new Array(fixture.snapshot.sources.length + 1);
		for (const [index, source] of fixture.snapshot.sources.entries()) sparse[index] = source;
		const extra = [...fixture.snapshot.sources] as unknown[] & { extra?: null };
		extra.extra = null;
		const symbolPopulation = [...fixture.snapshot.sources] as unknown as Record<
			PropertyKey,
			unknown
		>;
		delete symbolPopulation[String(fixture.snapshot.sources.length - 1)];
		symbolPopulation[Symbol('hostile')] = fixture.snapshot.sources.at(-1);
		const accessorPopulation = [...fixture.snapshot.sources];
		Object.defineProperty(accessorPopulation, '0', {
			enumerable: true,
			get: () => fixture.snapshot.sources[0]
		});
		for (const sources of [null, {}, sparse, extra, symbolPopulation, accessorPopulation])
			expectIssue(
				validate(baseline, {
					...fixture.inputs,
					semanticSnapshot: { ...fixture.snapshot, sources } as never
				}),
				'INVALID',
				'SHAPE_INVALID',
				'$inputs.semanticSnapshot.sources'
			);
	});

	it('bounds independently inspected predecessor input populations', () => {
		for (const options of [
			{ maxInputRecords: 1 },
			{ maxInputStringCharacters: 1 }
		] as CommandEventContractOverlayValidationOptions[])
			expectIssue(
				validate(baseline, fixture.inputs, options),
				'BUDGET_EXHAUSTED',
				'BUDGET_EXHAUSTED'
			);

		const shallowRoots = {
			...fixture.inputs,
			arrowObservation: {},
			commandHandlerGraph: {},
			commandHandlerRequest: {},
			request: {}
		} as CommandEventContractOverlayBuildInputs;
		expectIssue(
			validate(baseline, shallowRoots, { maxInputRecords: 1 }),
			'BUDGET_EXHAUSTED',
			'BUDGET_EXHAUSTED',
			'$inputs.commandHandlerRequest'
		);
		expectIssue(
			validate(baseline, shallowRoots, { maxInputRecords: 4 }),
			'BUDGET_EXHAUSTED',
			'BUDGET_EXHAUSTED',
			'$inputs.semanticSnapshot.projects'
		);
	});

	it('rejects malformed requests, stale identities, and missing semantic capabilities', () => {
		for (const request of [
			{ ...fixture.request, extra: null },
			{
				...fixture.request,
				budgets: { ...fixture.request.budgets, maxDiagnostics: 0 }
			},
			{
				...fixture.request,
				commandRegistry: { ...fixture.request.commandRegistry, exportName: 'EVENTS' }
			}
		] as never[])
			expectIssue(
				validate(baseline, { ...fixture.inputs, request }),
				'INVALID',
				'INPUT_INVALID',
				'$inputs.request'
			);

		for (const request of [
			{ ...fixture.request, subjectId: `stale-${fixture.request.subjectId}` },
			{
				...fixture.request,
				semanticSnapshotId:
					`${fixture.request.semanticSnapshotId}-stale` as typeof fixture.request.semanticSnapshotId
			},
			{
				...fixture.request,
				arrowObservationId:
					`${fixture.request.arrowObservationId}-stale` as typeof fixture.request.arrowObservationId
			},
			{
				...fixture.request,
				commandHandlerGraphId:
					`${fixture.request.commandHandlerGraphId}-stale` as typeof fixture.request.commandHandlerGraphId
			}
		])
			expectIssue(
				validate(baseline, { ...fixture.inputs, request }),
				'INVALID',
				'INPUT_INVALID',
				'$inputs'
			);

		for (const capabilities of [
			fixture.snapshot.capabilities.filter((item) => item.capability !== 'TS_SYMBOL'),
			fixture.snapshot.capabilities.map((item) =>
				item.capability === 'TS_SYMBOL' ? { ...item, state: 'UNSUPPORTED' as const } : item
			)
		])
			expectIssue(
				validate(baseline, {
					...fixture.inputs,
					semanticSnapshot: { ...fixture.snapshot, capabilities }
				}),
				'INVALID',
				'INPUT_INVALID',
				'$inputs.semanticSnapshot.capabilities'
			);
	});

	it('rejects invalid independent predecessors and maxAstNodes before derivation', () => {
		expectIssue(
			validate(baseline, {
				...fixture.inputs,
				request: {
					...fixture.request,
					budgets: {
						...fixture.request.budgets,
						maxAstNodes: fixture.snapshot.astNodes.length - 1
					}
				}
			}),
			'BUDGET_EXHAUSTED',
			'BUDGET_EXHAUSTED',
			'$inputs.request.budgets.maxAstNodes'
		);

		for (const inputs of [
			{
				...fixture.inputs,
				arrowObservation: { ...fixture.observation, contentDigest: '0'.repeat(64) }
			},
			{
				...fixture.inputs,
				commandHandlerGraph: {
					...fixture.commandHandlerGraph,
					graphInputDigest: '0'.repeat(64)
				}
			},
			{
				...fixture.inputs,
				commandHandlerGraph: {
					...fixture.commandHandlerGraph,
					contentDigest: '0'.repeat(64)
				}
			}
		] as CommandEventContractOverlayBuildInputs[])
			expectIssue(validate(baseline, inputs), 'INVALID', 'INPUT_INVALID', '$inputs');
	});

	it('enforces every independently derived output and exact source-byte operation guard', () => {
		for (const [key, actual] of [
			['maxBoundContributions', baseline.boundContributions.length],
			['maxCommands', baseline.commands.length],
			['maxDeclaredLinks', baseline.declaredLinks.length],
			['maxEventContracts', baseline.eventContracts.length],
			['maxFrontiers', baseline.frontiers.length],
			['maxPinnedEmissions', baseline.pinnedEmissions.length]
		] as const) {
			expect(actual).toBeGreaterThan(0);
			expectIssue(
				validate(baseline, {
					...fixture.inputs,
					request: {
						...fixture.request,
						budgets: { ...fixture.request.budgets, [key]: actual - 1 }
					}
				}),
				'BUDGET_EXHAUSTED',
				'BUDGET_EXHAUSTED',
				`$inputs.request.budgets.${key}`
			);
		}

		const sourceBytes = [
			COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
			COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
			COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH
		].reduce(
			(sum, path) =>
				sum + fixture.subject.artifacts.find((artifact) => artifact.path === path)!.bytes,
			0
		);
		expectIssue(
			validate(baseline, {
				...fixture.inputs,
				request: {
					...fixture.request,
					budgets: { ...fixture.request.budgets, maxSourceBytes: sourceBytes - 1 }
				}
			}),
			'BUDGET_EXHAUSTED',
			'BUDGET_EXHAUSTED',
			'$inputs.request.budgets.maxSourceBytes'
		);
	});

	it('fails closed when shaped selectors cannot reproduce independent derivation', () => {
		for (const request of [
			{
				...fixture.request,
				commandRegistry: {
					...fixture.request.commandRegistry,
					declarationId:
						`${fixture.request.commandRegistry.declarationId}-stale` as typeof fixture.request.commandRegistry.declarationId
				}
			},
			{
				...fixture.request,
				eventRegistry: {
					...fixture.request.eventRegistry,
					sourceId:
						`${fixture.request.eventRegistry.sourceId}-stale` as typeof fixture.request.eventRegistry.sourceId
				}
			},
			{
				...fixture.request,
				vocabArtifact: {
					...fixture.request.vocabArtifact,
					artifactContentSha256: '0'.repeat(64)
				}
			},
			{
				...fixture.request,
				retainedCensusArtifact: {
					...fixture.request.retainedCensusArtifact,
					artifactContentSha256: '0'.repeat(64)
				}
			}
		])
			expectIssue(
				validate(baseline, { ...fixture.inputs, request }),
				'INVALID',
				'POPULATION_MISMATCH',
				'$'
			);
	});

	it('fails closed when attached frozen bytes no longer reproduce recorded identity', () => {
		const subject = structuredClone(fixture.subject) as FrozenSubject;
		const bytesByPath = new Map<string, Uint8Array>();
		for (const artifact of fixture.subject.artifacts)
			bytesByPath.set(artifact.path, artifactBytes(artifact.path));
		bytesByPath.set(COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH, new TextEncoder().encode('{}'));
		attachFrozenSubjectBytes(subject, bytesByPath);
		expectIssue(
			validate(baseline, { ...fixture.inputs, subject }),
			'INVALID',
			'POPULATION_MISMATCH',
			'$'
		);
	});

	it('fails closed when an attached frozen capability omits a selected artifact body', () => {
		const subject = structuredClone(fixture.subject) as FrozenSubject;
		const bytesByPath = new Map<string, Uint8Array>();
		for (const artifact of fixture.subject.artifacts)
			if (artifact.path !== COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH)
				bytesByPath.set(artifact.path, artifactBytes(artifact.path));
		attachFrozenSubjectBytes(subject, bytesByPath);
		expectIssue(
			validate(baseline, { ...fixture.inputs, subject }),
			'INVALID',
			'POPULATION_MISMATCH',
			'$'
		);
	});

	it('does not silently admit a detached semantic declaration into the bound input population', () => {
		const semanticSnapshot = structuredClone(fixture.snapshot) as StaticSemanticSnapshot;
		const selected = semanticSnapshot.declarations.find(
			(declaration) => declaration.sourceId === fixture.request.eventRegistry.sourceId
		);
		if (selected === undefined) throw new Error('Fixture semantic declaration is unavailable.');
		Object.assign(
			semanticSnapshot as unknown as {
				declarations: StaticSemanticSnapshot['declarations'];
			},
			{
				declarations: [
					...semanticSnapshot.declarations,
					{
						...selected,
						id: 'semantic:declaration-detached' as never,
						name: 'DetachedSemanticDeclaration',
						nodeId: null,
						symbolId: null
					}
				]
			}
		);
		expectIssue(
			validate(baseline, inputsWithRebuiltCommandHandlerGraph(semanticSnapshot)),
			'INVALID',
			'POPULATION_MISMATCH',
			'$'
		);
	});

	it('independently rejects malformed vocab JSON and semantic vocab rows', () => {
		const vocab = JSON.parse(artifactText(COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH)) as {
			bindings: Record<string, unknown>[];
			commands: Record<string, unknown>[];
			events: Record<string, unknown>[];
		};
		const firstBinding = vocab.bindings[0]!;
		const firstCommand = vocab.commands[0]!;
		for (const malformed of [
			new Uint8Array([0xff]),
			'{',
			'{}',
			'[]',
			'{"commands":[],"events":[],"bindings":[],"bindings":[]}',
			JSON.stringify({ ...vocab, commands: [null] }),
			JSON.stringify({ ...vocab, events: [null] }),
			JSON.stringify({ ...vocab, bindings: [null] }),
			JSON.stringify({ ...vocab, events: [...vocab.events, vocab.events[0]] }),
			JSON.stringify({ ...vocab, bindings: [...vocab.bindings, firstBinding] }),
			JSON.stringify({
				...vocab,
				bindings: [{ commandType: 'Missing', eventType: 'WorkStarted' }]
			}),
			JSON.stringify({ ...vocab, commands: [{ ...firstCommand, drivesFrom: 7 }] }),
			JSON.stringify({ ...vocab, commands: [{ ...firstCommand, commandType: '' }] }),
			JSON.stringify({ ...vocab, commands: [{ ...firstCommand, alsoEmitsEvents: 'WorkAudited' }] }),
			JSON.stringify({ ...vocab, commands: [{ ...firstCommand, alsoEmitsEvents: [''] }] }),
			JSON.stringify({
				...vocab,
				commands: [{ ...firstCommand, alsoEmitsEvents: ['WorkAudited', 'WorkAudited'] }]
			}),
			JSON.stringify({ ...vocab, commands: [firstCommand, firstCommand] }),
			JSON.stringify({ ...vocab, commands: [{ ...firstCommand, emitsEvent: 'MissingEvent' }] }),
			JSON.stringify({
				...vocab,
				bindings: [{ ...firstBinding, eventType: 'MissingEvent' }, ...vocab.bindings.slice(1)]
			}),
			JSON.stringify({
				...vocab,
				bindings: [{ ...firstBinding, eventType: 'RuntimeOnly' }, ...vocab.bindings.slice(1)]
			})
		])
			expectIssue(
				validate(
					baseline,
					inputsWithArtifact(COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH, malformed)
				),
				'INVALID',
				'POPULATION_MISMATCH',
				'$'
			);
	});

	it('independently rejects valid vocab populations that diverge from generated registries', () => {
		const vocab = JSON.parse(artifactText(COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH)) as {
			bindings: Record<string, unknown>[];
			commands: Record<string, unknown>[];
			events: Record<string, unknown>[];
		};
		const firstCommand = vocab.commands[0]!;
		const primaryChanged = {
			...vocab,
			bindings: vocab.bindings.map((binding) =>
				binding.eventType === 'WorkStarted' ? { ...binding, eventType: 'RuntimeOnly' } : binding
			),
			commands: [{ ...firstCommand, emitsEvent: 'RuntimeOnly' }]
		};
		for (const changed of [
			{ ...vocab, bindings: [], commands: [] },
			primaryChanged,
			{
				...vocab,
				events: [
					...vocab.events,
					{ aggregateType: 'Work', eventType: 'ExtraEvent', payloadFields: [] }
				]
			}
		])
			expectIssue(
				validate(
					baseline,
					inputsWithArtifact(COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH, JSON.stringify(changed))
				),
				'INVALID',
				'POPULATION_MISMATCH',
				'$'
			);
	});

	it('rejects a candidate whose canonical content digest is stale', () => {
		expectIssue(
			validate({ ...baseline, contentDigest: '0'.repeat(64) }),
			'INVALID',
			'CONTENT_DIGEST_MISMATCH',
			'$.contentDigest'
		);
	});

	it('independently rejects retained census grammar and derives alternate valid surfaces', () => {
		const census = artifactText(COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH);
		const emitted =
			"const EMITTED_2026_08_04 = new Set(['RuntimeOnly', 'WorkAudited', 'WorkStarted']);";
		for (const malformed of [
			new Uint8Array([0xff]),
			'const BOUND = ;',
			census.replace('const BOUND =', 'const UNBOUND ='),
			census.replace('const BOUND =', 'let BOUND ='),
			census.replace('.flatMap((command) =>', '.map((command) =>'),
			census.replace(
				`...(vocab.commands ?? []).flatMap((command) =>
		command.emitsEvent ? [command.emitsEvent] : []
	),`,
				`...(vocab.commands ?? []).flatMap((command) => {
		return command.emitsEvent ? [command.emitsEvent] : [];
	}),`
			),
			census.replace(
				'command.emitsEvent ? [command.emitsEvent] : []',
				'true ? [command.emitsEvent] : []'
			),
			census.replace('new Set<string>([', 'new Set<number>(['),
			census.replace('vocab.bindings ?? []', 'vocab.commands ?? []'),
			census.replace('const EMITTED_2026_08_04', 'let EMITTED_2026_08_04'),
			census.replace(emitted, "const EMITTED_2026_08_04 = new Set('WorkAudited');"),
			census.replace("new Set(['RuntimeOnly'", "new Set<string>(['RuntimeOnly'"),
			census.replace("'WorkAudited', 'WorkStarted'", "'WorkAudited', 'WorkAudited', 'WorkStarted'"),
			census.replace(emitted, "const EMITTED_2026_08_04 = new Set([...['RuntimeOnly']]);")
		])
			expectIssue(
				validate(
					baseline,
					inputsWithArtifact(COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH, malformed)
				),
				'INVALID',
				'POPULATION_MISMATCH',
				'$'
			);

		const vocab = JSON.parse(artifactText(COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH)) as {
			bindings: unknown[];
		};
		for (const inputs of [
			inputsWithArtifact(
				COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
				JSON.stringify({ ...vocab, bindings: [] })
			),
			inputsWithArtifact(
				COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
				census.replace(emitted, "const EMITTED_2026_08_04 = new Set(['WorkAudited']);")
			)
		])
			expectIssue(validate(baseline, inputs), 'INVALID', 'POPULATION_MISMATCH', '$');
	});

	it('retains an unknown pinned event as an explicit unmatched frontier', () => {
		const census = artifactText(COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH);
		const changed = census.replace(
			"'RuntimeOnly', 'WorkAudited', 'WorkStarted'",
			"'OrphanPinned', 'RuntimeOnly', 'WorkAudited', 'WorkStarted'"
		);
		expect(changed).not.toBe(census);
		expectIssue(
			validate(
				baseline,
				inputsWithArtifact(COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH, changed)
			),
			'INVALID',
			'POPULATION_MISMATCH',
			'$'
		);
	});
});
