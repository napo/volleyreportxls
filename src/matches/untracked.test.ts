// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare, forSharing } from '../share/payload';
import { OPTIONAL_CODES, newMatchRecord } from './record';
import { exportVrp, importVrp, readMatchRecord } from './vrp';

describe('columns not recorded in a match', () => {
  it('are only "!" and "/" of the skills that have them', () => {
    expect(OPTIONAL_CODES.length).toBeGreaterThan(0);
    expect(OPTIONAL_CODES.every((code) => code.endsWith('!') || code.endsWith('/'))).toBe(true);
    expect(OPTIONAL_CODES).toContain('A/');
  });

  it('are kept in a .vrp file; unknown or always-recorded codes are dropped', () => {
    const record = { ...newMatchRecord(), untracked: ['A/', 'B!'] as const };
    const back = importVrp(exportVrp([record], '0.0.0')).matches[0]!;
    expect(new Set(back.untracked)).toEqual(new Set(['A/', 'B!']));
    expect(readMatchRecord({ ...record, untracked: ['A#', 'X/', 'A/', 'A/'] })!.untracked).toEqual(['A/']);
    expect(readMatchRecord({ ...record, untracked: [] })!.untracked).toBeUndefined();
  });

  it('travel in a shared link, and a link without them still opens', () => {
    const base = { ...newMatchRecord(), teamName: 'Trento', date: '2026-11-04' };
    for (const untracked of [['R/', 'M!'], undefined] as const) {
      const record = untracked ? { ...base, untracked } : base;
      const { matches } = forSharing([record], [], false);
      const encoded = encodeShare({ kind: 'match', expires: '2099-01-01T00:00:00.000Z', title: '', hidden: [], matches, athletes: [], numbers: [] });
      const decoded = decodeShare(encoded);
      if (typeof decoded === 'string') throw new Error(decoded);
      expect(decoded.matches[0]!.untracked && new Set(decoded.matches[0]!.untracked)).toEqual(untracked && new Set(untracked));
    }
  });
});
