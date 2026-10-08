/** Hash routes: "#tab", "#tab/param" (e.g. "#partita/k3x9…", "#tabellino/esempio"). */

/** Tabs of the main navigation, in order (their names are in the i18n texts). */
export const TABS = ['partite', 'tabellino', 'grafici', 'storico', 'informazioni'] as const;

export type Tab = (typeof TABS)[number];

/** Pages that live inside a tab. */
const PAGES = { partita: 'partite', foto: 'partite', atleta: 'storico', modulo: 'informazioni' } as const satisfies Record<string, Tab>;

export interface Route {
  readonly name: Tab | keyof typeof PAGES;
  readonly param: string | null;
}

/** The example match shown when no match of the user is selected. */
export const SAMPLE_ID = 'esempio';

export function parseRoute(hash: string): Route {
  const [name = '', param = null] = hash.replace(/^#/, '').split('/');
  if ((TABS as readonly string[]).includes(name) || name in PAGES) return { name: name as Route['name'], param: param || null };
  return { name: 'partite', param: null };
}

/** Pages that are a section of their tab's page: the app scrolls to the element with their name as id. */
export const isSectionPage = (route: Route) => route.name === 'modulo';

export const tabOf = (route: Route): Tab => (route.name in PAGES ? PAGES[route.name as keyof typeof PAGES] : (route.name as Tab));

export const href = (name: Route['name'], param?: string | null) => `#${name}${param ? `/${param}` : ''}`;

export function navigate(name: Route['name'], param?: string | null) {
  window.location.hash = href(name, param);
}
