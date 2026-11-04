// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Identity of a scouting-form page, encoded in its QR code so that a photo
 * can be matched to its layout (and, up to v4, to its set). The form is
 * generic (printed before the match is known), so the QR carries layout, set
 * and page only. From v5 one sheet serves every set: the set is marked by hand
 * on the sheet and the QR has no set.
 */

import type { ScoutCodeString } from '../domain/codes';
import type { SetNumber } from '../domain/model';
import { hiddenMask, maskHidden } from './layout';

export interface FormPageId {
  readonly layoutVersion: number;
  /** Printed set (layouts up to v4); null when the set is marked on the sheet. */
  readonly setNumber: SetNumber | null;
  /** Page of the set (1, or 2+ for continuation sheets). */
  readonly page: number;
  /** v9: the "!" and "/" columns left out of the form; the geometry is rebuilt from them. */
  readonly hidden?: readonly ScoutCodeString[];
}

/**
 * Compact QR payload, e.g. `VR|4|S1|P1`, `VR|5|P1` without a printed set, or
 * `VR|9|P1|H2c` with the columns left out (hexadecimal code of OPTIONAL_FORM_CODES).
 */
export function formQrPayload(id: FormPageId): string {
  const mask = hiddenMask(id.hidden ?? []);
  return ['VR', id.layoutVersion, ...(id.setNumber === null ? [] : [`S${id.setNumber}`]), `P${id.page}`, ...(mask ? [`H${mask.toString(16)}`] : [])].join('|');
}

export function parseFormQrPayload(payload: string): FormPageId | null {
  const found = /^VR\|(\d+)(?:\|S([1-5]))?\|P(\d+)(?:\|H([0-9a-f]{1,2}))?$/.exec(payload.trim());
  if (!found) return null;
  const hidden = found[4] === undefined ? [] : maskHidden(parseInt(found[4], 16));
  return {
    layoutVersion: Number(found[1]),
    setNumber: found[2] === undefined ? null : (Number(found[2]) as SetNumber),
    page: Number(found[3]),
    ...(hidden.length && { hidden }),
  };
}
