import { expect } from '@playwright/test';
import { test, resetEngine, gotoHydrated } from './support/harness';

// ⛔ REG-F-447 — AN INCONCLUSIVE REVIEW IS NOT A FAILED CALL, AND THE PAGE MUST NOT SAY IT IS.
//
// A draft the declared stand-in cannot fully judge — nothing registered, so the seven criteria the structural
// checker cannot answer arrive UNABLE_TO_DETERMINE — stages BLOCKED_EXTERNAL, as it did under the mock. The page
// used to print "The reviewer call failed (external/operational)" for every BLOCKED_EXTERNAL; the reviewer ran,
// and could not settle every mandatory question. The hint now carries the floor's own guidance.
//
// ⭐ `JAN-ESCREC` D3 (`REG-D-090`) — AND IT IS NOT AN ESCALATION'S. A BLOCKED_EXTERNAL candidate whose review its reviewer
// escalated is framed "The reviewer recommended escalation to a human reviewer —", and its "Refine it" sentence says that
// refining re-runs the same automated reviewer; the banner keys that on the classifier's ACTION, carried on the turn's
// summary, never on the guidance's prose. Every other banner is unchanged byte for byte, so this one is now asserted WHOLE:
// a banner that framed every external block as an escalation reddens here.
const INCOMPLETE_REVIEW_GUIDANCE =
	'PublishPwa remains blocked because the mandatory Reasoning Review is incomplete but produced no valid subject finding. Inspect the recorded policy result, configure or change the reviewer as needed, and rerun assurance. Do not revise the PWA or record a waiver merely to clear an incomplete review.';
const INCOMPLETE_REVIEW_BANNER = `The review did not produce a usable verdict — ${INCOMPLETE_REVIEW_GUIDANCE} This candidate is preserved. Refine it in the chat below (it continues on the same candidate), or Discard.`;

