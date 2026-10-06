import type { SetNumber } from '../../domain/model';
import type { Tabellino } from '../../report/tabellino';
import { useI18n } from '../../i18n';

interface Props {
  readonly tabellino: Tabellino;
  /** With a handler, the result selects the whole match and each set score selects that set. */
  readonly onSelect?: (set: SetNumber | null) => void;
}

export function Scoreboard({ tabellino, onSelect }: Props) {
  const t = useI18n().m.scoresheet;
  const teams = (
    <>
      <span className="team">{tabellino.teamName}</span>
      <span className="sets-won">{tabellino.setsWon.team}</span>
      <span className="team">{tabellino.opponentName}</span>
      <span className="sets-won">{tabellino.setsWon.opponent}</span>
    </>
  );
  const selected = (set: SetNumber | null) => (tabellino.set === set ? ' selected' : '');
  return (
    <div className="vr-score">
      {onSelect ? (
        <button
          type="button"
          className={`vr-score-teams${selected(null)}`}
          aria-pressed={tabellino.set === null}
          title={t.matchSheet}
          onClick={() => onSelect(null)}
        >
          {teams}
        </button>
      ) : (
        <div className="vr-score-teams">{teams}</div>
      )}
      <div className="vr-score-partials" aria-label={t.setScores}>
        {tabellino.setScores.map(({ number, score }) => {
          const className = `${score.team > score.opponent ? 'won' : ''}${selected(number)}`.trim() || undefined;
          const text = `${score.team}-${score.opponent}`;
          return onSelect ? (
            <button
              key={number}
              type="button"
              className={className}
              aria-pressed={tabellino.set === number}
              title={t.setSheet(number)}
              onClick={() => onSelect(number)}
            >
              {text}
            </button>
          ) : (
            <span key={number} className={className} title={`${t.set} ${number}`}>
              {text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
