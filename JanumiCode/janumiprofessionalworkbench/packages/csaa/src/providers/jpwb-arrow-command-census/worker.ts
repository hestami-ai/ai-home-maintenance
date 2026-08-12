import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ARROW_COMMAND_CENSUS_WORKER_REQUEST_SCHEMA_VERSION =
	'jan-csaa-arrow-command-census-worker-request/1.0.0' as const;
export const ARROW_COMMAND_CENSUS_WORKER_RESULT_SCHEMA_VERSION =
	'jan-csaa-arrow-command-census-worker-result/1.0.0' as const;

export interface ArrowCommandCensusWorkerRequest {
	readonly analyzerPath: string;
	readonly capsuleRoot: string;
	readonly schemaVersion: typeof ARROW_COMMAND_CENSUS_WORKER_REQUEST_SCHEMA_VERSION;
}

export interface ArrowCommandCensusWorkerDeclaredArrow {
	readonly from: string;
	readonly machine: string;
	readonly site: string;
	readonly to: string;
}

export interface ArrowCommandCensusWorkerStateMapEntry {
	readonly machine: string;
	readonly states: readonly string[];
}

export interface ArrowCommandCensusWorkerFindingSet {
	readonly dead: readonly string[];
	readonly orphans: readonly string[];
	readonly total: number;
	readonly unanalysed: readonly string[];
	readonly uncovered: readonly string[];
}

export interface ArrowCommandCensusWorkerResult {
	readonly analyzerResolvedPath: string;
	readonly baseline: ArrowCommandCensusWorkerFindingSet;
	readonly birthStates: readonly ArrowCommandCensusWorkerStateMapEntry[];
	readonly census: Pick<ArrowCommandCensusWorkerFindingSet, 'orphans' | 'total' | 'uncovered'>;
	readonly contractsResolvedPath: string;
	readonly deadCovered: Pick<ArrowCommandCensusWorkerFindingSet, 'dead' | 'unanalysed'>;
	readonly declaredArrows: readonly ArrowCommandCensusWorkerDeclaredArrow[];
	readonly domainResolvedPath: string;
	readonly occupiable: readonly ArrowCommandCensusWorkerStateMapEntry[];
	readonly runtime: {
		readonly bunVersion: string;
		readonly typescriptResolvedPath: string;
		readonly typescriptVersion: string;
		readonly ulidResolvedPath: string;
		readonly ulidVersion: string;
		readonly zodResolvedPath: string;
		readonly zodVersion: string;
	};
	readonly schemaVersion: typeof ARROW_COMMAND_CENSUS_WORKER_RESULT_SCHEMA_VERSION;
}

interface BunRuntime {
	readonly version: string;
	resolveSync(specifier: string, from: string): string;
}

interface RetainedAnalyzerModule {
	birthStates(): unknown;
	census(): unknown;
	deadCovered(): unknown;
	declaredArrows(): unknown;
	occupiable(): unknown;
}

const BASELINE_RELATIVE_PATH = 'verif/arrow-command-census.baseline.json';
const ANALYZER_RELATIVE_PATH = 'verif/arrow-command-census.ts';
const REQUIRED_ANALYZER_EXPORTS = [
	'birthStates',
	'census',
	'deadCovered',
	'declaredArrows',
	'occupiable'
] as const;

function fail(message: string): never {
	throw new Error(`arrow-command-census worker: ${message}`);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;

const requireExactKeys = (
	value: Record<string, unknown>,
	expected: readonly string[],
	label: string
): void => {
	const actual = Object.keys(value).sort(compareText);
	const canonicalExpected = [...expected].sort(compareText);
	if (
		actual.length !== canonicalExpected.length ||
		actual.some((key, index) => key !== canonicalExpected[index])
	) {
		fail(`${label} must contain exactly: ${canonicalExpected.join(', ')}`);
	}
};

const requireNonemptyString = (value: unknown, label: string): string => {
	if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
		fail(`${label} must be a non-empty string without NUL characters`);
	}
	return value;
};

