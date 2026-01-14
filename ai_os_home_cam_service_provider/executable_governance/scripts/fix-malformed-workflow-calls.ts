#!/usr/bin/env bun
/**
 * Automation Script: Fix Malformed DBOS.startWorkflow Calls
 *
 * This script fixes malformed DBOS.startWorkflow calls that have workflowID specified twice.
 *
 * Pattern detected:
 *   BEFORE: DBOS.startWorkflow(wf_v1, { workflowID: workflowId })(input, { workflowID: idempotencyKey })
 *   AFTER:  DBOS.startWorkflow(wf_v1, { workflowID: idempotencyKey })(input)
 *
 * Usage:
 *   bun run scripts/fix-malformed-workflow-calls.ts [--dry-run]
 */

import { Project } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface FixResult {
    file: string;
    fixesApplied: number;
    success: boolean;
    error?: string;
}

class MalformedWorkflowCallFixer {
    private project: Project;
    private dryRun: boolean;
    private results: FixResult[] = [];

    constructor(options: { dryRun?: boolean } = {}) {
        this.dryRun = options.dryRun || false;
        this.project = new Project({
            tsConfigFilePath: path.join(__dirname, '../../hestami-ai-os/tsconfig.json'),
        });
    }

    /**
     * Fix a single file using regex pattern matching
     */
    async fixFile(filePath: string): Promise<FixResult> {
        const result: FixResult = {
            file: filePath,
            fixesApplied: 0,
            success: false,
        };

        try {
            let content = fs.readFileSync(filePath, 'utf-8');
            const originalContent = content;

            // Pattern: DBOS.startWorkflow(workflow, { workflowID: X })(input, { workflowID: idempotencyKey })
            // Replace with: DBOS.startWorkflow(workflow, { workflowID: idempotencyKey })(input)

            // Match the malformed pattern and fix it
            const pattern = /(DBOS\.startWorkflow\([^,]+,\s*\{\s*workflowID:\s*)([^}]+)(\s*\}\)\()([^,)]+)(,\s*\{\s*workflowID:\s*idempotencyKey\s*\})/g;

            content = content.replace(pattern, (match, prefix, oldWorkflowId, middle, inputArg, malformedSuffix) => {
                result.fixesApplied++;
                // Replace oldWorkflowId with idempotencyKey and remove the malformed second options
                return `${prefix}idempotencyKey${middle}${inputArg}`;
            });

            if (content !== originalContent) {
                if (!this.dryRun) {
                    fs.writeFileSync(filePath, content, 'utf-8');
                }
                result.success = true;
            } else {
                result.success = true;
            }

            this.results.push(result);
            return result;

        } catch (error: any) {
            result.error = error.message;
            this.results.push(result);
            return result;
        }
    }

    /**
     * Fix all workflow files
     */
    async fixAllWorkflows(): Promise<void> {
        const workflowsDir = path.join(__dirname, '../../hestami-ai-os/src/lib/server/workflows');
        const files = glob.sync('**/*.ts', { cwd: workflowsDir, absolute: true });

        console.log(`Found ${files.length} workflow files to check\n`);

        for (const fullPath of files) {
            const fileName = path.basename(fullPath);
            const result = await this.fixFile(fullPath);

            if (result.fixesApplied > 0) {
                console.log(`✓ ${fileName}: ${result.fixesApplied} fix(es) applied`);
            }
        }
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
            console.log('  bun run verify');
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');

    console.log('🔧 Malformed Workflow Call Fixer');
    console.log('='.repeat(60));
    if (dryRun) {
        console.log('MODE: DRY RUN (no files will be modified)');
    }
    console.log('');

    const fixer = new MalformedWorkflowCallFixer({ dryRun });
    await fixer.fixAllWorkflows();
    fixer.printSummary();
}

main().catch(console.error);