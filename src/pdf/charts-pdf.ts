// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Charts on their way into the report PDF (report-pdf.ts): an image drawn by
 * the app with the same options used on screen, with its title, a note and
 * key figures; and section titles between them.
 */

export interface ChartImage {
  readonly png: Uint8Array;
  /** Size in pixels: only the proportions matter. */
  readonly width: number;
  readonly height: number;
}

export type ChartsPdfBlock =
  | { readonly kind: 'section'; readonly title: string }
  | {
      readonly kind: 'chart';
      readonly title: string;
      readonly note?: string;
      /** Key figures printed under the title, e.g. ["Voto", "7.0"]. */
      readonly figures?: readonly (readonly [string, string])[];
      readonly image: ChartImage;
    };
