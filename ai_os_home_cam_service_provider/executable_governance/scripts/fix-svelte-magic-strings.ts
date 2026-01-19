/**
 * Automated fixer script for Svelte magic string violations
 *
 * This script:
 * 1. Runs the governance checker to get violations
 * 2. Filters for Svelte file Prisma enum magic string violations
 * 3. Adds necessary imports from $lib/api/cam
 * 4. Replaces magic strings with enum const references
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

// Mapping from enum value to the *Values const object that contains it
// This is built by parsing cam.ts to find all exported *Values objects
interface EnumMapping {
    constName: string;      // e.g., 'WorkOrderStatusValues'
    values: Set<string>;    // e.g., Set(['OPEN', 'IN_PROGRESS', 'CLOSED'])
}

interface Violation {
    rule: string;
    file: string;
    reason: string;
    suggestion: string;
    line: number;
    severity: string;
}

interface FileChanges {
    imports: Set<string>;
    replacements: Map<number, Array<{ from: string; to: string }>>;
}

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

function log(...args: any[]) {
    console.log(...args);
}

function verbose(...args: any[]) {
    if (VERBOSE) console.log(...args);
}

/**
 * Parse cam.ts to build a mapping of enum values to their const object names
 */
function buildEnumMappings(camTsPath: string): Map<string, EnumMapping> {
    const content = readFileSync(camTsPath, 'utf-8');
    const mappings = new Map<string, EnumMapping>();

    // Match: export const XxxValues = { VALUE1: 'VALUE1', ... } as const;
    // Using a more robust regex that handles multiline
    const constRegex = /export const (\w+Values)\s*=\s*\{([^}]+)\}\s*as\s*const/g;

    let match;
    while ((match = constRegex.exec(content)) !== null) {
        const constName = match[1]!;
        const body = match[2]!;

        // Extract values from the object body
        const valueRegex = /(\w+):\s*['"](\w+)['"]/g;
        const values = new Set<string>();

        let valueMatch;
        while ((valueMatch = valueRegex.exec(body)) !== null) {
            // The key and value should match for our const pattern
            values.add(valueMatch[1]!);
        }

        if (values.size > 0) {
            mappings.set(constName, { constName, values });
        }
    }

    return mappings;
}

/**
 * Build reverse lookup: enum value -> const object name(s)
 */
function buildValueToConstLookup(mappings: Map<string, EnumMapping>): Map<string, string[]> {
    const lookup = new Map<string, string[]>();

    for (const [constName, mapping] of mappings) {
        for (const value of mapping.values) {
            const existing = lookup.get(value) || [];
            existing.push(constName);
            lookup.set(value, existing);
        }
    }

    return lookup;
}

/**
 * Extract the enum value from a violation reason
 */
function extractEnumValue(reason: string): string | null {
    const match = reason.match(/Magic string "([^"]+)"/);
    return match ? match[1]! : null;
}

/**
 * Check if violation is a Svelte Prisma enum magic string
 */
function isSveltePrismaEnumViolation(v: Violation): boolean {
    return v.file.endsWith('.svelte') &&
           v.reason.includes('Magic string') &&
           v.reason.includes('Prisma enum');
}

/**
 * Select the best const to use for a value
 * Prefers more specific names over generic ones
 */
