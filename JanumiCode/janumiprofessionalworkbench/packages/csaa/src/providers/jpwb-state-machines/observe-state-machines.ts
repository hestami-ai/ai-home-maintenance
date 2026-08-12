import { isProxy } from 'node:util/types';

import ts from 'typescript';

import {
	FULL_JAN_CSAA_008_CONFORMANCE,
	STATE_MACHINE_GRAPH_REGISTRY_STATUS,
	STATE_MACHINE_GRAPH_SCOPE,
	STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_METHOD,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_SCHEMA_VERSION,
	type BuildStateMachineTopologyObservationOutcome,
	type BuildStateMachineTopologyObservationRequest,
	type StateMachineSourceSpan,
	type StateMachineTopologyCrossAxisRuleRecord,
	type StateMachineTopologyGuardedTransitionRecord,
	type StateMachineTopologyIllegalTransitionRecord,
	type StateMachineTopologyLegalTransitionRecord,
	type StateMachineTopologyMachineId,
	type StateMachineTopologyMachineRecord,
	type StateMachineTopologyObservation,
	type StateMachineTopologyObservationDiagnostic,
	type StateMachineTopologyObservationDiagnosticCode,
	type StateMachineTopologyStateId,
	type StateMachineTopologyStateRecord
} from '../../contracts/state-machine-graph.js';
import {
	FULL_JAN_CSAA_007_CONFORMANCE,
	TYPESCRIPT_PROVIDER_VERSION
} from '../../contracts/semantic.js';
import type { FrozenSubject } from '../../contracts/subject.js';
import { compareText, sha256 } from '../../inventory/canonical.js';
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
import { isUnicodeScalarString } from '../../semantic/canonical.js';
import {
	isFrozenSubjectCapability,
	readFrozenSubjectArtifact
} from '../../subject/frozen-store.js';
import { assertCanonicalRelativePath } from '../../subject/paths.js';

const SHA256 = /^[a-f0-9]{64}$/u;

type JsonRecord = Record<string, unknown>;

class ObservationFailure extends Error {
	constructor(readonly diagnostic: StateMachineTopologyObservationDiagnostic) {
		super(diagnostic.message);
	}
}

function fail(
	code: StateMachineTopologyObservationDiagnosticCode,
	path: string,
	message: string,
	phase: StateMachineTopologyObservationDiagnostic['phase'] = 'PARSE'
): never {
	throw new ObservationFailure({ code, message, path, phase });
}

function plainRecord(value: unknown): value is JsonRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		return false;
	const prototype = Reflect.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function exactDataRecord(value: unknown, keys: readonly string[], path: string): JsonRecord {
	if (!plainRecord(value))
		fail('REQUEST_INVALID', path, 'Expected a plain, non-Proxy record.', 'REQUEST');
	const own = Reflect.ownKeys(value);
	if (own.some((key) => typeof key !== 'string') || own.length !== keys.length)
		fail('REQUEST_INVALID', path, 'Record has an unexpected field population.', 'REQUEST');
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			fail('REQUEST_INVALID', `${path}.${key}`, 'Expected an enumerable data property.', 'REQUEST');
	}
	for (const key of own as string[])
		if (!keys.includes(key))
			fail('REQUEST_INVALID', `${path}.${key}`, 'Unknown request field.', 'REQUEST');
	return value;
}

function data(value: JsonRecord, key: string): unknown {
	return Reflect.getOwnPropertyDescriptor(value, key)?.value;
}

const BUDGET_KEYS = [
	'maxAstNodes',
	'maxCrossAxisRules',
	'maxDiagnostics',
	'maxMachines',
	'maxSourceBytes',
	'maxStates',
	'maxTextCharacters',
	'maxTransitions'
] as const;

