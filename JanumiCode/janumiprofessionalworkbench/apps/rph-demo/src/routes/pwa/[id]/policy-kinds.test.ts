// ⭐ `REG-F-524` (`REG-D-121` Q18; `DESIGN-phase-7-completion.md` §4a E3) — THE DESIGNER FORM SHOWS WHICH PWU KINDS EACH
// POLICY GOVERNS, so the author can choose policies that govern the type's kind.
//
// ⛔ All 12 catalog policies are scoped by kind, the kernel matches the kind exactly, and a declared policy that excludes
// the unit's kind is never assessed for it: a unit whose declared policies all exclude it can never be assured, and the
// form showed no kinds. The page's policies are read from the engine by its own load, as the form receives them.
import { readFileSync } from 'node:fs';
import { listAssurancePolicies, SEED_PWA } from '@janumipwb/rph-engine';
import { describe, expect, it } from 'vitest';
import { getEngine } from '$lib/server/workbench';
import { load } from './+page.server.js';

/** `load` only ever reads `params.id`; the rest of the SvelteKit event is not touched. */
const event = (id: string) => ({ params: { id } }) as unknown as Parameters<typeof load>[0];

const MARKUP = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

describe('⭐ REG-F-524 — the designer form shows the PWU kinds each policy governs', () => {
	it('⭐ the page’s policies carry each policy’s kind conditions, as the engine holds them', async () => {
		const kindsStored = (state: Record<string, unknown>) =>
			(state.applicability as { pwuKindConditions?: readonly string[] } | undefined)?.pwuKindConditions;
		const scoped = listAssurancePolicies(getEngine()).filter((p) => (kindsStored(p.state)?.length ?? 0) > 0);
		expect(scoped.length, 'arrangement: the seeded catalog scopes its policies by kind').toBeGreaterThan(0);
		const data = (await load(event(SEED_PWA))) as unknown as {
			policies: readonly { id: string; pwuKinds?: readonly string[] }[];
		};
		const shown = new Map(data.policies.map((p) => [p.id, p]));
		for (const p of scoped)
			expect(shown.get(p.id)?.pwuKinds, `${p.id}: the form is not given the kinds it governs`).toEqual(
				kindsStored(p.state)
			);
	});

	it('⭐ the declared policies’ picker shows each policy’s kinds beside its name', () => {
		const start = MARKUP.indexOf("{@render fhead('Declared assurance policies'");
		const end = MARKUP.indexOf('⚖ Manage policies…', start);
		expect([start > -1, end > start], 'arrangement: the declared policies’ picker').toEqual([true, true]);
		const picker = MARKUP.slice(start, end);
		const each = picker.indexOf('{#each pickablePolicies as p (p.id)}');
		const name = picker.indexOf('{p.name}', each);
		const kinds = picker.indexOf('{policyKindsText(p.pwuKinds)}', name);
		expect([each > -1, name > each, kinds > name], 'each pickable policy’s kinds, after its name').toEqual([
			true,
			true,
			true
		]);
		expect(kinds < picker.indexOf('{/each}', each), 'the kinds are inside the policy’s own row').toBe(true);
	});
});
