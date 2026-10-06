/**
 * Plane-to-plane projective transform (homography) from point pairs, by
 * normalised DLT with least squares: the sheet, in millimetres, onto the photo.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Row-major 3×3 matrix. */
export type Homography = readonly [number, number, number, number, number, number, number, number, number];

export function project(h: Homography, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

/** Similarity moving the points' centroid to the origin and their mean distance to √2. */
function normaliser(points: readonly Point[]): Homography {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const d = points.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / points.length || 1;
  const k = Math.SQRT2 / d;
  return [k, 0, -k * cx, 0, k, -k * cy, 0, 0, 1];
}

function multiply(a: Homography, b: Homography): Homography {
  const m = new Array<number>(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m[r * 3 + c] = a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!;
  return m as unknown as Homography;
}

function invertSimilarity(t: Homography): Homography {
  const k = t[0];
  return [1 / k, 0, -t[2] / k, 0, 1 / k, -t[5] / k, 0, 0, 1];
}

/** Solves A·x = b (n×n) by Gaussian elimination with partial pivoting; null if singular. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r;
    if (Math.abs(a[pivot]![col]!) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    [b[col], b[pivot]] = [b[pivot]!, b[col]!];
    for (let r = col + 1; r < n; r++) {
      const f = a[r]![col]! / a[col]![col]!;
      for (let c = col; c < n; c++) a[r]![c]! -= f * a[col]![c]!;
      b[r]! -= f * b[col]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]!;
    for (let c = r + 1; c < n; c++) s -= a[r]![c]! * x[c]!;
    x[r] = s / a[r]![r]!;
  }
  return x;
}

/** The homography taking every `from` point onto its `to` point (≥ 4 pairs, least squares). */
export function solveHomography(from: readonly Point[], to: readonly Point[]): Homography | null {
  if (from.length < 4 || from.length !== to.length) return null;
  const tf = normaliser(from);
  const tt = normaliser(to);
  const ata = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const atb = new Array<number>(8).fill(0);
  const add = (row: number[], value: number) => {
    for (let i = 0; i < 8; i++) {
      atb[i]! += row[i]! * value;
      for (let j = 0; j < 8; j++) ata[i]![j]! += row[i]! * row[j]!;
    }
  };
  from.forEach((f, i) => {
    const p = project(tf, f);
    const q = project(tt, to[i]!);
    add([p.x, p.y, 1, 0, 0, 0, -q.x * p.x, -q.x * p.y], q.x);
    add([0, 0, 0, p.x, p.y, 1, -q.y * p.x, -q.y * p.y], q.y);
  });
  const h = solve(ata, atb);
  if (!h) return null;
  const normalised = [...h, 1] as unknown as Homography;
  return multiply(invertSimilarity(tt), multiply(normalised, tf));
}
