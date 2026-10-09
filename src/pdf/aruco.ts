// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * ArUco markers of the scouting form: OpenCV predefined dictionary DICT_4X4_50
 * (4×4 data bits). The codes are copied from OpenCV's predefined_dictionaries
 * (as packaged by js-aruco2); a test checks them against js-aruco2, the
 * detector used on photos, so printing and reading share one source.
 */

/** 16-bit codes, row-major, most significant bit first; a 1 bit is a white cell. */
export const DICT_4X4_50: readonly number[] = [46386,3994,13101,39238,21662,31181,40494,50418,65242,53078,63889,4519,3767,10767,9393,9790,18021,26112,27742,30383,34443,45099,52437,56706,65095,38001,44260,42324,8483,13423,17429,22450,40655,61643,2222,2345,6261,1279,3574,7258,5912,10792,12940,14514,9448,12011,11583,19300,20526,20499];

/** Name of the same dictionary in js-aruco2 (whose first 50 codes are DICT_4X4_50). */
export const ARUCO_DICTIONARY = 'ARUCO_4X4_1000';
/** Cells per side, including the black border (4 data bits + 2). */
export const ARUCO_GRID = 6;

/**
 * The marker as a 6×6 matrix, row-major, `true` = black. The marker must be
 * printed on a white quiet zone at least one cell wide.
 */
export function arucoMatrix(id: number): boolean[][] {
  const code = DICT_4X4_50[id];
  if (code === undefined) throw new Error(`ArUco id ${id} not in DICT_4X4_50`);
  const bits = code.toString(2).padStart(16, '0');
  return Array.from({ length: ARUCO_GRID }, (_, row) =>
    Array.from({ length: ARUCO_GRID }, (_, col) => {
      const border = row === 0 || col === 0 || row === ARUCO_GRID - 1 || col === ARUCO_GRID - 1;
      return border || bits[(row - 1) * (ARUCO_GRID - 2) + (col - 1)] === '0';
    }),
  );
}
