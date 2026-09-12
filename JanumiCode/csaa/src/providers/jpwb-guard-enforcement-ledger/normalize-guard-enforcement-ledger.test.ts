import { describe, expect, it } from 'vitest';

import {
	GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
	GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_CANONICAL_PROFILE,
	GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
	GUARD_ENFORCEMENT_LEDGER_LIMITATIONS,
	GUARD_ENFORCEMENT_LEDGER_METHOD,
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	type GuardEnforcementLedgerArtifactSetBinding,
	type GuardEnforcementLedgerExecutorIdentity,
	type GuardEnforcementLedgerRawEvidence,
	type ObserveGuardEnforcementLedgerRequest
} from '../../contracts/guard-enforcement-ledger.js';
import { canonicalSemanticJsonWitness } from '../../semantic/canonical.js';
import { canonicalPathKey } from '../../subject/paths.js';
import {
	guardEnforcementLedgerArtifactSetContentDigest,
	guardEnforcementLedgerArtifactSetId
} from './guard-enforcement-ledger-content.js';
import {
	GuardEnforcementLedgerNormalizationError,
	type NormalizeGuardEnforcementLedgerInput,
	normalizeGuardEnforcementLedgerObservation
} from './normalize-guard-enforcement-ledger.js';
import { validateGuardEnforcementLedgerObservation } from './validate-guard-enforcement-ledger.js';
import { GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION } from './worker.js';

function artifactSet(): GuardEnforcementLedgerArtifactSetBinding {
	const artifacts = [
		{
			bytes: 20,
			canonicalPathKey: canonicalPathKey(GUARD_ENFORCEMENT_LEDGER_DATA_PATH),
			path: GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
			primaryClass: 'VERIFICATION' as const,
			semanticRoles: [],
			sha256: '2'.repeat(64),
			uses: ['LEDGER_DATA'] as const
		},
		{
			bytes: 10,
			canonicalPathKey: canonicalPathKey(GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH),
			path: GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
			primaryClass: 'VERIFICATION' as const,
			semanticRoles: [],
			sha256: '1'.repeat(64),
			uses: ['ANALYZER_SOURCE'] as const
		}
	];
	const content = {
		artifacts,
		canonicalProfile: GUARD_ENFORCEMENT_LEDGER_CANONICAL_PROFILE,
		coverage: {
			analyzerArtifacts: 1,
			analyzerDependencyArtifacts: 0,
			artifacts: 2,
			authorityTestArtifacts: 0,
			enforcementSiteArtifacts: 0,
			ledgerDataArtifacts: 1,
			packageSourceArtifacts: 0,
			reconciles: true,
			stateMachineDeclarationArtifacts: 0,
			totalBytes: 30
		},
		id: guardEnforcementLedgerArtifactSetId({
			artifactContentDigest: canonicalSemanticJsonWitness(artifacts).sha256,
			method: GUARD_ENFORCEMENT_LEDGER_METHOD,
			operationVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_SCHEMA_VERSION,
			subjectId: 'subject-1'
		}),
		method: GUARD_ENFORCEMENT_LEDGER_METHOD,
		operationVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_SCHEMA_VERSION,
		subjectId: 'subject-1'
	};
	return { ...content, contentDigest: guardEnforcementLedgerArtifactSetContentDigest(content) };
}

function executor(
	set: GuardEnforcementLedgerArtifactSetBinding
): GuardEnforcementLedgerExecutorIdentity {
	const analyzer = set.artifacts.find(
		(artifact) => artifact.path === GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH
	)!;
	const data = set.artifacts.find(
		(artifact) => artifact.path === GUARD_ENFORCEMENT_LEDGER_DATA_PATH
	)!;
	return {
		adapterId: GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
		adapterVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
		executableBytes: 10,
		executableSha256: '3'.repeat(64),
		externalModules: [
			{ bytes: 1, contentDigest: '4'.repeat(64), files: 1, name: 'typescript', version: '5.9.3' },
			{ bytes: 1, contentDigest: '5'.repeat(64), files: 1, name: 'ulid', version: '2.4.0' },
			{ bytes: 1, contentDigest: '6'.repeat(64), files: 1, name: 'zod', version: '4.4.3' }
		],
		retainedAnalyzerCanonicalPathKey: analyzer.canonicalPathKey,
		retainedAnalyzerSha256: analyzer.sha256,
		retainedDataCanonicalPathKey: data.canonicalPathKey,
		retainedDataSha256: data.sha256,
		runtime: 'bun',
		runtimeVersion: '1.3.14',
		worker: { bytes: 1, sha256: '7'.repeat(64) }
	};
}

