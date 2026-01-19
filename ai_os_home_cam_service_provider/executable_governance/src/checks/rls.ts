import { Project, SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph';
import { type Config, getAbsolutePath } from '../config/index.js';
import type { Violation } from '../reporting/index.ts';
import path from 'path';

/**
 * R12: RLS Defense in Depth
 *
 * This check enforces multiple aspects of RLS safety:
 * A) Prisma queries in routers must include explicit organizationId/associationId filters
 * B) Workflows should use orgTransaction helper instead of raw prisma calls
 * C) setOrgContext calls should be inside prisma.$transaction blocks OR wrapped in withRLSContext
 * D) Connection pooling safety: orgProcedure must use withRLSContext pattern
 * E) Prisma extensions must not call query(args) inside transactions (must use tx[modelName][operation])
 * F) SvelteKit page.server.ts files must use orgTransaction for cross-org access, not setOrgContext + prisma
 */

const QUERY_METHODS = ['findMany', 'findFirst', 'findUnique', 'findUniqueOrThrow', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy'];
const MUTATION_METHODS = ['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'];
const ALL_PRISMA_METHODS = [...QUERY_METHODS, ...MUTATION_METHODS];

// Tables that require organizationId filter (tenant-scoped)
const ORG_SCOPED_TABLES = [
    'document', 'conciergeCase', 'ownerIntent', 'propertyPortfolio', 'individualProperty',
    'violation', 'arcRequest', 'workOrder', 'association', 'unit', 'party', 'ownership',
    'activityEvent', 'compliance', 'meeting', 'boardMotion', 'resolution', 'committee',
    'assessment', 'payment', 'invoice', 'vendor', 'contractorProfile', 'job', 'estimate',
    'proposal', 'serviceContract', 'inventoryItem', 'purchaseOrder', 'technician',
    'caseNote', 'caseAttachment', 'caseParticipant', 'conciergeAction', 'vendorCandidate',
    'vendorBid', 'externalHoaContext', 'externalVendorContext', 'materialDecision',
    'delegatedAuthority', 'propertyOwnership', 'portfolioProperty', 'caseCommunication',
    'caseReview', 'caseMilestone', 'caseIssue', 'intentNote'
];

// Tables that also require associationId filter for CAM pillar
const ASSOC_SCOPED_TABLES = [
    'document', 'violation', 'arcRequest', 'unit', 'ownership', 'meeting', 'boardMotion',
    'resolution', 'committee', 'assessment', 'policyDocument', 'activityEvent'
];

export async function verifyRls(config: Config): Promise<Violation[]> {
    const project = new Project();
    const violations: Violation[] = [];
    const projectRoot = getAbsolutePath(config.projectRoot, '.');

    // Scan ALL TypeScript files - don't rely on directory conventions
    // Code patterns determine what checks apply, not file locations
    const allTsGlob = path.join(projectRoot, 'src/**/*.ts').replace(/\\/g, '/');
    const allFiles = project.addSourceFilesAtPaths(allTsGlob);

    for (const file of allFiles) {
        const relativePath = path.relative(projectRoot, file.getFilePath()).replace(/\\/g, '/');

        // Skip generated files
        if (relativePath.includes('/generated/') || relativePath.includes('.generated.')) continue;

        // Detect file type by content patterns, not by folder conventions
        const fileText = file.getText();
        const isDbosWorkflow = fileText.includes('DBOS.registerWorkflow') ||
                              fileText.includes('DBOS.runStep') ||
                              fileText.includes('@dbos-inc/dbos-sdk');
        const isRouteHandler = relativePath.includes('/routes/') ||
                              relativePath.includes('/api/routes/');

        // Check A: Prisma queries should have explicit org/assoc filters (defense in depth)
        // Applies to route handlers - these run within withRLSContext but explicit filters add defense in depth
        if (isRouteHandler) {
            const routerViolations = checkRouterQueries(file, relativePath);
            violations.push(...routerViolations);
        }

        // Check B: Workflow mutations should use orgTransaction or be in $transaction
        // Applies to DBOS workflows - these run outside HTTP context and MUST use orgTransaction
        if (isDbosWorkflow) {
            const workflowViolations = checkWorkflowTransactions(file, relativePath);
            violations.push(...workflowViolations);
        }

        // Check C: setOrgContext calls outside transactions
        // Skip db.ts itself (it defines the helpers)
        if (!relativePath.endsWith('db.ts')) {
            const contextViolations = checkContextOutsideTransaction(file, relativePath);
            violations.push(...contextViolations);
        }

        // Check D: orgProcedure middleware must use withRLSContext (router.ts specific)
        if (relativePath.endsWith('router.ts')) {
            const connectionPoolingViolations = checkOrgProcedureUsesWithRLSContext(file, relativePath);
            violations.push(...connectionPoolingViolations);
        }

        // Check E: db.ts withRLSInjection must use tx[model][operation], not query(args)
        if (relativePath.endsWith('db.ts')) {
            const extensionViolations = checkPrismaExtensionQueryUsage(file, relativePath);
            violations.push(...extensionViolations);
        }

        // Check F: SvelteKit page.server.ts files must use orgTransaction, not setOrgContext + prisma
        if (relativePath.endsWith('+page.server.ts')) {
            const pageServerViolations = checkPageServerRlsUsage(file, relativePath);
            violations.push(...pageServerViolations);
        }
    }

    return violations;
}

/**
 * Check A: Router queries must include explicit organizationId filter
 */
function checkRouterQueries(file: SourceFile, relativePath: string): Violation[] {
    const violations: Violation[] = [];
    const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);
    const fileText = file.getText();

    for (const call of calls) {
        const queryInfo = getPrismaQueryInfo(call);
        if (!queryInfo) continue;

        const { tableName, methodName, isQuery } = queryInfo;
        
        // Only check queries (reads) - mutations are handled by workflows
        if (!isQuery) continue;

        // Check if this table requires org scoping
        const requiresOrgScope = ORG_SCOPED_TABLES.some(t => 
            tableName.toLowerCase() === t.toLowerCase()
        );
        
        if (!requiresOrgScope) continue;

        // Check if the query has an explicit organizationId filter
        const hasOrgFilter = hasExplicitOrgFilter(call);
        
        if (!hasOrgFilter) {
            // Determine severity based on context
            const severity = determineSeverity(relativePath, fileText, call);
            
            violations.push({
                rule: 'R12',
                file: relativePath,
                reason: `Prisma query on '${tableName}.${methodName}' missing explicit organizationId filter (Defense in Depth).`,
                suggestion: severity === 'info' 
                    ? 'This appears to be intentional cross-org access for staff users or uses orgTransaction. Verify this is expected behavior.'
                    : severity === 'warning'
                    ? 'This endpoint may need authentication context added to enable org filtering.'
                    : 'Add "organizationId: context.organization.id" to the WHERE clause to guard against RLS context loss from connection pooling.',
                line: call.getStartLineNumber(),
                severity
            });
        }

        // Check if this table also requires association scoping
        // Only flag missing associationId if organizationId is ALSO missing
        // organizationId provides primary tenant isolation; associationId is secondary defense
        const requiresAssocScope = ASSOC_SCOPED_TABLES.some(t => 
            tableName.toLowerCase() === t.toLowerCase()
        );

        if (requiresAssocScope && !hasOrgFilter) {
            const hasAssocFilter = hasExplicitAssocFilter(call);
            // Only warn if there's no association filter AND no org filter AND we're in a CAM-related file
            if (!hasAssocFilter && isLikelyCamContext(file, call)) {
                violations.push({
                    rule: 'R12',
                    file: relativePath,
                    reason: `Prisma query on '${tableName}.${methodName}' in CAM context missing explicit associationId filter.`,
                    suggestion: 'For CAM pillar tables, add "associationId: context.associationId" to the WHERE clause when association context is available.',
                    line: call.getStartLineNumber()
                });
            }
        }
    }

    return violations;
}

/**
 * Check B: Workflows should use orgTransaction instead of raw prisma calls
 */
function checkWorkflowTransactions(file: SourceFile, relativePath: string): Violation[] {
    const violations: Violation[] = [];
    
    // Skip schema files and helper files
    if (relativePath.includes('schemas.ts') || relativePath.includes('workflowLogger.ts')) {
        return violations;
    }

    const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of calls) {
        const queryInfo = getPrismaQueryInfo(call);
        if (!queryInfo) continue;

        const { tableName, methodName, isMutation } = queryInfo;

        // Check if this is a raw prisma call (not inside orgTransaction)
        if (isMutation && !isInsideOrgTransaction(call) && !isInsidePrismaTransaction(call)) {
            // Check if this is inside a helper function that receives a transaction parameter
            // These are already org-scoped via the caller's orgTransaction
            const functionParent = call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
            let severity: 'error' | 'warning' | 'info' = 'error';
            
            if (functionParent) {
                const params = functionParent.getParameters();
                // If the function takes a 'tx' parameter, it's a helper using orgTransaction
                if (params.some(p => p.getName() === 'tx' || p.getTypeNode()?.getText()?.includes('PrismaTransaction'))) {
                    severity = 'info';
                }
            }
            
            violations.push({
                rule: 'R12',
                file: relativePath,
                reason: `Workflow mutation '${tableName}.${methodName}' not wrapped in orgTransaction.`,
                suggestion: severity === 'info'
                    ? 'This helper function receives a transaction parameter from orgTransaction. Verify the caller uses orgTransaction.'
                    : 'Use orgTransaction() helper to ensure RLS context is set within the same database connection as the query.',
                line: call.getStartLineNumber(),
                severity
            });
        }
    }

    return violations;
}

