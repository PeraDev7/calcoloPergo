# 🚀 Guida Deploy su Vercel - Calcolo Pergosolar

Guida completa per deployare l'applicazione Calcolo Pergosolar su Vercel.

## 📋 Prerequisiti

1. Account Vercel (gratuito): https://vercel.com/signup
2. Git installato sul tuo computer
3. Repository Git (GitHub, GitLab, o Bitbucket)

## 🔧 Preparazione del Progetto

### 1. Verifica i File di Configurazione

Il progetto include già i file necessari:

- ✅ `vercel.json` - Configurazione Vercel
- ✅ `.vercelignore` - File da ignorare nel deploy
- ✅ `package.json` - Dipendenze Node.js
- ✅ `server.js` - Server Express

### 2. Inizializza Git (se non già fatto)

```bash
cd c:\Users\peron\Desktop\calcoloPergo
git init
git add .
git commit -m "Initial commit - Calcolo Pergosolar"
```

### 3. Crea un Repository su GitHub

1. Vai su https://github.com/new
2. Nome repository: `calcolo-pergosolar` (o come preferisci)
3. Lascia **privato** se contiene dati sensibili
4. **NON** inizializzare con README, .gitignore, o licenza
5. Clicca "Create repository"

### 4. Collega il Repository Locale a GitHub

```bash
git remote add origin https://github.com/TUO_USERNAME/calcolo-pergosolar.git
git branch -M main
git push -u origin main
```

Sostituisci `TUO_USERNAME` con il tuo username GitHub.

## 🌐 Deploy su Vercel

### Metodo 1: Deploy tramite Dashboard Vercel (Consigliato)

#### Passo 1: Accedi a Vercel
1. Vai su https://vercel.com
2. Clicca "Sign Up" o "Log In"
3. Connetti il tuo account GitHub

#### Passo 2: Importa il Progetto
1. Clicca "Add New..." → "Project"
2. Seleziona il repository `calcolo-pergosolar`
3. Clicca "Import"

#### Passo 3: Configura il Progetto
Vercel rileverà automaticamente le impostazioni:

- **Framework Preset**: Other
- **Root Directory**: `./`
- **Build Command**: (lascia vuoto)
- **Output Directory**: (lascia vuoto)
- **Install Command**: `npm install`

#### Passo 4: Deploy
1. Clicca "Deploy"
2. Attendi 1-2 minuti
3. Il tuo sito sarà disponibile su: `https://tuo-progetto.vercel.app`

### Metodo 2: Deploy tramite CLI Vercel

#### Passo 1: Installa Vercel CLI
```bash
npm install -g vercel
```

#### Passo 2: Login
```bash
vercel login
```

#### Passo 3: Deploy
```bash
cd c:\Users\peron\Desktop\calcoloPergo
vercel
```

Segui le istruzioni:
- Set up and deploy? **Y**
- Which scope? Seleziona il tuo account
- Link to existing project? **N**
- What's your project's name? `calcolo-pergosolar`
- In which directory is your code located? `./`

#### Passo 4: Deploy in Produzione
```bash
vercel --prod
```

## ⚙️ Configurazione Post-Deploy

### 1. Verifica il Funzionamento

Visita il tuo sito: `https://tuo-progetto.vercel.app`

Testa:
- ✅ Pagina principale carica correttamente
- ✅ Calcolo distanza funziona
- ✅ Selezione prodotti funziona
- ✅ Pagina Gestione Prodotti accessibile

### 2. Configurazione Dominio Personalizzato (Opzionale)

1. Vai su Vercel Dashboard → Il tuo progetto
2. Clicca "Settings" → "Domains"
3. Aggiungi il tuo dominio personalizzato
4. Segui le istruzioni per configurare i DNS

### 3. Variabili d'Ambiente (se necessario)

Se hai API keys o configurazioni sensibili:

1. Vai su Vercel Dashboard → Il tuo progetto
2. Clicca "Settings" → "Environment Variables"
3. Aggiungi le variabili necessarie