function request(
	set: GuardEnforcementLedgerArtifactSetBinding
): ObserveGuardEnforcementLedgerRequest {
	return {
		artifactSetId: set.id,
		budgets: {
			maxArtifacts: 10,
			maxAuditEntries: 10,
			maxDiagnostics: 10,
			maxExecutorDurationMs: 10_000,
			maxExternalModuleBytes: 1_000,
			maxExternalModuleFiles: 100,
			maxGuardedArrows: 10,
			maxGuardTexts: 10,
			maxLedgerRows: 10,
			maxMaterializedBytes: 1_000,
			maxOutputStringCharacters: 10_000,
			maxRawArrayEntries: 100,
			maxRawJsonDepth: 10,
			maxStderrBytes: 1_000,
			maxStdoutBytes: 10_000
		},
		operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
		subjectId: set.subjectId
	};
}

function evidence(): GuardEnforcementLedgerRawEvidence {
	return {
		analyzerPath: GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
		audit: {
			arrowCount: 1,
			counts: [{ count: 1, disposition: 'ENFORCED' }],
			enforcedAnchorBroken: [],
			enforcedWithoutSite: [],
			stale: [],
			textCount: 1,
			unclassified: []
		},
		dataPath: GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
		guardTexts: ['guard a'],
		guardedArrows: [{ from: 'A', guard: 'guard a', machine: 'Machine', to: 'B' }],
		ledgerRows: [
			{
				disposition: 'ENFORCED',
				enforcingAnchor: 'throw new Error',
				enforcingSite: 'packages/handler.ts:7',
				evidence: 'handler refusal',
				guardText: 'guard a'
			}
		],
		runtime: { bunVersion: '1.3.14' },
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION
	};
}

function normalizationInput(): NormalizeGuardEnforcementLedgerInput {
	const set = artifactSet();
	return {
		artifactSet: set,
		evidence: evidence(),
		executor: executor(set),
		request: request(set),
		transportOutputBytes: new Uint8Array([1])
	};
}

function mutableNormalizationInput(): {
	artifactSet: GuardEnforcementLedgerArtifactSetBinding;
	evidence: GuardEnforcementLedgerRawEvidence;
	executor: GuardEnforcementLedgerExecutorIdentity;
	rawOutputIdentity?: NormalizeGuardEnforcementLedgerInput['rawOutputIdentity'];
	request: ObserveGuardEnforcementLedgerRequest;
	transportOutputBytes?: Uint8Array;
} {
	return structuredClone(normalizationInput());
}

