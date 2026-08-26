import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';

import ts from 'typescript';

import type { FrozenSubject, FrozenSubjectFreshness } from '../../contracts/subject.js';
import { canonicalJson, compareText, sha256 } from '../../inventory/canonical.js';
import {
	isFrozenSubjectCapability,
	readFrozenSubjectArtifact
} from '../../subject/frozen-store.js';
import {
	evaluateHybridRuntimeRows,
	type HybridRuntimeEvaluationResult,
	type HybridStaticCapability,
	type HybridStaticPrerequisite,
	type HybridStaticPrerequisiteState
} from './evaluate-hybrid-runtime.js';
import {
	HYBRID_RUNTIME_FINDING_IDS,
	type DeterministicRuntimeTraceObservation,
	type HybridRuntimeFindingId
} from './import-runtime-trace.js';
import type { ProviderEvidenceResult } from './provider-evidence.js';

export const JPWB_HYBRID_STATIC_PROJECTION_SCHEMA_VERSION =
	'jan-csaa-jpwb-hybrid-static-prerequisite-projection/1.0.0' as const;
export const JPWB_HYBRID_STATIC_PROJECTOR_ID =
	'jan-csaa-jpwb-hybrid-static-prerequisite-projector' as const;
export const JPWB_HYBRID_STATIC_PROJECTOR_VERSION = '1.0.0' as const;
export const JPWB_HYBRID_STATIC_PROJECTION_OPERATION_VERSION =
	'jan-csaa-project-jpwb-hybrid-static-prerequisites/1.0.0' as const;

export const JPWB_HYBRID_STATIC_REQUIRED_PATHS = Object.freeze({
	9: 'apps/rph-demo/src/lib/server/workbench.ts',
	19: 'packages/rph-application/src/command-bus.ts',
	45: 'apps/rph-demo/src/lib/server/floor.ts',
	54: 'packages/rph-application/src/handlers/governance.ts',
	55: 'apps/rph-demo/src/lib/server/assurance/agy-cli.ts'
} satisfies Readonly<Record<HybridRuntimeFindingId, string>>);

export const JPWB_HYBRID_STATIC_CAPABILITIES = Object.freeze({
	9: 'TAINT',
	19: 'DFG',
	45: 'DFG',
	54: 'TAINT',
	55: 'TAINT'
} satisfies Readonly<Record<HybridRuntimeFindingId, HybridStaticCapability>>);

export const JPWB_HYBRID_STATIC_PROJECTION_LIMITATIONS = Object.freeze([
	'RULE_SPECIFIC_BOUNDED_SOURCE_LAYOUTS_ONLY',
	'NO_GENERAL_PURPOSE_DFG_CLAIM',
	'NO_GENERAL_PURPOSE_TAINT_CLAIM',
	'NO_RUNTIME_EXECUTION',
	'NO_ABSENCE_CLAIM_OUTSIDE_RECOGNIZED_LAYOUTS',
	'NO_PROVIDER_QUALIFICATION_CLAIM',
	'ANALYSIS_AUTHORITY_NONE',
	'GATE_EFFECT_NONE'
] as const);

export interface JpwbHybridStaticProjectionBudgets {
	readonly maxAstDepthPerArtifact: number;
	readonly maxAstNodesPerArtifact: number;
	readonly maxSourceBytesPerArtifact: number;
}

export const JPWB_HYBRID_STATIC_PROJECTION_DEFAULT_BUDGETS = Object.freeze({
	maxAstDepthPerArtifact: 512,
	maxAstNodesPerArtifact: 100_000,
	maxSourceBytesPerArtifact: 2 * 1024 * 1024
} satisfies JpwbHybridStaticProjectionBudgets);

export type JpwbHybridStaticProjectionReasonCode =
	| 'ARTIFACT_BINDING_MISMATCH'
	| 'CRITICAL_SYMBOL_ALIASED'
	| 'FRESHNESS_UNAVAILABLE'
	| 'LAYOUT_UNRECOGNIZED'
	| 'REQUIRED_ARTIFACT_AMBIGUOUS'
	| 'REQUIRED_ARTIFACT_MISSING'
	| 'RISK_PREREQUISITE_ABSENT'
	| 'RISK_PREREQUISITE_PRESENT'
	| 'SAFE_AND_RISK_LAYOUT_CONFLICT'
	| 'SOURCE_AST_BUDGET_EXHAUSTED'
	| 'SOURCE_BYTE_BUDGET_EXHAUSTED'
	| 'SOURCE_PARSE_MALFORMED'
	| 'SOURCE_UTF8_MALFORMED';

export interface JpwbHybridStaticSourceWitness {
	readonly end: number;
	readonly kind: string;
	readonly label: string;
	readonly path: string;
	readonly sha256: string;
	readonly start: number;
}

export interface JpwbHybridStaticProjectionRow {
	readonly capability: HybridStaticCapability;
	readonly findingId: HybridRuntimeFindingId;
	readonly prerequisite: HybridStaticPrerequisite;
	readonly reasonCode: JpwbHybridStaticProjectionReasonCode;
	readonly requiredPath: string;
	readonly semantics:
		| 'AUTHENTICATED_SESSION_VS_FABRICATED_HUMAN_COMMAND_IDENTITY'
		| 'THREE_AXIS_IDEMPOTENCY_BINDING_VS_PRIOR_RESULT_REUSE'
		| 'PER_OUTPUT_ASSESSMENT_VS_SINGLE_WHOLE_GRAPH_REASONING_REVIEW'
		| 'DISTINCT_PROPOSER_APPROVER_VS_HUMAN_ONLY_AUTHORITY'
		| 'COMPLETE_EXTERNAL_TOOL_ATTEMPT_RECORD_VS_DIRECT_UNRECORDED_EXECUTION';
	readonly sourceBinding: {
		readonly bytes: number;
		readonly sha256: string;
	} | null;
	readonly witnesses: readonly JpwbHybridStaticSourceWitness[];
}

