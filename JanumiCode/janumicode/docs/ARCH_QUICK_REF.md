# Architecture Quick Reference

## 🏗️ 4-Layer Architecture

```
┌─ Presentation (ui/, webview/)
├─ Business Logic (workflow/, orchestrator/, roles/)
├─ Infrastructure (database/, llm/, cli/)
└─ Foundation (types/, primitives/)
```

**Rule**: Dependencies flow **downward only**

## 🚫 Common Violations

| Violation | Why | Fix |
|-----------|-----|-----|
| UI → Database | Tight coupling | Use workflow layer stores |
| UI → CLI | Security risk | Use event bus |
| Business → UI | Reverse dependency | Use events, not direct imports |
| Infrastructure → Business | Breaks DI principle | Use callbacks/events |
| Foundation → Any upper layer | **CRITICAL** | Move to correct layer |

## 📊 Severity Levels

- 🔴 **ERROR**: Blocks build - fix immediately
- 🟡 **WARN**: Technical debt - fix soon
- 🔵 **INFO**: Awareness only

## 🛠️ Common Commands

```bash
# Run structural tests
pnpm run test:structure

# Validate with dependency-cruiser
pnpm run arch:validate

# Collect metrics
pnpm run arch:metrics

# Check for drift
pnpm run arch:drift

# Set new baseline
pnpm run arch:baseline
```

## 🎯 Layer Rules

### Presentation (ui/, webview/)
✅ **CAN** import from: Business Logic, Foundation  
❌ **CANNOT** import from: Database internals, CLI internals  
**Why**: Keeps UI testable and portable

### Business Logic (workflow/, orchestrator/, roles/)
✅ **CAN** import from: Infrastructure (interfaces), Foundation  
❌ **CANNOT** import from: UI, webview  
**Why**: Business logic must be UI-agnostic

### Infrastructure (database/, llm/, cli/)
✅ **CAN** import from: Foundation only  
❌ **CANNOT** import from: Business Logic, UI  
**Why**: Infrastructure is passive, controlled by business logic

### Foundation (types/, primitives/)
✅ **CAN** import from: Node stdlib, npm packages, other foundation  
❌ **CANNOT** import from: **ANY** application layer  
**Why**: Foundation must be reusable across projects

## 🔄 Circular Dependencies

**Zero tolerance** - any cycle is an error.

**If found**:
1. Check the Mermaid diagram in test output
2. Look for "weakest coupling" suggestion
3. Extract shared types to common module
4. Use dependency injection/events

## 🤖 Agent-Specific Rules

### Prompt Files (roles/, context/)
- ❌ No `any` types
- ✅ System prompts as `const`
- ✅ Strong typing for inputs

### LLM Calls
- ✅ Include retry logic
- ✅ Validate responses
- ✅ Redact PII

### Workflows
- ❌ No `Date.now()`, `Math.random()`
- ❌ No direct I/O (fs, process.env)
- ✅ Use dependency injection

## 📈 Health Metrics

**Score 90-100 (A)**: Excellent architecture  
**Score 80-89 (B)**: Good, minor issues  
**Score 70-79 (C)**: Moderate debt  
**Score 60-69 (D)**: Needs attention  
**Score <60 (F)**: Critical issues

**Baseline drift fails CI if**:
- Any new errors
- Warnings increase >10%
- New circular dependencies
- Health score drops >10 points

## 🩺 Health Checklist

Before PR:
- [ ] `pnpm run test:structure` passes
- [ ] `pnpm run arch:drift` passes
- [ ] No new circular dependencies
- [ ] Foundation modules have zero upward deps
- [ ] LLM calls have retry logic
- [ ] Context has PII redaction

## 🆘 Troubleshooting

**"Foundation upward deps" error**:
→ File in types/ or primitives/ imports from application layer  
→ Move file to correct layer or extract shared types

**"Circular dependency" error**:
→ Check Mermaid diagram in output  
→ Remove weakest import or extract interface

**"High fan-out" warning**:
→ Module has >20 dependencies  
→ Extract utilities or use dependency injection

**"LLM unauthorized access" warning**:
→ Non-role module accessing LLM provider  
→ Route through roles/, cli/, documents/, or curation/

## 📚 Full Documentation

See `docs/ARCHITECTURE.md` for complete reference.
