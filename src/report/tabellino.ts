// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The match scoresheet ("Tabellino"), with the layout and definitions of the
 * DataVolley 4 scoresheet (manual §9.7.1), built from the domain statistics.
 *
 * This module only selects and arranges numbers; it never computes a
 * statistic itself. Rates are null when the skill was never performed.
 *
 * The tables that need the order of the touches in a rally (attack on
 * reception, counter-attack, side-out and break points) are there only for
 * the touches entered in order with the keypad of the live sheet; the paper
 * sheet does not record that order. Points per rotation are not reproduced.
 */

import type { Skill } from '../domain/codes';
import type { Match, Player, SetNumber, SetScore } from '../domain/model';
import { type PhaseStats, sumPhases } from '../domain/phases';
import { type MatchStats, type StatLine, calculateMatchStats } from '../domain/stats/aggregate';

export interface TabellinoServe {
  readonly total: number;
  readonly errors: number;
  readonly points: number;
}

export interface TabellinoReception {
  readonly total: number;
  readonly errors: number;
  /** Pos%: (# + +) / total */
  readonly positivity: number | null;
  /** Prf%: # / total */
  readonly perfectRate: number | null;
}

export interface TabellinoAttack {
  readonly total: number;
  readonly errors: number;
  /** Mur: attacks blocked */
  readonly blocked: number;
  readonly points: number;
  /** Pt%: points / total */
  readonly pointRate: number | null;
}

export interface TabellinoSkills {
  readonly serve: TabellinoServe;
  readonly reception: TabellinoReception;
  readonly attack: TabellinoAttack;
  /** Muro Pt */
  readonly blockPoints: number;
}

export interface TabellinoLine extends TabellinoSkills {
  /** Punti Tot and V-P */
  readonly points: { readonly total: number; readonly balance: number };
}

export interface TabellinoPlayerRow extends TabellinoLine {
  readonly player: Player;
  readonly setsPlayed: readonly SetNumber[];
  /** Voto; null when the player was not rated. */
  readonly rating: number | null;
}

export interface TabellinoSetRow extends TabellinoSkills {
  readonly setNumber: SetNumber;
  readonly score: SetScore | null;
  /** "Punti vinti": Bat, Att, Mur, Er.Av (null when the score is unknown). */
  readonly pointsWon: {
    readonly serve: number;
    readonly attack: number;
    readonly block: number;
    readonly opponentErrors: number | null;
  };
}

/** How the team won and lost its points (input of the "Vinti-Persi" chart). */
export interface PointsBreakdown {
  readonly won: { readonly serve: number; readonly attack: number; readonly block: number; readonly opponentErrors: number };
  /** Points lost by each skill, according to the point-effects table. */
  readonly lost: Readonly<Record<Skill, number>>;
}

export interface Tabellino {
  /** The set this scoresheet is about; null for the whole match. */
  readonly set: SetNumber | null;
  readonly competition: string;
  readonly venue: string;
  readonly date: string;
  readonly teamName: string;
  readonly opponentName: string;
  readonly setsWon: { readonly team: number; readonly opponent: number };
  readonly setScores: readonly { readonly number: SetNumber; readonly score: SetScore }[];
  readonly players: readonly TabellinoPlayerRow[];
  /** False when no player has a name: the name column is left out. */
  readonly showNames: boolean;
  readonly totals: TabellinoLine;
  readonly sets: readonly TabellinoSetRow[];
  readonly opponentErrors: number;
  readonly pointsBreakdown: PointsBreakdown;
  /** Attack on reception, counter-attack, side-outs and break points; null when no touch was entered in order. */
  readonly phases: PhaseStats | null;
}

const rate = (value: number, total: number): number | null => (total > 0 ? value : null);

function skills(s: StatLine): TabellinoSkills {
  return {
    serve: { total: s.serve.total, errors: s.serve.errors, points: s.serve.points },
    reception: {
      total: s.reception.total,
      errors: s.reception.errors,
      positivity: rate(s.reception.positivity, s.reception.total),
      perfectRate: rate(s.reception.perfectRate, s.reception.total),
    },
    attack: {
      total: s.attack.total,
      errors: s.attack.errors,
      blocked: s.attack.blocked,
      points: s.attack.points,
      pointRate: rate(s.attack.pointRate, s.attack.total),
    },
    blockPoints: s.block.points,
  };
}

export function tabellinoLine(s: StatLine): TabellinoLine {
  return { ...skills(s), points: { total: s.summary.pointsWon, balance: s.summary.balance } };
}

/** Sets of the "Set" column: only the ones played (a three-set match has no 4 and 5). */
export const playedSets = (tabellino: Tabellino): SetNumber[] => tabellino.sets.map((s) => s.setNumber);

/** A player's "Set" cell: the number of every set played by the player, a dot for the other sets of the match. */
export const setsCell = (tabellino: Tabellino, row: TabellinoPlayerRow) =>
  playedSets(tabellino).map((n) => (row.setsPlayed.includes(n) ? String(n) : '·')).join(' ');

export function buildTabellino(match: Match, stats: MatchStats): Tabellino {
  const team = stats.team.match;
  return {
    set: null,
    competition: match.competition,
    venue: match.venue,
    date: match.date,
    teamName: match.team.name,
    opponentName: match.opponentName,
    setsWon: stats.scoreboard.setsWon,
    setScores: stats.scoreboard.sets.map(({ number, score }) => ({ number, score })),
    players: stats.players.map((p) => ({
      player: p.player,
      setsPlayed: p.setsPlayed,
      rating: p.rating.overall,
      ...tabellinoLine(p.match),
    })),
    showNames: match.team.players.some((p) => p.name.trim() !== ''),
    totals: tabellinoLine(team),
    sets: stats.sets.map((set) => ({
      setNumber: set.setNumber,
      score: set.score,
      pointsWon: {
        serve: set.team.serve.points,
        attack: set.team.attack.points,
        block: set.team.block.points,
        opponentErrors: set.opponentErrors?.count ?? null,
      },
      ...skills(set.team),
    })),
    opponentErrors: stats.opponentErrors,
    pointsBreakdown: {
      won: {
        serve: team.serve.points,
        attack: team.attack.points,
        block: team.block.points,
        opponentErrors: stats.opponentErrors,
      },
      lost: team.summary.lostBySkill,
    },
    phases: sumPhases(match.sets.map((s) => s.phases)),
  };
}

/**
 * The scoresheet of one set: statistics of that set only, players who played
 * it. The result (sets won and set scores) stays the one of the whole match.
 */
export function buildSetTabellino(match: Match, whole: Tabellino, number: SetNumber): Tabellino {
  const single: Match = { ...match, sets: match.sets.filter((s) => s.number === number) };
  const t = buildTabellino(single, calculateMatchStats(single));
  return {
    ...t,
    set: number,
    setsWon: whole.setsWon,
    setScores: whole.setScores,
    players: t.players.filter((p) => p.setsPlayed.length > 0),
  };
}
