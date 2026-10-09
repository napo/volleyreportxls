// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { calculateMatchStats } from '../domain';
import { line, match, set, team } from '../domain/testing';
import { activePlayers, evaluationShares, playerPoints, pointsBySkill, setTrend } from './chart-data';

const game = match(team([[7, 'Alice'], [9, 'Bea'], [3, 'Cleo']]), [
  set(1, { team: 25, opponent: 20 }, [line(7, 'A# A# A= R# R+ R='), line(9, 'B# B= M#')]),
  set(2, { team: 20, opponent: 25 }, [line(7, 'A/ R-')]),
]);
const stats = calculateMatchStats(game);

test('evaluation shares per skill, only for skills performed', () => {
  const rows = evaluationShares(stats.team.match);
  expect(rows.map((r) => r.skill)).toEqual(['B', 'R', 'A', 'M']);
  const attack = rows.find((r) => r.skill === 'A')!;
  expect(attack.total).toBe(4);
  expect(attack.shares['#']).toBe(0.5);
  expect(Object.values(attack.shares).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
});

test('points won and lost by skill, with opponent errors as a won-only row', () => {
  expect(pointsBySkill(stats.team.match, stats.opponentErrors)).toEqual([
    { label: 'Battuta', won: 1, lost: 1 },
    { label: 'Ricezione', won: 0, lost: 1 },
    { label: 'Attacco', won: 2, lost: 2 },
    { label: 'Muro', won: 1, lost: 0 },
    { label: 'Errori avversari', won: 21 + 20, lost: 0 },
  ]);
});

test('per-set trend, null when a skill was not performed', () => {
  expect(setTrend(stats)).toEqual([
    { set: 'Set 1', receptionPositivity: 2 / 3, attackPointRate: 2 / 3 },
    { set: 'Set 2', receptionPositivity: 0, attackPointRate: 0 },
  ]);
});

test('active players sorted by touches; player points in the requested order', () => {
  expect(activePlayers(stats).map((p) => p.player.number)).toEqual([7, 9]);
  expect(playerPoints(stats, ['p9', 'p7'])).toEqual([
    { playerId: 'p9', label: '9 Bea', won: 2, lost: 1 },
    { playerId: 'p7', label: '7 Alice', won: 2, lost: 3 },
  ]);
});
