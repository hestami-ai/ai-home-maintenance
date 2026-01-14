import { Project, SyntaxKind, type CallExpression, type SourceFile, type Identifier } from 'ts-morph';
import { type Config, getAbsolutePath } from '../config/index.js';
import type { Violation } from '../reporting/index.ts';
import path from 'path';
import { readFileSync, existsSync } from 'fs';

/**
 * R11: Deep Semantic Trace
 * Traces oRPC handlers into workflows to ensure Cerbos authorization is enforced.
 */
export async function verifyDeepTrace(config: Config): Promise<Violation[]> {
    const project = new Project();
    const violations: Violation[] = [];
    const projectRoot = getAbsolutePath(config.projectRoot, '.');

    // 1. Scan oRPC route files
    const globPath = path.join(projectRoot, 'src/lib/server/api/routes/**/*.ts').replace(/\\/g, '/');
    const files = project.addSourceFilesAtPaths(globPath);

    for (const file of files) {
        const relativePath = path.relative(projectRoot, file.getFilePath()).replace(/\\/g, '/');
        const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);

        for (const call of calls) {
            if (isOrpcHandler(call)) {
                if (requiresCerbosCheck(call)) {
                    const traceResult = traceAuthorization(call, project, projectRoot);
                    if (!traceResult.authorized) {
                        const procName = getOrpcProcedureName(call);
                        const tracePath = traceResult.path.length > 0 ? ` -> ${traceResult.path.join(' -> ')}` : '';
                        violations.push({
                            rule: 'R11',
                            file: relativePath,
                            reason: `oRPC handler '${procName}' is missing Cerbos authorization (checked path: ${procName}${tracePath}).`,
                            suggestion: `Add 'await context.cerbos.authorize(...)' in the handler or the workflow to protect this route (R11).`,
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
    const fullText = call.getExpression().getText();
    return fullText.includes('orgProcedure') || fullText.includes('adminProcedure') || fullText.includes('authProcedure');
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

interface TraceResult {
    authorized: boolean;
    path: string[];
}

function traceAuthorization(call: CallExpression, project: Project, projectRoot: string, depth = 0): TraceResult {
    if (depth > 3) return { authorized: false, path: [] };

    const args = call.getArguments();
    if (args.length === 0) return { authorized: false, path: [] };

    const handlerFn = args[0];
    const bodyText = handlerFn.getText();

    // 1. Direct check in handler
    if (hasCerbosCheckText(bodyText)) {
        return { authorized: true, path: ['handler'] };
    }

    // 2. Look for downstream calls (workflows)
    const downstreamCalls = handlerFn.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const dsCall of downstreamCalls) {
        const dsName = dsCall.getExpression().getText();

        // Trace into startXYZWorkflow wrappers
        if (dsName.startsWith('start') && dsName.endsWith('Workflow')) {
            const definition = findDefinition(dsName, dsCall.getSourceFile(), project, projectRoot);
            if (definition) {
                const subTrace = traceIntoFunction(definition, project, projectRoot, depth + 1);
                if (subTrace.authorized) {
                    return { authorized: true, path: ['handler', ...subTrace.path] };
                } else if (subTrace.path.length > 0) {
                    // Keep the deepest path even if unauthorized
                    return { authorized: false, path: ['handler', ...subTrace.path] };
                }
            }
        }

        // Trace into DBOS.startWorkflow(xyzWorkflow_v1)
        if (dsName === 'DBOS.startWorkflow' || dsName.endsWith('.startWorkflow')) {
            const workflowArg = dsCall.getArguments()[0];
            if (workflowArg) {
                const wfName = workflowArg.getText();
                const definition = findDefinition(wfName, dsCall.getSourceFile(), project, projectRoot);
                if (definition) {
                    const subTrace = traceIntoFunction(definition, project, projectRoot, depth + 1);
                    if (subTrace.authorized) {
                        return { authorized: true, path: ['handler', ...subTrace.path] };
                    }
                }
            }
        }
    }

    return { authorized: false, path: [] };
}

function traceIntoFunction(fnNode: any, project: Project, projectRoot: string, depth: number): TraceResult {
    const fnName = fnNode.getName?.() || 'function';
    const bodyText = fnNode.getText();

    if (hasCerbosCheckText(bodyText)) {
        return { authorized: true, path: [fnName] };
    }

    if (depth > 5) return { authorized: false, path: [fnName, '(max depth)'] };

    // Recursively check calls inside this function
    const calls = fnNode.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
        const dsName = call.getExpression().getText();

        // Trace into DBOS.startWorkflow(xyzWorkflow_v1)
        if (dsName === 'DBOS.startWorkflow' || dsName.endsWith('.startWorkflow')) {
            const workflowArg = call.getArguments()[0];
            if (workflowArg) {
                const wfName = workflowArg.getText();
                let definition = findDefinition(wfName, call.getSourceFile(), project, projectRoot);

                // If it's a DBOS.registerWorkflow(...) or similar, try to trace into the actual function
                if (definition && definition.getKind() === SyntaxKind.VariableDeclaration) {
                    const initializer = definition.getInitializer();
                    if (initializer && initializer.getKind() === SyntaxKind.CallExpression) {
                        const regCall = initializer.asKind(SyntaxKind.CallExpression)!;
                        if (regCall.getExpression().getText().includes('registerWorkflow')) {
                            const actualWfArg = regCall.getArguments()[0];
                            if (actualWfArg) {
                                const actualWfName = actualWfArg.getText();
                                definition = findDefinition(actualWfName, call.getSourceFile(), project, projectRoot);
                            }
                        }
                    }
                }

                if (definition) {
                    const subTrace = traceIntoFunction(definition, project, projectRoot, depth + 1);
                    if (subTrace.authorized) {
                        return { authorized: true, path: [fnName, ...subTrace.path] };
                    } else if (subTrace.path.length > 0) {
                        return { authorized: false, path: [fnName, ...subTrace.path] };
                    }
                }
            }
        }

        // Trace into other function calls that might be interesting
        // We can add more heuristics here
    }

    return { authorized: false, path: [fnName] };
}

function hasCerbosCheckText(text: string): boolean {
    return text.includes('cerbos.authorize') ||
        text.includes('cerbos.can') ||
        text.includes('cerbos.queryFilter') ||
        text.includes('requireAuthorization') ||
        text.includes('isAllowed');
}

/**
 * Heuristic definition finder: looks in imports and then in the target file
 */
function findDefinition(name: string, sourceFile: SourceFile, project: Project, projectRoot: string): any {
    // 1. Check imports
    const imports = sourceFile.getImportDeclarations();
    for (const imp of imports) {
        const namedImports = imp.getNamedImports();
        const found = namedImports.find(n => n.getName() === name);
        const defaultImport = imp.getDefaultImport();
        const isDefault = defaultImport?.getText() === name;

        if (found || isDefault) {
            const moduleSpecifier = imp.getModuleSpecifierValue();
            const resolvedPath = resolveModulePath(moduleSpecifier, sourceFile.getFilePath(), projectRoot);
            if (resolvedPath && existsSync(resolvedPath)) {
                let targetFile = project.getSourceFile(resolvedPath);
                if (!targetFile) {
                    try {
                        targetFile = project.addSourceFileAtPath(resolvedPath);
                    } catch (e) {
                        return null;
                    }
                }

                // Find function or variable definition
                const fn = targetFile.getFunction(name);
                if (fn) return fn;
                const variable = targetFile.getVariableDeclaration(name);
                if (variable) {
                    const initializer = variable.getInitializer();
                    if (initializer && (initializer.getKind() === SyntaxKind.ArrowFunction || initializer.getKind() === SyntaxKind.FunctionExpression)) {
                        return initializer;
                    }
                    return variable;
                }
                const exportedVar = targetFile.getVariableDeclaration(v => v.getName() === name);
                if (exportedVar) return exportedVar;
            }
        }
    }

    // 2. Check local file
    const localFn = sourceFile.getFunction(name);
    if (localFn) return localFn;
    const localVar = sourceFile.getVariableDeclaration(name);
    if (localVar) return localVar;

    return null;
}

function resolveModulePath(specifier: string, fromPath: string, projectRoot: string): string | null {
    let cleanSpecifier = specifier;
    if (cleanSpecifier.endsWith('.js')) {
        cleanSpecifier = cleanSpecifier.slice(0, -3);
    }

    let absolute: string;
    if (cleanSpecifier.startsWith('.')) {
        absolute = path.resolve(path.dirname(fromPath), cleanSpecifier);
    } else if (cleanSpecifier.startsWith('$lib/')) {
        absolute = path.join(projectRoot, 'src/lib', cleanSpecifier.slice(5));
    } else if (cleanSpecifier.startsWith('$server/')) {
        absolute = path.join(projectRoot, 'src/lib/server', cleanSpecifier.slice(8));
    } else {
        return null;
    }

    // Try extensions
    const extensions = ['.ts', '.js', '/index.ts', '/index.js'];
    for (const ext of extensions) {
        if (existsSync(absolute + ext)) return absolute + ext;
    }

    return null;
}
