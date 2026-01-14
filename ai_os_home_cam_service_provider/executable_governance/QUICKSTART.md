# 🚀 Quick Start: Automated Governance Violation Remediation

Get started fixing violations in 5 minutes with automation!

## ⚡ TL;DR - Run This Now

```bash
cd ai_os_home_cam_service_provider/executable_governance

# 1. Preview what will be fixed (safe, no changes)
bun run fix:all:dry

# 2. Apply all automated fixes
bun run fix:all

# 3. Verify the fixes worked
bun run verify
```

**Expected Result**: ~186 R3 violations eliminated in 2-3 minutes!

---

## 📋 Step-by-Step Guide

### Step 1: Check Current Status (30 seconds)

```bash
cd ai_os_home_cam_service_provider/executable_governance

# See current violation count
bun run verify
```

You should see:
```
✖ Found 514 violations:
  - R2: 258 (Prisma mutations outside workflows)
  - R3: 256 (Missing idempotencyKey)
```

---

### Step 2: Preview Automated Fixes (1 minute)

```bash
# See what WOULD be changed (no files modified)
bun run fix:all:dry
```

This runs both automation scripts in dry-run mode:
- **Workflow mapping fixer**: Shows which `DBOS.startWorkflow` calls will be updated
- **Input schema fixer**: Shows which handlers will get `idempotencyKey` added

Review the output to understand what will change.

---

### Step 3: Apply Automated Fixes (2 minutes)

```bash
# Apply all fixes automatically
bun run fix:all
```

Or run them individually:

```bash
# Fix workflow mapping violations first (144 violations)
bun run fix:workflows

# Then fix input schema violations (42 violations)
bun run fix:schemas
```

---

### Step 4: Verify Success (30 seconds)

```bash
# Run governance check again
bun run verify
```

**Expected Result**:
```
✖ Found ~328 violations:
  - R2: 258 (unchanged - needs manual work)
  - R3: ~70 (down from 256!)
```

**Success!** You've eliminated ~186 R3 violations (36% reduction) automatically!

---

## 🎯 What Just Happened?

### Workflow Mapping Fixes (144 violations)
The script found patterns like this:

```typescript
// BEFORE ❌
const handle = await DBOS.startWorkflow(myWorkflow_v1)(input);

// AFTER ✅
const handle = await DBOS.startWorkflow(
    myWorkflow_v1,
    { workflowID: idempotencyKey }
)(input);
```

### Input Schema Fixes (42 violations)
The script found patterns like this:

```typescript
// BEFORE ❌
create: orgProcedure
    .input(z.object({
        name: z.string(),
        email: z.string().email(),
    }))

// AFTER ✅
create: orgProcedure
    .input(z.object({
        idempotencyKey: z.string().uuid(),  // ← Added
        name: z.string(),
        email: z.string().email(),
    }))
```

---

## ✅ Post-Automation Checklist

After running the scripts:

- [ ] **Review Changes**: Use `git diff` to see what was modified
- [ ] **TypeScript Check**: Run `cd ../hestami-ai-os && npm run check`
- [ ] **Run Tests**: Run `npm test` to ensure nothing broke
- [ ] **Manual Review**: Check remaining ~70 R3 violations
- [ ] **Commit**: Save your progress with a clear commit message

---

## 🔍 Manual Review of Remaining Violations

Some violations need manual review because:

1. **Already Fixed**: Files using `IdempotencyKeySchema.extend()` or complex patterns
2. **Edge Cases**: Nested workflows, conditional calls, or complex schema structures
3. **False Positives**: Detection limitations

To see remaining violations:

```bash
# Generate detailed JSON report
bun run verify:json > check_results/remaining_violations.json

# View R3 violations only
bun run verify:json | grep '"R3"' | wc -l
```

Review the remaining violations and fix manually using the same patterns.

---

## 🛠️ Manual Fixes (If Needed)

If some files weren't automatically fixed:

### For Missing idempotencyKey:
```typescript
// Pattern
.input(z.object({
    idempotencyKey: z.string().uuid(),  // ← Add this as first field
    // ... rest of your fields
}))
```

### For Missing workflowID:
```typescript
// Pattern
await DBOS.startWorkflow(
    workflow_v1,
    { workflowID: idempotencyKey }  // ← Add this
)(input);
```

---

## 📊 Next Steps: R2 Violations (Manual Work Required)

The 258 R2 violations require wrapping Prisma mutations in DBOS workflows. Use the template generator:

```bash
# Generate a workflow template
bun run template BankAccount create

# Generate and save to file
bun run template GLAccount update --output ../hestami-ai-os/src/lib/server/workflows/glAccountWorkflow.ts

# Generate with documentation
bun run template Party delete --format markdown > party-workflow-guide.md
```

See [VIOLATIONS_IMPLEMENTATION_ROADMAP.md](./VIOLATIONS_IMPLEMENTATION_ROADMAP.md) for the complete R2 remediation plan.

---

## 🆘 Troubleshooting

### "0 fixes applied" message

**Solution**: Some files may already be compliant. Check with:
```bash
grep -r "IdempotencyKeySchema" ../hestami-ai-os/src/lib/server/api/routes/
```

### TypeScript errors after running scripts

**Solution**: Run TypeScript check and fix any import issues:
```bash
cd ../hestami-ai-os
npm run check
```

### Still seeing violations after automation

**Solution**: Some edge cases need manual review. See remaining violations:
```bash
cd ../executable_governance
bun run verify:json | grep -A 5 '"R3"' | head -30
```

---

## 📝 Commit Your Changes

Once you've verified everything works:

```bash
cd ../hestami-ai-os

# Review changes
git status
git diff

# Commit
git add .
git commit -m "fix: automated R3 violation remediation

- Fixed 144 workflow mapping violations (workflowID)
- Fixed 42 input schema violations (idempotencyKey)
- Used automation scripts from executable_governance/scripts/

Violations reduced from 514 to ~328 (-36%)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## 🎓 Learn More

- **Automation Details**: [scripts/README.md](./scripts/README.md)
- **Implementation Roadmap**: [VIOLATIONS_IMPLEMENTATION_ROADMAP.md](./VIOLATIONS_IMPLEMENTATION_ROADMAP.md)
- **Governance Rules**: [README.md](./README.md)

---

## 🎉 Success Metrics

After running automation:

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Total Violations** | 514 | ~328 | -36% |
| **R3 Violations** | 256 | ~70 | -73% |
| **Time Spent** | ~6-9 hours (manual) | ~2-3 hours (automated) | **4-6 hours saved!** |

**You're now ready to tackle the remaining 328 violations!** 🚀

Start with Priority 3.1 (Infrastructure) from the implementation roadmap.