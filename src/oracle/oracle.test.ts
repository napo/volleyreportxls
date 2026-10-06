/**
 * Oracle test: the TypeScript domain logic against the results stored in
 * VolleyReportXLS.xlsx (see tools/extract-oracle.py and docs/volleyreportxls-analysis.md §10).
 */

import { calculateMatchStats } from '../domain';
import { buildTabellino } from '../report';
import {
  type Comparison,
  DEFINITION_CHANGES,
  comparePlayerSheets,
  compareTabellino,
  compareTeamSheet,
  compareVintiPersi,
  sameValue,
} from './compare';
import { DISCREPANCIES } from './discrepancies';
import { matchFromWorkbook, workbook } from './workbook';

const match = matchFromWorkbook();
const stats = calculateMatchStats(match);
const tabellino = buildTabellino(match, stats);

const all = {
  'player sheet (Gioc A)': comparePlayerSheets(workbook, stats),
  'team sheet (Squadra)': compareTeamSheet(workbook, stats),
  'scoresheet (Tabellino)': compareTabellino(workbook, tabellino, stats),
  'points won/lost (Vinti-Persi Squadra)': compareVintiPersi(workbook, tabellino),
};
const comparisons = Object.values(all).flat();

const registered = new Map(
  DISCREPANCIES.flatMap((d) => Object.entries(d.cells).map(([ref, values]) => [ref, { id: d.id, values }] as const)),
);

function describe_(c: Comparison): string {
  return `${c.ref} (${c.what}): workbook ${JSON.stringify(c.workbook)}, computed ${c.computed}`;
}

/** Splits comparisons into unexpected differences and registered discrepancies that no longer hold. */
function check(list: readonly Comparison[]) {
  const unexpected: string[] = [];
  const stale: string[] = [];
  for (const c of list) {
    if (c.change) continue;
    const known = registered.get(c.ref);
    const equal = sameValue(c.workbook, c.computed);
    if (!known) {
      if (!equal) unexpected.push(describe_(c));
      continue;
    }
    const [workbookValue, computedValue] = known.values;
    const stillHolds =
      !equal && JSON.stringify(workbookValue) === JSON.stringify(c.workbook) && sameValue(computedValue, c.computed);
    if (!stillHolds) stale.push(`${known.id} ${describe_(c)}; registered ${JSON.stringify(known.values)}`);
  }
  return { unexpected, stale };
}

describe('VolleyReportXLS oracle', () => {
  test('the reference input is read without issues ("B #" counts as B#)', () => {
    expect(stats.issues).toEqual([]);
  });

  test.each(Object.entries(all))('%s matches the workbook, except for registered discrepancies', (_, list) => {
    expect(list.filter((c) => !c.change).length).toBeGreaterThan(0);
    const { unexpected, stale } = check(list);
    expect(unexpected).toEqual([]);
    expect(stale).toEqual([]);
  });

  test('every registered discrepancy refers to a compared cell', () => {
    const compared = new Set(comparisons.filter((c) => !c.change).map((c) => c.ref));
    expect([...registered.keys()].filter((ref) => !compared.has(ref))).toEqual([]);
  });

  test('the registered cells are not listed twice', () => {
    const count = DISCREPANCIES.reduce((n, d) => n + Object.keys(d.cells).length, 0);
    expect(registered.size).toBe(count);
  });

  test('cells left out because of a DataVolley definition are accounted for', () => {
    const byChange = Object.fromEntries(Object.keys(DEFINITION_CHANGES).map((id) => [id, 0]));
    for (const c of comparisons) if (c.change) byChange[c.change]! += 1;
    // Snapshot of how many workbook cells each definition change covers.
    expect(byChange).toMatchInlineSnapshot(`
      {
        "DV-EFF": 90,
        "DV-LOST": 2,
        "DV-NONE": 38,
        "DV-POS": 30,
        "DV-VP": 17,
      }
    `);
  });
});
