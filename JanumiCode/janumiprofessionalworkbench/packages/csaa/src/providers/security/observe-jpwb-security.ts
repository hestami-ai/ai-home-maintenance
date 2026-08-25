import ts from 'typescript';

import type { FrozenSubject } from '../../contracts/subject.js';
import { canonicalJson, compareText, sha256 } from '../../inventory/canonical.js';
import { verifyFrozenSubject } from '../../subject/freshness.js';
import { providerArtifactPath } from '../runtime/provider-evidence.js';

export const JPWB_NATIVE_SECURITY_PROVIDER_ID = 'jan-csaa-native-jpwb-security' as const;
export const JPWB_NATIVE_SECURITY_PROVIDER_VERSION = '1.0.0' as const;
export const JPWB_NATIVE_SECURITY_RESULT_SCHEMA_VERSION =
	'jan-csaa-native-jpwb-security-result/1.0.0' as const;

export const JPWB_NATIVE_SECURITY_LIMITS = Object.freeze({
	maxBytes: 64 * 1024 * 1024,
	maxFiles: 10_000,
	maxNodes: 2_000_000
} as const);

export type JpwbNativeSecurityRuleId =
	| 'JPWB-SEC-001_UNBOUND_HUMAN_PRINCIPAL_CONSTRUCTION'
	| 'JPWB-SEC-002_SHELL_ENABLED_PROCESS_EXECUTION'
	| 'JPWB-SEC-003_SECRET_BEARING_DIAGNOSTIC_ARGUMENT';

export interface JpwbSecuritySourceInput {
	readonly path: string;
	readonly source: string;
}

export interface JpwbNativeSecurityFinding {
	readonly evidenceSha256: string;
	readonly location: {
		readonly column: number;
		readonly line: number;
		readonly path: string;
	};
	readonly ruleId: JpwbNativeSecurityRuleId;
	readonly severity: 'HIGH' | 'MEDIUM';
	readonly supportBasis: string;
}

export interface JpwbNativeSecurityResult {
	readonly analysisAuthority: 'NONE';
	readonly coverage: {
		readonly completedPaths: readonly string[];
		readonly missingEligiblePaths: readonly string[];
		readonly state: 'COMPLETE' | 'PARTIAL' | 'NONE';
	};
	readonly diagnostics: readonly { readonly code: string; readonly message: string }[];
	readonly findings: readonly JpwbNativeSecurityFinding[];
	readonly freshness: 'CURRENT' | 'STALE' | 'UNKNOWN';
	readonly gateEffect: 'NONE';
	readonly health: 'HEALTHY' | 'MALFORMED' | 'STALE';
	readonly limitations: readonly string[];
	readonly observedAt: string;
	readonly provider: {
		readonly id: typeof JPWB_NATIVE_SECURITY_PROVIDER_ID;
		readonly parser: 'typescript';
		readonly parserVersion: string;
		readonly version: typeof JPWB_NATIVE_SECURITY_PROVIDER_VERSION;
	};
	readonly schemaVersion: typeof JPWB_NATIVE_SECURITY_RESULT_SCHEMA_VERSION;
	readonly subjectId: string;
}

const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?|svelte\.[jt]s)$/u;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const AUTHENTICATION_CALL =
	/^(?:assertAuthenticated|authenticate|requireAuthenticatedIdentity|requireIdentity)$/u;
const HUMAN_PROPERTY = /^(?:actorKind|kind|principalKind|type)$/u;
const LOG_CALL = /^(?:debug|error|info|log|trace|warn)$/u;
const SECRET_IDENTIFIER = /(authorization|cookie|credential|password|secret|token|apiKey)/iu;

function propertyName(node: ts.PropertyName): string | null {
	if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node))
		return node.text;
	return null;
}

function calledName(expression: ts.LeftHandSideExpression): string | null {
	if (ts.isIdentifier(expression)) return expression.text;
	if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
	return null;
}

