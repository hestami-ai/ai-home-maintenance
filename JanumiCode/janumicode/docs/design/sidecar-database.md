# Database Sidecar Architecture

## Problem

`better-sqlite3` is a native C++ addon compiled against a specific Node.js ABI.
VS Code runs extensions inside Electron, which bundles its own Node.js version.
Every VS Code update can change the Electron/Node ABI, breaking the compiled
binary. This makes `better-sqlite3` unsuitable for VS Code Marketplace
distribution where users don't have C++ build tools.

## Requirements

- Multi-GB databases (checkpoint rotation for archival)
- Native SQLite extensions: `@sqliteai/sqlite-vector`, future graph plugin
- FTS5 full-text search
- WAL mode for concurrent reads
- Works on all VS Code Marketplace platforms without user-side compilation
- Survives VS Code updates without breaking

## Solution: Database Sidecar Process

Move SQLite out of the Electron extension host into a **child Node.js process**
that runs against a known, stable Node.js version — decoupled from Electron's ABI.

```
Extension Host (Electron)              Sidecar Process (Node.js LTS)
┌──────────────────────────┐          ┌─────────────────────────────┐
│                          │          │                             │
│  58 consumer files       │          │  better-sqlite3             │
│       ↓                  │          │  @sqliteai/sqlite-vector    │
│  9 store files           │          │  graph extension (future)   │
│  (unchanged)             │          │  FTS5                       │
│       ↓                  │          │                             │
│  getDatabase()           │          │  DatabaseRPCServer          │
│       ↓                  │  NDJSON  │    prepare/run/get/all      │
│  DatabaseRPCClient ◄─────┼──stdio───┼──► transaction batches      │
│  (drop-in interface)     │          │    pragma, backup, stats    │
│                          │          │                             │
└──────────────────────────┘          └─────────────────────────────┘
```

## Design Decisions

### Why NDJSON over stdio

- Already proven in the codebase (VoyageRPC embedding provider uses this exact
  pattern with request IDs, timeouts, and lifecycle management)
- No port allocation, no localhost networking, no firewall issues
- Clean parent-child lifecycle (process dies when parent dies)
- Sufficient throughput: a JSON-serialized query + result at ~1MB/s is not a
  bottleneck for database operations that are I/O-bound anyway

### Why not HTTP / WebSocket / Unix socket

- Adds port management complexity (permission server already uses this — it's
  more code and more failure modes)
- No benefit for single-client, single-connection communication
- stdio is simpler, faster, and auto-cleans on process exit

### Why bundle Node.js

- System Node.js version is unpredictable (or absent) on user machines
- Bundling a specific Node.js LTS binary (~15MB compressed) gives total control
  over the ABI — prebuilt `better-sqlite3` matches exactly
- Platform-specific `.vsix` packages already handle per-platform assets

---

## IPC Protocol

### Message Format

Newline-delimited JSON (NDJSON). Each message is one JSON object per line.

**Request** (extension host → sidecar):
```json
{
  "id": "req_1",
  "method": "run",
  "params": {
    "sql": "INSERT INTO dialogues (id, title) VALUES (?, ?)",
    "params": ["uuid-123", "My Dialogue"]
  }
}
```

**Response** (sidecar → extension host):
```json
{
  "id": "req_1",
  "result": { "changes": 1, "lastInsertRowid": 42 }
}
```

**Error response**:
```json
{
  "id": "req_1",
  "error": { "code": "SQLITE_CONSTRAINT", "message": "UNIQUE constraint failed" }
}
```

### Methods

