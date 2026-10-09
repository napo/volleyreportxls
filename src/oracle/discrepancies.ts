// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Every result cell where the reference workbook and the TypeScript logic disagree.
 *
 * Each entry is a defect of the workbook, analysed in docs/volleyreportxls-analysis.md §9
 * (the id is the one used there). The oracle test fails if a difference appears that is not
 * listed here, or if a listed one disappears or changes value: the domain logic follows the
 * intended rule, and any change of behaviour must be a deliberate update of this file.
 *
 * Generated from a run of the oracle comparison, then reviewed by hand.
 */

export interface Discrepancy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Workbook cell → [value in the workbook, value computed by the domain logic]. */
  readonly cells: Readonly<Record<string, readonly [number | string | null, number | null]>>;
}

export const DISCREPANCIES: readonly Discrepancy[] = [
  {
    id: 'W1',
    name: 'SHIFTED_RANGE',
    description:
      "Some COUNTIF ranges are shifted one column right (C:AH in the player sheets, D:AO in Squadra), so the first code of a line is not counted for those codes. Shares, totals and ratios of the same table follow.",
    cells: {
      'Squadra!D12': [35, 37], // team match B+ count
      'Squadra!B13': [0.1428571429, 0.1506849315068493], // team match B# share
      'Squadra!C13': [0.04285714286, 0.0410958904109589], // team match B/ share
      'Squadra!D13': [0.5, 0.5068493150684932], // team match B+ share
      'Squadra!E13': [0.02857142857, 0.0273972602739726], // team match B! share
      'Squadra!F13': [0.1285714286, 0.1232876712328767], // team match B- share
      'Squadra!G13': [0.1571428571, 0.1506849315068493], // team match B= share
      'Squadra!H12': [70, 73], // team match B total
    },
  },
  {
    id: 'W2',
    name: 'WRONG_DENOMINATOR',
    description:
      "Share cells whose IF() guard or denominator points to the wrong cell (e.g. IF(U5>0,Q5/U5,0) with U5 empty, IF(S2>0,…), IF($G$69>0,…)), so they show 0 or a share not summing to 1.",
    cells: {
      'Gioc A!O13': [0, 0.8], // #19 set1 B+ share
      'Gioc A!S13': [0, 0.2], // #19 set1 B= share
      'Gioc A!T13': [0, 1], // #19 set1 B share total
      'Gioc A!E28': [0, 0.25], // #19 set2 R- share
      'Gioc A!H28': [0.75, 1], // #19 set2 R share total
      'Gioc A!N35': [0, 0.2], // #19 set3 B# share
      'Gioc A!O35': [0, 0.6], // #19 set3 B+ share
      'Gioc A!S35': [0, 0.2], // #19 set3 B= share
    },
  },
  {
    id: 'W3',
    name: 'MISSING_FORMULA',
    description:
      "The share-total cell of the set 3 serve table (T35) has no formula.",
    cells: {
      'Gioc A!T35': [null, 1], // #19 set3 B share total
    },
  },
  {
    id: 'W5',
    name: 'EXCLUDED_LAST_SLOT',
    description:
      "The totals row of the Tabellino sums rows 7:19 and leaves out roster slot N (row 20, #6 in the fixture); Vinti-Persi Squadra reads those totals.",
    cells: {
      'Tabellino!G21': [53, 57], // team points
      'Tabellino!J21': [66, 73], // team serve total
      'Tabellino!K21': [10, 11], // team serve errors
      'Tabellino!N21': [49, 53], // team reception total
      'Tabellino!T21': [79, 91], // team attack total
      'Tabellino!W21': [38, 41], // team attack points
      'Vinti-Persi Squadra!B3': [53, 57], // won (attack+serve+block)
      'Vinti-Persi Squadra!B4': [38, 41], // won attack
      'Vinti-Persi Squadra!C5': [10, 11], // lost serve
    },
  },
  {
    id: 'W6',
    name: 'SET_ROW_SERVE_TOTAL',
    description:
      "In the set rows of the Tabellino the serve \"Tot\" column reads the points of the set (Squadra!K32) instead of the number of serves (Squadra!H34).",
    cells: {
      'Tabellino!J23': [21, 24], // set1 serve total
      'Tabellino!J24': [18, 24], // set2 serve total
      'Tabellino!J25': [17, 25], // set3 serve total
    },
  },
  {
    id: 'W7',
    name: 'SET_ROW_BLOCKED',
    description:
      "In the set rows of the Tabellino the attack \"Mur\" column reads the block points M# (Squadra!J27) instead of the blocked attacks A/ (Squadra!F41).",
    cells: {
      'Tabellino!V23': [2, 0], // set1 attack blocked
      'Tabellino!V24': [3, 1], // set2 attack blocked
      'Tabellino!V25': [0, 1], // set3 attack blocked
    },
  },
  {
    id: 'W11',
    name: 'WHITESPACE_IN_CODE',
    description:
      'The workbook silently drops codes containing spaces ("B #", #22 in set 2): here whitespace is ignored and the code counts as B#, as decided by the project owner.',
    cells: {
      'Squadra!B12': [10, 11], // team match B# count
      'Squadra!K10': [56, 57], // team match pointsWon
      'Squadra!B56': [4, 5], // team set2 B# count
      'Squadra!B57': [0.1739130435, 0.20833333333333334], // team set2 B# share
      'Squadra!C57': [0.4347826087, 0.4166666666666667], // team set2 B+ share
      'Squadra!E57': [0.1739130435, 0.16666666666666666], // team set2 B- share
      'Squadra!F57': [0.1304347826, 0.125], // team set2 B/ share
      'Squadra!G57': [0.08695652174, 0.08333333333333333], // team set2 B= share
      'Squadra!H56': [23, 24], // team set2 B total
      'Squadra!K54': [18, 19], // team set2 pointsWon
      'Tabellino!G15': [7, 8], // #22 points
      'Tabellino!J15': [5, 6], // #22 serve total
      'Tabellino!L15': ["-", 1], // #22 serve points
      'Tabellino!L21': [10, 11], // team serve points
      'Tabellino!E24': [4, 5], // set2 serve points won
      'Tabellino!H24': [7, 6], // set2 opponent errors
      'Tabellino!L24': [4, 5], // set2 serve points
      'Tabellino!E29': [19, 18], // opponent errors
      'Vinti-Persi Squadra!B5': [10, 11], // won serve
      'Vinti-Persi Squadra!B8': [19, 18], // won opponent errors
    },
  },
];
