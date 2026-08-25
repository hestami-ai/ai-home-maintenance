import { posix } from 'node:path';
import { TextDecoder } from 'node:util';
import ts from 'typescript';
import type {
	SubjectDiagnostic,
	TestPopulationProvider,
	TestPopulationRecord
} from '../contracts/subject.js';
import { canonicalJson, compareText, sha256 } from '../inventory/canonical.js';
import type { SubjectCapture } from './capture-model.js';
import { assertCanonicalRelativePath } from './paths.js';
import { globMatches, validateBoundedPattern } from './policy.js';

export const TEST_POPULATION_DISCOVERY_METHOD =
	'captured-config-ast-and-captured-test-artifact-reconciliation/1.0.0' as const;
export const JPWB_VITEST_PROJECT_DISCOVERY_SYNTAX_DIGEST =
	'721a494885016386f55983af8f62feab8e244d51cc79cd58a2cf3042828db565' as const;

export interface TestPopulationDiscovery {
	readonly diagnostics: readonly SubjectDiagnostic[];
	readonly populations: readonly TestPopulationRecord[];
}

interface LiteralConfiguration {
	readonly parseErrors: number;
	readonly sourceFile: ts.SourceFile;
}

interface ConfiguredTestProject {
	readonly excludePatterns: readonly string[];
	readonly includePatterns: readonly string[];
	readonly passWithNoTests: boolean | null;
	readonly rootPattern: string | null;
}

interface ConfiguredProjectDiscovery {
	readonly factoryNames: ReadonlySet<string>;
	readonly limitations: readonly string[];
	readonly projects: readonly ConfiguredTestProject[];
}

function propertyName(name: ts.PropertyName | undefined): string | null {
	if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)))
		return name.text;
	return null;
}

function bindingNameContains(name: ts.BindingName, candidate: string): boolean {
	if (ts.isIdentifier(name)) return name.text === candidate;
	return name.elements.some(
		(element) => !ts.isOmittedExpression(element) && bindingNameContains(element.name, candidate)
	);
}

function hasConflictingTopLevelValueBinding(
	config: LiteralConfiguration,
	localName: string,
	admittedImport: ts.ImportSpecifier
): boolean {
	for (const statement of config.sourceFile.statements) {
		if (ts.isImportDeclaration(statement)) {
			const clause = statement.importClause;
			if (clause?.name?.text === localName) return true;
			const bindings = clause?.namedBindings;
			if (
				bindings !== undefined &&
				ts.isNamespaceImport(bindings) &&
				bindings.name.text === localName
			)
				return true;
			if (bindings !== undefined && ts.isNamedImports(bindings))
				for (const element of bindings.elements)
					if (element !== admittedImport && element.name.text === localName) return true;
			continue;
		}
		if (
			(ts.isFunctionDeclaration(statement) ||
				ts.isClassDeclaration(statement) ||
				ts.isEnumDeclaration(statement) ||
				ts.isModuleDeclaration(statement)) &&
			statement.name !== undefined &&
			ts.isIdentifier(statement.name) &&
			statement.name.text === localName
		)
			return true;
		if (ts.isVariableStatement(statement))
			for (const declaration of statement.declarationList.declarations)
				if (bindingNameContains(declaration.name, localName)) return true;
	}
	return false;
}

function exactNamedValueImport(
	config: LiteralConfiguration,
	moduleName: string,
	importedName: string
): { readonly declaration: ts.ImportDeclaration; readonly localName: string } | null {
	const matches: Array<{
		readonly declaration: ts.ImportDeclaration;
		readonly element: ts.ImportSpecifier;
	}> = [];
	for (const statement of config.sourceFile.statements) {
		if (
			!ts.isImportDeclaration(statement) ||
			!ts.isStringLiteral(statement.moduleSpecifier) ||
			statement.moduleSpecifier.text !== moduleName ||
			statement.importClause === undefined ||
			statement.importClause.isTypeOnly ||
			statement.importClause.namedBindings === undefined ||
			!ts.isNamedImports(statement.importClause.namedBindings)
		)
			continue;
		for (const element of statement.importClause.namedBindings.elements)
			if (!element.isTypeOnly && (element.propertyName ?? element.name).text === importedName)
				matches.push({ declaration: statement, element });
	}
	if (matches.length !== 1) return null;
	const match = matches[0]!;
	return hasConflictingTopLevelValueBinding(config, match.element.name.text, match.element)
		? null
		: { declaration: match.declaration, localName: match.element.name.text };
}

