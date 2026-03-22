# ⚡ Quick Start - Deploy in 5 Minuti

Guida rapidissima per mettere online il progetto.

## 🎯 Scelta Piattaforma

### Vuoi salvare le modifiche ai parametri?

**SÌ** → Usa **Railway** 🚂
- ✅ Salvataggio JSON funziona
- ✅ File system scrivibile
- ✅ $5/mese gratuiti

**NO** → Usa **Vercel** ⚡
- ✅ Deploy istantaneo
- ✅ Completamente gratuito
- ❌ Solo lettura

---

## 🚂 Railway (5 minuti)

### 1. Prepara Git
```bash
git init
git add .
git commit -m "Initial commit"
```

### 2. Pusha su GitHub
```bash
git remote add origin https://github.com/TUO_USERNAME/calcolo-pergosolar.git
git push -u origin main
```

### 3. Deploy su Railway
1. Vai su https://railway.app
2. Login con GitHub
3. "New Project" → "Deploy from GitHub repo"
4. Seleziona il repository
5. "Deploy Now"
6. Settings → Networking → "Generate Domain"

**✅ FATTO!** Il tuo sito è online con salvataggio funzionante!

---

## ⚡ Vercel (3 minuti)

### 1. Prepara Git
```bash
git init
git add .
git commit -m "Initial commit"
```

### 2. Pusha su GitHub
```bash
git remote add origin https://github.com/TUO_USERNAME/calcolo-pergosolar.git
git push -u origin main
```

### 3. Deploy su Vercel
1. Vai su https://vercel.com
2. Login con GitHub
3. "Add New..." → "Project"
4. Seleziona il repository
5. "Deploy"

**✅ FATTO!** Il tuo sito è online (sola lettura)!

---

## 🔄 Aggiornamenti Futuri

Per entrambe le piattaforme:

```bash
git add .
git commit -m "Descrizione modifiche"
git push
```

Il deploy avviene **automaticamente**!

---

## 📖 Guide Complete

- **Railway**: [DEPLOY_RAILWAY.md](DEPLOY_RAILWAY.md)
- **Vercel**: [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md)

---

## ⚠️ Importante

### Railway
- ✅ Salvataggio parametri funziona
- ✅ Modifiche persistenti
- 💰 $5/mese gratuiti (~500 ore)

### Vercel
- ❌ Salvataggio NON funziona
- ⚠️ Dati solo lettura
- 💰 Completamente gratuito

**Scegli in base alle tue necessità!**
