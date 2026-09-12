import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { sha256 } from '../../inventory/canonical.js';
import {
	ADVANCED_CPG_PROVIDER_DISCOVERY_COMMANDS,
	ADVANCED_CPG_PROVIDER_ENTRY_OPERATION_VERSION,
	ADVANCED_CPG_PROVIDER_ENTRY_REQUEST_SCHEMA_VERSION,
	assessAdvancedCpgProviderEntry,
	type AdvancedCpgProviderEntryRequest,
	type AdvancedCpgProviderQualificationEvidence,
	validateAdvancedCpgProviderDisposition
} from './assess-advanced-cpg-provider-entry.js';

function unavailableCheck(provider: 'CODEQL' | 'JOERN') {
	return {
		availability: 'UNAVAILABLE' as const,
		commandName: provider === 'CODEQL' ? ('codeql' as const) : ('joern' as const),
		exactCommand: ADVANCED_CPG_PROVIDER_DISCOVERY_COMMANDS[provider],
		provider,
		resolutionKind: null,
		resolvedExecutablePath: null
	};
}

function availableCodeqlCheck() {
	return {
		availability: 'AVAILABLE' as const,
		commandName: 'codeql' as const,
		exactCommand: ADVANCED_CPG_PROVIDER_DISCOVERY_COMMANDS.CODEQL,
		provider: 'CODEQL' as const,
		resolutionKind: 'APPLICATION' as const,
		resolvedExecutablePath: 'C:/tools/codeql.exe'
	};
}

function request(
	overrides: Partial<AdvancedCpgProviderEntryRequest> = {}
): AdvancedCpgProviderEntryRequest {
	return {
		budgets: {
			maxFactCount: 10_000,
			maxInputBytes: 250_000,
			maxOutputBytes: 250_000,
			maxStringCharacters: 20_000
		},
		checkedAt: '2026-08-25T06:13:14.968Z',
		commandChecks: [unavailableCheck('CODEQL'), unavailableCheck('JOERN')],
		environment: { environmentId: 'jpwb-csaa-win32-path-20260825', platform: 'win32' },
		nativeNeed: {
			capabilityId: 'JAN-CSAA-W4-DWP-009',
			rationale:
				'No available advanced CPG command can be measured under the authorized local-only profile.',
			state: 'UNKNOWN'
		},
		operationVersion: ADVANCED_CPG_PROVIDER_ENTRY_OPERATION_VERSION,
		providerPreference: ['CODEQL', 'JOERN'],
		qualification: null,
		schemaVersion: ADVANCED_CPG_PROVIDER_ENTRY_REQUEST_SCHEMA_VERSION,
		...overrides
	};
}

function qualifyingEvidence(): AdvancedCpgProviderQualificationEvidence {
	const queryText = 'from DataFlow::PathNode source select source';
	const notes = 'Mapped a named provider path node to the normalized CSAA finding location.';
	return {
		comparison: {
			corroboratedFactCount: 2,
			falseNegativeCount: 0,
			falsePositiveCount: 0,
			handCheckedNegativeExpectedCount: 1,
			handCheckedNegativeReportedCount: 0,
			handCheckedPositiveDetectedCount: 1,
			handCheckedPositiveExpectedCount: 1,
			incrementalBehavior: 'MATCHES_CLEAN',
			nativeFactCount: 2,
			operationsFit: 'BOUNDED_LOCAL',
			provenance: 'EXACT_SOURCE_LOCATION_AND_QUERY_ID',
			providerFactCount: 3,
			providerUniqueTruePositiveCount: 1,
			reproducibility: 'IDENTICAL_BOUNDED_RERUN',
			unknownCount: 0
		},
		provider: 'CODEQL',
		providerVersion: '2.20.0',
		query: {
			language: 'ql',
			queryId: 'jpwb/taint-path-gap',
			querySha256: sha256(queryText),
			queryText
		},
		result: {
			durationMilliseconds: 4210,
			exitCode: 0,
			resultSha256: 'a'.repeat(64),
			state: 'COMPLETED'
		},
		setup: {
			installationPerformed: false,
			networkUsed: false,
			setupDescription: 'Used the already-resolved local executable without configuration changes.',
			systemConfigurationChanged: false,
			uploadPerformed: false
		},
		subject: {
			artifactCount: 50,
			root: 'packages/rph-domain',
			subjectId: 'subject:packages/rph-domain@abc',
			subjectSha256: 'b'.repeat(64)
		},
		translation: {
			notes,
			state: 'HAND_CHECKED',
			translationSha256: sha256(notes)
		}
	};
}

