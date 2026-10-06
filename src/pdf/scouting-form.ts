/**
 * Identity of a scouting-form page, encoded in its QR code so that a photo
 * can be matched to its set and layout. The form is generic (printed before
 * the match is known), so the QR carries layout, set and page only.
 */

import type { SetNumber } from '../domain/model';

export interface FormPageId {
  readonly layoutVersion: number;
  readonly setNumber: SetNumber;
  /** Page of the set (1, or 2+ for continuation sheets). */
  readonly page: number;
}

/** Compact QR payload, e.g. `VR|4|S1|P1`. */
export function formQrPayload(id: FormPageId): string {
  return ['VR', id.layoutVersion, `S${id.setNumber}`, `P${id.page}`].join('|');
}

export function parseFormQrPayload(payload: string): FormPageId | null {
  const found = /^VR\|(\d+)\|S([1-5])\|P(\d+)$/.exec(payload.trim());
  if (!found) return null;
  return { layoutVersion: Number(found[1]), setNumber: Number(found[2]) as SetNumber, page: Number(found[3]) };
}
