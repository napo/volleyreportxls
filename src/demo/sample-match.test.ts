import { matchFromWorkbook } from '../oracle/workbook';
import { SAMPLE_MATCH } from './sample-match';

test('the demo match is the VolleyReportXLS example', () => {
  expect({ ...SAMPLE_MATCH, id: 'x' }).toEqual({ ...matchFromWorkbook(), id: 'x' });
});
