// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PDFDocument } from 'pdf-lib';
import { type ReportBlock, renderReportPdf, tableBlock } from './report-pdf';
import { num } from './tabellino-pdf';
import { TEST_FONTS } from './test-fonts';

/** 1×1 white PNG. */
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);
const image = (height = 300) => ({ png: PNG, width: 800, height });

const options = {
  fonts: TEST_FONTS,
  title: 'Analisi storica · Volley Lago',
  summary: '6 partite dal 01/10/26 al 06/10/26',
  legendTitle: 'Legenda',
  legend: [{ term: 'V-P', text: 'Punti vinti meno punti persi.' }],
};

test('blocks flow onto pages; a long table goes on with its headings; the legend has a page of its own', async () => {
  const rows = Array.from({ length: 80 }, (_, i) => ({ name: `Atleta ${i + 1}`, points: i }));
  const blocks: ReportBlock[] = [
    tableBlock('Statistiche per atleta', [{ title: '', columns: [{ header: 'Atleta', width: 40, align: 'left', value: (r: (typeof rows)[number]) => r.name }, num<(typeof rows)[number]>('Pt', (r) => String(r.points))] }], rows, () => false, 'Il totale somma i tocchi.'),
    { kind: 'section', title: 'Squadra' },
    { kind: 'chart', title: 'Valutazioni', note: 'Una nota abbastanza lunga da andare a capo '.repeat(6), image: image() },
    { kind: 'grid', items: Array.from({ length: 5 }, (_, i) => ({ title: `Profilo ${i + 1}`, images: [image(330)] })) },
  ];
  const bytes = await renderReportPdf(blocks, options);
  const pdf = await PDFDocument.load(bytes);
  // 80 rows need two pages, then charts and grid, then the legend.
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(4);
  expect(pdf.getTitle()).toBe('Analisi storica · Volley Lago - 6 partite dal 01/10/26 al 06/10/26');
});

test('only the legend when no block was chosen', async () => {
  const pdf = await PDFDocument.load(await renderReportPdf([], options));
  expect(pdf.getPageCount()).toBe(1);
});
