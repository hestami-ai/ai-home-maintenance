# Build, Debug, and Deploy Guide

**JanumiCode VS Code Extension**

This guide provides comprehensive instructions for developers on how to build, debug, test, package, and deploy the JanumiCode VS Code extension.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Environment Setup](#development-environment-setup)
3. [Building the Extension](#building-the-extension)
4. [Debugging the Extension](#debugging-the-extension)
5. [Running Tests](#running-tests)
6. [Packaging for Distribution](#packaging-for-distribution)
7. [Publishing to Marketplace](#publishing-to-marketplace)
8. [Troubleshooting](#troubleshooting)
9. [CI/CD Integration](#cicd-integration)

---

## Prerequisites

### Required Software

1. **Node.js** (v22.x or higher)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation:
     ```bash
     node --version  # Should be v22.x or higher
     ```

2. **pnpm** (v9.x or higher)
   - Install globally:
     ```bash
     npm install -g pnpm
     ```
   - Verify installation:
     ```bash
     pnpm --version
     ```

3. **Visual Studio Code** (v1.109.0 or higher)
   - Download from [code.visualstudio.com](https://code.visualstudio.com/)
   - Required for debugging and testing

4. **Git**
   - Download from [git-scm.com](https://git-scm.com/)
   - Required for version control

### Optional Tools

- **vsce** (VS Code Extension CLI) - Required for packaging and publishing
  ```bash
  npm install -g @vscode/vsce
  ```

- **ovsx** (Open VSX CLI) - For publishing to Open VSX Registry
  ```bash
  npm install -g ovsx
  ```

---

## Development Environment Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd JanumiCode/janumicode
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install:
- **Runtime dependencies**: `@anthropic-ai/sdk`, `better-sqlite3`, `nanoid`, `openai`, `uuid`
- **Dev dependencies**: TypeScript, ESBuild, ESLint, testing tools

### 3. Configure Environment

#### API Keys

Create a `.env` file in the workspace root (optional for development):

```bash
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENAI_API_KEY=your-openai-api-key
```

**Note**: API keys are typically configured per-workspace via VS Code settings, not `.env` files.

#### VS Code Workspace Settings

Create `.vscode/settings.json` in your test workspace:

```json
{
  "janumicode.llm.executor.provider": "CLAUDE",
  "janumicode.llm.executor.model": "claude-sonnet-4",
  "janumicode.llm.executor.apiKey": "your-api-key",
  "janumicode.tokenBudget": 10000
}
```

### 4. Verify Setup

Check that TypeScript compiles without errors:

```bash
pnpm run check-types
```

Check that linting passes:

```bash
pnpm run lint
```

---

## Building the Extension

### Build Scripts Overview

The extension uses **esbuild** for fast bundling with the following scripts:

| Script | Purpose | Usage |
|--------|---------|-------|
| `compile` | Build once with type checking and linting | `pnpm run compile` |
| `watch` | Build continuously with auto-rebuild | `pnpm run watch` |
| `package` | Production build (minified, no sourcemaps) | `pnpm run package` |
| `check-types` | TypeScript type checking only | `pnpm run check-types` |
| `lint` | ESLint checking | `pnpm run lint` |

### Development Build

**Recommended for active development:**

```bash
pnpm run watch
```

This starts two parallel watch processes:
1. **TypeScript watch** (`watch:tsc`) - Type checking in watch mode
2. **esbuild watch** (`watch:esbuild`) - Fast bundling with auto-rebuild

**Output**: `dist/extension.js` with sourcemaps

**Features**:
- Incremental builds (rebuilds only changed files)
- Sourcemaps enabled for debugging
- Type errors shown in terminal
- Build errors shown in VS Code Problems panel

### One-Time Build

For a single build without watching:

```bash
pnpm run compile
```

**Steps executed**:
1. Type checking (`tsc --noEmit`)
2. Linting (`eslint src`)
3. Bundling (`node esbuild.js`)

### Production Build

For final production-ready build:

```bash
pnpm run package
```

**Differences from development build**:
- **Minification enabled** (smaller bundle size)
- **Sourcemaps disabled** (security)
- **Tree-shaking optimizations**
- **Dead code elimination**

**Output**: Optimized `dist/extension.js` (~500KB typical)

### Build Configuration

#### esbuild.js

Key settings in `esbuild.js`:

```javascript
{
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',                    // CommonJS for Node.js
  minify: production,               // Only in production
  sourcemap: !production,           // Only in development
  platform: 'node',                 // Node.js target
  outfile: 'dist/extension.js',
  external: ['vscode'],             // VS Code API is external
}
```

#### TypeScript Configuration

Key settings in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "Node16",
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "noEmit": true,                 // esbuild handles output
    "moduleResolution": "Node16"
  }
}
```

### Understanding the Build Output

After building, you'll have:

```
dist/
└── extension.js          # Bundled extension code
```

**What's included in the bundle**:
- All TypeScript source files (compiled to JS)
- All runtime dependencies (better-sqlite3, nanoid, etc.)
- Inlined and optimized

**What's NOT included**:
- VS Code API (`vscode` module) - provided by VS Code at runtime
- Native modules like `better-sqlite3` - bundled but loaded at runtime

---

## Debugging the Extension

### Quick Start Debugging

1. **Open the project** in VS Code:
   ```bash
   code /path/to/JanumiCode/janumicode
   ```

2. **Start watch mode** (if not already running):
   ```bash
   pnpm run watch
   ```

3. **Press F5** or go to **Run → Start Debugging**

This will:
- Build the extension (via pre-launch task)
- Launch a new VS Code window with the extension loaded
- Attach the debugger

### Debug Configurations

The extension includes a pre-configured debug setup in `.vscode/launch.json`:

```json
{
  "name": "Run Extension",
  "type": "extensionHost",
  "request": "launch",
  "args": [
    "--extensionDevelopmentPath=${workspaceFolder}"
  ],
  "outFiles": [
    "${workspaceFolder}/dist/**/*.js"
  ],
  "preLaunchTask": "${defaultBuildTask}"
}
```

**Configuration details**:
- **type**: `extensionHost` - Launches VS Code Extension Host
- **outFiles**: Points to compiled JavaScript for source mapping
- **preLaunchTask**: Runs the default build task before launching

### Using Breakpoints

1. **Set breakpoints** in TypeScript source files (`.ts`)
2. **Start debugging** (F5)
3. **Trigger the code path** in the Extension Development Host window
4. **Debugger pauses** at breakpoints

**Example**: Set a breakpoint in `src/extension.ts` at the `activate` function:

```typescript
export function activate(context: vscode.ExtensionContext) {
  console.log('JanumiCode is now active!'); // ← Set breakpoint here
  // ...
}
```

### Debug Console

Use the Debug Console to:
- **Evaluate expressions** while paused
- **Inspect variables** in current scope
- **Execute commands** in extension context

**Examples**:
```javascript
// Inspect extension context
context.subscriptions.length

// Check database state
getDatabase()

// Evaluate complex expressions
getDialogueSession('abc-123')
```

### Logging Best Practices

Use VS Code's output channels for logging:

```typescript
const outputChannel = vscode.window.createOutputChannel('JanumiCode');
outputChannel.appendLine('Dialogue session created: ' + dialogue_id);
outputChannel.show(); // Show the output panel
```

**Benefits**:
- Persistent logs visible in Output panel
- Separate from Debug Console
- Can be shown/hidden by users

### Debugging Specific Components

#### Database Operations

To debug database queries:

1. Set breakpoint in database operation (e.g., `src/lib/database/init.ts`)
2. Inspect the SQLite Database object
3. Check query results in Debug Console

```typescript
// In Debug Console
db.prepare('SELECT * FROM dialogue_turns WHERE dialogue_id = ?').all('abc-123')
```

#### LLM Invocations

To debug LLM calls:

1. Set breakpoint in `src/lib/llm/client.ts`
2. Inspect request payload
3. Check response and token usage

**Tip**: Use conditional breakpoints to only pause for specific roles:

```typescript
// Breakpoint condition
role === Role.EXECUTOR
```

#### Workflow State Machine

To debug workflow transitions:

1. Set breakpoint in `src/lib/workflow/stateMachine.ts`
2. Watch the state transitions
3. Verify guard conditions

### Debugging Webviews

To debug webview content:

1. **Open Developer Tools** in Extension Development Host:
   - **Help → Toggle Developer Tools**

2. **Find your webview** in Elements tab

3. **Use Console** to debug webview JavaScript

### Hot Reload Support

With `pnpm run watch` running:
- Changes to TypeScript files trigger automatic rebuild
- **Reload Extension Host** window to see changes:
  - Press **Ctrl+R** (Windows/Linux) or **Cmd+R** (macOS)
  - Or use Command Palette: **Developer: Reload Window**

**Note**: Full window reload required (no true hot reload for extensions)

### Debugging Tests

To debug unit tests:

1. Set breakpoints in test files (`src/test/**/*.test.ts`)
2. Use the **Run and Debug** view
3. Select **"Extension Tests"** configuration (if configured)
4. Press F5

Alternatively, run tests with debugger attached:

```bash
pnpm run test --inspect-brk
```

### Common Debugging Scenarios

#### Extension Not Activating

**Check**:
1. Activation events in `package.json`
2. Error in `activate()` function
3. VS Code output logs

**Debug**:
```typescript
export function activate(context: vscode.ExtensionContext) {
  console.log('=== ACTIVATE CALLED ===');
  try {
    // Your activation code
  } catch (error) {
    console.error('Activation failed:', error);
  }
}
```

#### Database Not Initializing

**Check**:
1. Database file path
2. File system permissions
3. SQLite library loading

**Debug**:
```typescript
const dbPath = path.join(context.globalStorageUri.fsPath, 'janumicode.db');
console.log('Database path:', dbPath);
console.log('Path exists:', fs.existsSync(dbPath));
```

#### Command Not Registered

**Check**:
1. Command registered in `package.json` `contributes.commands`
2. Command handler registered in `activate()`

**Debug**:
```typescript
const disposable = vscode.commands.registerCommand('janumicode.startDialogue', () => {
  console.log('=== COMMAND EXECUTED ===');
  // Command logic
});
```

---

## Running Tests

### Test Setup

The extension uses **Mocha** for testing with VS Code Test Runner.

### Running All Tests

```bash
pnpm run test
```

**Steps executed**:
1. Compile tests (`compile-tests`)
2. Compile extension (`compile`)
3. Run linter (`lint`)
4. Execute tests in VS Code Test Runner

### Test Structure

```
src/test/
├── extension.test.ts      # Extension activation tests
├── dialogue.test.ts       # Dialogue system tests
├── workflow.test.ts       # Workflow state machine tests
├── context.test.ts        # Context compiler tests
└── database.test.ts       # Database operations tests
```

### Writing Tests

**Example test**:

```typescript
import * as assert from 'assert';
import { createDialogueSession } from '../lib/dialogue/session';

suite('Dialogue System Tests', () => {
  test('Create dialogue session', () => {
    const result = createDialogueSession();

    assert.strictEqual(result.success, true);
    assert.ok(result.value);
    assert.ok(result.value.dialogue_id);
    assert.strictEqual(result.value.turn_count, 0);
  });
});
```

### Test Coverage

To generate test coverage report (requires additional setup):

```bash
npm install --save-dev c8
npx c8 pnpm run test
```

### Watch Mode for Tests

Compile tests in watch mode:

```bash
pnpm run watch-tests
```

Then run tests manually or use VS Code Test Explorer.

### Testing Best Practices

1. **Test public APIs** - Focus on exported functions
2. **Use Result pattern** - Test both success and failure cases
3. **Mock external dependencies** - Don't make real LLM API calls in tests
4. **Clean up after tests** - Close database connections, delete test files
5. **Isolated tests** - Each test should be independent

**Example with cleanup**:

```typescript
suite('Database Tests', () => {
  let db: Database.Database;

  setup(() => {
    db = initDatabase(':memory:').value; // In-memory for tests
  });

  teardown(() => {
    db.close();
  });

  test('Insert dialogue turn', () => {
    // Test logic
  });
});
```

---

## Packaging for Distribution

### Creating a .vsix Package

A `.vsix` file is a packaged VS Code extension that can be installed manually or published to the marketplace.

#### Install vsce CLI

```bash
npm install -g @vscode/vsce
```

#### Build Production Package

```bash
# First, ensure production build is complete
pnpm run package

# Create .vsix package
vsce package
```

**Output**: `janumicode-0.0.1.vsix` (version from package.json)

#### Package Options

```bash
# Specify version
vsce package --version 0.1.0

# Pre-release version
vsce package --pre-release

# Skip dependency installation (if already done)
vsce package --no-dependencies

# Allow uncommitted changes
vsce package --allow-uncommitted
```

### Testing the .vsix Package

#### Install Locally

**Option 1: VS Code UI**
1. Open VS Code
2. Go to **Extensions** view (Ctrl+Shift+X)
3. Click **...** menu → **Install from VSIX...**
4. Select `janumicode-0.0.1.vsix`

**Option 2: Command Line**
```bash
code --install-extension janumicode-0.0.1.vsix
```

#### Verify Installation

1. Check extension appears in Extensions list
2. Verify extension activates
3. Test all commands work
4. Check configuration settings

#### Uninstall Test Package

```bash
code --uninstall-extension <publisher>.janumicode
```

### Package Contents

A `.vsix` file contains:

```
janumicode-0.0.1.vsix (ZIP archive)
├── extension/
│   ├── dist/
│   │   └── extension.js       # Bundled extension code
│   ├── resources/             # Icons, images
│   ├── package.json          # Extension manifest
│   ├── README.md             # Extension description
│   ├── LICENSE               # License file
│   └── CHANGELOG.md          # Version history
└── [Content_Types].xml
```

### Pre-Packaging Checklist

Before creating a package:

- [ ] Version bumped in `package.json`
- [ ] CHANGELOG.md updated with new version
- [ ] All tests passing (`pnpm run test`)
- [ ] Production build created (`pnpm run package`)
- [ ] README.md accurate and complete
- [ ] LICENSE file present
- [ ] No debug code or console.logs in production
- [ ] API keys not hardcoded
- [ ] All dependencies declared in package.json
- [ ] Extension icon present (`resources/JanumiCodeIcon.png`)

### Package Size Optimization

Typical extension size: **2-5 MB**

**Optimization strategies**:

1. **Exclude unnecessary files** in `.vscodeignore`:
   ```
   .vscode/
   src/
   node_modules/
   tsconfig.json
   .eslintrc.json
   esbuild.js
   *.test.ts
   .gitignore
   ```

2. **Use production build** (minified)
   ```bash
   pnpm run package  # Not 'compile'
   ```

3. **Analyze bundle size**:
   ```bash
   npx esbuild-visualizer dist/extension.js
   ```

4. **Consider code splitting** for large dependencies (advanced)

### Versioning Strategy

Follow **Semantic Versioning** (semver):

- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

**Pre-release versions**:
- `0.1.0-alpha.1` - Alpha release
- `0.1.0-beta.2` - Beta release
- `0.1.0-rc.1` - Release candidate

---

## Publishing to Marketplace

### Prerequisites

1. **Microsoft/Azure Account**
   - Create at [azure.microsoft.com](https://azure.microsoft.com/en-us/free/)

2. **Personal Access Token (PAT)**
   - Create at [dev.azure.com](https://dev.azure.com/)
   - Required scopes: `Marketplace (Manage)`
   - Store securely (don't commit to git)

3. **Publisher Account**
   - Create at [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage)
   - Choose unique publisher ID

### One-Time Setup

#### 1. Update package.json

Add publisher field:

```json
{
  "name": "janumicode",
  "displayName": "JanumiCode",
  "description": "Governed multi-role dialogue system for AI-assisted development",
  "version": "0.1.0",
  "publisher": "your-publisher-id",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/janumicode.git"
  },
  "bugs": {
    "url": "https://github.com/your-org/janumicode/issues"
  },
  "homepage": "https://github.com/your-org/janumicode#readme",
  "license": "MIT",
  "icon": "resources/JanumiCodeIcon.png",
  "galleryBanner": {
    "color": "#1e1e1e",
    "theme": "dark"
  },
  "keywords": [
    "ai",
    "claude",
    "verification",
    "governance",
    "code-generation"
  ]
}
```

#### 2. Login to vsce

```bash
vsce login your-publisher-id
```

Enter your Personal Access Token when prompted.

### Publishing Process

#### First-Time Publish

```bash
# Ensure production build is ready
pnpm run package

# Publish to marketplace
vsce publish
```

**Steps executed**:
1. Validates package.json
2. Creates .vsix package
3. Uploads to marketplace
4. Publishes extension

#### Update Existing Extension

```bash
# Bump version and publish
vsce publish minor  # or 'major' or 'patch'
```

This automatically:
- Increments version in package.json
- Creates git tag
- Publishes to marketplace

#### Publish Specific Version

```bash
# Publish specific version
vsce publish 1.2.3
```

#### Pre-Release

```bash
# Publish pre-release version
vsce publish --pre-release
```

Pre-release versions:
- Available to users who opt in
- Used for beta testing
- Can be promoted to stable

### Publishing to Open VSX

For users of VSCodium, Code-OSS, and other VS Code alternatives:

```bash
# Install ovsx
npm install -g ovsx

# Create account at open-vsx.org

# Login
ovsx login

# Publish
ovsx publish janumicode-0.1.0.vsix
```

### Post-Publication Checklist

After publishing:

- [ ] Verify extension appears in marketplace
- [ ] Install and test from marketplace
- [ ] Check extension page formatting
- [ ] Monitor download statistics
- [ ] Respond to user reviews/issues
- [ ] Update GitHub release notes

### Marketplace Listing Optimization

#### Extension Icon

Create `resources/JanumiCodeIcon.png`:
- **Size**: 128x128 pixels
- **Format**: PNG with transparency
- **Design**: Simple, recognizable logo

#### README for Marketplace

The README.md is displayed on the marketplace page. Ensure it includes:

1. **Clear description** of what the extension does
2. **Screenshots/GIFs** demonstrating features
3. **Installation instructions**
4. **Quick start guide**
5. **Configuration options**
6. **License and attribution**

#### Gallery Banner

Customize the marketplace banner in package.json:

```json
{
  "galleryBanner": {
    "color": "#1e1e1e",
    "theme": "dark"
  }
}
```

#### Keywords for Discovery

Add relevant keywords in package.json:

```json
{
  "keywords": [
    "ai",
    "assistant",
    "code-generation",
    "verification",
    "governance",
    "claude",
    "gpt",
    "llm"
  ]
}
```

### Unpublishing (Use with Caution)

```bash
# Unpublish specific version
vsce unpublish your-publisher.janumicode@0.1.0

# Unpublish entire extension
vsce unpublish your-publisher.janumicode
```

**Warning**: Unpublishing affects all users who have installed the extension.

### Marketplace Policies

Ensure compliance with [VS Code Marketplace policies](https://aka.ms/vsmarketplace-ToU):

- No malicious code
- Respect user privacy
- Accurate description
- Appropriate content rating
- Proper licensing

---

## Troubleshooting

### Build Issues

#### Error: "Cannot find module 'better-sqlite3'"

**Cause**: Native module not rebuilt for Electron.

**Solution**:
```bash
# Rebuild native modules
pnpm rebuild better-sqlite3 --build-from-source

# Or reinstall all dependencies
rm -rf node_modules
pnpm install
```

#### Error: "esbuild failed with errors"

**Cause**: Syntax errors in TypeScript code.

**Solution**:
1. Run type checking:
   ```bash
   pnpm run check-types
   ```
2. Fix TypeScript errors shown
3. Re-run build

#### Error: "Module not found" during bundle

**Cause**: Import path incorrect or missing dependency.

**Solution**:
1. Check import statements
2. Verify dependency in package.json
3. Run `pnpm install` if dependency missing

### Debugging Issues

#### Extension Not Loading in Debug Host

**Check**:
1. Build completed successfully
2. `dist/extension.js` exists
3. Activation events in package.json

**Solution**:
```bash
# Clean build
rm -rf dist
pnpm run compile
```

Then restart debugging (F5).

#### Breakpoints Not Hitting

**Cause**: Sourcemaps not generated or not found.

**Solution**:
1. Ensure development build (not production):
   ```bash
   pnpm run watch  # Not 'package'
   ```
2. Check `outFiles` in launch.json points to `dist/**/*.js`
3. Reload VS Code window

#### "Cannot connect to runtime process" Error

**Cause**: Extension Host crashed or port conflict.

**Solution**:
1. Close all VS Code windows
2. Restart VS Code
3. Try debugging again

### Testing Issues

#### Tests Failing: "Cannot find module"

**Cause**: Test compilation output path mismatch.

**Solution**:
```bash
pnpm run compile-tests
```

Ensure `out/` directory created with compiled tests.

#### Tests Timeout

**Cause**: Slow database operations or LLM calls.

**Solution**:
1. Increase timeout in test:
   ```typescript
   test('Slow test', async function() {
     this.timeout(10000); // 10 seconds
     // Test logic
   });
   ```
2. Mock LLM calls for faster tests

### Packaging Issues

#### vsce Error: "Missing publisher"

**Cause**: `publisher` field not in package.json.

**Solution**:
```json
{
  "publisher": "your-publisher-id"
}
```

#### Package Too Large (>100MB)

**Cause**: node_modules included or large assets.

**Solution**:
1. Check `.vscodeignore` excludes `node_modules/`
2. Remove large unnecessary files
3. Optimize images

#### "Extension activation failed" After Install

**Cause**: Missing native dependencies in bundle.

**Solution**:
1. Check `better-sqlite3` is bundled correctly
2. May need to exclude from esbuild and include as file:
   ```javascript
   // esbuild.js
   external: ['vscode', 'better-sqlite3']
   ```
   Then copy native module to dist manually

### Publishing Issues

#### "401 Unauthorized" Error

**Cause**: Invalid or expired Personal Access Token.

**Solution**:
1. Create new PAT at dev.azure.com
2. Login again:
   ```bash
   vsce logout
   vsce login your-publisher-id
   ```

#### "409 Conflict" Error

**Cause**: Version already published.

**Solution**:
1. Bump version in package.json
2. Publish again

### Runtime Issues

#### Database Locked Error

**Cause**: Concurrent writes or process didn't close connection.

**Solution**:
1. Use WAL mode (already configured)
2. Ensure proper connection closing
3. Check for concurrent transactions

#### Out of Memory Error

**Cause**: Large context packs or memory leaks.

**Solution**:
1. Reduce token budget
2. Implement context truncation
3. Check for memory leaks (circular references)

### Getting Help

If issues persist:

1. **Check logs**:
   - VS Code Output panel
   - Developer Tools Console
   - Extension logs

2. **Search issues**:
   - GitHub Issues
   - VS Code Extension Development docs

3. **Ask for help**:
   - GitHub Discussions
   - VS Code Extension Development Discord
   - Stack Overflow (tag: vscode-extensions)

---

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/build.yml`:

```yaml
name: Build and Test

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '22.x'

    - name: Setup pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 9

    - name: Install dependencies
      run: pnpm install

    - name: Type check
      run: pnpm run check-types

    - name: Lint
      run: pnpm run lint

    - name: Build
      run: pnpm run package

    - name: Run tests
      run: pnpm run test
```

### Automated Publishing Workflow

Create `.github/workflows/publish.yml`:

```yaml
name: Publish Extension

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '22.x'

    - name: Setup pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 9

    - name: Install dependencies
      run: pnpm install

    - name: Build
      run: pnpm run package

    - name: Publish to VS Code Marketplace
      env:
        VSCE_PAT: ${{ secrets.VSCE_PAT }}
      run: |
        npx vsce publish -p $VSCE_PAT

    - name: Publish to Open VSX
      env:
        OVSX_PAT: ${{ secrets.OVSX_PAT }}
      run: |
        npx ovsx publish -p $OVSX_PAT
```

**Setup secrets** in GitHub repository settings:
- `VSCE_PAT`: Visual Studio Marketplace Personal Access Token
- `OVSX_PAT`: Open VSX Personal Access Token

### Pre-Commit Hooks

Install Husky for pre-commit hooks:

```bash
pnpm add -D husky lint-staged
npx husky init
```

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
pnpm run check-types
pnpm run lint
```

Add to `package.json`:

```json
{
  "lint-staged": {
    "src/**/*.ts": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

---

## Summary

This guide covered:

✅ **Prerequisites** - Node.js, pnpm, VS Code setup
✅ **Building** - Development and production builds
✅ **Debugging** - Breakpoints, hot reload, common scenarios
✅ **Testing** - Unit tests, test coverage
✅ **Packaging** - Creating .vsix files
✅ **Publishing** - VS Code Marketplace and Open VSX
✅ **Troubleshooting** - Common issues and solutions
✅ **CI/CD** - Automated workflows

### Quick Reference Commands

```bash
# Development
pnpm install          # Install dependencies
pnpm run watch        # Start watch mode
F5                    # Debug extension

# Testing
pnpm run test         # Run all tests
pnpm run check-types  # Type checking
pnpm run lint         # Linting

# Production
pnpm run package      # Production build
vsce package          # Create .vsix
vsce publish          # Publish to marketplace
```

### Next Steps

After mastering build/debug/deploy:

1. Read [Architecture.md](./Architecture.md) for system design
2. Review [CONTRIBUTING.md](../CONTRIBUTING.md) for code standards
3. Check [Getting Started.md](./Getting%20Started.md) for user workflows
4. Explore [Implementation Roadmap.md](./Implementation%20Roadmap.md) for future plans

---

**Questions or Issues?**

- GitHub Issues: [Report a bug](https://github.com/your-org/janumicode/issues)
- Discussions: [Ask a question](https://github.com/your-org/janumicode/discussions)
- Contributing: See [CONTRIBUTING.md](../CONTRIBUTING.md)

---

**Last Updated**: 2026-02-06
**Version**: 1.0