const decodeUtf8 = (bytes: Uint8Array, label: string): string => {
	try {
		// Preserve a leading BOM in the decoded text so the explicit rejection
		// below is effective. The default decoder strips it before inspection.
		const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
		if (text.charCodeAt(0) === 0xfeff) fail(`${label} must not contain a UTF-8 BOM`);
		return text;
	} catch (error) {
		if (error instanceof Error && error.message.startsWith('arrow-command-census worker:'))
			throw error;
		return fail(`${label} is not valid UTF-8`);
	}
};

export const parseArrowCommandCensusWorkerRequest = (
	inputBytes: Uint8Array
): ArrowCommandCensusWorkerRequest => {
	const inputText = decodeUtf8(inputBytes, 'request');
	let parsed: unknown;
	try {
		parsed = JSON.parse(inputText);
	} catch {
		return fail('request must be exactly one valid JSON value');
	}
	if (!isRecord(parsed)) fail('request must be a JSON object');
	requireExactKeys(parsed, ['analyzerPath', 'capsuleRoot', 'schemaVersion'], 'request');
	if (parsed.schemaVersion !== ARROW_COMMAND_CENSUS_WORKER_REQUEST_SCHEMA_VERSION) {
		fail(`unsupported request schemaVersion: ${String(parsed.schemaVersion)}`);
	}
	return {
		analyzerPath: requireNonemptyString(parsed.analyzerPath, 'request.analyzerPath'),
		capsuleRoot: requireNonemptyString(parsed.capsuleRoot, 'request.capsuleRoot'),
		schemaVersion: ARROW_COMMAND_CENSUS_WORKER_REQUEST_SCHEMA_VERSION
	};
};

const canonicalExistingPath = (path: string, label: string): string => {
	try {
		return realpathSync.native(path);
	} catch {
		return fail(`${label} does not resolve to an existing path`);
	}
};

const requireDirectory = (path: string, label: string): void => {
	if (!statSync(path).isDirectory()) fail(`${label} must resolve to a directory`);
};

const requireFile = (path: string, label: string): void => {
	if (!statSync(path).isFile()) fail(`${label} must resolve to a regular file`);
};

const requireContained = (capsuleRoot: string, candidate: string, label: string): void => {
	const pathFromRoot = relative(capsuleRoot, candidate);
	if (
		pathFromRoot === '' ||
		pathFromRoot === '..' ||
		pathFromRoot.startsWith(`..${sep}`) ||
		isAbsolute(pathFromRoot)
	) {
		fail(`${label} must resolve to a file inside capsuleRoot`);
	}
};

const capsuleRelativePath = (capsuleRoot: string, candidate: string, label: string): string => {
	requireContained(capsuleRoot, candidate, label);
	return relative(capsuleRoot, candidate).replaceAll('\\', '/');
};

const canonicalResolvedModulePath = (
	bun: BunRuntime,
	specifier: string,
	from: string,
	label: string
): string => {
	let resolvedPath: string;
	try {
		const resolution = bun.resolveSync(specifier, from);
		resolvedPath = resolution.startsWith('file:') ? fileURLToPath(resolution) : resolution;
	} catch {
		return fail(`${label} cannot be resolved from the retained analyzer`);
	}
	const canonicalPath = canonicalExistingPath(resolvedPath, label);
	requireFile(canonicalPath, label);
	return canonicalPath;
};

const parseStringArray = (value: unknown, label: string): string[] => {
	if (!Array.isArray(value)) fail(`${label} must be an array`);
	return value.map((entry, index) => requireNonemptyString(entry, `${label}[${index}]`));
};