/**
 * Check C: setOrgContext calls outside of prisma.$transaction
 */
function checkContextOutsideTransaction(file: SourceFile, relativePath: string): Violation[] {
    const violations: Violation[] = [];
    const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of calls) {
        const callText = call.getExpression().getText();
        
        // Check for setOrgContext calls
        if (callText === 'setOrgContext' || callText.endsWith('.setOrgContext')) {
            // Check if this is inside a $transaction callback
            if (!isInsidePrismaTransaction(call) && !isInsideOrgTransaction(call)) {
                // Check if this is in the router middleware (orgProcedure) - this is the known issue
                if (isInOrgProcedureMiddleware(call)) {
                    violations.push({
                        rule: 'R12',
                        file: relativePath,
                        reason: 'setOrgContext called outside of prisma.$transaction in orgProcedure middleware.',
                        suggestion: 'RLS context may be lost due to connection pooling. Consider wrapping the entire procedure in a transaction or using orgTransaction in handlers.',
                        line: call.getStartLineNumber()
                    });
                }
            }
        }
    }

    return violations;
}

/**
 * Helper: Get Prisma query/mutation info from a call expression
 */
function getPrismaQueryInfo(call: CallExpression): { tableName: string; methodName: string; isQuery: boolean; isMutation: boolean } | null {
    const expression = call.getExpression();
    
    if (expression.getKind() !== SyntaxKind.PropertyAccessExpression) {
        return null;
    }

    const propAccess = expression.asKind(SyntaxKind.PropertyAccessExpression)!;
    const methodName = propAccess.getName();

    if (!ALL_PRISMA_METHODS.includes(methodName)) {
        return null;
    }

    // Get the table name (e.g., prisma.document.findMany -> document)
    const tableAccess = propAccess.getExpression();
    if (tableAccess.getKind() !== SyntaxKind.PropertyAccessExpression) {
        return null;
    }

    const tablePropAccess = tableAccess.asKind(SyntaxKind.PropertyAccessExpression)!;
    const tableName = tablePropAccess.getName();
    const caller = tablePropAccess.getExpression().getText();

    // Check if it's called on prisma or tx
    if (!caller.toLowerCase().includes('prisma') && caller !== 'tx') {
        return null;
    }

    return {
        tableName,
        methodName,
        isQuery: QUERY_METHODS.includes(methodName),
        isMutation: MUTATION_METHODS.includes(methodName)
    };
}

