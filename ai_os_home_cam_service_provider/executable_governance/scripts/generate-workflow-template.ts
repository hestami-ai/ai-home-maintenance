#!/usr/bin/env bun
/**
 * Workflow Template Generator
 *
 * Generates DBOS workflow templates for wrapping Prisma mutations (R2 violations).
 *
 * This tool analyzes Prisma mutation calls and generates boilerplate workflow code
 * to wrap them, ensuring durability and idempotency.
 *
 * Usage:
 *   bun run scripts/generate-workflow-template.ts <model> <operation> [options]
 *
 * Examples:
 *   bun run scripts/generate-workflow-template.ts BankAccount create
 *   bun run scripts/generate-workflow-template.ts GLAccount update
 *   bun run scripts/generate-workflow-template.ts Party delete
 *
 * Options:
 *   --output <path>    Output file path (default: stdout)
 *   --format <type>    Output format: typescript|markdown (default: typescript)
 */

import * as fs from 'fs';
import * as path from 'path';

interface WorkflowTemplate {
    modelName: string;
    operation: 'create' | 'update' | 'delete' | 'upsert';
    workflowCode: string;
    handlerCode: string;
    types: string;
}

class WorkflowTemplateGenerator {
    private modelName: string;
    private operation: string;
    private camelCaseModel: string;

    constructor(modelName: string, operation: string) {
        this.modelName = modelName;
        this.operation = operation.toLowerCase();
        this.camelCaseModel = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    }

    /**
     * Generate complete workflow template
     */
    generate(): WorkflowTemplate {
        return {
            modelName: this.modelName,
            operation: this.operation as any,
            workflowCode: this.generateWorkflowCode(),
            handlerCode: this.generateHandlerCode(),
            types: this.generateTypes(),
        };
    }

    /**
     * Generate workflow function code
     */
    private generateWorkflowCode(): string {
        const workflowName = `${this.camelCaseModel}${this.capitalize(this.operation)}Workflow`;

        switch (this.operation) {
            case 'create':
                return `/**
 * DBOS Workflow: Create ${this.modelName}
 *
 * Wraps Prisma create operation in a durable workflow for idempotency.
 * Uses workflowID from idempotencyKey to ensure exact-once semantics.
 */
export async function ${workflowName}(
    input: ${this.modelName}CreateInput
): Promise<${this.modelName}> {
    // Validate input (optional)
    // You can add business logic validation here

    // Perform the database mutation
    const result = await prisma.${this.camelCaseModel}.create({
        data: {
            // Map input fields to Prisma create data
            ...input,
        },
    });

    // Optional: Trigger side effects (notifications, events, etc.)
    // await DBOS.invoke(sendNotification, { ... });

    return result;
}

// Register the workflow with DBOS
export const ${workflowName}_v1 = DBOS.registerWorkflow(${workflowName});

/**
 * Workflow starter function
 *
 * Call this from your oRPC handler to start the workflow.
 */
export async function start${this.capitalize(this.camelCaseModel)}${this.capitalize(this.operation)}Workflow(
    input: ${this.modelName}CreateInput,
    idempotencyKey: string
): Promise<${this.modelName}> {
    const handle = await DBOS.startWorkflow(
        ${workflowName}_v1,
        { workflowID: idempotencyKey }
    )(input);
    return handle.getResult();
}`;

            case 'update':
                return `/**
 * DBOS Workflow: Update ${this.modelName}
 *
 * Wraps Prisma update operation in a durable workflow for idempotency.
 */
export async function ${workflowName}(
    input: ${this.modelName}UpdateInput
): Promise<${this.modelName}> {
    const { id, ...updateData } = input;

    // Perform the database mutation
    const result = await prisma.${this.camelCaseModel}.update({
        where: { id },
        data: updateData,
    });

    return result;
}

export const ${workflowName}_v1 = DBOS.registerWorkflow(${workflowName});

export async function start${this.capitalize(this.camelCaseModel)}${this.capitalize(this.operation)}Workflow(
    input: ${this.modelName}UpdateInput,
    idempotencyKey: string
): Promise<${this.modelName}> {
    const handle = await DBOS.startWorkflow(
        ${workflowName}_v1,
        { workflowID: idempotencyKey }
    )(input);
    return handle.getResult();
}`;

            case 'delete':
                return `/**
 * DBOS Workflow: Delete ${this.modelName}
 *
 * Wraps Prisma soft/hard delete in a durable workflow for idempotency.
 */
export async function ${workflowName}(
    input: ${this.modelName}DeleteInput
): Promise<{ success: boolean }> {
    const { id } = input;

    // Soft delete (recommended)
    await prisma.${this.camelCaseModel}.update({
        where: { id },
        data: { deletedAt: new Date() },
    });

    // OR Hard delete (use with caution)
    // await prisma.${this.camelCaseModel}.delete({
    //     where: { id },
    // });

    return { success: true };
}

export const ${workflowName}_v1 = DBOS.registerWorkflow(${workflowName});

export async function start${this.capitalize(this.camelCaseModel)}${this.capitalize(this.operation)}Workflow(
    input: ${this.modelName}DeleteInput,
    idempotencyKey: string
): Promise<{ success: boolean }> {
    const handle = await DBOS.startWorkflow(
        ${workflowName}_v1,
        { workflowID: idempotencyKey }
    )(input);
    return handle.getResult();
}`;

            default:
                throw new Error(`Unsupported operation: ${this.operation}`);
        }
    }

