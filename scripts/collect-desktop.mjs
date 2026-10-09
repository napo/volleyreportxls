// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

// Collects the desktop packages of one target into desktop-dist/, with the updater files: signatures
// (.sig) and the macOS update archive, whose name gets the architecture (Apple Silicon and Intel would
// otherwise collide).
// Usage: node scripts/collect-desktop.mjs <rust target>
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const target = process.argv[2];
if (!target) throw Error('usage: collect-desktop.mjs <rust target>');
const version = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).version;
const bundle = join('src-tauri/target', target, 'release/bundle');
const out = 'desktop-dist';
mkdirSync(out, { recursive: true });
const arch = target.startsWith('aarch64') ? 'aarch64' : 'x64';

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() && !name.endsWith('.app') ? walk(path) : [path];
      })
    : [];

let copied = 0;
for (const path of walk(bundle)) {
  const name = basename(path);
  let destination = null;
  if (/(\.exe|\.msi|\.dmg|\.deb|\.rpm|\.AppImage)(\.sig)?$/.test(name)) destination = name.replace(/ /g, '.');
  else if (/\.app\.tar\.gz(\.sig)?$/.test(name)) destination = `VolleyReport_${version}_${arch}.app.tar.gz${name.endsWith('.sig') ? '.sig' : ''}`;
  if (!destination) continue;
  copyFileSync(path, join(out, destination));
  console.log(`${path} -> ${out}/${destination}`);
  copied++;
}
if (!copied) throw Error(`no package found in ${bundle}`);
