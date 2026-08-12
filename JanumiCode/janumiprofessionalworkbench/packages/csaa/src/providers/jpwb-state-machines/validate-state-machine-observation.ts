import { isProxy } from 'node:util/types';

import {
	FULL_JAN_CSAA_008_CONFORMANCE,
	STATE_MACHINE_GRAPH_REGISTRY_STATUS,
	STATE_MACHINE_GRAPH_SCOPE,
	STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_METHOD,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_SCHEMA_VERSION,
	type StateMachineTopologyObservation
} from '../../contracts/state-machine-graph.js';
import {
	FULL_JAN_CSAA_007_CONFORMANCE,
	TYPESCRIPT_PROVIDER_VERSION
} from '../../contracts/semantic.js';
import type { FrozenSubject } from '../../contracts/subject.js';
import {
	stateMachineTopologyCrossAxisRuleId,
	stateMachineTopologyGuardedTransitionId,
	stateMachineTopologyIllegalTransitionId,
	stateMachineTopologyLegalTransitionId,
	stateMachineTopologyMachineId,
	stateMachineTopologyObservationId,
	stateMachineTopologyStateId
} from '../../graph/state-machine-graph-ids.js';
import { stateMachineTopologyObservationContentDigest } from '../../graph/state-machine-graph-content.js';
import { canonicalSemanticJson, isUnicodeScalarString } from '../../semantic/canonical.js';
import { isFrozenSubjectCapability } from '../../subject/frozen-store.js';
import { observeStateMachineTopology } from './observe-state-machines.js';

export interface StateMachineTopologyObservationValidationIssue {
	readonly code: string;
	readonly message: string;
	readonly path: string;
}

export interface StateMachineTopologyObservationValidationResult {
	readonly issues: readonly StateMachineTopologyObservationValidationIssue[];
	readonly state: 'INVALID' | 'VALID';
}

type RecordValue = Record<string, unknown>;
const SHA256 = /^[a-f0-9]{64}$/u;

class InvalidObservation extends Error {
	constructor(readonly issue: StateMachineTopologyObservationValidationIssue) {
		super(issue.message);
	}
}

function invalid(code: string, path: string, message: string): never {
	throw new InvalidObservation({ code, message, path });
}

function record(value: unknown, keys: readonly string[], path: string): RecordValue {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		invalid('INVALID_SHAPE', path, 'Expected a plain, non-Proxy record.');
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		invalid('INVALID_SHAPE', path, 'Expected a plain record.');
	const own = Reflect.ownKeys(value);
	if (own.some((key) => typeof key !== 'string') || own.length !== keys.length)
		invalid('INVALID_SHAPE', path, 'Record has an unexpected field population.');
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			invalid('INVALID_SHAPE', `${path}.${key}`, 'Expected an enumerable data property.');
	}
	for (const key of own as string[])
		if (!keys.includes(key))
			invalid('INVALID_SHAPE', `${path}.${key}`, 'Unknown observation field.');
	return value as RecordValue;
}

function get(value: RecordValue, key: string): unknown {
	return Reflect.getOwnPropertyDescriptor(value, key)?.value;
}

function text(value: unknown, path: string): string {
	if (typeof value !== 'string' || !isUnicodeScalarString(value))
		invalid('INVALID_VALUE', path, 'Expected Unicode scalar text.');
	return value;
}

function nullableText(value: unknown, path: string): string | null {
	return value === null ? null : text(value, path);
}

function integer(value: unknown, path: string, minimum = 0): number {
	if (!Number.isSafeInteger(value) || (value as number) < minimum)
		invalid('INVALID_VALUE', path, `Expected a safe integer no less than ${minimum}.`);
	return value as number;
}

function array(value: unknown, path: string): readonly unknown[] {
	if (!Array.isArray(value) || isProxy(value)) invalid('INVALID_SHAPE', path, 'Expected an array.');
	const keys = Reflect.ownKeys(value);
	if (
		keys.some(
			(key) => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key))
		) ||
		keys.length !== value.length + 1
	)
		invalid('INVALID_SHAPE', path, 'Array must be dense and have no expando fields.');
	return value;
}

function stringArray(value: unknown, path: string): readonly string[] {
	return array(value, path).map((entry, index) => text(entry, `${path}[${index}]`));
}