| Method | Params | Returns | Notes |
|--------|--------|---------|-------|
| `init` | `{ path, readonly?, timeout? }` | `{ ok: true }` | Opens DB, loads extensions, sets pragmas |
| `close` | `{}` | `{ ok: true }` | Closes DB connection |
| `run` | `{ sql, params? }` | `{ changes, lastInsertRowid }` | INSERT/UPDATE/DELETE |
| `get` | `{ sql, params? }` | row or `null` | Single row SELECT |
| `all` | `{ sql, params? }` | row[] | Multi-row SELECT |
| `exec` | `{ sql }` | `{ ok: true }` | Raw SQL execution (DDL) |
| `transaction` | `{ operations: [{method, sql, params}...] }` | result[] | Atomic batch |
| `pragma` | `{ pragma, simple? }` | value | Pragma get/set |
| `backup` | `{ path }` | `{ ok: true }` | SQLite backup API |
| `stats` | `{}` | `{ pageCount, pageSize, ... }` | DB statistics |
| `ping` | `{}` | `{ ok: true }` | Health check |

### Transaction Batching

All existing transactions use **pre-generated UUIDs** (no `lastInsertRowid`
dependencies between statements). This means every transaction can be expressed
as a batch of independent operations:

```json
{
  "id": "req_5",
  "method": "transaction",
  "params": {
    "operations": [
      { "method": "run", "sql": "INSERT INTO task_graphs ...", "params": ["uuid-1", ...] },
      { "method": "run", "sql": "INSERT INTO task_units ...", "params": ["uuid-2", "uuid-1", ...] },
      { "method": "run", "sql": "INSERT INTO task_edges ...", "params": ["uuid-1", ...] }
    ]
  }
}
```

The sidecar wraps all operations in a single `db.transaction()` call. If any
operation fails, the entire batch rolls back.

For the rare case where a future transaction needs intermediate results, the
protocol supports a `transactionSession` mode:

```json
{"id": "t1", "method": "txn_begin", "params": {}}
{"id": "t2", "method": "txn_run", "params": {"txnId": "...", "sql": "...", "params": [...]}}
{"id": "t3", "method": "txn_commit", "params": {"txnId": "..."}}
```

But this is not needed today and can be added later.

---

## Client Interface (Drop-in Replacement)

### DatabaseRPCClient

The RPC client exposes the same interface that store files already use, so
**no store files need to change**. The 58 consumer files also stay unchanged.

```typescript
// src/lib/database/rpcClient.ts

export class DatabaseRPCClient {
  private process: ChildProcess;
  private pending: Map<string, { resolve, reject, timer }>;
  private nextId = 0;
  private readline: ReadLine;

  // --- Core query methods (same signatures as better-sqlite3) ---

  prepare(sql: string): PreparedStatementProxy {
    return new PreparedStatementProxy(this, sql);
  }

  pragma(pragma: string, options?: { simple?: boolean }): unknown { ... }

  transaction<T>(fn: (db: DatabaseRPCClient) => T): (...args: unknown[]) => T {
    // Collect operations during fn() execution, then send as batch
    // Uses a "recording" mode that captures calls instead of executing
  }

  backup(path: string): void { ... }
  close(): void { ... }

  // --- Internal RPC ---

  _rpc(method: string, params: object): Promise<unknown> { ... }
  _rpcSync(method: string, params: object): unknown {
    // Uses Atomics.wait + SharedArrayBuffer for synchronous IPC
    // (required because better-sqlite3's API is synchronous)
  }
}

class PreparedStatementProxy {
  constructor(private client: DatabaseRPCClient, private sql: string) {}

  run(...params: unknown[]): Database.RunResult {
    return this.client._rpcSync('run', { sql: this.sql, params });
  }

  get(...params: unknown[]): unknown {
    return this.client._rpcSync('get', { sql: this.sql, params });
  }

  all(...params: unknown[]): unknown[] {
    return this.client._rpcSync('all', { sql: this.sql, params });
  }
}
```

### The Synchronous IPC Challenge

`better-sqlite3` has a **synchronous API** — `stmt.run()` blocks until done.
The store files depend on this. But child process communication over stdio is
inherently asynchronous.

**Solution: `Atomics.wait` + `SharedArrayBuffer` + worker thread**

