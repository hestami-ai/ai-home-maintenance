import { expect, type Page } from '@playwright/test';
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

/**
 * ⭐ (1c) `JAN-ESCREC` D3 (the second fix round's re-verifier's findings [6] and [7]) — AND READABLE THERE, NOT ONLY
 * PLACED. The first case's overlay measures read each item's BOX, which stays where it is while nobody can read it: an advisory painted
 * fully transparent (`ER1-V202`), or cut away by the header box it hangs from (`ER1-V203`), passed them all. So each
 * visible item must also lie inside every ancestor whose overflow is not `visible` — read at its padding box, the
 * region it clips to — and the product of the computed opacities over it and its ancestors must be 1. ⭑ And it is
 * never text over text: each item carries an OPAQUE background (it is an overlay over the canvas — a node, the
 * inspector's header — and with none of its own it printed over theirs), and while a candidate is staged the advisory
 * is no wider than the lifecycle row it hangs from with nothing staged, read before the plan was sent: there it is
 * 544px against the canvas, and that row's width bounds it.
 * ⭐ (1c) AND SEEN, NOT ONLY DRAWN (the third fix round's re-verifier's findings [3], [4] and [6]): boxes, clips,
 * opacities and an opaque background all held while the canvas — positioned, later in the document, opaque — was
 * painted over every item (`ER1-V300`), while each chip was the colour of its own text (`ER1-V301`), and while the list
 * hung at the header box's LEFT edge, over the agent's panel and a node (`ER1-V306`). So, with the list's
 * `pointer-events` switched on for the measure and restored after it — the only way `elementFromPoint` can see it —
 * the topmost element at each item's centre and inset corners must be the item or inside it; each item's text must
 * reach 4.5:1 against its own background (WCAG AA, for its 0.72rem); and the staged list's right edge must be the
 * lifecycle row's, so it hangs under the lifecycle buttons.
 * ⭐ `JAN-ESCREC` ER-2 step 7 (`REG-D-092`; the ER-1 fourth fix round's re-verifier's findings [2] and [3]) — MOVED HERE
 * FROM THE FIRST CASE, every limb as it was, so the TWO-ROOTS case below asks the same limbs of a WARNING chip — the
 * first case stages one root, so its advisory carries the info item alone, and the staged warn colour was held by no test
 * (`ER1-V403`). ⭐ AND THE RATIO IS TAKEN ON THE TEXT COLOUR AS PAINTED (`ER1-V404`): the luminance read r, g and b and
 * dropped the alpha, so text painted white at 6% — rgb(33, 33, 33) as composited over the dark surface, invisible — read
 * 18.58:1 where it paints 1.16:1 (measured). The text colour is composited over the item's own background by its own
 * alpha first; the background itself is held opaque by the limb before it. ⭐ And the text colour is the one the glyphs
 * are FILLED with (`-webkit-text-fill-color`, which paints in place of `color`; `ER2-V6`), `color` only where no fill is
 * set — Chromium resolves an unset fill to the current colour.
 * ⭐ AND NO PAINT-TIME FILTER (the ER-2 fix round's re-verifier's finding [4], `ER2-V53`): a `filter` — `opacity()`,
 * `brightness()` or any other — is applied as the item paints, after every value read above, so a chip filtered to 6%
 * kept opacity 1, an opaque background, a readable colour and the topmost place at each point. The item and every
 * ancestor must compute `filter: none`.
 * ⭐ AND NO PAINT-TIME MASK OR BLEND (`JAN-PRQUAL` `PQ-1` D6; `REG-D-093`'s owed pin `ER2-V103`, and its general form): a
 * `mask-image` — or `-webkit-mask-image`, its prefixed alias — and a `mix-blend-mode` are applied as the item paints too,
 * after every value read above. A chip masked to 6% kept opacity 1, `filter: none`, its opaque background, its readable
 * colours and the topmost place at each point, while its brightest PAINTED pixel fell from rgb(142, 144, 153) to
 * rgb(24, 26, 32) over a page of rgb(17, 19, 24) (measured in the lane's Edge).
 * So the item and every ancestor must compute `mask-image: none`, `-webkit-mask-image: none` and `mix-blend-mode: normal`.
 * ⭐ AND THE RATIO IS TAKEN ON THE PIXELS AS PAINTED (`JAN-PRQUAL` `PQ-1` D6; the general form of `ER2-V53` and `ER2-V103`):
 * every limb above reads a computed value or hit-tests a point, and a positioned `::after` laid over each chip in the
 * page's own colour at 94% left every one of them green — `elementFromPoint` returns the chip for its own pseudo-element,
 * and no opacity, filter, mask, blend or colour changes. So each item's PADDING box (inside its border, which paints its
 * text colour whatever lies over the text) is screenshotted TWICE and decoded by the page itself: as the page composites
 * it, and with the items' own glyphs unfilled — their text fill transparent, every pseudo-element keeping its own. What
 * differs between the two readings is what the GLYPHS paint, after everything laid over, under or through them, and on
 * EACH LINE of its text some pixel must change between them by 4.5:1. ⛔ READ ONCE, against the colour most of the box's
 * pixels are, the limb asked only whether a line held ONE pixel at 4.5:1 — and an opaque cover striped in the chip's own
 * colour passed it with every glyph hidden, its stripes carrying the contrast the glyphs no longer did (`PQ1-V424`). A
 * cover is in both readings alike, so its own pixels cancel out, whatever contrast they carry.
 * ⭐ AND HOW MUCH OF EACH LINE, READ AGAINST THE GLYPHS ALONE (`JAN-PRQUAL` `PQ-1` D6): a cover over MOST of a line passed —
 * opaque in the chip's own colour, with a one-pixel slit in every eight columns, laid by the item's own `::before`: the
 * glyphs' pixels left in the slits still changed by 4.5:1 between the two readings, and no computed limb or hit test
 * saw it (`PQ1-V604`). So each box is read twice more with the staged items ALONE — every other box hidden, the items'
 * own pseudo-elements gone — filled and unfilled; and on each line, the pixels that change by 4.5:1 as painted must be at
 * least nine tenths of those that change so alone. ⚠ NOT YET SEEN, AND SAID SO: anything the ITEM ITSELF paints over its
 * glyphs that the readings alone keep — a child element, or its own text decoration (a line-through in the chip's own
 * colour) — is in all four readings and takes from both counts alike; such a cover is reddened, if at all, only by the
 * CONTROL below, never by this limb.
 */
