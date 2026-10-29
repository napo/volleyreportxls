// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * When to synchronise, and the state shown to the user. Synchronisation runs
 * only after the user connected Drive on this device: at start, a few seconds
 * after every change, when the app comes back to the foreground, every few
 * minutes while it is open, and when the network comes back. One round at a
 * time; a change during a round asks for another one.
 */

import { VrpError } from '../matches/vrp';
import type { Archive } from '../storage/archive';
import type { GoogleAuth } from './auth';
import { DriveClient, DriveError } from './drive';
import { META, forgetSync, synchronise } from './engine';
import { createGoogleAuth, syncFetch } from './platform';

export type SyncState = 'off' | 'syncing' | 'ok' | 'paused' | 'error';

/** Why the last round failed: no network, Drive refused, or a file this version cannot read (written by a newer app). */
export type SyncProblem = 'offline' | 'drive' | 'file' | 'sign-in';

export interface SyncStatus {
  readonly state: SyncState;
  readonly lastSyncedAt: string | null;
  /** Matches changed on two devices in the last round: both versions kept. */
  readonly conflicts: number;
  readonly problem: SyncProblem | null;
}

const ENABLED = 'sync.enabled';
const AFTER_CHANGE_MS = 4000;
const EVERY_MS = 5 * 60_000;
/** Coming back to the app synchronises only if the last round is older than this. */
const ON_RETURN_MS = 30_000;

export class SyncController {
  private auth: GoogleAuth | null = null;
  private current: SyncStatus = { state: 'off', lastSyncedAt: null, conflicts: 0, problem: null };
  private readonly listeners = new Set<(s: SyncStatus) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  private lastAttempt = 0;
  private readonly stop: (() => void)[] = [];

  constructor(
    private readonly archive: Archive,
    private readonly appVersion: string,
  ) {}

  get status(): SyncStatus {
    return this.current;
  }

  subscribe(listener: (s: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(change: Partial<SyncStatus>) {
    this.current = { ...this.current, ...change };
    for (const listener of this.listeners) listener(this.current);
  }

  /** Resumes the synchronisation chosen on this device in an earlier session. */
  async init(): Promise<void> {
    if (!(await this.archive.getMeta<boolean>(ENABLED))) return;
    this.auth = await createGoogleAuth();
    if (!this.auth) return;
    this.set({ state: 'ok', lastSyncedAt: (await this.archive.getMeta<string>(META.lastSyncedAt)) ?? null });
    this.watch();
    this.schedule(0);
  }

  /**
   * Connects Drive: Google's sign-in, then a first synchronisation that merges
   * the archive of this device with the one already on Drive, if any.
   * Call it from the user's tap: on the web Google's window needs it.
   */
  async connect(): Promise<boolean> {
    this.auth ??= await createGoogleAuth();
    if (!this.auth) return false;
    let token: string | null = null;
    try {
      token = await this.auth.token(true);
    } catch {
      token = null;
    }
    if (!token) {
      this.set({ problem: 'sign-in' });
      return false;
    }
    await this.archive.setMeta(ENABLED, true);
    this.set({ state: 'ok', problem: null });
    this.watch();
    await this.syncNow(true);
    return true;
  }

  /** Stops the synchronisation on this device; with `deleteFromDrive` the file goes to the bin of the user's Drive. */
  async disconnect(deleteFromDrive = false): Promise<void> {
    this.unwatch();
    if (deleteFromDrive && this.auth) {
      const token = await this.auth.token(true).catch(() => null);
      const id = await this.archive.getMeta<string>(META.fileId);
      if (token && id) await new DriveClient(token, await syncFetch()).trash(id);
    }
    await this.auth?.signOut();
    this.auth = null;
    await this.archive.setMeta(ENABLED, false);
    await forgetSync(this.archive);
    this.set({ state: 'off', lastSyncedAt: null, conflicts: 0, problem: null });
  }

  /** A round now; `interactive` (a tap of the user) may show Google's sign-in again. */
  async syncNow(interactive = false): Promise<void> {
    if (!this.auth) return;
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.round(interactive).finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        this.schedule(0);
      }
    });
    return this.running;
  }

  private async round(interactive: boolean) {
    this.lastAttempt = Date.now();
    this.set({ state: 'syncing' });
    try {
      const fetchFn = await syncFetch();
      const outcome = await synchronise(
        { archive: this.archive, auth: this.auth!, appVersion: this.appVersion, drive: (token) => new DriveClient(token, fetchFn) },
        interactive,
      );
      if (!outcome.done) this.set({ state: 'paused', problem: 'sign-in' });
      else this.set({ state: 'ok', problem: null, conflicts: outcome.conflicts, lastSyncedAt: (await this.archive.getMeta<string>(META.lastSyncedAt)) ?? null });
    } catch (e) {
      const problem: SyncProblem = e instanceof VrpError ? 'file' : e instanceof DriveError ? 'drive' : 'offline';
      this.set({ state: 'error', problem });
    }
  }

  private schedule(delay: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.syncNow();
    }, delay);
  }

  private watch() {
    if (this.stop.length) return;
    const onReturn = () => {
      if (document.visibilityState === 'visible' && Date.now() - this.lastAttempt > ON_RETURN_MS) this.schedule(0);
    };
    const onOnline = () => this.schedule(0);
    const every = setInterval(() => document.visibilityState === 'visible' && this.schedule(0), EVERY_MS);
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('online', onOnline);
    this.stop.push(
      this.archive.onChange((origin) => origin === 'local' && this.schedule(AFTER_CHANGE_MS)),
      () => document.removeEventListener('visibilitychange', onReturn),
      () => window.removeEventListener('online', onOnline),
      () => clearInterval(every),
    );
  }

  private unwatch() {
    for (const stop of this.stop.splice(0)) stop();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  dispose() {
    this.unwatch();
  }
}
