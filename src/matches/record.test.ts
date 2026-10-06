import { calculateMatchStats } from '../domain/stats/aggregate';
import { tallyCounts } from '../domain/tally';
import { matchFromWorkbook } from '../oracle/workbook';
import { findAnomalies } from './checks';
import { type MatchRecord, emptySet, newMatchRecord, shirtNumbers, matchWinner, setScoreIsFinal, teamKey, toMatch, withNumbersFromPreviousSet } from './record';

/** The reference match as the user would enter it in the counts table. */
function referenceRecord(): MatchRecord {
  const match = matchFromWorkbook();
  const record = newMatchRecord(new Date('2026-10-06T10:00:00Z'));
  return {
    ...record,
    teamName: match.team.name,
    opponentName: match.opponentName,
    competition: match.competition,
    date: match.date,
    venue: match.venue,
    players: match.team.players.map((p) => ({ number: p.number, name: p.name })),
    sets: record.sets.map((set) => {
      const source = match.sets.find((s) => s.number === set.number);
      if (!source) return set;
      const rows = source.lines.map((line, i) => ({
        id: `r${i}`,
        kind: match.team.players.find((p) => p.number === line.playerNumber)?.role === 'L' ? ('libero' as const) : ('player' as const),
        playerNumber: line.playerNumber,
        counts: tallyCounts(line),
      }));
      return { ...set, score: source.score, rows: [...rows, ...emptySet(set.number).rows.slice(rows.length)] };
    }),
  };
}

test('a new match has five empty sets with the rows of the paper form', () => {
  const record = newMatchRecord();
  expect(record.sets.map((s) => s.rows.map((r) => r.kind).join(','))).toEqual(
    Array(5).fill([...Array(12).fill('player'), 'libero', 'libero'].join(',')),
  );
  expect(record.id).toMatch(/^[a-z2-9]{10}$/);
  expect(toMatch(record).sets).toEqual([]);
});

test('the reference match entered in the tally table gives the same team statistics', () => {
  const record = referenceRecord();
  const original = calculateMatchStats(matchFromWorkbook());
  const entered = calculateMatchStats(toMatch(record));
  expect(entered.team).toEqual(original.team);
  expect(entered.scoreboard).toEqual(original.scoreboard);
  expect(entered.opponentErrors).toBe(original.opponentErrors);
  // Players only appear when they have a row; names come from the record.
  expect(shirtNumbers(record).length).toBeLessThanOrEqual(original.players.length);
  expect(toMatch(record).team.players.find((p) => p.number === 3)).toMatchObject({ name: 'Alessandra Amoroso', role: 'L' });
  expect(findAnomalies(record)).toEqual([]);
});

test('anomalies: missing team, score, shirt number; points above the score', () => {
  const base = newMatchRecord();
  const set1 = emptySet(1);
  const rows = set1.rows.map((r, i) => (i === 0 ? { ...r, counts: { 'A#': 3 } } : i === 1 ? { ...r, playerNumber: 7, counts: { 'A#': 30 } } : r));
  const record: MatchRecord = { ...base, sets: [{ ...set1, rows }, { ...emptySet(2), score: { team: 25, opponent: 25 } }, ...base.sets.slice(2)] };
  expect(findAnomalies(record).map((a) => a.kind)).toEqual(['missing-team', 'missing-score', 'missing-number', 'tied-score']);
  const scored: MatchRecord = { ...record, teamName: 'X', sets: [{ ...record.sets[0]!, score: { team: 25, opponent: 20 } }, ...record.sets.slice(1)] };
  expect(findAnomalies(scored)).toContainEqual({ kind: 'points-above-score', set: 1, won: 33, score: 25 });
});

test('team key ignores case, accents and spaces', () => {
  expect(teamKey('  Pallavolo  Trentò ', 'Serie D')).toBe(teamKey('pallavolo trento', 'serie d'));
});