    /**
     * Generate handler code for using the workflow
     */
    private generateHandlerCode(): string {
        return `// In your oRPC handler file (e.g., routes/${this.camelCaseModel}.ts)

import { start${this.capitalize(this.camelCaseModel)}${this.capitalize(this.operation)}Workflow } from '$lib/server/workflows/${this.camelCaseModel}Workflow';

export const ${this.camelCaseModel}Router = {
    ${this.operation}: orgProcedure
        .input(
            z.object({
                idempotencyKey: z.string().uuid(),
                // ... your input fields
            })
        )
        .handler(async ({ input, context, errors }) => {
            // Authorization check
            await context.cerbos.authorize('${this.operation}', '${this.camelCaseModel}', 'new');

            // Call the workflow
            const result = await start${this.capitalize(this.camelCaseModel)}${this.capitalize(this.operation)}Workflow(
                input,
                input.idempotencyKey
            );

            return successResponse({ ${this.camelCaseModel}: result }, context);
        }),
};`;
    }

    /**
     * Generate TypeScript type definitions
     */
    private generateTypes(): string {
        switch (this.operation) {
            case 'create':
                return `// Type definitions for ${this.modelName} ${this.operation}

export interface ${this.modelName}CreateInput {
    // TODO: Add your input fields based on Prisma schema
    // Example:
    // name: string;
    // description?: string;
    // isActive?: boolean;
}`;

            case 'update':
                return `// Type definitions for ${this.modelName} ${this.operation}

export interface ${this.modelName}UpdateInput {
    id: string;
    // TODO: Add your update fields (make them optional)
    // Example:
    // name?: string;
    // description?: string;
    // isActive?: boolean;
}`;

            case 'delete':
                return `// Type definitions for ${this.modelName} ${this.operation}

export interface ${this.modelName}DeleteInput {
    id: string;
}`;

            default:
                return '';
        }
    }

    /**
     * Capitalize first letter of string
     */
    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Format output
     */
    formatOutput(format: 'typescript' | 'markdown'): string {
        const template = this.generate();

        if (format === 'markdown') {
            return `# ${this.modelName} ${this.capitalize(this.operation)} Workflow Template

Generated on: ${new Date().toISOString()}

## Workflow File
Create: \`src/lib/server/workflows/${this.camelCaseModel}Workflow.ts\`

\`\`\`typescript
${template.types}

${template.workflowCode}
\`\`\`

## Handler Integration
Update your route handler:

\`\`\`typescript
${template.handlerCode}
\`\`\`

## Checklist
- [ ] Create workflow file
- [ ] Add types based on Prisma schema
- [ ] Update handler to use workflow
- [ ] Add error handling
- [ ] Add tests
- [ ] Run governance check to verify
`;
        } else {
            // TypeScript format
            return `// ============================================================================
// ${this.modelName} ${this.capitalize(this.operation)} Workflow
// Generated on: ${new Date().toISOString()}
// ============================================================================

${template.types}

${template.workflowCode}

// ============================================================================
// Handler Integration Example
// ============================================================================

${template.handlerCode}
`;
        }
    }
}

// Main execution
function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Usage: bun run scripts/generate-workflow-template.ts <model> <operation> [options]');
        console.error('');
        console.error('Examples:');
        console.error('  bun run scripts/generate-workflow-template.ts BankAccount create');
        console.error('  bun run scripts/generate-workflow-template.ts GLAccount update');
        console.error('  bun run scripts/generate-workflow-template.ts Party delete');
        process.exit(1);
    }

    const [modelName, operation] = args;
    const outputIndex = args.indexOf('--output');
    const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
    const formatIndex = args.indexOf('--format');
    const format = (formatIndex >= 0 ? args[formatIndex + 1] : 'typescript') as 'typescript' | 'markdown';

    const generator = new WorkflowTemplateGenerator(modelName, operation);
    const output = generator.formatOutput(format);

    if (outputPath) {
        fs.writeFileSync(outputPath, output, 'utf-8');
        console.log(`✓ Template generated: ${outputPath}`);
    } else {
        console.log(output);
    }
}

main();