test.describe('Assurance floor — the resume hint names the recorded cause', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('an unregistered clean draft is described as an INCOMPLETE review, not a failed call', async ({ page }) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Resume Hint PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /Resume Hint PWA/ });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);
		// ⭐ `JAN-ESCREC` D3 (the second fix round's re-verifier's finding [7]) — THE LIFECYCLE ROW, WITH NOTHING STAGED: the box
		// the composition advisory hangs from here, which bounds its width here. Read now, before a candidate is staged.
		const unstagedRow = await page
			.locator('.pubact')
			.evaluate((el) => el.getBoundingClientRect().width);

		const plan = {
			plan: [{ tool: 'scaffold_graph', args: { types: [{ tempKey: 'plan', name: 'Plan', pwuKind: 'PLAN', isRoot: true }] } }]
		};
		await page.getByTestId('agent-input').fill(JSON.stringify(plan));
		await page.getByRole('button', { name: 'Send' }).click();

		await expect(page.getByTestId('authoring-candidate-banner')).toContainText('BLOCKED_EXTERNAL');
		const hint = page.getByTestId('candidate-resume-hint');
		await expect(hint).toContainText('is incomplete');
		await expect(hint).not.toContainText('reviewer call failed');
		// ⭐ `JAN-ESCREC` D3 — the whole banner, unchanged: an incomplete review is not framed as an escalation.
		await expect(hint).toHaveText(INCOMPLETE_REVIEW_BANNER);
		await expect(hint).not.toContainText(/escalat/i);

		// ⭐ `JAN-ESCREC` D3 (the ER-1 app verifier's MAJOR 2) — AND THE WHOLE BANNER IS ON SCREEN. `toHaveText` reads
		// textContent, which clipping never touches: the banner was ONE line, `white-space: nowrap` with an ellipsis, so at
		// this width the professional read its first seventy-odd characters and none of the guidance after them — beside an
		// escalation, not that refining re-runs the same automated reviewer (`REG-F-474`). These two measure the RENDERING:
		// nothing overflows the span's box, and the banner's last phrase is laid out inside it.
		expect(
			await hint.evaluate((el) => el.scrollWidth <= el.clientWidth),
			'the resume banner overflows its box, so part of it is clipped'
		).toBe(true);
		const lastPhrase = await hint.evaluate((el, phrase) => {
			const node = [...el.childNodes].find(
				(n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').includes(phrase)
			);
			if (!node) return 'the last phrase is not in one text node of the banner';
			const at = (node.textContent ?? '').lastIndexOf(phrase);
			const range = document.createRange();
			range.setStart(node, at);
			range.setEnd(node, at + phrase.length);
			const p = range.getBoundingClientRect();
			const box = el.getBoundingClientRect();
			const inside =
				p.left >= box.left - 0.5 &&
				p.right <= box.right + 0.5 &&
				p.top >= box.top - 0.5 &&
				p.bottom <= box.bottom + 0.5;
			return inside
				? 'inside'
				: `outside: the phrase spans x ${Math.round(p.left)}-${Math.round(p.right)}, the banner x ${Math.round(box.left)}-${Math.round(box.right)}`;
		}, 'or Discard.');
		expect(lastPhrase, 'the banner’s last phrase is not laid out inside it').toBe('inside');

		// ⭐ `JAN-ESCREC` D3 (the ER-1 app re-verifier's finding [2]) — AND NOTHING IS PAINTED OVER IT, AND NO ANCESTOR CLIPS IT.
		// The two measures above read the span against ITSELF, and both stayed green while (1) the composition-lint advisory
		// (`.complint`, an overlay hung out of flow below the top bar) was painted over the wrapped banner — at this width over
		// the right end of the hint's first four lines, measured — and (2) a CONTAINER that held the banner to one line clipped
		// every line after the first (`ER1-V154`). ⭑ This page HAS an advisory, so (1) is measured, never vacuous: the staged root
		// type was never asked who does its work, and the advisory says so. No visible item of it intersects the banner, its
		// hint and its Discard button included — and each lies on screen BELOW the banner: moved off it. ⭑ And not out of
		// sight: (1c) below holds each item inside every ancestor that clips, at full opacity, with nothing painted over it,
		// and its text readable against its own background.
		const overlay = await page.evaluate(() => {
			const banner = document
				.querySelector('[data-testid="authoring-candidate-banner"]')!
				.getBoundingClientRect();
			const items = [...document.querySelectorAll('.complint li')].filter((li) => {
				const r = li.getBoundingClientRect();
				return r.width > 0 && r.height > 0 && getComputedStyle(li).visibility === 'visible';
			});
			const rects = items.map((li) => ({
				text: (li.textContent ?? '').trim().slice(0, 60),
				r: li.getBoundingClientRect()
			}));
			return {
				visible: items.length,
				over: rects
					.filter(
						({ r }) =>
							r.left < banner.right &&
							r.right > banner.left &&
							r.top < banner.bottom &&
							r.bottom > banner.top
					)
					.map(({ text }) => text),
				offScreenOrAbove: rects
					.filter(
						({ r }) =>
							r.top < banner.bottom - 0.5 ||
							r.left < -0.5 ||
							r.right > window.innerWidth + 0.5 ||
							r.bottom > window.innerHeight + 0.5
					)
					.map(
						({ text, r }) =>
							`${text} @ x ${Math.round(r.left)}-${Math.round(r.right)} y ${Math.round(r.top)}-${Math.round(r.bottom)}`
					)
			};
		});
		expect(
			overlay.visible,
			'arrangement: no composition advisory is shown, so nothing could be painted over the banner'
		).toBeGreaterThan(0);
		expect(overlay.over, 'the composition advisory is painted over the resume banner').toEqual([]);
		expect(
			overlay.offScreenOrAbove,
			'the composition advisory is not on screen below the banner'
		).toEqual([]);
		// ⭐ (1c) `JAN-ESCREC` D3 (the second fix round's re-verifier's findings [6] and [7]) — AND READABLE THERE, NOT ONLY
		// PLACED. The measures above read each item's BOX, which stays where it is while nobody can read it: an advisory painted
		// fully transparent (`ER1-V202`), or cut away by the header box it hangs from (`ER1-V203`), passed them all. So each
		// visible item must also lie inside every ancestor whose overflow is not `visible` — read at its padding box, the
		// region it clips to — and the product of the computed opacities over it and its ancestors must be 1. ⭑ And it is
		// never text over text: each item carries an OPAQUE background (it is an overlay over the canvas — a node, the
		// inspector's header — and with none of its own it printed over theirs), and while a candidate is staged the advisory
		// is no wider than the lifecycle row it hangs from with nothing staged, read before the plan was sent: there it is
		// 544px against the canvas, and that row's width bounds it.
		// ⭐ (1c) AND SEEN, NOT ONLY DRAWN (the third fix round's re-verifier's findings [3], [4] and [6]): boxes, clips,
		// opacities and an opaque background all held while the canvas — positioned, later in the document, opaque — was
		// painted over every item (`ER1-V300`), while each chip was the colour of its own text (`ER1-V301`), and while the list
		// hung at the header box's LEFT edge, over the agent's panel and a node (`ER1-V306`). So, with the list's
		// `pointer-events` switched on for the measure and restored after it — the only way `elementFromPoint` can see it —
		// the topmost element at each item's centre and inset corners must be the item or inside it; each item's text must
		// reach 4.5:1 against its own background (WCAG AA, for its 0.72rem); and the staged list's right edge must be the
		// lifecycle row's, so it hangs under the lifecycle buttons.
		const advisory = await page.evaluate(() => {
			const ul = document.querySelector('.complint') as HTMLElement;
			const items = [...ul.querySelectorAll('li')].filter((li) => {
				const r = li.getBoundingClientRect();
				return r.width > 0 && r.height > 0 && getComputedStyle(li).visibility === 'visible';
			});
			/** The alpha of a computed colour: `a` in `rgba(r, g, b, a)` or after the slash of `rgb(r g b / a)` and
			 *  `color(… / a)`; with neither, the colour is opaque — save `transparent`. */
			const alpha = (colour: string): number => {
				const inner = /\(([^)]*)\)/.exec(colour)?.[1];
				if (inner === undefined) return colour === 'transparent' ? 0 : 1;
				const slash = inner.split('/');
				const a = (slash.length > 1 ? slash[1]! : (inner.split(',')[3] ?? '1')).trim();
				return a.endsWith('%') ? Number(a.slice(0, -1)) / 100 : Number(a);
			};
			/** WCAG 2's relative luminance of a computed `rgb(r, g, b)` / `rgba(r, g, b, a)` colour; `undefined` for any other
			 *  form, which is reported rather than guessed. */
			const luminance = (colour: string): number | undefined => {
				const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(colour);
				if (m === null) return undefined;
				const [r, g, b] = [m[1], m[2], m[3]].map((c) => {
					const s = Number(c) / 255;
					return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
				}) as [number, number, number];
				return 0.2126 * r + 0.7152 * g + 0.0722 * b;
			};
			const clipped: string[] = [];
			const notOpaque: string[] = [];
			const translucent: string[] = [];
			const unreadable: string[] = [];
			const covered: string[] = [];
			for (const li of items) {
				const text = (li.textContent ?? '').trim().slice(0, 60);
				const r = li.getBoundingClientRect();
				let opacity = 1;
				for (let a: Element | null = li; a !== null; a = a.parentElement) {
					const cs = getComputedStyle(a);
					opacity *= Number(cs.opacity);
					if (a === li || (cs.overflowX === 'visible' && cs.overflowY === 'visible')) continue;
					const b = a.getBoundingClientRect();
					const left = b.left + a.clientLeft;
					const top = b.top + a.clientTop;
					if (
						r.left < left - 0.5 ||
						r.top < top - 0.5 ||
						r.right > left + a.clientWidth + 0.5 ||
						r.bottom > top + a.clientHeight + 0.5
					)
						clipped.push(
							`${text} @ y ${Math.round(r.top)}-${Math.round(r.bottom)}: <${a.tagName.toLowerCase()} class="${a.getAttribute('class') ?? ''}"> clips it to y ${Math.round(top)}-${Math.round(top + a.clientHeight)}`
						);
				}
				if (opacity !== 1) notOpaque.push(`${text}: opacity ${opacity}`);
				const background = getComputedStyle(li).backgroundColor;
				if (alpha(background) !== 1) translucent.push(`${text}: background ${background}`);
				const ink = getComputedStyle(li).color;
				const [fg, bg] = [luminance(ink), luminance(background)];
				const ratio =
					fg === undefined || bg === undefined
						? undefined
						: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
				if (ratio === undefined || ratio < 4.5)
					unreadable.push(
						`${text}: ${ratio === undefined ? 'unreadable colours' : `${ratio.toFixed(2)}:1`} (${ink} on ${background})`
					);
			}
			// ⭑ What is PAINTED at each item, topmost — read with the list hit-testable for the measure alone.
			const pointerEvents = ul.style.pointerEvents;
			ul.style.pointerEvents = 'auto';
			try {
				for (const li of items) {
					const text = (li.textContent ?? '').trim().slice(0, 60);
					const r = li.getBoundingClientRect();
					const inset = 3;
					const points: [number, number][] = [
						[(r.left + r.right) / 2, (r.top + r.bottom) / 2],
						[r.left + inset, r.top + inset],
						[r.right - inset, r.top + inset],
						[r.left + inset, r.bottom - inset],
						[r.right - inset, r.bottom - inset]
					];
					for (const [x, y] of points) {
						const top = document.elementFromPoint(x, y);
						if (top === null || !li.contains(top))
							covered.push(
								`${text} @ (${Math.round(x)}, ${Math.round(y)}): <${top?.tagName.toLowerCase() ?? 'nothing'} class="${top?.getAttribute('class') ?? ''}">`
							);
					}
				}
			} finally {
				ul.style.pointerEvents = pointerEvents;
			}
			return {
				visible: items.length,
				width: ul.getBoundingClientRect().width,
				right: ul.getBoundingClientRect().right,
				rowRight: document.querySelector('.pubact')!.getBoundingClientRect().right,
				clipped,
				notOpaque,
				translucent,
				unreadable,
				covered
			};
		});
		expect(advisory.visible, 'arrangement: no advisory item is measured').toBeGreaterThan(0);
		expect(advisory.clipped, 'an ancestor clips the composition advisory').toEqual([]);
		expect(
			advisory.notOpaque,
			'the composition advisory is painted translucent, or not at all'
		).toEqual([]);
		expect(
			advisory.translucent,
			'an advisory item has no opaque background, so its text is printed over the canvas’s'
		).toEqual([]);
		expect(
			advisory.width,
			`the staged advisory is wider than the lifecycle row it hangs from with nothing staged (${unstagedRow}px)`
		).toBeLessThanOrEqual(unstagedRow + 0.5);
		expect(advisory.covered, 'something is painted over the composition advisory').toEqual([]);
		expect(
			advisory.unreadable,
			'an advisory item’s text does not reach 4.5:1 against its own background, so it cannot be read'
		).toEqual([]);
		expect(
			Math.abs(advisory.right - advisory.rowRight),
			`the staged advisory does not hang under the lifecycle buttons: its right edge is at x ${advisory.right}, the lifecycle row's at x ${advisory.rowRight}`
		).toBeLessThanOrEqual(1);
		// ⭑ (1b) THE HINT HAS A ROW OF ITS OWN: it starts the banner copy's row, below the title, so the title beside it is no
		// longer squeezed to one word a line (seven lines at this width, before).
		const row = await hint.evaluate((el) => {
			const copy = el.parentElement!.getBoundingClientRect();
			const title = el.parentElement!.querySelector('strong')!.getBoundingClientRect();
			const own = el.getBoundingClientRect();
			return {
				startsTheRow: Math.abs(own.left - copy.left) <= 0.5,
				belowTheTitle: own.top >= title.bottom - 0.5
			};
		});
		expect(row, 'the resume hint does not have a row of its own').toEqual({
			startsTheRow: true,
			belowTheTitle: true
		});
		// ⭑ (2) The last phrase lies inside EVERY ancestor whose overflow is not `visible`, each read at its padding box — the
		// region it clips to — so a container that clips the wrapped banner reddens here, not only a span that overflows.
		const clipped = await hint.evaluate((el, phrase) => {
			const node = [...el.childNodes].find(
				(n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').includes(phrase)
			);
			if (!node) return ['the last phrase is not in one text node of the banner'];
			const at = (node.textContent ?? '').lastIndexOf(phrase);
			const range = document.createRange();
			range.setStart(node, at);
			range.setEnd(node, at + phrase.length);
			const p = range.getBoundingClientRect();
			const out: string[] = [];
			for (let a = el.parentElement; a !== null; a = a.parentElement) {
				const cs = getComputedStyle(a);
				if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
				const b = a.getBoundingClientRect();
				const left = b.left + a.clientLeft;
				const top = b.top + a.clientTop;
				const right = left + a.clientWidth;
				const bottom = top + a.clientHeight;
				if (
					p.left < left - 0.5 ||
					p.right > right + 0.5 ||
					p.top < top - 0.5 ||
					p.bottom > bottom + 0.5
				)
					out.push(
						`<${a.tagName.toLowerCase()} class="${a.getAttribute('class') ?? ''}"> clips it: the phrase spans x ${Math.round(p.left)}-${Math.round(p.right)} y ${Math.round(p.top)}-${Math.round(p.bottom)}, the clip box x ${Math.round(left)}-${Math.round(right)} y ${Math.round(top)}-${Math.round(bottom)}`
					);
			}
			return out;
		}, 'or Discard.');
		expect(clipped, 'an ancestor clips the banner’s last phrase').toEqual([]);
	});
});
