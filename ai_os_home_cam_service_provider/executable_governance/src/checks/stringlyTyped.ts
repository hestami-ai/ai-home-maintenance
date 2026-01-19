import { Project, SyntaxKind, type StringLiteral, type Node, type SourceFile } from 'ts-morph';
import { type Config, getAbsolutePath } from '../config/index.js';
import type { Violation } from '../reporting/index.ts';
import path from 'path';
import { readFileSync, existsSync } from 'fs';
import { parse } from 'svelte/compiler';
import { globSync } from 'glob';

interface PrismaEnum {
    name: string;
    values: string[];
}

interface SvelteStringLiteral {
    value: string;
    line: number;
    context: 'script' | 'template';
}

/**
 * Workflow action const object definition
 * e.g., export const ConciergeActionAction = { CREATE_ACTION: 'CREATE_ACTION', ... } as const
 */
interface WorkflowActionConst {
    name: string;           // e.g., 'ConciergeActionAction'
    values: string[];       // e.g., ['CREATE_ACTION', 'START_ACTION', ...]
    filePath: string;       // e.g., 'src/lib/server/workflows/conciergeActionWorkflow.ts'
}

/**
 * File context categories for context-aware suggestions
 */
enum FileContext {
    ORPC_ROUTE = 'ORPC_ROUTE',
    WORKFLOW = 'WORKFLOW',
    SERVER_API_CORE = 'SERVER_API_CORE',
    SERVER_OTHER = 'SERVER_OTHER',
    PAGE_SERVER_LOAD = 'PAGE_SERVER_LOAD',
    CLIENT_API_MODULE = 'CLIENT_API_MODULE',
    CLIENT_STORE = 'CLIENT_STORE',
    SVELTE_COMPONENT = 'SVELTE_COMPONENT',
    SERVER_HOOK = 'SERVER_HOOK',
    CLIENT_HOOK = 'CLIENT_HOOK',
    UNKNOWN = 'UNKNOWN'
}

/**
 * Barrel file export status for an enum
 */
interface BarrelExportStatus {
    apiSchemas: boolean;      // Exported in src/lib/server/api/schemas.ts
    workflowSchemas: boolean; // Exported in src/lib/server/workflows/schemas.ts
    camTypes: boolean;        // Exported in src/lib/api/cam.ts
}

/**
 * Context-aware violation info
 */
interface ContextAwareViolation {
    reason: string;
    suggestion: string;
    severity: 'error' | 'warning' | 'info';
}

/**
 * Allowlist entry for specific file+value combinations
 */
interface AllowListEntry {
    file: string;      // File path pattern (exact match)
    values: string[];  // Values to allow in this file
    reason?: string;   // Optional reason for documentation
}

/**
 * R13: Stringly-Typed Code Detection
 *
 * Detects "magic strings" that should be using proper enums/types from the Prisma schema.
 * This catches:
 * - Primitive obsession: encoding domain concepts as plain strings
 * - Magic values/constants: hardcoded literals like 'INDIVIDUAL', 'RESOLVED', 'CLOSED'
 * - Enum drift: allowed values exist in Prisma but UI/server re-declares them ad hoc
 * - Workflow action discriminators: hardcoded action strings like 'CREATE_ACTION', 'BLOCK_ACTION'
 *
 * Provides context-aware suggestions based on file location:
 * - oRPC routes → Zod schemas from api/schemas.ts
 * - Workflows → Prisma enums from workflows/schemas.ts
 * - Client-side → Pre-extracted types from $lib/api/cam.ts
 */
export async function verifyStringlyTyped(config: Config): Promise<Violation[]> {
    const project = new Project();
    const violations: Violation[] = [];
    const projectRoot = getAbsolutePath(config.projectRoot, '.');

    // Step 1: Parse Prisma schema to extract all enum definitions
    const prismaSchemaPath = path.join(projectRoot, config.paths.prismaSchema);
    const prismaEnums = parsePrismaEnums(prismaSchemaPath);

    // Build lookup: enum value -> enum name(s)
    const enumValueToNames = buildEnumValueLookup(prismaEnums);

    // Step 2: Check barrel file exports for each enum
    const enumExportStatus = buildEnumExportStatus(prismaEnums, projectRoot);

    // Step 3: Scan workflow files for action const objects
    const workflowActionConsts = scanWorkflowActionConsts(projectRoot, project);
    const actionValueToConsts = buildActionValueLookup(workflowActionConsts);

    // Step 4: Scan for type discriminator const objects
    const typeDiscriminatorConsts = scanTypeDiscriminatorConsts(projectRoot, project);
    const typeValueToConsts = buildTypeValueLookup(typeDiscriminatorConsts);

    // Get R13 options from config (default skipCaseClauses to false)
    const r13Options = (config.rules as any)?.R13?.options || {};
    const skipCaseClauses = r13Options.skipCaseClauses ?? false;

    // Build allowlist lookup: file path -> Set of allowed values
    const allowList = (r13Options.allowList || []) as AllowListEntry[];
    const allowListLookup = buildAllowListLookup(allowList);

    // Step 5: Process TypeScript files with ts-morph
    const tsGlobPath = path.join(projectRoot, 'src/**/*.ts').replace(/\\/g, '/');
    const tsFiles = project.addSourceFilesAtPaths(tsGlobPath);

    for (const file of tsFiles) {
        const relativePath = path.relative(projectRoot, file.getFilePath()).replace(/\\/g, '/');

        if (isExcludedFile(relativePath, config)) {
            continue;
        }

        const fileViolations = processTypeScriptFile(file, relativePath, enumValueToNames, enumExportStatus, actionValueToConsts, typeValueToConsts, skipCaseClauses, allowListLookup);
        violations.push(...fileViolations);
    }

    // Step 6: Process Svelte files with Svelte compiler
    const svelteGlobPath = path.join(projectRoot, 'src/**/*.svelte').replace(/\\/g, '/');
    const svelteFiles = globSync(svelteGlobPath);

    for (const filePath of svelteFiles) {
        const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

        if (isExcludedFile(relativePath, config)) {
            continue;
        }

        const fileViolations = processSvelteFile(filePath, relativePath, enumValueToNames, enumExportStatus, actionValueToConsts, skipCaseClauses, project, allowListLookup);
        violations.push(...fileViolations);
    }

    return violations;
}

/**
 * Build a lookup map from file path to allowed values set
 */
function buildAllowListLookup(allowList: AllowListEntry[]): Map<string, Set<string>> {
    const lookup = new Map<string, Set<string>>();

    for (const entry of allowList) {
        const normalizedPath = entry.file.replace(/\\/g, '/');
        const existing = lookup.get(normalizedPath) || new Set<string>();
        for (const value of entry.values) {
            existing.add(value);
        }
        lookup.set(normalizedPath, existing);
    }

    return lookup;
}

/**
 * Check if a value is allowed in a specific file according to the allowlist
 */
function isAllowedByAllowList(relativePath: string, value: string, allowListLookup: Map<string, Set<string>>): boolean {
    const allowedValues = allowListLookup.get(relativePath);
    return allowedValues ? allowedValues.has(value) : false;
}

/**
 * Process a TypeScript file using ts-morph AST
 */
function processTypeScriptFile(
    file: SourceFile,
    relativePath: string,
    enumValueToNames: Map<string, string[]>,
    enumExportStatus: Map<string, BarrelExportStatus>,
    actionValueToConsts: Map<string, WorkflowActionConst[]>,
    typeValueToConsts: Map<string, TypeDiscriminatorConst[]>,
    skipCaseClauses: boolean,
    allowListLookup: Map<string, Set<string>>
): Violation[] {
    const violations: Violation[] = [];
    const fileContext = detectFileContext(relativePath);

    const stringLiterals = file.getDescendantsOfKind(SyntaxKind.StringLiteral);

    for (const literal of stringLiterals) {
        const value = literal.getLiteralText();

        // Check allowlist first - skip if value is explicitly allowed for this file
        if (isAllowedByAllowList(relativePath, value, allowListLookup)) {
            continue;
        }

        // Check 1: Prisma enum values
        const matchingEnums = enumValueToNames.get(value);
        if (matchingEnums && matchingEnums.length > 0) {
            if (!isAllowedContext(literal, value, matchingEnums, skipCaseClauses)) {
                const violationInfo = generateContextAwareViolation(
                    value,
                    matchingEnums,
                    fileContext,
                    enumExportStatus
                );

                violations.push({
                    rule: 'R13',
                    file: relativePath,
                    reason: violationInfo.reason,
                    suggestion: violationInfo.suggestion,
                    line: literal.getStartLineNumber(),
                    severity: violationInfo.severity
                });
            }
            continue;
        }

        // Check 2: Workflow action discriminators
        const matchingActionConsts = actionValueToConsts.get(value);
        if (matchingActionConsts && matchingActionConsts.length > 0) {
            if (isWorkflowActionContext(literal) && !isActionConstDefinition(literal, relativePath)) {
                const violationInfo = generateWorkflowActionViolation(
                    value,
                    matchingActionConsts,
                    fileContext,
                    relativePath
                );

                violations.push({
                    rule: 'R13',
                    file: relativePath,
                    reason: violationInfo.reason,
                    suggestion: violationInfo.suggestion,
                    line: literal.getStartLineNumber(),
                    severity: violationInfo.severity
                });
            }
            continue;
        }

        // Check 3: Type discriminators (type: 'VALUE', eventType: 'VALUE', etc.)
        const typeContext = isTypeDiscriminatorContext(literal);
        if (typeContext.isTypeDiscriminator && typeContext.propertyName) {
            // Only flag if it looks like a type discriminator value and not in a type annotation
            if (looksLikeTypeDiscriminator(value) && !isTypeConstDefinition(literal) && !isInsideTypeAnnotation(literal)) {
                const matchingTypeConsts = typeValueToConsts.get(value);
                const violationInfo = generateTypeDiscriminatorViolation(
                    value,
                    typeContext.propertyName,
                    matchingTypeConsts,
                    fileContext,
                    relativePath
                );

                violations.push({
                    rule: 'R13',
                    file: relativePath,
                    reason: violationInfo.reason,
                    suggestion: violationInfo.suggestion,
                    line: literal.getStartLineNumber(),
                    severity: violationInfo.severity
                });
            }
            continue;
        }

        // Check 4: Log messages (Phase 4)
        if (isInsideLoggingCall(literal) && looksLikeLogMessage(value)) {
            const violationInfo = generateLogMessageViolation(value, fileContext);

            violations.push({
                rule: 'R13',
                file: relativePath,
                reason: violationInfo.reason,
                suggestion: violationInfo.suggestion,
                line: literal.getStartLineNumber(),
                severity: violationInfo.severity
            });
        }
    }

    return violations;
}

