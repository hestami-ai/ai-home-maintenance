// ⭐ `JAN-EXEC` Phase 7 — THE RUN'S PRODUCT BRIEF AND ITS PWA'S CONTENT, DECLARED ONCE, IN ONE PURE MODULE
// (`docs/_working/DESIGN-the-live-end-to-end-run.md` §3.1, §3.2; `REG-D-101`, `REG-D-102`).
//
// What the run types into the designer, and what its own checks test it against:
//   · THE BRIEF (§3.1), VERBATIM — `product-brief.md`'s bytes, the text the acceptance suite was written from (P7-4a);
//   · the four markers a work unit fills, and the 4,000 characters of an instruction the reviewer is shown (§3.2);
//   · §3.2's five PWU Types — kinds, discharges, purposes and declared policies — each model type with its prompt and
//     its output contract, and the instruction each renders to.
// ⭐ WHO READS IT: the operator's hands in the gate (`apps/rph-demo/e2e/support/phase7-pwa.ts`, for P7-1b's rehearsal,
// `e2e/phase7-five-unit.e2e.ts`); the negative control (`negative-control.ts`, P7-4e), which hands the reviewer the
// end-to-end phase's instruction exactly as the run renders it; and the run's own lane (P7-2, not yet written). A
// rehearsal of a lookalike rehearses nothing about this one. ⚠ The prompts' wording is a delegated call (`REG-D-101`:
// *"prompts written as a competent author would write them"*), drafted for P7-1b.
//
// ⛔ WHY ONE MODULE — round 1's BLOCKER, 2026-10-09. The PWA's prompts carried a brief of their own (`phase7-pwa.ts`'s
// `BRIEF`), while the acceptance suite and the negative control carried `product-brief.md`: the run would have told each
// phase one product and tested it against another. `verif/phase7-pwa-content.test.ts` holds the brief here to that file,
// byte for byte, and each phase's instruction to the engine's own rendering of it.
//
// ⭑ WHY HERE, IN `scripts/phase7/`, AND WHY IT IMPORTS NOTHING. It sits beside the brief it must equal and the P7-4 tools
// that read the brief, and BOTH programs that load it check it: `scripts/tsconfig.json` (NodeNext) holds it as one of its
// own files, and `apps/rph-demo/e2e/tsconfig.json` (bundler) checks it as a dependency of `e2e/support/phase7-pwa.ts` —
// as it checks `verif/live-backend-isolation.ts` for `playwright.config.ts`, the precedent for a Playwright file that
// imports from outside the app. With no import there is nothing the two resolutions could read differently, nothing
// for Playwright's runner to load beside a spec, and no file read when it loads: the brief is a literal, so this module
// is the same value under Playwright, bun and vitest. ⚠ An e2e file names it without an extension, as the e2e files name
// each other; a file under `scripts/` or `verif/` names it `pwa-content.js`, as NodeNext requires.
//
// ⛔ WHAT THE PROMPTS MAY SAY (§3.2, §3.3). What a competent author of this PWA would say — the product, where files go,
// the toolchain this host offers, and the shape of the answer — and nothing whose only purpose is to dodge a known defect.
// They use only markers a work unit FILLS: `{subject}`, `{title}`, `{description}` and `{purpose}`
// (`packages/rph-application/src/execution-invocation.ts`, `assembleStepContext`). `{statement}` is in that map and never
// filled, and any other marker refuses the step at render, after its step has started (`REG-F-507`, `REG-F-508`). So no
// prompt here holds a brace except around those four, and every type carries a non-empty purpose for `{purpose}`.
// ⚠ AND THE PROMPTS NAME THE PRODUCT, because an Undertaking cannot tell its units what to build (`REG-F-510`): the
// design records that departure (§3.3) and a "Yes" states it.

/**
 * ⭐ THE PRODUCT BRIEF (§3.1), VERBATIM: `product-brief.md`, one element to a line, each line ended LF as the file ends it.
 * ⚠ A LITERAL, NOT A READ OF THE FILE, so this module stays pure (the header says why); `verif/phase7-pwa-content.test.ts`
 * holds the two equal byte for byte, and to the SHA-256 the acceptance suite pins (`ef1b696c…`). ⛔ An edit to the brief
 * is an edit to what the acceptance suite must test (`verif/phase7-acceptance.test.ts`): both change, or neither.
 */
