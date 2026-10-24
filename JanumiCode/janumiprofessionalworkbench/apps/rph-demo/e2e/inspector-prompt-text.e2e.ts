import { expect, type Locator, type Page } from '@playwright/test';
import { test, resetEngine, introspect, gotoHydrated, registerStipulation } from './support/harness';
import { shot } from './support/gallery';

// ⭐ `REG-F-503` REMEDY 2 (`REG-D-123` Q25; `docs/_working/DESIGN-phase-7-completion.md` §4c, F2) — THE PERSON ACCEPTING A
// CANDIDATE CAN READ WHAT IT WOULD TELL THE MODEL. While a candidate is staged its editable form is hidden
// (`editable = isDraft && !hasStagedCandidate && !running`), and the read-only inspector the panel falls to showed each
// prompt's status and version alone (EG-07a, `pwa-authoring.e2e.ts`): the exact hash a person accepts covers each
// prompt's text and output contract, and neither was on screen. Here the candidate is STAGED, READY_TO_COMMIT with its
// exact hash, and each type's prompt is read from the candidate's own stored object and compared with what the inspector
// shows: unchanged, as plain text whose line breaks and indentation are rendered.
//
// ⭑ CONTROLS: an ACTIVE prompt and a DRAFT one, each with an output contract; an ACTIVE prompt with no output contract,
// which the inspector says is absent; and a type with no prompt at all.

const ROOT_TEXT = [
	'Synthesize the delivered product from its parts.',
	'',
	'For each part:',
	'  - name what it produced',
	'  - cite the evidence that it ran',
	'',
	'Never report a <result> you did not see.'
].join('\n');
const ROOT_CONTRACT = ['A report in two sections:', '  ## Parts', '  ## Evidence'].join('\n');
const IMPLEMENTATION_TEXT = [
	'Implement the product from the supplied design.',
	'  Cover the success path',
	'  and every failure path.'
].join('\n');
const IMPLEMENTATION_CONTRACT = 'The changed files, one per line.';
const VALIDATION_TEXT = [
	'Run the verification suite and report what actually ran.',
	'',
	'  Do not invent test results.'
].join('\n');

interface StoredPrompt {
	readonly templateText: string;
	readonly templateVersion: number;
	readonly outputContract?: string;
	readonly status: 'ACTIVE' | 'DRAFT';
}

/** Select a node, and wait until the inspector shows that type. */
async function inspect(page: Page, name: string): Promise<void> {
	await page.locator('.svelte-flow__node').filter({ hasText: name }).click();
	await expect(page.getByTestId('inspector-panel').getByRole('heading', { name, exact: true })).toBeVisible();
}

