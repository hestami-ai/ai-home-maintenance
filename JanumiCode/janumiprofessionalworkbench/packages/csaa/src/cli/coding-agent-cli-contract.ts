import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';

import {
	AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS,
	validateAgentOperationRequest,
	type AgentExitCategory,
	type AgentOperation,
	type AgentOperationRequest,
	type AgentProtocolValidationDiagnostic
} from '../agent/agent-operation-protocol.js';

export const CODING_AGENT_CLI_VERSION = 'jan-csaa-coding-agent-cli/0.1.0' as const;
export const CODING_AGENT_CLI_INPUT_VERSION = 'jan-csaa-coding-agent-cli-input/0.1.0' as const;
export const CODING_AGENT_CLI_INPUT_CONTRACT_ID = 'jan-csaa-coding-agent-cli-input' as const;
export const CODING_AGENT_CLI_IMPLEMENTATION_STATE = 'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;

export const CODING_AGENT_CLI_NONCLAIMS = Object.freeze([
	'This CLI foundation is implementation-local and is not a registered JAN-CSAA capability or package binary.',
	'The foundation validates and routes exact protocol messages but does not itself resolve subjects, execute analysis providers, use the network, execute subject code, mutate source, or activate a gate.',
	'Operation handlers remain explicit root-integration dependencies; an absent handler returns a typed unavailable or unsupported response rather than an empty success.',
	'Only versioned JSON stdout is supported; filesystem output paths and human-output reinterpretations are intentionally unavailable.'
] as const);

export const CODING_AGENT_CLI_SAFETY_CEILINGS = Object.freeze({
	maxArgumentBytes: AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS.maxMessageBytes * 2,
	maxArguments: 7,
	maxProgressResponses: 1_024,
	minTerminalResponseBytes: 262_144
} as const);

export const CODING_AGENT_CLI_EXIT_CODES = Object.freeze({
	FAILED_EXPECTATION: 4,
	INCOMPLETE_OR_UNSUPPORTED: 3,
	INTERNAL_FAILURE: 5,
	INVALID_REQUEST: 2,
	SUCCESS: 0
} as const satisfies Record<Exclude<AgentExitCategory, 'IN_PROGRESS'>, number>);

interface CodingAgentCliInputBase {
	readonly bindingRef: string;
	readonly output: 'STDOUT_JSON';
	readonly schemaVersion: typeof CODING_AGENT_CLI_INPUT_VERSION;
}

export interface CodingAgentCliInventoryInput extends CodingAgentCliInputBase {
	readonly kind: 'INVENTORY';
	readonly subjectInputRef: string;
}

export interface CodingAgentCliSnapshotInput extends CodingAgentCliInputBase {
	readonly kind: 'SNAPSHOT';
	readonly subjectInputRef: string;
}

export interface CodingAgentCliQueryInput extends CodingAgentCliInputBase {
	readonly kind: 'QUERY';
	readonly queryRef: string;
	readonly snapshotRef: string;
}

export interface CodingAgentCliImpactInput extends CodingAgentCliInputBase {
	readonly changeSetRef: string;
	readonly kind: 'IMPACT';
	readonly snapshotRef: string;
}

export interface CodingAgentCliFindingsInput extends CodingAgentCliInputBase {
	readonly kind: 'FINDINGS';
	readonly ruleProfileRef: string;
	readonly snapshotRef: string;
}

export interface CodingAgentCliExplainInput extends CodingAgentCliInputBase {
	readonly explanationProfileRef: string;
	readonly kind: 'EXPLAIN';
	readonly resultRef: string;
}

export interface CodingAgentCliVerifyInput extends CodingAgentCliInputBase {
	readonly expectationRef: string;
	readonly kind: 'VERIFY';
	readonly subjectInputRef: string;
}

export type CodingAgentCliOperationInput =
	| CodingAgentCliExplainInput
	| CodingAgentCliFindingsInput
	| CodingAgentCliImpactInput
	| CodingAgentCliInventoryInput
	| CodingAgentCliQueryInput
	| CodingAgentCliSnapshotInput
	| CodingAgentCliVerifyInput;

export interface CodingAgentCliInvocation {
	readonly cliVersion: typeof CODING_AGENT_CLI_VERSION;
	readonly command: AgentOperation;
	readonly input: CodingAgentCliOperationInput;
	readonly output: 'json';
	readonly request: AgentOperationRequest;
}

