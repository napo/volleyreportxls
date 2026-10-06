import { formatDate, parseDate } from './format';

describe('dates', () => {
  it('formats ISO dates as GG/MM/AA', () => {
    expect(formatDate('2023-11-18')).toBe('18/11/23');
    expect(formatDate('')).toBe('');
  });

  it('reads Italian dates typed by hand', () => {
    expect(parseDate('18/11/23')).toBe('2023-11-18');
    expect(parseDate('6.10.2026')).toBe('2026-10-06');
    expect(parseDate('06-10-26')).toBe('2026-10-06');
  });

  it('rejects dates that do not exist', () => {
    expect(parseDate('31/02/24')).toBeNull();
    expect(parseDate('18/11')).toBeNull();
    expect(parseDate('11/18/23')).toBeNull();
  });

  it('round-trips', () => {
    expect(parseDate(formatDate('2024-02-29'))).toBe('2024-02-29');
  });
});
