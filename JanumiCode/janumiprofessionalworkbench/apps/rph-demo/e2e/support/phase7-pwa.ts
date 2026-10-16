// ⭐ `JAN-EXEC` Phase 7 — THE OPERATOR'S HANDS THAT TYPE THE RUN'S PWA INTO THE DESIGNER AND RUN ITS UNDERTAKING
// (`docs/_working/DESIGN-the-live-end-to-end-run.md` §3.2; `REG-D-101`, `REG-D-102`).
//
// The design's half A types a person-authored PWA into the designer, as the operator, then creates an Undertaking of it
// and runs each unit. This module holds the helpers that drive the designer's own forms and the Undertaking page — and
// only those. ⭐ THE PWA ITSELF — the brief, §3.2's five types, their prompts and their output contracts — is DATA in
// `scripts/phase7/pwa-content.ts`, which the gate's rehearsal (`phase7-five-unit.e2e.ts`, P7-1b), the negative control
// (P7-4e) and the run's own lane (P7-2, not yet written) all import. ⛔ IT LIVED HERE UNTIL 2026-10-09, with a brief of
// its own that was not `product-brief.md`, the brief the acceptance suite and the negative control test (round 1's
// BLOCKER): the shared module's header says why it moved, and why there.
//
// ⚠ NOTHING HERE TAKES PLAYWRIGHT'S `test` — `verif/e2e-harness-import-census.test.ts` reddens on any file under `e2e/`
// that does — and nothing here registers a stipulation: the spec that runs a PWA decides whether its reviews are
// stipulated, in its own body (`JAN-CRITREAD` J1-3).
import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import type {
	Phase7PwaDeclaration,
	Phase7TypeDeclaration
} from '../../../../scripts/phase7/pwa-content';
import { declareRisk, gotoHydrated, introspect } from './harness';

/** A literal, safe inside a RegExp. */
export function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── THE DESIGNER, DRIVEN AS THE OPERATOR ────────────────────────────────────────────────────────────────────────────

/**
 * Create a DRAFT PWA through the home page's form, open it in the designer, and return its id READ FROM THE STORE —
 * never computed, because test-mode ids restart at every reset.
 */
export async function createDraftPwa(
	page: Page,
	request: APIRequestContext,
	pwa: Pick<Phase7PwaDeclaration, 'name' | 'domain'>
): Promise<string> {
	await gotoHydrated(page, '/');
	await page.getByRole('button', { name: '+ New PWA' }).click();
	await page.getByPlaceholder(/PWA name/i).fill(pwa.name);
	await page.getByPlaceholder(/Domain/i).fill(pwa.domain);
	await page.getByRole('button', { name: 'Create draft' }).click();
	const card = page.getByRole('link', { name: new RegExp(escapeRegExp(pwa.name)) });
	await expect(card).toBeVisible();
	const pwaId = (await introspect(request)).pwas.find((p) => p.state.name === pwa.name)?.id;
	expect(pwaId, `the draft PWA "${pwa.name}" is not in the store`).toBeTruthy();
	await gotoHydrated(page, (await card.getAttribute('href'))!);
	return pwaId!;
}

/**
 * Type each declared PWU Type through the designer's "+ Define PWU Type" form, in order.
 *
 * ⭐ THE POLICIES' NAMES ARE READ FROM THE STORE, AS THE FORM LABELS THEM — each declared id is checked by the name its
 * library row carries, so a policy renamed in the catalog reddens here, naming the id, rather than ticking nothing.
 */
export async function typePwuTypes(
	page: Page,
	request: APIRequestContext,
	types: readonly Phase7TypeDeclaration[]
): Promise<void> {
	const policyNames = new Map(
		(await introspect(request)).assurancePolicies.map((p) => [p.id, String(p.state.name)])
	);
	for (const type of types) await typePwuType(page, type, policyNames);
}

async function typePwuType(
	page: Page,
	t: Phase7TypeDeclaration,
	policyNames: ReadonlyMap<string, string>
): Promise<void> {
	// ⚠ The button is disabled while the previous type's save is in flight, and the click waits for it.
	await page.getByRole('button', { name: '+ Define PWU Type' }).click();
	await page.locator('#pwu-type-name').fill(t.name);
	await page.locator('#pwu-type-kind').fill(t.pwuKind);
	await page.locator('#pwu-type-purpose').fill(t.purpose);
	// JAN-DISCHARGE — the type SAYS who does its work; the prompt field shows only for MODEL.
	await page.getByTestId('pwu-type-discharge').selectOption(t.workDischarge);
	if (t.prompt !== undefined) {
		await page.getByTestId('pwu-type-prompt').fill(t.prompt);
		// The "Expected answer shape", which the engine appends to the rendered prompt (`withOutputContract`). ⚠ Saved
		// only beside a template: the form's reader keeps it inside `promptTemplate` (`routes/pwa/[id]/+page.server.ts`).
		if (t.outputContract !== undefined)
			await page.locator('#pwu-type-output-contract').fill(t.outputContract);
		// ⛔ WITHOUT THIS THE TEMPLATE IS A DRAFT AND THE STEP REFUSES: authoring is not arming.
		await page.getByRole('checkbox', { name: /Ready to use/i }).check();
	}
	if (t.isRoot) await page.getByLabel(/Root type/i).check();
	for (const child of t.children ?? []) {
		await page.getByRole('checkbox', { name: child, exact: true }).check();
		await page.getByRole('combobox', { name: `Cardinality for ${child}` }).selectOption('M1');
	}
	for (const policyId of t.policyIds) {
		const name = policyNames.get(policyId);
		expect(name, `the policy library holds no ${policyId} to declare on ${t.name}`).toBeTruthy();
		await page.getByRole('checkbox', { name: name!, exact: true }).check();
	}
	await page.getByRole('button', { name: 'Add type' }).click();
	await expect(
		page.locator('.svelte-flow__node .nametext').getByText(t.name, { exact: true })
	).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Add type' }),
		'the type form did not close'
	).toHaveCount(0);
}

