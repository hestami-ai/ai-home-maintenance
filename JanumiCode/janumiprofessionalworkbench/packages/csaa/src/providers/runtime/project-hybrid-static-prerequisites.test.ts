import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { FrozenSubject, FrozenSubjectFreshness } from '../../contracts/subject.js';
import { canonicalJson, sha256 } from '../../inventory/canonical.js';
import { transferFrozenSubjectBytes } from '../../subject/frozen-store.js';
import { verifyFrozenSubject } from '../../subject/freshness.js';
import {
	DETERMINISTIC_RUNTIME_TRACE_INPUT_SCHEMA_VERSION,
	DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID,
	EXTERNAL_TOOL_ATTEMPT_REQUIRED_FIELDS,
	importDeterministicRuntimeTrace
} from './import-runtime-trace.js';
import {
	JPWB_HYBRID_STATIC_CAPABILITIES,
	JPWB_HYBRID_STATIC_PROJECTOR_ID,
	JPWB_HYBRID_STATIC_PROJECTION_DEFAULT_BUDGETS,
	JPWB_HYBRID_STATIC_PROJECTION_LIMITATIONS,
	JPWB_HYBRID_STATIC_REQUIRED_PATHS,
	evaluateProjectedHybridRuntimeRows,
	hybridStaticPrerequisiteProjectionDigest,
	projectJpwbHybridStaticPrerequisites
} from './project-hybrid-static-prerequisites.js';
import {
	cleanupProviderFixtures,
	providerContext,
	providerFixture
} from './provider-evidence.test-support.js';
import type { ProviderImportContext } from './provider-evidence.js';

afterEach(cleanupProviderFixtures);

const OBSERVED_AT = '2026-08-25T12:00:01.500Z';
const ASSESSED_AT = '2026-08-25T12:00:02.000Z';
const CURRENT: FrozenSubjectFreshness = Object.freeze({
	changedPaths: Object.freeze([]),
	diagnostics: Object.freeze([]),
	state: 'CURRENT'
});

const RISKY_SOURCES = Object.freeze({
	'package.json': '{"name":"provider-fixture","private":true,"workspaces":["packages/*","apps/*"]}',
	'apps/rph-demo/package.json': '{"name":"@fixture/rph-demo","private":true,"version":"0.0.0"}',
	'apps/rph-demo/tsconfig.json': '{"include":["src"]}',
	'packages/demo/src/index.ts': 'export const fixtureAnchor = true;\n',
	'packages/rph-application/package.json':
		'{"name":"@fixture/rph-application","private":true,"version":"0.0.0"}',
	'packages/rph-application/tsconfig.json': '{"include":["src"]}',
	[JPWB_HYBRID_STATIC_REQUIRED_PATHS[9]]: `
function newEngine() { return createEngine({}); }
function uiCommand() {
	return { issuedBy: { actorId: 'ui-user', actorType: 'HUMAN' }, payload: true };
}
`,
	[JPWB_HYBRID_STATIC_REQUIRED_PATHS[19]]: `
class CommandBus {
	dispatchStamped(command: any) {
		const prior = this.store.getReceipt(command.idempotencyKey);
		if (prior) return this.answerFromReceipt(prior, command, 'payload-hash');
	}
	answerFromReceipt(prior: any, command: any, payloadHash: string) {
		return { commandId: prior.commandId, producedEventIds: prior.producedEventIds };
	}
}
`,
	[JPWB_HYBRID_STATIC_REQUIRED_PATHS[45]]: `
async function runPwaFloor() {
	const graphExport = { outputs: [] };
	const ctx = { reasoningReview: { content: JSON.stringify({ ...graphExport }) } };
	const plan = await runFloorAndPlanRecording(subject, ctx, registry);
	recordAssuranceRecordingPlan(engine, plan, {});
}
`,
	[JPWB_HYBRID_STATIC_REQUIRED_PATHS[54]]: `
const proposeDecision = (ctx: any, command: any, payload: any) => {
	const p = payload;
	const state = { authority: p.authority };
	return state;
};
function makeDecisionEffective() {
	return (ctx: any, command: any) => {
		const authority = state.authority;
		const authorityHeld = authority?.actorType === 'HUMAN';
		return authorityHeld;
	};
}
`,
	[JPWB_HYBRID_STATIC_REQUIRED_PATHS[55]]: `
async function agyPrint() {
	const args = ['--print', 'prompt'];
	const { stdout } = await execFileAsync(AGY_BIN, args, {
		timeout: 240000,
		maxBuffer: 1024,
		windowsHide: true
	});
	return stdout;
}
`
});

