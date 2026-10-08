import { emptySet, newMatchRecord, type MatchRecord, type PlayerRecord } from '../matches/record';
import { type Athlete, conflicts, fullestName, linkEntry, proposals, rosterEntries, sameName } from './matching';

let n = 0;
function match(teamName: string, competition: string, date: string, players: readonly PlayerRecord[]): MatchRecord {
  const set = emptySet(1);
  const rows = set.rows.map((r, i) => (i < players.length ? { ...r, playerNumber: players[i]!.number, counts: { 'A#': 1 } } : r));
  return { ...newMatchRecord(), id: `m${n++}`, teamName, competition, date, players, sets: [{ ...set, rows }, ...newMatchRecord().sets.slice(1)] };
}

test('names written in different ways', () => {
  expect(sameName('Giulia Rossi', 'rossi giulia')).toBe(true);
  expect(sameName('Giulia Rossi', 'Rossi G.')).toBe(true);
  expect(sameName('G. Rossi', 'Rossi Giulia')).toBe(true);
  expect(sameName('Ròssi Giulia', 'ROSSI giulia')).toBe(true);
  expect(sameName('Giulia Rossi', 'Giulia Bianchi')).toBe(false);
  expect(sameName('Giulia Rossi', 'Marta Rossi')).toBe(false);
  expect(sameName('Giulia', 'Giulia Rossi')).toBe(false);
  expect(sameName('Giulia', 'giulia')).toBe(true);
  expect(sameName('', '')).toBe(false);
  expect(fullestName(['Rossi G.', 'Giulia Rossi', 'Giulia'])).toBe('Giulia Rossi');
});

test('one entry per roster, number and athlete', () => {
  const records = [
    match('Trento', 'U18', '2026-10-01', [{ number: 7, name: 'Giulia Rossi' }]),
    match('trento', 'u18', '2026-10-08', [{ number: 7, name: '' }]),
    match('Trento', 'Serie C', '2026-10-05', [{ number: 12, name: 'Rossi G.' }]),
  ];
  const entries = rosterEntries(records);
  expect(entries.map((e) => [e.competition, e.number, e.names, e.matchIds.length])).toEqual([
    ['Serie C', 12, ['Rossi G.'], 1],
    ['U18', 7, ['Giulia Rossi'], 2],
  ]);
});

test('proposals: same roster, then same name, then the same new athlete, never by number alone', () => {
  const giulia: Athlete = { id: 'giulia', name: 'Giulia Rossi', note: '' };
  const records = [
    match('Trento', 'U18', '2026-10-01', [{ number: 7, name: 'Giulia Rossi', athleteId: 'giulia' }, { number: 9, name: 'Anna Neri' }]),
    match('Trento', 'U18', '2026-10-08', [{ number: 7, name: '' }, { number: 3, name: '' }]),
    match('Trento', 'Serie C', '2026-10-05', [{ number: 12, name: 'Rossi G.' }, { number: 4, name: 'Neri Anna' }, { number: 3, name: '' }]),
  ];
  const entries = rosterEntries(records);
  const p = proposals(entries, [giulia]);
  const of = (competition: string, number: number) => p.get(entries.find((e) => e.competition === competition && e.number === number && !e.athleteId)!.key);
  expect(of('U18', 7)).toEqual({ kind: 'athlete', athleteId: 'giulia', reason: 'roster' });
  expect(of('Serie C', 12)).toEqual({ kind: 'athlete', athleteId: 'giulia', reason: 'name' });
  expect(of('Serie C', 4)).toEqual({ kind: 'new' });
  expect(of('U18', 9)).toEqual({ kind: 'same-as', entryKey: entries.find((e) => e.number === 4)!.key });
  expect(of('U18', 3)).toEqual({ kind: 'new' });
  expect(of('Serie C', 3)).toEqual({ kind: 'new' });
});

test('an athlete is never proposed twice in the same match', () => {
  const records = [match('Trento', 'U18', '2026-10-01', [{ number: 7, name: 'Giulia Rossi', athleteId: 'giulia' }, { number: 8, name: 'Rossi Giulia' }])];
  const entries = rosterEntries(records);
  const other = entries.find((e) => e.number === 8)!;
  expect(conflicts(entries, other, 'giulia')).toBe(true);
  expect(proposals(entries, [{ id: 'giulia', name: 'Giulia Rossi', note: '' }]).get(other.key)).toEqual({ kind: 'new' });
});

test('linking fills empty names and unlinking keeps the name', () => {
  const records = [match('Trento', 'U18', '2026-10-01', [{ number: 7, name: '' }])];
  const entry = rosterEntries(records)[0]!;
  const [linked] = linkEntry(records, entry, { id: 'giulia', name: 'Giulia Rossi', note: '' });
  expect(linked!.players).toEqual([{ number: 7, name: 'Giulia Rossi', athleteId: 'giulia' }]);
  const [unlinked] = linkEntry([linked!], rosterEntries([linked!])[0]!, null);
  expect(unlinked!.players).toEqual([{ number: 7, name: 'Giulia Rossi' }]);
});
