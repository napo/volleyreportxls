// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ExtractedEvents, extractEvents } from '../events';
import { type Match, type Player, type ScoutEvent, type SetNumber, type SetScore, SET_NUMBERS } from '../model';
import { type EvaluationTables, DATAVOLLEY_TABLES } from '../tables';
import { filterEvents } from './counts';
import { type PlayerRating, type RatingRules, calculatePlayerRating } from './rating';
import {
  type AttackStats,
  type BlockStats,
  type FreeBallStats,
  type ReceptionStats,
  type ServeStats,
  type SettingStats,
  calculateAttackStats,
  calculateBlockStats,
  calculateFreeBallStats,
  calculateReceptionStats,
  calculateServeStats,
  calculateSettingStats,
} from './skills';
import { type PointsSummary, calculatePointsSummary } from './summary';

export interface StatsOptions {
  /** Evaluation tables; DataVolley defaults when omitted. */
  readonly tables?: EvaluationTables;
  /** Scoresheet rating rules; DataVolley rules when omitted. */
  readonly rating?: RatingRules;
}

/** Every statistic computed for one group of events (a player or the team, in a set or in the match). */
export interface StatLine {
  readonly serve: ServeStats;
  readonly reception: ReceptionStats;
  readonly attack: AttackStats;
  readonly block: BlockStats;
  readonly setting: SettingStats;
  readonly freeBall: FreeBallStats;
  readonly summary: PointsSummary;
}

export interface PlayerStats {
  readonly player: Player;
  /** Sets in which the player has a line on the sheet. */
  readonly setsPlayed: readonly SetNumber[];
  readonly match: StatLine;
  readonly bySet: Readonly<Record<SetNumber, StatLine>>;
  readonly rating: PlayerRating;
}

export interface TeamStats {
  readonly match: StatLine;
  readonly bySet: Readonly<Record<SetNumber, StatLine>>;
}

export interface OpponentErrors {
  /**
   * "Er.Av": points of the set minus the points won in serve, attack and block
   * (DataVolley manual §9.7.1).
   */
  readonly count: number;
  /**
   * True when the recorded points exceed the team's score: the scouting or the
   * score is wrong. The workbook hides this case behind ABS().
   */
  readonly inconsistent: boolean;
}

export interface SetStats {
  readonly setNumber: SetNumber;
  readonly score: SetScore | null;
  readonly team: StatLine;
  /** Null when the score of the set is unknown. */
  readonly opponentErrors: OpponentErrors | null;
}

export type SetWinner = 'team' | 'opponent' | null;

export interface Scoreboard {
  readonly setsWon: { readonly team: number; readonly opponent: number };
  readonly sets: readonly { readonly number: SetNumber; readonly score: SetScore; readonly winner: SetWinner }[];
}

export interface MatchStats extends ExtractedEvents {
  readonly team: TeamStats;
  readonly players: readonly PlayerStats[];
  readonly sets: readonly SetStats[];
  readonly scoreboard: Scoreboard;
  /** Sum of the opponent errors of the sets with a known score. */
  readonly opponentErrors: number;
}

export function calculateStatLine(events: readonly ScoutEvent[], tables: EvaluationTables = DATAVOLLEY_TABLES): StatLine {
  const skills = {
    serve: calculateServeStats(events, tables),
    reception: calculateReceptionStats(events, tables),
    attack: calculateAttackStats(events, tables),
    block: calculateBlockStats(events, tables),
    setting: calculateSettingStats(events, tables),
    freeBall: calculateFreeBallStats(events, tables),
  };
  const bySkill = {
    B: skills.serve,
    R: skills.reception,
    A: skills.attack,
    M: skills.block,
    P: skills.setting,
    F: skills.freeBall,
  };
  return { ...skills, summary: calculatePointsSummary(bySkill) };
}

function bySet(events: readonly ScoutEvent[], tables: EvaluationTables): Record<SetNumber, StatLine> {
  return Object.fromEntries(
    SET_NUMBERS.map((setNumber) => [setNumber, calculateStatLine(filterEvents(events, { setNumber }), tables)]),
  ) as Record<SetNumber, StatLine>;
}

/** Team statistics include every valid event, also those of lines without a known player. */
export function calculateTeamStats(events: readonly ScoutEvent[], options: StatsOptions = {}): TeamStats {
  const tables = options.tables ?? DATAVOLLEY_TABLES;
  return { match: calculateStatLine(events, tables), bySet: bySet(events, tables) };
}

export function calculatePlayerStats(
  events: readonly ScoutEvent[],
  player: Player,
  setsPlayed: readonly SetNumber[],
  team: TeamStats,
  options: StatsOptions = {},
): PlayerStats {
  const tables = options.tables ?? DATAVOLLEY_TABLES;
  const own = filterEvents(events, { playerNumber: player.number });
  const match = calculateStatLine(own, tables);
  return {
    player,
    setsPlayed,
    match,
    bySet: bySet(own, tables),
    rating: calculatePlayerRating(match, team.match, setsPlayed.length, options.rating),
  };
}

export function setsPlayedBy(match: Match, playerNumber: number): SetNumber[] {
  return match.sets.filter((set) => set.lines.some((line) => line.playerNumber === playerNumber)).map((set) => set.number);
}

export function calculateOpponentErrors(score: SetScore, pointsWon: number): OpponentErrors {
  const unattributed = score.team - pointsWon;
  return { count: Math.max(0, unattributed), inconsistent: unattributed < 0 };
}

export function calculateSetStats(
  events: readonly ScoutEvent[],
  setNumber: SetNumber,
  score: SetScore | null,
  tables: EvaluationTables = DATAVOLLEY_TABLES,
): SetStats {
  const team = calculateStatLine(filterEvents(events, { setNumber }), tables);
  return {
    setNumber,
    score,
    team,
    opponentErrors: score === null ? null : calculateOpponentErrors(score, team.summary.pointsWon),
  };
}

export function setWinner(score: SetScore): SetWinner {
  if (score.team > score.opponent) return 'team';
  if (score.opponent > score.team) return 'opponent';
  return null;
}

export function calculateScoreboard(match: Match): Scoreboard {
  const sets = match.sets.flatMap((set) =>
    set.score === null ? [] : [{ number: set.number, score: set.score, winner: setWinner(set.score) }],
  );
  return {
    setsWon: {
      team: sets.filter((s) => s.winner === 'team').length,
      opponent: sets.filter((s) => s.winner === 'opponent').length,
    },
    sets,
  };
}

/** Sets that were played: those with a score or with scouting lines. */
function playedSets(match: Match) {
  return match.sets.filter((set) => set.score !== null || set.lines.length > 0);
}

export function calculateMatchStats(match: Match, options: StatsOptions = {}): MatchStats {
  const { events, issues } = extractEvents(match);
  const sets = playedSets(match).map((set) => calculateSetStats(events, set.number, set.score, options.tables));
  const team = calculateTeamStats(events, options);
  return {
    events,
    issues,
    team,
    players: match.team.players.map((player) =>
      calculatePlayerStats(events, player, setsPlayedBy(match, player.number), team, options),
    ),
    sets,
    scoreboard: calculateScoreboard(match),
    opponentErrors: sets.reduce((sum, s) => sum + (s.opponentErrors?.count ?? 0), 0),
  };
}
