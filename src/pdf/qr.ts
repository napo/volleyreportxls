import QRCode from 'qrcode';

/** QR code modules as a square matrix, `true` = black, without quiet zone. */
export function qrMatrix(text: string): boolean[][] {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  return Array.from({ length: modules.size }, (_, row) =>
    Array.from({ length: modules.size }, (_, col) => modules.get(row, col) === 1),
  );
}
