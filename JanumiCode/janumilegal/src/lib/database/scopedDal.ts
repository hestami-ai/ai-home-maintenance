/**
 * Scoped Data-Access Layer.
 *
 * Per:
 *   - docs/janumilegal_multi_matter_isolation_addendum.md §4 §11
 *   - docs/janumilegal_implementation_roadmap.md Wave 0 §0.2a
 *
 * Architectural rule: NO domain query may run without an active scope.
 * The DAL is the only sanctioned path for SQL execution against domain tables.
 * Raw `db.prepare(...)` calls outside this module are rejected by the
 * `lintLayers` CI script (see `scripts/lintLayers.ts`).
 *
 * Wave 0 surface: minimal CRUD on tenant tables (firms, clients, matters, users,
 * user_matter_access) and a generic scoped reader/writer for domain tables.
 *
 * Cross-matter operations are NOT exposed here. They live under
 * `src/lib/database/crossMatter.ts` (Wave 6) with their own audit-emitting
 * surface and a separate, named API.
 */

import type Database from 'better-sqlite3';
import type { Scope, PartialScope } from './types.js';
import { SCOPED_DOMAIN_TABLES, UNSCOPED_REGISTRY_TABLES } from './schema.js';

const SCOPED_TABLES = new Set(SCOPED_DOMAIN_TABLES);
const REGISTRY_TABLES = new Set(UNSCOPED_REGISTRY_TABLES);

/** A bound DAL pinned to a single matter's scope. */
export class ScopedDal {
  constructor(
    private readonly db: Database.Database,
    private readonly scope: Scope,
  ) {}

  /**
   * SELECT all rows from a scoped domain table for the active scope.
   * Filters by additional `where` columns (AND-combined).
   */
  selectAll<T = unknown>(table: string, where: Record<string, unknown> = {}): T[] {
    assertScopedDomainTable(table);
    const cols = Object.keys(where);
    const whereClause = cols.length ? ' AND ' + cols.map((c) => `${c} = ?`).join(' AND ') : '';
    const sql = `SELECT * FROM ${table} WHERE firm_id = ? AND client_id = ? AND matter_id = ?${whereClause}`;
    return this.db.prepare(sql).all(this.scope.firmId, this.scope.clientId, this.scope.matterId, ...cols.map((c) => where[c])) as T[];
  }

  /** SELECT a single row. */
  selectOne<T = unknown>(table: string, where: Record<string, unknown> = {}): T | undefined {
    const rows = this.selectAll<T>(table, where);
    return rows[0];
  }

  /** INSERT a row, automatically injecting the active scope. */
  insert(table: string, row: Record<string, unknown>): void {
    assertScopedDomainTable(table);
    const merged: Record<string, unknown> = {
      firm_id: this.scope.firmId,
      client_id: this.scope.clientId,
      matter_id: this.scope.matterId,
      ...row,
    };
    const cols = Object.keys(merged);
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
    this.db.prepare(sql).run(...cols.map((c) => merged[c] as never));
  }

  /** UPDATE rows, automatically constrained by the active scope. */
  update(table: string, set: Record<string, unknown>, where: Record<string, unknown> = {}): number {
    assertScopedDomainTable(table);
    const setCols = Object.keys(set);
    if (setCols.length === 0) return 0;
    const whereCols = Object.keys(where);
    const setClause = setCols.map((c) => `${c} = ?`).join(', ');
    const whereExtra = whereCols.length ? ' AND ' + whereCols.map((c) => `${c} = ?`).join(' AND ') : '';
    const sql = `UPDATE ${table} SET ${setClause} WHERE firm_id = ? AND client_id = ? AND matter_id = ?${whereExtra}`;
    const params = [
      ...setCols.map((c) => set[c]),
      this.scope.firmId,
      this.scope.clientId,
      this.scope.matterId,
      ...whereCols.map((c) => where[c]),
    ];
    const info = this.db.prepare(sql).run(...(params as never[]));
    return info.changes;
  }

  /** Returns the active scope (read-only). */
  getScope(): Scope {
    return this.scope;
  }
}

/**
 * Tenant-table operations (firm/client/matter/user registry).
 * These are not scoped to a matter; they are scoped to a firm at most.
 */
export class FirmDal {
  constructor(private readonly db: Database.Database) {}

  insertFirm(firmId: string, name: string, primaryJurisdiction: string): void {
    this.db
      .prepare('INSERT INTO firms (firm_id, name, primary_jurisdiction, created_at) VALUES (?, ?, ?, ?)')
      .run(firmId, name, primaryJurisdiction, new Date().toISOString());
  }

