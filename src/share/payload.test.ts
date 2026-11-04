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
  // Four sets of twelve shirts: about 1 KB in version 1, a few hundred characters now.
  expect(encoded.length).toBeLessThan(700);
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

test('the link: the r/ page of the web app, then the report after #v/', () => {
  const url = shareUrl('https://report.volleyserve.it/', 'abc');
  expect(url).toBe('https://report.volleyserve.it/r/#v/abc');
  expect(shareUrl('https://example.org/test', 'abc')).toBe('https://example.org/test/r/#v/abc');
  expect(sharedPart(new URL(url).hash)).toBe('abc');
  expect(sharedPart('#tabellino/esempio')).toBeNull();
});

test('the content comes back as it was: sections, shirts, athletes, names, expiry to the minute', () => {
  const shared = forSharing([fullMatch(), { ...fullMatch(), opponentName: 'Brescia', date: '2026-10-12' }], [{ id: 'athlete6', label: 'Nome Cognome 7' }], true);
  const p = payload(shared.matches, { kind: 'history', title: 'Volley Trento', hidden: ['team'], athletes: shared.athletes, numbers: [] });
  const back = decodeShare(encodeShare(p));
  if (typeof back === 'string') throw new Error(back);
  expect(back).toMatchObject({ kind: 'history', title: 'Volley Trento', hidden: ['team'], athletes: [{ id: 'a000', label: 'Nome Cognome 7' }], expires: '2026-11-09T23:59:00.000Z' });
  expect(back.matches.map((m) => [m.opponentName, m.date])).toEqual([
    ['Itas', ''],
    ['Brescia', '2026-10-12'],
  ].map(([o, d]) => [o, d || shared.matches[0]!.date]));
  // In a history the name of a linked shirt travels once, with the athlete.
  expect(back.matches[0]!.players.find((p) => p.number === 7)).toEqual({ number: 7, name: '', athleteId: 'a000' });
});

test('links of version 1 (JSON) still open', () => {
  const { matches } = forSharing([fullMatch()], [], false);
  const json = { v: 1, k: 'match', e: '2026-11-09T23:59:59.000Z', t: '', h: ['sets'], m: matches, a: [], n: [7] };
  const old = btoa(String.fromCharCode(...deflateSync(strToU8(JSON.stringify(json))))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const back = decodeShare(old);
  if (typeof back === 'string') throw new Error(back);
  expect(back).toMatchObject({ kind: 'match', hidden: ['sets'], numbers: [7] });
});

test('a link cut short is not read', () => {
  const encoded = encodeShare(payload(forSharing([fullMatch()], [], true).matches));
  expect(decodeShare(encoded.slice(0, encoded.length / 2))).toBe('invalid');
});

test('a shared history shows the same as the archive: athletes, sets played, votes, team, opponent errors', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `athlete${i}`);
  // A match where an athlete sits out set 2, and a row without shirt number.
  const record = fullMatch();
  const sets = record.sets.map((s) =>
    s.number === 2 ? { ...s, rows: s.rows.filter((r) => r.playerNumber !== 7) } : s.number === 3 ? { ...s, rows: [...s.rows, { id: 'x', kind: 'player' as const, playerNumber: null, counts: { 'A#': 3 } }] } : s,
  );
  const records = [{ ...record, sets }, { ...fullMatch(), opponentName: 'Brescia' }];
  const shared = forSharing(records, ids.map((id) => ({ id, label: id })), true);
  const back = decodeShare(encodeShare(payload(shared.matches, { kind: 'history', athletes: shared.athletes })));
  if (typeof back === 'string') throw new Error(back);
  const view = (rs: readonly MatchRecord[]) =>
    rs.map((r) => {
      const s = calculateMatchStats(toMatch(r));
      return {
        team: s.team.match,
        opponentErrors: s.opponentErrors,
        sets: r.sets.filter((x) => x.score).map((x) => x.score),
        players: s.players.map((p) => ({ number: p.player.number, sets: p.setsPlayed, line: p.match, rating: p.rating.overall })),
      };
    });
  expect(view(back.matches)).toEqual(view(shared.matches));
  expect(back.matches[0]!.players.find((p) => p.number === 7)?.athleteId).toBe('a006');
});

test('counts of any size come back: half a byte below 15, then 15 plus a number', () => {
  const record = fullMatch();
  const counts = { 'B#': 14, 'R+': 15, 'A#': 16, 'M#': 200, 'P=': 1 };
  const sets = record.sets.map((s) => (s.number === 1 ? { ...s, rows: [{ ...s.rows[0]!, counts }] } : { ...s, rows: [] }));
  const { matches } = forSharing([{ ...record, sets }], [], true);
  const back = decodeShare(encodeShare(payload(matches)));
  if (typeof back === 'string') throw new Error(back);
  expect(back.matches[0]!.sets[0]!.rows[0]!.counts).toEqual(counts);
});
