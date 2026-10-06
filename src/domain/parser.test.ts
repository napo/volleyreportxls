import { allScoutCodes, formatScoutCode } from './codes';
import { parseScoutCode } from './parser';

describe('parseScoutCode', () => {
  test('accepts the whole vocabulary (DataVolley evaluations)', () => {
    const codes = allScoutCodes().map(formatScoutCode);
    expect(codes).toEqual([
      'B#', 'B+', 'B!', 'B-', 'B/', 'B=',
      'R#', 'R+', 'R!', 'R-', 'R/', 'R=',
      'A#', 'A+', 'A!', 'A-', 'A/', 'A=',
      'M#', 'M+', 'M!', 'M-', 'M/', 'M=',
      'P=',
      'F#', 'F+', 'F-', 'F/', 'F=',
    ]);
    for (const code of codes) expect(parseScoutCode(code)).toEqual({ ok: true, code: { skill: code[0], evaluation: code[1] } });
  });

  test('dig is not recorded and the set only as a fault (P=)', () => {
    expect(parseScoutCode('D#')).toMatchObject({ ok: false });
    expect(parseScoutCode('P#')).toMatchObject({ ok: false });
  });

  test('normalises letter case, as COUNTIF does in the workbook', () => {
    expect(parseScoutCode('a#')).toEqual({ ok: true, code: { skill: 'A', evaluation: '#' } });
  });

  test('reports blank cells as empty', () => {
    expect(parseScoutCode('')).toMatchObject({ ok: false, error: { kind: 'empty' } });
    expect(parseScoutCode('   ')).toMatchObject({ ok: false, error: { kind: 'empty' } });
  });

  test('ignores whitespace inside or around a code', () => {
    expect(parseScoutCode('B #')).toEqual({ ok: true, code: { skill: 'B', evaluation: '#' } });
    expect(parseScoutCode(' r+ ')).toEqual({ ok: true, code: { skill: 'R', evaluation: '+' } });
  });

  test('rejects cells that are not one letter and one symbol', () => {
    expect(parseScoutCode('A##')).toEqual({ ok: false, error: { kind: 'malformed', input: 'A##' } });
    expect(parseScoutCode('A')).toEqual({ ok: false, error: { kind: 'malformed', input: 'A' } });
  });

  test('rejects unknown skills and evaluations', () => {
    expect(parseScoutCode('X#')).toMatchObject({ ok: false, error: { kind: 'unknown-skill' } });
    expect(parseScoutCode('A*')).toMatchObject({ ok: false, error: { kind: 'unknown-evaluation' } });
  });

  test('rejects pairs outside the vocabulary', () => {
    expect(parseScoutCode('P!')).toMatchObject({ ok: false, error: { kind: 'not-allowed' } });
    expect(parseScoutCode('P/')).toMatchObject({ ok: false, error: { kind: 'not-allowed' } });
    expect(parseScoutCode('F!')).toMatchObject({ ok: false, error: { kind: 'not-allowed' } });
  });
});
