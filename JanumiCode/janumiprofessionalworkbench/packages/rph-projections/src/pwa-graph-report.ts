// A human/agent-readable COHERENCE REPORT over a PWA graph export + its analysis. This is the artifact a debugging
// coding agent (or a reviewer) reads to decide whether an authored PWU-Type graph is a COHERENT PWA — not a
// screenshot and not raw JSON. It renders the stricter `coherent` verdict, the structural invariants, the
// conservation advisories (the permits × dataFlow cross-check), and a compact roster of nodes and data-flow edges
// with cross-subtree edges flagged. Pure and browser-safe (no engine import).
import type { PwaGraphExport, PwaGraphReport, DataFlowEdge } from './pwa-graph.js';

const mark = (b: boolean): string => (b ? '✓' : '✗');

function verdictSection(report: PwaGraphReport): string[] {
	return [
		'## Verdict',
		'',
		`- **coherent:** ${mark(report.coherent)} — structurally valid AND artifact-flow conservation holds (the proof-harness gate).`,
		`- **valid (structural):** ${mark(report.valid)} — single root, acyclic composition, every type reachable.`,
		''
	];
}

function invariantsSection(report: PwaGraphReport): string[] {
	return [
		'## Structural invariants',
		'',
		...report.invariants.map((i) => `- [${i.ok ? 'OK' : 'FAIL'}] **${i.name}** — ${i.detail}`),
		''
	];
}

function metricsSection(report: PwaGraphReport): string[] {
	const m = report.metrics;
	return [
		'## Metrics',
		'',
		`- nodes: ${m.nodeCount} · permits edges: ${m.permitsEdges} · data-flow edges: ${m.dataFlowEdges}`,
		`- roots: ${m.rootCount} · max depth: ${m.maxDepth} · max fan-out: ${m.maxFanout}`,
		`- orphans: ${m.orphanCount} · cycles: ${m.cycleCount} · dangling inputs: ${m.danglingInputs} · unused outputs: ${m.unusedOutputs}`,
		`- **ungrounded branches: ${m.ungroundedBranches}** · cross-subtree flows: ${m.crossSubtreeFlows}`,
		''
	];
}

function listSection(title: string, items: readonly string[], empty: string): string[] {
	if (items.length === 0) return [`## ${title}`, '', `_${empty}_`, ''];
	return [`## ${title}`, '', ...items.map((f) => `- ${f}`), ''];
}

function nodesSection(ex: PwaGraphExport): string[] {
	const rows = ex.nodes.map((n) => {
		const leaf = n.permittedChildTypeIds.length === 0 ? 'L' : 'N';
		const root = n.isRoot ? ' (root)' : '';
		const io = [
			n.requiredInputs.length ? `in: ${n.requiredInputs.join(', ')}` : '',
			n.requiredOutputs.length ? `out: ${n.requiredOutputs.join(', ')}` : ''
		]
			.filter(Boolean)
			.join(' · ');
		const ioSuffix = io ? ` — ${io}` : '';
		return `- [${leaf}] **${n.name}** \`${n.pwuKind}\`${root}${ioSuffix}`;
	});
	return ['## Nodes', '', ...rows, ''];
}

function flowsSection(ex: PwaGraphExport): string[] {
	const nameOf = (id: string): string => ex.nodes.find((n) => n.id === id)?.name ?? id;
	const parents = new Map<string, string[]>();
	for (const e of ex.permits) parents.set(e.child, [...(parents.get(e.child) ?? []), e.parent]);
	const rootSet = new Set(ex.roots);
	const ancestors = (id: string): Set<string> => {
		const out = new Set<string>();
		const q = [id];
		while (q.length) {
			const x = q.shift()!;
			if (out.has(x)) continue;
			out.add(x);
			for (const p of parents.get(x) ?? []) if (!out.has(p)) q.push(p);
		}
		return out;
	};
	const crosses = (e: DataFlowEdge): boolean => {
		const up = ancestors(e.consumer);
		for (const a of ancestors(e.producer)) if (!rootSet.has(a) && up.has(a)) return false;
		return true;
	};
	const rows = ex.dataFlow.map(
		(e) =>
			`- ${nameOf(e.producer)} → ${nameOf(e.consumer)} : \`${e.artifact}\`${crosses(e) ? ' ⚠ cross-subtree' : ''}`
	);
	if (rows.length === 0) return ['## Data-flow edges', '', '_none declared_', ''];
	return ['## Data-flow edges', '', ...rows, ''];
}

/** Render the full markdown coherence report for a PWA graph export + its analysis. */
export function formatPwaCoherenceReport(ex: PwaGraphExport, report: PwaGraphReport): string {
	const lines: string[] = [
		`# PWA coherence report — ${ex.pwa.name}`,
		'',
		`${ex.pwa.domain || '(no domain)'} · v${ex.pwa.version || '?'} · ${ex.pwa.publicationStatus}`,
		'',
		...verdictSection(report),
		...invariantsSection(report),
		...listSection(
			'Artifact-flow conservation',
			report.conservation,
			'no conservation violations — every branch is grounded by its subtree.'
		),
		...metricsSection(report),
		...listSection('Structural advisories', report.findings, 'none'),
		...nodesSection(ex),
		...flowsSection(ex)
	];
	return lines.join('\n');
}
