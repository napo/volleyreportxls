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
import { type Fact, type Indicator, levelOf } from '../../matches/live-situation';

export interface Situation {
  readonly set: readonly Indicator[];
  readonly match: readonly Indicator[];
  readonly facts: readonly Fact[];
}

const percent = (v: number) => `${Math.round(v * 100)}%`;

/** One line: label, a bar from 0 to 100% in the colour of its level, the value and the balls. */
function Line({ label, indicator, strong }: { label: string; indicator: Indicator; strong: boolean }) {
  const { m } = useI18n();
  const t = m.live.situation;
  const v = indicator.value;
  const level = levelOf(indicator);
  return (
    <div className={`vr-stats-line${strong ? ' set' : ' match'}`}>
      <span className="vr-stats-label">{label}</span>
      <span className="vr-stats-track" aria-hidden="true">
        <span className={`vr-stats-bar ${level}`} style={{ width: `${v === null ? 0 : Math.max(0, Math.min(1, v)) * 100}%` }} />
      </span>
      <span className={`vr-stats-value ${level}`}>{v === null ? '–' : percent(v)}</span>
      <span className="vr-stats-balls">{v === null ? t.none : t.balls(indicator.total)}</span>
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
      <ul className="vr-stats">
        {situation.set.map((s, i) => (
          <li key={s.skill}>
            <h3>{t.indicator[s.skill]}</h3>
            <Line label={m.live.set(set)} indicator={s} strong />
            <Line label={t.match} indicator={situation.match[i]!} strong={false} />
          </li>
        ))}
      </ul>
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
