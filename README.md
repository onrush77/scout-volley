# Scout Volley

App di scout per la pallavolo che funziona **offline** su tablet e telefono.
Gira tutta nel browser: nessun server, nessun account, i dati restano sul dispositivo.

- `app/` — l'app (questa è la versione da usare)
- `tests/engine.test.js` — test delle regole (`node tests/engine.test.js`)
- `Scout_master.py` — vecchia demo Flask, tenuta solo come riferimento

## Installarla su tablet e telefono

Per funzionare offline l'app va aperta **una volta** da un indirizzo `https://`; poi si
aggiunge alla schermata Home e non serve più internet.

1. Pubblica la cartella `app/` su un hosting statico gratuito, per esempio:
   - **Netlify Drop**: vai su https://app.netlify.com/drop e trascina la cartella `app/`;
   - **GitHub Pages**: carica `app/` in un repository e attiva Pages.
2. Sul dispositivo apri l'indirizzo ottenuto:
   - **Android (Chrome)**: menu ⋮ → *Installa app* / *Aggiungi a schermata Home*;
   - **iPhone/iPad (Safari)**: pulsante Condividi → *Aggiungi alla schermata Home*.
3. Da quel momento si apre dall'icona anche in modalità aereo.

Per provarla sul PC: `cd app && python3 -m http.server 8000`, poi apri http://localhost:8000.

**Aggiornamenti:** dopo aver modificato i file, aumenta `VERSION` in `app/sw.js` e ripubblica;
i dispositivi prendono la nuova versione alla prima apertura con internet.

## Uso in partita

1. **Home**: in alto la guida *Come si usa*. La rosa parte **vuota**: inserisci i tuoi giocatori con
   i ruoli (alzatore, prima banda, seconda banda, primo centro, secondo centro, opposto, libero).
   Per provare l'app c'è *Prova con una rosa di esempio* (nomi segnaposto "Esempio …", non persone
   reali): un giocatore vero con lo stesso numero prende il posto di quello di esempio.
   Per creare una partita la rosa deve avere almeno **1 alzatore, 1 opposto, 2 bande e 2 centri**
   (il libero è facoltativo): sopra l'elenco i ruoli sono verdi se ci sono e rossi se mancano, e
   nel menu del ruolo è già proposto quello che manca.
   Poi nuova partita (avversario, formula, modalità avversari).
2. **Formazione del set**: tocca la posizione di partenza dell'alzatore (P1…P6) e la formazione 5-1
   si compone da sola dai ruoli (alzatore/opposto, bande e centri in diagonale). A lato puoi cambiare
   chi gioca in ogni ruolo e usare **Inverti bande** / **Inverti centri**. Chi batte si sceglie solo al
   1° set e al tie-break; negli altri set la battuta è alternata automaticamente.
3. **Scout** (in due tocchi):
   1. la barra in alto chiede cosa serve adesso (**Chi ha ricevuto?**, **Chi ha alzato?**,
      **Chi ha attaccato?**, …): tocca il giocatore sul campo;
   2. sotto al campo tocca **com'è andata** (pulsanti grandi). Il fondamentale previsto è già
      scelto; se serve un altro (es. muro invece di difesa) tocca la sua scheda sopra gli esiti.
      Quelli impossibili sono grigi (es. muro per chi è in seconda linea).
   - In **battuta** il P1 è già selezionato e quando tocca **alzare** è già selezionato
     l'alzatore: basta toccare l'esito (o un altro giocatore se ha alzato qualcun altro).
   - A sinistra (su tablet) vedi l'**azione in corso** tocco per tocco, gli **ultimi punti**,
     chi è in campo e la panchina.
   - **Ace avversario**: si apre "Ace su chi?" e scegli il nostro ricevitore; gli viene
     registrato l'errore in ricezione (il punto è contato una volta sola).
     In modalità rapida: tocca il ricevitore → Ricezione → *Errore / ace subito*.
   - La barra colorata sopra il campo dice sempre cosa fare. I giocatori che non si possono
     scegliere sono grigi con il motivo (doppio tocco, seconda linea a muro…).
   - **+1 NOI / +1 AVV** per i punti non registrati con un tocco (errore avversario, arbitro…).
   - **Annulla** toglie l'ultima azione, qualunque sia: tocco, punto, rotazione, cambio, fine set.
   - **Time-out** sempre visibili nel tabellone, uno per squadra (i pallini mostrano quanti ne restano).
   - Sotto il campo: **In campo** con ruolo e pulsante *Sostituisci* (per il libero *Cambia libero*),
     e **Panchina** aggiornata con la rotazione: centro uscito per il libero, secondo libero, riserve.
   - Il pulsante **?** (e *Guida* nel Menu) spiega la schermata; si apre da solo la prima volta.
   - Ogni esito ha sotto una breve spiegazione (es. *Muro normale — toccato, torna di là*).
   - **Muro**: *Muro secco* (punto), *Muro normale* (toccato, torna nel campo avversario),
     *Palla rigiocata* (tocco a muro, resta a noi), *Interdizione* (non tirano sul muro: sopra o
     altrove), *Mani out*, *Invasione*.
   - **Cambi**: può entrare qualsiasi giocatore della panchina. Chi entra **prende il ruolo di chi
     esce fino a fine set** (es. un opposto che entra per un centro conta come centro: il libero lo
     sostituisce in seconda linea). Dal set successivo torna al ruolo della rosa.
   - **Menu**: time-out, cambi, libero, correzioni di rotazione/battuta, modalità avversari,
     statistiche, esportazione.
   - Nell'Excel ogni voto ha anche il codice DataVolley (`# + ! - / =`).
4. Rotazione automatica al cambio palla. Libero automatico al posto del centrale in seconda
   linea (il centrale in P1 batte; quando batte l'avversario entra il libero).
5. Fine set a 25 (tie-break 15) con 2 punti di scarto: l'app chiede conferma.

### Modalità avversari
- **Zone**: registri i tocchi avversari per posizione.
- **Maglie**: con i numeri di maglia (statistiche anche per i loro giocatori).
- **Rapida**: registri solo noi; quando la palla torna tocchi direttamente il nostro giocatore.

## Statistiche ed esportazione
- In app: in alto il titolo dice partita, data, risultato e se i numeri sono di **tutta la partita**
  o di **un set**. Per giocatore e per set (battuta, ricezione positiva/perfetta, efficienza attacco,
  muri divisi in secchi / normali / palle rigiocate / interdizione, difesa) e **cambio palla / break per rotazione** (rotazione = posizione del palleggiatore).
- **Excel** (.xlsx): riepilogo, giocatori, giocatori per set, rotazioni, avversari, rally, tocchi.
- **Backup** (.json): la partita completa, reimportabile su un altro dispositivo dalla Home.

I dati stanno nella memoria del browser: **esporta un backup dopo ogni partita**.
Se cancelli i dati del browser o disinstalli l'app, le partite non salvate altrove si perdono.
