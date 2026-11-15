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
// ⚠ AND THE PROMPTS NAME THE PRODUCT, ~~because an Undertaking cannot tell its units what to build (`REG-F-510`): the
// design records that departure (§3.3) and a "Yes" states it.~~ ⭐⭐ as §3.3 records; and since package L7 (design D61;
// `REG-D-151` (1)) every unit's instruction states its Undertaking's intended product and objective too (`renderedPrompt`).

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

/** ⭐⭐ Package L7 — D61 — an Undertaking as the form takes it (`e2e/support/phase7-pwa.ts`): its objective and intended product. */
export interface Phase7Undertaking {
	readonly objective: string;
	readonly product: string;
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L7 — design D61 (`REG-D-151` (1)) — THE UNDERTAKING'S SECTION, RESTATED AS A LITERAL: the engine's
 * (`packages/rph-application/src/execution-invocation.ts`, `undertakingSection`) — its heading line, `Intended product: ` and the
 * product, `Objective:` and the objective on the lines after it, each value trimmed, an empty value's line left out, and none at
 * all when both are empty. ⚠ RESTATED, never imported: this module loads no module (its limb in
 * `verif/phase7-pwa-content.test.ts`), which holds the two equal for the lane's Undertaking and for each empty shape.
 */
function undertakingSectionOf(u: Phase7Undertaking | undefined): string | undefined {
	const product = u?.product.trim() ?? '';
	const objective = u?.objective.trim() ?? '';
	if (product === '' && objective === '') return undefined;
	return [
		'This work is part of an Undertaking. Its intended product and its objective, as stated when it was created:',
		...(product === '' ? [] : [`Intended product: ${product}`]),
		...(objective === '' ? [] : ['Objective:', objective])
	].join('\n');
}

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
 * ⭐⭐ `JAN-EXEC` Phase 7, package L7 — design D61 (`REG-D-151` (1)): and between the work and the contract, the section that
 * states the Undertaking the unit belongs to (`undertakingSectionOf`), as the form's action stores it; `undefined`, none.
 */
export function renderedPrompt(t: Phase7TypeDeclaration, undertaking: Phase7Undertaking | undefined): string {
	const values: Readonly<Record<string, string>> = {
		subject: t.name,
		title: t.name,
		description: t.purpose,
		purpose: t.purpose
	};
	const work = (t.prompt ?? '').replace(
		/\{([A-Za-z]\w*)\}/g,
		(marker, name: string) => values[name] ?? marker
	);
	// ⭐⭐ Package L7 — D61 — then the Undertaking's section, after the work and before the contract.
	const section = undertakingSectionOf(undertaking);
	const rendered = section === undefined ? work : `${work}\n\n${section}`;
	const contract = t.outputContract?.trim();
	const toTheContract = contract ? `${rendered}\n\nThe output this work requires:\n${contract}` : rendered;
	// ⭐⭐ `JAN-EXEC` Phase 7, package L16 — D70 (`REG-D-163` (1)) — then, after the contract, the criteria its declared reviews will judge it
	// by (`reviewCriteriaSectionOf`); §3.2's units depend on no accepted work, so no D69 section follows it.
	const criteria = reviewCriteriaSectionOf(t);
	return criteria === undefined ? toTheContract : `${toTheContract}\n\n${criteria}`;
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L16 — design D70 (`REG-D-163` (1)) — THE PART OF A TYPE'S INSTRUCTION THE 4,000 CHARACTERS A REVIEWER IS SHOWN
 * MUST HOLD: the work, the Undertaking's section and the output contract — `renderedPrompt` up to D70's section. D70 seats its section after
 * the contract for this reason (`PROMPT-LENGTH`; `USER_INTENT_MAX`): that part is shown as before, and the section after it as far as it fits.
 */
export function renderedPromptToTheContract(t: Phase7TypeDeclaration, undertaking: Phase7Undertaking | undefined): string {
	const full = renderedPrompt(t, undertaking);
	const criteria = reviewCriteriaSectionOf(t);
	return criteria === undefined ? full : full.slice(0, full.length - criteria.length - 2);
}

/** ⭐⭐ Package L16 — D70 — one declared policy §3.2's types name, as the catalog seeds it: its name, and its criteria in its order. */
export interface Phase7PolicyCriteria {
	readonly name: string;
	readonly criteria: readonly { readonly id: string; readonly name: string; readonly description: string }[];
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L16 — design D70 (`REG-D-163` (1)) — EACH DECLARED POLICY §3.2's TYPES NAME, AS THE CATALOG SEEDS IT: its name
 * and its criteria, each its id, its name and its description, in the policy's order — RESTATED AS LITERALS, never imported (this module loads
 * no module); `verif/phase7-pwa-content.test.ts` holds them equal to the catalog's (`packages/rph-product-realization-pwa`), criterion by
 * criterion, and in the catalog's order (`seedPolicies`), which is the order the designer lists a type's policies in, and so stores them.
 */
export const PHASE7_POLICY_CRITERIA: Readonly<Record<string, Phase7PolicyCriteria>> = {
	pol_assumption_disclosure: {
		name: 'Assumption Disclosure',
		criteria: [
			{
				id: 'AD-01',
				name: 'AD-01',
				description: 'Material assumptions have been surfaced.'
			},
			{
				id: 'AD-02',
				name: 'AD-02',
				description: 'Assumptions are distinguished from facts.'
			},
			{
				id: 'AD-03',
				name: 'AD-03',
				description: 'Affected objects are identified.'
			},
			{
				id: 'AD-04',
				name: 'AD-04',
				description: 'Materiality is classified.'
			},
			{
				id: 'AD-05',
				name: 'AD-05',
				description: 'Verification or acceptance needs are identified.'
			},
			{
				id: 'AD-06',
				name: 'AD-06',
				description: 'Critical assumptions do not silently authorize irreversible work.'
			}
		]
	},
	pol_requirement_coverage: {
		name: 'Requirement Coverage',
		criteria: [
			{
				id: 'RC-01',
				name: 'RC-01',
				description: 'Each mandatory outcome is represented.'
			},
			{
				id: 'RC-02',
				name: 'RC-02',
				description: 'Each critical journey has applicable requirements.'
			},
			{
				id: 'RC-03',
				name: 'RC-03',
				description: 'Each mandatory constraint creates enforceable obligations.'
			},
			{
				id: 'RC-04',
				name: 'RC-04',
				description: 'Important failure paths are addressed.'
			},
			{
				id: 'RC-05',
				name: 'RC-05',
				description: 'Requirements without an authoritative source are identified.'
			},
			{
				id: 'RC-06',
				name: 'RC-06',
				description: 'Explicit exclusions are recorded.'
			}
		]
	},
	pol_decomposition_coverage: {
		name: 'Decomposition Coverage',
		criteria: [
			{
				id: 'DC-01',
				name: 'Obligation coverage',
				description: 'No mandatory obligation silently disappears.'
			},
			{
				id: 'DC-02',
				name: 'Constraint preservation',
				description: 'Applicable constraints are propagated or retained.'
			},
			{
				id: 'DC-03',
				name: 'Cohesion',
				description: 'Each child represents coherent work.'
			},
			{
				id: 'DC-04',
				name: 'Boundary clarity',
				description: 'Child responsibilities are distinguishable.'
			},
			{
				id: 'DC-05',
				name: 'Dependency completeness',
				description: 'Material sibling dependencies are explicit.'
			},
			{
				id: 'DC-06',
				name: 'Recomposition feasibility',
				description: 'A credible parent-level integration strategy exists.'
			},
			{
				id: 'DC-07',
				name: 'Intent continuity',
				description: 'Child objectives remain subordinate to parent intent.'
			}
		]
	},
	pol_architecture_coverage: {
		name: 'Architecture Coverage',
		criteria: [
			{
				id: 'AC-01',
				name: 'AC-01',
				description: 'Applicable requirements are allocated.'
			},
			{
				id: 'AC-02',
				name: 'AC-02',
				description: 'System boundaries are explicit.'
			},
			{
				id: 'AC-03',
				name: 'AC-03',
				description: 'Major components have coherent responsibilities.'
			},
			{
				id: 'AC-04',
				name: 'AC-04',
				description: 'Interfaces are sufficiently defined.'
			},
			{
				id: 'AC-05',
				name: 'AC-05',
				description: 'Data ownership is explicit.'
			},
			{
				id: 'AC-06',
				name: 'AC-06',
				description: 'Security boundaries are represented.'
			},
			{
				id: 'AC-07',
				name: 'AC-07',
				description: 'Operational and deployment concerns are proportionate.'
			},
			{
				id: 'AC-08',
				name: 'AC-08',
				description: 'Mandatory constraints are preserved.'
			},
			{
				id: 'AC-09',
				name: 'AC-09',
				description: 'Known architecture risks and assumptions are explicit.'
			},
			{
				id: 'AC-10',
				name: 'AC-10',
				description: 'Architecture is feasible.'
			}
		]
	},
	pol_intent_preservation: {
		name: 'Intent Preservation',
		criteria: [
			{
				id: 'IP-01',
				name: 'IP-01',
				description: 'Desired outcomes remain represented.'
			},
			{
				id: 'IP-02',
				name: 'IP-02',
				description: 'Scope has not expanded or contracted without authority.'
			},
			{
				id: 'IP-03',
				name: 'IP-03',
				description: 'Mandatory constraints remain active.'
			},
			{
				id: 'IP-04',
				name: 'IP-04',
				description: 'Descendant work continues to serve the parent objective.'
			},
			{
				id: 'IP-05',
				name: 'IP-05',
				description: 'Implementation choices have not replaced product need.'
			},
			{
				id: 'IP-06',
				name: 'IP-06',
				description: 'Local success contributes to global success.'
			},
			{
				id: 'IP-07',
				name: 'IP-07',
				description: 'Authorized intent revisions are properly recorded.'
			}
		]
	},
	pol_test_adequacy: {
		name: 'Test Adequacy',
		criteria: [
			{
				id: 'TA-01',
				name: 'TA-01',
				description: 'Tests trace to requirements or risks.'
			},
			{
				id: 'TA-02',
				name: 'TA-02',
				description: 'Critical journeys are covered.'
			},
			{
				id: 'TA-03',
				name: 'TA-03',
				description: 'Failure and alternate paths are proportionately covered.'
			},
			{
				id: 'TA-04',
				name: 'TA-04',
				description: 'Integrations are tested at appropriate boundaries.'
			},
			{
				id: 'TA-05',
				name: 'TA-05',
				description: 'Regression scope is justified.'
			},
			{
				id: 'TA-06',
				name: 'TA-06',
				description: 'Test environments are sufficiently representative.'
			},
			{
				id: 'TA-07',
				name: 'TA-07',
				description: 'Results are current and reproducible where required.'
			},
			{
				id: 'TA-08',
				name: 'TA-08',
				description: 'Passing tests are not overclaimed.'
			}
		]
	},
	pol_fitness_for_purpose: {
		name: 'Fitness For Purpose',
		criteria: [
			{
				id: 'FP-01',
				name: 'FP-01',
				description: 'Intended actors can achieve critical outcomes.'
			},
			{
				id: 'FP-02',
				name: 'FP-02',
				description: 'Major journeys function coherently.'
			},
			{
				id: 'FP-03',
				name: 'FP-03',
				description: 'The product addresses the originating problem.'
			},
			{
				id: 'FP-04',
				name: 'FP-04',
				description: 'Technical correctness has not obscured product failure.'
			},
			{
				id: 'FP-05',
				name: 'FP-05',
				description: 'Known limitations are compatible with declared use.'
			},
			{
				id: 'FP-06',
				name: 'FP-06',
				description: 'Residual uncertainty is acceptable.'
			},
			{
				id: 'FP-07',
				name: 'FP-07',
				description: 'Critical operational conditions are represented.'
			}
		]
	}
};
/**
 * ⭐⭐ Package L16 — D70 — THE SECTION THAT TELLS A TYPE'S UNIT THE CRITERIA ITS DECLARED REVIEWS WILL JUDGE IT BY, RESTATED AS A LITERAL OF THE
 * ENGINE'S (`packages/rph-application/src/execution-invocation.ts`, `reviewCriteriaSection`): its heading line, then for each policy the type
 * declares, `<its name>:` and `- <id>: <description>` per criterion (its name where it has none). ⚠ The type's declared policies stand for the
 * unit's governing ones — every one §3.2 names is ACTIVE and governs its kind — ⚠ IN THE ORDER THE UNIT'S SELECTION HOLDS THEM, never the
 * order §3.2 names them in: the designer stores a type's policies in its list's order, the catalog's (`PHASE7_POLICY_CRITERIA`'s), and a unit's
 * selection keeps its type's order (`declaredAssurancePolicyIds`), so the implementation phase is told Assumption Disclosure, Intent
 * Preservation, Test Adequacy, and the end-to-end phase Intent Preservation, Test Adequacy, Fitness For Purpose. The gate's rehearsal holds
 * the route's sent bytes to this (`e2e/phase7-five-unit.e2e.ts`). None declared: no section.
 */
function reviewCriteriaSectionOf(t: Phase7TypeDeclaration): string | undefined {
	const declared = new Set(t.policyIds ?? []);
	const policies = Object.entries(PHASE7_POLICY_CRITERIA)
		.filter(([id]) => declared.has(id))
		.map(([, p]) => p);
	if (policies.length === 0) return undefined;
	return [
		'This work will be reviewed against the criteria below, under the policies named. Make the work meet each one.',
		...policies.flatMap((p) => [
			`${p.name}:`,
			...p.criteria.map((c) => `- ${c.id}: ${c.description.trim() === '' ? c.name : c.description.trim()}`)
		])
	].join('\n');
}

/** Every `{marker}` a prompt holds, by the designer's own reading of the text (`routes/pwa/[id]/+page.svelte`). */
export function promptMarkers(prompt: string): string[] {
	return [...new Set([...prompt.matchAll(/\{([A-Za-z]\w*)\}/g)].map((m) => m[1]!))];
}
