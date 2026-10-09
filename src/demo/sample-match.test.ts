// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { matchFromWorkbook } from '../oracle/workbook';
import { SAMPLE_MATCH } from './sample-match';

test('the demo match is the VolleyReportXLS example', () => {
  expect({ ...SAMPLE_MATCH, id: 'x' }).toEqual({ ...matchFromWorkbook(), id: 'x' });
});