function configuration(source: string, path: string): LiteralConfiguration {
	const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
	const parseErrors =
		(sourceFile as unknown as { readonly parseDiagnostics?: readonly unknown[] }).parseDiagnostics
			?.length ?? 0;
	return { parseErrors, sourceFile };
}

function captureText(capture: SubjectCapture, path: string): string | null {
	const bytes = capture.bytesByPath.get(path);
	if (bytes === undefined) return null;
	try {
		return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
	} catch {
		return null;
	}
}

function unique(values: readonly string[]): string[] {
	return [...new Set(values)].sort(compareText);
}

function directProperty(
	object: ts.ObjectLiteralExpression,
	name: string
): ts.PropertyAssignment | null {
	const seen = new Set<string>();
	for (const property of object.properties) {
		if (ts.isSpreadAssignment(property)) return null;
		const candidate = propertyName(property.name);
		if (candidate === null || seen.has(candidate)) return null;
		seen.add(candidate);
	}
	for (const property of object.properties)
		if (ts.isPropertyAssignment(property) && propertyName(property.name) === name) return property;
	return null;
}

function syntaxDigest(config: LiteralConfiguration): string {
	const scanner = ts.createScanner(
		ts.ScriptTarget.Latest,
		true,
		ts.LanguageVariant.Standard,
		config.sourceFile.text
	);
	const tokens: Array<readonly [number, string]> = [];
	for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan())
		tokens.push([token, scanner.getTokenText()]);
	return sha256(`JAN-CSAA-VITEST-PROJECT-DISCOVERY-SYNTAX\0${canonicalJson(tokens)}`);
}

export function vitestProjectDiscoverySyntaxDigest(source: string): string {
	return syntaxDigest(configuration(source, 'vitest.projects.ts'));
}

function staticPattern(expression: ts.Expression): string | null {
	if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
		return expression.text;
	if (!ts.isTemplateExpression(expression)) return null;
	let pattern = expression.head.text;
	for (const span of expression.templateSpans) {
		if (!ts.isIdentifier(span.expression) || span.expression.text !== 'name') return null;
		pattern += `*${span.literal.text}`;
	}
	return pattern;
}

function staticPatterns(expression: ts.Expression): string[] | null {
	if (!ts.isArrayLiteralExpression(expression)) return null;
	const patterns: string[] = [];
	for (const element of expression.elements) {
		if (!ts.isExpression(element)) return null;
		const pattern = staticPattern(element);
		if (pattern === null) return null;
		patterns.push(pattern);
	}
	return patterns;
}

function staticPatternList(expression: ts.Expression): string[] | null {
	const single = staticPattern(expression);
	return single === null ? staticPatterns(expression) : [single];
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
	let current = expression;
	while (
		ts.isParenthesizedExpression(current) ||
		ts.isAsExpression(current) ||
		ts.isSatisfiesExpression(current)
	)
		current = current.expression;
	return current;
}

function defaultDefineConfigObject(
	config: LiteralConfiguration,
	moduleName: '@playwright/test' | 'vitest/config'
): ts.ObjectLiteralExpression | null {
	const assignments = config.sourceFile.statements.filter(
		(statement): statement is ts.ExportAssignment =>
			ts.isExportAssignment(statement) && !statement.isExportEquals
	);
	if (assignments.length !== 1) return null;
	const expression = unwrapExpression(assignments[0]!.expression);
	const binding = exactNamedValueImport(config, moduleName, 'defineConfig');
	if (
		binding === null ||
		!ts.isCallExpression(expression) ||
		!ts.isIdentifier(expression.expression) ||
		expression.expression.text !== binding.localName ||
		expression.arguments.length !== 1
	)
		return null;
	const argument = expression.arguments[0];
	return argument !== undefined && ts.isObjectLiteralExpression(unwrapExpression(argument))
		? (unwrapExpression(argument) as ts.ObjectLiteralExpression)
		: null;
}

