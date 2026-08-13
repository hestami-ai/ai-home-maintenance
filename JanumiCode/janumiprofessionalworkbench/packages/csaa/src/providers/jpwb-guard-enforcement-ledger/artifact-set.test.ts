import { describe, expect, it } from 'vitest';

import {
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
	type BuildGuardEnforcementLedgerArtifactSetRequest
} from '../../contracts/guard-enforcement-ledger.js';
import type {
	CapturedArtifactRecord,
	ExcludedArtifactRecord,
	FrozenSubject
} from '../../contracts/subject.js';
import { sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJsonWitness } from '../../semantic/canonical.js';
import { classifyArtifact } from '../../subject/artifacts.js';
import { attachFrozenSubjectBytes } from '../../subject/frozen-store.js';
import { canonicalPathKey } from '../../subject/paths.js';
import {
	guardEnforcementLedgerArtifactSetContentDigest,
	guardEnforcementLedgerArtifactSetId
} from './guard-enforcement-ledger-content.js';
import {
	buildGuardEnforcementLedgerArtifactSet,
	selectGuardEnforcementLedgerArtifactSet,
	validateGuardEnforcementLedgerArtifactSet
} from './artifact-set.js';

const SUBJECT_ID = 'subject:guard-enforcement-ledger-fixture';
const encoder = new TextEncoder();

const REQUIRED_SOURCES = new Map<string, string>([
	[
		'verif/guard-enforcement-ledger.ts',
		'export const guardedArrows = () => []; export const auditLedger = () => ({});\n'
	],
	[
		'verif/guard-enforcement-ledger.data.ts',
		`export const GUARD_LEDGER = {
			one: { disposition: "ENFORCED", evidence: "one", enforcingSite: "packages/rph-application/src/handlers/pwu.ts:12", enforcingAnchor: "one" },
			two: { disposition: "ENFORCED", evidence: "two", enforcingSite: "packages/rph-application/src/handlers/execution.ts:34", enforcingAnchor: "two" }
		};\n`
	],
	['verif/guard-enforcement-ledger.test.ts', "export const retainedAuthority = 'delegated';\n"],
	['packages/rph-domain/package.json', '{"name":"@janumipwb/rph-domain"}\n'],
	['packages/rph-contracts/package.json', '{"name":"@janumipwb/rph-contracts"}\n'],
	['packages/rph-domain/src/index.ts', "export * from './transitions.data.js';\n"],
	[
		'packages/rph-domain/src/machine-exclusions.ts',
		'export const isExcludedMachine = () => false;\n'
	],
	[
		'packages/rph-domain/src/transitions.data.ts',
		'// GENERATED FILE — fixture\nexport const STATE_MACHINES = {};\n'
	],
	['packages/rph-contracts/src/index.ts', "export * from './ids.js';\n"],
	['packages/rph-application/src/handlers/pwu.ts', "export const pwu = 'one';\n"],
	['packages/rph-application/src/handlers/execution.ts', "export const execution = 'two';\n"]
]);

const IGNORED_SOURCES = new Map<string, string>([
	['packages/rph-application/src/handlers/assurance.ts', 'export const unrelated = true;\n'],
	['packages/rph-application/src/handlers/pwu.test.ts', 'export const testOnly = true;\n'],
	['packages/rph-domain/src/example.test.ts', 'export const testOnly = true;\n'],
	['packages/rph-domain/src/gen/generate.ts', 'export const generator = true;\n'],
	['packages/rph-contracts/src/example.spec.ts', 'export const testOnly = true;\n'],
	['packages/rph-contracts/src/gen/generate.ts', 'export const generator = true;\n'],
	['packages/csaa/src/index.ts', 'export {};\n']
]);

interface SubjectOptions {
	readonly add?: ReadonlyMap<string, string>;
	readonly duplicatePath?: string;
	readonly excludePaths?: readonly string[];
	readonly mutate?: (artifact: CapturedArtifactRecord) => CapturedArtifactRecord;
	readonly omitBytes?: readonly string[];
	readonly omitPaths?: readonly string[];
	readonly subjectId?: string;
}