const parseFindingTriple = (
	value: unknown,
	label: string
): Pick<ArrowCommandCensusWorkerFindingSet, 'orphans' | 'total' | 'uncovered'> => {
	if (!isRecord(value)) fail(`${label} must be an object`);
	requireExactKeys(value, ['orphans', 'total', 'uncovered'], label);
	if (!Number.isSafeInteger(value.total) || (value.total as number) < 0) {
		fail(`${label}.total must be a non-negative safe integer`);
	}
	return {
		orphans: parseStringArray(value.orphans, `${label}.orphans`),
		total: value.total as number,
		uncovered: parseStringArray(value.uncovered, `${label}.uncovered`)
	};
};

const parseDeadCovered = (
	value: unknown,
	label: string
): Pick<ArrowCommandCensusWorkerFindingSet, 'dead' | 'unanalysed'> => {
	if (!isRecord(value)) fail(`${label} must be an object`);
	requireExactKeys(value, ['dead', 'unanalysed'], label);
	return {
		dead: parseStringArray(value.dead, `${label}.dead`),
		unanalysed: parseStringArray(value.unanalysed, `${label}.unanalysed`)
	};
};

const parseBaseline = (baselinePath: string): ArrowCommandCensusWorkerFindingSet => {
	const text = decodeUtf8(readFileSync(baselinePath), 'baseline');
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return fail('baseline must contain exactly one valid JSON value');
	}
	if (!isRecord(value)) fail('baseline must be a JSON object');
	requireExactKeys(value, ['dead', 'orphans', 'total', 'unanalysed', 'uncovered'], 'baseline');
	const census = parseFindingTriple(
		{ orphans: value.orphans, total: value.total, uncovered: value.uncovered },
		'baseline census'
	);
	const deadCovered = parseDeadCovered(
		{ dead: value.dead, unanalysed: value.unanalysed },
		'baseline deadCovered'
	);
	return { ...census, ...deadCovered };
};

const parseDeclaredArrows = (value: unknown): ArrowCommandCensusWorkerDeclaredArrow[] => {
	if (!Array.isArray(value)) fail('declaredArrows() must return an array');
	return value.map((entry, index) => {
		const label = `declaredArrows()[${index}]`;
		if (!isRecord(entry)) fail(`${label} must be an object`);
		requireExactKeys(entry, ['from', 'machine', 'site', 'to'], label);
		return {
			machine: requireNonemptyString(entry.machine, `${label}.machine`),
			from: requireNonemptyString(entry.from, `${label}.from`),
			to: requireNonemptyString(entry.to, `${label}.to`),
			site: requireNonemptyString(entry.site, `${label}.site`)
		};
	});
};

const normalizeStateMap = (
	value: unknown,
	label: string
): ArrowCommandCensusWorkerStateMapEntry[] => {
	if (!(value instanceof Map)) fail(`${label}() must return a Map`);
	const entries: ArrowCommandCensusWorkerStateMapEntry[] = [];
	for (const [machineValue, statesValue] of value.entries()) {
		const machine = requireNonemptyString(machineValue, `${label}() machine`);
		if (!(statesValue instanceof Set))
			fail(`${label}().get(${JSON.stringify(machine)}) must be a Set`);
		const states = [...statesValue].map((state, index) =>
			requireNonemptyString(state, `${label}().get(${JSON.stringify(machine)})[${index}]`)
		);
		states.sort(compareText);
		entries.push({ machine, states });
	}
	entries.sort((left, right) => compareText(left.machine, right.machine));
	return entries;
};

const requireRetainedAnalyzer = (value: unknown): RetainedAnalyzerModule => {
	if (!isRecord(value)) fail('retained analyzer module namespace must be an object');
	for (const name of REQUIRED_ANALYZER_EXPORTS) {
		if (typeof value[name] !== 'function') fail(`retained analyzer must export function ${name}()`);
	}
	return value as unknown as RetainedAnalyzerModule;
};

