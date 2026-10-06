/// <reference lib="webworker" />
/** Reads photos of sheets off the main thread, so the page stays responsive. */
import { type SheetFailure, type SheetResult, readSheetImage } from '../../image-processing/read-sheet';

export interface SheetRequest {
  readonly id: number;
  readonly width: number;
  readonly height: number;
  readonly buffer: ArrayBuffer;
}

export type SheetResponse = { readonly id: number; readonly result: SheetResult | SheetFailure } | { readonly id: number; readonly error: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<SheetRequest>) => {
  const { id, width, height, buffer } = event.data;
  try {
    const result = readSheetImage({ width, height, data: new Uint8ClampedArray(buffer) });
    const crops = result.ok
      ? [...result.rows.flatMap((r) => [r.numberCrop, ...r.cells.flatMap((c) => (c.crop ? [c.crop] : []))]), result.score.team, result.score.opponent]
      : [];
    scope.postMessage({ id, result } satisfies SheetResponse, crops.map((c) => c.data.buffer as ArrayBuffer));
  } catch (error) {
    scope.postMessage({ id, error: String(error) } satisfies SheetResponse);
  }
};