/**
 * Helper: Check if a Prisma query has explicit organizationId filter
 */
function hasExplicitOrgFilter(call: CallExpression): boolean {
    const args = call.getArguments();
    const firstArg = args[0];
    if (!firstArg) return false;

    let argText = firstArg.getText();

    // If the argument is an object literal with a shorthand 'where' property like { where, ... }
    // we need to trace the 'where' variable to see if it contains organizationId
    if (firstArg.getKind() === SyntaxKind.ObjectLiteralExpression) {
        const objLiteral = firstArg.asKind(SyntaxKind.ObjectLiteralExpression);
        if (objLiteral) {
            const whereProperty = objLiteral.getProperty('where');
            if (whereProperty) {
                // Check if it's a shorthand property (just 'where' not 'where: something')
                if (whereProperty.getKind() === SyntaxKind.ShorthandPropertyAssignment) {
                    // Trace the 'where' variable
                    const sourceFile = call.getSourceFile();
                    const varDecls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
                    for (const decl of varDecls) {
                        if (decl.getName() === 'where') {
                            const initializer = decl.getInitializer();
                            if (initializer) {
                                const whereText = initializer.getText();
                                if (containsOrgIdPattern(whereText)) {
                                    return true;
                                }
                            }
                        }
                    }
                } else if (whereProperty.getKind() === SyntaxKind.PropertyAssignment) {
                    // Regular property assignment like 'where: { ... }'
                    const propAssign = whereProperty.asKind(SyntaxKind.PropertyAssignment);
                    if (propAssign) {
                        const whereText = propAssign.getInitializer()?.getText() || '';
                        if (containsOrgIdPattern(whereText)) {
                            return true;
                        }
                    }
                }
            }
            
            // Also check the entire argument text for organizationId patterns
            // This catches cases where organizationId is in the where clause directly
            if (containsOrgIdPattern(argText)) {
                return true;
            }
        }
    }

    // If the argument is a simple identifier (variable reference), try to trace its definition
    if (firstArg.getKind() === SyntaxKind.Identifier) {
        const varName = argText;
        const sourceFile = call.getSourceFile();
        const varDecls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
        for (const decl of varDecls) {
            if (decl.getName() === varName) {
                const initializer = decl.getInitializer();
                if (initializer) {
                    argText = initializer.getText();
                    break;
                }
            }
        }
    }

    // Check for organizationId patterns in the argument text
    if (containsOrgIdPattern(argText)) {
        return true;
    }

    return false;
}