/**
 * Process a Svelte file using Svelte compiler for template + ts-morph for script
 */
function processSvelteFile(
    filePath: string,
    relativePath: string,
    enumValueToNames: Map<string, string[]>,
    enumExportStatus: Map<string, BarrelExportStatus>,
    actionValueToConsts: Map<string, WorkflowActionConst[]>,
    skipCaseClauses: boolean,
    project: Project,
    allowListLookup: Map<string, Set<string>>
): Violation[] {
    const violations: Violation[] = [];
    const fileContext = FileContext.SVELTE_COMPONENT;

    try {
        const content = readFileSync(filePath, 'utf-8');
        const ast = parse(content, { filename: filePath });

        // Process script content with ts-morph for better AST analysis
        if (ast.instance) {
            const scriptContent = content.substring(ast.instance.start, ast.instance.end);
            const scriptStartLine = getLineNumber(content, ast.instance.start);

            // Extract just the script content (between <script> tags)
            const scriptMatch = scriptContent.match(/<script[^>]*>([\s\S]*?)<\/script>/);
            if (scriptMatch && scriptMatch[1] !== undefined) {
                const innerScript = scriptMatch[1];
                const innerScriptStartOffset = scriptContent.indexOf(innerScript);
                const innerScriptStartLine = scriptStartLine + countNewlines(scriptContent.substring(0, innerScriptStartOffset));

                const scriptViolations = processScriptContent(
                    innerScript,
                    relativePath,
                    enumValueToNames,
                    enumExportStatus,
                    actionValueToConsts,
                    skipCaseClauses,
                    innerScriptStartLine,
                    project,
                    fileContext,
                    allowListLookup
                );
                violations.push(...scriptViolations);
            }
        }

        // Process module script (context="module")
        if (ast.module) {
            const moduleContent = content.substring(ast.module.start, ast.module.end);
            const moduleStartLine = getLineNumber(content, ast.module.start);

            const scriptMatch = moduleContent.match(/<script[^>]*>([\s\S]*?)<\/script>/);
            if (scriptMatch && scriptMatch[1] !== undefined) {
                const innerScript = scriptMatch[1];
                const innerScriptStartOffset = moduleContent.indexOf(innerScript);
                const innerScriptStartLine = moduleStartLine + countNewlines(moduleContent.substring(0, innerScriptStartOffset));

                const scriptViolations = processScriptContent(
                    innerScript,
                    relativePath,
                    enumValueToNames,
                    enumExportStatus,
                    actionValueToConsts,
                    skipCaseClauses,
                    innerScriptStartLine,
                    project,
                    fileContext,
                    allowListLookup
                );
                violations.push(...scriptViolations);
            }
        }

        // Process template expressions using Svelte AST
        // Note: Svelte AST uses 'html' property (with 'fragment' as fallback for older versions)
        const templateRoot = ast.html || ast.fragment;
        if (templateRoot) {
            const templateViolations = processSvelteTemplate(
                templateRoot,
                content,
                relativePath,
                enumValueToNames,
                enumExportStatus
            );
            violations.push(...templateViolations);
            
            // Process template for i18n violations (Phase 3)
            const i18nViolations = findI18nViolationsInTemplate(
                templateRoot,
                content,
                relativePath
            );
            violations.push(...i18nViolations);
        }

    } catch (error: any) {
        // If Svelte parsing fails, fall back to regex-based detection
        console.warn(`Warning: Could not parse Svelte file ${relativePath}: ${error.message}`);
        const fallbackViolations = processSvelteFallback(filePath, relativePath, enumValueToNames, enumExportStatus);
        violations.push(...fallbackViolations);
    }

    return violations;
}

/**
 * Process script content extracted from Svelte file using ts-morph
 */
function processScriptContent(
    scriptContent: string,
    relativePath: string,
    enumValueToNames: Map<string, string[]>,
    enumExportStatus: Map<string, BarrelExportStatus>,
    actionValueToConsts: Map<string, WorkflowActionConst[]>,
    skipCaseClauses: boolean,
    startLine: number,
    project: Project,
    fileContext: FileContext,
    allowListLookup: Map<string, Set<string>>
): Violation[] {
    const violations: Violation[] = [];

    try {
        // Create a temporary source file for the script content
        const tempFile = project.createSourceFile(
            `__temp_${Date.now()}.ts`,
            scriptContent,
            { overwrite: true }
        );

        const stringLiterals = tempFile.getDescendantsOfKind(SyntaxKind.StringLiteral);

        for (const literal of stringLiterals) {
            const value = literal.getLiteralText();

            // Check allowlist first
            if (isAllowedByAllowList(relativePath, value, allowListLookup)) {
                continue;
            }

            const matchingEnums = enumValueToNames.get(value);
            if (!matchingEnums || matchingEnums.length === 0) {
                continue;
            }

            if (isAllowedContext(literal, value, matchingEnums, skipCaseClauses)) {
                continue;
            }

            // Adjust line number to account for script position in Svelte file
            const adjustedLine = startLine + literal.getStartLineNumber() - 1;

            const violationInfo = generateContextAwareViolation(
                value,
                matchingEnums,
                fileContext,
                enumExportStatus
            );

            violations.push({
                rule: 'R13',
                file: relativePath,
                reason: violationInfo.reason,
                suggestion: violationInfo.suggestion,
                line: adjustedLine,
                severity: violationInfo.severity
            });
        }

        // Clean up temp file
        project.removeSourceFile(tempFile);

    } catch (error) {
        // Script parsing failed, skip this script block
    }

    return violations;
}

/**
 * Process Svelte template AST to find string literals in expressions
 */
function processSvelteTemplate(
    fragment: any,
    content: string,
    relativePath: string,
    enumValueToNames: Map<string, string[]>,
    enumExportStatus: Map<string, BarrelExportStatus>
): Violation[] {
    const violations: Violation[] = [];

    // Walk the Svelte AST to find expressions with string literals
    walkSvelteAst(fragment, (node: any) => {
        // Check for expressions in various Svelte constructs
        if (node.type === 'MustacheTag' || node.type === 'RawMustacheTag') {
            // {expression} or {@html expression}
            const exprViolations = findStringLiteralsInExpression(
                node.expression,
                content,
                relativePath,
                enumValueToNames,
                enumExportStatus
            );
            violations.push(...exprViolations);
        } else if (node.type === 'IfBlock' || node.type === 'ElseBlock') {
            // {#if expression} or {:else if expression}
            if (node.expression) {
                const exprViolations = findStringLiteralsInExpression(
                    node.expression,
                    content,
                    relativePath,
                    enumValueToNames,
                    enumExportStatus
                );
                violations.push(...exprViolations);
            }
        } else if (node.type === 'EachBlock') {
            // {#each expression as item}
            if (node.expression) {
                const exprViolations = findStringLiteralsInExpression(
                    node.expression,
                    content,
                    relativePath,
                    enumValueToNames,
                    enumExportStatus
                );
                violations.push(...exprViolations);
            }
        } else if (node.type === 'AwaitBlock') {
            // {#await expression}
            if (node.expression) {
                const exprViolations = findStringLiteralsInExpression(
                    node.expression,
                    content,
                    relativePath,
                    enumValueToNames,
                    enumExportStatus
                );
                violations.push(...exprViolations);
            }
        } else if (node.type === 'Attribute' && node.value) {
            // attribute={expression}
            for (const val of node.value) {
                if (val.type === 'MustacheTag' && val.expression) {
                    const exprViolations = findStringLiteralsInExpression(
                        val.expression,
                        content,
                        relativePath,
                        enumValueToNames,
                        enumExportStatus
                    );
                    violations.push(...exprViolations);
                }
            }
        }
    });

    return violations;
}

/**
 * Find string literals in a Svelte expression AST node
 */
