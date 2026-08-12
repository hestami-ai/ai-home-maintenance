import { basename } from 'node:path';
import ts from 'typescript';
import {
	ARROW_COMMAND_CENSUS_ADAPTER_ID,
	ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY,
	ARROW_COMMAND_CENSUS_METHOD,
	ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY
} from '../contracts/arrow-command-census.js';
import {
	INVENTORY_GENERATOR_ID,
	INVENTORY_GENERATOR_VERSION,
	INVENTORY_SCHEMA_VERSION,
	type ArtifactClass,
	type ArtifactPopulation,
	type AssuranceSurfaceInventory,
	type CapabilityInventory,
	type CommandInventory,
	type DependencyBoundaryInventory,
	type DependencyDeclaration,
	type ExclusionRecord,
	type InventoryDocument,
	type ProviderInventory,
	type SelectedFileRecord,
	type TypeScriptProjectInventory,
	type VerificationAssetInventory,
	type WorkspaceInventory
} from '../contracts/inventory.js';
import type { FrozenSubject } from '../contracts/subject.js';
import { readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import { subjectConfigurationPreimage } from '../subject/manifest.js';
import { compareText, sortUniqueBy } from './canonical.js';
import { projectSubjectForInventory } from './project-subject-for-inventory.js';

type JsonObject = Record<string, unknown>;

const TYPESCRIPT_AST_PROVENANCE = [
	'packages/csaa/src/contracts/semantic.ts',
	'packages/csaa/src/providers/typescript/compiler-input-journal.ts',
	'packages/csaa/src/providers/typescript/extract-static-raw.ts',
	'packages/csaa/src/providers/typescript/frozen-compiler-host.ts',
	'packages/csaa/src/semantic/build-static-semantic-snapshot.ts',
	'packages/csaa/src/semantic/monotonic-operation-clock.ts'
] as const;

const TYPESCRIPT_SYMBOL_PROVENANCE = [
	'packages/csaa/src/providers/typescript/extract-symbols.ts',
	'packages/csaa/src/semantic/raw-semantic-model.ts',
	'packages/csaa/src/semantic/normalize-semantic-snapshot.ts',
	'packages/csaa/src/semantic/validate-snapshot.ts'
] as const;

const TYPESCRIPT_TYPE_PROVENANCE = [
	'packages/csaa/src/providers/typescript/extract-types.ts'
] as const;

const TYPESCRIPT_MODULE_GRAPH_PROVENANCE = [
	'packages/csaa/src/contracts/graph.ts',
	'packages/csaa/src/graph/build-module-dependency-graph.ts',
	'packages/csaa/src/graph/ids.ts',
	'packages/csaa/src/graph/module-dependency-content.ts',
	'packages/csaa/src/graph/module-dependency-input.ts',
	'packages/csaa/src/graph/validate-graph.ts'
] as const;

const TYPESCRIPT_CALL_GRAPH_PROVENANCE = [
	'packages/csaa/src/contracts/call-graph.ts',
	'packages/csaa/src/graph/build-call-graph.ts',
	'packages/csaa/src/graph/call-graph-content.ts',
	'packages/csaa/src/graph/call-graph-ids.ts',
	'packages/csaa/src/graph/call-graph-input.ts',
	'packages/csaa/src/graph/validate-call-graph.ts'
] as const;

const TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE = [
	'packages/csaa/src/contracts/read-write-access-graph.ts',
	'packages/csaa/src/graph/build-read-write-access-graph.ts',
	'packages/csaa/src/graph/read-write-access-graph-canonical.ts',
	'packages/csaa/src/graph/validate-read-write-access-graph.ts'
] as const;

const JPWB_STATE_MACHINE_GRAPH_PROVENANCE = [
	'packages/csaa/src/contracts/state-machine-graph.ts',
	'packages/csaa/src/graph/build-state-machine-graph.ts',
	'packages/csaa/src/graph/state-machine-graph-content.ts',
	'packages/csaa/src/graph/state-machine-graph-ids.ts',
	'packages/csaa/src/graph/state-machine-graph-input.ts',
	'packages/csaa/src/graph/validate-state-machine-graph.ts',
	'packages/csaa/src/providers/jpwb-state-machines/observe-state-machines.ts',
	'packages/csaa/src/providers/jpwb-state-machines/validate-state-machine-observation.ts'
] as const;

const JPWB_ARROW_COMMAND_CENSUS_PROVENANCE = [
	'packages/csaa/src/contracts/arrow-command-census.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/arrow-command-census-content.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/artifact-set.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/executor-environment.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/normalize-arrow-command-census.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/observe-arrow-command-census.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/parse-worker-output.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/validate-arrow-command-census.ts',
	'packages/csaa/src/providers/jpwb-arrow-command-census/worker.ts'
] as const;

const JPWB_ARROW_COMMAND_CENSUS_RETAINED_PROVENANCE = [
	'verif/arrow-command-census.ts',
	'verif/arrow-command-census.baseline.json',
	'verif/arrow-command-census.test.ts'
] as const;

const EXISTING_GRAPH_RELEVANT_VERIFICATION_AUTHORITY = [
	'verif/arrow-census-coverage.test.ts',
	'verif/arrow-command-census.baseline.json',
	'verif/arrow-command-census.test.ts',
	'verif/arrow-command-census.ts',
	'verif/authority-resolution-census.test.ts',
	'verif/births-outside-the-census.test.ts',
	'verif/command-dispatch-census.test.ts',
	'verif/contract-number-census.test.ts',
	'verif/dead-kernel-census.test.ts',
	'verif/event-surface-census.test.ts',
	'verif/policy-evidence-requirement-census.test.ts',
	'verif/route-action-census.test.ts'
] as const;

const DEPENDENCY_CRUISER_CORROBORATION_PROVENANCE = [
	'packages/csaa/src/contracts/dependency-comparison.ts',
	'packages/csaa/src/contracts/dependency-cruiser.ts',
	'packages/csaa/src/graph/compare-dependency-providers.ts',
	'packages/csaa/src/graph/validate-dependency-comparison.ts',
	'packages/csaa/src/providers/dependency-cruiser/normalize-output.ts',
	'packages/csaa/src/providers/dependency-cruiser/schema/cruise-result-16.10.4.schema.json',
	'packages/csaa/src/providers/dependency-cruiser/validate-raw-wire-schema.ts'
] as const;

const TYPESCRIPT_SEMANTIC_PROVENANCE = [
	...TYPESCRIPT_AST_PROVENANCE,
	...TYPESCRIPT_SYMBOL_PROVENANCE,
	...TYPESCRIPT_TYPE_PROVENANCE
] as const;

const TYPESCRIPT_ADAPTER_CAPABILITIES = [
	'TS_PROJECT',
	'TS_SYMBOL',
	'TS_SYNTAX',
	'TS_TYPE',
	'configuration-ast-parse',
	'frozen-program-construction',
	'read-write-access-projection'
] as const;

export interface CollectInventoryOptions {
	readonly repositoryRoot: string;
	readonly requireJpwbPopulations?: boolean;
}

function object(value: unknown, description: string): JsonObject {
	if (value === null || Array.isArray(value) || typeof value !== 'object') {
		throw new Error(`${description} must be a JSON object`);
	}
	return value as JsonObject;
}

function stringArray(value: unknown, description: string): string[] {
	if (value === undefined) return [];
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
		throw new Error(`${description} must be an array of strings`);
	}
	return [...value].sort(compareText) as string[];
}

