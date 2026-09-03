// MXR-07 — a DURABLE ArtifactStore, so a record no longer names bytes that a restart erased.
//
// ── ⭑ ITS OWN DATABASE, NOT A SIXTH TABLE IN THE GOVERNED SCHEMA ─────────────────────────────────────────────
// The content plane and the record plane have OPPOSITE retention semantics: the record is permanent (`PER-8`,
// no hard delete after participation) and the content is purgeable at retention expiry (`PER-12`). Putting
// them in one schema would put a purge path inside the store whose entire guarantee is that nothing is
// deleted, and it would add a table to `Section 10`'s typed persistence — which §10.1 says these information
// requirements are "not permission" to do. A separate database is the two-plane architecture made physical.
//
// ── WHAT §31 ACTUALLY REQUIRES, READ RATHER THAN RECALLED ────────────────────────────────────────────────────
// ⚠ THIS CORRECTS A CLAIM THIS REPOSITORY HAS BEEN CARRYING. §31 was cited as making S3-compatible object
// storage normative. It does not: *"Large binary and document Artifacts **SHOULD** use S3-compatible
// storage"* — SHOULD, and scoped to LARGE BINARY AND DOCUMENT artifacts. A materialized judge prompt is
// neither. §31's actual SHALLs are §31.2 (*"Object keys SHALL include opaque tenant-scoped prefixes"*) and
// §31.3 (*"Artifacts SHALL use cryptographic content hashes"*), and both are honoured here. §31.1 puts
// authoritative METADATA in a relational store, which is where this one is.
//
// So this is not a stopgap standing in for an S3 adapter. It is a compliant content plane; an S3 adapter
// becomes worthwhile when artifacts are large, which is a deployment question rather than a conformance one.
import { createSqliteDriver, type SqlDriver } from './sql-driver.js';
import type {
	ArtifactContentInput,
	ArtifactStore,
	ContentDurability,
	PurgeOutcome,
	StoredArtifactMeta,
	StoredArtifactRef
} from '@janumipwb/rph-ports';
import { createHash } from 'node:crypto';

export const SQLITE_STORAGE_PROVIDER = 'jpwb:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS artifact_content (
	storage_key   TEXT PRIMARY KEY,
	content_hash  TEXT NOT NULL,
	byte_size     INTEGER NOT NULL,
	media_type    TEXT NOT NULL,
	purgeability  TEXT NOT NULL,
	purged        INTEGER NOT NULL DEFAULT 0,
	-- NULL once purged. The ROW survives: an ARTIFACT referencing a purged key must stay EXPLICABLE, or a
	-- reader cannot tell "purged on schedule" from "never stored" from "lost" — the silent-omission defect
	-- one layer down. Deleting the row would be the hard delete this table exists to avoid.
	bytes         TEXT
);
`;

/** SHA-256 over the BYTES (§31.3), never a canonicalized object — see the in-memory default's note. */
function hashBytes(bytes: string): string {
	return `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`;
}

interface Row {
	storage_key: string;
	content_hash: string;
	byte_size: number;
	media_type: string;
	purgeability: string;
	purged: number;
	bytes: string | null;
}

export class SqliteArtifactStore implements ArtifactStore {
	readonly durability: ContentDurability = 'DURABLE';
	private readonly db: SqlDriver;

	constructor(opts: { driver?: SqlDriver; filename?: string } = {}) {
		this.db = opts.driver ?? createSqliteDriver(opts.filename);
		this.db.exec(SCHEMA);
	}

	async put(input: ArtifactContentInput): Promise<StoredArtifactRef> {
		const contentHash = hashBytes(input.bytes);
		// ⭑ RETENTION CLASS IS PART OF THE IDENTITY (REG-F-337). Keyed on tenant+hash alone, a later
		// PURGEABLE put of the SAME BYTES silently downgraded a RETAINED entry and `purge` then destroyed
		// participating content. Two retention fates are two stored objects; canon licenses exactly that
		// (DOC-003:89, "One Representation may have several Artifacts"). The durable adapter must reproduce
		// this or the defect returns the moment it is wired.
		const storageKey = `${input.tenantPrefix}/${input.purgeability}/${contentHash.slice('sha256:'.length)}`;
		const byteSize = Buffer.byteLength(input.bytes, 'utf8');
		this.db
			.prepare(
				`INSERT INTO artifact_content(storage_key,content_hash,byte_size,media_type,purgeability,purged,bytes)
				 VALUES(?,?,?,?,?,0,?)
				 ON CONFLICT(storage_key) DO UPDATE SET bytes = excluded.bytes, purged = 0`
			)
			.run(storageKey, contentHash, byteSize, input.mediaType, input.purgeability, input.bytes);
		return { storageProvider: SQLITE_STORAGE_PROVIDER, storageKey, contentHash, byteSize };
	}

	async get(storageKey: string): Promise<string | undefined> {
		const row = this.db
			.prepare('SELECT bytes FROM artifact_content WHERE storage_key = ?')
			.get(storageKey) as { bytes: string | null } | undefined;
		return row?.bytes ?? undefined;
	}

	async stat(storageKey: string): Promise<StoredArtifactMeta | undefined> {
		const row = this.db
			.prepare('SELECT * FROM artifact_content WHERE storage_key = ?')
			.get(storageKey) as Row | undefined;
		if (!row) return undefined;
		return {
			storageKey: row.storage_key,
			contentHash: row.content_hash,
			byteSize: row.byte_size,
			mediaType: row.media_type,
			purgeability: row.purgeability as StoredArtifactMeta['purgeability'],
			purged: row.purged === 1
		};
	}

	async purge(storageKey: string): Promise<PurgeOutcome> {
		const row = this.db
			.prepare('SELECT purgeability FROM artifact_content WHERE storage_key = ?')
			.get(storageKey) as { purgeability: string } | undefined;
		if (!row)
			return {
				purged: false,
				// ⭑ UNLIKE THE IN-MEMORY DEFAULT, THIS STORE CAN TELL THE CASES APART, so it says the true thing
				// rather than the careful one. Rows survive purging, so an absent row really does mean nothing
				// was ever stored here — a claim the process-local store cannot make after a restart.
				refusedBecause: `no row exists for storageKey '${storageKey}', so nothing was purged. This store is DURABLE and its rows survive purging as tombstones, so an absent row means the key was never written — not that its content was removed.`
			};
		if (row.purgeability === 'RETAINED_BY_PARTICIPATION')
			return {
				purged: false,
				refusedBecause: `storageKey '${storageKey}' is RETAINED_BY_PARTICIPATION. PER-8: material that has participated in execution, assurance, governance, a baseline or traceability is never hard-deleted, and purging it here would make this store the mechanism by which PER-8 is violated.`
			};
		// The bytes go; the row stays. See the schema note.
		this.db
			.prepare('UPDATE artifact_content SET bytes = NULL, purged = 1 WHERE storage_key = ?')
			.run(storageKey);
		return { purged: true };
	}

	close(): void {
		this.db.close();
	}
}
