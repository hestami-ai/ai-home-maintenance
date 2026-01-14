# Governance Violation Automation Scripts

This directory contains automation tools to help fix the 514 governance violations identified in the Hestami AI OS codebase.

## 📋 Quick Start

```bash
cd executable_governance

# 1. Install dependencies (if not already done)
bun install

# 2. Run automation scripts in order
bun run scripts/fix-workflow-mapping.ts --dry-run    # Preview changes
bun run scripts/fix-workflow-mapping.ts              # Apply fixes

bun run scripts/fix-input-schemas.ts --dry-run       # Preview changes
bun run scripts/fix-input-schemas.ts                 # Apply fixes

# 3. Verify fixes
bun run src/cli.ts verify mutations
```

---

## 🛠️ Available Scripts

### 1. fix-workflow-mapping.ts
**Purpose**: Automatically fix R3 workflow mapping violations (144 violations)

**What it does**:
- Finds all `DBOS.startWorkflow()` calls missing `workflowID` parameter
- Adds `{ workflowID: idempotencyKey }` to the options
- Handles multiple patterns (with/without existing options)

**Usage**:
```bash
# Dry run (preview only, no changes)
bun run scripts/fix-workflow-mapping.ts --dry-run

# Apply fixes to all workflow files
bun run scripts/fix-workflow-mapping.ts

# Verbose output
bun run scripts/fix-workflow-mapping.ts --verbose

# Fix specific file
bun run scripts/fix-workflow-mapping.ts --file path/to/file.ts
```

**Example transformations**:
```typescript
// BEFORE
DBOS.startWorkflow(myWorkflow_v1)(input)

// AFTER
DBOS.startWorkflow(myWorkflow_v1, { workflowID: idempotencyKey })(input)
```

```typescript
// BEFORE
DBOS.startWorkflow(myWorkflow_v1, { timeout: 5000 })(input)

// AFTER
DBOS.startWorkflow(myWorkflow_v1, { workflowID: idempotencyKey, timeout: 5000 })(input)
```

**Time savings**: ~2 hours (3-5 hours manual → 1-2 hours with script)

---

### 2. fix-input-schemas.ts
**Purpose**: Automatically fix R3 input schema violations (42 violations)

**What it does**:
- Reads violations from `mutations_final.json`
- Finds mutating oRPC handlers missing `idempotencyKey`
- Adds `idempotencyKey: z.string().uuid()` as first field in schema

**Usage**:
```bash
# Dry run (preview only, no changes)
bun run scripts/fix-input-schemas.ts --dry-run

# Apply fixes to all violated files
bun run scripts/fix-input-schemas.ts

# Verbose output
bun run scripts/fix-input-schemas.ts --verbose

# Fix specific file
bun run scripts/fix-input-schemas.ts --file path/to/file.ts
```

**Example transformations**:
```typescript
// BEFORE
create: orgProcedure
  .input(z.object({
    name: z.string(),
    email: z.string().email(),
  }))

// AFTER
create: orgProcedure
  .input(z.object({
    idempotencyKey: z.string().uuid(),  // ✅ Added
    name: z.string(),
    email: z.string().email(),
  }))
```

**Time savings**: ~1-2 hours (2-4 hours manual → 1-2 hours with script + review)

---

### 3. generate-workflow-template.ts
**Purpose**: Generate DBOS workflow templates for wrapping Prisma mutations (R2 violations)

**What it does**:
- Generates complete workflow boilerplate code
- Creates handler integration examples
- Provides type definitions
- Supports create, update, delete operations

**Usage**:
```bash
# Generate workflow template for BankAccount create
bun run scripts/generate-workflow-template.ts BankAccount create

# Generate and save to file
bun run scripts/generate-workflow-template.ts GLAccount update --output glAccountWorkflow.ts

# Generate markdown documentation
bun run scripts/generate-workflow-template.ts Party delete --format markdown
```

**Example output**:
```typescript
// Type definitions
export interface BankAccountCreateInput {
    // TODO: Add your input fields
}

// Workflow function
export async function bankAccountCreateWorkflow(
    input: BankAccountCreateInput
): Promise<BankAccount> {
    const result = await prisma.bankAccount.create({
        data: { ...input },
    });
    return result;
}

// Registration
export const bankAccountCreateWorkflow_v1 = DBOS.registerWorkflow(bankAccountCreateWorkflow);

// Starter function
export async function startBankAccountCreateWorkflow(
    input: BankAccountCreateInput,
    idempotencyKey: string
): Promise<BankAccount> {
    const handle = await DBOS.startWorkflow(
        bankAccountCreateWorkflow_v1,
        { workflowID: idempotencyKey }
    )(input);
    return handle.getResult();
}
```