/**
 * Helper: Check if text contains any organizationId-related pattern
 */
function containsOrgIdPattern(text: string): boolean {
    // Check for organizationId in where clause
    if (text.includes('organizationId') || text.includes('organization_id')) {
        return true;
    }

    // Check for ownerOrgId (used in individualProperty)
    if (text.includes('ownerOrgId') || text.includes('owner_org_id')) {
        return true;
    }

    // Check for serviceProviderOrgId (used in service provider cross-tenant access)
    if (text.includes('serviceProviderOrgId') || text.includes('service_provider_org_id')) {
        return true;
    }

    // Check for context.organization.id pattern
    if (text.includes('context.organization.id')) {
        return true;
    }

    return false;
}

/**
 * Helper: Determine the severity of a missing organizationId filter violation
 * - 'info': Intentional cross-org access (staff users) or orgTransaction helper functions
 * - 'warning': Endpoints without auth context (SSE, admin pages)
 * - 'error': Standard violations that need fixing
 */
function determineSeverity(relativePath: string, fileText: string, call: CallExpression): 'error' | 'warning' | 'info' {
    // Staff cross-org access patterns (intentional - info level)
    // These are handlers where staff users need to view data across organizations
    const staffCrossOrgPatterns = [
        // conciergeCase.ts handlers that allow staff to view cases across orgs
        'concierge/conciergeCase.ts'
    ];
    
    // Check if this is a staff cross-org access pattern
    if (staffCrossOrgPatterns.some(p => relativePath.includes(p))) {
        // Look for staff-related context in the surrounding code
        const callText = call.getText();
        const parentText = call.getParent()?.getParent()?.getText() || '';
        const surroundingText = parentText + callText;
        
        // If the code mentions staff context or Cerbos authorization with cross-org intent
        if (fileText.includes('staffOrgContextSet') || 
            fileText.includes('isStaffUser') ||
            surroundingText.includes('Cerbos authorization')) {
            return 'info';
        }
    }
    
    // orgTransaction helper functions (already org-scoped - info level)
    // These are helper functions inside workflows that receive a pre-scoped transaction
    if (relativePath.includes('workflows/') && relativePath.endsWith('Workflow.ts')) {
        // Check if this is inside a helper function that takes a transaction parameter
        const functionParent = call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
        if (functionParent) {
            const params = functionParent.getParameters();
            // If the function takes a 'tx' parameter, it's likely a helper using orgTransaction
            if (params.some(p => p.getName() === 'tx' || p.getTypeNode()?.getText()?.includes('PrismaTransaction'))) {
                return 'info';
            }
        }
    }
    
    // SSE endpoints and admin pages without auth context (warning level)
    // These need architectural changes to add authentication
    const noAuthContextPatterns = [
        'routes/api/v1/',  // Raw API routes (not oRPC)
        'routes/app/admin/',  // Admin pages
        '+server.ts',  // SvelteKit server routes
        '+page.server.ts'  // SvelteKit page server loads
    ];
    
    if (noAuthContextPatterns.some(p => relativePath.includes(p))) {
        // Check if this file has oRPC context (if not, it's a warning)
        if (!fileText.includes('orgProcedure') && !fileText.includes('context.organization')) {
            return 'warning';
        }
    }
    
    // Default: standard error that needs fixing
    return 'error';
}

