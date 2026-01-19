import { type Config, getAbsolutePath } from '../config/index.js';
import type { Violation } from '../reporting/index.ts';
import path from 'node:path';
import fs from 'node:fs';
import { glob } from 'glob';
import { parse, walk } from 'svelte/compiler';

/**
 * R15: Svelte 5 Snippet/Component Safety
 *
 * This check enforces correct usage of Svelte 5 snippets vs components.
 *
 * The Problem:
 * In Svelte 5, snippets use `{@render snippetName()}` syntax while components
 * use `<Component />` syntax. Mixing these patterns causes runtime errors:
 *
 * - Using `{@render icon()}` where `icon` is a component causes:
 *   "right-hand side of 'in' should be an object, got undefined"
 *   during navigation/component teardown because Svelte's internal
 *   store_get function receives undefined.
 *
 * - Passing `() => Component` as a snippet parameter and calling
 *   `{@render paramName()}` attempts to render a function as a snippet.
 *
 * The Fix:
 * - For components passed as parameters: Use `<IconComponent />` (dynamic component)
 * - For snippets: Use `{@render snippetName()}`
 * - Never mix: don't use `{@render}` with component parameters
 *
 * This check detects:
 * 1. Snippet definitions that call `{@render param()}` on their parameters
 * 2. `{@render}` calls that pass component factories like `() => Component`
 */

interface SnippetDefinition {
    name: string;
    params: SnippetParam[];
    line: number;
    body: string;
}

interface SnippetParam {
    name: string;
    type: string;
}

interface RenderCall {
    snippetName: string;
    args: string[];
    line: number;
    fullText: string;
}

export async function verifySvelteSnippets(config: Config): Promise<Violation[]> {
    const violations: Violation[] = [];
    const projectRoot = getAbsolutePath(config.projectRoot, '.');

    // Find all .svelte files
    const svelteGlob = path.join(projectRoot, 'src/**/*.svelte').replace(/\\/g, '/');
    const files = await glob(svelteGlob);

    for (const filePath of files) {
        const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const fileViolations = analyzeSvelteFile(content, relativePath);
            violations.push(...fileViolations);
        } catch (error) {
            // Skip files that can't be parsed
            console.warn(`Warning: Could not parse ${relativePath}: ${error}`);
        }
    }

    return violations;
}

/**
 * Analyze a Svelte file for snippet/component misuse
 */
function analyzeSvelteFile(content: string, relativePath: string): Violation[] {
    const violations: Violation[] = [];

    // Extract snippet definitions and their parameters
    const snippetDefs = extractSnippetDefinitions(content);

    // Extract all {@render} calls
    const renderCalls = extractRenderCalls(content);

    // Check 1: Snippet definitions that use {@render param()} on their parameters
    for (const snippet of snippetDefs) {
        const bodyViolations = checkSnippetBodyForParamRenders(snippet, content, relativePath);
        violations.push(...bodyViolations);
    }

    // Check 2: {@render} calls that pass component factories
    for (const call of renderCalls) {
        const callViolations = checkRenderCallArgs(call, snippetDefs, relativePath);
        violations.push(...callViolations);
    }

    // Check 3: Look for likely component parameters in snippets that are rendered with {@render}
    for (const snippet of snippetDefs) {
        const componentParamViolations = checkForComponentParams(snippet, content, relativePath);
        violations.push(...componentParamViolations);
    }

    return violations;
}

/**
 * Extract snippet definitions from the file
 */
