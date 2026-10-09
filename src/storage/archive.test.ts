// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import 'fake-indexeddb/auto';
import { newMatchRecord } from '../matches/record';
import { Archive, withKnownNames } from './archive';

let n = 0;
const open = () => Archive.open(`test-${n++}`);

test('matches are saved, listed newest first, reloaded and deleted', async () => {
  const archive = await open();
  const a = await archive.saveMatch({ ...newMatchRecord(), teamName: 'A' });
  await new Promise((r) => setTimeout(r, 5));
  const b = await archive.saveMatch({ ...newMatchRecord(), teamName: 'B' });
  expect((await archive.listMatches()).map((m) => m.teamName)).toEqual(['B', 'A']);
  expect(await archive.getMatch(a.id)).toEqual(a);
  await archive.deleteMatch(b.id);
  expect((await archive.listMatches()).map((m) => m.id)).toEqual([a.id]);
  archive.close();
});

test('names are remembered per team and competition, and offered to a new match', async () => {
  const archive = await open();
  await archive.saveMatch({
    ...newMatchRecord(),
    teamName: 'Volley Trento',
    competition: 'Serie D',
    players: [{ number: 7, name: 'Alice' }, { number: 9, name: '' }],
  });
  expect(await archive.knownPlayers('volley trento', 'serie d')).toEqual([{ number: 7, name: 'Alice' }]);
  expect(await archive.knownPlayers('Volley Trento', 'Under 18')).toEqual([]);

  const next = { ...newMatchRecord(), teamName: 'Volley Trento', competition: 'Serie D', players: [{ number: 9, name: 'Bea' }] };
  const filled = withKnownNames(next, await archive.knownPlayers(next.teamName, next.competition), [7, 9, 12]);
  expect(filled.players).toEqual([
    { number: 7, name: 'Alice' },
    { number: 9, name: 'Bea' },
    { number: 12, name: '' },
  ]);
  archive.close();
});

test('imported matches never overwrite: same data is skipped, different data becomes a copy', async () => {
  const archive = await open();
  const saved = await archive.saveMatch({ ...newMatchRecord(), teamName: 'A' });
  const fresh = { ...newMatchRecord(), teamName: 'B' };
  const result = await archive.importMatches([saved, { ...saved, teamName: 'A modificata' }, fresh]);
  expect(result).toEqual({ added: 1, copies: 1, unchanged: 1 });
  expect((await archive.listMatches()).map((m) => m.teamName).sort()).toEqual(['A', 'A modificata', 'B']);
  expect((await archive.getMatch(saved.id))!.teamName).toBe('A');
  archive.close();
});

test('links are remembered by the team, and deleting an athlete unlinks it everywhere', async () => {
  const archive = await open();
  const match = await archive.saveMatch({ ...newMatchRecord(), teamName: 'Trento', competition: 'U18', players: [{ number: 7, name: '' }] });
  await archive.saveAthlete({ id: 'giulia', name: 'Giulia Rossi', note: '' });
  await archive.saveLink([{ ...match, players: [{ number: 7, name: 'Giulia Rossi', athleteId: 'giulia' }] }], 'Trento', 'U18', 7, 'giulia');
  expect(await archive.knownPlayers('Trento', 'U18')).toEqual([{ number: 7, name: 'Giulia Rossi', athleteId: 'giulia' }]);
  const next = withKnownNames({ ...newMatchRecord(), teamName: 'Trento', competition: 'U18' }, await archive.knownPlayers('Trento', 'U18'), [7]);
  expect(next.players).toEqual([{ number: 7, name: 'Giulia Rossi', athleteId: 'giulia' }]);

  await archive.deleteAthlete('giulia');
  expect(await archive.listAthletes()).toEqual([]);
  expect((await archive.getMatch(match.id))!.players).toEqual([{ number: 7, name: 'Giulia Rossi' }]);
  expect(await archive.knownPlayers('Trento', 'U18')).toEqual([{ number: 7, name: 'Giulia Rossi' }]);
  archive.close();
});

test('an archive of version 1 is upgraded keeping its matches', async () => {
  const { openDB } = await import('idb');
  const name = `test-${n++}`;
  const old = await openDB(name, 1, {
    upgrade(db) {
      db.createObjectStore('matches', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
      db.createObjectStore('teams', { keyPath: 'key' });
    },
  });
  await old.put('matches', { ...newMatchRecord(), id: 'old1' });
  old.close();
  const archive = await Archive.open(name);
  expect((await archive.listMatches()).map((m) => m.id)).toEqual(['old1']);
  expect(await archive.listAthletes()).toEqual([]);
  expect(await archive.listSquads()).toEqual([]);
  archive.close();
});

test('imported squads never take a name already joined', async () => {
  const archive = await open();
  await archive.saveSquads([{ id: 'sq01', name: 'Trento', teamNames: ['Trento', 'Itas Trentino'] }]);
  await archive.importSquads([
    { id: 'sq02', name: 'Altro', teamNames: ['itas trentino', 'Altro'] },
    { id: 'sq03', name: 'Rovereto', teamNames: ['Rovereto', 'Lagaris Rovereto'] },
  ]);
  expect((await archive.listSquads()).map((s) => s.id).sort()).toEqual(['sq01', 'sq03']);
  archive.close();
});
