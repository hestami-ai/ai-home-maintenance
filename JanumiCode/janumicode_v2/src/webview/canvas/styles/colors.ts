/**
 * Canvas Color Palette.
 *
 * Maps design system CSS custom properties to Canvas 2D colors.
 * Reads computed styles from document root at runtime.
 *
 * Wave 13: Styles + Tests + Integration
 */

import type { CanvasColorPalette } from '../../../lib/canvas/types';

/**
 * Get the current color palette from CSS custom properties.
 */
export function getCanvasColors(): CanvasColorPalette {
  const style = getComputedStyle(document.documentElement);

  return {
    surface: getCssVar(style, '--jc-surface', '#1a1a1a'),
    surfaceContainer: getCssVar(style, '--jc-surface-container', '#242424'),
    surfaceContainerHigh: getCssVar(style, '--jc-surface-container-high', '#2e2e2e'),
    surfaceContainerHighest: getCssVar(style, '--jc-surface-container-highest', '#383838'),
    primary: getCssVar(style, '--jc-primary', '#a8c7fa'),
    tertiary: getCssVar(style, '--jc-tertiary', '#73d9d4'),
    warning: getCssVar(style, '--jc-warning', '#f9a825'),
    error: getCssVar(style, '--jc-error', '#f28b82'),
    onSurface: getCssVar(style, '--jc-on-surface', '#e3e3e3'),
    outline: getCssVar(style, '--jc-outline', '#5c5c5c'),
  };
}

/**
 * Get a CSS variable value with fallback.
 */
function getCssVar(style: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = style.getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Node colors by type.
 */
export function getNodeColors(): Record<string, NodeColors> {
  const palette = getCanvasColors();

  return {
    artifact: {
      background: palette.surfaceContainer,
      border: palette.outline,
      selected: palette.primary,
      text: palette.onSurface,
    },
    requirement: {
      background: palette.surfaceContainer,
      border: palette.outline,
      selected: palette.primary,
      text: palette.onSurface,
    },
    component: {
      background: palette.surfaceContainer,
      border: palette.outline,
      selected: palette.primary,
      text: palette.onSurface,
    },
    adr: {
      background: palette.surfaceContainerHigh,
      border: palette.warning,
      selected: palette.primary,
      text: palette.onSurface,
    },
    test_case: {
      background: palette.surfaceContainer,
      border: palette.tertiary,
      selected: palette.primary,
      text: palette.onSurface,
    },
    acceptance_criterion: {
      background: palette.surfaceContainer,
      border: palette.outline,
      selected: palette.primary,
      text: palette.onSurface,
    },
    default: {
      background: palette.surfaceContainer,
      border: palette.outline,
      selected: palette.primary,
      text: palette.onSurface,
    },
  };
}

/**
 * Edge colors by type.
 */
export function getEdgeColors(): Record<string, string> {
  const palette = getCanvasColors();

  return {
    satisfies: palette.tertiary,
    depends_on: palette.outline,
    governs: palette.warning,
    derives_from: palette.primary,
    implements: palette.tertiary,
    tests: palette.primary,
    default: palette.outline,
  };
}

/**
 * Status badge colors.
 */
export function getStatusColors(): Record<string, StatusColors> {
  const palette = getCanvasColors();

  return {
    pending: {
      background: palette.surfaceContainerHighest,
      text: palette.onSurface,
    },
    generating: {
      background: '#1e3a5f',
      text: '#7fcfff',
    },
    complete: {
      background: '#1e3a1e',
      text: '#7fff7f',
    },
    flagged: {
      background: '#3a1e1e',
      text: palette.error,
    },
  };
}

/**
 * Colors for a node.
 */
interface NodeColors {
  background: string;
  border: string;
  selected: string;
  text: string;
}

/**
 * Colors for a status badge.
 */
interface StatusColors {
  background: string;
  text: string;
}