function closedRequest(value: unknown): BuildStateMachineTopologyObservationRequest {
	const request = exactDataRecord(
		value,
		['artifact', 'budgets', 'operationVersion', 'schemaVersion', 'subjectId'],
		'$request'
	);
	const artifact = exactDataRecord(
		data(request, 'artifact'),
		['bytes', 'canonicalPathKey', 'disposition', 'path', 'primaryClass', 'roles', 'sha256'],
		'$request.artifact'
	);
	const budgets = exactDataRecord(data(request, 'budgets'), BUDGET_KEYS, '$request.budgets');
	if (data(request, 'schemaVersion') !== STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION)
		fail(
			'REQUEST_INVALID',
			'$request.schemaVersion',
			'Unsupported request schema version.',
			'REQUEST'
		);
	if (data(request, 'operationVersion') !== STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION)
		fail(
			'REQUEST_INVALID',
			'$request.operationVersion',
			'Unsupported operation version.',
			'REQUEST'
		);
	const subjectId = data(request, 'subjectId');
	if (typeof subjectId !== 'string' || !SHA256.test(subjectId))
		fail(
			'REQUEST_INVALID',
			'$request.subjectId',
			'Subject identity must be lowercase SHA-256.',
			'REQUEST'
		);
	const artifactPath = data(artifact, 'path');
	if (typeof artifactPath !== 'string' || !isUnicodeScalarString(artifactPath))
		fail(
			'REQUEST_INVALID',
			'$request.artifact.path',
			'Artifact path must be Unicode scalar text.',
			'REQUEST'
		);
	try {
		assertCanonicalRelativePath(artifactPath);
	} catch {
		fail(
			'REQUEST_INVALID',
			'$request.artifact.path',
			'Artifact path must be canonical repository-relative text.',
			'REQUEST'
		);
	}
	const bytes = data(artifact, 'bytes');
	if (!Number.isSafeInteger(bytes) || (bytes as number) < 0)
		fail(
			'REQUEST_INVALID',
			'$request.artifact.bytes',
			'Artifact bytes must be a nonnegative safe integer.',
			'REQUEST'
		);
	const digest = data(artifact, 'sha256');
	if (typeof digest !== 'string' || !SHA256.test(digest))
		fail(
			'REQUEST_INVALID',
			'$request.artifact.sha256',
			'Artifact digest must be lowercase SHA-256.',
			'REQUEST'
		);
	if (data(artifact, 'disposition') !== 'ANALYZED')
		fail(
			'REQUEST_INVALID',
			'$request.artifact.disposition',
			'Observer requires an analyzed artifact.',
			'REQUEST'
		);
	for (const key of ['canonicalPathKey', 'primaryClass'] as const) {
		const value = data(artifact, key);
		if (typeof value !== 'string' || !isUnicodeScalarString(value) || value.length === 0)
			fail(
				'REQUEST_INVALID',
				`$request.artifact.${key}`,
				'Artifact binding text must be nonempty Unicode scalar text.',
				'REQUEST'
			);
	}
	const roles = data(artifact, 'roles');
	if (
		!Array.isArray(roles) ||
		roles.some((role) => typeof role !== 'string' || !isUnicodeScalarString(role))
	)
		fail(
			'REQUEST_INVALID',
			'$request.artifact.roles',
			'Artifact roles must be Unicode scalar strings.',
			'REQUEST'
		);
	for (const key of BUDGET_KEYS) {
		const budget = data(budgets, key);
		if (!Number.isSafeInteger(budget) || (budget as number) < 1)
			fail(
				'REQUEST_INVALID',
				`$request.budgets.${key}`,
				'Budgets must be caller-supplied positive safe integers.',
				'REQUEST'
			);
	}
	return value as BuildStateMachineTopologyObservationRequest;
}