function frozenText(subject: FrozenSubject, path: string): string {
	const bytes = readFrozenSubjectArtifact(subject, path);
	if (bytes === undefined) throw new Error(`Frozen subject artifact is absent: ${path}`);
	return Buffer.from(bytes).toString('utf8');
}

function readJsonObject(subject: FrozenSubject, path: string, description: string): JsonObject {
	let parsed: unknown;
	try {
		parsed = JSON.parse(frozenText(subject, path));
	} catch (error) {
		throw new Error(`Unreadable ${description} at ${path}: ${String(error)}`);
	}
	return object(parsed, description);
}

function sortedRecord(value: unknown, description: string): Record<string, string> {
	if (value === undefined) return {};
	const record = object(value, description);
	const out: Record<string, string> = {};
	for (const key of Object.keys(record).sort(compareText)) {
		if (typeof record[key] !== 'string') throw new Error(`${description}.${key} must be a string`);
		out[key] = record[key];
	}
	return out;
}

function dependencyDeclarations(
	manifest: JsonObject,
	manifestPath: string
): DependencyDeclaration[] {
	const scopes = [
		'dependencies',
		'devDependencies',
		'optionalDependencies',
		'peerDependencies'
	] as const;
	const declarations: DependencyDeclaration[] = [];
	for (const scope of scopes) {
		const values = sortedRecord(manifest[scope], `${manifestPath}#/${scope}`);
		for (const [name, specifier] of Object.entries(values))
			declarations.push({ name, scope, specifier });
	}
	return declarations.sort((left, right) =>
		compareText(`${left.scope}\0${left.name}`, `${right.scope}\0${right.name}`)
	);
}

function inventoryArtifactClass(
	primaryClass: FrozenSubject['artifacts'][number]['primaryClass']
): ArtifactClass {
	switch (primaryClass) {
		case 'MANIFEST':
		case 'LOCKFILE':
		case 'TOOL_CONFIGURATION':
		case 'PROJECT_CONFIGURATION':
		case 'GENERATED_CONFIGURATION':
			return 'CONFIGURATION';
		case 'PRODUCTION_SOURCE':
			return 'SOURCE';
		case 'TEST_SOURCE':
			return 'TEST';
		case 'GENERATED_SOURCE':
			return 'GENERATED_SOURCE';
		case 'GENERATOR_SOURCE':
		case 'SCRIPT':
			return 'SCRIPT';
		case 'VERIFICATION':
			return 'VERIFICATION';
		case 'BUILD_OUTPUT':
		case 'CACHE':
		case 'EXTERNAL_DEPENDENCY':
		case 'VENDOR':
		case 'OTHER':
			return 'OTHER';
	}
}

function projectSelectedFiles(subject: FrozenSubject): SelectedFileRecord[] {
	return subject.artifacts.map((artifact) => ({
		artifactClass: inventoryArtifactClass(artifact.primaryClass),
		bytes: artifact.bytes,
		path: artifact.path,
		sha256: artifact.sha256,
		subjectArtifactClass: artifact.primaryClass
	}));
}

function projectWorkspaces(subject: FrozenSubject): WorkspaceInventory[] {
	return subject.workspaces.map((workspace) => {
		const manifest = readJsonObject(
			subject,
			workspace.manifestPath,
			`workspace manifest ${workspace.manifestPath}`
		);
		return {
			dependencies: dependencyDeclarations(manifest, workspace.manifestPath),
			exportsState: manifest.exports === undefined ? 'NOT_DECLARED' : 'DECLARED',
			kind: workspace.kind,
			manifestPath: workspace.manifestPath,
			name: workspace.name,
			path: workspace.path,
			private: workspace.private,
			provenance: workspace.provenance,
			scripts: sortedRecord(manifest.scripts, `${workspace.manifestPath}#/scripts`),
			version: typeof manifest.version === 'string' ? manifest.version : null
		};
	});
}

