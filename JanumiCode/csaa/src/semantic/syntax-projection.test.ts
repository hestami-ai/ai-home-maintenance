import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { canonicalSemanticJson } from './canonical.js';
import {
	SEMANTIC_AST_STRUCTURAL_ROLES,
	canHaveAssignmentInitializer,
	declarationCandidateMatchesNode,
	exactLiteralValueType,
	isSemanticLiteralKind,
	isTypeScriptModifierKind,
	isUtf16CodeUnitLiteralKind,
	literalLexemeDigest,
	literalValueDigest,
	literalValueLength,
	literalValueMatchesNodeKind,
	semanticAssignmentKind,
	semanticDeclarationCandidateRole,
	semanticDeclarationNameState,
	semanticInvocationKind,
	semanticLiteralDescriptor,
	typescriptSyntaxKindName
} from './syntax-projection.js';

describe('bounded TypeScript syntax projection', () => {
	it('uses the exact declaration-candidate taxonomy without semantic overclaim', () => {
		expect(semanticDeclarationCandidateRole(ts.SyntaxKind.VariableDeclaration)).toBe('BINDING');
		expect(semanticDeclarationCandidateRole(ts.SyntaxKind.MethodSignature)).toBe('MEMBER');
		expect(semanticDeclarationCandidateRole(ts.SyntaxKind.CallSignature)).toBe('SIGNATURE');
		expect(semanticDeclarationCandidateRole(ts.SyntaxKind.ImportSpecifier)).toBe('IMPORT_ALIAS');
		expect(semanticDeclarationCandidateRole(ts.SyntaxKind.ExportSpecifier)).toBe('EXPORT_BINDING');
		expect(semanticDeclarationCandidateRole(ts.SyntaxKind.JSDocTypedefTag)).toBe('JSDOC_BINDING');
		for (const excluded of [
			ts.SyntaxKind.ArrowFunction,
			ts.SyntaxKind.ImportDeclaration,
			ts.SyntaxKind.ExportDeclaration,
			ts.SyntaxKind.ClassStaticBlockDeclaration,
			ts.SyntaxKind.JsxAttribute,
			ts.SyntaxKind.SemicolonClassElement
		])
			expect(semanticDeclarationCandidateRole(excluded)).toBeNull();
		expect(
			declarationCandidateMatchesNode(ts.SyntaxKind.FunctionExpression, 'BINDING', 'ATOMIC')
		).toBe(true);
		expect(
			declarationCandidateMatchesNode(ts.SyntaxKind.FunctionExpression, 'BINDING', 'ANONYMOUS')
		).toBe(false);
		expect(
			declarationCandidateMatchesNode(ts.SyntaxKind.VariableDeclaration, 'BINDING', 'PATTERN')
		).toBe(true);
		expect(
			declarationCandidateMatchesNode(ts.SyntaxKind.VariableDeclaration, 'BINDING', 'ANONYMOUS')
		).toBe(false);
		expect(semanticDeclarationNameState(ts.SyntaxKind.Identifier, '')).toBe('MISSING');
		expect(semanticDeclarationNameState(ts.SyntaxKind.Identifier, 'name')).toBe('ATOMIC');
		expect(semanticDeclarationNameState(ts.SyntaxKind.ComputedPropertyName)).toBe('COMPUTED');
		expect(semanticDeclarationNameState(ts.SyntaxKind.ObjectBindingPattern)).toBe('PATTERN');
	});

	it('projects only literal nodes with explicit string-safe encodings', () => {
		expect(semanticLiteralDescriptor(ts.SyntaxKind.NumericLiteral)).toEqual({
			valueEncoding: 'TYPESCRIPT_TEXT',
			valueType: 'NUMBER'
		});
		expect(semanticLiteralDescriptor(ts.SyntaxKind.BigIntLiteral)).toEqual({
			valueEncoding: 'TYPESCRIPT_TEXT',
			valueType: 'BIGINT'
		});
		expect(semanticLiteralDescriptor(ts.SyntaxKind.StringLiteral)).toEqual({
			valueEncoding: 'JSON_SCALAR',
			valueType: 'STRING'
		});
		expect(semanticLiteralDescriptor(ts.SyntaxKind.TemplateExpression)).toBeNull();
		expect(semanticLiteralDescriptor(ts.SyntaxKind.NoSubstitutionTemplateLiteral)?.valueType).toBe(
			'NO_SUBSTITUTION_TEMPLATE'
		);
		expect(semanticLiteralDescriptor(ts.SyntaxKind.TemplateHead)?.valueType).toBe('TEMPLATE_HEAD');
		expect(semanticLiteralDescriptor(ts.SyntaxKind.TemplateMiddle)?.valueType).toBe(
			'TEMPLATE_MIDDLE'
		);
		expect(semanticLiteralDescriptor(ts.SyntaxKind.TemplateTail)?.valueType).toBe('TEMPLATE_TAIL');
		expect(
			literalValueMatchesNodeKind(
				ts.SyntaxKind.NumericLiteral,
				'NUMBER',
				'TYPESCRIPT_TEXT',
				'Infinity'
			)
		).toBe(true);
		expect(
			literalValueMatchesNodeKind(
				ts.SyntaxKind.NumericLiteral,
				'NUMBER',
				'TYPESCRIPT_TEXT',
				1 as never
			)
		).toBe(false);
		expect(literalValueDigest('TYPESCRIPT_TEXT', 'NUMBER', '1')).not.toBe(
			literalValueDigest('JSON_SCALAR', 'NUMBER', '1')
		);
		const loneHigh = '\ud800';
		const loneLow = '\udc00';
		expect(literalValueDigest('UTF16_CODE_UNITS_LE', 'STRING', loneHigh)).not.toBe(
			literalValueDigest('UTF16_CODE_UNITS_LE', 'STRING', loneLow)
		);
		expect(literalValueDigest('UTF16_CODE_UNITS_LE', 'STRING', loneHigh)).not.toBe(
			literalValueDigest('UTF16_CODE_UNITS_LE', 'NO_SUBSTITUTION_TEMPLATE', loneHigh)
		);
		expect(() => canonicalSemanticJson(loneHigh)).toThrow('lone UTF-16 surrogates');
	});

	it('uses the exact assignment-initializer and invocation kind sets', () => {
		for (const included of [
			ts.SyntaxKind.BindingElement,
			ts.SyntaxKind.EnumMember,
			ts.SyntaxKind.Parameter,
			ts.SyntaxKind.PropertyAssignment,
			ts.SyntaxKind.PropertyDeclaration,
			ts.SyntaxKind.ShorthandPropertyAssignment,
			ts.SyntaxKind.VariableDeclaration
		])
			expect(canHaveAssignmentInitializer(included)).toBe(true);
		for (const excluded of [ts.SyntaxKind.JsxAttribute, ts.SyntaxKind.PropertySignature])
			expect(canHaveAssignmentInitializer(excluded)).toBe(false);
		expect(semanticInvocationKind(ts.SyntaxKind.CallExpression)).toBe('CALL');
		expect(semanticInvocationKind(ts.SyntaxKind.NewExpression)).toBe('NEW');
		expect(semanticInvocationKind(ts.SyntaxKind.TaggedTemplateExpression)).toBe('TAGGED_TEMPLATE');
		expect(semanticInvocationKind(ts.SyntaxKind.PropertyAccessExpression)).toBeNull();
	});

	it('closes every public taxonomy boundary without widening the TypeScript projection', () => {
		expect(SEMANTIC_AST_STRUCTURAL_ROLES).toEqual([...SEMANTIC_AST_STRUCTURAL_ROLES].sort());
		expect(typescriptSyntaxKindName(ts.SyntaxKind.SourceFile)).toBe('SourceFile');
		expect(typescriptSyntaxKindName(-1)).toBeNull();
		expect(isTypeScriptModifierKind(ts.SyntaxKind.ReadonlyKeyword)).toBe(true);
		expect(isTypeScriptModifierKind(ts.SyntaxKind.Identifier)).toBe(false);

		expect(
			declarationCandidateMatchesNode(ts.SyntaxKind.VariableDeclaration, 'MEMBER', 'ATOMIC')
		).toBe(false);
		expect(
			declarationCandidateMatchesNode(ts.SyntaxKind.FunctionDeclaration, 'BINDING', 'ANONYMOUS')
		).toBe(true);
		expect(
			declarationCandidateMatchesNode(ts.SyntaxKind.PropertyDeclaration, 'MEMBER', 'COMPUTED')
		).toBe(true);
		expect(
			declarationCandidateMatchesNode(ts.SyntaxKind.Constructor, 'SIGNATURE', 'ANONYMOUS')
		).toBe(true);
		expect(
			declarationCandidateMatchesNode(ts.SyntaxKind.JSDocPropertyTag, 'JSDOC_BINDING', 'ANONYMOUS')
		).toBe(true);
		expect(declarationCandidateMatchesNode(ts.SyntaxKind.TypeParameter, 'BINDING', 'ATOMIC')).toBe(
			true
		);

		for (const kind of [
			ts.SyntaxKind.StringLiteral,
			ts.SyntaxKind.NumericLiteral,
			ts.SyntaxKind.NoSubstitutionTemplateLiteral,
			ts.SyntaxKind.BigIntLiteral
		])
			expect(semanticDeclarationNameState(kind)).toBe('ATOMIC');
		expect(semanticDeclarationNameState(ts.SyntaxKind.ArrayBindingPattern)).toBe('PATTERN');
		expect(semanticDeclarationNameState(ts.SyntaxKind.SourceFile)).toBeNull();

		expect(isSemanticLiteralKind(ts.SyntaxKind.TrueKeyword)).toBe(true);
		expect(isSemanticLiteralKind(ts.SyntaxKind.Identifier)).toBe(false);
		for (const kind of [
			ts.SyntaxKind.StringLiteral,
			ts.SyntaxKind.NoSubstitutionTemplateLiteral,
			ts.SyntaxKind.TemplateHead,
			ts.SyntaxKind.TemplateMiddle,
			ts.SyntaxKind.TemplateTail
		])
			expect(isUtf16CodeUnitLiteralKind(kind)).toBe(true);
		expect(isUtf16CodeUnitLiteralKind(ts.SyntaxKind.NumericLiteral)).toBe(false);
		expect(
			literalValueMatchesNodeKind(ts.SyntaxKind.Identifier, 'STRING', 'JSON_SCALAR', 'x')
		).toBe(false);
		expect(
			literalValueMatchesNodeKind(
				ts.SyntaxKind.StringLiteral,
				'STRING',
				'UTF16_CODE_UNITS_LE',
				null
			)
		).toBe(true);
		expect(
			literalValueMatchesNodeKind(ts.SyntaxKind.NumericLiteral, 'NUMBER', 'JSON_SCALAR', '1')
		).toBe(false);
		expect(
			literalValueMatchesNodeKind(ts.SyntaxKind.FalseKeyword, 'BOOLEAN', 'JSON_SCALAR', false)
		).toBe(true);
		expect(
			literalValueMatchesNodeKind(ts.SyntaxKind.TrueKeyword, 'BOOLEAN', 'JSON_SCALAR', true)
		).toBe(true);
		expect(
			literalValueMatchesNodeKind(ts.SyntaxKind.NullKeyword, 'NULL', 'JSON_SCALAR', null)
		).toBe(true);

		expect(
			semanticAssignmentKind({
				hasAssignmentInitializer: true,
				kind: ts.SyntaxKind.VariableDeclaration,
				operatorKind: null
			})
		).toBe('INITIALIZER');
		expect(
			semanticAssignmentKind({
				hasAssignmentInitializer: false,
				kind: ts.SyntaxKind.BinaryExpression,
				operatorKind: ts.SyntaxKind.QuestionQuestionEqualsToken
			})
		).toBe('BINARY');
		expect(
			semanticAssignmentKind({
				hasAssignmentInitializer: false,
				kind: ts.SyntaxKind.PrefixUnaryExpression,
				operatorKind: ts.SyntaxKind.PlusPlusToken
			})
		).toBe('PREFIX_UPDATE');
		expect(
			semanticAssignmentKind({
				hasAssignmentInitializer: false,
				kind: ts.SyntaxKind.PostfixUnaryExpression,
				operatorKind: ts.SyntaxKind.MinusMinusToken
			})
		).toBe('POSTFIX_UPDATE');
		expect(
			semanticAssignmentKind({
				hasAssignmentInitializer: false,
				kind: ts.SyntaxKind.BinaryExpression,
				operatorKind: ts.SyntaxKind.PlusToken
			})
		).toBeNull();

		expect(exactLiteralValueType('NULL', null)).toBe(true);
		expect(exactLiteralValueType('BOOLEAN', false)).toBe(true);
		expect(exactLiteralValueType('STRING', 'value')).toBe(true);
		expect(literalValueLength(null)).toBe(4);
		expect(literalValueLength(false)).toBe(5);
		expect(literalValueLength('🧪')).toBe(2);
		expect(literalLexemeDigest('"value"')).toMatch(/^[a-f0-9]{64}$/u);
		expect(() => literalValueDigest('UTF16_CODE_UNITS_LE', 'STRING', null)).toThrow(
			'exact cooked string'
		);
	});
});
