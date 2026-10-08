import { PDFDocument } from 'pdf-lib';
import { TEST_FONTS } from './test-fonts';
import { calculateMatchStats } from '../domain';
import { matchFromWorkbook } from '../oracle/workbook';
import { buildTabellino } from '../report';
import { type ChartsPdfBlock, chartsFileName, renderChartsPdf } from './charts-pdf';

const m = matchFromWorkbook();
const tabellino = buildTabellino(m, calculateMatchStats(m));

/** 1×1 white PNG. */
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

const chart = (title: string, height = 300): ChartsPdfBlock => ({ kind: 'chart', title, image: { png: PNG, width: 800, height } });

test('charts flow onto as many A4 pages as needed', async () => {
  const blocks: ChartsPdfBlock[] = [
    { kind: 'section', title: 'Squadra' },
    { ...chart('Valutazioni per fondamentale'), figures: [['V-P', '+10'], ['Errori avversari', '13']] } as ChartsPdfBlock,
    chart('Punti vinti e persi'),
    chart('Andamento per set'),
    { kind: 'section', title: 'Singoli' },
    ...Array.from({ length: 6 }, (_, i) => chart(`Divisa ${i + 1}`, 260)),
  ];
  const pdf = await PDFDocument.load(await renderChartsPdf(tabellino, blocks, { fonts: TEST_FONTS }));
  expect(pdf.getPageCount()).toBeGreaterThan(1);
  for (const page of pdf.getPages()) expect(page.getSize().width).toBeCloseTo(595.28, 1);
  expect(pdf.getTitle()).toBe('Grafici Melodic Spikers - Rhythmic Blockers 3-0');
});

test('file name', () => {
  expect(chartsFileName(tabellino)).toBe('Grafici - Melodic Spikers - Rhythmic Blockers 3-0 (25-16, 25-18, 25-22).pdf');
});