export interface JpwbHybridStaticPrerequisiteProjection {
	readonly analysisAuthority: 'NONE';
	readonly budgets: JpwbHybridStaticProjectionBudgets;
	readonly freshness: {
		readonly changedPaths: readonly string[];
		readonly state: FrozenSubjectFreshness['state'];
	};
	readonly gateEffect: 'NONE';
	readonly limitations: typeof JPWB_HYBRID_STATIC_PROJECTION_LIMITATIONS;
	readonly observedAt: string;
	readonly operationVersion: typeof JPWB_HYBRID_STATIC_PROJECTION_OPERATION_VERSION;
	readonly population: {
		readonly conflicting: number;
		readonly conclusive: number;
		readonly expected: 5;
		readonly produced: 5;
		readonly reconciles: true;
		readonly unsupported: number;
	};
	readonly prerequisites: readonly HybridStaticPrerequisite[];
	readonly projector: {
		readonly id: typeof JPWB_HYBRID_STATIC_PROJECTOR_ID;
		readonly version: typeof JPWB_HYBRID_STATIC_PROJECTOR_VERSION;
	};
	readonly rows: readonly JpwbHybridStaticProjectionRow[];
	readonly schemaVersion: typeof JPWB_HYBRID_STATIC_PROJECTION_SCHEMA_VERSION;
	readonly subject: {
		readonly fileManifestDigest: string;
		readonly subjectId: string;
	};
}

export interface ProjectJpwbHybridStaticPrerequisitesRequest {
	readonly budgets?: JpwbHybridStaticProjectionBudgets;
	readonly freshness: FrozenSubjectFreshness;
	readonly observedAt: string;
	readonly subject: FrozenSubject;
}

interface ParsedRegion {
	readonly artifact: FrozenSubject['artifacts'][number];
	readonly nodes: readonly ts.Node[];
	readonly path: string;
	readonly sourceFile: ts.SourceFile;
	readonly text: string;
}

interface DetectorResult {
	readonly reasonCode: JpwbHybridStaticProjectionReasonCode;
	readonly state: HybridStaticPrerequisiteState;
	readonly witnesses: readonly JpwbHybridStaticSourceWitness[];
}

interface RegionAdmission {
	readonly binding: JpwbHybridStaticProjectionRow['sourceBinding'];
	readonly reasonCode?: JpwbHybridStaticProjectionReasonCode;
	readonly region?: ParsedRegion;
}

const SHA256 = /^[a-f0-9]{64}$/u;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });

function dataProperty(record: Record<string, unknown>, key: string, label: string): unknown {
	const descriptor = Reflect.getOwnPropertyDescriptor(record, key);
	if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
		throw new TypeError(`${label}.${key} must be an enumerable data property.`);
	return descriptor.value;
}

function plainRecord(value: unknown, label: string): Record<string, unknown> {
	if (isProxy(value) || value === null || typeof value !== 'object' || Array.isArray(value))
		throw new TypeError(`${label} must be a non-Proxy plain record.`);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError(`${label} must be a plain record.`);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (
			typeof key !== 'string' ||
			descriptor === undefined ||
			!descriptor.enumerable ||
			!('value' in descriptor)
		)
			throw new TypeError(`${label} rejects accessors, symbols, and non-enumerable properties.`);
	}
	return value as Record<string, unknown>;
}

function exactKeys(
	record: Record<string, unknown>,
	expected: readonly string[],
	label: string
): void {
	const actual = Object.keys(record).sort(compareText);
	const keys = [...expected].sort(compareText);
	if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index]))
		throw new TypeError(`${label} has an unsupported property set.`);
}

function boundedInteger(value: unknown, label: string, minimum: number, maximum: number): number {
	if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum)
		throw new TypeError(`${label} must be an integer from ${minimum} through ${maximum}.`);
	return value as number;
}

function admittedBudgets(value: unknown): JpwbHybridStaticProjectionBudgets {
	if (value === undefined) return JPWB_HYBRID_STATIC_PROJECTION_DEFAULT_BUDGETS;
	const record = plainRecord(value, 'request.budgets');
	exactKeys(
		record,
		['maxAstDepthPerArtifact', 'maxAstNodesPerArtifact', 'maxSourceBytesPerArtifact'],
		'request.budgets'
	);
	return Object.freeze({
		maxAstDepthPerArtifact: boundedInteger(
			dataProperty(record, 'maxAstDepthPerArtifact', 'request.budgets'),
			'request.budgets.maxAstDepthPerArtifact',
			8,
			4_096
		),
		maxAstNodesPerArtifact: boundedInteger(
			dataProperty(record, 'maxAstNodesPerArtifact', 'request.budgets'),
			'request.budgets.maxAstNodesPerArtifact',
			32,
			1_000_000
		),
		maxSourceBytesPerArtifact: boundedInteger(
			dataProperty(record, 'maxSourceBytesPerArtifact', 'request.budgets'),
			'request.budgets.maxSourceBytesPerArtifact',
			64,
			16 * 1024 * 1024
		)
	});
}

function admittedFreshness(value: unknown): FrozenSubjectFreshness {
	const record = plainRecord(value, 'request.freshness');
	exactKeys(record, ['changedPaths', 'diagnostics', 'state'], 'request.freshness');
	const state = dataProperty(record, 'state', 'request.freshness');
	if (state !== 'CURRENT' && state !== 'STALE' && state !== 'UNAVAILABLE')
		throw new TypeError('request.freshness.state is unsupported.');
	const changedPathsValue = dataProperty(record, 'changedPaths', 'request.freshness');
	if (!Array.isArray(changedPathsValue) || changedPathsValue.length > 100_000)
		throw new TypeError('request.freshness.changedPaths must be bounded.');
	const changedPaths = changedPathsValue.map((path, index) => {
		if (typeof path !== 'string' || path.length === 0 || path.length > 32_768)
			throw new TypeError(`request.freshness.changedPaths[${index}] is invalid.`);
		return path;
	});
	if (
		new Set(changedPaths).size !== changedPaths.length ||
		changedPaths.some(
			(path, index) => index > 0 && compareText(changedPaths[index - 1]!, path) >= 0
		)
	)
		throw new TypeError('request.freshness.changedPaths must be unique and canonically ordered.');
	const diagnostics = dataProperty(record, 'diagnostics', 'request.freshness');
	if (!Array.isArray(diagnostics) || diagnostics.length > 100_000)
		throw new TypeError('request.freshness.diagnostics must be bounded.');
	if (state === 'CURRENT' && changedPaths.length !== 0)
		throw new TypeError('CURRENT freshness cannot identify changed paths.');
	return Object.freeze({
		changedPaths: Object.freeze(changedPaths),
		diagnostics: Object.freeze([...diagnostics]) as FrozenSubjectFreshness['diagnostics'],
		state
	}) as FrozenSubjectFreshness;
}