  insertClient(firmId: string, clientId: string, name: string, entityType: string | null = null): void {
    this.db
      .prepare('INSERT INTO clients (firm_id, client_id, name, entity_type, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(firmId, clientId, name, entityType, new Date().toISOString());
  }

  insertMatter(args: {
    firmId: string;
    clientId: string;
    matterId: string;
    matterName: string;
    practiceArea: string;
    primaryJurisdiction: string;
    matterType: string;
    proceduralPosture?: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO matters (firm_id, client_id, matter_id, matter_name, practice_area, primary_jurisdiction, matter_type, procedural_posture, status, opened_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
      )
      .run(
        args.firmId,
        args.clientId,
        args.matterId,
        args.matterName,
        args.practiceArea,
        args.primaryJurisdiction,
        args.matterType,
        args.proceduralPosture ?? null,
        new Date().toISOString(),
      );
  }

  /**
   * Resolve a ScopedDal for a (firmId, clientId, matterId) tuple.
   * Verifies the matter exists; throws otherwise.
   */
  scopeTo(scope: Scope): ScopedDal {
    const exists = this.db
      .prepare('SELECT 1 FROM matters WHERE firm_id = ? AND client_id = ? AND matter_id = ?')
      .get(scope.firmId, scope.clientId, scope.matterId);
    if (!exists) {
      throw new Error(`matter not found in scope: ${scope.firmId}/${scope.clientId}/${scope.matterId}`);
    }
    return new ScopedDal(this.db, scope);
  }

  insertUser(args: {
    firmId: string;
    userId: string;
    displayName: string;
    role: 'attorney' | 'paralegal' | 'legal_assistant' | 'knowledge_attorney' | 'conflicts_officer' | 'admin' | 'intake_only';
    barNumbers?: ReadonlyArray<{ jurisdiction: string; barNumber: string }>;
  }): void {
    this.db
      .prepare(
        `INSERT INTO users (firm_id, user_id, display_name, role, bar_numbers_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(args.firmId, args.userId, args.displayName, args.role, JSON.stringify(args.barNumbers ?? []), new Date().toISOString());
  }

  grantAccess(args: {
    firmId: string;
    userId: string;
    clientId: string;
    matterId: string;
    role:
      | 'attorney_of_record'
      | 'supervising'
      | 'reviewer'
      | 'drafter'
      | 'paralegal'
      | 'legal_assistant'
      | 'knowledge_attorney'
      | 'billing'
      | 'intake_only'
      | 'screened_out';
    grantedBy: string;
    grantBasis: string;
    effectiveUntil?: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO user_matter_access (firm_id, user_id, client_id, matter_id, role, redacted_fields_json, read_only, effective_from, effective_until, granted_by, grant_basis)
         VALUES (?, ?, ?, ?, ?, '[]', 0, ?, ?, ?, ?)`,
      )
      .run(
        args.firmId,
        args.userId,
        args.clientId,
        args.matterId,
        args.role,
        new Date().toISOString(),
        args.effectiveUntil ?? null,
        args.grantedBy,
        args.grantBasis,
      );
  }

  /**
   * Schema introspection — returns column names of a table.
   * Used by schema validators and tests; not for application logic.
   */
  tableColumns(table: string): string[] {
    const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return cols.map((c) => c.name);
  }

  /**
   * List matters a user has access to. Filters out screened matters at the
   * data-access layer (per multi-matter §4.4).
   */
  listAccessibleMatters(firmId: string, userId: string): Scope[] {
    const rows = this.db
      .prepare(
        `SELECT client_id, matter_id, role FROM user_matter_access
         WHERE firm_id = ? AND user_id = ?
           AND role != 'screened_out'
           AND (effective_until IS NULL OR effective_until > ?)`,
      )
      .all(firmId, userId, new Date().toISOString()) as Array<{ client_id: string; matter_id: string }>;
    return rows.map((r) => ({ firmId, clientId: r.client_id, matterId: r.matter_id }));
  }
}

function assertScopedDomainTable(table: string): void {
  if (REGISTRY_TABLES.has(table)) {
    throw new Error(`table ${table} is a registry table; use FirmDal or registry-specific surfaces`);
  }
  if (!SCOPED_TABLES.has(table)) {
    throw new Error(
      `table ${table} is not registered as a scoped domain table. ` +
        `Add it to SCOPED_DOMAIN_TABLES in schema.ts or use a dedicated DAL surface.`,
    );
  }
}

export type { Scope, PartialScope };
