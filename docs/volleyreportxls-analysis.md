<!--
SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
SPDX-License-Identifier: CC-BY-4.0
-->

# VolleyReport: analisi di VolleyReportXLS, definizioni DataVolley e progetto

Questo documento ricostruisce il funzionamento di `VolleyReportXLS.xlsx` e descrive come la nuova applicazione lo sostituisce. Il workbook dà la struttura della rilevazione (il modulo cartaceo, i codici, le righe per giocatore) ed è l'oracle per i conteggi. **L'interpretazione dei dati, cioè formule, tabellino e votazioni, segue invece DataVolley 4**, come richiesto.

Indice:

1. [Fonti e metodo](#1-fonti-e-metodo)
2. [Struttura dei fogli](#2-struttura-dei-fogli)
3. [Dati inseriti dall'utente](#3-dati-inseriti-dallutente)
4. [Codici di rilevazione](#4-codici-di-rilevazione)
5. [Modello concettuale](#5-modello-concettuale)
6. [Modello dati TypeScript](#6-modello-dati-typescript)
7. [Statistiche (definizioni DataVolley)](#7-statistiche-definizioni-datavolley)
8. [Tabellino e report](#8-tabellino-e-report)
9. [Anomalie del workbook](#9-anomalie-del-workbook)
10. [Verifica contro il workbook (oracle)](#10-verifica-contro-il-workbook-oracle)
11. [Architettura](#11-architettura)
12. [Modulo A4 fotografabile](#12-modulo-a4-fotografabile)
13. [Strategia di riconoscimento](#13-strategia-di-riconoscimento)
14. [Rischi tecnici](#14-rischi-tecnici)
15. [Roadmap](#15-roadmap)
16. [Decisioni](#16-decisioni)

---

## 1. Fonti e metodo

- **Workbook** `VolleyReportXLS.xlsx`: 24 fogli e circa 11.000 formule. I valori in cache contengono una partita reale di esempio: amichevole del 18/11/2023, vinta 3-0 (25-16, 25-18, 25-22), con 25 righe di rilevazione e 248 codici. Le formule in minuscolo (`if(`, `Text(`) fanno pensare a un file salvato con Google Sheets.
- **Manuale DataVolley 4** (`openvolleyscout/docs/datavolley-manual.pdf`, versione 4.02.36), sezioni usate:
  - §2.3.4 "Tabelle" (effetti per punto, pesi per indice, efficienza), lette dalle schermate delle impostazioni predefinite;
  - §4.1.1 "Valutazione" (significato dei simboli per fondamentale);
  - §9.7.1 "Tabellino" (layout, definizioni di V-P, Pos%, Prf%, errori avversari) e §9.7.1.1 (calcolo della votazione).
- **Articolo** "VolleyReportXLS" (Medium, 6/12/2023, fornito in PDF), da cui risulta che:
  - lo strumento è pensato come primo passo verso la match analysis, per chi non ha budget o persone dedicate, e rileva una sola squadra;
  - i simboli di valutazione sono quelli "divenuti standard grazie alla diffusione di DataVolley" (`#` doppio più, `=` doppio meno). È la conferma della scelta di adottare le definizioni DataVolley;
  - riporta la tabella dei codici (§4) e una **foto di un foglio reale compilato a mano** (§13);
  - dice che "gli stessi pesi di valutazione possono essere rivisti e riadattati". Per questo le tabelle sono configurabili (§7.1).

  Gli screenshot del tabellino nell'articolo si riferiscono a una versione precedente della partita d'esempio (set 25-8, 25-11, 25-13), quindi non sono usati come oracle.
- **Metodo**: ho estratto formule e valori calcolati con `openpyxl`, confrontato i blocchi che dovrebbero essere identici per isolare le anomalie, ricostruito la regola di ogni tabella, poi riscritto la logica con le definizioni DataVolley. Dove workbook e DataVolley definiscono lo stesso numero, il risultato è verificato cella per cella (§10).

## 2. Struttura dei fogli

| Foglio | Ruolo | Contenuto |
|---|---|---|
| `Istruzioni` | documentazione | uso dei fogli e significato dei codici |
| `Evento` | **input** | competizione, data, luogo, squadra, avversari, punteggi dei 5 set |
| `Atleti` | **input** | 14 righe (slot A–N): numero di maglia, ruolo (`L` = libero), nome |
| `Rilevazione` | **input** | 5 tabelle (una per set) di righe giocatore + sequenza di codici |
| `Gioc A` … `Gioc O` | calcolo | statistiche di un giocatore: partita + 5 set. I 15 fogli sono **copie identiche** in cui cambia solo il numero di maglia letto da `Atleti` |
| `Squadra` | calcolo | statistiche di squadra: partita + 5 set |
| `Tabellino` | **report** | tabellino finale (stesso schema di colonne del tabellino DataVolley) |
| `Vinti-Persi Squadra` | report | come sono stati vinti e persi i punti (torta) |
| `Grafici squadra` | report | istogrammi della distribuzione delle valutazioni (attacco, ricezione, battuta) |
| `Statistiche GIoc` | report | vista di un giocatore scelto da menu, più una sezione "Difesa" (§4) |

```text
Evento ─────────────────────────────────────────────┐
Atleti ──► Gioc A..O (VLOOKUP per numero di maglia) ─┼─► Tabellino ─► Vinti-Persi Squadra
Rilevazione ─┬─► Gioc A..O                           │
             └─► Squadra (COUNTIF su tutto il foglio) ┘──► Grafici squadra
```

## 3. Dati inseriti dall'utente

- **Evento**: `B1` competizione, `B2` data, `B3` luogo, `B4` squadra rilevata, `B5` avversari, `B6:B15` punteggi alternati squadra/avversari per i set 1–5. Dai punteggi si ricavano gli errori avversari.
- **Atleti**: slot `A`–`N` (righe 3–16) con numero, ruolo (solo `L`) e nome. Lo slot collega il giocatore al foglio `Gioc <slot>`.
- **Rilevazione**: 5 tabelle da 12 righe (set 1: righe 2–13, set 2: 16–27, set 3: 30–41, set 4: 44–55, set 5: 58–69). In colonna `B` c'è il numero di maglia del giocatore entrato in campo; dalla colonna `C` in poi i codici, nell'ordine in cui ha toccato il pallone, uno per cella. La riga più lunga dell'esempio ha 22 codici.

## 4. Codici di rilevazione

Un codice è **lettera del fondamentale + simbolo di valutazione**. Le lettere sono quelle del modulo VolleyReportXLS; **valutazioni e significati sono quelli standard di DataVolley** (manuale §4.1.1).

| Lettera | Fondamentale | Lettera DataVolley | Valutazioni ammesse |
|---|---|---|---|
| `B` | Battuta | S | `# + ! - / =` |
| `R` | Ricezione | R | `# + ! - / =` |
| `A` | Attacco | A | `# + ! - / =` |
| `M` | Muro | B | `# + ! - / =` |
| `P` | Alzata (palleggio) | E | `=` |
| `F` | Free ball | F | `# + - / =` |

**Vocabolario: 30 codici.** La difesa non si rileva (D14).

| | Battuta | Ricezione | Attacco | Muro | Alzata |
|---|---|---|---|---|---|
| `#` | punto diretto | perfetta (tutte le combinazioni) | vincente | vincente | — |
| `+` | positiva (l'avversario riceve `-`, una sola possibilità d'attacco) | positiva (nei 3 m, non tutte le combinazioni) | positivo (difeso con difficoltà, rigiochiamo noi) | positivo (toccata e rigiocabile da noi) | — |
| `!` | personalizzabile | personalizzabile | murato ma ripreso dalla nostra copertura | murato ma ripreso dall'avversario | — |
| `-` | scadente (l'avversario riceve `#`/`+`) | scadente (un solo attacco obbligato) | scadente (difeso facilmente) | scadente (rigiocabile dall'avversario) | — |
| `/` | mezzo punto (la ricezione avversaria torna nel nostro campo) | molto scadente (palla nel campo avversario) | murato (punto avversario) | invasione (punto avversario) | — |
| `=` | errata | errata (ace subito) | errato (fuori, rete, invasione) | errato (mani fuori, rete, palla a terra) | fallo fischiato dall'arbitro sul secondo tocco (doppia, trattenuta), per qualsiasi ruolo |

**Free ball** (`F`, aggiunta su decisione di progetto, significati DataVolley; nel vocabolario ma non sul modulo né nell'inserimento manuale): `#` offre al palleggiatore tutte le combinazioni; `+` il palleggiatore può servire tutti gli attaccanti, ma non agevolmente; `-` il palleggio può dare solo palla alta; `/` free ball di là o impossibile costruire un attacco; `=` errore.

**Codici originali di VolleyReportXLS** (tabella dell'articolo, coerente con il foglio `Istruzioni`): B, R e A con tutti e sei i simboli; Muro solo `M# M+ M! M=` (`M=` = invasione); Palleggio solo `P=` (doppia o portata), "valutato solo nel caso in cui porta vantaggio all'avversario". Le differenze di sfumatura tra articolo e `Istruzioni` (per esempio `R+` "soluzioni al centro difficili da giocare", `R-` "attacco obbligato a una o due soluzioni") non cambiano l'ordine delle valutazioni.

**Rispetto a VolleyReportXLS:**

- I significati coincidono nella sostanza per B, R e A.
- Nel **Muro** il workbook usava `=` per l'invasione; in DataVolley `=` è l'errore e `/` l'invasione, quindi `M/` è ora ammesso.
- L'**Alzata** (`P`) resta come nel workbook: solo `P=`, il fallo fischiato dall'arbitro sul secondo tocco (doppia, trattenuta), che può commettere qualsiasi ruolo (D15).
- La **Difesa** (`D`) non si rileva (D14): il workbook la contemplava solo nella sezione "Difesa" di `Statistiche GIoc`, con formule che puntano a righe sbagliate (W16).

**Normalizzazione**: maiuscole e spazi non contano, quindi `b#` e `B #` valgono `B#` (decisione confermata; il workbook scartava `B #` senza avviso, W11).

## 5. Modello concettuale

- **Partita** = intestazione (Evento) + squadra rilevata con il roster + fino a 5 set.
- **Set** = punteggio finale + elenco di **righe**: una per ogni giocatore entrato in campo, identificato dal numero di maglia, con la sequenza dei tocchi.
- **Evento** = un tocco (set, giocatore, posizione nella riga, codice). Le statistiche dipendono solo dai conteggi; l'ordine dei tocchi resta nel modello per il modulo cartaceo e per i controlli.
- **Squadra vs giocatori**: la squadra conta tutti gli eventi, anche quelli di righe senza numero o fuori roster; il giocatore solo i propri, su tutte le sue righe.
- **Set giocati da un giocatore**: i set in cui ha almeno una riga. Servono per la colonna "Set" e per il voto a muro.
- **Ciò che il foglio cartaceo non registra**: l'ordine dei rally, la squadra al servizio, le rotazioni. Dal foglio non si possono calcolare i break point (BP), i punti per rotazione, i cambi palla e i contrattacchi del tabellino DataVolley, né il voto aggiuntivo del palleggiatore (§8).
- **Ciò che registra la rilevazione sullo schermo** (tastierino e griglia, §17): ogni tocco con il suo orario e nel suo ordine (`SetRecord.log`), la formazione per zone, i cambi, la rotazione e lo scambio in corso. Da qui vengono le tabelle di cambio palla e break point (§8) e il file DataVolley per l'analisi video (§18). Le partite lette da foto restano senza sequenza.

## 6. Modello dati TypeScript

| Tipo | File | Descrizione |
|---|---|---|
| `Skill`, `Evaluation`, `ScoutCode`, `ScoutCodeString` | `domain/codes.ts` | vocabolario chiuso (union e template literal) |
| `SkillDefinition`, `SKILL_DEFINITIONS` | `domain/codes.ts` | valutazioni ammesse e significato DataVolley |
| `Player`, `Team`, `Match`, `MatchSet`, `SetScore` | `domain/model.ts` | roster e partita |
| `ScoutLine`, `CellRef`, `ScoutEvent` | `domain/model.ts` | riga del modulo con celle **grezze**, posizione di una cella, tocco valido |
| `ParseResult`, `ParseError` | `domain/parser.ts` | esito del parsing |
| `ScoutIssue` | `domain/events.ts` | codice non valido, numero mancante, giocatore fuori roster |
| `EvaluationTables`, `DATAVOLLEY_TABLES` | `domain/tables.ts` | tabelle DataVolley configurabili: effetti per punto, efficienza, pesi dell'indice |
| `SkillStats` e `ServeStats`, `ReceptionStats`, `AttackStats`, `BlockStats`, `SettingStats` | `domain/stats/skills.ts` | statistiche per fondamentale |
| `PointsSummary` | `domain/stats/summary.ts` | punti vinti, persi, V-P, persi per fondamentale |
| `RatingRules`, `PlayerRating` | `domain/stats/rating.ts` | votazione del tabellino |
| `StatLine`, `PlayerStats`, `TeamStats`, `SetStats`, `MatchStats`, `Scoreboard` | `domain/stats/aggregate.ts` | aggregazioni |
| `Tabellino`, `PointsBreakdown` | `report/tabellino.ts` | modello del tabellino DataVolley |

Pipeline (funzioni pure, nessuna dipendenza da browser o React):

```text
Match (celle grezze)
  └─ extractEvents()            → ScoutEvent[] + ScoutIssue[]
       └─ calculateStatLine()      → StatLine (con EvaluationTables)
            ├─ calculateTeamStats() / calculatePlayerStats() (+ calculatePlayerRating)
            ├─ calculateSetStats()   (+ errori avversari)
            └─ calculateMatchStats() → MatchStats
                 └─ buildTabellino()  → Tabellino ──► renderTabellinoPdf() → PDF A4
```

Esempio senza OCR (builder di `domain/testing.ts`):

```ts
const game = match(team([[7, 'Alice'], [9, 'Bea']]), [
  set(1, { team: 25, opponent: 20 }, [line(7, 'B# A# A= R='), line(9, 'M# P= R# A/')]),
]);
const tabellino = buildTabellino(game, calculateMatchStats(game));
const pdf = await renderTabellinoPdf(tabellino);
```

## 7. Statistiche (definizioni DataVolley)

### 7.1 Tabelle predefinite (manuale §2.3.4)

Lettere del modulo; tra parentesi quelle DataVolley.

| Fondamentale | Effetti vinc. | Effetti perd. | Efficienza "*E%" | Pesi indice `= / - ! + #` |
|---|---|---|---|---|
| Battuta B (S) | `#` | `=` | `(#+!/) / Tot` | 0, 8, 4, 0, 7, 10 |
| Ricezione R | — | `= /` | `(#+) / Tot` | −3, −3, −1, 0, 7, 10 |
| Attacco A | `#` | `= /` | `((#) − (/=)) / Tot` | 0, 0, 5, 0, 5, 10 |
| Muro M (B) | `#` | `= /` ¹ | `((#+) − (/=)) / Tot` | 0, 0, 0, 0, 0, 10 |
| Alzata P (E) | — | `=` | — (solo `P=`) | 0, 0, 0, 0, 7, 10 |
| Free ball F | — | `=` | `((#+) − (/=)) / Tot` | 0, 0, 0, 0, 0, 10 |

¹ Unica variazione rispetto ai valori predefiniti DataVolley (che per il muro hanno solo `=`): anche l'invasione `M/` fa perdere il punto (decisione di progetto).

- Battuta e ricezione usano la **positività** (quota di colpi positivi); attacco e muro l'**efficienza** (positivi − negativi). È il sistema della Nazionale Italiana adottato come predefinito da DataVolley.
- **Indice** = Σ(colpi × peso) / Tot × fattore (fattore 1).
- Le tabelle sono un parametro (`StatsOptions.tables`): come in DataVolley, un allenatore può personalizzarle.

### 7.2 Indicatori per fondamentale

| Indicatore | Definizione | Campo |
|---|---|---|
| conteggi, totale, distribuzione | per valutazione | `counts`, `total`, `distribution` |
| efficienza (*E%) | tabella §7.1 | `efficiency` |
| indice (Ind.) | tabella §7.1 | `index` |
| vinti / persi | effetti per punto | `won`, `lost` |
| Battuta Err / Pt | `=` / `#` | `ServeStats.errors`, `points` |
| Ricezione Err | `=` (ace subiti) | `ReceptionStats.errors` |
| Ricezione **Pos%** | `(# + +) / Tot` (positiva) | `positivity` |
| Ricezione **Prf%** | `# / Tot` (perfetta) | `perfectRate` |
| Attacco Err / Mur / Pt | `=` / `/` / `#` | `AttackStats.errors`, `blocked`, `points` |
| Attacco **Pt%** | `# / Tot` | `pointRate` |
| Muro Pt / errori / invasioni | `#` / `=` / `/` | `BlockStats.points`, `errors`, `invasions` |

Con zero tentativi ogni quota vale 0 nel dominio e `null` ("non applicabile") nel tabellino.

### 7.3 Punti

| Indicatore | Definizione (manuale §9.7.1) | Campo |
|---|---|---|
| Punti Tot | punti conquistati in battuta, attacco e muro (effetti vincenti: `B#`, `A#`, `M#`) | `summary.pointsWon` |
| Punti persi | persi in battuta, ricezione, attacco e muro (effetti perdenti: `B=`, `R=`, `R/`, `A=`, `A/`, `M=`, `M/`) | `summary.pointsLost` |
| **V-P** | vinti − persi | `summary.balance` |
| Persi per fondamentale | effetti perdenti di ogni fondamentale, anche muro e alzata | `summary.lostBySkill` |
| **Er.Av** (set) | punti del set − punti in battuta − in attacco − a muro | `calculateOpponentErrors` |
| Set vinti | set con punteggio maggiore | `calculateScoreboard` |

Il manuale DataVolley elenca i persi "in battuta, ricezione e attacco". Per decisione di progetto il V-P comprende anche il muro (`M=`, `M/`); restano fuori alzata e free ball (`P=`, `F=`), che compaiono comunque nei persi per fondamentale ([D3](#16-decisioni)).

### 7.4 Votazione (manuale §9.7.1.1)

| Voto | Formula | Condizione |
|---|---|---|
| Battuta | `(=·0 + -·4 + +·7 + /·8 + #·10) / Tot`, minimo 5,5 | ≥ 5% delle battute di squadra |
| Ricezione | `(=·−3 + /·−3 + -·−1 + +·7 + #·10) / Tot`, minimo 5,5 | ≥ 12% delle ricezioni di squadra |
| Attacco | `(=·0 + /·0 + -·5 + +·5 + #·10) / Tot`, minimo 5,5 | ≥ 7% degli attacchi di squadra |
| Muro | 8,5 se `M#` ≥ set giocati × 1; 8 se ≥ × 0,8; 7 se ≥ × 0,5 | altrimenti nessun voto |
| **Finale** | media dei voti ottenuti | nessun voto → nessuna votazione |

Il **voto aggiuntivo del palleggiatore** (attacchi della squadra dopo ricezione positiva mentre è in campo) richiede la sequenza dei rally e il ruolo, che il modulo non registra: non è calcolato.

## 8. Tabellino e report

### Tabellino (layout DataVolley §9.7.1)

- **Intestazione**: competizione, luogo, data; squadre con set vinti e punteggi finali dei set.
- **Una riga per giocatore** del roster:

| Gruppo | Colonne |
|---|---|
| Giocatore | N°, nome (L = libero) |
| Set | set giocati (1 2 3 4 5) |
| Voto | votazione §7.4 |
| Punti | Tot, V-P |
| Battuta | Tot, Err, Pt |
| Ricezione | Tot, Err, Pos%, (Prf%) |
| Attacco | Tot, Err, Mur, Pt, Pt% |
| Muro | Pt |

- **Totali squadra**.
- **Statistiche per set**: punti vinti (Bat, Att, Mur, Er.Av) e gli stessi gruppi battuta, ricezione, attacco, muro.
- **Errori avversari totali** e **legenda**.
- **Convenzioni di visualizzazione** DataVolley: zero e "non applicabile" come `.`, percentuali intere, Prf% tra parentesi, V-P con segno.
- **Cambio palla e break point** (solo per i tocchi inseriti sullo schermo, `domain/phases.ts`): attacco su ricezione positiva (`#`, `+`) e negativa (`!`, `-`), cioè il primo attacco dopo la ricezione; contrattacco, cioè ogni altro attacco; punti CP (scambi vinti in ricezione) e punti BP (scambi vinti in battuta), compresi quelli per errore avversario, riconosciuti dalla battuta che segue. Dopo `R=` e `R/` non c'è attacco su ricezione. La sezione compare nel tabellino e nel PDF solo se ci sono tocchi in sequenza.
- **Non riprodotti**: punti per rotazione e percentuali di cambio palla e break point sugli scambi giocati (servirebbero tutti gli scambi, anche quelli senza nostri tocchi).
- Rispetto al tabellino di VolleyReportXLS spariscono le colonne Eff% (non presenti in DataVolley) e il piede "Errori totali / Invasioni / Doppie"; si aggiungono Set e Voto.

### Esportazione PDF A4

`pdf/tabellino-pdf.ts` → `renderTabellinoPdf(tabellino): Promise<Uint8Array>`. È un PDF vettoriale A4 verticale, a una pagina, stampabile in bianco e nero, generato con `pdf-lib` direttamente dal modello. Non è una cattura della pagina, quindi il risultato è identico in browser, PWA, Capacitor e Tauri, e funziona offline.

- **Nome file**: `Squadra - Avversari 3-0 (25-16, 25-18, 25-22).pdf` (`tabellinoFileName`).
- **Font**: Roboto e Montserrat incorporati (vedi "Stile grafico").

### Altri report

- **Vinti-Persi**: `Tabellino.pointsBreakdown`. Vinti per battuta, attacco, muro ed errori avversari; persi per ogni fondamentale secondo gli effetti per punto, quindi l'attacco perde anche su `A/` e la ricezione su `R=` e `R/`.
- **Grafici** (scheda Grafici, **Apache ECharts** con importazione selettiva e renderer SVG, caricata solo all'apertura). I dati vengono da `report/chart-data.ts`, funzioni pure e testate; i grafici sono in `ui/charts/`.
  - *Squadra*:
    - riquadri con punti diretti, V-P, errori avversari, ricezione Pos%, attacco Pt%;
    - **valutazioni per fondamentale** in barre al 100% da `#` a `=`;
    - **punti vinti e persi** per fondamentale in barre divergenti, con gli errori avversari come riga dei soli vinti;
    - **andamento per set** di ricezione Pos% e attacco Pt%.
  - *Atleti*: selezione degli atleti, preimpostati i tre più coinvolti; confronto vinti/persi; per ognuno voto, punti, V-P e valutazioni per fondamentale. Grafici scaricabili in PDF A4 (squadra e atleti scelti).
  - **Colori**: quelli **ufficiali di VolleyReportXLS**, ricavati dal tema dei grafici del workbook. Sono una scelta di progetto: comunicano subito dove le cose vanno bene (verde) e male (rosso).
    - valutazioni: `#` `#00FF00`, `+` `#90EE90`, `!` `#ADFF2F`, `-` `#FFFF99`, `/` `#F79646`, `=` `#FF0000`;
    - vinti `#00FF00` / persi `#FF0000`.
    - Le verifiche di accessibilità segnalano contrasto basso sul bianco per i colori chiari e i due verdi chiari (`+`, `!`) vicini tra loro. I valori restano sempre leggibili con le etichette nei segmenti, la legenda, il tooltip e la tabella "Mostra i dati".
    - Le linee dell'andamento per set, che non indicano bene o male, usano blu `#1876A1` e arancio `#E96E23` del logo.
  - **Leggibilità**:
    - tooltip con valore e significato del codice per fondamentale; il colore segue l'ordine DataVolley del simbolo, ma in battuta `/` è un "mezzo punto" positivo e il tooltip lo dice;
    - "Mostra i dati" sotto ogni grafico, con la tabella dei valori;
    - legende HTML che vanno a capo;
    - etichette dentro i segmenti solo se c'entrano.
- **Scheda giocatore** (ex `Gioc X` / `Statistiche GIoc`): una sola vista parametrica sul numero di maglia, con tutti i fondamentali.

## 9. Anomalie del workbook

Restano documentate perché spiegano le differenze nei conteggi (§10).

**Con effetto sui valori confrontati (52 celle):**

| Id | Anomalia | Celle |
|---|---|---|
| **W1** | Range `COUNTIF` slittati di una colonna (`C:AH` nei fogli Gioc, `D:AO` in Squadra): il primo codice di una riga non viene contato per alcuni codici (Gioc: `R-` nei set, `B-` nella partita e nel set 1, `B/` set 2, `B!` set 3–5; Squadra: `R!`, `B+` partita, `B!` set) | 8 |
| **W2** | Percentuali con guardia o denominatore sbagliati (`IF(U5>0,Q5/U5,0)` con `U5` vuota, `IF(S2>0,…)`, `IF($G$69>0,…)`, …) | 8 |
| **W3** | Manca la formula del totale percentuale della battuta nel set 3 (`T35`) | 1 |
| **W5** | I totali del Tabellino sommano le righe 7:19 ed escludono lo slot N (#6); Vinti-Persi legge quei totali | 9 |
| **W6** | Righe set del Tabellino: la colonna Battuta "Tot" mostra i punti del set invece delle battute | 3 |
| **W7** | Righe set del Tabellino: la colonna Attacco "Mur" mostra i punti a muro invece degli attacchi murati | 3 |
| **W11** | `B #` (#22, set 2) scartato perché contiene uno spazio: l'ace manca da punti, battute ed errori avversari | 20 |

**Senza effetto sui valori dell'esempio, oppure superate da DataVolley:**

| Id | Anomalia |
|---|---|
| **W4** | "Errori" definito diversamente tra partita e set: superata, perché DataVolley usa gli effetti per punto |
| **W8** | Tabellino: `G9` legge `L11`; `O12` legge `R/` invece di `R=`; `O27` contiene `#REF!`; `H27` senza `ABS`. Squadra set 4: intestazione `B+` duplicata al posto di `B!` |
| **W9** | I fogli giocatore leggono con `VLOOKUP` solo la prima riga di un giocatore per set (max 30 codici); Squadra conta tutte le righe (38 codici); Squadra set 5 legge 7 righe su 12 |
| **W10** | 14 slot giocatore; `Gioc O` non raggiungibile |
| **W12** | Errori avversari con `ABS`: un'incoerenza tra punti registrati e punteggio sparisce |
| **W13** | Efficienze ≤ 0 mostrate come "-": superata, perché il tabellino DataVolley non ha colonne Eff% |
| **W14**, **W15** | Battuta "Efficacia" e "Positività" e V-P senza `A/`: superate dalle definizioni DataVolley |
| **W16** | Sezione "Difesa" di `Statistiche GIoc` con riferimenti a righe sbagliate |

Scelte: W1–W3 e W5–W10 sono corrette (errori di copia); con W11 gli spazi vengono ignorati; con W12 l'errore avversario vale `max(0, …)` con segnalazione di incoerenza.

## 10. Verifica contro il workbook (oracle)

- `tools/extract-oracle.py` (solo sviluppo, `openpyxl`) estrae gli input e i valori calcolati di **`Gioc A`** (i fogli giocatore sono copie identiche: ne basta uno), `Squadra`, `Tabellino` e `Vinti-Persi`, con l'indirizzo di ogni cella, in `src/oracle/volleyreportxls-oracle.json`.
- `src/oracle/compare.ts` abbina ogni cella estratta (1046) al valore TypeScript corrispondente. Le celle con una definizione diversa in DataVolley **non vengono confrontate ma etichettate** con la variazione che le spiega:

| Id | Variazione | Celle |
|---|---|---|
| `DV-EFF` | efficienze secondo la tabella DataVolley; il tabellino non ha Eff% | 90 |
| `DV-NONE` | indicatori solo VolleyReportXLS (efficacia/positività battuta, positività attacco, "Errori") | 38 |
| `DV-POS` | Pos% ricezione = `(#+)/Tot` invece di `(#+!)/Tot` | 30 |
| `DV-VP` | V-P secondo DataVolley | 17 |
| `DV-LOST` | punti persi in attacco comprendono `A/` | 2 |

- Restano **869 confronti** (conteggi, totali, distribuzioni, punti, Prf%, Pt%, errori avversari, set): **817 identici**, **52 differenze** registrate in `src/oracle/discrepancies.ts` e spiegate da W1–W11.
- Il test fallisce se compare una differenza non registrata, se una registrata cambia o scompare, o se cambia il numero di celle attribuite a ciascuna variazione DataVolley.
- I test unitari verificano le definizioni DataVolley su casi costruiti a mano (tabelle, indice, votazione, V-P, Pos%/Prf%, tabelle personalizzate), i PDF (tabellino, grafici, modulo), archivio e file `.vrp`. In totale **107 test**.

## 11. Architettura

```text
src/
  domain/            modello, vocabolario, parser, tabelle DataVolley, statistiche, votazione (TS puro)
  report/            modello del tabellino e convenzioni di visualizzazione
  pdf/               PDF del tabellino; poi layout e PDF del modulo di rilevazione
  oracle/            fixture e test di equivalenza con il workbook
  recognition/       interfaccia SymbolRecognizer, livelli di confidenza, implementazioni
  image-processing/  marker, omografia, rettifica, segmentazione celle
  storage/           repository su IndexedDB (match, roster, immagini, correzioni)
  ui/                componenti React; grafici con Apache ECharts
```

- `domain` non dipende da nessun altro modulo né da API del browser; `report` dipende solo da `domain`; `pdf` da `report` e `domain`.
- **Layout del modulo come sorgente unica**: `pdf/layout.ts` descriverà in millimetri marker, QR, righe e celle. Lo useranno sia il generatore PDF sia la segmentazione. Ogni versione resta disponibile, indicata dal QR.
- **Elaborazione immagini in un Web Worker**, con strutture semplici (`{width, height, pixels}`) testabili in Node.
- **Persistenza**: IndexedDB per match, roster, foto, crop e correzioni; `localStorage` solo per preferenze; `navigator.storage.persist()`.
- **Dataset futuro**: ogni correzione si salva in locale come `{ cellRef, crop, predicted, corrected, modelVersion, layoutVersion }`; esportazione solo opt-in, in futuro.
- **Distribuzione**: versione web su https://report.volleyserve.it (GitHub Pages) e app **Tauri 2** per Windows, macOS, Linux e Android, con aggiornamenti automatici. Versioni, rilasci e build sono descritti in [builds.md](builds.md).

### Stile grafico

- **Impaginazione e componenti** ripresi da Referto Volley (refertogara.volleyserve.it):
  - sfondo `#F4F4F4` e schede bianche con bordo sottile e raggio 12 px;
  - barra in alto con logo e navigazione a schede sottolineate;
  - presentazione iniziale con occhiello in maiuscoletto;
  - bottoni pieni scuri e bottoni chiari con bordo;
  - piè di pagina con crediti.
- **Font integrati nell'applicazione, mai caricati dalla rete**: Montserrat (titoli), Rubik (navigazione e bottoni), Roboto (testo).
  - Interfaccia: pacchetti `@fontsource-variable/*` (OFL), inclusi nel bundle.
  - PDF: Roboto Regular/Bold e Montserrat ExtraBold in `src/assets/fonts/` (TTF statici con licenze OFL), incorporati in ogni PDF con `@pdf-lib/fontkit`, solo i glifi usati. Il PDF appare identico su ogni dispositivo. I caratteri assenti dal font vengono traslitterati (`Ł` resta, `李` diventa `?`).
  - Verificato nel browser: nessuna richiesta esterna, i tre font web caricati dal bundle, PDF scaricati con i font incorporati (`pdffonts`: `emb yes`).
- **Logo e colori**: il logo di VolleyReportXLS (cartellina con pallone, estratto dal workbook: `src/assets/volleyreportxls-logo.png`). Palette ricavata dal logo:

| Ruolo | Colore |
|---|---|
| accento | blu notte `#062845` (hover `#1B4561`) |
| secondario | blu pallone `#1876A1` su `#E3F1F6` |
| evidenza | arancio `#E96E23`; testo `#B4500F` su `#FDEEE2` |

  I token sono in `src/ui/theme.css`.
- **PDF del tabellino**: stessa palette, con il logo nell'intestazione; resta leggibile in bianco e nero. Il modulo v7 colora soltanto le intestazioni con tinte pastello e mantiene bianche le aree lette dalla foto.

## 12. Modulo A4 fotografabile

Il modulo è **a crocette** (layout v7), generico e con un unico foglio per tutti i set: il set si segna a mano in alto. Per ogni pallone toccato si annerisce o si barra il primo pallino libero nella riga del giocatore, sotto fondamentale e valutazione. Le statistiche dipendono solo dai conteggi, quindi non si perde nulla rispetto ai codici scritti (`domain/tally.ts`). In compenso la lettura della foto diventa un riconoscimento di segni, molto più affidabile della scrittura a mano.

Coordinate in `pdf/layout.ts`, identità della pagina (QR) in `pdf/scouting-form.ts`, disegno in `pdf/scouting-form-pdf.ts`. Il PDF si scarica da *Informazioni → Il modulo di rilevazione*.

### Capacità delle caselle

Il numero di pallini per valutazione è calcolato su **559 partite DataVolley** (campionato italiano 2024/25, nazionali, Turchia), cioè 2.100 set e 36.643 giocatore-set. Si usa il 99° percentile del numero di tocchi di un giocatore in un set, con margine per i livelli più bassi: più attacchi `#`, `+` ed errori. Dalla v7 anche l’ultimo pallino vale un tocco. Se la casella è piena si continua su un foglio aggiuntivo dello stesso set, riportando lo stesso numero di divisa; i conteggi si sommano. Nei fogli fino alla v6 il pallino «+» resta una segnalazione da correggere nell’app.

| Righe giocatore (12) | `#` | `+` | `!` | `-` | `/` | `=` |
|---|---|---|---|---|---|---|
| Battuta | 6 | 9 | 6 | 9 | 6 | 6 |
| Ricezione | 9 | 9 | 9 | 9 | 6 | 6 |
| Attacco | 12 | 9 | 6 | 9 | 6 | 9 |
| Muro | 6 | 6 | 6 | 6 | 6 | 6 |
| Alzata | — | — | — | — | — | 6 |

| Righe Libero (2) | `#` | `+` | `!` | `-` | `/` | `=` |
|---|---|---|---|---|---|---|
| Ricezione (sotto quella dei giocatori) | 9 | 9 | 9 | 9 | 6 | 6 |
| Alzata (sotto quella dei giocatori) | — | — | — | — | — | 6 |

I liberi non battono, non attaccano e non murano: nelle loro righe quelle zone sono barrate. Il fallo di alzata (`P=`) è su ogni riga, perché può commetterlo qualsiasi ruolo.

### Layout v5 (A4 orizzontale, una pagina per tutti i set)

La v5 ha la griglia della v4. Cambia solo l'intestazione: il set non è più stampato ma si segna su cinque pallini, e un sesto pallino «Foglio aggiuntivo» dice che il foglio continua un set cominciato su un altro foglio. L'app legge il set dal pallino più segnato; se non ce n'è nessuno o ce ne sono due, lo chiede. Un foglio aggiuntivo si somma agli altri fogli dello stesso set (o al set già salvato) senza chiedere. I fogli v4 già stampati (una pagina per set, set nel QR) si leggono come prima. Se il QR non si legge, la v5 e la v4 non si distinguono e il set si sceglie a mano.

### Layout v6 (pallini più grandi, spazio per il nome)

Chi usava la v5 trovava i pallini troppo piccoli (2,7 mm), e chi ricorda il nome ma non il numero di divisa chiedeva dove scriverlo. La v6 mantiene marker, segni del set, righe (12 di gioco + 2 libero) e capienze della v5, e cambia così:

- **Intestazione compatta**: set, «Foglio aggiuntivo», squadra e avversari a sinistra del marker centrale; campionato, data e punteggio finale a destra; tutto alto quanto i marker. Il QR scende da 19 a 12 mm: l'app lo cerca prima nella posizione nuova, poi in quella dei fogli già stampati.
- **Liberi affiancati**: le righe libero usano solo ricezione e alzata, quindi stanno su un'unica riga, in due blocchi (numero e nome, ricezione, alzata `=`); il secondo parte sotto l'attacco. Lo spazio delle righe equivale a 13 invece di 14.
- **Pallini tutti da 3,2 mm, vuoti**: senza numero dentro (le prime stampe della v6, rilasciata con l'app 0.7.0, avevano il numero in grigio chiaro; la geometria è la stessa e si leggono allo stesso modo). Muro `-` e `/` passano da una a due colonne (5 pallini invece di 2), così nessuna casella costringe a rimpicciolire le altre.
- **Separatori tra i fondamentali** spessi (1,6 pt, quasi neri). Entrano per 0,28 mm nelle caselle accanto: la lettura della v6 ignora una fascia di 0,5 mm lungo il bordo delle caselle, lontana dai pallini (almeno 0,56 mm). Senza questa fascia le linee venivano contate come segni nelle caselle `=`.
- **Numero e nome**: due caselle per le cifre e sotto una riga per il nome. L'app non legge il nome, ma lo mostra nel ritaglio accanto al campo del numero.

Retrocompatibilità, verificata dai test: geometria di v3, v4 e v5 identica al millimetro, PDF v4 e v5 identici al pixel, foto reali v3 e fogli sintetici v4, v5, v6 letti come prima; con il QR illeggibile un foglio v5 viene letto con la griglia v5 (condivisa con la v4), un foglio v6 con la sua.

### Layout v7 (microlegende nelle intestazioni)

La bozza A diventa il modulo predefinito: descrizioni brevi sotto i simboli delle righe giocatore, intestazioni verde tenue per esiti favorevoli, giallo tenue per intermedi e rosa tenue per sfavorevoli. La mappa dipende da fondamentale e valutazione (`pdf/evaluation-style.ts`): per esempio `B/` è favorevole, `R/` e `A/` sfavorevoli, `A!` intermedio. Sono indicazioni qualitative, indipendenti dai pesi statistici. I grafici mantengono la palette esistente.

Testo scuro, simboli e descrizioni trasmettono il significato anche in bianco e nero; le tinte non sono l’unico riferimento. Le descrizioni complete restano nella guida. I liberi riutilizzano simboli e colori della ricezione, con la legenda descrittiva nell’intestazione principale. I pallini hanno diametro uniforme di almeno 3 mm. La fascia descrittiva richiede 7 mm aggiuntivi; la griglia mantiene 12 righe giocatore e due liberi affiancati.

Il QR identifica la nuova geometria (`VR|7|P1`). I layout precedenti restano disponibili per la lettura delle stampe esistenti; anche senza QR la v7 è distinguibile dalla griglia. Ogni pallino è contato: una casella piena non attiva richieste di totale. Prove sui PDF rasterizzati, anche compilati in scala di grigi, verificano i conteggi e il set; resta utile una prova con stampa e fotocamera reali.

**Foglio di esempio.** `npm run sample:sheet` genera un modulo compilato a caso (numeri, nomi, set, punteggio, tocchi plausibili per ruolo, pallini anneriti o barrati, `--full N` caselle con tutti i pallini segnati) e accanto un JSON con quello che l'app deve leggere. In `docs/examples/` ci sono `modulo-compilato.pdf`, la sua immagine `modulo-compilato.jpg` (da caricare nell'app senza stamparlo) e `modulo-compilato.json`. Lo stesso foglio illustra la guida introduttiva.


La v3 (con difesa e alzata valutata sulle righe libero) non è mai stata rilasciata ed è stata sostituita, non affiancata.

| Elemento | Posizione e misure |
|---|---|
| Marker ArUco `DICT_4X4_50`, id 0–5 | 12 × 12 mm, agli angoli a 7 mm dal bordo e al centro dei lati lunghi; zona di rispetto di 2 mm |
| Intestazione | "Set" con cinque pallini (1–5) e il pallino «Foglio aggiuntivo» (v4: "Set N" stampato); righe per squadra, avversari, campionato, data (promemoria cartaceo); istruzione d'uso |
| Punteggio finale | "Noi" e "Avversari", due caselle-cifra ciascuno |
| QR | 19 × 19 mm, in alto a destra; payload `VR\|5\|P<pagina>` (v4: `VR\|4\|S<set>\|P<pagina>`) |
| Numero di maglia | due caselle-cifra per riga, con bordo marcato |
| Pallini | tre file per casella, diametro circa 2,7 mm, numerati in grigio chiaro; fasce alternate e righe più marcate tra i fondamentali |

Marker e QR sono nero pieno. Pallini, numeri e linee sono grigi e sottili, così dopo la binarizzazione resta solo l'inchiostro. Un layout stampato non cambia mai: ogni modifica crea una nuova versione, tenuta in `FORM_LAYOUTS`.

### Verifiche

- **Fogli compilati a mano** (`raw_data/`, tenuti nel repository finché restano piccoli): tre pagine del layout v3 (set 1 e 2 compilati, set 3 vuoto). `image-processing/sheet.test.ts` verifica marker, QR, nessun tocco sul foglio vuoto e alcuni conteggi controllati a vista; il test si salta se la cartella manca.

- **Test automatici** (`pdf/layout.test.ts`, `pdf/scouting-form.test.ts`):
  - tutti gli elementi sono nella pagina;
  - le zone di rispetto dei marker sono libere e le caselle non si sovrappongono;
  - le mezze caselle misurano almeno 5 × 8 mm;
  - i codici `DICT_4X4_50` incorporati coincidono con quelli del rilevatore `js-aruco2`;
  - un'immagine sintetica del modulo a 3 e 6 px/mm viene riletta con 6 marker al loro posto (errore < 1 mm) e QR corretto.
- **Prove sul PDF rasterizzato:**

| Condizione | Marker | QR |
|---|---|---|
| PDF a 72 / 100 / 150 dpi | 6/6 | letto |
| Simulazione bassa risoluzione: prospettiva, rotazione 8–15° o 183°, sfocatura, ombra, rumore | 5/6 | non letto |
| Simulazione a risoluzione da telefono (≈ 12 px/mm) con le stesse degradazioni, **ridotta a 1000–2000 px** | 6/6 | letto |
| Stessa immagine a piena risoluzione (3800 px) | 0/6 | non letto |

**Conseguenza per la pipeline:** marker e QR si cercano su una **copia ridotta** della foto (circa 1400 px di lato), poi si calcola l'omografia e si raddrizza l'**originale** a piena risoluzione per ritagliare le caselle.

### Pipeline immagine (prossimo passo)

```text
foto → copia ridotta (~1400 px) → marker ArUco + QR → omografia (≥ 4 marker)
     → rettifica dell'originale (8–10 px/mm) → normalizzazione del contrasto
     → binarizzazione adattiva → raffinamento locale della griglia
     → per ogni pallino: inchiostro dentro il cerchio rispetto al vuoto → conteggi per casella → revisione
```

- `js-aruco2` funziona in Node (test) ma **non nel bundle per il browser**: assegna l'export a `this.AR`, in stile CommonJS. Per il rilevamento nell'app va adattato in modulo ES (licenza MIT) oppure sostituito.
- `image-processing/synthetic.ts` genera "scansioni" sintetiche del modulo dal layout, per testare la pipeline senza stampanti né fotocamere.

### Layout v8 e v9 (ordine dei fondamentali, colonne e righe a scelta)

- **v8** è il modulo standard: fondamentali nell'ordine dello scambio (battuta, muro, attacco, ricezione, alzata in fondo), valutazioni dalla più alla meno favorevole, fasce grigie alternate sulle righe.
- **v9** è la v8 personalizzata al momento del download, in tre passi:
  1. **colonne** `!` e `/` da togliere, fondamentale per fondamentale; le altre si allargano e i pallini diventano ovali;
  2. **ordine** di battuta, muro, attacco e ricezione (l'alzata resta in fondo);
  3. **righe** giocatore da 6 a 13 (12 è lo standard), sempre con i due liberi. Con 13 righe i pallini scendono a circa 2,8 mm; con meno righe crescono fino a circa 3,45 mm, poi lo spazio in più resta tra le righe.
- Il QR porta tutto ciò che si allontana dallo standard: `VR|9|P1|H<colonne>|O<ordine>|N<righe>` (per esempio `VR|9|P1|H20|ORBMA|N13`). Con tutto standard si scarica il modulo v8 pubblicato con il sito.
- **Senza QR leggibile**: le colonne tolte si riconoscono dalla posizione delle bolle; le righe dalle fasce grigie alternate. L'**ordine non si riconosce dalla foto** (le bolle stanno sulla stessa griglia di colonne qualunque sia l'ordine): l'acquisizione chiede l'ordine dei fondamentali e rilegge la foto. Resta un'ambiguità tra fondamentali vicini con colonne tolte diverse ma nello stesso numero.
- L'ordine scelto vale anche per la griglia e il tastierino del dispositivo, ed è proposto al download successivo.

## 13. Strategia di riconoscimento

Con il modulo a crocette il riconoscimento è soprattutto **lettura di segni**, senza scrittura a mano da interpretare:

1. **Rettifica**:
   - marker ArUco cercati sulla copia ridotta della foto, poi omografia;
   - QR letto dal ritaglio della sua posizione nota. Cercato sull'intera pagina a bassa risoluzione può confondersi con la griglia di cerchi, mentre dal ritaglio viene letto senza problemi.
2. **Pallini**: per ogni pallino si misura la quantità di inchiostro dentro il cerchio, al netto del cerchio e del numero stampati, rispetto a un pallino vuoto della stessa foto.
   - Il conteggio di una casella è il **numero di pallini segnati**, non il numero più alto: se se ne salta uno resta giusto.
   - Pallini pieni e barrati sono entrambi segni.
3. **Confidenza**:
   - i pallini con inchiostro vicino alla soglia sono incerti, e la casella viene evidenziata nella revisione;
   - sui fogli fino alla v6, un «+» segnato chiede il totale all’utente; dalla v7 tutti i pallini contano normalmente.
4. **Cifre**: si riconoscono ancora a mano solo il numero di maglia (due cifre per riga) e il punteggio (quattro cifre per foglio). È una classificazione 0–9, vincolata dai numeri ricorrenti nei set e dall'archivio della squadra, sempre da confermare nella revisione.
5. Nessun modello di intelligenza artificiale è necessario per i pallini; per le cifre basta un classificatore piccolo, eseguito nel browser, oppure l'inserimento manuale.

## 14. Rischi tecnici

| Rischio | Mitigazione |
|---|---|
| Segni ambigui: pallino toccato appena, segno a cavallo di due pallini, correzioni a penna | soglia rispetto a un pallino vuoto della stessa foto, caselle incerte evidenziate, conteggi sempre modificabili nella revisione |
| Caselle piene a livelli bassi (molti attacchi) | capacità calibrate su 559 partite con margine; prosecuzione su foglio aggiuntivo con lo stesso numero di divisa |
| Ombre, riflessi, foglio curvo | 6 marker, normalizzazione per blocchi, controllo dell'errore di riproiezione |
| Peso di OpenCV.js e ONNX su telefoni economici | pipeline leggera, worker, modelli piccoli |
| Storage cancellato (iOS) | `storage.persist()`, PWA installata, esportazione JSON |
| Pochi dati reali | trascrizione assistita come generatore di dati, k-NN locale, dati sintetici |
| Indicatori DataVolley non calcolabili dal modulo (BP, rotazioni, voto palleggiatore) | dal foglio esclusi e dichiarati nel report; dalla rilevazione sullo schermo cambio palla e break point (D18) |
| Pallini più piccoli con 13 righe (circa 2,8 mm) | provati su foto sintetiche; da verificare con stampa e foto reali prima di consigliarlo |
| Punteggio ricostruito nel file DVW diverso da quello reale | si ricostruisce bene solo con tutte le battute e le ricezioni in ordine; l'app segnala, set per set, le differenze con il punteggio scritto |
| Stampa scalata | scala ricavata dai marker |

## 15. Roadmap

Ordine rivisto sulle priorità indicate: prima il tabellino, poi il riconoscimento.

| Fase | Contenuto | Stato |
|---|---|---|
| **1 — Business logic** | dominio, parser, oracle | ✅ |
| **1b — Definizioni DataVolley + tabellino** | tabelle DataVolley, votazione, difesa, tabellino DataVolley, **PDF A4** | ✅ |
| **2 — Modulo di rilevazione** | modulo a crocette v4: 12 righe giocatore + 2 libero, capacità calibrate su 559 partite DataVolley, marker, QR | ✅ |
| **3 — Archivio e struttura** | IndexedDB (partite, foto, correzioni; squadre per nome + campionato con i nomi per numero di maglia), schede Partite / Revisione / Dati gara / Tabellino / Grafici / Approfondita | ✅ archivio IndexedDB con salvataggio automatico, elenco partite, editor della partita (dati gara, punteggio e tabella dei conteggi per set, atleti con nomi proposti dall'archivio, anomalie), tabellino e grafici di ogni partita salvata; foto e correzioni con la fase 4–5; Approfondita con la fase 6 |
| **4 — Acquisizione e rettifica** | più immagini per partita, una per set (caricate insieme o una alla volta; il set lo dice il QR); fotocamera o webcam con scatti in sequenza ("aggiungi un altro set"); marker, QR dal ritaglio, omografia, ritagli; modalità debug | ✅ foto multiple, fotocamera (webcam su computer, app fotocamera su telefono), trascinamento; marker, omografia, QR dal ritaglio; versione del modulo riconosciuta anche senza QR; lettura in un worker. Da fare: modalità debug, prove su foto reali da telefono |
| **5 — Revisione e dati gara** | tabella dei conteggi sempre modificabile a mano (✅ inserimento manuale) (totale dei tocchi per casella, stessa struttura del foglio, righe libero, totali); anomalie segnalate con "ricarica la foto" o "correggi a mano" (foglio non riconosciuto, QR illeggibile, set doppio, pallini incerti, "+" segnato, numero di maglia illeggibile, punteggio mancante o incoerente); punteggio letto dal foglio e confermato; gara, data, elenco atleti precompilato; alla conferma si apre il tabellino | ✅ schermata di revisione (set, ritagli dei numeri di maglia e del punteggio, caselle incerte o piene da correggere, set doppi, foto non riconosciute, copia dei numeri da un altro set), creazione della partita o aggiunta a una esistente |
| **6 — Grafici** | ECharts: squadra, poi per atleta con selettore (✅ sulla partita d'esempio); sezione "Approfondita" da fare | in parte |
| **7 — Riconoscimento** | lettura dei pallini (conteggi e confidenza), cifre dei numeri di maglia e dei punteggi | ✅ pallini: tratti e pallini contati e confrontati, caselle incerte segnalate. Cifre: per ora ritaglio mostrato e numero scritto dall'utente |
| **7b — Rilevazione su tablet** | seconda modalità accanto alla foto: il modulo v4 sullo schermo come foglio di contatori (stesse righe e colonne, numeri al posto dei pallini); tocco = +1, pressione prolungata o clic destro = −1, «Annulla» l'ultimo tocco, «Modalità −1»; «Chiudi set» chiede il punteggio (avviso se insolito, blocco solo sulla parità), il set successivo riprende i numeri di divisa, i set chiusi restano in sola lettura finché non si riaprono; salvataggio a ogni tocco, schermo sempre acceso. Stesso `MatchRecord` dei fogli fotografati (`matches/live.ts`, `ui/views/LiveSheetView.tsx`, pagina `#rileva/<id>` a schermo intero) | ✅ |
| **7c — Tastierino** | per smartphone: numero e fondamentale in ordine libero, poi la valutazione; legenda contestuale delle valutazioni; tasti disposti per zone; rotazione al cambio di servizio (opzionale per i tasti, sempre seguita per proporre chi batte); statistiche live; "+ riga" e "− riga" sulla griglia | ✅ (§17) |
| **7d — Analisi video** | sequenza dei tocchi con orario; file DataVolley `.dvw` per OpenVolleyScout, con scambi e punteggio ricostruiti; palleggiatore dedotto e confermato | ✅ (§18); da provare con un video vero in OpenVolleyScout |
| **8 — Packaging** | versione `0.1.0`, tag e release su GitHub, build Tauri (Windows, macOS, Linux, Android), versione web, aggiornamenti automatici | ✅ pronto, primo rilascio da confermare |

Le schermate minime necessarie a ciascuna fase (per esempio il caricamento della foto) si realizzano dentro quella fase.

## 16. Decisioni

| # | Questione | Stato |
|---|---|---|
| D1 | Correzioni delle anomalie W1–W10 | applicate |
| D2 | Indicatori di battuta | **deciso**: DataVolley (positività `#+!/`, indice, voto) |
| D3 | V-P | **deciso**: persi in battuta, ricezione, attacco **e muro** (`M=`, `M/`) |
| D4 | Definizione di "errori" | superata dagli effetti per punto DataVolley |
| D5 | Errori avversari incoerenti | 0 + segnalazione |
| D6 | Difesa | superata da D14 |
| D7 | Efficienze negative | superata (il tabellino DataVolley non ha Eff%) |
| D8 | `B #` | **deciso**: vale `B#` |
| D9 | Più righe dello stesso giocatore in un set | tutte contano |
| D10 | Articolo Medium | letto (PDF): conferma simboli DataVolley e pesi personalizzabili |
| D11 | Free ball | **deciso**: aggiunta (`F`, valutazioni DataVolley) |
| D12 | BP, rotazioni, cambio palla, voto del palleggiatore | **superata da D18** per la rilevazione sullo schermo; resta valida per il foglio cartaceo, a cui non si aggiungono campi |
| D13 | Quota con tentativi ma zero riusciti | mostrata come `0%` (il manuale non chiarisce se DataVolley mostri `.`) |
| D14 | Difesa | **deciso**: eliminata (né sul modulo, né nell'inserimento manuale, né nel vocabolario), per non togliere spazio al foglio |
| D15 | Alzata | **deciso**: solo `P=`, fallo fischiato sul secondo tocco, su ogni riga del modulo (vale per tutti i ruoli) |
| D17 | Lingua | **deciso**: italiano e inglese; al primo avvio la lingua di sistema (italiano se è italiano, altrimenti inglese); la scelta dal menu in alto a destra resta come predefinita; anche i PDF (tabellino, grafici, modulo) seguono la lingua |
| D16 | Esportazione delle partite | **deciso**: file `.vrp` (VolleyReport Paper), uno zip con `manifest.json` e `matches/<id>.json`; l'importazione non sovrascrive mai (dati diversi → copia con nuovo id) |
| D18 | Cambio palla e break point | **deciso**: calcolati dai tocchi inseriti sullo schermo, come le tabelle in fondo al tabellino DataVolley (attacco su ricezione, contrattacco, punti CP e BP, inclusi quelli per errore avversario) |
| D19 | Ordine dei fondamentali | **deciso**: a scelta per griglia, tastierino e modulo v9; l'alzata resta in fondo; nel QR, perché dalla foto non si riconosce |
| D20 | Numero di righe | **deciso**: da 6 a 13, sempre con due liberi; sul modulo nel QR, sulla griglia con "+ riga" e "− riga" (si toglie solo l'ultima riga vuota) |
| D21 | Analisi video | **deciso**: non in VolleyReport ma in OpenVolleyScout, tramite un file `.dvw` che OVS già importa; nessun secondo lettore video da mantenere |

## 17. Rilevazione sullo schermo: griglia e tastierino

La griglia (§15, fase 7b) riproduce il foglio come contatori; il tastierino, pensato per lo smartphone in verticale, inserisce un tocco alla volta.

- **Inserimento**: numero di divisa e fondamentale nell'ordine preferito, poi la valutazione; la fila che manca ha il bordo arancione. Con un fondamentale non da libero i tasti dei liberi si spengono; l'errore di alzata (una sola valutazione) si segna al secondo tocco.
- **Legenda**: toccando un fondamentale compare il significato di ogni valutazione, a destra sugli schermi larghi, sotto i pulsanti quando c'è altezza; non compare sugli schermi piccoli o in orizzontale.
- **Zone**: i sei tasti in campo sono disposti 4 3 2 a rete e 5 6 1 dietro, i liberi a destra; la formazione si scrive zona per zona.
- **Rotazione** (`matches/live.ts`): dopo una nostra battuta, una ricezione o un nostro errore in battuta (`B=`) significano che batte la squadra avversaria; alla battuta successiva tocca a chi segue nella rotazione, già selezionato toccando "Battuta". Dopo un ace resta chi ha battuto. Se la battuta cambia senza indizi (errore in battuta avversario dopo uno scambio perso), si tocca il numero di chi batte e la rotazione riparte da lì. L'opzione "Ruota al cambio di servizio" decide solo se i tasti si spostano. La rotazione è salvata con il set e "Annulla" la riporta indietro.
- **Statistiche live**: pannello aperto dal tastierino con le valutazioni di battuta, ricezione e attacco del set e della partita e frasi sul set per numero di divisa (per esempio "Maria (#4) ha sbagliato 3 battute"); colori per daltonismo rispettati.
- **Righe**: "+ riga" fino a 13 e "− riga" fino a 6, nella fascia dei liberi della griglia.
- **Sequenza**: ogni tocco è salvato con orario e ordine; toglierlo lo toglie dalla sequenza; le correzioni a mano nell'editor diminuiscono la sequenza ma non la aumentano.

## 18. File DataVolley per l'analisi video (OpenVolleyScout)

`matches/dvw.ts` produce un file `.dvw` dai tocchi inseriti sullo schermo, scaricabile dal tabellino ("Scarica dati in DVW"). OpenVolleyScout lo importa: lì si associa il video, si indica il primo tocco e si filtrano le azioni.

- **Contenuto**: solo la squadra rilevata (l'avversaria per nome), rosa, formazioni per zona, cambi, tocchi con orario e secondi dal primo tocco (tempo video).
- **Scambi e punteggio ricostruiti**: uno scambio inizia con una nostra battuta o ricezione; lo chiude un tocco decisivo (`B#`, `A#`, `M#` per noi; `B=`, `R=`, `A=`, `A/`, `M=`, `M/`, `P=` per l'avversaria) oppure lo rivela l'inizio dello scambio successivo. Una nostra battuta dopo uno scambio perso indica un errore in battuta avversario: punto nostro senza tocchi. Un cambio si scrive prima dello scambio in cui chi entra tocca il primo pallone.
- **Palleggiatore**: dedotto tra i sei in campo (chi non riceve e attacca meno, sui conteggi della partita), proposto alla chiusura del set e prima del download, dove si conferma o si cambia; la scelta resta nella partita.
- **Verifica**: il file passa importatore e controlli di OpenVolleyScout senza errori (restano gli avvisi attesi sulla squadra avversaria senza atleti). Dopo il download l'app dice, set per set, tocchi esportati, punteggio ricostruito e differenze con quello scritto.
- **Limiti**: l'orario è quello del tocco sullo schermo, qualche secondo dopo l'azione (in OVS si compensa con il ritardo per fondamentale); zone d'attacco e direzioni non ci sono; con il doppio palleggiatore se ne indica uno solo per set.

