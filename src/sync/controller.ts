// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * When to synchronise, and the state shown to the user. Synchronisation runs
 * only after the user connected a service on this device: at start, a few seconds
 * after every change, when the app comes back to the foreground, every few
 * minutes while it is open, and when the network comes back. One round at a
 * time; a change during a round asks for another one.
 */

import { VrpError } from '../matches/vrp';
import type { Archive } from '../storage/archive';
import type { CloudAuth } from './auth';
import { META, forgetSync, synchronise } from './engine';
import { syncFetch } from './platform';
import type { ProviderId, SyncProvider } from './provider';
import { DEFAULT_PROVIDER, createAuth, providerById } from './providers';
import { StorageError } from './storage';

export type SyncState = 'off' | 'syncing' | 'ok' | 'paused' | 'error';

/** Why the last round failed: no network, the service refused, or a file this version cannot read (written by a newer app). */
export type SyncProblem = 'offline' | 'storage' | 'file' | 'sign-in';

export interface SyncStatus {
  readonly state: SyncState;
  /** The service in use, or the default one while disconnected. */
  readonly provider: ProviderId;
  readonly lastSyncedAt: string | null;
  /** Matches changed on two devices in the last round: both versions kept. */
  readonly conflicts: number;
  readonly problem: SyncProblem | null;
  /** The refusal of the service as it reported it ("403 accessDenied"). */
  readonly detail: string | null;
}

const ENABLED = 'sync.enabled';
const AFTER_CHANGE_MS = 4000;
const EVERY_MS = 5 * 60_000;
/** Coming back to the app synchronises only if the last round is older than this. */
const ON_RETURN_MS = 30_000;

export class SyncController {
  private auth: CloudAuth | null = null;
  private provider: SyncProvider = DEFAULT_PROVIDER;
  private current: SyncStatus = { state: 'off', provider: DEFAULT_PROVIDER.id, lastSyncedAt: null, conflicts: 0, problem: null, detail: null };
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
    this.provider = providerById(await this.archive.getMeta<ProviderId>(META.provider));
    this.auth = await createAuth(this.provider);
    if (!this.auth) return;
    this.set({ state: 'ok', provider: this.provider.id, lastSyncedAt: (await this.archive.getMeta<string>(META.lastSyncedAt)) ?? null });
    this.watch();
    this.schedule(0);
  }

  /**
   * Connects a service: its sign-in, then a first synchronisation that merges
   * the archive of this device with the one already on the service, if any.
   * Call it from the user's tap: on the web the sign-in window needs it.
   */
  async connect(provider: SyncProvider = DEFAULT_PROVIDER): Promise<boolean> {
    if (provider.id !== this.provider.id) this.auth = null;
    this.provider = provider;
    this.auth ??= await createAuth(provider);
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
    await this.archive.setMeta(META.provider, provider.id);
    this.set({ state: 'ok', provider: provider.id, problem: null });
    this.watch();
    await this.syncNow(true);
    return true;
  }

  /** Stops the synchronisation on this device; with `deleteRemote` the file goes to the bin of the service. */
  async disconnect(deleteRemote = false): Promise<void> {
    this.unwatch();
    if (deleteRemote && this.auth) {
      const token = await this.auth.token(true).catch(() => null);
      const id = await this.archive.getMeta<string>(META.fileId);
      if (token && id) await this.provider.storage(token, await syncFetch()).trash(id);
    }
    await this.auth?.signOut();
    this.auth = null;
    this.provider = DEFAULT_PROVIDER;
    await this.archive.setMeta(ENABLED, false);
    await forgetSync(this.archive);
    this.set({ state: 'off', provider: DEFAULT_PROVIDER.id, lastSyncedAt: null, conflicts: 0, problem: null, detail: null });
  }

  /** A round now; `interactive` (a tap of the user) may show the sign-in again. */
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
        { archive: this.archive, auth: this.auth!, appVersion: this.appVersion, storage: (token) => this.provider.storage(token, fetchFn) },
        interactive,
      );
      if (!outcome.done) this.set({ state: 'paused', problem: 'sign-in' });
      else this.set({ state: 'ok', problem: null, detail: null, conflicts: outcome.conflicts, lastSyncedAt: (await this.archive.getMeta<string>(META.lastSyncedAt)) ?? null });
    } catch (e) {
      const problem: SyncProblem = e instanceof VrpError ? 'file' : e instanceof StorageError ? 'storage' : 'offline';
      this.set({ state: 'error', problem, detail: e instanceof StorageError ? `${e.status} ${e.code}`.trim() : null });
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
