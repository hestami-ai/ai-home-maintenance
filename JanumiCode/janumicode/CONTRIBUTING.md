# Contributing to JanumiCode

Thank you for your interest in contributing to JanumiCode! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)
- [Issue Reporting](#issue-reporting)
- [Areas for Contribution](#areas-for-contribution)

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **VS Code**: Latest stable version
- **Git**: For version control
- **TypeScript**: Experience with TypeScript recommended
- **SQLite**: Basic knowledge helpful

### First Steps

1. **Fork the Repository**
   ```bash
   # Visit https://github.com/yourorg/janumicode
   # Click "Fork" button
   ```

2. **Clone Your Fork**
   ```bash
   git clone https://github.com/your-username/janumicode.git
   cd janumicode
   ```

3. **Add Upstream Remote**
   ```bash
   git remote add upstream https://github.com/yourorg/janumicode.git
   ```

4. **Install Dependencies**
   ```bash
   npm install
   ```

5. **Build the Project**
   ```bash
   npm run compile
   ```

6. **Run in Development Mode**
   - Open project in VS Code
   - Press `F5` to launch Extension Development Host
   - Test your changes in the new VS Code window

## Development Setup

### Environment Configuration

Create a `.env` file in the project root (not committed to git):

```env
# Optional: API keys for testing
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Optional: Test database path
TEST_DATABASE_PATH=.janumicode-test/test.db
```

### VS Code Configuration

Recommended VS Code settings for development (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.exclude": {
    "out": false,
    "dist": false
  }
}
```

### Useful npm Scripts

```bash
# Compile TypeScript
npm run compile

# Watch mode (auto-compile on changes)
npm run watch

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build VSIX package
npm run package
```

## Project Structure

```
janumicode/
├── src/
│   ├── extension.ts           # Extension entry point
│   ├── lib/
│   │   ├── artifacts/         # Phase 3: Blob storage
│   │   ├── claudeCode/        # Phase 9.3: CLI integration
│   │   ├── config/            # Phase 1.5: Configuration
│   │   ├── context/           # Phase 5: Context compilation
│   │   ├── database/          # Phase 1.2-1.3: SQLite layer
│   │   ├── dialogue/          # Phase 2: Dialogue system
│   │   ├── errorHandling/     # Phase 9.4: Error recovery
│   │   ├── events/            # Phase 1.4: Event logging
│   │   ├── integration/       # Phase 9.1: Component wiring
│   │   ├── llm/               # Phase 4: LLM abstraction
│   │   ├── roles/             # Phase 6: Role implementations
│   │   ├── types/             # TypeScript type definitions
│   │   ├── ui/                # Phase 8: UI components
│   │   └── workflow/          # Phase 7: State machine
│   └── test/                  # Test suite
├── docs/                      # Documentation
├── .eslintrc.json             # ESLint configuration
├── tsconfig.json              # TypeScript configuration
├── package.json               # Extension manifest
└── CONTRIBUTING.md            # This file
```

### Module Organization

Each module follows this pattern:

```
module/
├── index.ts              # Public exports
├── [feature].ts          # Implementation files
└── __tests__/            # Tests for this module
    └── [feature].test.ts
```

## Development Workflow

### Creating a Feature Branch

```bash
# Sync with upstream
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-number-description
```

### Making Changes

1. **Write Code**
   - Follow coding standards (see below)
   - Add tests for new functionality
   - Update documentation as needed

2. **Test Your Changes**
   ```bash
   # Run tests
   npm test

   # Test in Extension Development Host
   # Press F5 in VS Code
   ```

3. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"

   # Follow conventional commits format:
   # feat: new feature
   # fix: bug fix
   # docs: documentation changes
   # test: test changes
   # refactor: code refactoring
   # chore: maintenance tasks
   ```

4. **Keep Branch Updated**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

5. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

## Coding Standards

### TypeScript Style Guide

1. **Type Safety**
   - Use explicit types, avoid `any`
   - Use interfaces for object shapes
   - Use type guards for runtime checks

   ```typescript
   // Good
   interface User {
     id: string;
     name: string;
   }

   function getUser(id: string): Result<User> {
     // ...
   }

   // Bad
   function getUser(id: any): any {
     // ...
   }
   ```

2. **Result Pattern**
   - Always use `Result<T>` for operations that can fail
   - Never throw exceptions in business logic

   ```typescript
   // Good
   export function processData(input: string): Result<ProcessedData> {
     try {
       // ...
       return { success: true, value: result };
     } catch (error) {
       return {
         success: false,
         error: error instanceof Error ? error : new Error('Unknown error')
       };
     }
   }

   // Bad
   export function processData(input: string): ProcessedData {
     if (invalid) {
       throw new Error('Invalid input');
     }
     // ...
   }
   ```

3. **Naming Conventions**
   - Functions: `camelCase`
   - Classes: `PascalCase`
   - Interfaces: `PascalCase`
   - Constants: `UPPER_SNAKE_CASE`
   - Private members: prefix with `_` or use `#`

4. **Function Documentation**
   - Add JSDoc comments to all exported functions
   - Include parameter descriptions
   - Document return types
   - Note any side effects

   ```typescript
   /**
    * Compile context pack for a specific role
    * Creates a deterministic context pack from database state
    *
    * @param options - Context compilation options
    * @returns Result containing compiled context pack
    */
   export function compileContextPack(
     options: CompileContextOptions
   ): Result<CompiledContextPack> {
     // ...
   }
   ```

5. **Error Handling**
   - Use `CodedError` for business logic errors
   - Include helpful error messages
   - Preserve error context

   ```typescript
   return {
     success: false,
     error: new CodedError(
       'CONTEXT_COMPILATION_FAILED',
       `Failed to compile context: ${contextResult.error.message}`
     )
   };
   ```

### Code Formatting

- Use Prettier with default settings
- 2 spaces for indentation (tabs in some legacy files)
- Single quotes for strings
- Semicolons required
- Max line length: 100 characters

### Import Organization

Organize imports in this order:

```typescript
// 1. External dependencies
import * as vscode from 'vscode';
import { nanoid } from 'nanoid';

// 2. Internal lib imports (absolute)
import type { Result, Dialogue } from '../types';
import { getDatabase } from '../database';

// 3. Internal relative imports
import { helperFunction } from './helpers';
```

## Testing

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { functionToTest } from '../functionToTest';

describe('functionToTest', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should handle valid input', () => {
    const result = functionToTest('valid');
    expect(result.success).toBe(true);
  });

  it('should handle invalid input', () => {
    const result = functionToTest('invalid');
    expect(result.success).toBe(false);
  });
});
```

### Test Coverage

- Aim for 80%+ coverage on new code
- All public APIs must have tests
- Test both success and failure paths
- Test edge cases

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- compiler.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Critical regression matrix (direct + sidecar DB backends)
pnpm run test:critical:matrix

# Required CI gates (critical matrix + critical coverage thresholds)
pnpm run test:ci:required

# Extension host smoke tests
pnpm run test:host:smoke
```

