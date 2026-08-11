import { basename } from 'node:path';
import ts from 'typescript';
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

function dependencyDeclarations(manifest: JsonObject, manifestPath: string): DependencyDeclaration[] {
	const scopes = [
		'dependencies',
		'devDependencies',
		'optionalDependencies',
		'peerDependencies'
	] as const;
	const declarations: DependencyDeclaration[] = [];
	for (const scope of scopes) {
		const values = sortedRecord(manifest[scope], `${manifestPath}#/${scope}`);
		for (const [name, specifier] of Object.entries(values)) declarations.push({ name, scope, specifier });
	}
	return declarations.sort((left, right) =>
		compareText(`${left.scope}\0${left.name}`, `${right.scope}\0${right.name}`)
	);
}

function inventoryArtifactClass(primaryClass: FrozenSubject['artifacts'][number]['primaryClass']): ArtifactClass {
	switch (primaryClass) {
		case 'MANIFEST':
		case 'LOCKFILE':
		case 'TOOL_CONFIGURATION':
		case 'PROJECT_CONFIGURATION':
		case 'GENERATED_CONFIGURATION': return 'CONFIGURATION';
		case 'PRODUCTION_SOURCE': return 'SOURCE';
		case 'TEST_SOURCE': return 'TEST';
		case 'GENERATED_SOURCE': return 'GENERATED_SOURCE';
		case 'GENERATOR_SOURCE':
		case 'SCRIPT': return 'SCRIPT';
		case 'VERIFICATION': return 'VERIFICATION';
		case 'BUILD_OUTPUT':
		case 'CACHE':
		case 'EXTERNAL_DEPENDENCY':
		case 'VENDOR':
		case 'OTHER': return 'OTHER';
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
		const manifest = readJsonObject(subject, workspace.manifestPath, `workspace manifest ${workspace.manifestPath}`);
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
		const generatedContexts = subject.generatedContexts.filter((context) => context.consumerProject === project.configPath);
		const generatedPaths = new Set(generatedContexts.map((context) => context.path));
		const generatedDiagnostics = subject.diagnostics.filter((diagnostic) =>
			diagnostic.code === 'GENERATED_CONTEXT_ABSENT' && diagnostic.path === project.configPath
			|| diagnostic.phase === 'FRESHNESS' && diagnostic.path !== null && generatedPaths.has(diagnostic.path)
		);
		const partialityReasons: TypeScriptProjectInventory['partialityReasons'][number][] = [];
		if (project.rootDisposition === 'INCOMPLETE') partialityReasons.push({
			code: 'ROOT_DISPOSITION_INCOMPLETE',
			message: 'TypeScript did not produce a complete compiler-root disposition for this project.',
			path: project.configPath,
			provenance: ['project.rootDisposition']
		});
		if (project.frameworkCandidates.length > 0) partialityReasons.push({
			code: 'FRAMEWORK_CANDIDATES_PRESENT',
			message: `${project.frameworkCandidates.length} framework candidate(s) remain outside the DWP-002 TypeScript compiler-root model.`,
			path: project.configPath,
			provenance: ['project.frameworkCandidates']
		});
		for (const diagnostic of project.typescriptDiagnostics.filter((item) => item.severity === 'ERROR' || item.code === 'TYPESCRIPT_PROJECT_PARTIAL')) partialityReasons.push({
			code: diagnostic.code,
			message: diagnostic.message,
			path: diagnostic.path,
			provenance: ['project.typescriptDiagnostics']
		});
		for (const diagnostic of generatedDiagnostics) partialityReasons.push({
			code: diagnostic.code,
			message: diagnostic.message,
			path: diagnostic.path,
			provenance: ['subject.diagnostics', 'subject.generatedContexts']
		});
		for (const context of generatedContexts.filter((item) => item.freshness === 'STALE')) partialityReasons.push({
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

function commands(rootManifest: JsonObject, workspaces: readonly WorkspaceInventory[]): CommandInventory[] {
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
	for (const workspace of workspaces) add(workspace.path, workspace.manifestPath, workspace.scripts);
	return sortUniqueBy(out, (entry) => `${entry.owner}\0${entry.name}`, 'configured command');
}

function propertyName(name: ts.PropertyName | undefined): string | undefined {
	if (!name) return undefined;
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
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

function findObjectProperty(source: string, fileName: string, wanted: string): JsonObject | undefined {
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
	const unitTests = files.filter((file) => /\.test\.[cm]?[jt]sx?$/.test(file.path)).map((file) => file.path);
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
	const boundaryCommand = sortedRecord(rootManifest.scripts, 'package.json#/scripts').boundary ?? null;
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
	const sourceFile = ts.createSourceFile(configurationPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
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
		configuredCommands.filter((command) => command.owner === '.').map((command) => [command.name, command.command])
	);
	const gateReachable = gateReachableScriptNames(rootScripts);
	return PROVIDERS.map(([name, potentialCapabilities]) => {
		const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const version = new RegExp(`^\\s*"${escaped}": \\["${escaped}@([^"\\s]+)"`, 'm').exec(text)?.[1] ?? null;
		const configurationPaths: Record<(typeof PROVIDERS)[number][0], readonly string[]> = {
			'@playwright/test': files.filter((file) => /playwright\.config\.ts$/.test(file.path)).map((file) => file.path),
			'@vitest/coverage-v8': files.some((file) => file.path === 'vitest.config.ts') ? ['vitest.config.ts'] : [],
			'dependency-cruiser': files.some((file) => file.path === '.dependency-cruiser.cjs')
				? ['.dependency-cruiser.cjs']
				: [],
			eslint: files.some((file) => file.path === 'eslint.config.mjs') ? ['eslint.config.mjs'] : [],
			sonar: files.some((file) => file.path === 'sonar-project.properties')
				? ['sonar-project.properties']
				: [],
			typescript: files.filter((file) => /(?:^|\/)tsconfig(?:\.[^/]+)?\.json$/.test(file.path)).map((file) => file.path),
			vitest: files.filter((file) => /^vitest(?:\.[^.]+)?\.(?:config|projects)\.ts$/.test(file.path)).map((file) => file.path)
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
			vitest: gateReachable.has('test:src') || gateReachable.has('test')
				? ['package.json#/scripts/test']
				: []
		};
		const configured = configurationPaths[name].length > 0;
		const gateWired = gateEvidence[name].length > 0;
		const inventoryIntegrated = name === 'typescript';
		return {
			adapterCapabilities: inventoryIntegrated ? ['configuration-ast-parse'] : [],
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
				...gateEvidence[name]
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
		if (!selectedFile) throw new Error(`Verification asset is absent from selected-file manifest: ${path}`);
		const text = frozenText(subject, path);
		const stem = basename(path).replace(/\.test\.ts$|\.data\.ts$|\.ts$/, '');
		const isTest = path.endsWith('.test.ts');
		const isData = path.endsWith('.data.ts');
		const isGuard = !isTest && /(?:guard|refusal)/.test(basename(path));
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
		if (!isTest && projectsText.includes(basename(path))) carriers.push('vitest.projects.ts#setupFiles');
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
			disposition: role === 'ANALYZER' ? 'WRAP' : 'RETAIN_DELEGATED',
			extractionMethod,
			gateCarriers: [...new Set(carriers)].sort(compareText),
			path,
			provenance: [path],
			role
		};
	});
}

function capabilities(): CapabilityInventory[] {
	return [
		{
			explanation: 'DWP-001 deterministically derives and verifies the repository inventory.',
			id: 'repository-inventory',
			provider: INVENTORY_GENERATOR_ID,
			provenance: ['packages/csaa/src/inventory/collect-inventory.ts'],
			state: 'IMPLEMENTED'
		},
		...[
			'call-graph',
			'code-property-graph',
			'control-flow',
			'data-flow',
			'runtime-traces',
			'security-query',
			'symbol-table',
			'test-coverage-ingestion',
			'type-graph',
			'typescript-ast'
		].map(
			(id): CapabilityInventory => ({
				explanation: 'Scheduled after the generated-inventory increment; no support is inferred from installed tools.',
				id,
				provider: null,
				provenance: ['packages/csaa/src/contracts/inventory.ts'],
				state: 'UNIMPLEMENTED'
			})
		)
	];
}

function artifactPopulations(files: readonly SelectedFileRecord[], subject: FrozenSubject): ArtifactPopulation[] {
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
		const excludedRecords = subject.excludedArtifacts.filter((artifact) => inventoryArtifactClass(artifact.primaryClass) === artifactClass);
		const excluded = excludedRecords.some((artifact) => artifact.physicalFileCount === 'UNKNOWN')
			? 'UNKNOWN' as const
			: excludedRecords.reduce((total, artifact) => total + (artifact.physicalFileCount as number), 0);
		return {
			artifactClass,
			discovered: excluded === 'UNKNOWN' ? 'UNKNOWN' as const : count + excluded,
			excluded,
			failed: 0,
			included: count,
			provenance: [`subject.selectedFiles#artifactClass=${artifactClass}`, 'subject.excludedArtifacts[*].physicalFileCount'],
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
	return [...byPolicy].map(([id, records]) => {
		const physicalPopulationKnown = records.every((record) => record.physicalFileCount !== 'UNKNOWN');
		return {
			countState: physicalPopulationKnown ? 'PHYSICAL_POPULATION_ENUMERATED' as const : 'PHYSICAL_POPULATION_NOT_ENUMERATED' as const,
			excludedPhysicalFileCount: physicalPopulationKnown ? records.reduce((total, record) => total + (record.physicalFileCount as number), 0) : null,
			id,
			includedFileCount: 0 as const,
			physicalPopulationState: physicalPopulationKnown ? 'EXCLUDED_AFTER_ENUMERATION' as const : 'EXCLUDED_BEFORE_ENUMERATION' as const,
			policyRuleCount: new Set(records.map((record) => record.reason)).size,
			rules: [...new Set(records.map((record) => record.reason))].sort(compareText)
		};
	}).sort((left, right) => compareText(left.id, right.id));
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
	const rootNames = new Set(configuredCommands.filter((entry) => entry.owner === '.').map((entry) => entry.name));
	for (const required of ['boundary', 'check-types', 'gate', 'gate:fast', 'lint', 'test', 'test:coverage']) {
		if (!rootNames.has(required)) throw new Error(`Required JPWB assurance command is absent: ${required}`);
	}
}

export function collectInventory(options: CollectInventoryOptions): InventoryDocument {
	const resolvedSubject = projectSubjectForInventory(options.repositoryRoot);
	const rootManifest = readJsonObject(resolvedSubject, 'package.json', 'root manifest package.json');
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
			configurationPreimage: subjectConfigurationPreimage(resolvedSubject.artifacts, resolvedSubject.generatedContexts, resolvedSubject.projects, resolvedSubject.workspaces),
			dirtyState: 'UNKNOWN',
			exclusionPolicyIds: resolvedSubject.descriptor.exclusionPolicyIds,
			excludedClasses: projectExclusionRecords(resolvedSubject),
			fileManifestDigest: resolvedSubject.descriptor.fileManifestDigest,
			generatedContexts: resolvedSubject.generatedContexts,
			parentRevision: null,
			perimeter,
			repositoryRoot: '.',
			revision: null,
			resolutionCompleteness: resolvedSubject.projects.some((project) => project.status === 'PARTIAL') || resolvedSubject.diagnostics.some((item) => item.severity !== 'INFO') ? 'PARTIAL' : 'COMPLETE',
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
				statement: 'Git revision and dirty-state classification are not used as a generation prerequisite and remain UNKNOWN.'
			},
			{
				provenance: ['commands[*].state'],
				statement: 'Configured commands are inventoried but NOT_RUN by inventory generation.'
			},
			{
				provenance: ['typescriptProjects[*].resolvedRootState'],
				statement: 'TypeScript compiler roots are resolved by DWP-002; semantic Program construction remains deferred to DWP-003.'
			},
			{
				provenance: ['subject.excludedClasses'],
				statement: 'Physical files under excluded build, cache, dependency, and generated-output trees are intentionally not enumerated; their included count is zero and their physical count remains UNKNOWN.'
			},
			{
				provenance: ['assuranceSurfaces.coverage.outputIdentity'],
				statement: 'Coverage output identity is UNKNOWN until a coverage adapter explicitly ingests an output.'
			},
			{
				provenance: ['capabilities'],
				statement: 'Runtime, network, security-query, and external-provider health remain NOT_RUN or UNIMPLEMENTED.'
			}
		],
		verificationAssets: assets,
		workspaces
	};
	return inventory;
}
