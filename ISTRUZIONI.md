# Planning Operai — Gama Service

Web app per la gestione del foglio presenze/assegnazioni mensile del personale (sostituisce l'Excel "FOGLIO PRESENZE PERSONALE").

## Funzionalità

- Vista MESE: griglia data × operaio identica al foglio Excel, con i 3 gruppi (PERSONALE / PRESIDIANTI / ARTIGIANI), weekend evidenziati, riga di oggi evidenziata
- Vista GIORNO: elenco operai con assegnazione del giorno, comoda da telefono
- Modifica celle (solo admin): tap sulla cella → scelte rapide (ASSENZA, FERIE, UFF, MALATTIA), preset cantieri, testo libero
- Pattern ricorrenti: assegna lo stesso cantiere a più operai per un intervallo di date, solo feriali (perfetto per i presidianti TELECOM/ENI)
- Gestione operai e preset cantieri da interfaccia
- Export Excel del mese corrente
- Importazione one-click dei dati di GIUGNO 2026 dal foglio originale (25 operai, 272 assegnazioni)
- Permessi: gli utenti nelle ADMIN_EMAILS modificano, tutti gli altri account vedono in sola lettura

## Setup (5 minuti)

1. **Firebase config** — apri `js/firebase-config.js` e incolla la config del progetto
   `gama-service` (Console Firebase → Impostazioni progetto → Le tue app).
   Verifica/aggiorna la lista `ADMIN_EMAILS`.

2. **Regole Firestore** — copia il blocco da `firestore.rules` (le due match
   `po_config` e `po_planning` + la funzione `isPlanningAdmin`) DENTRO le regole
   esistenti del progetto, PRIMA di eventuali regole generiche. Pubblica.

3. **Utenti** — in Firebase Authentication crea gli account (email/password):
   il tuo admin e, se vuoi, account di sola lettura per chi deve consultare.

4. **Deploy GitHub Pages** — crea un repo (es. `planning-operai`), carica tutti
   i file, attiva Pages dal branch main. Il file principale è già `index.html`.

5. **Primo avvio** — accedi come admin → tab ⚙️ Gestione → "Importa dati
   giugno 2026". Fatto: la griglia si popola con tutto il mese.

## Struttura dati Firestore

- `po_config/operai`  → `{ lista: [{id, nome, gruppo}] }`
- `po_config/cantieri` → `{ lista: ["TELECOM", ...] }`
- `po_planning/{YYYY-MM}` → `{ celle: { "<operaioId>_<GG>": "testo" } }`

Un documento per mese: leggero, veloce, storico infinito navigando ◀ ▶.

## Note

- Nessun template literal annidato nel codice (solo concatenazione di stringhe).
- I nomi con refusi del foglio originale sono stati corretti nel seed
  (PERSOMNALE→PERSONALE, SIMONONE TERRAGNI→SIMONE TERRAGNI, GIUSEPPEN→GIUSEPPE).
- Eliminare un operaio lo toglie dall'elenco ma NON cancella lo storico.
