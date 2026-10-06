/** Font files for tests and dev scripts (Node only). */
import { readFileSync } from 'node:fs';
import type { PdfFontFiles } from './fonts';

const read = (name: string) => new Uint8Array(readFileSync(new URL(`../assets/fonts/${name}`, import.meta.url)));

export const TEST_FONTS: PdfFontFiles = {
  regular: read('Roboto-Regular.ttf'),
  bold: read('Roboto-Bold.ttf'),
  heading: read('Montserrat-ExtraBold.ttf'),
};