function containsSecretBearingExpression(node: ts.Node): boolean {
	let matched = false;
	const visit = (child: ts.Node): void => {
		if (matched) return;
		if (ts.isIdentifier(child) && SECRET_IDENTIFIER.test(child.text)) {
			matched = true;
			return;
		}
		if (
			ts.isPropertyAccessExpression(child) &&
			ts.isPropertyAccessExpression(child.expression) &&
			ts.isIdentifier(child.expression.expression) &&
			child.expression.expression.text === 'process' &&
			child.expression.name.text === 'env'
		) {
			matched = true;
			return;
		}
		child.forEachChild(visit);
	};
	visit(node);
	return matched;
}

function location(sourceFile: ts.SourceFile, node: ts.Node, path: string) {
	const point = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile, false));
	return Object.freeze({ column: point.character + 1, line: point.line + 1, path });
}

function finding(
	sourceFile: ts.SourceFile,
	node: ts.Node,
	path: string,
	ruleId: JpwbNativeSecurityRuleId,
	severity: 'HIGH' | 'MEDIUM',
	supportBasis: string
): JpwbNativeSecurityFinding {
	const observedLocation = location(sourceFile, node, path);
	return Object.freeze({
		evidenceSha256: sha256(
			canonicalJson({
				end: node.end,
				path,
				ruleId,
				start: node.getStart(sourceFile, false)
			})
		),
		location: observedLocation,
		ruleId,
		severity,
		supportBasis
	});
}

function inspectSource(
	path: string,
	source: string,
	budget: { nodes: number }
): readonly JpwbNativeSecurityFinding[] {
	const scriptKind = /\.tsx$/u.test(path)
		? ts.ScriptKind.TSX
		: /\.jsx$/u.test(path)
			? ts.ScriptKind.JSX
			: /\.[cm]?js$/u.test(path)
				? ts.ScriptKind.JS
				: ts.ScriptKind.TS;
	const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, scriptKind);
	const parseDiagnostics = (
		sourceFile as ts.SourceFile & { readonly parseDiagnostics: readonly ts.Diagnostic[] }
	).parseDiagnostics;
	if (parseDiagnostics.length > 0)
		throw new TypeError('Native security source contains parser diagnostics.');
	const findings: JpwbNativeSecurityFinding[] = [];
	let authenticationBound = false;
	const authenticationVisit = (node: ts.Node): void => {
		budget.nodes += 1;
		if (budget.nodes > JPWB_NATIVE_SECURITY_LIMITS.maxNodes)
			throw new TypeError('Native security observation exceeded its AST node limit.');
		if (ts.isCallExpression(node)) {
			const name = calledName(node.expression);
			if (name !== null && AUTHENTICATION_CALL.test(name)) authenticationBound = true;
		}
		node.forEachChild(authenticationVisit);
	};
	authenticationVisit(sourceFile);
	const visit = (node: ts.Node): void => {
		budget.nodes += 1;
		if (budget.nodes > JPWB_NATIVE_SECURITY_LIMITS.maxNodes)
			throw new TypeError('Native security observation exceeded its AST node limit.');
		if (
			!authenticationBound &&
			path.includes('/server/') &&
			ts.isPropertyAssignment(node) &&
			propertyName(node.name) !== null &&
			HUMAN_PROPERTY.test(propertyName(node.name)!) &&
			(ts.isStringLiteral(node.initializer) ||
				ts.isNoSubstitutionTemplateLiteral(node.initializer)) &&
			node.initializer.text === 'HUMAN'
		)
			findings.push(
				finding(
					sourceFile,
					node,
					path,
					'JPWB-SEC-001_UNBOUND_HUMAN_PRINCIPAL_CONSTRUCTION',
					'HIGH',
					'A server-side HUMAN principal literal is constructed without an admitted authentication-binding call in the same source file.'
				)
			);
		if (ts.isCallExpression(node)) {
			const name = calledName(node.expression);
			const directExec = name === 'exec' || name === 'execSync';
			const shellEnabled =
				(name === 'spawn' || name === 'spawnSync') &&
				node.arguments.some(
					(argument) =>
						ts.isObjectLiteralExpression(argument) &&
						argument.properties.some(
							(property) =>
								ts.isPropertyAssignment(property) &&
								propertyName(property.name) === 'shell' &&
								property.initializer.kind === ts.SyntaxKind.TrueKeyword
						)
				);
			if (directExec || shellEnabled)
				findings.push(
					finding(
						sourceFile,
						node,
						path,
						'JPWB-SEC-002_SHELL_ENABLED_PROCESS_EXECUTION',
						'HIGH',
						'A direct shell execution surface or explicitly shell-enabled process call is present.'
					)
				);
			if (
				name !== null &&
				LOG_CALL.test(name) &&
				node.arguments.some((argument) => containsSecretBearingExpression(argument))
			)
				findings.push(
					finding(
						sourceFile,
						node,
						path,
						'JPWB-SEC-003_SECRET_BEARING_DIAGNOSTIC_ARGUMENT',
						'MEDIUM',
						'A diagnostic call receives an expression whose syntax names a secret-bearing value.'
					)
				);
		}
		node.forEachChild(visit);
	};
	visit(sourceFile);
	return findings;
}