```
Extension Host                    Worker Thread              Sidecar
     │                                │                        │
     │ ── _rpcSync(query) ──────────► │                        │
     │    (writes to shared buf,      │                        │
     │     Atomics.wait blocks)       │ ── write to stdin ───► │
     │                                │                        │ (query)
     │                                │ ◄── read from stdout ─ │
     │    (Atomics.notify wakes)      │                        │
     │ ◄── result from shared buf ──  │                        │
     │                                │                        │
```

1. Main thread writes the request to a `SharedArrayBuffer` and calls
   `Atomics.wait()` — this blocks the thread synchronously
2. A `Worker` thread reads the shared buffer, sends the request to the
   sidecar's stdin, waits for the response on stdout
3. Worker writes the response back to the shared buffer and calls
   `Atomics.notify()` to wake the main thread
4. Main thread reads the result and returns synchronously

This is the same technique used by `synckit`, `make-synchronous`, and other
Node.js libraries that bridge sync/async boundaries. It works in Electron's
extension host because `SharedArrayBuffer` and `Atomics` are available.

**Alternative (simpler, slightly slower): `execFileSync` per query**

For a simpler v1, each synchronous call could spawn a tiny helper that sends
one query and prints the result. This has ~50ms overhead per call (process
spawn), which is acceptable for low-frequency operations but too slow for
batch inserts. The SharedArrayBuffer approach adds ~0.1ms overhead.

**Recommendation**: Start with `SharedArrayBuffer` + Worker. It's the right
architecture and avoids a migration from the simpler approach later.

### Transaction Recording

The `transaction()` method uses a recording pattern to collect operations:

```typescript
transaction<T>(fn: (db: DatabaseRPCClient) => T): (...args: unknown[]) => T {
  return (...args: unknown[]) => {
    // Enter recording mode
    this._recording = [];
    try {
      const result = fn(this);
      // Send all recorded operations as a batch
      this._rpcSync('transaction', { operations: this._recording });
      return result;
    } finally {
      this._recording = null;
    }
  };
}
```

When `_recording` is active, `run/get/all` append to the list instead of
executing immediately. The batch is sent as a single `transaction` RPC call.

**Limitation**: `get()` and `all()` during a recording return `undefined`/`[]`.
This is acceptable because all existing transactions use pre-generated UUIDs
and don't depend on query results mid-transaction. If this changes in the
future, the `transactionSession` protocol mode handles it.

---

## Sidecar Server

### Entry Point

```typescript
// src/sidecar/dbServer.ts — bundled separately by esbuild

import Database from 'better-sqlite3';
import * as readline from 'readline';

let db: Database.Database | null = null;

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
  const req = JSON.parse(line);
  try {
    const result = dispatch(req.method, req.params);
    process.stdout.write(JSON.stringify({ id: req.id, result }) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify({
      id: req.id,
      error: { code: err.code ?? 'ERROR', message: err.message }
    }) + '\n');
  }
});

function dispatch(method: string, params: any): any {
  switch (method) {
    case 'init':    return initDb(params);
    case 'run':     return db!.prepare(params.sql).run(...(params.params ?? []));
    case 'get':     return db!.prepare(params.sql).get(...(params.params ?? []));
    case 'all':     return db!.prepare(params.sql).all(...(params.params ?? []));
    case 'exec':    return db!.exec(params.sql);
    case 'pragma':  return db!.pragma(params.pragma, params.options);
    case 'transaction': return runTransaction(params.operations);
    case 'backup':  return db!.backup(params.path);
    case 'stats':   return getStats();
    case 'ping':    return { ok: true };
    case 'close':   db?.close(); db = null; return { ok: true };
    default:        throw new Error(`Unknown method: ${method}`);
  }
}

function runTransaction(operations: any[]): any[] {
  const txn = db!.transaction((ops: any[]) => {
    return ops.map(op => dispatch(op.method, op));
  });
  return txn(operations);
}
```

