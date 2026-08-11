import ts from 'typescript';
import type {
	SemanticAstNodeRecord,
	SemanticAstStructuralRole,
	SemanticDeclarationCandidateNameState,
	SemanticDeclarationCandidateRole,
	SemanticInvocationSiteRecord,
	SemanticLiteralRecord
} from '../contracts/semantic.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson, semanticUtf16CodeUnitsDigest } from './canonical.js';

const DECLARATION_CANDIDATE_ROLE_BY_KIND = new Map<number, SemanticDeclarationCandidateRole>([
	[ts.SyntaxKind.BindingElement, 'BINDING'],
	[ts.SyntaxKind.VariableDeclaration, 'BINDING'],
	[ts.SyntaxKind.Parameter, 'BINDING'],
	[ts.SyntaxKind.TypeParameter, 'BINDING'],
	[ts.SyntaxKind.FunctionDeclaration, 'BINDING'],
	[ts.SyntaxKind.FunctionExpression, 'BINDING'],
	[ts.SyntaxKind.ClassDeclaration, 'BINDING'],
	[ts.SyntaxKind.ClassExpression, 'BINDING'],
	[ts.SyntaxKind.InterfaceDeclaration, 'BINDING'],
	[ts.SyntaxKind.TypeAliasDeclaration, 'BINDING'],
	[ts.SyntaxKind.EnumDeclaration, 'BINDING'],
	[ts.SyntaxKind.ModuleDeclaration, 'BINDING'],
	[ts.SyntaxKind.EnumMember, 'MEMBER'],
	[ts.SyntaxKind.PropertyDeclaration, 'MEMBER'],
	[ts.SyntaxKind.PropertySignature, 'MEMBER'],
	[ts.SyntaxKind.MethodDeclaration, 'MEMBER'],
	[ts.SyntaxKind.MethodSignature, 'MEMBER'],
	[ts.SyntaxKind.GetAccessor, 'MEMBER'],
	[ts.SyntaxKind.SetAccessor, 'MEMBER'],
	[ts.SyntaxKind.PropertyAssignment, 'MEMBER'],
	[ts.SyntaxKind.ShorthandPropertyAssignment, 'MEMBER'],
	[ts.SyntaxKind.NamedTupleMember, 'MEMBER'],
	[ts.SyntaxKind.Constructor, 'SIGNATURE'],
	[ts.SyntaxKind.CallSignature, 'SIGNATURE'],
	[ts.SyntaxKind.ConstructSignature, 'SIGNATURE'],
	[ts.SyntaxKind.IndexSignature, 'SIGNATURE'],
	[ts.SyntaxKind.ImportClause, 'IMPORT_ALIAS'],
	[ts.SyntaxKind.ImportEqualsDeclaration, 'IMPORT_ALIAS'],
	[ts.SyntaxKind.NamespaceImport, 'IMPORT_ALIAS'],
	[ts.SyntaxKind.ImportSpecifier, 'IMPORT_ALIAS'],
	[ts.SyntaxKind.NamespaceExport, 'EXPORT_BINDING'],
	[ts.SyntaxKind.NamespaceExportDeclaration, 'EXPORT_BINDING'],
	[ts.SyntaxKind.ExportSpecifier, 'EXPORT_BINDING'],
	[ts.SyntaxKind.ExportAssignment, 'EXPORT_BINDING'],
	[ts.SyntaxKind.JSDocTypedefTag, 'JSDOC_BINDING'],
	[ts.SyntaxKind.JSDocCallbackTag, 'JSDOC_BINDING'],
	[ts.SyntaxKind.JSDocEnumTag, 'JSDOC_BINDING'],
	[ts.SyntaxKind.JSDocParameterTag, 'JSDOC_BINDING'],
	[ts.SyntaxKind.JSDocPropertyTag, 'JSDOC_BINDING']
]);

export type SemanticLiteralValueType = SemanticLiteralRecord['valueType'];
export type SemanticLiteralValueEncoding = SemanticLiteralRecord['valueEncoding'];

export const AST_STRUCTURAL_ROLES = {
	assignmentTarget: 'assignment-target',
	assignmentValue: 'assignment-value',
	declarationName: 'declaration-name',
	genericChild: 'generic-child',
	invocationArgument: 'invocation-argument',
	invocationCallee: 'invocation-callee',
	invocationTemplate: 'invocation-template',
	sourceFile: 'source-file'
} as const satisfies Readonly<Record<string, SemanticAstStructuralRole>>;

