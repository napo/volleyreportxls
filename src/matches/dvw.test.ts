// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildDvw, hasDvwData, likelySetter } from './dvw';
import { bump, bumpShirt, closeSet, setLineup, substitute } from './live';
import { type MatchRecord, newMatchRecord } from './record';

/** Touches as "number code", seven seconds apart, as the keypad enters them (number 9 is the libero). */
function scouted(...touches: string[]) {
  let record: MatchRecord = setLineup({ ...newMatchRecord(), teamName: 'Home', opponentName: 'Away', date: '2026-11-14' }, 1, { court: [1, 2, 3, 4, 5, 6], liberos: [9] });
  let at = new Date(2026, 10, 14, 18, 0, 0).getTime();
  for (const touch of touches) {
    const [n, code] = touch.split(' ');
    if (n === 'sub') {
      const [out, enter] = code!.split(':').map(Number);
      record = substitute(record, 1, { out: out!, in: enter! });
      continue;
    }
    at += 7000;
    const placed = bumpShirt(record, 1, Number(n), n === '9' ? 'libero' : 'player', code as never)!.record;
    // bumpShirt takes the time of the clock: here each touch gets its own.
    record = { ...placed, sets: placed.sets.map((s) => (s.number === 1 ? { ...s, log: s.log!.map((e, i, all) => (i === all.length - 1 ? { ...e, at } : e)) } : s)) };
  }
  return record;
}

const scout = (record: MatchRecord) => {
  const text = buildDvw(record, 0).text;
  return text.slice(text.indexOf('[3SCOUT]')).split('\r\n').slice(1).filter(Boolean).map((line) => line.split(';'));
};
/** The codes of the rallies: without the two rows of the setter at the start of the set. */
const codes = (record: MatchRecord) => scout(record).map((f) => f[0]!).filter((code) => !code.endsWith('>LUp'));

test('touches become DataVolley codes with time, video seconds and the lineup by zone', () => {
  const rows = scout(scouted('1 B+', '4 M#'));
  expect(rows.map((f) => f[0])).toEqual(['*P01>LUp', '*z1>LUp', '*01SH+', '*04BH#', '*p01:00', '**1set']);
  const block = rows[3]!;
  expect(block[7]).toBe('18.00.14');
  expect(block[8]).toBe('1');
  expect(block[12]).toBe('7');
  expect(block.slice(14, 20)).toEqual(['1', '2', '3', '4', '5', '6']);
});

test('who won a rally: a deciding touch, or how the next rally starts', () => {
  // Ace; serve and a rally won by an opponent error (same server again); lost (we receive next); side-out by an opponent error (we serve next).
  expect(codes(scouted('1 B#', '1 B+', '1 B+', '9 R+', '3 A-', '2 B+'))).toEqual([
    '*01SH#', '*p01:00',
    '*01SH+', '*p02:00',
    '*01SH+', 'ap02:01',
    '*09RH+', '*03AH-', '*p03:01',
    '*02SH+', '*p04:01',
    '**1set',
  ]);
});

test('serving after a rally we lost: the opponent missed their serve, a point of ours with no touch; the lineup turns', () => {
  const rows = scout(scouted('1 B=', '2 B+'));
  expect(rows.map((f) => f[0])).toEqual(['*P01>LUp', '*z1>LUp', '*01SH=', 'ap00:01', '*$$&H#', '*p01:01', '*02SH+', '*p02:01', '**1set']);
  expect(rows[6]!.slice(14, 20)).toEqual(['2', '3', '4', '5', '6', '1']);
  // Whoever started in zone 1 stands for the setter: now in zone 6.
  expect(rows[6]![9]).toBe('6');
});

test('a substitution is written before the rally in which whoever came in first touches the ball', () => {
  // Number 12 came in for 5 before the second rally, and attacks in it after the reception.
  const record = scouted('1 B#', '1 B=', 'sub 5:12', '9 R+', '12 A#');
  expect(codes(record)).toEqual(['*01SH#', '*p01:00', '*01SH=', 'ap01:01', '*c05:12', '*09RH+', '*12AH#', '*p02:01', '**1set']);
  expect(scout(record)[7]!.slice(14, 20)).toEqual(['1', '2', '3', '4', '12', '6']);
});

test('the rebuilt score is reported against the one written; touches without an order are counted as missing', () => {
  let record = scouted('1 B#', '1 B#');
  record = closeSet(record, 1, { team: 25, opponent: 20 }).record;
  const report = buildDvw(record, 0).sets[0]!;
  expect(report).toMatchObject({ set: 1, touches: 2, missing: 0, rebuilt: { team: 2, opponent: 0 }, written: { team: 25, opponent: 20 } });
});

test('a match read from paper has nothing to export; taking a touch back takes it out of the file', () => {
  expect(hasDvwData(newMatchRecord())).toBe(false);
  const record = scouted('1 B#', '4 A#');
  const row = record.sets[0]!.rows.find((r) => r.playerNumber === 4)!.id;
  expect(codes(bump(record, 1, row, 'A#' as never, -1)!.record)).not.toContain('*04AH#');
});

test('the setter is worked out from the touches: who does not receive and attacks the least', () => {
  // 5 and 6 receive; 3 and 4 attack; 1 serves and scores; 2 only sets up: no reception, no attack, no point.
  const record = scouted('1 B#', '1 B-', '5 R+', '3 A#', '6 R+', '4 A-', '3 A#', '5 R-', '4 A#');
  expect(likelySetter(record, [1, 2, 3, 4, 5, 6])).toBe(2);
  const rows = scout(record);
  expect(rows[0]![0]).toBe('*P02>LUp');
  expect(rows[1]![0]).toBe('*z2>LUp');
  expect(buildDvw(record, 0).sets[0]!.setter).toBe(2);
  // The setter goes out: the next one among the six on court takes over.
  const changed = scouted('5 R+', '3 A#', '6 R+', '4 A#', 'sub 1:12', '5 R+', '12 A-', '3 A#');
  expect(codes(changed)).toContain('*P02');
});