function projectFromObject(
	object: ts.ObjectLiteralExpression,
	limitations: string[]
): ConfiguredTestProject | null {
	const test = directProperty(object, 'test');
	if (test === null || !ts.isObjectLiteralExpression(unwrapExpression(test.initializer))) {
		limitations.push('VITEST_PROJECT_TEST_CONFIGURATION_NOT_STATIC');
		return null;
	}
	const testObject = unwrapExpression(test.initializer) as ts.ObjectLiteralExpression;
	const root = directProperty(testObject, 'root');
	const include = directProperty(testObject, 'include');
	const exclude = directProperty(testObject, 'exclude');
	const passWithNoTests = directProperty(testObject, 'passWithNoTests');
	const includePatterns = include === null ? null : staticPatterns(include.initializer);
	const excludePatterns = exclude === null ? [] : staticPatterns(exclude.initializer);
	if (root === null || staticPattern(root.initializer) === null || includePatterns === null)
		limitations.push('VITEST_PROJECT_SELECTION_NOT_STATIC');
	if (excludePatterns === null) limitations.push('VITEST_PROJECT_EXCLUSION_NOT_STATIC');
	return {
		excludePatterns: excludePatterns ?? [],
		includePatterns: includePatterns ?? [],
		passWithNoTests:
			passWithNoTests?.initializer.kind === ts.SyntaxKind.FalseKeyword
				? false
				: passWithNoTests?.initializer.kind === ts.SyntaxKind.TrueKeyword
					? true
					: null,
		rootPattern: root === null ? null : staticPattern(root.initializer)
	};
}

function returnedObject(
	functionLike: ts.ArrowFunction | ts.FunctionExpression
): ts.ObjectLiteralExpression | null {
	if (!ts.isBlock(functionLike.body)) {
		const body = unwrapExpression(functionLike.body);
		return ts.isObjectLiteralExpression(body) ? body : null;
	}
	const returns = functionLike.body.statements.filter(ts.isReturnStatement);
	if (returns.length !== 1 || returns[0]!.expression === undefined) return null;
	const body = unwrapExpression(returns[0]!.expression!);
	return ts.isObjectLiteralExpression(body) ? body : null;
}

function mappedProjectObject(element: ts.SpreadElement): {
	readonly factoryName: string;
	readonly object: ts.ObjectLiteralExpression;
} | null {
	const expression = unwrapExpression(element.expression);
	if (
		!ts.isCallExpression(expression) ||
		!ts.isPropertyAccessExpression(expression.expression) ||
		expression.expression.name.text !== 'map' ||
		expression.arguments.length !== 1
	)
		return null;
	const factoryCall = unwrapExpression(expression.expression.expression);
	const mapper = expression.arguments[0];
	if (
		!ts.isCallExpression(factoryCall) ||
		!ts.isIdentifier(factoryCall.expression) ||
		factoryCall.arguments.length !== 0 ||
		mapper === undefined ||
		(!ts.isArrowFunction(mapper) && !ts.isFunctionExpression(mapper))
	)
		return null;
	const object = returnedObject(mapper);
	return object === null ? null : { factoryName: factoryCall.expression.text, object };
}

