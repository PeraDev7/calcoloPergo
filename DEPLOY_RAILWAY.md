# 🚂 Guida Deploy su Railway - Calcolo Pergosolar

Guida per deployare su Railway con supporto completo per il salvataggio dei file JSON.

## ⭐ Perché Railway?

Railway supporta:
- ✅ **Scrittura file system** - Salvataggio JSON funziona!
- ✅ **Deploy automatico** da GitHub
- ✅ **Piano gratuito** con $5/mese di crediti
- ✅ **Database integrati** (opzionale)
- ✅ **SSL automatico**

## 📋 Prerequisiti

1. Account Railway: https://railway.app
2. Repository GitHub del progetto
3. Git installato

## 🚀 Deploy Passo per Passo

### Passo 1: Prepara il Repository

```bash
cd c:\Users\peron\Desktop\calcoloPergo

# Inizializza git (se non già fatto)
git init
git add .
git commit -m "Initial commit"

# Crea repository su GitHub e pusha
git remote add origin https://github.com/TUO_USERNAME/calcolo-pergosolar.git
git branch -M main
git push -u origin main
```

### Passo 2: Accedi a Railway

1. Vai su https://railway.app
2. Clicca "Login" → "Login with GitHub"
3. Autorizza Railway ad accedere a GitHub

### Passo 3: Crea Nuovo Progetto

1. Clicca "New Project"
2. Seleziona "Deploy from GitHub repo"
3. Seleziona il repository `calcolo-pergosolar`
4. Clicca "Deploy Now"

### Passo 4: Configura il Progetto

Railway rileverà automaticamente Node.js e userà:
- **Build Command**: `npm install`
- **Start Command**: `npm start`

Se necessario, puoi modificare in Settings → Deploy.

### Passo 5: Configura la Porta

Railway assegna automaticamente una porta tramite variabile `PORT`.

Aggiorna `server.js` per usare la porta di Railway:

```javascript
const PORT = process.env.PORT || 3000;
```

(Questo è già configurato nel tuo server.js)

### Passo 6: Ottieni l'URL Pubblico

1. Vai su Settings → Networking
2. Clicca "Generate Domain"
3. Il tuo sito sarà disponibile su: `https://tuo-progetto.up.railway.app`

## ⚙️ Configurazione Avanzata

### Variabili d'Ambiente

1. Vai su Variables
2. Aggiungi variabili necessarie (es. API keys)
3. Clicca "Add" per salvare

### Volume Persistente (per file JSON)

Railway supporta volumi persistenti per salvare i dati:

1. Vai su Settings → Volumes
2. Clicca "New Volume"
3. Mount Path: `/app/data`
4. Sposta i file JSON in questa cartella

**Aggiorna server.js:**
```javascript
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || __dirname;

app.post('/api/salva/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const allowedFiles = ['costanti.json', 'prodotti.json', 'acessori.json', 'trasporti.json', 'gru.json'];
    
    if (!allowedFiles.includes(filename)) {
      return res.status(400).json({ error: 'File non consentito' });
    }

    const filePath = path.join(DATA_DIR, filename);
    const data = JSON.stringify(req.body, null, 2);
    
    await fs.writeFile(filePath, data, 'utf8');
    
    console.log(`✓ Salvato: ${filename}`);
    res.json({ success: true, message: `${filename} salvato con successo` });
  } catch (error) {
    console.error('Errore salvataggio:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Dominio Personalizzato

1. Vai su Settings → Networking
2. Clicca "Custom Domain"
3. Inserisci il tuo dominio
4. Configura i DNS come indicato

## 🔄 Aggiornamenti Automatici

Ogni push su GitHub triggera automaticamente un nuovo deploy:

```bash
git add .
git commit -m "Aggiornamento"
git push
```

Railway farà il deploy automaticamente in 1-2 minuti.

## 💰 Costi

### Piano Gratuito (Hobby)
- $5/mese di crediti gratuiti
- ~500 ore di runtime al mese
- Perfetto per progetti personali

### Piano Pro
- $20/mese
- Crediti illimitati
- Supporto prioritario

## 📊 Monitoraggio

### Logs in Tempo Reale
1. Clicca sul tuo progetto
2. Vai su "Deployments"
3. Clicca su un deployment
4. Vedi i logs in tempo reale

### Metriche
1. Vai su "Metrics"
2. Visualizza CPU, RAM, Network usage

## 🛠️ Troubleshooting

### Build Failed
```bash
# Controlla i logs
# Vai su Deployments → Clicca sul deploy fallito → View Logs
```

### File non salvati
Assicurati di usare un volume persistente (vedi sopra)

### Porta errata
Verifica che `server.js` usi `process.env.PORT`

## 🎯 Comandi CLI Railway (Opzionale)

### Installa Railway CLI
```bash
npm install -g @railway/cli
```

### Login
```bash
railway login
```

### Deploy da CLI
```bash
railway up
```

### Logs
```bash
railway logs
```

### Apri Dashboard
```bash
railway open
```

## ✅ Checklist Deploy

- [ ] Repository GitHub pronto
- [ ] Account Railway creato
- [ ] Progetto importato da GitHub
- [ ] Deploy completato
- [ ] URL pubblico generato
- [ ] Sito testato e funzionante
- [ ] Salvataggio JSON testato ✅
- [ ] Volume persistente configurato (se necessario)
- [ ] Dominio personalizzato (opzionale)

## 🆚 Railway vs Vercel

| Caratteristica | Railway | Vercel |
|---------------|---------|--------|
| Scrittura file | ✅ Sì | ❌ No |
| Database | ✅ Integrato | ⚠️ Esterno |
| Deploy automatico | ✅ Sì | ✅ Sì |
| Piano gratuito | ✅ $5/mese | ✅ Illimitato |
| SSL | ✅ Automatico | ✅ Automatico |
| Serverless | ❌ No | ✅ Sì |

**Consiglio**: Usa Railway se hai bisogno di salvare file JSON!

## 📞 Supporto

- **Documentazione**: https://docs.railway.app
- **Discord**: https://discord.gg/railway
- **Status**: https://status.railway.app

---

**Il tuo progetto è ora live su Railway con supporto completo per il salvataggio! 🎉**