function artifact(path: string, source: string): CapturedArtifactRecord {
	const bytes = encoder.encode(source);
	const classification = classifyArtifact(path, source);
	return {
		bytes: bytes.byteLength,
		canonicalPathKey: canonicalPathKey(path),
		disposition: classification.disposition,
		path,
		primaryClass: classification.primaryClass,
		reason: classification.reason,
		roles: classification.roles,
		sha256: sha256(bytes)
	};
}

function frozenSubject(options: SubjectOptions = {}): FrozenSubject {
	const omit = new Set(options.omitPaths ?? []);
	const excluded = new Set(options.excludePaths ?? []);
	const all = new Map([...REQUIRED_SOURCES, ...IGNORED_SOURCES, ...(options.add ?? [])]);
	const rows: CapturedArtifactRecord[] = [];
	const bytes = new Map<string, Uint8Array>();
	const excludedArtifacts: ExcludedArtifactRecord[] = [];
	for (const [path, source] of all) {
		if (omit.has(path)) continue;
		const row = artifact(path, source);
		if (excluded.has(path)) {
			excludedArtifacts.push({
				canonicalPathKey: row.canonicalPathKey,
				disposition: 'EXCLUDED',
				path,
				physicalFileCount: 1,
				policyId: 'fixture-exclusion',
				primaryClass: row.primaryClass,
				reason: 'Fixture exclusion.',
				roles: row.roles
			});
			continue;
		}
		rows.push(options.mutate?.(row) ?? row);
		if (!(options.omitBytes ?? []).includes(path)) bytes.set(path, encoder.encode(source));
	}
	if (options.duplicatePath !== undefined) {
		const duplicate = rows.find((row) => row.path === options.duplicatePath);
		if (duplicate !== undefined) rows.push({ ...duplicate });
	}
	rows.sort((left, right) => left.path.localeCompare(right.path));
	const subject = {
		artifacts: rows,
		descriptor: { subjectId: options.subjectId ?? SUBJECT_ID },
		diagnostics: [],
		excludedArtifacts,
		generatedContexts: [],
		population: {
			analyzed: rows.filter((row) => row.disposition === 'ANALYZED').length,
			discovered: rows.length + excludedArtifacts.length,
			excluded: excludedArtifacts.length,
			failed: 0,
			included: rows.length,
			inventoryOnly: rows.filter((row) => row.disposition === 'INVENTORY_ONLY').length,
			reconciles: true
		},
		projects: [],
		request: {},
		workspaces: []
	} as unknown as FrozenSubject;
	attachFrozenSubjectBytes(subject, bytes);
	return subject;
}

function request(subject = frozenSubject()): BuildGuardEnforcementLedgerArtifactSetRequest {
	return {
		budgets: {
			maxArtifacts: subject.artifacts.length + 10,
			maxDiagnostics: 100,
			maxTotalBytes: subject.artifacts.reduce((sum, row) => sum + row.bytes, 0) + 1
		},
		operationVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
		subjectId: subject.descriptor.subjectId
	};
}

function complete(subject = frozenSubject()) {
	const result = buildGuardEnforcementLedgerArtifactSet(request(subject), { subject });
	expect(result.outcome).toBe('complete');
	if (result.outcome !== 'complete') throw new Error(result.diagnostics[0]?.message);
	return result.artifactSet;
}

function repair(value: ReturnType<typeof complete>): void {
	const mutable = value as unknown as Record<string, any>;
	mutable.id = guardEnforcementLedgerArtifactSetId({
		artifactContentDigest: canonicalSemanticJsonWitness(mutable.artifacts).sha256,
		method: mutable.method,
		operationVersion: mutable.operationVersion,
		schemaVersion: mutable.schemaVersion,
		subjectId: mutable.subjectId
	});
	mutable.contentDigest = guardEnforcementLedgerArtifactSetContentDigest(mutable as never);
}