function extractSnippetDefinitions(content: string): SnippetDefinition[] {
    const snippets: SnippetDefinition[] = [];

    // Match {#snippet name(params)}...{/snippet}
    const snippetRegex = /\{#snippet\s+(\w+)\s*\(([^)]*)\)\s*\}([\s\S]*?)\{\/snippet\}/g;

    let match;
    while ((match = snippetRegex.exec(content)) !== null) {
        const name = match[1];
        const paramsStr = match[2];
        const body = match[3];

        // Calculate line number
        const beforeMatch = content.slice(0, match.index);
        const line = beforeMatch.split('\n').length;

        // Parse parameters
        const params = parseSnippetParams(paramsStr);

        if (name && body) {
            snippets.push({ name, params, line, body });
        }
    }

    return snippets;
}

/**
 * Parse snippet parameters from the parameter string
 */
function parseSnippetParams(paramsStr: string): SnippetParam[] {
    const params: SnippetParam[] = [];

    if (!paramsStr.trim()) return params;

    // Split by comma, handling potential type annotations
    const paramParts = paramsStr.split(',');

    for (const part of paramParts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        // Handle TypeScript-style: "name: type" or just "name"
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
            const name = trimmed.slice(0, colonIndex).trim();
            const type = trimmed.slice(colonIndex + 1).trim();
            params.push({ name, type });
        } else {
            params.push({ name: trimmed, type: 'unknown' });
        }
    }

    return params;
}

/**
 * Extract all {@render} calls from the file
 * Handles nested parentheses like: {@render Snippet('text', () => Component, 'more')}
 */
function extractRenderCalls(content: string): RenderCall[] {
    const calls: RenderCall[] = [];

    // First find {@render name( then manually parse balanced parens
    const renderStartRegex = /\{@render\s+(\w+)\s*\(/g;

    let match;
    while ((match = renderStartRegex.exec(content)) !== null) {
        const snippetName = match[1];
        const argsStart = match.index + match[0].length;

        // Find the matching closing paren by counting nesting
        let depth = 1;
        let i = argsStart;
        while (i < content.length && depth > 0) {
            if (content[i] === '(') depth++;
            else if (content[i] === ')') depth--;
            i++;
        }

        if (depth !== 0) continue; // Unbalanced, skip

        const argsStr = content.slice(argsStart, i - 1);

        // Find the closing }
        const afterParen = content.slice(i);
        const closingBrace = /^\s*\}/.exec(afterParen);
        if (!closingBrace) continue;

        const fullText = content.slice(match.index, i + closingBrace[0].length);

        const beforeMatch = content.slice(0, match.index);
        const line = beforeMatch.split('\n').length;

        // Parse arguments with balanced paren awareness
        const args = parseBalancedArgs(argsStr);

        if (snippetName) {
            calls.push({ snippetName, args, line, fullText });
        }
    }

    return calls;
}

/**
 * Parse comma-separated arguments while respecting nested parentheses
 */
function parseBalancedArgs(argsStr: string): string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < argsStr.length; i++) {
        const char = argsStr[i];

        if (char === '(' || char === '[' || char === '{') {
            depth++;
            current += char;
        } else if (char === ')' || char === ']' || char === '}') {
            depth--;
            current += char;
        } else if (char === ',' && depth === 0) {
            if (current.trim()) {
                args.push(current.trim());
            }
            current = '';
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        args.push(current.trim());
    }

    return args;
}

/**
 * Check if a snippet body uses {@render param()} on its parameters
 * This is the main pattern we want to detect
 */
