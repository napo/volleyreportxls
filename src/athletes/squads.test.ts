import { newMatchRecord, type MatchRecord } from '../matches/record';
import { inSquad, joinTeam, separateTeam, similarTeams, squadsOf } from './squads';

const match = (teamName: string, competition: string): MatchRecord => ({ ...newMatchRecord(), teamName, competition });

const records = [
  match('Volley Trento', 'Under 18'),
  match('volley trento', 'Under 18'),
  match('Itas Trentino', 'Serie C'),
  match('Volley Rovereto', 'Serie D'),
];

test('every name is a squad of its own until the user joins them', () => {
  const views = squadsOf(records, []);
  expect(views.map((v) => [v.name, v.matches, v.stored])).toEqual([
    ['Volley Trento', 2, false],
    ['Itas Trentino', 1, false],
    ['Volley Rovereto', 1, false],
  ]);
});

test('joining names of the same club, and separating them again', () => {
  const trento = squadsOf(records, [])[0]!;
  const { squads, id } = joinTeam([], trento, 'Itas Trentino', 'sq1');
  expect(squads).toEqual([{ id: 'sq1', name: 'Volley Trento', teamNames: ['Volley Trento', 'Itas Trentino'] }]);
  const views = squadsOf(records, squads);
  const joined = views.find((v) => v.id === id)!;
  expect(joined.matches).toBe(3);
  expect(joined.teams.map((t) => [t.name, t.competitions])).toEqual([
    ['Volley Trento', ['Under 18']],
    ['Itas Trentino', ['Serie C']],
  ]);
  expect(inSquad(joined, 'ITAS trentino')).toBe(true);
  expect(inSquad(joined, 'Volley Rovereto')).toBe(false);
  expect(separateTeam(squads, 'Itas Trentino')).toEqual([]);
});

test('similar names share a word that is not generic', () => {
  expect(similarTeams('Volley Trento', 'Trento Volley U18')).toBe(true);
  expect(similarTeams('Volley Trento', 'Volley Rovereto')).toBe(false);
  expect(similarTeams('Volley Trento', 'Itas Trentino')).toBe(false);
});
