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

  const POSTI_AUTO_STEPS = [...Array(20).keys()].map((i) => i + 1).concat([...Array(8).keys()].map((i) => 30 + (i * 10)));

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

      prodotti = (prodotti || []).map(normalizzaProdotto);
      
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

    prodottiFiltrati.forEach((prodotto) => {
      const realIndex = prodotti.indexOf(prodotto);
      const card = createProdottoCard(prodotto, realIndex);
      container.appendChild(card);
    });
  }

  function normalizzaNumero(v, def = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }

  function normalizzaProdotto(p) {
    const out = JSON.parse(JSON.stringify(p || {}));
    out.MODELLO_STRUTTURA = String(out.MODELLO_STRUTTURA || '').trim() || 'NUOVO MODELLO';
    out['POSTI AUTO'] = Math.min(100, Math.max(1, parseInt(out['POSTI AUTO'], 10) || 1));

    const kg1 = Math.max(0, normalizzaNumero(out.KG_1PA, normalizzaNumero(out.KG, 0)));
    out.KG = kg1;
    out.KG_1PA = kg1;

    POSTI_AUTO_STEPS.forEach((posti) => {
      const keyOre = `ORE_INSTALLAZIONE_${posti}PA`;
      const keyKg = `KG_${posti}PA`;
      if (posti === 1 && (out[keyOre] == null || Number.isNaN(Number(out[keyOre])))) {
        out[keyOre] = normalizzaNumero(out.ORE_INSTALLAZIONE_1PA, 0);
      }
      if (posti > 1 && out[keyOre] == null) out[keyOre] = null;
      out[keyKg] = Math.round(kg1 * posti);
    });

    out.ORE_INSTALLAZIONE_1PA = normalizzaNumero(out.ORE_INSTALLAZIONE_1PA, out.ORE_INSTALLAZIONE_1PA == null ? 0 : Number(out.ORE_INSTALLAZIONE_1PA));
    out.bilico_13mt_senza_zavorre = Math.max(0, parseInt(out.bilico_13mt_senza_zavorre ?? out.bilico_13mt, 10) || 0);
    out.bilico_13mt_con_zavorre = Math.max(0, parseInt(out.bilico_13mt_con_zavorre ?? out.bilico_13mt_senza_zavorre, 10) || 0);
    out.bilico_13mt = out.bilico_13mt_senza_zavorre;
    out.camion_gru = Math.max(0, parseInt(out.camion_gru, 10) || 0);
    out.nostro_mezzo = Math.max(0, parseInt(out.nostro_mezzo, 10) || 0);

    accessori.forEach((acc) => {
      const codice = acc?.nome_prodotti;
      if (!codice) return;
      const keyOre = `ORE_INSTALLAZIONE_${codice}`;
      const keyPeso = `PESO_ACCESSORIO_${codice}`;
      const keyPers = `CONSEGNA_PERSONALIZZATA_${codice}`;
      const keyCarico = `ACCESSORIO_GESTIONE_CARICO_${codice}`;
      const keyTipo = `ACCESSORIO_TIPO_CALCOLO_${codice}`;
      const keyCapBil = `ACCESSORIO_CAP_BILICO_${codice}`;
      const keyCapNostro = `ACCESSORIO_CAP_NOSTRO_MEZZO_${codice}`;
      const keyCapCam = `ACCESSORIO_CAP_CAMION_GRU_${codice}`;

      const codiceUpper = String(codice).toUpperCase();
      const defaultCarico = ['ZAVORRE', 'PF', 'PANNELLI_COIBENTATI'].includes(codiceUpper);

      if (out[keyOre] == null || Number.isNaN(Number(out[keyOre]))) out[keyOre] = 0;
      if (out[keyPeso] == null || Number.isNaN(Number(out[keyPeso]))) out[keyPeso] = 0;
      out[keyPers] = out[keyPers] === true;
      out[keyCarico] = out[keyCarico] === true || out[keyPers] === true || defaultCarico;
      out[keyTipo] = String(out[keyTipo] || 'per_posto_auto').toLowerCase() === 'per_pz' ? 'per_pz' : 'per_posto_auto';
      out[keyCapBil] = Math.max(0, parseInt(out[keyCapBil], 10) || 0);
      out[keyCapNostro] = Math.max(0, parseInt(out[keyCapNostro], 10) || 0);
      out[keyCapCam] = Math.max(0, parseInt(out[keyCapCam], 10) || 0);
    });

    return out;
  }

  function getNextNuovoModelloNome() {
    let n = 1;
    while (true) {
      const nome = `NUOVO MODELLO ${n}`;
      const exists = prodotti.some((p) => String(p.MODELLO_STRUTTURA || '').toUpperCase() === nome.toUpperCase());
      if (!exists) return nome;
      n += 1;
    }
  }

  function creaProdottoVuoto() {
    const p = {
      MODELLO_STRUTTURA: getNextNuovoModelloNome(),
      ORE_INSTALLAZIONE_1PA: 0,
      'POSTI AUTO': 1,
      KG: 0,
      KG_1PA: 0,
      bilico_13mt_senza_zavorre: 0,
      bilico_13mt_con_zavorre: 0,
      bilico_13mt: 0,
      camion_gru: 0,
      nostro_mezzo: 0,
    };
    POSTI_AUTO_STEPS.forEach((posti) => {
      p[`ORE_INSTALLAZIONE_${posti}PA`] = posti === 1 ? 0 : null;
      p[`KG_${posti}PA`] = 0;
    });
    accessori.forEach((acc) => {
      const codice = acc?.nome_prodotti;
      if (!codice) return;
      p[`ORE_INSTALLAZIONE_${codice}`] = 0;
      p[`PESO_ACCESSORIO_${codice}`] = 0;
      p[`CONSEGNA_PERSONALIZZATA_${codice}`] = false;
      p[`ACCESSORIO_GESTIONE_CARICO_${codice}`] = false;
      p[`ACCESSORIO_TIPO_CALCOLO_${codice}`] = 'per_posto_auto';
      p[`ACCESSORIO_CAP_BILICO_${codice}`] = 0;
      p[`ACCESSORIO_CAP_NOSTRO_MEZZO_${codice}`] = 0;
      p[`ACCESSORIO_CAP_CAMION_GRU_${codice}`] = 0;
    });
    return normalizzaProdotto(p);
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
    const infoBilico = createInfoItem('Bilico 13mt (senza/con zavorre)', `${prodotto.bilico_13mt_senza_zavorre || 0} / ${prodotto.bilico_13mt_con_zavorre || 0}`);

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

    const btnRimuovi = document.createElement('button');
    btnRimuovi.className = 'btn-modifica btn-rimuovi-card';
    btnRimuovi.textContent = 'Elimina';
    btnRimuovi.addEventListener('click', (e) => {
      e.stopPropagation();
      eliminaProdotto(index);
    });
    footer.appendChild(btnRimuovi);
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

    $('#edit-modello').value = prodottoCorrente.MODELLO_STRUTTURA || '';
    $('#edit-ore-1pa').value = prodottoCorrente.ORE_INSTALLAZIONE_1PA || 0;
    $('#edit-posti-auto').value = prodottoCorrente['POSTI AUTO'] || 1;
    $('#edit-kg').value = prodottoCorrente.KG_1PA || prodottoCorrente.KG || 0;
    $('#edit-bilico').value = prodottoCorrente.bilico_13mt_senza_zavorre || 0;
    $('#edit-bilico-zavorre').value = prodottoCorrente.bilico_13mt_con_zavorre || 0;
    $('#edit-camion-gru').value = prodottoCorrente.camion_gru || 0;
    $('#edit-nostro-mezzo').value = prodottoCorrente.nostro_mezzo || 0;

    $('#gen-ore-base').value = prodottoCorrente.ORE_INSTALLAZIONE_1PA || 0;
    $('#gen-ore-incremento').value = 0;
    $('#gen-max-posti').value = 100;

    popolaOrePosti();
    popolaAccessori();
  }

  function popolaOrePosti() {
    const container = $('#container-ore-posti');
    if (!container) return;

    container.innerHTML = '';

    const kg1 = Math.max(0, parseFloat($('#edit-kg')?.value) || prodottoCorrente.KG_1PA || 0);
    POSTI_AUTO_STEPS.forEach((i) => {
      const item = document.createElement('div');
      item.className = 'ore-posto-item';

      const label = document.createElement('div');
      label.className = 'ore-posto-label';
      label.textContent = `${i} ${i === 1 ? 'Posto Auto' : 'Posti Auto'}`;

      const fields = document.createElement('div');
      fields.className = 'ore-posto-fields';

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

      const fieldPeso = document.createElement('div');
      fieldPeso.className = 'ore-posto-field';
      const labelPeso = document.createElement('label');
      labelPeso.className = 'ore-posto-field-label';
      labelPeso.textContent = 'Peso calcolato';
      const pesoVal = document.createElement('div');
      pesoVal.className = 'ore-posto-peso-calc';
      pesoVal.textContent = `${Math.round(kg1 * i)} kg`;
      fieldPeso.appendChild(labelPeso);
      fieldPeso.appendChild(pesoVal);

      fields.appendChild(fieldOre);
      fields.appendChild(fieldPeso);

      item.appendChild(label);
      item.appendChild(fields);
      container.appendChild(item);
    });
  }

  function popolaAccessori() {
    const container = $('#container-accessori');
    if (!container) return;

    container.innerHTML = '';

    accessori.forEach((acc) => {
      const codice = acc.nome_prodotti;
      if (!codice) return;
      const item = document.createElement('div');
      item.className = 'accessorio-item-edit';

      const label = document.createElement('label');
      label.className = 'accessorio-nome';
      label.textContent = acc.nome || codice;
      label.setAttribute('for', `acc-${codice}`);

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'accessorio-input';
      input.id = `acc-${codice}`;
      input.step = '0.1';
      input.min = '0';
      input.placeholder = '0.0';

      const fieldName = `ORE_INSTALLAZIONE_${codice}`;
      input.value = prodottoCorrente[fieldName] || 0;

      const hint = document.createElement('span');
      hint.className = 'accessorio-hint';
      hint.textContent = 'Ore installazione';

      const pesoWrap = document.createElement('div');
      pesoWrap.className = 'accessorio-extra-row';
      const pesoLabel = document.createElement('label');
      pesoLabel.className = 'accessorio-extra-label';
      pesoLabel.setAttribute('for', `acc-peso-${codice}`);
      pesoLabel.textContent = 'Peso accessorio (kg)';
      const pesoInput = document.createElement('input');
      pesoInput.type = 'number';
      pesoInput.className = 'accessorio-input';
      pesoInput.id = `acc-peso-${codice}`;
      pesoInput.min = '0';
      pesoInput.step = '0.1';
      pesoInput.value = prodottoCorrente[`PESO_ACCESSORIO_${codice}`] || 0;
      pesoWrap.appendChild(pesoLabel);
      pesoWrap.appendChild(pesoInput);

      const chkWrap = document.createElement('label');
      chkWrap.className = 'accessorio-check';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.id = `acc-consegna-${codice}`;
      chk.checked = prodottoCorrente[`ACCESSORIO_GESTIONE_CARICO_${codice}`] === true || prodottoCorrente[`CONSEGNA_PERSONALIZZATA_${codice}`] === true;
      chkWrap.appendChild(chk);
      chkWrap.appendChild(document.createTextNode(' Soggetto a gestione del carico'));

      const tipoWrap = document.createElement('div');
      tipoWrap.className = 'accessorio-extra-row';
      const tipoLabel = document.createElement('label');
      tipoLabel.className = 'accessorio-extra-label';
      tipoLabel.setAttribute('for', `acc-tipo-${codice}`);
      tipoLabel.textContent = 'Tipo calcolo';
      const tipoSel = document.createElement('select');
      tipoSel.id = `acc-tipo-${codice}`;
      tipoSel.className = 'filtro-select';
      tipoSel.innerHTML = '<option value="per_posto_auto">Correlato ai posti auto</option><option value="per_pz">Calcolato a pezzi</option>';
      tipoSel.value = prodottoCorrente[`ACCESSORIO_TIPO_CALCOLO_${codice}`] === 'per_pz' ? 'per_pz' : 'per_posto_auto';
      tipoWrap.appendChild(tipoLabel);
      tipoWrap.appendChild(tipoSel);

      const capWrap = document.createElement('div');
      capWrap.className = 'accessorio-extra-row';
      const capBilLabel = document.createElement('label');
      capBilLabel.className = 'accessorio-extra-label';
      capBilLabel.setAttribute('for', `acc-cap-bil-${codice}`);
      capBilLabel.textContent = 'Capacità su Bilico';
      const capBil = document.createElement('input');
      capBil.type = 'number';
      capBil.min = '0';
      capBil.step = '1';
      capBil.className = 'accessorio-input';
      capBil.id = `acc-cap-bil-${codice}`;
      capBil.value = prodottoCorrente[`ACCESSORIO_CAP_BILICO_${codice}`] || 0;

      const capNostLabel = document.createElement('label');
      capNostLabel.className = 'accessorio-extra-label';
      capNostLabel.setAttribute('for', `acc-cap-nostro-${codice}`);
      capNostLabel.textContent = 'Capacità su Nostro mezzo';
      const capNost = document.createElement('input');
      capNost.type = 'number';
      capNost.min = '0';
      capNost.step = '1';
      capNost.className = 'accessorio-input';
      capNost.id = `acc-cap-nostro-${codice}`;
      capNost.value = prodottoCorrente[`ACCESSORIO_CAP_NOSTRO_MEZZO_${codice}`] || 0;

      const capCamLabel = document.createElement('label');
      capCamLabel.className = 'accessorio-extra-label';
      capCamLabel.setAttribute('for', `acc-cap-camion-${codice}`);
      capCamLabel.textContent = 'Capacità su Camion con gru';
      const capCam = document.createElement('input');
      capCam.type = 'number';
      capCam.min = '0';
      capCam.step = '1';
      capCam.className = 'accessorio-input';
      capCam.id = `acc-cap-camion-${codice}`;
      capCam.value = prodottoCorrente[`ACCESSORIO_CAP_CAMION_GRU_${codice}`] || 0;

      capWrap.appendChild(capBilLabel);
      capWrap.appendChild(capBil);
      capWrap.appendChild(capNostLabel);
      capWrap.appendChild(capNost);
      capWrap.appendChild(capCamLabel);
      capWrap.appendChild(capCam);

      item.appendChild(label);
      item.appendChild(input);
      item.appendChild(hint);
      item.appendChild(pesoWrap);
      item.appendChild(chkWrap);
      item.appendChild(tipoWrap);
      item.appendChild(capWrap);
      container.appendChild(item);
    });
  }

  function generaElencoOrePosti() {
    const base = Math.max(0, parseFloat($('#gen-ore-base')?.value) || 0);
    const incremento = parseFloat($('#gen-ore-incremento')?.value) || 0;
    const maxPosti = Math.max(1, Math.min(100, parseInt($('#gen-max-posti')?.value, 10) || 100));

    POSTI_AUTO_STEPS.forEach((i) => {
      const inputOre = $(`#ore-posto-${i}`);
      if (!inputOre) return;
      if (i <= maxPosti) {
        const v = Math.round((base + ((i - 1) * incremento)) * 1000) / 1000;
        inputOre.value = Math.max(0, v);
      } else {
        inputOre.value = '';
      }
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

    prodottoCorrente.MODELLO_STRUTTURA = ($('#edit-modello')?.value || '').trim() || 'NUOVO MODELLO';
    prodottoCorrente.ORE_INSTALLAZIONE_1PA = parseFloat($('#edit-ore-1pa').value) || 0;
    prodottoCorrente['POSTI AUTO'] = Math.min(100, Math.max(1, parseInt($('#edit-posti-auto').value, 10) || 1));
    const kg1 = Math.max(0, parseFloat($('#edit-kg').value) || 0);
    prodottoCorrente.KG = kg1;
    prodottoCorrente.KG_1PA = kg1;
    prodottoCorrente.bilico_13mt_senza_zavorre = parseInt($('#edit-bilico').value, 10) || 0;
    prodottoCorrente.bilico_13mt_con_zavorre = parseInt($('#edit-bilico-zavorre').value, 10) || 0;
    prodottoCorrente.bilico_13mt = prodottoCorrente.bilico_13mt_senza_zavorre;
    prodottoCorrente.camion_gru = parseInt($('#edit-camion-gru').value) || 0;
    prodottoCorrente.nostro_mezzo = parseInt($('#edit-nostro-mezzo').value) || 0;

    POSTI_AUTO_STEPS.forEach((i) => {
      const inputOre = $(`#ore-posto-${i}`);
      
      if (inputOre) {
        const fieldNameOre = `ORE_INSTALLAZIONE_${i}PA`;
        const v = inputOre.value.trim();
        prodottoCorrente[fieldNameOre] = v === '' ? null : (parseFloat(v) || 0);
      }
      prodottoCorrente[`KG_${i}PA`] = Math.round(kg1 * i);
    });

    accessori.forEach((acc) => {
      const codice = acc?.nome_prodotti;
      if (!codice) return;
      const input = $(`#acc-${codice}`);
      const inputPeso = $(`#acc-peso-${codice}`);
      const chkPers = $(`#acc-consegna-${codice}`);
      const tipoSel = $(`#acc-tipo-${codice}`);
      const capBil = $(`#acc-cap-bil-${codice}`);
      const capNostro = $(`#acc-cap-nostro-${codice}`);
      const capCam = $(`#acc-cap-camion-${codice}`);
      if (input) {
        const fieldName = `ORE_INSTALLAZIONE_${codice}`;
        prodottoCorrente[fieldName] = parseFloat(input.value) || 0;
      }
      prodottoCorrente[`PESO_ACCESSORIO_${codice}`] = inputPeso ? (parseFloat(inputPeso.value) || 0) : 0;
      prodottoCorrente[`ACCESSORIO_GESTIONE_CARICO_${codice}`] = chkPers?.checked === true;
      prodottoCorrente[`CONSEGNA_PERSONALIZZATA_${codice}`] = chkPers?.checked === true;
      prodottoCorrente[`ACCESSORIO_TIPO_CALCOLO_${codice}`] = tipoSel?.value === 'per_pz' ? 'per_pz' : 'per_posto_auto';
      prodottoCorrente[`ACCESSORIO_CAP_BILICO_${codice}`] = capBil ? (parseInt(capBil.value, 10) || 0) : 0;
      prodottoCorrente[`ACCESSORIO_CAP_NOSTRO_MEZZO_${codice}`] = capNostro ? (parseInt(capNostro.value, 10) || 0) : 0;
      prodottoCorrente[`ACCESSORIO_CAP_CAMION_GRU_${codice}`] = capCam ? (parseInt(capCam.value, 10) || 0) : 0;
    });

    prodotti[prodottoCorrenteIndex] = normalizzaProdotto(prodottoCorrente);
    
    chiudiModalProdotto();
    renderListaProdotti();
  }

  function eliminaProdotto(index) {
    if (index < 0 || index >= prodotti.length) return;
    const nome = prodotti[index]?.MODELLO_STRUTTURA || `#${index + 1}`;
    const ok = confirm(`Eliminare il prodotto "${nome}"?`);
    if (!ok) return;
    prodotti.splice(index, 1);
    renderListaProdotti();
    if (prodottoCorrenteIndex === index) chiudiModalProdotto();
  }

  function aggiungiProdotto() {
    const nuovo = creaProdottoVuoto();
    prodotti.push(nuovo);
    renderListaProdotti();
    apriModalProdotto(prodotti.length - 1);
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
    const btnAggiungiProdotto = $('#btn-aggiungi-prodotto');
    const btnEliminaProdotto = $('#btn-elimina-prodotto');
    const btnGeneraOrePosti = $('#btn-genera-ore-posti');
    const searchInput = $('#search-prodotti');
    const filtroSelect = $('#filtro-posti');
    const modalOverlay = $('.modal-overlay');

    if (btnChiudiModal) btnChiudiModal.addEventListener('click', chiudiModalProdotto);
    if (btnAnnullaProdotto) btnAnnullaProdotto.addEventListener('click', chiudiModalProdotto);
    if (modalOverlay) modalOverlay.addEventListener('click', chiudiModalProdotto);
    if (btnSalvaProdotto) btnSalvaProdotto.addEventListener('click', salvaProdottoCorrente);
    if (btnSalvaTutto) btnSalvaTutto.addEventListener('click', salvaTuttoProdotti);
    if (btnAggiungiProdotto) btnAggiungiProdotto.addEventListener('click', aggiungiProdotto);
    if (btnEliminaProdotto) btnEliminaProdotto.addEventListener('click', () => eliminaProdotto(prodottoCorrenteIndex));
    if (btnGeneraOrePosti) btnGeneraOrePosti.addEventListener('click', generaElencoOrePosti);

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchInput.searchTimer);
        searchInput.searchTimer = setTimeout(renderListaProdotti, 300);
      });
    }

    if (filtroSelect) {
      filtroSelect.addEventListener('change', renderListaProdotti);
    }

    $('#edit-kg')?.addEventListener('input', popolaOrePosti);
    $('#edit-ore-1pa')?.addEventListener('input', () => {
      const v = parseFloat($('#edit-ore-1pa')?.value) || 0;
      const first = $('#ore-posto-1');
      if (first) first.value = v;
      const g = $('#gen-ore-base');
      if (g) g.value = v;
    });

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
