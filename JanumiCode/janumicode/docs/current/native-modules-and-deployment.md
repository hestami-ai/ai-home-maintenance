# Native Modules and Deployment

JanumiCode depends on `better-sqlite3`, a native Node.js addon (C++ compiled to a `.node` binary). Native addons are compiled against a specific **Node.js ABI version** (identified by `NODE_MODULE_VERSION`), and a binary compiled for one ABI cannot be loaded by a runtime with a different ABI.

This creates a fundamental tension: VS Code extensions run inside **Electron's** embedded Node.js, which has a different ABI than the **system** Node.js used for development and testing.

## The Problem

```
System Node.js v24  →  NODE_MODULE_VERSION 137  →  used by vitest, scripts
VS Code / Electron 39  →  NODE_MODULE_VERSION 140  →  used by the extension at runtime
```

A single `better_sqlite3.node` binary cannot serve both. If compiled for system Node, the extension crashes on load. If compiled for Electron, unit tests fail.

VS Code auto-updates roughly monthly, and each update may bump the Electron version (and therefore the ABI). When this happens, the extension's bundled native module becomes incompatible and the database fails to initialize:

```
Error: The module was compiled against NODE_MODULE_VERSION 137.
This version of Node.js requires NODE_MODULE_VERSION 140.
```

## Development Build Pipeline

The build system maintains **two separate binaries** to solve the dual-ABI problem:

| Location | Compiled for | Used by |
|---|---|---|
| `node_modules/.pnpm/better-sqlite3@*/…/build/Release/better_sqlite3.node` | System Node.js | vitest, scripts |
| `.electron-native-cache/better_sqlite3-electron-{version}.node` | Electron | VS Code extension (via `dist/`) |

### How It Works

The build pipeline (`node esbuild.js`) calls `ensure()` from `scripts/ensure-native-modules.js` on every build:

1. **Detect** — Reads the Electron version from the local VS Code installation:
   - Windows: `%LOCALAPPDATA%/Programs/Microsoft VS Code/<commit>/version`
   - macOS: `/Applications/Visual Studio Code.app/Contents/Frameworks/Electron Framework.framework/Versions/Current/Resources/version`
   - Linux: `/usr/share/code/version`, `/snap/code/current/usr/share/code/version`

2. **Check cache** — Reads `.electron-native-cache/stamp.json`. If the cached binary matches the detected Electron version, platform, and architecture, the build skips the rebuild (instant).

3. **Rebuild** (cache miss only):
   - Backs up the current system-Node binary from `node_modules/` to the cache directory
   - Runs `@electron/rebuild` to compile `better-sqlite3` for the detected Electron version (modifies the binary in `node_modules/` in-place)
   - Copies the freshly built Electron binary to `.electron-native-cache/better_sqlite3-electron-{version}.node`
   - Restores the system-Node binary from backup so tests continue to work