function findStringLiteralsInExpression(
    expression: any,
    content: string,
    relativePath: string,
    enumValueToNames: Map<string, string[]>,
    enumExportStatus: Map<string, BarrelExportStatus>
): Violation[] {
    const violations: Violation[] = [];

    walkSvelteAst(expression, (node: any) => {
        if (node.type === 'Literal' && typeof node.value === 'string') {
            const value = node.value;
            const matchingEnums = enumValueToNames.get(value);

            if (matchingEnums && matchingEnums.length > 0) {
                // Check if this is in an allowed template context
                if (!isAllowedTemplateContext(node, expression)) {
                    const line = getLineNumber(content, node.start);
                    const violationInfo = generateContextAwareViolation(
                        value,
                        matchingEnums,
                        FileContext.SVELTE_COMPONENT,
                        enumExportStatus
                    );
                    violations.push({
                        rule: 'R13',
                        file: relativePath,
                        reason: violationInfo.reason,
                        suggestion: violationInfo.suggestion,
                        line,
                        severity: violationInfo.severity
                    });
                }
            }
        }
    });

    return violations;
}

/**
 * Check if a string literal in a Svelte template is in an allowed context
 */
function isAllowedTemplateContext(node: any, rootExpression: any): boolean {
    // In template, we primarily care about comparisons like `status === 'ACTIVE'`
    // which are stringly-typed. But we allow:
    // - CSS classes and styling (handled by UI string check)
    // - Object keys in template expressions

    // For now, we flag all enum values in template expressions
    // The isUIStylingString check in the main flow will filter out CSS-like strings
    return false;
}

/**
 * Walk a Svelte AST node recursively
 */
function walkSvelteAst(node: any, callback: (node: any) => void) {
    if (!node || typeof node !== 'object') return;

    callback(node);

    // Handle arrays
    if (Array.isArray(node)) {
        for (const child of node) {
            walkSvelteAst(child, callback);
        }
        return;
    }

    // Handle common Svelte AST node properties
    const childKeys = ['children', 'body', 'fragment', 'expression', 'consequent', 'alternate',
        'left', 'right', 'test', 'argument', 'arguments', 'elements', 'properties',
        'value', 'key', 'object', 'property', 'callee', 'declarations', 'init'];

    for (const key of childKeys) {
        if (node[key]) {
            walkSvelteAst(node[key], callback);
        }
    }
}

/**
 * Fallback: regex-based string literal detection for Svelte files
 * Used when Svelte parsing fails
 */
function processSvelteFallback(
    filePath: string,
    relativePath: string,
    enumValueToNames: Map<string, string[]>,
    enumExportStatus: Map<string, BarrelExportStatus>
): Violation[] {
    const violations: Violation[] = [];

    try {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        // Simple regex to find string literals
        const stringRegex = /['"]([A-Z][A-Z0-9_]+)['"]/g;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line === undefined) continue;
            let match;

            while ((match = stringRegex.exec(line)) !== null) {
                const value = match[1];
                if (value === undefined) continue;
                const matchingEnums = enumValueToNames.get(value);

                if (matchingEnums && matchingEnums.length > 0) {
                    const violationInfo = generateContextAwareViolation(
                        value,
                        matchingEnums,
                        FileContext.SVELTE_COMPONENT,
                        enumExportStatus
                    );
                    violations.push({
                        rule: 'R13',
                        file: relativePath,
                        reason: violationInfo.reason,
                        suggestion: violationInfo.suggestion,
                        line: i + 1,
                        severity: violationInfo.severity
                    });
                }
            }
        }
    } catch (error) {
        // File read failed, skip
    }

    return violations;
}

/**
 * Get line number from character offset
 */
function getLineNumber(content: string, offset: number): number {
    return content.substring(0, offset).split('\n').length;
}

/**
 * Count newlines in a string
 */
function countNewlines(str: string): number {
    return (str.match(/\n/g) || []).length;
}

/**
 * Parse Prisma schema file to extract enum definitions
 */
function parsePrismaEnums(schemaPath: string): PrismaEnum[] {
    const enums: PrismaEnum[] = [];

    try {
        const content = readFileSync(schemaPath, 'utf-8');
        const lines = content.split('\n');

        let currentEnum: PrismaEnum | null = null;
        let braceDepth = 0;

        for (const line of lines) {
            const trimmed = line.trim();

            // Match enum declaration: "enum EnumName {"
            const enumMatch = trimmed.match(/^enum\s+(\w+)\s*\{?\s*$/);
            if (enumMatch && enumMatch[1]) {
                currentEnum = { name: enumMatch[1], values: [] };
                braceDepth = trimmed.includes('{') ? 1 : 0;
                continue;
            }

            // Track opening brace for enum
            if (currentEnum && braceDepth === 0 && trimmed === '{') {
                braceDepth = 1;
                continue;
            }

            // Inside enum body
            if (currentEnum && braceDepth > 0) {
                // Check for closing brace
                if (trimmed === '}') {
                    enums.push(currentEnum);
                    currentEnum = null;
                    braceDepth = 0;
                    continue;
                }

                // Extract enum value (ignore comments and empty lines)
                if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
                    // Handle inline comments: "VALUE // comment" or "VALUE \ comment"
                    const valueMatch = trimmed.match(/^(\w+)/);
                    if (valueMatch && valueMatch[1]) {
                        currentEnum.values.push(valueMatch[1]);
                    }
                }
            }
        }
    } catch (error) {
        console.warn(`Warning: Could not parse Prisma schema at ${schemaPath}`);
    }

    return enums;
}

/**
 * Build a map from enum value to the enum name(s) it belongs to
 * Some values may appear in multiple enums (e.g., "ACTIVE" in multiple status enums)
 */
function buildEnumValueLookup(enums: PrismaEnum[]): Map<string, string[]> {
    const lookup = new Map<string, string[]>();

    for (const enumDef of enums) {
        for (const value of enumDef.values) {
            const existing = lookup.get(value) || [];
            existing.push(enumDef.name);
            lookup.set(value, existing);
        }
    }

    return lookup;
}

/**
 * Check if this is a client-side file (Svelte components, stores, etc.)
 * These files cannot import from $lib/server and need different fix suggestions
 */
function isClientSideFile(relativePath: string): boolean {
    // Svelte components (except +page.server.ts, +layout.server.ts)
    if (relativePath.endsWith('.svelte')) {
        return true;
    }

    // Client-side stores
    if (relativePath.includes('/stores/') && !relativePath.includes('.server.')) {
        return true;
    }

    // Client-side API modules (not server)
    if (relativePath.startsWith('src/lib/api/') && !relativePath.includes('/server/')) {
        return true;
    }

    return false;
}

/**
 * Check if a file should be excluded from stringly-typed checking
 */
function isExcludedFile(relativePath: string, config: Config): boolean {
    // Generated files
    if (relativePath.includes('/generated/') || relativePath.includes('.generated.')) {
        return true;
    }

    // Schema barrel files (these are the source of truth for re-exports)
    if (relativePath === config.paths.apiBarrel ||
        relativePath === config.paths.workflowBarrel) {
        return true;
    }

    // Test files
    if (relativePath.includes('.test.') ||
        relativePath.includes('.spec.') ||
        relativePath.includes('/__tests__/')) {
        return true;
    }

    // Migration files
    if (relativePath.includes('/migrations/')) {
        return true;
    }

    return false;
}

/**
 * Check if a string literal usage is in an allowed context where magic strings are acceptable
 * @param skipCaseClauses - If true, case clauses (switch cases) are considered allowed contexts
 */
function isAllowedContext(literal: StringLiteral, value: string, matchingEnums: string[], skipCaseClauses: boolean): boolean {
    const parent = literal.getParent();
    if (!parent) return false;

    // 1. Inside object property key (not value) - e.g., { ACTIVE: ... }
    if (parent.getKind() === SyntaxKind.PropertyAssignment) {
        const propAssignment = parent;
        const nameNode = propAssignment.getChildAtIndex(0);
        if (nameNode === literal) {
            return true; // It's the property name, not value
        }
    }

    // 2. Inside import/export statements
    if (isInsideImportOrExport(literal)) {
        return true;
    }

    // 3. Inside type annotations (TypeScript type literals)
    if (isInsideTypeAnnotation(literal)) {
        return true;
    }

    // 4. Inside z.enum() definition in allowed files (already checked at file level)
    if (isInsideZodEnumDefinition(literal)) {
        return true;
    }

    // 5. Inside string template literals (these are complex and may have false positives)
    if (parent.getKind() === SyntaxKind.TemplateSpan) {
        return true;
    }

    // 6. Console.log, logger calls (debugging output)
    if (isInsideLoggingCall(literal)) {
        return true;
    }

    // 7. Error message strings
    if (isInsideErrorMessage(literal)) {
        return true;
    }

    // 8. JSDoc or comments (shouldn't happen for StringLiteral but be safe)
    if (isInsideComment(literal)) {
        return true;
    }

    // 9. Object key in switch case (case 'VALUE':) - optionally allowed (configurable)
    // When skipCaseClauses is false (default), case clauses ARE flagged as violations
    if (skipCaseClauses && parent.getKind() === SyntaxKind.CaseClause) {
        return true;
    }

    // 10. In a Prisma where/data/select clause (these are typed by Prisma)
    if (isInsidePrismaOperation(literal)) {
        return true;
    }

    // 11. Inside schema validation definitions (Zod refinements, etc.)
    if (isInsideSchemaValidation(literal)) {
        return true;
    }

    // 12. Inside Cerbos authorization calls (policy resource names)
    if (isInsideCerbosCall(literal)) {
        return true;
    }

    // 13. URL paths and route definitions
    if (isUrlOrRoutePath(value)) {
        return true;
    }

    // 14. CSS class names, colors, and other UI styling strings
    if (isUIStylingString(value)) {
        return true;
    }

    // 15. Inside object literal definitions that map enum values (e.g., status color maps)
    if (isInsideEnumMap(literal)) {
        return true;
    }

    return false;
}