function configuredTestProjects(config: LiteralConfiguration): ConfiguredProjectDiscovery {
	const limitations: string[] = [];
	const projects: ConfiguredTestProject[] = [];
	const factoryNames = new Set<string>();
	const functions = config.sourceFile.statements.filter(
		(statement): statement is ts.FunctionDeclaration =>
			ts.isFunctionDeclaration(statement) &&
			statement.name?.text === 'projectsFor' &&
			statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ===
				true
	);
	if (functions.length !== 1 || functions[0]!.body === undefined)
		return {
			factoryNames,
			limitations: ['VITEST_PROJECT_FACTORY_DEFINITION_NOT_STATIC_AND_UNIQUE'],
			projects
		};
	const returns = functions[0]!.body!.statements.filter(ts.isReturnStatement);
	if (returns.length !== 1 || returns[0]!.expression === undefined) {
		limitations.push('VITEST_PROJECT_FACTORY_RETURN_NOT_STATIC_AND_UNIQUE');
		return { factoryNames, limitations, projects };
	}
	const returned = unwrapExpression(returns[0]!.expression!);
	if (!ts.isArrayLiteralExpression(returned)) {
		limitations.push('VITEST_PROJECT_FACTORY_RETURN_NOT_ARRAY_LITERAL');
		return { factoryNames, limitations, projects };
	}
	for (const element of returned.elements) {
		if (ts.isObjectLiteralExpression(element)) {
			const project = projectFromObject(element, limitations);
			if (project !== null) projects.push(project);
			continue;
		}
		if (ts.isSpreadElement(element)) {
			const mapped = mappedProjectObject(element);
			if (mapped !== null) {
				factoryNames.add(mapped.factoryName);
				const project = projectFromObject(mapped.object, limitations);
				if (project !== null) projects.push(project);
				continue;
			}
		}
		limitations.push('VITEST_PROJECT_FACTORY_ELEMENT_UNMODELED');
	}
	return { factoryNames, limitations, projects };
}

function resolvedProjectPattern(configPath: string, root: string, pattern: string): string {
	const base = posix.dirname(configPath);
	const result = posix.normalize(posix.join(base, root, pattern));
	assertCanonicalRelativePath(result);
	return result;
}

function vitestRootSelectionLimitations(config: LiteralConfiguration): string[] {
	const root = defaultDefineConfigObject(config, 'vitest/config');
	if (root === null) return ['VITEST_DEFINE_CONFIG_EXPORT_NOT_STATIC_AND_UNIQUE'];
	const test = directProperty(root, 'test');
	if (test === null || !ts.isObjectLiteralExpression(unwrapExpression(test.initializer)))
		return ['VITEST_ROOT_TEST_CONFIGURATION_NOT_STATIC'];
	const testObject = unwrapExpression(test.initializer) as ts.ObjectLiteralExpression;
	return directProperty(testObject, 'include') !== null ||
		directProperty(testObject, 'exclude') !== null
		? ['VITEST_ROOT_SELECTION_OVERRIDE_UNMODELED']
		: [];
}

interface ImportedProjectsBinding {
	readonly localName: string;
	readonly path: string;
}

function importedProjectsBinding(
	capture: SubjectCapture,
	configurationPath: string,
	config: LiteralConfiguration
): ImportedProjectsBinding | null {
	const imports = config.sourceFile.statements
		.filter(
			(statement): statement is ts.ImportDeclaration =>
				ts.isImportDeclaration(statement) &&
				ts.isStringLiteral(statement.moduleSpecifier) &&
				statement.importClause !== undefined &&
				!statement.importClause.isTypeOnly &&
				statement.importClause.namedBindings !== undefined &&
				ts.isNamedImports(statement.importClause.namedBindings)
		)
		.flatMap((declaration) =>
			(declaration.importClause!.namedBindings as ts.NamedImports).elements
				.filter(
					(element) =>
						!element.isTypeOnly && (element.propertyName ?? element.name).text === 'projectsFor'
				)
				.map((element) => ({ declaration, element }))
		);
	if (imports.length !== 1) return null;
	const imported = imports[0]!;
	if (hasConflictingTopLevelValueBinding(config, imported.element.name.text, imported.element))
		return null;
	const specifier = (imported.declaration.moduleSpecifier as ts.StringLiteral).text;
	if (!specifier.startsWith('./') && !specifier.startsWith('../')) return null;
	const resolved = posix.normalize(posix.join(posix.dirname(configurationPath), specifier));
	const candidates = unique([
		resolved,
		resolved.replace(/\.js$/u, '.ts'),
		resolved.replace(/\.mjs$/u, '.mts'),
		resolved.replace(/\.cjs$/u, '.cts')
	]);
	const selected = candidates.filter((path) => capture.bytesByPath.has(path));
	return selected.length === 1
		? { localName: imported.element.name.text, path: selected[0]! }
		: null;
}

