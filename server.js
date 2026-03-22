/**
 * Server Node.js per servire l'applicazione e gestire il salvataggio dei JSON
 */
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/salva/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const allowedFiles = ['costanti.json', 'prodotti.json', 'acessori.json', 'trasporti.json', 'gru.json', 'trasferta.json'];
    
    if (!allowedFiles.includes(filename)) {
      return res.status(400).json({ error: 'File non consentito' });
    }

    const filePath = path.join(__dirname, filename);
    const data = JSON.stringify(req.body, null, 2);
    
    await fs.writeFile(filePath, data, 'utf8');
    
    console.log(`✓ Salvato: ${filename}`);
    res.json({ success: true, message: `${filename} salvato con successo` });
  } catch (error) {
    console.error('Errore salvataggio:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server avviato su http://localhost:${PORT}`);
  console.log(`📝 Puoi modificare i parametri e salvarli sui file JSON\n`);
});
