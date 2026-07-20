// Review-gallery helpers for the virtuous-cycle harness. shot() captures a LABELED viewport screenshot into
// e2e-results/gallery/<test>/NN-label.png and records it in a manifest; snapshotTruth() dumps the engine ground
// truth (introspect) alongside it. global-teardown builds an index.html from the manifest so a human (or the
// agent) can open one page and review the whole flow — the "screenshots of my end-to-end testing" the sponsor
// asked for. The gallery is cleared per run by global-setup.
import { test, type Page, type APIRequestContext } from '@playwright/test';
import {
	analyzePwaGraph,
	buildPwaGraphExport,
	formatPwaCoherenceReport,
	type PwaGraphExport,
	type PwaGraphNode,
	type PwaGraphReport
} from '@janumipwb/rph-projections';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { introspect } from './harness';

export const GALLERY_ROOT = 'e2e-results/gallery';
const seqByTest = new Map<string, number>();

export function slug(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
}

/** Capture a labeled viewport screenshot into the review gallery and record it in the manifest. */
export async function shot(page: Page, label: string): Promise<void> {
	const title = test.info().title;
	const n = (seqByTest.get(title) ?? 0) + 1;
	seqByTest.set(title, n);
	const dir = join(GALLERY_ROOT, slug(title));
	mkdirSync(dir, { recursive: true });
	const file = join(dir, `${String(n).padStart(2, '0')}-${slug(label)}.png`);
	await page.screenshot({ path: file, fullPage: false });
	appendFileSync(
		join(GALLERY_ROOT, 'manifest.jsonl'),
		JSON.stringify({ test: title, label, file, seq: n }) + '\n'
	);
}

/** Dump the engine ground truth (introspect) into the gallery folder for review + return it. */
export async function snapshotTruth(request: APIRequestContext, label: string) {
	const title = test.info().title;
	const dir = join(GALLERY_ROOT, slug(title));
	mkdirSync(dir, { recursive: true });
	const snap = await introspect(request);
	writeFileSync(join(dir, `${slug(label)}.truth.json`), JSON.stringify(snap, null, 2));
	return snap;
}

function strArr(v: unknown): string[] {
	return Array.isArray(v) ? v.map(String) : [];
}

/** Build the canonical PWA graph export + the structural report from engine truth, write both to the gallery, and
 *  return them. This is the queryable, diffable representation the harness (and the LLM judge) validate AGAINST —
 *  not a screenshot. Defaults to the first PWA (test mode resets to one). */
export async function snapshotPwaGraph(
	request: APIRequestContext,
	label: string,
	pwaId?: string
): Promise<{ export: PwaGraphExport; report: PwaGraphReport }> {
	const title = test.info().title;
	const dir = join(GALLERY_ROOT, slug(title));
	mkdirSync(dir, { recursive: true });
	const snap = await introspect(request);
	const pwa = pwaId ? snap.pwas.find((p) => p.id === pwaId) : snap.pwas[0];
	if (!pwa) throw new Error('snapshotPwaGraph: no PWA found in engine truth');
	const meta = {
		id: pwa.id,
		name: String((pwa.state.name ?? pwa.id) as string),
		domain: String((pwa.state.domain ?? '') as string),
		version: String((pwa.state.version ?? '') as string),
		publicationStatus: String((pwa.state.publicationStatus ?? 'DRAFT') as string)
	};
	const nodes: PwaGraphNode[] = snap.pwuTypes
		.filter((t) => t.state.status !== 'REMOVED' && t.state.pwaId === pwa.id)
		.map((t) => ({
			id: t.id,
			name: String((t.state.name ?? t.id) as string),
			pwuKind: String((t.state.pwuKind ?? '') as string),
			isRoot: t.state.isRoot === true,
			permittedChildTypeIds: strArr(t.state.permittedChildTypeIds),
			requiredInputs: strArr(t.state.requiredInputs),
			requiredOutputs: strArr(t.state.requiredOutputs)
		}));
	const exported = buildPwaGraphExport(meta, nodes);
	const report = analyzePwaGraph(exported);
	writeFileSync(join(dir, `${slug(label)}.export.json`), JSON.stringify(exported, null, 2));
	writeFileSync(join(dir, `${slug(label)}.report.json`), JSON.stringify(report, null, 2));
	// The legible proof artifact a debugging agent (or a human) reads — the coherence verdict, invariants, and the
	// conservation cross-check, rendered from the same export/report the assertions run on.
	writeFileSync(join(dir, `${slug(label)}.report.md`), formatPwaCoherenceReport(exported, report));
	return { export: exported, report };
}
