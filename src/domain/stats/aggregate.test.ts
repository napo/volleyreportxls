// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { line, match, set, team } from '../testing';
import { calculateMatchStats, calculateOpponentErrors } from './aggregate';

const roster = team([
  [7, 'Alice'],
  [9, 'Bea'],
]);

const game = match(roster, [
  set(1, { team: 25, opponent: 20 }, [line(7, 'B# A# A= R='), line(9, 'M# P= R/ A/'), line(null, 'A#')]),
  set(2, { team: 18, opponent: 25 }, [line(7, 'A# M='), line(7, 'B=')]),
  set(3, null, []),
]);

const stats = calculateMatchStats(game);
const player = (n: number) => stats.players.find((p) => p.player.number === n)!;

describe('calculateMatchStats', () => {
  test('V-P = won − lost in serve, reception, attack and block (P= excluded)', () => {
    expect(player(7).match.summary).toMatchObject({ pointsWon: 3, pointsLost: 4, balance: -1 });
    expect(player(9).match.summary).toMatchObject({ pointsWon: 1, pointsLost: 2, balance: -1 });
    expect(player(9).match.summary.lostBySkill).toEqual({ B: 0, R: 1, A: 1, M: 0, P: 1, F: 0 });
  });

  test('player statistics include all their lines, also several in the same set', () => {
    expect(player(7).bySet[2].summary).toMatchObject({ pointsWon: 1, pointsLost: 2 });
    expect(player(7).setsPlayed).toEqual([1, 2]);
    expect(player(9).setsPlayed).toEqual([1]);
  });

  test('set faults (P=) are counted even though the scoresheet does not show them', () => {
    expect(player(9).match.setting.errors).toBe(1);
    expect(stats.team.match.setting.lost).toBe(1);
  });

  test('team statistics include lines without a player number', () => {
    expect(stats.team.match.attack.points).toBe(3);
    expect(stats.team.bySet[1].summary.pointsWon).toBe(4);
    expect(stats.issues).toContainEqual({ kind: 'missing-player-number', setNumber: 1, lineId: expect.any(String) });
  });

  test('sets without score nor lines are not reported', () => {
    expect(stats.sets.map((s) => s.setNumber)).toEqual([1, 2]);
  });

  test('opponent errors are the set points not won by serve, attack and block', () => {
    expect(stats.sets.map((s) => s.opponentErrors)).toEqual([
      { count: 21, inconsistent: false },
      { count: 17, inconsistent: false },
    ]);
    expect(stats.opponentErrors).toBe(38);
  });

  test('scoreboard', () => {
    expect(stats.scoreboard.setsWon).toEqual({ team: 1, opponent: 1 });
    expect(stats.scoreboard.sets.map((s) => s.winner)).toEqual(['team', 'opponent']);
  });
});

test('recorded points above the score are flagged instead of hidden', () => {
  expect(calculateOpponentErrors({ team: 10, opponent: 25 }, 12)).toEqual({ count: 0, inconsistent: true });
});

test('unknown players and invalid codes are reported', () => {
  const s = calculateMatchStats(match(roster, [set(1, null, [line(99, 'A# X#')])]));
  expect(s.issues.map((i) => i.kind)).toEqual(['unknown-player', 'invalid-code']);
  expect(s.team.match.attack.points).toBe(1);
});
