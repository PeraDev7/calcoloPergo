/**
 * Modal Parametri e Costi - Gestione modifiche e salvataggio su JSON
 */
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let modalState = {
    costanti: null,
    accessori: [],
    trasporti: [],
    gru: [],
    trasferta: null,
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
    modalState.accessori = JSON.parse(JSON.stringify(window.APP_STATE.accessori || []));
    modalState.trasporti = JSON.parse(JSON.stringify(window.APP_STATE.trasporti || []));
    modalState.gru = JSON.parse(JSON.stringify(window.APP_STATE.gru || []));
    modalState.trasferta = JSON.parse(JSON.stringify(window.APP_STATE.trasfertaConfig || {}));

    popolaTabCostanti();
    popolaTabAccessori();
    popolaTabTrasporti();
    popolaTabGru();
    popolaTabTrasferta();
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

    const pi = modalState.costanti?.parametri_installazione || {};
    const ap = window.APP_STATE?.parametri || {};
    const instVal = (k, def) => {
      const x = pi[k];
      if (x != null && x !== '') return x;
      const y = ap[k];
      if (y != null && y !== '') return y;
      return def;
    };
    const setInst = (id, k, def) => {
      const el = $(id);
      if (el) el.value = instVal(k, def);
    };
    setInst('#param-inst-soglia-km', 'km_soglia_trasferta_interna', 150);
    setInst('#param-inst-vel-kmh', 'velocita_media_trasferta_kmh', 60);
    setInst('#param-inst-ora-partenza', 'ora_partenza_azienda', 7);
    setInst('#param-inst-ora-ritorno', 'ora_ritorno_azienda', 18);
    setInst('#param-inst-costo-orario-int', 'costo_orario_interno', 35);
    setInst('#param-inst-costo-orario-ext', 'costo_orario_esterno', 40);
    setInst('#param-inst-rimborso-ext', 'rimborso_giornaliero_esterno', 25);
    setInst('#param-inst-extra-trasferta', 'costo_extra_giorno_interno_trasferta_lunga', 80);

    const ptm = modalState.costanti?.parametri_trasporto_merci || {};
    const defTrm = {
      nostro_mezzo_eur_km_base: 0.05,
      nostro_mezzo_eur_km_pedaggio: 0.06,
      nostro_mezzo_eur_km_carburante: 0.08,
      nostro_mezzo_eur_km_usura: 0.12,
      bilico_eur_km: 2.2,
      camion_gru_eur_km: 2,
    };
    const trm = (k, def) => (ptm[k] != null && ptm[k] !== '' ? ptm[k] : def);
    const setTrm = (id, k, def) => {
      const el = $(id);
      if (el) el.value = trm(k, def);
    };
    setTrm('#param-trm-base', 'nostro_mezzo_eur_km_base', defTrm.nostro_mezzo_eur_km_base);
    setTrm('#param-trm-pedaggio', 'nostro_mezzo_eur_km_pedaggio', defTrm.nostro_mezzo_eur_km_pedaggio);
    setTrm('#param-trm-carburante', 'nostro_mezzo_eur_km_carburante', defTrm.nostro_mezzo_eur_km_carburante);
    setTrm('#param-trm-usura', 'nostro_mezzo_eur_km_usura', defTrm.nostro_mezzo_eur_km_usura);
    setTrm('#param-trm-bilico', 'bilico_eur_km', defTrm.bilico_eur_km);
    setTrm('#param-trm-camion-gru', 'camion_gru_eur_km', defTrm.camion_gru_eur_km);
    const pctSic = modalState.costanti?.sicurezza_percentuale_auto;
    const elPct = $('#param-sicurezza-pct');
    if (elPct) el.value = pctSic != null && pctSic !== '' ? pctSic : 5;
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

  function popolaTabTrasferta() {
    const t = modalState.trasferta || {};
    const g = t.giornata_lavorativa || {};
    const m = t.mezzo_aziendale || {};
    const tr = t.treno || {};
    const ae = t.aereo || {};

    const setN = (id, v, def) => {
      const el = $(id);
      if (el) el.value = v != null && v !== '' ? v : def;
    };

    setN('#param-trf-ora-inizio', g.ora_inizio, 7.5);
    setN('#param-trf-ora-fine', g.ora_fine, 17.5);
    setN('#param-trf-pausa', g.pausa_pranzo_ore, 1);
    setN('#param-trf-pausa-inizio', g.pausa_ora_inizio, 12);
    setN('#param-trf-pausa-fine', g.pausa_ora_fine, 13);
    setN('#param-trf-premio', t.premio_trasferta_euro_per_tecnico_per_giorno, 50);
    setN('#param-trf-ore-min', t.ore_minime_cantiere_stesso_giorno_trasferta, 3);
    setN('#param-trf-ora-max-rientro', t.ora_massima_rientro_casa, 18);
    setN('#param-trf-gasolio', m.eur_litro_gasolio, 1.75);
    setN('#param-trf-litri', m.litri_100km, 8);
    setN('#param-trf-usura', m.usura_euro_km, 0.12);
    setN('#param-trf-pedaggio', m.pedaggio_euro_km, 0.06);
    setN('#param-trf-treno-biglietto', tr.costo_medio_andata_ritorno_per_persona, 90);
    setN('#param-trf-treno-taxi', tr.taxi_stazione_cantiere_per_tratta, 45);
    setN('#param-trf-aereo-biglietto', ae.costo_medio_andata_ritorno_per_persona, 220);
    setN('#param-trf-aereo-taxi', ae.taxi_aeroporto_cantiere_per_tratta, 55);
    setN('#param-trf-hotel', t.hotel_euro_per_notte, 75);
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

    modalState.costanti.parametri_trasporto_merci = {
      nostro_mezzo_eur_km_base: parseFloat($('#param-trm-base')?.value) || 0.05,
      nostro_mezzo_eur_km_pedaggio: parseFloat($('#param-trm-pedaggio')?.value) || 0,
      nostro_mezzo_eur_km_carburante: parseFloat($('#param-trm-carburante')?.value) || 0,
      nostro_mezzo_eur_km_usura: parseFloat($('#param-trm-usura')?.value) || 0,
      bilico_eur_km: parseFloat($('#param-trm-bilico')?.value) || 2.2,
      camion_gru_eur_km: parseFloat($('#param-trm-camion-gru')?.value) || 2,
    };
    modalState.costanti.sicurezza_percentuale_auto = parseFloat($('#param-sicurezza-pct')?.value);
    if (!Number.isFinite(modalState.costanti.sicurezza_percentuale_auto)) modalState.costanti.sicurezza_percentuale_auto = 5;

    if (!modalState.costanti.parametri_installazione) modalState.costanti.parametri_installazione = {};
    modalState.costanti.parametri_installazione = {
      km_soglia_trasferta_interna: parseFloat($('#param-inst-soglia-km')?.value) || 150,
      velocita_media_trasferta_kmh: parseFloat($('#param-inst-vel-kmh')?.value) || 60,
      ora_partenza_azienda: parseFloat($('#param-inst-ora-partenza')?.value) || 7,
      ora_ritorno_azienda: parseFloat($('#param-inst-ora-ritorno')?.value) || 18,
      costo_orario_interno: parseFloat($('#param-inst-costo-orario-int')?.value) || 0,
      costo_orario_esterno: parseFloat($('#param-inst-costo-orario-ext')?.value) || 0,
      rimborso_giornaliero_esterno: parseFloat($('#param-inst-rimborso-ext')?.value) || 0,
      costo_extra_giorno_interno_trasferta_lunga: parseFloat($('#param-inst-extra-trasferta')?.value) || 0,
    };
    if (window.APP_STATE?.parametri) {
      Object.assign(window.APP_STATE.parametri, modalState.costanti.parametri_installazione);
    }

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

    modalState.trasferta = {
      giornata_lavorativa: {
        ora_inizio: parseFloat($('#param-trf-ora-inizio')?.value) || 7.5,
        ora_fine: parseFloat($('#param-trf-ora-fine')?.value) || 17.5,
        pausa_pranzo_ore: parseFloat($('#param-trf-pausa')?.value) || 1,
        pausa_ora_inizio: parseFloat($('#param-trf-pausa-inizio')?.value) || 12,
        pausa_ora_fine: parseFloat($('#param-trf-pausa-fine')?.value) || 13,
      },
      premio_trasferta_euro_per_tecnico_per_giorno: parseFloat($('#param-trf-premio')?.value) || 50,
      ore_minime_cantiere_stesso_giorno_trasferta: parseFloat($('#param-trf-ore-min')?.value) || 3,
      ora_massima_rientro_casa: parseFloat($('#param-trf-ora-max-rientro')?.value) || 18,
      rientro_weekend_default: true,
      premio_include_giorni_viaggio_default: true,
      mezzo_aziendale: {
        eur_litro_gasolio: parseFloat($('#param-trf-gasolio')?.value) || 1.75,
        litri_100km: parseFloat($('#param-trf-litri')?.value) || 8,
        usura_euro_km: parseFloat($('#param-trf-usura')?.value) || 0.12,
        pedaggio_euro_km: parseFloat($('#param-trf-pedaggio')?.value) || 0.06,
      },
      treno: {
        costo_medio_andata_ritorno_per_persona: parseFloat($('#param-trf-treno-biglietto')?.value) || 90,
        taxi_stazione_cantiere_per_tratta: parseFloat($('#param-trf-treno-taxi')?.value) || 45,
      },
      aereo: {
        costo_medio_andata_ritorno_per_persona: parseFloat($('#param-trf-aereo-biglietto')?.value) || 220,
        taxi_aeroporto_cantiere_per_tratta: parseFloat($('#param-trf-aereo-taxi')?.value) || 55,
      },
      hotel_euro_per_notte: parseFloat($('#param-trf-hotel')?.value) || 75,
      costo_extra_generico_default: 0,
    };
    if (window.APP_STATE) {
      window.APP_STATE.trasfertaConfig = JSON.parse(JSON.stringify(modalState.trasferta));
    }
  }

  async function salvaModifiche() {
    raccogliDatiDalModal();

    try {
      await Promise.all([
        salvaSuFile('costanti.json', modalState.costanti),
        salvaSuFile('acessori.json', modalState.accessori),
        salvaSuFile('trasporti.json', modalState.trasporti),
        salvaSuFile('gru.json', modalState.gru),
        salvaSuFile('trasferta.json', modalState.trasferta),
      ]);

      if (window.APP_STATE) {
        window.APP_STATE.costanti = JSON.parse(JSON.stringify(modalState.costanti));
        window.APP_STATE.accessori = JSON.parse(JSON.stringify(modalState.accessori));
        window.APP_STATE.trasporti = JSON.parse(JSON.stringify(modalState.trasporti));
        window.APP_STATE.gru = JSON.parse(JSON.stringify(modalState.gru));
        window.APP_STATE.trasfertaConfig = JSON.parse(JSON.stringify(modalState.trasferta));
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
    const overlayParametri = $('#modal-parametri .modal-overlay');

    if (btnApri) btnApri.addEventListener('click', apriModal);
    if (btnChiudi) btnChiudi.addEventListener('click', chiudiModal);
    if (btnAnnulla) btnAnnulla.addEventListener('click', chiudiModal);
    if (overlayParametri) overlayParametri.addEventListener('click', chiudiModal);
    if (btnSalva) btnSalva.addEventListener('click', salvaModifiche);

    $$('.modal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        switchTab(tabName);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const modalAcc = $('#modal-accessori');
      if (modalAcc && !modalAcc.hidden) return;
      const modal = $('#modal-parametri');
      if (modal && !modal.hidden) chiudiModal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.MODAL_PARAMETRI = { apriModal, chiudiModal };
})();
