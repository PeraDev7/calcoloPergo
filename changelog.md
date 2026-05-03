# Changelog - 03 Maggio 2026

## Novita e Miglioramenti Principali

### Trasparenza e Dettaglio Calcoli
- Nuova Sezione "Scopri tutti i calcoli": Implementato un accordion interattivo nella dashboard che mostra il breakdown analitico di ogni voce di spesa.
- Dettaglio Ore: Visualizzazione granulare delle ore di montaggio struttura, ore accessori e ore di trasferta.
- Dettaglio Logistica: Esplicitazione della distanza A/R calcolata, del mezzo utilizzato e della tariffa chilometrica applicata.
- Dettaglio Noleggi: Elenco puntuale di ogni attrezzatura con relativi giorni di utilizzo e costi unitari.

### Gestione Parametri e Persistenza
- Centralizzazione Costi: Spostati i costi di noleggio (Muletto, Scala, Camion Gru) nel file di configurazione costanti.json per una gestione non hard-coded.
- Ricalcolo Immediato: Ottimizzato il flusso di aggiornamento: ogni modifica ai parametri (sconti, costi orari, etc.) triggera ora un ricalcolo istantaneo della dashboard senza perdere le selezioni correnti dell'utente.
- Sincronizzazione Stato: Migliorata la persistenza dei dati tra le diverse sezioni dell'app.

### Precisione e Formattazione
- Arrotondamento Centesimale: Implementata la precisione rigorosa a 2 cifre decimali per tutti i calcoli di distanza (km) e costi (EUR), eliminando gli artefatti del calcolo in virgola mobile (es. .000000000001).
- Metriche per Posto Auto: Aggiunto il calcolo del costo unitario "per posto auto" nei riepiloghi di Manodopera, Trasporto e Noleggi.

### Correzioni e Stabilita
- Bug Fix Sintassi: Risolti errori di runtime (ReferenceError: mulActv is not defined) e di parsing che bloccavano l'esecuzione in particolari configurazioni.
- Feedback UI: Migliorata la messaggistica nella sezione dettagli quando i dati sono incompleti (es. indirizzo mancante o calcolo non avviato).
- Refactoring Logica Trasporto: Ottimizzata la gestione della capacità di carico per gli accessori e i relativi viaggi supplementari.

## File Modificati
- js/app.js: Core della logica di calcolo e nuova funzione di breakdown tecnico.
- index.html: Struttura della nuova sezione accordion.
- css/style.css: Styling premium per la sezione dettagli e i nuovi componenti UI.
- costanti.json: Espansione dello schema per includere i parametri noleggi.
