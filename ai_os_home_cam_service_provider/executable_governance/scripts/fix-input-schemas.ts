#!/usr/bin/env bun
/**
 * Automation Script: Fix R3 Input Schema Violations
 *
 * This script automatically adds idempotencyKey to input schemas for mutating
 * oRPC handlers that are missing it.
 *
 * Pattern detected:
 *   BEFORE: .input(z.object({ id: z.string(), ... }))
 *   AFTER:  .input(z.object({ idempotencyKey: z.string().uuid(), id: z.string(), ... }))
 *
 * Usage:
 *   bun run scripts/fix-input-schemas.ts [--dry-run] [--file <path>]
 *
 * Options:
 *   --dry-run          Show what would be changed without modifying files
 *   --file <path>      Fix only the specified file
 *   --verbose          Show detailed progress
 *   --interactive      Ask for confirmation before each fix
 */

import { Project, CallExpression, Node } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

interface Violation {
    file: string;
    line: number;
    reason: string;
}

interface FixResult {
    file: string;
    fixesApplied: number;
    lineNumbers: number[];
    skipped: number;
    success: boolean;
    error?: string;
}

class InputSchemaFixer {
    private project: Project;
    private dryRun: boolean;
    private verbose: boolean;
    private violations: Violation[];
    private results: FixResult[] = [];

    constructor(options: { dryRun?: boolean; verbose?: boolean } = {}) {
        this.dryRun = options.dryRun || false;
        this.verbose = options.verbose || false;
        this.project = new Project({
            tsConfigFilePath: path.join(__dirname, '../../hestami-ai-os/tsconfig.json'),
        });
        this.violations = this.loadViolations();
    }

    /**
     * Load R3 input schema violations from mutations_final.json
     */
    private loadViolations(): Violation[] {
        const violationsPath = path.join(__dirname, '../check_results/mutations_final.json');

        if (!fs.existsSync(violationsPath)) {
            console.warn('⚠ mutations_final.json not found. Run governance check first.');
            return [];
        }

        let rawContent = fs.readFileSync(violationsPath, 'utf-8');

        // Handle case where JSON has output prepended (e.g., "Checking mutations... ✖\n{...}")
        const jsonStart = rawContent.indexOf('{');
        if (jsonStart > 0) {
            rawContent = rawContent.substring(jsonStart);
        }

        const data = JSON.parse(rawContent);

        return data.violations
            .filter((v: any) =>
                v.rule === 'R3' &&
                v.reason.includes('missing idempotencyKey in input schema')
            )
            .map((v: any) => ({
                file: v.file,
                line: v.line,
                reason: v.reason,
            }));
    }