### Prepared Statement Caching

The sidecar should cache prepared statements by SQL string to avoid re-parsing:

```typescript
const stmtCache = new Map<string, Database.Statement>();

function getStmt(sql: string): Database.Statement {
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = db!.prepare(sql);
    stmtCache.set(sql, stmt);
  }
  return stmt;
}
```

This matches what `better-sqlite3` recommends and what the store files
implicitly expect (many create statements at module load time).

---

## Lifecycle Management

### Startup

```
Extension activates
  → spawn sidecar: node.exe dist/sidecar/dbServer.js
  → send 'init' with { path: config.databasePath }
  → sidecar opens DB, loads extensions, sets pragmas
  → sidecar responds { ok: true }
  → init.ts returns DatabaseRPCClient as the "database instance"
  → rest of activation proceeds normally
```

### Shutdown

```
Extension deactivates (or window closes)
  → send 'close' to sidecar
  → sidecar closes DB connection
  → sidecar process exits
  → extension host kills process if still alive after 5s timeout
```

### Crash Recovery

If the sidecar process exits unexpectedly:

1. Worker thread detects pipe close → rejects all pending requests
2. `DatabaseRPCClient` marks itself as disconnected
3. Next database call triggers automatic restart:
   - Respawn sidecar process
   - Re-send `init` with same config
   - Retry the failed operation
4. After 3 consecutive crash-restarts within 30s, stop retrying and show error

SQLite + WAL mode is crash-safe — incomplete transactions are rolled back on
next open. No data corruption risk.

---

## Deployment / Marketplace Packaging

### Directory Structure in .vsix

```
extension/
├── dist/
│   ├── extension.js              (extension host bundle)
│   ├── webview/
│   │   └── governedStream.js     (webview client bundle)
│   ├── sidecar/
│   │   ├── dbServer.js           (sidecar bundle — esbuild CJS)
│   │   └── node_modules/
│   │       ├── better-sqlite3/
│   │       │   └── build/Release/
│   │       │       └── better_sqlite3.node  (prebuilt for platform)
│   │       ├── bindings/
│   │       └── file-uri-to-path/
│   └── mcp/
│       └── permissionServer.js
├── runtime/
│   └── node                      (bundled Node.js LTS binary)
├── package.json
└── ...
```

### Platform-Specific .vsix Packages

VS Code Marketplace supports publishing separate packages per platform via
`vsce package --target <platform>`:

| Target | Node.js Binary | better-sqlite3 Prebuilt |
|--------|---------------|------------------------|
| `win32-x64` | `node.exe` (22.x LTS, ~35MB) | `better_sqlite3.node` for win32-x64 |
| `linux-x64` | `node` (22.x LTS, ~35MB) | `better_sqlite3.node` for linux-x64 |
| `darwin-x64` | `node` (22.x LTS, ~35MB) | `better_sqlite3.node` for darwin-x64 |
| `darwin-arm64` | `node` (22.x LTS, ~35MB) | `better_sqlite3.node` for darwin-arm64 |
| `linux-arm64` | `node` (22.x LTS, ~35MB) | `better_sqlite3.node` for linux-arm64 |

### CI/CD Pipeline

```yaml
# .github/workflows/publish.yml (conceptual)
strategy:
  matrix:
    include:
      - os: windows-latest
        target: win32-x64
        node_platform: win-x64
      - os: ubuntu-latest
        target: linux-x64
        node_platform: linux-x64
      - os: macos-latest
        target: darwin-x64
        node_platform: darwin-x64
      - os: macos-latest
        target: darwin-arm64
        node_platform: darwin-arm64

steps:
  # 1. Download Node.js LTS binary for the target platform
  - run: |
      curl -o node-archive https://nodejs.org/dist/v22.x.x/node-v22.x.x-${{ matrix.node_platform }}.tar.gz
      # Extract just the node binary into runtime/

  # 2. Download prebuilt better-sqlite3 for Node 22 + target platform
  - run: npx prebuild-install --runtime node --target 22.x.x --arch x64 --platform linux

  # 3. Build the sidecar bundle
  - run: node esbuild.js

  # 4. Package platform-specific .vsix
  - run: npx vsce package --target ${{ matrix.target }}

  # 5. Publish
  - run: npx vsce publish --target ${{ matrix.target }}
```

