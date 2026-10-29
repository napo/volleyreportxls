// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import 'fake-indexeddb/auto';
import { newMatchRecord } from '../matches/record';
import { importVrp } from '../matches/vrp';
import { Archive } from '../storage/archive';
import type { GoogleAuth } from './auth';
import { type DriveApi, DriveError, type DriveFile } from './drive';
import { synchronise } from './engine';
import { readSyncFile, writeSyncFile } from './file';
import { EMPTY_SNAPSHOT, type Snapshot, mergeSnapshots } from './merge';

/** Drive in memory: one archive file, its version increasing at every write. */
class FakeDrive implements DriveApi {
  file: { id: string; version: number; bytes: Uint8Array } | null = null;
  /** Called before every version check: lets a test change the file meanwhile. */
  beforeVersion: (() => void) | null = null;
  async findArchive(): Promise<DriveFile | null> {
    return this.file && { id: this.file.id, version: String(this.file.version) };
  }
  async version(id: string) {
    this.beforeVersion?.();
    return this.file?.id === id ? String(this.file.version) : null;
  }
  async download(id: string) {
    if (this.file?.id !== id) throw new DriveError(404);
    return this.file.bytes;
  }
  async create(bytes: Uint8Array) {
    this.file = { id: 'f1', version: 1, bytes };
    return { id: 'f1', version: '1' };
  }
  async update(id: string, bytes: Uint8Array) {
    this.file = { id, version: this.file!.version + 1, bytes };
    return { id, version: String(this.file.version) };
  }
}

const auth = (token: string | null = 'token'): GoogleAuth & { invalidated: number } => ({
  invalidated: 0,
  async token() {
    return token;
  },
  invalidate() {
    this.invalidated++;
  },
  async signOut() {},
});

let n = 0;
const device = () => Archive.open(`sync-${n++}`);
const tick = () => new Promise((r) => setTimeout(r, 5));
const sync = (archive: Archive, drive: DriveApi, a: GoogleAuth = auth()) => synchronise({ archive, auth: a, appVersion: '0.9.0', drive: () => drive });

test('a match created on one device reaches the other; changes and deletions follow it', async () => {
  const drive = new FakeDrive();
  const [a, b] = [await device(), await device()];
  const match = await a.saveMatch({ ...newMatchRecord(), teamName: 'Volley Trento', competition: 'Serie D', players: [{ number: 7, name: 'Alice' }] });

  expect(await sync(a, drive)).toMatchObject({ done: true, uploaded: true, received: 0 });
  expect(await sync(b, drive)).toMatchObject({ done: true, uploaded: false, received: 2 });
  expect((await b.getMatch(match.id))?.teamName).toBe('Volley Trento');
  // The names known for the team travel too.
  expect(await b.knownPlayers('Volley Trento', 'Serie D')).toEqual([{ number: 7, name: 'Alice' }]);

  await tick();
  await b.saveMatch({ ...(await b.getMatch(match.id))!, opponentName: 'Itas' });
  await sync(b, drive);
  await sync(a, drive);
  expect((await a.getMatch(match.id))?.opponentName).toBe('Itas');

  await a.deleteMatch(match.id);
  await sync(a, drive);
  await sync(b, drive);
  expect(await b.getMatch(match.id)).toBeUndefined();
  // The deletion stays: a further round does not bring the match back.
  await sync(b, drive);
  await sync(a, drive);
  expect(await a.getMatch(match.id)).toBeUndefined();
  expect(await sync(a, drive)).toMatchObject({ received: 0, uploaded: false });
});

test('the same match changed on two devices: the latest wins, the other is kept as a copy', async () => {
  const drive = new FakeDrive();
  const [a, b] = [await device(), await device()];
  const match = await a.saveMatch({ ...newMatchRecord(), teamName: 'Volley Trento' });
  await sync(a, drive);
  await sync(b, drive);

  await tick();
  await a.saveMatch({ ...match, venue: 'Trento' });
  await tick();
  await b.saveMatch({ ...match, venue: 'Rovereto' });
  await sync(a, drive);
  expect(await sync(b, drive)).toMatchObject({ conflicts: 1 });
  await sync(a, drive);
  for (const archive of [a, b]) {
    const venues = (await archive.listMatches()).map((m) => m.venue).sort();
    expect(venues).toEqual(['Rovereto', 'Trento']);
    expect((await archive.getMatch(match.id))?.venue).toBe('Rovereto');
  }
});

test('athletes and squads: changes and deletions reach the other device', async () => {
  const drive = new FakeDrive();
  const [a, b] = [await device(), await device()];
  await a.saveAthlete({ id: 'ath1', name: 'Alice', note: '' });
  await a.saveAthlete({ id: 'ath2', name: 'Bea', note: '' });
  await a.saveSquads([{ id: 'squad001', name: 'Trento', teamNames: ['Volley Trento', 'Itas Trentino'] }]);
  await sync(a, drive);
  await sync(b, drive);
  expect((await b.listAthletes()).map((x) => x.name).sort()).toEqual(['Alice', 'Bea']);
  expect((await b.listSquads()).map((s) => s.name)).toEqual(['Trento']);

  await tick();
  await b.deleteAthlete('ath2');
  await b.saveSquads([]);
  await sync(b, drive);
  await sync(a, drive);
  expect((await a.listAthletes()).map((x) => x.name)).toEqual(['Alice']);
  expect(await a.listSquads()).toEqual([]);
});