function boundBytes(
	request: BuildStateMachineTopologyObservationRequest,
	subjectValue: unknown
): { readonly bytes: Uint8Array; readonly subject: FrozenSubject } {
	if (!isFrozenSubjectCapability(subjectValue))
		fail(
			'SUBJECT_CAPABILITY_UNAVAILABLE',
			'$options.subject',
			'Observer requires the exact FrozenSubject capability.',
			'REQUEST'
		);
	const subject = subjectValue;
	if (subject.descriptor.subjectId !== request.subjectId)
		fail(
			'SUBJECT_ID_MISMATCH',
			'$request.subjectId',
			'Request and FrozenSubject identities differ.',
			'REQUEST'
		);
	const matching = subject.artifacts.filter((artifact) => artifact.path === request.artifact.path);
	if (matching.length !== 1)
		fail(
			'ARTIFACT_IDENTITY_MISMATCH',
			'$request.artifact.path',
			'Requested artifact must occur exactly once in the FrozenSubject manifest.',
			'READ'
		);
	const artifact = matching[0]!;
	if (
		artifact.bytes !== request.artifact.bytes ||
		artifact.canonicalPathKey !== request.artifact.canonicalPathKey ||
		artifact.sha256 !== request.artifact.sha256 ||
		artifact.disposition !== request.artifact.disposition ||
		artifact.primaryClass !== request.artifact.primaryClass ||
		artifact.roles.length !== request.artifact.roles.length ||
		artifact.roles.some((role, index) => role !== request.artifact.roles[index])
	)
		fail(
			'ARTIFACT_IDENTITY_MISMATCH',
			'$request.artifact',
			'Request does not exactly bind an analyzed subject artifact.',
			'READ'
		);
	const bytes = readFrozenSubjectArtifact(subject, request.artifact.path);
	if (
		bytes === undefined ||
		bytes.byteLength !== artifact.bytes ||
		sha256(bytes) !== artifact.sha256
	)
		fail(
			'ARTIFACT_IDENTITY_MISMATCH',
			'$options.subject',
			'Frozen bytes do not reproduce the artifact manifest.',
			'READ'
		);
	if (bytes.byteLength > request.budgets.maxSourceBytes)
		fail(
			'BUDGET_EXHAUSTED',
			'$request.budgets.maxSourceBytes',
			'Source bytes exceed the caller budget.',
			'READ'
		);
	return { bytes, subject };
}

interface ParseContext {
	readonly observationId: StateMachineTopologyObservation['id'];
	readonly request: BuildStateMachineTopologyObservationRequest;
	readonly sourceFile: ts.SourceFile;
	textCharacters: number;
	transitions: number;
}

function span(context: ParseContext, node: ts.Node): StateMachineSourceSpan {
	return {
		end: node.end,
		start: node.getStart(context.sourceFile, false)
	};
}

function addText(context: ParseContext, value: string, path: string): string {
	if (!isUnicodeScalarString(value))
		fail(
			'MALFORMED_GENERATED_TABLE',
			path,
			'Literal text must contain only Unicode scalar values.'
		);
	context.textCharacters += value.length;
	if (context.textCharacters > context.request.budgets.maxTextCharacters)
		fail('BUDGET_EXHAUSTED', path, 'Literal text exceeds the caller character budget.');
	return value;
}

function stringLiteral(context: ParseContext, node: ts.Expression, path: string): string {
	if (!ts.isStringLiteral(node) && !ts.isNoSubstitutionTemplateLiteral(node))
		fail('UNSUPPORTED_GENERATED_TABLE', path, 'Expected a string literal.');
	return addText(context, node.text, path);
}

function propertyName(context: ParseContext, name: ts.PropertyName, path: string): string {
	if (ts.isIdentifier(name)) return name.text;
	if (ts.isStringLiteral(name)) return addText(context, name.text, path);
	fail(
		'UNSUPPORTED_GENERATED_TABLE',
		path,
		'Property name must be an identifier or string literal.'
	);
}

function objectProperties(
	context: ParseContext,
	node: ts.Expression,
	allowed: readonly string[],
	required: readonly string[],
	path: string
): ReadonlyMap<string, ts.Expression> {
	if (!ts.isObjectLiteralExpression(node))
		fail('UNSUPPORTED_GENERATED_TABLE', path, 'Expected a literal object.');
	const result = new Map<string, ts.Expression>();
	for (const [index, property] of node.properties.entries()) {
		if (!ts.isPropertyAssignment(property))
			fail(
				'UNSUPPORTED_GENERATED_TABLE',
				`${path}.properties[${index}]`,
				'Only property assignments are supported.'
			);
		const key = propertyName(context, property.name, `${path}.properties[${index}].name`);
		if (!allowed.includes(key))
			fail('UNSUPPORTED_GENERATED_TABLE', `${path}.${key}`, 'Unknown literal-object field.');
		if (result.has(key))
			fail('MALFORMED_GENERATED_TABLE', `${path}.${key}`, 'Duplicate literal-object field.');
		result.set(key, property.initializer);
	}
	for (const key of required)
		if (!result.has(key))
			fail(
				'MALFORMED_GENERATED_TABLE',
				`${path}.${key}`,
				'Required literal-object field is absent.'
			);
	return result;
}

