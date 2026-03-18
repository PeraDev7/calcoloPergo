/**
 * Gestione Prodotti - Personalizzazione ore e accessori
 */
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let prodotti = [];
  let accessori = [];
  let prodottoCorrente = null;
  let prodottoCorrenteIndex = -1;

  async function loadJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Errore caricamento ${path}`);
    return res.json();
  }

  async function init() {
    try {
      [prodotti, accessori] = await Promise.all([
        loadJson('prodotti.json'),
        loadJson('acessori.json').catch(() => []),
      ]);
      
      renderListaProdotti();
      bindEvents();
    } catch (e) {
      console.error(e);
      alert('Errore nel caricamento dei dati.');
    }
  }

  function renderListaProdotti() {
    const container = $('#lista-prodotti');
    const msgVuoto = $('#msg-nessun-prodotto');
    
    if (!container) return;

    const searchTerm = $('#search-prodotti')?.value.toLowerCase() || '';
    const filtroPosti = $('#filtro-posti')?.value || '';

    let prodottiFiltrati = prodotti.filter(p => {
      const matchSearch = !searchTerm || 
        p.MODELLO_STRUTTURA?.toLowerCase().includes(searchTerm);
      
      let matchPosti = true;
      if (filtroPosti) {
        const posti = p['POSTI AUTO'] || 1;
        if (filtroPosti === '1') matchPosti = posti === 1;
        else if (filtroPosti === '2') matchPosti = posti === 2;
        else if (filtroPosti === '3') matchPosti = posti >= 3;
      }
      
      return matchSearch && matchPosti;
    });

    container.innerHTML = '';
    
    if (prodottiFiltrati.length === 0) {
      msgVuoto.hidden = false;
      return;
    }
    
    msgVuoto.hidden = true;

    prodottiFiltrati.forEach((prodotto, idx) => {
      const realIndex = prodotti.indexOf(prodotto);
      const card = createProdottoCard(prodotto, realIndex);
      container.appendChild(card);
    });
  }

  function createProdottoCard(prodotto, index) {
    const card = document.createElement('div');
    card.className = 'prodotto-card';
    card.setAttribute('data-index', index);

    const header = document.createElement('div');
    header.className = 'prodotto-card-header';

    const nome = document.createElement('h3');
    nome.className = 'prodotto-nome';
    nome.textContent = prodotto.MODELLO_STRUTTURA || 'Senza nome';

    const badge = document.createElement('span');
    badge.className = 'prodotto-badge';
    badge.textContent = `${prodotto['POSTI AUTO'] || 1} PA`;

    header.appendChild(nome);
    header.appendChild(badge);
    card.appendChild(header);

    const info = document.createElement('div');
    info.className = 'prodotto-info';

    const infoOre = createInfoItem('Ore base (1 PA)', `${prodotto.ORE_INSTALLAZIONE_1PA || 0} h`);
    const pesoDisplay = prodotto.KG_1PA || prodotto.KG || 0;
    const infoKg = createInfoItem('Peso (1 PA)', `${pesoDisplay} kg`);
    const infoBilico = createInfoItem('Bilico 13mt', prodotto.bilico_13mt || 0);

    info.appendChild(infoOre);
    info.appendChild(infoKg);
    info.appendChild(infoBilico);
    card.appendChild(info);

    const footer = document.createElement('div');
    footer.className = 'prodotto-card-footer';
    const btnModifica = document.createElement('button');
    btnModifica.className = 'btn-modifica';
    btnModifica.textContent = '✏️ Modifica dettagli';
    btnModifica.addEventListener('click', (e) => {
      e.stopPropagation();
      apriModalProdotto(index);
    });
    footer.appendChild(btnModifica);
    card.appendChild(footer);

    card.addEventListener('click', () => apriModalProdotto(index));

    return card;
  }

  function createInfoItem(label, value) {
    const item = document.createElement('div');
    item.className = 'prodotto-info-item';

    const labelEl = document.createElement('span');
    labelEl.className = 'prodotto-info-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'prodotto-info-value';
    valueEl.textContent = value;

    item.appendChild(labelEl);
    item.appendChild(valueEl);
    return item;
  }

  function apriModalProdotto(index) {
    prodottoCorrenteIndex = index;
    prodottoCorrente = JSON.parse(JSON.stringify(prodotti[index]));

    const modal = $('#modal-prodotto');
    const titolo = $('#modal-prodotto-titolo');
    
    if (titolo) titolo.textContent = prodottoCorrente.MODELLO_STRUTTURA || 'Prodotto';
    if (modal) modal.hidden = false;

    popolaModalProdotto();
    switchTabProdotto('ore-base');
  }

  function chiudiModalProdotto() {
    const modal = $('#modal-prodotto');
    if (modal) modal.hidden = true;
    prodottoCorrente = null;
    prodottoCorrenteIndex = -1;
  }

  function popolaModalProdotto() {
    if (!prodottoCorrente) return;

    $('#edit-ore-1pa').value = prodottoCorrente.ORE_INSTALLAZIONE_1PA || 0;
    $('#edit-posti-auto').value = prodottoCorrente['POSTI AUTO'] || 1;
    $('#edit-kg').value = prodottoCorrente.KG || 0;
    $('#edit-bilico').value = prodottoCorrente.bilico_13mt || 0;
    $('#edit-camion-gru').value = prodottoCorrente.camion_gru || 0;
    $('#edit-nostro-mezzo').value = prodottoCorrente.nostro_mezzo || 0;

    popolaOrePosti();
    popolaAccessori();
  }

  function popolaOrePosti() {
    const container = $('#container-ore-posti');
    if (!container) return;

    container.innerHTML = '';

    for (let i = 1; i <= 20; i++) {
      const item = document.createElement('div');
      item.className = 'ore-posto-item';

      const label = document.createElement('div');
      label.className = 'ore-posto-label';
      label.textContent = `${i} ${i === 1 ? 'Posto Auto' : 'Posti Auto'}`;

      const fields = document.createElement('div');
      fields.className = 'ore-posto-fields';

      // Campo Ore
      const fieldOre = document.createElement('div');
      fieldOre.className = 'ore-posto-field';
      
      const labelOre = document.createElement('label');
      labelOre.className = 'ore-posto-field-label';
      labelOre.textContent = 'Ore';
      labelOre.setAttribute('for', `ore-posto-${i}`);
      
      const inputOre = document.createElement('input');
      inputOre.type = 'number';
      inputOre.className = 'ore-posto-input';
      inputOre.id = `ore-posto-${i}`;
      inputOre.step = '0.1';
      inputOre.min = '0';
      inputOre.placeholder = '0.0';
      
      const fieldNameOre = `ORE_INSTALLAZIONE_${i}PA`;
      inputOre.value = prodottoCorrente[fieldNameOre] || 
                       (i === 1 ? (prodottoCorrente.ORE_INSTALLAZIONE_1PA || 0) : 0);

      fieldOre.appendChild(labelOre);
      fieldOre.appendChild(inputOre);

      // Campo Peso
      const fieldPeso = document.createElement('div');
      fieldPeso.className = 'ore-posto-field';
      
      const labelPeso = document.createElement('label');
      labelPeso.className = 'ore-posto-field-label';
      labelPeso.textContent = 'Peso (kg)';
      labelPeso.setAttribute('for', `peso-posto-${i}`);
      
      const inputPeso = document.createElement('input');
      inputPeso.type = 'number';
      inputPeso.className = 'ore-posto-input peso-input';
      inputPeso.id = `peso-posto-${i}`;
      inputPeso.step = '1';
      inputPeso.min = '0';
      inputPeso.placeholder = '0';
      
      const fieldNamePeso = `KG_${i}PA`;
      // Calcolo peso approssimativo se non presente
      const pesoBase = prodottoCorrente.KG || 300;
      const pesoApprossimativo = Math.round(pesoBase * i * 0.9); // 90% del peso lineare
      inputPeso.value = prodottoCorrente[fieldNamePeso] || 
                        (i === 1 ? pesoBase : pesoApprossimativo);

      fieldPeso.appendChild(labelPeso);
      fieldPeso.appendChild(inputPeso);

      fields.appendChild(fieldOre);
      fields.appendChild(fieldPeso);

      item.appendChild(label);
      item.appendChild(fields);
      container.appendChild(item);
    }
  }

  function popolaAccessori() {
    const container = $('#container-accessori');
    if (!container) return;

    container.innerHTML = '';

    accessori.forEach(acc => {
      const item = document.createElement('div');
      item.className = 'accessorio-item-edit';

      const label = document.createElement('label');
      label.className = 'accessorio-nome';
      label.textContent = acc.nome || acc.nome_prodotti;
      label.setAttribute('for', `acc-${acc.nome_prodotti}`);

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'accessorio-input';
      input.id = `acc-${acc.nome_prodotti}`;
      input.step = '0.1';
      input.min = '0';
      input.placeholder = '0.0';

      const fieldName = `ORE_INSTALLAZIONE_${acc.nome_prodotti}`;
      input.value = prodottoCorrente[fieldName] || 0;

      const hint = document.createElement('span');
      hint.className = 'accessorio-hint';
      hint.textContent = 'ore';

      item.appendChild(label);
      item.appendChild(input);
      item.appendChild(hint);
      container.appendChild(item);
    });
  }

  function switchTabProdotto(tabName) {
    $$('.modal-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
    });
    $$('.tab-content').forEach(content => {
      content.classList.toggle('active', content.getAttribute('data-tab-content') === tabName);
    });
  }

  function salvaProdottoCorrente() {
    if (!prodottoCorrente || prodottoCorrenteIndex === -1) return;

    prodottoCorrente.ORE_INSTALLAZIONE_1PA = parseFloat($('#edit-ore-1pa').value) || 0;
    prodottoCorrente['POSTI AUTO'] = parseInt($('#edit-posti-auto').value) || 1;
    prodottoCorrente.KG = parseFloat($('#edit-kg').value) || 0;
    prodottoCorrente.bilico_13mt = parseInt($('#edit-bilico').value) || 0;
    prodottoCorrente.camion_gru = parseInt($('#edit-camion-gru').value) || 0;
    prodottoCorrente.nostro_mezzo = parseInt($('#edit-nostro-mezzo').value) || 0;

    for (let i = 1; i <= 20; i++) {
      const inputOre = $(`#ore-posto-${i}`);
      const inputPeso = $(`#peso-posto-${i}`);
      
      if (inputOre) {
        const fieldNameOre = `ORE_INSTALLAZIONE_${i}PA`;
        prodottoCorrente[fieldNameOre] = parseFloat(inputOre.value) || 0;
      }
      
      if (inputPeso) {
        const fieldNamePeso = `KG_${i}PA`;
        prodottoCorrente[fieldNamePeso] = parseInt(inputPeso.value) || 0;
      }
    }

    accessori.forEach(acc => {
      const input = $(`#acc-${acc.nome_prodotti}`);
      if (input) {
        const fieldName = `ORE_INSTALLAZIONE_${acc.nome_prodotti}`;
        prodottoCorrente[fieldName] = parseFloat(input.value) || 0;
      }
    });

    prodotti[prodottoCorrenteIndex] = prodottoCorrente;
    
    chiudiModalProdotto();
    renderListaProdotti();
  }

  async function salvaTuttoProdotti() {
    const btnSalva = $('#btn-salva-tutto');
    if (btnSalva) {
      btnSalva.disabled = true;
      btnSalva.textContent = '💾 Salvataggio...';
    }

    try {
      const response = await fetch('/api/salva/prodotti.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prodotti, null, 2),
      });

      if (!response.ok) {
        throw new Error(`Errore salvataggio: ${response.statusText}`);
      }

      alert('✅ Tutti i prodotti sono stati salvati con successo!');
    } catch (error) {
      console.error('Errore:', error);
      alert('❌ Errore durante il salvataggio. Verifica la console per dettagli.');
    } finally {
      if (btnSalva) {
        btnSalva.disabled = false;
        btnSalva.textContent = '💾 Salva tutte le modifiche';
      }
    }
  }

  function bindEvents() {
    const btnChiudiModal = $('#btn-chiudi-modal-prodotto');
    const btnSalvaProdotto = $('#btn-salva-prodotto');
    const btnAnnullaProdotto = $('#btn-annulla-prodotto');
    const btnSalvaTutto = $('#btn-salva-tutto');
    const searchInput = $('#search-prodotti');
    const filtroSelect = $('#filtro-posti');
    const modalOverlay = $('.modal-overlay');

    if (btnChiudiModal) btnChiudiModal.addEventListener('click', chiudiModalProdotto);
    if (btnAnnullaProdotto) btnAnnullaProdotto.addEventListener('click', chiudiModalProdotto);
    if (modalOverlay) modalOverlay.addEventListener('click', chiudiModalProdotto);
    if (btnSalvaProdotto) btnSalvaProdotto.addEventListener('click', salvaProdottoCorrente);
    if (btnSalvaTutto) btnSalvaTutto.addEventListener('click', salvaTuttoProdotti);

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchInput.searchTimer);
        searchInput.searchTimer = setTimeout(renderListaProdotti, 300);
      });
    }

    if (filtroSelect) {
      filtroSelect.addEventListener('change', renderListaProdotti);
    }

    $$('.modal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        switchTabProdotto(tabName);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = $('#modal-prodotto');
        if (modal && !modal.hidden) chiudiModalProdotto();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