/**
 * Helper: Check if a Prisma query has explicit associationId filter
 */
function hasExplicitAssocFilter(call: CallExpression): boolean {
    const args = call.getArguments();
    const firstArg = args[0];
    if (!firstArg) return false;

    const argText = firstArg.getText();

    // Check for associationId in where clause
    if (argText.includes('associationId') || argText.includes('association_id')) {
        return true;
    }

    // Check for context.associationId pattern
    if (argText.includes('context.associationId')) {
        return true;
    }

    // Check for context.association.id pattern
    if (argText.includes('context.association.id')) {
        return true;
    }

    return false;
}

/**
 * Helper: Check if we're likely in a CAM context based on file path or imports
 */
function isLikelyCamContext(file: SourceFile, call: CallExpression): boolean {
    const filePath = file.getFilePath();
    
    // CAM-related paths
    const camPaths = [
        '/routes/governance/',
        '/routes/arc/',
        '/routes/violation/',
        '/routes/association',
        '/routes/unit',
        '/routes/ownership',
        '/routes/property.ts',
        '/routes/party.ts'
    ];

    return camPaths.some(p => filePath.includes(p));
}

/**
 * Helper: Check if call is inside orgTransaction
 */
function isInsideOrgTransaction(call: CallExpression): boolean {
    let parent = call.getParent();
    
    while (parent) {
        if (parent.getKind() === SyntaxKind.CallExpression) {
            const parentCall = parent.asKind(SyntaxKind.CallExpression)!;
            const exprText = parentCall.getExpression().getText();
            
            if (exprText === 'orgTransaction' || exprText.includes('orgTransaction')) {
                return true;
            }
        }
        
        // Check if we're in an arrow function that's an argument to orgTransaction
        if (parent.getKind() === SyntaxKind.ArrowFunction || parent.getKind() === SyntaxKind.FunctionExpression) {
            const grandParent = parent.getParent();
            if (grandParent && grandParent.getKind() === SyntaxKind.CallExpression) {
                const gpCall = grandParent.asKind(SyntaxKind.CallExpression)!;
                const gpExprText = gpCall.getExpression().getText();
                if (gpExprText === 'orgTransaction' || gpExprText.includes('orgTransaction')) {
                    return true;
                }
            }
        }
        
        parent = parent.getParent();
    }
    
    return false;
}

/**
 * Helper: Check if call is inside prisma.$transaction
 */
function isInsidePrismaTransaction(call: CallExpression): boolean {
    let parent = call.getParent();
    
    while (parent) {
        if (parent.getKind() === SyntaxKind.CallExpression) {
            const parentCall = parent.asKind(SyntaxKind.CallExpression)!;
            const exprText = parentCall.getExpression().getText();
            
            if (exprText.includes('$transaction')) {
                return true;
            }
        }
        
        // Check if we're in an arrow function that's an argument to $transaction
        if (parent.getKind() === SyntaxKind.ArrowFunction || parent.getKind() === SyntaxKind.FunctionExpression) {
            const grandParent = parent.getParent();
            if (grandParent && grandParent.getKind() === SyntaxKind.CallExpression) {
                const gpCall = grandParent.asKind(SyntaxKind.CallExpression)!;
                const gpExprText = gpCall.getExpression().getText();
                if (gpExprText.includes('$transaction')) {
                    return true;
                }
            }
        }
        
        parent = parent.getParent();
    }
    
    return false;
}

/**
 * Helper: Check if call is in orgProcedure middleware
 */
