import {
	ARROW_COMMAND_CENSUS_ADAPTER_ID,
	ARROW_COMMAND_CENSUS_AUTHORITY_TRANSFER,
	ARROW_COMMAND_CENSUS_CANONICAL_PROFILE,
	ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_007_CONFORMANCE,
	ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_008_CONFORMANCE,
	ARROW_COMMAND_CENSUS_GATE_EFFECT,
	ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY,
	ARROW_COMMAND_CENSUS_LIMITATIONS,
	ARROW_COMMAND_CENSUS_METHOD,
	ARROW_COMMAND_CENSUS_OBSERVATION_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_ORACLE_CHANGE,
	ARROW_COMMAND_CENSUS_REPLACEMENT_EQUIVALENCE,
	ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY,
	type ArrowCommandCensusArrowRecord,
	type ArrowCommandCensusArtifactSetBinding,
	type ArrowCommandCensusBaselineComparisonItem,
	type ArrowCommandCensusDeclaredArrowRecord,
	type ArrowCommandCensusDeclaredSiteRecord,
	type ArrowCommandCensusExecutorIdentity,
	type ArrowCommandCensusObservation,
	type ArrowCommandCensusObservationId,
	type ArrowCommandCensusRawDeclaredArrow,
	type ArrowCommandCensusRawOutput,
	type ArrowCommandCensusRawOutputIdentity,
	type ArrowCommandCensusSourceSite,
	type ObserveArrowCommandCensusRequest
} from '../../contracts/arrow-command-census.js';
import { compareText, sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJson, isUnicodeScalarString } from '../../semantic/canonical.js';
import {
	arrowCommandCensusDeclaredArrowId,
	arrowCommandCensusDeclaredSiteId,
	arrowCommandCensusObservationContentDigest,
	arrowCommandCensusObservationId,
	arrowCommandCensusRawOutputId
} from './arrow-command-census-content.js';

export class ArrowCommandCensusNormalizationError extends Error {
	constructor(
		readonly path: string,
		message: string
	) {
		super(message);
	}
}

function fail(path: string, message: string): never {
	throw new ArrowCommandCensusNormalizationError(path, message);
}

type PlainRecord = Record<string, unknown>;

function exactRecord(value: unknown, path: string, keys: readonly string[]): PlainRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		fail(path, 'Expected an exact plain record.');
	let prototype: object | null;
	let ownKeys: readonly PropertyKey[];
	try {
		prototype = Reflect.getPrototypeOf(value);
		ownKeys = Reflect.ownKeys(value);
	} catch {
		return fail(path, 'Expected an inspectable plain record.');
	}
	if (prototype !== Object.prototype && prototype !== null) fail(path, 'Expected a plain record.');
	if (
		ownKeys.length !== keys.length ||
		ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))
	)
		fail(path, 'Record field population is not exact.');
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			fail(`${path}.${key}`, 'Expected an enumerable data property.');
	}
	return value as PlainRecord;
}

function recordData(record: PlainRecord, key: string): unknown {
	return Reflect.getOwnPropertyDescriptor(record, key)?.value;
}

function positiveSafeInteger(value: unknown, path: string): void {
	if (!Number.isSafeInteger(value) || (value as number) < 1)
		fail(path, 'Expected a positive safe integer.');
}

function sha256Text(value: unknown, path: string): void {
	if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value))
		fail(path, 'Expected a lowercase SHA-256 digest.');
}

function nonemptyText(value: unknown, path: string): void {
	if (typeof value !== 'string' || value.length === 0 || !isUnicodeScalarString(value))
		fail(path, 'Expected nonempty Unicode scalar text.');
}

