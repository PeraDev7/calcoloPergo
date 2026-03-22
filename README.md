# Calcolo Pergosolar

Applicazione web per la configurazione e il calcolo preventivi Pergosolar.

## Funzionalità

### Pagina Preventivo (index.html)
- Calcolo distanza da cantiere
- Selezione fino a 4 prodotti con possibilità di rimozione

### Pagina Gestione Prodotti (gestione-prodotti.html)
- **Personalizzazione completa di ogni prodotto**:
  - Ore installazione base (1 posto auto)
  - **Ore e peso personalizzati per ogni configurazione** (da 1 a 20 posti auto)
  - Ore installazione per ogni accessorio
  - Capacità mezzi di trasporto (bilico, camion gru, nostro mezzo)
  - Peso base e informazioni generali
- **Ricerca e filtri**: trova rapidamente i prodotti
- **Salvataggio persistente**: tutte le modifiche vengono salvate nel JSON
- **Interfaccia card moderna**: visualizzazione chiara di tutti i prodotti
- **Sistema toggle per accessori**: attiva/disattiva accessori per ogni prodotto
  - Selezione accessorio
  - Scelta modalità: solo fornito o fornito e installato
- **Gestione tecnici e noleggi** con interfaccia migliorata:
  - Controlli giorni con pulsanti +/- grandi e intuitivi
  - Visualizzazione costo in tempo reale
  - Toggle per muletto, scala aerea, gru
- **Servizi personalizzati** per casi particolari:
  - Aggiungi servizi extra non previsti nelle voci standard
  - Descrizione completamente personalizzabile
  - Costo libero
  - Note aggiuntive opzionali
  - Possibilità di aggiungere più servizi personalizzati
- **Modal parametri e costi** con possibilità di modificare e salvare:
  - Coordinate partenza
  - Costi noleggi
  - Dati prodotti (ore installazione, kg, capacità mezzi)
  - Dati accessori
  - Tabelle trasporti e gru

## Installazione

1. Installa Node.js se non già presente
2. Installa le dipendenze:

```bash
npm install
```

## Avvio

```bash
npm start
```

L'applicazione sarà disponibile su `http://localhost:3000`

## 🚀 Deploy in Produzione

### Opzione 1: Vercel (Consigliato per siti statici)
Deploy veloce e gratuito, ma **senza supporto per salvataggio file**.

📖 **[Guida completa Deploy Vercel](DEPLOY_VERCEL.md)**

### Opzione 2: Railway (Consigliato per salvataggio dati)
Supporta **scrittura file system** - il salvataggio JSON funziona!

📖 **[Guida completa Deploy Railway](DEPLOY_RAILWAY.md)**

### Confronto Rapido

| Caratteristica | Vercel | Railway |
|---------------|--------|---------|
| Salvataggio JSON | ❌ No | ✅ Sì |
| Deploy automatico | ✅ Sì | ✅ Sì |
| Piano gratuito | ✅ Illimitato | ✅ $5/mese |
| Setup | Facile | Facile |

**Raccomandazione**: Usa **Railway** se vuoi salvare le modifiche ai parametri!

## Utilizzo Gestione Prodotti

1. Dalla pagina principale, clicca su **📦 Gestione Prodotti**
2. Visualizza tutti i prodotti in formato card
3. Usa la barra di ricerca per trovare prodotti specifici
4. Filtra per numero di posti auto
5. Clicca su una card o sul pulsante "Modifica dettagli" per aprire il modal
6. Nel modal, personalizza:
   - **Ore Base**: ore installazione base e info generali
   - **Ore per Posto Auto**: imposta ore specifiche E peso (kg) per ogni configurazione (1-20 PA)
   - **Ore Accessori**: ore installazione per ogni accessorio
   - **Trasporto**: capacità mezzi (bilico, camion gru, nostro mezzo)
7. Clicca **Salva modifiche** per applicare le modifiche al prodotto
8. Clicca **💾 Salva tutte le modifiche** per salvare definitivamente su `prodotti.json`

## Utilizzo Modal Parametri

1. Dalla pagina principale, clicca su **⚙️ Parametri e costi**
2. Naviga tra i tab:
   - **Costanti**: coordinate partenza, costi noleggi
   - **Prodotti**: modifica ore installazione, kg, capacità mezzi per ogni modello
   - **Accessori**: modifica nomi e codici accessori
   - **Trasporti**: modifica fasce distanza e costi
   - **Gru**: modifica fasce distanza e costi gru
3. Modifica i valori nelle tabelle
4. Clicca **Salva modifiche** per salvare sui file JSON
5. Le modifiche vengono applicate immediatamente all'applicazione

## File JSON

- `costanti.json`: coordinate partenza
- `prodotti.json`: dati prodotti e ore installazione
- `acessori.json`: lista accessori
- `trasporti.json`: fasce distanza e costi trasporto
- `gru.json`: fasce distanza e costi gru

## Note

- Le modifiche salvate dal modal vengono scritte direttamente sui file JSON
- L'applicazione ricarica automaticamente i dati dopo il salvataggio
- Usa ESC per chiudere il modal
