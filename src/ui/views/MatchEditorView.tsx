/**
 * A match entered or corrected by hand: game data, the tally table and the
 * score of every set, the players' names. Every change is saved on the device.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { findAnomalies } from '../../matches/checks';
import { useI18n } from '../../i18n';
import { type MatchRecord, type SetRecord, liberoNumbers, matchWinner, setIsPlayed, shirtNumbers, withNumbersFromPreviousSet } from '../../matches/record';
import { formatDate, parseDate } from '../../report/format';
import { withKnownNames } from '../../storage/archive';
import { useArchive } from '../archive-context';
import { exportMatches } from '../match-files';
import { CountsEditor } from '../components/CountsEditor';
import { href, navigate } from '../routes';

const SAVE_DELAY = 600;

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="vr-field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Date typed as GG/MM/AA (the browser's date field would follow the system language). */
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  const { m } = useI18n();
  const [text, setText] = useState(() => formatDate(value));
  const invalid = text.trim() !== '' && parseDate(text) === null;
  return (
    <label className="vr-field">
      <span>{label}</span>
      <input
        inputMode="numeric"
        placeholder={m.editor.datePlaceholder}
        aria-invalid={invalid}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const iso = e.target.value.trim() === '' ? '' : parseDate(e.target.value);
          if (iso !== null) onChange(iso);
        }}
        onBlur={() => !invalid && setText(formatDate(value))}
      />
      {invalid && <small className="vr-field-error">{m.editor.dateError}</small>}
    </label>
  );
}

interface ScoreInputProps {
  readonly set: SetRecord;
  readonly onChange: (set: SetRecord) => void;
  /** Focus left both fields (or Enter was pressed): the score is entered. */
  readonly onDone: () => void;
}

function ScoreInput({ set, onChange, onDone }: ScoreInputProps) {
  const { m } = useI18n();
  const value = (side: 'team' | 'opponent') => (set.score ? String(set.score[side]) : '');
  const change = (side: 'team' | 'opponent', text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 2);
    const other = side === 'team' ? 'opponent' : 'team';
    const current = set.score ?? { team: 0, opponent: 0 };
    const next = { ...current, [side]: digits === '' ? 0 : Number(digits) };
    onChange({ ...set, score: digits === '' && !set.score?.[other] ? null : next });
  };
  return (
    <div
      className="vr-score-input"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onDone();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLElement).blur();
      }}
    >
      <span>{m.editor.finalScore}</span>
      <label>
        {m.editor.us} <input inputMode="numeric" value={value('team')} onChange={(e) => change('team', e.target.value)} />
      </label>
      <label>
        {m.editor.them} <input inputMode="numeric" value={value('opponent')} onChange={(e) => change('opponent', e.target.value)} />
      </label>
    </div>
  );
}