function isInOrgProcedureMiddleware(call: CallExpression): boolean {
    const file = call.getSourceFile();
    const filePath = file.getFilePath();

    // Check if this is in router.ts
    if (!filePath.includes('router.ts')) {
        return false;
    }

    // Check if we're inside the orgProcedure definition
    let parent = call.getParent();
    while (parent) {
        const text = parent.getText();
        if (text.includes('orgProcedure') && text.includes('.use(')) {
            return true;
        }
        parent = parent.getParent();
    }

    return false;
}

/**
 * Check D: orgProcedure middleware must use withRLSContext for connection pooling safety
 *
 * The issue: Prisma uses connection pooling, so setOrgContext() may set context on
 * one connection while subsequent queries run on different connections.
 *
 * The fix: Use withRLSContext() which wraps all queries in transactions ensuring
 * the SET and query run on the same connection.
 */
function checkOrgProcedureUsesWithRLSContext(file: SourceFile, relativePath: string): Violation[] {
    const violations: Violation[] = [];
    const fileText = file.getText();

    // Check if withRLSContext is imported
    const hasWithRLSContextImport = fileText.includes('withRLSContext');

    // Check if orgProcedure uses withRLSContext
    const orgProcedureMatch = fileText.match(/orgProcedure\s*=[\s\S]*?\.use\s*\(\s*async[\s\S]*?\)\s*=>/);

    if (orgProcedureMatch) {
        // Get the full orgProcedure middleware block
        const startIndex = fileText.indexOf('orgProcedure');
        const endIndex = fileText.indexOf('export const orgRouter', startIndex);
        const orgProcedureBlock = endIndex > startIndex
            ? fileText.substring(startIndex, endIndex)
            : fileText.substring(startIndex);

        // Check if withRLSContext is used in the middleware
        const usesWithRLSContext = orgProcedureBlock.includes('withRLSContext');

        // Check for bare setOrgContext without withRLSContext
        const usesSetOrgContext = orgProcedureBlock.includes('setOrgContext');
        const usesClearOrgContext = orgProcedureBlock.includes('clearOrgContext');

        if (!usesWithRLSContext && (usesSetOrgContext || usesClearOrgContext)) {
            // Find line number approximately
            const lines = fileText.substring(0, startIndex).split('\n');
            const lineNumber = lines.length;

            violations.push({
                rule: 'R12',
                file: relativePath,
                reason: 'orgProcedure middleware uses setOrgContext/clearOrgContext without withRLSContext wrapper.',
                suggestion: 'Use withRLSContext() to wrap the next() call. This ensures RLS context is set on the same database connection as queries, preventing connection pooling race conditions. See src/lib/server/db.ts for the withRLSContext implementation.',
                line: lineNumber
            });
        }

        if (!hasWithRLSContextImport && !usesWithRLSContext) {
            violations.push({
                rule: 'R12',
                file: relativePath,
                reason: 'withRLSContext is not imported in router.ts.',
                suggestion: 'Import withRLSContext from "../db.js" and use it in orgProcedure middleware to ensure connection pooling safety.',
                line: 1
            });
        }
    }

    return violations;
}

/**
 * Check E: Prisma extensions must not call query(args) inside transactions
 *
 * The issue: When using Prisma client extensions, the `query(args)` callback
 * runs on the original client's connection pool, NOT on the transaction client.
 * This breaks RLS context because SET runs on tx but query runs elsewhere.
 *
 * The fix: Use tx[modelName][operation](args) to ensure the query runs on
 * the same transaction connection where context was set.
 */