function arrayElements(
	context: ParseContext,
	node: ts.Expression,
	path: string
): readonly ts.Expression[] {
	if (!ts.isArrayLiteralExpression(node))
		fail('UNSUPPORTED_GENERATED_TABLE', path, 'Expected a literal array.');
	for (const [index, element] of node.elements.entries())
		if (ts.isSpreadElement(element) || ts.isOmittedExpression(element))
			fail(
				'UNSUPPORTED_GENERATED_TABLE',
				`${path}[${index}]`,
				'Spread and omitted elements are unsupported.'
			);
	return node.elements as readonly ts.Expression[];
}

function optionalString(
	context: ParseContext,
	properties: ReadonlyMap<string, ts.Expression>,
	key: string,
	path: string
): string | null {
	const node = properties.get(key);
	return node === undefined ? null : stringLiteral(context, node, `${path}.${key}`);
}

function parseExport(
	sourceFile: ts.SourceFile,
	name: 'CROSS_AXIS_RULES' | 'STATE_MACHINES'
): ts.Expression {
	const declarations: ts.VariableDeclaration[] = [];
	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const exported =
			statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
			false;
		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
			if (
				!exported ||
				!(statement.declarationList.flags & ts.NodeFlags.Const) ||
				declaration.initializer === undefined
			)
				fail(
					'MALFORMED_GENERATED_TABLE',
					`$source.${name}`,
					`${name} must be an initialized exported const.`
				);
			declarations.push(declaration);
		}
	}
	if (declarations.length !== 1)
		fail(
			'MALFORMED_GENERATED_TABLE',
			`$source.${name}`,
			`Expected exactly one exported ${name} declaration.`
		);
	return declarations[0]!.initializer!;
}

function checkAstBudget(sourceFile: ts.SourceFile, maxAstNodes: number): void {
	let count = 0;
	const stack: ts.Node[] = [sourceFile];
	while (stack.length > 0) {
		const node = stack.pop()!;
		count += 1;
		if (count > maxAstNodes)
			fail('BUDGET_EXHAUSTED', '$source', 'AST nodes exceed the caller budget.');
		node.forEachChild((child) => {
			stack.push(child);
		});
	}
}

function parseStateNames(
	context: ParseContext,
	machineId: StateMachineTopologyMachineId,
	node: ts.Expression,
	path: string
): {
	readonly stateIds: readonly StateMachineTopologyStateId[];
	readonly states: readonly StateMachineTopologyStateRecord[];
} {
	const elements = arrayElements(context, node, path);
	const states: StateMachineTopologyStateRecord[] = [];
	const names = new Set<string>();
	for (const [ordinal, element] of elements.entries()) {
		const name = stringLiteral(context, element, `${path}[${ordinal}]`);
		if (names.has(name))
			fail(
				'MALFORMED_GENERATED_TABLE',
				`${path}[${ordinal}]`,
				'Machine state names must be unique.'
			);
		names.add(name);
		states.push({
			id: stateMachineTopologyStateId(machineId, name),
			initial: false,
			machineId,
			name,
			ordinal,
			span: span(context, element),
			terminal: false
		});
		if (states.length > context.request.budgets.maxStates)
			fail('BUDGET_EXHAUSTED', path, 'State population exceeds the caller budget.');
	}
	return { stateIds: states.map((state) => state.id), states };
}

function parseStateIdList(
	context: ParseContext,
	node: ts.Expression,
	stateByName: ReadonlyMap<string, StateMachineTopologyStateRecord>,
	path: string
): readonly StateMachineTopologyStateId[] {
	const result: StateMachineTopologyStateId[] = [];
	const seen = new Set<string>();
	for (const [index, element] of arrayElements(context, node, path).entries()) {
		const name = stringLiteral(context, element, `${path}[${index}]`);
		const state = stateByName.get(name);
		if (state === undefined)
			fail(
				'MALFORMED_GENERATED_TABLE',
				`${path}[${index}]`,
				'Terminal state is not declared by the machine.'
			);
		if (seen.has(state.id))
			fail('MALFORMED_GENERATED_TABLE', `${path}[${index}]`, 'Terminal states must be unique.');
		seen.add(state.id);
		result.push(state.id);
	}
	return result;
}