export const SEMANTIC_AST_STRUCTURAL_ROLES: readonly SemanticAstStructuralRole[] = Object.values(AST_STRUCTURAL_ROLES).sort();

const SYNTAX_KIND_NAME_BY_CODE = new Map<number, string>();
for (const [name, value] of Object.entries(ts.SyntaxKind)) {
	if (typeof value !== 'number' || /^(?:First|Last)/u.test(name) || SYNTAX_KIND_NAME_BY_CODE.has(value)) continue;
	SYNTAX_KIND_NAME_BY_CODE.set(value, name);
}

export const PUBLIC_NODE_FLAG_MASK = ts.NodeFlags.Let
	| ts.NodeFlags.Const
	| ts.NodeFlags.Using
	| ts.NodeFlags.NestedNamespace
	| ts.NodeFlags.Synthesized
	| ts.NodeFlags.Namespace
	| ts.NodeFlags.OptionalChain
	| ts.NodeFlags.ExportContext
	| ts.NodeFlags.ContainsThis
	| ts.NodeFlags.HasImplicitReturn
	| ts.NodeFlags.HasExplicitReturn
	| ts.NodeFlags.GlobalAugmentation
	| ts.NodeFlags.HasAsyncFunctions
	| ts.NodeFlags.DisallowInContext
	| ts.NodeFlags.YieldContext
	| ts.NodeFlags.DecoratorContext
	| ts.NodeFlags.AwaitContext
	| ts.NodeFlags.DisallowConditionalTypesContext
	| ts.NodeFlags.ThisNodeHasError
	| ts.NodeFlags.JavaScriptFile
	| ts.NodeFlags.ThisNodeOrAnySubNodesHasError
	| ts.NodeFlags.HasAggregatedChildData
	| ts.NodeFlags.JSDoc
	| ts.NodeFlags.JsonFile;

export function typescriptSyntaxKindName(kind: number): string | null {
	return SYNTAX_KIND_NAME_BY_CODE.get(kind) ?? null;
}

const ASSIGNMENT_OPERATORS = new Set<number>([
	ts.SyntaxKind.EqualsToken,
	ts.SyntaxKind.PlusEqualsToken,
	ts.SyntaxKind.MinusEqualsToken,
	ts.SyntaxKind.AsteriskEqualsToken,
	ts.SyntaxKind.AsteriskAsteriskEqualsToken,
	ts.SyntaxKind.SlashEqualsToken,
	ts.SyntaxKind.PercentEqualsToken,
	ts.SyntaxKind.LessThanLessThanEqualsToken,
	ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
	ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
	ts.SyntaxKind.AmpersandEqualsToken,
	ts.SyntaxKind.BarEqualsToken,
	ts.SyntaxKind.CaretEqualsToken,
	ts.SyntaxKind.BarBarEqualsToken,
	ts.SyntaxKind.AmpersandAmpersandEqualsToken,
	ts.SyntaxKind.QuestionQuestionEqualsToken
]);

const ASSIGNMENT_INITIALIZER_KINDS = new Set<number>([
	ts.SyntaxKind.BindingElement,
	ts.SyntaxKind.EnumMember,
	ts.SyntaxKind.Parameter,
	ts.SyntaxKind.PropertyAssignment,
	ts.SyntaxKind.PropertyDeclaration,
	ts.SyntaxKind.ShorthandPropertyAssignment,
	ts.SyntaxKind.VariableDeclaration
]);

const MODIFIER_KINDS = new Set<number>([
	ts.SyntaxKind.AbstractKeyword,
	ts.SyntaxKind.AccessorKeyword,
	ts.SyntaxKind.AsyncKeyword,
	ts.SyntaxKind.ConstKeyword,
	ts.SyntaxKind.DeclareKeyword,
	ts.SyntaxKind.DefaultKeyword,
	ts.SyntaxKind.ExportKeyword,
	ts.SyntaxKind.InKeyword,
	ts.SyntaxKind.OutKeyword,
	ts.SyntaxKind.OverrideKeyword,
	ts.SyntaxKind.PrivateKeyword,
	ts.SyntaxKind.ProtectedKeyword,
	ts.SyntaxKind.PublicKeyword,
	ts.SyntaxKind.ReadonlyKeyword,
	ts.SyntaxKind.StaticKeyword
]);

export function isTypeScriptModifierKind(kind: number): boolean {
	return MODIFIER_KINDS.has(kind);
}

export function semanticDeclarationCandidateRole(kind: number): SemanticDeclarationCandidateRole | null {
	return DECLARATION_CANDIDATE_ROLE_BY_KIND.get(kind) ?? null;
}

