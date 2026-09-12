import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
	STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
	type BuildStateMachineTopologyObservationRequest,
	type StateMachineTopologyArtifactBinding
} from '../../contracts/state-machine-graph.js';
import type { FrozenSubject } from '../../contracts/subject.js';
import { stateMachineTopologyObservationContentDigest } from '../../graph/state-machine-graph-content.js';
import { sha256 } from '../../inventory/canonical.js';
import { attachFrozenSubjectBytes } from '../../subject/frozen-store.js';
import { observeStateMachineTopology } from './observe-state-machines.js';
import { validateStateMachineTopologyObservation } from './validate-state-machine-observation.js';

const PATH = 'packages/rph-domain/src/transitions.data.ts';
const SUBJECT_ID = 'a'.repeat(64);
const SOURCE = `
export interface Ignored { readonly name: string }
export const STATE_MACHINES = {
  Alpha: {
    name: 'Alpha',
    states: ['ONE', 'TWO', 'THREE'],
    initialState: 'ONE',
    terminalStates: ['THREE'],
    transitions: [
      { from: 'ONE', to: 'TWO', trigger: 'go', guard: 'allowed', note: 'source note' },
      { from: 'TWO', to: 'THREE' }
    ],
    illegal: [{ from: 'THREE', to: 'ONE', reason: 'terminal' }],
    guarded: [{ from: 'ONE', to: 'TWO', reason: 'authorization' }],
    sourceSection: 'fixture §1'
  },
  Beta: {
    name: 'Beta', states: ['IDLE'], initialState: undefined, terminalStates: [],
    transitions: [], illegal: [], guarded: []
  }
};
export const CROSS_AXIS_RULES = [
  { machine: 'Alpha', from: 'external=YES', to: 'THREE', reason: 'cross-axis reason' }
];
`;

function fixture(
	source = SOURCE,
	rawBytes?: Uint8Array
): {
	readonly request: BuildStateMachineTopologyObservationRequest;
	readonly subject: FrozenSubject;
} {
	const bytes = rawBytes ?? new TextEncoder().encode(source);
	const digest = sha256(bytes);
	const artifact: StateMachineTopologyArtifactBinding = {
		bytes: bytes.byteLength,
		canonicalPathKey: PATH,
		disposition: 'ANALYZED' as const,
		path: PATH,
		primaryClass: 'GENERATED_SOURCE',
		roles: ['ANALYSIS_INPUT', 'GENERATED'] as const,
		sha256: digest
	};
	const subject = {
		artifacts: [artifact],
		descriptor: { subjectId: SUBJECT_ID },
		diagnostics: [],
		excludedArtifacts: [],
		generatedContexts: [],
		population: {
			analyzed: 1,
			discovered: 1,
			excluded: 0,
			failed: 0,
			included: 1,
			inventoryOnly: 0,
			reconciles: true
		},
		projects: [],
		request: {},
		workspaces: []
	} as unknown as FrozenSubject;
	attachFrozenSubjectBytes(subject, new Map([[PATH, bytes]]));
	return {
		request: {
			artifact,
			budgets: {
				maxAstNodes: 1_000,
				maxCrossAxisRules: 10,
				maxDiagnostics: 10,
				maxMachines: 10,
				maxSourceBytes: 100_000,
				maxStates: 100,
				maxTextCharacters: 10_000,
				maxTransitions: 100
			},
			operationVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
			schemaVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
			subjectId: SUBJECT_ID
		},
		subject
	};
}

function complete(source = SOURCE) {
	const { request, subject } = fixture(source);
	const outcome = observeStateMachineTopology(request, { subject });
	expect(outcome.outcome).toBe('complete');
	if (outcome.outcome !== 'complete') throw new Error(outcome.diagnostics[0]?.message);
	return { observation: outcome.observation, request, subject };
}

function unavailable(
	source: string,
	revise?: (request: BuildStateMachineTopologyObservationRequest) => unknown
) {
	const { request, subject } = fixture(source);
	return observeStateMachineTopology(
		(revise?.(request) ?? request) as BuildStateMachineTopologyObservationRequest,
		{ subject }
	);
}