function checkPrismaExtensionQueryUsage(file: SourceFile, relativePath: string): Violation[] {
    const violations: Violation[] = [];
    const fileText = file.getText();

    // Look for withRLSInjection function
    const hasWithRLSInjection = fileText.includes('withRLSInjection');
    if (!hasWithRLSInjection) {
        violations.push({
            rule: 'R12',
            file: relativePath,
            reason: 'db.ts is missing withRLSInjection Prisma extension for RLS connection pooling safety.',
            suggestion: 'Implement withRLSInjection() that wraps all queries in transactions and uses tx[modelName][operation](args) instead of query(args).',
            line: 1
        });
        return violations;
    }

    // Find the withRLSInjection function and check for problematic patterns
    const extensionMatch = fileText.match(/function\s+withRLSInjection[\s\S]*?(?=\n(?:function|export|const\s+\w+\s*=)|\n\n\/\*\*)/);

    if (extensionMatch) {
        const extensionBlock = extensionMatch[0];

        // Check for the bug pattern: calling query(args) after setting context in transaction
        // This is the problematic pattern:
        //   await tx.$executeRaw`SELECT set_org_context...`
        //   return query(args)  // BUG: runs on wrong connection!
        //
        // The correct pattern is:
        //   await tx.$executeRaw`SELECT set_org_context...`
        //   return tx[modelName][operation](args)  // Correct: runs on tx connection

        // Look for query(args) calls that are NOT in the "already in transaction" early return
        // and NOT in the fallback case
        const lines = extensionBlock.split('\n');
        let inRlsContextBlock = false;
        let afterSetContext = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line === undefined) continue;

            // Track if we're in the rlsContext block (where SET happens)
            if (line.includes('if (rlsContext)') && !line.includes('_inTransaction')) {
                inRlsContextBlock = true;
            }
            if (inRlsContextBlock && line.includes('} else {')) {
                inRlsContextBlock = false;
                afterSetContext = false;
            }

            // Track if SET context was called
            if (inRlsContextBlock && (line.includes('set_org_context') || line.includes('set_current_org_id'))) {
                afterSetContext = true;
            }

            // Check for problematic query(args) call after SET in the RLS context block
            // This is ONLY a problem if:
            // 1. We're in the rlsContext block (not the else block)
            // 2. We're after the SET context call
            // 3. The query(args) is NOT in the _inTransaction early return
            // 4. The query(args) is NOT in the fallback warning case
            if (afterSetContext && line.includes('query(args)')) {
                // Check if this is NOT in the early return or fallback
                const surroundingContext = lines.slice(Math.max(0, i - 5), i + 1).join('\n');

                const isInEarlyReturn = surroundingContext.includes('_inTransaction');
                const isInFallback = surroundingContext.includes('fallback') ||
                    surroundingContext.includes('Could not find model') ||
                    surroundingContext.includes('warn(');

                if (!isInEarlyReturn && !isInFallback) {
                    // This is the bug! query(args) is called after SET but runs on wrong connection
                    const fileLines = fileText.substring(0, fileText.indexOf(extensionBlock)).split('\n');
                    const baseLine = fileLines.length;

                    violations.push({
                        rule: 'R12',
                        file: relativePath,
                        reason: 'withRLSInjection calls query(args) after setting RLS context - this runs on the wrong connection!',
                        suggestion: 'Replace "query(args)" with "tx[modelName][operation](args)" to ensure the query runs on the same transaction connection where RLS context was set.',
                        line: baseLine + i
                    });
                }
            }
        }

        // Also check that the proper pattern EXISTS (tx[modelName][operation])
        const hasCorrectPattern = extensionBlock.includes('tx[modelName]') ||
            extensionBlock.includes('txModel[operation]');

        if (!hasCorrectPattern) {
            violations.push({
                rule: 'R12',
                file: relativePath,
                reason: 'withRLSInjection does not use tx[modelName][operation](args) pattern.',
                suggestion: 'After setting RLS context, execute the query using tx[modelName][operation](args) to ensure it runs on the transaction connection.',
                line: 1
            });
        }
    }

    return violations;
}

/**
 * Check F: SvelteKit page.server.ts files must use orgTransaction for cross-org access
 *
 * The issue: page.server.ts files that use setOrgContext or setOrgContextForWorkItem
 * followed by Prisma queries will fail due to connection pooling. The setOrgContext
 * call sets RLS context on one connection, but subsequent Prisma queries may run
 * on different connections from the pool.
 *
 * The fix: Use orgTransaction() or lookupWorkItemOrgId() + orgTransaction() to ensure
 * all queries run on the same connection where RLS context was set.
 *
 * Correct patterns:
 * 1. lookupWorkItemOrgId() + orgTransaction(orgId, async (tx) => { ... })
 * 2. orgTransaction(orgId, async (tx) => { ... })
 *
 * Incorrect patterns:
 * 1. setOrgContext() + prisma.model.findFirst() (connection pooling issue)
 * 2. setOrgContextForWorkItem() + prisma.model.findFirst() (connection pooling issue)
 */
