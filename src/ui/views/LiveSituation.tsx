// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * "Live stats" on the keypad: the team's serve, reception and attack in the set
 * and in the match so far, each written out with its bar (0 to 100%, in the
 * colour of how it is going) and the balls played, and short facts about
 * single shirt numbers in the set.
 */
import { useI18n } from '../../i18n';
import { useA11y } from '../a11y';
import { type Fact, type Indicator, type PlayerForm, type Shares, levelOf } from '../../matches/live-situation';
import { scalePlace } from '../../report/evaluation-colors';
import { scaleColors, scaleLabels } from '../charts/tokens';

export interface Situation {
  readonly set: readonly Indicator[];
  readonly match: readonly Indicator[];
  /** The evaluations behind the bars, for the set and for the match so far. */
  readonly setShares: readonly Shares[];
  readonly matchShares: readonly Shares[];
  readonly facts: readonly Fact[];
  /** Who goes well and who goes badly in the set. */
  readonly form: { readonly good: readonly PlayerForm[]; readonly bad: readonly PlayerForm[] };
}

const percent = (v: number) => `${Math.round(v * 100)}%`;

/** A segment shows its symbol when it is wide enough to hold it. */
const LABEL_MIN_SHARE = 0.1;

/** One line: label, a stacked bar of the evaluations (symbols on their colours), the indicator and the balls. */
function Line({ label, indicator, shares, strong }: { label: string; indicator: Indicator; shares: Shares; strong: boolean }) {
  const { m } = useI18n();
  const t = m.live.situation;
  const v = indicator.value;
  const level = levelOf(indicator);
  const colors = scaleColors();
  const inks = scaleLabels();
  return (
    <div className={`vr-stats-line${strong ? ' set' : ' match'}`}>
      <span className="vr-stats-label">{label}</span>
      <span className="vr-stats-track stacked" aria-hidden="true">
        {shares.parts.map((part) => {
          if (part.count === 0) return null;
          const share = part.count / shares.total;
          const place = scalePlace(shares.skill, part.evaluation);
          return (
            <span key={part.evaluation} className="vr-stats-segment" style={{ width: `${share * 100}%`, background: colors[place]!, color: inks[place]! }}>
              {share >= LABEL_MIN_SHARE ? `${part.evaluation} ${part.count}` : ''}
            </span>
          );
        })}
      </span>
      <span className={`vr-stats-value ${level}`}>{v === null ? '–' : percent(v)}</span>
      <span className="vr-stats-balls">{v === null ? t.none : t.balls(indicator.total)}</span>
    </div>
  );
}

/** The serve, reception and attack of the set and of the match so far, with their bars. */
export function LiveStats({ situation, set, withMatch = true }: { situation: Situation; set: number; withMatch?: boolean }) {
  const { m } = useI18n();
  const t = m.live.situation;
  return (
    <ul className="vr-stats">
      {situation.set.map((s, i) => (
        <li key={s.skill}>
          <h3>{t.indicator[s.skill]}</h3>
          <Line label={m.live.set(set)} indicator={s} shares={situation.setShares[i]!} strong />
          {withMatch && <Line label={t.match} indicator={situation.match[i]!} shares={situation.matchShares[i]!} strong={false} />}
        </li>
      ))}
    </ul>
  );
}

/** The two shirt numbers that go well and the two that go badly in the set, highlighted. */
export function LiveForm({ situation, nameOf }: { situation: Situation; nameOf: (n: number) => string }) {
  const { m } = useI18n();
  const t = m.live.situation;
  const chip = (p: PlayerForm, kind: 'good' | 'bad') => (
    <li key={p.number} className={`vr-form-chip ${kind}`}>
      <strong>{p.number}</strong>
      {nameOf(p.number).trim() && <small>{nameOf(p.number).trim()}</small>}
      <span>{p.balance > 0 ? `+${p.balance}` : `−${Math.abs(p.balance)}`}</span>
    </li>
  );
  return (
    <div className="vr-form">
      <div>
        <h3>{t.formGood}</h3>
        {situation.form.good.length === 0 ? <p>{t.formNone}</p> : <ul>{situation.form.good.map((p) => chip(p, 'good'))}</ul>}
      </div>
      <div>
        <h3>{t.formBad}</h3>
        {situation.form.bad.length === 0 ? <p>{t.formNone}</p> : <ul>{situation.form.bad.map((p) => chip(p, 'bad'))}</ul>}
      </div>
    </div>
  );
}

export function LiveSituation({ situation, set, nameOf, onClose }: { situation: Situation; set: number; nameOf: (n: number) => string; onClose: () => void }) {
  const { m } = useI18n();
  const t = m.live.situation;
  const { colorblind } = useA11y();
  const label = (n: number) => t.who(n, nameOf(n).trim());
  return (
    <div className="vr-situation">
      <LiveStats situation={situation} set={set} />
      <LiveForm situation={situation} nameOf={nameOf} />
      <p className="vr-situation-scale">{colorblind ? t.scaleColorblind : t.scale}</p>
      <h3 className="vr-situation-facts-title">{t.factsTitle}</h3>
      {situation.facts.length === 0 ? (
        <p className="vr-situation-empty">{t.noFacts}</p>
      ) : (
        <ul className="vr-situation-facts">
          {situation.facts.map((f) => (
            <li key={`${f.number}:${f.kind}`} className={f.negative ? 'negative' : 'positive'}>
              {t.fact[f.kind](label(f.number), f.count)}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="vr-btn vr-btn-primary vr-situation-close" onClick={onClose}>
        {t.close}
      </button>
    </div>
  );
}
