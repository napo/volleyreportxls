<!--
SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
SPDX-License-Identifier: CC-BY-4.0
-->

# volleyreportxls

dalla carta al report della gara della propria squadra di volley

Evoluzione web di VolleyReportXLS: si rileva la partita a penna su un modulo A4 stampato dall'app, si fotografa il foglio e si ottengono tabellino e statistiche. Tutto viene elaborato sul dispositivo (local first).

Stato: business logic in TypeScript con le definizioni di DataVolley 4 (efficienze, V-P, votazione, tabellino), verificata contro il workbook di riferimento; tabellino esportabile in PDF A4.

- Analisi del workbook, architettura, modulo cartaceo e roadmap: [docs/volleyreportxls-analysis.md](docs/volleyreportxls-analysis.md)
- Logica di dominio: [src/domain](src/domain), tabellino: [src/report](src/report), PDF: [src/pdf](src/pdf)
- Test di equivalenza con il workbook: [src/oracle](src/oracle)

- Versione web: https://report.volleyserve.it · app per Windows, macOS, Linux e Android nelle [release](https://github.com/napo/volleyreportxls/releases/latest)
- Versioni, rilasci e build: [docs/builds.md](docs/builds.md)

```sh
npm install
npm test            # test unitari + confronto con VolleyReportXLS.xlsx (fixture JSON)
npm run typecheck
npm run dev
npm run oracle:extract   # rigenera la fixture dall'XLSX (richiede python3 + openpyxl)
npm run desktop:dev      # app desktop (Tauri)
uvx reuse lint           # titolare e licenza di ogni file (REUSE)
```

`VolleyReportXLS.xlsx` serve solo come riferimento e oracle di test: l'applicazione non lo legge mai.

## Licenza e riuso

Il codice è distribuito secondo i termini della GNU Affero General Public License v3.0 o successive ([LICENSE](LICENSE)); documentazione, immagini e il foglio `VolleyReportXLS.xlsx` secondo la [CC BY 4.0](LICENSES/CC-BY-4.0.txt). I font e l'icona PayPal hanno le licenze dei loro autori. Ogni file indica titolare e licenza con un'intestazione SPDX o in [REUSE.toml](REUSE.toml), secondo lo standard [REUSE](https://reuse.software); i testi completi sono in [LICENSES/](LICENSES/).

Chi riusa il codice, anche con un agente AI, trova in [AGENTS.md](AGENTS.md) le condizioni da rispettare: verificare la compatibilità delle licenze, conservare le note di copyright, informare sugli obblighi e segnalare le incompatibilità.
