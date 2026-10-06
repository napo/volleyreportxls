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
```

`VolleyReportXLS.xlsx` serve solo come riferimento e oracle di test: l'applicazione non lo legge mai.
