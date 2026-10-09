// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SET_NUMBERS } from '../../domain/model';
import { formatBracketedPercent, formatCount, formatPercent, formatRating, formatSigned } from '../../report/format';
import type { Tabellino, TabellinoLine, TabellinoPlayerRow, TabellinoSkills } from '../../report/tabellino';
import { useI18n } from '../../i18n';

export function SkillCells({ row }: { row: TabellinoSkills }) {
  return (
    <>
      <td className="num group-start">{formatCount(row.serve.total)}</td>
      <td className="num">{formatCount(row.serve.errors)}</td>
      <td className="num">{formatCount(row.serve.points)}</td>
      <td className="num group-start">{formatCount(row.reception.total)}</td>
      <td className="num">{formatCount(row.reception.errors)}</td>
      <td className="num">{formatPercent(row.reception.positivity)}</td>
      <td className="num">{formatBracketedPercent(row.reception.perfectRate)}</td>
      <td className="num group-start">{formatCount(row.attack.total)}</td>
      <td className="num">{formatCount(row.attack.errors)}</td>
      <td className="num">{formatCount(row.attack.blocked)}</td>
      <td className="num">{formatCount(row.attack.points)}</td>
      <td className="num">{formatPercent(row.attack.pointRate)}</td>
      <td className="num group-start">{formatCount(row.blockPoints)}</td>
    </>
  );
}

export function SkillHeaders() {
  const t = useI18n().m.scoresheet;
  return (
    <>
      {[t.tot, t.err, t.pt].map((h, i) => <th key={`b${h}`} className={`num${i === 0 ? ' group-start' : ''}`}>{h}</th>)}
      {[t.tot, t.err, t.pos, t.prf].map((h, i) => <th key={`r${h}`} className={`num${i === 0 ? ' group-start' : ''}`}>{h}</th>)}
      {[t.tot, t.err, t.blocked, t.pt, t.ptPct].map((h, i) => <th key={`a${h}`} className={`num${i === 0 ? ' group-start' : ''}`}>{h}</th>)}
      <th className="num group-start">{t.pt}</th>
    </>
  );
}

export function SkillGroups() {
  const t = useI18n().m.scoresheet;
  return (
    <>
      <th colSpan={3} className="group-start">{t.serve}</th>
      <th colSpan={4} className="group-start">{t.reception}</th>
      <th colSpan={5} className="group-start">{t.attack}</th>
      <th className="group-start">{t.block}</th>
    </>
  );
}

function balanceClass(balance: number) {
  return balance > 0 ? 'num positive' : balance < 0 ? 'num negative' : 'num';
}

export function PointsCells({ line }: { line: TabellinoLine }) {
  return (
    <>
      <td className="num group-start">{formatCount(line.points.total)}</td>
      <td className={balanceClass(line.points.balance)}>{formatSigned(line.points.balance)}</td>
    </>
  );
}

function PlayerRow({ row, showNames }: { row: TabellinoPlayerRow; showNames: boolean }) {
  const libero = row.player.role === 'L' && <span className="libero">L</span>;
  return (
    <tr>
      <td className="num player-number">
        {row.player.number}
        {!showNames && libero}
      </td>
      {showNames && (
        <td>
          {row.player.name}
          {libero}
        </td>
      )}
      <td className="sets">{SET_NUMBERS.map((n) => (row.setsPlayed.includes(n) ? n : '·')).join(' ')}</td>
      <td className="num">{formatRating(row.rating)}</td>
      <PointsCells line={row} />
      <SkillCells row={row} />
    </tr>
  );
}

export function TabellinoTable({ tabellino }: { tabellino: Tabellino }) {
  const t = useI18n().m.scoresheet;
  const { showNames } = tabellino;
  return (
    <div className="vr-scroll">
      <table className="vr-table">
        <thead>
          <tr>
            <th colSpan={showNames ? 2 : 1} />
            <th>{t.set}</th>
            <th />
            <th colSpan={2} className="group-start">{t.points}</th>
            <SkillGroups />
          </tr>
          <tr>
            <th className="num">{t.number}</th>
            {showNames && <th>{t.player}</th>}
            <th>1 2 3 4 5</th>
            <th className="num">{t.rating}</th>
            <th className="num group-start">{t.tot}</th>
            <th className="num">{t.balance}</th>
            <SkillHeaders />
          </tr>
        </thead>
        <tbody>
          {tabellino.players.map((row) => (
            <PlayerRow key={row.player.id} row={row} showNames={showNames} />
          ))}
          <tr className="total">
            <td colSpan={showNames ? 2 : 1}>{t.teamTotals}</td>
            <td />
            <td />
            <PointsCells line={tabellino.totals} />
            <SkillCells row={tabellino.totals} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function TabellinoSetTable({ tabellino }: { tabellino: Tabellino }) {
  const t = useI18n().m.scoresheet;
  return (
    <div className="vr-scroll">
      <table className="vr-table">
        <thead>
          <tr>
            <th />
            <th colSpan={4} className="group-start">{t.pointsWon}</th>
            <SkillGroups />
          </tr>
          <tr>
            <th>{t.set}</th>
            <th className="num group-start">{t.srv}</th>
            <th className="num">{t.att}</th>
            <th className="num">{t.blk}</th>
            <th className="num">{t.oppErr}</th>
            <SkillHeaders />
          </tr>
        </thead>
        <tbody>
          {tabellino.sets.map((set) => (
            <tr key={set.setNumber}>
              <td>
                {t.set} {set.setNumber}
                {set.score && <span className="vr-muted"> · {set.score.team}-{set.score.opponent}</span>}
              </td>
              <td className="num group-start">{formatCount(set.pointsWon.serve)}</td>
              <td className="num">{formatCount(set.pointsWon.attack)}</td>
              <td className="num">{formatCount(set.pointsWon.block)}</td>
              <td className="num">{formatCount(set.pointsWon.opponentErrors)}</td>
              <SkillCells row={set} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
