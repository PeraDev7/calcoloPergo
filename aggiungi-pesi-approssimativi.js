/**
 * Script per aggiungere pesi approssimativi ai prodotti
 * Esegui con: node aggiungi-pesi-approssimativi.js
 */
const fs = require('fs');
const path = require('path');

const prodottiPath = path.join(__dirname, 'prodotti.json');

// Leggi il file prodotti
const prodotti = JSON.parse(fs.readFileSync(prodottiPath, 'utf8'));

// Aggiungi pesi approssimativi per ogni prodotto
prodotti.forEach(prodotto => {
  const pesoBase = prodotto.KG || 300;
  
  // Aggiungi KG_1PA se non esiste
  if (!prodotto.KG_1PA) {
    prodotto.KG_1PA = pesoBase;
  }
  
  // Calcola pesi approssimativi per 2-20 posti auto
  // Formula: peso aumenta del 85-90% per ogni posto auto aggiuntivo
  // (non è lineare perché ci sono economie di scala)
  for (let i = 2; i <= 20; i++) {
    const fieldName = `KG_${i}PA`;
    if (!prodotto[fieldName]) {
      // Peso approssimativo: peso base * i * 0.88 (88% per considerare economie di scala)
      const pesoApprossimativo = Math.round(pesoBase * i * 0.88);
      prodotto[fieldName] = pesoApprossimativo;
    }
  }
});

// Salva il file aggiornato
fs.writeFileSync(prodottiPath, JSON.stringify(prodotti, null, 2), 'utf8');

console.log('✅ Pesi approssimativi aggiunti con successo!');
console.log(`📊 Aggiornati ${prodotti.length} prodotti`);
console.log('📝 File salvato: prodotti.json');
