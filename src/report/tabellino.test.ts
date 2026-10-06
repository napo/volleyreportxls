import { calculateMatchStats } from '../domain';
import { line, match, set, team } from '../domain/testing';
import { formatBracketedPercent, formatCount, formatPercent, formatRating, formatSigned, playerLabel } from './format';
import { buildSetTabellino, buildTabellino } from './tabellino';

const game = match(team([[7, 'Alice'], [9, 'Bea']]), [
  set(1, { team: 25, opponent: 23 }, [line(7, 'B# A# A= R= R#'), line(9, 'B= B= A# A# A/ M= M#')]),
]);
const tabellino = buildTabellino(game, calculateMatchStats(game));

test('one row per roster player, rates null when the skill was not performed', () => {
  const bea = tabellino.players[1]!;
  expect(bea.player.name).toBe('Bea');
  expect(bea.setsPlayed).toEqual([1]);
  expect(bea.reception).toEqual({ total: 0, errors: 0, positivity: null, perfectRate: null });
  expect(bea.attack).toEqual({ total: 3, errors: 0, blocked: 1, points: 2, pointRate: 2 / 3 });
  expect(bea.points).toEqual({ total: 3, balance: 3 - 4 });
  expect(bea.rating).not.toBeNull();
});

test('totals, set rows and points breakdown', () => {
  expect(tabellino.totals.points).toEqual({ total: 5, balance: 5 - 6 });
  expect(tabellino.sets[0]!.pointsWon).toEqual({ serve: 1, attack: 3, block: 1, opponentErrors: 20 });
  expect(tabellino.pointsBreakdown.lost).toEqual({ B: 2, R: 1, A: 2, M: 1, P: 0, F: 0 });
});

test('DataVolley display conventions', () => {
  expect([formatCount(0), formatCount(null), formatCount(3)]).toEqual(['.', '.', '3']);
  expect([formatPercent(null), formatPercent(0), formatPercent(2 / 3)]).toEqual(['.', '0%', '67%']);
  expect(formatBracketedPercent(0.23)).toBe('(23%)');
  expect([formatSigned(9), formatSigned(-3), formatSigned(0)]).toEqual(['+9', '-3', '.']);
  expect([formatRating(6.25), formatRating(null)]).toEqual(['6.3', '.']);
});

test('the name column is shown only when at least one player has a name', () => {
  const unnamed = match(team([[7, ''], [9, ' ']]), [set(1, { team: 25, opponent: 20 }, [line(7, 'A#')])]);
  expect(buildTabellino(unnamed, calculateMatchStats(unnamed)).showNames).toBe(false);
  expect(tabellino.showNames).toBe(true);
  expect([playerLabel({ number: 7, name: 'Alice' }), playerLabel({ number: 7, name: '  ' })]).toEqual(['7 Alice', '7']);
});

test('the scoresheet of one set keeps the match result and only that set\'s statistics', () => {
  const two = match(team([[7, 'Alice'], [9, 'Bea']]), [
    set(1, { team: 25, opponent: 23 }, [line(7, 'B# A#'), line(9, 'A=')]),
    set(2, { team: 20, opponent: 25 }, [line(7, 'A# A# A=')]),
  ]);
  const whole = buildTabellino(two, calculateMatchStats(two));
  const second = buildSetTabellino(two, whole, 2);
  expect(whole.set).toBeNull();
  expect(second.set).toBe(2);
  expect(second.setsWon).toEqual({ team: 1, opponent: 1 });
  expect(second.setScores).toEqual(whole.setScores);
  expect(second.players.map((p) => p.player.number)).toEqual([7]);
  expect(second.totals.attack).toMatchObject({ total: 3, points: 2, errors: 1 });
  expect(second.sets.map((s) => s.setNumber)).toEqual([2]);
  expect(second.opponentErrors).toBe(20 - 2);
});
