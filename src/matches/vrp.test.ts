// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { strToU8, zipSync } from 'fflate';
import { emptySet, newMatchRecord, type MatchRecord } from './record';
import { VrpError, exportVrp, importVrp, readMatchRecord, vrpFileName } from './vrp';

function sample(): MatchRecord {
  const base = newMatchRecord(new Date('2026-10-06T10:00:00Z'));
  const set1 = emptySet(1);
  const rows = set1.rows.map((r, i) => (i === 0 ? { ...r, playerNumber: 7, counts: { 'A#': 3, 'P=': 1 } } : r));
  return { ...base, teamName: 'Trento', opponentName: 'Rovereto', players: [{ number: 7, name: 'Rossi' }], sets: [{ ...set1, rows, score: { team: 25, opponent: 20 } }, ...base.sets.slice(1)] };
}

test('export and import give back the same matches', () => {
  const a = sample();
  const b = { ...sample(), teamName: 'Altra' };
  expect(importVrp(exportVrp([a, b], '0.1.0'))).toEqual({ matches: [a, b], athletes: [], squads: [] });
});

test('the athletes linked to the players travel with the matches', () => {
  const a = { ...sample(), players: [{ number: 7, name: 'Rossi', athleteId: 'ath1' }] };
  const athletes = [
    { id: 'ath1', name: 'Giulia Rossi', note: '2010' },
    { id: 'ath2', name: 'Non in questa partita', note: '' },
  ];
  const content = importVrp(exportVrp([a], '0.1.0', new Date(), athletes));
  expect(content.matches[0]!.players).toEqual([{ number: 7, name: 'Rossi', athleteId: 'ath1' }]);
  expect(content.athletes).toEqual([athletes[0]]);
});

test('the squads of the exported teams travel with the matches', () => {
  const squads = [
    { id: 'sq01', name: 'Trento', teamNames: ['Trento', 'Itas Trentino'] },
    { id: 'sq02', name: 'Altra', teamNames: ['Altra', 'Altra Sponsor'] },
  ];
  expect(importVrp(exportVrp([sample()], '0.1.0', new Date(), [], squads)).squads).toEqual([squads[0]]);
});

test('file names', () => {
  expect(vrpFileName([sample()])).toBe('Trento - Rovereto 2026-10-06.vrp');
  expect(vrpFileName([sample(), sample()])).toBe('VolleyReport (2).vrp');
});

test('unknown codes, bad counts and extra fields are dropped', () => {
  const raw = JSON.parse(JSON.stringify(sample()));
  raw.sets[0].rows[0].counts = { 'A#': 3, 'D#': 2, 'P#': 1, 'B=': -1, 'R+': 1.5, 'X!': 4 };
  raw.evil = '<script>';
  const record = readMatchRecord(raw)!;
  expect(record.sets[0]!.rows[0]!.counts).toEqual({ 'A#': 3 });
  expect(record).not.toHaveProperty('evil');
});

test('files that are not .vrp archives are rejected', () => {
  expect(() => importVrp(strToU8('not a zip'))).toThrow(VrpError);
  expect(() => importVrp(zipSync({ 'manifest.json': strToU8('{"format":"other"}') }))).toThrow(VrpError);
  const future = zipSync({ 'manifest.json': strToU8('{"format":"volleyreport-paper","version":99}'), 'matches/x.json': strToU8('{}') });
  expect(() => importVrp(future)).toThrow(expect.objectContaining({ kind: 'newer' }));
  const broken = zipSync({ 'manifest.json': strToU8('{"format":"volleyreport-paper","version":1}'), 'matches/abcd.json': strToU8('{"id":"abcd"}') });
  expect(() => importVrp(broken)).toThrow(VrpError);
});