function failure(
	options: { readonly observedAt: string; readonly subject: FrozenSubject },
	health: JpwbNativeSecurityResult['health'],
	freshness: JpwbNativeSecurityResult['freshness'],
	code: string
): JpwbNativeSecurityResult {
	return Object.freeze({
		analysisAuthority: 'NONE',
		coverage: Object.freeze({ completedPaths: [], missingEligiblePaths: [], state: 'NONE' }),
		diagnostics: Object.freeze([
			Object.freeze({
				code,
				message: 'Native security observation could not produce current complete evidence.'
			})
		]),
		findings: Object.freeze([]),
		freshness,
		gateEffect: 'NONE',
		health,
		limitations: Object.freeze([
			'SYNTAX_RULES_DO_NOT_ESTABLISH_EXPLOITABILITY_OR_ABSENCE_OF_VULNERABILITIES'
		]),
		observedAt: options.observedAt,
		provider: Object.freeze({
			id: JPWB_NATIVE_SECURITY_PROVIDER_ID,
			parser: 'typescript',
			parserVersion: ts.version,
			version: JPWB_NATIVE_SECURITY_PROVIDER_VERSION
		}),
		schemaVersion: JPWB_NATIVE_SECURITY_RESULT_SCHEMA_VERSION,
		subjectId: options.subject.descriptor.subjectId
	});
}

