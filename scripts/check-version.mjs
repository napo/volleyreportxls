#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

// Fails unless every manifest carries the same version and, when given, the tag matches it (vX.Y.Z).
// Usage: node scripts/check-version.mjs [tag]
import { readFileSync, existsSync } from 'node:fs';

const versions = {
  'package.json': JSON.parse(readFileSync('package.json', 'utf8')).version,
  'package-lock.json': JSON.parse(readFileSync('package-lock.json', 'utf8')).version,
  'src-tauri/tauri.conf.json': JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).version,
  'src-tauri/Cargo.toml': readFileSync('src-tauri/Cargo.toml', 'utf8').match(/^version = "(.*)"$/m)?.[1],
};
if (existsSync('src-tauri/Cargo.lock')) {
  versions['src-tauri/Cargo.lock'] = readFileSync('src-tauri/Cargo.lock', 'utf8').match(/name = "volleyreport"\nversion = "(.*)"/)?.[1];
}
const expected = versions['package.json'];
const wrong = Object.entries(versions).filter(([, v]) => v !== expected);
const tag = process.argv[2];
if (tag && tag !== `v${expected}`) wrong.push([`tag ${tag}`, tag]);
if (wrong.length) {
  console.error(`Version mismatch (package.json: ${expected}):`);
  for (const [where, v] of wrong) console.error(`  ${where}: ${v}`);
  process.exit(1);
}
console.log(`Version ${expected}${tag ? ` matches ${tag}` : ''}`);