function checkPageServerRlsUsage(file: SourceFile, relativePath: string): Violation[] {
    const violations: Violation[] = [];
    const fileText = file.getText();

    // Check if file uses RLS context setting functions
    const usesSetOrgContext = fileText.includes('setOrgContext') || 
                              fileText.includes('setOrgContextForWorkItem');
    
    if (!usesSetOrgContext) {
        // No RLS context setting, nothing to check
        return violations;
    }

    // Check if file uses orgTransaction (the correct pattern)
    const usesOrgTransaction = fileText.includes('orgTransaction');

    // Check if file has direct prisma calls (not inside orgTransaction)
    const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);
    const hasPrismaCallsOutsideTransaction: { tableName: string; methodName: string; line: number }[] = [];

    for (const call of calls) {
        const queryInfo = getPrismaQueryInfo(call);
        if (!queryInfo) continue;

        // Check if this Prisma call is inside orgTransaction
        if (!isInsideOrgTransaction(call) && !isInsidePrismaTransaction(call)) {
            hasPrismaCallsOutsideTransaction.push({
                tableName: queryInfo.tableName,
                methodName: queryInfo.methodName,
                line: call.getStartLineNumber()
            });
        }
    }

    // If file uses setOrgContext but has Prisma calls outside transactions, flag it
    if (hasPrismaCallsOutsideTransaction.length > 0) {
        // Check if the file imports setOrgContext/setOrgContextForWorkItem but NOT orgTransaction
        const importsSetOrgContext = fileText.includes("import") && 
            (fileText.includes('setOrgContext') || fileText.includes('setOrgContextForWorkItem'));
        const importsOrgTransaction = fileText.includes("import") && fileText.includes('orgTransaction');

        // If they import setOrgContext but not orgTransaction, this is likely the bug pattern
        if (importsSetOrgContext && !importsOrgTransaction) {
            // Find the line where setOrgContext is called
            const setOrgContextMatch = fileText.match(/setOrgContext(ForWorkItem)?\s*\(/);
            let setOrgContextLine = 1;
            if (setOrgContextMatch && setOrgContextMatch.index !== undefined) {
                setOrgContextLine = fileText.substring(0, setOrgContextMatch.index).split('\n').length;
            }

            violations.push({
                rule: 'R12',
                file: relativePath,
                reason: 'page.server.ts uses setOrgContext/setOrgContextForWorkItem with Prisma queries outside orgTransaction.',
                suggestion: 'Due to connection pooling, setOrgContext may set RLS context on a different connection than subsequent queries. Use orgTransaction() to wrap all Prisma queries, ensuring they run on the same connection where RLS context was set. Pattern: const orgId = await lookupWorkItemOrgId(...); await orgTransaction(orgId, async (tx) => { /* queries using tx */ });',
                line: setOrgContextLine,
                severity: 'error'
            });

            // Also flag each Prisma call outside transaction
            for (const prismaCall of hasPrismaCallsOutsideTransaction) {
                violations.push({
                    rule: 'R12',
                    file: relativePath,
                    reason: `Prisma query '${prismaCall.tableName}.${prismaCall.methodName}' outside orgTransaction in page.server.ts with RLS context setting.`,
                    suggestion: 'Move this query inside the orgTransaction callback to ensure it uses the same connection where RLS context was set.',
                    line: prismaCall.line,
                    severity: 'warning'
                });
            }
        }
    }

    // Additional check: If file uses clearOrgContext in finally block, it's the old pattern
    if (fileText.includes('clearOrgContext') && fileText.includes('finally')) {
        const clearOrgContextMatch = fileText.match(/finally\s*\{[\s\S]*?clearOrgContext/);
        if (clearOrgContextMatch) {
            let line = 1;
            if (clearOrgContextMatch.index !== undefined) {
                line = fileText.substring(0, clearOrgContextMatch.index).split('\n').length;
            }

            violations.push({
                rule: 'R12',
                file: relativePath,
                reason: 'page.server.ts uses clearOrgContext in finally block - this is the old pattern that has connection pooling issues.',
                suggestion: 'Replace setOrgContext/clearOrgContext pattern with orgTransaction(). The transaction automatically handles context cleanup.',
                line,
                severity: 'error'
            });
        }
    }

    return violations;
}