describe('JPWB generated state-machine topology observer', () => {
	it('observes deterministic real-shaped topology with exact semantics, spans, provenance text, and subject binding', () => {
		const first = complete();
		const second = observeStateMachineTopology(first.request, { subject: first.subject });
		expect(second).toEqual({
			diagnostics: [],
			observation: first.observation,
			outcome: 'complete'
		});
		expect(first.observation.coverage).toEqual({
			crossAxisRules: 1,
			explicitlyIllegalTransitions: 1,
			guardedTransitions: 1,
			legalTransitions: 2,
			machines: 2,
			reconciles: true,
			states: 4
		});
		const alpha = first.observation.machines.find((machine) => machine.name === 'Alpha')!;
		expect(alpha).toMatchObject({
			initialState: 'ONE',
			sourceSection: 'fixture §1',
			terminalStates: ['THREE']
		});
		expect(alpha.stateIds).toEqual(
			first.observation.states
				.filter((state) => state.machineId === alpha.id)
				.sort((left, right) => left.ordinal - right.ordinal)
				.map((state) => state.id)
		);
		expect(first.observation.legalTransitions.find((edge) => edge.from === 'ONE')).toMatchObject({
			guard: 'allowed',
			note: 'source note',
			to: 'TWO',
			trigger: 'go'
		});
		expect(first.observation.guardedTransitions[0]!.legalTransitionId).toBe(
			first.observation.legalTransitions.find((edge) => edge.from === 'ONE')!.id
		);
		expect(first.observation.crossAxisRules[0]).toMatchObject({
			from: 'external=YES',
			machineName: 'Alpha',
			reason: 'cross-axis reason',
			to: 'THREE'
		});
		expect(first.observation.states.find((state) => state.name === 'ONE')).toMatchObject({
			initial: true,
			terminal: false
		});
		expect(first.observation.states.find((state) => state.name === 'THREE')).toMatchObject({
			initial: false,
			terminal: true
		});
		expect(
			first.observation.machines.every((machine) => machine.span.end > machine.span.start)
		).toBe(true);
		expect(first.observation.contentDigest).toBe(
			stateMachineTopologyObservationContentDigest(first.observation)
		);
		expect(first.observation.epistemic).toMatchObject({
			freshness: 'SUBJECT_BOUND',
			supportBasis: 'DECLARED_GENERATED_TOPOLOGY'
		});
		expect(validateStateMachineTopologyObservation(first.observation, first.subject)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it.each([
		['missing export', SOURCE.replace('export const CROSS_AXIS_RULES', 'const OTHER')],
		['duplicate export', `${SOURCE}\nexport const STATE_MACHINES = {};`],
		[
			'non-exported declaration',
			SOURCE.replace('export const STATE_MACHINES', 'const STATE_MACHINES')
		],
		['spread machine', SOURCE.replace('  Alpha: {', '  ...other,\n  Alpha: {')],
		['computed machine key', SOURCE.replace('  Alpha: {', "  ['Alpha']: {")],
		['shorthand field', SOURCE.replace("    name: 'Alpha',", '    name,')],
		[
			'template expression',
			SOURCE.replace("sourceSection: 'fixture §1'", 'sourceSection: `fixture ${1}`')
		],
		['call expression', SOURCE.replace("states: ['ONE', 'TWO', 'THREE']", 'states: makeStates()')],
		[
			'unknown field',
			SOURCE.replace("sourceSection: 'fixture §1'", "sourceSection: 'fixture §1', extra: true")
		],
		['machine name mismatch', SOURCE.replace("name: 'Alpha'", "name: 'Wrong'")],
		['duplicate state', SOURCE.replace("['ONE', 'TWO', 'THREE']", "['ONE', 'TWO', 'TWO']")],
		['unknown initial', SOURCE.replace("initialState: 'ONE'", "initialState: 'MISSING'")],
		[
			'unknown terminal',
			SOURCE.replace("terminalStates: ['THREE']", "terminalStates: ['MISSING']")
		],
		[
			'unknown legal endpoint',
			SOURCE.replace("from: 'TWO', to: 'THREE'", "from: 'MISSING', to: 'THREE'")
		],
		[
			'duplicate legal edge',
			SOURCE.replace("{ from: 'TWO', to: 'THREE' }", "{ from: 'ONE', to: 'TWO' }")
		],
		[
			'guarded edge is not legal',
			SOURCE.replace("guarded: [{ from: 'ONE', to: 'TWO'", "guarded: [{ from: 'TWO', to: 'ONE'")
		],
		[
			'illegal edge is legal',
			SOURCE.replace("illegal: [{ from: 'THREE', to: 'ONE'", "illegal: [{ from: 'ONE', to: 'TWO'")
		],
		['unknown cross-axis machine', SOURCE.replace("machine: 'Alpha'", "machine: 'Missing'")],
		[
			'duplicate cross-axis descriptor',
			SOURCE.replace(/\];\s*$/u, ", { machine: 'Alpha', from: 'external=YES', to: 'THREE' }\n];")
		]
	])('fails closed for %s', (_name, source) => {
		const outcome = unavailable(source);
		expect(outcome.outcome).toBe('unavailable');
		expect(outcome.outcome === 'unavailable' && outcome.diagnostics[0]?.code).toMatch(
			/MALFORMED|UNSUPPORTED/u
		);
	});

	it('rejects strict UTF-8 failure and Unicode scalar failure', () => {
		const invalidUtf8 = fixture('', new Uint8Array([0xc3, 0x28]));
		expect(
			observeStateMachineTopology(invalidUtf8.request, { subject: invalidUtf8.subject }).outcome
		).toBe('unavailable');
		const unicode = unavailable(SOURCE.replace("trigger: 'go'", "trigger: '\\ud800'"));
		expect(unicode.outcome).toBe('unavailable');
	});

	it.each([
		['maxAstNodes', 1],
		['maxMachines', 1],
		['maxSourceBytes', 1],
		['maxStates', 1],
		['maxTextCharacters', 1],
		['maxTransitions', 1]
	] as const)('enforces caller budget %s without embedding a product maximum', (key, value) => {
		const outcome = unavailable(SOURCE, (request) => ({
			...request,
			budgets: { ...request.budgets, [key]: value }
		}));
		expect(outcome).toMatchObject({
			outcome: 'unavailable',
			diagnostics: [{ code: 'BUDGET_EXHAUSTED' }]
		});
	});

	it('enforces the caller cross-axis budget against the actual rule population', () => {
		const source = SOURCE.replace(
			/\];\s*$/u,
			", { machine: 'Alpha', from: 'external=NO', to: 'ONE' }\n];"
		);
		const outcome = unavailable(source, (request) => ({
			...request,
			budgets: { ...request.budgets, maxCrossAxisRules: 1 }
		}));
		expect(outcome).toMatchObject({
			outcome: 'unavailable',
			diagnostics: [{ code: 'BUDGET_EXHAUSTED' }]
		});
	});

	it('rejects absent, forged, and mismatched FrozenSubject/artifact capabilities', () => {
		const { request, subject } = fixture();
		expect(observeStateMachineTopology(request, { subject: { ...subject } }).outcome).toBe(
			'unavailable'
		);
		expect(
			observeStateMachineTopology({ ...request, subjectId: 'b'.repeat(64) }, { subject }).outcome
		).toBe('unavailable');
		expect(
			observeStateMachineTopology(
				{
					...request,
					artifact: { ...request.artifact, roles: ['WRONG'] }
				} as unknown as BuildStateMachineTopologyObservationRequest,
				{ subject }
			).outcome
		).toBe('unavailable');
	});

	it('rejects accessor, Proxy, unknown request fields, and invalid budget values without invoking them', () => {
		const { request, subject } = fixture();
		let invoked = false;
		const accessor = { ...request } as Record<string, unknown>;
		Object.defineProperty(accessor, 'subjectId', {
			enumerable: true,
			get: () => {
				invoked = true;
				return SUBJECT_ID;
			}
		});
		expect(
			observeStateMachineTopology(
				accessor as unknown as BuildStateMachineTopologyObservationRequest,
				{ subject }
			).outcome
		).toBe('unavailable');
		expect(invoked).toBe(false);
		expect(
			observeStateMachineTopology(
				new Proxy(request, {}) as BuildStateMachineTopologyObservationRequest,
				{ subject }
			).outcome
		).toBe('unavailable');
		expect(
			observeStateMachineTopology(
				{ ...request, extra: true } as unknown as BuildStateMachineTopologyObservationRequest,
				{ subject }
			).outcome
		).toBe('unavailable');
		expect(
			observeStateMachineTopology(
				{ ...request, budgets: { ...request.budgets, maxMachines: 0 } },
				{ subject }
			).outcome
		).toBe('unavailable');
		expect(
			observeStateMachineTopology(
				{ ...request, budgets: { ...request.budgets, maxMachines: Number.MAX_SAFE_INTEGER } },
				{ subject }
			).outcome
		).toBe('complete');
	});

	it('rejects every malformed closed-request identity field and exact manifest divergence', () => {
		const revisions: Array<(request: BuildStateMachineTopologyObservationRequest) => unknown> = [
			(request) => ({ ...request, schemaVersion: 'wrong' }),
			(request) => ({ ...request, operationVersion: 'wrong' }),
			(request) => ({ ...request, subjectId: 'wrong' }),
			(request) => ({ ...request, artifact: { ...request.artifact, path: '../escape.ts' } }),
			(request) => ({ ...request, artifact: { ...request.artifact, bytes: -1 } }),
			(request) => ({ ...request, artifact: { ...request.artifact, sha256: 'wrong' } }),
			(request) => ({
				...request,
				artifact: { ...request.artifact, disposition: 'INVENTORY_ONLY' }
			}),
			(request) => ({ ...request, artifact: { ...request.artifact, canonicalPathKey: '' } }),
			(request) => ({ ...request, artifact: { ...request.artifact, primaryClass: '' } }),
			(request) => ({ ...request, artifact: { ...request.artifact, roles: [1] } }),
			(request) => ({
				...request,
				budgets: { ...request.budgets, maxStates: Number.MAX_SAFE_INTEGER + 1 }
			}),
			(request) => {
				const { schemaVersion: _removed, ...rest } = request;
				return { ...rest, extra: true };
			}
		];
		for (const revise of revisions) {
			const { request, subject } = fixture();
			expect(
				observeStateMachineTopology(
					revise(request) as BuildStateMachineTopologyObservationRequest,
					{ subject }
				).outcome
			).toBe('unavailable');
		}

		const absent = fixture();
		(absent.subject as unknown as { artifacts: unknown[] }).artifacts = [];
		expect(observeStateMachineTopology(absent.request, { subject: absent.subject }).outcome).toBe(
			'unavailable'
		);
		const mismatched = fixture();
		const mismatchedRequest = {
			...mismatched.request,
			artifact: { ...mismatched.request.artifact, roles: [...mismatched.request.artifact.roles] }
		};
		(mismatched.subject.artifacts[0] as unknown as { roles: string[] }).roles = ['ANALYSIS_INPUT'];
		expect(
			observeStateMachineTopology(mismatchedRequest, { subject: mismatched.subject }).outcome
		).toBe('unavailable');
		const bytesMismatch = fixture();
		attachFrozenSubjectBytes(
			bytesMismatch.subject,
			new Map([[PATH, new TextEncoder().encode('different')]])
		);
		expect(
			observeStateMachineTopology(bytesMismatch.request, { subject: bytesMismatch.subject }).outcome
		).toBe('unavailable');
	});

	it.each([
		[
			'STATE_MACHINES non-object',
			SOURCE.replace(
				'export const STATE_MACHINES = {',
				'export const STATE_MACHINES = [] as const; const UNUSED = {'
			)
		],
		['duplicate machine key', SOURCE.replace('  Beta: {', '  Alpha: {')],
		['duplicate field', SOURCE.replace("name: 'Alpha',", "name: 'Alpha', name: 'Alpha',")],
		[
			'missing required field',
			SOURCE.replace("    guarded: [{ from: 'ONE', to: 'TWO', reason: 'authorization' }],", '')
		],
		['array expected', SOURCE.replace("terminalStates: ['THREE']", "terminalStates: 'THREE'")],
		['omitted array element', SOURCE.replace("['ONE', 'TWO', 'THREE']", "['ONE',, 'THREE']")],
		[
			'duplicate terminal',
			SOURCE.replace("terminalStates: ['THREE']", "terminalStates: ['THREE', 'THREE']")
		],
		[
			'unknown illegal endpoint',
			SOURCE.replace("from: 'THREE', to: 'ONE'", "from: 'MISSING', to: 'ONE'")
		],
		[
			'duplicate illegal edge',
			SOURCE.replace(
				"illegal: [{ from: 'THREE', to: 'ONE', reason: 'terminal' }]",
				"illegal: [{ from: 'THREE', to: 'ONE' }, { from: 'THREE', to: 'ONE' }]"
			)
		],
		['syntax diagnostics', `${SOURCE}\nconst broken = {`]
	])('fails closed for additional parser boundary: %s', (_name, source) => {
		expect(unavailable(source).outcome).toBe('unavailable');
	});

	it('accepts a literal quoted machine key and preserves its text', () => {
		const result = complete(SOURCE.replace('  Alpha: {', "  'Alpha': {"));
		expect(result.observation.machines.some((machine) => machine.name === 'Alpha')).toBe(true);
	});

	it('observes the exact bounded JPWB generated topology without importing or executing rph-domain', () => {
		const bytes = readFileSync(PATH);
		const { request, subject } = fixture('', bytes);
		const outcome = observeStateMachineTopology(
			{
				...request,
				budgets: {
					...request.budgets,
					maxAstNodes: 100_000,
					maxCrossAxisRules: 1_000,
					maxMachines: 1_000,
					maxSourceBytes: bytes.byteLength,
					maxStates: 10_000,
					maxTextCharacters: 1_000_000,
					maxTransitions: 10_000
				}
			},
			{ subject }
		);
		if (outcome.outcome !== 'complete')
			throw new Error(`${outcome.diagnostics[0]?.path}: ${outcome.diagnostics[0]?.message}`);
		expect(outcome.outcome).toBe('complete');
		expect(outcome.observation.coverage).toMatchObject({
			crossAxisRules: 11,
			// 304 -> 308: W-5.5's UnblockPwu adds four transitions. ⚠ REG-F-194 recorded this remedy as
			// "308 -> 312" and cited subject.test.ts:1707; both figures are wrong. Re-derived from the
			// assertion diff and corroborated by counting the delta in transitions.data.ts (+4).
			legalTransitions: 308,
			machines: 27,
			reconciles: true
		});
		expect(validateStateMachineTopologyObservation(outcome.observation, subject).state).toBe(
			'VALID'
		);
	});

	it('catches an unexpected hostile options failure without exposing it', () => {
		const { request } = fixture();
		const options = new Proxy(
			{},
			{
				get: () => {
					throw new Error('hostile');
				}
			}
		);
		expect(
			observeStateMachineTopology(request, options as { readonly subject: FrozenSubject })
		).toMatchObject({
			outcome: 'unavailable',
			diagnostics: [{ code: 'MALFORMED_GENERATED_TABLE' }]
		});
	});
});

describe('state-machine topology observation validator', () => {
	it('rejects ordinary corruption and coordinated corruption with a repaired digest', () => {
		const { observation } = complete();
		const corrupted = structuredClone(
			observation
		) as unknown as StateMachineTopologyObservationMutable;
		corrupted.states[0]!.name = 'FORGED';
		expect(validateStateMachineTopologyObservation(corrupted).state).toBe('INVALID');
		corrupted.contentDigest = stateMachineTopologyObservationContentDigest(corrupted as never);
		expect(validateStateMachineTopologyObservation(corrupted)).toMatchObject({ state: 'INVALID' });
	});

	it.each([
		[
			'guarded legal binding',
			(value: StateMachineTopologyObservationMutable) => {
				value.guardedTransitions[0]!.legalTransitionId = value.explicitlyIllegalTransitions[0]!.id;
			}
		],
		[
			'cross-axis machine',
			(value: StateMachineTopologyObservationMutable) => {
				value.crossAxisRules[0]!.machineName = 'Missing';
			}
		],
		[
			'coverage',
			(value: StateMachineTopologyObservationMutable) => {
				value.coverage.states += 1;
			}
		],
		[
			'machine manifest',
			(value: StateMachineTopologyObservationMutable) => {
				(
					value.machines.find((machine) => machine.stateIds.length > 1)!
						.stateIds as unknown as string[]
				).reverse();
			}
		],
		[
			'authority',
			(value: StateMachineTopologyObservationMutable) => {
				(value as unknown as Record<string, unknown>).verifierAuthority = 'FORGED';
			}
		]
	])('rejects coordinated %s corruption even when content digest is repaired', (_name, mutate) => {
		const { observation } = complete();
		const forged = structuredClone(
			observation
		) as unknown as StateMachineTopologyObservationMutable;
		mutate(forged);
		forged.contentDigest = stateMachineTopologyObservationContentDigest(forged as never);
		expect(validateStateMachineTopologyObservation(forged).state).toBe('INVALID');
	});

	it('fails closed on hostile wire values and verifies the optional exact subject binding', () => {
		const { observation, subject } = complete();
		expect(validateStateMachineTopologyObservation(new Proxy(observation, {})).state).toBe(
			'INVALID'
		);
		expect(validateStateMachineTopologyObservation(null).state).toBe('INVALID');
		expect(validateStateMachineTopologyObservation(observation, subject).state).toBe('VALID');
		expect(
			validateStateMachineTopologyObservation(observation, { ...subject } as FrozenSubject).state
		).toBe('INVALID');
	});

	it('independently rejects malformed wire containers, scalars, spans, order, versions, and identities', () => {
		const mutateCases: Array<(value: Record<string, any>) => void> = [
			(value) => {
				value.schemaVersion = 'wrong';
			},
			(value) => {
				value.subjectId = 'wrong';
			},
			(value) => {
				value.artifact.disposition = 'INVENTORY_ONLY';
			},
			(value) => {
				value.artifact.sha256 = 'wrong';
			},
			(value) => {
				value.budgets.maxStates = 0;
			},
			(value) => {
				value.producer.api = 'PRIVATE_API';
			},
			(value) => {
				value.epistemic.executionHealth = 'FAILED';
			},
			(value) => {
				value.id = 'forged';
			},
			(value) => {
				value.machines[0].id = 'forged';
			},
			(value) => {
				value.states[0].machineId = 'missing';
			},
			(value) => {
				value.states[0].id = 'forged';
			},
			(value) => {
				value.states[0].initial = 'yes';
			},
			(value) => {
				value.states[0].span.end = value.states[0].span.start - 1;
			},
			(value) => {
				value.legalTransitions[0].machineId = 'missing';
			},
			(value) => {
				value.legalTransitions[0].fromStateId =
					value.states.find((state: any) => state.machineId !== value.legalTransitions[0].machineId)
						?.id ?? 'missing';
			},
			(value) => {
				value.legalTransitions[0].id = 'forged';
			},
			(value) => {
				value.crossAxisRules[0].id = 'forged';
			},
			(value) => {
				value.machines.reverse();
			},
			(value) => {
				value.coverage.reconciles = false;
			},
			(value) => {
				value.contentDigest = 'wrong';
			}
		];
		const { observation } = complete();
		for (const mutate of mutateCases) {
			const value = structuredClone(observation) as unknown as Record<string, any>;
			mutate(value);
			expect(validateStateMachineTopologyObservation(value).state).toBe('INVALID');
		}
		const extra = structuredClone(observation) as unknown as Record<string, unknown>;
		extra.extra = true;
		expect(validateStateMachineTopologyObservation(extra).state).toBe('INVALID');
		const nonPlain = Object.assign(
			Object.create({ inherited: true }),
			structuredClone(observation)
		);
		expect(validateStateMachineTopologyObservation(nonPlain).state).toBe('INVALID');
		const sparse = structuredClone(observation) as unknown as Record<string, any>;
		delete sparse.states[0];
		expect(validateStateMachineTopologyObservation(sparse).state).toBe('INVALID');
	});
});

type StateMachineTopologyObservationMutable = {
	-readonly [K in keyof ReturnType<typeof complete>['observation']]: ReturnType<
		typeof complete
	>['observation'][K] extends readonly (infer E)[]
		? Array<{ -readonly [P in keyof E]: E[P] }>
		: ReturnType<typeof complete>['observation'][K] extends object
			? {
					-readonly [P in keyof ReturnType<typeof complete>['observation'][K]]: ReturnType<
						typeof complete
					>['observation'][K][P];
				}
			: ReturnType<typeof complete>['observation'][K];
};
