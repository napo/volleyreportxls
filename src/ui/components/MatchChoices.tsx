// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The matches to put in a history, grouped by team name and competition, each group with a check for all of it. */
import type { MatchRecord } from '../../matches/record';
import { formatDate } from '../../report/format';
import { useI18n } from '../../i18n';

export interface MatchChoice {
  readonly record: MatchRecord;
  /** Shown after the date and the opponent, e.g. the shirt number. */
  readonly detail?: string;
}

interface Props {
  readonly items: readonly MatchChoice[];
  /** Matches left out by the user. */
  readonly excluded: ReadonlySet<string>;
  readonly onChange: (excluded: ReadonlySet<string>) => void;
}

export function MatchChoices({ items, excluded, onChange }: Props) {
  const { m } = useI18n();
  // One roster each, in order of first match.
  const groups = items.reduce<{ key: string; label: string; items: MatchChoice[] }[]>((list, x) => {
    const key = `${x.record.teamName}|${x.record.competition}`;
    const group = list.find((g) => g.key === key);
    if (group) group.items.push(x);
    else list.push({ key, label: [x.record.competition, x.record.teamName].filter((s) => s.trim()).join(' · ') || '—', items: [x] });
    return list;
  }, []);
  const set = (ids: readonly string[], include: boolean) => {
    const next = new Set(excluded);
    ids.forEach((id) => (include ? next.delete(id) : next.add(id)));
    onChange(next);
  };

  return groups.map(({ key, label, items }) => {
    const ids = items.map((x) => x.record.id);
    const on = ids.filter((id) => !excluded.has(id)).length;
    return (
      <fieldset key={key} className="vr-choices vr-match-group">
        <legend>
          <label className="vr-check">
            <input
              type="checkbox"
              checked={on === ids.length}
              ref={(el) => {
                if (el) el.indeterminate = on > 0 && on < ids.length;
              }}
              onChange={() => set(ids, on < ids.length)}
            />
            {label}
          </label>
        </legend>
        {items.map((x) => (
          <label key={x.record.id} className="vr-choice">
            <input type="checkbox" checked={!excluded.has(x.record.id)} onChange={() => set([x.record.id], excluded.has(x.record.id))} />
            {formatDate(x.record.date)} {x.record.opponentName || m.common.opponent}
            {x.detail && ` · ${x.detail}`}
          </label>
        ))}
      </fieldset>
    );
  });
}
