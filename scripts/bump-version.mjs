#!/usr/bin/env node
// Sets the app version everywhere it is stored (package.json is the source of truth).
// Usage: npm run release:version -- <patch|minor|major|X.Y.Z>
// It only edits files: commit, tag (vX.Y.Z) and push are a separate, confirmed step (docs/builds.md).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = (path) => join(root, path);
const arg = process.argv[2];
if (!arg) throw Error('usage: bump-version.mjs <patch|minor|major|X.Y.Z>');

const current = JSON.parse(readFileSync(file('package.json'), 'utf8')).version;
const [major, minor, patch] = current.split('.').map(Number);
const next =
  arg === 'major' ? `${major + 1}.0.0`
  : arg === 'minor' ? `${major}.${minor + 1}.0`
  : arg === 'patch' ? `${major}.${minor}.${patch + 1}`
  : /^\d+\.\d+\.\d+$/.test(arg) ? arg
  : null;
if (!next) throw Error(`invalid version "${arg}"`);

const updateJson = (path, update) => {
  const data = JSON.parse(readFileSync(file(path), 'utf8'));
  update(data);
  writeFileSync(file(path), `${JSON.stringify(data, null, 2)}\n`);
};
const updateText = (path, pattern, replacement) => {
  const text = readFileSync(file(path), 'utf8');
  if (!pattern.test(text)) throw Error(`version not found in ${path}`);
  writeFileSync(file(path), text.replace(pattern, replacement));
};

updateJson('package.json', (d) => { d.version = next; });
updateJson('package-lock.json', (d) => { d.version = next; d.packages[''].version = next; });
updateJson('src-tauri/tauri.conf.json', (d) => { d.version = next; });
updateText('src-tauri/Cargo.toml', /^version = ".*"$/m, `version = "${next}"`);
if (existsSync(file('src-tauri/Cargo.lock'))) {
  updateText('src-tauri/Cargo.lock', /(name = "volleyreport"\nversion = )".*"/, `$1"${next}"`);
}
console.log(`${current} -> ${next}`);
