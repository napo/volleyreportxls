/**
 * Update check of the installed apps (Tauri). Never in the web version, which is always the latest.
 * - Windows, macOS, Linux: Tauri updater (signed packages listed in latest.json of the latest GitHub
 *   release); the user confirms, the app downloads, installs and restarts.
 * - Android: the updater does not exist on mobile; the latest GitHub release is read and, if newer,
 *   the notice opens the APK download in the system browser.
 * Only the version is requested from GitHub: no match data leaves the device.
 */
import { RELEASES_API } from '../config';

const SETTING = 'volleyreport.update-checks';
const LAST_VERSION_SETTING = 'volleyreport.last-version';

export const isTauriApp = () => Boolean((globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

export function mobilePlatform(userAgent = globalThis.navigator?.userAgent ?? ''): 'android' | 'ios' | null {
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  return null;
}

/** Numeric comparison of dotted versions, "v" prefix ignored: compareVersions('v0.2.0', '0.1.9') === 1. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.replace(/^v/i, '').split(/[.-]/).map((p) => Number.parseInt(p, 10) || 0);
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0) ? 1 : -1;
  }
  return 0;
}

export interface ReleaseAsset {
  readonly name: string;
  readonly browser_download_url: string;
}

export interface Release {
  readonly tag_name: string;
  readonly html_url: string;
  readonly published_at?: string | null;
  readonly assets?: readonly ReleaseAsset[];
}

/** Android: the release APK (the debug one is signed with another key and cannot update the app). */
export function mobileDownload(release: Release, platform: 'android' | 'ios'): string {
  if (platform === 'android') {
    const apk = release.assets?.find((a) => /android-universal\.apk$/.test(a.name));
    if (apk) return apk.browser_download_url;
  }
  return release.html_url;
}

export function updateChecksEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(SETTING) !== 'off';
  } catch {
    return true;
  }
}

export function setUpdateChecksEnabled(enabled: boolean) {
  try {
    globalThis.localStorage?.setItem(SETTING, enabled ? 'on' : 'off');
  } catch {
    // not persisted: default (enabled) at the next start
  }
}

/** Version of the previous start (null the first time); stores the current one. */
export function swapLastVersion(currentVersion: string): string | null {
  try {
    const previous = globalThis.localStorage?.getItem(LAST_VERSION_SETTING) ?? null;
    globalThis.localStorage?.setItem(LAST_VERSION_SETTING, currentVersion);
    return previous;
  } catch {
    return null;
  }
}

export async function fetchLatestRelease(fetchImpl: typeof fetch = globalThis.fetch): Promise<Release | null> {
  const response = await fetchImpl(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
  return response.ok ? ((await response.json()) as Release) : null;
}

type DesktopUpdate = Awaited<ReturnType<typeof import('@tauri-apps/plugin-updater').check>>;

export type UpdateInfo =
  | { readonly kind: 'desktop'; readonly version: string; readonly update: NonNullable<DesktopUpdate> }
  | { readonly kind: 'mobile'; readonly version: string; readonly url: string };

/** A newer version, or null (none, web version, offline). */
export async function checkForUpdate(
  currentVersion: string,
  { fetchImpl = globalThis.fetch, app = isTauriApp(), platform = mobilePlatform() } = {},
): Promise<UpdateInfo | null> {
  if (!app) return null;
  if (!platform) {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    return update ? { kind: 'desktop', version: update.version, update } : null;
  }
  const release = await fetchLatestRelease(fetchImpl);
  if (!release || compareVersions(release.tag_name, currentVersion) <= 0) return null;
  return { kind: 'mobile', version: release.tag_name.replace(/^v/i, ''), url: mobileDownload(release, platform) };
}

/** Desktop: download, install (the user already confirmed) and restart. onProgress(0..1, or null if unknown). */
export async function installUpdate(info: Extract<UpdateInfo, { kind: 'desktop' }>, onProgress: (p: number | null) => void) {
  let total = 0;
  let received = 0;
  await info.update.downloadAndInstall((event) => {
    if (event.event === 'Started') total = event.data.contentLength ?? 0;
    if (event.event === 'Progress') {
      received += event.data.chunkLength;
      onProgress(total ? received / total : null);
    }
    if (event.event === 'Finished') onProgress(1);
  });
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}

/** Installed apps: open a URL in the system browser. */
export async function openInSystemBrowser(url: string) {
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(url);
}
