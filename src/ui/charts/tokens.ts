// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Chart colours and chrome.
 *
 * Evaluations and points won/lost use the official VolleyReportXLS colours (theme of the workbook's
 * charts: accent1–6 and FF0000): green for what goes well, yellow, orange, red for what goes badly.
 * They are a project decision. The dataviz checks flag them (light fills below 3:1 on white, the two
 * light greens close to each other), so values are always readable in another way: labels inside the
 * segments, legend, tooltip and the "Mostra i dati" table.
 * Lines that do not mean good/bad (set trend) use the logo blue/orange pair, which passes all checks.
 */
export const SURFACE = '#ffffff';
export const TEXT_PRIMARY = '#383838';
export const TEXT_SECONDARY = '#7d7d7d';
export const GRID = '#e8ebee';
export const AXIS = '#d5d9dd';
export const FONT = "'Roboto Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
/** The typeface of the charts: the highly legible one when chosen in Accessibility. */
export const chartFont = () => (a11y().legible ? `'Atkinson Hyperlegible Next', ${FONT}` : FONT);
/** A font size of the charts, larger with larger text. */
export const chartSize = (px: number) => Math.round(px * (1 + 0.15 * a11y().text));

/** Categorical pair for series without a good/bad meaning (logo blue, logo orange). */
export const SERIES = ['#1876a1', '#e96e23'] as const;

/** Points won / lost: VolleyReportXLS "Vinti-Persi" charts. */
export const WON = '#00ff00';
export const LOST = '#ff0000';

/**
 * Colours for colour blindness (Accessibility): blue for what goes well,
 * orange for what goes badly (Okabe-Ito), and a blue-to-orange scale for the
 * evaluations, told apart by every common kind of colour blindness.
 */
const COLORBLIND = {
  won: '#0072b2',
  lost: '#e69f00',
  scale: ['#08519c', '#6baed6', '#c6dbef', '#fdd0a2', '#fd8d3c', '#a63603'],
  labels: ['#ffffff', '#383838', '#383838', '#383838', '#383838', '#ffffff'],
} as const;

export const wonColor = () => (a11y().colorblind ? COLORBLIND.won : WON);
export const lostColor = () => (a11y().colorblind ? COLORBLIND.lost : LOST);
export const scaleColors = (): readonly string[] => (a11y().colorblind ? COLORBLIND.scale : SCALE_COLORS);
export const scaleLabels = (): readonly string[] => (a11y().colorblind ? COLORBLIND.labels : SCALE_LABELS);

/** Evaluations, by place on the scale of their skill: the VolleyReportXLS palette. */
import { SCALE_COLORS, SCALE_LABELS } from '../../report/evaluation-colors';
import { a11y } from '../a11y';

export { SCALE_COLORS, SCALE_LABELS, evaluationColor } from '../../report/evaluation-colors';

/**
 * Shared chrome: recessive hairline axes and grid, text in text tokens.
 * Read when a chart is drawn, so it follows Accessibility (motion, typeface, size).
 */
export const BASE_OPTION = {
  get animation() {
    return !a11y().still;
  },
  animationDuration: 300,
  get textStyle() {
    return { fontFamily: chartFont(), color: TEXT_SECONDARY, fontSize: chartSize(12) };
  },
  aria: { enabled: true },
  get tooltip() {
    return {
      backgroundColor: SURFACE,
      borderColor: AXIS,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { fontFamily: chartFont(), color: TEXT_PRIMARY, fontSize: chartSize(12) },
      extraCssText: 'box-shadow: 0 4px 14px rgba(6,40,69,0.12); border-radius: 8px;',
    };
  },
};

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const percent = (v: number) => `${Math.round(v * 100)}%`;