const SAFE_SOURCES = Object.freeze({
	'package.json': '{"name":"provider-fixture","private":true,"workspaces":["packages/*","apps/*"]}',
	'apps/rph-demo/package.json': '{"name":"@fixture/rph-demo","private":true,"version":"0.0.0"}',
	'apps/rph-demo/tsconfig.json': '{"include":["src"]}',
	'packages/demo/src/index.ts': 'export const fixtureAnchor = true;\n',
	'packages/rph-application/package.json':
		'{"name":"@fixture/rph-application","private":true,"version":"0.0.0"}',
	'packages/rph-application/tsconfig.json': '{"include":["src"]}',
	[JPWB_HYBRID_STATIC_REQUIRED_PATHS[9]]: `
function newEngine() {
	return createEngine({ authenticate: standaloneAuthenticator() });
}
function uiCommand() { return { payload: true }; }
function uiSession() { return getEngine().as(SESSION_CREDENTIAL); }
`,
	[JPWB_HYBRID_STATIC_REQUIRED_PATHS[19]]: `
class CommandBus {
	dispatchStamped(command: any) {
		const prior = this.store.getReceipt(command.idempotencyKey);
		if (prior) return this.answerFromReceipt(prior, command, 'payload-hash');
	}
	answerFromReceipt(prior: any, command: any, payloadHash: string) {
		const reused = [
			prior.commandType !== command.commandType,
			prior.targetAggregateId !== command.targetAggregateId,
			prior.payloadHash !== payloadHash
		];
		return reused;
	}
}
`,
	[JPWB_HYBRID_STATIC_REQUIRED_PATHS[45]]: `
async function runPwaFloor() {
	const graphExport = { outputs: [] };
	for (const output of graphExport.outputs) {
		const ctx = { reasoningReview: { content: JSON.stringify(output) } };
		const plan = await runFloorAndPlanRecording(subject, ctx, registry);
		recordAssuranceRecordingPlan(engine, plan, {});
	}
}
`,
	[JPWB_HYBRID_STATIC_REQUIRED_PATHS[54]]: `
const proposeDecision = (ctx: any, command: any, payload: any) => {
	const p = payload;
	const state = { authority: p.authority };
	return state;
};
function makeDecisionEffective() {
	return (ctx: any, command: any) => {
		const authority = state.authority;
		const authorityHeld = authority?.actorType === 'HUMAN';
		if (authority.actorId === command.issuedBy.actorId)
			return reject(command, 'RPH_AUTHORITY_INSUFFICIENT', 'same actor');
		return authorityHeld;
	};
}
`,
	[JPWB_HYBRID_STATIC_REQUIRED_PATHS[55]]: `
async function agyPrint() {
	const args = ['--print', 'prompt'];
	const { stdout } = await execFileAsync(AGY_BIN, args, {
		timeout: 240000,
		maxBuffer: 1024,
		windowsHide: true
	});
	recordExternalToolAttempt({
		attemptId: 'attempt-1',
		commandIdentity: 'command',
		environmentIdentity: 'environment',
		exitOutcome: 'exited',
		inputProvenance: 'input',
		outputValidation: 'validated',
		subjectIdentity: 'subject',
		timeBound: 'bounded'
	});
	return stdout;
}
`
});

function projection(subject: FrozenSubject, freshness = CURRENT) {
	return projectJpwbHybridStaticPrerequisites({
		freshness,
		observedAt: OBSERVED_AT,
		subject
	});
}

const A = sha256('a');
const B = sha256('b');
const ACTOR = sha256('actor');

function defectEvents() {
	return [
		{
			data: {
				authenticated: false,
				endpointId: 'workbench-command',
				identitySource: 'FABRICATED',
				outcome: 'ACCEPTED',
				principalKind: 'HUMAN'
			},
			kind: 'AUTHENTICATION_DECISION'
		},
		{
			data: {
				firstRequestSha256: A,
				idempotencyKeySha256: sha256('key'),
				outcome: 'PRIOR_RESULT_RETURNED',
				secondRequestSha256: B
			},
			kind: 'IDEMPOTENCY_REPLAY'
		},
		{
			data: { material: true, outputId: 'output-a', turnId: 'turn-1' },
			kind: 'AUTHORING_TRANSFORMATION'
		},
		{
			data: { material: true, outputId: 'output-b', turnId: 'turn-1' },
			kind: 'AUTHORING_TRANSFORMATION'
		},
		{
			data: { outputId: null, scope: 'TURN', turnId: 'turn-1' },
			kind: 'ASSESSMENT_RECORDED'
		},
		{
			data: {
				action: 'PROPOSED',
				actorSha256: ACTOR,
				resourceId: 'decision-1',
				resourceKind: 'DECISION'
			},
			kind: 'GOVERNANCE_ACTION'
		},
		{
			data: {
				action: 'APPROVED',
				actorSha256: ACTOR,
				resourceId: 'decision-1',
				resourceKind: 'DECISION'
			},
			kind: 'GOVERNANCE_ACTION'
		},
		{
			data: { attemptId: 'attempt-1', fieldsPresent: ['ATTEMPT_ID'], outcome: 'EXITED' },
			kind: 'EXTERNAL_TOOL_ATTEMPT'
		}
	];
}