### Node.js LTS Update Cadence

- Node.js LTS releases every 12 months (even years: 22, 24, 26...)
- ABI only changes on major versions
- You control when to update the bundled Node.js — **no forced updates**
- Unlike Electron/VS Code, you choose the timeline

This is the fundamental advantage: instead of reacting to VS Code's monthly
Electron updates, you proactively update the bundled Node.js on your own
schedule (typically once a year when a new LTS lands).

### .vsix Size Budget

| Component | Size (compressed) |
|-----------|------------------|
| Node.js binary | ~15MB |
| better-sqlite3 .node | ~3MB |
| sqlite-vector .node | ~2MB |
| Extension JS bundles | ~1MB |
| **Total per platform** | **~21MB** |

Comparable to other extensions with native dependencies (e.g., GitHub Copilot
ships at ~20MB, Jupyter at ~30MB).

---

## Migration Path

### Phase 1: Build the sidecar (no behavior change)

1. Create `src/sidecar/dbServer.ts` — the NDJSON server
2. Create `src/lib/database/rpcClient.ts` — the `DatabaseRPCClient`
3. Create `src/lib/database/rpcWorker.ts` — the sync bridge worker
4. Add sidecar entry point to `esbuild.js`
5. Unit test the sidecar independently (node → sidecar → SQLite)

### Phase 2: Swap the backend behind the interface

6. Modify `init.ts`:
   - `initializeDatabase()` spawns sidecar + returns `DatabaseRPCClient`
   - `getDatabase()` returns the RPC client (same type surface)
   - `closeDatabase()` sends close + kills sidecar
   - `transaction()` uses the recording pattern
7. Run existing test suite — everything should pass unchanged

### Phase 3: Marketplace packaging

8. Add `runtime/` directory with platform-specific Node.js binaries
9. Update `esbuild.js` to bundle the sidecar
10. Create CI/CD matrix for platform-specific `.vsix` builds
11. Remove `ensure-native-modules.js`, `@electron/rebuild` dependency,
    and the ABI mismatch recovery code from `extension.ts`

### Phase 4: Cleanup

12. Remove the native module copy plugin from `esbuild.js`
13. Remove `.electron-native-cache/` infrastructure
14. Move `better-sqlite3` from `dependencies` to sidecar-only deps
15. Update CLAUDE.md / documentation

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Sync IPC latency (~0.1ms per call) | Negligible vs. SQLite disk I/O. Benchmark confirms no user-visible impact for metadata DB workloads |
| SharedArrayBuffer availability | Available in all Electron versions that VS Code targets. Falls back to worker-based polling if needed |
| Sidecar crash | Auto-restart with backoff. SQLite WAL is crash-safe |
| Large result sets over stdio | NDJSON handles arbitrarily large payloads. For truly massive results (100K+ rows), consider streaming/pagination |
| Bundled Node.js size | ~15MB compressed per platform. Acceptable for marketplace extensions |
| Transaction recording limitations | No existing code depends on mid-transaction query results. Protocol supports `txn_begin/txn_run/txn_commit` as escape hatch |

---

## What Doesn't Change

- **58 consumer files** — zero modifications
- **9 store files** — zero modifications (they call `getDatabase().prepare().run()`)
- **Schema, migrations, FTS5** — all run in the sidecar, same SQLite engine
- **SQLite extensions** — loaded by the sidecar, not the extension host
- **WAL mode, pragmas, backup** — all handled by the sidecar
- **Result<T> pattern** — `init.ts` wrapper functions stay the same
