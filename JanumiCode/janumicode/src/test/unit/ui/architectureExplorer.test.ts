/**
 * Regression tests for the four Architecture Explorer code review findings.
 *
 *  #1  renderComponentTree.getDepth() — infinite loop on cyclic
 *      parent_component_id chains. Fix: visited-set cycle break.
 *
 *  #2  ArchitectureExplorerPanel inline webview script — XSS via
 *      `indicator.innerHTML = '<span>...</span> ' + msg.data.subPhase`.
 *      Fix: textContent + DOM nodes; no innerHTML concatenation with payload.
 *
 *  #3  buildConcernMap — `text.includes(id)` substring match means short IDs
 *      like "C1" steal concerns targeted at "C10". Fix: word-boundary regex.
 *
 *  #4  ArchitectureExplorerPanel `workflow:command` subscription only matched
 *      `action === 'complete'`, but the recursive decomposition local planner
 *      emits `label: 'Recursive Decomposition'` with `action: 'output'`. The
 *      live updates documented for this panel never fired. Fix:
 *      shouldRefreshOnCommand() also matches that label/action.
 */

import { describe, it, expect } from 'vitest';
import {
	renderComponentTree,
	buildConcernMap,
	type Concern,
} from '../../../lib/ui/architectureExplorer/renderTree';
import { shouldRefreshOnCommand } from '../../../lib/ui/architectureExplorer/ArchitectureExplorerPanel';
import {
	ArchitectureDocumentStatus,
	type ArchitectureDocument,
	type ComponentSpec,
} from '../../../lib/types/architecture';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Fixtures ────────────────────────────────────────────────────────

function makeComponent(id: string, parent: string | null, label = id): ComponentSpec {
	return {
		component_id: id,
		parent_component_id: parent,
		label,
		responsibility: 'r',
		rationale: '',
		workflows_served: [],
		dependencies: [],
		interaction_patterns: [],
		technology_notes: '',
		file_scope: '',
	};
}

function makeDoc(components: ComponentSpec[]): ArchitectureDocument {
	return {
		doc_id: 'DOC-1',
		dialogue_id: 'DLG-1',
		version: 1,
		capabilities: [],
		workflow_graph: [],
		components,
		data_models: [],
		interfaces: [],
		implementation_sequence: [],
		goal_alignment_score: null,
		validation_findings: [],
		status: ArchitectureDocumentStatus.DRAFT,
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
	};
}

// ─── #1 — cycle in getDepth ──────────────────────────────────────────

describe('Finding #1 — renderComponentTree cycle in parent chain', () => {
	it('(fail-to-pass) terminates instead of hanging when parent_component_id forms a cycle', () => {
		// A → B → A: pre-fix this would loop forever inside getDepth.
		const a = makeComponent('A', 'B');
		const b = makeComponent('B', 'A');
		const doc = makeDoc([a, b]);

		// Bound the test with a timeout so that an actual hang fails fast
		// instead of stalling vitest's whole worker.
		const start = Date.now();
		const html = renderComponentTree(doc, new Map());
		const elapsedMs = Date.now() - start;

		expect(elapsedMs).toBeLessThan(1000);
		expect(typeof html).toBe('string');
		// Both nodes have parents (cyclic), so neither is top-level — the
		// stats bar still renders with total=2, proving we walked the array
		// without hanging.
		expect(html).toContain('<strong>2</strong> total');
	}, 2000);

	it('(pass-to-pass) still renders an acyclic parent chain with correct depth', () => {
		const root = makeComponent('R', null, 'Root');
		const mid = makeComponent('M', 'R', 'Mid');
		const leaf = makeComponent('L', 'M', 'Leaf');
		const doc = makeDoc([root, mid, leaf]);

		const html = renderComponentTree(doc, new Map());
		expect(html).toContain('Root');
		expect(html).toContain('Mid');
		expect(html).toContain('Leaf');
		// Max depth label rendered in the stats bar (depth = 2 for L → M → R).
		expect(html).toContain('<strong>2</strong> max depth');
	});
});