export function MatchEditorView({ id }: { id: string }) {
  const { m } = useI18n();
  const t = m.editor;
  const { archive } = useArchive();
  const [record, setRecord] = useState<MatchRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [saved, setSaved] = useState(true);
  const [setNumber, setSetNumber] = useState(1);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether the match was over at the last check: the tabellino opens by
  // itself only when entering a score ends it.
  const over = useRef(false);
  const latest = useRef<MatchRecord | null>(null);
  latest.current = record;

  useEffect(() => {
    if (!archive) return;
    archive.getMatch(id).then((found) => {
      if (!found) return setMissing(true);
      over.current = matchWinner(found) !== null;
      setRecord(found);
    });
  }, [archive, id]);

  /** A side has won three sets: save now and show the tabellino. */
  const scoreEntered = async () => {
    const current = latest.current;
    if (!archive || !current) return;
    const ended = matchWinner(current) !== null;
    const justEnded = ended && !over.current;
    over.current = ended;
    if (!justEnded) return;
    if (pending.current) clearTimeout(pending.current);
    await archive.saveMatch(current);
    setSaved(true);
    navigate('tabellino', current.id);
  };

  // Save shortly after the last change.
  useEffect(() => {
    if (!archive || !record || saved) return;
    pending.current = setTimeout(() => {
      archive.saveMatch(record).then(() => setSaved(true));
    }, SAVE_DELAY);
    return () => {
      if (pending.current) clearTimeout(pending.current);
    };
  }, [archive, record, saved]);

  const change = (next: MatchRecord) => {
    setRecord(next);
    setSaved(false);
  };

  // Names known for this team and competition fill the empty ones.
  const numbers = useMemo(() => (record ? shirtNumbers(record) : []), [record]);
  const teamKeyParts = record ? `${record.teamName}|${record.competition}|${numbers.join(',')}` : '';
  useEffect(() => {
    if (!archive || !record) return;
    let active = true;
    archive.knownPlayers(record.teamName, record.competition).then((known) => {
      if (!active) return;
      const filled = withKnownNames(record, known, numbers);
      if (JSON.stringify(filled.players) !== JSON.stringify(record.players)) change(filled);
    });
    return () => {
      active = false;
    };
    // Only when the team, the competition or the shirt numbers change.
  }, [archive, teamKeyParts]);

  const anomalies = useMemo(() => (record ? findAnomalies(record) : []), [record]);

  if (missing) {
    return (
      <section className="vr-card">
        <p>{m.common.matchNotFound}</p>
        <a className="vr-btn vr-btn-secondary" href={href('partite')}>
          {m.common.backToMatches}
        </a>
      </section>
    );
  }
  if (!record) return <p className="vr-note">{m.common.loading}</p>;

  const set = record.sets.find((s) => s.number === setNumber)!;
  const liberos = liberoNumbers(record);
  const title = record.teamName || record.opponentName ? `${record.teamName || '…'} – ${record.opponentName || '…'}` : t.newMatch;

  const remove = async () => {
    if (!archive || !window.confirm(t.confirmDelete)) return;
    await archive.deleteMatch(record.id);
    navigate('partite');
  };

  return (
    <>
      <header className="vr-hero">
        <p className="vr-eyebrow">{t.eyebrow}</p>
        <h1>{title}</h1>
        <ul className="vr-meta">
          <li>{saved ? t.saved : t.saving}</li>
        </ul>
        <div className="vr-actions start">
          <a className="vr-btn vr-btn-primary" href={href('tabellino', record.id)}>
            {m.nav.tabellino}
          </a>
          <a className="vr-btn vr-btn-secondary" href={href('grafici', record.id)}>
            {m.nav.grafici}
          </a>
          <a className="vr-btn vr-btn-secondary" href={href('foto', record.id)}>
            {t.addPhotos}
          </a>
          <button type="button" className="vr-btn vr-btn-secondary" onClick={() => exportMatches([record], m.matches.fileKind)}>
            {t.export}
          </button>
          <button type="button" className="vr-btn vr-btn-secondary vr-btn-danger" onClick={remove}>
            {t.delete}
          </button>
        </div>
      </header>

      {anomalies.length > 0 && (
        <section className="vr-card vr-warning" aria-live="polite">
          <div className="vr-card-head">
            <div>
              <h2>{t.checkTitle}</h2>
              <p>{t.checkText}</p>
            </div>
          </div>
          <ul className="vr-list">
            {anomalies.map((a, i) => (
              <li key={i}>{m.anomaly(a)}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{t.dataTitle}</h2>
            <p>{t.dataText}</p>
          </div>
        </div>
        <div className="vr-form-grid">
          <Field label={t.team} value={record.teamName} onChange={(teamName) => change({ ...record, teamName })} />
          <Field label={t.opponent} value={record.opponentName} onChange={(opponentName) => change({ ...record, opponentName })} />
          <Field label={t.competition} value={record.competition} onChange={(competition) => change({ ...record, competition })} />
          <DateField label={t.date} value={record.date} onChange={(date) => change({ ...record, date })} />
          <Field label={t.venue} value={record.venue} onChange={(venue) => change({ ...record, venue })} />
        </div>
      </section>

      <section className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{t.setsTitle}</h2>
            <p>{t.setsText}</p>
          </div>
        </div>
        <div className="vr-set-tabs" role="tablist">
          {record.sets.map((s) => (
            <button
              key={s.number}
              type="button"
              role="tab"
              aria-selected={s.number === setNumber}
              className={`vr-choice${s.number === setNumber ? ' selected' : ''}`}
              onClick={() => {
                const next = withNumbersFromPreviousSet(record, s.number);
                if (next !== record) change(next);
                setSetNumber(s.number);
              }}
            >
              {t.set} {s.number}
              {s.score ? ` · ${s.score.team}-${s.score.opponent}` : setIsPlayed(s) ? ' · ?' : ''}
            </button>
          ))}
        </div>
        <ScoreInput set={set} onDone={scoreEntered} onChange={(next) => change({ ...record, sets: record.sets.map((s) => (s.number === next.number ? next : s)) })} />
        <CountsEditor set={set} onChange={(next) => change({ ...record, sets: record.sets.map((s) => (s.number === next.number ? next : s)) })} />
      </section>

      <section className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{t.playersTitle}</h2>
            <p>{t.playersText}</p>
          </div>
        </div>
        {numbers.length === 0 ? (
          <p className="vr-note">{t.noNumbers}</p>
        ) : (
          <div className="vr-players">
            {numbers.map((number) => (
              <label key={number} className="vr-player-field">
                <span className="vr-player-number">{number}</span>
                {liberos.has(number) && <span className="vr-badge vr-badge-orange">L</span>}
                <input
                  value={record.players.find((p) => p.number === number)?.name ?? ''}
                  placeholder={t.namePlaceholder}
                  onChange={(e) => {
                    const players = [...record.players.filter((p) => p.number !== number), { number, name: e.target.value }];
                    change({ ...record, players });
                  }}
                />
              </label>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
