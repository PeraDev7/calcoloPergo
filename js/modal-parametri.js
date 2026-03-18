/**
 * Modal Parametri e Costi - Gestione modifiche e salvataggio su JSON
 */
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let modalState = {
    costanti: null,
    prodotti: [],
    accessori: [],
    trasporti: [],
    gru: [],
  };

  function apriModal() {
    const modal = $('#modal-parametri');
    if (modal) {
      modal.hidden = false;
      caricaDatiNelModal();
    }
  }

  function chiudiModal() {
    const modal = $('#modal-parametri');
    if (modal) modal.hidden = true;
  }

  function switchTab(tabName) {
    $$('.modal-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
    });
    $$('.tab-content').forEach((content) => {
      content.classList.toggle('active', content.getAttribute('data-tab-content') === tabName);
    });
  }

  function caricaDatiNelModal() {
    if (!window.APP_STATE) return;
    
    modalState.costanti = JSON.parse(JSON.stringify(window.APP_STATE.costanti || {}));
    modalState.prodotti = JSON.parse(JSON.stringify(window.APP_STATE.prodotti || []));
    modalState.accessori = JSON.parse(JSON.stringify(window.APP_STATE.accessori || []));
    modalState.trasporti = JSON.parse(JSON.stringify(window.APP_STATE.trasporti || []));
    modalState.gru = JSON.parse(JSON.stringify(window.APP_STATE.gru || []));

    popolaTabCostanti();
    popolaTabProdotti();
    popolaTabAccessori();
    popolaTabTrasporti();
    popolaTabGru();
  }

  function popolaTabCostanti() {
    const coord = modalState.costanti?.coordinate_partenza || {};
    const latInput = $('#param-lat-partenza');
    const lonInput = $('#param-lon-partenza');
    
    if (latInput) latInput.value = coord.lat != null ? coord.lat : '';
    if (lonInput) lonInput.value = coord.lon != null ? coord.lon : '';

    const mulettoSett = $('#param-muletto-settimana');
    const mulettoMese = $('#param-muletto-mese');
    const muletto2Mesi = $('#param-muletto-2mesi');
    const scalaPrimo = $('#param-scala-primo');
    const scalaGiorno = $('#param-scala-giorno');

    if (mulettoSett) mulettoSett.value = window.APP_STATE?.parametri?.muletto_settimana ?? 800;
    if (mulettoMese) mulettoMese.value = window.APP_STATE?.parametri?.muletto_mese ?? 1200;
    if (muletto2Mesi) muletto2Mesi.value = window.APP_STATE?.parametri?.muletto_2mesi ?? 2300;
    if (scalaPrimo) scalaPrimo.value = window.APP_STATE?.parametri?.scala_primo_giorno ?? 600;
    if (scalaGiorno) scalaGiorno.value = window.APP_STATE?.parametri?.scala_giorno_extra ?? 100;
  }

  function popolaTabProdotti() {
    const container = $('#tabella-prodotti-container');
    if (!container || !modalState.prodotti.length) return;

    const campi = Object.keys(modalState.prodotti[0]).filter(k => k !== 'MODELLO_STRUTTURA');
    
    const table = document.createElement('table');
    table.className = 'tabella-editable';
    
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const thModello = document.createElement('th');
    thModello.textContent = 'Modello';
    thModello.style.minWidth = '180px';
    headerRow.appendChild(thModello);
    
    campi.forEach(campo => {
      const th = document.createElement('th');
      th.textContent = campo.replace(/_/g, ' ');
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    modalState.prodotti.forEach((prodotto, idx) => {
      const row = document.createElement('tr');
      
      const tdModello = document.createElement('td');
      tdModello.textContent = prodotto.MODELLO_STRUTTURA;
      tdModello.style.fontWeight = '600';
      row.appendChild(tdModello);
      
      campi.forEach(campo => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = prodotto[campo] != null ? prodotto[campo] : '';
        input.dataset.idx = idx;
        input.dataset.campo = campo;
        td.appendChild(input);
        row.appendChild(td);
      });
      
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    container.innerHTML = '';
    container.appendChild(table);
  }

  function popolaTabAccessori() {
    const container = $('#tabella-accessori-container');
    if (!container || !modalState.accessori.length) return;

    const table = document.createElement('table');
    table.className = 'tabella-editable';
    
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Nome', 'Nome Prodotti'].forEach(label => {
      const th = document.createElement('th');
      th.textContent = label;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    modalState.accessori.forEach((acc, idx) => {
      const row = document.createElement('tr');
      
      const tdNome = document.createElement('td');
      const inputNome = document.createElement('input');
      inputNome.type = 'text';
      inputNome.value = acc.nome || '';
      inputNome.dataset.idx = idx;
      inputNome.dataset.campo = 'nome';
      tdNome.appendChild(inputNome);
      row.appendChild(tdNome);
      
      const tdNomeProd = document.createElement('td');
      const inputNomeProd = document.createElement('input');
      inputNomeProd.type = 'text';
      inputNomeProd.value = acc.nome_prodotti || '';
      inputNomeProd.dataset.idx = idx;
      inputNomeProd.dataset.campo = 'nome_prodotti';
      tdNomeProd.appendChild(inputNomeProd);
      row.appendChild(tdNomeProd);
      
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    container.innerHTML = '';
    container.appendChild(table);
  }

  function popolaTabTrasporti() {
    const container = $('#tabella-trasporti-container');
    if (!container || !modalState.trasporti.length) return;

    const campi = Object.keys(modalState.trasporti[0]);
    
    const table = document.createElement('table');
    table.className = 'tabella-editable';
    
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    campi.forEach(campo => {
      const th = document.createElement('th');
      th.textContent = campo.replace(/_/g, ' ');
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    modalState.trasporti.forEach((trasp, idx) => {
      const row = document.createElement('tr');
      
      campi.forEach(campo => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = trasp[campo] != null ? trasp[campo] : '';
        input.dataset.idx = idx;
        input.dataset.campo = campo;
        td.appendChild(input);
        row.appendChild(td);
      });
      
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    container.innerHTML = '';
    container.appendChild(table);
  }

  function popolaTabGru() {
    const container = $('#tabella-gru-container');
    if (!container || !modalState.gru.length) return;

    const campi = Object.keys(modalState.gru[0]);
    
    const table = document.createElement('table');
    table.className = 'tabella-editable';
    
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    campi.forEach(campo => {
      const th = document.createElement('th');
      th.textContent = campo.replace(/_/g, ' ');
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    modalState.gru.forEach((g, idx) => {
      const row = document.createElement('tr');
      
      campi.forEach(campo => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = g[campo] != null ? g[campo] : '';
        input.dataset.idx = idx;
        input.dataset.campo = campo;
        td.appendChild(input);
        row.appendChild(td);
      });
      
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    container.innerHTML = '';
    container.appendChild(table);
  }

  function raccogliDatiDalModal() {
    const latInput = $('#param-lat-partenza');
    const lonInput = $('#param-lon-partenza');
    
    if (latInput && lonInput) {
      modalState.costanti.coordinate_partenza = {
        lat: parseFloat(latInput.value) || 0,
        lon: parseFloat(lonInput.value) || 0,
      };
    }

    const mulettoSett = $('#param-muletto-settimana');
    const mulettoMese = $('#param-muletto-mese');
    const muletto2Mesi = $('#param-muletto-2mesi');
    const scalaPrimo = $('#param-scala-primo');
    const scalaGiorno = $('#param-scala-giorno');

    if (window.APP_STATE?.parametri) {
      if (mulettoSett) window.APP_STATE.parametri.muletto_settimana = parseFloat(mulettoSett.value) || 800;
      if (mulettoMese) window.APP_STATE.parametri.muletto_mese = parseFloat(mulettoMese.value) || 1200;
      if (muletto2Mesi) window.APP_STATE.parametri.muletto_2mesi = parseFloat(muletto2Mesi.value) || 2300;
      if (scalaPrimo) window.APP_STATE.parametri.scala_primo_giorno = parseFloat(scalaPrimo.value) || 600;
      if (scalaGiorno) window.APP_STATE.parametri.scala_giorno_extra = parseFloat(scalaGiorno.value) || 100;
    }

    $$('#tabella-prodotti-container input').forEach(input => {
      const idx = parseInt(input.dataset.idx, 10);
      const campo = input.dataset.campo;
      const val = input.value.trim();
      if (modalState.prodotti[idx]) {
        modalState.prodotti[idx][campo] = val === '' ? null : (isNaN(val) ? val : parseFloat(val));
      }
    });

    $$('#tabella-accessori-container input').forEach(input => {
      const idx = parseInt(input.dataset.idx, 10);
      const campo = input.dataset.campo;
      if (modalState.accessori[idx]) {
        modalState.accessori[idx][campo] = input.value.trim();
      }
    });

    $$('#tabella-trasporti-container input').forEach(input => {
      const idx = parseInt(input.dataset.idx, 10);
      const campo = input.dataset.campo;
      const val = input.value.trim();
      if (modalState.trasporti[idx]) {
        modalState.trasporti[idx][campo] = val === '' ? null : (isNaN(val) ? val : parseFloat(val));
      }
    });

    $$('#tabella-gru-container input').forEach(input => {
      const idx = parseInt(input.dataset.idx, 10);
      const campo = input.dataset.campo;
      const val = input.value.trim();
      if (modalState.gru[idx]) {
        modalState.gru[idx][campo] = val === '' ? null : (isNaN(val) ? val : parseFloat(val));
      }
    });
  }

  async function salvaModifiche() {
    raccogliDatiDalModal();

    try {
      await Promise.all([
        salvaSuFile('costanti.json', modalState.costanti),
        salvaSuFile('prodotti.json', modalState.prodotti),
        salvaSuFile('acessori.json', modalState.accessori),
        salvaSuFile('trasporti.json', modalState.trasporti),
        salvaSuFile('gru.json', modalState.gru),
      ]);

      if (window.APP_STATE) {
        window.APP_STATE.costanti = JSON.parse(JSON.stringify(modalState.costanti));
        window.APP_STATE.prodotti = JSON.parse(JSON.stringify(modalState.prodotti));
        window.APP_STATE.accessori = JSON.parse(JSON.stringify(modalState.accessori));
        window.APP_STATE.trasporti = JSON.parse(JSON.stringify(modalState.trasporti));
        window.APP_STATE.gru = JSON.parse(JSON.stringify(modalState.gru));
      }

      alert('Modifiche salvate con successo!');
      chiudiModal();
      
      if (window.APP_RELOAD_DATA) {
        window.APP_RELOAD_DATA();
      }
    } catch (err) {
      console.error('Errore salvataggio:', err);
      alert('Errore durante il salvataggio. Verifica la console per dettagli.');
    }
  }

  async function salvaSuFile(filename, data) {
    const response = await fetch(`/api/salva/${filename}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2),
    });
    
    if (!response.ok) {
      throw new Error(`Errore salvataggio ${filename}: ${response.statusText}`);
    }
    
    return response.json();
  }

  function init() {
    const btnApri = $('#btn-apri-parametri');
    const btnChiudi = $('#btn-chiudi-modal');
    const btnSalva = $('#btn-salva-parametri');
    const btnAnnulla = $('#btn-annulla-parametri');
    const overlay = $('.modal-overlay');

    if (btnApri) btnApri.addEventListener('click', apriModal);
    if (btnChiudi) btnChiudi.addEventListener('click', chiudiModal);
    if (btnAnnulla) btnAnnulla.addEventListener('click', chiudiModal);
    if (overlay) overlay.addEventListener('click', chiudiModal);
    if (btnSalva) btnSalva.addEventListener('click', salvaModifiche);

    $$('.modal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        switchTab(tabName);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = $('#modal-parametri');
        if (modal && !modal.hidden) chiudiModal();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.MODAL_PARAMETRI = { apriModal, chiudiModal };
})();
