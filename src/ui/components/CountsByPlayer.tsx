/**
 * The tally of one set, one athlete at a time: made for phones. Each code has
 * − and + buttons starting from 0 (the number can also be typed); each skill
 * shows its total.
 */
import { useState } from 'react';
import type { Evaluation, Skill } from '../../domain/codes';
import { type Messages, useI18n } from '../../i18n';
import type { TallyRowRecord } from '../../matches/record';
import { codeOf, parseCount, parseShirtNumber, rowTotal, skillColumns, skillTotal } from './counts-columns';
import type { CountsViewProps } from './CountsEditor';

function rowName(row: TallyRowRecord, rows: readonly TallyRowRecord[], m: Messages) {
  if (row.playerNumber !== null) return String(row.playerNumber);
  const position = rows.filter((r) => r.kind === row.kind).indexOf(row) + 1;
  return m.counts.rowName(row.kind === 'libero', position);
}

/** Short meaning of an evaluation: "punto diretto", "positiva"… */
const shortMeaning = (m: Messages, skill: Skill, evaluation: Evaluation) => (m.codes[skill][evaluation] ?? '').split(' (')[0]!;

export function CountsByPlayer({ set, onCount, onNumber, onRemove, onAdd }: CountsViewProps) {
  const { m } = useI18n();
  const t = m.counts;
  const title = (kind: 'player' | 'libero') => (kind === 'player' ? t.players : t.liberos);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const row = set.rows.find((r) => r.id === selectedId) ?? set.rows[0];
  const index = row ? set.rows.indexOf(row) : -1;

  return (
    <div className="vr-byplayer">
      {(['player', 'libero'] as const).map((kind) => (
        <div key={kind} className="vr-byplayer-picker" role="group" aria-label={title(kind)}>
          <span className="vr-byplayer-picker-title">{title(kind)}</span>
          {set.rows
            .filter((r) => r.kind === kind)
            .map((r) => (
              <button
                key={r.id}
                type="button"
                className={`vr-choice${r.id === row?.id ? ' selected' : ''}${r.playerNumber === null ? ' empty' : ''}`}
                aria-pressed={r.id === row?.id}
                onClick={() => setSelectedId(r.id)}
              >
                {rowName(r, set.rows, m)}
                {rowTotal(r) > 0 && <span className="vr-byplayer-count">{rowTotal(r)}</span>}
              </button>
            ))}
          <button
            type="button"
            className="vr-choice vr-byplayer-add"
            aria-label={kind === 'libero' ? t.addLibero : t.addPlayer}
            onClick={() => onAdd(kind)}
          >
            +
          </button>
        </div>
      ))}

      {row && (
        <section className="vr-byplayer-panel" aria-label={t.touchesOf(rowName(row, set.rows, m))}>
          <div className="vr-byplayer-head">
            <button type="button" className="vr-icon-button" aria-label={t.previous} disabled={index <= 0} onClick={() => setSelectedId(set.rows[index - 1]!.id)}>
              ‹
            </button>
            <label className="vr-byplayer-number">
              <span>{row.kind === 'libero' ? t.liberoShirt : t.shirt}</span>
              <input
                inputMode="numeric"
                value={row.playerNumber ?? ''}
                placeholder="—"
                onChange={(e) => onNumber(row.id, parseShirtNumber(e.target.value))}
              />
            </label>
            <span className="vr-byplayer-total">
              Totale <strong>{rowTotal(row)}</strong>
            </span>
            <button
              type="button"
              className="vr-icon-button"
              aria-label={t.next}
              disabled={index >= set.rows.length - 1}
              onClick={() => setSelectedId(set.rows[index + 1]!.id)}
            >
              ›
            </button>
          </div>

          {skillColumns(row.kind).map((g, i) => (
            <div key={g.skill} className={`vr-byplayer-skill ${i % 2 === 0 ? 'band-a' : 'band-b'}`}>
              <h4>
                {m.skills[g.skill]}
                <span>
                  {t.tot} <strong>{skillTotal(row, g)}</strong>
                </span>
              </h4>
              <div className="vr-steppers">
                {g.evaluations.map((e) => {
                  const code = codeOf(g.skill, e);
                  const n = row.counts[code] ?? 0;
                  const label = `${m.skills[g.skill]} ${e}`;
                  return (
                    <div key={code} className="vr-stepper">
                      <span className="vr-stepper-code" title={shortMeaning(m, g.skill, e)}>
                        {e}
                        <small>{shortMeaning(m, g.skill, e)}</small>
                      </span>
                      <button type="button" aria-label={t.removeTouch(label)} disabled={n === 0} onClick={() => onCount(row.id, code, n - 1)}>
                        −
                      </button>
                      <input aria-label={label} inputMode="numeric" value={n} onFocus={(ev) => ev.target.select()} onChange={(ev) => onCount(row.id, code, parseCount(ev.target.value))} />
                      <button type="button" aria-label={t.addTouch(label)} onClick={() => onCount(row.id, code, n + 1)}>
                        +
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => onRemove(row.id)}>
            {t.deleteThisRow}
          </button>
        </section>
      )}
    </div>
  );
}