// ─── #3 — substring theft in buildConcernMap ─────────────────────────

describe('Finding #3 — buildConcernMap substring theft', () => {
	it('(fail-to-pass) does not attribute "C10" concerns to "C1"', () => {
		const doc = makeDoc([
			makeComponent('C1', null),
			makeComponent('C10', null),
		]);
		const review = JSON.stringify({
			concerns: [{ severity: 'HIGH', summary: 'Issue in C10 module', detail: '' }],
		});

		const map = buildConcernMap([review], doc);

		// C10 should be attributed; C1 must NOT be (this fails pre-fix).
		expect(map.get('C10')?.length ?? 0).toBe(1);
		expect(map.get('C1')).toBeUndefined();
	});

	it('(pass-to-pass) still attributes a clean ID match correctly', () => {
		const doc = makeDoc([makeComponent('AUTH-SVC', null)]);
		const review = JSON.stringify({
			concerns: [{ severity: 'MED', summary: 'AUTH-SVC has weak validation', detail: '' }],
		});

		const map = buildConcernMap([review], doc);
		expect(map.get('AUTH-SVC')?.length).toBe(1);
		const concern = (map.get('AUTH-SVC') as Concern[])[0];
		expect(concern.severity).toBe('MED');
	});

	it('(pass-to-pass) routes unmatched concerns to __general__', () => {
		const doc = makeDoc([makeComponent('X', null)]);
		const review = JSON.stringify({
			concerns: [{ severity: 'LOW', summary: 'totally unrelated', detail: '' }],
		});
		const map = buildConcernMap([review], doc);
		expect(map.get('__general__')?.length).toBe(1);
	});
});

// ─── #4 — broken subscription filter ─────────────────────────────────

describe('Finding #4 — shouldRefreshOnCommand subscription filter', () => {
	it('(fail-to-pass) refreshes for Recursive Decomposition output events', () => {
		// Pre-fix this returned false: the predicate only accepted action==='complete'
		// AND a label containing "Architect"/"ARCHITECTURE", missing the local
		// planner's actual label "Recursive Decomposition".
		expect(shouldRefreshOnCommand('Recursive Decomposition', 'output')).toBe(true);
	});

	it('(pass-to-pass) still refreshes on architecture phase command completion', () => {
		expect(shouldRefreshOnCommand('Architect — DECOMPOSING', 'complete')).toBe(true);
		expect(shouldRefreshOnCommand('ARCHITECTURE phase', 'complete')).toBe(true);
	});

	it('(pass-to-pass) ignores unrelated commands', () => {
		expect(shouldRefreshOnCommand('Verifier — proof check', 'complete')).toBe(false);
		expect(shouldRefreshOnCommand('Architect — DECOMPOSING', 'start')).toBe(false);
	});
});

// ─── #2 — XSS via innerHTML concatenation ────────────────────────────

describe('Finding #2 — webview script must not innerHTML-concat the progress payload', () => {
	// We can't realistically execute the webview's inline JS from vitest, but
	// we can guard against the dangerous pattern by scanning the source. The
	// pre-fix code contained `innerHTML = '<span...></span> ' + msg.data.subPhase`
	// which executes arbitrary HTML/JS in the webview.
	const panelSource = fs.readFileSync(
		path.resolve(__dirname, '../../../lib/ui/architectureExplorer/ArchitectureExplorerPanel.ts'),
		'utf8',
	);

	it('(fail-to-pass) does not assign innerHTML by concatenating msg.data.subPhase', () => {
		expect(panelSource).not.toMatch(/innerHTML\s*=\s*['"`][^'"`]*['"`]\s*\+\s*msg\.data\.subPhase/);
	});

	it('(pass-to-pass) uses textContent for the untrusted progress payload', () => {
		expect(panelSource).toMatch(/textContent/);
	});
});
