import { type Config, getAbsolutePath } from '../config/index.js';
import type { Violation } from '../reporting/index.ts';
import path from 'node:path';
import fs from 'node:fs';
import { glob } from 'glob';
import { parse } from 'svelte/compiler';
import { Project, SyntaxKind } from 'ts-morph';

/**
 * R14: Svelte Reactivity Safety
 *
 * This check enforces safe patterns for accessing server data in Svelte 5 components.
 * 
 * The Problem:
 * When accessing `data.property` in Svelte components, if `data` is undefined
 * during navigation transitions, Svelte's proxy system throws:
 * "right-hand side of 'in' should be an object, got undefined"
 *
 * The Fix:
 * Use null-safe access with defaults: data?.property ?? defaultValue
 * Or guard with: if (data) { ... }
 *
 * This check detects unsafe patterns in:
 * - $derived(data.property) - reactive derived values
 * - $effect(() => { data.property }) - reactive effects
 * - $state(data.property) - state initializers
 * - Template expressions {data.property} - markup bindings
 * - Any direct data.property access in reactive contexts
 */

// Patterns that indicate a reactive context where data access is unsafe
const REACTIVE_CONTEXTS = ['$derived', '$effect', '$state', 'untrack'];

export async function verifySvelteReactivity(config: Config): Promise<Violation[]> {
    const violations: Violation[] = [];
    const projectRoot = getAbsolutePath(config.projectRoot, '.');

    // Find all +page.svelte and +layout.svelte files
    const svelteGlob = path.join(projectRoot, 'src/routes/**/*.svelte').replace(/\\/g, '/');
    const files = await glob(svelteGlob);

    for (const filePath of files) {
        const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
        
        // Check +page.svelte and +layout.svelte files (they receive data from server)
        if (!relativePath.endsWith('+page.svelte') && !relativePath.endsWith('+layout.svelte')) {
            continue;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const fileViolations = analyzeWithAST(content, relativePath);
            violations.push(...fileViolations);
            
            // Also check template for unsafe data access
            const templateViolations = analyzeTemplate(content, relativePath);
            violations.push(...templateViolations);
        } catch {
            // Fall back to regex if AST parsing fails
            const content = fs.readFileSync(filePath, 'utf-8');
            const fileViolations = analyzeWithRegex(content, relativePath);
            violations.push(...fileViolations);
        }
    }

    return violations;
}

/**
 * AST-based analysis for accurate detection in script blocks
 */
function analyzeWithAST(content: string, relativePath: string): Violation[] {
    const violations: Violation[] = [];
    
    // Parse Svelte file to get script content
    let scriptContent: string;
    let scriptStartLine: number;
    
    try {
        const ast = parse(content, { modern: true });
        const scriptNode = ast.instance;
        
        if (!scriptNode) {
            return []; // No script block
        }
        
        scriptContent = content.slice(scriptNode.start, scriptNode.end);
        // Extract just the content between <script> tags
        const scriptMatch = /<script[^>]*>([\s\S]*?)<\/script>/.exec(scriptContent);
        if (!scriptMatch || !scriptMatch[1]) {
            return [];
        }
        scriptContent = scriptMatch[1];
        
        // Calculate the line offset for the script block
        const beforeScript = content.slice(0, scriptNode.start);
        scriptStartLine = beforeScript.split('\n').length;
    } catch {
        // If Svelte parsing fails, try to extract script manually
        const scriptMatch = /<script[^>]*>([\s\S]*?)<\/script>/.exec(content);
        if (!scriptMatch || !scriptMatch[1]) {
            return [];
        }
        scriptContent = scriptMatch[1];
        const beforeScript = content.slice(0, scriptMatch.index || 0);
        scriptStartLine = beforeScript.split('\n').length;
    }

    // Create a ts-morph project to parse the TypeScript
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('temp.ts', scriptContent);

    // Find all call expressions for reactive functions
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    
    for (const call of callExpressions) {
        const expression = call.getExpression();
        const funcName = expression.getText();
        
        // Check if this is a reactive context
        if (!REACTIVE_CONTEXTS.includes(funcName)) {
            continue;
        }

        const args = call.getArguments();
        if (args.length === 0) continue;

        const arg = args[0];
        if (!arg) continue;
        const argText = arg.getText();

        // Check if the argument accesses 'data' without optional chaining
        if (hasUnsafeDataAccess(arg)) {
            const lineInScript = arg.getStartLineNumber();
            const actualLine = scriptStartLine + lineInScript - 1;

            const suggestion = funcName === '$effect' 
                ? `Add guard: \`if (!data) return;\` at start of effect`
                : `Use null-safe access: \`${funcName}(${convertToSafeAccess(argText)})\``;

            violations.push({
                rule: 'R14',
                file: relativePath,
                reason: `Unsafe ${funcName} usage: \`${funcName}(${truncate(argText, 50)})\` may crash during navigation transitions.`,
                suggestion,
                line: actualLine,
                severity: 'warning'
            });
        }
    }

    return violations;
}

/**
 * Analyze template section for unsafe data access in expressions
 */
