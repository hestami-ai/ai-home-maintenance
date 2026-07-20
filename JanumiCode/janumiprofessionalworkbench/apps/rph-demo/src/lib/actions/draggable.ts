// A small Svelte action to make a floating panel draggable by a handle. Used by the PWA Designer's side panels
// (agent / inspector / floor) so the user can reposition them off each other. The panel is moved via CSS transform
// (its layout anchor — a Svelte Flow <Panel> corner — is untouched), and the offset is clamped to the enclosing
// `.flowarea` so a panel can never be dragged fully off-screen. Drags that start on an interactive control
// (button/input/select/textarea/link) are ignored, so the collapse chevron and form fields keep working.
export interface DraggableOptions {
	/** CSS selector (within the node) for the drag handle; defaults to the whole node. */
	handle?: string;
}

const INTERACTIVE = 'button, input, textarea, select, a, [contenteditable="true"]';

export function draggable(node: HTMLElement, opts: DraggableOptions = {}) {
	let handle: HTMLElement = node;
	let offX = 0;
	let offY = 0;
	let startX = 0;
	let startY = 0;
	let baseLeft = 0;
	let baseTop = 0;
	let bound: DOMRect | null = null;
	let dragging = false;
	let observer: ResizeObserver | null = null;

	const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
	const M = 8; // keep at least this far inside the flow area

	/** Clamp an anchor-relative offset so the panel stays inside `b`, given its on-screen position at zero transform. */
	function clampOffset(nx: number, ny: number, baseL: number, baseT: number, b: DOMRect): [number, number] {
		return [
			clamp(nx, b.left + M - baseL, b.right - node.offsetWidth - M - baseL),
			clamp(ny, b.top + M - baseT, b.bottom - node.offsetHeight - M - baseT)
		];
	}

	function apply(nx: number, ny: number) {
		offX = nx;
		offY = ny;
		node.dataset.dragX = String(nx);
		node.dataset.dragY = String(ny);
		node.style.transform = `translate(${nx}px, ${ny}px)`;
	}

	function flowRect(): DOMRect {
		const flow = node.closest('.flowarea') as HTMLElement | null;
		return (flow ?? node.offsetParent ?? document.body).getBoundingClientRect();
	}

	function onMove(e: PointerEvent) {
		if (!dragging || !bound) return;
		const [nx, ny] = clampOffset(
			offX + (e.clientX - startX),
			offY + (e.clientY - startY),
			baseLeft,
			baseTop,
			bound
		);
		node.style.transform = `translate(${nx}px, ${ny}px)`;
		node.dataset.dragX = String(nx);
		node.dataset.dragY = String(ny);
	}

	function onUp() {
		if (!dragging) return;
		dragging = false;
		offX = Number(node.dataset.dragX ?? offX);
		offY = Number(node.dataset.dragY ?? offY);
		document.body.style.userSelect = '';
		document.body.style.cursor = '';
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
	}

	// Re-clamp a moved panel back into view when the viewport/container changes (window resize, fullscreen toggle,
	// layout reflow). Positions are stored as a px offset relative to the panel's anchor corner, so a change in the
	// flow area's size would otherwise strand a previously-moved panel off-screen with nothing pulling it back.
	function reclamp() {
		if (dragging || (offX === 0 && offY === 0)) return; // active drag self-clamps; an unmoved panel is at anchor
		const rect = node.getBoundingClientRect();
		const [nx, ny] = clampOffset(offX, offY, rect.left - offX, rect.top - offY, flowRect());
		if (nx !== offX || ny !== offY) apply(nx, ny);
	}

	function onDown(e: PointerEvent) {
		if (e.button !== 0) return;
		if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
		bound = flowRect();
		const rect = node.getBoundingClientRect();
		baseLeft = rect.left - offX; // panel's on-screen position at zero transform
		baseTop = rect.top - offY;
		startX = e.clientX;
		startY = e.clientY;
		dragging = true;
		document.body.style.userSelect = 'none';
		document.body.style.cursor = 'grabbing';
		e.stopPropagation();
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	function bind() {
		handle = (opts.handle ? node.querySelector<HTMLElement>(opts.handle) : node) ?? node;
		handle.addEventListener('pointerdown', onDown);
	}

	bind();
	const flowArea = node.closest('.flowarea');
	if (typeof ResizeObserver !== 'undefined' && flowArea) {
		observer = new ResizeObserver(() => reclamp());
		observer.observe(flowArea);
	}
	window.addEventListener('resize', reclamp);
	document.addEventListener('fullscreenchange', reclamp);

	return {
		update(next: DraggableOptions) {
			handle.removeEventListener('pointerdown', onDown);
			opts = next;
			bind();
		},
		destroy() {
			handle.removeEventListener('pointerdown', onDown);
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('resize', reclamp);
			document.removeEventListener('fullscreenchange', reclamp);
			observer?.disconnect();
		}
	};
}