/** Performs bounded syntax inspection over supplied, subject-bound bytes and never executes them. */
export function observeJpwbNativeSecurity(options: {
	readonly observedAt: string;
	readonly repositoryRoot: string;
	readonly sources: readonly JpwbSecuritySourceInput[];
	readonly subject: FrozenSubject;
}): JpwbNativeSecurityResult {
	const observedAtMs = Date.parse(options.observedAt);
	const canonicalObservedAt = Number.isFinite(observedAtMs)
		? new Date(observedAtMs).toISOString()
		: null;
	if (
		!UTC_TIMESTAMP.test(options.observedAt) ||
		canonicalObservedAt === null ||
		(options.observedAt !== canonicalObservedAt &&
			options.observedAt !== canonicalObservedAt.replace('.000Z', 'Z'))
	)
		throw new TypeError('Native security observedAt must be UTC ISO-8601.');
	const before = verifyFrozenSubject(options.subject, { rootLocator: options.repositoryRoot });
	if (before.state !== 'CURRENT')
		return failure(
			options,
			'STALE',
			before.state === 'STALE' ? 'STALE' : 'UNKNOWN',
			'SUBJECT_NOT_CURRENT'
		);
	try {
		if (options.sources.length > JPWB_NATIVE_SECURITY_LIMITS.maxFiles)
			throw new TypeError('Native security source population exceeds its file limit.');
		const artifacts = new Map(
			options.subject.artifacts.map((artifact) => [artifact.path, artifact] as const)
		);
		const eligiblePaths = [...artifacts.keys()]
			.filter((path) => SOURCE_EXTENSION.test(path))
			.sort(compareText);
		const seen = new Set<string>();
		const completedPaths: string[] = [];
		const findings: JpwbNativeSecurityFinding[] = [];
		const budget = { nodes: 0 };
		let bytes = 0;
		for (const input of options.sources) {
			const path = providerArtifactPath(input.path, options.repositoryRoot);
			if (seen.has(path))
				throw new TypeError('Native security source population contains duplicates.');
			seen.add(path);
			if (!SOURCE_EXTENSION.test(path))
				throw new TypeError('Native security input has an unsupported source extension.');
			const artifact = artifacts.get(path);
			if (artifact === undefined)
				throw new TypeError('Native security input is outside the selected FrozenSubject.');
			if (typeof input.source !== 'string')
				throw new TypeError('Native security source must be a string.');
			const sourceBytes = Buffer.from(input.source, 'utf8');
			if (sourceBytes.toString('utf8') !== input.source)
				throw new TypeError('Native security source must contain only Unicode scalar values.');
			bytes += sourceBytes.byteLength;
			if (bytes > JPWB_NATIVE_SECURITY_LIMITS.maxBytes)
				throw new TypeError('Native security source population exceeds its byte limit.');
			if (sourceBytes.byteLength !== artifact.bytes || sha256(sourceBytes) !== artifact.sha256)
				throw new TypeError('Native security source bytes do not match the FrozenSubject.');
			completedPaths.push(path);
			findings.push(...inspectSource(path, input.source, budget));
		}
		const after = verifyFrozenSubject(options.subject, { rootLocator: options.repositoryRoot });
		if (after.state !== 'CURRENT')
			return failure(options, 'STALE', 'STALE', 'SUBJECT_CHANGED_DURING_OBSERVATION');
		completedPaths.sort(compareText);
		findings.sort((left, right) =>
			compareText(
				`${left.location.path}\0${String(left.location.line).padStart(10, '0')}\0${left.ruleId}`,
				`${right.location.path}\0${String(right.location.line).padStart(10, '0')}\0${right.ruleId}`
			)
		);
		const missingEligiblePaths = eligiblePaths.filter((path) => !seen.has(path));
		return Object.freeze({
			analysisAuthority: 'NONE',
			coverage: Object.freeze({
				completedPaths: Object.freeze(completedPaths),
				missingEligiblePaths: Object.freeze(missingEligiblePaths),
				state:
					completedPaths.length === 0
						? 'NONE'
						: missingEligiblePaths.length === 0
							? 'COMPLETE'
							: 'PARTIAL'
			}),
			diagnostics: Object.freeze([]),
			findings: Object.freeze(findings),
			freshness: 'CURRENT',
			gateEffect: 'NONE',
			health: 'HEALTHY',
			limitations: Object.freeze([
				'SYNTAX_RULES_DO_NOT_ESTABLISH_EXPLOITABILITY_OR_ABSENCE_OF_VULNERABILITIES',
				'UNBOUND_HUMAN_PRINCIPAL_RULE_USES_FILE_LOCAL_AUTHENTICATION_CALL_EVIDENCE',
				'PROCESS_AND_DIAGNOSTIC_CALL_NAMES_ARE_NOT_SYMBOL_RESOLVED',
				'NO_FINDING_IS_NOT_NO_VULNERABILITY'
			]),
			observedAt: options.observedAt,
			provider: Object.freeze({
				id: JPWB_NATIVE_SECURITY_PROVIDER_ID,
				parser: 'typescript',
				parserVersion: ts.version,
				version: JPWB_NATIVE_SECURITY_PROVIDER_VERSION
			}),
			schemaVersion: JPWB_NATIVE_SECURITY_RESULT_SCHEMA_VERSION,
			subjectId: options.subject.descriptor.subjectId
		});
	} catch {
		return failure(options, 'MALFORMED', 'CURRENT', 'SECURITY_INPUT_REFUSED');
	}
}
