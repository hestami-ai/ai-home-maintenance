import { Project, SyntaxKind, type CallExpression } from 'ts-morph';
import { type Config, getAbsolutePath } from '../config/index.js';
import type { Violation } from '../reporting/index.ts';
import path from 'node:path';

/**
 * R6: Error contract (type-safe errors only)
 * oRPC procedure handlers must use the type-safe .errors() approach.
 * Do NOT use ApiException or throw ORPCError directly in handlers.
 */
export async function verifyErrors(config: Config): Promise<Violation[]> {
    const project = new Project();
    const violations: Violation[] = [];
    const projectRoot = getAbsolutePath(config.projectRoot, '.');

    // Scan all TypeScript files - don't rely on directory conventions
    // Code patterns (isOrpcHandler) determine what gets checked
    const globPath = path.join(projectRoot, 'src/**/*.ts').replaceAll('\\', '/');
    const files = project.addSourceFilesAtPaths(globPath);

    for (const file of files) {
        const relativePath = path.relative(projectRoot, file.getFilePath()).replaceAll('\\', '/');

        // Skip generated files
        if (relativePath.includes('/generated/') || relativePath.includes('.generated.')) continue;

        const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);
        for (const call of calls) {
            if (isOrpcHandler(call)) {
                if (hasErrorsCall(call)) {
                    // Check for raw throws inside the handler
                    checkRawThrows(call, relativePath, violations);
                } else {
                    violations.push({
                        rule: 'R6',
                        file: relativePath,
                        reason: 'oRPC handler missing .errors() definition.',
                        suggestion: 'Add .errors({...}) before .handler() to enable type-safe error handling and proper observability (non-500 errors).',
                        line: call.getStartLineNumber()
                    });
                }
            }
        }
    }

    return violations;
}

function isOrpcHandler(call: CallExpression): boolean {
    const expression = call.getExpression();
    if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expression.asKind(SyntaxKind.PropertyAccessExpression)!;
        return propAccess.getName() === 'handler';
    }
    return false;
}

function hasErrorsCall(call: CallExpression): boolean {
    // Walk up the call chain to see if .errors() was called
    let current: any = call.getExpression();

    // In a chain like .input().errors().handler(), current will be the expression for .handler
    // which is a PropertyAccessExpression. Its base is the call to .errors()

    while (current) {
        if (current.getKind() === SyntaxKind.PropertyAccessExpression) {
            const propAccess = current.asKind(SyntaxKind.PropertyAccessExpression)!;
            if (propAccess.getName() === 'errors') {
                return true;
            }
            current = propAccess.getExpression();
        } else if (current.getKind() === SyntaxKind.CallExpression) {
            current = current.asKind(SyntaxKind.CallExpression)!.getExpression();
        } else {
            break;
        }
    }
    return false;
}

function checkRawThrows(call: CallExpression, relativePath: string, violations: Violation[]) {
    const args = call.getArguments();
    if (args.length === 0) return;

    const handlerFn = args[0];
    if (!handlerFn) return;
    const throws = handlerFn.getDescendantsOfKind(SyntaxKind.ThrowStatement);
    for (const t of throws) {
        const expr = t.getExpression();
        if (!expr) continue;
        const text = expr.getText();

        // Flag if throwing new ORPCError or new ApiException or raw Error
        // The correct way is throw errors.CODE(...)
        if (text.includes('new ORPCError') || text.includes('new ApiException') || (text.includes('new Error') && !text.includes('errors.'))) {
            violations.push({
                rule: 'R6',
                file: relativePath,
                reason: 'Raw error thrown in oRPC handler.',
                suggestion: 'Use throw errors.CODE(...) instead of throwing raw errors to ensure the client receives a typed error and it is recorded correctly in traces.',
                line: t.getStartLineNumber()
            });
        }
    }
}