function selectBestConst(value: string, constNames: string[], fileContent: string): string {
    if (constNames.length === 1) {
        return constNames[0]!;
    }

    // Priority rules:
    // 1. If one of them is already imported, use that
    for (const name of constNames) {
        if (fileContent.includes(`import { ${name}`) || fileContent.includes(`, ${name}`)) {
            return name;
        }
    }

    // 2. Prefer specific names based on context
    // Status values
    if (['ACTIVE', 'INACTIVE', 'PENDING', 'APPROVED', 'SUSPENDED'].includes(value)) {
        // Look for context-specific status
        if (fileContent.includes('WorkOrder') || fileContent.includes('work-order')) {
            const wo = constNames.find(n => n.startsWith('WorkOrder'));
            if (wo) return wo;
        }
        if (fileContent.includes('Staff') || fileContent.includes('staff')) {
            const staff = constNames.find(n => n.startsWith('Staff'));
            if (staff) return staff;
        }
        if (fileContent.includes('Vendor') || fileContent.includes('vendor')) {
            const vendor = constNames.find(n => n.startsWith('Vendor'));
            if (vendor) return vendor;
        }
        if (fileContent.includes('Document') || fileContent.includes('document')) {
            const doc = constNames.find(n => n.startsWith('Document'));
            if (doc) return doc;
        }
        if (fileContent.includes('ServiceContract') || fileContent.includes('service-contract')) {
            const sc = constNames.find(n => n.startsWith('ServiceContract'));
            if (sc) return sc;
        }
        if (fileContent.includes('Organization') || fileContent.includes('organization')) {
            const org = constNames.find(n => n.startsWith('Organization'));
            if (org) return org;
        }
        if (fileContent.includes('Asset') || fileContent.includes('asset')) {
            const asset = constNames.find(n => n.startsWith('Asset'));
            if (asset) return asset;
        }
        if (fileContent.includes('Concierge') || fileContent.includes('concierge') || fileContent.includes('service-call')) {
            const conc = constNames.find(n => n.startsWith('Concierge'));
            if (conc) return conc;
        }
        if (fileContent.includes('Violation') || fileContent.includes('violation')) {
            const viol = constNames.find(n => n.startsWith('Violation'));
            if (viol) return viol;
        }
        if (fileContent.includes('ARC') || fileContent.includes('arc')) {
            const arc = constNames.find(n => n.startsWith('ARC'));
            if (arc) return arc;
        }
        if (fileContent.includes('Meeting') || fileContent.includes('meeting')) {
            const meeting = constNames.find(n => n.startsWith('Meeting'));
            if (meeting) return meeting;
        }
        if (fileContent.includes('Motion') || fileContent.includes('motion')) {
            const motion = constNames.find(n => n.startsWith('BoardMotion'));
            if (motion) return motion;
        }
        if (fileContent.includes('Job') || fileContent.includes('job')) {
            const job = constNames.find(n => n.startsWith('Job'));
            if (job) return job;
        }
        if (fileContent.includes('Invitation') || fileContent.includes('invitation')) {
            const inv = constNames.find(n => n.startsWith('Invitation'));
            if (inv) return inv;
        }
        if (fileContent.includes('Intent') || fileContent.includes('intent')) {
            const intent = constNames.find(n => n.startsWith('OwnerIntent'));
            if (intent) return intent;
        }
        if (fileContent.includes('OwnerRequest') || fileContent.includes('owner-request')) {
            const or = constNames.find(n => n.startsWith('OwnerRequest'));
            if (or) return or;
        }
    }

    // 3. For category values
    if (value.includes('CATEGORY') || ['HVAC', 'PLUMBING', 'ELECTRICAL', 'GENERAL', 'OTHER'].includes(value)) {
        if (fileContent.includes('WorkOrder') || fileContent.includes('work-order')) {
            const wo = constNames.find(n => n === 'WorkOrderCategoryValues');
            if (wo) return wo;
        }
        if (fileContent.includes('ARC') || fileContent.includes('arc')) {
            const arc = constNames.find(n => n === 'ARCCategoryValues');
            if (arc) return arc;
        }
        if (fileContent.includes('Document') || fileContent.includes('document')) {
            const doc = constNames.find(n => n === 'DocumentCategoryValues');
            if (doc) return doc;
        }
    }

    // 4. For role values
    if (['OWNER', 'ADMIN', 'CAM', 'TECHNICIAN', 'BOOKKEEPER', 'ESTIMATOR'].includes(value)) {
        if (fileContent.includes('ServiceProvider') || fileContent.includes('service-provider')) {
            const sp = constNames.find(n => n === 'ServiceProviderRoleValues');
            if (sp) return sp;
        }
        if (fileContent.includes('Staff') || fileContent.includes('staff')) {
            const staff = constNames.find(n => n === 'StaffRoleValues');
            if (staff) return staff;
        }
        if (fileContent.includes('User') || fileContent.includes('user')) {
            const user = constNames.find(n => n === 'UserRoleValues');
            if (user) return user;
        }
        if (fileContent.includes('PropertyOwnership') || fileContent.includes('ownership')) {
            const po = constNames.find(n => n === 'PropertyOwnershipRoleValues');
            if (po) return po;
        }
    }

    // 5. For property types
    if (['SINGLE_FAMILY', 'CONDO', 'TOWNHOME', 'COMMERCIAL', 'MIXED_USE', 'APARTMENT'].includes(value)) {
        return 'PropertyTypeValues';
    }

    // 6. For priority values
    if (['URGENT', 'EMERGENCY', 'HIGH', 'MEDIUM', 'LOW', 'MODERATE'].includes(value)) {
        if (fileContent.includes('WorkOrder') || fileContent.includes('work-order')) {
            const wo = constNames.find(n => n === 'WorkOrderPriorityValues');
            if (wo) return wo;
        }
        if (fileContent.includes('Concierge') || fileContent.includes('concierge') || fileContent.includes('service-call')) {
            const conc = constNames.find(n => n === 'ConciergeCasePriorityValues');
            if (conc) return conc;
        }
        if (fileContent.includes('Intent') || fileContent.includes('intent')) {
            const intent = constNames.find(n => n === 'OwnerIntentPriorityValues');
            if (intent) return intent;
        }
    }

    // 7. For entity type values
    if (fileContent.includes('Activity') || fileContent.includes('activity') ||
        ['WORK_ORDER', 'VENDOR', 'VIOLATION', 'ARC_REQUEST', 'PROPERTY', 'UNIT', 'MEETING', 'MOTION'].includes(value)) {
        const activity = constNames.find(n => n === 'ActivityEntityTypeValues');
        if (activity) return activity;
    }

    // 8. For document context types
    if (['WORK_ORDER', 'VENDOR', 'PROPERTY', 'UNIT', 'JOB', 'VIOLATION', 'ARC_REQUEST'].includes(value)) {
        if (fileContent.includes('Document') || fileContent.includes('document') || fileContent.includes('contextType')) {
            const doc = constNames.find(n => n === 'DocumentContextTypeValues');
            if (doc) return doc;
        }
    }

    // Default: use the first one (shortest name often most generic)
    return constNames.sort((a, b) => a.length - b.length)[0]!;
}

