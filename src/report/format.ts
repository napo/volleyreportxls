// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Display conventions of the DataVolley scoresheet: a dot for zero or "not
 * applicable", whole percentages, signed balance.
 */

export const EMPTY = '.';

/** "7 Alice", or just "7" when the player has no name. */
export function playerLabel(player: { readonly number: number; readonly name: string }): string {
  const name = player.name.trim();
  return name ? `${player.number} ${name}` : String(player.number);
}

export function formatCount(value: number | null): string {
  return value === null || value === 0 ? EMPTY : String(value);
}

export function formatPercent(value: number | null): string {
  return value === null ? EMPTY : `${Math.round(value * 100)}%`;
}

/** Prf% is printed in brackets next to Pos%. */
export function formatBracketedPercent(value: number | null): string {
  return value === null ? EMPTY : `(${formatPercent(value)})`;
}

export function formatSigned(value: number): string {
  if (value === 0) return EMPTY;
  return value > 0 ? `+${value}` : String(value);
}

export function formatRating(value: number | null): string {
  return value === null ? EMPTY : value.toFixed(1);
}

/** ISO date (2023-11-18) → "18/11/23"; anything else is returned unchanged. */
export function formatDate(iso: string): string {
  const m = /^\d\d(\d{2})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/**
 * Italian date typed by hand → ISO date, or null when it is not a real date.
 * Accepts GG/MM/AA and GG/MM/AAAA, with "/", "." or "-"; two-digit years are 20xx.
 */
export function parseDate(text: string): string | null {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [, d1 = '', m1 = '', y1 = ''] = m;
  const [day, month] = [Number(d1), Number(m1)];
  const year = y1.length === 2 ? 2000 + Number(y1) : Number(y1);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
