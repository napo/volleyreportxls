// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The tally of one set as a table, the same structure as the paper form: one
 * row per player, one cell per code holding the number of touches. Each skill
 * ends with its total (computed, not editable) and has its own background band.
 */
import type { RowKind, TallyRowRecord } from '../../matches/record';
import { useI18n } from '../../i18n';
import { codeOf, parseCount, parseShirtNumber, rowTotal, skillColumns, skillTotal } from './counts-columns';
import type { CountsViewProps } from './CountsEditor';

const band = (i: number) => (i % 2 === 0 ? 'band-a' : 'band-b');

export function CountsTable({ set, onCount, onNumber, onRemove, onAdd }: CountsViewProps) {
  const { m } = useI18n();
  const t = m.counts;
  return (
    <>
      {(['player', 'libero'] as const satisfies readonly RowKind[]).map((kind) => {
        const rows = set.rows.filter((r) => r.kind === kind);
        const groups = skillColumns(kind);
        const title = kind === 'player' ? t.players : t.liberos;
        const sum = (value: (row: TallyRowRecord) => number) => rows.reduce((n, row) => n + value(row), 0) || '';
        return (
          <div className="vr-counts-section" key={kind}>
            <h3>{title}</h3>
            <div className="vr-scroll">
              <table className="vr-table vr-counts">
                <thead>
                  <tr>
                    <th className="vr-counts-number" />
                    {groups.map((g, i) => (
                      <th key={g.skill} colSpan={g.evaluations.length + 1} className={`vr-counts-skill ${band(i)}`}>
                        {m.skills[g.skill]}
                      </th>
                    ))}
                    <th />
                    <th />
                  </tr>
                  <tr>
                    <th className="vr-counts-number">{t.number}</th>
                    {groups.flatMap((g, i) => [
                      ...g.evaluations.map((e) => (
                        <th key={codeOf(g.skill, e)} className={`vr-counts-eval ${band(i)}`}>
                          {e}
                        </th>
                      )),
                      <th key={`${g.skill}-tot`} className={`vr-counts-skilltotal ${band(i)}`}>
                        {t.tot}
                      </th>,
                    ])}
                    <th className="vr-counts-total">{t.total}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, r) => (
                    <tr key={row.id}>
                      <td className="vr-counts-number">
                        <input
                          aria-label={t.shirtOf(t.row(title, r + 1))}
                          inputMode="numeric"
                          value={row.playerNumber ?? ''}
                          placeholder="—"
                          onChange={(e) => onNumber(row.id, parseShirtNumber(e.target.value))}
                        />
                      </td>
                      {groups.flatMap((g, i) => [
                        ...g.evaluations.map((e) => {
                          const code = codeOf(g.skill, e);
                          const n = row.counts[code] ?? 0;
                          return (
                            <td key={code} className={band(i)}>
                              <input
                                aria-label={`${t.row(title, r + 1)}, ${code}`}
                                inputMode="numeric"
                                value={n === 0 ? '' : n}
                                onChange={(ev) => onCount(row.id, code, parseCount(ev.target.value))}
                              />
                            </td>
                          );
                        }),
                        <td key={`${g.skill}-tot`} className={`vr-counts-skilltotal ${band(i)}`}>
                          {skillTotal(row, g) || ''}
                        </td>,
                      ])}
                      <td className="vr-counts-total">{rowTotal(row) || ''}</td>
                      <td>
                        <button type="button" className="vr-icon-button" aria-label={t.deleteRow(r + 1)} onClick={() => onRemove(row.id)}>
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="vr-counts-number">{t.tot}</td>
                    {groups.flatMap((g, i) => [
                      ...g.evaluations.map((e) => (
                        <td key={codeOf(g.skill, e)} className={band(i)}>
                          {sum((row) => row.counts[codeOf(g.skill, e)] ?? 0)}
                        </td>
                      )),
                      <td key={`${g.skill}-tot`} className={`vr-counts-skilltotal ${band(i)}`}>
                        {sum((row) => skillTotal(row, g))}
                      </td>,
                    ])}
                    <td className="vr-counts-total">{sum(rowTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => onAdd(kind)}>
              {kind === 'libero' ? t.addLibero : t.addPlayer}
            </button>
          </div>
        );
      })}
    </>
  );
}
