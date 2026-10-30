<!--
SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
SPDX-License-Identifier: CC-BY-4.0
-->

# Come contribuire

Segnalazioni di errori e richieste di nuove funzioni sono benvenute nelle [issue](https://github.com/napo/volleyreportxls/issues). Il codice è distribuito con licenza AGPL-3.0-or-later e la documentazione con CC-BY-4.0: chi contribuisce accetta di rilasciare il proprio lavoro con le stesse licenze.

## Aggiungere una lingua

I testi dell'app, dei PDF e del modulo stanno in `src/i18n`.

1. Copia `src/i18n/en.ts` in un nuovo file con il codice della lingua, per esempio `src/i18n/es.ts`, e traduci i valori lasciando invariate le chiavi. Il tipo `Messages` segnala le voci mancanti.
2. Registra la lingua in `src/i18n/index.ts`: tipo `Lang`, elenco `LANGUAGES` e tabella `MESSAGES`.
3. Aggiungi il nome del PDF in `FORM_FILES` (`src/pdf/form-files.ts`) e la lingua in `scripts/form-pdfs-plugin.ts`, così il modulo viene generato anche in quella lingua.
4. Esegui `npm run typecheck` e `npm test`, poi apri una pull request.

Non serve saper programmare: se preferisci, apri una issue allegando le traduzioni e le inseriamo noi. I termini delle valutazioni e delle statistiche seguono quelli di DataVolley: in caso di dubbio chiedi nella issue.

## How to contribute (English)

Bug reports and feature requests are welcome in the [issues](https://github.com/napo/volleyreportxls/issues). Code is licensed under AGPL-3.0-or-later and documentation under CC-BY-4.0: contributions are released under the same licences.

To add a language, copy `src/i18n/en.ts` to a new file named after the language and translate the values, keeping the keys; register it in `src/i18n/index.ts` (`Lang`, `LANGUAGES`, `MESSAGES`), add the PDF name to `FORM_FILES` in `src/pdf/form-files.ts` and the language to `scripts/form-pdfs-plugin.ts`, run `npm run typecheck` and `npm test`, then open a pull request. If you do not program, open an issue with your translations and we will add them.