function canonicalTimestamp(value: unknown): string {
	if (typeof value !== 'string' || !UTC_TIMESTAMP.test(value) || Number.isNaN(Date.parse(value)))
		throw new TypeError('request.observedAt must be a canonical millisecond UTC timestamp.');
	return value;
}

function admittedRequest(value: unknown): {
	readonly budgets: JpwbHybridStaticProjectionBudgets;
	readonly freshness: FrozenSubjectFreshness;
	readonly observedAt: string;
	readonly subject: FrozenSubject;
} {
	const record = plainRecord(value, 'request');
	const keys = Object.hasOwn(record, 'budgets')
		? ['budgets', 'freshness', 'observedAt', 'subject']
		: ['freshness', 'observedAt', 'subject'];
	exactKeys(record, keys, 'request');
	const subject = dataProperty(record, 'subject', 'request');
	if (isProxy(subject) || !isFrozenSubjectCapability(subject))
		throw new TypeError(
			'request.subject must be the exact nonserialized FrozenSubject byte capability.'
		);
	if (
		typeof subject.descriptor.subjectId !== 'string' ||
		subject.descriptor.subjectId.length === 0 ||
		typeof subject.descriptor.fileManifestDigest !== 'string' ||
		!SHA256.test(subject.descriptor.fileManifestDigest)
	)
		throw new TypeError('request.subject identity is invalid.');
	return Object.freeze({
		budgets: admittedBudgets(
			Object.hasOwn(record, 'budgets') ? dataProperty(record, 'budgets', 'request') : undefined
		),
		freshness: admittedFreshness(dataProperty(record, 'freshness', 'request')),
		observedAt: canonicalTimestamp(dataProperty(record, 'observedAt', 'request')),
		subject
	});
}

function collectNodes(
	sourceFile: ts.SourceFile,
	budgets: JpwbHybridStaticProjectionBudgets
): readonly ts.Node[] | null {
	const nodes: ts.Node[] = [];
	const stack: { readonly depth: number; readonly node: ts.Node }[] = [
		{ depth: 0, node: sourceFile }
	];
	while (stack.length > 0) {
		const entry = stack.pop()!;
		if (
			entry.depth > budgets.maxAstDepthPerArtifact ||
			nodes.length >= budgets.maxAstNodesPerArtifact
		)
			return null;
		nodes.push(entry.node);
		const children: ts.Node[] = [];
		entry.node.forEachChild((child) => {
			children.push(child);
		});
		for (let index = children.length - 1; index >= 0; index -= 1)
			stack.push({ depth: entry.depth + 1, node: children[index]! });
	}
	return Object.freeze(nodes);
}

function admitRegion(
	subject: FrozenSubject,
	path: string,
	budgets: JpwbHybridStaticProjectionBudgets
): RegionAdmission {
	const artifacts = subject.artifacts.filter((artifact) => artifact.path === path);
	if (artifacts.length === 0)
		return Object.freeze({ binding: null, reasonCode: 'REQUIRED_ARTIFACT_MISSING' });
	if (artifacts.length !== 1)
		return Object.freeze({ binding: null, reasonCode: 'REQUIRED_ARTIFACT_AMBIGUOUS' });
	const artifact = artifacts[0]!;
	const binding = Object.freeze({ bytes: artifact.bytes, sha256: artifact.sha256 });
	if (artifact.disposition !== 'ANALYZED' || artifact.bytes < 0 || !SHA256.test(artifact.sha256))
		return Object.freeze({ binding, reasonCode: 'ARTIFACT_BINDING_MISMATCH' });
	if (artifact.bytes > budgets.maxSourceBytesPerArtifact)
		return Object.freeze({ binding, reasonCode: 'SOURCE_BYTE_BUDGET_EXHAUSTED' });
	const bytes = readFrozenSubjectArtifact(subject, path);
	if (
		bytes === undefined ||
		bytes.byteLength !== artifact.bytes ||
		createHash('sha256').update(bytes).digest('hex') !== artifact.sha256
	)
		return Object.freeze({ binding, reasonCode: 'ARTIFACT_BINDING_MISMATCH' });
	let text: string;
	try {
		text = TEXT_DECODER.decode(bytes);
	} catch {
		return Object.freeze({ binding, reasonCode: 'SOURCE_UTF8_MALFORMED' });
	}
	const sourceFile = ts.createSourceFile(
		path,
		text,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	);
	const parseDiagnostics = (
		sourceFile as ts.SourceFile & { readonly parseDiagnostics?: readonly ts.Diagnostic[] }
	).parseDiagnostics;
	if ((parseDiagnostics?.length ?? 0) > 0)
		return Object.freeze({ binding, reasonCode: 'SOURCE_PARSE_MALFORMED' });
	const nodes = collectNodes(sourceFile, budgets);
	if (nodes === null) return Object.freeze({ binding, reasonCode: 'SOURCE_AST_BUDGET_EXHAUSTED' });
	return Object.freeze({
		binding,
		region: Object.freeze({ artifact, nodes, path, sourceFile, text })
	});
}

function nameText(name: ts.PropertyName | ts.BindingName | undefined): string | null {
	if (name === undefined) return null;
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
		return name.text;
	return null;
}

function expressionPath(expression: ts.Expression): string | null {
	if (ts.isIdentifier(expression)) return expression.text;
	if (expression.kind === ts.SyntaxKind.ThisKeyword) return 'this';
	if (ts.isPropertyAccessExpression(expression)) {
		const left = expressionPath(expression.expression);
		return left === null ? null : `${left}.${expression.name.text}`;
	}
	if (ts.isParenthesizedExpression(expression)) return expressionPath(expression.expression);
	if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression))
		return expressionPath(expression.expression);
	return null;
}