/**
 * Process a single Svelte file
 */
function processSvelteFile(
    filePath: string,
    violations: Violation[],
    valueToConst: Map<string, string[]>,
    projectRoot: string
): { modified: boolean; changes: string[] } {
    const fullPath = path.join(projectRoot, filePath);
    if (!existsSync(fullPath)) {
        log(`  File not found: ${fullPath}`);
        return { modified: false, changes: [] };
    }

    let content = readFileSync(fullPath, 'utf-8');
    const originalContent = content;
    const changes: string[] = [];
    const neededImports = new Set<string>();

    // Group violations by line to handle multiple on same line
    const violationsByLine = new Map<number, Violation[]>();
    for (const v of violations) {
        const existing = violationsByLine.get(v.line) || [];
        existing.push(v);
        violationsByLine.set(v.line, existing);
    }

    // Track replacements we've made
    const replacementsMade = new Set<string>();

    // Process each violation
    for (const v of violations) {
        const enumValue = extractEnumValue(v.reason);
        if (!enumValue) continue;

        const constNames = valueToConst.get(enumValue);
        if (!constNames || constNames.length === 0) {
            verbose(`  No const found for value: ${enumValue}`);
            continue;
        }

        const constName = selectBestConst(enumValue, constNames, content);
        neededImports.add(constName);

        // Build replacement patterns for this value
        // We need to handle various patterns:
        // - status === 'VALUE'
        // - status !== 'VALUE'
        // - status: 'VALUE'
        // - case 'VALUE':
        // - === "VALUE"
        // - !== "VALUE"
        // - status === VALUE (already using const - skip)

        const patterns = [
            // Comparison patterns
            {
                regex: new RegExp(`(\\w+)\\s*===\\s*['"]${enumValue}['"]`, 'g'),
                replacement: `$1 === ${constName}.${enumValue}`
            },
            {
                regex: new RegExp(`(\\w+)\\s*!==\\s*['"]${enumValue}['"]`, 'g'),
                replacement: `$1 !== ${constName}.${enumValue}`
            },
            // Array includes patterns
            {
                regex: new RegExp(`\\[\\s*['"]${enumValue}['"]\\s*\\]`, 'g'),
                replacement: `[${constName}.${enumValue}]`
            },
            // Property assignment patterns (for objects)
            {
                regex: new RegExp(`(status|type|category|priority|role|visibility|contextType|entityType):\\s*['"]${enumValue}['"]`, 'g'),
                replacement: `$1: ${constName}.${enumValue}`
            },
            // Case clause patterns
            {
                regex: new RegExp(`case\\s+['"]${enumValue}['"]\\s*:`, 'g'),
                replacement: `case ${constName}.${enumValue}:`
            },
            // Array literal with multiple values - handle one at a time
            {
                regex: new RegExp(`(['"])${enumValue}\\1`, 'g'),
                replacement: `${constName}.${enumValue}`
            }
        ];

        for (const { regex, replacement } of patterns) {
            const matches = content.match(regex);
            if (matches) {
                const key = `${enumValue}:${regex.source}`;
                if (!replacementsMade.has(key)) {
                    const beforeReplace = content;
                    content = content.replace(regex, replacement);
                    if (content !== beforeReplace) {
                        changes.push(`Replaced '${enumValue}' with ${constName}.${enumValue}`);
                        replacementsMade.add(key);
                    }
                }
            }
        }
    }

    // Add imports if needed
    if (neededImports.size > 0) {
        // Check existing imports from $lib/api/cam
        const camImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"](\$lib\/api\/cam)['"]/;
        const camImportMatch = content.match(camImportRegex);

        if (camImportMatch) {
            // Parse existing imports
            const existingImports = camImportMatch[1]!
                .split(',')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            // Find imports we need to add
            const importsToAdd = [...neededImports].filter(imp => !existingImports.includes(imp));

            if (importsToAdd.length > 0) {
                // Build new import list
                const allImports = [...existingImports, ...importsToAdd].sort();
                const newImportLine = `import { ${allImports.join(', ')} } from '$lib/api/cam'`;

                content = content.replace(camImportRegex, newImportLine);
                changes.push(`Added imports: ${importsToAdd.join(', ')}`);
            }
        } else {
            // No existing cam.ts import - add one after the script tag
            const scriptTagRegex = /<script[^>]*lang=["']ts["'][^>]*>/;
            const scriptMatch = content.match(scriptTagRegex);

            if (scriptMatch) {
                const importStatement = `\n\timport { ${[...neededImports].sort().join(', ')} } from '$lib/api/cam';`;
                content = content.replace(scriptMatch[0], scriptMatch[0] + importStatement);
                changes.push(`Added new import from $lib/api/cam: ${[...neededImports].join(', ')}`);
            }
        }
    }

    const modified = content !== originalContent;

    if (modified && !DRY_RUN) {
        writeFileSync(fullPath, content, 'utf-8');
    }

    return { modified, changes };
}

