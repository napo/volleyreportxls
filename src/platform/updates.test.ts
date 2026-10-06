import { compareVersions, checkForUpdate, mobileDownload, mobilePlatform } from './updates';
import { groupDownloads } from './downloads';

const asset = (name: string) => ({ name, browser_download_url: `https://example.org/${name}` });
const release = {
  tag_name: 'v0.2.0',
  html_url: 'https://github.com/napo/volleyreportxls/releases/tag/v0.2.0',
  published_at: '2026-10-05T10:00:00Z',
  assets: [
    asset('VolleyReport_0.2.0_amd64.deb'),
    asset('VolleyReport_0.2.0_amd64.AppImage'),
    asset('VolleyReport_0.2.0_amd64.AppImage.sig'),
    asset('VolleyReport-0.2.0-1.x86_64.rpm'),
    asset('VolleyReport_0.2.0_x64-setup.exe'),
    asset('VolleyReport_0.2.0_x64_en-US.msi'),
    asset('VolleyReport_0.2.0_aarch64.dmg'),
    asset('VolleyReport_0.2.0_x64.dmg'),
    asset('VolleyReport_0.2.0_android-universal.apk'),
    asset('latest.json'),
  ],
};

test('versions compare numerically, with or without "v"', () => {
  expect(compareVersions('v0.10.0', '0.9.9')).toBe(1);
  expect(compareVersions('0.1.0', 'v0.1.0')).toBe(0);
  expect(compareVersions('0.1', '0.1.1')).toBe(-1);
});

test('platform from the user agent', () => {
  expect(mobilePlatform('Mozilla/5.0 (Linux; Android 14)')).toBe('android');
  expect(mobilePlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBeNull();
});

test('downloads grouped by platform, in order, signatures and manifests skipped', () => {
  expect(groupDownloads(release).map((g) => [g.platform, g.files.map((f) => f.label)])).toEqual([
    ['Windows', ['msi', 'exe']],
    ['macOS', ['Apple Silicon', 'Intel']],
    ['Linux', ['AppImage', 'deb', 'rpm']],
    ['Android', ['apk']],
  ]);
});

test('Android update: newer release opens the APK; same or older: nothing; web: never', async () => {
  const fetchImpl = (async () => ({ ok: true, json: async () => release })) as unknown as typeof fetch;
  expect(await checkForUpdate('0.1.0', { fetchImpl, app: true, platform: 'android' })).toEqual({
    kind: 'mobile',
    version: '0.2.0',
    url: 'https://example.org/VolleyReport_0.2.0_android-universal.apk',
  });
  expect(await checkForUpdate('0.2.0', { fetchImpl, app: true, platform: 'android' })).toBeNull();
  expect(await checkForUpdate('0.1.0', { fetchImpl, app: false, platform: 'android' })).toBeNull();
  expect(mobileDownload({ ...release, assets: [] }, 'android')).toBe(release.html_url);
});