**Time savings**: ~15-20 min per workflow template (258 R2 violations = significant time savings)

---

## 📊 Expected Results

### After Running fix-workflow-mapping.ts
- **Violations before**: 514 (256 R3, 258 R2)
- **Violations after**: ~370 (112 R3, 258 R2)
- **Fixed**: 144 R3 workflow mapping violations
- **Time**: 1-2 hours (vs 3-5 hours manual)

### After Running fix-input-schemas.ts
- **Violations before**: ~370
- **Violations after**: ~328 (70 R3, 258 R2)
- **Fixed**: 42 R3 input schema violations
- **Time**: 1-2 hours (vs 2-4 hours manual)

### Total R3 Automation Impact
- **Total R3 violations**: 186 remaining before automation
- **Automated fixes**: 186 (100% of R3 violations)
- **Manual review needed**: ~10% (edge cases, already fixed)
- **Time saved**: ~4-5 hours

---

## 🔍 Validation

After running the automation scripts, verify the fixes:

```bash
# Run governance check
cd executable_governance
bun run src/cli.ts verify mutations

# Check specific rule
bun run src/cli.ts verify mutations --json | grep -c '"R3"'

# View detailed results
bun run src/cli.ts verify mutations --json > check_results/mutations_post_automation.json
```

Expected results:
- R3 violations should drop from 256 to ~70
- R2 violations remain at 258 (requires manual workflow creation)

---

## 🚨 Common Issues & Troubleshooting

### Issue: Script reports "0 fixes applied"
**Causes**:
- Violations already fixed manually
- File patterns don't match expectations
- Files already use `IdempotencyKeySchema`

**Solution**:
```bash
# Run with --verbose to see what's being detected
bun run scripts/fix-input-schemas.ts --verbose --dry-run

# Check if files use IdempotencyKeySchema
grep -r "IdempotencyKeySchema" src/lib/server/api/routes/
```

### Issue: TypeScript errors after running scripts
**Causes**:
- Missing imports for `z` or `DBOS`
- Syntax issues in generated code

**Solution**:
```bash
# Run TypeScript check
cd ../hestami-ai-os
npm run check

# Fix imports manually if needed
```

### Issue: Governance check still shows violations
**Causes**:
- Edge cases not handled by automation
- Complex schema patterns (nested objects, conditionals)
- Files need manual review

**Solution**:
1. Review remaining violations in `mutations_final.json`
2. Fix manually using the patterns from the script
3. Use `--file` option to test script on specific files

---

## 📝 Manual Review Checklist

After running automation scripts:

- [ ] Run governance check: `bun run src/cli.ts verify mutations`
- [ ] Review any remaining R3 violations
- [ ] Test a sample of modified files
- [ ] Run TypeScript check: `npm run check`
- [ ] Run tests: `npm test`
- [ ] Commit changes with clear message:
  ```bash
  git add .
  git commit -m "fix: automated R3 violation remediation (186 violations)

  - Added workflowID mapping to DBOS.startWorkflow calls
  - Added idempotencyKey to mutating handler input schemas
  - Used automation scripts from executable_governance/scripts/

  Violations: 514 → ~328 (-36%)"
  ```

---

## 🎯 Next Steps: R2 Violations (Manual Work)

R2 violations require architectural changes (wrapping Prisma mutations in workflows). Use the workflow template generator to speed this up:

### For each R2 violation:

1. **Generate template**:
   ```bash
   bun run scripts/generate-workflow-template.ts BankAccount create
   ```

2. **Create workflow file**:
   - Save generated code to `src/lib/server/workflows/bankAccountWorkflow.ts`
   - Customize input types based on Prisma schema
   - Add business logic if needed

3. **Update handler**:
   - Import workflow starter function
   - Replace Prisma call with workflow call
   - Ensure idempotencyKey is passed

4. **Test**:
   - Unit test the workflow
   - Integration test the handler
   - Verify idempotency (call twice with same key)

5. **Verify**:
   ```bash
   bun run src/cli.ts verify mutations
   ```

---

## 📚 Additional Resources

- **Governance Rules**: `../README.md`
- **Implementation Roadmap**: `../VIOLATIONS_IMPLEMENTATION_ROADMAP.md`
- **Violations Summary**: `../VIOLATIONS_SUMMARY.md`
- **DBOS Documentation**: https://docs.dbos.dev/

---

## 🤝 Contributing

If you improve these scripts or add new automation:

1. Update this README
2. Add tests if applicable
3. Document edge cases
4. Update time estimates

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the `mutations_final.json` for specific violations
3. Consult the implementation roadmap for context
4. Test with `--dry-run` and `--verbose` flags first