// Review-gallery helpers for the virtuous-cycle harness. shot() captures a LABELED viewport screenshot into
// e2e-results/gallery/<test>/NN-label.png and records it in a manifest; snapshotTruth() dumps the engine ground
// truth (introspect) alongside it. global-teardown builds an index.html from the manifest so a human (or the
// agent) can open one page and review the whole flow — the "screenshots of my end-to-end testing" the sponsor
// asked for. The gallery is cleared per run by global-setup.
import { test, type Page, type APIRequestContext } from '@playwright/test';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { introspect } from './harness';

export const GALLERY_ROOT = 'e2e-results/gallery';
const seqByTest = new Map<string, number>();

export function slug(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
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
