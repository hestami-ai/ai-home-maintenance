/**
 * Extract the most recent INTAKE handoff document from a live JanumiCode SQLite
 * database into a frozen JSON fixture for the Ollama-backed prompt-regression
 * harness. Read-only — never mutates the source DB.
 *
 * Usage:
 *   JANUMICODE_LIVE_DB="C:/path/to/janumicode.db" node scripts/extractIntakeFixture.js
 *   node scripts/extractIntakeFixture.js "C:/path/to/janumicode.db"
 *
 * Output: src/test/fixtures/ollama/intake-handoff.json
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

function tryParseJson(value) {
	if (value == null) return value;
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value);
	} catch {
		return value; // leave as-is if not JSON
	}
}

function main() {
	const dbPath = process.env.JANUMICODE_LIVE_DB || process.argv[2];
	if (!dbPath) {
		console.error('ERROR: provide DB path via JANUMICODE_LIVE_DB env var or first CLI arg.');
		process.exit(1);
	}
	if (!fs.existsSync(dbPath)) {
		console.error(`ERROR: DB file not found: ${dbPath}`);
		process.exit(1);
	}

	console.log(`[extract] opening (read-only): ${dbPath}`);
	const db = new Database(dbPath, { readonly: true, fileMustExist: true });

	// 1. Most recent INTAKE handoff
	const handoffRow = db.prepare(
		`SELECT * FROM handoff_documents
		 WHERE doc_type = 'INTAKE'
		 ORDER BY created_at DESC
		 LIMIT 1`
	).get();

	if (!handoffRow) {
		console.error('ERROR: no INTAKE rows found in handoff_documents.');
		db.close();
		process.exit(1);
	}

	console.log(`[extract] handoff doc_id=${handoffRow.doc_id} dialogue_id=${handoffRow.dialogue_id} created_at=${handoffRow.created_at}`);

	// Parse the JSON content blob in-place
	handoffRow.content = tryParseJson(handoffRow.content);

	// 2. Parent dialogue row (for goal text)
	const dialogueRow = db.prepare(
		`SELECT * FROM dialogues WHERE dialogue_id = ?`
	).get(handoffRow.dialogue_id);
	if (!dialogueRow) {
		console.warn('[extract] WARN: parent dialogue row missing');
	}

	// 3. Intake conversation row (for finalized_plan, mmp_history, etc.)
	const intakeRow = db.prepare(
		`SELECT * FROM intake_conversations WHERE dialogue_id = ?`
	).get(handoffRow.dialogue_id);
	if (intakeRow) {
		intakeRow.draft_plan = tryParseJson(intakeRow.draft_plan);
		intakeRow.accumulations = tryParseJson(intakeRow.accumulations);
		intakeRow.finalized_plan = tryParseJson(intakeRow.finalized_plan);
		intakeRow.domain_coverage = tryParseJson(intakeRow.domain_coverage);
		intakeRow.checkpoints = tryParseJson(intakeRow.checkpoints);
		intakeRow.classifier_result = tryParseJson(intakeRow.classifier_result);
		intakeRow.mmp_history = tryParseJson(intakeRow.mmp_history);
	} else {
		console.warn('[extract] WARN: no intake_conversations row for this dialogue');
	}

	// 4. Sanity counts
	const handoffCount = db.prepare(`SELECT COUNT(*) AS n FROM handoff_documents WHERE doc_type='INTAKE'`).get().n;
	const dialogueCount = db.prepare(`SELECT COUNT(*) AS n FROM dialogues`).get().n;
	console.log(`[extract] totals: dialogues=${dialogueCount} intake_handoffs=${handoffCount}`);

	const bundle = {
		capturedAt: new Date().toISOString(),
		sourceDbPath: dbPath,
		dialogueId: handoffRow.dialogue_id,
		goal: dialogueRow ? dialogueRow.goal : null,
		dialogue: dialogueRow || null,
		handoffDoc: handoffRow,
		intakeConversation: intakeRow || null,
	};

	const outDir = path.join(__dirname, '..', 'src', 'test', 'fixtures', 'ollama');
	fs.mkdirSync(outDir, { recursive: true });
	const outPath = path.join(outDir, 'intake-handoff.json');
	fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2), 'utf8');

	const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
	console.log(`[extract] wrote ${outPath} (${sizeKb} KB)`);

	// Quick content sanity
	const content = handoffRow.content;
	if (content && typeof content === 'object') {
		const keys = Object.keys(content);
		console.log(`[extract] handoffDoc.content top-level keys: ${keys.join(', ') || '(none)'}`);
		if (content.finalizedPlan) {
			console.log('[extract] OK: handoffDoc.content.finalizedPlan present');
		} else {
			console.warn('[extract] WARN: handoffDoc.content.finalizedPlan missing — fixture may be incomplete');
		}
	} else {
		console.warn('[extract] WARN: handoffDoc.content is not an object');
	}

	db.close();
	console.log('[extract] done.');
}

main();