function parseLegalTransitions(
	context: ParseContext,
	machineId: StateMachineTopologyMachineId,
	stateByName: ReadonlyMap<string, StateMachineTopologyStateRecord>,
	node: ts.Expression,
	path: string
): readonly StateMachineTopologyLegalTransitionRecord[] {
	const result: StateMachineTopologyLegalTransitionRecord[] = [];
	const keys = new Set<string>();
	for (const [ordinal, element] of arrayElements(context, node, path).entries()) {
		const itemPath = `${path}[${ordinal}]`;
		const properties = objectProperties(
			context,
			element,
			['from', 'guard', 'note', 'to', 'trigger'],
			['from', 'to'],
			itemPath
		);
		const from = stringLiteral(context, properties.get('from')!, `${itemPath}.from`);
		const to = stringLiteral(context, properties.get('to')!, `${itemPath}.to`);
		const fromState = stateByName.get(from);
		const toState = stateByName.get(to);
		if (fromState === undefined || toState === undefined)
			fail(
				'MALFORMED_GENERATED_TABLE',
				itemPath,
				'Legal transition endpoints must be declared machine states.'
			);
		const key = `${from}\0${to}`;
		if (keys.has(key))
			fail('MALFORMED_GENERATED_TABLE', itemPath, 'Legal transition edges must be unique.');
		keys.add(key);
		result.push({
			from,
			fromStateId: fromState.id,
			guard: optionalString(context, properties, 'guard', itemPath),
			id: stateMachineTopologyLegalTransitionId({ from, machineId, ordinal, to }),
			machineId,
			note: optionalString(context, properties, 'note', itemPath),
			ordinal,
			span: span(context, element),
			to,
			toStateId: toState.id,
			trigger: optionalString(context, properties, 'trigger', itemPath)
		});
		context.transitions += 1;
		if (context.transitions > context.request.budgets.maxTransitions)
			fail('BUDGET_EXHAUSTED', itemPath, 'Transition population exceeds the caller budget.');
	}
	return result;
}

function parseDeclaredTransitions(
	context: ParseContext,
	kind: 'explicitly-illegal-transition' | 'guarded-transition',
	machineId: StateMachineTopologyMachineId,
	stateByName: ReadonlyMap<string, StateMachineTopologyStateRecord>,
	node: ts.Expression,
	path: string
): readonly StateMachineTopologyIllegalTransitionRecord[] {
	const result: StateMachineTopologyIllegalTransitionRecord[] = [];
	const keys = new Set<string>();
	for (const [ordinal, element] of arrayElements(context, node, path).entries()) {
		const itemPath = `${path}[${ordinal}]`;
		const properties = objectProperties(
			context,
			element,
			['from', 'reason', 'to'],
			['from', 'to'],
			itemPath
		);
		const from = stringLiteral(context, properties.get('from')!, `${itemPath}.from`);
		const to = stringLiteral(context, properties.get('to')!, `${itemPath}.to`);
		const fromState = stateByName.get(from);
		const toState = stateByName.get(to);
		if (fromState === undefined || toState === undefined)
			fail(
				'MALFORMED_GENERATED_TABLE',
				itemPath,
				'Declared transition endpoints must be machine states.'
			);
		const reason = optionalString(context, properties, 'reason', itemPath);
		const key = `${from}\0${to}\0${reason ?? ''}`;
		if (keys.has(key))
			fail('MALFORMED_GENERATED_TABLE', itemPath, 'Declared transition edges must be unique.');
		keys.add(key);
		result.push({
			from,
			fromStateId: fromState.id,
			id:
				kind === 'guarded-transition'
					? stateMachineTopologyGuardedTransitionId({ from, machineId, ordinal, to })
					: stateMachineTopologyIllegalTransitionId({ from, machineId, ordinal, to }),
			machineId,
			ordinal,
			reason,
			span: span(context, element),
			to,
			toStateId: toState.id
		});
		context.transitions += 1;
		if (context.transitions > context.request.budgets.maxTransitions)
			fail('BUDGET_EXHAUSTED', itemPath, 'Transition population exceeds the caller budget.');
	}
	return result;
}