/**
 * Submit for Review, Validate and Publish, through the designer's own buttons, then read PUBLISHED from the store.
 *
 * ⚠ A person-authored PWA publishes with no authoring floor (design §2, stage 1: `pwa-authoring.ts`, `pwaFloorGate`'s
 * *"A purely human-authored, never-assessed PWA passes"*). Half A leaves that unmeasured; it is P7-7's.
 */
export async function publishThroughDesigner(
	page: Page,
	request: APIRequestContext,
	pwaId: string
): Promise<void> {
	await page.getByRole('button', { name: /Submit for Review/i }).click();
	await page.getByRole('button', { name: /Validate/i }).click();
	await page.getByRole('button', { name: /^Publish$/ }).click();
	await expect(page.getByText('Published versions are immutable')).toBeVisible();
	const pwa = (await introspect(request)).pwas.find((p) => p.id === pwaId);
	expect(pwa?.state.publicationStatus, 'the PWA did not publish').toBe('PUBLISHED');
}

// ── THE UNDERTAKING PAGE ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Create an Undertaking of the one published PWA through the portfolio's form, open it, and show its overview — the
 * tab whose rows carry each unit's lifecycle actions.
 */
export async function createUndertakingThroughForm(
	page: Page,
	undertaking: { readonly name: string; readonly objective: string; readonly product: string }
): Promise<void> {
	await gotoHydrated(page, '/undertakings');
	await page.getByRole('button', { name: '+ New Undertaking' }).click();
	await page.getByPlaceholder(/Undertaking name/i).fill(undertaking.name);
	await page.getByPlaceholder(/Objective/i).fill(undertaking.objective);
	await page.getByPlaceholder(/Intended product/i).fill(undertaking.product);
	const pwaSelect = page.getByRole('combobox', { name: 'Instantiate from published PWA' });
	// After an `empty` reset this PWA is the only published one; its option follows the placeholder.
	await expect(pwaSelect.locator('option'), 'the PWA never published').toHaveCount(2);
	await pwaSelect.selectOption({ index: 1 });
	await declareRisk(page); // DR-002 W-4: the form refuses without a judgement
	await page.getByRole('button', { name: 'Create Undertaking' }).click();
	const link = page.getByRole('link', { name: new RegExp(escapeRegExp(undertaking.name)) });
	await expect(link).toBeVisible();
	await gotoHydrated(page, (await link.getAttribute('href'))!);
	await page.getByRole('button', { name: 'overview' }).click();
}

/**
 * The overview's row for the unit titled `title` — the row with a CELL of exactly that text. ⚠ Not a name prefix: the
 * type column links the same words with a trailing "↗", so only the title cell matches exactly.
 */
export function unitRow(page: Page, title: string): Locator {
	return page
		.getByRole('row')
		.filter({ has: page.getByRole('cell', { name: title, exact: true }) });
}

/**
 * ⭐ `JAN-EXEC` Phase 7 completion programme, `REG-D-112` (E3's review, finding 5) — the overview's row for the unit
 * `unitId`, BY THE ID THE ROW CARRIES (`data-pwu-id`). ⛔ A title may repeat: instantiation names each unit after its type,
 * so a type more than one parent permits gives its title to a unit under each, and `unitRow` would find both rows.
 */
export function unitRowById(page: Page, unitId: string): Locator {
	return page.locator(`tr[data-pwu-id=${JSON.stringify(unitId)}]`);
}

/** SvelteKit's answer to an enhanced form action: its own verdict, at HTTP 200 either way. */
export interface ActionEnvelope {
	readonly type: string;
	readonly status?: number;
	/** The action's returned object, `devalue`-stringified. */
	readonly data?: string;
}

/**
 * Press a form action's button and return the ACTION'S OWN VERDICT.
 *
 * ⛔ `res.ok()` IS NOT ACCEPTANCE (`REG-F-426`; the harness's `acceptAgentCandidate`): an enhanced form is answered with
 * a JSON envelope at HTTP 200 even when the action returned `fail(400)`, so the envelope's `type` is what a caller
 * asserts. ⚠ AND THE WAIT IS ON THE RESPONSE, NOT THE CLICK (`JAN-CRITREAD` J1-4): `.click()` resolves when the click
 * is dispatched, so a store read straight after it can run before the action has.
 */
export async function pressAction(
	page: Page,
	action: string,
	button: Locator
): Promise<ActionEnvelope> {
	const url = new URL(`?/${action}`, page.url()).href;
	const answered = page.waitForResponse((r) => r.url() === url && r.request().method() === 'POST');
	await button.click();
	return (await (await answered).json()) as ActionEnvelope;
}

/**
 * The action's returned fields — `{ error }` on a refusal, `{ advanced }` on success — decoded from the envelope's
 * `devalue` form, which for a flat object is `[{ key: index }, value, …]`. ⚠ Flat objects of plain values only, which is
 * every result the Undertaking page's actions return; anything else decodes to `{}` and the caller's assertion says so.
 */
export function actionFields(envelope: ActionEnvelope): Record<string, unknown> {
	if (typeof envelope.data !== 'string') return {};
	const flat = JSON.parse(envelope.data) as unknown[];
	const root = flat[0];
	if (typeof root !== 'object' || root === null || Array.isArray(root)) return {};
	return Object.fromEntries(
		Object.entries(root as Record<string, unknown>).map(([key, at]) => [
			key,
			typeof at === 'number' ? flat[at] : undefined
		])
	);
}
