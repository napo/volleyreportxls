import { messagesFor, systemLang } from './index';

test('Italian only when the first system language is Italian', () => {
  expect(systemLang(['it-IT', 'en-US'])).toBe('it');
  expect(systemLang(['it'])).toBe('it');
  expect(systemLang(['en-GB', 'it-IT'])).toBe('en');
  expect(systemLang(['de-DE'])).toBe('en');
});

test('both languages describe every anomaly and every evaluation of the vocabulary', () => {
  for (const lang of ['it', 'en'] as const) {
    const m = messagesFor(lang);
    expect(m.anomaly({ kind: 'missing-score', set: 2 })).toContain('2');
    expect(m.codes.P['=']).toBeTruthy();
    expect(Object.keys(m.codes.B)).toEqual(['#', '+', '!', '-', '/', '=']);
  }
});