## 📝 Aggiornamenti Futuri

### Aggiornare il Sito

Ogni volta che fai modifiche:

```bash
# 1. Salva le modifiche
git add .
git commit -m "Descrizione modifiche"
git push

# Vercel farà automaticamente il deploy!
```

### Deploy Manuale (CLI)

```bash
vercel --prod
```

## 🔒 Limitazioni del Salvataggio su Vercel

**⚠️ IMPORTANTE**: Vercel è una piattaforma **serverless** e **read-only**.

### Cosa NON Funzionerà:
- ❌ Salvataggio modifiche nei file JSON
- ❌ Scrittura su file system
- ❌ Modifiche permanenti ai dati

### Soluzioni Alternative:

#### Opzione 1: Database Esterno (Consigliato)
Usa un database per salvare le modifiche:
- **MongoDB Atlas** (gratuito): https://www.mongodb.com/atlas
- **Supabase** (gratuito): https://supabase.com
- **PlanetScale** (gratuito): https://planetscale.com

#### Opzione 2: Deploy su Piattaforma con File System
Piattaforme che supportano scrittura file:
- **Railway**: https://railway.app
- **Render**: https://render.com
- **Fly.io**: https://fly.io
- **VPS tradizionale** (DigitalOcean, Linode, ecc.)

#### Opzione 3: Gestione Locale + Deploy Statico
1. Gestisci i dati localmente
2. Fai commit delle modifiche
3. Push su GitHub
4. Vercel aggiorna automaticamente

## 🛠️ Troubleshooting

### Errore: "Module not found"
```bash
# Assicurati che package.json sia corretto
npm install
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

### Errore: "Build failed"
Controlla i log su Vercel Dashboard → Deployments → Clicca sul deploy fallito

### API non funzionano
Verifica che `vercel.json` sia presente e corretto nel repository

### Google Maps non funziona
Aggiungi il dominio Vercel alle API restrictions su Google Cloud Console:
1. Vai su https://console.cloud.google.com
2. APIs & Services → Credentials
3. Modifica la tua API key
4. Aggiungi `*.vercel.app` ai domini autorizzati

## 📊 Monitoraggio

### Analytics Vercel
1. Vai su Vercel Dashboard → Il tuo progetto
2. Clicca "Analytics"
3. Visualizza traffico, performance, errori

### Logs
1. Vai su Vercel Dashboard → Il tuo progetto
2. Clicca "Deployments" → Seleziona un deploy
3. Clicca "Functions" per vedere i log del server

## 💡 Best Practices

1. **Commit frequenti**: Fai commit dopo ogni modifica importante
2. **Branch per sviluppo**: Usa branch separati per nuove funzionalità
3. **Test locale**: Testa sempre localmente prima di fare push
4. **Backup dati**: Fai backup regolari dei file JSON
5. **Documentazione**: Aggiorna README.md con le modifiche

## 🎯 Comandi Rapidi

```bash
# Sviluppo locale
npm start

# Commit modifiche
git add .
git commit -m "Descrizione"
git push

# Deploy manuale
vercel --prod

# Vedere logs
vercel logs

# Aprire dashboard
vercel open
```

## 📞 Supporto

- **Documentazione Vercel**: https://vercel.com/docs
- **Community Vercel**: https://github.com/vercel/vercel/discussions
- **Status Vercel**: https://www.vercel-status.com

## ✅ Checklist Pre-Deploy

- [ ] Git inizializzato
- [ ] Repository GitHub creato
- [ ] Codice pushato su GitHub
- [ ] Account Vercel creato
- [ ] Progetto importato su Vercel
- [ ] Deploy completato con successo
- [ ] Sito testato e funzionante
- [ ] Dominio configurato (opzionale)
- [ ] Google Maps API configurata per dominio Vercel

---

**Congratulazioni! 🎉** Il tuo progetto è ora live su Vercel!

URL: `https://tuo-progetto.vercel.app`