async function main() {
    log('=== Svelte Magic String Fixer ===');
    if (DRY_RUN) log('(Dry run mode - no files will be modified)');
    log('');

    const projectRoot = path.resolve(process.cwd(), '../hestami-ai-os');
    const camTsPath = path.join(projectRoot, 'src/lib/api/cam.ts');

    // Step 1: Build enum mappings from cam.ts
    log('Step 1: Building enum mappings from cam.ts...');
    const enumMappings = buildEnumMappings(camTsPath);
    log(`  Found ${enumMappings.size} *Values const objects`);

    const valueToConst = buildValueToConstLookup(enumMappings);
    log(`  Mapped ${valueToConst.size} unique enum values`);

    // Step 2: Run governance checker to get violations
    log('\nStep 2: Running governance checker...');
    let violations: Violation[];
    try {
        const output = execSync('bun run src/cli.ts verify stringly --json', {
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large output
            stdio: ['pipe', 'pipe', 'pipe'] // Capture stderr too
        });

        // Parse JSON from output (skip the "Checking..." line)
        const jsonStart = output.indexOf('{');
        if (jsonStart === -1) {
            throw new Error('No JSON output found');
        }
        const jsonStr = output.substring(jsonStart);
        const result = JSON.parse(jsonStr);
        violations = result.violations || [];
    } catch (e: any) {
        // execSync throws on non-zero exit, but we still get stdout
        if (e.stdout) {
            const output = e.stdout.toString();
            const jsonStart = output.indexOf('{');
            if (jsonStart !== -1) {
                const jsonStr = output.substring(jsonStart);
                const result = JSON.parse(jsonStr);
                violations = result.violations || [];
            } else {
                log('Error running governance checker:', e.message);
                process.exit(1);
            }
        } else {
            log('Error running governance checker:', e.message);
            process.exit(1);
        }
    }

    // Step 3: Filter for Svelte Prisma enum violations
    const svelteViolations = violations.filter(isSveltePrismaEnumViolation);
    log(`  Found ${svelteViolations.length} Svelte Prisma enum magic string violations`);

    // Step 4: Group violations by file
    const violationsByFile = new Map<string, Violation[]>();
    for (const v of svelteViolations) {
        const existing = violationsByFile.get(v.file) || [];
        existing.push(v);
        violationsByFile.set(v.file, existing);
    }
    log(`  Across ${violationsByFile.size} files`);

    // Step 5: Process each file
    log('\nStep 3: Processing files...');
    let filesModified = 0;
    let totalChanges = 0;

    for (const [filePath, fileViolations] of violationsByFile) {
        verbose(`\nProcessing ${filePath} (${fileViolations.length} violations)...`);

        const result = processSvelteFile(filePath, fileViolations, valueToConst, projectRoot);

        if (result.modified) {
            filesModified++;
            totalChanges += result.changes.length;
            log(`  ✓ ${filePath}: ${result.changes.length} changes`);
            for (const change of result.changes) {
                verbose(`    - ${change}`);
            }
        } else if (result.changes.length > 0) {
            log(`  ~ ${filePath}: Would make ${result.changes.length} changes (dry run)`);
        }
    }

    // Summary
    log('\n=== Summary ===');
    log(`Files processed: ${violationsByFile.size}`);
    log(`Files modified: ${filesModified}`);
    log(`Total changes: ${totalChanges}`);

    if (DRY_RUN) {
        log('\n(Dry run mode - no files were actually modified)');
        log('Run without --dry-run to apply changes.');
    }
}

main().catch(console.error);
