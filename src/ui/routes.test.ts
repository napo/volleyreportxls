import { href, parseRoute, tabOf } from './routes';

test('hash routes with an optional parameter', () => {
  expect(parseRoute('#partita/abc123')).toEqual({ name: 'partita', param: 'abc123' });
  expect(tabOf(parseRoute('#partita/abc123'))).toBe('partite');
  expect(parseRoute('#tabellino')).toEqual({ name: 'tabellino', param: null });
  expect(tabOf(parseRoute('#modulo'))).toBe('informazioni');
  expect(parseRoute('#qualcosa')).toEqual({ name: 'partite', param: null });
  expect(parseRoute('')).toEqual({ name: 'partite', param: null });
  expect(href('grafici', 'x1')).toBe('#grafici/x1');
});