const requireBunRuntime = (): BunRuntime => {
	const candidate = (globalThis as { Bun?: unknown }).Bun;
	if (
		!isRecord(candidate) ||
		typeof candidate.version !== 'string' ||
		typeof candidate.resolveSync !== 'function'
	) {
		fail('this worker must execute under Bun with Bun.resolveSync available');
	}
	return candidate as unknown as BunRuntime;
};

const packageVersion = (bun: BunRuntime, packageName: string, from: string): string => {
	const packageJsonPath = canonicalResolvedModulePath(
		bun,
		`${packageName}/package.json`,
		from,
		`${packageName}/package.json`
	);
	const text = decodeUtf8(readFileSync(packageJsonPath), `${packageName}/package.json`);
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return fail(`${packageName}/package.json must contain exactly one valid JSON value`);
	}
	if (!isRecord(value)) fail(`${packageName}/package.json must be a JSON object`);
	return requireNonemptyString(value.version, `${packageName}/package.json version`);
};

export const executeArrowCommandCensusWorker = async (
	request: ArrowCommandCensusWorkerRequest
): Promise<ArrowCommandCensusWorkerResult> => {
	if (Object.prototype.hasOwnProperty.call(process.env, 'PIN_ARROW_BASELINE')) {
		fail('PIN_ARROW_BASELINE is forbidden for retained-verifier observation');
	}

	const bun = requireBunRuntime();
	if (!isAbsolute(request.capsuleRoot)) fail('request.capsuleRoot must be an absolute path');
	if (isAbsolute(request.analyzerPath)) fail('request.analyzerPath must be capsule-relative');
	if (request.analyzerPath !== ANALYZER_RELATIVE_PATH) {
		fail(`request.analyzerPath must be exactly ${ANALYZER_RELATIVE_PATH}`);
	}
	const requestedRoot = resolve(request.capsuleRoot);
	const capsuleRoot = canonicalExistingPath(requestedRoot, 'capsuleRoot');
	requireDirectory(capsuleRoot, 'capsuleRoot');

	const requestedAnalyzer = resolve(capsuleRoot, request.analyzerPath);
	const analyzerResolvedPath = canonicalExistingPath(requestedAnalyzer, 'analyzerPath');
	requireContained(capsuleRoot, analyzerResolvedPath, 'analyzerPath');
	requireFile(analyzerResolvedPath, 'analyzerPath');
	const analyzerResultPath = capsuleRelativePath(capsuleRoot, analyzerResolvedPath, 'analyzerPath');

	const baselinePath = canonicalExistingPath(
		resolve(capsuleRoot, BASELINE_RELATIVE_PATH),
		'baseline'
	);
	requireContained(capsuleRoot, baselinePath, 'baseline');
	requireFile(baselinePath, 'baseline');

	// Resolve and confine both subject packages before importing the retained analyzer. This sentinel prevents
	// Bun's parent-directory lookup from silently executing domain or contract code outside the capsule.
	const domainResolvedPath = canonicalResolvedModulePath(
		bun,
		'@janumipwb/rph-domain',
		analyzerResolvedPath,
		'@janumipwb/rph-domain'
	);
	requireContained(capsuleRoot, domainResolvedPath, '@janumipwb/rph-domain');
	const domainResultPath = capsuleRelativePath(
		capsuleRoot,
		domainResolvedPath,
		'@janumipwb/rph-domain'
	);
	const contractsResolvedPath = canonicalResolvedModulePath(
		bun,
		'@janumipwb/rph-contracts',
		analyzerResolvedPath,
		'@janumipwb/rph-contracts'
	);
	requireContained(capsuleRoot, contractsResolvedPath, '@janumipwb/rph-contracts');
	const contractsResultPath = capsuleRelativePath(
		capsuleRoot,
		contractsResolvedPath,
		'@janumipwb/rph-contracts'
	);

	// TypeScript is executor lineage supplied by the provider runtime. It is intentionally not subject evidence
	// and therefore is recorded but not required to resolve inside the subject capsule.
	const typescriptResolvedPath = canonicalResolvedModulePath(
		bun,
		'typescript',
		analyzerResolvedPath,
		'typescript'
	);
	const resolvedTypescriptVersion = packageVersion(bun, 'typescript', analyzerResolvedPath);
	const zodResolvedPath = canonicalResolvedModulePath(bun, 'zod', analyzerResolvedPath, 'zod');
	const resolvedZodVersion = packageVersion(bun, 'zod', analyzerResolvedPath);
	const ulidResolvedPath = canonicalResolvedModulePath(bun, 'ulid', analyzerResolvedPath, 'ulid');
	const resolvedUlidVersion = packageVersion(bun, 'ulid', analyzerResolvedPath);
	const bunVersion = bun.version;
	const baseline = parseBaseline(baselinePath);

	const originalConsole = globalThis.console;
	const suppressedConsole: Console = Object.freeze({
		...originalConsole,
		assert: () => undefined,
		clear: () => undefined,
		count: () => undefined,
		countReset: () => undefined,
		debug: () => undefined,
		dir: () => undefined,
		dirxml: () => undefined,
		error: () => undefined,
		group: () => undefined,
		groupCollapsed: () => undefined,
		groupEnd: () => undefined,
		info: () => undefined,
		log: () => undefined,
		table: () => undefined,
		time: () => undefined,
		timeEnd: () => undefined,
		timeLog: () => undefined,
		trace: () => undefined,
		warn: () => undefined
	});
	globalThis.console = suppressedConsole;
	let analyzer: RetainedAnalyzerModule;
	let declaredArrows: ArrowCommandCensusWorkerDeclaredArrow[];
	let birthStates: ArrowCommandCensusWorkerStateMapEntry[];
	let occupiable: ArrowCommandCensusWorkerStateMapEntry[];
	let deadCovered: Pick<ArrowCommandCensusWorkerFindingSet, 'dead' | 'unanalysed'>;
	let census: Pick<ArrowCommandCensusWorkerFindingSet, 'orphans' | 'total' | 'uncovered'>;
	try {
		analyzer = requireRetainedAnalyzer(await import(pathToFileURL(analyzerResolvedPath).href));
		declaredArrows = parseDeclaredArrows(analyzer.declaredArrows());
		birthStates = normalizeStateMap(analyzer.birthStates(), 'birthStates');
		occupiable = normalizeStateMap(analyzer.occupiable(), 'occupiable');
		deadCovered = parseDeadCovered(analyzer.deadCovered(), 'deadCovered()');
		census = parseFindingTriple(analyzer.census(), 'census()');
	} finally {
		globalThis.console = originalConsole;
	}

	return {
		schemaVersion: ARROW_COMMAND_CENSUS_WORKER_RESULT_SCHEMA_VERSION,
		analyzerResolvedPath: analyzerResultPath,
		domainResolvedPath: domainResultPath,
		contractsResolvedPath: contractsResultPath,
		runtime: {
			bunVersion,
			typescriptVersion: resolvedTypescriptVersion,
			typescriptResolvedPath,
			zodVersion: resolvedZodVersion,
			zodResolvedPath,
			ulidVersion: resolvedUlidVersion,
			ulidResolvedPath
		},
		declaredArrows,
		birthStates,
		occupiable,
		deadCovered,
		census,
		baseline
	};
};

const main = async (): Promise<void> => {
	try {
		const request = parseArrowCommandCensusWorkerRequest(readFileSync(0));
		const result = await executeArrowCommandCensusWorker(request);
		process.stdout.write(`${JSON.stringify(result)}\n`);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'arrow-command-census worker: unknown failure';
		process.stderr.write(`${message}\n`);
		process.exitCode = 1;
	}
};

if ((import.meta as ImportMeta & { readonly main?: boolean }).main === true) {
	await main();
}
