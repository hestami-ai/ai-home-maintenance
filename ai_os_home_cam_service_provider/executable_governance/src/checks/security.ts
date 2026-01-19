import { Project, SyntaxKind, type CallExpression } from 'ts-morph';
import { type Config, getAbsolutePath } from '../config/index.js';
import type { Violation } from '../reporting/index.ts';
import path from 'path';
import { readFileSync, existsSync } from 'fs';
import { glob } from 'glob';

/**
 * R7: SECURITY DEFINER triggers/functions
 * R8: No direct Prisma in bootstrap/system flows
 */
export async function verifySecurity(config: Config): Promise<Violation[]> {
    const project = new Project();
    const violations: Violation[] = [];
    const projectRoot = getAbsolutePath(config.projectRoot, '.');

    // 1. Check for SECURITY DEFINER usage in SQL files (R7)
    // Each SECURITY DEFINER function should have SET search_path = public
    // For migrations: track which functions have been fixed in later migrations
    const sqlMatches = await glob('**/*.sql', { cwd: projectRoot, absolute: true, ignore: ['**/node_modules/**', '**/dist/**'] });

    // Separate migration files from other SQL files
    const migrationFiles: string[] = [];
    const otherSqlFiles: string[] = [];
    for (const sqlFile of sqlMatches) {
        if (sqlFile.includes('prisma/migrations') || sqlFile.includes('prisma\\migrations')) {
            migrationFiles.push(sqlFile);
        } else {
            otherSqlFiles.push(sqlFile);
        }
    }

    // Sort migrations by name (which includes timestamp) to process in chronological order
    migrationFiles.sort();

    // Track functions that have been properly fixed in later migrations
    // Key: function name, Value: migration file where it was properly defined
    const fixedFunctions = new Map<string, string>();

    // First pass: find all functions that ARE properly defined with SET search_path
    for (const sqlFile of migrationFiles) {
        const content = readFileSync(sqlFile, 'utf8');
        const relativePath = path.relative(projectRoot, sqlFile).replace(/\\/g, '/');
        const properlyDefinedFunctions = findProperlyDefinedFunctions(content);
        for (const funcName of properlyDefinedFunctions) {
            fixedFunctions.set(funcName.toLowerCase(), relativePath);
        }
    }

    // Second pass: find violations, but skip if function was later fixed
    for (const sqlFile of migrationFiles) {
        const content = readFileSync(sqlFile, 'utf8');
        const relativePath = path.relative(projectRoot, sqlFile).replace(/\\/g, '/');
        const funcViolations = findSecurityDefinerViolations(content, relativePath, fixedFunctions);
        violations.push(...funcViolations);
    }

    // Check non-migration SQL files (always check these, no exemptions)
    for (const sqlFile of otherSqlFiles) {
        const relativePath = path.relative(projectRoot, sqlFile).replace(/\\/g, '/');
        const content = readFileSync(sqlFile, 'utf8');
        const funcViolations = findSecurityDefinerViolations(content, relativePath);
        violations.push(...funcViolations);
    }

    // 2. Check for direct Prisma usage in bootstrap flows (R8)
    const bootstrapFiles = [
        'src/routes/api/v1/rpc/[...rest]/+server.ts',
        'src/hooks.server.ts'
    ];

    for (const bFile of bootstrapFiles) {
        const fullPath = path.join(projectRoot, bFile);
        if (existsSync(fullPath)) {
            const sourceFile = project.addSourceFileAtPath(fullPath);
            const relativePath = bFile;

            // Look for prisma.X.findMany/findUnique etc.
            const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
            for (const call of calls) {
                if (isDirectPrismaQuery(call)) {
                    // Check if it's inside a bootstrap-sensitive function like createContext
                    if (isInsideBootstrapContext(call)) {
                        violations.push({
                            rule: 'R8',
                            file: relativePath,
                            reason: 'Direct Prisma query detected in bootstrap flow. RLS will block this before context is established.',
                            suggestion: 'Use a SECURITY DEFINER function via prisma.$queryRaw instead of direct Prisma calls for bootstrapping (R8).',
                            line: call.getStartLineNumber()
                        });
                    }
                }
            }
        }
    }

    return violations;
}

function isDirectPrismaQuery(call: CallExpression): boolean {
    const expression = call.getExpression();
    if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expression.asKind(SyntaxKind.PropertyAccessExpression)!;
        const name = propAccess.getName();
        const caller = propAccess.getExpression().getText();

        const isPrisma = caller.toLowerCase().includes('prisma') || caller === 'tx';
        const isQuery = ['findMany', 'findUnique', 'findFirst', 'count', 'findUniqueOrThrow', 'findFirstOrThrow'].includes(name);

        return isPrisma && isQuery;
    }
    return false;
}