export const PRODUCT_BRIEF: string = [
	'wordfreq is a command-line tool for Node.js 20 or later, with no dependencies. Usage: node bin/wordfreq.js [options] [file]',
	'- It reads UTF-8 text from file, or from standard input when no file is given or the file is "-".',
	'- A word is a maximal run of letters, digits or apostrophes (Unicode letters included). Words are folded to lower case unless --case-sensitive is given.',
	'- It prints the N most frequent words, one per line, as "<count> <word>", most frequent first; ties are broken by the word, ascending.',
	'- Options: -n N or --top N, a positive integer, default 10; --case-sensitive; --stop-words FILE, a file of one word per line whose words are excluded (compared after case folding unless --case-sensitive); -h or --help prints usage to standard output and exits 0.',
	'- Exit codes: 0 success; 1 the input file is missing or unreadable; 2 a usage error (an unknown option, or a bad N).',
	'- Errors go to standard error, as one line beginning "wordfreq: ".',
	'- Files: bin/wordfreq.js (the entry), src/*.js (ES modules; package.json has "type": "module"), test/unit/*.test.js and test/e2e/*.test.js run with node --test, and docs/requirements.md, docs/design.md and docs/verification.md.',
	''
].join('\n');

/**
 * The markers a work unit FILLS when its prompt renders — and so the only ones §3.2 lets a prompt use. ⚠ READ FROM
 * `assembleStepContext`'s map minus `statement`, which that map declares and never fills (`REG-F-507`).
 */
export const PHASE7_MARKERS: readonly string[] = ['subject', 'title', 'description', 'purpose'];

/**
 * What the reviewer is shown of an instruction (§3.2: *"The rendered instruction stays under 4,000 characters"*) — the
 * reasoning review's own `REASONING_REVIEW_BUDGET.USER_INTENT_MAX`, which `verif/phase7-pwa-content.test.ts` holds it to.
 */
export const PHASE7_INSTRUCTION_BUDGET = 4_000;

/** One PWU Type of §3.2, as the designer's form takes it. */
export interface Phase7TypeDeclaration {
	readonly name: string;
	readonly pwuKind: string;
	/** Never empty: it is what `{purpose}` renders, and instantiation copies it into each unit's description. */
	readonly purpose: string;
	readonly workDischarge: 'HUMAN' | 'MODEL';
	/** A MODEL type's prompt template, typed and ARMED ("Ready to use"). A HUMAN type has none. */
	readonly prompt?: string;
	/**
	 * A MODEL type's output contract — the designer's "Expected answer shape" (`promptOutputContract`), one line, which
	 * the engine APPENDS to the rendered prompt (`execution-invocation.ts`, `withOutputContract`). A HUMAN type has none.
	 */
	readonly outputContract?: string;
	readonly isRoot?: true;
	/**
	 * The child types, by name, each permitted M1: instantiation builds one unit per MANDATORY child, and offers a
	 * conditional one to no one (`REG-F-516`), so a C1 or C+ phase would never become a unit.
	 */
	readonly children?: readonly string[];
	/** The declared assurance policies, by id: each kind's ontology defaults, or the root's departures (§3.3). */
	readonly policyIds: readonly string[];
}

/** A PWA to type: its draft's name and domain, and its types in the order the form needs them, children first. */
export interface Phase7PwaDeclaration {
	readonly name: string;
	readonly domain: string;
	readonly types: readonly Phase7TypeDeclaration[];
}

// ── THE PROMPTS (§3.2: "Each prompt carries the same short product brief and the file conventions") ──────────────────
// ⚠ NO BRACES BUT THE MARKERS', AND NO CODE SNIPPET: a brace pair around any other word is a marker nothing supplies.
// ⭐ THE BRIEF IS `PRODUCT_BRIEF` ITSELF, never a restatement of it: a second wording of the product is how round 1's
// prompts came to describe another one.

/** Where files go, and the toolchain this host offers (§3.1: *"Why no dependencies"*; `REG-F-534`). */
const CONVENTIONS = [
	"Work in the current directory: it is the product's workspace, and the other phases of its realization read and write it too.",
	'Documents go in docs/, source in src/, unit tests in test/unit/ and end-to-end tests in test/e2e/.',
	'The toolchain on this host is Node.js alone: use node, and node --test for tests. npm, npx and pnpm are not available, and the product installs no packages.'
].join(' ');