function projectTypeScriptProjects(subject: FrozenSubject): TypeScriptProjectInventory[] {
	return subject.projects.map((project) => {
		const generatedContexts = subject.generatedContexts.filter(
			(context) => context.consumerProject === project.configPath
		);
		const generatedPaths = new Set(generatedContexts.map((context) => context.path));
		const generatedDiagnostics = subject.diagnostics.filter(
			(diagnostic) =>
				(diagnostic.code === 'GENERATED_CONTEXT_ABSENT' &&
					diagnostic.path === project.configPath) ||
				(diagnostic.phase === 'FRESHNESS' &&
					diagnostic.path !== null &&
					generatedPaths.has(diagnostic.path))
		);
		const partialityReasons: TypeScriptProjectInventory['partialityReasons'][number][] = [];
		if (project.rootDisposition === 'INCOMPLETE')
			partialityReasons.push({
				code: 'ROOT_DISPOSITION_INCOMPLETE',
				message:
					'TypeScript did not produce a complete compiler-root disposition for this project.',
				path: project.configPath,
				provenance: ['project.rootDisposition']
			});
		if (project.frameworkCandidates.length > 0)
			partialityReasons.push({
				code: 'FRAMEWORK_CANDIDATES_PRESENT',
				message: `${project.frameworkCandidates.length} framework candidate(s) remain outside the DWP-002 TypeScript compiler-root model.`,
				path: project.configPath,
				provenance: ['project.frameworkCandidates']
			});
		for (const diagnostic of project.typescriptDiagnostics.filter(
			(item) => item.severity === 'ERROR' || item.code === 'TYPESCRIPT_PROJECT_PARTIAL'
		))
			partialityReasons.push({
				code: diagnostic.code,
				message: diagnostic.message,
				path: diagnostic.path,
				provenance: ['project.typescriptDiagnostics']
			});
		for (const diagnostic of generatedDiagnostics)
			partialityReasons.push({
				code: diagnostic.code,
				message: diagnostic.message,
				path: diagnostic.path,
				provenance: ['subject.diagnostics', 'subject.generatedContexts']
			});
		for (const context of generatedContexts.filter((item) => item.freshness === 'STALE'))
			partialityReasons.push({
				code: 'GENERATED_CONTEXT_STALE',
				message: context.freshnessBasis,
				path: context.path,
				provenance: ['subject.generatedContexts']
			});
		return {
			candidateArtifactCount: project.fileNames.length + project.frameworkCandidates.length,
			compilerOptions: project.rawCompilerOptions,
			diagnostics: project.typescriptDiagnostics,
			diagnosticsState: 'RUN',
			exclude: project.rawExclude,
			extends: project.rawExtends,
			files: project.rawFiles,
			frameworkCandidates: project.frameworkCandidates,
			generatedContexts,
			include: project.rawInclude,
			partialityReasons,
			parseState: 'PARSED',
			path: project.configPath,
			provenance: [project.configPath, ...project.configClosure.map((item) => item.path)],
			references: project.projectReferences,
			resolvedRootFiles: project.fileNames,
			resolvedRootState: 'RESOLVED_DWP002',
			rootDisposition: project.rootDisposition,
			semanticOptionCoverage: 'COMPLETE_RAW_DECLARATION',
			status: project.status
		};
	});
}

function commandCategories(name: string): string[] {
	const categories: string[] = [];
	for (const [category, pattern] of [
		['BOUNDARY', /boundary/],
		['BUILD', /build/],
		['COVERAGE', /coverage/],
		['E2E', /e2e/],
		['FRAMEWORK_CHECK', /check(?!-types)/],
		['GENERATION', /(?:^|:)gen/],
		['LINT', /lint|format/],
		['MUTATION', /mutant/],
		['TEST', /test|gate/],
		['TYPE_CHECK', /check-types/]
	] as const) {
		if (pattern.test(name)) categories.push(category);
	}
	return categories.length > 0 ? categories : ['OTHER'];
}

function commands(
	rootManifest: JsonObject,
	workspaces: readonly WorkspaceInventory[]
): CommandInventory[] {
	const out: CommandInventory[] = [];
	const add = (owner: string, manifestPath: string, scripts: Readonly<Record<string, string>>) => {
		for (const [name, command] of Object.entries(scripts)) {
			out.push({
				categories: commandCategories(name),
				command,
				name,
				owner,
				provenance: [`${manifestPath}#/scripts/${name}`],
				state: 'CONFIGURED_NOT_RUN'
			});
		}
	};
	add('.', 'package.json', sortedRecord(rootManifest.scripts, 'package.json#/scripts'));
	for (const workspace of workspaces)
		add(workspace.path, workspace.manifestPath, workspace.scripts);
	return sortUniqueBy(out, (entry) => `${entry.owner}\0${entry.name}`, 'configured command');
}

function propertyName(name: ts.PropertyName | undefined): string | undefined {
	if (!name) return undefined;
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
		return name.text;
	return undefined;
}

function literalValue(node: ts.Expression): unknown {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
	if (ts.isNumericLiteral(node)) return Number(node.text);
	if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
	if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
	if (ts.isArrayLiteralExpression(node)) {
		const values = node.elements.map((element) =>
			ts.isSpreadElement(element) ? undefined : literalValue(element as ts.Expression)
		);
		return values.some((value) => value === undefined) ? undefined : values;
	}
	if (ts.isObjectLiteralExpression(node)) {
		const value: Record<string, unknown> = {};
		for (const child of node.properties) {
			if (!ts.isPropertyAssignment(child)) return undefined;
			const key = propertyName(child.name);
			const literal = literalValue(child.initializer);
			if (key === undefined || literal === undefined) return undefined;
			value[key] = literal;
		}
		return value;
	}
	return undefined;
}