test('a change made during the synchronisation is not overwritten', async () => {
  const drive = new FakeDrive();
  const [a, b] = [await device(), await device()];
  const match = await a.saveMatch({ ...newMatchRecord(), venue: 'A' });
  await sync(a, drive);
  await sync(b, drive);
  await tick();
  await a.saveMatch({ ...match, venue: 'from A' });
  await sync(a, drive);
  // While B merges, the user edits the same match on B.
  await tick();
  const original = b.snapshot.bind(b);
  b.snapshot = async () => {
    const read = await original();
    await b.saveMatch({ ...match, venue: 'typed on B' });
    return read;
  };
  await sync(b, drive);
  b.snapshot = original;
  expect((await b.getMatch(match.id))?.venue).toBe('typed on B');
  await sync(b, drive);
  await sync(a, drive);
  expect((await a.getMatch(match.id))?.venue).toBe('typed on B');
});

test('a file changed on Drive while merging is merged again, not overwritten', async () => {
  const drive = new FakeDrive();
  const [a, b] = [await device(), await device()];
  await a.saveMatch({ ...newMatchRecord(), venue: 'A' });
  await sync(a, drive);
  const other = await b.saveMatch({ ...newMatchRecord(), venue: 'B' });
  // Another device uploads between B's download and B's upload, once.
  let once = true;
  drive.beforeVersion = () => {
    if (!once || !drive.file) return;
    once = false;
    const current = readSyncFile(drive.file.bytes);
    const extra = { ...newMatchRecord(), id: 'zzzz9999', venue: 'C', updatedAt: new Date().toISOString() };
    drive.file = { ...drive.file, version: drive.file.version + 1, bytes: writeSyncFile({ ...current, matches: [...current.matches, extra] }, '0.9.0') };
  };
  await sync(b, drive);
  drive.beforeVersion = null;
  const onDrive = readSyncFile(drive.file!.bytes).matches.map((m) => m.venue).sort();
  expect(onDrive).toEqual(['A', 'B', 'C']);
  expect((await b.getMatch(other.id))?.venue).toBe('B');
});

test('a refused token is renewed once; without a token nothing happens', async () => {
  const drive = new FakeDrive();
  const a = await device();
  const signedIn = auth();
  let refuse = true;
  const findArchive = drive.findArchive.bind(drive);
  drive.findArchive = async () => {
    if (refuse) {
      refuse = false;
      throw new DriveError(401);
    }
    return findArchive();
  };
  expect(await sync(a, drive, signedIn)).toMatchObject({ done: true });
  expect(signedIn.invalidated).toBe(1);
  expect(await sync(a, drive, auth(null))).toMatchObject({ done: false });
});

test('a file deleted from Drive by the user is written again from the device', async () => {
  const drive = new FakeDrive();
  const a = await device();
  await a.saveMatch({ ...newMatchRecord(), venue: 'A' });
  await sync(a, drive);
  drive.file = null;
  expect(await sync(a, drive)).toMatchObject({ uploaded: true });
  expect(readSyncFile(drive.file!.bytes).matches.map((m) => m.venue)).toEqual(['A']);
});

test('the file on Drive is a .vrp the user can import by hand; untrusted content is cleaned', async () => {
  const record = { ...newMatchRecord(), teamName: 'Volley Trento', updatedAt: '2026-10-29T10:00:00.000Z' };
  const snapshot: Snapshot = {
    ...EMPTY_SNAPSHOT,
    matches: [record],
    athletes: [{ id: 'ath1', name: 'Alice', note: '', updatedAt: '2026-10-29T10:00:00.000Z' }],
    deletions: [{ kind: 'match', id: 'gone1234', deletedAt: '2026-10-29T09:00:00.000Z' }],
  };
  const bytes = writeSyncFile(snapshot, '0.9.0');
  expect(importVrp(bytes).matches.map((m) => m.teamName)).toEqual(['Volley Trento']);
  const read = readSyncFile(bytes);
  expect(read.athletes[0]?.updatedAt).toBe('2026-10-29T10:00:00.000Z');
  expect(read.deletions).toEqual(snapshot.deletions);
  // An empty archive is a valid file too.
  expect(readSyncFile(writeSyncFile(EMPTY_SNAPSHOT, '0.9.0'))).toEqual(EMPTY_SNAPSHOT);
});

test('merge: one side changed wins, old deletions are forgotten', () => {
  const at = (iso: string) => ({ ...newMatchRecord(), id: 'm1', venue: iso, updatedAt: iso });
  const old = at('2026-01-01T00:00:00.000Z');
  const changed = at('2026-02-01T00:00:00.000Z');
  const base = { 'match:m1': old.updatedAt };
  const id = () => 'copy0001';
  // Changed on the remote side only, even if the local time were later: the remote wins.
  expect(mergeSnapshots({ ...EMPTY_SNAPSHOT, matches: [old] }, { ...EMPTY_SNAPSHOT, matches: [changed] }, base, id).merged.matches).toEqual([changed]);
  // Deleted on one side, unchanged on the other: deleted.
  const deleted = mergeSnapshots(
    { ...EMPTY_SNAPSHOT, deletions: [{ kind: 'match', id: 'm1', deletedAt: '2026-03-01T00:00:00.000Z' }] },
    { ...EMPTY_SNAPSHOT, matches: [old] },
    base,
    id,
    new Date('2026-03-02T00:00:00.000Z'),
  );
  expect(deleted.merged.matches).toEqual([]);
  expect(deleted.merged.deletions).toHaveLength(1);
  // Over a year later the deletion is forgotten.
  const later = mergeSnapshots(deleted.merged, deleted.merged, deleted.base, id, new Date('2027-06-01T00:00:00.000Z'));
  expect(later.merged.deletions).toEqual([]);
});