/**
 * The shape of the answer (§3.2: *"The work product carries the deliverable"*), as every model type's OUTPUT CONTRACT:
 * the designer's field for it, which the engine appends after the work under *"The output this work requires:"*
 * (`withOutputContract`), so a model is told the work before the shape it returns it in. ⭑ The deliverable goes IN the
 * work product, or the only model review of a phase judges a list of file names (`REG-F-522`); the hashes let the run's
 * own checks tie the archived files to what was reviewed (P7-4). ⚠ ONE LINE: the designer's field is a single-line input.
 */
const OUTPUT_CONTRACT = [
	'Your workProduct is a JSON object with four fields:',
	'documents, each document you wrote, with its path and its full text;',
	'files, each source or test file you wrote, with its path and its full text, as far as they fit within 24,000 characters;',
	'hashes, each file you wrote, with its path and its SHA-256;',
	'and commands, each command you ran, with its exit code.'
].join(' ');

/**
 * A phase's prompt: who it is, the brief, what this phase does, and the conventions. ⚠ The brief's lines are spread in
 * whole, so the prompt carries `PRODUCT_BRIEF` verbatim — its last line's LF included, before the blank line.
 */
const phasePrompt = (ask: string): string =>
	[
		'Work unit: {subject}. Its purpose: {purpose}',
		'',
		...PRODUCT_BRIEF.split('\n').slice(0, -1),
		'',
		ask,
		'',
		CONVENTIONS
	].join('\n');

// ── THE FIVE TYPES OF §3.2 ──────────────────────────────────────────────────────────────────────────────────────────
// ⭑ Every non-root type declares EXACTLY its kind's ontology default policies
// (`packages/rph-product-realization-pwa/vocab/m8-ontology.json`, `defaultPolicyIds`). The root departs as §3.3 records:
// it drops `pol_intent_fidelity` (seven required-evidence items, three mandatory, none produced: `REG-F-403`,
// `REG-F-308`) and `pol_baseline_promotion` (it governs `PRODUCT_BASELINE_PROMOTION` alone).
// ⚠ The asks name files as the brief lays them out: the entry `bin/wordfreq.js`, which the acceptance suite, the seeded
// faults and the spawn check all run (`entry.ts`), and the modules in `src/`.

export const PHASE7_REQUIREMENTS: Phase7TypeDeclaration = {
	name: 'Requirements',
	pwuKind: 'REQUIREMENT_DEFINITION',
	purpose:
		'Define what wordfreq must do as numbered, testable requirements with acceptance criteria.',
	workDischarge: 'MODEL',
	prompt: phasePrompt(
		'Write docs/requirements.md: numbered requirements, each with its acceptance criteria; the usage line; each exit code and what it means; and the end-to-end scenarios that will show the tool working.'
	),
	outputContract: OUTPUT_CONTRACT,
	policyIds: ['pol_requirement_coverage', 'pol_intent_preservation']
};

export const PHASE7_DESIGN: Phase7TypeDeclaration = {
	name: 'Design',
	pwuKind: 'ARCHITECTURE_DEFINITION',
	purpose:
		'Design wordfreq so that every requirement has a module that meets it and a test that will verify it.',
	workDischarge: 'MODEL',
	prompt: phasePrompt(
		"Read docs/requirements.md, which the requirements phase wrote. Write docs/design.md: the modules, each exported function's signature, how each error is reported and which exit code it produces, and a map from each requirement to the test that will verify it."
	),
	outputContract: OUTPUT_CONTRACT,
	policyIds: [
		'pol_assumption_disclosure',
		'pol_decomposition_coverage',
		'pol_architecture_coverage',
		'pol_intent_preservation'
	]
};

export const PHASE7_IMPLEMENTATION: Phase7TypeDeclaration = {
	name: 'Implementation and unit tests',
	pwuKind: 'PRODUCT_IMPLEMENTATION',
	purpose: 'Implement wordfreq and its unit tests, and show the unit tests passing.',
	workDischarge: 'MODEL',
	prompt: phasePrompt(
		'Read docs/requirements.md and docs/design.md. Implement the tool as the brief lays out its files: the entry bin/wordfreq.js, its modules in src/, and package.json. Write its unit tests in test/unit/ with node:test and node:assert. Run the unit tests with node --test.'
	),
	outputContract: OUTPUT_CONTRACT,
	policyIds: ['pol_assumption_disclosure', 'pol_test_adequacy', 'pol_intent_preservation']
};