    /**
     * Fix a single file
     */
    async fixFile(filePath: string): Promise<FixResult> {
        const result: FixResult = {
            file: filePath,
            fixesApplied: 0,
            lineNumbers: [],
            skipped: 0,
            success: false,
        };

        try {
            // Get violations for this file
            const pathParts = filePath.replace(/\\/g, '/').split('hestami-ai-os/');
            const relPath = pathParts[1] ?? filePath;
            const fileViolations = this.violations.filter(v =>
                v.file.endsWith(relPath) || relPath.endsWith(v.file)
            );

            if (fileViolations.length === 0) {
                if (this.verbose) {
                    console.log(`  ℹ No violations found for ${path.basename(filePath)}`);
                }
                result.success = true;
                return result;
            }

            const sourceFile = this.project.addSourceFileAtPath(filePath);
            let modified = false;

            // Find all .input() calls on mutating handlers
            sourceFile.forEachDescendant((node) => {
                if (Node.isPropertyAssignment(node)) {
                    const name = node.getName();

                    // Check if this is a mutating handler
                    if (this.isMutatingName(name)) {
                        const fixed = this.fixInputSchema(node);
                        if (fixed) {
                            modified = true;
                            result.fixesApplied++;
                            result.lineNumbers.push(node.getStartLineNumber());

                            if (this.verbose) {
                                console.log(`  ✓ Fixed '${name}' at line ${node.getStartLineNumber()}`);
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
     * Check if a handler name is mutating
     */
    private isMutatingName(name: string): boolean {
        const mutatingWords = [
            'create', 'update', 'delete', 'upsert', 'patch', 'post', 'put',
            'approve', 'void', 'process', 'submit', 'record'
        ];
        return mutatingWords.some(word => name.toLowerCase().includes(word));
    }

    /**
     * Fix the input schema of a handler property
     */
    private fixInputSchema(propertyNode: Node): boolean {
        // Find the .input() call in this property
        let inputCall: CallExpression | undefined;

        propertyNode.forEachDescendant((node) => {
            if (Node.isCallExpression(node)) {
                const expr = node.getExpression();
                if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'input') {
                    inputCall = node;
                    return;
                }
            }
        });

        if (!inputCall) return false;

        const args = inputCall.getArguments();
        if (args.length === 0) return false;

        const schemaArg = args[0];
        if (!schemaArg) return false;

        const schemaText = schemaArg.getText();

        // Skip if already has idempotencyKey or IdempotencyKeySchema
        if (schemaText.includes('idempotencyKey') || schemaText.includes('IdempotencyKeySchema')) {
            return false;
        }

        // Handle different schema patterns
        if (Node.isCallExpression(schemaArg)) {
            // Pattern: z.object({ ... })
            return this.addToZodObject(schemaArg);
        }

        return false;
    }

    /**
     * Add idempotencyKey to a z.object() call
     */
    private addToZodObject(zodCall: CallExpression): boolean {
        const args = zodCall.getArguments();
        if (args.length === 0) return false;

        const objectArg = args[0];

        if (Node.isObjectLiteralExpression(objectArg)) {
            // Add idempotencyKey as the first property
            objectArg.insertProperty(0, 'idempotencyKey: z.string().uuid()');
            return true;
        }

        return false;
    }

    /**
     * Fix files from violations list
     */
    async fixAllViolations(): Promise<void> {
        if (this.violations.length === 0) {
            console.log('No violations to fix!');
            return;
        }

        // Group violations by file
        const fileGroups = new Map<string, Violation[]>();
        for (const violation of this.violations) {
            if (!fileGroups.has(violation.file)) {
                fileGroups.set(violation.file, []);
            }
            fileGroups.get(violation.file)!.push(violation);
        }

        console.log(`Found ${this.violations.length} violations in ${fileGroups.size} files\n`);

        const baseDir = path.join(__dirname, '../../hestami-ai-os');

        for (const [relPath, violations] of fileGroups) {
            const fullPath = path.join(baseDir, relPath);

            if (!fs.existsSync(fullPath)) {
                console.log(`⚠ Skipping ${relPath} (not found)`);
                continue;
            }

            const fileName = path.basename(fullPath);
            if (this.verbose) {
                console.log(`Processing ${fileName} (${violations.length} violation(s))...`);
            }

            const result = await this.fixFile(fullPath);

            if (!this.verbose && result.fixesApplied > 0) {
                console.log(`✓ ${fileName}: ${result.fixesApplied} fix(es) applied`);
            } else if (!this.verbose && result.fixesApplied === 0 && violations.length > 0) {
                console.log(`⚠ ${fileName}: 0 fixes (may already be fixed or need manual review)`);
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

        console.log(`\nViolations found: ${this.violations.length}`);
        console.log(`Files processed: ${totalFiles}`);
        console.log(`Files modified: ${filesModified}`);
        console.log(`Total fixes applied: ${totalFixes}`);

        const remaining = this.violations.length - totalFixes;
        if (remaining > 0) {
            console.log(`Remaining violations: ${remaining} (may need manual review)`);
        }

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

        if (remaining > 0) {
            console.log('\n⚠ Some violations may require manual fixes:');
            console.log('  - Handlers using IdempotencyKeySchema.extend()');
            console.log('  - Complex schema patterns');
            console.log('  - Already fixed but not detected');
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

    console.log('🔧 R3 Input Schema Auto-Fixer');
    console.log('='.repeat(60));
    if (dryRun) {
        console.log('MODE: DRY RUN (no files will be modified)');
    }
    console.log('');

    const fixer = new InputSchemaFixer({ dryRun, verbose });

    if (specificFile) {
        console.log(`Processing single file: ${specificFile}\n`);
        await fixer.fixFile(specificFile);
    } else {
        await fixer.fixAllViolations();
    }

    fixer.printSummary();
}

main().catch(console.error);