function parseMachines(
	context: ParseContext,
	initializer: ts.Expression
): {
	readonly explicitlyIllegalTransitions: readonly StateMachineTopologyIllegalTransitionRecord[];
	readonly guardedTransitions: readonly StateMachineTopologyGuardedTransitionRecord[];
	readonly legalTransitions: readonly StateMachineTopologyLegalTransitionRecord[];
	readonly machines: readonly StateMachineTopologyMachineRecord[];
	readonly states: readonly StateMachineTopologyStateRecord[];
} {
	if (!ts.isObjectLiteralExpression(initializer))
		fail(
			'UNSUPPORTED_GENERATED_TABLE',
			'$source.STATE_MACHINES',
			'STATE_MACHINES must be a literal object.'
		);
	const machines: StateMachineTopologyMachineRecord[] = [];
	const states: StateMachineTopologyStateRecord[] = [];
	const legalTransitions: StateMachineTopologyLegalTransitionRecord[] = [];
	const explicitlyIllegalTransitions: StateMachineTopologyIllegalTransitionRecord[] = [];
	const guardedTransitions: StateMachineTopologyGuardedTransitionRecord[] = [];
	const machineNames = new Set<string>();
	for (const [machineOrdinal, property] of initializer.properties.entries()) {
		const machinePath = `$source.STATE_MACHINES[${machineOrdinal}]`;
		if (!ts.isPropertyAssignment(property))
			fail(
				'UNSUPPORTED_GENERATED_TABLE',
				machinePath,
				'Machine entries must be property assignments.'
			);
		const machineName = propertyName(context, property.name, `${machinePath}.key`);
		if (machineNames.has(machineName))
			fail('MALFORMED_GENERATED_TABLE', machinePath, 'Machine keys must be unique.');
		machineNames.add(machineName);
		if (machineNames.size > context.request.budgets.maxMachines)
			fail('BUDGET_EXHAUSTED', machinePath, 'Machine population exceeds the caller budget.');
		const properties = objectProperties(
			context,
			property.initializer,
			[
				'guarded',
				'illegal',
				'initialState',
				'name',
				'sourceSection',
				'states',
				'terminalStates',
				'transitions'
			],
			['guarded', 'illegal', 'initialState', 'name', 'states', 'terminalStates', 'transitions'],
			machinePath
		);
		const declaredName = stringLiteral(context, properties.get('name')!, `${machinePath}.name`);
		if (declaredName !== machineName)
			fail(
				'MALFORMED_GENERATED_TABLE',
				`${machinePath}.name`,
				'Machine key and declared name differ.'
			);
		const machineId = stateMachineTopologyMachineId(context.observationId, machineName);
		const parsedStates = parseStateNames(
			context,
			machineId,
			properties.get('states')!,
			`${machinePath}.states`
		);
		const stateByName = new Map(parsedStates.states.map((state) => [state.name, state]));
		const initialExpression = properties.get('initialState')!;
		const initialState =
			ts.isIdentifier(initialExpression) && initialExpression.text === 'undefined'
				? null
				: stringLiteral(context, initialExpression, `${machinePath}.initialState`);
		if (initialState !== null && !stateByName.has(initialState))
			fail(
				'MALFORMED_GENERATED_TABLE',
				`${machinePath}.initialState`,
				'Initial state is not declared by the machine.'
			);
		const terminalStateIds = parseStateIdList(
			context,
			properties.get('terminalStates')!,
			stateByName,
			`${machinePath}.terminalStates`
		);
		const machineLegal = parseLegalTransitions(
			context,
			machineId,
			stateByName,
			properties.get('transitions')!,
			`${machinePath}.transitions`
		);
		const machineIllegal = parseDeclaredTransitions(
			context,
			'explicitly-illegal-transition',
			machineId,
			stateByName,
			properties.get('illegal')!,
			`${machinePath}.illegal`
		);
		const machineGuarded = parseDeclaredTransitions(
			context,
			'guarded-transition',
			machineId,
			stateByName,
			properties.get('guarded')!,
			`${machinePath}.guarded`
		);
		const legalKeys = new Set(machineLegal.map((edge) => `${edge.fromStateId}\0${edge.toStateId}`));
		const legalByKey = new Map(
			machineLegal.map((edge) => [`${edge.fromStateId}\0${edge.toStateId}`, edge])
		);
		const machineGuardedRecords: StateMachineTopologyGuardedTransitionRecord[] = [];
		for (const edge of machineGuarded) {
			const legal = legalByKey.get(`${edge.fromStateId}\0${edge.toStateId}`);
			if (legal === undefined)
				fail(
					'MALFORMED_GENERATED_TABLE',
					`${machinePath}.guarded`,
					'Every guarded edge must match a legal transition.'
				);
			machineGuardedRecords.push({ ...edge, legalTransitionId: legal.id });
		}
		for (const edge of machineIllegal)
			if (legalKeys.has(`${edge.fromStateId}\0${edge.toStateId}`))
				fail(
					'MALFORMED_GENERATED_TABLE',
					`${machinePath}.illegal`,
					'An explicitly illegal edge cannot also be legal.'
				);
		const terminalStateNames = terminalStateIds.map(
			(id) => parsedStates.states.find((state) => state.id === id)!.name
		);
		const finalStates = parsedStates.states.map((state) => ({
			...state,
			initial: state.name === initialState,
			terminal: terminalStateIds.includes(state.id)
		}));
		machines.push({
			explicitlyIllegalTransitionIds: machineIllegal.map((edge) => edge.id),
			guardedTransitionIds: machineGuardedRecords.map((edge) => edge.id),
			id: machineId,
			initialState,
			legalTransitionIds: machineLegal.map((edge) => edge.id),
			name: machineName,
			sourceSection: optionalString(context, properties, 'sourceSection', machinePath),
			span: span(context, property.initializer),
			stateIds: parsedStates.stateIds,
			terminalStates: terminalStateNames
		});
		states.push(...finalStates);
		legalTransitions.push(...machineLegal);
		explicitlyIllegalTransitions.push(...machineIllegal);
		guardedTransitions.push(...machineGuardedRecords);
	}
	return { explicitlyIllegalTransitions, guardedTransitions, legalTransitions, machines, states };
}