async function measureTheStagedAdvisory(page: Page) {
	const measured = await page.evaluate(() => {
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
		/** The r, g and b of a computed `rgb(r, g, b)` / `rgba(r, g, b, a)` colour; `undefined` for any other form, which is
		 *  reported rather than guessed. */
		const channels = (colour: string): [number, number, number] | undefined => {
			const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(colour);
			return m === null ? undefined : [Number(m[1]), Number(m[2]), Number(m[3])];
		};
		/** WCAG 2's relative luminance of r, g and b. */
		const luminance = (rgb: readonly [number, number, number]): number => {
			const [r, g, b] = rgb.map((c) => {
				const s = c / 255;
				return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
			}) as [number, number, number];
			return 0.2126 * r + 0.7152 * g + 0.0722 * b;
		};
		/** ⭐ `JAN-ESCREC` ER-2 step 7 (`ER1-V404`) — the text colour AS PAINTED: its r, g and b composited over the item's
		 *  background by the text's own alpha (`painted = fg × a + bg × (1 − a)`), so a colour that is near-transparent is
		 *  read as the near-background it paints, never as the full colour it names. */
		const painted = (ink: string, under: string): [number, number, number] | undefined => {
			const [fg, bg] = [channels(ink), channels(under)];
			if (fg === undefined || bg === undefined) return undefined;
			const a = alpha(ink);
			return fg.map((c, i) => c * a + bg[i]! * (1 - a)) as [number, number, number];
		};
		const clipped: string[] = [];
		const notOpaque: string[] = [];
		const filtered: string[] = [];
		const masked: string[] = [];
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
				if (cs.filter !== 'none')
					filtered.push(`${text}: <${a.tagName.toLowerCase()} class="${a.getAttribute('class') ?? ''}"> filter ${cs.filter}`);
				// ⭑ `ER2-V103` — a mask or a blend, read as each property computes (the prefixed alias on its own).
				for (const [property, none] of [
					['mask-image', 'none'],
					['-webkit-mask-image', 'none'],
					['mix-blend-mode', 'normal']
				] as const) {
					const value = cs.getPropertyValue(property);
					if (value !== none)
						masked.push(`${text}: <${a.tagName.toLowerCase()} class="${a.getAttribute('class') ?? ''}"> ${property} ${value}`);
				}
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
			// ⭑ THE COLOUR THE GLYPHS ARE PAINTED IN (the ER-2 verifier's finding [2]; `ER2-V6`): `-webkit-text-fill-color`
			// paints in place of `color`, and Chromium resolves an unset fill to the current colour — so the fill, then `color`.
			const own = getComputedStyle(li);
			const ink = own.webkitTextFillColor || own.color;
			const [shown, under] = [painted(ink, background), channels(background)];
			const [fg, bg] = [shown && luminance(shown), under && luminance(under)];
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
		// ⭐ WHERE THE PIXELS ARE READ (`PQ-1` D6): each item's PADDING box in whole pixels, inside its border — which paints
		// the text colour whatever lies over the text — and each line its text is laid out on, within that box.
		const paintBoxes = items.map((li) => {
			const r = li.getBoundingClientRect();
			const left = r.left + li.clientLeft;
			const top = r.top + li.clientTop;
			const x = Math.ceil(left);
			const y = Math.ceil(top);
			const clip = { x, y, width: Math.floor(left + li.clientWidth) - x, height: Math.floor(top + li.clientHeight) - y };
			const range = document.createRange();
			range.selectNodeContents(li);
			const byTop = new Map<number, { x0: number; y0: number; x1: number; y1: number }>();
			for (const f of range.getClientRects()) {
				if (f.width <= 0 || f.height <= 0) continue;
				const key = Math.round(f.top);
				const line = byTop.get(key) ?? { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
				byTop.set(key, {
					x0: Math.min(line.x0, Math.max(0, Math.floor(f.left) - x)),
					y0: Math.min(line.y0, Math.max(0, Math.floor(f.top) - y)),
					x1: Math.max(line.x1, Math.min(clip.width, Math.ceil(f.right) - x)),
					y1: Math.max(line.y1, Math.min(clip.height, Math.ceil(f.bottom) - y))
				});
			}
			return {
				text: (li.textContent ?? '').trim().slice(0, 60),
				clip,
				lines: [...byTop.values()]
			};
		});
		return {
			paintBoxes,
			visible: items.length,
			/** Each measured item's kind — `clwarn` or `clinfo`, read from its class list (Svelte adds its scope class) — so a
			 *  case can say which chips it measured. */
			kinds: items.map((li) =>
				li.classList.contains('clwarn') ? 'clwarn' : li.classList.contains('clinfo') ? 'clinfo' : li.className
			),
			width: ul.getBoundingClientRect().width,
			right: ul.getBoundingClientRect().right,
			rowRight: document.querySelector('.pubact')!.getBoundingClientRect().right,
			clipped,
			notOpaque,
			filtered,
			masked,
			translucent,
			unreadable,
			covered
		};
	});
	// ⭐ THE GLYPHS' OWN PAINT, BY DIFFERENCE (`PQ-1` D6): each padding box is screenshotted twice — as the page
	// composites it, and with the items' own glyphs unfilled (`GLYPHS_UNFILLED`) — and both are decoded by the page's own
	// image decoder, no codec of ours. What differs between the two readings is what the GLYPHS paint, after everything
	// laid over, under or through them; so on EACH LINE some pixel must change by 4.5:1 between them. ⛔ A cover over the
	// glyphs is in both readings alike, and cancels out whatever contrast its own pixels carry (`PQ1-V424`).
	// ⭐ AND TWICE MORE, THE ITEMS ALONE (`GLYPHS_ALONE`; `PQ1-V604`): what changes there is what the glyphs paint with
	// nothing laid over them — so on each line, as painted, nine tenths of those pixels must still change by 4.5:1.
	const { paintBoxes, ...rest } = measured;
	const shoot = async (): Promise<string[]> => {
		const out: string[] = [];
		for (const box of paintBoxes)
			out.push(
				(await page.screenshot({ clip: box.clip, scale: 'css', animations: 'disabled', caret: 'hide' })).toString('base64')
			);
		return out;
	};
	const composited = await shoot();
	const unfilling = await page.addStyleTag({ content: GLYPHS_UNFILLED });
	let unfilled: string[];
	try {
		unfilled = await shoot();
	} finally {
		await unfilling.evaluate((el) => el.parentNode?.removeChild(el));
	}
	const isolating = await page.addStyleTag({ content: GLYPHS_ALONE });
	let alone: string[];
	let aloneUnfilled: string[];
	try {
		alone = await shoot();
		const unfillingAlone = await page.addStyleTag({ content: GLYPHS_UNFILLED });
		try {
			aloneUnfilled = await shoot();
		} finally {
			await unfillingAlone.evaluate((el) => el.parentNode?.removeChild(el));
		}
	} finally {
		await isolating.evaluate((el) => el.parentNode?.removeChild(el));
	}
	const paintedUnreadable: string[] = [];
	let paintedLines = 0;
	for (const [b, box] of paintBoxes.entries()) {
		const read = await page.evaluate(
			async ({ asPainted, withoutGlyphs, glyphsAlone, glyphsAloneUnfilled, lines }) => {
				const decode = async (b64: string): Promise<ImageData> => {
					const image = new Image();
					image.src = `data:image/png;base64,${b64}`;
					await image.decode();
					const canvas = document.createElement('canvas');
					canvas.width = image.naturalWidth;
					canvas.height = image.naturalHeight;
					const g = canvas.getContext('2d')!;
					g.drawImage(image, 0, 0);
					return g.getImageData(0, 0, canvas.width, canvas.height);
				};
				const [first, second, third, fourth] = [
					await decode(asPainted),
					await decode(withoutGlyphs),
					await decode(glyphsAlone),
					await decode(glyphsAloneUnfilled)
				];
				const luminance = ({ data, width }: ImageData, x: number, y: number): number => {
					const i = (y * width + x) * 4;
					const [r, gr, bl] = [data[i]!, data[i + 1]!, data[i + 2]!].map((c) => {
						const s = c / 255;
						return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
					}) as [number, number, number];
					return 0.2126 * r + 0.7152 * gr + 0.0722 * bl;
				};
				const width = Math.min(first.width, second.width, third.width, fourth.width);
				const height = Math.min(first.height, second.height, third.height, fourth.height);
				/** The contrast ratio between two readings at one pixel. */
				const ratio = (p: ImageData, q: ImageData, x: number, y: number): number => {
					const [la, lb] = [luminance(p, x, y), luminance(q, x, y)];
					return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
				};
				// ⭐ Per line: the most any pixel changes as painted; how many change by 4.5:1 as painted; and how many so alone.
				const perLine = lines.map((line) => {
					let best = 1;
					let painted = 0;
					let isolated = 0;
					for (let y = Math.max(0, line.y0); y < Math.min(height, line.y1); y += 1)
						for (let x = Math.max(0, line.x0); x < Math.min(width, line.x1); x += 1) {
							const k = ratio(first, second, x, y);
							best = Math.max(best, k);
							if (k >= 4.5) painted += 1;
							if (ratio(third, fourth, x, y) >= 4.5) isolated += 1;
						}
					return { best, painted, isolated };
				});
				return { perLine, size: [width, height] };
			},
			{
				asPainted: composited[b]!,
				withoutGlyphs: unfilled[b]!,
				glyphsAlone: alone[b]!,
				glyphsAloneUnfilled: aloneUnfilled[b]!,
				lines: box.lines
			}
		);
		if (read.perLine.length === 0) paintedUnreadable.push(`${box.text}: no line of its text was found to read`);
		paintedLines += read.perLine.length;
		read.perLine.forEach(({ best, painted, isolated }, i) => {
			if (best < 4.5)
				paintedUnreadable.push(
					`${box.text}: line ${i + 1} — its own glyphs change the paint by at most ${best.toFixed(2)}:1 (${read.size.join('×')} px read)`
				);
			// ⭐ `PQ1-V604` — most of the line covered: its glyphs change by 4.5:1 alone what a cover takes from them as painted.
			else if (painted < 0.9 * isolated)
				paintedUnreadable.push(
					`${box.text}: line ${i + 1} — ${painted} of the ${isolated} pixels its glyphs change by 4.5:1 alone change so as painted`
				);
		});
	}
	return { ...rest, paintedUnreadable, paintedLines };
}

/**
 * ⭐ WHAT THE SECOND READING TAKES AWAY (`PQ-1` D6): the staged items' own glyphs — the text fill of every item and of
 * everything in it made transparent (`-webkit-text-fill-color` paints in place of `color`) — while every pseudo-element of
 * them keeps its own fill, so a cover one lays is painted in both readings and cancels out.
 */
const GLYPHS_UNFILLED =
	'.pubact.staged .complint li, .pubact.staged .complint li * { -webkit-text-fill-color: transparent !important; } ' +
	'.pubact.staged .complint li::before, .pubact.staged .complint li::after, ' +
	'.pubact.staged .complint li *::before, .pubact.staged .complint li *::after ' +
	'{ -webkit-text-fill-color: currentColor !important; }';

/**
 * ⭐ WHAT THE THIRD AND FOURTH READINGS SHOW (`PQ-1` D6; `PQ1-V604`): the staged items ALONE — every other box hidden, and
 * the items' own pseudo-elements and their descendants' gone — so what their glyphs paint there is what no cover laid
 * over them, by the page or by the item's pseudo-elements, has taken away. ⚠ What the item paints as ITSELF stays: a
 * child element of it, and its own text decoration — so a cover laid by either is in these readings too.
 */
const GLYPHS_ALONE =
	'body * { visibility: hidden !important; } ' +
	'.pubact.staged .complint li, .pubact.staged .complint li * { visibility: visible !important; } ' +
	'.pubact.staged .complint li::before, .pubact.staged .complint li::after, ' +
	'.pubact.staged .complint li *::before, .pubact.staged .complint li *::after { content: none !important; }';

/**
 * ⭐ (1c)'s PAINTED LIMB, CONTROLLED (`JAN-PRQUAL` `PQ-1` D6): five covers no computed value shows, each laid over each
 * staged chip for this measure alone, then taken off — by a positioned `::after` of the chip, the page's own colour at
 * 94%; an OPAQUE cover striped in the chip's own colour, whose stripes carry the very contrast the glyphs would
 * (`PQ1-V424`); and an opaque cover in the chip's own colour with a one-pixel slit in every eight columns, through which
 * the glyphs still change by 4.5:1 (`PQ1-V604`); and the same slits laid by an element of the PAGE's, not the chip's,
 * its pointer events off so no hit test meets it — which only the readings alone take away, because they hide every
 * box but the staged items (`GLYPHS_ALONE`); ⭐ and, by the chip's `::after` again, a cover in the chip's own colour
 * over TWO of every eight columns, leaving six open — so about four fifths of what the glyphs change alone still
 * changes as painted, short of the nine tenths the limb asks. ⛔ WITHOUT IT, the slit covers left about one eighth open,
 * so any share between about an eighth and the whole passed them alike, and a limb held to a fifth, not nine tenths,
 * named every line still (`PQ1-V806`); with it, the limb is shown to discriminate between about four fifths and the
 * whole, at the nine tenths it asks. Under each, the painted limb must name EVERY line of every chip, and nothing else
 * may: every computed limb and the hit test stay clear. So the painted limb is the one that sees them, and is shown
 * able to — a limb reading one pixel's contrast, not the glyphs' own paint, passes the striped cover, and one that does
 * not read the glyphs alone passes the slits. ⭐ AND EACH BY THE LIMB BUILT FOR IT: a line no pixel of which changes by
 * 4.5:1 is named for that (the overlay, the stripes), and one that keeps some such pixels but too few of its own for
 * that (the slits) — so neither half of the limb can lean on the other: the first held to a weaker ratio, the
 * overlay's lines would be named by the second alone.
 */
async function expectThePaintedLimbToSeeAnOverlay(page: Page): Promise<void> {
	const TOO_LITTLE_CHANGE = 'its own glyphs change the paint by at most';
	const TOO_FEW_PIXELS = 'pixels its glyphs change by 4.5:1 alone change so as painted';
	/** A cover laid by each staged chip's own positioned `::after`; what is returned takes it off. */
	const byTheChip = (cover: string) => async (): Promise<() => Promise<void>> => {
		const overlay = await page.addStyleTag({
			content:
				'.pubact.staged .complint li { position: relative; } ' +
				`.pubact.staged .complint li::after { content: ""; position: absolute; inset: 0; ${cover} }`
		});
		return async () => {
			await overlay.evaluate((el) => el.parentNode?.removeChild(el));
		};
	};
	/**
	 * ⭐ The slits laid by an element of the PAGE's over each staged chip — fixed at the chip's box, in the chip's own
	 * computed background, its pointer events off — so neither the hit test nor the chip's own pseudo-elements meet it.
	 */
	const byThePage = async (): Promise<() => Promise<void>> => {
		await page.evaluate(() => {
			for (const li of document.querySelectorAll('.pubact.staged .complint li')) {
				const r = li.getBoundingClientRect();
				const background = getComputedStyle(li).backgroundColor;
				const cover = document.createElement('div');
				cover.dataset.paintedControl = 'slits';
				cover.setAttribute(
					'style',
					`position: fixed; left: ${r.left}px; top: ${r.top}px; width: ${r.width}px; height: ${r.height}px; ` +
						`pointer-events: none; z-index: 2147483647; background: repeating-linear-gradient(to right, ${background} 0 7px, transparent 7px 8px);`
				);
				document.body.appendChild(cover);
			}
		});
		return async () => {
			await page.evaluate(() => {
				for (const cover of document.querySelectorAll('[data-painted-control]')) cover.remove();
			});
		};
	};
	for (const [cover, lay, limb] of [
		['background: var(--surface); opacity: 0.94;', byTheChip('background: var(--surface); opacity: 0.94;'), TOO_LITTLE_CHANGE],
		[
			'background: repeating-linear-gradient(to bottom, var(--surface) 0 4px, currentColor 4px 6px);',
			byTheChip('background: repeating-linear-gradient(to bottom, var(--surface) 0 4px, currentColor 4px 6px);'),
			TOO_LITTLE_CHANGE
		],
		[
			'background: repeating-linear-gradient(to right, var(--surface) 0 7px, transparent 7px 8px);',
			byTheChip('background: repeating-linear-gradient(to right, var(--surface) 0 7px, transparent 7px 8px);'),
			TOO_FEW_PIXELS
		],
		['the same slits, laid by an element of the page over each chip', byThePage, TOO_FEW_PIXELS],
		// ⭐ `PQ1-V806` — two of every eight columns covered, six open: a share of about four fifths, under nine tenths.
		[
			'background: repeating-linear-gradient(to right, var(--surface) 0 2px, transparent 2px 8px);',
			byTheChip('background: repeating-linear-gradient(to right, var(--surface) 0 2px, transparent 2px 8px);'),
			TOO_FEW_PIXELS
		]
	] as const) {
		const takeOff = await lay();
		try {
			const hidden = await measureTheStagedAdvisory(page);
			expect(hidden.paintedLines, 'CONTROL arrangement: lines of text are read').toBeGreaterThan(0);
			expect(hidden.paintedUnreadable, `CONTROL: the painted limb names every hidden line under ${cover}`).toHaveLength(
				hidden.paintedLines
			);
			expect(
				hidden.paintedUnreadable.filter((line) => !line.includes(limb)),
				`CONTROL: each line under ${cover} is named because ${limb}`
			).toEqual([]);
			expect(
				[hidden.clipped, hidden.notOpaque, hidden.filtered, hidden.masked, hidden.translucent, hidden.unreadable, hidden.covered],
				`CONTROL: and no other limb sees ${cover} — which is why the painted limb is there`
			).toEqual([[], [], [], [], [], [], []]);
		} finally {
			await takeOff();
		}
	}
	expect((await measureTheStagedAdvisory(page)).paintedUnreadable, 'CONTROL: the covers taken off, every line reads again').toEqual(
		[]
	);
}

/** (1c)'s limbs over `measureTheStagedAdvisory`'s report, against the lifecycle row's width read with nothing staged. */
function expectTheStagedAdvisoryReadable(
	advisory: Awaited<ReturnType<typeof measureTheStagedAdvisory>>,
	unstagedRow: number
): void {
	expect(advisory.visible, 'arrangement: no advisory item is measured').toBeGreaterThan(0);
	expect(advisory.clipped, 'an ancestor clips the composition advisory').toEqual([]);
	expect(
		advisory.notOpaque,
		'the composition advisory is painted translucent, or not at all'
	).toEqual([]);
	expect(
		advisory.filtered,
		'a paint-time filter is laid over the composition advisory, which its opacity and colours do not show'
	).toEqual([]);
	expect(
		advisory.masked,
		'a paint-time mask or blend is laid over the composition advisory, which its opacity, filter and colours do not show'
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
	// ⭐ `PQ-1` D6 — AND AS PAINTED: what the pixels show, whatever the computed values above say.
	expect(
		advisory.paintedUnreadable,
		'an advisory item’s text, as PAINTED, does not reach 4.5:1 against its background as painted — something laid over, under or through it hides what no computed value shows'
	).toEqual([]);
	expect(
		Math.abs(advisory.right - advisory.rowRight),
		`the staged advisory does not hang under the lifecycle buttons: its right edge is at x ${advisory.right}, the lifecycle row's at x ${advisory.rowRight}`
	).toBeLessThanOrEqual(1);
}

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
		// ⭐ (1c) `JAN-ESCREC` D3 — AND READABLE THERE, NOT ONLY PLACED: clipped by no ancestor, at full opacity, an opaque
		// chip with nothing painted over it, its text at 4.5:1 or more as painted, and hung under the lifecycle buttons no wider
		// than the row it hangs from with nothing staged (`expectTheStagedAdvisoryReadable`, above, which says why each limb).
		expectTheStagedAdvisoryReadable(await measureTheStagedAdvisory(page), unstagedRow);
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

	// ⭐ `JAN-ESCREC` ER-2 step 7 (`REG-D-092`; the ER-1 fourth fix round's re-verifier's finding [2]; `ER1-V403`) — THE
	// WARNING CHIP, ASKED BY THE SAME LIMBS. The case above stages one root, so its advisory carries the info item alone,
	// and the staged warn colour (`.pubact.staged .complint .clwarn`) was held by no test: removed, the warning read the
	// unstaged orange on the dark chip, 3.70:1 (computed), with every case green. Two root types staged give the advisory its
	// root-count WARNING, and (1c) asks it every limb it asks the info item. ⭑ THE ARRANGEMENT FIRST: a `clwarn` item is among
	// the items measured, so the readability limb is asked of a warning chip, never vacuously.
	test('two root types staged: the advisory’s WARNING chip is measured by (1c) as every item is — readable on its own background', async ({
		page
	}) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Resume Hint Two Roots');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /Resume Hint Two Roots/ });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);
		// The lifecycle row with nothing staged, read before the plan is sent — as the case above reads it.
		const unstagedRow = await page
			.locator('.pubact')
			.evaluate((el) => el.getBoundingClientRect().width);

		const plan = {
			plan: [
				{
					tool: 'scaffold_graph',
					args: {
						types: [
							{ tempKey: 'a', name: 'Plan A', pwuKind: 'PLAN', isRoot: true },
							{ tempKey: 'b', name: 'Plan B', pwuKind: 'PLAN', isRoot: true }
						]
					}
				}
			]
		};
		await page.getByTestId('agent-input').fill(JSON.stringify(plan));
		await page.getByRole('button', { name: 'Send' }).click();
		await expect(page.getByTestId('authoring-candidate-banner')).toBeVisible();

		const advisory = await measureTheStagedAdvisory(page);
		expect(advisory.kinds, 'arrangement: no warning chip is measured').toContain('clwarn');
		expectTheStagedAdvisoryReadable(advisory, unstagedRow);
		// ⭐ `JAN-PRQUAL` `PQ-1` D6 — and the painted limb, over both kinds of chip, shown to see what nothing else does.
		await expectThePaintedLimbToSeeAnOverlay(page);
	});
});