function isInsideImportOrExport(node: Node): boolean {
    let current: Node | undefined = node;
    while (current) {
        const kind = current.getKind();
        if (kind === SyntaxKind.ImportDeclaration ||
            kind === SyntaxKind.ExportDeclaration ||
            kind === SyntaxKind.ImportSpecifier ||
            kind === SyntaxKind.ExportSpecifier) {
            return true;
        }
        current = current.getParent();
    }
    return false;
}

function isInsideTypeAnnotation(node: Node): boolean {
    let current: Node | undefined = node;
    while (current) {
        const kind = current.getKind();
        if (kind === SyntaxKind.TypeLiteral ||
            kind === SyntaxKind.TypeReference ||
            kind === SyntaxKind.LiteralType ||
            kind === SyntaxKind.UnionType ||
            kind === SyntaxKind.TypeAliasDeclaration) {
            return true;
        }
        current = current.getParent();
    }
    return false;
}

function isInsideZodEnumDefinition(node: Node): boolean {
    // Check if the string is directly inside a z.enum() call
    // Be precise: only match z.enum([...]) or schemaName.enum([...])
    let current: Node | undefined = node;
    let depth = 0;
    const maxDepth = 4; // z.enum(['VALUE']) is only a few levels deep

    while (current && depth < maxDepth) {
        const callExpr = current.asKind(SyntaxKind.CallExpression);
        if (callExpr) {
            const exprText = callExpr.getExpression().getText();

            // Match z.enum or z.nativeEnum patterns
            if (exprText === 'z.enum' || exprText === 'z.nativeEnum') {
                return true;
            }
        }
        current = current.getParent();
        depth++;
    }
    return false;
}

function isInsideLoggingCall(node: Node): boolean {
    // Check if the string is directly inside a logging call
    let current: Node | undefined = node;
    let depth = 0;
    const maxDepth = 6;

    while (current && depth < maxDepth) {
        const callExpr = current.asKind(SyntaxKind.CallExpression);
        if (callExpr) {
            const exprText = callExpr.getExpression().getText();

            if (exprText.startsWith('console.') ||
                exprText.startsWith('log.') ||
                exprText.startsWith('logger.') ||
                exprText.match(/\.info$/) ||
                exprText.match(/\.debug$/) ||
                exprText.match(/\.warn$/) ||
                exprText.match(/\.error$/)) {
                return true;
            }
        }
        current = current.getParent();
        depth++;
    }
    return false;
}

function isInsideErrorMessage(node: Node): boolean {
    // Check if the string is directly inside an error-related call
    // Be more precise: limit depth so we only match strings within the call arguments
    let current: Node | undefined = node;
    let depth = 0;
    const maxDepth = 6; // Don't look too far up the tree

    while (current && depth < maxDepth) {
        const callExpr = current.asKind(SyntaxKind.CallExpression);
        if (callExpr) {
            const exprText = callExpr.getExpression().getText();

            // Check for typed error helpers like errors.NOT_FOUND({ message: '...' })
            if (exprText.match(/^errors\.\w+$/)) {
                return true;
            }
        }
        if (current.getKind() === SyntaxKind.ThrowStatement) {
            return true;
        }
        const newExpr = current.asKind(SyntaxKind.NewExpression);
        if (newExpr) {
            const exprText = newExpr.getExpression().getText();
            if (exprText === 'Error') {
                return true;
            }
        }
        current = current.getParent();
        depth++;
    }
    return false;
}

function isInsideComment(node: Node): boolean {
    // StringLiteral nodes shouldn't be in comments, but check leading/trailing trivia
    const fullText = node.getFullText();
    const text = node.getText();
    const leadingTrivia = fullText.substring(0, fullText.indexOf(text));
    return leadingTrivia.includes('//') || leadingTrivia.includes('/*');
}

function isInsidePrismaOperation(node: Node): boolean {
    // Check if this string is inside a Prisma query object literal (where, data, select, etc.)
    // We need to be precise: only flag strings that are directly in the query arguments,
    // not strings that just happen to be in a function that calls Prisma
    let current: Node | undefined = node;
    let foundObjectLiteral = false;

    while (current) {
        // First, track if we're inside an object literal
        if (current.getKind() === SyntaxKind.ObjectLiteralExpression) {
            foundObjectLiteral = true;
        }

        // Then check if that object literal is a Prisma call argument
        const callExpr = current.asKind(SyntaxKind.CallExpression);
        if (callExpr && foundObjectLiteral) {
            const exprText = callExpr.getExpression().getText();

            // Check for Prisma method chains like prisma.model.operation() or tx.model.operation()
            if (exprText.match(/\b(prisma|tx)\.\w+\.(findUnique|findFirst|findMany|create|update|delete|upsert|createMany|updateMany|deleteMany|aggregate|groupBy|count)\b/)) {
                return true;
            }
        }

        current = current.getParent();
    }
    return false;
}

function isInsideSchemaValidation(node: Node): boolean {
    // Check if the string is directly inside a Zod schema validation call
    let current: Node | undefined = node;
    let depth = 0;
    const maxDepth = 8; // Allow a bit more depth for nested schema definitions

    while (current && depth < maxDepth) {
        const callExpr = current.asKind(SyntaxKind.CallExpression);
        if (callExpr) {
            const exprText = callExpr.getExpression().getText();

            // Check for Zod schema methods
            if (exprText.match(/\.refine$/) ||
                exprText.match(/\.superRefine$/) ||
                exprText.match(/\.transform$/) ||
                exprText.match(/\.default$/) ||
                exprText.match(/\.describe$/)) {
                return true;
            }
        }
        current = current.getParent();
        depth++;
    }
    return false;
}

function isInsideCerbosCall(node: Node): boolean {
    // Check if the string is a DIRECT argument to a Cerbos call (action or resource name)
    // These are typically not Prisma enum values, but we check anyway
    // Note: We intentionally DON'T skip enum values used in expressions that determine
    // Cerbos arguments (like `status === 'SKIPPED' ? 'skip' : 'complete'`) because
    // those comparisons ARE stringly-typed code we want to flag.
    const parent = node.getParent();
    if (!parent) return false;

    // Only skip if this string is a direct argument (not inside an expression)
    const callExpr = parent.asKind(SyntaxKind.CallExpression);
    if (!callExpr) {
        return false;
    }

    const exprText = callExpr.getExpression().getText();

    // Check if parent is a Cerbos call
    if (exprText.match(/\.authorize$/) ||
        exprText.match(/\.checkResource$/) ||
        exprText.match(/\.isAllowed$/) ||
        exprText.includes('cerbos.')) {
        return true;
    }

    return false;
}

function isUrlOrRoutePath(value: string): boolean {
    // URLs and route paths
    return value.startsWith('/') ||
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        value.includes('/app/') ||
        value.includes('/api/');
}

function isUIStylingString(value: string): boolean {
    // Common CSS/UI values that might match enum names
    const uiPatterns = [
        // Color names
        'primary', 'secondary', 'success', 'error', 'warning', 'info',
        // Size names
        'sm', 'md', 'lg', 'xl',
        // Position names
        'top', 'bottom', 'left', 'right', 'center',
        // Display names
        'block', 'inline', 'flex', 'grid', 'none'
    ];
    return uiPatterns.includes(value.toLowerCase());
}

