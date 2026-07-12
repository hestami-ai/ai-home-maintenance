// The thin SQLite driver seam. The engine is a Node library: its tests run in vitest's Node workers and its
// hosts (VS Code extension, platform control-plane) are Node, so the driver is better-sqlite3 (a Node native
// addon). NOTE: better-sqlite3 cannot dlopen under the *Bun* runtime (bun#4290) — that only matters for a
// hypothetical direct-Bun host, which would supply a bun:sqlite SqlDriver behind this same interface. Bun
// here is only the package manager / task runner; no engine code executes SQLite under direct Bun.
import Database from 'better-sqlite3';

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
	/** Run `fn` inside a single transaction; commit on return, roll back on throw. */
	transaction<T>(fn: () => T): T;
	close(): void;
}

/** Open a SQLite database via better-sqlite3 (default backend). `:memory:` for tests. */
export function createSqliteDriver(filename = ':memory:'): SqlDriver {
	const db = new Database(filename);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	return {
		exec: (sql) => {
			db.exec(sql);
		},
		prepare: (sql) => db.prepare(sql) as unknown as SqlStatement,
		transaction: <T>(fn: () => T): T => db.transaction(fn)(),
		close: () => {
			db.close();
		}
	};
}
