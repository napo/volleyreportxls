<!--
SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
SPDX-License-Identifier: CC-BY-4.0
-->

# Font

Font incorporati nei PDF generati dall'app (tabellino e modulo di rilevazione), così il documento appare identico su ogni dispositivo e non dipende dai font installati; e il carattere ad alta leggibilità dell'interfaccia, scelto nel pannello Accessibilità.

| File | Origine | Licenza |
|---|---|---|
| `Roboto-Regular.ttf`, `Roboto-Bold.ttf` | `google/fonts` `ofl/roboto/Roboto[wdth,wght].ttf`, istanze statiche wght 400 / 700, wdth 100 | SIL OFL 1.1 (`OFL-Roboto.txt`) |
| `Montserrat-ExtraBold.ttf` | `google/fonts` `ofl/montserrat/Montserrat[wght].ttf`, istanza statica wght 800 | SIL OFL 1.1 (`OFL-Montserrat.txt`) |

| `AtkinsonHyperlegibleNext-latin-wght.woff2`, `AtkinsonHyperlegibleNext-latin-ext-wght.woff2` | `google/fonts` `ofl/atkinsonhyperlegiblenext`, file variabili (wght 200–800, solo dritto) nei sottoinsiemi latin e latin-ext pubblicati da Fontsource (`@fontsource-variable/atkinson-hyperlegible-next` 5.3.0) | SIL OFL 1.1 (`OFL-AtkinsonHyperlegibleNext.txt`) |

Istanze generate con `fontTools.varLib.instancer`. Il carattere ad alta leggibilità è nel repository, non scaricato da npm: l'app lo serve da sé e il browser lo scarica solo quando l'opzione è attiva. I font dell'interfaccia web arrivano invece dai pacchetti `@fontsource-variable/*` (stessa licenza), inclusi nel bundle.