## Documentation

### Code Documentation

1. **JSDoc Comments**
   - Required for all exported functions
   - Include examples for complex functions
   - Document type parameters

2. **Inline Comments**
   - Explain "why", not "what"
   - Use comments sparingly
   - Prefer self-documenting code

### User Documentation

When adding user-facing features:

1. Update README.md
2. Add to Getting Started guide if applicable
3. Add examples to docs/
4. Update CHANGELOG.md

### Architecture Documentation

When making architectural changes:

1. Update Technical Specification
2. Add diagrams if helpful
3. Document design decisions
4. Update Implementation Roadmap

## Submitting Changes

### Pull Request Process

1. **Create Pull Request**
   - Go to your fork on GitHub
   - Click "New Pull Request"
   - Select your feature branch
   - Fill out PR template

2. **PR Title Format**
   ```
   feat: add context truncation strategy
   fix: resolve database locking issue
   docs: update getting started guide
   test: add tests for verifier role
   ```

3. **PR Description**
   Include:
   - What changed and why
   - Related issue numbers
   - Testing performed
   - Screenshots (if UI changes)
   - Breaking changes (if any)

4. **Review Process**
   - Maintainers will review
   - Address feedback
   - Maintain green CI checks
   - Rebase if requested

5. **Merge**
   - Squash and merge is default
   - Maintainers will merge approved PRs

### PR Checklist

- [ ] Code follows style guidelines
- [ ] Tests added for new functionality
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No linting errors
- [ ] Commit messages follow conventions
- [ ] PR description is clear and complete

## Issue Reporting

### Before Creating an Issue

1. Search existing issues
2. Check documentation
3. Try troubleshooting steps
4. Reproduce on latest version

### Creating an Issue

Use the appropriate template:

**Bug Report**:
- Environment details
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/logs
- Workarounds (if any)

**Feature Request**:
- Use case description
- Proposed solution
- Alternative solutions considered
- Additional context

**Question**:
- What you're trying to do
- What you've tried
- Relevant code/configuration

## Areas for Contribution

### Good First Issues

Look for issues labeled `good-first-issue`:
- Documentation improvements
- Simple bug fixes
- Test additions
- UI text improvements

### High Priority Areas

1. **Testing**
   - Increase test coverage
   - Add integration tests
   - Add E2E workflow tests

2. **Performance**
   - Database query optimization
   - Context compilation efficiency
   - UI responsiveness

3. **Documentation**
   - More examples
   - Video tutorials
   - Architecture diagrams

4. **UI/UX**
   - Improve webview designs
   - Better error messages
   - Accessibility improvements

5. **Provider Support**
   - Additional LLM providers
   - Provider-specific optimizations
   - Rate limiting improvements

### Advanced Contributions

1. **New Roles**
   - Implement additional specialized roles
   - Enhance existing role capabilities

2. **Workflow Engine**
   - New phase types
   - Custom gate conditions
   - Workflow branching

3. **Integration**
   - Git integration improvements
   - External tool connectors
   - API for external extensions

## Questions?

- **GitHub Discussions**: Ask questions and discuss ideas
- **GitHub Issues**: Report bugs or request features
- **Technical Spec**: Review [Technical Specification](./docs/Governed%20Multi-Role%20Dialogue%20&%20Execution%20System%20-%20Technical%20Specification.md)
- **Roadmap**: See [Implementation Roadmap](./docs/Implementation%20Roadmap.md)

---

**Thank you for contributing to JanumiCode!**

Your contributions help make governed AI-assisted development accessible to everyone.
