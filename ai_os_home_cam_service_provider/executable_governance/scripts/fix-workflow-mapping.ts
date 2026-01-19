#!/usr/bin/env bun
/**
 * Automation Script: Fix R3 Workflow Mapping Violations
 *
 * This script automatically fixes DBOS.startWorkflow calls that are missing
 * the workflowID parameter mapping to idempotencyKey.
 *
 * Pattern detected:
 *   BEFORE: DBOS.startWorkflow(workflow, { ...opts })(input)
 *   AFTER:  DBOS.startWorkflow(workflow, { workflowID: idempotencyKey, ...opts })(input)
 *
 * Usage:
 *   bun run scripts/fix-workflow-mapping.ts [--dry-run] [--file <path>]
 *
 * Options:
 *   --dry-run          Show what would be changed without modifying files
 *   --file <path>      Fix only the specified file
 *   --verbose          Show detailed progress
 */

import { Project, SyntaxKind, CallExpression, Node } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

interface FixResult {
    file: string;
    fixesApplied: number;
    lineNumbers: number[];
    success: boolean;
    error?: string;
}

class WorkflowMappingFixer {
    private project: Project;
    private dryRun: boolean;
    private verbose: boolean;
    private results: FixResult[] = [];

    constructor(options: { dryRun?: boolean; verbose?: boolean } = {}) {
        this.dryRun = options.dryRun || false;
        this.verbose = options.verbose || false;
        this.project = new Project({
            tsConfigFilePath: path.join(__dirname, '../../hestami-ai-os/tsconfig.json'),
        });
    }

    /**
     * Fix a single file
     */
    async fixFile(filePath: string): Promise<FixResult> {
        const result: FixResult = {
            file: filePath,
            fixesApplied: 0,
            lineNumbers: [],
            success: false,
        };

        try {
            const sourceFile = this.project.addSourceFileAtPath(filePath);
            let modified = false;

            // Find all DBOS.startWorkflow calls
            sourceFile.forEachDescendant((node) => {
                if (Node.isCallExpression(node)) {
                    const expression = node.getExpression();
                    const text = expression.getText();

                    // Check if this is a DBOS.startWorkflow call
                    if (text.includes('DBOS.startWorkflow')) {
                        const fixed = this.fixWorkflowCall(node);
                        if (fixed) {
                            modified = true;
                            result.fixesApplied++;
                            result.lineNumbers.push(node.getStartLineNumber());

                            if (this.verbose) {
                                console.log(`  ✓ Fixed at line ${node.getStartLineNumber()}`);
                            }
                        }
                    }
                }
            });

            if (modified && !this.dryRun) {
                await sourceFile.save();
            }

            result.success = true;
            this.results.push(result);
            return result;

        } catch (error: any) {
            result.error = error.message;
            this.results.push(result);
            return result;
        }
    }

    /**
     * Fix a DBOS.startWorkflow call expression
     */
    private fixWorkflowCall(call: CallExpression): boolean {
        const args = call.getArguments();

        // DBOS.startWorkflow(workflow, options?)
        // We need at least 1 argument (the workflow)
        if (args.length < 1) return false;

        // Check if options object exists
        if (args.length === 1) {
            // No options - add { workflowID: idempotencyKey }
            call.insertArgument(1, '{ workflowID: idempotencyKey }');
            return true;
        }

        // Options object exists - check if it already has workflowID
        const optionsArg = args[1];
        if (!optionsArg) {
            call.insertArgument(1, '{ workflowID: idempotencyKey }');
            return true;
        }
        const optionsText = optionsArg.getText();

        // Skip if already has workflowID
        if (optionsText.includes('workflowID')) {
            return false;
        }

        // Add workflowID to existing options
        if (Node.isObjectLiteralExpression(optionsArg)) {
            // Options is an object literal - add workflowID as first property
            optionsArg.insertProperty(0, 'workflowID: idempotencyKey');
            return true;
        } else if (optionsText.startsWith('{') && optionsText.endsWith('}')) {
            // Options is a simple object - prepend workflowID
            const newOptions = `{ workflowID: idempotencyKey, ${optionsText.slice(1, -1).trim()} }`;
            optionsArg.replaceWithText(newOptions);
            return true;
        } else {
            // Options is a variable/spread - wrap with workflowID
            const newOptions = `{ workflowID: idempotencyKey, ...${optionsText} }`;
            optionsArg.replaceWithText(newOptions);
            return true;
        }
    }