export const PHASE7_E2E: Phase7TypeDeclaration = {
	name: 'End-to-end verification',
	pwuKind: 'INTEGRATED_PRODUCT_VALIDATION',
	purpose:
		'Verify the real wordfreq tool end to end against every requirement, and record each result.',
	workDischarge: 'MODEL',
	prompt: phasePrompt(
		"Read docs/requirements.md, docs/design.md and the source in src/. Write end-to-end tests in test/e2e/ that start the real tool, bin/wordfreq.js, as a child process with process.execPath and check its output and exit code for each end-to-end scenario. Run the whole suite with node --test, then write docs/verification.md mapping each requirement to its test and that test's result."
	),
	outputContract: OUTPUT_CONTRACT,
	policyIds: ['pol_fitness_for_purpose', 'pol_test_adequacy', 'pol_intent_preservation']
};

/** The four phases, in the order the run starts them: each only after the one before has returned (`REG-F-535`). */
export const PHASE7_PHASES: readonly Phase7TypeDeclaration[] = [
	PHASE7_REQUIREMENTS,
	PHASE7_DESIGN,
	PHASE7_IMPLEMENTATION,
	PHASE7_E2E
];

/**
 * The root. ⚠ HUMAN, WITH NO PROMPT: the operator runs its Begin & Execute — a TRANSFORMATION, no model, no output —
 * and signs it off last (§3.2, *"The root's own run"*).
 */
export const PHASE7_ROOT: Phase7TypeDeclaration = {
	name: 'CLI Product Realization',
	pwuKind: 'PRODUCT_REALIZATION',
	purpose:
		'Realize wordfreq, a small Node.js command-line tool, from its requirements through end-to-end verification.',
	workDischarge: 'HUMAN',
	isRoot: true,
	children: PHASE7_PHASES.map((t) => t.name),
	policyIds: ['pol_intent_preservation', 'pol_fitness_for_purpose']
};

/** §3.2's PWA, *CLI Product Realization*: the four phases first, because the root's form offers only types that exist. */
export const PHASE7_PWA: Phase7PwaDeclaration = {
	name: 'CLI Product Realization',
	domain: 'software product',
	types: [...PHASE7_PHASES, PHASE7_ROOT]
};

/**
 * ⭐ THE INSTRUCTION A TYPE'S UNIT IS GIVEN — what the executing model receives and what the reviewer is shown as its
 * intent, the run's command reviews included (`producingPrompt: outcome.prompt`, `undertakings/[id]/+page.server.ts`).
 * Each marker is filled with the value `assembleStepContext` supplies: `{subject}` and `{title}` are the unit's title,
 * which instantiation copies from the type's name, and `{description}` and `{purpose}` are the type's purpose. Then the
 * output contract is appended as `withOutputContract` appends it. ⚠ A RESTATEMENT OF THE ENGINE'S RENDERING, PURE so
 * Playwright and the negative control can load it; `verif/phase7-pwa-content.test.ts` holds it, type by type, to
 * `prepareModelInvocation`'s own `prompt` for the type as the designer stores it and the unit as instantiation builds it,
 * both built there by hand. ⭐ The gate's rehearsal holds it to what the ROUTE sends: each phase's try records these
 * bytes as its input (`apps/rph-demo/e2e/phase7-five-unit.e2e.ts`, section 6; round 1's verifier, 2026-10-09).
 */
export function renderedPrompt(t: Phase7TypeDeclaration): string {
	const values: Readonly<Record<string, string>> = {
		subject: t.name,
		title: t.name,
		description: t.purpose,
		purpose: t.purpose
	};
	const rendered = (t.prompt ?? '').replace(
		/\{([A-Za-z]\w*)\}/g,
		(marker, name: string) => values[name] ?? marker
	);
	const contract = t.outputContract?.trim();
	return contract ? `${rendered}\n\nThe output this work requires:\n${contract}` : rendered;
}

/** Every `{marker}` a prompt holds, by the designer's own reading of the text (`routes/pwa/[id]/+page.svelte`). */
export function promptMarkers(prompt: string): string[] {
	return [...new Set([...prompt.matchAll(/\{([A-Za-z]\w*)\}/g)].map((m) => m[1]!))];
}