function isInsideEnumMap(node: Node): boolean {
    // Check if this string is a key in an object that looks like an enum-to-value map
    const parent = node.getParent();
    if (!parent) return false;

    // Check if parent is a property assignment and we're the key
    if (parent.getKind() === SyntaxKind.PropertyAssignment) {
        const grandparent = parent.getParent();
        if (grandparent && grandparent.getKind() === SyntaxKind.ObjectLiteralExpression) {
            // Check if this object has multiple properties that look like enum keys
            const siblings = grandparent.getChildrenOfKind(SyntaxKind.PropertyAssignment);
            if (siblings.length >= 2) {
                // Check if all/most keys are SCREAMING_SNAKE_CASE (enum-like)
                let enumLikeKeys = 0;
                for (const sibling of siblings) {
                    const key = sibling.getChildAtIndex(0);
                    if (key) {
                        const keyText = key.getText().replace(/['"]/g, '');
                        if (/^[A-Z][A-Z0-9_]*$/.test(keyText)) {
                            enumLikeKeys++;
                        }
                    }
                }
                // If more than half the keys look like enum values, this is likely an enum map
                if (enumLikeKeys > siblings.length / 2) {
                    return true;
                }
            }
        }
    }

    return false;
}

// =============================================================================
// Context-Aware Detection Functions
// =============================================================================

/**
 * Detect the file context based on the relative path
 */
function detectFileContext(relativePath: string): FileContext {
    // Normalize path separators
    const normalizedPath = relativePath.replace(/\\/g, '/');

    // oRPC route files
    if (normalizedPath.startsWith('src/lib/server/api/routes/') && normalizedPath.endsWith('.ts')) {
        return FileContext.ORPC_ROUTE;
    }

    // Workflow files
    if (normalizedPath.startsWith('src/lib/server/workflows/') && normalizedPath.endsWith('.ts')) {
        return FileContext.WORKFLOW;
    }

    // Server API core files (not routes)
    if (normalizedPath.startsWith('src/lib/server/api/') && normalizedPath.endsWith('.ts')) {
        return FileContext.SERVER_API_CORE;
    }

    // Server hooks
    if (normalizedPath === 'src/hooks.server.ts') {
        return FileContext.SERVER_HOOK;
    }

    // Client hooks
    if (normalizedPath === 'src/hooks.client.ts') {
        return FileContext.CLIENT_HOOK;
    }

    // Page server loads
    if (normalizedPath.startsWith('src/routes/') && normalizedPath.endsWith('.server.ts')) {
        return FileContext.PAGE_SERVER_LOAD;
    }

    // Client API modules
    if (normalizedPath.startsWith('src/lib/api/') && normalizedPath.endsWith('.ts')) {
        return FileContext.CLIENT_API_MODULE;
    }

    // Client stores
    if (normalizedPath.startsWith('src/lib/stores/') && normalizedPath.endsWith('.ts')) {
        return FileContext.CLIENT_STORE;
    }

    // Svelte components
    if (normalizedPath.endsWith('.svelte')) {
        return FileContext.SVELTE_COMPONENT;
    }

    // Other server files
    if (normalizedPath.startsWith('src/lib/server/') && normalizedPath.endsWith('.ts')) {
        return FileContext.SERVER_OTHER;
    }

    return FileContext.UNKNOWN;
}

/**
 * Build a map of enum names to their export status in barrel files
 */
function buildEnumExportStatus(prismaEnums: PrismaEnum[], projectRoot: string): Map<string, BarrelExportStatus> {
    const exportStatus = new Map<string, BarrelExportStatus>();

    // Read barrel file contents
    const apiSchemasPath = path.join(projectRoot, 'src/lib/server/api/schemas.ts');
    const workflowSchemasPath = path.join(projectRoot, 'src/lib/server/workflows/schemas.ts');
    const camTypesPath = path.join(projectRoot, 'src/lib/api/cam.ts');

    const apiSchemasContent = safeReadFile(apiSchemasPath);
    const workflowSchemasContent = safeReadFile(workflowSchemasPath);
    const camTypesContent = safeReadFile(camTypesPath);

    for (const enumDef of prismaEnums) {
        const enumName = enumDef.name;

        // Check for Zod schema export (e.g., "export { OrganizationTypeSchema }")
        const zodSchemaPattern = new RegExp(`export\\s*\\{[^}]*\\b${enumName}Schema\\b[^}]*\\}`, 'm');
        // Check for Prisma enum export (e.g., "export { OrganizationType }")
        const prismaEnumPattern = new RegExp(`export\\s*\\{[^}]*\\b${enumName}\\b[^}]*\\}`, 'm');
        // Check for type export in cam.ts (e.g., "export type OrganizationType =")
        const typeExportPattern = new RegExp(`export\\s+type\\s+${enumName}\\s*=`, 'm');
        // Check for const export in cam.ts (e.g., "export const OrganizationTypeValues =")
        const constExportPattern = new RegExp(`export\\s+const\\s+${enumName}Values\\s*=`, 'm');

        exportStatus.set(enumName, {
            apiSchemas: zodSchemaPattern.test(apiSchemasContent) || prismaEnumPattern.test(apiSchemasContent),
            workflowSchemas: zodSchemaPattern.test(workflowSchemasContent) || prismaEnumPattern.test(workflowSchemasContent),
            camTypes: typeExportPattern.test(camTypesContent) || constExportPattern.test(camTypesContent)
        });
    }

    return exportStatus;
}

/**
 * Safely read a file, returning empty string if it doesn't exist
 */
function safeReadFile(filePath: string): string {
    try {
        if (existsSync(filePath)) {
            return readFileSync(filePath, 'utf-8');
        }
    } catch {
        // Ignore read errors
    }
    return '';
}

/**
 * Generate context-aware violation reason and suggestion
 */
function generateContextAwareViolation(
    value: string,
    matchingEnums: string[],
    fileContext: FileContext,
    enumExportStatus: Map<string, BarrelExportStatus>
): ContextAwareViolation {
    const primaryEnum = matchingEnums[0]!;
    const enumList = matchingEnums.length > 1 ? matchingEnums.join(' or ') : primaryEnum;
    const exportStatus = enumExportStatus.get(primaryEnum) || { apiSchemas: false, workflowSchemas: false, camTypes: false };

    switch (fileContext) {
        case FileContext.ORPC_ROUTE:
            return generateOrpcRouteViolation(value, primaryEnum, enumList, exportStatus);

        case FileContext.WORKFLOW:
            return generateWorkflowViolation(value, primaryEnum, enumList, exportStatus);

        case FileContext.SERVER_API_CORE:
            return generateServerApiCoreViolation(value, primaryEnum, enumList);

        case FileContext.SERVER_OTHER:
        case FileContext.SERVER_HOOK:
            return generateServerOtherViolation(value, primaryEnum, enumList);

        case FileContext.PAGE_SERVER_LOAD:
            return generatePageServerLoadViolation(value, primaryEnum, enumList);

        case FileContext.CLIENT_API_MODULE:
            return generateClientApiModuleViolation(value, primaryEnum, enumList, exportStatus);

        case FileContext.CLIENT_STORE:
            return generateClientStoreViolation(value, primaryEnum, enumList, exportStatus);

        case FileContext.SVELTE_COMPONENT:
            return generateSvelteComponentViolation(value, primaryEnum, enumList, exportStatus);

        case FileContext.CLIENT_HOOK:
            return generateClientHookViolation(value, primaryEnum, enumList, exportStatus);

        default:
            return generateDefaultViolation(value, primaryEnum, enumList);
    }
}

// =============================================================================
// Context-Specific Violation Generators
// =============================================================================

function generateOrpcRouteViolation(
    value: string,
    primaryEnum: string,
    enumList: string,
    exportStatus: BarrelExportStatus
): ContextAwareViolation {
    const reason = `Magic string "${value}" matches Prisma enum \`${enumList}\`. oRPC routes must use Zod schemas from the API barrel file to ensure type safety and auto-sync with Prisma schema changes.`;

    let suggestion: string;
    if (exportStatus.apiSchemas) {
        suggestion = `Import the Zod schema: \`import { ${primaryEnum}Schema } from '../schemas.js'\` and use it in \`.input()\` or for comparisons use \`${primaryEnum}Schema.enum.${value}\`.`;
    } else {
        suggestion = `First, add a re-export to \`src/lib/server/api/schemas.ts\`:\n` +
            `  \`export { ${primaryEnum}Schema } from '../../../../generated/zod/inputTypeSchemas/${primaryEnum}Schema.js'\`\n` +
            `Then import: \`import { ${primaryEnum}Schema } from '../schemas.js'\` and use \`${primaryEnum}Schema.enum.${value}\`.`;
    }

    return { reason, suggestion, severity: 'error' };
}

function generateWorkflowViolation(
    value: string,
    primaryEnum: string,
    enumList: string,
    exportStatus: BarrelExportStatus
): ContextAwareViolation {
    const reason = `Magic string "${value}" matches Prisma enum \`${enumList}\`. Workflows should use typed enums from the workflow schemas barrel for compile-time validation.`;

    let suggestion: string;
    if (exportStatus.workflowSchemas) {
        suggestion = `Import the Prisma enum: \`import { ${primaryEnum} } from './schemas.js'\` and use \`${primaryEnum}.${value}\`. For Zod validation, use \`${primaryEnum}Schema\`.`;
    } else {
        suggestion = `First, add a re-export to \`src/lib/server/workflows/schemas.ts\`:\n` +
            `  \`export { ${primaryEnum} } from '../../../../generated/prisma/enums.js'\`\n` +
            `Then import: \`import { ${primaryEnum} } from './schemas.js'\` and use \`${primaryEnum}.${value}\`.`;
    }

    return { reason, suggestion, severity: 'error' };
}

function generateServerApiCoreViolation(
    value: string,
    primaryEnum: string,
    enumList: string
): ContextAwareViolation {
    const reason = `Magic string "${value}" matches Prisma enum \`${enumList}\`. Server-side API infrastructure should use Prisma enums for type safety.`;

    const suggestion = `Import the Prisma enum: \`import { ${primaryEnum} } from '../../../../generated/prisma/enums.js'\` and use \`${primaryEnum}.${value}\`.`;

    return { reason, suggestion, severity: 'warning' };
}

function generateServerOtherViolation(
    value: string,
    primaryEnum: string,
    enumList: string
): ContextAwareViolation {
    const reason = `Magic string "${value}" matches Prisma enum \`${enumList}\`. Server-side code should use Prisma enums for compile-time type safety.`;

    const suggestion = `Import the Prisma enum: \`import { ${primaryEnum} } from 'generated/prisma/enums.js'\` (adjust relative path as needed) and use \`${primaryEnum}.${value}\`.`;

    return { reason, suggestion, severity: 'warning' };
}

function generatePageServerLoadViolation(
    value: string,
    primaryEnum: string,
    enumList: string
): ContextAwareViolation {
    const reason = `Magic string "${value}" matches Prisma enum \`${enumList}\`. Server load functions should use Prisma enums for DB operations or API-derived types for context objects.`;

    const suggestion = `For DB operations: \`import { ${primaryEnum} } from '$lib/server/...' \` (from generated/prisma/enums.js) and use \`${primaryEnum}.${value}\`.\n` +
        `For API context types: Extract from \`types.generated.ts\` via \`$lib/api/cam.ts\`.`;

    return { reason, suggestion, severity: 'warning' };
}

function generateClientApiModuleViolation(
    value: string,
    primaryEnum: string,
    enumList: string,
    exportStatus: BarrelExportStatus
): ContextAwareViolation {
    const reason = `Magic string "${value}" matches Prisma enum \`${enumList}\`. Client API modules must extract types from \`types.generated.ts\` to maintain type consistency with the API contract.`;

    let suggestion: string;
    if (exportStatus.camTypes) {
        suggestion = `Use the existing type/const from this file or \`cam.ts\`. For runtime comparisons, use a const object like \`${primaryEnum}Values.${value}\`.`;
    } else {
        suggestion = `Extract the enum type from \`types.generated.ts\`:\n` +
            `  \`type ${primaryEnum} = operations['...']['requestBody']['content']['application/json']['{field}']\`\n` +
            `Or create a const object for runtime use:\n` +
            `  \`export const ${primaryEnum}Values = { ${value}: '${value}', ... } as const;\``;
    }

    return { reason, suggestion, severity: 'info' };
}

function generateClientStoreViolation(
    value: string,
    primaryEnum: string,
    enumList: string,
    exportStatus: BarrelExportStatus
): ContextAwareViolation {
    const reason = `Magic string "${value}" matches Prisma enum \`${enumList}\`. Client stores cannot import from \`$lib/server\` or directly from \`types.generated.ts\` (causes memory crash). Use pre-extracted types.`;

    let suggestion: string;
    if (exportStatus.camTypes) {
        suggestion = `Import from \`$lib/api/cam.ts\`: \`import type { ${primaryEnum} } from '$lib/api/cam'\`.\n` +
            `For runtime comparisons: \`import { ${primaryEnum}Values } from '$lib/api/cam'\` and use \`${primaryEnum}Values.${value}\`.`;
    } else {
        suggestion = `First, add the type extraction to \`$lib/api/cam.ts\`:\n` +
            `  \`export type ${primaryEnum} = operations['...']['...']['...'];\`\n` +
            `  \`export const ${primaryEnum}Values = { ${value}: '${value}', ... } as const;\`\n` +
            `Then import: \`import type { ${primaryEnum} } from '$lib/api/cam'\`.`;
    }

    return { reason, suggestion, severity: 'info' };
}

function generateSvelteComponentViolation(
    value: string,
    primaryEnum: string,
    enumList: string,
    exportStatus: BarrelExportStatus
): ContextAwareViolation {
    const reason = `Magic string "${value}" matches Prisma enum \`${enumList}\`. Svelte files cannot import Prisma types or \`types.generated.ts\` directly (causes svelte-check memory crash).`;

    let suggestion: string;
    if (exportStatus.camTypes) {
        suggestion = `Import from \`$lib/api/cam.ts\`: \`import type { ${primaryEnum} } from '$lib/api/cam'\`.\n` +
            `For runtime comparisons in template: \`import { ${primaryEnum}Values } from '$lib/api/cam'\` and use \`${primaryEnum}Values.${value}\`.`;
    } else {
        suggestion = `First, add the type extraction to \`$lib/api/cam.ts\`:\n` +
            `  \`export type ${primaryEnum} = operations['...']['...']['...'];\`\n` +
            `  \`export const ${primaryEnum}Values = { ${value}: '${value}', ... } as const;\`\n` +
            `Then import: \`import type { ${primaryEnum} } from '$lib/api/cam'\` and use \`${primaryEnum}Values.${value}\` for comparisons.`;
    }

    return { reason, suggestion, severity: 'info' };
}

function generateClientHookViolation(
    value: string,
    primaryEnum: string,
    enumList: string,
    exportStatus: BarrelExportStatus
): ContextAwareViolation {
    const reason = `Magic string "${value}" matches Prisma enum \`${enumList}\`. Client hooks cannot import server-side types.`;

    let suggestion: string;
    if (exportStatus.camTypes) {
        suggestion = `Import from \`$lib/api/cam.ts\`: \`import { ${primaryEnum}Values } from '$lib/api/cam'\` and use \`${primaryEnum}Values.${value}\`.`;
    } else {
        suggestion = `Use a const assertion or add the enum to \`$lib/api/cam.ts\`:\n` +
            `  \`export const ${primaryEnum}Values = { ${value}: '${value}', ... } as const;\``;
    }

    return { reason, suggestion, severity: 'info' };
}

function generateDefaultViolation(
    value: string,
    primaryEnum: string,
    enumList: string
): ContextAwareViolation {
    const reason = `Magic string "${value}" matches Prisma enum \`${enumList}\`. Use the appropriate typed import based on file context.`;

    const suggestion = `Server-side: \`import { ${primaryEnum} } from 'generated/prisma/enums.js'\` and use \`${primaryEnum}.${value}\`.\n` +
        `Client-side: Import from \`$lib/api/cam.ts\` or create a const assertion.`;

    return { reason, suggestion, severity: 'warning' };
}

// =============================================================================
// Workflow Action Discriminator Detection
// =============================================================================

/**
 * Scan workflow files for action const objects (e.g., export const XAction = { ... } as const)
 */
function scanWorkflowActionConsts(projectRoot: string, project: Project): WorkflowActionConst[] {
    const actionConsts: WorkflowActionConst[] = [];
    const workflowsPath = path.join(projectRoot, 'src/lib/server/workflows/**/*.ts').replace(/\\/g, '/');
    const workflowFiles = project.addSourceFilesAtPaths(workflowsPath);

    for (const file of workflowFiles) {
        const relativePath = path.relative(projectRoot, file.getFilePath()).replace(/\\/g, '/');

        // Find variable declarations that match the pattern: export const XAction = { ... } as const
        const variableStatements = file.getVariableStatements();

        for (const statement of variableStatements) {
            if (!statement.isExported()) continue;

            for (const declaration of statement.getDeclarations()) {
                const name = declaration.getName();

                // Must end with 'Action' to be considered a workflow action const
                if (!name.endsWith('Action')) continue;

                const initializer = declaration.getInitializer();
                if (!initializer) continue;

                // Check if it's an object literal with 'as const'
                const initText = initializer.getText();
                if (!initText.includes('as const')) continue;

                // Extract values from the object literal
                if (initializer.getKind() === SyntaxKind.AsExpression) {
                    const asExpr = initializer.asKind(SyntaxKind.AsExpression);
                    if (asExpr) {
                        const objLiteral = asExpr.getExpression();
                        if (objLiteral.getKind() === SyntaxKind.ObjectLiteralExpression) {
                            const values = extractObjectLiteralValues(objLiteral);
                            if (values.length > 0) {
                                actionConsts.push({
                                    name,
                                    values,
                                    filePath: relativePath
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    return actionConsts;
}

/**
 * Extract string values from an object literal expression
 */
function extractObjectLiteralValues(objLiteral: Node): string[] {
    const values: string[] = [];

    const properties = objLiteral.getChildrenOfKind(SyntaxKind.PropertyAssignment);
    for (const prop of properties) {
        const initializer = prop.getInitializer();
        if (initializer && initializer.getKind() === SyntaxKind.StringLiteral) {
            const stringLit = initializer.asKind(SyntaxKind.StringLiteral);
            if (stringLit) {
                values.push(stringLit.getLiteralText());
            }
        }
    }

    return values;
}

/**
 * Build lookup: action value -> action const(s) that contain it
 */
function buildActionValueLookup(actionConsts: WorkflowActionConst[]): Map<string, WorkflowActionConst[]> {
    const lookup = new Map<string, WorkflowActionConst[]>();

    for (const actionConst of actionConsts) {
        for (const value of actionConst.values) {
            const existing = lookup.get(value) || [];
            existing.push(actionConst);
            lookup.set(value, existing);
        }
    }

    return lookup;
}

/**
 * Check if a string literal is in a workflow action context (action: 'VALUE' property)
 */
function isWorkflowActionContext(literal: StringLiteral): boolean {
    const parent = literal.getParent();
    if (!parent) return false;

    // Check if parent is a property assignment with name 'action'
    if (parent.getKind() === SyntaxKind.PropertyAssignment) {
        const propAssign = parent.asKind(SyntaxKind.PropertyAssignment);
        if (propAssign) {
            const propName = propAssign.getName();
            if (propName === 'action') {
                return true;
            }
        }
    }

    return false;
}

/**
 * Check if a string literal is part of an action const definition (to avoid flagging the definition itself)
 */
function isActionConstDefinition(literal: StringLiteral, relativePath: string): boolean {
    // Only workflow files can define action consts
    if (!relativePath.includes('workflows/')) return false;

    // Check if we're inside an exported const declaration ending with 'Action'
    let current: Node | undefined = literal.getParent();
    while (current) {
        if (current.getKind() === SyntaxKind.VariableDeclaration) {
            const varDecl = current.asKind(SyntaxKind.VariableDeclaration);
            if (varDecl) {
                const name = varDecl.getName();
                if (name.endsWith('Action')) {
                    // Check if it's exported
                    const statement = varDecl.getVariableStatement();
                    if (statement && statement.isExported()) {
                        return true;
                    }
                }
            }
        }
        current = current.getParent();
    }

    return false;
}

/**
 * Generate violation info for workflow action discriminators
 */
function generateWorkflowActionViolation(
    value: string,
    matchingConsts: WorkflowActionConst[],
    fileContext: FileContext,
    currentFilePath: string
): ContextAwareViolation {
    const primaryConst = matchingConsts[0]!;
    const constList = matchingConsts.length > 1
        ? matchingConsts.map(c => c.name).join(' or ')
        : primaryConst.name;

    const reason = `Workflow action discriminator "${value}" should use the typed const object \`${constList}\` instead of a magic string.`;

    // Calculate relative import path
    const constFilePath = primaryConst.filePath;
    let importPath: string;

    if (currentFilePath.startsWith('src/lib/server/workflows/')) {
        // Same directory - use relative import
        const currentDir = path.dirname(currentFilePath);
        const constDir = path.dirname(constFilePath);
        if (currentDir === constDir) {
            importPath = `./${path.basename(constFilePath, '.ts')}.js`;
        } else {
            const relativePath = path.relative(currentDir, constFilePath).replace(/\\/g, '/').replace(/\.ts$/, '.js');
            importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
        }
    } else if (currentFilePath.startsWith('src/lib/server/api/routes/')) {
        // oRPC route - calculate relative path to workflows
        const currentDir = path.dirname(currentFilePath);
        const relativePath = path.relative(currentDir, constFilePath).replace(/\\/g, '/').replace(/\.ts$/, '.js');
        importPath = relativePath;
    } else {
        // Other files - use full path from src
        importPath = `$lib/server/workflows/${path.basename(constFilePath, '.ts')}.js`;
    }

    const suggestion = `Import and use the const: \`import { ${primaryConst.name} } from '${importPath}'\` and use \`${primaryConst.name}.${value}\`.`;

    // Severity based on context
    let severity: 'error' | 'warning' | 'info';
    if (fileContext === FileContext.ORPC_ROUTE || fileContext === FileContext.WORKFLOW) {
        severity = 'error';
    } else if (fileContext === FileContext.SERVER_API_CORE || fileContext === FileContext.SERVER_OTHER || fileContext === FileContext.SERVER_HOOK) {
        severity = 'warning';
    } else {
        severity = 'info';
    }

    return { reason, suggestion, severity };
}

// =============================================================================
// Type Discriminator Detection (Phase 2)
// =============================================================================

/**
 * Known type discriminator property names and their expected const object locations
 */
const TYPE_DISCRIMINATOR_PROPERTIES = new Set([
    'type',
    'eventType',
    'errorType',
    'status',
    'kind',
    'category'
]);

/**
 * Known type discriminator const objects that should be used
 * Maps property name patterns to suggested const object info
 */
interface TypeDiscriminatorConst {
    name: string;
    values: string[];
    filePath: string;
    propertyNames: string[]; // Which property names this const applies to
}

/**
 * Scan for existing type discriminator const objects in the codebase
 */
function scanTypeDiscriminatorConsts(projectRoot: string, project: Project): TypeDiscriminatorConst[] {
    const consts: TypeDiscriminatorConst[] = [];
    
    // Add known const objects that should be used for type discriminators
    // These are defined based on codebase conventions
    
    // Check if ProcessingErrorType const exists in schemas.ts
    const schemasPath = path.join(projectRoot, 'src/lib/server/workflows/schemas.ts');
    if (existsSync(schemasPath)) {
        const content = safeReadFile(schemasPath);
        
        // Check for ProcessingErrorType const
        if (content.includes('ProcessingErrorType') && content.includes('as const')) {
            const match = content.match(/export const ProcessingErrorType\s*=\s*\{([^}]+)\}\s*as const/);
            if (match && match[1]) {
                const values = extractConstValues(match[1]);
                consts.push({
                    name: 'ProcessingErrorType',
                    values,
                    filePath: 'src/lib/server/workflows/schemas.ts',
                    propertyNames: ['type', 'errorType']
                });
            }
        }
        
        // Check for ActionLogEventType const
        if (content.includes('ActionLogEventType') && content.includes('as const')) {
            const match = content.match(/export const ActionLogEventType\s*=\s*\{([^}]+)\}\s*as const/);
            if (match && match[1]) {
                const values = extractConstValues(match[1]);
                consts.push({
                    name: 'ActionLogEventType',
                    values,
                    filePath: 'src/lib/server/workflows/schemas.ts',
                    propertyNames: ['eventType']
                });
            }
        }
    }
    
    return consts;
}

/**
 * Extract values from a const object definition string
 */
function extractConstValues(constBody: string): string[] {
    const values: string[] = [];
    const regex = /['"]([A-Z_]+)['"]/g;
    let match;
    while ((match = regex.exec(constBody)) !== null) {
        if (match[1]) {
            values.push(match[1]);
        }
    }
    return values;
}

/**
 * Build lookup: type value -> const(s) that contain it
 */
function buildTypeValueLookup(typeConsts: TypeDiscriminatorConst[]): Map<string, TypeDiscriminatorConst[]> {
    const lookup = new Map<string, TypeDiscriminatorConst[]>();
    
    for (const typeConst of typeConsts) {
        for (const value of typeConst.values) {
            const existing = lookup.get(value) || [];
            existing.push(typeConst);
            lookup.set(value, existing);
        }
    }
    
    return lookup;
}

/**
 * Check if a string literal is in a type discriminator context (type: 'VALUE', eventType: 'VALUE', etc.)
 */
function isTypeDiscriminatorContext(literal: StringLiteral): { isTypeDiscriminator: boolean; propertyName: string | null } {
    const parent = literal.getParent();
    if (!parent) return { isTypeDiscriminator: false, propertyName: null };

    // Check if parent is a property assignment with a type discriminator property name
    if (parent.getKind() === SyntaxKind.PropertyAssignment) {
        const propAssign = parent.asKind(SyntaxKind.PropertyAssignment);
        if (propAssign) {
            const propName = propAssign.getName();
            if (TYPE_DISCRIMINATOR_PROPERTIES.has(propName)) {
                return { isTypeDiscriminator: true, propertyName: propName };
            }
        }
    }

    return { isTypeDiscriminator: false, propertyName: null };
}

/**
 * Check if a string value looks like a type discriminator (SCREAMING_SNAKE_CASE or snake_case)
 */
function looksLikeTypeDiscriminator(value: string): boolean {
    // SCREAMING_SNAKE_CASE: PERMANENT, TRANSIENT, NETWORK_ERROR
    if (/^[A-Z][A-Z0-9_]*$/.test(value)) {
        return true;
    }
    // snake_case for event types: status_change, created, completed
    if (/^[a-z][a-z0-9_]*$/.test(value) && value.length > 2) {
        return true;
    }
    return false;
}

/**
 * Check if a string literal is part of a type const definition (to avoid flagging the definition itself)
 */
function isTypeConstDefinition(literal: StringLiteral): boolean {
    // Check if we're inside an exported const declaration ending with 'Type'
    let current: Node | undefined = literal.getParent();
    while (current) {
        if (current.getKind() === SyntaxKind.VariableDeclaration) {
            const varDecl = current.asKind(SyntaxKind.VariableDeclaration);
            if (varDecl) {
                const name = varDecl.getName();
                if (name.endsWith('Type') || name.endsWith('Status') || name.endsWith('Kind')) {
                    // Check if it's exported and has 'as const'
                    const statement = varDecl.getVariableStatement();
                    if (statement && statement.isExported()) {
                        const initializer = varDecl.getInitializer();
                        if (initializer && initializer.getText().includes('as const')) {
                            return true;
                        }
                    }
                }
            }
        }
        current = current.getParent();
    }

    return false;
}


/**
 * Generate violation info for type discriminators
 */
function generateTypeDiscriminatorViolation(
    value: string,
    propertyName: string,
    matchingConsts: TypeDiscriminatorConst[] | undefined,
    fileContext: FileContext,
    currentFilePath: string
): ContextAwareViolation {
    let reason: string;
    let suggestion: string;
    
    if (matchingConsts && matchingConsts.length > 0) {
        // There's an existing const object that should be used
        const primaryConst = matchingConsts[0]!;
        const constList = matchingConsts.length > 1
            ? matchingConsts.map(c => c.name).join(' or ')
            : primaryConst.name;
        
        reason = `Type discriminator "${value}" in \`${propertyName}:\` should use the typed const object \`${constList}\` instead of a magic string.`;
        
        // Calculate import path
        const constFilePath = primaryConst.filePath;
        let importPath: string;
        
        if (currentFilePath.startsWith('src/lib/server/workflows/')) {
            const currentDir = path.dirname(currentFilePath);
            const constDir = path.dirname(constFilePath);
            if (currentDir === constDir) {
                importPath = `./${path.basename(constFilePath, '.ts')}.js`;
            } else {
                const relativePath = path.relative(currentDir, constFilePath).replace(/\\/g, '/').replace(/\.ts$/, '.js');
                importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
            }
        } else if (currentFilePath.startsWith('src/lib/server/api/routes/')) {
            const currentDir = path.dirname(currentFilePath);
            const relativePath = path.relative(currentDir, constFilePath).replace(/\\/g, '/').replace(/\.ts$/, '.js');
            importPath = relativePath;
        } else {
            importPath = `$lib/server/workflows/${path.basename(constFilePath, '.ts')}.js`;
        }
        
        suggestion = `Import and use the const: \`import { ${primaryConst.name} } from '${importPath}'\` and use \`${primaryConst.name}.${value}\`.`;
    } else {
        // No existing const - suggest creating one
        const suggestedConstName = deriveConstName(propertyName, value);
        
        reason = `Type discriminator "${value}" in \`${propertyName}:\` is a magic string. Consider defining a typed const object for type safety.`;
        
        suggestion = `Create a const object in \`src/lib/server/workflows/schemas.ts\`:\n` +
            `  \`export const ${suggestedConstName} = { ${value}: '${value}', ... } as const;\`\n` +
            `Then import and use \`${suggestedConstName}.${value}\`.`;
    }
    
    // Severity based on context
    let severity: 'error' | 'warning' | 'info';
    if (fileContext === FileContext.WORKFLOW) {
        severity = 'error';
    } else if (fileContext === FileContext.ORPC_ROUTE || fileContext === FileContext.SERVER_API_CORE || fileContext === FileContext.SERVER_OTHER) {
        severity = 'warning';
    } else {
        severity = 'info';
    }
    
    return { reason, suggestion, severity };
}

/**
 * Derive a const name from the property name and value
 */
function deriveConstName(propertyName: string, value: string): string {
    // eventType -> EventType, type -> Type, errorType -> ErrorType
    const baseName = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
    
    // Try to infer domain from value
    if (value.includes('ERROR') || value === 'TRANSIENT' || value === 'PERMANENT') {
        return 'ProcessingErrorType';
    }
    if (value === 'created' || value === 'status_change' || value === 'completed' || value === 'blocked') {
        return 'ActionLogEventType';
    }
    
    return baseName;
}

// =============================================================================
// UI Label Detection for i18n (Phase 3)
// =============================================================================

/**
 * Attribute names that typically contain user-facing text
 */
const I18N_ATTRIBUTE_NAMES = new Set([
    'placeholder',
    'title',
    'aria-label',
    'aria-description',
    'alt'
]);

/**
 * Check if a string looks like a user-facing label (not a technical value)
 */
function looksLikeUserFacingText(value: string): boolean {
    // Must be at least 5 characters
    if (value.length < 5) return false;
    
    // Must contain at least one space (multi-word phrase)
    if (!value.includes(' ')) return false;
    
    // Must start with a capital letter or be a question/instruction
    if (!/^[A-Z]/.test(value) && !value.endsWith('?') && !value.endsWith('...')) return false;
    
    // Skip if it looks like a technical identifier
    if (/^[A-Z_]+$/.test(value)) return false; // SCREAMING_SNAKE_CASE
    if (/^[a-z]+[A-Z]/.test(value)) return false; // camelCase
    if (value.includes('_')) return false; // snake_case
    if (value.startsWith('$')) return false; // variables
    if (value.startsWith('http')) return false; // URLs
    if (/^\d/.test(value)) return false; // starts with number
    
    // Skip CSS classes and technical strings
    if (value.includes('px') || value.includes('rem') || value.includes('em')) return false;
    if (value.includes('rgb') || value.includes('#')) return false;
    
    // Must look like natural language (has lowercase letters)
    if (!/[a-z]/.test(value)) return false;
    
    return true;
}

/**
 * Check if a Svelte template attribute contains a user-facing string
 */
function isI18nAttribute(attrName: string): boolean {
    return I18N_ATTRIBUTE_NAMES.has(attrName.toLowerCase());
}

/**
 * Generate violation info for UI labels that should be internationalized
 */
function generateI18nViolation(
    value: string,
    context: 'attribute' | 'text' | 'script',
    attrName?: string
): ContextAwareViolation {
    let reason: string;
    let suggestion: string;
    
    if (context === 'attribute' && attrName) {
        reason = `User-facing text "${truncateString(value, 40)}" in \`${attrName}\` attribute should be extracted for internationalization (i18n).`;
        suggestion = `Extract to a messages file:\n` +
            `  1. Add to \`$lib/i18n/messages.ts\`: \`export const messages = { ${camelCase(value.substring(0, 20))}: '${value}', ... };\`\n` +
            `  2. Import and use: \`${attrName}={messages.${camelCase(value.substring(0, 20))}}\``;
    } else if (context === 'text') {
        reason = `User-facing text "${truncateString(value, 40)}" should be extracted for internationalization (i18n).`;
        suggestion = `Extract to a messages file:\n` +
            `  1. Add to \`$lib/i18n/messages.ts\`: \`export const messages = { ${camelCase(value.substring(0, 20))}: '${value}', ... };\`\n` +
            `  2. Import and use: \`{messages.${camelCase(value.substring(0, 20))}}\``;
    } else {
        reason = `User-facing text "${truncateString(value, 40)}" in script should be extracted for internationalization (i18n).`;
        suggestion = `Extract to a messages file and import for use in the component.`;
    }
    
    return { reason, suggestion, severity: 'info' };
}

/**
 * Truncate a string for display in error messages
 */
function truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Convert a string to camelCase for use as a message key
 */
function camelCase(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+(.)/g, (_, char) => char.toUpperCase())
        .replace(/^./, char => char.toLowerCase())
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 30);
}

/**
 * Process Svelte template for i18n violations
 * Note: Svelte AST uses 'html' with 'children', element type is 'Element' or 'InlineComponent'
 */
function findI18nViolationsInTemplate(
    htmlNode: any,
    content: string,
    relativePath: string
): Violation[] {
    const violations: Violation[] = [];
    
    function walkNode(node: any): void {
        if (!node) return;
        
        // Check attributes on elements (Svelte AST uses 'Element' type)
        if ((node.type === 'Element' || node.type === 'InlineComponent') && node.attributes) {
            for (const attr of node.attributes) {
                if (attr.type === 'Attribute' && attr.value) {
                    const attrName = attr.name;
                    
                    // Check if this is an i18n-relevant attribute
                    if (isI18nAttribute(attrName)) {
                        // Get the attribute value - can be array or single value
                        const valueNodes = Array.isArray(attr.value) ? attr.value : [attr.value];
                        for (const valueNode of valueNodes) {
                            if (valueNode.type === 'Text' && valueNode.data) {
                                const text = valueNode.data.trim();
                                if (text && looksLikeUserFacingText(text)) {
                                    const line = getLineNumber(content, valueNode.start);
                                    const violationInfo = generateI18nViolation(text, 'attribute', attrName);
                                    
                                    violations.push({
                                        rule: 'R13',
                                        file: relativePath,
                                        reason: violationInfo.reason,
                                        suggestion: violationInfo.suggestion,
                                        line,
                                        severity: violationInfo.severity
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Check text content in elements (headings, buttons, labels, etc.)
        if (node.type === 'Text' && node.data) {
            const text = node.data.trim();
            // Only flag substantial text that looks like a label
            if (text && looksLikeUserFacingText(text)) {
                const line = getLineNumber(content, node.start);
                const violationInfo = generateI18nViolation(text, 'text');
                
                violations.push({
                    rule: 'R13',
                    file: relativePath,
                    reason: violationInfo.reason,
                    suggestion: violationInfo.suggestion,
                    line,
                    severity: violationInfo.severity
                });
            }
        }
        
        // Recurse into children (Svelte AST uses 'children' array)
        if (node.children) {
            for (const child of node.children) {
                walkNode(child);
            }
        }
        // Also check 'else' branches in if blocks
        if (node.else) {
            walkNode(node.else);
        }
        // Check 'then' and 'catch' in await blocks
        if (node.then) {
            walkNode(node.then);
        }
        if (node.catch) {
            walkNode(node.catch);
        }
        // Check 'pending' in await blocks
        if (node.pending) {
            walkNode(node.pending);
        }
    }
    
    walkNode(htmlNode);
    return violations;
}

// =============================================================================
// Log Message Detection (Phase 4)
// =============================================================================

/**
 * Logging function names to detect
 */
const LOG_FUNCTION_NAMES = new Set([
    'log', 'warn', 'error', 'info', 'debug', 'trace'
]);

/**
 * Objects that have logging methods
 */
const LOG_OBJECT_NAMES = new Set([
    'console', 'logger', 'log'
]);


/**
 * Check if a string looks like a log message (not a technical identifier)
 */
function looksLikeLogMessage(value: string): boolean {
    // Must be at least 10 characters (meaningful message)
    if (value.length < 10) return false;
    
    // Must contain spaces (sentence-like)
    if (!value.includes(' ')) return false;
    
    // Skip if it looks like a technical identifier
    if (/^[A-Z_]+$/.test(value)) return false; // SCREAMING_SNAKE_CASE
    if (value.includes('${')) return false; // Template literal (already dynamic)
    
    // Must have lowercase letters (natural language)
    if (!/[a-z]/.test(value)) return false;
    
    return true;
}

/**
 * Generate violation info for log messages
 */
function generateLogMessageViolation(
    value: string,
    fileContext: FileContext
): ContextAwareViolation {
    const truncated = truncateString(value, 50);
    
    const reason = `Log message "${truncated}" should use structured logging with a message key for observability and potential i18n.`;
    
    const suggestion = `Consider using structured logging:\n` +
        `  \`logger.info({ event: 'some_event_key', ...context })\`\n` +
        `Or extract to a log messages constant for consistency.`;
    
    // Log messages are lowest priority - always info
    return { reason, suggestion, severity: 'info' };
}