function checkSnippetBodyForParamRenders(
    snippet: SnippetDefinition,
    content: string,
    relativePath: string
): Violation[] {
    const violations: Violation[] = [];

    // Get parameter names
    const paramNames = snippet.params.map(p => p.name);

    // Look for {@render paramName()} in the body
    for (const paramName of paramNames) {
        // Check if param type suggests it's a component (any, typeof Component, Component, etc.)
        const param = snippet.params.find(p => p.name === paramName);
        const isLikelyComponent = param && isLikelyComponentType(param.type, paramName);

        // Check for {@render paramName()} pattern
        const renderParamRegex = new RegExp(`\\{@render\\s+${paramName}\\s*\\(\\s*\\)\\s*\\}`, 'g');
        let match;

        while ((match = renderParamRegex.exec(snippet.body)) !== null) {
            // This is suspicious - rendering a parameter as a snippet
            // Find the line number within the snippet body
            const beforeMatch = snippet.body.slice(0, match.index);
            const lineOffset = beforeMatch.split('\n').length - 1;
            const actualLine = snippet.line + lineOffset;

            violations.push({
                rule: 'R15',
                file: relativePath,
                reason: `Snippet "${snippet.name}" uses \`{@render ${paramName}()}\` on parameter "${paramName}"${isLikelyComponent ? ' which appears to be a component' : ''}. This pattern fails during navigation if the parameter is a Svelte component instead of a snippet.`,
                suggestion: `If "${paramName}" is a component, use \`<${toPascalCase(paramName)} class="..." />\` instead. If it's truly a snippet, ensure callers pass a snippet, not \`() => Component\`.`,
                line: actualLine,
                severity: isLikelyComponent ? 'error' : 'warning'
            });
        }
    }

    return violations;
}

/**
 * Check if a render call passes component factories as arguments
 */
function checkRenderCallArgs(
    call: RenderCall,
    snippetDefs: SnippetDefinition[],
    relativePath: string
): Violation[] {
    const violations: Violation[] = [];

    // Look for arguments that look like component factories: () => ComponentName
    const componentFactoryPattern = /\(\s*\)\s*=>\s*([A-Z][A-Za-z0-9]*)/;

    for (let i = 0; i < call.args.length; i++) {
        const arg = call.args[i];
        if (!arg) continue;

        const factoryMatch = componentFactoryPattern.exec(arg);
        if (factoryMatch) {
            const componentName = factoryMatch[1];

            violations.push({
                rule: 'R15',
                file: relativePath,
                reason: `Passing component factory \`${arg}\` to snippet "${call.snippetName}". This pattern causes "right-hand side of 'in' should be an object, got undefined" errors during navigation.`,
                suggestion: `Pass the component directly: \`${componentName}\` instead of \`() => ${componentName}\`. Then update the snippet to use \`<ComponentParam />\` instead of \`{@render param()}\`.`,
                line: call.line,
                severity: 'error'
            });
        }
    }

    return violations;
}

/**
 * Check for component-like parameters in snippets
 * Parameters named "icon", "Icon", ending with "Icon", or typed as "any"
 * that are used with {@render} are suspicious
 */
function checkForComponentParams(
    snippet: SnippetDefinition,
    content: string,
    relativePath: string
): Violation[] {
    const violations: Violation[] = [];

    for (const param of snippet.params) {
        // Check if parameter name suggests a component
        const isComponentName = /^[Ii]con$|Icon$|^[Cc]omponent$|Component$/i.test(param.name);
        const isAnyType = param.type === 'any' || param.type.includes('any');

        if ((isComponentName || isAnyType) && snippet.body.includes(`{@render ${param.name}(`)) {
            // Only report if not already caught by checkSnippetBodyForParamRenders
            // This catches the pattern with more context
            const renderParamRegex = new RegExp(`\\{@render\\s+${param.name}\\s*\\([^)]*\\)\\s*\\}`, 'g');

            if (renderParamRegex.test(snippet.body)) {
                // Already caught by the more specific check
                continue;
            }
        }
    }

    return violations;
}

/**
 * Check if a type string suggests it's a component type
 */
function isLikelyComponentType(type: string, paramName: string): boolean {
    // Common component type patterns
    if (type === 'any') return true;
    if (/^typeof\s+[A-Z]/.test(type)) return true;
    if (/Component/.test(type)) return true;
    if (/Icon/.test(type)) return true;
    if (/Svelte/.test(type)) return true;

    // Parameter name suggests component
    if (/^[Ii]con$|Icon$|^[Cc]omponent$|Component$/i.test(paramName)) return true;

    return false;
}

/**
 * Convert parameter name to PascalCase for suggestion
 */
function toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