function negativeEvents() {
	return [
		{
			data: {
				authenticated: false,
				endpointId: 'workbench-command',
				identitySource: 'NONE',
				outcome: 'REJECTED',
				principalKind: 'UNKNOWN'
			},
			kind: 'AUTHENTICATION_DECISION'
		},
		{
			data: {
				firstRequestSha256: A,
				idempotencyKeySha256: sha256('key'),
				outcome: 'CONFLICT_REJECTED',
				secondRequestSha256: B
			},
			kind: 'IDEMPOTENCY_REPLAY'
		},
		{
			data: { material: true, outputId: 'output-a', turnId: 'turn-1' },
			kind: 'AUTHORING_TRANSFORMATION'
		},
		{
			data: { material: true, outputId: 'output-b', turnId: 'turn-1' },
			kind: 'AUTHORING_TRANSFORMATION'
		},
		{
			data: { outputId: 'output-a', scope: 'OUTPUT', turnId: 'turn-1' },
			kind: 'ASSESSMENT_RECORDED'
		},
		{
			data: { outputId: 'output-b', scope: 'OUTPUT', turnId: 'turn-1' },
			kind: 'ASSESSMENT_RECORDED'
		},
		{
			data: {
				action: 'PROPOSED',
				actorSha256: ACTOR,
				resourceId: 'decision-1',
				resourceKind: 'DECISION'
			},
			kind: 'GOVERNANCE_ACTION'
		},
		{
			data: {
				action: 'APPROVED',
				actorSha256: sha256('different-actor'),
				resourceId: 'decision-1',
				resourceKind: 'DECISION'
			},
			kind: 'GOVERNANCE_ACTION'
		},
		{
			data: {
				attemptId: 'attempt-1',
				fieldsPresent: [...EXTERNAL_TOOL_ATTEMPT_REQUIRED_FIELDS],
				outcome: 'EXITED'
			},
			kind: 'EXTERNAL_TOOL_ATTEMPT'
		}
	];
}

function rawTrace(
	context: ProviderImportContext,
	events: readonly { readonly data: unknown; readonly kind: string }[]
) {
	return {
		artifacts: [{ kind: 'TRACE', path: 'verif/runtime.trace.json', sha256: sha256('trace') }],
		coverage: { findingIds: [9, 19, 45, 54, 55], missingFindingIds: [] as number[] },
		events: events.map((event, sequence) => ({
			...event,
			at: '2026-08-25T12:00:00.500Z',
			sequence
		})),
		runBindingSha256: sha256(canonicalJson(context.run)),
		schemaVersion: DETERMINISTIC_RUNTIME_TRACE_INPUT_SCHEMA_VERSION
	};
}

function importedTrace(
	root: string,
	subject: FrozenSubject,
	events: readonly { readonly data: unknown; readonly kind: string }[]
) {
	const context = providerContext(root, subject, DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID);
	return importDeterministicRuntimeTrace(JSON.stringify(rawTrace(context, events)), context);
}