    /**
     * Fix all workflow files
     */
    async fixAllWorkflows(): Promise<void> {
        const workflowsDir = path.join(__dirname, '../../hestami-ai-os/src/lib/server/workflows');
        const files = this.getTypeScriptFiles(workflowsDir);

        console.log(`Found ${files.length} workflow files to process...\n`);

        for (const file of files) {
            const fileName = path.basename(file);
            if (this.verbose) {
                console.log(`Processing ${fileName}...`);
            }

            const result = await this.fixFile(file);

            if (!this.verbose && result.fixesApplied > 0) {
                console.log(`✓ ${fileName}: ${result.fixesApplied} fix(es) applied`);
            }
        }
    }

    /**
     * Fix specific route files with workflow calls
     */
    async fixRoutesWithWorkflows(): Promise<void> {
        const routeFiles = [
            'src/lib/server/api/routes/association.ts',
            'src/lib/server/api/routes/concierge/conciergeCase.ts',
            'src/routes/api/internal/tus-hook/+server.ts',
        ];

        const baseDir = path.join(__dirname, '../../hestami-ai-os');

        console.log(`\nProcessing ${routeFiles.length} route files with workflow calls...\n`);

        for (const relPath of routeFiles) {
            const fullPath = path.join(baseDir, relPath);
            if (!fs.existsSync(fullPath)) {
                console.log(`⚠ Skipping ${relPath} (not found)`);
                continue;
            }

            const fileName = path.basename(fullPath);
            if (this.verbose) {
                console.log(`Processing ${fileName}...`);
            }

            const result = await this.fixFile(fullPath);

            if (!this.verbose && result.fixesApplied > 0) {
                console.log(`✓ ${fileName}: ${result.fixesApplied} fix(es) applied`);
            }
        }
    }

    /**
     * Get all TypeScript files in a directory recursively
     */
    private getTypeScriptFiles(dir: string): string[] {
        const files: string[] = [];

        if (!fs.existsSync(dir)) {
            return files;
        }

        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                files.push(...this.getTypeScriptFiles(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
                files.push(fullPath);
            }
        }

        return files;
    }

    /**
     * Print summary report
     */
    printSummary(): void {
        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));

        const totalFiles = this.results.length;
        const filesModified = this.results.filter(r => r.fixesApplied > 0).length;
        const totalFixes = this.results.reduce((sum, r) => sum + r.fixesApplied, 0);
        const errors = this.results.filter(r => !r.success).length;

        console.log(`\nFiles processed: ${totalFiles}`);
        console.log(`Files modified: ${filesModified}`);
        console.log(`Total fixes applied: ${totalFixes}`);
        if (errors > 0) {
            console.log(`Errors: ${errors}`);
        }

        if (this.dryRun) {
            console.log('\n⚠ DRY RUN MODE - No files were actually modified');
        }

        if (totalFixes > 0) {
            console.log('\n✓ Next step: Run governance check to verify:');
            console.log('  bun run src/cli.ts verify mutations');
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const verbose = args.includes('--verbose');
    const fileIndex = args.indexOf('--file');
    const specificFile = fileIndex >= 0 ? args[fileIndex + 1] : null;

    console.log('🔧 R3 Workflow Mapping Auto-Fixer');
    console.log('='.repeat(60));
    if (dryRun) {
        console.log('MODE: DRY RUN (no files will be modified)');
    }
    console.log('');

    const fixer = new WorkflowMappingFixer({ dryRun, verbose });

    if (specificFile) {
        console.log(`Processing single file: ${specificFile}\n`);
        await fixer.fixFile(specificFile);
    } else {
        await fixer.fixAllWorkflows();
        await fixer.fixRoutesWithWorkflows();
    }

    fixer.printSummary();
}

main().catch(console.error);