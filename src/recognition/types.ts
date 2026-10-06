/**
 * Contract between the scanned-sheet pipeline and the symbol recognizer
 * (Milestones 7–8). Any model — or a manual-entry stub — can sit behind it.
 */

import type { ScoutCodeString } from '../domain/codes';

/** Pixels of one cell, independent from the browser's ImageData so it also runs in workers and tests. */
export interface CellImage {
  readonly width: number;
  readonly height: number;
  /** Grayscale, one byte per pixel, row-major. */
  readonly pixels: Uint8ClampedArray;
}

export interface RecognitionCandidate {
  /** null stands for "blank cell". */
  readonly value: ScoutCodeString | null;
  /** Probability in [0, 1]. */
  readonly confidence: number;
}

export interface RecognitionResult extends RecognitionCandidate {
  /** Best alternatives, most likely first, offered in the review screen. */
  readonly alternatives: readonly RecognitionCandidate[];
}

export interface SymbolRecognizer {
  recognize(image: CellImage): Promise<RecognitionResult>;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceThresholds {
  /** At or above: accepted automatically. */
  readonly high: number;
  /** At or above (and below high): highlighted. Below: the user must confirm. */
  readonly medium: number;
}

/** Initial values, to be calibrated on real sheets (see the roadmap). */
export const DEFAULT_THRESHOLDS: ConfidenceThresholds = { high: 0.97, medium: 0.8 };

export function confidenceLevel(confidence: number, thresholds: ConfidenceThresholds = DEFAULT_THRESHOLDS): ConfidenceLevel {
  if (confidence >= thresholds.high) return 'high';
  if (confidence >= thresholds.medium) return 'medium';
  return 'low';
}
