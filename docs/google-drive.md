<!--
SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
SPDX-License-Identifier: CC-BY-4.0
-->

# Sincronizzazione con Google Drive

Chi usa l'app può collegare il proprio Google Drive, dispositivo per dispositivo: l'archivio (partite, rose, atleti, raggruppamenti di squadre) viene copiato nel file `VolleyReport/VolleyReport.vrp` del suo Drive e tenuto allineato tra i dispositivi collegati allo stesso account.

## Come funziona

- **Permesso richiesto**: solo `https://www.googleapis.com/auth/drive.file`. L'app vede soltanto i file che crea lei (la cartella «VolleyReport» e il file), non il resto del Drive.
- **File**: un `.vrp` (zip) come quelli dell'esportazione, con in più `teams.json` (nomi noti per squadra) e `deletions.json` (cancellazioni). Si può scaricare e importare a mano con «Importa». Cartella e file sono riconosciuti da una proprietà dell'app (`appProperties`), quindi l'utente può spostarli o rinominarli.
- **Quando**: all'avvio, 4 secondi dopo ogni modifica, al ritorno nell'app (se l'ultima sincronizzazione ha più di 30 secondi), ogni 5 minuti con l'app aperta, al ritorno della rete.
- **Unione** (`src/sync/merge.ts`): ogni record ha la data dell'ultima modifica, ogni cancellazione lascia una traccia datata (tenuta 400 giorni). Rispetto all'ultima sincronizzazione, se un record è cambiato da una parte sola vince quella; se è cambiato da entrambe vince la modifica più recente e, per le partite, l'altra versione resta come copia con un nuovo id.
- **Concorrenza**: prima di caricare il file l'app controlla che la versione su Drive non sia cambiata; se un altro dispositivo l'ha aggiornato nel frattempo, ripete tutto il giro. Le modifiche fatte sul dispositivo durante una sincronizzazione non vengono sovrascritte.
- **Nessun server**: i token restano sul dispositivo e i dati vanno direttamente dal dispositivo al Drive.

## Accesso a Google per piattaforma

| Piattaforma | Client OAuth | Flusso | Rinnovo dell'accesso |
|---|---|---|---|
| Web | Applicazione web | Google Identity Services, token model (`src/sync/auth-web.ts`) | Il token dura un'ora; poi serve un tocco su «Sincronizza ora» |
| Windows, macOS, Linux | App desktop | Browser di sistema, ritorno su `127.0.0.1` (RFC 8252, `src-tauri/src/oauth.rs`), PKCE | Refresh token sul dispositivo, senza chiedere |
| Android | Android | API di autorizzazione di Google Play services, dal plugin Kotlin `src-tauri/plugins/google-auth` (`src/sync/auth-android.ts`); il client è riconosciuto da pacchetto e certificato, il suo ID non viene usato dall'app | Silenzioso dopo il primo consenso |
| iOS | iOS | Da completare: browser di sistema e ritorno con lo schema URL del client | Refresh token sul dispositivo |

Nelle app installate le richieste a Google passano da `tauri-plugin-http` (capability `src-tauri/capabilities/google-drive.json`, limitata agli indirizzi di Google necessari).

## Configurazione su Google Cloud (una volta)

1. Crea un progetto su <https://console.cloud.google.com> (per esempio «VolleyReport»).
2. **API e servizi → Libreria**: abilita **Google Drive API**.
3. **Google Auth Platform → Branding**:
   - nome dell'app «VolleyReport», email di assistenza, logo (`src/assets/volleyreportxls-logo.png`, 120×120);
   - home page `https://report.volleyserve.it/`;
   - privacy policy `https://report.volleyserve.it/privacy.html` (pagina `public/privacy.html` di questo repository);
   - dominio autorizzato `volleyserve.it` (va verificato in Google Search Console).
4. **Audience**: tipo «Esterno», poi **Pubblica l'app** (in produzione). In modalità di test l'accesso è limitato agli utenti di test e i refresh token scadono dopo 7 giorni.
5. **Accesso ai dati**: aggiungi l'ambito `.../auth/drive.file`. Google lo considera un ambito non sensibile: dovrebbe bastare la verifica del branding, senza la verifica di sicurezza prevista per gli ambiti sensibili (da confermare al momento della richiesta).
6. **Client**: crea un client per piattaforma.
   - **Applicazione web**: origini JavaScript autorizzate `https://report.volleyserve.it` e, per lo sviluppo, `http://localhost:5173`. Nessun URI di reindirizzamento.
   - **App desktop**: annota ID client e client secret (per Google non è un segreto: è pubblico in ogni app installata).
   - **Android**: nome del pacchetto `it.napolitano.volleyreport` e impronta SHA-1 del certificato di firma. Per l'APK firmato:
     `keytool -list -v -keystore ~/.tauri-keys/volleyreport-android.jks -alias volleyreport`.
     Per provare gli APK di debug serve un secondo client Android con lo SHA-1 del keystore di debug.
   - **iOS**: ID bundle `it.napolitano.volleyreport`.
7. Copia gli ID in `GOOGLE_OAUTH` di `src/config.ts`. Con un ID vuoto la sincronizzazione resta nascosta su quella piattaforma.
8. Il client secret del desktop non va nel repository (la scansione dei segreti di GitHub e Google lo segnalerebbe): si legge al momento della build dalla variabile `VITE_GOOGLE_DESKTOP_CLIENT_SECRET`.
   - in locale, nel file `.env.local` (escluso da git): `VITE_GOOGLE_DESKTOP_CLIENT_SECRET=GOCSPX-…`;
   - nelle build di GitHub, dal secret del repository `GOOGLE_DESKTOP_CLIENT_SECRET` (`gh secret set GOOGLE_DESKTOP_CLIENT_SECRET`).
   Senza secret la sincronizzazione resta nascosta sul desktop. Il secret finisce comunque nell'app installata: per Google non è riservato.

## Dropbox

Oltre a Google Drive l'app può usare Dropbox, uno per dispositivo (`src/sync/provider-dropbox.ts`, `src/sync/dropbox.ts`). I servizi si escludono a vicenda: ogni dispositivo ne usa uno alla volta e quelli su servizi diversi non si allineano tra loro; l'app lo spiega nel riquadro di sincronizzazione, nelle FAQ e nelle informazioni. Per ora è disponibile su web e desktop: Dropbox documenta come ritorno solo indirizzi https e localhost, quindi Android e iOS richiedono un link https che riapra l'app.

- **App**: «VolleyReport» nella console di Dropbox, accesso circoscritto, tipo cartella dell'app, client pubblici consentiti. La chiave è in `DROPBOX_OAUTH` di `src/config.ts`; il segreto non serve.
- **Autorizzazioni**: `files.content.read`, `files.content.write`, `files.metadata.read`.
- **Indirizzi di ritorno registrati**: `https://report.volleyserve.it/oauth-callback.html` (web, finestra e `public/oauth-callback.html`) e `http://localhost:53682/` (desktop, porta fissa perché Dropbox vuole l'indirizzo esatto).
- **File**: `VolleyReport.vrp` nella cartella dell'app, riconosciuto dal percorso. La scrittura è condizionata alla revisione (`rev`): se un altro dispositivo ha scritto prima, l'app ripete il giro.

## OneDrive

Disponibile su web e desktop per gli account Microsoft personali (`src/sync/provider-onedrive.ts`, `src/sync/onedrive.ts`), con le stesse regole di esclusività di Dropbox.

- **App**: «VolleyReport» in Microsoft Entra, solo account personali. Registrarla richiede una directory, creata con un account Azure. L'ID client è in `ONEDRIVE_OAUTH` di `src/config.ts`; nessun secret.
- **Indirizzi di ritorno**: piattaforma SPA `https://report.volleyserve.it/oauth-callback.html` e `http://localhost:5173/oauth-callback.html`; piattaforma Mobile e desktop `http://localhost` (la porta è ignorata). Sul desktop la richiesta dei token va senza `Origin`, che Microsoft rifiuta fuori dalle SPA: per questo `tauri-plugin-http` ha la funzione `unsafe-headers`.
- **Autorizzazioni**: `Files.ReadWrite.AppFolder`, `offline_access`.
- **File**: `VolleyReport.vrp` nella cartella dell'app, riconosciuto dal percorso. La scrittura è condizionata all'`eTag` (`If-Match`). Lo scaricamento usa l'indirizzo temporaneo dato da Graph: gli host ammessi sul desktop sono in `src-tauri/capabilities/onedrive.json`.
- **Durata dell'accesso**: 24 ore sul web (limite Microsoft per le SPA), poi basta un tocco; senza scadenza dichiarata sul desktop.

## Privacy

Collegare Drive è una scelta esplicita, presentata con una schermata che spiega cosa succede. Finché non si collega, l'app non contatta Google (lo script di Google per il web si carica solo dopo la scelta). «Scollega» lascia i dati sul dispositivo, cancella i token, revoca l'accesso e, se richiesto, sposta il file nel cestino del Drive.