function isInsideBootstrapContext(call: CallExpression): boolean {
    let parent = call.getParent();
    while (parent) {
        if (parent.getKind() === SyntaxKind.FunctionDeclaration || parent.getKind() === SyntaxKind.FunctionExpression || parent.getKind() === SyntaxKind.ArrowFunction) {
            const funcName = (parent as any).getName?.() || '';
            if (funcName === 'createContext' || funcName === 'handle') return true;
        }
        parent = parent.getParent();
    }
    return false;
}

/**
 * Finds SECURITY DEFINER functions that are missing SET search_path = public.
 *
 * PostgreSQL function syntax patterns to detect:
 * 1. Inline: $$ LANGUAGE plpgsql SECURITY DEFINER;
 * 2. Multi-line: SECURITY DEFINER\nSET search_path = public\nAS $$
 *
 * For each SECURITY DEFINER occurrence, we check if SET search_path appears
 * within 3 lines before or after it (to handle both patterns).
 *
 * @param fixedFunctions - Optional map of function names that have been properly
 *                         defined in later migrations. If a function is in this map,
 *                         violations for earlier definitions are suppressed.
 */
function findSecurityDefinerViolations(
    content: string,
    relativePath: string,
    fixedFunctions?: Map<string, string>
): Violation[] {
    const violations: Violation[] = [];
    const lines = content.split('\n');

    // Find all lines containing SECURITY DEFINER (skip comments)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined || !line.includes('SECURITY DEFINER')) continue;

        // Skip SQL comment lines and string literals (documentation)
        const trimmedLine = line.trim();
        // Skip: -- comments, COMMENT ON statements, and string content (starts with ')
        if (trimmedLine.startsWith('--') ||
            trimmedLine.startsWith('COMMENT ON') ||
            trimmedLine.startsWith("'")) continue;

        // Check if SET search_path = public appears nearby (within 3 lines before or after)
        // This handles both inline and multi-line function definition patterns
        const startIdx = Math.max(0, i - 3);
        const endIdx = Math.min(lines.length - 1, i + 3);

        let hasSearchPath = false;
        for (let j = startIdx; j <= endIdx; j++) {
            const checkLine = lines[j];
            if (checkLine && checkLine.toLowerCase().includes('set search_path')) {
                hasSearchPath = true;
                break;
            }
        }

        if (!hasSearchPath) {
            // Try to extract function name for better error messages
            const funcName = extractFunctionName(lines, i);

            // If this function has been fixed in a later migration, skip this violation
            if (funcName && fixedFunctions) {
                const fixedIn = fixedFunctions.get(funcName.toLowerCase());
                if (fixedIn && fixedIn !== relativePath) {
                    // Function was properly defined elsewhere, skip this violation
                    continue;
                }
            }

            violations.push({
                rule: 'R7',
                file: relativePath,
                reason: funcName
                    ? `SECURITY DEFINER function "${funcName}" missing "SET search_path = public".`
                    : 'SECURITY DEFINER function missing "SET search_path = public".',
                suggestion: 'Add "SET search_path = public" to SECURITY DEFINER functions to prevent search_path hijacking (R7).',
                line: i + 1
            });
        }
    }

    return violations;
}

/**
 * Finds functions that are properly defined with SECURITY DEFINER AND SET search_path.
 * Returns a list of function names that are compliant.
 */
function findProperlyDefinedFunctions(content: string): string[] {
    const properFunctions: string[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined || !line.includes('SECURITY DEFINER')) continue;

        // Skip SQL comment lines and string literals (documentation)
        const trimmedLine = line.trim();
        // Skip: -- comments, COMMENT ON statements, and string content (starts with ')
        if (trimmedLine.startsWith('--') ||
            trimmedLine.startsWith('COMMENT ON') ||
            trimmedLine.startsWith("'")) continue;

        // Check if SET search_path = public appears nearby
        const startIdx = Math.max(0, i - 3);
        const endIdx = Math.min(lines.length - 1, i + 3);

        let hasSearchPath = false;
        for (let j = startIdx; j <= endIdx; j++) {
            const checkLine = lines[j];
            if (checkLine && checkLine.toLowerCase().includes('set search_path')) {
                hasSearchPath = true;
                break;
            }
        }

        if (hasSearchPath) {
            const funcName = extractFunctionName(lines, i);
            if (funcName) {
                properFunctions.push(funcName);
            }
        }
    }

    return properFunctions;
}

/**
 * Tries to extract the function name by looking backwards from the SECURITY DEFINER line
 * for CREATE [OR REPLACE] FUNCTION pattern.
 */
function extractFunctionName(lines: string[], securityDefinerLineIdx: number): string | null {
    // Look backwards up to 30 lines for CREATE FUNCTION
    const startIdx = Math.max(0, securityDefinerLineIdx - 30);
    for (let i = securityDefinerLineIdx; i >= startIdx; i--) {
        const line = lines[i];
        if (line === undefined) continue;
        const match = line.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([^\s(]+)/i);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}
