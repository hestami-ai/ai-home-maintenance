import { describe, expect, it } from 'vitest';
import {
	EMPTY_CANVAS_HISTORY,
	recordCanvasMove,
	redoCanvasMove,
	undoCanvasMove,
	type PositionedCanvasNode
} from './canvasHistory.js';

interface TestNode extends PositionedCanvasNode {
	readonly data: { readonly label: string };
	readonly selected?: boolean;
}

const before: TestNode[] = [
	{ id: 'root', position: { x: 10, y: 20 }, data: { label: 'Root' }, selected: true },
	{ id: 'child', position: { x: 40, y: 80 }, data: { label: 'Child' } }
];

const after: TestNode[] = [{ ...before[0]!, position: { x: 125, y: 230 } }, before[1]!];

describe('canvas position history', () => {
	it('stores inverse Stately Graph patches and supports undo/redo without changing node data', () => {
		const recorded = recordCanvasMove(EMPTY_CANVAS_HISTORY, before, after);
		expect(recorded.past).toHaveLength(1);
		expect(recorded.future).toHaveLength(0);

		const undone = undoCanvasMove(recorded, after);
		expect(undone.nodes.map((node) => node.position)).toEqual(before.map((node) => node.position));
		expect(undone.nodes[0]!.data).toEqual({ label: 'Root' });
		expect(undone.nodes[0]!.selected).toBe(true);

		const redone = redoCanvasMove(undone.history, undone.nodes);
		expect(redone.nodes.map((node) => node.position)).toEqual(after.map((node) => node.position));
	});

	it('does not add a history entry for a drag gesture that changed no positions', () => {
		expect(recordCanvasMove(EMPTY_CANVAS_HISTORY, before, before)).toBe(EMPTY_CANVAS_HISTORY);
	});

	it('clears the redo branch when a new move follows an undo', () => {
		const first = recordCanvasMove(EMPTY_CANVAS_HISTORY, before, after);
		const undone = undoCanvasMove(first, after);
		expect(undone.history.future).toHaveLength(1);

		const alternative = [{ ...before[0]!, position: { x: 9, y: 9 } }, before[1]!];
		const branched = recordCanvasMove(undone.history, undone.nodes, alternative);
		expect(branched.past).toHaveLength(1);
		expect(branched.future).toHaveLength(0);
	});
});