describe('source-bound JPWB hybrid static prerequisite projection', () => {
	it('projects the exact five risky rows with source population, binding, and provenance', () => {
		const fixture = providerFixture(RISKY_SOURCES);
		const first = projection(fixture.subject);
		const second = projection(fixture.subject);

		expect(
			first.rows.map((row) => [row.findingId, row.capability, row.prerequisite.state])
		).toEqual([
			[9, 'TAINT', 'SATISFIED'],
			[19, 'DFG', 'SATISFIED'],
			[45, 'DFG', 'SATISFIED'],
			[54, 'TAINT', 'SATISFIED'],
			[55, 'TAINT', 'SATISFIED']
		]);
		expect(first.population).toEqual({
			conflicting: 0,
			conclusive: 5,
			expected: 5,
			produced: 5,
			reconciles: true,
			unsupported: 0
		});
		expect(first).toMatchObject({
			analysisAuthority: 'NONE',
			gateEffect: 'NONE',
			projector: { id: JPWB_HYBRID_STATIC_PROJECTOR_ID },
			subject: {
				fileManifestDigest: fixture.subject.descriptor.fileManifestDigest,
				subjectId: fixture.subject.descriptor.subjectId
			}
		});
		expect(first.limitations).toEqual(JPWB_HYBRID_STATIC_PROJECTION_LIMITATIONS);
		expect(first.prerequisites).toEqual(first.rows.map((row) => row.prerequisite));
		for (const row of first.rows) {
			const artifact = fixture.subject.artifacts.find(
				(candidate) => candidate.path === row.requiredPath
			)!;
			expect(row.sourceBinding).toEqual({ bytes: artifact.bytes, sha256: artifact.sha256 });
			expect(row.capability).toBe(JPWB_HYBRID_STATIC_CAPABILITIES[row.findingId]);
			expect(row.prerequisite).toMatchObject({
				evidenceIds: [expect.stringMatching(/^[a-f0-9]{64}$/u)],
				freshness: 'CURRENT',
				providerId: JPWB_HYBRID_STATIC_PROJECTOR_ID,
				subjectId: fixture.subject.descriptor.subjectId
			});
			expect(row.witnesses.length).toBeGreaterThan(0);
			for (const witness of row.witnesses) {
				expect(witness.path).toBe(row.requiredPath);
				expect(witness.sha256).toMatch(/^[a-f0-9]{64}$/u);
				expect(witness.end).toBeGreaterThan(witness.start);
			}
		}
		expect(second).toEqual(first);
		expect(hybridStaticPrerequisiteProjectionDigest(second)).toBe(
			hybridStaticPrerequisiteProjectionDigest(first)
		);
	});

	it('returns NOT_SATISFIED only for all five recognized nearby-safe layouts', () => {
		const fixture = providerFixture(SAFE_SOURCES);
		const result = projection(fixture.subject);
		expect(result.rows.map((row) => [row.findingId, row.prerequisite.state])).toEqual([
			[9, 'NOT_SATISFIED'],
			[19, 'NOT_SATISFIED'],
			[45, 'NOT_SATISFIED'],
			[54, 'NOT_SATISFIED'],
			[55, 'NOT_SATISFIED']
		]);
		expect(result.population).toMatchObject({ conclusive: 5, unsupported: 0 });
		expect(result.rows.every((row) => row.prerequisite.evidenceIds.length === 1)).toBe(true);
	});

	it('composes projected prerequisites with supplied traces for every detected and non-detected row', () => {
		const risky = providerFixture(RISKY_SOURCES);
		const riskyProjection = projection(risky.subject);
		const detected = evaluateProjectedHybridRuntimeRows({
			assessedAt: ASSESSED_AT,
			projection: riskyProjection,
			trace: importedTrace(risky.root, risky.subject, defectEvents())
		});
		expect(detected.rows.map((row) => [row.findingId, row.status])).toEqual([
			[9, 'DETECTED'],
			[19, 'DETECTED'],
			[45, 'DETECTED'],
			[54, 'DETECTED'],
			[55, 'DETECTED']
		]);

		const runtimeNegative = evaluateProjectedHybridRuntimeRows({
			assessedAt: ASSESSED_AT,
			projection: riskyProjection,
			trace: importedTrace(risky.root, risky.subject, negativeEvents())
		});
		expect(runtimeNegative.rows.every((row) => row.status === 'NOT_DETECTED')).toBe(true);

		const safe = providerFixture(SAFE_SOURCES);
		const staticNegative = evaluateProjectedHybridRuntimeRows({
			assessedAt: ASSESSED_AT,
			projection: projection(safe.subject),
			trace: importedTrace(safe.root, safe.subject, defectEvents())
		});
		expect(staticNegative.rows.every((row) => row.status === 'NOT_DETECTED')).toBe(true);
	});

	it('projects the exact current JPWB source bytes without substituting live reads during analysis', () => {
		const currentSources = Object.fromEntries([
			[
				'package.json',
				'{"name":"provider-fixture","private":true,"workspaces":["packages/*","apps/*"]}'
			],
			[
				'apps/rph-demo/package.json',
				'{"name":"@fixture/rph-demo","private":true,"version":"0.0.0"}'
			],
			['apps/rph-demo/tsconfig.json', '{"include":["src"]}'],
			['packages/demo/src/index.ts', 'export const fixtureAnchor = true;\n'],
			[
				'packages/rph-application/package.json',
				'{"name":"@fixture/rph-application","private":true,"version":"0.0.0"}'
			],
			['packages/rph-application/tsconfig.json', '{"include":["src"]}'],
			...Object.values(JPWB_HYBRID_STATIC_REQUIRED_PATHS).map((path) => [
				path,
				readFileSync(join(process.cwd(), ...path.split('/')), 'utf8')
			])
		]);
		const fixture = providerFixture(currentSources);
		const result = projection(fixture.subject);
		expect(result.rows.map((row) => [row.findingId, row.prerequisite.state])).toEqual([
			[9, 'NOT_SATISFIED'],
			[19, 'NOT_SATISFIED'],
			[45, 'SATISFIED'],
			[54, 'SATISFIED'],
			[55, 'SATISFIED']
		]);
		expect(result.rows.every((row) => row.sourceBinding !== null)).toBe(true);
	});

	it('keeps frozen-byte conclusions deterministic while live mutation makes them stale', () => {
		const fixture = providerFixture(RISKY_SOURCES);
		const current = projection(fixture.subject);
		writeFileSync(
			join(fixture.root, ...JPWB_HYBRID_STATIC_REQUIRED_PATHS[9].split('/')),
			SAFE_SOURCES[JPWB_HYBRID_STATIC_REQUIRED_PATHS[9]]!,
			'utf8'
		);
		const freshness = verifyFrozenSubject(fixture.subject, { rootLocator: fixture.root });
		expect(freshness).toMatchObject({ state: 'STALE' });
		expect(freshness.changedPaths).toContain(JPWB_HYBRID_STATIC_REQUIRED_PATHS[9]);
		const stale = projection(fixture.subject, freshness);
		expect(stale.rows.map((row) => row.prerequisite.state)).toEqual(
			current.rows.map((row) => row.prerequisite.state)
		);
		expect(stale.prerequisites.every((prerequisite) => prerequisite.freshness === 'STALE')).toBe(
			true
		);
		const evaluation = evaluateProjectedHybridRuntimeRows({
			assessedAt: ASSESSED_AT,
			projection: stale,
			trace: importedTrace(fixture.root, fixture.subject, defectEvents())
		});
		expect(evaluation.rows.every((row) => row.status === 'NOT_RUN')).toBe(true);

		const changed = providerFixture(SAFE_SOURCES);
		const changedProjection = projection(changed.subject);
		expect(changed.subject.descriptor.subjectId).not.toBe(fixture.subject.descriptor.subjectId);
		expect(changedProjection.rows[0]!.prerequisite.state).toBe('NOT_SATISFIED');
		expect(changedProjection.rows[0]!.prerequisite.evidenceIds).not.toEqual(
			current.rows[0]!.prerequisite.evidenceIds
		);
	});

	it('fails closed for missing, duplicated, aliased, malformed, and budget-exhausted regions', () => {
		const missingSources = { ...RISKY_SOURCES };
		delete missingSources[JPWB_HYBRID_STATIC_REQUIRED_PATHS[55]];
		const missing = projection(providerFixture(missingSources).subject);
		expect(missing.rows[4]).toMatchObject({
			prerequisite: { evidenceIds: [], state: 'UNSUPPORTED' },
			reasonCode: 'REQUIRED_ARTIFACT_MISSING',
			sourceBinding: null
		});

		const original = providerFixture(RISKY_SOURCES).subject;
		const target = original.artifacts.find(
			(artifact) => artifact.path === JPWB_HYBRID_STATIC_REQUIRED_PATHS[9]
		)!;
		const inventoryOnly = {
			...original,
			artifacts: Object.freeze(
				original.artifacts.map((artifact) =>
					artifact.path === target.path
						? Object.freeze({ ...artifact, disposition: 'INVENTORY_ONLY' as const })
						: artifact
				)
			)
		} as FrozenSubject;
		transferFrozenSubjectBytes(original, inventoryOnly);
		expect(projection(inventoryOnly).rows[0]).toMatchObject({
			prerequisite: { evidenceIds: [], state: 'UNSUPPORTED' },
			reasonCode: 'ARTIFACT_BINDING_MISMATCH'
		});

		const duplicated = {
			...original,
			artifacts: Object.freeze([...original.artifacts, target])
		} as FrozenSubject;
		transferFrozenSubjectBytes(original, duplicated);
		expect(projection(duplicated).rows[0]).toMatchObject({
			prerequisite: { state: 'CONFLICTING' },
			reasonCode: 'REQUIRED_ARTIFACT_AMBIGUOUS'
		});

		const aliasedSources = {
			...RISKY_SOURCES,
			[JPWB_HYBRID_STATIC_REQUIRED_PATHS[9]]: `
const readEngine = getEngine;
function newEngine() { return createEngine({ authenticate: standaloneAuthenticator() }); }
function uiCommand() { return { payload: true }; }
function uiSession() { return readEngine().as(SESSION_CREDENTIAL); }
`
		};
		expect(projection(providerFixture(aliasedSources).subject).rows[0]).toMatchObject({
			prerequisite: { state: 'UNSUPPORTED' },
			reasonCode: 'CRITICAL_SYMBOL_ALIASED'
		});

		const malformedSources = {
			...RISKY_SOURCES,
			[JPWB_HYBRID_STATIC_REQUIRED_PATHS[45]]: 'async function runPwaFloor( {'
		};
		expect(projection(providerFixture(malformedSources).subject).rows[2]).toMatchObject({
			prerequisite: { state: 'UNSUPPORTED' },
			reasonCode: 'SOURCE_PARSE_MALFORMED'
		});

		const boundedFixture = providerFixture(RISKY_SOURCES);
		const byteBounded = projectJpwbHybridStaticPrerequisites({
			budgets: { ...JPWB_HYBRID_STATIC_PROJECTION_DEFAULT_BUDGETS, maxSourceBytesPerArtifact: 64 },
			freshness: CURRENT,
			observedAt: OBSERVED_AT,
			subject: boundedFixture.subject
		});
		expect(byteBounded.rows.every((row) => row.reasonCode === 'SOURCE_BYTE_BUDGET_EXHAUSTED')).toBe(
			true
		);
		const astBounded = projectJpwbHybridStaticPrerequisites({
			budgets: { ...JPWB_HYBRID_STATIC_PROJECTION_DEFAULT_BUDGETS, maxAstNodesPerArtifact: 32 },
			freshness: CURRENT,
			observedAt: OBSERVED_AT,
			subject: boundedFixture.subject
		});
		expect(astBounded.rows.some((row) => row.reasonCode === 'SOURCE_AST_BUDGET_EXHAUSTED')).toBe(
			true
		);
		expect(byteBounded.population).toMatchObject({ expected: 5, produced: 5, reconciles: true });
	});

	it('rejects forged, proxy, accessor-bearing, and trace-mismatched inputs', () => {
		const fixture = providerFixture(RISKY_SOURCES);
		expect(() => projection({ ...fixture.subject } as FrozenSubject)).toThrow(
			/exact nonserialized FrozenSubject byte capability/u
		);
		expect(() =>
			projectJpwbHybridStaticPrerequisites(
				new Proxy({ freshness: CURRENT, observedAt: OBSERVED_AT, subject: fixture.subject }, {})
			)
		).toThrow(/non-Proxy plain record/u);
		let invoked = false;
		const accessor = { freshness: CURRENT, observedAt: OBSERVED_AT } as Record<string, unknown>;
		Object.defineProperty(accessor, 'subject', {
			enumerable: true,
			get() {
				invoked = true;
				return fixture.subject;
			}
		});
		expect(() =>
			projectJpwbHybridStaticPrerequisites(
				accessor as unknown as Parameters<typeof projectJpwbHybridStaticPrerequisites>[0]
			)
		).toThrow(/rejects accessors/u);
		expect(invoked).toBe(false);

		const other = providerFixture(SAFE_SOURCES);
		expect(() =>
			evaluateProjectedHybridRuntimeRows({
				assessedAt: ASSESSED_AT,
				projection: projection(fixture.subject),
				trace: importedTrace(other.root, other.subject, defectEvents())
			})
		).toThrow(/not bound/u);
	});

	it('admits only closed request, budget, freshness, timestamp, and subject identities', () => {
		const fixture = providerFixture(RISKY_SOURCES);
		const validRequest = () => ({
			freshness: CURRENT,
			observedAt: OBSERVED_AT,
			subject: fixture.subject
		});
		const cases: Array<(request: Record<string, unknown>) => void> = [
			(request) => Object.setPrototypeOf(request, { inherited: true }),
			(request) => (request.extra = true),
			(request) =>
				(request.budgets = {
					...JPWB_HYBRID_STATIC_PROJECTION_DEFAULT_BUDGETS,
					maxAstDepthPerArtifact: 7
				}),
			(request) => (request.freshness = { changedPaths: [], diagnostics: [], state: 'UNKNOWN' }),
			(request) => (request.freshness = { changedPaths: null, diagnostics: [], state: 'STALE' }),
			(request) => (request.freshness = { changedPaths: [''], diagnostics: [], state: 'STALE' }),
			(request) =>
				(request.freshness = {
					changedPaths: ['src/a.ts', 'src/a.ts'],
					diagnostics: [],
					state: 'STALE'
				}),
			(request) =>
				(request.freshness = {
					changedPaths: [],
					diagnostics: new Array(100_001).fill(null),
					state: 'STALE'
				}),
			(request) =>
				(request.freshness = {
					changedPaths: ['src/a.ts'],
					diagnostics: [],
					state: 'CURRENT'
				}),
			(request) => (request.observedAt = '2026-08-25T12:00:01Z')
		];

		for (const mutate of cases) {
			const request = validRequest() as unknown as Record<string, unknown>;
			mutate(request);
			expect(() =>
				projectJpwbHybridStaticPrerequisites(
					request as unknown as Parameters<typeof projectJpwbHybridStaticPrerequisites>[0]
				)
			).toThrow(TypeError);
		}

		const invalidSubject = {
			...fixture.subject,
			descriptor: Object.freeze({ ...fixture.subject.descriptor, subjectId: '' })
		} as FrozenSubject;
		transferFrozenSubjectBytes(fixture.subject, invalidSubject);
		expect(() => projection(invalidSubject)).toThrow(/subject identity is invalid/u);
	});

	it('classifies conflicting and unsupported layouts without promoting them to evidence', () => {
		const variant = (findingId: 9 | 19 | 45 | 54 | 55, source: string) => {
			const subject = providerFixture({
				...RISKY_SOURCES,
				[JPWB_HYBRID_STATIC_REQUIRED_PATHS[findingId]]: source
			}).subject;
			return projection(subject).rows.find((row) => row.findingId === findingId)!;
		};
		const cases: ReadonlyArray<{
			findingId: 9 | 19 | 45 | 54 | 55;
			reasonCode:
				| 'CRITICAL_SYMBOL_ALIASED'
				| 'LAYOUT_UNRECOGNIZED'
				| 'REQUIRED_ARTIFACT_AMBIGUOUS'
				| 'SAFE_AND_RISK_LAYOUT_CONFLICT';
			source: string;
			state: 'CONFLICTING' | 'UNSUPPORTED';
		}> = [
			{
				findingId: 9,
				reasonCode: 'REQUIRED_ARTIFACT_AMBIGUOUS',
				source: 'function newEngine() {} function newEngine() {} function uiCommand() {}',
				state: 'CONFLICTING'
			},
			{
				findingId: 9,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: 'function newEngine() {}',
				state: 'UNSUPPORTED'
			},
			{
				findingId: 9,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: 'function newEngine() {} function uiCommand() { return { issuedBy: identity() }; }',
				state: 'UNSUPPORTED'
			},
			{
				findingId: 9,
				reasonCode: 'SAFE_AND_RISK_LAYOUT_CONFLICT',
				source: `function newEngine() { return createEngine({ authenticate: standaloneAuthenticator() }); }
function uiCommand() { return { issuedBy: { actorId: 'a', actorType: 'HUMAN' } }; }
function uiSession() { return getEngine().as(SESSION_CREDENTIAL); }`,
				state: 'CONFLICTING'
			},
			{
				findingId: 9,
				reasonCode: 'CRITICAL_SYMBOL_ALIASED',
				source:
					"import { getEngine as readEngine } from 'engine'; function newEngine() {} function uiCommand() {}",
				state: 'UNSUPPORTED'
			},
			{
				findingId: 9,
				reasonCode: 'CRITICAL_SYMBOL_ALIASED',
				source:
					'const { getEngine: readEngine } = services; function newEngine() {} function uiCommand() {}',
				state: 'UNSUPPORTED'
			},
			{
				findingId: 19,
				reasonCode: 'REQUIRED_ARTIFACT_AMBIGUOUS',
				source: `class Bus { dispatchStamped() {} dispatchStamped() {}
answerFromReceipt() {} }`,
				state: 'CONFLICTING'
			},
			{
				findingId: 19,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: 'class Bus { dispatchStamped() {} }',
				state: 'UNSUPPORTED'
			},
			{
				findingId: 19,
				reasonCode: 'CRITICAL_SYMBOL_ALIASED',
				source: `class Bus { dispatchStamped(command: any) {
const prior = this.store.getReceipt(command.idempotencyKey); return this.answerFromReceipt(prior, command); }
answerFromReceipt(prior: any) { const cached = prior; return cached; } }`,
				state: 'UNSUPPORTED'
			},
			{
				findingId: 19,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: `class Bus { dispatchStamped(command: any) {
this.store.getReceipt(); return this.answerFromReceipt(command); }
answerFromReceipt(prior: any, command: any) { return prior; } }`,
				state: 'UNSUPPORTED'
			},
			{
				findingId: 19,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: `class Bus { dispatchStamped(command: any) {
const prior = this.store.getReceipt(command.idempotencyKey); return this.answerFromReceipt(prior, command); }
answerFromReceipt(prior: any, command: any) {
return prior.commandType !== command.commandType; } }`,
				state: 'UNSUPPORTED'
			},
			{
				findingId: 45,
				reasonCode: 'CRITICAL_SYMBOL_ALIASED',
				source: 'const record = recordAssuranceRecordingPlan; async function runPwaFloor() {}',
				state: 'UNSUPPORTED'
			},
			{
				findingId: 45,
				reasonCode: 'REQUIRED_ARTIFACT_AMBIGUOUS',
				source: 'function runPwaFloor() {} function runPwaFloor() {}',
				state: 'CONFLICTING'
			},
			{
				findingId: 45,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: 'const floor = true;',
				state: 'UNSUPPORTED'
			},
			{
				findingId: 45,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: `function runPwaFloor() { const ctx = { reasoningReview: review() };
runFloorAndPlanRecording(); recordAssuranceRecordingPlan(); return ctx; }`,
				state: 'UNSUPPORTED'
			},
			{
				findingId: 45,
				reasonCode: 'REQUIRED_ARTIFACT_AMBIGUOUS',
				source: `function runPwaFloor() { const ctx = { reasoningReview: { content: JSON.stringify(graph) } };
runFloorAndPlanRecording(); runFloorAndPlanRecording(); recordAssuranceRecordingPlan(); return ctx; }`,
				state: 'CONFLICTING'
			},
			{
				findingId: 45,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: `function runPwaFloor() { const ctx = { reasoningReview: { content: makeContent() } };
runFloorAndPlanRecording(); recordAssuranceRecordingPlan(); return ctx; }`,
				state: 'UNSUPPORTED'
			},
			{
				findingId: 45,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: `function runPwaFloor() { const ctx = { reasoningReview: { content: JSON.stringify() } };
runFloorAndPlanRecording(); recordAssuranceRecordingPlan(); return ctx; }`,
				state: 'UNSUPPORTED'
			},
			{
				findingId: 45,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: `function runPwaFloor() { const ctx = { reasoningReview: { content: JSON.stringify(graph) } };
runFloorAndPlanRecording(); recordAssuranceRecordingPlan(); return ctx; }`,
				state: 'UNSUPPORTED'
			},
			{
				findingId: 54,
				reasonCode: 'CRITICAL_SYMBOL_ALIASED',
				source: 'const propose = proposeDecision; function makeDecisionEffective() {}',
				state: 'UNSUPPORTED'
			},
			{
				findingId: 54,
				reasonCode: 'REQUIRED_ARTIFACT_AMBIGUOUS',
				source:
					'function proposeDecision() {} function proposeDecision() {} function makeDecisionEffective() {}',
				state: 'CONFLICTING'
			},
			{
				findingId: 54,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: 'function proposeDecision() {}',
				state: 'UNSUPPORTED'
			},
			{
				findingId: 54,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: 'function proposeDecision() {} function makeDecisionEffective() {}',
				state: 'UNSUPPORTED'
			},
			{
				findingId: 55,
				reasonCode: 'CRITICAL_SYMBOL_ALIASED',
				source: 'const run = execFileAsync; async function agyPrint() {}',
				state: 'UNSUPPORTED'
			},
			{
				findingId: 55,
				reasonCode: 'REQUIRED_ARTIFACT_AMBIGUOUS',
				source: 'async function agyPrint() {} async function agyPrint() {}',
				state: 'CONFLICTING'
			},
			{
				findingId: 55,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: 'const value = true;',
				state: 'UNSUPPORTED'
			},
			{
				findingId: 55,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: 'async function agyPrint() { await execFileAsync(AGY_BIN); }',
				state: 'UNSUPPORTED'
			},
			{
				findingId: 55,
				reasonCode: 'REQUIRED_ARTIFACT_AMBIGUOUS',
				source: `async function agyPrint() { const args = [];
await execFileAsync(AGY_BIN, args, { timeout: 1, maxBuffer: 1, windowsHide: true });
await execFileAsync(AGY_BIN, args, { timeout: 1, maxBuffer: 1, windowsHide: true }); }`,
				state: 'CONFLICTING'
			},
			{
				findingId: 55,
				reasonCode: 'REQUIRED_ARTIFACT_AMBIGUOUS',
				source: `async function agyPrint() { const args = [];
await execFileAsync(AGY_BIN, args, { timeout: 1, maxBuffer: 1, windowsHide: true });
recordExternalToolAttempt({}); recordExternalToolAttempt({}); }`,
				state: 'CONFLICTING'
			},
			{
				findingId: 55,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: `async function agyPrint() { const args = [];
await execFileAsync(AGY_BIN, args, { timeout: 1, maxBuffer: 1, windowsHide: true });
recordExternalToolAttempt(attempt); }`,
				state: 'UNSUPPORTED'
			},
			{
				findingId: 55,
				reasonCode: 'LAYOUT_UNRECOGNIZED',
				source: `async function agyPrint() { const args = [];
await execFileAsync(AGY_BIN, args, { timeout: 1, maxBuffer: 1, windowsHide: true });
recordExternalToolAttempt({ attemptId: 'a' }); }`,
				state: 'UNSUPPORTED'
			}
		];

		for (const testCase of cases) {
			const row = variant(testCase.findingId, testCase.source);
			expect(row).toMatchObject({
				prerequisite: { evidenceIds: [], state: testCase.state },
				reasonCode: testCase.reasonCode,
				witnesses: expect.any(Array)
			});
		}
	});
});
