# Font per i PDF

Font incorporati nei PDF generati dall'app (tabellino e modulo di rilevazione), così il documento appare identico su ogni dispositivo e non dipende dai font installati.

| File | Origine | Licenza |
|---|---|---|
| `Roboto-Regular.ttf`, `Roboto-Bold.ttf` | `google/fonts` `ofl/roboto/Roboto[wdth,wght].ttf`, istanze statiche wght 400 / 700, wdth 100 | SIL OFL 1.1 (`OFL-Roboto.txt`) |
| `Montserrat-ExtraBold.ttf` | `google/fonts` `ofl/montserrat/Montserrat[wght].ttf`, istanza statica wght 800 | SIL OFL 1.1 (`OFL-Montserrat.txt`) |

Istanze generate con `fontTools.varLib.instancer`. I font dell'interfaccia web arrivano invece dai pacchetti `@fontsource-variable/*` (stessa licenza), inclusi nel bundle.
