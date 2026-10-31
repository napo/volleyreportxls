// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import 'fake-indexeddb/auto';
import { newMatchRecord } from '../matches/record';
import { importVrp } from '../matches/vrp';
import { Archive } from '../storage/archive';
import type { CloudAuth } from './auth';
import { PkceAuth, type PkceEndpoints } from './auth-pkce';
import { synchronise } from './engine';
import { readSyncFile, writeSyncFile } from './file';
import { DropboxClient } from './dropbox';
import { OneDriveClient } from './onedrive';
import { EMPTY_SNAPSHOT, type Snapshot, mergeSnapshots } from './merge';
import { DEFAULT_PROVIDER, providerById } from './providers';
import { type RemoteFile, type RemoteStorage, StorageError } from './storage';

/** A service in memory: one archive file, its version increasing at every write. */
class FakeDrive implements RemoteStorage {
  file: { id: string; version: number; bytes: Uint8Array } | null = null;
  /** Called before every version check: lets a test change the file meanwhile. */
  beforeVersion: (() => void) | null = null;
  async findArchive(): Promise<RemoteFile | null> {
    return this.file && { id: this.file.id, version: String(this.file.version) };
  }
  async version(id: string) {
    this.beforeVersion?.();
    return this.file?.id === id ? String(this.file.version) : null;
  }
  async download(id: string) {
    if (this.file?.id !== id) throw new StorageError(404);
    return this.file.bytes;
  }
  async create(bytes: Uint8Array) {
    this.file = { id: 'f1', version: 1, bytes };
    return { id: 'f1', version: '1' };
  }
  async update(id: string, bytes: Uint8Array, expected: string) {
    if ((await this.version(id)) !== expected) return null;
    this.file = { id, version: this.file!.version + 1, bytes };
    return { id, version: String(this.file.version) };
  }
  async trash() {
    this.file = null;
  }
}

const auth = (token: string | null = 'token'): CloudAuth & { invalidated: number } => ({
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
const sync = (archive: Archive, drive: RemoteStorage, a: CloudAuth = auth()) => synchronise({ archive, auth: a, appVersion: '0.9.0', storage: () => drive });

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
      throw new StorageError(401);
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

describe('PKCE sign-in', () => {
  const endpoints: PkceEndpoints = { authorize: 'https://s/authorize', token: 'https://s/token', scope: 'files', storageKey: 'test.refresh' };
  const memory = (stored: Record<string, string>) => ({
    getItem: (k: string) => stored[k] ?? null,
    setItem: (k: string, v: string) => void (stored[k] = v),
    removeItem: (k: string) => void delete stored[k],
  });
  const options = (stored: Record<string, string>, fetchFn: (url: string) => Promise<Response>, over: Partial<PkceEndpoints> = {}) => ({
    endpoints: { ...endpoints, ...over },
    clientId: 'id',
    fetch: fetchFn,
    storage: memory(stored),
    redirect: async () => ({ uri: 'http://127.0.0.1:1', wait: async () => '' }),
    openBrowser: async () => {},
  });

  test('a refresh token renewed by the service replaces the old one', async () => {
    const stored = { 'test.refresh': 'old' };
    const renewed = async () => new Response(JSON.stringify({ access_token: 'a', expires_in: 3600, refresh_token: 'new' }));
    expect(await new PkceAuth(options(stored, renewed)).token(false)).toBe('a');
    expect(stored['test.refresh']).toBe('new');
  });

  test('a refresh token kept by the service stays', async () => {
    const stored = { 'test.refresh': 'old' };
    const kept = async () => new Response(JSON.stringify({ access_token: 'a', expires_in: 3600 }));
    await new PkceAuth(options(stored, kept)).token(false);
    expect(stored['test.refresh']).toBe('old');
  });

  test('signing out revokes only where the service can; the token is forgotten anyway', async () => {
    const urls: string[] = [];
    const record = async (url: string) => {
      urls.push(url);
      return new Response('{}');
    };
    const without: Record<string, string> = { 'test.refresh': 'old' };
    await new PkceAuth(options(without, record)).signOut();
    expect(urls).toEqual([]);
    expect(without).toEqual({});
    await new PkceAuth(options({ 'test.refresh': 'old' }, record, { revoke: 'https://s/revoke' })).signOut();
    expect(urls).toEqual(['https://s/revoke?token=old']);
  });
});

test('a device connected before the choice of a service stays on Google Drive', () => {
  expect(DEFAULT_PROVIDER.id).toBe('google-drive');
  expect(providerById(undefined)).toBe(DEFAULT_PROVIDER);
  expect(providerById(null)).toBe(DEFAULT_PROVIDER);
});

describe('Dropbox', () => {
  const failing = (status: number, error_summary: string) => async () => new Response(JSON.stringify({ error_summary }), { status });

  test('no file at the path means no archive', async () => {
    const client = new DropboxClient('t', failing(409, 'path/not_found/.'));
    expect(await client.findArchive()).toBeNull();
    expect(await client.version()).toBeNull();
  });

  test('an update writes only over the expected version; a conflict is not an error', async () => {
    const calls: RequestInit[] = [];
    const ok = new DropboxClient('t', async (_url, init) => {
      calls.push(init!);
      return new Response(JSON.stringify({ rev: 'r2' }));
    });
    expect(await ok.update('', new Uint8Array([1]), 'r1')).toEqual({ id: '/VolleyReport.vrp', version: 'r2' });
    const arg = JSON.parse((calls[0]!.headers as Record<string, string>)['Dropbox-API-Arg']!);
    expect(arg).toMatchObject({ path: '/VolleyReport.vrp', mode: { '.tag': 'update', update: 'r1' }, strict_conflict: true });
    expect((calls[0]!.headers as Record<string, string>).Authorization).toBe('Bearer t');
    expect(await new DropboxClient('t', failing(409, 'path/conflict/file/.')).update('', new Uint8Array([1]), 'r1')).toBeNull();
  });

  test('a refused token and other refusals stay errors', async () => {
    await expect(new DropboxClient('t', failing(401, 'expired_access_token/.')).version()).rejects.toMatchObject({ status: 401 });
    await expect(new DropboxClient('t', failing(409, 'path/insufficient_space/.')).create(new Uint8Array([1]))).rejects.toMatchObject({ status: 409 });
  });
});

test('PKCE: a service revoking by access token gets it as bearer, renewed when needed', async () => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const stored: Record<string, string> = { key: 'refresh' };
  await new PkceAuth({
    endpoints: { authorize: 'https://s/a', token: 'https://s/token', revoke: 'https://s/revoke', revokeWithAccessToken: true, scope: 'x', storageKey: 'key' },
    clientId: 'id',
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ access_token: 'fresh', expires_in: 3600 }));
    },
    storage: { getItem: (k) => stored[k] ?? null, setItem: (k, v) => void (stored[k] = v), removeItem: (k) => void delete stored[k] },
    redirect: async () => ({ uri: '', wait: async () => '' }),
    openBrowser: async () => {},
  }).signOut();
  expect(calls.map((c) => c.url)).toEqual(['https://s/token', 'https://s/revoke']);
  expect((calls[1]!.init!.headers as Record<string, string>).Authorization).toBe('Bearer fresh');
  expect(stored).toEqual({});
});

