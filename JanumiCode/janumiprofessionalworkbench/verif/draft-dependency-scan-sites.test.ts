// ── THE SCAN-SITE CENSUS: WHAT A DRAFT READS AS A SET, AND UNDER WHICH DECLARATION (`JAN-CRITREAD` `DD-6`) ───────────
//
// `REG-D-070` narrowed the commit check from "the log must not have moved at all" to "nothing I DECLARED changed".
// The old whole-log limb caught an undeclared dependency for free; the new rule cannot, so the net it removed is
// replaced by gates. This is the first: every SET READ — a list or a scan — in the file set the design names is
// recorded here and classified, and a new one reddens `gate:fast` until somebody classifies it.
//
// ⭑ THE CLASSES (DESIGN §5.5):
//   DECLARED  — the set IS a declared group (G1 a PWA's conversation, G2 its types, G3 its floor review records,
//               G4 the reviewer exchanges about it), so a change to a member refuses the draft, naming it.
//   DISPLAY   — read to SHOW a human or the assistant, never to shape the candidate. A change to it can make the
//               screen stale; it cannot make the draft wrong. (`REG-F-066`: waivers are display-only on this path.)
//   ADVISORY  — read to advise or lint, where being out of date changes nothing the draft commits.
//   REPLAY    — read by a handler during the replay, and covered by a §5.1 PIN rather than by a group.
//
// ⚠ WHAT THIS GATE IS AND IS NOT. It is a census of SET reads in a NAMED file set — the design's own limits, quoted
// below. It does not see reads outside that set, reads through the canonical witness or the artifact store, or event
// payloads read without a query. Direct by-id reads are the other gate's subject, not this one's.
//
// ⛔ A NEW ROW IS NOT A FAILURE TO SILENCE. It means somebody taught the draft to read a new set: classify it, and if
// the class is DECLARED and no group covers it, the rule in `REG-D-070` §5.1 needs a group before the code ships.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (relative: string) => readFileSync(`${ROOT}${relative}`, 'utf8');

/**
 * ⭐ THE SCAN SURFACE, DERIVED FROM THE QUERY MODULE ITSELF, never hand-listed: a query is a SCAN when it reaches
 * `listByType` or `readAllEvents` — that is, when it enumerates a TYPE rather than loading one aggregate by id. The
 * fixed point below follows those calls through `queries.ts`'s own helpers, so a new list helper is a scan the moment
 * it is written, whether or not anyone remembers this file.
 */