function parseCrossAxisRules(
	context: ParseContext,
	initializer: ts.Expression,
	machineByName: ReadonlyMap<string, StateMachineTopologyMachineRecord>
): readonly StateMachineTopologyCrossAxisRuleRecord[] {
	const rules: StateMachineTopologyCrossAxisRuleRecord[] = [];
	const keys = new Set<string>();
	for (const [ordinal, element] of arrayElements(
		context,
		initializer,
		'$source.CROSS_AXIS_RULES'
	).entries()) {
		const path = `$source.CROSS_AXIS_RULES[${ordinal}]`;
		if (ordinal + 1 > context.request.budgets.maxCrossAxisRules)
			fail('BUDGET_EXHAUSTED', path, 'Cross-axis rule population exceeds the caller budget.');
		const properties = objectProperties(
			context,
			element,
			['from', 'machine', 'reason', 'to'],
			['from', 'machine', 'to'],
			path
		);
		const machineName = stringLiteral(context, properties.get('machine')!, `${path}.machine`);
		const machine = machineByName.get(machineName);
		if (machine === undefined)
			fail(
				'MALFORMED_GENERATED_TABLE',
				`${path}.machine`,
				'Cross-axis rule names an unknown machine.'
			);
		const from = stringLiteral(context, properties.get('from')!, `${path}.from`);
		const to = stringLiteral(context, properties.get('to')!, `${path}.to`);
		const key = `${machineName}\0${from}\0${to}`;
		if (keys.has(key))
			fail('MALFORMED_GENERATED_TABLE', path, 'Cross-axis descriptors must be unique.');
		keys.add(key);
		rules.push({
			from,
			id: stateMachineTopologyCrossAxisRuleId({ from, machineId: machine.id, ordinal, to }),
			machineId: machine.id,
			machineName,
			ordinal,
			reason: optionalString(context, properties, 'reason', path),
			span: span(context, element),
			to
		});
	}
	return rules;
}

function canonical<T extends { readonly id: string }>(values: readonly T[]): readonly T[] {
	return [...values].sort((left, right) => compareText(left.id, right.id));
}