function analyzeTemplate(content: string, relativePath: string): Violation[] {
    const violations: Violation[] = [];
    
    // Find the template section (after </script>)
    const scriptEndMatch = /<\/script>/gi;
    let lastScriptEnd = 0;
    let match;
    while ((match = scriptEndMatch.exec(content)) !== null) {
        lastScriptEnd = match.index + match[0].length;
    }
    
    if (lastScriptEnd === 0) return violations;
    
    const templateContent = content.slice(lastScriptEnd);
    const templateStartLine = content.slice(0, lastScriptEnd).split('\n').length;
    
    // Find template expressions like {data.property} or {data.property.nested}
    // But not {data?.property} which is safe
    const unsafeExprPattern = /\{([^}]*\bdata\.(?!\?)[^}]*)\}/g;
    const lines = templateContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        
        let exprMatch;
        unsafeExprPattern.lastIndex = 0;
        while ((exprMatch = unsafeExprPattern.exec(line)) !== null) {
            const expr = exprMatch[1] ?? '';
            if (!expr) continue;
            // Skip if it's already using optional chaining for data
            if (/\bdata\?\./.test(expr)) continue;
            // Skip if it's in a conditional that checks data first
            if (/\bdata\s*&&/.test(expr) || /\bdata\s*\?/.test(expr)) continue;
            
            violations.push({
                rule: 'R14',
                file: relativePath,
                reason: `Unsafe template expression: \`{${truncate(expr, 40)}}\` may crash during navigation transitions.`,
                suggestion: `Use null-safe access: \`{${convertToSafeAccess(expr)}}\` or wrap in {#if data}`,
                line: templateStartLine + i,
                severity: 'warning'
            });
        }
    }
    
    return violations;
}

/**
 * Truncate string for display
 */
function truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen - 3) + '...';
}

/**
 * Check if an expression has unsafe data access (data.property without ?.)
 */
function hasUnsafeDataAccess(node: any): boolean {
    const text = node.getText();
    
    // Quick check: does it reference 'data' at all?
    if (!text.includes('data')) {
        return false;
    }

    // Check for unsafe patterns: data.property without optional chaining
    // Safe patterns: data?.property, data?.property?.nested
    // Unsafe patterns: data.property, data.property.nested
    
    // Use regex to find all occurrences of data followed by . or ?.
    // We need to check if ANY access to data uses . instead of ?.
    
    // Match "data." that is NOT followed by "?" (unsafe)
    // But exclude "data?." which is safe
    const unsafePattern = /\bdata\.(?!\?)/;
    const safePattern = /\bdata\?\./;
    
    // If there's a safe pattern and no unsafe pattern, it's safe
    if (safePattern.test(text) && !unsafePattern.test(text)) {
        return false;
    }
    
    // If there's an unsafe pattern, it's unsafe
    if (unsafePattern.test(text)) {
        return true;
    }

    // Also check via AST for more complex cases
    const propertyAccesses = node.getDescendantsOfKind?.(SyntaxKind.PropertyAccessExpression) || [];
    
    for (const access of propertyAccesses) {
        const expr = access.getExpression();
        const exprText = expr.getText();
        
        // Check if this is accessing 'data' directly without optional chaining
        if (exprText === 'data') {
            // Check if it's using optional chaining
            const questionDotToken = access.getQuestionDotToken?.();
            if (!questionDotToken) {
                return true; // Unsafe: data.property without ?.
            }
        }
    }

    return false;
}

/**
 * Fallback regex-based analysis
 */
function analyzeWithRegex(content: string, relativePath: string): Violation[] {
    const violations: Violation[] = [];
    const lines = content.split('\n');

    const UNSAFE_PATTERN = /\$derived\s*\(\s*data\.(?!\?)/;
    const SAFE_PATTERN = /\$derived\s*\(\s*data\?\./;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const lineNumber = i + 1;

        if (!line.includes('$derived')) continue;
        if (SAFE_PATTERN.test(line)) continue;

        if (UNSAFE_PATTERN.test(line)) {
            const expressionMatch = /\$derived\s*\(\s*([^)]+)\)/.exec(line);
            const expression = expressionMatch?.[1] ?? 'data.property';

            violations.push({
                rule: 'R14',
                file: relativePath,
                reason: `Unsafe $derived usage: \`$derived(${expression})\` may crash during navigation transitions.`,
                suggestion: `Use null-safe access: \`$derived(${convertToSafeAccess(expression)})\``,
                line: lineNumber,
                severity: 'warning'
            });
        }
    }

    return violations;
}

/**
 * Convert an unsafe expression to a safe one with null-coalescing
 * e.g., "data.items" -> "data?.items ?? []"
 * e.g., "data.filters.status" -> "data?.filters?.status ?? ''"
 */
function convertToSafeAccess(expression: string): string {
    // Split by . to handle each part
    const parts = expression.split('.');
    
    // Build safe expression: data?.property?.nested
    let safe = parts[0]; // 'data'
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        // Skip if part already has ?. or is empty
        if (part && !part.startsWith('?')) {
            safe += `?.${part}`;
        } else if (part) {
            safe += `.${part}`;
        }
    }

    // Determine appropriate default value based on common patterns
    let defaultValue = 'null';
    if (expression.includes('items') || expression.includes('List') || 
        expression.includes('members') || expression.includes('documents') ||
        expression.includes('cases') || expression.includes('events') ||
        expression.includes('Changes') || expression.includes('history') ||
        expression.includes('Orders') || expression.includes('associations') ||
        expression.includes('properties') || expression.includes('Bindings') ||
        expression.includes('Templates') || expression.includes('Members')) {
        defaultValue = '[]';
    } else if (expression.includes('Filter') || expression.includes('filter') ||
               expression.includes('search') || expression.includes('query') ||
               expression.includes('status') || expression.includes('role')) {
        defaultValue = "''";
    } else if (expression.includes('hasMore') || expression.includes('isAdmin') ||
               expression.includes('isPlatform') || expression.includes('assigned')) {
        defaultValue = 'false';
    }

    return `${safe} ?? ${defaultValue}`;
}
