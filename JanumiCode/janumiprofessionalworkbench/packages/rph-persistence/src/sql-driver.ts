// The thin SQLite driver seam. The engine is a Node library: its tests run in vitest's Node workers and its
// hosts (VS Code extension, platform control-plane) are Node, so the driver is better-sqlite3 (a Node native
// addon). NOTE: better-sqlite3 cannot dlopen under the *Bun* runtime (bun#4290) — that only matters for a
// hypothetical direct-Bun host, which would supply a bun:sqlite SqlDriver behind this same interface. Bun
// here is only the package manager / task runner; no engine code executes SQLite under direct Bun.
import Database from 'better-sqlite3';
import { StoreBusyError } from '@janumipwb/rph-ports';

export interface SqlRunResult {
	readonly changes: number;
	readonly lastInsertRowid: number | bigint;
}

export interface SqlStatement {
	run(...params: unknown[]): SqlRunResult;
	get(...params: unknown[]): unknown;
	all(...params: unknown[]): unknown[];
}

export interface SqlDriver {
	exec(sql: string): void;
	prepare(sql: string): SqlStatement;
	/**
	 * Run `fn` inside a single WRITE transaction; commit on return, roll back on throw. The outermost call takes the
	 * write lock up front (`BEGIN IMMEDIATE`); a nested call is a savepoint. Throws `StoreBusyError` if the lock is
	 * not acquired within the busy timeout, before `fn` runs.
	 */
	transaction<T>(fn: () => T): T;
	/** Run `fn` inside a READ transaction: one snapshot, no write lock (`BEGIN DEFERRED`; a savepoint when nested). */
	readTransaction<T>(fn: () => T): T;
	close(): void;
}

/**
 * Open a SQLite database via better-sqlite3 (default backend). `:memory:` for tests.
 *
 * `busyTimeoutMs` is how long a writer waits for another's lock before `StoreBusyError`. It is SET EXPLICITLY:
 * better-sqlite3's own default happened to be 5000 ms, and a timeout nobody chose is a behaviour nobody owns.
 */
export function createSqliteDriver(
	filename = ':memory:',
	opts: { readonly busyTimeoutMs?: number } = {}
): SqlDriver {
	// better-sqlite3 is a Node native addon that cannot dlopen under the Bun runtime (bun#4290). Every real host
	// runs the engine under Node (vitest workers; the SvelteKit server, which Bun only *launches* via the Node-based
	// vite binary). Fail loud with an actionable message if someone runs engine code under Bun directly (e.g.
	// `bun run script.ts`) instead of surfacing a cryptic ERR_DLOPEN_FAILED. A future Bun host would inject a
	// bun:sqlite-backed SqlDriver behind this same interface.
	if ((globalThis as { Bun?: unknown }).Bun !== undefined) {
		throw new Error(
			'The RPH engine cannot open its SQLite store under the Bun runtime (better-sqlite3 is a Node native addon; bun#4290). Run engine code under Node — the SvelteKit server does this automatically. For a standalone script, use `node` (or `vite-node`), not `bun run`.'
		);
	}
	const db = new Database(filename, { timeout: opts.busyTimeoutMs ?? 5000 });
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	return {
		exec: (sql) => {
			db.exec(sql);
		},
		prepare: (sql) => db.prepare(sql) as unknown as SqlStatement,
		// ⚠ `BEGIN IMMEDIATE`, NOT the deferred default. Under WAL a deferred transaction's snapshot is fixed by its
		// first READ; if another connection commits before its first WRITE, SQLite refuses that write with
		// SQLITE_BUSY_SNAPSHOT, which no busy timeout retries — observed on the pre-DD-1 build as a raw SqliteError
		// escaping the store with the whole transaction lost. Taking the lock first makes the other writer WAIT
		// instead. better-sqlite3 turns a nested `.immediate()` into a savepoint, so only the outermost call locks.
		transaction: <T>(fn: () => T): T => {
			let entered = false;
			try {
				return db
					.transaction(() => {
						entered = true;
						return fn();
					})
					.immediate();
			} catch (error) {
				// Only a lock never acquired is "busy": once `fn` ran, a BUSY is some other fault and keeps its own identity.
				if (!entered && (error as { code?: string }).code === 'SQLITE_BUSY')
					throw new StoreBusyError();
				throw error;
			}
		},
		readTransaction: <T>(fn: () => T): T => db.transaction(fn).deferred(),
		close: () => {
			db.close();
		}
	};
}