function observe(requestValue: unknown, subjectValue: unknown): StateMachineTopologyObservation {
	const request = closedRequest(requestValue);
	const { bytes } = boundBytes(request, subjectValue);
	const id = stateMachineTopologyObservationId({
		artifact: request.artifact,
		method: STATE_MACHINE_TOPOLOGY_OBSERVATION_METHOD,
		operationVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
		schemaVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_SCHEMA_VERSION,
		subjectId: request.subjectId
	});
	let source: string;
	try {
		source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		fail('MALFORMED_GENERATED_TABLE', '$source', 'Artifact is not strict UTF-8.');
	}
	const sourceFile = ts.createSourceFile(
		request.artifact.path,
		source,
		ts.ScriptTarget.ES2022,
		true,
		ts.ScriptKind.TS
	);
	const parseDiagnostics = (
		sourceFile as ts.SourceFile & { readonly parseDiagnostics?: readonly ts.Diagnostic[] }
	).parseDiagnostics;
	if (parseDiagnostics !== undefined && parseDiagnostics.length > 0)
		fail('MALFORMED_GENERATED_TABLE', '$source', 'TypeScript source contains syntax diagnostics.');
	checkAstBudget(sourceFile, request.budgets.maxAstNodes);
	const context: ParseContext = {
		observationId: id,
		request,
		sourceFile,
		textCharacters: 0,
		transitions: 0
	};
	const parsed = parseMachines(context, parseExport(sourceFile, 'STATE_MACHINES'));
	const crossAxisRules = parseCrossAxisRules(
		context,
		parseExport(sourceFile, 'CROSS_AXIS_RULES'),
		new Map(parsed.machines.map((machine) => [machine.name, machine]))
	);
	const content: Omit<StateMachineTopologyObservation, 'contentDigest'> = {
		artifact: { ...request.artifact, roles: [...request.artifact.roles] },
		budgets: { ...request.budgets },
		coverage: {
			crossAxisRules: crossAxisRules.length,
			explicitlyIllegalTransitions: parsed.explicitlyIllegalTransitions.length,
			guardedTransitions: parsed.guardedTransitions.length,
			legalTransitions: parsed.legalTransitions.length,
			machines: parsed.machines.length,
			reconciles: true,
			states: parsed.states.length
		},
		crossAxisRules: canonical(crossAxisRules),
		explicitlyIllegalTransitions: canonical(parsed.explicitlyIllegalTransitions),
		epistemic: {
			capabilityCoverage: 'PARTIAL',
			conflictState: 'NOT_EVALUATED',
			executionHealth: 'SUCCEEDED',
			freshness: 'SUBJECT_BOUND',
			inferenceState: 'NONE',
			supportBasis: 'DECLARED_GENERATED_TOPOLOGY'
		},
		fullJanCsaa007Conformance: FULL_JAN_CSAA_007_CONFORMANCE,
		fullJanCsaa008Conformance: FULL_JAN_CSAA_008_CONFORMANCE,
		guardedTransitions: canonical(parsed.guardedTransitions),
		id,
		legalTransitions: canonical(parsed.legalTransitions),
		machines: canonical(parsed.machines),
		method: STATE_MACHINE_TOPOLOGY_OBSERVATION_METHOD,
		operationVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
		producer: {
			api: 'PUBLIC_COMPILER_API',
			id: 'typescript',
			version: TYPESCRIPT_PROVIDER_VERSION
		},
		registryStatus: STATE_MACHINE_GRAPH_REGISTRY_STATUS,
		schemaVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_SCHEMA_VERSION,
		scope: STATE_MACHINE_GRAPH_SCOPE,
		states: canonical(parsed.states),
		subjectId: request.subjectId,
		verifierAuthority: STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY
	};
	return { ...content, contentDigest: stateMachineTopologyObservationContentDigest(content) };
}

export function observeStateMachineTopology(
	request: BuildStateMachineTopologyObservationRequest,
	options: { readonly subject: FrozenSubject }
): BuildStateMachineTopologyObservationOutcome {
	try {
		return {
			diagnostics: [],
			observation: observe(request, options?.subject),
			outcome: 'complete'
		};
	} catch (error) {
		return {
			diagnostics: [
				error instanceof ObservationFailure
					? error.diagnostic
					: {
							code: 'MALFORMED_GENERATED_TABLE',
							message: 'State-machine observation failed closed.',
							path: '$',
							phase: 'PARSE'
						}
			],
			outcome: 'unavailable'
		};
	}
}
