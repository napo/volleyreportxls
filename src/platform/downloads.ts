/**
 * Download section of the "Informazioni" page: the packages of the latest GitHub release, read from
 * the GitHub API (nothing is listed by hand, so the page follows each new release by itself).
 */
import { type Release, fetchLatestRelease } from './updates';

interface Rule {
  readonly platform: string;
  /** Key of the platform note in the i18n texts. */
  readonly note: PlatformNote;
  readonly test: RegExp;
  readonly label: (name: string) => string;
}

export type PlatformNote = 'installer' | 'disk' | 'linux' | 'apk' | 'ipa';

/** Order, card text and chip labels of the platforms; the first matching rule wins. */
const RULES: readonly Rule[] = [
  { platform: 'Windows', note: 'installer', test: /\.(exe|msi)$/i, label: (n) => (/\.msi$/i.test(n) ? 'msi' : 'exe') },
  { platform: 'macOS', note: 'disk', test: /_aarch64\.dmg$/i, label: () => 'Apple Silicon' },
  { platform: 'macOS', note: 'disk', test: /_x64\.dmg$/i, label: () => 'Intel' },
  { platform: 'Linux', note: 'linux', test: /\.AppImage$/i, label: () => 'AppImage' },
  { platform: 'Linux', note: 'linux', test: /\.deb$/i, label: () => 'deb' },
  { platform: 'Linux', note: 'linux', test: /\.rpm$/i, label: () => 'rpm' },
  { platform: 'Android', note: 'apk', test: /android-universal(-debug)?\.apk$/i, label: () => 'apk' },
  // "ios" is shown with its translated name (iPhone e iPad / iPhone and iPad).
  { platform: 'ios', note: 'ipa', test: /\.ipa$/i, label: () => 'ipa' },
];

export interface DownloadGroup {
  readonly platform: string;
  /** Key of the platform note in the i18n texts. */
  readonly note: PlatformNote;
  readonly files: readonly { readonly name: string; readonly label: string; readonly url: string }[];
}

/** Assets grouped by platform in display order; signatures, manifests and the like are skipped. */
export function groupDownloads(release: Release): DownloadGroup[] {
  const groups: { platform: string; note: PlatformNote; order: number; files: { name: string; label: string; url: string; order: number }[] }[] = [];
  for (const asset of release.assets ?? []) {
    const index = RULES.findIndex((rule) => rule.test.test(asset.name));
    if (index < 0) continue;
    const rule = RULES[index]!;
    let group = groups.find((g) => g.platform === rule.platform);
    if (!group) groups.push((group = { platform: rule.platform, note: rule.note, order: index, files: [] }));
    group.files.push({ name: asset.name, label: rule.label(asset.name), url: asset.browser_download_url, order: index });
  }
  groups.sort((a, b) => a.order - b.order);
  return groups.map(({ platform, note, files }) => ({
    platform,
    note,
    files: files.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)).map(({ name, label, url }) => ({ name, label, url })),
  }));
}

export interface LatestDownloads {
  readonly version: string;
  readonly date: string | null;
  readonly groups: readonly DownloadGroup[];
}

/** The latest release and its packages, or null (offline, rate limit, no release yet). */
export async function fetchLatestDownloads(fetchImpl: typeof fetch = globalThis.fetch): Promise<LatestDownloads | null> {
  const release = await fetchLatestRelease(fetchImpl);
  if (!release) return null;
  return { version: release.tag_name.replace(/^v/i, ''), date: release.published_at ?? null, groups: groupDownloads(release) };
}
