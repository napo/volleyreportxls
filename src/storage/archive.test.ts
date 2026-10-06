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