describe('JPWB retained guard-enforcement-ledger artifact set', () => {
	it('binds the exact retained, runtime-source, and enforcement-site population deterministically', () => {
		const subject = frozenSubject({
			add: new Map([
				['package.json', '{"private":true}\n'],
				['bun.lock', '[install]\n']
			])
		});
		const first = complete(subject);
		const second = selectGuardEnforcementLedgerArtifactSet(request(subject), { subject });
		expect(second).toEqual({ artifactSet: first, diagnostics: [], outcome: 'complete' });
		expect(first.coverage).toEqual({
			analyzerArtifacts: 1,
			artifacts: 13,
			authorityTestArtifacts: 1,
			enforcementSiteArtifacts: 2,
			ledgerDataArtifacts: 1,
			packageSourceArtifacts: 4,
			reconciles: true,
			stateMachineDeclarationArtifacts: 2,
			totalBytes: first.artifacts.reduce((sum, row) => sum + row.bytes, 0)
		});
		expect(first.artifacts.map((row) => row.path)).toEqual(
			[...first.artifacts.map((row) => row.path)].sort()
		);
		expect(
			first.artifacts
				.filter((row) => row.uses.includes('ENFORCEMENT_SITE_SOURCE'))
				.map((row) => row.path)
		).toEqual([
			'packages/rph-application/src/handlers/execution.ts',
			'packages/rph-application/src/handlers/pwu.ts'
		]);
		expect(first.artifacts.some((row) => row.path.endsWith('/assurance.ts'))).toBe(false);
		expect(validateGuardEnforcementLedgerArtifactSet(first, subject)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('derives runtime package sources but excludes tests, generators, and uncited handlers', () => {
		const artifactSet = complete(
			frozenSubject({
				add: new Map([
					['packages/rph-domain/src/nested/new-domain.ts', 'export const domain = true;\n'],
					['packages/rph-contracts/src/nested/new-contract.ts', 'export const contract = true;\n'],
					['packages/rph-domain/src/nested/new-domain.test.ts', 'export const testOnly = true;\n'],
					['packages/rph-contracts/src/gen/new-generator.ts', 'export const generator = true;\n']
				])
			})
		);
		const paths = new Set(artifactSet.artifacts.map((row) => row.path));
		expect(paths.has('packages/rph-domain/src/nested/new-domain.ts')).toBe(true);
		expect(paths.has('packages/rph-contracts/src/nested/new-contract.ts')).toBe(true);
		for (const path of [
			'packages/rph-domain/src/nested/new-domain.test.ts',
			'packages/rph-contracts/src/gen/new-generator.ts',
			'packages/rph-application/src/handlers/assurance.ts'
		])
			expect(paths.has(path), path).toBe(false);
	});

	it.each([...REQUIRED_SOURCES.keys()])(
		'fails closed when required artifact %s is absent',
		(path) => {
			const subject = frozenSubject({ omitPaths: [path] });
			const result = buildGuardEnforcementLedgerArtifactSet(request(subject), { subject });
			expect(result.outcome).toBe('unavailable');
			expect(result.diagnostics).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: 'REQUIRED_ARTIFACT_MISSING', path })
				])
			);
		}
	);

	it('fails closed for exclusions, duplicate rows, unavailable bytes, and malformed site literals', () => {
		for (const subject of [
			frozenSubject({ excludePaths: ['packages/rph-application/src/handlers/pwu.ts'] }),
			frozenSubject({ duplicatePath: 'packages/rph-domain/src/index.ts' }),
			frozenSubject({ omitBytes: ['packages/rph-contracts/src/index.ts'] }),
			frozenSubject({
				add: new Map([
					[
						'verif/guard-enforcement-ledger.data.ts',
						'export const GUARD_LEDGER = { one: { enforcingSite: makeSite() } };\n'
					]
				])
			})
		]) {
			const result = buildGuardEnforcementLedgerArtifactSet(request(subject), { subject });
			expect(result.outcome).toBe('unavailable');
		}
	});

	it.each([
		[
			'an aliased ledger initializer',
			`const rows = { one: { disposition: "ENFORCED", evidence: "one", enforcingSite: "packages/rph-application/src/handlers/pwu.ts:12" } };
			export const GUARD_LEDGER = rows;
			`
		],
		[
			'a spread ledger population',
			`const rows = { one: { disposition: "ENFORCED", evidence: "one", enforcingSite: "packages/rph-application/src/handlers/pwu.ts:12" } };
			export const GUARD_LEDGER = { ...rows };
			`
		],
		[
			'a dynamic computed guard text',
			`const guardText = "one";
			export const GUARD_LEDGER = { [guardText]: { disposition: "ENFORCED", evidence: "one", enforcingSite: "packages/rph-application/src/handlers/pwu.ts:12" } };
			`
		],
		[
			'an aliased ledger row',
			`const row = { disposition: "ENFORCED", evidence: "one", enforcingSite: "packages/rph-application/src/handlers/pwu.ts:12" };
			export const GUARD_LEDGER = { one: row };
			`
		],
		[
			'a spread ledger row',
			`const row = { disposition: "ENFORCED", evidence: "one", enforcingSite: "packages/rph-application/src/handlers/pwu.ts:12" };
			export const GUARD_LEDGER = { one: { ...row } };
			`
		],
		[
			'a computed ledger-row field',
			`const field = "enforcingSite";
			export const GUARD_LEDGER = { one: { disposition: "ENFORCED", evidence: "one", [field]: "packages/rph-application/src/handlers/pwu.ts:12" } };
			`
		],
		[
			'a shorthand ledger-row field',
			`const enforcingSite = "packages/rph-application/src/handlers/pwu.ts:12";
			export const GUARD_LEDGER = { one: { disposition: "ENFORCED", evidence: "one", enforcingSite } };
			`
		],
		[
			'a post-declaration dynamic mutation',
			`export const GUARD_LEDGER = { one: { disposition: "ENFORCED", evidence: "one", enforcingSite: "packages/rph-application/src/handlers/pwu.ts:12" } };
			Object.assign(GUARD_LEDGER, { two: { disposition: "ENFORCED", evidence: "two", enforcingSite: "packages/rph-application/src/handlers/execution.ts:34" } });
			`
		]
	] as const)('fails closed rather than under-selecting handlers for %s', (_label, source) => {
		const subject = frozenSubject({
			add: new Map([['verif/guard-enforcement-ledger.data.ts', source]])
		});
		const result = buildGuardEnforcementLedgerArtifactSet(request(subject), { subject });
		expect(result.outcome).toBe('unavailable');
		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'POPULATION_RECONCILIATION_FAILED',
					path: 'verif/guard-enforcement-ledger.data.ts'
				})
			])
		);
	});

	it('rejects forged classification metadata, subject mismatches, invalid requests, and caller budget exhaustion', () => {
		const forged = frozenSubject({
			mutate: (row) =>
				row.path === 'verif/guard-enforcement-ledger.ts' ? { ...row, sha256: '0'.repeat(64) } : row
		});
		expect(
			buildGuardEnforcementLedgerArtifactSet(request(forged), { subject: forged }).outcome
		).toBe('unavailable');

		const subject = frozenSubject();
		expect(
			buildGuardEnforcementLedgerArtifactSet(
				{ ...request(subject), subjectId: 'other' },
				{ subject }
			).diagnostics[0]?.code
		).toBe('SUBJECT_ID_MISMATCH');
		expect(
			buildGuardEnforcementLedgerArtifactSet(
				{ ...request(subject), budgets: { ...request(subject).budgets, maxArtifacts: 1 } },
				{ subject }
			).diagnostics.some((item) => item.code === 'BUDGET_EXHAUSTED')
		).toBe(true);
		expect(
			buildGuardEnforcementLedgerArtifactSet({ ...request(subject), extra: true } as never, {
				subject
			}).outcome
		).toBe('unavailable');
		expect(
			buildGuardEnforcementLedgerArtifactSet(request(subject), { subject: {} as FrozenSubject })
				.diagnostics[0]?.code
		).toBe('SUBJECT_CAPABILITY_UNAVAILABLE');
	});

	it('validates exact shape, canonical order, identities, coverage, and FrozenSubject population', () => {
		const subject = frozenSubject();
		const valid = complete(subject);

		const digestTamper = structuredClone(valid) as typeof valid;
		(digestTamper as any).contentDigest = '0'.repeat(64);
		expect(validateGuardEnforcementLedgerArtifactSet(digestTamper).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'CONTENT_DIGEST_MISMATCH' })])
		);

		const populationTamper = structuredClone(valid) as typeof valid;
		(populationTamper.artifacts as any[]).reverse();
		repair(populationTamper);
		expect(validateGuardEnforcementLedgerArtifactSet(populationTamper, subject).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE' }),
				expect.objectContaining({ code: 'POPULATION_MISMATCH' })
			])
		);

		const coverageTamper = structuredClone(valid) as typeof valid;
		(coverageTamper.coverage as any).artifacts += 1;
		repair(coverageTamper);
		expect(validateGuardEnforcementLedgerArtifactSet(coverageTamper, subject).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'POPULATION_MISMATCH' })])
		);

		const negativeBytes = structuredClone(valid);
		(negativeBytes.artifacts[0] as unknown as { bytes: number }).bytes = -1;
		repair(negativeBytes);
		expect(validateGuardEnforcementLedgerArtifactSet(negativeBytes).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'SHAPE_INVALID', path: '$.artifacts[0].bytes' })
			])
		);
		const pathIdentity = structuredClone(valid);
		(pathIdentity.artifacts[0] as unknown as { path: unknown }).path = 1;
		repair(pathIdentity);
		expect(validateGuardEnforcementLedgerArtifactSet(pathIdentity).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'SHAPE_INVALID', path: '$.artifacts[0].path' })
			])
		);

		expect(validateGuardEnforcementLedgerArtifactSet({ ...valid, extra: true })).toEqual({
			issues: [expect.objectContaining({ code: 'SHAPE_INVALID' })],
			state: 'INVALID'
		});
		expect(validateGuardEnforcementLedgerArtifactSet(valid, subject, { maxRecords: 1 }).state).toBe(
			'BUDGET_EXHAUSTED'
		);
		expect(
			validateGuardEnforcementLedgerArtifactSet(valid, undefined, { maxIssues: 0 }).state
		).toBe('INVALID');
	});

	it('rejects duplicate and noncanonically ordered semantic roles', () => {
		for (const mutate of [
			(roles: string[]) => roles.push(roles[0]!),
			(roles: string[]) => roles.reverse()
		]) {
			const artifactSet = structuredClone(complete());
			const artifactIndex = artifactSet.artifacts.findIndex(
				(artifact) => artifact.semanticRoles.length > 1
			);
			expect(artifactIndex).toBeGreaterThanOrEqual(0);
			const roles = (artifactSet.artifacts[artifactIndex] as any).semanticRoles as string[];
			mutate(roles);
			repair(artifactSet);
			expect(validateGuardEnforcementLedgerArtifactSet(artifactSet).issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: 'INVALID_VALUE',
						path: `$.artifacts[${artifactIndex}].semanticRoles`
					})
				])
			);
		}
	});

	it('inspects hostile arrays without invoking accessors and enforces traversal budgets first', () => {
		const valid = complete();
		const hostile = structuredClone(valid) as typeof valid;
		let getterCalls = 0;
		Object.defineProperty(hostile.artifacts, '0', {
			configurable: true,
			enumerable: true,
			get() {
				getterCalls += 1;
				return valid.artifacts[0];
			}
		});
		expect(validateGuardEnforcementLedgerArtifactSet(hostile)).toMatchObject({
			issues: [{ code: 'SHAPE_INVALID', path: '$.artifacts' }],
			state: 'INVALID'
		});
		expect(getterCalls).toBe(0);
		let inheritedCalls = 0;
		class HostileArray<T> extends Array<T> {
			override some(): boolean {
				inheritedCalls += 1;
				return false;
			}
		}
		const subclassed = structuredClone(valid) as typeof valid;
		(subclassed as { artifacts: unknown }).artifacts = new HostileArray(...valid.artifacts);
		expect(validateGuardEnforcementLedgerArtifactSet(subclassed).state).toBe('INVALID');
		expect(inheritedCalls).toBe(0);
		const oversized = structuredClone(valid) as typeof valid;
		(oversized as { artifacts: unknown }).artifacts = new Array(1_000_000);
		expect(
			validateGuardEnforcementLedgerArtifactSet(oversized, undefined, { maxRecords: 1 })
		).toMatchObject({
			issues: [{ code: 'BUDGET_EXHAUSTED', path: '$.artifacts' }],
			state: 'BUDGET_EXHAUSTED'
		});
		const nestedOversized = structuredClone(valid) as typeof valid;
		(nestedOversized.artifacts[0] as { semanticRoles: unknown }).semanticRoles = new Array(
			1_000_000
		);
		expect(
			validateGuardEnforcementLedgerArtifactSet(nestedOversized, undefined, {
				maxRecords: 1_000_000
			}).state
		).toBe('INVALID');
		expect(
			validateGuardEnforcementLedgerArtifactSet(valid, undefined, { maxRecords: 1 })
		).toMatchObject({
			issues: [{ code: 'BUDGET_EXHAUSTED', path: '$.artifacts' }],
			state: 'BUDGET_EXHAUSTED'
		});
		expect(
			validateGuardEnforcementLedgerArtifactSet(valid, undefined, { maxStringCharacters: 1 })
		).toMatchObject({
			issues: [{ code: 'BUDGET_EXHAUSTED', path: '$' }],
			state: 'BUDGET_EXHAUSTED'
		});
	});

	it('covers strict request and validator rejection surfaces without widening selection', () => {
		const subject = frozenSubject();
		let dependencyGetterCalls = 0;
		const hostileDependencies = {};
		Object.defineProperty(hostileDependencies, 'subject', {
			enumerable: true,
			get() {
				dependencyGetterCalls += 1;
				return subject;
			}
		});
		expect(
			buildGuardEnforcementLedgerArtifactSet(request(subject), hostileDependencies as never).outcome
		).toBe('unavailable');
		expect(dependencyGetterCalls).toBe(0);
		for (const malformed of [
			null,
			[],
			{ ...request(subject), budgets: [] },
			{ ...request(subject), schemaVersion: 'wrong' },
			{ ...request(subject), operationVersion: 'wrong' },
			{ ...request(subject), subjectId: '' },
			{ ...request(subject), budgets: { ...request(subject).budgets, maxDiagnostics: 0 } },
			{ ...request(subject), budgets: { ...request(subject).budgets, maxTotalBytes: 1 } }
		])
			expect(buildGuardEnforcementLedgerArtifactSet(malformed as never, { subject }).outcome).toBe(
				'unavailable'
			);

		const valid = complete(subject);
		for (const options of [null, [], { extra: 1 }, { maxIssues: 0 }, { maxRecords: 0 }])
			expect(
				validateGuardEnforcementLedgerArtifactSet(valid, undefined, options as never).state
			).toBe('INVALID');
		expect(validateGuardEnforcementLedgerArtifactSet(valid, {} as FrozenSubject).state).toBe(
			'INVALID'
		);

		const invalid = (mutate: (draft: ReturnType<typeof complete>) => void): void => {
			const draft = structuredClone(valid);
			mutate(draft);
			repair(draft);
			expect(validateGuardEnforcementLedgerArtifactSet(draft).state).not.toBe('VALID');
		};
		invalid((draft) => ((draft as any).schemaVersion = 'wrong'));
		invalid((draft) => ((draft as any).operationVersion = 'wrong'));
		invalid((draft) => ((draft as any).method = 'wrong'));
		invalid((draft) => ((draft as any).canonicalProfile = 'wrong'));
		invalid((draft) => ((draft as any).subjectId = ''));
		invalid((draft) => ((draft.artifacts[0] as any).bytes = -1));
		invalid((draft) => ((draft.artifacts[0] as any).path = '../escape.ts'));
		invalid((draft) => ((draft.artifacts[0] as any).primaryClass = 'WRONG'));
		invalid((draft) => ((draft.artifacts[0] as any).sha256 = 'wrong'));
		invalid((draft) => ((draft.artifacts[0] as any).uses = ['WRONG']));
		invalid((draft) => ((draft.artifacts[0] as any).canonicalPathKey = 'wrong'));
		const wrongId = structuredClone(valid);
		(wrongId as any).id = 'wrong';
		expect(validateGuardEnforcementLedgerArtifactSet(wrongId).state).not.toBe('VALID');
		const wrongOrder = structuredClone(valid);
		(wrongOrder.artifacts as unknown as unknown[]).reverse();
		repair(wrongOrder);
		expect(validateGuardEnforcementLedgerArtifactSet(wrongOrder).state).not.toBe('VALID');
		const wrongRoles = structuredClone(valid);
		(wrongRoles.artifacts[0] as any).semanticRoles = ['WRONG'];
		repair(wrongRoles);
		expect(validateGuardEnforcementLedgerArtifactSet(wrongRoles).state).not.toBe('VALID');

		const empty = structuredClone(valid);
		(empty as any).artifacts = [];
		expect(validateGuardEnforcementLedgerArtifactSet(empty).issues[0]).toMatchObject({
			code: 'SHAPE_INVALID',
			path: '$.artifacts'
		});
		const badCoverage = structuredClone(valid);
		(badCoverage as any).coverage = {};
		expect(validateGuardEnforcementLedgerArtifactSet(badCoverage).issues[0]).toMatchObject({
			code: 'SHAPE_INVALID',
			path: '$.coverage'
		});
		const badNested = structuredClone(valid);
		(badNested.artifacts[0] as any).uses = {};
		expect(validateGuardEnforcementLedgerArtifactSet(badNested).issues[0]).toMatchObject({
			code: 'SHAPE_INVALID',
			path: '$.artifacts[0]'
		});
		const nestedBudget = structuredClone(valid);
		(nestedBudget.artifacts[0] as any).uses = Array.from({ length: 20 }, () => 'ANALYZER_SOURCE');
		expect(
			validateGuardEnforcementLedgerArtifactSet(nestedBudget, undefined, { maxRecords: 15 }).state
		).toBe('BUDGET_EXHAUSTED');
		for (const mutate of [
			(draft: any) => (draft.contentDigest = 1),
			(draft: any) => (draft.artifacts[0] = null),
			(draft: any) => (draft.artifacts[0].bytes = 'one'),
			(draft: any) => (draft.artifacts[0].path = 1),
			(draft: any) => (draft.artifacts[0].semanticRoles = Array.from({ length: 10 }, () => 'x')),
			(draft: any) => (draft.artifacts[0].semanticRoles = [1]),
			(draft: any) => (draft.coverage.analyzerArtifacts = -1),
			(draft: any) => (draft.coverage.reconciles = 'yes')
		]) {
			const draft = structuredClone(valid);
			mutate(draft);
			expect(validateGuardEnforcementLedgerArtifactSet(draft).state).toBe('INVALID');
		}
		const nestedAccessor = structuredClone(valid);
		Object.defineProperty(nestedAccessor.artifacts[0]!.semanticRoles, '0', {
			enumerable: true,
			get: () => 'DECLARATION_SOURCE'
		});
		expect(validateGuardEnforcementLedgerArtifactSet(nestedAccessor).state).toBe('INVALID');
		const nestedStrings = structuredClone(valid);
		(nestedStrings.artifacts[0] as any).semanticRoles = ['x'.repeat(10_000)];
		expect(
			validateGuardEnforcementLedgerArtifactSet(nestedStrings, undefined, {
				maxStringCharacters: 5_000
			}).state
		).toBe('BUDGET_EXHAUSTED');
		expect(
			validateGuardEnforcementLedgerArtifactSet(valid, frozenSubject({ subjectId: 'other' })).issues
		).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'SUBJECT_MISMATCH' })]));
		expect(
			validateGuardEnforcementLedgerArtifactSet(
				valid,
				frozenSubject({ omitBytes: [GUARD_ENFORCEMENT_LEDGER_DATA_PATH] })
			).issues
		).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'POPULATION_MISMATCH' })]));

		const tooManyIssues = structuredClone(valid);
		(tooManyIssues as any).schemaVersion = 'wrong';
		(tooManyIssues as any).operationVersion = 'wrong';
		expect(
			validateGuardEnforcementLedgerArtifactSet(tooManyIssues, undefined, { maxIssues: 1 }).state
		).toBe('BUDGET_EXHAUSTED');
		expect(
			validateGuardEnforcementLedgerArtifactSet(
				new Proxy(valid, {
					ownKeys() {
						throw new Error('hostile');
					}
				}),
				undefined
			).state
		).toBe('INVALID');

		for (const maximum of [1, 2]) {
			const missing = frozenSubject({ omitPaths: [...REQUIRED_SOURCES.keys()].slice(0, 5) });
			const result = buildGuardEnforcementLedgerArtifactSet(
				{ ...request(missing), budgets: { ...request(missing).budgets, maxDiagnostics: maximum } },
				{ subject: missing }
			);
			expect(result.diagnostics).toHaveLength(maximum);
			expect(result.diagnostics.at(-1)?.code).toBe('BUDGET_EXHAUSTED');
		}
	});

	it.each([
		[
			'non-exported ledger',
			'const GUARD_LEDGER = { one: { disposition: "UNENFORCED", evidence: "x" } };\n'
		],
		['empty ledger', 'export const GUARD_LEDGER = {};\n'],
		['missing row fields', 'export const GUARD_LEDGER = { one: { evidence: "x" } };\n'],
		[
			'duplicate guard text',
			'export const GUARD_LEDGER = { one: { disposition: "UNENFORCED", evidence: "x" }, one: { disposition: "UNENFORCED", evidence: "y" } };\n'
		],
		['non-object row', 'export const GUARD_LEDGER = { one: "not a row" };\n'],
		[
			'duplicate row field',
			'export const GUARD_LEDGER = { one: { disposition: "UNENFORCED", disposition: "UNENFORCED", evidence: "x" } };\n'
		],
		[
			'non-string row field',
			'export const GUARD_LEDGER = { one: { disposition: "UNENFORCED", evidence: 1 } };\n'
		],
		[
			'invalid site literal',
			'export const GUARD_LEDGER = { one: { disposition: "ENFORCED", evidence: "x", enforcingSite: "outside.ts:1" } };\n'
		],
		['syntax-invalid ledger', 'export const GUARD_LEDGER = { one: ;\n']
	] as const)('rejects %s during direct ledger grammar selection', (_label, source) => {
		const subject = frozenSubject({
			add: new Map([[GUARD_ENFORCEMENT_LEDGER_DATA_PATH, source]])
		});
		expect(buildGuardEnforcementLedgerArtifactSet(request(subject), { subject }).outcome).toBe(
			'unavailable'
		);
	});
});