test('an untouched set gets the shirt numbers of the nearest earlier set', () => {
  const base = newMatchRecord();
  const set1 = emptySet(1);
  const rows1 = set1.rows.map((r, i) => (i === 0 ? { ...r, playerNumber: 7, counts: { 'A#': 3 } } : i === 12 ? { ...r, playerNumber: 3 } : r));
  const record: MatchRecord = { ...base, sets: [{ ...set1, rows: rows1 }, ...base.sets.slice(1)] };

  const filled = withNumbersFromPreviousSet(record, 3);
  const rows3 = filled.sets[2]!.rows;
  expect(rows3.map((r) => [r.kind, r.playerNumber])).toEqual(rows1.map((r) => [r.kind, r.playerNumber]));
  expect(rows3.every((r) => Object.keys(r.counts).length === 0)).toBe(true);
  expect(new Set(rows3.map((r) => r.id)).size).toBe(rows3.length);
  expect(rows3.some((r) => rows1.some((s) => s.id === r.id))).toBe(false);

  // Set 4 copies set 3, where the numbers were changed.
  const changed: MatchRecord = { ...filled, sets: filled.sets.map((s) => (s.number === 3 ? { ...s, rows: s.rows.map((r, i) => (i === 0 ? { ...r, playerNumber: 9 } : r)) } : s)) };
  expect(withNumbersFromPreviousSet(changed, 4).sets[3]!.rows[0]!.playerNumber).toBe(9);

  // Nothing to do: set 1 itself, a set already filled, a set with a score.
  expect(withNumbersFromPreviousSet(record, 1)).toBe(record);
  expect(withNumbersFromPreviousSet(filled, 3)).toBe(filled);
  const scored: MatchRecord = { ...record, sets: record.sets.map((s) => (s.number === 2 ? { ...s, score: { team: 25, opponent: 18 } } : s)) };
  expect(withNumbersFromPreviousSet(scored, 2)).toBe(scored);
  expect(withNumbersFromPreviousSet(base, 2)).toBe(base);
});

test('final set scores follow the rules (25, or 15 in the fifth set, two points of margin)', () => {
  expect(setScoreIsFinal({ team: 25, opponent: 23 }, 1)).toBe(true);
  expect(setScoreIsFinal({ team: 18, opponent: 25 }, 2)).toBe(true);
  expect(setScoreIsFinal({ team: 28, opponent: 26 }, 3)).toBe(true);
  expect(setScoreIsFinal({ team: 15, opponent: 12 }, 5)).toBe(true);
  expect(setScoreIsFinal({ team: 25, opponent: 0 }, 1)).toBe(true);
  // Still being typed or not over.
  expect(setScoreIsFinal({ team: 2, opponent: 0 }, 1)).toBe(false);
  expect(setScoreIsFinal({ team: 25, opponent: 24 }, 1)).toBe(false);
  expect(setScoreIsFinal({ team: 28, opponent: 25 }, 1)).toBe(false);
  expect(setScoreIsFinal({ team: 15, opponent: 12 }, 1)).toBe(false);
});

test('the match is over when a side wins three sets', () => {
  const base = newMatchRecord();
  const scored = (...scores: [number, number][]): MatchRecord => ({
    ...base,
    sets: base.sets.map((s, i) => (scores[i] ? { ...s, score: { team: scores[i]![0], opponent: scores[i]![1] } } : s)),
  });
  expect(matchWinner(scored([25, 20], [25, 18]))).toBeNull();
  expect(matchWinner(scored([25, 20], [25, 18], [25, 23]))).toBe('team');
  expect(matchWinner(scored([25, 20], [18, 25], [23, 25], [20, 25]))).toBe('opponent');
  expect(matchWinner(scored([25, 20], [18, 25], [25, 23], [20, 25], [15, 13]))).toBe('team');
  // The third set is still being typed: 25-2 is not a final score.
  expect(matchWinner(scored([25, 20], [25, 18], [2, 0]))).toBeNull();
});
