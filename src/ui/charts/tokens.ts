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
import type { Evaluation } from '../../domain/codes';

export const SURFACE = '#ffffff';
export const TEXT_PRIMARY = '#383838';
export const TEXT_SECONDARY = '#7d7d7d';
export const GRID = '#e8ebee';
export const AXIS = '#d5d9dd';
export const FONT = "'Roboto Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

/** Categorical pair for series without a good/bad meaning (logo blue, logo orange). */
export const SERIES = ['#1876a1', '#e96e23'] as const;

/** Points won / lost: VolleyReportXLS "Vinti-Persi" charts. */
export const WON = '#00ff00';
export const LOST = '#ff0000';

/** Evaluations from best (#) to worst (=): the VolleyReportXLS palette. */
export const EVALUATION_COLORS: Readonly<Record<Evaluation, string>> = {
  '#': '#00ff00',
  '+': '#90ee90',
  '!': '#adff2f',
  '-': '#ffff99',
  '/': '#f79646',
  '=': '#ff0000',
};

/** Ink for a label drawn inside a fill: text colour on the light fills, white on red. */
export const EVALUATION_LABEL: Readonly<Record<Evaluation, string>> = {
  '#': TEXT_PRIMARY,
  '+': TEXT_PRIMARY,
  '!': TEXT_PRIMARY,
  '-': TEXT_PRIMARY,
  '/': TEXT_PRIMARY,
  '=': '#ffffff',
};

/** Shared chrome: recessive hairline axes and grid, text in text tokens. */
export const BASE_OPTION = {
  animationDuration: 300,
  textStyle: { fontFamily: FONT, color: TEXT_SECONDARY, fontSize: 12 },
  aria: { enabled: true },
  tooltip: {
    backgroundColor: SURFACE,
    borderColor: AXIS,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { fontFamily: FONT, color: TEXT_PRIMARY, fontSize: 12 },
    extraCssText: 'box-shadow: 0 4px 14px rgba(6,40,69,0.12); border-radius: 8px;',
  },
} as const;

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const percent = (v: number) => `${Math.round(v * 100)}%`;