4. **Copy to dist/** — The esbuild `copyNativeModulesPlugin`:
   - Copies all of `better-sqlite3` (JS, package.json, etc.) from `node_modules/` to `dist/node_modules/`
   - **Overlays** the Electron-compiled `.node` file from cache onto `dist/node_modules/better-sqlite3/build/Release/`
   - Handles `EBUSY`/`EPERM` on Windows when VS Code has the old binary locked (renames the locked file, then copies the new one)

### Result

After a build:
- `node_modules/` has the **system-Node** binary → `pnpm run test:unit` works
- `dist/node_modules/` has the **Electron** binary → the extension loads in VS Code
- Cache is warm → subsequent builds skip the rebuild entirely

### Manual Commands

```bash
# Force rebuild (e.g., after VS Code update or when troubleshooting):
pnpm run rebuild:native

# Or directly:
node scripts/ensure-native-modules.js --force
```

### Files Involved

| File | Role |
|---|---|
| `scripts/ensure-native-modules.js` | Detects Electron version, manages cache, rebuilds |
| `esbuild.js` | Calls `ensure()`, copies to `dist/` with Electron overlay |
| `.electron-native-cache/stamp.json` | Records which Electron version the cache was built for |
| `.electron-native-cache/better_sqlite3-electron-*.node` | Cached Electron-compiled binary |
| `package.json` `rebuild:native` | Shortcut to `ensure-native-modules.js --force` |

### When the Cache Invalidates

The cache automatically invalidates and triggers a rebuild when:
- VS Code updates to a new version (different Electron version detected)
- The OS or CPU architecture changes (e.g., switching between x64 and arm64)
- The cache directory is deleted
- `--force` flag is passed

## Deployment Considerations

### Marketplace Distribution (.vsix)

When JanumiCode is published to the VS Code Marketplace, the `.vsix` package must contain a `better_sqlite3.node` binary compiled for the correct Electron ABI. There are several strategies:

#### Option 1: Platform-Specific Packages (Recommended)

VS Code supports [platform-specific extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#platformspecific-extensions). Each `.vsix` targets a specific OS + architecture:

```bash
vsce package --target win32-x64
vsce package --target darwin-x64
vsce package --target darwin-arm64
vsce package --target linux-x64
```

The `vscode:prepublish` script (currently `pnpm run package`) should invoke `@electron/rebuild` targeting the Electron version specified by `engines.vscode` in `package.json`. This ensures the binary matches the minimum supported VS Code version.

**Limitation:** The binary is compiled for _one_ Electron ABI. If a user's VS Code is on a newer Electron than what the `.vsix` was built against, the ABI may not match. In practice, Electron maintains ABI compatibility within the same major version, so this works as long as the `engines.vscode` constraint is reasonably current.

#### Option 2: Prebuild Bundles

Ship multiple precompiled `.node` binaries for different Electron ABIs and select the correct one at runtime:

```
dist/prebuilds/
  electron-v39-win32-x64/better_sqlite3.node
  electron-v39-darwin-x64/better_sqlite3.node
  electron-v39-darwin-arm64/better_sqlite3.node
  electron-v39-linux-x64/better_sqlite3.node
```

A thin runtime loader checks `process.versions.electron` and `process.platform`/`process.arch` to pick the right binary. Libraries like [`prebuild-install`](https://github.com/prebuild/prebuild-install) and [`node-gyp-build`](https://github.com/prebuild/node-gyp-build) provide this pattern.

**Trade-off:** Larger package size (~2MB per platform/ABI), but maximum compatibility. Extensions like `better-sqlite3` already use this pattern for Node.js; it would need extension to cover Electron ABIs.

#### Option 3: WASM Alternative (Long-term)

Replace `better-sqlite3` with [`sql.js`](https://github.com/sql-js/sql.js), a WebAssembly-compiled SQLite. WASM runs identically across all platforms and Node.js/Electron versions — no native compilation, no ABI concerns.

**Trade-offs:**
- **Pro:** Zero native dependencies. Eliminates the entire build complexity described in this document. Works in VS Code for Web.
- **Con:** ~2x slower for write-heavy workloads. No shared-cache mode. Entire database must fit in memory (or use a custom VFS). Lacks some advanced SQLite features (WAL mode, user-defined functions via C).
- **Feasibility for JanumiCode:** The database workload is light (small writes during workflow transitions, reads for UI rendering). The performance difference is unlikely to matter. The main concern is migration effort and ensuring feature parity (WAL mode, `@sqliteai/sqlite-vector` compatibility).

### What Happens When a User Updates VS Code

For a **marketplace-installed** extension:

1. User's VS Code auto-updates (e.g., from Electron 39 to Electron 40)
2. The extension's bundled `.node` binary was compiled for Electron 39
3. If Electron 40 has a different `NODE_MODULE_VERSION`, the extension crashes

**How other extensions handle this:**
- **Extensions without native deps** (the vast majority): Not affected.
- **Extensions with prebuilds** (e.g., those using `node-gyp-build`): Ship binaries for multiple ABIs. If the new ABI is covered, it works. If not, it fails until the extension publishes an update.
- **Microsoft's own native extensions** (e.g., C/C++ extension): Are typically updated in lockstep with VS Code releases.
- **`vsce`**: The `vsce package` command runs `@electron/rebuild` during packaging, targeting the Electron version implied by `engines.vscode`. Extensions that pin to a recent `engines.vscode` range tend to stay compatible.

**Mitigation strategies for JanumiCode:**
1. Keep `engines.vscode` reasonably current (track stable VS Code releases).
2. Publish extension updates promptly when VS Code bumps Electron major versions.
3. Consider the WASM migration path (Option 3) to eliminate the problem entirely.

For a **development (sideloaded)** extension:
- The build pipeline handles this automatically. Running `node esbuild.js` detects the new Electron version, rebuilds from cache (or triggers a fresh rebuild), and overlays the correct binary.

## CI Considerations

The GitHub Actions CI pipeline (`.github/workflows/ci.yml`) runs tests on Ubuntu with system Node.js, not inside VS Code/Electron. The `unit-tests` job rebuilds `better-sqlite3` for system Node:

```yaml
- name: Rebuild better-sqlite3 for Linux
  run: npx node-gyp rebuild --directory=node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3 || true
```

This ensures the test binary matches the CI runner's Node.js. The `ensure-native-modules.js` script gracefully skips when VS Code is not installed (CI environments), so it does not interfere.
