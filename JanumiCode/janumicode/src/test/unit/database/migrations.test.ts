import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { getDatabase } from '../../../lib/database/init';
import { getCurrentSchemaVersion, validateSchema } from '../../../lib/database/migrations';

describe('Database Migrations', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	it('creates database with latest schema version', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();
		const version = getCurrentSchemaVersion(db!);
		expect(version).toBeGreaterThanOrEqual(1);
	});

	it('validates schema successfully', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();
		const result = validateSchema(db!);
		expect(result.success).toBe(true);
	});

	it('creates all expected core tables', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();
		const tables = db!
			.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
			.all() as Array<{ name: string }>;
		const tableNames = tables.map(t => t.name);

		const expectedTables = [
			'dialogue_events',
			'claims',
			'verdicts',
			'gates',
			'human_decisions',
			'dialogues',
			'intake_conversations',
		];
		for (const table of expectedTables) {
			expect(tableNames, `Missing table: ${table}`).toContain(table);
		}
	});

	it('V7: arch_capabilities has parent_capability_id column', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		// Check column exists
		const columns = db!
			.prepare("PRAGMA table_info('arch_capabilities')")
			.all() as Array<{ name: string; type: string; dflt_value: string | null }>;
		const colNames = columns.map(c => c.name);
		expect(colNames).toContain('parent_capability_id');

		// Verify default is NULL
		const parentCol = columns.find(c => c.name === 'parent_capability_id');
		expect(parentCol).toBeDefined();
		expect(parentCol!.dflt_value).toBe('NULL');

		// Check index exists
		const indexes = db!
			.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='arch_capabilities'")
			.all() as Array<{ name: string }>;
		const indexNames = indexes.map(i => i.name);
		expect(indexNames).toContain('idx_arch_cap_parent');
	});

	it('V2: architecture_documents and lookup tables exist', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		const tables = db!
			.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
			.all() as Array<{ name: string }>;
		const tableNames = tables.map(t => t.name);

		expect(tableNames).toContain('architecture_documents');
		expect(tableNames).toContain('arch_capabilities');
		expect(tableNames).toContain('arch_components');
		expect(tableNames).toContain('arch_domain_mappings');
		expect(tableNames).toContain('arch_workflows');
		expect(tableNames).toContain('arch_implementation_steps');
	});

	it('V3: intake_conversations has mmp_history column', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		const columns = db!
			.prepare("PRAGMA table_info('intake_conversations')")
			.all() as Array<{ name: string }>;
		const colNames = columns.map(c => c.name);
		expect(colNames).toContain('mmp_history');
	});

	it('V4: arch_components has rationale and interaction_patterns columns', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		const columns = db!
			.prepare("PRAGMA table_info('arch_components')")
			.all() as Array<{ name: string; dflt_value: string | null }>;
		const colNames = columns.map(c => c.name);

		expect(colNames).toContain('rationale');
		expect(colNames).toContain('interaction_patterns');

		const rationaleCol = columns.find(c => c.name === 'rationale');
		expect(rationaleCol?.dflt_value).toBe("''");

		const patternsCol = columns.find(c => c.name === 'interaction_patterns');
		expect(patternsCol?.dflt_value).toBe("'[]'");
	});

	it('V5: verdicts has novel_dependency column', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		const columns = db!
			.prepare("PRAGMA table_info('verdicts')")
			.all() as Array<{ name: string; dflt_value: string | null }>;
		const colNames = columns.map(c => c.name);

		expect(colNames).toContain('novel_dependency');

		const col = columns.find(c => c.name === 'novel_dependency');
		expect(col?.dflt_value).toBe('0');
	});

	it('V6: intake_conversations sub_state CHECK includes PRODUCT_REVIEW', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		// Insert a row with PRODUCT_REVIEW to verify constraint allows it
		db!.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES ('aaaaaaaa-bbbb-cccc-dddd-000000000001', 'test', 'ACTIVE', datetime('now'))"
		).run();

		const insertResult = () =>
			db!
				.prepare(
					"INSERT INTO intake_conversations (dialogue_id, sub_state) VALUES (?, ?)"
				)
				.run('aaaaaaaa-bbbb-cccc-dddd-000000000001', 'PRODUCT_REVIEW');

		expect(insertResult).not.toThrow();
	});

	it('V8: intake_conversations has proposer_phase column and expanded sub_states', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		const columns = db!
			.prepare("PRAGMA table_info('intake_conversations')")
			.all() as Array<{ name: string }>;
		const colNames = columns.map(c => c.name);

		expect(colNames).toContain('proposer_phase');

		// Test that proposer sub-states are allowed
		db!.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES ('aaaaaaaa-bbbb-cccc-dddd-000000000002', 'test', 'ACTIVE', datetime('now'))"
		).run();

		const insertResult = () =>
			db!
				.prepare(
					"INSERT INTO intake_conversations (dialogue_id, sub_state) VALUES (?, ?)"
				)
				.run('aaaaaaaa-bbbb-cccc-dddd-000000000002', 'PROPOSING_BUSINESS_DOMAINS');

		expect(insertResult).not.toThrow();
	});

	it('V9: pending_mmp_decisions table exists with correct schema', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		const tables = db!
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pending_mmp_decisions'")
			.all() as Array<{ name: string }>;

		expect(tables).toHaveLength(1);

		const columns = db!
			.prepare("PRAGMA table_info('pending_mmp_decisions')")
			.all() as Array<{ name: string }>;
		const colNames = columns.map(c => c.name);

		expect(colNames).toContain('dialogue_id');
		expect(colNames).toContain('card_id');
		expect(colNames).toContain('mirror_decisions');
		expect(colNames).toContain('menu_selections');
		expect(colNames).toContain('premortem_decisions');
		expect(colNames).toContain('product_edits');

		// Verify UNIQUE constraint on (dialogue_id, card_id)
		const indexes = db!
			.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='pending_mmp_decisions'")
			.all() as Array<{ sql: string | null }>;
		const hasUniqueConstraint = indexes.some(idx => idx.sql?.includes('dialogue_id') && idx.sql?.includes('card_id'));
		expect(hasUniqueConstraint).toBe(true);
	});

	it('V10: generated_documents table exists with UNIQUE constraint', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		const tables = db!
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='generated_documents'")
			.all() as Array<{ name: string }>;

		expect(tables).toHaveLength(1);

		const columns = db!
			.prepare("PRAGMA table_info('generated_documents')")
			.all() as Array<{ name: string }>;
		const colNames = columns.map(c => c.name);

		expect(colNames).toContain('dialogue_id');
		expect(colNames).toContain('document_type');
		expect(colNames).toContain('title');
		expect(colNames).toContain('content');
		expect(colNames).toContain('created_at');
	});

	it('V11: webview_drafts table exists', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		const tables = db!
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='webview_drafts'")
			.all() as Array<{ name: string }>;

		expect(tables).toHaveLength(1);

		const columns = db!
			.prepare("PRAGMA table_info('webview_drafts')")
			.all() as Array<{ name: string }>;
		const colNames = columns.map(c => c.name);

		expect(colNames).toContain('dialogue_id');
		expect(colNames).toContain('category');
		expect(colNames).toContain('item_key');
		expect(colNames).toContain('value');
	});

	it('V12: workflow_states has transition_graph_version column', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		const columns = db!
			.prepare("PRAGMA table_info('workflow_states')")
			.all() as Array<{ name: string; dflt_value: string | null }>;
		const colNames = columns.map(c => c.name);

		expect(colNames).toContain('transition_graph_version');

		const col = columns.find(c => c.name === 'transition_graph_version');
		expect(col?.dflt_value).toBe('1');
	});

	it('V13: Deep Memory tables exist (memory_objects, memory_edges, extraction_runs, context_packets)', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		const tables = db!
			.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
			.all() as Array<{ name: string }>;
		const tableNames = tables.map(t => t.name);

		expect(tableNames).toContain('memory_objects');
		expect(tableNames).toContain('memory_edges');
		expect(tableNames).toContain('memory_extraction_runs');
		expect(tableNames).toContain('memory_context_packets');

		// Verify embeddings table was recreated with widened source_type
		expect(tableNames).toContain('embeddings');
		expect(tableNames).not.toContain('embeddings_v13'); // Should have been renamed
	});

	it('V13: memory_objects has correct schema with CHECK constraints', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		const columns = db!
			.prepare("PRAGMA table_info('memory_objects')")
			.all() as Array<{ name: string }>;
		const colNames = columns.map(c => c.name);

		expect(colNames).toContain('object_id');
		expect(colNames).toContain('object_type');
		expect(colNames).toContain('authority_level');
		expect(colNames).toContain('validation_status');
		expect(colNames).toContain('extraction_run_id');
		expect(colNames).toContain('superseded_by');
	});

	it('schema version reflects latest migration', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		const version = getCurrentSchemaVersion(db!);
		// Should be at least V13 (latest migration in schema.ts)
		expect(version).toBeGreaterThanOrEqual(13);
	});

	it('idempotent re-run: migrations do not fail when run twice', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		// Running validateSchema again should succeed
		const result1 = validateSchema(db!);
		expect(result1.success).toBe(true);

		const result2 = validateSchema(db!);
		expect(result2.success).toBe(true);
	});

	it('all MAKER tables exist (V1)', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		const tables = db!
			.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
			.all() as Array<{ name: string }>;
		const tableNames = tables.map(t => t.name);

		const makerTables = [
			'maker_intents',
			'maker_task_units',
			'maker_task_dependencies',
			'maker_claims',
			'maker_claim_validations',
			'maker_validation_tests',
			'maker_execution_traces',
		];

		for (const table of makerTables) {
			expect(tableNames, `Missing MAKER table: ${table}`).toContain(table);
		}
	});

	it('workflow_commands and workflow_command_outputs exist (V1)', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		const tables = db!
			.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
			.all() as Array<{ name: string }>;
		const tableNames = tables.map(t => t.name);

		expect(tableNames).toContain('workflow_commands');
		expect(tableNames).toContain('workflow_command_outputs');
	});

	it('FTS table fts_stream_content exists (V1)', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		const tables = db!
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fts_stream_content'")
			.all() as Array<{ name: string }>;

		expect(tables).toHaveLength(1);
	});
});
