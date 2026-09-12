import { isProxy } from 'node:util/types';

import {
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
	type ArrowCommandCensusObservation,
	type ArrowCommandCensusValidationIssue,
	type ArrowCommandCensusValidationIssueCode,
	type ArrowCommandCensusValidationOptions,
	type ArrowCommandCensusValidationResult
} from '../../contracts/arrow-command-census.js';
import type { FrozenSubject } from '../../contracts/subject.js';
import { canonicalSemanticJson } from '../../semantic/canonical.js';
import { validateArrowCommandCensusArtifactSet } from './artifact-set.js';
import {
	ArrowCommandCensusNormalizationError,
	normalizeArrowCommandCensusObservation
} from './normalize-arrow-command-census.js';

class InvalidObservation extends Error {
	constructor(readonly issue: ArrowCommandCensusValidationIssue) {
		super(issue.message);
	}
}

function invalid(
	code: ArrowCommandCensusValidationIssueCode,
	path: string,
	message: string
): never {
	throw new InvalidObservation({ code, message, path });
}

function validateOptions(options: ArrowCommandCensusValidationOptions | undefined): number {
	if (options === undefined) return Number.MAX_SAFE_INTEGER;
	try {
		if (
			options === null ||
			typeof options !== 'object' ||
			Array.isArray(options) ||
			Reflect.getPrototypeOf(options) !== Object.prototype ||
			Reflect.ownKeys(options).some((key) => key !== 'maxIssues')
		)
			invalid('INVALID_SHAPE', '$options', 'Validation options must be an exact plain record.');
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'maxIssues');
		if (descriptor === undefined) return Number.MAX_SAFE_INTEGER;
		const maximum = 'value' in descriptor ? descriptor.value : undefined;
		if (!descriptor.enumerable || !Number.isSafeInteger(maximum) || (maximum as number) < 1)
			invalid(
				'INVALID_VALUE',
				'$options.maxIssues',
				'maxIssues must be a positive safe integer reporting budget.'
			);
		return maximum as number;
	} catch (error) {
		if (error instanceof InvalidObservation) throw error;
		invalid('INVALID_SHAPE', '$options', 'Validation options are hostile or malformed.');
	}
}

function assertPlainContainer(current: object): void {
	if (isProxy(current)) invalid('INVALID_SHAPE', '$', 'Observation contains a Proxy value.');
	const prototype = Reflect.getPrototypeOf(current);
	if (
		(Array.isArray(current) && prototype !== Array.prototype) ||
		(!Array.isArray(current) && prototype !== Object.prototype && prototype !== null)
	)
		invalid('INVALID_SHAPE', '$', 'Observation containers must be plain JSON containers.');
}

function pushOwnDataValues(stack: unknown[], current: object): void {
	for (const key of Reflect.ownKeys(current)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
		if (descriptor === undefined || !('value' in descriptor))
			invalid('INVALID_SHAPE', '$', 'Observation must contain data properties only.');
		if (key !== 'length') stack.push(descriptor.value);
	}
}

function assertPlainDataGraph(value: unknown): void {
	const stack: unknown[] = [value];
	const seen = new Set<object>();
	while (stack.length > 0) {
		const current = stack.pop();
		if (current === null || typeof current !== 'object') continue;
		if (seen.has(current)) continue;
		seen.add(current);
		assertPlainContainer(current);
		pushOwnDataValues(stack, current);
	}
}

function canonicalizeOrRefuse(value: unknown, message: string): string {
	try {
		return canonicalSemanticJson(value);
	} catch {
		invalid('INVALID_SHAPE', '$', message);
	}
}

function assertArtifactSetReproduces(
	observation: ArrowCommandCensusObservation,
	subject: FrozenSubject | undefined
): void {
	const artifactSetValidation = validateArrowCommandCensusArtifactSet(
		observation.artifactSet,
		subject,
		{ maxIssues: 1 }
	);
	if (artifactSetValidation.state === 'VALID') return;
	invalid(
		artifactSetValidation.issues[0]?.code === 'CONTENT_DIGEST_MISMATCH'
			? 'CONTENT_DIGEST_MISMATCH'
			: 'POPULATION_MISMATCH',
		'$.artifactSet',
		artifactSetValidation.issues[0]?.message ?? 'Artifact-set validation failed.'
	);
}

function rebuildObservation(
	observation: ArrowCommandCensusObservation
): ArrowCommandCensusObservation {
	try {
		return normalizeArrowCommandCensusObservation({
			artifactSet: observation.artifactSet,
			evidence: observation.rawEvidence,
			executor: observation.executor,
			request: {
				artifactSetId: observation.artifactSet.id,
				budgets: observation.budgets,
				operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
				schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
				subjectId: observation.subjectId
			}
		}).observation;
	} catch (error) {
		if (error instanceof ArrowCommandCensusNormalizationError)
			invalid('RECONCILIATION_MISMATCH', error.path, error.message);
		invalid('INVALID_SHAPE', '$', 'Observation reconstruction failed closed.');
	}
}

function assertObservationReconciles(
	observation: ArrowCommandCensusObservation,
	rebuilt: ArrowCommandCensusObservation,
	actualCanonical: string,
	expectedCanonical: string
): void {
	if (actualCanonical === expectedCanonical) return;
	if (observation.id !== rebuilt.id)
		invalid('IDENTITY_MISMATCH', '$.id', 'Observation identity does not reproduce.');
	if (observation.contentDigest !== rebuilt.contentDigest)
		invalid(
			'CONTENT_DIGEST_MISMATCH',
			'$.contentDigest',
			'Observation content digest does not reproduce.'
		);
	invalid(
		'RECONCILIATION_MISMATCH',
		'$',
		'Observation differs from the canonical projection of its bound evidence.'
	);
}

function validateInternal(value: unknown, subject?: FrozenSubject): void {
	assertPlainDataGraph(value);
	const actualCanonical = canonicalizeOrRefuse(
		value,
		'Observation is not a canonicalizable plain-data semantic value.'
	);
	const observation = value as ArrowCommandCensusObservation;
	assertArtifactSetReproduces(observation, subject);
	const rebuilt = rebuildObservation(observation);
	const expectedCanonical = canonicalizeOrRefuse(
		rebuilt,
		'Reconstructed observation is not canonicalizable.'
	);
	assertObservationReconciles(observation, rebuilt, actualCanonical, expectedCanonical);
}

export function validateArrowCommandCensusObservation(
	observation: unknown,
	subject?: FrozenSubject,
	options?: ArrowCommandCensusValidationOptions
): ArrowCommandCensusValidationResult {
	let maximum = 1;
	try {
		maximum = validateOptions(options);
		validateInternal(observation, subject);
		return { issues: [], state: 'VALID' };
	} catch (error) {
		const issue: ArrowCommandCensusValidationIssue =
			error instanceof InvalidObservation
				? error.issue
				: {
						code: 'INVALID_SHAPE',
						message: 'Observation validation failed closed on a hostile value.',
						path: '$'
					};
		return {
			issues: [issue].slice(0, maximum),
			state: maximum < 1 ? 'BUDGET_EXHAUSTED' : 'INVALID'
		};
	}
}