function assertExecutorIdentity(
	value: unknown
): asserts value is ArrowCommandCensusExecutorIdentity {
	const path = '$input.executor';
	const executor = exactRecord(value, path, [
		'adapterId',
		'adapterVersion',
		'executableBytes',
		'executableSha256',
		'externalModules',
		'retainedVerifierCanonicalPathKey',
		'retainedVerifierSha256',
		'runtime',
		'runtimeVersion',
		'worker'
	]);
	if (recordData(executor, 'adapterId') !== ARROW_COMMAND_CENSUS_ADAPTER_ID)
		fail(`${path}.adapterId`, 'Executor adapter identity is unsupported.');
	if (recordData(executor, 'adapterVersion') !== ARROW_COMMAND_CENSUS_OPERATION_VERSION)
		fail(`${path}.adapterVersion`, 'Executor adapter version is unsupported.');
	positiveSafeInteger(recordData(executor, 'executableBytes'), `${path}.executableBytes`);
	sha256Text(recordData(executor, 'executableSha256'), `${path}.executableSha256`);
	nonemptyText(
		recordData(executor, 'retainedVerifierCanonicalPathKey'),
		`${path}.retainedVerifierCanonicalPathKey`
	);
	sha256Text(recordData(executor, 'retainedVerifierSha256'), `${path}.retainedVerifierSha256`);
	if (recordData(executor, 'runtime') !== 'bun')
		fail(`${path}.runtime`, 'Executor runtime must be Bun.');
	nonemptyText(recordData(executor, 'runtimeVersion'), `${path}.runtimeVersion`);
	const worker = exactRecord(recordData(executor, 'worker'), `${path}.worker`, ['bytes', 'sha256']);
	positiveSafeInteger(recordData(worker, 'bytes'), `${path}.worker.bytes`);
	sha256Text(recordData(worker, 'sha256'), `${path}.worker.sha256`);
	const modules = recordData(executor, 'externalModules');
	if (!Array.isArray(modules) || modules.length !== 3)
		fail(`${path}.externalModules`, 'Expected exactly TypeScript, ULID, and Zod identities.');
	const names = ['typescript', 'ulid', 'zod'] as const;
	for (const [index, name] of names.entries()) {
		const modulePath = `${path}.externalModules[${index}]`;
		const module = exactRecord(modules[index], modulePath, [
			'bytes',
			'contentDigest',
			'files',
			'name',
			'version'
		]);
		if (recordData(module, 'name') !== name)
			fail(`${modulePath}.name`, 'External module identities are incomplete or noncanonical.');
		positiveSafeInteger(recordData(module, 'bytes'), `${modulePath}.bytes`);
		positiveSafeInteger(recordData(module, 'files'), `${modulePath}.files`);
		sha256Text(recordData(module, 'contentDigest'), `${modulePath}.contentDigest`);
		nonemptyText(recordData(module, 'version'), `${modulePath}.version`);
	}
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertUnique(values: readonly string[], path: string): void {
	if (new Set(values).size !== values.length) fail(path, 'Population contains duplicate values.');
}

function assertCanonicalStrings(values: readonly string[], path: string): void {
	assertUnique(values, path);
	for (let index = 1; index < values.length; index += 1)
		if (compareText(values[index - 1]!, values[index]!) >= 0)
			fail(path, 'Set-valued population is not strictly canonically ordered.');
}

function assertCanonicalStateMaps(
	values: ArrowCommandCensusRawOutput['births'] | ArrowCommandCensusRawOutput['occupiable'],
	path: string
): void {
	for (let index = 0; index < values.length; index += 1) {
		const entry = values[index]!;
		if (index > 0 && values[index - 1]!.machine >= entry.machine)
			fail(path, 'State-map machines are not strictly canonically ordered.');
		assertUnique(entry.states, `${path}[${index}].states`);
		for (let stateIndex = 1; stateIndex < entry.states.length; stateIndex += 1)
			if (entry.states[stateIndex - 1]! >= entry.states[stateIndex]!)
				fail(`${path}[${index}].states`, 'States are not strictly canonically ordered.');
	}
}

function arrowKey(machine: string, from: string, to: string): string {
	return `${machine}  ${from} -> ${to}`;
}

function parseArrowKey(value: string, path: string): ArrowCommandCensusArrowRecord {
	if (!isUnicodeScalarString(value) || value.length === 0)
		fail(path, 'Arrow key must be nonempty Unicode scalar text.');
	const machineSeparator = value.indexOf('  ');
	const arrowSeparator = value.indexOf(' -> ', machineSeparator + 2);
	if (machineSeparator <= 0 || arrowSeparator <= machineSeparator + 2)
		fail(path, 'Arrow key does not use the retained machine/from/to grammar.');
	const machine = value.slice(0, machineSeparator);
	const from = value.slice(machineSeparator + 2, arrowSeparator);
	const to = value.slice(arrowSeparator + 4);
	if (
		to.length === 0 ||
		machine.includes('  ') ||
		from.includes(' -> ') ||
		to.includes(' -> ') ||
		arrowKey(machine, from, to) !== value
	)
		fail(path, 'Arrow key is ambiguous or noncanonical.');
	return { arrowKey: value, from, machine, to };
}

function commandDeclarationPath(locator: string): string | null {
	if (/^STEP_COMMAND_SPECS\.[^\s]+$/u.test(locator))
		return 'packages/rph-domain/src/step-command-spec.ts';
	if (
		/^(?:PWU_LIFECYCLE_COMMAND_SPECS|PWU_GENERIC_SETTER_SPECS|PWU_RECOVERY_COMMAND_SPECS)\.[^\s]+$/u.test(
			locator
		)
	)
		return 'packages/rph-domain/src/pwu-lifecycle-command-spec.ts';
	return null;
}

function sourceSite(
	locator: string,
	path: string,
	artifactSet: ArrowCommandCensusArtifactSetBinding
): ArrowCommandCensusSourceSite {
	const handler = /^([^/\\:]+\.ts):([1-9]\d*)$/u.exec(locator);
	if (handler !== null) {
		const line = Number(handler[2]);
		if (!Number.isSafeInteger(line)) fail(path, 'Handler line is not a safe integer.');
		const handlerPath = `packages/rph-application/src/handlers/${handler[1]}`;
		const bindings = artifactSet.artifacts.filter(
			(artifact) => artifact.path === handlerPath && artifact.uses.includes('HANDLER_SOURCE')
		);
		if (bindings.length !== 1)
			fail(path, 'Handler site does not bind exactly one selected handler-source artifact.');
		return {
			line,
			locator,
			path: handlerPath
		};
	}
	const declarationPath = commandDeclarationPath(locator);
	if (declarationPath !== null) {
		const bindings = artifactSet.artifacts.filter(
			(artifact) =>
				artifact.path === declarationPath && artifact.uses.includes('COMMAND_DECLARATIONS')
		);
		if (bindings.length !== 1)
			fail(path, 'Table site does not bind exactly one command-declaration artifact.');
		return { line: null, locator, path: null };
	}
	fail(path, 'Declaration site does not use a retained-verifier locator grammar.');
}

function comparison(
	actualCount: number,
	baselineCount: number,
	matches: boolean
): ArrowCommandCensusBaselineComparisonItem {
	return { actualCount, baselineCount, matches };
}

function rawIdentity(evidence: ArrowCommandCensusRawOutput): ArrowCommandCensusRawOutputIdentity {
	const bytes = new TextEncoder().encode(canonicalSemanticJson(evidence));
	const base = {
		bytes: bytes.byteLength,
		encoding: 'UTF-8' as const,
		exitCode: 0 as const,
		format: 'JSON' as const,
		schemaVersion: evidence.schemaVersion,
		sha256: sha256(bytes)
	};
	return { ...base, id: arrowCommandCensusRawOutputId(base) };
}

function assertRequestBinding(
	request: ObserveArrowCommandCensusRequest,
	artifactSet: ArrowCommandCensusArtifactSetBinding
): void {
	if (request.subjectId !== artifactSet.subjectId)
		fail('$input.request.subjectId', 'Request and artifact-set subjects differ.');
	if (request.artifactSetId !== artifactSet.id)
		fail('$input.request.artifactSetId', 'Request and artifact-set identities differ.');
	if (request.operationVersion !== ARROW_COMMAND_CENSUS_OPERATION_VERSION)
		fail('$input.request.operationVersion', 'Unsupported observation operation version.');
}

function assertCanonicalEvidencePopulations(evidence: ArrowCommandCensusRawOutput): void {
	assertCanonicalStateMaps(evidence.births, '$input.evidence.births');
	assertCanonicalStateMaps(evidence.occupiable, '$input.evidence.occupiable');
	for (const [path, values] of [
		['$input.evidence.baseline.dead', evidence.baseline.dead],
		['$input.evidence.baseline.orphans', evidence.baseline.orphans],
		['$input.evidence.baseline.unanalysed', evidence.baseline.unanalysed],
		['$input.evidence.baseline.uncovered', evidence.baseline.uncovered],
		['$input.evidence.census.orphans', evidence.census.orphans],
		['$input.evidence.census.uncovered', evidence.census.uncovered],
		['$input.evidence.deadCovered.dead', evidence.deadCovered.dead],
		['$input.evidence.deadCovered.unanalysed', evidence.deadCovered.unanalysed]
	] as const)
		assertCanonicalStrings(values, path);
	for (const [path, values] of [
		['$input.evidence.baseline.dead', evidence.baseline.dead],
		['$input.evidence.baseline.uncovered', evidence.baseline.uncovered]
	] as const)
		for (const [index, value] of values.entries()) parseArrowKey(value, `${path}[${index}]`);
}

function assertUncoveredArrowsAreUndeclared(
	uncoveredArrows: readonly ArrowCommandCensusArrowRecord[],
	declaredArrowKeys: ReadonlySet<string>
): void {
	for (const [index, arrow] of uncoveredArrows.entries())
		if (declaredArrowKeys.has(arrow.arrowKey))
			fail(
				`$input.evidence.census.uncovered[${index}]`,
				'Uncovered arrow is also present in the retained declared-arrow population.'
			);
}

function assertBirthMachinesAreOccupiable(
	evidence: ArrowCommandCensusRawOutput,
	occupiableByMachine: ReadonlyMap<string, ReadonlySet<string>>
): void {
	if (
		evidence.births.length !== evidence.occupiable.length ||
		evidence.births.some((entry) => !occupiableByMachine.has(entry.machine))
	)
		fail(
			'$input.evidence.occupiable',
			'Occupiable and birth machine populations must be identical.'
		);
}

function assertBirthStatesAreOccupiable(
	births: ArrowCommandCensusRawOutput['births'],
	occupiableByMachine: ReadonlyMap<string, ReadonlySet<string>>
): void {
	for (const [index, entry] of births.entries()) {
		const occupiableStates = occupiableByMachine.get(entry.machine)!;
		if (entry.states.some((state) => !occupiableStates.has(state)))
			fail(
				`$input.evidence.births[${index}]`,
				'Every birth state must be represented as occupiable.'
			);
	}
}

function assertDeadCoveredArrows(
	deadCoveredArrows: readonly ArrowCommandCensusArrowRecord[],
	declaredArrowKeys: ReadonlySet<string>,
	occupiableByMachine: ReadonlyMap<string, ReadonlySet<string>>
): void {
	for (const [index, arrow] of deadCoveredArrows.entries()) {
		if (!declaredArrowKeys.has(arrow.arrowKey))
			fail(
				`$input.evidence.deadCovered.dead[${index}]`,
				'Dead-covered arrow is absent from the declared-arrow population.'
			);
		const occupiableStates = occupiableByMachine.get(arrow.machine);
		if (occupiableStates === undefined || occupiableStates.has(arrow.from))
			fail(
				`$input.evidence.deadCovered.dead[${index}]`,
				'Dead-covered arrow must name an analysed machine with an unoccupiable source.'
			);
	}
}

interface DeclaredSiteAccumulator {
	readonly arrows: ArrowCommandCensusDeclaredArrowRecord[];
	readonly id: ReturnType<typeof arrowCommandCensusDeclaredSiteId>;
	readonly ordinal: number;
	readonly source: ArrowCommandCensusSourceSite;
}

function resolveDeclaredSite(
	siteByLocator: Map<string, DeclaredSiteAccumulator>,
	locator: string,
	index: number,
	observationId: ArrowCommandCensusObservationId,
	artifactSet: ArrowCommandCensusArtifactSetBinding
): DeclaredSiteAccumulator {
	const existing = siteByLocator.get(locator);
	if (existing !== undefined) return existing;
	const source = sourceSite(locator, `$input.evidence.declaredArrows[${index}].site`, artifactSet);
	const site: DeclaredSiteAccumulator = {
		arrows: [],
		id: arrowCommandCensusDeclaredSiteId(observationId, source),
		ordinal: siteByLocator.size,
		source
	};
	siteByLocator.set(locator, site);
	return site;
}

function projectDeclaredArrows(
	evidence: ArrowCommandCensusRawOutput,
	observationId: ArrowCommandCensusObservationId,
	artifactSet: ArrowCommandCensusArtifactSetBinding
): {
	readonly declaredArrows: ArrowCommandCensusDeclaredArrowRecord[];
	readonly declaredSites: ArrowCommandCensusDeclaredSiteRecord[];
} {
	const siteByLocator = new Map<string, DeclaredSiteAccumulator>();
	const declaredArrows: ArrowCommandCensusDeclaredArrowRecord[] = [];
	for (const [index, arrow] of evidence.declaredArrows.entries()) {
		const site = resolveDeclaredSite(siteByLocator, arrow.site, index, observationId, artifactSet);
		const ordinalAtSite = site.arrows.length;
		const record: ArrowCommandCensusDeclaredArrowRecord = {
			arrowKey: arrowKey(arrow.machine, arrow.from, arrow.to),
			from: arrow.from,
			id: arrowCommandCensusDeclaredArrowId(
				observationId,
				site.id,
				ordinalAtSite,
				arrow as ArrowCommandCensusRawDeclaredArrow
			),
			machine: arrow.machine,
			ordinalAtSite,
			siteId: site.id,
			to: arrow.to
		};
		site.arrows.push(record);
		declaredArrows.push(record);
	}
	const declaredSites: ArrowCommandCensusDeclaredSiteRecord[] = [...siteByLocator.values()].map(
		(site) => ({
			arrowIds: site.arrows.map((arrow) => arrow.id),
			id: site.id,
			ordinal: site.ordinal,
			source: site.source
		})
	);
	return { declaredArrows, declaredSites };
}

export interface NormalizeArrowCommandCensusInput {
	readonly artifactSet: ArrowCommandCensusArtifactSetBinding;
	readonly evidence: ArrowCommandCensusRawOutput;
	readonly executor: ArrowCommandCensusExecutorIdentity;
	readonly request: ObserveArrowCommandCensusRequest;
}

export interface NormalizeArrowCommandCensusResult {
	readonly baselineMismatch: boolean;
	readonly observation: ArrowCommandCensusObservation;
}

/** Pure projection from bounded retained evidence into the CSAA observation contract. */
export function normalizeArrowCommandCensusObservation(
	input: NormalizeArrowCommandCensusInput
): NormalizeArrowCommandCensusResult {
	const { artifactSet, evidence, executor, request } = input;
	assertExecutorIdentity(executor);
	assertRequestBinding(request, artifactSet);

	assertCanonicalEvidencePopulations(evidence);

	const uncoveredArrows = evidence.census.uncovered.map((value, index) =>
		parseArrowKey(value, `$input.evidence.census.uncovered[${index}]`)
	);
	const deadCoveredArrows = evidence.deadCovered.dead.map((value, index) =>
		parseArrowKey(value, `$input.evidence.deadCovered.dead[${index}]`)
	);
	const coveredInScopeTopologyArrows = evidence.census.total - uncoveredArrows.length;
	if (coveredInScopeTopologyArrows < 0)
		fail(
			'$input.evidence.census',
			'Uncovered population exceeds the in-scope topology denominator.'
		);
	const declaredArrowKeys = new Set(
		evidence.declaredArrows.map((arrow) => arrowKey(arrow.machine, arrow.from, arrow.to))
	);
	assertUncoveredArrowsAreUndeclared(uncoveredArrows, declaredArrowKeys);
	const occupiableByMachine = new Map(
		evidence.occupiable.map((entry) => [entry.machine, new Set(entry.states)])
	);
	assertBirthMachinesAreOccupiable(evidence, occupiableByMachine);
	assertBirthStatesAreOccupiable(evidence.births, occupiableByMachine);
	assertDeadCoveredArrows(deadCoveredArrows, declaredArrowKeys, occupiableByMachine);
	const declaredMachines = [...new Set(evidence.declaredArrows.map((arrow) => arrow.machine))].sort(
		compareText
	);
	const declaredMachineSet = new Set(declaredMachines);
	const unanalysedMachineSet = new Set(evidence.deadCovered.unanalysed);
	const uncoveredMachineSet = new Set(uncoveredArrows.map((arrow) => arrow.machine));
	if (
		declaredMachines.some(
			(machine) =>
				(!occupiableByMachine.has(machine) || uncoveredMachineSet.has(machine)) &&
				!unanalysedMachineSet.has(machine)
		) ||
		evidence.deadCovered.unanalysed.some((machine) => !declaredMachineSet.has(machine))
	)
		fail(
			'$input.evidence.deadCovered.unanalysed',
			'Unanalysed machines must include declared machines without occupancy or with uncovered arrows and must not name undeclared machines.'
		);
	if (evidence.census.orphans.some((machine) => declaredMachines.includes(machine)))
		fail(
			'$input.evidence.census.orphans',
			'Orphan machines must be absent from the declared-arrow machine population.'
		);
	if (coveredInScopeTopologyArrows > declaredArrowKeys.size)
		fail(
			'$input.evidence.census',
			'Covered topology-arrow count exceeds the unique declared-arrow population.'
		);

	const rawOutput = rawIdentity(evidence);
	const observationId = arrowCommandCensusObservationId({
		artifactSetDigest: artifactSet.artifactSetDigest,
		artifactSetId: artifactSet.id,
		canonicalProfile: ARROW_COMMAND_CENSUS_CANONICAL_PROFILE,
		executor,
		method: ARROW_COMMAND_CENSUS_METHOD,
		operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
		rawOutputId: rawOutput.id,
		schemaVersion: ARROW_COMMAND_CENSUS_OBSERVATION_SCHEMA_VERSION,
		subjectId: request.subjectId
	});

	const { declaredArrows, declaredSites } = projectDeclaredArrows(
		evidence,
		observationId,
		artifactSet
	);

	const actual = {
		deadCovered: evidence.deadCovered.dead,
		orphanMachines: evidence.census.orphans,
		totalInScopeTopologyArrows: evidence.census.total,
		unanalysedMachines: evidence.deadCovered.unanalysed,
		uncoveredArrows: evidence.census.uncovered
	};
	const baseline = {
		deadCoveredArrowKeys: evidence.baseline.dead,
		orphanMachines: evidence.baseline.orphans,
		totalInScopeTopologyArrows: evidence.baseline.total,
		unanalysedMachines: evidence.baseline.unanalysed,
		uncoveredArrowKeys: evidence.baseline.uncovered
	};
	const baselineComparison = {
		deadCovered: comparison(
			actual.deadCovered.length,
			baseline.deadCoveredArrowKeys.length,
			sameStrings(actual.deadCovered, baseline.deadCoveredArrowKeys)
		),
		orphanMachines: comparison(
			actual.orphanMachines.length,
			baseline.orphanMachines.length,
			sameStrings(actual.orphanMachines, baseline.orphanMachines)
		),
		totalInScopeTopologyArrows: comparison(
			actual.totalInScopeTopologyArrows,
			baseline.totalInScopeTopologyArrows,
			actual.totalInScopeTopologyArrows === baseline.totalInScopeTopologyArrows
		),
		unanalysedMachines: comparison(
			actual.unanalysedMachines.length,
			baseline.unanalysedMachines.length,
			sameStrings(actual.unanalysedMachines, baseline.unanalysedMachines)
		),
		uncoveredArrows: comparison(
			actual.uncoveredArrows.length,
			baseline.uncoveredArrowKeys.length,
			sameStrings(actual.uncoveredArrows, baseline.uncoveredArrowKeys)
		)
	};
	const baselineMatches = [
		baselineComparison.deadCovered,
		baselineComparison.orphanMachines,
		baselineComparison.totalInScopeTopologyArrows,
		baselineComparison.unanalysedMachines,
		baselineComparison.uncoveredArrows
	].every((item) => item.matches);

	const content = {
		artifactSet,
		authorityTransfer: ARROW_COMMAND_CENSUS_AUTHORITY_TRANSFER,
		baseline,
		baselineComparison: { ...baselineComparison, matches: baselineMatches },
		births: evidence.births,
		budgets: request.budgets,
		canonicalProfile: ARROW_COMMAND_CENSUS_CANONICAL_PROFILE,
		census: {
			deadCovered: deadCoveredArrows,
			orphanMachines: evidence.census.orphans,
			totalInScopeTopologyArrows: evidence.census.total,
			unanalysedMachines: evidence.deadCovered.unanalysed,
			uncoveredArrows
		},
		coverage: {
			baselineMatches,
			birthMachines: evidence.births.length,
			birthStates: evidence.births.reduce((total, entry) => total + entry.states.length, 0),
			coveredInScopeTopologyArrows,
			deadCoveredArrows: deadCoveredArrows.length,
			declaredArrowOccurrences: declaredArrows.length,
			declaredSites: declaredSites.length,
			machinesWithDeclaredArrows: new Set(declaredArrows.map((arrow) => arrow.machine)).size,
			occupiableMachines: evidence.occupiable.length,
			occupiableStates: evidence.occupiable.reduce(
				(total, entry) => total + entry.states.length,
				0
			),
			orphanMachines: evidence.census.orphans.length,
			reconciles: true,
			totalInScopeTopologyArrows: evidence.census.total,
			unanalysedMachines: evidence.deadCovered.unanalysed.length,
			uncoveredArrows: uncoveredArrows.length
		},
		declaredArrows,
		declaredSites,
		epistemic: {
			capabilityCoverage: 'PARTIAL' as const,
			conflictState: 'NOT_EVALUATED' as const,
			executionHealth: baselineMatches ? ('SUCCEEDED' as const) : ('PARTIAL' as const),
			freshness: 'SUBJECT_AND_EXECUTOR_BOUND' as const,
			inferenceState: 'MIXED_DECLARED_AND_TOPOLOGY_INFERRED' as const,
			supportBasis: 'RETAINED_VERIFIER_MIXED_DECLARATION_AND_TOPOLOGY' as const
		},
		executor,
		fullJanCsaa007Conformance: ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_007_CONFORMANCE,
		fullJanCsaa008Conformance: ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_008_CONFORMANCE,
		gateEffect: ARROW_COMMAND_CENSUS_GATE_EFFECT,
		id: observationId,
		integrationStrategy: ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY,
		limitations: ARROW_COMMAND_CENSUS_LIMITATIONS,
		method: ARROW_COMMAND_CENSUS_METHOD,
		occupiable: evidence.occupiable,
		operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
		oracleChange: ARROW_COMMAND_CENSUS_ORACLE_CHANGE,
		rawEvidence: evidence,
		rawOutput,
		replacementEquivalence: ARROW_COMMAND_CENSUS_REPLACEMENT_EQUIVALENCE,
		schemaVersion: ARROW_COMMAND_CENSUS_OBSERVATION_SCHEMA_VERSION,
		subjectId: request.subjectId,
		verifierAuthority: ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY
	};
	const observation: ArrowCommandCensusObservation = {
		...content,
		contentDigest: arrowCommandCensusObservationContentDigest(content)
	};
	return { baselineMismatch: !baselineMatches, observation };
}