export function declarationCandidateMatchesNode(
	kind: number,
	candidateRole: SemanticDeclarationCandidateRole,
	nameState: SemanticDeclarationCandidateNameState
): boolean {
	if (semanticDeclarationCandidateRole(kind) !== candidateRole) return false;
	const atomic = nameState === 'ATOMIC' || nameState === 'MISSING';
	switch (kind) {
		case ts.SyntaxKind.BindingElement:
		case ts.SyntaxKind.VariableDeclaration:
		case ts.SyntaxKind.Parameter:
			return atomic || nameState === 'PATTERN';
		case ts.SyntaxKind.FunctionDeclaration:
		case ts.SyntaxKind.ClassDeclaration:
			return atomic || nameState === 'ANONYMOUS';
		case ts.SyntaxKind.FunctionExpression:
		case ts.SyntaxKind.ClassExpression:
		case ts.SyntaxKind.ImportClause:
			return atomic;
		case ts.SyntaxKind.EnumMember:
		case ts.SyntaxKind.PropertyDeclaration:
		case ts.SyntaxKind.PropertySignature:
		case ts.SyntaxKind.MethodDeclaration:
		case ts.SyntaxKind.MethodSignature:
		case ts.SyntaxKind.GetAccessor:
		case ts.SyntaxKind.SetAccessor:
		case ts.SyntaxKind.PropertyAssignment:
			return atomic || nameState === 'COMPUTED';
		case ts.SyntaxKind.Constructor:
		case ts.SyntaxKind.CallSignature:
		case ts.SyntaxKind.ConstructSignature:
		case ts.SyntaxKind.IndexSignature:
		case ts.SyntaxKind.ExportAssignment:
			return nameState === 'ANONYMOUS';
		case ts.SyntaxKind.JSDocTypedefTag:
		case ts.SyntaxKind.JSDocCallbackTag:
		case ts.SyntaxKind.JSDocEnumTag:
		case ts.SyntaxKind.JSDocParameterTag:
		case ts.SyntaxKind.JSDocPropertyTag:
			return atomic || nameState === 'ANONYMOUS';
		default:
			return atomic;
	}
}

export function semanticDeclarationNameState(kind: number, syntacticIdentifierText?: string | null): SemanticDeclarationCandidateNameState | null {
	switch (kind) {
		case ts.SyntaxKind.Identifier:
		case ts.SyntaxKind.PrivateIdentifier:
			return syntacticIdentifierText === '' ? 'MISSING' : 'ATOMIC';
		case ts.SyntaxKind.StringLiteral:
		case ts.SyntaxKind.NumericLiteral:
		case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
		case ts.SyntaxKind.BigIntLiteral:
			return 'ATOMIC';
		case ts.SyntaxKind.ComputedPropertyName:
			return 'COMPUTED';
		case ts.SyntaxKind.ObjectBindingPattern:
		case ts.SyntaxKind.ArrayBindingPattern:
			return 'PATTERN';
		default:
			return null;
	}
}

export function isSemanticLiteralKind(kind: number): boolean {
	return semanticLiteralDescriptor(kind) !== null;
}

export function semanticLiteralDescriptor(kind: number): {
	readonly valueEncoding: Exclude<SemanticLiteralValueEncoding, 'UTF16_CODE_UNITS_LE'>;
	readonly valueType: SemanticLiteralValueType;
} | null {
	switch (kind) {
		case ts.SyntaxKind.BigIntLiteral: return { valueEncoding: 'TYPESCRIPT_TEXT', valueType: 'BIGINT' };
		case ts.SyntaxKind.FalseKeyword:
		case ts.SyntaxKind.TrueKeyword: return { valueEncoding: 'JSON_SCALAR', valueType: 'BOOLEAN' };
		case ts.SyntaxKind.NoSubstitutionTemplateLiteral: return { valueEncoding: 'TYPESCRIPT_TEXT', valueType: 'NO_SUBSTITUTION_TEMPLATE' };
		case ts.SyntaxKind.TemplateHead: return { valueEncoding: 'TYPESCRIPT_TEXT', valueType: 'TEMPLATE_HEAD' };
		case ts.SyntaxKind.TemplateMiddle: return { valueEncoding: 'TYPESCRIPT_TEXT', valueType: 'TEMPLATE_MIDDLE' };
		case ts.SyntaxKind.TemplateTail: return { valueEncoding: 'TYPESCRIPT_TEXT', valueType: 'TEMPLATE_TAIL' };
		case ts.SyntaxKind.NullKeyword: return { valueEncoding: 'JSON_SCALAR', valueType: 'NULL' };
		case ts.SyntaxKind.NumericLiteral: return { valueEncoding: 'TYPESCRIPT_TEXT', valueType: 'NUMBER' };
		case ts.SyntaxKind.RegularExpressionLiteral: return { valueEncoding: 'TYPESCRIPT_TEXT', valueType: 'REGEXP' };
		case ts.SyntaxKind.StringLiteral: return { valueEncoding: 'JSON_SCALAR', valueType: 'STRING' };
		default: return null;
	}
}

