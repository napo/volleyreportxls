// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * "Live stats" on the keypad: the team's serve, reception and attack in the set
 * and in the match so far, each written out with its bar (0 to 100%, in the
 * colour of how it is going) and the balls played, and short facts about
 * single shirt numbers in the set.
 */
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import type { Evaluation } from '../../domain/codes';
import { type Fact, type PlayerForm, type Shares, type Tally } from '../../matches/live-situation';
import type { EvaluationShareRow } from '../../report/chart-data';
import { EvaluationChart } from '../charts/EvaluationChart';

export interface Situation {
  /** The evaluations behind the bars, for the set and for the match so far. */
  readonly setShares: readonly Shares[];
  readonly matchShares: readonly Shares[];
  /** Points scored and errors made in the set, with where they came from. */
  readonly tally: Tally;
  readonly facts: readonly Fact[];
  /** Who goes well and who goes badly in the set. */
  readonly form: { readonly good: readonly PlayerForm[]; readonly bad: readonly PlayerForm[] };
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => globalThis.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const list = globalThis.matchMedia?.(query);
    if (!list) return;
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** The evaluations of a skill as a row of the stacked bar chart; null while the skill was never played. */
function shareRow(shares: Shares, label: string): EvaluationShareRow | null {
  if (shares.total === 0) return null;
  const counts = { '#': 0, '+': 0, '!': 0, '-': 0, '/': 0, '=': 0 } as Record<Evaluation, number>;
  const ratios = { ...counts };
  for (const part of shares.parts) {
    counts[part.evaluation] = part.count;
    ratios[part.evaluation] = part.count / shares.total;
  }
  return { skill: shares.skill, label, total: shares.total, counts, shares: ratios };
}

/** The serve, reception and attack of the set and of the match so far, with their bars. */
export function LiveStats({ situation, set, withMatch: wantsMatch = true, compact }: { situation: Situation; set: number; withMatch?: boolean; compact?: boolean }) {
  const { m } = useI18n();
  const t = m.live.situation;
  // On a short phone the bars of the match (the set alone, and the rest fits without scrolling) are dropped.
  const short = useMediaQuery('(max-width: 899px) and (max-height: 700px)');
  const withMatch = wantsMatch && !short;
  const rows = situation.setShares.flatMap((shares, i) => {
    const name = m.skills[shares.skill];
    const own = shareRow(shares, withMatch ? `${name} · ${m.live.set(set)}` : name);
    const all = withMatch ? shareRow(situation.matchShares[i]!, `${name} · ${t.match}`) : null;
    return [own, all].filter((r): r is EvaluationShareRow => r !== null);
  });
  return (
    <>
      <EvaluationChart rows={rows} title={t.chartTitle} floating compact={compact ?? wantsMatch} />
      <p className="vr-stats-tally">
        <span className="points">{t.tallyPoints(situation.tally.points, situation.tally.pointsBy.map((x) => t.pointBy(x.skill, x.count)))}</span>
        {' · '}
        <span className="errors">{t.tallyErrors(situation.tally.errors, situation.tally.errorsBy.map((x) => t.errorBy(x.skill, x.count)))}</span>
      </p>
    </>
  );
}

/** The two shirt numbers that go well and the two that go badly in the set, highlighted. */
export function LiveForm({ situation, nameOf }: { situation: Situation; nameOf: (n: number) => string }) {
  const { m } = useI18n();
  const t = m.live.situation;
  const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0');
  // The name shows on hover (and is read by screen readers); the number is what fits on the chip.
  const chip = (p: PlayerForm, kind: 'good' | 'bad') => {
    const name = nameOf(p.number).trim();
    return (
      <li key={p.number} className={`vr-form-chip ${kind}`} title={name || undefined} aria-label={t.formChip(p.number, name, p.points, p.errors, signed(p.balance))}>
        <strong>{p.number}</strong>
        <span>{`${p.points}/${p.errors}/${signed(p.balance)}`}</span>
      </li>
    );
  };
  return (
    <div className="vr-form">
      <h3 className="vr-form-title">
        {t.formTitle} <small>{t.formKey}</small>
      </h3>
      <div>
        <h4>{t.formGood}</h4>
        {situation.form.good.length === 0 ? <p>{t.formNone}</p> : <ul>{situation.form.good.map((p) => chip(p, 'good'))}</ul>}
      </div>
      <div>
        <h4>{t.formBad}</h4>
        {situation.form.bad.length === 0 ? <p>{t.formNone}</p> : <ul>{situation.form.bad.map((p) => chip(p, 'bad'))}</ul>}
      </div>
    </div>
  );
}

export function LiveSituation({ situation, set, nameOf, onClose }: { situation: Situation; set: number; nameOf: (n: number) => string; onClose: () => void }) {
  const { m } = useI18n();
  const t = m.live.situation;
  const label = (n: number) => t.who(n, nameOf(n).trim());
  return (
    <div className="vr-situation">
      <LiveStats situation={situation} set={set} />
      <LiveForm situation={situation} nameOf={nameOf} />
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
