import { Project, SyntaxKind, type CallExpression } from 'ts-morph';
import { type Config, getAbsolutePath } from '../config/index.js';
import type { Violation } from '../reporting/index.ts';
import path from 'path';
import { readFileSync, readdirSync, existsSync } from 'fs';

/**
 * R10: Cerbos Policies
 * Any new resource/action referenced in API has a Cerbos policy.
 */
export async function verifyPolicies(config: Config): Promise<Violation[]> {
    const project = new Project();
    const violations: Violation[] = [];
    const projectRoot = getAbsolutePath(config.projectRoot, '.');

    // 1. Load all Cerbos policies
    const policyDir = path.join(projectRoot, 'cerbos/policies/resource');
    const policies = loadCerbosPolicies(policyDir);

    // 2. Focus on oRPC route files
    const globPath = path.join(projectRoot, 'src/lib/server/api/routes/**/*.ts').replace(/\\/g, '/');
    const files = project.addSourceFilesAtPaths(globPath);

    for (const file of files) {
        const relativePath = path.relative(projectRoot, file.getFilePath()).replace(/\\/g, '/');

        const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);
        for (const call of calls) {
            // Check for existing Cerbos calls to validate them
            const check = getCerbosCheck(call);
            if (check) {
                const { action, resource } = check;

                // If either is unknown (e.g. dynamic variable), we skip to avoid noise
                if (action === 'unknown' || resource === 'unknown') continue;

                const policy = policies[resource];
                if (!policy) {
                    violations.push({
                        rule: 'R10',
                        file: relativePath,
                        reason: `Cerbos policy for resource '${resource}' not found.`,
                        suggestion: `Create a new policy file at 'cerbos/policies/resource/${resource}.yaml'.`,
                        line: call.getStartLineNumber()
                    });
                } else if (action !== '*' && !policy.actions.includes(action) && !policy.actions.includes('*')) {
                    violations.push({
                        rule: 'R10',
                        file: relativePath,
                        reason: `Action '${action}' not defined in Cerbos policy for resource '${resource}'.`,
                        suggestion: `Add the action '${action}' to the rules in 'cerbos/policies/resource/${resource}.yaml'.`,
                        line: call.getStartLineNumber()
                    });
                }
            }

            // New Check: Detect procedures missing any Cerbos check
            if (isOrpcHandler(call)) {
                if (requiresCerbosCheck(call)) {
                    if (!hasCerbosCheckInside(call)) {
                        const procName = getOrpcProcedureName(call);
                        violations.push({
                            rule: 'R10',
                            file: relativePath,
                            reason: `oRPC handler '${procName}' is missing a Cerbos authorization check (authorize/can/queryFilter).`,
                            suggestion: `Add 'await context.cerbos.authorize(action, resource, id)' to ensure the procedure is protected (R10).`,
                            line: call.getStartLineNumber()
                        });
                    }
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

function requiresCerbosCheck(call: CallExpression): boolean {
    const text = call.getText();
    // Heuristic: procedures using orgProcedure or adminProcedure (or similar) usually require Cerbos
    // We can also check the context type if we had full type info, but here we use text-based heuristics on the chain
    const fullText = call.getExpression().getText();
    return fullText.includes('orgProcedure') || fullText.includes('adminProcedure') || fullText.includes('authProcedure');
}

function hasCerbosCheckInside(call: CallExpression): boolean {
    const args = call.getArguments();
    if (args.length === 0) return false;

    const handlerFn = args[0];
    const body = handlerFn.getText();

    // Check for common Cerbos call patterns
    return body.includes('cerbos.authorize') ||
        body.includes('cerbos.can') ||
        body.includes('cerbos.queryFilter') ||
        body.includes('requireAuthorization') ||
        body.includes('isAllowed');
}

function getOrpcProcedureName(call: CallExpression): string {
    let parent = call.getParent();
    while (parent) {
        if (parent.getKind() === SyntaxKind.PropertyAssignment) {
            return parent.asKind(SyntaxKind.PropertyAssignment)!.getName();
        }
        parent = parent.getParent();
    }
    return 'unknown';
}

interface CerbosPolicy {
    resource: string;
    actions: string[];
}

function loadCerbosPolicies(dir: string): Record<string, CerbosPolicy> {
    const result: Record<string, CerbosPolicy> = {};
    if (!existsSync(dir)) return result;

    const files = readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    for (const file of files) {
        const content = readFileSync(path.join(dir, file), 'utf8');
        // Match resource: "name"
        const resourceMatch = content.match(/resource:\s*["']?([^"'\s#]+)["']?/);
        if (resourceMatch) {
            const resource = resourceMatch[1];
            const actions: string[] = [];
            // Match actions: ["view", "edit"] or actions: [ 'view', 'edit' ]
            const actionLines = content.match(/actions:\s*\[([^\]]+)\]/g);
            if (actionLines) {
                for (const line of actionLines) {
                    const matches = line.match(/['"]([^'"]+)['"]/g);
                    if (matches) {
                        actions.push(...matches.map(m => m.replace(/['"]/g, '')));
                    }
                }
            }

            // Also match YAML list format:
            // actions:
            //   - view
            //   - edit
            const listMatches = content.match(/actions:\s*\n(\s*-\s*['"]?[^"'\n#]+['"]?\n?)+/g);
            if (listMatches) {
                for (const listBlock of listMatches) {
                    const items = listBlock.match(/-\s*['"]?([^"'\s#]+)["']?/g);
                    if (items) {
                        actions.push(...items.map(i => i.replace(/-\s*['"]?/, '').replace(/['"]?$/, '')));
                    }
                }
            }

            result[resource] = { resource, actions: Array.from(new Set(actions)) };
        }
    }
    return result;
}

function getCerbosCheck(call: CallExpression): { action: string, resource: string } | null {
    const expression = call.getExpression();
    if (expression.getKind() !== SyntaxKind.PropertyAccessExpression) {
        // Handle direct calls like requireAuthorization
        if (expression.getKind() === SyntaxKind.Identifier) {
            const name = expression.getText();
            if (name === 'requireAuthorization' || name === 'isAllowed') {
                const args = call.getArguments();
                if (args.length >= 3) {
                    const action = getStringValue(args[2]);
                    const resourceArg = args[1];
                    let resource = 'unknown';
                    if (resourceArg.getKind() === SyntaxKind.CallExpression) {
                        const resCall = resourceArg.asKind(SyntaxKind.CallExpression)!;
                        if (resCall.getExpression().getText().endsWith('createResource')) {
                            const resArgs = resCall.getArguments();
                            if (resArgs.length >= 1) {
                                resource = getStringValue(resArgs[0]);
                            }
                        }
                    }
                    return { action, resource };
                }
            }
        }
        return null;
    }

    const propAccess = expression.asKind(SyntaxKind.PropertyAccessExpression)!;
    const name = propAccess.getName();

    // Check for cerbos.can, cerbos.authorize, cerbos.queryFilter
    if (name === 'can' || name === 'authorize' || name === 'queryFilter') {
        const caller = propAccess.getExpression().getText();
        if (caller.endsWith('cerbos')) {
            const args = call.getArguments();
            if (args.length >= 2) {
                const action = getStringValue(args[0]);
                const resource = getStringValue(args[1]);
                return { action, resource };
            }
        }
    }

    return null;
}

function getStringValue(node: any): string {
    if (node.getKind() === SyntaxKind.StringLiteral || node.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
        return node.getLiteralValue();
    }
    return 'unknown';
}