describe('OneDrive', () => {
  const status = (code: number) => async () => new Response('{}', { status: code });

  test('no file at the path means no archive', async () => {
    expect(await new OneDriveClient('t', status(404)).findArchive()).toBeNull();
  });

  test('an update writes only over the expected eTag; another version is not an error', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const ok = new OneDriveClient('t', async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ eTag: 'e2' }));
    });
    expect(await ok.update('', new Uint8Array([1]), 'e1')).toEqual({ id: 'VolleyReport.vrp', version: 'e2' });
    expect(calls[0]!.url).toBe('https://graph.microsoft.com/v1.0/me/drive/special/approot:/VolleyReport.vrp:/content');
    expect(calls[0]!.init!.headers).toMatchObject({ 'If-Match': 'e1', Authorization: 'Bearer t' });
    expect(await new OneDriveClient('t', status(412)).update('', new Uint8Array([1]), 'e1')).toBeNull();
  });

  test('the download uses the address from Graph, without the token', async () => {
    const seen: (RequestInit | undefined)[] = [];
    const client = new OneDriveClient('t', async (url, init) => {
      seen.push(init);
      return url.startsWith('https://graph')
        ? new Response(JSON.stringify({ eTag: 'e', '@microsoft.graph.downloadUrl': 'https://x.1drv.com/f' }))
        : new Response(new Uint8Array([7]));
    });
    expect(await client.download()).toEqual(new Uint8Array([7]));
    expect(seen[1]).toBeUndefined();
  });

  test('a refused token stays an error; a new file never overwrites', async () => {
    await expect(new OneDriveClient('t', status(401)).version()).rejects.toMatchObject({ status: 401 });
    const urls: string[] = [];
    await new OneDriveClient('t', async (url) => {
      urls.push(url);
      return new Response(JSON.stringify({ eTag: 'e1' }));
    }).create(new Uint8Array([1]));
    expect(urls[0]).toContain('conflictBehavior=fail');
  });
});
