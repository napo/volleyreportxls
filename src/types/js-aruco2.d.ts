// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

declare module 'js-aruco2' {
  export interface Point {
    x: number;
    y: number;
  }
  export interface Marker {
    id: number;
    corners: Point[];
    hammingDistance: number;
  }
  export interface DictionaryDefinition {
    nBits: number;
    tau: number | null;
    codeList: (number | string | number[])[];
  }
  export interface Detector {
    detect(image: { width: number; height: number; data: Uint8ClampedArray }): Marker[];
  }
  /** CommonJS only (assigned through `this.AR`): usable from Node, not from the browser bundle. */
  export const AR: {
    DICTIONARIES: Record<string, DictionaryDefinition>;
    Detector: new (config?: { dictionaryName?: string; maxHammingDistance?: number }) => Detector;
  };
}

declare module 'js-aruco2/src/dictionaries/aruco_4x4_1000.js';
