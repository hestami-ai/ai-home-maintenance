import { Project, SyntaxKind, type CallExpression } from 'ts-morph';
import { type Config, getAbsolutePath } from '../config/index.js';
import type { Violation } from '../reporting/index.ts';
import path from 'path';

const MUTATION_METHODS = ['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany', '$executeRaw', '$executeRawUnsafe', '$transaction'];

export async function verifyMutations(config: Config): Promise<Violation[]> {
    const project = new Project();
    const violations: Violation[] = [];
    const projectRoot = getAbsolutePath(config.projectRoot, '.');

    // We care about all TS files that might call Prisma
    const globPath = path.join(projectRoot, 'src/**/*.ts').replace(/\\/g, '/');
    const files = project.addSourceFilesAtPaths(globPath);

    for (const file of files) {
        const relativePath = path.relative(projectRoot, file.getFilePath()).replace(/\\/g, '/');

        const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);
        for (const call of calls) {
            if (isPrismaMutation(call)) {
                if (!isInsideWorkflow(call)) {
                    violations.push({
                        rule: 'R2',
                        file: relativePath,
                        reason: 'Prisma mutation call detected outside of a DBOS workflow.',
                        suggestion: 'Move this database write into a DBOS workflow to ensure durability and idempotency.',
                        line: call.getStartLineNumber()
                    });
                }
            }

            // R3: Idempotency Key check for oRPC handlers that are presumably mutating
            // Heuristic: if it's named 'create', 'update', 'delete', 'upsert', 'approve', 'void', etc.
            if (isOrpcHandler(call)) {
                const procName = getOrpcProcedureName(call);
                if (isMutatingAction(procName)) {
                    if (!hasIdempotencyKey(call)) {
                        violations.push({
                            rule: 'R3',
                            file: relativePath,
                            reason: `Mutating oRPC handler '${procName}' missing idempotencyKey in input schema.`,
                            suggestion: 'Add "idempotencyKey: z.string().uuid()" to the input schema for all mutating operations (R3).',
                            line: call.getStartLineNumber()
                        });
                    } else {
                        // Check if it's passed to start*Workflow
                        const handlerNode = getHandlerFunction(call);
                        if (handlerNode) {
                            const workflowStarts = handlerNode.getDescendantsOfKind(SyntaxKind.CallExpression)
                                .filter(c => isWorkflowStart(c));

                            for (const ws of workflowStarts) {
                                if (!isPassingIdempotencyKey(ws)) {
                                    violations.push({
                                        rule: 'R3',
                                        file: relativePath,
                                        reason: `Workflow start in '${procName}' missing idempotencyKey propagation.`,
                                        suggestion: 'Ensure input.idempotencyKey is passed as the workflow identity (workflowID) to ensure atomicity (R3).',
                                        line: ws.getStartLineNumber()
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // New Refinement: Check workflow wrapper functions (start*Workflow)
            // Exclude DBOS.startWorkflow calls (these are checked separately)
            // and exclude inline route handler calls
            if (isWorkflowWrapper(call) && !isDbosStartWorkflow(call) && !isInlineRouteHandlerCall(call, file)) {
                if (!hasIdempotencyKeyInSignature(call)) {
                    const wrapperName = getCalledFunctionName(call);
                    violations.push({
                        rule: 'R3',
                        file: relativePath,
                        reason: `Workflow wrapper '${wrapperName}' missing idempotencyKey in signature.`,
                        suggestion: 'Workflow wrappers (start*Workflow) must accept an idempotencyKey to ensure durable execution (R3).',
                        line: call.getStartLineNumber()
                    });
                }
            }

            // New Refinement: Check DBOS.startWorkflow for workflowID mapping
            // Exclude inline calls in route handlers (webhooks, etc.)
            if (isDbosStartWorkflow(call) && !isInlineRouteHandlerCall(call, file)) {
                if (!isMappingWorkflowIdToIdempotencyKey(call)) {
                    violations.push({
                        rule: 'R3',
                        file: relativePath,
                        reason: 'DBOS.startWorkflow missing direct mapping from idempotencyKey to workflowID.',
                        suggestion: 'Assign workflowID = idempotencyKey in the startWorkflow options to ensure exact-once semantics (R3).',
                        line: call.getStartLineNumber()
                    });
                }
            }
        }
    }

    return violations;
}

function getHandlerFunction(call: CallExpression) {
    const args = call.getArguments();
    const firstArg = args[0];
    if (firstArg && (firstArg.getKind() === SyntaxKind.FunctionDeclaration || firstArg.getKind() === SyntaxKind.ArrowFunction || firstArg.getKind() === SyntaxKind.FunctionExpression)) {
        return firstArg;
    }
    return null;
}

function isWorkflowStart(call: CallExpression): boolean {
    const expression = call.getExpression();
    const name = expression.getKind() === SyntaxKind.PropertyAccessExpression
        ? (expression as any).getName()
        : expression.getText();

    return (name.startsWith('start') && name.endsWith('Workflow')) || name === 'startWorkflow' || name === 'invokeWorkflow';
}

function isPassingIdempotencyKey(call: CallExpression): boolean {
    const args = call.getArguments();
    const text = call.getText();

    // Check if any argument contains 'idempotencyKey'
    if (args.some(a => a.getText().includes('idempotencyKey'))) return true;

    // Check for DBOS.startWorkflow(..., { workflowID: ... })
    if (text.includes('workflowID') && text.includes('idempotencyKey')) return true;

    return false;
}

function isOrpcHandler(call: CallExpression): boolean {
    const expression = call.getExpression();
    if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expression.asKind(SyntaxKind.PropertyAccessExpression)!;
        return propAccess.getName() === 'handler';
    }
    return false;
}

function getOrpcProcedureName(call: CallExpression): string {
    // Usually oRPC procedures are defined in an object: export const myRouter = { myProc: orgProcedure.handler(...) }
    // We want to find 'myProc'
    let parent = call.getParent();
    while (parent) {
        if (parent.getKind() === SyntaxKind.PropertyAssignment) {
            return parent.asKind(SyntaxKind.PropertyAssignment)!.getName();
        }
        parent = parent.getParent();
    }
    return 'unknown';
}

function isMutatingAction(name: string): boolean {
    const mutatingWords = ['create', 'update', 'delete', 'upsert', 'patch', 'post', 'put', 'approve', 'void', 'process', 'submit', 'record'];
    const queryWords = ['list', 'get', 'find', 'search', 'query', 'read', 'fetch', 'count'];

    // Exclude operations that are clearly read-only
    const lowerName = name.toLowerCase();
    if (queryWords.some(word => lowerName.includes(word))) {
        return false;
    }

    return mutatingWords.some(word => lowerName.includes(word));
}

function hasIdempotencyKey(call: CallExpression): boolean {
    // Walk up the call chain to find .input()
    let current: any = call.getExpression();
    while (current) {
        if (current.getKind() === SyntaxKind.PropertyAccessExpression) {
            const propAccess = current.asKind(SyntaxKind.PropertyAccessExpression)!;
            if (propAccess.getName() === 'input') {
                // Found .input, now check its arguments
                const inputCall = propAccess.getParentIfKind(SyntaxKind.CallExpression);
                if (inputCall) {
                    const arg = inputCall.getArguments()[0];
                    if (arg) {
                        const text = arg.getText();
                        // Check for direct idempotencyKey field
                        if (text.includes('idempotencyKey')) {
                            return true;
                        }
                        // Check for IdempotencyKeySchema usage (merge, extend, or direct)
                        if (text.includes('IdempotencyKeySchema')) {
                            return true;
                        }

                        // If it's a variable reference, try to resolve it
                        if (arg.getKind() === SyntaxKind.Identifier) {
                            const identifier = arg.asKind(SyntaxKind.Identifier)!;
                            const definitions = identifier.getDefinitions();

                            for (const def of definitions) {
                                const defNode = def.getNode();
                                if (defNode) {
                                    const parent = defNode.getParent();
                                    if (parent && parent.getKind() === SyntaxKind.VariableDeclaration) {
                                        const varDecl = parent.asKind(SyntaxKind.VariableDeclaration)!;
                                        const initializer = varDecl.getInitializer();
                                        if (initializer) {
                                            const initText = initializer.getText();
                                            // Check if variable definition includes IdempotencyKeySchema
                                            if (initText.includes('idempotencyKey') || initText.includes('IdempotencyKeySchema')) {
                                                return true;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
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

function isWorkflowWrapper(call: CallExpression): boolean {
    const name = getCalledFunctionName(call);
    return name.startsWith('start') && name.endsWith('Workflow');
}

function hasIdempotencyKeyInSignature(call: CallExpression): boolean {
    // This check is slightly complex with AST without type info,
    // but we can check if the called function's declaration has 'idempotencyKey' in its params
    // For now, let's check if 'idempotencyKey' is passed as an argument to the call
    return call.getArguments().some(arg => arg.getText().includes('idempotencyKey'));
}

function isDbosStartWorkflow(call: CallExpression): boolean {
    const text = call.getExpression().getText();
    return text.includes('DBOS.startWorkflow');
}

function isMappingWorkflowIdToIdempotencyKey(call: CallExpression): boolean {
    // For DBOS.startWorkflow, we might have: DBOS.startWorkflow(wf, opts)(input)
    // This creates two CallExpressions - we need to check the inner one
    const expr = call.getExpression();
    let targetCall = call;

    // If this is the outer call (the (input) part), get the inner call
    if (expr.getKind() === SyntaxKind.CallExpression) {
        const innerCall = expr.asKind(SyntaxKind.CallExpression)!;
        if (innerCall.getExpression().getText().includes('DBOS.startWorkflow')) {
            targetCall = innerCall;
        }
    }

    const args = targetCall.getArguments();
    // DBOS.startWorkflow(workflow, { workflowID: ... })
    if (args.length >= 2) {
        const options = args[1];
        if (options && options.getKind() === SyntaxKind.ObjectLiteralExpression) {
            const obj = options.asKind(SyntaxKind.ObjectLiteralExpression)!;
            const prop = obj.getProperty('workflowID');
            if (prop) {
                const text = prop.getText();

                // Check for direct idempotencyKey usage
                if (text.includes('idempotencyKey')) {
                    return true;
                }

                // Check for documented exceptions (webhook handlers, system events)
                const leadingComments = targetCall.getLeadingCommentRanges();
                for (const comment of leadingComments) {
                    const commentText = comment.getText().toLowerCase();
                    if (commentText.includes('governance note') ||
                        commentText.includes('governance exception') ||
                        commentText.includes('webhook') ||
                        commentText.includes('external event')) {
                        return true;
                    }
                }

                // Check if workflowID is derived from an external/system identifier
                // Common patterns: workflowId, derivedId, eventId, externalId
                if (text.includes('workflowId') ||
                    text.includes('eventId') ||
                    text.includes('externalId') ||
                    text.includes('tusId') ||
                    text.includes('hookId')) {

                    // Look for variable declaration to see if it's derived from external source
                    const workflowIdMatch = text.match(/workflowID:\s*(\w+)/);
                    if (workflowIdMatch) {
                        const varName = workflowIdMatch[1];
                        const sourceFile = targetCall.getSourceFile();
                        const varDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);

                        for (const varDecl of varDeclarations) {
                            if (varDecl.getName() === varName) {
                                const initializer = varDecl.getInitializer();
                                if (initializer) {
                                    const initText = initializer.getText();
                                    // Check if it's a template string deriving from external ID
                                    if (initText.includes('`') &&
                                        (initText.includes('tusId') ||
                                         initText.includes('eventId') ||
                                         initText.includes('hookId') ||
                                         initText.includes('externalId'))) {
                                        return true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return false;
}

function isInlineRouteHandlerCall(call: CallExpression, sourceFile: any): boolean {
    // Check if this DBOS.startWorkflow call is inside a route handler
    // Route handlers are in files matching: src/routes/**/+server.ts or src/routes/**/+page.server.ts
    const filePath = sourceFile.getFilePath();

    if (filePath.includes('/routes/') &&
        (filePath.includes('+server.ts') || filePath.includes('+page.server.ts'))) {

        // Check if the call is inside an exported RequestHandler or similar
        let parent = call.getParent();
        while (parent) {
            // Look for arrow function or function expression
            if (parent.getKind() === SyntaxKind.ArrowFunction ||
                parent.getKind() === SyntaxKind.FunctionExpression) {

                // Check if this function is assigned to an exported const (like POST, GET, etc.)
                const grandParent = parent.getParent();
                if (grandParent && grandParent.getKind() === SyntaxKind.VariableDeclaration) {
                    const varDecl = grandParent.asKind(SyntaxKind.VariableDeclaration);
                    const name = varDecl?.getName();

                    // Common SvelteKit handler names
                    if (name && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'load'].includes(name)) {
                        // Check if it's exported
                        const varStatement = varDecl.getParent()?.getParent();
                        if (varStatement && varStatement.getKind() === SyntaxKind.VariableStatement) {
                            const modifiers = (varStatement as any).getModifiers?.() || [];
                            if (modifiers.some((m: any) => m.getKind() === SyntaxKind.ExportKeyword)) {
                                return true;
                            }
                        }
                    }
                }

                // Also check for direct export const pattern
                const text = parent.getParent()?.getText() || '';
                if (text.includes('export const') &&
                    (text.includes('POST') || text.includes('GET') || text.includes('PUT') ||
                     text.includes('DELETE') || text.includes('PATCH'))) {
                    return true;
                }
            }
            parent = parent.getParent();
        }
    }

    return false;
}

function getCalledFunctionName(call: CallExpression): string {
    const expression = call.getExpression();
    if (expression.getKind() === SyntaxKind.Identifier) {
        return expression.getText();
    } else if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
        return expression.asKind(SyntaxKind.PropertyAccessExpression)!.getName();
    }
    return 'unknown';
}

function isPrismaMutation(call: CallExpression): boolean {
    const expression = call.getExpression();
    if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expression.asKind(SyntaxKind.PropertyAccessExpression)!;
        const name = propAccess.getName();
        if (MUTATION_METHODS.includes(name)) {
            // Check if it's called on prisma or tx
            const caller = propAccess.getExpression().getText();
            return caller.toLowerCase().includes('prisma') || caller === 'tx' || caller.includes('this.ctx.prisma');
        }
    }
    return false;
}

function isInsideWorkflow(call: CallExpression): boolean {
    // Simple heuristic: check if any parent function is registered as a workflow
    // Or if the file is in the workflows directory
    const file = call.getSourceFile();
    const filePath = file.getFilePath();

    if (filePath.includes('src/lib/server/workflows')) {
        // We actually want to ensure it's inside a function that will be executed as a step or part of a workflow
        return true;
    }

    // Check parents for workflow patterns or if the function is passed to DBOS.registerWorkflow
    let parent = call.getParent();
    while (parent) {
        const kind = parent.getKind();
        if (kind === SyntaxKind.FunctionDeclaration || kind === SyntaxKind.FunctionExpression || kind === SyntaxKind.ArrowFunction) {
            // Check for registration in the same file
            const name = (parent as any).getName?.();
            if (name) {
                const sourceFile = call.getSourceFile();
                if (sourceFile.getText().includes(`registerWorkflow(${name})`)) {
                    return true;
                }
            }

            // Or if it's inside a class method of a class labeled/used as a workflow or background job
        }
        parent = parent.getParent();
    }

    return false;
}