function availableRequest(
	qualification: AdvancedCpgProviderQualificationEvidence | null = null
): AdvancedCpgProviderEntryRequest {
	return request({
		commandChecks: [availableCodeqlCheck(), unavailableCheck('JOERN')],
		nativeNeed: {
			capabilityId: 'CAP-TAINT-PATH',
			rationale: 'A bounded native taint-path gap was measured on the named package slice.',
			state: 'HIGH_VALUE_NATIVE_GAP'
		},
		qualification
	});
}

describe('advanced CPG provider entry predicate and disposition', () => {
	it('reconstructs the checked-in local unavailable-provider disposition evidence', () => {
		const evidence = JSON.parse(
			readFileSync(
				resolve(
					process.cwd(),
					'verif/csaa/experimental/dwp-009.local-provider-disposition.evidence.json'
				),
				'utf8'
			)
		) as { request: unknown; result: unknown };
		expect(validateAdvancedCpgProviderDisposition(evidence.request, evidence.result)).toBe(true);
		expect(assessAdvancedCpgProviderEntry(evidence.request)).toEqual(evidence.result);
	});

	it('validly defers when exact read-only command checks find neither provider', () => {
		const input = request();
		const first = assessAdvancedCpgProviderEntry(input);
		const second = assessAdvancedCpgProviderEntry(structuredClone(input));
		expect(first).toEqual(second);
		expect(first).toMatchObject({
			analysisAuthority: 'NONE',
			disposition: 'DEFER',
			entryPredicate: {
				needState: 'UNKNOWN',
				providerAvailability: 'UNAVAILABLE',
				qualificationState: 'NOT_PERFORMED',
				state: 'DEFERRED'
			},
			gateEffect: 'NONE',
			nativeCsaaDependency: 'INDEPENDENT',
			reasons: ['NO_PROVIDER_AVAILABLE'],
			selectedProvider: null
		});
		expect(first.commandChecks).toEqual(input.commandChecks);
		expect(Object.isFrozen(first)).toBe(true);
		expect(Object.isFrozen(first.commandChecks)).toBe(true);
		expect(validateAdvancedCpgProviderDisposition(input, first)).toBe(true);
	});

	it('rejects entry when there is explicitly no current need', () => {
		const result = assessAdvancedCpgProviderEntry(
			request({
				nativeNeed: {
					capabilityId: 'CAP-TAINT',
					rationale: 'Native closure passed.',
					state: 'NO_CURRENT_NEED'
				}
			})
		);
		expect(result).toMatchObject({
			disposition: 'REJECT_FOR_CURRENT_NEED',
			reasons: ['NO_PROVEN_ENTRY_NEED']
		});
	});

	it('defers an available provider until a bounded qualification is recorded', () => {
		const result = assessAdvancedCpgProviderEntry(availableRequest());
		expect(result).toMatchObject({
			disposition: 'DEFER',
			reasons: ['QUALIFICATION_NOT_PERFORMED'],
			selectedProvider: 'CODEQL'
		});
	});

	it('adopts only after all discriminating, operational, and reproducibility predicates pass', () => {
		const input = availableRequest(qualifyingEvidence());
		const result = assessAdvancedCpgProviderEntry(input);
		expect(result).toMatchObject({
			disposition: 'ADOPT_BOUNDED_ADAPTER',
			entryPredicate: { qualificationState: 'PASSED', state: 'PASSED' },
			reasons: ['QUALIFICATION_PASSED'],
			selectedProvider: 'CODEQL'
		});
		expect(result.qualification).toEqual(input.qualification);
		expect(
			validateAdvancedCpgProviderDisposition(input, { ...result, contentDigest: '0'.repeat(64) })
		).toBe(false);
	});

	it('rejects a completed spike with false results, provenance loss, drift, or no advantage', () => {
		const evidence = qualifyingEvidence();
		const degraded: AdvancedCpgProviderQualificationEvidence = {
			...evidence,
			comparison: {
				...evidence.comparison,
				falsePositiveCount: 1,
				incrementalBehavior: 'DIFFERS_FROM_CLEAN',
				provenance: 'LOSSY',
				providerUniqueTruePositiveCount: 0,
				reproducibility: 'DRIFT'
			}
		};
		const result = assessAdvancedCpgProviderEntry(availableRequest(degraded));
		expect(result.disposition).toBe('REJECT_FOR_CURRENT_NEED');
		expect(result.reasons).toEqual([
			'FALSE_RESULT_OBSERVED',
			'NO_DISCRIMINATING_ADVANTAGE',
			'PROVENANCE_INSUFFICIENT',
			'REPRODUCIBILITY_INSUFFICIENT',
			'INCREMENTAL_EQUIVALENCE_UNPROVEN'
		]);
	});

	it('defers a failed or disappeared provider and records prohibited setup as non-adoptable', () => {
		const evidence = qualifyingEvidence();
		const failed: AdvancedCpgProviderQualificationEvidence = {
			...evidence,
			result: { ...evidence.result, exitCode: 2, state: 'FAILED' }
		};
		expect(assessAdvancedCpgProviderEntry(availableRequest(failed))).toMatchObject({
			disposition: 'DEFER',
			reasons: ['QUALIFICATION_RUN_FAILED']
		});

		const prohibited: AdvancedCpgProviderQualificationEvidence = {
			...evidence,
			setup: { ...evidence.setup, networkUsed: true }
		};
		expect(assessAdvancedCpgProviderEntry(availableRequest(prohibited))).toMatchObject({
			disposition: 'REJECT_FOR_CURRENT_NEED',
			reasons: ['FORBIDDEN_OPERATION_OBSERVED']
		});
	});

	it('rejects hostile, ambiguous, mismatched, and over-budget wire inputs', () => {
		const extra = { ...request(), unexpected: true };
		expect(() => assessAdvancedCpgProviderEntry(extra)).toThrowError(
			'Advanced CPG provider entry request is invalid.'
		);

		const wrongCommand = structuredClone(request()) as unknown as {
			commandChecks: [{ exactCommand: string }, unknown];
		};
		wrongCommand.commandChecks[0].exactCommand = 'where.exe codeql';
		expect(() => assessAdvancedCpgProviderEntry(wrongCommand)).toThrow(TypeError);

		const accessor = structuredClone(request()) as unknown as Record<string, unknown>;
		Object.defineProperty(accessor, 'qualification', { enumerable: true, get: () => null });
		expect(() => assessAdvancedCpgProviderEntry(accessor)).toThrow(TypeError);

		const sparse = structuredClone(request()) as unknown as { providerPreference: string[] };
		delete sparse.providerPreference[0];
		expect(() => assessAdvancedCpgProviderEntry(sparse)).toThrow(TypeError);

		const evidence = qualifyingEvidence();
		const badDigest = {
			...evidence,
			query: { ...evidence.query, querySha256: '0'.repeat(64) }
		};
		expect(() => assessAdvancedCpgProviderEntry(availableRequest(badDigest))).toThrow(TypeError);

		const wrongProvider = { ...qualifyingEvidence(), provider: 'JOERN' as const };
		expect(() => assessAdvancedCpgProviderEntry(availableRequest(wrongProvider))).toThrow(
			'Advanced CPG provider qualification does not match the selected available provider.'
		);

		const tooSmallInput = request({
			budgets: { ...request().budgets, maxInputBytes: 1 }
		});
		expect(() => assessAdvancedCpgProviderEntry(tooSmallInput)).toThrow(RangeError);

		const tooSmallOutput = request({
			budgets: { ...request().budgets, maxOutputBytes: 1 }
		});
		expect(() => assessAdvancedCpgProviderEntry(tooSmallOutput)).toThrow(RangeError);

		const hostileProxy = new Proxy(request(), {
			ownKeys: () => {
				throw new Error('trap');
			}
		});
		expect(() => assessAdvancedCpgProviderEntry(hostileProxy)).toThrowError(
			'Advanced CPG provider entry request is invalid.'
		);
	});

	it('rejects every remaining closed-wire and qualification boundary without inspecting accessors', () => {
		type MutableRecord = Record<PropertyKey, unknown>;
		const invalidCandidates: unknown[] = [];

		invalidCandidates.push({ ...request(), unexpectedUndefined: undefined });
		const cyclic = structuredClone(request()) as unknown as MutableRecord;
		cyclic.qualification = cyclic;
		invalidCandidates.push(cyclic);

		class PreferenceArray extends Array<string> {}
		const subclassed = structuredClone(request()) as unknown as MutableRecord;
		subclassed.providerPreference = new PreferenceArray('CODEQL', 'JOERN');
		invalidCandidates.push(subclassed);

		const arrayProperty = structuredClone(request()) as unknown as MutableRecord;
		const preference = arrayProperty.providerPreference as string[] & MutableRecord;
		preference.extra = true;
		invalidCandidates.push(arrayProperty);

		const nonplain = structuredClone(request()) as unknown as MutableRecord;
		nonplain.environment = new Date();
		invalidCandidates.push(nonplain);

		const symbolKey = structuredClone(request()) as unknown as MutableRecord;
		symbolKey[Symbol('unexpected')] = true;
		invalidCandidates.push(symbolKey);
		invalidCandidates.push(null);

		const controlCharacter = structuredClone(request()) as unknown as MutableRecord;
		(controlCharacter.environment as MutableRecord).environmentId = 'bad\u0001id';
		invalidCandidates.push(controlCharacter);

		const budgetShape = structuredClone(request()) as unknown as MutableRecord;
		(budgetShape.budgets as MutableRecord).extra = 1;
		invalidCandidates.push(budgetShape);

		const budgetValue = structuredClone(request()) as unknown as MutableRecord;
		(budgetValue.budgets as MutableRecord).maxFactCount = 0;
		invalidCandidates.push(budgetValue);

		const commandShape = structuredClone(request()) as unknown as MutableRecord;
		(commandShape.commandChecks as unknown[])[0] = null;
		invalidCandidates.push(commandShape);

		const unavailableResolution = structuredClone(request()) as unknown as MutableRecord;
		((unavailableResolution.commandChecks as unknown[])[0] as MutableRecord).resolutionKind =
			'APPLICATION';
		invalidCandidates.push(unavailableResolution);

		const availableResolution = structuredClone(availableRequest()) as unknown as MutableRecord;
		((availableResolution.commandChecks as unknown[])[0] as MutableRecord).resolvedExecutablePath =
			'';
		invalidCandidates.push(availableResolution);

		const qualificationShape = structuredClone(availableRequest()) as unknown as MutableRecord;
		qualificationShape.qualification = {};
		invalidCandidates.push(qualificationShape);

		for (const candidate of invalidCandidates)
			expect(() => assessAdvancedCpgProviderEntry(candidate)).toThrow(
				'Advanced CPG provider entry request is invalid.'
			);

		const invalidQualifications = [
			{
				...qualifyingEvidence(),
				setup: { ...qualifyingEvidence().setup, installationPerformed: 'no' as never }
			},
			{
				...qualifyingEvidence(),
				setup: { ...qualifyingEvidence().setup, setupDescription: '' }
			},
			{
				...qualifyingEvidence(),
				comparison: { ...qualifyingEvidence().comparison, nativeFactCount: -1 }
			},
			{
				...qualifyingEvidence(),
				comparison: {
					...qualifyingEvidence().comparison,
					operationsFit: 'UNSUPPORTED' as never
				}
			}
		];
		for (const qualification of invalidQualifications)
			expect(() => assessAdvancedCpgProviderEntry(availableRequest(qualification))).toThrow(
				'Advanced CPG provider entry request is invalid.'
			);
	});

	it('records hand-check failure and rejects an unknown need despite provider availability', () => {
		const evidence = qualifyingEvidence();
		const handCheckFailure: AdvancedCpgProviderQualificationEvidence = {
			...evidence,
			comparison: { ...evidence.comparison, handCheckedPositiveDetectedCount: 0 }
		};
		expect(assessAdvancedCpgProviderEntry(availableRequest(handCheckFailure))).toMatchObject({
			disposition: 'REJECT_FOR_CURRENT_NEED',
			reasons: ['HAND_CHECK_FAILED']
		});

		const unknownAvailable = availableRequest();
		expect(
			assessAdvancedCpgProviderEntry({
				...unknownAvailable,
				nativeNeed: { ...unknownAvailable.nativeNeed, state: 'UNKNOWN' }
			})
		).toMatchObject({
			disposition: 'REJECT_FOR_CURRENT_NEED',
			reasons: ['NO_PROVEN_ENTRY_NEED']
		});
	});

	it('fails validation closed when result wire inspection itself fails', () => {
		const result = assessAdvancedCpgProviderEntry(request());
		const hostile = new Proxy(result, {
			ownKeys: () => {
				throw new Error('synthetic result inspection failure');
			}
		});
		expect(validateAdvancedCpgProviderDisposition(request(), hostile)).toBe(false);
	});
});
