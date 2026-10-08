# Versioni, rilasci e build

VolleyReport è distribuito come versione web (https://report.volleyserve.it) e come applicazione installabile per Windows, macOS, Linux e Android, tutte prodotte da GitHub Actions a partire dallo stesso codice e dalla stessa versione.

## Versione

- **Unica sorgente**: il campo `version` di `package.json` (semver `X.Y.Z`). L'app la legge in fase di build (`__APP_VERSION__`, `src/version.ts`) e la mostra nel piè di pagina e nella pagina Informazioni, con link alla release.
- La stessa versione è ripetuta, perché gli strumenti la leggono da lì, in `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` e `src-tauri/Cargo.lock`.
  - `npm run release:version -- <patch|minor|major|X.Y.Z>` (`scripts/bump-version.mjs`) la aggiorna in tutti i file.
  - `scripts/check-version.mjs` verifica che coincidano; la CI lo esegue a ogni push e, per le release, controlla che coincidano anche con il tag.

## Procedura di rilascio

Una nuova versione si pubblica **solo su proposta e con conferma esplicita del maintainer**:

1. Si propone il tipo di versione (`patch` per correzioni, `minor` per nuove funzioni, `major` per cambi incompatibili) e il contenuto della release.
2. Dopo la conferma:
   ```bash
   npm run release:version -- minor      # oppure patch / major / X.Y.Z
   git add -A && git commit -m "Release vX.Y.Z"
   git tag -a vX.Y.Z -m "VolleyReport vX.Y.Z"
   git push origin main --follow-tags
   ```
3. Il push del tag avvia due workflow:
   - **Build applicazioni** (`.github/workflows/build-apps.yml`): installer per tutte le piattaforme, poi la **GitHub Release** `vX.Y.Z` con i pacchetti, le firme e `latest.json`;
   - **Versione web** (`.github/workflows/deploy-pages.yml`): pubblica la stessa versione su GitHub Pages.

Le build si possono provare anche senza rilasciare: *Actions → Build applicazioni → Run workflow*. I pacchetti restano come artefatti del workflow e non viene creata nessuna release.

## Pacchetti

| Piattaforma | File | Note |
|---|---|---|
| Windows x64 | `VolleyReport_X.Y.Z_x64-setup.exe`, `VolleyReport_X.Y.Z_x64_en-US.msi` | non firmati: SmartScreen può avvisare al primo avvio (*Ulteriori informazioni → Esegui comunque*) |
| macOS Apple Silicon | `VolleyReport_X.Y.Z_aarch64.dmg` | firma ad hoc: al primo avvio clic destro → *Apri* |
| macOS Intel | `VolleyReport_X.Y.Z_x64.dmg` | come sopra |
| Linux x64 | `VolleyReport_X.Y.Z_amd64.AppImage`, `VolleyReport_X.Y.Z_amd64.deb`, `VolleyReport-X.Y.Z-1.x86_64.rpm` | AppImage: `chmod +x` ed esegui |
| Android | `VolleyReport_X.Y.Z_android-universal.apk` (firmato) oppure `…-debug.apk` | arm64, armv7, x86_64; consentire l'installazione da origini sconosciute |

La pagina **Informazioni** dell'app elenca i file dell'ultima release leggendoli dall'API di GitHub (`src/platform/downloads.ts`): non c'è nulla da aggiornare a mano.

## Aggiornamenti automatici

All'avvio le app installate controllano se esiste una versione più recente e mostrano un avviso; l'utente sceglie *Aggiorna ora* o *Più tardi* (`src/platform/updates.ts`, `src/ui/components/UpdateNotice.tsx`). Il controllo si può disattivare dalla pagina Informazioni. A GitHub viene chiesto solo il numero dell'ultima versione.

- **Windows, macOS, Linux (AppImage, .deb, .rpm)**: plugin `tauri-plugin-updater`.
  - L'app legge `https://github.com/napo/volleyreportxls/releases/latest/download/latest.json`, scarica il pacchetto della propria piattaforma e ne verifica la firma con la chiave pubblica contenuta in `tauri.conf.json`.
  - Poi lo installa e si riavvia. Su Linux l'aggiornamento del `.deb` chiede la password di amministratore.
- **Android**: il plugin non esiste su mobile. L'app legge l'ultima release dall'API di GitHub e, se è più nuova, apre nel browser il download dell'APK firmato.
- **Web**: è sempre l'ultima release, nessun controllo.

### Chiave di firma degli aggiornamenti

- Chiave privata e password stanno **solo** sulla macchina del maintainer, in `~/.tauri-keys/volleyreport-updater.key` e `~/.tauri-keys/volleyreport-updater.password`.
- Su GitHub sono i secret `TAURI_SIGNING_PRIVATE_KEY` e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- La chiave pubblica è `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.
- **Conservarne una copia sicura**: senza la chiave privata le app già installate non possono più aggiornarsi da sole e andrebbero reinstallate a mano.

### Firma Android (facoltativa, consigliata)

Senza chiave viene pubblicato un APK *debug*, installabile ma che non può aggiornare un'installazione fatta con un'altra chiave. Per un APK firmato, sempre aggiornabile con la stessa chiave, servono i secret `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`. Il keystore va conservato con la stessa cura della chiave degli aggiornamenti. Il keystore attuale è `~/.tauri-keys/volleyreport-android.jks` (PKCS12, alias `volleyreport`, password in `volleyreport-android.password`, stessa per keystore e chiave), creato il 6/10/2026; i quattro secret sono configurati.

## Versione web e dominio

- GitHub Pages pubblica `dist/`, con il dominio personalizzato `report.volleyserve.it` (`public/CNAME`); l'app è servita dalla radice del sito.
- DNS: record `CNAME` `report.volleyserve.it → napo.github.io`.
- In *Settings → Pages*: *Source: GitHub Actions*, dominio personalizzato `report.volleyserve.it`, *Enforce HTTPS*.

## Build in locale

```bash
npm run desktop:dev                       # app desktop con ricarica a caldo
npm run desktop:build -- --bundles deb    # pacchetto Linux (richiede libwebkit2gtk-4.1-dev)
```

Gli identificativi: app `it.napolitano.volleyreport`, crate Rust `volleyreport`. Le icone (`src-tauri/icons/`) sono generate dal logo con `npx tauri icon src-tauri/app-icon.png -o src-tauri/icons`. I progetti Android e iOS in `src-tauri/gen/` vengono creati in CI da `tauri android|ios init` con le icone predefinite di Tauri: subito dopo il workflow rilancia `tauri icon src-tauri/app-icon.png`, che vi scrive quelle del logo.