export type CodingAgentCliAdmissionCode =
	| 'CLI_ARGUMENT_COUNT_EXCEEDED'
	| 'CLI_ARGUMENT_ENCODING_INVALID'
	| 'CLI_ARGUMENT_SIZE_EXCEEDED'
	| 'CLI_COMMAND_MISSING'
	| 'CLI_COMMAND_UNSUPPORTED'
	| 'CLI_FLAG_DUPLICATE'
	| 'CLI_FLAG_MISSING_VALUE'
	| 'CLI_FLAG_UNSUPPORTED'
	| 'CLI_INPUT_BINDING_MISMATCH'
	| 'CLI_INPUT_INVALID'
	| 'CLI_INPUT_JSON_INVALID'
	| 'CLI_OUTPUT_BUDGET_TOO_SMALL'
	| 'CLI_OUTPUT_UNSUPPORTED'
	| 'CLI_REFERENCE_UNSAFE'
	| 'CLI_REQUEST_INVALID'
	| 'CLI_REQUEST_JSON_INVALID';

export interface CodingAgentCliAdmissionDiagnostic {
	readonly cliVersion: typeof CODING_AGENT_CLI_VERSION;
	readonly code: CodingAgentCliAdmissionCode;
	readonly messageKind: 'cli-diagnostic';
	readonly safeSummary: string;
	readonly severity: 'error';
}

export type CodingAgentCliAdmissionOutcome =
	| { readonly invocation: CodingAgentCliInvocation; readonly state: 'ADMITTED' }
	| { readonly diagnostic: CodingAgentCliAdmissionDiagnostic; readonly state: 'REFUSED' };

export type CodingAgentCliInputDigestOutcome =
	| {
			readonly digest: string;
			readonly input: CodingAgentCliOperationInput;
			readonly state: 'VALID';
	  }
	| { readonly diagnostic: CodingAgentCliAdmissionDiagnostic; readonly state: 'REFUSED' };

const COMMANDS = new Set<AgentOperation>([
	'explain',
	'findings',
	'impact',
	'inventory',
	'query',
	'snapshot',
	'verify'
]);
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._~:/@#-]*$/u;
const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/u;
const ABSOLUTE_OR_PARENT_PATH = /(?:^|[\\/])\.\.(?:[\\/]|$)/u;
const FILE_URI = /^file:/iu;
const MAX_REFERENCE_CHARACTERS = 1_024;

class AdmissionRefusal extends Error {
	readonly code: CodingAgentCliAdmissionCode;

	constructor(code: CodingAgentCliAdmissionCode, safeSummary: string) {
		super(safeSummary);
		this.code = code;
	}
}

interface InspectedObject {
	readonly values: ReadonlyMap<string, unknown>;
}

function refuse(code: CodingAgentCliAdmissionCode, safeSummary: string): never {
	throw new AdmissionRefusal(code, safeSummary);
}

function diagnostic(
	code: CodingAgentCliAdmissionCode,
	safeSummary: string
): CodingAgentCliAdmissionDiagnostic {
	return Object.freeze({
		cliVersion: CODING_AGENT_CLI_VERSION,
		code,
		messageKind: 'cli-diagnostic',
		safeSummary,
		severity: 'error'
	});
}

function isUnicodeScalarString(text: string): boolean {
	for (let index = 0; index < text.length; index += 1) {
		const code = text.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = text.charCodeAt(index + 1);
			if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) return false;
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff) return false;
	}
	return true;
}

function inspectObject(value: unknown, safeSummary: string): InspectedObject {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		refuse('CLI_INPUT_INVALID', safeSummary);
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		refuse('CLI_INPUT_INVALID', safeSummary);
	const values = new Map<string, unknown>();
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== 'string') refuse('CLI_INPUT_INVALID', safeSummary);
		const property = Reflect.getOwnPropertyDescriptor(value, key);
		if (property === undefined || !property.enumerable || !('value' in property))
			refuse('CLI_INPUT_INVALID', safeSummary);
		values.set(key, property.value);
	}
	return { values };
}

function exactKeys(inspected: InspectedObject, keys: readonly string[]): void {
	if (inspected.values.size !== keys.length)
		refuse('CLI_INPUT_INVALID', 'The CLI operation input has an open or incomplete shape.');
	for (const key of keys)
		if (!inspected.values.has(key))
			refuse('CLI_INPUT_INVALID', 'The CLI operation input has an open or incomplete shape.');
}

function requiredLiteral<Value extends string>(
	inspected: InspectedObject,
	key: string,
	expected: Value
): Value {
	if (inspected.values.get(key) !== expected)
		refuse('CLI_INPUT_INVALID', `The CLI operation input ${key} is invalid.`);
	return expected;
}