function span(value: unknown, path: string): void {
	const item = record(value, ['end', 'start'], path);
	const start = integer(get(item, 'start'), `${path}.start`);
	const end = integer(get(item, 'end'), `${path}.end`);
	if (end < start) invalid('INVALID_VALUE', path, 'Source span end precedes start.');
}

function assertCanonicalIds<T extends { readonly id: string }>(
	values: readonly T[],
	path: string
): void {
	const seen = new Set<string>();
	for (let index = 0; index < values.length; index += 1) {
		const id = values[index]!.id;
		if (seen.has(id))
			invalid('DUPLICATE_ID', `${path}[${index}].id`, 'Record identity is duplicated.');
		seen.add(id);
		if (index > 0 && values[index - 1]!.id >= id)
			invalid('NONCANONICAL_ORDER', path, 'Population is not strictly ordered by identity.');
	}
}

function validateInternal(value: unknown, subject?: FrozenSubject): void {
	const root = record(
		value,
		[
			'artifact',
			'budgets',
			'contentDigest',
			'coverage',
			'crossAxisRules',
			'explicitlyIllegalTransitions',
			'epistemic',
			'fullJanCsaa007Conformance',
			'fullJanCsaa008Conformance',
			'guardedTransitions',
			'id',
			'legalTransitions',
			'machines',
			'method',
			'operationVersion',
			'producer',
			'registryStatus',
			'schemaVersion',
			'scope',
			'states',
			'subjectId',
			'verifierAuthority'
		],
		'$'
	);
	if (
		get(root, 'schemaVersion') !== STATE_MACHINE_TOPOLOGY_OBSERVATION_SCHEMA_VERSION ||
		get(root, 'operationVersion') !== STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION ||
		get(root, 'method') !== STATE_MACHINE_TOPOLOGY_OBSERVATION_METHOD
	)
		invalid('UNSUPPORTED_VERSION', '$', 'Observation schema, operation, or method is unsupported.');
	const subjectId = text(get(root, 'subjectId'), '$.subjectId');
	if (!SHA256.test(subjectId))
		invalid('INVALID_VALUE', '$.subjectId', 'Subject identity must be lowercase SHA-256.');
	const artifact = record(
		get(root, 'artifact'),
		['bytes', 'canonicalPathKey', 'disposition', 'path', 'primaryClass', 'roles', 'sha256'],
		'$.artifact'
	);
	integer(get(artifact, 'bytes'), '$.artifact.bytes');
	for (const key of ['canonicalPathKey', 'path', 'primaryClass'] as const)
		text(get(artifact, key), `$.artifact.${key}`);
	if (get(artifact, 'disposition') !== 'ANALYZED')
		invalid('INVALID_VALUE', '$.artifact.disposition', 'Artifact must be analyzed.');
	stringArray(get(artifact, 'roles'), '$.artifact.roles');
	if (!SHA256.test(text(get(artifact, 'sha256'), '$.artifact.sha256')))
		invalid('INVALID_VALUE', '$.artifact.sha256', 'Artifact digest must be lowercase SHA-256.');
	const budgets = record(
		get(root, 'budgets'),
		[
			'maxAstNodes',
			'maxCrossAxisRules',
			'maxDiagnostics',
			'maxMachines',
			'maxSourceBytes',
			'maxStates',
			'maxTextCharacters',
			'maxTransitions'
		],
		'$.budgets'
	);
	for (const key of Reflect.ownKeys(budgets) as string[])
		integer(get(budgets, key), `$.budgets.${key}`, 1);
	const producer = record(get(root, 'producer'), ['api', 'id', 'version'], '$.producer');
	if (
		get(producer, 'api') !== 'PUBLIC_COMPILER_API' ||
		get(producer, 'id') !== 'typescript' ||
		get(producer, 'version') !== TYPESCRIPT_PROVIDER_VERSION
	)
		invalid('INVALID_VALUE', '$.producer', 'Producer identity is unsupported.');
	const epistemic = record(
		get(root, 'epistemic'),
		[
			'capabilityCoverage',
			'conflictState',
			'executionHealth',
			'freshness',
			'inferenceState',
			'supportBasis'
		],
		'$.epistemic'
	);
	const expectedEpistemic = {
		capabilityCoverage: 'PARTIAL',
		conflictState: 'NOT_EVALUATED',
		executionHealth: 'SUCCEEDED',
		freshness: 'SUBJECT_BOUND',
		inferenceState: 'NONE',
		supportBasis: 'DECLARED_GENERATED_TOPOLOGY'
	};
	for (const [key, expected] of Object.entries(expectedEpistemic))
		if (get(epistemic, key) !== expected)
			invalid('INVALID_VALUE', `$.epistemic.${key}`, 'Epistemic value is inconsistent.');
	if (
		get(root, 'fullJanCsaa007Conformance') !== FULL_JAN_CSAA_007_CONFORMANCE ||
		get(root, 'fullJanCsaa008Conformance') !== FULL_JAN_CSAA_008_CONFORMANCE ||
		get(root, 'registryStatus') !== STATE_MACHINE_GRAPH_REGISTRY_STATUS ||
		get(root, 'scope') !== STATE_MACHINE_GRAPH_SCOPE ||
		get(root, 'verifierAuthority') !== STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY
	)
		invalid('INVALID_VALUE', '$', 'Authority or conformance boundary is inconsistent.');

	const observation = value as StateMachineTopologyObservation;
	const expectedObservationId = stateMachineTopologyObservationId({
		artifact: observation.artifact,
		method: observation.method,
		operationVersion: observation.operationVersion,
		schemaVersion: observation.schemaVersion,
		subjectId
	});
	if (observation.id !== expectedObservationId)
		invalid('IDENTITY_MISMATCH', '$.id', 'Observation identity mismatch.');

	const machineValues = array(get(root, 'machines'), '$.machines');
	const machines = machineValues.map((entry, index) => {
		const item = record(
			entry,
			[
				'explicitlyIllegalTransitionIds',
				'guardedTransitionIds',
				'id',
				'initialState',
				'legalTransitionIds',
				'name',
				'sourceSection',
				'span',
				'stateIds',
				'terminalStates'
			],
			`$.machines[${index}]`
		);
		const name = text(get(item, 'name'), `$.machines[${index}].name`);
		const id = text(get(item, 'id'), `$.machines[${index}].id`);
		if (id !== stateMachineTopologyMachineId(observation.id, name))
			invalid('IDENTITY_MISMATCH', `$.machines[${index}].id`, 'Machine identity mismatch.');
		nullableText(get(item, 'initialState'), `$.machines[${index}].initialState`);
		nullableText(get(item, 'sourceSection'), `$.machines[${index}].sourceSection`);
		span(get(item, 'span'), `$.machines[${index}].span`);
		for (const key of [
			'explicitlyIllegalTransitionIds',
			'guardedTransitionIds',
			'legalTransitionIds',
			'stateIds',
			'terminalStates'
		] as const)
			stringArray(get(item, key), `$.machines[${index}].${key}`);
		return entry as StateMachineTopologyObservation['machines'][number];
	});
	assertCanonicalIds(machines, '$.machines');
	const machineById = new Map(machines.map((machine) => [machine.id, machine]));
	const machineByName = new Map(machines.map((machine) => [machine.name, machine]));
	if (machineByName.size !== machines.length)
		invalid('DUPLICATE_VALUE', '$.machines', 'Machine names must be unique.');

	const stateValues = array(get(root, 'states'), '$.states');
	const states = stateValues.map((entry, index) => {
		const item = record(
			entry,
			['id', 'initial', 'machineId', 'name', 'ordinal', 'span', 'terminal'],
			`$.states[${index}]`
		);
		const machineId = text(get(item, 'machineId'), `$.states[${index}].machineId`);
		const machine = machineById.get(machineId as never);
		if (machine === undefined)
			invalid(
				'REFERENCE_MISMATCH',
				`$.states[${index}].machineId`,
				'State names an unknown machine.'
			);
		const name = text(get(item, 'name'), `$.states[${index}].name`);
		if (get(item, 'id') !== stateMachineTopologyStateId(machine.id, name))
			invalid('IDENTITY_MISMATCH', `$.states[${index}].id`, 'State identity mismatch.');
		integer(get(item, 'ordinal'), `$.states[${index}].ordinal`);
		if (typeof get(item, 'initial') !== 'boolean' || typeof get(item, 'terminal') !== 'boolean')
			invalid('INVALID_VALUE', `$.states[${index}]`, 'State flags must be boolean.');
		span(get(item, 'span'), `$.states[${index}].span`);
		return entry as StateMachineTopologyObservation['states'][number];
	});
	assertCanonicalIds(states, '$.states');
	const stateById = new Map(states.map((state) => [state.id, state]));

	const transitionIds = new Set<string>();
	const validateTransitions = (
		field: 'explicitlyIllegalTransitions' | 'guardedTransitions' | 'legalTransitions'
	) => {
		const values = array(get(root, field), `$.${field}`).map((entry, index) => {
			const guarded = field === 'guardedTransitions';
			const legal = field === 'legalTransitions';
			const keys = legal
				? [
						'from',
						'fromStateId',
						'guard',
						'id',
						'machineId',
						'note',
						'ordinal',
						'span',
						'to',
						'toStateId',
						'trigger'
					]
				: guarded
					? [
							'from',
							'fromStateId',
							'id',
							'legalTransitionId',
							'machineId',
							'ordinal',
							'reason',
							'span',
							'to',
							'toStateId'
						]
					: [
							'from',
							'fromStateId',
							'id',
							'machineId',
							'ordinal',
							'reason',
							'span',
							'to',
							'toStateId'
						];
			const item = record(entry, keys, `$.${field}[${index}]`);
			const machineId = text(get(item, 'machineId'), `$.${field}[${index}].machineId`);
			const machine = machineById.get(machineId as never);
			if (machine === undefined)
				invalid(
					'REFERENCE_MISMATCH',
					`$.${field}[${index}].machineId`,
					'Transition names an unknown machine.'
				);
			const from = text(get(item, 'from'), `$.${field}[${index}].from`);
			const to = text(get(item, 'to'), `$.${field}[${index}].to`);
			const ordinal = integer(get(item, 'ordinal'), `$.${field}[${index}].ordinal`);
			const fromState = stateById.get(
				text(get(item, 'fromStateId'), `$.${field}[${index}].fromStateId`) as never
			);
			const toState = stateById.get(
				text(get(item, 'toStateId'), `$.${field}[${index}].toStateId`) as never
			);
			if (
				fromState?.machineId !== machine.id ||
				toState?.machineId !== machine.id ||
				fromState.name !== from ||
				toState.name !== to
			)
				invalid(
					'REFERENCE_MISMATCH',
					`$.${field}[${index}]`,
					'Transition endpoints do not bind named machine states.'
				);
			const input = { from, machineId: machine.id, ordinal, to };
			const expected = legal
				? stateMachineTopologyLegalTransitionId(input)
				: guarded
					? stateMachineTopologyGuardedTransitionId(input)
					: stateMachineTopologyIllegalTransitionId(input);
			const id = text(get(item, 'id'), `$.${field}[${index}].id`);
			if (id !== expected)
				invalid('IDENTITY_MISMATCH', `$.${field}[${index}].id`, 'Transition identity mismatch.');
			if (transitionIds.has(id))
				invalid('DUPLICATE_ID', `$.${field}[${index}].id`, 'Transition identity is duplicated.');
			transitionIds.add(id);
			span(get(item, 'span'), `$.${field}[${index}].span`);
			for (const key of legal ? ['guard', 'note', 'trigger'] : ['reason'])
				nullableText(get(item, key), `$.${field}[${index}].${key}`);
			return entry as { readonly id: string };
		});
		assertCanonicalIds(values, `$.${field}`);
		return values;
	};
	const illegal = validateTransitions('explicitlyIllegalTransitions');
	const guarded = validateTransitions('guardedTransitions');
	const legal = validateTransitions('legalTransitions');
	const legalIds = new Set(legal.map((edge) => edge.id));
	for (const [index, edge] of observation.guardedTransitions.entries())
		if (!legalIds.has(edge.legalTransitionId))
			invalid(
				'REFERENCE_MISMATCH',
				`$.guardedTransitions[${index}].legalTransitionId`,
				'Guarded edge does not bind a legal edge.'
			);

	const crossAxis = array(get(root, 'crossAxisRules'), '$.crossAxisRules').map((entry, index) => {
		const item = record(
			entry,
			['from', 'id', 'machineId', 'machineName', 'ordinal', 'reason', 'span', 'to'],
			`$.crossAxisRules[${index}]`
		);
		const machineName = text(get(item, 'machineName'), `$.crossAxisRules[${index}].machineName`);
		const machine = machineByName.get(machineName);
		if (machine === undefined || get(item, 'machineId') !== machine.id)
			invalid(
				'REFERENCE_MISMATCH',
				`$.crossAxisRules[${index}].machineId`,
				'Cross-axis rule names an unknown machine.'
			);
		const from = text(get(item, 'from'), `$.crossAxisRules[${index}].from`);
		const to = text(get(item, 'to'), `$.crossAxisRules[${index}].to`);
		const ordinal = integer(get(item, 'ordinal'), `$.crossAxisRules[${index}].ordinal`);
		if (
			get(item, 'id') !==
			stateMachineTopologyCrossAxisRuleId({ from, machineId: machine.id, ordinal, to })
		)
			invalid(
				'IDENTITY_MISMATCH',
				`$.crossAxisRules[${index}].id`,
				'Cross-axis rule identity mismatch.'
			);
		nullableText(get(item, 'reason'), `$.crossAxisRules[${index}].reason`);
		span(get(item, 'span'), `$.crossAxisRules[${index}].span`);
		return entry as StateMachineTopologyObservation['crossAxisRules'][number];
	});
	assertCanonicalIds(crossAxis, '$.crossAxisRules');

	for (const machine of machines) {
		const machineStates = states
			.filter((state) => state.machineId === machine.id)
			.sort((left, right) => left.ordinal - right.ordinal);
		if (
			canonicalSemanticJson(machine.stateIds) !==
			canonicalSemanticJson(machineStates.map((state) => state.id))
		)
			invalid(
				'RECONCILIATION_MISMATCH',
				'$.machines[*].stateIds',
				'Machine state manifest does not preserve authored order.'
			);
		if ((machineStates.find((state) => state.initial)?.name ?? null) !== machine.initialState)
			invalid(
				'RECONCILIATION_MISMATCH',
				'$.machines[*].initialState',
				'Initial-state projections disagree.'
			);
		if (
			canonicalSemanticJson(machine.terminalStates) !==
			canonicalSemanticJson(
				machineStates.filter((state) => state.terminal).map((state) => state.name)
			)
		)
			invalid(
				'RECONCILIATION_MISMATCH',
				'$.machines[*].terminalStates',
				'Terminal-state projections disagree.'
			);
	}
	const coverage = record(
		get(root, 'coverage'),
		[
			'crossAxisRules',
			'explicitlyIllegalTransitions',
			'guardedTransitions',
			'legalTransitions',
			'machines',
			'reconciles',
			'states'
		],
		'$.coverage'
	);
	const counts = {
		crossAxisRules: crossAxis.length,
		explicitlyIllegalTransitions: illegal.length,
		guardedTransitions: guarded.length,
		legalTransitions: legal.length,
		machines: machines.length,
		states: states.length
	};
	for (const [key, expected] of Object.entries(counts))
		if (get(coverage, key) !== expected)
			invalid('RECONCILIATION_MISMATCH', `$.coverage.${key}`, 'Coverage count mismatch.');
	if (get(coverage, 'reconciles') !== true)
		invalid(
			'RECONCILIATION_MISMATCH',
			'$.coverage.reconciles',
			'Complete observation must reconcile.'
		);
	if (
		!SHA256.test(text(get(root, 'contentDigest'), '$.contentDigest')) ||
		observation.contentDigest !== stateMachineTopologyObservationContentDigest(observation)
	)
		invalid('CONTENT_DIGEST_MISMATCH', '$.contentDigest', 'Observation content digest mismatch.');

	if (subject !== undefined) {
		if (!isFrozenSubjectCapability(subject))
			invalid(
				'SUBJECT_CAPABILITY_UNAVAILABLE',
				'$subject',
				'Expected exact FrozenSubject capability.'
			);
		const rebuilt = observeStateMachineTopology(
			{
				artifact: observation.artifact,
				budgets: observation.budgets,
				operationVersion: observation.operationVersion,
				schemaVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
				subjectId: observation.subjectId
			},
			{ subject }
		);
		if (
			rebuilt.outcome !== 'complete' ||
			canonicalSemanticJson(rebuilt.observation) !== canonicalSemanticJson(observation)
		)
			invalid(
				'SOURCE_BINDING_MISMATCH',
				'$',
				'Observation does not reproduce from the bound FrozenSubject artifact.'
			);
	}
}

export function validateStateMachineTopologyObservation(
	observation: unknown,
	subject?: FrozenSubject
): StateMachineTopologyObservationValidationResult {
	try {
		validateInternal(observation, subject);
		return { issues: [], state: 'VALID' };
	} catch (error) {
		return {
			issues: [
				error instanceof InvalidObservation
					? error.issue
					: {
							code: 'INVALID_SHAPE',
							message: 'Observation validation failed closed on a hostile value.',
							path: '$'
						}
			],
			state: 'INVALID'
		};
	}
}
