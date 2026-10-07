/**
 * The printable scouting form is the same for every match: it is made once at build time and
 * published as a plain file, one per language. Phones download a real file far more reliably
 * than one made in the page.
 */
import type { Lang } from '../i18n';

export const FORM_FILES: Readonly<Record<Lang, string>> = {
  it: 'forms/modulo-rilevazione.pdf',
  en: 'forms/scouting-form.pdf',
};