describe('normalizeGuardEnforcementLedgerObservation', () => {
	it('binds canonical raw-evidence identity and preserves partial epistemic boundaries', () => {
		const set = artifactSet();
		const rawEvidence = evidence();
		const observation = normalizeGuardEnforcementLedgerObservation({
			artifactSet: set,
			evidence: rawEvidence,
			executor: executor(set),
			transportOutputBytes: new TextEncoder().encode('{"worker":"exact"}\n'),
			request: request(set)
		});
		const second = normalizeGuardEnforcementLedgerObservation({
			artifactSet: set,
			evidence: rawEvidence,
			executor: executor(set),
			transportOutputBytes: new TextEncoder().encode('{"worker":"exact"}\n'),
			request: request(set)
		});
		expect(Object.isFrozen(GUARD_ENFORCEMENT_LEDGER_LIMITATIONS)).toBe(true);
		expect(Object.isFrozen(GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS)).toBe(true);
		expect(() =>
			(GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS as unknown as string[]).push('weakened.ts')
		).toThrow();
		expect(GUARD_ENFORCEMENT_LEDGER_LIMITATIONS.every((entry) => Object.isFrozen(entry))).toBe(
			true
		);
		expect(Object.isFrozen(observation.limitations)).toBe(true);
		expect(observation.limitations.every((entry) => Object.isFrozen(entry))).toBe(true);
		expect(observation.limitations).not.toBe(GUARD_ENFORCEMENT_LEDGER_LIMITATIONS);
		expect(second.limitations).not.toBe(observation.limitations);
		expect(() =>
			(observation.limitations as unknown as { code: string }[]).push({ code: 'MUTATED' })
		).toThrow();
		expect(
			() => ((observation.limitations[0] as unknown as { code: string }).code = 'MUTATED')
		).toThrow();
		expect(GUARD_ENFORCEMENT_LEDGER_LIMITATIONS[0]!.code).toBe(
			'CLASSIFICATION_IS_RETAINED_REVIEW_JUDGMENT'
		);
		expect(second.limitations[0]!.code).toBe('CLASSIFICATION_IS_RETAINED_REVIEW_JUDGMENT');
		expect(observation.coverage).toMatchObject({
			arrowOccurrences: 1,
			classifiedGuardTexts: 1,
			reconciles: true
		});
		expect(observation.health).toBe('PARTIAL');
		expect(observation.runtimeEnforcement).toBe('NOT_CLAIMED');
		expect(observation.retainedTestExecution).toBe('NOT_EXECUTED_BY_CSAA');
		expect(observation.rawOutput.bytes).toBe(canonicalSemanticJsonWitness(rawEvidence).bytes);
		expect(validateGuardEnforcementLedgerObservation(observation)).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(validateGuardEnforcementLedgerObservation(second).state).toBe('VALID');
	});

	it('excludes relocation-sensitive private transport paths from canonical identities', () => {
		const set = artifactSet();
		const normalize = (checkout: string) =>
			normalizeGuardEnforcementLedgerObservation({
				artifactSet: set,
				evidence: evidence(),
				executor: executor(set),
				transportOutputBytes: new TextEncoder().encode(
					JSON.stringify({ typescriptResolvedPath: `${checkout}/node_modules/typescript/index.js` })
				),
				request: request(set)
			});
		const first = normalize('C:/checkout-a');
		const second = normalize('D:/relocated/checkout-b');
		expect(second.rawOutput).toEqual(first.rawOutput);
		expect(second.id).toBe(first.id);
		expect(second.contentDigest).toBe(first.contentDigest);
	});

	it('rejects non-reconciling audit populations', () => {
		const set = artifactSet();
		const malformed = structuredClone(evidence()) as {
			audit: { arrowCount: number };
		} & GuardEnforcementLedgerRawEvidence;
		malformed.audit.arrowCount = 2;
		expect(() =>
			normalizeGuardEnforcementLedgerObservation({
				artifactSet: set,
				evidence: malformed,
				executor: executor(set),
				transportOutputBytes: new Uint8Array([1]),
				request: request(set)
			})
		).toThrow(GuardEnforcementLedgerNormalizationError);
	});

	it('requires exact nonempty retained populations and nonempty ledger evidence', () => {
		const set = artifactSet();
		const normalize = (rawEvidence: GuardEnforcementLedgerRawEvidence) =>
			normalizeGuardEnforcementLedgerObservation({
				artifactSet: set,
				evidence: rawEvidence,
				executor: executor(set),
				transportOutputBytes: new Uint8Array([1]),
				request: request(set)
			});
		const extraGuardText = structuredClone(evidence()) as unknown as {
			audit: { textCount: number; unclassified: string[] };
			guardTexts: string[];
		} & GuardEnforcementLedgerRawEvidence;
		extraGuardText.guardTexts.push('guard b');
		extraGuardText.audit.textCount = 2;
		extraGuardText.audit.unclassified = ['guard b'];
		expect(() => normalize(extraGuardText)).toThrow(/exactly equal/u);

		for (const key of ['guardTexts', 'guardedArrows', 'ledgerRows'] as const) {
			const empty = structuredClone(evidence()) as unknown as Record<string, unknown>;
			empty[key] = [];
			expect(() => normalize(empty as unknown as GuardEnforcementLedgerRawEvidence)).toThrow(
				/at least one/u
			);
		}
		const emptyEvidence = structuredClone(evidence()) as unknown as {
			ledgerRows: { evidence: string }[];
		} & GuardEnforcementLedgerRawEvidence;
		emptyEvidence.ledgerRows[0]!.evidence = '';
		expect(() => normalize(emptyEvidence)).toThrow(/nonempty Unicode scalar text/u);
	});

	it('enforces the exact request schema and every positive operation budget', () => {
		const set = artifactSet();
		const normalize = (requestValue: ObserveGuardEnforcementLedgerRequest) =>
			normalizeGuardEnforcementLedgerObservation({
				artifactSet: set,
				evidence: evidence(),
				executor: executor(set),
				transportOutputBytes: new Uint8Array([1]),
				request: requestValue
			});
		const wrongSchema = {
			...request(set),
			schemaVersion: 'unsupported'
		} as unknown as ObserveGuardEnforcementLedgerRequest;
		expect(() => normalize(wrongSchema)).toThrow(/request schema/u);
		for (const key of Object.keys(
			request(set).budgets
		) as (keyof ObserveGuardEnforcementLedgerRequest['budgets'])[]) {
			const malformed = structuredClone(request(set)) as unknown as {
				budgets: Record<string, number>;
			};
			malformed.budgets[key] = -1;
			expect(() => normalize(malformed as unknown as ObserveGuardEnforcementLedgerRequest)).toThrow(
				/positive safe integer/u
			);
		}
	});

	it('rejects empty exact worker transport bytes', () => {
		const set = artifactSet();
		expect(() =>
			normalizeGuardEnforcementLedgerObservation({
				artifactSet: set,
				evidence: evidence(),
				executor: executor(set),
				transportOutputBytes: new Uint8Array(),
				request: request(set)
			})
		).toThrow(/must be nonempty/u);
	});

	it('fails closed across malformed executor, evidence, binding, and acceptance surfaces', () => {
		const setAt = (root: unknown, path: readonly (number | string)[], value: unknown): void => {
			let cursor = root as Record<number | string, unknown>;
			for (const key of path.slice(0, -1)) cursor = cursor[key] as Record<number | string, unknown>;
			cursor[path.at(-1)!] = value;
		};
		const reject = (path: readonly (number | string)[], value: unknown, message: RegExp): void => {
			const input = mutableNormalizationInput();
			setAt(input, path, value);
			expect(() => normalizeGuardEnforcementLedgerObservation(input)).toThrow(message);
		};

		reject(['request', 'operationVersion'], 'wrong', /operation version/u);
		reject(['executor', 'adapterId'], 'wrong', /adapter identity/u);
		reject(['executor', 'adapterVersion'], 'wrong', /adapter version/u);
		reject(['executor', 'executableSha256'], 'wrong', /SHA-256/u);
		reject(['executor', 'runtime'], 'node', /runtime must be Bun/u);
		reject(['executor', 'externalModules'], [], /exactly TypeScript, ULID, and Zod/u);
		reject(['executor', 'externalModules', 0, 'name'], 'wrong', /incomplete or noncanonical/u);
		reject(['evidence', 'analyzerPath'], 'verif/other.ts', /retained analyzer path/u);
		reject(['evidence', 'dataPath'], 'verif/other.data.ts', /retained data path/u);
		reject(['evidence', 'schemaVersion'], 'wrong', /worker evidence schema/u);
		reject(['evidence', 'guardTexts'], 'not-an-array', /Expected an array/u);
		reject(['evidence', 'guardTexts'], ['guard a', 'guard a'], /unique and canonically ordered/u);
		reject(['evidence', 'guardedArrows'], 'not-an-array', /Expected an array/u);
		reject(['evidence', 'guardedArrows', 0, 'guard'], 'guard b', /absent from/u);
		reject(['evidence', 'ledgerRows'], 'not-an-array', /Expected an array/u);
		reject(['evidence', 'audit', 'counts'], 'not-an-array', /Expected an array/u);
		reject(['evidence', 'audit', 'arrowCount'], -1, /nonnegative safe integer/u);
		reject(['evidence', 'ledgerRows', 0, 'disposition'], 'WRONG', /recognized guard disposition/u);
		reject(['request', 'subjectId'], 'other', /subjects differ/u);
		reject(['request', 'artifactSetId'], 'other', /identities differ/u);
		reject(['evidence', 'runtime', 'bunVersion'], 'other', /Bun versions differ/u);
		reject(['executor', 'retainedAnalyzerSha256'], '9'.repeat(64), /analyzer identity/u);
		reject(['executor', 'retainedDataSha256'], '9'.repeat(64), /data identity/u);
		for (const malformedEvidence of [
			null,
			[],
			{ ...evidence(), extra: true },
			Object.create({ inherited: true })
		]) {
			const input = mutableNormalizationInput();
			(input as { evidence: unknown }).evidence = malformedEvidence;
			expect(() => normalizeGuardEnforcementLedgerObservation(input as never)).toThrow();
		}
		const accessorEvidence = evidence() as unknown as Record<string, unknown>;
		Object.defineProperty(accessorEvidence, 'runtime', { enumerable: true, get: () => ({}) });
		const accessorInput = mutableNormalizationInput();
		(accessorInput as { evidence: unknown }).evidence = accessorEvidence;
		expect(() => normalizeGuardEnforcementLedgerObservation(accessorInput as never)).toThrow(
			/enumerable data property/u
		);

		const noAnalyzer = mutableNormalizationInput();
		setAt(
			noAnalyzer,
			['artifactSet', 'artifacts'],
			noAnalyzer.artifactSet.artifacts.filter(
				(artifact) => artifact.path !== GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH
			)
		);
		expect(() => normalizeGuardEnforcementLedgerObservation(noAnalyzer)).toThrow(
			/exactly one retained analyzer/u
		);
		const noData = mutableNormalizationInput();
		setAt(
			noData,
			['artifactSet', 'artifacts'],
			noData.artifactSet.artifacts.filter(
				(artifact) => artifact.path !== GUARD_ENFORCEMENT_LEDGER_DATA_PATH
			)
		);
		expect(() => normalizeGuardEnforcementLedgerObservation(noData)).toThrow(
			/exactly one retained ledger-data/u
		);

		for (const [budget, value] of [
			['maxGuardedArrows', 0],
			['maxGuardTexts', 0],
			['maxLedgerRows', 0],
			['maxAuditEntries', 0],
			['maxArtifacts', 1],
			['maxMaterializedBytes', 1],
			['maxExternalModuleBytes', 1],
			['maxExternalModuleFiles', 1],
			['maxRawArrayEntries', 1],
			['maxRawJsonDepth', 1],
			['maxOutputStringCharacters', 1]
		] as const) {
			const input = mutableNormalizationInput();
			setAt(input, ['request', 'budgets', budget], value);
			expect(() => normalizeGuardEnforcementLedgerObservation(input)).toThrow();
		}
		const durationTooLarge = mutableNormalizationInput();
		durationTooLarge.request = {
			...durationTooLarge.request,
			budgets: {
				...durationTooLarge.request.budgets,
				maxExecutorDurationMs: Number.MAX_SAFE_INTEGER
			}
		};
		expect(() => normalizeGuardEnforcementLedgerObservation(durationTooLarge)).toThrow(
			/runtime timer representation/u
		);
		const invalidTransport = mutableNormalizationInput();
		invalidTransport.transportOutputBytes = [] as never;
		expect(() => normalizeGuardEnforcementLedgerObservation(invalidTransport)).toThrow(
			/non-Proxy Uint8Array/u
		);
		const auditBudget = mutableNormalizationInput();
		setAt(auditBudget, ['evidence', 'guardTexts'], ['guard a', 'guard b', 'guard c']);
		setAt(
			auditBudget,
			['evidence', 'guardedArrows'],
			[
				...auditBudget.evidence.guardedArrows,
				{ ...auditBudget.evidence.guardedArrows[0]!, guard: 'guard b' },
				{ ...auditBudget.evidence.guardedArrows[0]!, guard: 'guard c' }
			]
		);
		setAt(auditBudget, ['evidence', 'audit', 'arrowCount'], 3);
		setAt(auditBudget, ['evidence', 'audit', 'textCount'], 3);
		setAt(auditBudget, ['evidence', 'audit', 'unclassified'], ['guard b', 'guard c']);
		auditBudget.request = {
			...auditBudget.request,
			budgets: { ...auditBudget.request.budgets, maxAuditEntries: 1 }
		};
		expect(() => normalizeGuardEnforcementLedgerObservation(auditBudget)).toThrow(
			/acceptance budget/u
		);
		const stale = mutableNormalizationInput();
		setAt(
			stale,
			['evidence', 'ledgerRows'],
			[...stale.evidence.ledgerRows, { ...stale.evidence.ledgerRows[0]!, guardText: 'stale guard' }]
		);
		setAt(stale, ['evidence', 'audit', 'stale'], ['stale guard']);
		expect(normalizeGuardEnforcementLedgerObservation(stale).health).toBe('PARTIAL');

		const reversedArrows = mutableNormalizationInput();
		setAt(reversedArrows, ['evidence', 'guardTexts'], ['guard a', 'guard b']);
		setAt(
			reversedArrows,
			['evidence', 'guardedArrows'],
			[
				{ from: 'Z', guard: 'guard b', machine: 'Machine', to: 'Z' },
				{ from: 'A', guard: 'guard a', machine: 'Machine', to: 'A' }
			]
		);
		expect(() => normalizeGuardEnforcementLedgerObservation(reversedArrows)).toThrow(
			/canonically ordered/u
		);
		const reversedRows = mutableNormalizationInput();
		setAt(
			reversedRows,
			['evidence', 'ledgerRows'],
			[
				reversedRows.evidence.ledgerRows[0],
				{ ...reversedRows.evidence.ledgerRows[0], guardText: 'a guard' }
			]
		);
		expect(() => normalizeGuardEnforcementLedgerObservation(reversedRows)).toThrow(
			/canonically ordered/u
		);
		const duplicateCounts = mutableNormalizationInput();
		setAt(
			duplicateCounts,
			['evidence', 'audit', 'counts'],
			[
				{ count: 1, disposition: 'ENFORCED' },
				{ count: 1, disposition: 'ENFORCED' }
			]
		);
		expect(() => normalizeGuardEnforcementLedgerObservation(duplicateCounts)).toThrow(
			/canonically ordered/u
		);
		for (const [key, value] of [
			['textCount', 2],
			['unclassified', ['guard a']],
			['stale', ['guard a']],
			['enforcedWithoutSite', ['guard a']],
			['counts', []]
		] as const) {
			const input = mutableNormalizationInput();
			setAt(input, ['evidence', 'audit', key], value);
			expect(() => normalizeGuardEnforcementLedgerObservation(input)).toThrow(/reconcile/u);
		}
	});

	it('accepts only a reproducible canonical structural raw-output witness', () => {
		const transportInput = normalizationInput();
		const observation = normalizeGuardEnforcementLedgerObservation(transportInput);
		const structuralInput: NormalizeGuardEnforcementLedgerInput = {
			artifactSet: transportInput.artifactSet,
			evidence: transportInput.evidence,
			executor: transportInput.executor,
			rawOutputIdentity: observation.rawOutput,
			request: transportInput.request
		};
		expect(normalizeGuardEnforcementLedgerObservation(structuralInput)).toEqual(observation);
		expect(() =>
			normalizeGuardEnforcementLedgerObservation({
				...structuralInput,
				transportOutputBytes: new Uint8Array([1])
			})
		).toThrow(/exactly one/u);
		expect(() =>
			normalizeGuardEnforcementLedgerObservation({
				artifactSet: structuralInput.artifactSet,
				evidence: structuralInput.evidence,
				executor: structuralInput.executor,
				request: structuralInput.request
			})
		).toThrow(/exactly one/u);

		for (const [key, value, message] of [
			['evidenceContentDigest', '0'.repeat(64), /projection digest/u],
			['schemaVersion', 'wrong', /schemas differ/u],
			['bytes', observation.rawOutput.bytes + 1, /does not reproduce/u],
			['sha256', '0'.repeat(64), /does not reproduce/u],
			['id', 'wrong', /identity does not reproduce/u]
		] as const) {
			const input = structuredClone(structuralInput) as {
				rawOutputIdentity: Record<string, unknown>;
			} & NormalizeGuardEnforcementLedgerInput;
			(input.rawOutputIdentity as Record<string, unknown>)[key] = value;
			expect(() => normalizeGuardEnforcementLedgerObservation(input)).toThrow(message);
		}
		const transportTooLarge = mutableNormalizationInput();
		transportTooLarge.request = {
			...transportTooLarge.request,
			budgets: { ...transportTooLarge.request.budgets, maxStdoutBytes: 1 }
		};
		transportTooLarge.transportOutputBytes = new Uint8Array([1, 2]);
		expect(() => normalizeGuardEnforcementLedgerObservation(transportTooLarge)).toThrow(
			/transport budget/u
		);
		const canonicalTooLarge = structuredClone(structuralInput) as {
			request: ObserveGuardEnforcementLedgerRequest;
		} & NormalizeGuardEnforcementLedgerInput;
		canonicalTooLarge.request = {
			...canonicalTooLarge.request,
			budgets: { ...canonicalTooLarge.request.budgets, maxStdoutBytes: 1 }
		};
		expect(() => normalizeGuardEnforcementLedgerObservation(canonicalTooLarge)).toThrow(
			/Canonical raw evidence exceeds/u
		);
	});

	it('independently rejects identity mutation and validation budget exhaustion', () => {
		const set = artifactSet();
		const observation = normalizeGuardEnforcementLedgerObservation({
			artifactSet: set,
			evidence: evidence(),
			executor: executor(set),
			transportOutputBytes: new Uint8Array([1]),
			request: request(set)
		});
		const mutated = structuredClone(observation) as unknown as {
			guardedArrows: { to: string }[];
		};
		mutated.guardedArrows[0]!.to = 'C';
		expect(validateGuardEnforcementLedgerObservation(mutated).state).toBe('INVALID');
		const rawIdentityMutation = structuredClone(observation) as unknown as {
			rawOutput: { sha256: string };
		};
		rawIdentityMutation.rawOutput.sha256 = '0'.repeat(64);
		expect(validateGuardEnforcementLedgerObservation(rawIdentityMutation).state).toBe('INVALID');
		const malformedBudget = structuredClone(observation) as unknown as {
			budgets: { maxExecutorDurationMs: number };
		};
		malformedBudget.budgets.maxExecutorDurationMs = -1;
		expect(validateGuardEnforcementLedgerObservation(malformedBudget).issues[0]).toMatchObject({
			code: 'INVALID_VALUE',
			path: '$.budgets.maxExecutorDurationMs'
		});
		const extraGuard = structuredClone(observation) as unknown as {
			rawEvidence: { audit: { textCount: number; unclassified: string[] }; guardTexts: string[] };
		};
		extraGuard.rawEvidence.guardTexts.push('guard b');
		extraGuard.rawEvidence.audit.textCount = 2;
		extraGuard.rawEvidence.audit.unclassified = ['guard b'];
		expect(validateGuardEnforcementLedgerObservation(extraGuard).issues[0]).toMatchObject({
			code: 'POPULATION_MISMATCH',
			path: '$.rawEvidence.guardTexts'
		});
		expect(
			validateGuardEnforcementLedgerObservation(
				new Proxy(observation, {
					ownKeys() {
						throw new Error('hostile');
					}
				})
			).state
		).toBe('INVALID');
		expect(
			validateGuardEnforcementLedgerObservation(observation, undefined, { maxRecords: 1 }).state
		).toBe('BUDGET_EXHAUSTED');
	});

	it('independently rejects hostile public shapes, constants, populations, and projections', () => {
		const valid = normalizeGuardEnforcementLedgerObservation(normalizationInput());
		const setAt = (root: unknown, path: readonly (number | string)[], value: unknown): void => {
			let cursor = root as Record<number | string, unknown>;
			for (const key of path.slice(0, -1)) cursor = cursor[key] as Record<number | string, unknown>;
			cursor[path.at(-1)!] = value;
		};
		const invalid = (path: readonly (number | string)[], value: unknown): void => {
			const draft = structuredClone(valid);
			setAt(draft, path, value);
			expect(validateGuardEnforcementLedgerObservation(draft).state).toBe('INVALID');
		};

		invalid(['runtimeEnforcement'], 'CLAIMED');
		invalid(['subjectId'], '');
		invalid(['id'], '');
		invalid(['contentDigest'], 'wrong');
		invalid(['limitations'], [...valid.limitations].reverse());
		invalid(['coverage', 'reconciles'], false);
		invalid(['coverage', 'reconciles'], 1);
		invalid(['coverage', 'arrowOccurrences'], 'one');
		invalid(['coverage', 'arrowOccurrences'], -1);
		invalid(['rawEvidence', 'audit', 'arrowCount'], 'one');
		invalid(['rawEvidence', 'guardedArrows'], []);
		invalid(['rawEvidence', 'guardTexts'], []);
		invalid(['rawEvidence', 'ledgerRows'], []);
		invalid(['rawEvidence', 'ledgerRows', 0, 'evidence'], '');
		invalid(['rawEvidence', 'audit', 'arrowCount'], 2);
		invalid(['rawEvidence', 'audit', 'textCount'], 2);
		for (const [key, value] of [
			['maxArtifacts', 1],
			['maxStdoutBytes', 1]
		] as const) {
			const draft = structuredClone(valid);
			setAt(draft, ['budgets', key], value);
			expect(validateGuardEnforcementLedgerObservation(draft).state).toBe('BUDGET_EXHAUSTED');
		}
		invalid(['guardedArrows'], []);
		invalid(['guards'], []);
		invalid(['guardedArrows', 0, 'ordinal'], 1);
		invalid(['coverage', 'arrowOccurrences'], 2);
		invalid(['executor', 'runtime'], 'node');
		invalid(['budgets', 'maxExecutorDurationMs'], Number.MAX_SAFE_INTEGER);

		const extraRoot = structuredClone(valid) as unknown as Record<string, unknown>;
		extraRoot.extra = true;
		expect(validateGuardEnforcementLedgerObservation(extraRoot).state).toBe('INVALID');
		const missingRoot = structuredClone(valid) as unknown as Record<string, unknown>;
		delete missingRoot.health;
		expect(validateGuardEnforcementLedgerObservation(missingRoot).state).toBe('INVALID');
		const wrongCoverageRecord = structuredClone(valid);
		(wrongCoverageRecord as unknown as { coverage: unknown }).coverage = [];
		expect(validateGuardEnforcementLedgerObservation(wrongCoverageRecord).state).toBe('INVALID');
		const wrongCoverageBoolean = structuredClone(valid);
		(wrongCoverageBoolean.coverage as unknown as { reconciles: unknown }).reconciles = 1;
		expect(validateGuardEnforcementLedgerObservation(wrongCoverageBoolean).state).toBe('INVALID');
		const arrayProxy = structuredClone(valid);
		(arrayProxy as unknown as { limitations: unknown }).limitations = new Proxy(
			structuredClone(valid.limitations),
			{}
		);
		expect(validateGuardEnforcementLedgerObservation(arrayProxy).state).toBe('INVALID');
		const missingNestedField = structuredClone(valid) as unknown as {
			rawEvidence: { audit: Record<string, unknown> };
		};
		delete missingNestedField.rawEvidence.audit.textCount;
		expect(validateGuardEnforcementLedgerObservation(missingNestedField).state).toBe('INVALID');
		const nullBudgetRecord = structuredClone(valid) as unknown as { budgets: unknown };
		nullBudgetRecord.budgets = null;
		expect(validateGuardEnforcementLedgerObservation(nullBudgetRecord).state).toBe('INVALID');
		const subclassedLimitations = structuredClone(valid);
		class LimitationArray<T> extends Array<T> {}
		(subclassedLimitations as unknown as { limitations: unknown }).limitations =
			new LimitationArray(...valid.limitations);
		expect(validateGuardEnforcementLedgerObservation(subclassedLimitations).state).toBe('INVALID');

		for (const mutate of [
			(draft: typeof valid) => {
				(draft.rawEvidence.guardedArrows as unknown as unknown[]).push(
					structuredClone(draft.rawEvidence.guardedArrows[0]!)
				);
				(draft.rawEvidence.audit as unknown as { arrowCount: number }).arrowCount = 2;
				(draft.budgets as unknown as { maxGuardedArrows: number }).maxGuardedArrows = 1;
			},
			(draft: typeof valid) => {
				(draft.rawEvidence.guardedArrows as unknown as { guard: string }[]).push({
					...structuredClone(draft.rawEvidence.guardedArrows[0]!),
					guard: 'guard b'
				});
				(draft.rawEvidence.guardTexts as unknown as string[]).push('guard b');
				(
					draft.rawEvidence.audit as unknown as { arrowCount: number; textCount: number }
				).arrowCount = 2;
				(draft.rawEvidence.audit as unknown as { textCount: number }).textCount = 2;
				(draft.budgets as unknown as { maxGuardTexts: number }).maxGuardTexts = 1;
			},
			(draft: typeof valid) => {
				(draft.rawEvidence.ledgerRows as unknown as unknown[]).push(
					structuredClone(draft.rawEvidence.ledgerRows[0]!)
				);
				(draft.budgets as unknown as { maxLedgerRows: number }).maxLedgerRows = 1;
			},
			(draft: typeof valid) => {
				(draft.rawEvidence.audit.unclassified as unknown as string[]).push('a', 'b');
				(draft.budgets as unknown as { maxAuditEntries: number }).maxAuditEntries = 1;
			}
		]) {
			const draft = structuredClone(valid);
			mutate(draft);
			expect(validateGuardEnforcementLedgerObservation(draft).state).toBe('BUDGET_EXHAUSTED');
		}

		const identity = structuredClone(valid);
		setAt(identity, ['id'], 'different-but-nonempty');
		expect(validateGuardEnforcementLedgerObservation(identity).issues[0]).toMatchObject({
			code: 'IDENTITY_MISMATCH',
			path: '$.id'
		});
		const digestMutation = structuredClone(valid);
		setAt(digestMutation, ['contentDigest'], '0'.repeat(64));
		expect(validateGuardEnforcementLedgerObservation(digestMutation).issues[0]).toMatchObject({
			code: 'CONTENT_DIGEST_MISMATCH',
			path: '$.contentDigest'
		});
		const artifactDigest = structuredClone(valid);
		setAt(artifactDigest, ['artifactSet', 'contentDigest'], '0'.repeat(64));
		expect(validateGuardEnforcementLedgerObservation(artifactDigest).state).toBe('INVALID');

		for (const options of [
			null,
			{ extra: 1 },
			{ maxIssues: 0 },
			new Proxy(
				{},
				{
					ownKeys() {
						throw new Error('hostile options');
					}
				}
			)
		])
			expect(
				validateGuardEnforcementLedgerObservation(valid, undefined, options as never).state
			).toBe('INVALID');
		expect(
			validateGuardEnforcementLedgerObservation(valid, undefined, { maxStringCharacters: 1 }).state
		).toBe('BUDGET_EXHAUSTED');
		expect(
			validateGuardEnforcementLedgerObservation(valid, undefined, { maxRecords: 30 }).state
		).toBe('BUDGET_EXHAUSTED');

		const cyclic = structuredClone(valid) as unknown as Record<string, unknown>;
		cyclic.subjectId = cyclic;
		expect(validateGuardEnforcementLedgerObservation(cyclic).state).toBe('INVALID');
		const nonPlain = structuredClone(valid) as unknown as Record<string, unknown>;
		nonPlain.subjectId = Object.create({ inherited: true });
		expect(validateGuardEnforcementLedgerObservation(nonPlain).state).toBe('INVALID');
		const sparse = structuredClone(valid);
		const sparseLimitations = new Array(valid.limitations.length + 1);
		for (const [index, limitation] of valid.limitations.entries())
			sparseLimitations[index] = limitation;
		setAt(sparse, ['limitations'], sparseLimitations);
		expect(validateGuardEnforcementLedgerObservation(sparse).state).toBe('INVALID');
		const accessor = structuredClone(valid) as unknown as Record<string, unknown>;
		Object.defineProperty(accessor, 'subjectId', { enumerable: true, get: () => valid.subjectId });
		expect(validateGuardEnforcementLedgerObservation(accessor).state).toBe('INVALID');
		const nestedAccessor = structuredClone(valid);
		Object.defineProperty(nestedAccessor.limitations[0], 'reason', {
			enumerable: true,
			get: () => valid.limitations[0]!.reason
		});
		expect(validateGuardEnforcementLedgerObservation(nestedAccessor).state).toBe('INVALID');
		const scalarObject = structuredClone(valid);
		(scalarObject.rawEvidence.guardTexts as unknown as unknown[])[0] = {};
		expect(validateGuardEnforcementLedgerObservation(scalarObject).state).toBe('INVALID');
		const noncanonicalPrimitive = structuredClone(valid);
		(noncanonicalPrimitive.executor.externalModules[0] as unknown as { bytes: unknown }).bytes = 1n;
		expect(validateGuardEnforcementLedgerObservation(noncanonicalPrimitive).state).toBe('INVALID');
		const nonCanonical = structuredClone(valid) as unknown as Record<string, unknown>;
		nonCanonical.subjectId = 1n;
		expect(validateGuardEnforcementLedgerObservation(nonCanonical).state).toBe('INVALID');
	});

	it('classifies nested non-plain containers and subject-bound artifact-set failures', () => {
		const nonPlain = structuredClone(
			normalizeGuardEnforcementLedgerObservation(normalizationInput())
		);
		Object.setPrototypeOf(nonPlain.limitations[0]!, { hostile: true });
		expect(validateGuardEnforcementLedgerObservation(nonPlain)).toMatchObject({
			issues: [{ code: 'SHAPE_INVALID' }],
			state: 'INVALID'
		});

		const unsupportedArtifactSet = structuredClone(
			normalizeGuardEnforcementLedgerObservation(normalizationInput())
		);
		(
			unsupportedArtifactSet.artifactSet as unknown as {
				schemaVersion: string;
			}
		).schemaVersion = 'unsupported';
		expect(validateGuardEnforcementLedgerObservation(unsupportedArtifactSet)).toMatchObject({
			issues: [{ code: 'ARTIFACT_SET_INVALID', path: '$.artifactSet' }],
			state: 'INVALID'
		});

		const subjectBound = normalizeGuardEnforcementLedgerObservation(normalizationInput());
		expect(validateGuardEnforcementLedgerObservation(subjectBound, {} as never)).toMatchObject({
			issues: [{ code: 'SUBJECT_MISMATCH', path: '$.artifactSet' }],
			state: 'INVALID'
		});
	});
});
