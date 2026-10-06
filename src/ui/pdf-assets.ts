/** Loads the PDF assets bundled with the app (fonts and logo); nothing is fetched from the network. */
import type { PdfFontFiles } from '../pdf/fonts';
import logoUrl from '../assets/volleyreportxls-logo.png';
import headingUrl from '../assets/fonts/Montserrat-ExtraBold.ttf?url';
import boldUrl from '../assets/fonts/Roboto-Bold.ttf?url';
import regularUrl from '../assets/fonts/Roboto-Regular.ttf?url';

const bytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());

let fonts: Promise<PdfFontFiles> | undefined;

export function loadPdfFonts(): Promise<PdfFontFiles> {
  fonts ??= Promise.all([bytes(regularUrl), bytes(boldUrl), bytes(headingUrl)]).then(([regular, bold, heading]) => ({
    regular,
    bold,
    heading,
  }));
  return fonts;
}

export function loadLogoPng(): Promise<Uint8Array> {
  return bytes(logoUrl);
}