function scanQueryNames(): string[] {
	const source = read('packages/rph-engine/src/queries.ts');
	const bodies = new Map<string, string>();
	const declaration =
		/export (?:function|const) ([A-Za-z0-9_]+)[\s\S]*?(?=\nexport (?:function|const|interface|type)|$)/g;
	for (const match of source.matchAll(declaration)) bodies.set(match[1]!, match[0]);
	const scans = new Set<string>(['listByType']);
	for (let changed = true; changed;) {
		changed = false;
		for (const [name, body] of bodies) {
			if (scans.has(name)) continue;
			const reaches =
				/\breadAllEvents\(/.test(body) ||
				[...scans].some((scan) => new RegExp(`\\b${scan}\\(`).test(body));
			if (reaches) {
				scans.add(name);
				changed = true;
			}
		}
	}
	return [...scans].sort();
}

/** The file set DESIGN §5.5 names, transcribed: "the turn (`authoring-turn.ts`, `workbench.ts`'s broker and
 *  conversation paths), the agent tools (`lib/server/agent/**`), the floor (`floor.ts`, `assurance/**`), the broker
 *  (`packages/rph-authoring`) and the handlers of the command types a turn records". The handler files are the three
 *  a turn's own recorded commands reach: PWU-Type authoring and the conversation append (`pwa-authoring.ts`), the
 *  floor's assessments and observations (`assurance.ts`), and the witness's exchange records (`model-exchange.ts`). */
const NAMED_FILE_SET = [
	'apps/rph-demo/src/lib/server/authoring-turn.ts',
	'apps/rph-demo/src/lib/server/workbench.ts',
	'apps/rph-demo/src/lib/server/floor.ts',
	'apps/rph-demo/src/lib/server/agent/**',
	'apps/rph-demo/src/lib/server/assurance/**',
	'packages/rph-authoring/src/**',
	'packages/rph-application/src/handlers/pwa-authoring.ts',
	'packages/rph-application/src/handlers/assurance.ts',
	'packages/rph-application/src/handlers/model-exchange.ts'
];

function filesIn(pattern: string): string[] {
	if (!pattern.endsWith('/**')) return [pattern];
	const directory = pattern.slice(0, -3);
	const walk = (relative: string): string[] =>
		readdirSync(`${ROOT}${relative}`).flatMap((entry) => {
			const next = `${relative}/${entry}`;
			if (statSync(`${ROOT}${next}`).isDirectory()) return walk(next);
			return next.endsWith('.ts') && !next.includes('.test.') && !next.endsWith('.testing.ts')
				? [next]
				: [];
		});
	return walk(directory);
}

/** Every (file, scan) pair in the named set, with how many times that file scans that way. */
function measuredScanSites(): Map<string, number> {
	const scans = scanQueryNames();
	const sites = new Map<string, number>();
	for (const file of NAMED_FILE_SET.flatMap(filesIn)) {
		const source = read(file);
		for (const scan of scans) {
			// A call, not an import or a re-export: the name followed by `(`.
			const calls = [...source.matchAll(new RegExp(`\\b${scan}\\(`, 'g'))].length;
			if (calls > 0) sites.set(`${file} :: ${scan}`, calls);
		}
	}
	return sites;
}

/**
 * ⭐ THE CENSUS. Every set read the named files make, its count, and the class that says why a change to it does or
 * does not refuse a draft. Sorted, so a diff reads as one line per change.
 */
const DECLARED_SCAN_SITES: Record<
	string,
	{
		readonly calls: number;
		readonly class: 'DECLARED' | 'DISPLAY' | 'ADVISORY' | 'REPLAY';
		readonly why: string;
	}
> = {
	'apps/rph-demo/src/lib/server/authoring-turn.ts :: listPwuTypes': {
		calls: 1,
		class: 'DECLARED',
		why: 'G2. `hashAuthoringSubject` folds the PWA and its live types into the hash the reviewer judges and the human accepts — the candidate IS this set, so a type born, edited or removed for the PWA refuses the draft, naming it.'
	},
	'apps/rph-demo/src/lib/server/workbench.ts :: getConversation': {
		calls: 2,
		class: 'DECLARED',
		why: 'G1, twice. `recordConversation` reads the conversation of the PWA to append to it (or mints the first one — the ABSENCE read the phantom rode in on); `loadConversation` reads it for the page. Both are the same keyed set, and G1 covers a first conversation another writer creates.'
	},
	'apps/rph-demo/src/lib/server/workbench.ts :: listPwuTypes': {
		calls: 1,
		class: 'DECLARED',
		why: 'G2. `buildPwaExport` is the graph the floor hands the reviewer; on a turn it is built from the FORK, so the set is the types of the draft itself.'
	},
	'apps/rph-demo/src/lib/server/floor.ts :: listAssessments': {
		calls: 2,
		class: 'DECLARED',
		why: 'G3. ⭐ The review in parts (`REG-D-125`): `latestFloorRound` ranks the review records of the PWA and of each of its types into the latest round — the set a canonical reader ranks in an order-sensitive way and the commit of this draft writes into (DESIGN §3.2 job (b)); G3 covers the PWA’s records and its per-type groups each type’s. The second call, `latestFloorAssessments`, is the execution plane’s reader of a work product’s floor (`loadSubjectFloor`), which no draft reads.'
	},
	'apps/rph-demo/src/lib/server/floor.ts :: listPwuTypes': {
		calls: 1,
		class: 'DECLARED',
		why: 'G2. ⭐ The review in parts (`REG-D-125`): `storedTypes` reads the PWA’s live types — on a turn, the draft’s own, on its fork — for each part’s stored name and semantic version, and for the round reader’s expected inventory.'
	},
	'apps/rph-demo/src/lib/server/floor.ts :: listObservations': {
		calls: 1,
		class: 'DISPLAY',
		why: 'The findings shown under each policy in the floor VIEW (`loadPwaFloor`). A change makes the screen stale; it cannot make the candidate wrong — the floor verdict the commit carries was computed on the fork and is never re-judged at replay.'
	},
	'apps/rph-demo/src/lib/server/floor.ts :: listDecisions': {
		calls: 1,
		class: 'DISPLAY',
		why: 'Waiver decisions (`hasEffectiveWaiver`) — display-only on the turn path, as `REG-F-066` records. A waiver never discharges the floor (ASR-3), so it cannot change what the draft commits.'
	},
	'apps/rph-demo/src/lib/server/assurance/declared-policy-signoff.ts :: listAssessments': {
		calls: 1,
		class: 'ADVISORY',
		why: "No draft reads it. `latestDeclaredVerdicts` ranks a work unit's declared assessments, per policy, for the re-run of its declared reviews that did not conclude (`REG-D-112` (a)) — the Undertaking page's offer, and the server's re-check when the person presses it — on the canonical store, never in an authoring turn. It is in this file set only because `assurance/**` is, and being out of date changes nothing a draft commits."
	},
	'apps/rph-demo/src/lib/server/assurance/reviewer-answer.ts :: listByType': {
		calls: 1,
		class: 'DISPLAY',
		why: 'The answer of the reviewer, read back and re-hashed for the page (MXREAD-03). While G4 stands the same exchanges are also a declared group; either way nothing here shapes the candidate.'
	},
	'packages/rph-authoring/src/broker.ts :: listPwuTypes': {
		calls: 1,
		class: 'DECLARED',
		why: 'G2. `listTypes` is the graph the assistant authors against and `lintComposition` advises on — the type set of the draft, on its fork.'
	},
	'packages/rph-authoring/src/broker.ts :: listAssurancePolicies': {
		calls: 1,
		class: 'REPLAY',
		why: 'The policy library. Its ids are read for the ACTIVE-only listing the assistant sees (`DD-5`) and for the friendly pre-check of the broker, whose authoritative twin is the domain write boundary the REPLAY re-runs — and every policy that re-run validates is PINNED by §5.1 pin 3, command by command. The library as a SET is not a dependency: a policy nobody references may come and go.'
	}
};

describe('the scan-site census (DD-6) — every set a draft reads is classified', () => {
	it('the scan surface is derived from the query module, and includes the enumerating helpers', () => {
		const scans = scanQueryNames();
		expect(scans, 'listByType is the root of every scan').toContain('listByType');
		for (const name of [
			'listPwuTypes',
			'listAssurancePolicies',
			'listConversations',
			'getConversation'
		])
			expect(scans, `${name} enumerates a type`).toContain(name);
		for (const name of ['getObject', 'getObjectRevision', 'getObjectOfType'])
			expect(scans, `${name} loads ONE aggregate by id — the other gate's subject`).not.toContain(
				name
			);
	});

	it('⛔⛔ every scan site in the named file set is classified, and no classified site has gone', () => {
		const measured = measuredScanSites();
		const declaredKeys = Object.keys(DECLARED_SCAN_SITES).sort();
		const measuredKeys = [...measured.keys()].sort();
		expect(
			measuredKeys.filter((key) => !(key in DECLARED_SCAN_SITES)),
			'UNCLASSIFIED SET READS. Somebody taught a draft to read a new set. Classify each below — DECLARED (name ' +
				'the group that covers it, or add one to REG-D-070 §5.1 first), DISPLAY, ADVISORY or REPLAY.'
		).toEqual([]);
		expect(
			declaredKeys.filter((key) => !measured.has(key)),
			'CLASSIFIED SITES THAT ARE GONE — remove their rows, so the census keeps describing this tree.'
		).toEqual([]);
		for (const [key, count] of measured)
			expect(DECLARED_SCAN_SITES[key]!.calls, `${key}: the number of calls moved`).toBe(count);
	});
});
