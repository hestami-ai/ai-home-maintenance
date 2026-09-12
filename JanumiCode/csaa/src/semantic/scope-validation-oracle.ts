import ts from 'typescript';
import type {
	SemanticScopeDomain,
	SemanticScopeKind,
	SemanticSourceModuleKind
} from '../contracts/semantic.js';

export interface ValidationScopeBoundaryDescriptor {
	readonly domain: SemanticScopeDomain;
	readonly kind: SemanticScopeKind;
}

const VALIDATION_FUNCTION_KINDS = new Set<number>([
	ts.SyntaxKind.CallSignature,
	ts.SyntaxKind.ConstructSignature,
	ts.SyntaxKind.MethodSignature,
	ts.SyntaxKind.FunctionType,
	ts.SyntaxKind.ConstructorType,
	ts.SyntaxKind.FunctionDeclaration,
	ts.SyntaxKind.MethodDeclaration,
	ts.SyntaxKind.Constructor,
	ts.SyntaxKind.GetAccessor,
	ts.SyntaxKind.SetAccessor,
	ts.SyntaxKind.FunctionExpression,
	ts.SyntaxKind.ArrowFunction
]);

/**
 * Closed validation oracle for the retained scope contract. This module is
 * intentionally independent from the producer taxonomy and placement helpers.
 */
export function validationScopeBoundaryDescriptor(
	syntaxKind: number,
	moduleKind: SemanticSourceModuleKind
): ValidationScopeBoundaryDescriptor | null {
	if (syntaxKind === ts.SyntaxKind.SourceFile)
		return {
			domain: moduleKind === 'MODULE' ? 'MIXED' : 'LEXICAL',
			kind: moduleKind === 'MODULE' ? 'SOURCE_MODULE' : 'SOURCE_SCRIPT'
		};
	if (syntaxKind === ts.SyntaxKind.CatchClause) return { domain: 'LEXICAL', kind: 'CATCH' };
	if (syntaxKind === ts.SyntaxKind.ClassDeclaration || syntaxKind === ts.SyntaxKind.ClassExpression)
		return { domain: 'MIXED', kind: 'CLASS' };
	if (syntaxKind === ts.SyntaxKind.ModuleDeclaration) return { domain: 'MIXED', kind: 'NAMESPACE' };
	if (syntaxKind === ts.SyntaxKind.EnumDeclaration) return { domain: 'MIXED', kind: 'ENUM' };
	if (VALIDATION_FUNCTION_KINDS.has(syntaxKind)) return { domain: 'LEXICAL', kind: 'FUNCTION' };
	if (
		syntaxKind === ts.SyntaxKind.ForStatement ||
		syntaxKind === ts.SyntaxKind.ForInStatement ||
		syntaxKind === ts.SyntaxKind.ForOfStatement
	)
		return { domain: 'LEXICAL', kind: 'LOOP' };
	if (
		syntaxKind === ts.SyntaxKind.InterfaceDeclaration ||
		syntaxKind === ts.SyntaxKind.TypeAliasDeclaration ||
		syntaxKind === ts.SyntaxKind.MappedType
	)
		return { domain: 'TYPE_PARAMETER', kind: 'TYPE' };
	if (
		syntaxKind === ts.SyntaxKind.ObjectLiteralExpression ||
		syntaxKind === ts.SyntaxKind.TypeLiteral
	)
		return { domain: 'MEMBER', kind: 'OBJECT' };
	if (
		syntaxKind === ts.SyntaxKind.Block ||
		syntaxKind === ts.SyntaxKind.CaseBlock ||
		syntaxKind === ts.SyntaxKind.ClassStaticBlockDeclaration
	)
		return { domain: 'LEXICAL', kind: 'BLOCK' };
	return null;
}

export function validationSourceScopeKind(
	moduleKind: SemanticSourceModuleKind
): 'SOURCE_MODULE' | 'SOURCE_SCRIPT' {
	return moduleKind === 'MODULE' ? 'SOURCE_MODULE' : 'SOURCE_SCRIPT';
}

export function isValidationOrdinaryReferenceScope(domain: SemanticScopeDomain): boolean {
	return domain !== 'MEMBER';
}

export function validationProgramGlobalScopeDescriptor(): ValidationScopeBoundaryDescriptor {
	return { domain: 'LEXICAL', kind: 'PROGRAM_GLOBAL' };
}