test.describe('PWA Designer — the inspector shows a staged candidate’s prompts (REG-F-503 remedy 2)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('with an exact candidate staged and its form hidden, each prompt’s text and output contract are shown unchanged beside its status and version, and an absent one is said to be absent', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Inspector Prompt PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /Inspector Prompt PWA/ });
		await expect(card).toBeVisible();
		// The declared stand-in answers the review's remainder, so the candidate reaches READY_TO_COMMIT and offers its
		// exact hash for acceptance (`registerStipulation`'s rule: after the reset, the id read from the store).
		const pwaId = (await introspect(request)).pwas.find((p) => p.state.name === 'Inspector Prompt PWA')!.id;
		await registerStipulation(request, pwaId, 'PWA_TYPE');
		await gotoHydrated(page, (await card.getAttribute('href'))!);

		const plan = {
			plan: [
				{
					tool: 'scaffold_graph',
					args: {
						types: [
							{
								tempKey: 'root',
								name: 'Product Realization',
								pwuKind: 'PRODUCT_REALIZATION',
								isRoot: true,
								workDischarge: 'MODEL',
								promptTemplateText: ROOT_TEXT,
								promptOutputContract: ROOT_CONTRACT,
								promptActive: true,
								childTempKeys: ['implementation', 'validation', 'approval']
							},
							{
								tempKey: 'implementation',
								name: 'Product Implementation',
								pwuKind: 'PRODUCT_IMPLEMENTATION',
								workDischarge: 'MODEL',
								promptTemplateText: IMPLEMENTATION_TEXT,
								promptOutputContract: IMPLEMENTATION_CONTRACT,
								promptActive: false
							},
							{
								tempKey: 'validation',
								name: 'Integrated Product Validation',
								pwuKind: 'INTEGRATED_PRODUCT_VALIDATION',
								workDischarge: 'MODEL',
								promptTemplateText: VALIDATION_TEXT,
								promptActive: true
							},
							{ tempKey: 'approval', name: 'Release Approval', pwuKind: 'RELEASE_APPROVAL', workDischarge: 'HUMAN' }
						]
					}
				}
			]
		};
		await page.getByTestId('agent-input').fill(JSON.stringify(plan));
		await page.getByRole('button', { name: 'Send' }).click();

		// ⭑ THE ACCEPTANCE MOMENT: the candidate staged with its exact hash, the canonical draft unchanged, and no type form.
		const banner = page.getByTestId('authoring-candidate-banner');
		await expect(banner).toContainText('READY_TO_COMMIT', { timeout: 15_000 });
		await expect(page.getByRole('button', { name: 'Accept exact candidate' })).toBeVisible();
		await expect(page.locator('form.typeform')).toHaveCount(0);
		const snapshot = await introspect(request);
		expect(snapshot.pwuTypes, 'arrangement: the candidate is staged, not accepted').toEqual([]);
		const candidate = snapshot.authoringCandidates.find((c) => c.pwaId === pwaId);
		expect(candidate, 'arrangement: no candidate is staged for the PWA').toBeDefined();
		const stored = (name: string) =>
			candidate!.pwuTypes.find((t) => t.state.name === name)?.state.promptTemplate as StoredPrompt | undefined;
		// ⭑ What the inspector is held to is the candidate's STORED prompt, and that is the plan's, the tool trimming nothing
		// from these texts.
		expect(
			[stored('Product Realization'), stored('Product Implementation'), stored('Integrated Product Validation')].map((p) => [
				p?.status,
				p?.templateText,
				p?.outputContract
			]),
			'arrangement: the candidate does not store the prompts the plan authored'
		).toEqual([
			['ACTIVE', ROOT_TEXT, ROOT_CONTRACT],
			['DRAFT', IMPLEMENTATION_TEXT, IMPLEMENTATION_CONTRACT],
			['ACTIVE', VALIDATION_TEXT, undefined]
		]);
		expect(stored('Release Approval'), 'arrangement: the approval type stores a prompt').toBeUndefined();

		const prompt = page.getByTestId('inspector-prompt');
		const text = page.getByTestId('inspector-prompt-text');
		const contract = page.getByTestId('inspector-prompt-contract');
		const noContract = page.getByTestId('inspector-prompt-contract-none');
		// ⛔ `textContent` is the text as stored; `innerText` is the text as RENDERED, so a block that collapsed its line
		// breaks and indentation into single spaces would fail it while holding every character.
		const shown = async (block: Locator, value: string) => {
			await expect(block).toBeVisible();
			await expect(block).toHaveJSProperty('textContent', value);
			await expect(block).toHaveJSProperty('innerText', value);
		};

		// ⛔ ACTIVE, with an output contract: what the model is told, as stored.
		const root = stored('Product Realization')!;
		await inspect(page, 'Product Realization');
		await expect(prompt).toContainText('ACTIVE');
		await expect(prompt).toContainText(`v${root.templateVersion} · this is what the model is told`);
		await shown(text, root.templateText);
		await shown(contract, root.outputContract!);
		await expect(noContract).toHaveCount(0);
		await text.scrollIntoViewIfNeeded();
		await shot(page, 'inspector shows a staged active prompt');

		// ⭑ CONTROL — DRAFT: authored, not armed, and shown as stored all the same.
		const implementation = stored('Product Implementation')!;
		await inspect(page, 'Product Implementation');
		await expect(prompt).toContainText('DRAFT');
		await expect(prompt).toContainText(`v${implementation.templateVersion} · authored, not armed — it renders nothing`);
		await shown(text, implementation.templateText);
		await shown(contract, implementation.outputContract!);
		await expect(noContract).toHaveCount(0);

		// ⭑ CONTROL — AN ABSENT OUTPUT CONTRACT is said to be absent, never shown as an empty one.
		const validation = stored('Integrated Product Validation')!;
		await inspect(page, 'Integrated Product Validation');
		await expect(prompt).toContainText('ACTIVE');
		await expect(prompt).toContainText(`v${validation.templateVersion} · this is what the model is told`);
		await shown(text, validation.templateText);
		await expect(contract).toHaveCount(0);
		await expect(noContract).toBeVisible();
		await expect(noContract).toContainText('no output contract is authored for this prompt');

		// ⭑ CONTROL — AN ABSENT TEMPLATE: the type authors no instruction, and no text or contract is shown for it.
		await inspect(page, 'Release Approval');
		await expect(prompt).toContainText('NONE');
		await expect(prompt).toContainText('no instruction is authored for this type');
		await expect(text).toHaveCount(0);
		await expect(contract).toHaveCount(0);
		await expect(noContract).toHaveCount(0);
	});
});
