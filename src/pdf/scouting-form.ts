/**
 * Identity of a scouting-form page, encoded in its QR code so that a photo
 * can be matched to its layout (and, up to v4, to its set). The form is
 * generic (printed before the match is known), so the QR carries layout, set
 * and page only. From v5 one sheet serves every set: the set is marked by hand
 * on the sheet and the QR has no set.
 */

import type { SetNumber } from '../domain/model';

export interface FormPageId {
  readonly layoutVersion: number;
  /** Printed set (layouts up to v4); null when the set is marked on the sheet. */
  readonly setNumber: SetNumber | null;
  /** Page of the set (1, or 2+ for continuation sheets). */
  readonly page: number;
}

/** Compact QR payload, e.g. `VR|4|S1|P1`, or `VR|5|P1` without a printed set. */
export function formQrPayload(id: FormPageId): string {
  return ['VR', id.layoutVersion, ...(id.setNumber === null ? [] : [`S${id.setNumber}`]), `P${id.page}`].join('|');
}

export function parseFormQrPayload(payload: string): FormPageId | null {
  const found = /^VR\|(\d+)(?:\|S([1-5]))?\|P(\d+)$/.exec(payload.trim());
  if (!found) return null;
  return {
    layoutVersion: Number(found[1]),
    setNumber: found[2] === undefined ? null : (Number(found[2]) as SetNumber),
    page: Number(found[3]),
  };
}
