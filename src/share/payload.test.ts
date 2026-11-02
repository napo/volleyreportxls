// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { strToU8, deflateSync } from 'fflate';
import { type MatchRecord, emptySet, newMatchRecord } from '../matches/record';
import { calculateMatchStats } from '../domain/stats/aggregate';
import { toMatch } from '../matches/record';
import { type SharePayload, decodeShare, encodeShare, forSharing, isExpired, shareUrl, sharedPart } from './payload';

/** A full match: four sets, twelve shirts, many touches. */
function fullMatch(): MatchRecord {
  const base = newMatchRecord();
  const counts = { 'B#': 2, 'B+': 5, 'B-': 6, 'B=': 2, 'R#': 4, 'R+': 5, 'R-': 3, 'R=': 1, 'A#': 6, 'A+': 3, 'A-': 4, 'A=': 2, 'A/': 1, 'M#': 2, 'M-': 3, 'P=': 1 };
  const sets = base.sets.map((set, s) =>
    s > 3 ? set : { ...emptySet(set.number), score: { team: 25, opponent: 20 + s }, rows: emptySet(set.number).rows.map((row, i) => ({ ...row, playerNumber: i + 1, counts })) },
  );
  return {
    ...base,
    teamName: 'Volley Trento',
    opponentName: 'Itas',
    competition: 'Serie D',
    players: Array.from({ length: 14 }, (_, i) => ({ number: i + 1, name: `Nome Cognome ${i + 1}`, athleteId: `athlete${i}` })),
    sets,
  };
}

const payload = (matches: MatchRecord[], extra: Partial<SharePayload> = {}): SharePayload => ({
  kind: 'match',
  expires: '2026-11-09T23:59:59.000Z',
  title: '',
  hidden: ['sets'],
  matches,
  athletes: [],
  numbers: [7, 4],
  ...extra,
});

test('a shared match comes back with the same statistics, in a link of a couple of kilobytes', () => {
  const record = fullMatch();
  const { matches } = forSharing([record], [], true);
  const encoded = encodeShare(payload(matches));
  expect(encoded.length).toBeLessThan(2500);
  expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);

  const back = decodeShare(encoded);
  if (typeof back === 'string') throw new Error(back);
  expect(back).toMatchObject({ kind: 'match', hidden: ['sets'], numbers: [7, 4] });
  const stats = (r: MatchRecord) => calculateMatchStats(toMatch(r)).team.match;
  expect(stats(back.matches[0]!)).toEqual(stats(record));
});

test('without names: no names in the link, athletes become their shirt numbers', () => {
  const record = fullMatch();
  const shared = forSharing([record], [{ id: 'athlete6', label: 'Nome Cognome 7' }], false);
  expect(JSON.stringify(shared)).not.toContain('Nome');
  expect(shared.athletes).toEqual([{ id: 'a000', label: 'n. 7' }]);
  expect(shared.matches[0]!.players.find((p) => p.number === 7)).toEqual({ number: 7, name: '', athleteId: 'a000' });
});

test('broken, newer and expired links are recognised', () => {
  expect(decodeShare('not a link')).toBe('invalid');
  const newer = btoa(String.fromCharCode(...deflateSync(strToU8(JSON.stringify({ v: 99 }))))).replace(/=+$/, '');
  expect(decodeShare(newer)).toBe('newer');
  const p = payload(forSharing([fullMatch()], [], true).matches);
  expect(isExpired(p, new Date('2026-11-09T12:00:00Z'))).toBe(false);
  expect(isExpired(p, new Date('2026-11-10T00:00:01Z'))).toBe(true);
});

test('the link: address of the web app, then the report after #v/', () => {
  const url = shareUrl('https://report.volleyserve.it/', 'abc');
  expect(url).toBe('https://report.volleyserve.it/#v/abc');
  expect(sharedPart(new URL(url).hash)).toBe('abc');
  expect(sharedPart('#tabellino/esempio')).toBeNull();
});
