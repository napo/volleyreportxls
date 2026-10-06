/**
 * Loads the VolleyReportXLS reference fixture (extracted by tools/extract-oracle.py)
 * and converts its input sheets into a domain Match. Test-only code.
 */

import type { Match, MatchSet, SetNumber } from '../domain/model';
import fixture from './volleyreportxls-oracle.json';

export interface OracleValue {
  readonly cell: string;
  readonly value: number | string | null;
}

export interface OracleSkillTable {
  readonly counts: Readonly<Record<string, OracleValue>>;
  readonly distribution?: Readonly<Record<string, OracleValue>>;
  readonly total?: OracleValue;
  readonly distributionTotal?: OracleValue;
  readonly efficiency?: OracleValue;
  readonly positivity?: OracleValue;
  readonly efficacy?: OracleValue;
}

export interface OracleBlock {
  readonly skills: Readonly<Record<string, OracleSkillTable>>;
  readonly summary: Readonly<Record<string, OracleValue>>;
}

export type OracleBlocks = Readonly<Record<'match' | `set${SetNumber}`, OracleBlock>>;

export interface WorkbookFixture {
  readonly event: {
    readonly competition: string;
    readonly date: string;
    readonly venue: string;
    readonly team: string;
    readonly opponent: string;
    readonly scores: readonly { set: number; team: number | null; opponent: number | null }[];
  };
  readonly roster: readonly { slot: string; number: number; role: string | null; name: string }[];
  readonly rilevazione: readonly { set: number; lines: readonly { row: number; playerNumber: number | null; cells: string[] }[] }[];
  readonly oracle: {
    readonly players: Readonly<Record<string, OracleBlocks & { number: number; sheet: string }>>;
    readonly team: OracleBlocks;
    readonly tabellino: { readonly cells: Readonly<Record<string, number | string | null>> };
    readonly vintiPersi: Readonly<Record<string, number | null>>;
  };
}

export const workbook = fixture as unknown as WorkbookFixture;

export function matchFromWorkbook(data: WorkbookFixture = workbook): Match {
  const { event } = data;
  const sets: MatchSet[] = data.rilevazione.map((set) => {
    const score = event.scores.find((s) => s.set === set.set);
    return {
      number: set.set as SetNumber,
      score: score && score.team !== null && score.opponent !== null ? { team: score.team, opponent: score.opponent } : null,
      lines: set.lines.map((line) => ({ id: `R${line.row}`, playerNumber: line.playerNumber, cells: line.cells })),
    };
  });
  return {
    id: 'volleyreportxls-reference',
    competition: event.competition,
    date: event.date,
    venue: event.venue,
    opponentName: event.opponent,
    team: {
      id: 'team',
      name: event.team,
      players: data.roster.map((p) => ({
        id: `slot-${p.slot}`,
        number: p.number,
        name: p.name,
        ...(p.role === 'L' ? { role: 'L' as const } : {}),
      })),
    },
    sets,
  };
}