function requiredReference(inspected: InspectedObject, key: string): string {
	const value = inspected.values.get(key);
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > MAX_REFERENCE_CHARACTERS ||
		!isUnicodeScalarString(value)
	)
		refuse('CLI_INPUT_INVALID', 'A CLI operation-input reference is invalid.');
	assertReferenceNotPath(value);
	if (!REFERENCE.test(value))
		refuse('CLI_INPUT_INVALID', 'A CLI operation-input reference is invalid.');
	return value;
}

function assertReferenceNotPath(value: string): void {
	if (
		value.startsWith('/') ||
		value.startsWith('\\') ||
		WINDOWS_ABSOLUTE_PATH.test(value) ||
		ABSOLUTE_OR_PARENT_PATH.test(value) ||
		FILE_URI.test(value) ||
		value.includes('\\')
	)
		refuse(
			'CLI_REFERENCE_UNSAFE',
			'The CLI accepts opaque evidence references, not filesystem paths or traversal.'
		);
}

function base(inspected: InspectedObject) {
	return {
		bindingRef: requiredReference(inspected, 'bindingRef'),
		output: requiredLiteral(inspected, 'output', 'STDOUT_JSON'),
		schemaVersion: requiredLiteral(inspected, 'schemaVersion', CODING_AGENT_CLI_INPUT_VERSION)
	};
}

function materializeInput(value: unknown): CodingAgentCliOperationInput {
	const inspected = inspectObject(value, 'The CLI operation input is invalid.');
	const kind = inspected.values.get('kind');
	switch (kind) {
		case 'INVENTORY':
		case 'SNAPSHOT': {
			exactKeys(inspected, ['bindingRef', 'kind', 'output', 'schemaVersion', 'subjectInputRef']);
			return Object.freeze({
				...base(inspected),
				kind,
				subjectInputRef: requiredReference(inspected, 'subjectInputRef')
			});
		}
		case 'QUERY':
			exactKeys(inspected, [
				'bindingRef',
				'kind',
				'output',
				'queryRef',
				'schemaVersion',
				'snapshotRef'
			]);
			return Object.freeze({
				...base(inspected),
				kind,
				queryRef: requiredReference(inspected, 'queryRef'),
				snapshotRef: requiredReference(inspected, 'snapshotRef')
			});
		case 'IMPACT':
			exactKeys(inspected, [
				'bindingRef',
				'changeSetRef',
				'kind',
				'output',
				'schemaVersion',
				'snapshotRef'
			]);
			return Object.freeze({
				...base(inspected),
				changeSetRef: requiredReference(inspected, 'changeSetRef'),
				kind,
				snapshotRef: requiredReference(inspected, 'snapshotRef')
			});
		case 'FINDINGS':
			exactKeys(inspected, [
				'bindingRef',
				'kind',
				'output',
				'ruleProfileRef',
				'schemaVersion',
				'snapshotRef'
			]);
			return Object.freeze({
				...base(inspected),
				kind,
				ruleProfileRef: requiredReference(inspected, 'ruleProfileRef'),
				snapshotRef: requiredReference(inspected, 'snapshotRef')
			});
		case 'EXPLAIN':
			exactKeys(inspected, [
				'bindingRef',
				'explanationProfileRef',
				'kind',
				'output',
				'resultRef',
				'schemaVersion'
			]);
			return Object.freeze({
				...base(inspected),
				explanationProfileRef: requiredReference(inspected, 'explanationProfileRef'),
				kind,
				resultRef: requiredReference(inspected, 'resultRef')
			});
		case 'VERIFY':
			exactKeys(inspected, [
				'bindingRef',
				'expectationRef',
				'kind',
				'output',
				'schemaVersion',
				'subjectInputRef'
			]);
			return Object.freeze({
				...base(inspected),
				expectationRef: requiredReference(inspected, 'expectationRef'),
				kind,
				subjectInputRef: requiredReference(inspected, 'subjectInputRef')
			});
		default:
			refuse('CLI_INPUT_INVALID', 'The CLI operation input kind is unsupported.');
	}
}

