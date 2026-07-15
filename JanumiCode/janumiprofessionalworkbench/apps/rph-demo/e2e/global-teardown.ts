// Build a single browsable index.html from the gallery manifest so the whole end-to-end flow can be reviewed at a
// glance (labeled screenshots grouped by test). Opens with a plain file:// — no server needed.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GALLERY_ROOT } from './support/gallery';

interface Entry {
	test: string;
	label: string;
	file: string;
	seq: number;
}

function esc(s: string): string {
	return s.replace(
		/[&<>"]/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!
	);
}

export default function globalTeardown(): void {
	const manifest = join(GALLERY_ROOT, 'manifest.jsonl');
	if (!existsSync(manifest)) return;
	const entries: Entry[] = readFileSync(manifest, 'utf8')
		.split('\n')
		.filter(Boolean)
		.map((l) => JSON.parse(l) as Entry);
	if (entries.length === 0) return;

	const byTest = new Map<string, Entry[]>();
	for (const e of entries) {
		if (!byTest.has(e.test)) byTest.set(e.test, []);
		byTest.get(e.test)!.push(e);
	}

	let body = '';
	for (const [testTitle, shots] of byTest) {
		body += `<section><h2>${esc(testTitle)}</h2><div class="row">`;
		for (const s of shots) {
			const rel = s.file.replaceAll('\\', '/').replace(new RegExp(`^${GALLERY_ROOT}/`), '');
			body += `<figure><a href="${rel}" target="_blank"><img src="${rel}" loading="lazy"></a><figcaption>${s.seq}. ${esc(s.label)}</figcaption></figure>`;
		}
		body += `</div></section>`;
	}

	const html = `<!doctype html><html><head><meta charset="utf-8"><title>JPWB E2E gallery</title><style>
:root{color-scheme:dark}body{margin:0;background:#131313;color:#e5e2e1;font:14px/1.5 'Inter',system-ui,sans-serif}
h1{padding:18px 24px;margin:0;border-bottom:1px solid #202020}h1 small{color:#8a919d;font-weight:400;font-size:12px}
section{padding:16px 24px;border-bottom:1px solid #202020}h2{font-size:15px;margin:0 0 12px;color:#9fcaff}
.row{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;width:360px}
img{width:360px;border:1px solid #404751;border-radius:8px;display:block;background:#000}
figcaption{font-size:12px;color:#c0c7d3;margin-top:6px}
</style></head><body><h1>JPWB E2E gallery <small>${esc(new Date().toISOString())} · ${entries.length} shots · ${byTest.size} tests</small></h1>${body}</body></html>`;

	writeFileSync(join(GALLERY_ROOT, 'index.html'), html);
	console.log(
		`\n[gallery] ${entries.length} screenshots across ${byTest.size} test(s) → ${join(GALLERY_ROOT, 'index.html')}\n`
	);
}