function runnableSourcePaths(capture: SubjectCapture): string[] {
	return capture.artifacts
		.map((artifact) => artifact.path)
		.filter((path) => /\.[cm]?[jt]sx?$/u.test(path))
		.sort(compareText);
}

function configuredProfile(
	configurationPath: string,
	provider: 'vitest' | 'playwright',
	defaultProfile: string
): string {
	const file = posix.basename(configurationPath);
	const match = file.match(new RegExp(`^${provider}(?:\\.([^/]+))?\\.config\\.[cm]?[jt]s$`, 'u'));
	const localProfile = (match?.[1] ?? defaultProfile).toUpperCase().replace(/[^A-Z0-9]+/gu, '_');
	return localProfile;
}

function withinDirectory(path: string, directory: string): boolean {
	return directory === '.' || path.startsWith(`${directory}/`);
}

function validateRunnerPattern(pattern: string): void {
	validateBoundedPattern(pattern);
	if (/[+?*@]\(/u.test(pattern)) throw new Error(`Unsupported runner glob syntax: ${pattern}`);
}

function hasProjectsForTrueSelection(
	config: LiteralConfiguration,
	projectsForLocalName: string | null
): boolean {
	const root = defaultDefineConfigObject(config, 'vitest/config');
	if (root === null) return false;
	const test = directProperty(root, 'test');
	if (test === null || !ts.isObjectLiteralExpression(unwrapExpression(test.initializer)))
		return false;
	const projects = directProperty(
		unwrapExpression(test.initializer) as ts.ObjectLiteralExpression,
		'projects'
	);
	if (projects === null || !ts.isCallExpression(unwrapExpression(projects.initializer)))
		return false;
	const call = unwrapExpression(projects.initializer) as ts.CallExpression;
	return (
		projectsForLocalName !== null &&
		ts.isIdentifier(call.expression) &&
		call.expression.text === projectsForLocalName &&
		call.arguments.length === 1 &&
		call.arguments[0]?.kind === ts.SyntaxKind.TrueKeyword
	);
}

function populationProfileId(
	provider: TestPopulationProvider,
	profile: string,
	configurationPaths: readonly string[]
): string {
	const paths = unique(configurationPaths);
	return sha256(
		`JAN-CSAA-TEST-POPULATION-PROFILE\0${TEST_POPULATION_DISCOVERY_METHOD}\0${canonicalJson({ configurationPaths: paths, profile, provider })}`
	);
}

function makePopulation(options: {
	readonly candidates: readonly string[];
	readonly configurationPaths: readonly string[];
	readonly excludePatterns: readonly string[];
	readonly includePatterns: readonly string[];
	readonly includedPaths: readonly string[];
	readonly limitations: readonly string[];
	readonly profile: string;
	readonly provider: TestPopulationProvider;
	readonly provenance: readonly string[];
}): TestPopulationRecord {
	const candidates = unique(options.candidates);
	const includedPaths = unique(options.includedPaths);
	const included = new Set(includedPaths);
	if (includedPaths.some((path) => !candidates.includes(path)))
		throw new Error(
			'Test population included path is outside its discovered candidate population.'
		);
	const excludedPaths = candidates.filter((path) => !included.has(path));
	const status = options.limitations.length === 0 ? 'COMPLETE' : 'PARTIAL';
	const configurationPaths = unique(options.configurationPaths);
	const excludePatterns = unique(options.excludePatterns);
	const includePatterns = unique(options.includePatterns);
	const limitations = unique(options.limitations);
	const provenance = unique(options.provenance);
	const profileId = populationProfileId(options.provider, options.profile, configurationPaths);
	const selectionDigest = sha256(
		`JAN-CSAA-TEST-POPULATION-SELECTION\0${TEST_POPULATION_DISCOVERY_METHOD}\0${canonicalJson({
			configurationPaths,
			excludePatterns,
			excludedPaths,
			includePatterns,
			includedPaths,
			limitations,
			profile: options.profile,
			provider: options.provider,
			status
		})}`
	);
	return Object.freeze({
		configurationPaths: Object.freeze(configurationPaths),
		discovered: candidates.length,
		discoveryMethod: TEST_POPULATION_DISCOVERY_METHOD,
		excluded: excludedPaths.length,
		excludePatterns: Object.freeze(excludePatterns),
		excludedPaths: Object.freeze(excludedPaths),
		failed: 0,
		id: sha256(`JAN-CSAA-TEST-POPULATION-RECORD\0${profileId}\0${selectionDigest}`),
		includePatterns: Object.freeze(includePatterns),
		included: includedPaths.length,
		includedPaths: Object.freeze(includedPaths),
		limitations: Object.freeze(limitations),
		profileId,
		populationClosure: status === 'COMPLETE' ? 'CLOSED_FOR_CAPTURED_TEST_ARTIFACTS' : 'OPEN',
		profile: options.profile,
		provider: options.provider,
		provenance: Object.freeze(provenance),
		reconciles: candidates.length === includedPaths.length + excludedPaths.length,
		selectionDigest,
		status
	});
}

function vitestPopulations(
	capture: SubjectCapture,
	testPaths: readonly string[],
	runnablePaths: readonly string[]
): TestPopulationRecord[] {
	const configurations = capture.artifacts
		.map((artifact) => artifact.path)
		.filter((path) => /(^|\/)vitest(?:\.[^/]+)?\.config\.[cm]?[jt]s$/u.test(path))
		.sort(compareText);
	if (configurations.length === 0) return [];
	return configurations.map((configurationPath) => {
		const limitations: string[] = [];
		const configSource = captureText(capture, configurationPath);
		const config = configSource === null ? null : configuration(configSource, configurationPath);
		if (config === null || config.parseErrors > 0)
			limitations.push('VITEST_CONFIGURATION_UNREADABLE_OR_MALFORMED');
		if (config !== null) {
			limitations.push(...vitestRootSelectionLimitations(config));
		}
		const projectsBinding =
			config === null ? null : importedProjectsBinding(capture, configurationPath, config);
		if (config !== null && !hasProjectsForTrueSelection(config, projectsBinding?.localName ?? null))
			limitations.push('VITEST_PROJECT_FACTORY_NOT_BOUND_WITH_EXTENDS_TRUE');
		const projectsPath = projectsBinding?.path ?? null;
		if (projectsPath === null) limitations.push('VITEST_PROJECT_CONFIGURATION_IMPORT_NOT_RESOLVED');
		const projectsSource = projectsPath === null ? null : captureText(capture, projectsPath);
		const projectsConfig =
			projectsSource === null || projectsPath === null
				? null
				: configuration(projectsSource, projectsPath);
		let includePatterns: string[] = [];
		let excludePatterns: string[] = [];
		if (projectsConfig === null || projectsConfig.parseErrors > 0)
			limitations.push('VITEST_PROJECT_CONFIGURATION_UNREADABLE_OR_MALFORMED');
		else {
			if (syntaxDigest(projectsConfig) !== JPWB_VITEST_PROJECT_DISCOVERY_SYNTAX_DIGEST)
				limitations.push('VITEST_PROJECT_DISCOVERY_IMPLEMENTATION_UNRECOGNIZED');
			const discovery = configuredTestProjects(projectsConfig);
			limitations.push(...discovery.limitations);
			if (
				!discovery.factoryNames.has('packagesWithTests') ||
				!discovery.factoryNames.has('appsWithTests') ||
				[...discovery.factoryNames].some(
					(name) => name !== 'packagesWithTests' && name !== 'appsWithTests'
				)
			)
				limitations.push('VITEST_WORKSPACE_TEST_DISCOVERY_NOT_TOTAL');
			const configuredProjects = discovery.projects;
			if (configuredProjects.length === 0)
				limitations.push('VITEST_CONFIGURED_PROJECT_POPULATION_EMPTY');
			if (configuredProjects.some((project) => project.passWithNoTests !== false))
				limitations.push('VITEST_EMPTY_POPULATION_DOES_NOT_FAIL_CLOSED');
			if (
				configuredProjects.some(
					(project) => project.rootPattern === null || project.includePatterns.length === 0
				)
			)
				limitations.push('VITEST_PROJECT_SELECTION_NOT_STATIC');
			try {
				includePatterns = unique(
					configuredProjects.flatMap((project) =>
						project.rootPattern === null
							? []
							: project.includePatterns.map((pattern) =>
									resolvedProjectPattern(projectsPath!, project.rootPattern!, pattern)
								)
					)
				);
				excludePatterns = unique(
					configuredProjects.flatMap((project) =>
						project.rootPattern === null
							? []
							: project.excludePatterns.map((pattern) =>
									resolvedProjectPattern(projectsPath!, project.rootPattern!, pattern)
								)
					)
				);
				for (const pattern of [...includePatterns, ...excludePatterns])
					validateRunnerPattern(pattern);
			} catch {
				limitations.push('VITEST_PROJECT_SELECTION_UNSUPPORTED_OR_ESCAPES_REPOSITORY');
			}
		}
		const includedPaths = runnablePaths.filter(
			(path) =>
				includePatterns.some((pattern) => globMatches(path, pattern)) &&
				!excludePatterns.some((pattern) => globMatches(path, pattern))
		);
		const candidates = unique([...testPaths, ...includedPaths]);
		if (includedPaths.length === 0) limitations.push('VITEST_INCLUDED_POPULATION_EMPTY');
		return makePopulation({
			candidates,
			configurationPaths: [configurationPath, ...(projectsPath === null ? [] : [projectsPath])],
			excludePatterns,
			includePatterns,
			includedPaths,
			limitations,
			profile: configuredProfile(configurationPath, 'vitest', 'SOURCE'),
			provider: 'VITEST',
			provenance: [
				`${configurationPath}#/test/projects`,
				...(projectsPath === null ? [] : [`${projectsPath}#/projectsFor`])
			]
		});
	});
}

function resolvedConfigPattern(configPath: string, directory: string, pattern: string): string {
	const base = posix.dirname(configPath);
	const resolvedDirectory = posix.normalize(posix.join(base, directory));
	const result = posix.normalize(posix.join(resolvedDirectory, pattern));
	assertCanonicalRelativePath(result);
	return result;
}

function playwrightPopulations(
	capture: SubjectCapture,
	testPaths: readonly string[],
	runnablePaths: readonly string[]
): TestPopulationRecord[] {
	return capture.artifacts
		.map((artifact) => artifact.path)
		.filter((path) => /(^|\/)playwright(?:\.[^/]+)?\.config\.[cm]?[jt]s$/u.test(path))
		.sort(compareText)
		.map((configurationPath) => {
			const limitations: string[] = [];
			const source = captureText(capture, configurationPath);
			const config = source === null ? null : configuration(source, configurationPath);
			if (config === null || config.parseErrors > 0)
				limitations.push('PLAYWRIGHT_CONFIGURATION_UNREADABLE_OR_MALFORMED');
			const root = config === null ? null : defaultDefineConfigObject(config, '@playwright/test');
			if (config !== null && root === null)
				limitations.push('PLAYWRIGHT_DEFINE_CONFIG_EXPORT_NOT_STATIC_AND_UNIQUE');
			const testDirectoryProperty = root === null ? null : directProperty(root, 'testDir');
			const testMatchProperty = root === null ? null : directProperty(root, 'testMatch');
			const testIgnoreProperty = root === null ? null : directProperty(root, 'testIgnore');
			const projectsProperty = root === null ? null : directProperty(root, 'projects');
			if (projectsProperty !== null) {
				const initializer = unwrapExpression(projectsProperty.initializer);
				if (
					!ts.isArrayLiteralExpression(initializer) ||
					initializer.elements.some((element) => {
						if (!ts.isObjectLiteralExpression(element)) return true;
						if (element.properties.some(ts.isSpreadAssignment)) return true;
						return ['testDir', 'testMatch', 'testIgnore'].some(
							(name) => directProperty(element, name) !== null
						);
					})
				)
					limitations.push('PLAYWRIGHT_PROJECT_SELECTION_OVERRIDE_UNMODELED');
			}
			const testDirectories =
				testDirectoryProperty === null
					? null
					: staticPatternList(testDirectoryProperty.initializer);
			const testMatches =
				testMatchProperty === null ? null : staticPatternList(testMatchProperty.initializer);
			const testIgnores =
				testIgnoreProperty === null ? [] : staticPatternList(testIgnoreProperty.initializer);
			if (testDirectories?.length !== 1 || testMatches === null || testMatches.length === 0)
				limitations.push('PLAYWRIGHT_TEST_SELECTION_NOT_STATIC_AND_UNIQUE');
			if (testIgnores === null) limitations.push('PLAYWRIGHT_TEST_EXCLUSION_NOT_STATIC');
			let includePatterns: string[] = [];
			let excludePatterns: string[] = [];
			try {
				if (testDirectories?.length === 1 && testMatches !== null)
					includePatterns = unique(
						testMatches.map((pattern) =>
							resolvedConfigPattern(configurationPath, testDirectories[0]!, pattern)
						)
					);
				if (testDirectories?.length === 1 && testIgnores !== null)
					excludePatterns = unique(
						testIgnores.map((pattern) =>
							resolvedConfigPattern(configurationPath, testDirectories[0]!, pattern)
						)
					);
				for (const pattern of [...includePatterns, ...excludePatterns])
					validateRunnerPattern(pattern);
			} catch {
				limitations.push('PLAYWRIGHT_TEST_SELECTION_UNSUPPORTED_OR_ESCAPES_REPOSITORY');
			}
			const workspaceRoot = posix.dirname(configurationPath);
			const includedPaths = runnablePaths.filter(
				(path) =>
					withinDirectory(path, workspaceRoot) &&
					includePatterns.some((pattern) => globMatches(path, pattern)) &&
					!excludePatterns.some((pattern) => globMatches(path, pattern))
			);
			const candidates = unique([
				...testPaths.filter((path) => withinDirectory(path, workspaceRoot)),
				...includedPaths
			]);
			if (includedPaths.length === 0) limitations.push('PLAYWRIGHT_INCLUDED_POPULATION_EMPTY');
			return makePopulation({
				candidates,
				configurationPaths: [configurationPath],
				excludePatterns,
				includePatterns,
				includedPaths,
				limitations,
				profile: configuredProfile(configurationPath, 'playwright', 'DETERMINISTIC'),
				provider: 'PLAYWRIGHT',
				provenance: [`${configurationPath}#/testDir`, `${configurationPath}#/testMatch`]
			});
		});
}

export function discoverTestPopulations(capture: SubjectCapture): TestPopulationDiscovery {
	const testPaths = capture.artifacts
		.filter(
			(artifact) => artifact.primaryClass === 'TEST_SOURCE' || artifact.roles.includes('TEST')
		)
		.map((artifact) => artifact.path)
		.sort(compareText);
	const runnablePaths = runnableSourcePaths(capture);
	const populations = [
		...vitestPopulations(capture, testPaths, runnablePaths),
		...playwrightPopulations(capture, testPaths, runnablePaths)
	].sort((left, right) =>
		compareText(
			`${left.provider}\0${left.profile}\0${left.configurationPaths.join('\0')}`,
			`${right.provider}\0${right.profile}\0${right.configurationPaths.join('\0')}`
		)
	);
	const diagnostics: SubjectDiagnostic[] = populations
		.filter((population) => population.status !== 'COMPLETE')
		.map((population) => ({
			code: 'TEST_POPULATION_PARTIAL',
			message: `Configured ${population.provider} ${population.profile} test population is partial: ${population.limitations.join(', ')}.`,
			path: population.configurationPaths[0] ?? null,
			phase: 'RESOLVE',
			severity: 'WARNING'
		}));
	return { diagnostics, populations };
}
