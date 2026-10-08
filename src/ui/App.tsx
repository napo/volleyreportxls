import { Suspense, lazy, useEffect, useState } from 'react';
import logo from '../assets/volleyreportxls-logo.png';
import { LICENSE_URL, SOURCE_REPOSITORY_URL, VOLLEYREPORTXLS_URL, releaseUrl } from '../config';
import { ExternalLink } from '../platform/ExternalLink';
import { APP_VERSION } from '../version';
import { ArchiveProvider } from './archive-context';
import { GuideDialog } from './components/GuideDialog';
import { UpdateNotice } from './components/UpdateNotice';
import { useMatchReport } from './match-report';
import { type Route, SAMPLE_ID, TABS, type Tab, href, isSectionPage, parseRoute, tabOf } from './routes';
import { AthletesView } from './views/AthletesView';
import { HomeView } from './views/HomeView';
import { InfoView } from './views/InfoView';
import { MatchEditorView } from './views/MatchEditorView';
import { AcquisitionView } from './acquisition/AcquisitionView';
import { LANGUAGES, type Lang, setLang, useI18n } from '../i18n';
import { TabellinoView } from './views/TabellinoView';

// Charts (ECharts) are loaded only when the tab is opened.
const GraficiView = lazy(() => import('./views/GraficiView'));
const AthleteView = lazy(() => import('./views/AthleteView'));

/** Tabellino and Grafici of the match in the route (the example when none). */
function ReportPage({ route }: { route: Route }) {
  const { m } = useI18n();
  const { report, missing } = useMatchReport(route.param);
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
  if (!report) return <p className="vr-note">{m.common.loading}</p>;
  if (route.name === 'tabellino') return <TabellinoView report={report} />;
  return (
    <Suspense fallback={<p className="vr-note">{m.common.loadingCharts}</p>}>
      <GraficiView report={report} />
    </Suspense>
  );
}

// Per-viewer convenience only: storage may be unavailable (private mode).
const LAST_MATCH_KEY = 'volleyreport.lastMatch';

function readLastMatch(): string | null {
  try {
    return window.localStorage.getItem(LAST_MATCH_KEY);
  } catch {
    return null;
  }
}

function writeLastMatch(id: string) {
  try {
    window.localStorage.setItem(LAST_MATCH_KEY, id);
  } catch {
    // Ignored: the tabs fall back to the example match.
  }
}

function AthleteRoute({ id }: { id: string }) {
  const { m } = useI18n();
  return (
    <Suspense fallback={<p className="vr-note">{m.common.loadingCharts}</p>}>
      <AthleteView id={id} />
    </Suspense>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'foto':
      return <AcquisitionView key={route.param ?? 'nuova'} matchId={route.param} />;
    case 'partita':
      return route.param ? <MatchEditorView key={route.param} id={route.param} /> : <HomeView />;
    case 'tabellino':
    case 'grafici':
      return <ReportPage route={route} />;
    case 'storico':
      return <AthletesView />;
    case 'atleta':
      return route.param ? <AthleteRoute key={route.param} id={route.param} /> : <AthletesView />;
    case 'informazioni':
    case 'modulo':
      return <InfoView />;
    default:
      return <HomeView />;
  }
}

function LanguageMenu() {
  const { lang, m } = useI18n();
  return (
    <label className="vr-lang">
      <span className="vr-visually-hidden">{m.language.label}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
        {LANGUAGES.map((l) => (
          <option key={l.lang} value={l.lang} lang={l.lang}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  // The match the user worked on last: the Tabellino and Grafici tabs open it.
  const [lastMatch, setLastMatch] = useState<string | null>(() => readLastMatch());

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (route.param && ['partita', 'tabellino', 'grafici'].includes(route.name)) {
      setLastMatch(route.param);
      writeLastMatch(route.param);
    }
  }, [route]);

  // Scroll to the linked section, or to the top when changing page.
  useEffect(() => {
    const section = document.getElementById(route.name);
    if (section && isSectionPage(route)) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0 });
  }, [route]);

  const { m } = useI18n();
  const tab = tabOf(route);
  const tabHref = (key: Tab) => (key === 'tabellino' || key === 'grafici' ? href(key, lastMatch ?? SAMPLE_ID) : href(key));

  return (
    <ArchiveProvider>
      <nav className="vr-navbar" aria-label={m.nav.label}>
        <div className="vr-navbar-inner">
          <a className="vr-brand" href={href('partite')}>
            <img src={logo} alt="" />
            VolleyReport
          </a>
          <ul className="vr-nav-tabs">
            {TABS.map((key) => (
              <li key={key}>
                <a className={`vr-nav-item${tab === key ? ' active' : ''}`} aria-current={tab === key ? 'page' : undefined} href={tabHref(key)}>
                  {m.nav[key]}
                </a>
              </li>
            ))}
          </ul>
          <LanguageMenu />
        </div>
      </nav>

      <UpdateNotice />
      <GuideDialog />

      <main className="vr-shell">
        <Page route={route} />
      </main>

      <footer className="vr-footer">
        <div>
          <p>
            <strong>VolleyReport</strong> · {m.footer.tagline}
          </p>
          <p>
            {m.footer.idea} <ExternalLink href={VOLLEYREPORTXLS_URL}>VolleyReportXLS</ExternalLink>.
          </p>
        </div>
        <div className="right">
          <p>{m.footer.local}</p>
          <p>
            <ExternalLink href={LICENSE_URL}>{m.footer.license}</ExternalLink> ·{' '}
            <ExternalLink href={SOURCE_REPOSITORY_URL}>{m.footer.source}</ExternalLink>
          </p>
          <p>
            <ExternalLink href={releaseUrl(APP_VERSION)}>
              {m.footer.version} {APP_VERSION}
            </ExternalLink>
          </p>
        </div>
      </footer>
    </ArchiveProvider>
  );
}