function findObjectProperty(
	source: string,
	fileName: string,
	wanted: string
): JsonObject | undefined {
	const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
	let result: JsonObject | undefined;
	const visit = (node: ts.Node) => {
		if (
			result === undefined &&
			ts.isPropertyAssignment(node) &&
			propertyName(node.name) === wanted &&
			ts.isObjectLiteralExpression(node.initializer)
		) {
			const value = literalValue(node.initializer);
			if (value !== undefined) result = object(value, `${fileName}#/${wanted}`);
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return result;
}

function booleanPropertyValues(source: string, fileName: string, wanted: string): boolean[] {
	const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
	const values = new Set<boolean>();
	const visit = (node: ts.Node) => {
		if (ts.isPropertyAssignment(node) && propertyName(node.name) === wanted) {
			const value = literalValue(node.initializer);
			if (typeof value === 'boolean') values.add(value);
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return [...values].sort((left, right) => Number(left) - Number(right));
}

function assuranceSurfaces(
	subject: FrozenSubject,
	files: readonly SelectedFileRecord[],
	rootCommands: readonly CommandInventory[]
): AssuranceSurfaceInventory {
	const unitTests = files
		.filter((file) => /\.test\.[cm]?[jt]sx?$/.test(file.path))
		.map((file) => file.path);
	const e2e = files
		.filter((file) => /(?:\/e2e(?:-live)?\/|\.e2e\.)/.test(file.path))
		.map((file) => file.path);
	const deterministicFiles = e2e.filter((path) => !/(?:\/e2e-live\/|\/live\/|\.live\.)/.test(path));
	const liveFiles = e2e.filter((path) => /(?:\/e2e-live\/|\/live\/|\.live\.)/.test(path));
	const vitestConfig = files.find((file) => file.path === 'vitest.config.ts');
	const projectsConfig = files.find((file) => file.path === 'vitest.projects.ts');
	const coverageObject = vitestConfig
		? findObjectProperty(frozenText(subject, vitestConfig.path), vitestConfig.path, 'coverage')
		: undefined;
	const thresholds = coverageObject?.thresholds;
	const numericThresholds: Record<string, number> = {};
	if (thresholds !== undefined) {
		for (const [key, value] of Object.entries(object(thresholds, 'coverage thresholds'))) {
			if (typeof value === 'number') numericThresholds[key] = value;
		}
	}
	const mutationCommands = rootCommands
		.filter((command) => command.categories.includes('MUTATION'))
		.map((command) => command.name);
	return {
		coverage: {
			configurationPath: vitestConfig?.path ?? null,
			exclude: stringArray(coverageObject?.exclude, 'vitest coverage exclude'),
			include: stringArray(coverageObject?.include, 'vitest coverage include'),
			outputIdentity: null,
			provider: typeof coverageObject?.provider === 'string' ? coverageObject.provider : null,
			state: vitestConfig ? 'NOT_RUN' : 'NOT_CONFIGURED',
			thresholds: numericThresholds
		},
		e2e: {
			deterministicFiles,
			liveFiles,
			state: e2e.length > 0 ? 'NOT_RUN' : 'NOT_CONFIGURED'
		},
		mutation: {
			commands: mutationCommands,
			ledgerPath: files.some((file) => file.path === 'scripts/mutants/ledger.ts')
				? 'scripts/mutants/ledger.ts'
				: null,
			runnerPath: files.some((file) => file.path === 'scripts/mutants/run.ts')
				? 'scripts/mutants/run.ts'
				: null,
			state: mutationCommands.length > 0 ? 'NOT_RUN' : 'NOT_CONFIGURED'
		},
		unitTests: {
			files: unitTests,
			passWithNoTestsValues: projectsConfig
				? booleanPropertyValues(
						frozenText(subject, projectsConfig.path),
						projectsConfig.path,
						'passWithNoTests'
					)
				: [],
			state: unitTests.length > 0 ? 'NOT_RUN' : 'NOT_CONFIGURED'
		}
	};
}

function dependencyBoundary(
	subject: FrozenSubject,
	files: readonly SelectedFileRecord[],
	rootManifest: JsonObject
): DependencyBoundaryInventory {
	const configurationPath = files.some((file) => file.path === '.dependency-cruiser.cjs')
		? '.dependency-cruiser.cjs'
		: null;
	const boundaryCommand =
		sortedRecord(rootManifest.scripts, 'package.json#/scripts').boundary ?? null;
	if (!configurationPath) {
		return {
			analyzedPerimeter: [],
			command: boundaryCommand,
			configurationPath: null,
			enforcementCarriers: boundaryCommand?.includes('csaa-product-boundary.ts')
				? ['scripts/csaa-product-boundary.ts']
				: [],
			enforcementPerimeter: boundaryCommand?.includes('csaa-product-boundary.ts')
				? ['apps', 'packages']
				: [],
			provenance: boundaryCommand ? ['package.json#/scripts/boundary'] : [],
			ruleIds: [],
			state: 'NOT_CONFIGURED'
		};
	}
	const source = frozenText(subject, configurationPath);
	const sourceFile = ts.createSourceFile(
		configurationPath,
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.JS
	);
	const names = new Set<string>();
	const visit = (node: ts.Node) => {
		if (
			ts.isPropertyAssignment(node) &&
			propertyName(node.name) === 'name' &&
			ts.isStringLiteral(node.initializer)
		) {
			names.add(node.initializer.text);
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	const commandTokens = boundaryCommand?.trim().split(/\s+/) ?? [];
	const executableIndex = commandTokens.findIndex((token) => token === 'depcruise');
	const optionIndex = commandTokens.findIndex(
		(token, index) => index > executableIndex && token.startsWith('-')
	);
	const analyzedPerimeter =
		executableIndex < 0
			? []
			: commandTokens
					.slice(executableIndex + 1, optionIndex < 0 ? commandTokens.length : optionIndex)
					.filter((token) => !token.startsWith('-'))
					.sort(compareText);
	return {
		analyzedPerimeter,
		command: boundaryCommand,
		configurationPath,
		enforcementCarriers: [
			configurationPath,
			...(boundaryCommand?.includes('csaa-product-boundary.ts')
				? ['scripts/csaa-product-boundary.ts']
				: [])
		],
		enforcementPerimeter: boundaryCommand?.includes('csaa-product-boundary.ts')
			? ['apps', 'packages']
			: analyzedPerimeter,
		provenance: [configurationPath, ...(boundaryCommand ? ['package.json#/scripts/boundary'] : [])],
		ruleIds: [...names].sort(compareText),
		state: 'CONFIGURED_NOT_RUN'
	};
}

const PROVIDERS = [
	['@playwright/test', ['e2e-test']],
	['@vitest/coverage-v8', ['coverage']],
	['dependency-cruiser', ['dependency-graph', 'architecture-boundary']],
	['eslint', ['lint']],
	['sonar', ['static-quality-reporting']],
	['typescript', ['typescript-parse', 'type-system']],
	['vitest', ['unit-test']]
] as const;

function gateReachableScriptNames(rootScripts: ReadonlyMap<string, string>): Set<string> {
	const reachable = new Set<string>();
	const pending = ['gate', 'gate:fast'].filter((name) => rootScripts.has(name));
	while (pending.length > 0) {
		const name = pending.shift()!;
		if (reachable.has(name)) continue;
		reachable.add(name);
		const command = rootScripts.get(name);
		if (!command) continue;
		for (const match of command.matchAll(/\bbun run ([a-zA-Z0-9:_-]+)/g)) {
			const dependency = match[1]!;
			if (!reachable.has(dependency)) pending.push(dependency);
		}
	}
	return reachable;
}

function providerInventory(
	subject: FrozenSubject,
	files: readonly SelectedFileRecord[],
	configuredCommands: readonly CommandInventory[]
): ProviderInventory[] {
	const lock = files.find((file) => file.path === 'bun.lock');
	const text = lock ? frozenText(subject, lock.path) : '';
	const rootScripts = new Map(
		configuredCommands
			.filter((command) => command.owner === '.')
			.map((command) => [command.name, command.command])
	);
	const gateReachable = gateReachableScriptNames(rootScripts);
	return PROVIDERS.map(([name, potentialCapabilities]) => {
		const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const version =
			new RegExp(`^\\s*"${escaped}": \\["${escaped}@([^"\\s]+)"`, 'm').exec(text)?.[1] ?? null;
		const configurationPaths: Record<(typeof PROVIDERS)[number][0], readonly string[]> = {
			'@playwright/test': files
				.filter((file) => /playwright\.config\.ts$/.test(file.path))
				.map((file) => file.path),
			'@vitest/coverage-v8': files.some((file) => file.path === 'vitest.config.ts')
				? ['vitest.config.ts']
				: [],
			'dependency-cruiser': files.some((file) => file.path === '.dependency-cruiser.cjs')
				? ['.dependency-cruiser.cjs']
				: [],
			eslint: files.some((file) => file.path === 'eslint.config.mjs') ? ['eslint.config.mjs'] : [],
			sonar: files.some((file) => file.path === 'sonar-project.properties')
				? ['sonar-project.properties']
				: [],
			typescript: files
				.filter((file) => /(?:^|\/)tsconfig(?:\.[^/]+)?\.json$/.test(file.path))
				.map((file) => file.path),
			vitest: files
				.filter((file) => /^vitest(?:\.[^.]+)?\.(?:config|projects)\.ts$/.test(file.path))
				.map((file) => file.path)
		};
		const gateEvidence: Record<(typeof PROVIDERS)[number][0], readonly string[]> = {
			'@playwright/test': gateReachable.has('e2e') ? ['package.json#/scripts/gate:fast'] : [],
			'@vitest/coverage-v8': gateReachable.has('test:coverage')
				? ['package.json#/scripts/test:coverage']
				: [],
			'dependency-cruiser': gateReachable.has('boundary') ? ['package.json#/scripts/boundary'] : [],
			eslint: gateReachable.has('lint') ? ['package.json#/scripts/lint'] : [],
			sonar: gateReachable.has('sonar') ? ['package.json#/scripts/sonar'] : [],
			typescript: gateReachable.has('check-types') ? ['package.json#/scripts/check-types'] : [],
			vitest:
				gateReachable.has('test:src') || gateReachable.has('test')
					? ['package.json#/scripts/test']
					: []
		};
		const configured = configurationPaths[name].length > 0;
		const gateWired = gateEvidence[name].length > 0;
		const inventoryIntegrated = name === 'typescript';
		return {
			adapterCapabilities: inventoryIntegrated ? TYPESCRIPT_ADAPTER_CAPABILITIES : [],
			adapterState: inventoryIntegrated ? 'INVENTORY_INTEGRATED' : 'UNIMPLEMENTED',
			configurationState: configured ? 'CONFIGURED' : 'NOT_CONFIGURED',
			configuredState: configured ? 'CONFIGURED_NOT_RUN' : 'NOT_CONFIGURED',
			gateState: gateWired ? 'GATE_WIRED' : 'NOT_GATE_WIRED',
			installationState: version ? 'LOCKED' : 'NOT_LOCKED',
			name,
			potentialCapabilities,
			provenance: [
				...(lock ? [lock.path] : []),
				...configurationPaths[name],
				...gateEvidence[name],
				...(inventoryIntegrated
					? [...TYPESCRIPT_SEMANTIC_PROVENANCE, ...TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE]
					: [])
			].sort(compareText),
			version
		};
	});
}

function verificationAssets(
	subject: FrozenSubject,
	files: readonly SelectedFileRecord[],
	configuredCommands: readonly CommandInventory[]
): VerificationAssetInventory[] {
	const assetPaths = files
		.filter((file) => /^(?:verif|scripts)\/.*\.ts$/.test(file.path))
		.map((file) => file.path);
	const baselines = files.filter((file) => /^verif\/[^/]+\.baseline\.json$/.test(file.path));
	const testSources = new Map(
		assetPaths
			.filter((path) => path.endsWith('.test.ts'))
			.map((path) => [path, frozenText(subject, path)])
	);
	const projectsText = files.some((file) => file.path === 'vitest.projects.ts')
		? frozenText(subject, 'vitest.projects.ts')
		: '';
	return assetPaths.map((path) => {
		const selectedFile = files.find((file) => file.path === path);
		if (!selectedFile)
			throw new Error(`Verification asset is absent from selected-file manifest: ${path}`);
		const text = frozenText(subject, path);
		const stem = basename(path).replace(/\.test\.ts$|\.data\.ts$|\.ts$/, '');
		const isTest = path.endsWith('.test.ts');
		const isData = path.endsWith('.data.ts');
		const isGuard =
			!isTest && /(?:guard|refusal)/.test(basename(path)) && projectsText.includes(basename(path));
		const isScript = path.startsWith('scripts/');
		const role = isTest
			? 'TEST'
			: isData
				? 'SUPPORT_DATA'
				: isGuard
					? 'RUNTIME_GUARD'
					: isScript
						? 'SCRIPT'
						: 'ANALYZER';
		const associatedBaselines = baselines
			.filter(
				(baseline) =>
					baseline.path.includes(stem) ||
					text.includes(baseline.path) ||
					text.includes(basename(baseline.path))
			)
			.map((baseline) => baseline.path);
		const carriers = isTest
			? ['bun run test:src -> verif', path]
			: [...testSources.entries()]
					.filter(
						([, source]) =>
							source.includes(`./${stem}`) ||
							source.includes(basename(path)) ||
							source.includes(path.replace(/\.ts$/, ''))
					)
					.map(([testPath]) => testPath);
		for (const command of configuredCommands) {
			if (command.command.includes(path) || command.command.includes(basename(path))) {
				carriers.push(...command.provenance);
			}
		}
		if (!isTest && projectsText.includes(basename(path)))
			carriers.push('vitest.projects.ts#setupFiles');
		if (carriers.length === 0) carriers.push('UNMAPPED');
		const extractionMethod = text.match(/from ['"]typescript['"]|require\(['"]typescript['"]\)/)
			? 'TYPESCRIPT_AST'
			: isTest
				? 'VITEST_EXECUTABLE_ASSERTION'
				: isData
					? 'DECLARED_STATIC_DATA'
					: /\b(?:readFileSync|readdirSync|globSync|readFile)\b/.test(text)
						? 'FILESYSTEM_OR_TEXT'
						: 'IMPORTED_EXECUTABLE_LOGIC';
		return {
			associatedBaselines,
			assertedPopulation: isTest
				? `Executable assertions and imported surfaces declared by ${path}.`
				: extractionMethod === 'TYPESCRIPT_AST'
					? `Repository syntax and declarations selected by ${path} at execution time.`
					: `Repository files, exports, or runtime events selected by ${path} at execution time.`,
			contentSha256: selectedFile.sha256,
			disposition:
				path === 'verif/arrow-command-census.ts'
					? ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY
					: role === 'ANALYZER'
						? 'WRAP'
						: 'RETAIN_DELEGATED',
			extractionMethod,
			gateCarriers: [...new Set(carriers)].sort(compareText),
			path,
			provenance: [path],
			role
		};
	});
}

function capabilities(): CapabilityInventory[] {
	const unimplemented = [
		'code-property-graph',
		'control-flow',
		'data-flow',
		'runtime-traces',
		'security-query',
		'test-coverage-ingestion'
	];
	return [
		{
			explanation: 'DWP-001 deterministically derives and verifies the repository inventory.',
			id: 'repository-inventory',
			provider: INVENTORY_GENERATOR_ID,
			provenance: ['packages/csaa/src/inventory/collect-inventory.ts'],
			state: 'IMPLEMENTED'
		},
		{
			explanation:
				'The first two bounded DWP-004 increments project every compiler-observed module occurrence into a validated TypeScript module-dependency graph and normalize exact-schema-validated dependency-cruiser 16.10.4 JSON evidence for conservative, context-bound comparison. Provider aggregates never replace compiler occurrence edges; qualified target agreement, unresolved agreement, collapsed corroboration, incomparable scope/context differences, and unqualified observed differences remain distinct. This contract cannot promote a difference to conflict without later validated context-equivalence and closed-perimeter evidence. Manifest dependencies, resolved component instances, inferred or observed runtime dependencies, provider execution, flow, graph algorithms, and cross-Program composition are not implemented by these increments.',
			id: 'dependency-graph',
			provider: 'typescript',
			provenance: [
				...TYPESCRIPT_MODULE_GRAPH_PROVENANCE,
				...TYPESCRIPT_SYMBOL_PROVENANCE,
				...DEPENDENCY_CRUISER_CORROBORATION_PROVENANCE
			],
			state: 'PARTIAL'
		},
		{
			explanation:
				'The third bounded DWP-004 increment enumerates every retained TypeScript CALL, NEW, and TAGGED_TEMPLATE site into a validated graph with exact structural/lexical ownership within the declared method, open compiler-bound callable candidates, and explicit external-dispatch, unresolved, or unsupported frontiers. Runtime caller and evaluation ownership remain coarsened and are not inferred from the structural ownership edge. Invocation-specific resolved signatures, dispatch closure, runtime observations, and all twelve entry-mechanism classes are not yet analyzed, so exact targets, whole-program reachability, dead-code conclusions, and full JAN-CSAA-007 conformance are not claimed.',
			id: 'call-graph',
			provider: 'typescript',
			provenance: [...TYPESCRIPT_CALL_GRAPH_PROVENANCE, ...TYPESCRIPT_SEMANTIC_PROVENANCE],
			state: 'PARTIAL'
		},
		{
			explanation:
				'The fourth bounded DWP-004 increment observes the exact frozen generated JPWB transition table without executing it and projects declared machines, states, legal transitions, guarded-legal restrictions, explicitly illegal transitions, and cross-axis frontiers. It uses implementation-local relation codes because the closed JAN-CSAA-007 registry has no state-machine relation family. This generated-runtime-topology projection does not establish upstream vocabulary authority, command performability, writer/effect coverage, guard enforcement, behavioral reachability, or any specialized verifier-census conclusion; full JAN-CSAA-007 and JAN-CSAA-008 conformance remain NOT_CLAIMED and existing verifier authority remains delegated.',
			id: 'state-machine-graph',
			provider: 'jpwb-generated-transition-table',
			provenance: [...JPWB_STATE_MACHINE_GRAPH_PROVENANCE],
			state: 'PARTIAL'
		},
		{
			explanation: `The fifth bounded DWP-004 increment implements the ${ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY} strategy through exact adapter ${ARROW_COMMAND_CENSUS_ADAPTER_ID} and method ${ARROW_COMMAND_CENSUS_METHOD}, wrapping the retained JPWB arrow-command census without changing its ${ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY} verifier authority, oracle, baseline, gate effect, or source implementation. It binds an exact repository FrozenSubject artifact population, independently records the Bun/TypeScript/ULID/Zod executor environment, runs the retained analyzer in an isolated temporary byte capsule, validates post-execution subject and executor integrity, preserves exact raw evidence and baseline comparison, and publishes a canonical partial observation. This is process isolation rather than a hostile-code security sandbox; supported declaration idioms remain those of the retained verifier; runtime performability, handler-registry closure, replacement equivalence, and full JAN-CSAA-007 or JAN-CSAA-008 conformance are NOT_CLAIMED.`,
			id: 'arrow-command-census',
			provider: ARROW_COMMAND_CENSUS_ADAPTER_ID,
			provenance: [
				...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
				...JPWB_ARROW_COMMAND_CENSUS_RETAINED_PROVENANCE
			],
			state: 'PARTIAL'
		},
		{
			explanation:
				'The sixth bounded DWP-004 increment derives a validated Program-local read/write access graph from normalized TypeScript reference, declaration, symbol, and assignment facts. It distinguishes reads, writes, and compound/update read-writes; retains deterministic symbol-slot and occurrence identities, forward/reverse indexes, source witnesses, population reconciliation, and explicit type-position, dynamic-element, unresolved, and unsupported frontiers. Implicit bindings, for-in/of targets, delete operations, and write forms absent from the normalized assignment taxonomy are not classified as supported writes. It does not construct control flow, reaching definitions, heap or points-to state, interprocedural flow, taint, or JAN-CSAA-CAP-007 data flow; the broader data-flow capability therefore remains UNIMPLEMENTED.',
			id: 'read-write-access-graph',
			provider: 'typescript',
			provenance: [
				...TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE,
				...TYPESCRIPT_SYMBOL_PROVENANCE
			],
			state: 'PARTIAL'
		},
		...unimplemented.map((id): CapabilityInventory => ({
			explanation:
				'Not implemented by the current bounded DWP-004 graph increments; no control-flow, data-flow, code-property, security, coverage, or runtime graph support is inferred from semantic snapshots, module/call graphs, or installed tools.',
			id,
			provider: null,
			provenance: ['packages/csaa/src/contracts/inventory.ts'],
			state: 'UNIMPLEMENTED'
		})),
		{
			explanation:
				'The current DWP-003 provider constructs frozen TypeScript Programs and implements TS_PROJECT and TS_SYNTAX semantic snapshot capabilities. Its operation-wide duration budget is enforced from a wall-anchored monotonic elapsed-time clock, preventing later wall-clock correction from making in-flight elapsed time regress. This is an execution-control property, not a benchmark, product ceiling, expected duration, or SLO.',
			id: 'typescript-ast',
			provider: 'typescript',
			provenance: TYPESCRIPT_AST_PROVENANCE,
			state: 'IMPLEMENTED'
		},
		{
			explanation:
				'The current DWP-003 provider implements Program-scoped TS_SYMBOL declarations, symbols, aliases, references, module resolutions, and module exports with normalized provenance and validation. Cross-Program symbol identity and binding reconciliation is not implemented for multi-project snapshots.',
			id: 'symbol-table',
			provider: 'typescript',
			provenance: TYPESCRIPT_SYMBOL_PROVENANCE,
			state: 'PARTIAL'
		},
		{
			explanation:
				'The current DWP-003 provider implements Program-local TS_TYPE records for types, type parameters, call and construct signatures, signature parameters, overload sets, declared type relations, and request-scoped checker assignability. Cross-Program type reconciliation, exhaustive all-pairs assignability, and DWP-004 composed graph projection are not implemented.',
			id: 'type-graph',
			provider: 'typescript',
			provenance: [...TYPESCRIPT_TYPE_PROVENANCE, ...TYPESCRIPT_SYMBOL_PROVENANCE],
			state: 'PARTIAL'
		}
	];
}

function artifactPopulations(
	files: readonly SelectedFileRecord[],
	subject: FrozenSubject
): ArtifactPopulation[] {
	const classes: ArtifactClass[] = [
		'CONFIGURATION',
		'GENERATED_SOURCE',
		'OTHER',
		'SCRIPT',
		'SOURCE',
		'TEST',
		'VERIFICATION'
	];
	return classes.map((artifactClass) => {
		const count = files.filter((file) => file.artifactClass === artifactClass).length;
		const excludedRecords = subject.excludedArtifacts.filter(
			(artifact) => inventoryArtifactClass(artifact.primaryClass) === artifactClass
		);
		const excluded = excludedRecords.some((artifact) => artifact.physicalFileCount === 'UNKNOWN')
			? ('UNKNOWN' as const)
			: excludedRecords.reduce(
					(total, artifact) => total + (artifact.physicalFileCount as number),
					0
				);
		return {
			artifactClass,
			discovered: excluded === 'UNKNOWN' ? ('UNKNOWN' as const) : count + excluded,
			excluded,
			failed: 0,
			included: count,
			provenance: [
				`subject.selectedFiles#artifactClass=${artifactClass}`,
				'subject.excludedArtifacts[*].physicalFileCount'
			],
			successfullyInventoried: count
		};
	});
}

function projectExclusionRecords(subject: FrozenSubject): ExclusionRecord[] {
	const byPolicy = new Map<string, FrozenSubject['excludedArtifacts'][number][]>();
	for (const artifact of subject.excludedArtifacts) {
		const records = byPolicy.get(artifact.policyId) ?? [];
		records.push(artifact);
		byPolicy.set(artifact.policyId, records);
	}
	return [...byPolicy]
		.map(([id, records]) => {
			const physicalPopulationKnown = records.every(
				(record) => record.physicalFileCount !== 'UNKNOWN'
			);
			return {
				countState: physicalPopulationKnown
					? ('PHYSICAL_POPULATION_ENUMERATED' as const)
					: ('PHYSICAL_POPULATION_NOT_ENUMERATED' as const),
				excludedPhysicalFileCount: physicalPopulationKnown
					? records.reduce((total, record) => total + (record.physicalFileCount as number), 0)
					: null,
				id,
				includedFileCount: 0 as const,
				physicalPopulationState: physicalPopulationKnown
					? ('EXCLUDED_AFTER_ENUMERATION' as const)
					: ('EXCLUDED_BEFORE_ENUMERATION' as const),
				policyRuleCount: new Set(records.map((record) => record.reason)).size,
				rules: [...new Set(records.map((record) => record.reason))].sort(compareText)
			};
		})
		.sort((left, right) => compareText(left.id, right.id));
}

function assertJpwbNonVacuity(
	rootManifest: JsonObject,
	workspaces: readonly WorkspaceInventory[],
	files: readonly SelectedFileRecord[],
	assets: readonly VerificationAssetInventory[],
	configuredCommands: readonly CommandInventory[]
): void {
	if (rootManifest.name !== 'janumi-professional-workbench') {
		throw new Error('JPWB inventory root manifest identity is absent or incompatible');
	}
	if (workspaces.length === 0) throw new Error('JPWB workspace population is empty');
	if (!assets.some((asset) => /^verif\/[^/]+\.ts$/.test(asset.path))) {
		throw new Error('JPWB top-level verif TypeScript population is empty');
	}
	if (!files.some((file) => file.path.startsWith('scripts/') && file.path.endsWith('.ts'))) {
		throw new Error('JPWB scripts TypeScript population is empty');
	}
	const rootNames = new Set(
		configuredCommands.filter((entry) => entry.owner === '.').map((entry) => entry.name)
	);
	for (const required of [
		'boundary',
		'check-types',
		'gate',
		'gate:fast',
		'lint',
		'test',
		'test:coverage'
	]) {
		if (!rootNames.has(required))
			throw new Error(`Required JPWB assurance command is absent: ${required}`);
	}
	const selectedPaths = new Set(files.map((file) => file.path));
	for (const required of TYPESCRIPT_SEMANTIC_PROVENANCE) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB TypeScript semantic implementation source is absent: ${required}`
			);
		}
	}
	for (const required of TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB TypeScript read/write access graph implementation source is absent: ${required}`
			);
		}
	}
	for (const required of [
		...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
		...JPWB_ARROW_COMMAND_CENSUS_RETAINED_PROVENANCE
	]) {
		if (!selectedPaths.has(required)) {
			throw new Error(
				`Required JPWB arrow-command census implementation or retained-authority artifact is absent: ${required}`
			);
		}
	}
}

export function collectInventory(options: CollectInventoryOptions): InventoryDocument {
	const resolvedSubject = projectSubjectForInventory(options.repositoryRoot);
	const rootManifest = readJsonObject(
		resolvedSubject,
		'package.json',
		'root manifest package.json'
	);
	const workspaces = projectWorkspaces(resolvedSubject);
	const perimeter = resolvedSubject.descriptor.perimeter;
	const selectedFiles = projectSelectedFiles(resolvedSubject);
	if (selectedFiles.length === 0) throw new Error('Selected file manifest is empty');
	const configuredCommands = commands(rootManifest, workspaces);
	const assets = verificationAssets(resolvedSubject, selectedFiles, configuredCommands);
	if (options.requireJpwbPopulations) {
		assertJpwbNonVacuity(rootManifest, workspaces, selectedFiles, assets, configuredCommands);
	}
	const inventory: InventoryDocument = {
		artifactPopulations: artifactPopulations(selectedFiles, resolvedSubject),
		assuranceSurfaces: assuranceSurfaces(resolvedSubject, selectedFiles, configuredCommands),
		capabilities: capabilities(),
		commands: configuredCommands,
		dependencyBoundary: dependencyBoundary(resolvedSubject, selectedFiles, rootManifest),
		generator: { id: INVENTORY_GENERATOR_ID, version: INVENTORY_GENERATOR_VERSION },
		providers: providerInventory(resolvedSubject, selectedFiles, configuredCommands),
		schemaVersion: INVENTORY_SCHEMA_VERSION,
		subject: {
			configurationDigest: resolvedSubject.descriptor.configurationDigest,
			configurationPreimage: subjectConfigurationPreimage(
				resolvedSubject.artifacts,
				resolvedSubject.generatedContexts,
				resolvedSubject.projects,
				resolvedSubject.workspaces
			),
			dirtyState: 'UNKNOWN',
			exclusionPolicyIds: resolvedSubject.descriptor.exclusionPolicyIds,
			excludedClasses: projectExclusionRecords(resolvedSubject),
			fileManifestDigest: resolvedSubject.descriptor.fileManifestDigest,
			generatedContexts: resolvedSubject.generatedContexts,
			parentRevision: null,
			perimeter,
			repositoryRoot: '.',
			revision: null,
			resolutionCompleteness:
				resolvedSubject.projects.some((project) => project.status === 'PARTIAL') ||
				resolvedSubject.diagnostics.some((item) => item.severity !== 'INFO')
					? 'PARTIAL'
					: 'COMPLETE',
			resolutionDiagnostics: resolvedSubject.diagnostics,
			schemaVersion: resolvedSubject.descriptor.schemaVersion,
			selectedFileCount: selectedFiles.length,
			selectedFiles,
			subjectId: resolvedSubject.descriptor.subjectId,
			subjectKind: 'WORKTREE'
		},
		typescriptProjects: projectTypeScriptProjects(resolvedSubject),
		unknowns: [
			{
				provenance: ['subject.dirtyState'],
				statement:
					'Git revision and dirty-state classification are not used as a generation prerequisite and remain UNKNOWN.'
			},
			{
				provenance: ['commands[*].state'],
				statement: 'Configured commands are inventoried but NOT_RUN by inventory generation.'
			},
			{
				provenance: [
					...TYPESCRIPT_SEMANTIC_PROVENANCE,
					...TYPESCRIPT_MODULE_GRAPH_PROVENANCE,
					...TYPESCRIPT_CALL_GRAPH_PROVENANCE,
					...TYPESCRIPT_READ_WRITE_ACCESS_GRAPH_PROVENANCE,
					...JPWB_STATE_MACHINE_GRAPH_PROVENANCE,
					...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
					...DEPENDENCY_CRUISER_CORROBORATION_PROVENANCE,
					'capabilities#arrow-command-census',
					'capabilities#call-graph',
					'capabilities#dependency-graph',
					'capabilities#read-write-access-graph',
					'capabilities#state-machine-graph',
					'capabilities#symbol-table',
					'capabilities#typescript-ast',
					'capabilities#type-graph'
				],
				statement:
					'TypeScript compiler roots from DWP-002 are consumed by current DWP-003 frozen Program construction and TS_PROJECT/TS_SYNTAX/TS_SYMBOL/TS_TYPE extraction. Semantic-snapshot duration enforcement uses a wall-anchored monotonic operation clock; maxDurationMs remains a caller-supplied operation budget and runaway guard, not an empirical runtime, expected duration, product ceiling, or SLO. The first six bounded DWP-004 increments implement the validated compiler module-dependency projection, pure exact-schema-validated dependency-cruiser 16.10.4 output normalization and context-bound comparison, a deliberately partial static call graph with total call-site/frontier accounting, an implementation-local generated JPWB state-machine topology projection, an exact FrozenSubject- and executor-bound wrapper around the retained arrow-command census, and a Program-local read/write access projection with explicit unsupported frontiers. Inventory generation executes or benchmarks none of these analysis providers. Cross-Program semantic reconciliation, invocation-specific resolved signatures, manifest/runtime dependency layers, graph algorithms, control-flow and JAN-CSAA-CAP-007 data-flow graphs, generalized state-machine inference, and composed graph projections remain UNIMPLEMENTED.'
			},
			{
				provenance: [
					...EXISTING_GRAPH_RELEVANT_VERIFICATION_AUTHORITY,
					...JPWB_ARROW_COMMAND_CENSUS_PROVENANCE,
					...TYPESCRIPT_CALL_GRAPH_PROVENANCE,
					...JPWB_STATE_MACHINE_GRAPH_PROVENANCE
				],
				statement: `Existing graph-relevant verif censuses remain authoritative for their specialized repository gates. The arrow-command analyzer's ${ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY} integration strategy is IMPLEMENTED by bounded CSAA adapter ${ARROW_COMMAND_CENSUS_ADAPTER_ID} using method ${ARROW_COMMAND_CENSUS_METHOD}, while its source, exact baseline, tests, ${ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY} verifier authority, oracle, and gate effect remain unchanged; the authority-resolution, aggregate-birth, command-dispatch, contract-number, dead-kernel, event-surface, policy-evidence-requirement, and route-action census families remain delegated and unwrapped. Neither the adapter, partial call graph, nor generated state-machine topology projection replaces, retires, weakens, or transfers retained authority. The adapter preserves the retained census limitations and does not establish runtime performability, handler-registry closure, replacement equivalence, or full graph-relation conformance.`
			},
			{
				provenance: ['subject.excludedClasses'],
				statement:
					'Physical files under excluded build, cache, dependency, and generated-output trees are intentionally not enumerated; their included count is zero and their physical count remains UNKNOWN.'
			},
			{
				provenance: ['assuranceSurfaces.coverage.outputIdentity'],
				statement:
					'Coverage output identity is UNKNOWN until a coverage adapter explicitly ingests an output.'
			},
			{
				provenance: ['capabilities'],
				statement:
					'Runtime, network, security-query, and external-provider health remain NOT_RUN or UNIMPLEMENTED.'
			}
		],
		verificationAssets: assets,
		workspaces
	};
	return inventory;
}
