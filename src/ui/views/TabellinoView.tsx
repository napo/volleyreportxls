import { useMemo, useState } from 'react';
import type { SetNumber } from '../../domain/model';
import { Scoreboard } from '../components/Scoreboard';
import { TabellinoSetTable, TabellinoTable } from '../components/TabellinoTable';
import { saveFile } from '../../platform/save-file';
import { loadLogoPng, loadPdfFonts } from '../pdf-assets';
import { messagesFor, useI18n } from '../../i18n';
import type { MatchReport } from '../match-report';
import { href } from '../routes';
import { formatDate } from '../../report/format';
import { buildSetTabellino } from '../../report/tabellino';

export function TabellinoView({ report }: { report: MatchReport }) {
  const { m, lang } = useI18n();
  const t = m.scoresheet;
  // The whole match, or the set chosen on the scoreboard; the PDF follows.
  const [setShown, setSetShown] = useState<SetNumber | null>(null);
  const tabellino = useMemo(
    () => (setShown === null ? report.tabellino : buildSetTabellino(report.match, report.tabellino, setShown)),
    [report, setShown],
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function exportPdf() {
    setBusy(true);
    setFailed(false);
    try {
      // The PDF library is loaded only when needed.
      const { renderTabellinoPdf, tabellinoFileName } = await import('../../pdf/tabellino-pdf');
      await saveFile(tabellinoFileName(tabellino), async () => {
        const [fonts, logoPng] = await Promise.all([loadPdfFonts(), loadLogoPng()]);
        return renderTabellinoPdf(tabellino, { fonts, logoPng, texts: messagesFor(lang).scoresheet });
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const date = formatDate(tabellino.date);
  return (
    <>
      <header className="vr-hero">
        <p className="vr-eyebrow">
          {t.eyebrow} · {report.recordId ? m.common.match : m.common.example}
          {tabellino.set && ` · ${t.set} ${tabellino.set}`}
        </p>
        <h1>
          {tabellino.teamName} – {tabellino.opponentName}
        </h1>
        <ul className="vr-meta">
          {[tabellino.competition, tabellino.venue, date]
            .filter((text) => text.trim() !== '')
            .map((text) => (
              <li key={text}>{text}</li>
            ))}
        </ul>
      </header>

      {report.recordId && (
        <section className={`vr-card${report.anomalies.length ? ' vr-warning' : ''}`}>
          {report.anomalies.length > 0 ? (
            <>
              <p>
                <strong>{t.toCheck}</strong>
              </p>
              <ul className="vr-list">
                {report.anomalies.map((a, i) => (
                  <li key={i}>{m.anomaly(a)}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>{t.complete}</p>
          )}
          <div className="vr-actions start">
            <a className="vr-btn vr-btn-secondary vr-btn-small" href={href('partita', report.recordId)}>
              {t.editMatch}
            </a>
          </div>
        </section>
      )}

      <section className="vr-card">
        <div className="vr-card-head">
          <div>
            <Scoreboard tabellino={tabellino} onSelect={setSetShown} />
            <p className="vr-note">
              {tabellino.set ? t.seeingSet(tabellino.set) : t.tapSet}
            </p>
          </div>
          <div className="vr-actions start">
            <button type="button" className="vr-btn vr-btn-primary" onClick={exportPdf} disabled={busy}>
              {busy ? m.common.preparing : m.common.downloadPdf}
            </button>
          </div>
        </div>
        {failed && <p className="vr-message warning">{m.common.pdfError}</p>}
        <TabellinoTable tabellino={tabellino} />
        <p className="vr-note">{t.legend}</p>
      </section>

      <section className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{tabellino.set ? t.oneSetStats : t.setStats}</h2>
            <p>{tabellino.set ? t.opponentErrorsSet(tabellino.opponentErrors) : t.opponentErrorsMatch(tabellino.opponentErrors)}</p>
          </div>
        </div>
        <TabellinoSetTable tabellino={tabellino} />
      </section>
    </>
  );
}