function callName(call: ts.CallExpression): string | null {
	const path = expressionPath(call.expression);
	return path?.split('.').at(-1) ?? null;
}

function callsWithin(
	region: ParsedRegion,
	root: ts.Node,
	name: string
): readonly ts.CallExpression[] {
	return region.nodes.filter(
		(node): node is ts.CallExpression =>
			ts.isCallExpression(node) &&
			node.pos >= root.pos &&
			node.end <= root.end &&
			callName(node) === name
	);
}

type NamedFunction =
	ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression;

function namedFunctions(region: ParsedRegion, name: string): readonly NamedFunction[] {
	const found: NamedFunction[] = [];
	for (const node of region.nodes) {
		if (
			(ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
			nameText(node.name) === name
		)
			found.push(node);
		if (
			ts.isVariableDeclaration(node) &&
			nameText(node.name) === name &&
			node.initializer !== undefined &&
			(ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
		)
			found.push(node.initializer);
	}
	return found;
}

function criticalAlias(region: ParsedRegion, symbols: ReadonlySet<string>): ts.Node | null {
	for (const node of region.nodes) {
		if (
			ts.isImportSpecifier(node) &&
			node.propertyName !== undefined &&
			symbols.has(node.propertyName.text) &&
			node.name.text !== node.propertyName.text
		)
			return node;
		if (
			ts.isVariableDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			node.initializer !== undefined &&
			ts.isIdentifier(node.initializer) &&
			symbols.has(node.initializer.text) &&
			node.name.text !== node.initializer.text
		)
			return node;
		if (
			ts.isBindingElement(node) &&
			node.propertyName !== undefined &&
			ts.isIdentifier(node.propertyName) &&
			symbols.has(node.propertyName.text) &&
			nameText(node.name) !== node.propertyName.text
		)
			return node;
	}
	return null;
}

function sourceWitness(
	region: ParsedRegion,
	node: ts.Node,
	label: string
): JpwbHybridStaticSourceWitness {
	const start = node.getStart(region.sourceFile);
	const end = node.getEnd();
	return Object.freeze({
		end,
		kind: ts.SyntaxKind[node.kind] ?? String(node.kind),
		label,
		path: region.path,
		sha256: sha256(region.text.slice(start, end)),
		start
	});
}

function result(
	state: HybridStaticPrerequisiteState,
	reasonCode: JpwbHybridStaticProjectionReasonCode,
	witnesses: readonly JpwbHybridStaticSourceWitness[] = []
): DetectorResult {
	return Object.freeze({
		reasonCode,
		state,
		witnesses: Object.freeze(
			[...witnesses].sort((left, right) =>
				left.start === right.start ? compareText(left.label, right.label) : left.start - right.start
			)
		)
	});
}

function propertyAssignmentsWithin(
	region: ParsedRegion,
	root: ts.Node,
	name: string
): readonly ts.PropertyAssignment[] {
	return region.nodes.filter(
		(node): node is ts.PropertyAssignment =>
			ts.isPropertyAssignment(node) &&
			node.pos >= root.pos &&
			node.end <= root.end &&
			nameText(node.name) === name
	);
}

function literalText(expression: ts.Expression): string | null {
	return ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)
		? expression.text
		: null;
}

function detectFinding9(region: ParsedRegion): DetectorResult {
	const alias = criticalAlias(
		region,
		new Set(['SESSION_CREDENTIAL', 'createEngine', 'getEngine', 'standaloneAuthenticator'])
	);
	if (alias !== null)
		return result('UNSUPPORTED', 'CRITICAL_SYMBOL_ALIASED', [
			sourceWitness(region, alias, 'critical-symbol-alias')
		]);
	const newEngines = namedFunctions(region, 'newEngine');
	const uiCommands = namedFunctions(region, 'uiCommand');
	const uiSessions = namedFunctions(region, 'uiSession');
	if (newEngines.length > 1 || uiCommands.length > 1 || uiSessions.length > 1)
		return result('CONFLICTING', 'REQUIRED_ARTIFACT_AMBIGUOUS');
	if (newEngines.length !== 1 || uiCommands.length !== 1)
		return result('UNSUPPORTED', 'LAYOUT_UNRECOGNIZED');
	const issuedBy = propertyAssignmentsWithin(region, uiCommands[0]!, 'issuedBy').filter(
		(property) => {
			if (!ts.isObjectLiteralExpression(property.initializer)) return false;
			const actorType = property.initializer.properties.find(
				(member): member is ts.PropertyAssignment =>
					ts.isPropertyAssignment(member) && nameText(member.name) === 'actorType'
			);
			const actorId = property.initializer.properties.find(
				(member): member is ts.PropertyAssignment =>
					ts.isPropertyAssignment(member) && nameText(member.name) === 'actorId'
			);
			return (
				actorType !== undefined &&
				literalText(actorType.initializer) === 'HUMAN' &&
				actorId !== undefined &&
				literalText(actorId.initializer) !== null
			);
		}
	);
	const authenticators = propertyAssignmentsWithin(region, newEngines[0]!, 'authenticate').filter(
		(property) =>
			ts.isCallExpression(property.initializer) &&
			callName(property.initializer) === 'standaloneAuthenticator'
	);
	const sessionCalls =
		uiSessions.length === 1
			? region.nodes.filter(
					(node): node is ts.CallExpression =>
						ts.isCallExpression(node) &&
						node.pos >= uiSessions[0]!.pos &&
						node.end <= uiSessions[0]!.end &&
						ts.isPropertyAccessExpression(node.expression) &&
						node.expression.name.text === 'as' &&
						ts.isCallExpression(node.expression.expression) &&
						node.expression.expression.arguments.length === 0 &&
						expressionPath(node.expression.expression.expression) === 'getEngine' &&
						node.arguments.length === 1 &&
						expressionPath(node.arguments[0]!) === 'SESSION_CREDENTIAL'
				)
			: [];
	const risky = issuedBy.length === 1;
	const authenticatedSession = authenticators.length === 1 && sessionCalls.length === 1;
	const safe = issuedBy.length === 0 && authenticatedSession;
	if (
		issuedBy.length > 1 ||
		authenticators.length > 1 ||
		sessionCalls.length > 1 ||
		(risky && authenticatedSession)
	)
		return result('CONFLICTING', 'SAFE_AND_RISK_LAYOUT_CONFLICT');
	if (risky)
		return result('SATISFIED', 'RISK_PREREQUISITE_PRESENT', [
			sourceWitness(region, issuedBy[0]!, 'fabricated-human-command-identity')
		]);
	if (safe)
		return result('NOT_SATISFIED', 'RISK_PREREQUISITE_ABSENT', [
			sourceWitness(region, authenticators[0]!, 'standalone-authenticator'),
			sourceWitness(region, sessionCalls[0]!, 'credential-bound-session')
		]);
	return result('UNSUPPORTED', 'LAYOUT_UNRECOGNIZED');
}

function comparison(
	node: ts.Node,
	left: string,
	right: string,
	operators: ReadonlySet<ts.SyntaxKind>
): boolean {
	if (!ts.isBinaryExpression(node) || !operators.has(node.operatorToken.kind)) return false;
	const leftPath = expressionPath(node.left);
	const rightPath = expressionPath(node.right);
	return (leftPath === left && rightPath === right) || (leftPath === right && rightPath === left);
}

function detectFinding19(region: ParsedRegion): DetectorResult {
	const dispatches = namedFunctions(region, 'dispatchStamped');
	const answers = namedFunctions(region, 'answerFromReceipt');
	if (dispatches.length > 1 || answers.length > 1)
		return result('CONFLICTING', 'REQUIRED_ARTIFACT_AMBIGUOUS');
	if (dispatches.length !== 1 || answers.length !== 1)
		return result('UNSUPPORTED', 'LAYOUT_UNRECOGNIZED');
	const aliases = region.nodes.filter(
		(node): node is ts.VariableDeclaration =>
			ts.isVariableDeclaration(node) &&
			node.pos >= answers[0]!.pos &&
			node.end <= answers[0]!.end &&
			ts.isIdentifier(node.name) &&
			node.name.text !== 'prior' &&
			node.initializer !== undefined &&
			expressionPath(node.initializer) === 'prior'
	);
	if (aliases.length > 0)
		return result('UNSUPPORTED', 'CRITICAL_SYMBOL_ALIASED', [
			sourceWitness(region, aliases[0]!, 'prior-receipt-alias')
		]);
	const receiptCalls = callsWithin(region, dispatches[0]!, 'getReceipt').filter(
		(call) =>
			expressionPath(call.expression) === 'this.store.getReceipt' &&
			call.arguments.length === 1 &&
			expressionPath(call.arguments[0]!) === 'command.idempotencyKey'
	);
	const answerCalls = callsWithin(region, dispatches[0]!, 'answerFromReceipt').filter(
		(call) =>
			expressionPath(call.expression) === 'this.answerFromReceipt' &&
			call.arguments.length >= 2 &&
			expressionPath(call.arguments[0]!) === 'prior' &&
			expressionPath(call.arguments[1]!) === 'command'
	);
	if (receiptCalls.length !== 1 || answerCalls.length !== 1)
		return result('UNSUPPORTED', 'LAYOUT_UNRECOGNIZED');
	const unequal = new Set<ts.SyntaxKind>([
		ts.SyntaxKind.ExclamationEqualsEqualsToken,
		ts.SyntaxKind.ExclamationEqualsToken
	]);
	const checks = [
		region.nodes.find(
			(node) =>
				node.pos >= answers[0]!.pos &&
				node.end <= answers[0]!.end &&
				comparison(node, 'prior.commandType', 'command.commandType', unequal)
		),
		region.nodes.find(
			(node) =>
				node.pos >= answers[0]!.pos &&
				node.end <= answers[0]!.end &&
				comparison(node, 'prior.targetAggregateId', 'command.targetAggregateId', unequal)
		),
		region.nodes.find(
			(node) =>
				node.pos >= answers[0]!.pos &&
				node.end <= answers[0]!.end &&
				comparison(node, 'prior.payloadHash', 'payloadHash', unequal)
		)
	];
	const count = checks.filter((node) => node !== undefined).length;
	if (count === 3)
		return result('NOT_SATISFIED', 'RISK_PREREQUISITE_ABSENT', [
			sourceWitness(region, receiptCalls[0]!, 'receipt-read'),
			...checks.map((node, index) =>
				sourceWitness(region, node!, `receipt-binding-axis-${index + 1}`)
			)
		]);
	if (count === 0)
		return result('SATISFIED', 'RISK_PREREQUISITE_PRESENT', [
			sourceWitness(region, receiptCalls[0]!, 'receipt-read'),
			sourceWitness(region, answerCalls[0]!, 'prior-result-return-without-binding-checks')
		]);
	return result(
		'UNSUPPORTED',
		'LAYOUT_UNRECOGNIZED',
		checks
			.filter((node): node is ts.Node => node !== undefined)
			.map((node, index) => sourceWitness(region, node, `partial-receipt-axis-${index + 1}`))
	);
}

function nearestLoop(node: ts.Node, root: ts.Node): ts.IterationStatement | null {
	let cursor = node.parent;
	while (cursor !== undefined && cursor !== root) {
		if (ts.isIterationStatement(cursor, false)) return cursor;
		cursor = cursor.parent;
	}
	return null;
}

function reasoningContent(region: ParsedRegion, root: ts.Node): readonly ts.PropertyAssignment[] {
	const reasoning = propertyAssignmentsWithin(region, root, 'reasoningReview');
	const content: ts.PropertyAssignment[] = [];
	for (const property of reasoning) {
		if (!ts.isObjectLiteralExpression(property.initializer)) continue;
		for (const member of property.initializer.properties)
			if (ts.isPropertyAssignment(member) && nameText(member.name) === 'content')
				content.push(member);
	}
	return content;
}

function detectFinding45(region: ParsedRegion): DetectorResult {
	const alias = criticalAlias(
		region,
		new Set(['recordAssuranceRecordingPlan', 'runFloorAndPlanRecording'])
	);
	if (alias !== null)
		return result('UNSUPPORTED', 'CRITICAL_SYMBOL_ALIASED', [
			sourceWitness(region, alias, 'critical-symbol-alias')
		]);
	const floors = namedFunctions(region, 'runPwaFloor');
	if (floors.length > 1) return result('CONFLICTING', 'REQUIRED_ARTIFACT_AMBIGUOUS');
	if (floors.length !== 1) return result('UNSUPPORTED', 'LAYOUT_UNRECOGNIZED');
	const floor = floors[0]!;
	const runCalls = callsWithin(region, floor, 'runFloorAndPlanRecording');
	const recordCalls = callsWithin(region, floor, 'recordAssuranceRecordingPlan');
	const contents = reasoningContent(region, floor);
	if (runCalls.length !== 1 || recordCalls.length !== 1 || contents.length !== 1)
		return result(
			runCalls.length > 1 || recordCalls.length > 1 || contents.length > 1
				? 'CONFLICTING'
				: 'UNSUPPORTED',
			runCalls.length > 1 || recordCalls.length > 1 || contents.length > 1
				? 'REQUIRED_ARTIFACT_AMBIGUOUS'
				: 'LAYOUT_UNRECOGNIZED'
		);
	const content = contents[0]!;
	if (
		!ts.isCallExpression(content.initializer) ||
		expressionPath(content.initializer.expression) !== 'JSON.stringify'
	)
		return result('UNSUPPORTED', 'LAYOUT_UNRECOGNIZED');
	const argument = content.initializer.arguments[0];
	if (argument === undefined) return result('UNSUPPORTED', 'LAYOUT_UNRECOGNIZED');
	const wholeGraph =
		ts.isObjectLiteralExpression(argument) &&
		argument.properties.some(
			(member) =>
				ts.isSpreadAssignment(member) && expressionPath(member.expression) === 'graphExport'
		);
	const contentLoop = nearestLoop(content, floor);
	const runLoop = nearestLoop(runCalls[0]!, floor);
	const recordLoop = nearestLoop(recordCalls[0]!, floor);
	let perOutput = false;
	if (
		contentLoop !== null &&
		contentLoop === runLoop &&
		contentLoop === recordLoop &&
		ts.isForOfStatement(contentLoop) &&
		ts.isVariableDeclarationList(contentLoop.initializer) &&
		contentLoop.initializer.declarations.length === 1 &&
		ts.isIdentifier(contentLoop.initializer.declarations[0]!.name) &&
		expressionPath(contentLoop.expression) === 'graphExport.outputs'
	) {
		const outputName = contentLoop.initializer.declarations[0]!.name.text;
		perOutput = expressionPath(argument) === outputName;
	}
	const risky = wholeGraph && contentLoop === null && runLoop === null && recordLoop === null;
	if (risky && perOutput) return result('CONFLICTING', 'SAFE_AND_RISK_LAYOUT_CONFLICT');
	if (risky)
		return result('SATISFIED', 'RISK_PREREQUISITE_PRESENT', [
			sourceWitness(region, content, 'whole-graph-reasoning-review-content'),
			sourceWitness(region, recordCalls[0]!, 'single-turn-level-recording-plan')
		]);
	if (perOutput)
		return result('NOT_SATISFIED', 'RISK_PREREQUISITE_ABSENT', [
			sourceWitness(region, contentLoop!, 'per-output-assessment-loop'),
			sourceWitness(region, content, 'per-output-reasoning-review-content')
		]);
	return result('UNSUPPORTED', 'LAYOUT_UNRECOGNIZED');
}

function containsRejectCall(region: ParsedRegion, root: ts.Node): boolean {
	return callsWithin(region, root, 'reject').length > 0;
}

function detectFinding54(region: ParsedRegion): DetectorResult {
	const alias = criticalAlias(region, new Set(['makeDecisionEffective', 'proposeDecision']));
	if (alias !== null)
		return result('UNSUPPORTED', 'CRITICAL_SYMBOL_ALIASED', [
			sourceWitness(region, alias, 'critical-symbol-alias')
		]);
	const proposals = namedFunctions(region, 'proposeDecision');
	const approvals = namedFunctions(region, 'makeDecisionEffective');
	if (proposals.length > 1 || approvals.length > 1)
		return result('CONFLICTING', 'REQUIRED_ARTIFACT_AMBIGUOUS');
	if (proposals.length !== 1 || approvals.length !== 1)
		return result('UNSUPPORTED', 'LAYOUT_UNRECOGNIZED');
	const states = region.nodes.filter(
		(node): node is ts.VariableDeclaration & { readonly initializer: ts.ObjectLiteralExpression } =>
			ts.isVariableDeclaration(node) &&
			node.pos >= proposals[0]!.pos &&
			node.end <= proposals[0]!.end &&
			nameText(node.name) === 'state' &&
			node.initializer !== undefined &&
			ts.isObjectLiteralExpression(node.initializer)
	);
	if (states.length !== 1)
		return result(
			states.length > 1 ? 'CONFLICTING' : 'UNSUPPORTED',
			states.length > 1 ? 'REQUIRED_ARTIFACT_AMBIGUOUS' : 'LAYOUT_UNRECOGNIZED'
		);
	const authority = states[0]!.initializer.properties.filter(
		(property): property is ts.PropertyAssignment => {
			if (!ts.isPropertyAssignment(property) || nameText(property.name) !== 'authority')
				return false;
			const path = expressionPath(property.initializer);
			return path === 'p.authority' || path === 'command.issuedBy';
		}
	);
	if (authority.length !== 1)
		return result(
			authority.length > 1 ? 'CONFLICTING' : 'UNSUPPORTED',
			authority.length > 1 ? 'REQUIRED_ARTIFACT_AMBIGUOUS' : 'LAYOUT_UNRECOGNIZED'
		);
	const equal = new Set<ts.SyntaxKind>([
		ts.SyntaxKind.EqualsEqualsEqualsToken,
		ts.SyntaxKind.EqualsEqualsToken
	]);
	const humanChecks = region.nodes.filter(
		(node) =>
			node.pos >= approvals[0]!.pos &&
			node.end <= approvals[0]!.end &&
			ts.isBinaryExpression(node) &&
			equal.has(node.operatorToken.kind) &&
			((expressionPath(node.left) === 'authority.actorType' &&
				literalText(node.right) === 'HUMAN') ||
				(expressionPath(node.right) === 'authority.actorType' &&
					literalText(node.left) === 'HUMAN'))
	);
	const separation = region.nodes.filter((node): node is ts.IfStatement => {
		if (
			!ts.isIfStatement(node) ||
			node.pos < approvals[0]!.pos ||
			node.end > approvals[0]!.end ||
			!containsRejectCall(region, node.thenStatement)
		)
			return false;
		return region.nodes.some(
			(candidate) =>
				candidate.pos >= node.expression.pos &&
				candidate.end <= node.expression.end &&
				comparison(candidate, 'authority.actorId', 'command.issuedBy.actorId', equal)
		);
	});
	if (humanChecks.length !== 1 || separation.length > 1)
		return result(
			humanChecks.length > 1 || separation.length > 1 ? 'CONFLICTING' : 'UNSUPPORTED',
			humanChecks.length > 1 || separation.length > 1
				? 'REQUIRED_ARTIFACT_AMBIGUOUS'
				: 'LAYOUT_UNRECOGNIZED'
		);
	if (separation.length === 1)
		return result('NOT_SATISFIED', 'RISK_PREREQUISITE_ABSENT', [
			sourceWitness(region, authority[0]!, 'recorded-proposer-authority'),
			sourceWitness(region, humanChecks[0]!, 'human-authority-check'),
			sourceWitness(region, separation[0]!, 'same-actor-approval-rejection')
		]);
	return result('SATISFIED', 'RISK_PREREQUISITE_PRESENT', [
		sourceWitness(region, authority[0]!, 'recorded-proposer-authority'),
		sourceWitness(region, humanChecks[0]!, 'human-only-approval-without-separation')
	]);
}

const ATTEMPT_FIELDS = Object.freeze([
	'attemptId',
	'commandIdentity',
	'environmentIdentity',
	'exitOutcome',
	'inputProvenance',
	'outputValidation',
	'subjectIdentity',
	'timeBound'
] as const);

function detectFinding55(region: ParsedRegion): DetectorResult {
	const alias = criticalAlias(
		region,
		new Set(['execFile', 'execFileAsync', 'recordExternalToolAttempt'])
	);
	if (alias !== null)
		return result('UNSUPPORTED', 'CRITICAL_SYMBOL_ALIASED', [
			sourceWitness(region, alias, 'critical-symbol-alias')
		]);
	const functions = namedFunctions(region, 'agyPrint');
	if (functions.length > 1) return result('CONFLICTING', 'REQUIRED_ARTIFACT_AMBIGUOUS');
	if (functions.length !== 1) return result('UNSUPPORTED', 'LAYOUT_UNRECOGNIZED');
	const fn = functions[0]!;
	const executions = callsWithin(region, fn, 'execFileAsync').filter(
		(call) =>
			expressionPath(call.expression) === 'execFileAsync' &&
			call.arguments.length === 3 &&
			expressionPath(call.arguments[0]!) === 'AGY_BIN' &&
			expressionPath(call.arguments[1]!) === 'args' &&
			ts.isObjectLiteralExpression(call.arguments[2]!) &&
			['timeout', 'maxBuffer', 'windowsHide'].every((field) =>
				(call.arguments[2] as ts.ObjectLiteralExpression).properties.some(
					(member) => nameText(member.name) === field
				)
			)
	);
	if (executions.length !== 1)
		return result(
			executions.length > 1 ? 'CONFLICTING' : 'UNSUPPORTED',
			executions.length > 1 ? 'REQUIRED_ARTIFACT_AMBIGUOUS' : 'LAYOUT_UNRECOGNIZED'
		);
	const records = callsWithin(region, fn, 'recordExternalToolAttempt');
	if (records.length > 1)
		return result(
			'CONFLICTING',
			'REQUIRED_ARTIFACT_AMBIGUOUS',
			records.map((record) => sourceWitness(region, record, 'attempt-record'))
		);
	if (records.length === 0)
		return result('SATISFIED', 'RISK_PREREQUISITE_PRESENT', [
			sourceWitness(region, executions[0]!, 'direct-external-tool-execution-without-attempt-record')
		]);
	const record = records[0]!;
	if (record.arguments.length !== 1 || !ts.isObjectLiteralExpression(record.arguments[0]!))
		return result('UNSUPPORTED', 'LAYOUT_UNRECOGNIZED', [
			sourceWitness(region, record, 'nonliteral-attempt-record')
		]);
	const names = record.arguments[0].properties
		.map((property) => nameText(property.name))
		.filter((name): name is string => name !== null)
		.sort(compareText);
	if (
		names.length !== ATTEMPT_FIELDS.length ||
		ATTEMPT_FIELDS.some((field) => !names.includes(field))
	)
		return result('UNSUPPORTED', 'LAYOUT_UNRECOGNIZED', [
			sourceWitness(region, record, 'partial-attempt-record')
		]);
	return result('NOT_SATISFIED', 'RISK_PREREQUISITE_ABSENT', [
		sourceWitness(region, executions[0]!, 'bounded-external-tool-execution'),
		sourceWitness(region, record, 'complete-attempt-record')
	]);
}

const DETECTORS: Readonly<
	Record<HybridRuntimeFindingId, (region: ParsedRegion) => DetectorResult>
> = Object.freeze({
	9: detectFinding9,
	19: detectFinding19,
	45: detectFinding45,
	54: detectFinding54,
	55: detectFinding55
});

const SEMANTICS: Readonly<
	Record<HybridRuntimeFindingId, JpwbHybridStaticProjectionRow['semantics']>
> = Object.freeze({
	9: 'AUTHENTICATED_SESSION_VS_FABRICATED_HUMAN_COMMAND_IDENTITY',
	19: 'THREE_AXIS_IDEMPOTENCY_BINDING_VS_PRIOR_RESULT_REUSE',
	45: 'PER_OUTPUT_ASSESSMENT_VS_SINGLE_WHOLE_GRAPH_REASONING_REVIEW',
	54: 'DISTINCT_PROPOSER_APPROVER_VS_HUMAN_ONLY_AUTHORITY',
	55: 'COMPLETE_EXTERNAL_TOOL_ATTEMPT_RECORD_VS_DIRECT_UNRECORDED_EXECUTION'
});

function evidenceId(
	subjectId: string,
	findingId: HybridRuntimeFindingId,
	binding: NonNullable<JpwbHybridStaticProjectionRow['sourceBinding']>,
	resultValue: DetectorResult
): string {
	return sha256(
		canonicalJson({
			binding,
			findingId,
			operationVersion: JPWB_HYBRID_STATIC_PROJECTION_OPERATION_VERSION,
			projectorVersion: JPWB_HYBRID_STATIC_PROJECTOR_VERSION,
			reasonCode: resultValue.reasonCode,
			state: resultValue.state,
			subjectId,
			witnesses: resultValue.witnesses
		})
	);
}

function unavailableDetector(reasonCode: JpwbHybridStaticProjectionReasonCode): DetectorResult {
	return result(
		reasonCode === 'REQUIRED_ARTIFACT_AMBIGUOUS' ? 'CONFLICTING' : 'UNSUPPORTED',
		reasonCode
	);
}

export function projectJpwbHybridStaticPrerequisites(
	requestValue: ProjectJpwbHybridStaticPrerequisitesRequest
): JpwbHybridStaticPrerequisiteProjection {
	const request = admittedRequest(requestValue);
	const prerequisiteFreshness = request.freshness.state === 'CURRENT' ? 'CURRENT' : 'STALE';
	const rows = HYBRID_RUNTIME_FINDING_IDS.map((findingId): JpwbHybridStaticProjectionRow => {
		const path = JPWB_HYBRID_STATIC_REQUIRED_PATHS[findingId];
		const admission = admitRegion(request.subject, path, request.budgets);
		const detectorResult =
			request.freshness.state === 'UNAVAILABLE'
				? unavailableDetector('FRESHNESS_UNAVAILABLE')
				: admission.reasonCode !== undefined
					? unavailableDetector(admission.reasonCode)
					: DETECTORS[findingId](admission.region!);
		const evidenceIds =
			admission.binding !== null &&
			(detectorResult.state === 'SATISFIED' || detectorResult.state === 'NOT_SATISFIED')
				? Object.freeze([
						evidenceId(
							request.subject.descriptor.subjectId,
							findingId,
							admission.binding,
							detectorResult
						)
					])
				: Object.freeze([]);
		const prerequisite: HybridStaticPrerequisite = Object.freeze({
			capability: JPWB_HYBRID_STATIC_CAPABILITIES[findingId],
			evidenceIds,
			findingId,
			freshness: prerequisiteFreshness,
			observedAt: request.observedAt,
			providerId: JPWB_HYBRID_STATIC_PROJECTOR_ID,
			state: detectorResult.state,
			subjectId: request.subject.descriptor.subjectId
		});
		return Object.freeze({
			capability: JPWB_HYBRID_STATIC_CAPABILITIES[findingId],
			findingId,
			prerequisite,
			reasonCode: detectorResult.reasonCode,
			requiredPath: path,
			semantics: SEMANTICS[findingId],
			sourceBinding: admission.binding,
			witnesses: detectorResult.witnesses
		});
	});
	const conclusive = rows.filter(
		(row) => row.prerequisite.state === 'SATISFIED' || row.prerequisite.state === 'NOT_SATISFIED'
	).length;
	const conflicting = rows.filter((row) => row.prerequisite.state === 'CONFLICTING').length;
	const unsupported = rows.filter((row) => row.prerequisite.state === 'UNSUPPORTED').length;
	if (conclusive + conflicting + unsupported !== HYBRID_RUNTIME_FINDING_IDS.length)
		throw new Error('Hybrid static prerequisite population arithmetic did not reconcile.');
	return Object.freeze({
		analysisAuthority: 'NONE',
		budgets: request.budgets,
		freshness: Object.freeze({
			changedPaths: Object.freeze([...request.freshness.changedPaths]),
			state: request.freshness.state
		}),
		gateEffect: 'NONE',
		limitations: JPWB_HYBRID_STATIC_PROJECTION_LIMITATIONS,
		observedAt: request.observedAt,
		operationVersion: JPWB_HYBRID_STATIC_PROJECTION_OPERATION_VERSION,
		population: Object.freeze({
			conflicting,
			conclusive,
			expected: 5,
			produced: 5,
			reconciles: true,
			unsupported
		}),
		prerequisites: Object.freeze(rows.map((row) => row.prerequisite)),
		projector: Object.freeze({
			id: JPWB_HYBRID_STATIC_PROJECTOR_ID,
			version: JPWB_HYBRID_STATIC_PROJECTOR_VERSION
		}),
		rows: Object.freeze(rows),
		schemaVersion: JPWB_HYBRID_STATIC_PROJECTION_SCHEMA_VERSION,
		subject: Object.freeze({
			fileManifestDigest: request.subject.descriptor.fileManifestDigest,
			subjectId: request.subject.descriptor.subjectId
		})
	});
}

export function hybridStaticPrerequisiteProjectionDigest(
	projection: JpwbHybridStaticPrerequisiteProjection
): string {
	return sha256(canonicalJson(projection));
}

export function evaluateProjectedHybridRuntimeRows(options: {
	readonly assessedAt: string;
	readonly projection: JpwbHybridStaticPrerequisiteProjection;
	readonly trace: ProviderEvidenceResult<DeterministicRuntimeTraceObservation>;
}): HybridRuntimeEvaluationResult {
	if (
		options.projection.schemaVersion !== JPWB_HYBRID_STATIC_PROJECTION_SCHEMA_VERSION ||
		options.projection.projector.id !== JPWB_HYBRID_STATIC_PROJECTOR_ID ||
		options.projection.projector.version !== JPWB_HYBRID_STATIC_PROJECTOR_VERSION ||
		options.projection.population.expected !== 5 ||
		options.projection.population.produced !== 5 ||
		options.projection.population.reconciles !== true ||
		options.projection.subject.subjectId !== options.trace.subject.id ||
		options.projection.subject.fileManifestDigest !== options.trace.subject.fileManifestSha256
	)
		throw new TypeError('Hybrid runtime trace is not bound to the supplied static projection.');
	return evaluateHybridRuntimeRows({
		assessedAt: options.assessedAt,
		staticPrerequisites: options.projection.prerequisites,
		trace: options.trace
	});
}