function canonicalJson(value: unknown): string {
	if (value === null) return 'null';
	if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) throw new Error('Non-finite canonical JSON number.');
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	if (typeof value !== 'object') throw new Error('Unsupported canonical JSON value.');
	return `{${Object.keys(value)
		.sort()
		.map(
			(key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`
		)
		.join(',')}}`;
}

function sha256(text: string): string {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

function deeplyAssertNoFilesystemPath(value: unknown): void {
	const pending: unknown[] = [value];
	while (pending.length > 0) {
		const current = pending.pop();
		if (typeof current === 'string') {
			assertReferenceNotPath(current);
			continue;
		}
		if (Array.isArray(current)) {
			pending.push(...current);
			continue;
		}
		if (current !== null && typeof current === 'object') pending.push(...Object.values(current));
	}
}

function inputOperation(input: CodingAgentCliOperationInput): AgentOperation {
	return input.kind.toLowerCase() as AgentOperation;
}

function parseJson(text: string, code: CodingAgentCliAdmissionCode, safeSummary: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return refuse(code, safeSummary);
	}
}

function admissionOutcome(
	operation: () => CodingAgentCliInvocation
): CodingAgentCliAdmissionOutcome {
	try {
		return Object.freeze({ invocation: operation(), state: 'ADMITTED' as const });
	} catch (error) {
		const refusal =
			error instanceof AdmissionRefusal
				? diagnostic(error.code, error.message)
				: diagnostic(
						'CLI_INPUT_INVALID',
						'The CLI request could not be admitted without exposing internal exception text.'
					);
		return Object.freeze({ diagnostic: refusal, state: 'REFUSED' as const });
	}
}

function requestRefusalSummary(diagnosticValue: AgentProtocolValidationDiagnostic): string {
	return diagnosticValue.code === 'BUDGET_REFUSED'
		? 'The agent request exceeds a protocol resource ceiling.'
		: 'The agent operation request is invalid or incompatible.';
}

function materializeArguments(value: unknown): readonly string[] {
	if (value === null || typeof value !== 'object' || isProxy(value) || !Array.isArray(value))
		refuse('CLI_ARGUMENT_ENCODING_INVALID', 'The CLI argument vector is invalid.');
	if (Object.getPrototypeOf(value) !== Array.prototype)
		refuse('CLI_ARGUMENT_ENCODING_INVALID', 'The CLI argument vector is invalid.');
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	if (
		lengthDescriptor === undefined ||
		!('value' in lengthDescriptor) ||
		typeof lengthDescriptor.value !== 'number' ||
		!Number.isSafeInteger(lengthDescriptor.value) ||
		lengthDescriptor.value < 0
	)
		refuse('CLI_ARGUMENT_ENCODING_INVALID', 'The CLI argument vector is invalid.');
	const length = lengthDescriptor.value;
	const result: string[] = [];
	for (let index = 0; index < length; index += 1) {
		const property = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (
			property === undefined ||
			!property.enumerable ||
			!('value' in property) ||
			typeof property.value !== 'string'
		)
			refuse('CLI_ARGUMENT_ENCODING_INVALID', 'The CLI argument vector is invalid.');
		result.push(property.value);
	}
	if (
		Reflect.ownKeys(value).some(
			(key) =>
				typeof key !== 'string' ||
				(key !== 'length' && !/^\d+$/u.test(key)) ||
				(key !== 'length' && String(Number(key)) !== key) ||
				(key !== 'length' && Number(key) >= length)
		)
	)
		refuse('CLI_ARGUMENT_ENCODING_INVALID', 'The CLI argument vector is invalid.');
	return Object.freeze(result);
}

export function codingAgentCliInputDigest(value: unknown): CodingAgentCliInputDigestOutcome {
	try {
		const input = materializeInput(value);
		return Object.freeze({ digest: sha256(canonicalJson(input)), input, state: 'VALID' as const });
	} catch (error) {
		const refusal =
			error instanceof AdmissionRefusal
				? diagnostic(error.code, error.message)
				: diagnostic('CLI_INPUT_INVALID', 'The CLI operation input is invalid.');
		return Object.freeze({ diagnostic: refusal, state: 'REFUSED' as const });
	}
}

/**
 * Admits the exact argv grammar:
 * `<command> --request-json <AgentOperationRequest> --input-json <CodingAgentCliOperationInput> --output json`.
 * Flag order is immaterial; duplication and undeclared positional/flag input fail closed.
 */
export function admitCodingAgentCliArguments(
	argv: readonly string[]
): CodingAgentCliAdmissionOutcome {
	return admissionOutcome(() => {
		const argumentsValue = materializeArguments(argv);
		if (argumentsValue.length === 0)
			refuse('CLI_COMMAND_MISSING', 'A CSAA CLI command is required.');
		if (argumentsValue.length > CODING_AGENT_CLI_SAFETY_CEILINGS.maxArguments)
			refuse('CLI_ARGUMENT_COUNT_EXCEEDED', 'The CLI argument-count ceiling was exceeded.');
		let argumentBytes = 0;
		for (const argument of argumentsValue) {
			if (
				typeof argument !== 'string' ||
				!isUnicodeScalarString(argument) ||
				argument.includes('\0')
			)
				refuse('CLI_ARGUMENT_ENCODING_INVALID', 'A CLI argument has invalid text encoding.');
			argumentBytes += Buffer.byteLength(argument, 'utf8');
		}
		if (argumentBytes > CODING_AGENT_CLI_SAFETY_CEILINGS.maxArgumentBytes)
			refuse('CLI_ARGUMENT_SIZE_EXCEEDED', 'The CLI argument byte ceiling was exceeded.');

		const commandValue = argumentsValue[0];
		if (!COMMANDS.has(commandValue as AgentOperation))
			refuse('CLI_COMMAND_UNSUPPORTED', 'The requested CSAA CLI command is unsupported.');
		const command = commandValue as AgentOperation;
		const flags = new Map<string, string>();
		for (let index = 1; index < argumentsValue.length; index += 2) {
			const flag = argumentsValue[index];
			const value = argumentsValue[index + 1];
			if (flag === undefined || !flag.startsWith('--'))
				refuse('CLI_FLAG_UNSUPPORTED', 'The CLI accepts only declared named flags.');
			if (value === undefined)
				refuse('CLI_FLAG_MISSING_VALUE', 'A declared CLI flag is missing its value.');
			if (flag !== '--request-json' && flag !== '--input-json' && flag !== '--output')
				refuse('CLI_FLAG_UNSUPPORTED', 'The CLI flag is unsupported.');
			if (flags.has(flag)) refuse('CLI_FLAG_DUPLICATE', 'A CLI flag was supplied more than once.');
			flags.set(flag, value);
		}
		const requestJson = flags.get('--request-json');
		const inputJson = flags.get('--input-json');
		const output = flags.get('--output');
		if (requestJson === undefined || inputJson === undefined || output === undefined)
			refuse('CLI_FLAG_MISSING_VALUE', 'The request, input, and output flags are required.');
		if (output !== 'json')
			refuse('CLI_OUTPUT_UNSUPPORTED', 'Only deterministic JSON stdout is supported.');
		const requestCandidate = parseJson(
			requestJson,
			'CLI_REQUEST_JSON_INVALID',
			'The agent request JSON is malformed.'
		);
		const requestOutcome = validateAgentOperationRequest(requestCandidate);
		if (requestOutcome.state !== 'VALID')
			refuse('CLI_REQUEST_INVALID', requestRefusalSummary(requestOutcome.diagnostic));
		const request = requestOutcome.value;
		if (request.budgets.maxOutputBytes < CODING_AGENT_CLI_SAFETY_CEILINGS.minTerminalResponseBytes)
			refuse(
				'CLI_OUTPUT_BUDGET_TOO_SMALL',
				'The output budget cannot safely carry one closed terminal response envelope.'
			);
		deeplyAssertNoFilesystemPath(request);
		const inputCandidate = parseJson(
			inputJson,
			'CLI_INPUT_JSON_INVALID',
			'The CLI operation-input JSON is malformed.'
		);
		const input = materializeInput(inputCandidate);
		const inputDigest = sha256(canonicalJson(input));
		if (
			request.operation !== command ||
			inputOperation(input) !== command ||
			request.operationInput.contractId !== CODING_AGENT_CLI_INPUT_CONTRACT_ID ||
			request.operationInput.contractVersion !== CODING_AGENT_CLI_INPUT_VERSION ||
			request.operationInput.inputRef !== input.bindingRef ||
			request.operationInput.inputDigest !== inputDigest
		)
			refuse(
				'CLI_INPUT_BINDING_MISMATCH',
				'The command, request, and operation-input content binding do not reconcile.'
			);
		return Object.freeze({
			cliVersion: CODING_AGENT_CLI_VERSION,
			command,
			input,
			output: 'json' as const,
			request
		});
	});
}

export function codingAgentCliExitCode(
	exitCategory: Exclude<AgentExitCategory, 'IN_PROGRESS'>
): (typeof CODING_AGENT_CLI_EXIT_CODES)[Exclude<AgentExitCategory, 'IN_PROGRESS'>] {
	return CODING_AGENT_CLI_EXIT_CODES[exitCategory];
}

export function serializeCodingAgentCliDiagnostic(
	value: CodingAgentCliAdmissionDiagnostic
): string {
	return `${canonicalJson(value)}\n`;
}
