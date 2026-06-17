/**
 * ScreenDiffEngine — spatial diff between two screen snapshots (perception
 * layer, reference design §2). Works on the VISIBLE region (viewportTop…end)
 * in `lines` coordinates; falls back to whole-buffer line diff when the
 * snapshot has no viewport metadata (legacy line-buffer model).
 */

import type { ScreenSnapshot } from '../types';

export interface Region {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface ScreenDiff {
  /** Changed positions (row in `lines` coords, col). */
  changed: Array<{ row: number; col: number }>;
  /** Bounding box of changes, or null when nothing changed. */
  bounds: Region | null;
  /** changed cells / bounding-box area (0 when no box). */
  density: number;
  /** bounding-box area / visible-screen area (0 when no box). */
  coverage: number;
}

export function diffScreens(prev: ScreenSnapshot, curr: ScreenSnapshot): ScreenDiff {
  const changed: Array<{ row: number; col: number }> = [];
  const top = Math.min(prev.viewportTop ?? 0, curr.viewportTop ?? 0);
  const maxRows = Math.max(prev.lines.length, curr.lines.length);

  for (let r = top; r < maxRows; r++) {
    const a = prev.lines[r] ?? '';
    const b = curr.lines[r] ?? '';
    if (a === b) continue;
    const len = Math.max(a.length, b.length);
    for (let c = 0; c < len; c++) {
      if ((a[c] ?? ' ') !== (b[c] ?? ' ')) changed.push({ row: r, col: c });
    }
  }

  const bounds = boundingBox(changed);
  let density = 0;
  let coverage = 0;
  if (bounds) {
    const boxArea = (bounds.bottom - bounds.top + 1) * (bounds.right - bounds.left + 1);
    density = boxArea > 0 ? changed.length / boxArea : 0;
    const rows = curr.rows ?? Math.max(1, curr.lines.length - (curr.viewportTop ?? 0));
    const cols = curr.cols ?? Math.max(1, ...curr.lines.map((l) => l.length));
    coverage = boxArea / Math.max(1, rows * cols);
  }
  return { changed, bounds, density, coverage };
}

export function boundingBox(points: Array<{ row: number; col: number }>): Region | null {
  if (points.length === 0) return null;
  let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
  for (const p of points) {
    if (p.row < top) top = p.row;
    if (p.row > bottom) bottom = p.row;
    if (p.col < left) left = p.col;
    if (p.col > right) right = p.col;
  }
  return { top, bottom, left, right };
}

export function regionContains(outer: Region, inner: Region): boolean {
  return inner.top >= outer.top && inner.bottom <= outer.bottom
    && inner.left >= outer.left && inner.right <= outer.right;
}

export function regionsOverlap(a: Region, b: Region): boolean {
  return a.top <= b.bottom && b.top <= a.bottom && a.left <= b.right && b.left <= a.right;
}

/** Extract the visible text of a region from a snapshot. */
export function extractText(s: ScreenSnapshot, region: Region): string {
  const out: string[] = [];
  for (let r = region.top; r <= region.bottom && r < s.lines.length; r++) {
    out.push((s.lines[r] ?? '').slice(region.left, region.right + 1));
  }
  return out.join('\n');
}
