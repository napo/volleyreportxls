/**
 * Photos on the device: decoding (with the camera orientation), thumbnails,
 * crops as images, and the reading done in a worker. Nothing leaves the device.
 */
import { type SheetFailure, type SheetResult, readSheetImage } from '../../image-processing/read-sheet';
import type { RgbaImage } from '../../image-processing/synthetic';
import type { SheetRequest, SheetResponse } from './sheet-worker';

/** Longer side kept from a photo: enough for ~13 px/mm on an A4 page, and light on memory. */
const MAX_SIDE = 4000;
const THUMBNAIL_SIDE = 480;

async function bitmapOf(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Older engines: an <img> applies the EXIF orientation by itself.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, context: canvas.getContext('2d', { willReadFrequently: true })! };
}

export interface DecodedPhoto {
  readonly image: RgbaImage;
  /** Small JPEG data URL to show the photo in the list. */
  readonly thumbnail: string;
}

export async function decodePhoto(file: Blob): Promise<DecodedPhoto> {
  const source = await bitmapOf(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);
  const { canvas, context } = canvasOf(width, height);
  context.drawImage(source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const t = Math.min(1, THUMBNAIL_SIDE / Math.max(width, height));
  const thumb = canvasOf(Math.round(width * t), Math.round(height * t));
  thumb.context.drawImage(canvas, 0, 0, thumb.canvas.width, thumb.canvas.height);
  if ('close' in source) source.close();
  return { image: { width, height, data: pixels.data }, thumbnail: thumb.canvas.toDataURL('image/jpeg', 0.75) };
}

/** A crop as a PNG data URL, for an <img>. */
export function imageUrl(image: RgbaImage): string {
  const { canvas, context } = canvasOf(image.width, image.height);
  context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  return canvas.toDataURL('image/png');
}

let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, { resolve: (r: SheetResult | SheetFailure) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./sheet-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<SheetResponse>) => {
      const job = pending.get(event.data.id);
      if (!job) return;
      pending.delete(event.data.id);
      if ('error' in event.data) job.reject(new Error(event.data.error));
      else job.resolve(event.data.result);
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** Reads a decoded photo; in the worker when available, otherwise here. */
export function readPhoto(image: RgbaImage): Promise<SheetResult | SheetFailure> {
  const w = getWorker();
  if (!w) return Promise.resolve(readSheetImage(image));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: SheetRequest = { id, width: image.width, height: image.height, buffer: image.data.buffer as ArrayBuffer };
    w.postMessage(request, [request.buffer]);
  });
}
