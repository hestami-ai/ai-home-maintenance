import { Ajv, type AnySchema, type ErrorObject, type ValidateFunction } from 'ajv';

import type { DependencyCruiserNormalizationDiagnostic } from '../../contracts/dependency-cruiser.js';
import { sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJson } from '../../semantic/canonical.js';
import dependencyCruiserRawWireSchema from './schema/cruise-result-16.10.4.schema.json' with { type: 'json' };

export const DEPENDENCY_CRUISER_RAW_WIRE_SCHEMA_PROVIDER_VERSION = '16.10.4' as const;
export const DEPENDENCY_CRUISER_RAW_WIRE_SCHEMA_DRAFT =
	'http://json-schema.org/draft-07/schema#' as const;
export const DEPENDENCY_CRUISER_RAW_WIRE_SCHEMA_ID =
	'https://dependency-cruiser.js.org/schema/cruise-result.schema.json' as const;
export const DEPENDENCY_CRUISER_RAW_WIRE_SCHEMA_CANONICAL_SHA256 =
	'fdb1187167190cee9f618ba8c8529de6201e22f720b9ad836e4f4ecf60972153' as const;

const MAX_DIAGNOSTIC_PATH_LENGTH = 512;
const VALID_RESULT = { state: 'VALID' } as const;

export type DependencyCruiserRawWireSchemaValidationResult =
	| typeof VALID_RESULT
	| {
			readonly diagnostic: DependencyCruiserNormalizationDiagnostic;
			readonly state: 'INVALID';
	  };

export class DependencyCruiserRawWireSchemaError extends Error {
	readonly diagnostic: DependencyCruiserNormalizationDiagnostic;

	constructor(diagnostic: DependencyCruiserNormalizationDiagnostic) {
		super(diagnostic.message);
		this.name = 'DependencyCruiserRawWireSchemaError';
		this.diagnostic = diagnostic;
	}
}

let compiledValidator: ValidateFunction<unknown> | undefined;

function assertPinnedSchemaIdentity(): void {
	const schema = dependencyCruiserRawWireSchema as Record<string, unknown>;
	const canonicalDigest = sha256(canonicalSemanticJson(schema));
	if (
		schema.$schema !== DEPENDENCY_CRUISER_RAW_WIRE_SCHEMA_DRAFT ||
		schema.$id !== DEPENDENCY_CRUISER_RAW_WIRE_SCHEMA_ID ||
		canonicalDigest !== DEPENDENCY_CRUISER_RAW_WIRE_SCHEMA_CANONICAL_SHA256
	)
		throw new Error('Vendored dependency-cruiser 16.10.4 raw schema identity mismatch.');
}

function getCompiledValidator(): ValidateFunction<unknown> {
	if (compiledValidator !== undefined) return compiledValidator;
	assertPinnedSchemaIdentity();
	const ajv = new Ajv({
		allErrors: false,
		coerceTypes: false,
		messages: false,
		ownProperties: true,
		removeAdditional: false,
		strict: true,
		unicodeRegExp: true,
		useDefaults: false,
		verbose: false
	});
	const validator = ajv.compile<unknown>(dependencyCruiserRawWireSchema as AnySchema);
	compiledValidator = validator;
	return validator;
}

function diagnosticPath(instancePath: string): string {
	const path = `$raw${instancePath}`;
	return path.length <= MAX_DIAGNOSTIC_PATH_LENGTH ? path : '$raw';
}

function invalidResult(
	error: ErrorObject | undefined
): DependencyCruiserRawWireSchemaValidationResult {
	const keyword = error?.keyword ?? 'validation';
	return {
		diagnostic: {
			code: 'RAW_SHAPE_INVALID',
			message: `dependency-cruiser 16.10.4 raw schema violation (${keyword}).`,
			path: diagnosticPath(error?.instancePath ?? '')
		},
		state: 'INVALID'
	};
}

/**
 * Validates a parsed, caller-budgeted dependency-cruiser JSON value against the exact
 * dependency-cruiser 16.10.4 cruise-result schema. Ajv compilation is lazy and cached.
 */
export function validateDependencyCruiserRawWireSchema(
	value: unknown
): DependencyCruiserRawWireSchemaValidationResult {
	const validator = getCompiledValidator();
	return validator(value) ? VALID_RESULT : invalidResult(validator.errors?.[0]);
}

/** Throws a bounded, non-data-bearing error when the parsed raw value violates the pinned schema. */
export function assertDependencyCruiserRawWireSchema(
	value: unknown
): asserts value is Record<string, unknown> {
	const result = validateDependencyCruiserRawWireSchema(value);
	if (result.state === 'INVALID') throw new DependencyCruiserRawWireSchemaError(result.diagnostic);
}