export function isUtf16CodeUnitLiteralKind(kind: number): boolean {
	return kind === ts.SyntaxKind.StringLiteral
		|| kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral
		|| kind === ts.SyntaxKind.TemplateHead
		|| kind === ts.SyntaxKind.TemplateMiddle
		|| kind === ts.SyntaxKind.TemplateTail;
}

export function literalValueMatchesNodeKind(
	kind: number,
	valueType: SemanticLiteralValueType,
	valueEncoding: SemanticLiteralValueEncoding,
	value: SemanticLiteralRecord['value']
): boolean {
	const descriptor = semanticLiteralDescriptor(kind);
	if (descriptor?.valueType !== valueType) return false;
	if (valueEncoding === 'UTF16_CODE_UNITS_LE') return isUtf16CodeUnitLiteralKind(kind) && value === null;
	if (descriptor.valueEncoding !== valueEncoding) return false;
	if (kind === ts.SyntaxKind.FalseKeyword) return value === false;
	if (kind === ts.SyntaxKind.TrueKeyword) return value === true;
	if (kind === ts.SyntaxKind.NullKeyword) return value === null;
	return typeof value === 'string';
}

export function semanticInvocationKind(kind: number): SemanticInvocationSiteRecord['invocationKind'] | null {
	if (kind === ts.SyntaxKind.CallExpression) return 'CALL';
	if (kind === ts.SyntaxKind.NewExpression) return 'NEW';
	if (kind === ts.SyntaxKind.TaggedTemplateExpression) return 'TAGGED_TEMPLATE';
	return null;
}

export function canHaveAssignmentInitializer(kind: number): boolean {
	return ASSIGNMENT_INITIALIZER_KINDS.has(kind);
}

export function semanticAssignmentKind(node: Pick<SemanticAstNodeRecord, 'hasAssignmentInitializer' | 'kind' | 'operatorKind'>): 'BINARY' | 'INITIALIZER' | 'PREFIX_UPDATE' | 'POSTFIX_UPDATE' | null {
	if (node.hasAssignmentInitializer) return 'INITIALIZER';
	if (node.kind === ts.SyntaxKind.BinaryExpression && node.operatorKind !== null && ASSIGNMENT_OPERATORS.has(node.operatorKind)) return 'BINARY';
	if (node.kind === ts.SyntaxKind.PrefixUnaryExpression && (node.operatorKind === ts.SyntaxKind.PlusPlusToken || node.operatorKind === ts.SyntaxKind.MinusMinusToken)) return 'PREFIX_UPDATE';
	if (node.kind === ts.SyntaxKind.PostfixUnaryExpression && (node.operatorKind === ts.SyntaxKind.PlusPlusToken || node.operatorKind === ts.SyntaxKind.MinusMinusToken)) return 'POSTFIX_UPDATE';
	return null;
}

export function exactLiteralValueType(valueType: SemanticLiteralRecord['valueType'], value: SemanticLiteralRecord['value']): boolean {
	if (valueType === 'NULL') return value === null;
	if (valueType === 'BOOLEAN') return typeof value === 'boolean';
	return typeof value === 'string';
}

export function literalValueLength(value: SemanticLiteralRecord['value']): number {
	if (value === null) return 'null'.length;
	return typeof value === 'string' ? value.length : String(value).length;
}

export function literalValueDigest(
	valueEncoding: SemanticLiteralRecord['valueEncoding'],
	valueType: SemanticLiteralRecord['valueType'],
	value: SemanticLiteralRecord['value']
): string {
	if (valueEncoding === 'UTF16_CODE_UNITS_LE') {
		if (typeof value !== 'string') throw new TypeError('UTF-16 literal digests require the exact cooked string before redaction.');
		return semanticUtf16CodeUnitsDigest('JAN-CSAA-LITERAL-VALUE', [valueEncoding, valueType], value);
	}
	return sha256(canonicalSemanticJson({ value, valueEncoding, valueType }));
}

export function literalLexemeDigest(lexeme: string): string {
	return sha256(lexeme);
}
