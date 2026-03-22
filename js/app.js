/**
 * App principale: carica JSON, gestisce form, dipendenze domande, geocoding e distanza.
 * Tutte le domande sulla stessa pagina; visibilità e valori in base alle dipendenze.
 */
(function () {
  const state = {
    costanti: null,
    prodotti: [],
    trasporti: [],
    accessori: [],
    gru: [],
    /** Parametri trasferta (trasferta.json): giornata, premio, costi mezzo/treno/aereo, hotel */
    trasfertaConfig: null,
    valori: {},
    distanzaKm: null,
    coordCantiere: null,
    serviziPersonalizzati: [],
    /** Per ogni slot 1–4: array di { codice: nome_prodotti, modalita: 'fornito'|'installato' } */
    accessoriSelezioni: { 1: [], 2: [], 3: [], 4: [] },
    parametri: {
      lat_partenza: null,
      lon_partenza: null,
      muletto_settimana: 800,
      muletto_mese: 1200,
      muletto_2mesi: 2300,
      scala_primo_giorno: 600,
      scala_giorno_extra: 100,
      costo_km_trasporto: null,
      costo_km_gru: null,
      km_soglia_trasferta_interna: 150,
      velocita_media_trasferta_kmh: 60,
      ora_partenza_azienda: 7,
      ora_ritorno_azienda: 18,
      costo_orario_interno: 35,
      costo_orario_esterno: 40,
      rimborso_giornaliero_esterno: 25,
      costo_extra_giorno_interno_trasferta_lunga: 80,
    },
  };
  let checkSubmitFn = () => {};
  let serviziPersonalizzatiCounter = 0;
  let modalAccessoriSlot = null;
  let modalAccessoriDraft = null;

  window.APP_STATE = state;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  async function loadJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Errore caricamento ${path}`);
    return res.json();
  }

  async function initData() {
    try {
      [state.costanti, state.prodotti, state.trasporti, state.accessori, state.gru, state.trasfertaConfig] = await Promise.all([
        loadJson('costanti.json'),
        loadJson('prodotti.json'),
        loadJson('trasporti.json'),
        loadJson('acessori.json').catch(() => []),
        loadJson('gru.json').catch(() => []),
        loadJson('trasferta.json').catch(() => null),
      ]);
    } catch (e) {
      console.error(e);
      alert('Errore nel caricamento dei dati. Verifica che costanti.json, prodotti.json e trasporti.json siano presenti.');
      return false;
    }
    return true;
  }

  async function reloadData() {
    const ok = await initData();
    if (ok) {
      initParametriFromDefaults();
      buildContainerProdotti();
      mostraNascondiDomande();
    }
  }

  window.APP_RELOAD_DATA = reloadData;

  function getCoordinatePartenza() {
    const lat = getParametro('lat_partenza') ?? state.costanti?.coordinate_partenza?.lat;
    const lon = getParametro('lon_partenza') ?? state.costanti?.coordinate_partenza?.lon;
    if (typeof lat === 'number' && typeof lon === 'number' && !Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon };
    const c = state.costanti?.coordinate_partenza;
    return c && typeof c.lat === 'number' && typeof c.lon === 'number' ? c : null;
  }

  function getParametro(name) {
    const v = state.parametri[name];
    return v != null && v !== '' ? Number(v) : null;
  }

  function setParametro(name, value) {
    state.parametri[name] = value;
    const el = $(`[data-param="${name}"]`);
    if (el && el.tagName === 'INPUT') el.value = value != null && value !== '' ? String(value) : '';
  }

  /** Inizializza state.parametri con default da costanti/JSON */
  function initParametriFromDefaults() {
    const cp = state.costanti?.coordinate_partenza;
    state.parametri.lat_partenza = cp?.lat != null ? cp.lat : null;
    state.parametri.lon_partenza = cp?.lon != null ? cp.lon : null;
    state.parametri.muletto_settimana = 800;
    state.parametri.muletto_mese = 1200;
    state.parametri.muletto_2mesi = 2300;
    state.parametri.scala_primo_giorno = 600;
    state.parametri.scala_giorno_extra = 100;
    const firstTrasporti = state.trasporti?.length && state.trasporti[0];
    const firstGru = state.gru?.length && state.gru[0];
    state.parametri.costo_km_trasporto = firstTrasporti?.COSTO_KM != null ? firstTrasporti.COSTO_KM : null;
    state.parametri.costo_km_gru = firstGru?.COSTO_KM != null ? firstGru.COSTO_KM : null;

    const pi = state.costanti?.parametri_installazione;
    const defInst = {
      km_soglia_trasferta_interna: 150,
      velocita_media_trasferta_kmh: 60,
      ora_partenza_azienda: 7,
      ora_ritorno_azienda: 18,
      costo_orario_interno: 35,
      costo_orario_esterno: 40,
      rimborso_giornaliero_esterno: 25,
      costo_extra_giorno_interno_trasferta_lunga: 80,
    };
    Object.keys(defInst).forEach((k) => {
      const v = pi && pi[k] != null && pi[k] !== '' ? Number(pi[k]) : null;
      state.parametri[k] = v != null && !Number.isNaN(v) ? v : defInst[k];
    });

    const ptm = state.costanti?.parametri_trasporto_merci || {};
    const defTrm = {
      nostro_mezzo_eur_km_base: 0.05,
      nostro_mezzo_eur_km_pedaggio: 0.06,
      nostro_mezzo_eur_km_carburante: 0.08,
      nostro_mezzo_eur_km_usura: 0.12,
      bilico_eur_km: 2.2,
      camion_gru_eur_km: 2,
    };
    Object.keys(defTrm).forEach((k) => {
      const v = ptm[k] != null && ptm[k] !== '' ? Number(ptm[k]) : null;
      state.parametri[k] = v != null && !Number.isNaN(v) ? v : defTrm[k];
    });
    const sic = state.costanti?.sicurezza_percentuale_auto;
    state.parametri.sicurezza_percentuale_auto = sic != null && sic !== '' && !Number.isNaN(Number(sic)) ? Number(sic) : 5;
  }

  /** Aggiorna costo_km_trasporto e costo_km_gru dalla fascia corrispondente alla distanza (da JSON) */
  function aggiornaParametriDaDistanza() {
    const km = state.distanzaKm;
    if (km == null) return;
    const sortedTrasporti = state.trasporti?.length ? [...state.trasporti].sort((a, b) => (a.DISTANZA || 0) - (b.DISTANZA || 0)) : [];
    const rowTrasporti = sortedTrasporti.find((r) => (r.DISTANZA || 0) >= km) || sortedTrasporti[sortedTrasporti.length - 1];
    if (rowTrasporti?.COSTO_KM != null) setParametro('costo_km_trasporto', rowTrasporti.COSTO_KM);
    const sortedGru = state.gru?.length ? [...state.gru].sort((a, b) => (a.DISTANZA || 0) - (b.DISTANZA || 0)) : [];
    const rowGru = sortedGru.find((r) => (r.DISTANZA || 0) >= km) || sortedGru[sortedGru.length - 1];
    if (rowGru?.COSTO_KM != null) setParametro('costo_km_gru', rowGru.COSTO_KM);
  }

  /** Prima di usare coordinate partenza in calcoli, aggiorna state dai campi del pannello */
  function refreshCoordinatePartenzaFromParametri() {
    const latEl = $('#param-lat-partenza');
    const lonEl = $('#param-lon-partenza');
    if (latEl?.value.trim() !== '') state.parametri.lat_partenza = parseFloat(latEl.value);
    if (lonEl?.value.trim() !== '') state.parametri.lon_partenza = parseFloat(lonEl.value);
  }

  function buildProdottiSelect(obbligatorio) {
    const frag = document.createDocumentFragment();
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = obbligatorio ? '— Seleziona modello —' : 'Nessuno';
    frag.appendChild(opt0);
    state.prodotti.forEach((p) => {
      const mod = p.MODELLO_STRUTTURA;
      if (!mod) return;
      const opt = document.createElement('option');
      opt.value = mod;
      opt.textContent = mod;
      frag.appendChild(opt);
    });
    return frag;
  }

  function getAccessorioMeta(codice) {
    return (state.accessori || []).find((a) => a.nome_prodotti === codice) || null;
  }

  function aggiornaRiepilogoAccessoriSlot(slot) {
    const el = $(`#accessorio-riepilogo-${slot}`);
    if (!el) return;
    const list = state.accessoriSelezioni[slot] || [];
    if (!list.length) {
      el.textContent = 'Nessun accessorio selezionato';
      el.classList.add('accessorio-riepilogo-vuoto');
      return;
    }
    el.classList.remove('accessorio-riepilogo-vuoto');
    el.textContent = list
      .map((x) => {
        const meta = getAccessorioMeta(x.codice);
        const nome = meta?.nome || x.codice;
        const modLabel = x.modalita === 'installato' ? 'fornito e installato' : 'solo fornito';
        return `${nome} (${modLabel})`;
      })
      .join(' · ');
  }

  function renderModalAccessoriLista() {
    const container = $('#modal-accessori-lista');
    if (!container) return;
    container.innerHTML = '';
    const catalog = state.accessori || [];
    if (!catalog.length) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = 'Nessun accessorio configurato in acessori.json.';
      container.appendChild(p);
      return;
    }

    catalog.forEach((acc) => {
      const codice = acc.nome_prodotti;
      if (!codice) return;
      const nome = acc.nome || codice;
      const desc = acc.descrizione != null ? String(acc.descrizione).trim() : '';
      const icona = acc.icona != null ? String(acc.icona).trim() : '';

      const draft = modalAccessoriDraft || [];
      const sel = draft.find((d) => d.codice === codice);
      const checked = !!sel;
      const modalita = sel?.modalita === 'installato' ? 'installato' : 'fornito';

      const row = document.createElement('div');
      row.className = 'modal-accessorio-riga' + (checked ? ' modal-accessorio-riga--attivo' : '');

      const checkCol = document.createElement('div');
      checkCol.className = 'modal-accessorio-check';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = `modal-acc-${modalAccessoriSlot}-${codice}`;
      cb.checked = checked;
      cb.dataset.codice = codice;
      checkCol.appendChild(cb);

      const iconWrap = document.createElement('div');
      iconWrap.className = 'modal-accessorio-icon';
      iconWrap.setAttribute('aria-hidden', 'true');
      if (icona) {
        iconWrap.textContent = icona;
      } else {
        iconWrap.classList.add('modal-accessorio-icon--empty');
      }

      const textCol = document.createElement('div');
      textCol.className = 'modal-accessorio-testo';
      const titolo = document.createElement('div');
      titolo.className = 'modal-accessorio-titolo';
      titolo.textContent = nome;
      textCol.appendChild(titolo);
      if (desc) {
        const sotto = document.createElement('div');
        sotto.className = 'modal-accessorio-desc';
        sotto.textContent = desc;
        textCol.appendChild(sotto);
      }

      const modCol = document.createElement('div');
      modCol.className = 'modal-accessorio-modalita';
      if (!checked) modCol.hidden = true;

      const rg = document.createElement('div');
      rg.className = 'radio-group-inline modal-accessorio-radio';

      const labF = document.createElement('label');
      labF.className = 'radio-label-inline';
      const rF = document.createElement('input');
      rF.type = 'radio';
      rF.name = `modalita-acc-${modalAccessoriSlot}-${codice}`;
      rF.value = 'fornito';
      rF.dataset.codice = codice;
      rF.checked = modalita === 'fornito';
      labF.appendChild(rF);
      labF.appendChild(document.createTextNode(' Solo fornito'));

      const labI = document.createElement('label');
      labI.className = 'radio-label-inline';
      const rI = document.createElement('input');
      rI.type = 'radio';
      rI.name = `modalita-acc-${modalAccessoriSlot}-${codice}`;
      rI.value = 'installato';
      rI.dataset.codice = codice;
      rI.checked = modalita === 'installato';
      labI.appendChild(rI);
      labI.appendChild(document.createTextNode(' Fornito e installato'));

      rg.appendChild(labF);
      rg.appendChild(labI);
      modCol.appendChild(rg);

      row.appendChild(checkCol);
      row.appendChild(iconWrap);
      row.appendChild(textCol);
      row.appendChild(modCol);
      container.appendChild(row);
    });
  }

  function apriModalAccessori(slot) {
    modalAccessoriSlot = slot;
    const cur = state.accessoriSelezioni[slot] || [];
    modalAccessoriDraft = JSON.parse(JSON.stringify(cur));
    const sub = $('#modal-accessori-sottotitolo');
    if (sub) sub.textContent = `Prodotto ${slot}: seleziona uno o più accessori e la modalità per ciascuno.`;
    renderModalAccessoriLista();
    const modal = $('#modal-accessori');
    if (modal) modal.hidden = false;
  }

  function chiudiModalAccessori(conferma) {
    if (conferma && modalAccessoriSlot != null && modalAccessoriDraft) {
      state.accessoriSelezioni[modalAccessoriSlot] = JSON.parse(JSON.stringify(modalAccessoriDraft));
      aggiornaRiepilogoAccessoriSlot(modalAccessoriSlot);
      aggiornaValori();
      aggiornaCampiCalcolati();
    }
    const modal = $('#modal-accessori');
    if (modal) modal.hidden = true;
    modalAccessoriSlot = null;
    modalAccessoriDraft = null;
  }

  function bindModalAccessori() {
    const lista = $('#modal-accessori-lista');
    if (lista) {
      lista.addEventListener('change', (e) => {
        const t = e.target;
        if (!modalAccessoriDraft || modalAccessoriSlot == null) return;
        const codice = t.dataset?.codice;
        if (!codice) return;

        if (t.matches('input[type="checkbox"]')) {
          if (t.checked) {
            if (!modalAccessoriDraft.find((x) => x.codice === codice)) {
              modalAccessoriDraft.push({ codice, modalita: 'fornito' });
            }
          } else {
            modalAccessoriDraft = modalAccessoriDraft.filter((x) => x.codice !== codice);
          }
          renderModalAccessoriLista();
          return;
        }
        if (t.matches('input[type="radio"]')) {
          const item = modalAccessoriDraft.find((x) => x.codice === codice);
          if (item) item.modalita = t.value === 'installato' ? 'installato' : 'fornito';
        }
      });
    }

    $('#btn-conferma-accessori')?.addEventListener('click', () => chiudiModalAccessori(true));
    $('#btn-annulla-accessori')?.addEventListener('click', () => chiudiModalAccessori(false));
    $('#btn-chiudi-modal-accessori')?.addEventListener('click', () => chiudiModalAccessori(false));
    $('#modal-accessori-overlay')?.addEventListener('click', () => chiudiModalAccessori(false));

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const m = $('#modal-accessori');
      if (m && !m.hidden) chiudiModalAccessori(false);
    });
  }

  function buildContainerProdotti() {
    const container = $('#container-slot-prodotti');
    const schema = window.DOMANDE_SCHEMA;
    const n = (schema?.numeroProdotti) || 4;
    if (!container) return;

    container.innerHTML = '';
    state.accessoriSelezioni = { 1: [], 2: [], 3: [], 4: [] };
    for (let i = 1; i <= n; i++) {
      const obbligatorio = i === 1 && schema?.primoObbligatorio;
      const slot = document.createElement('div');
      slot.className = 'slot-prodotto';
      slot.setAttribute('data-slot', i);
      if (i > 1) slot.hidden = true;

      const slotHeader = document.createElement('div');
      slotHeader.className = 'slot-prodotto-header';

      const titolo = document.createElement('h3');
      titolo.className = 'slot-prodotto-titolo';
      titolo.textContent = `Prodotto ${i}${obbligatorio ? ' (obbligatorio)' : ' (opzionale)'}`;
      slotHeader.appendChild(titolo);

      if (i > 1) {
        const btnRimuovi = document.createElement('button');
        btnRimuovi.type = 'button';
        btnRimuovi.className = 'btn-rimuovi-prodotto';
        btnRimuovi.textContent = '✕';
        btnRimuovi.title = 'Rimuovi prodotto';
        btnRimuovi.setAttribute('data-slot', i);
        btnRimuovi.addEventListener('click', () => rimuoviProdotto(i));
        slotHeader.appendChild(btnRimuovi);
      }

      slot.appendChild(slotHeader);

      const rowModello = document.createElement('div');
      rowModello.className = 'domanda';
      const labelModello = document.createElement('label');
      labelModello.setAttribute('for', `input-prodotto-${i}`);
      labelModello.textContent = 'Modello prodotto';
      const selectModello = document.createElement('select');
      selectModello.id = `input-prodotto-${i}`;
      selectModello.name = `prodotto_${i}`;
      selectModello.appendChild(buildProdottiSelect(obbligatorio));
      rowModello.appendChild(labelModello);
      rowModello.appendChild(selectModello);
      slot.appendChild(rowModello);

      if (i === 1) {
        const rowPosti = document.createElement('div');
        rowPosti.className = 'domanda';
        const labelPosti = document.createElement('label');
        labelPosti.setAttribute('for', 'input-posti-auto');
        labelPosti.textContent = 'Numero posti auto';
        const inputPosti = document.createElement('input');
        inputPosti.type = 'number';
        inputPosti.id = 'input-posti-auto';
        inputPosti.name = 'numero_posti_auto';
        inputPosti.min = 1;
        inputPosti.max = 20;
        inputPosti.value = 2;
        rowPosti.appendChild(labelPosti);
        rowPosti.appendChild(inputPosti);
        slot.appendChild(rowPosti);
      }

      const accessorioItem = document.createElement('div');
      accessorioItem.className = 'accessorio-item';

      const accessorioActions = document.createElement('div');
      accessorioActions.className = 'accessorio-item-actions';

      const btnAccessori = document.createElement('button');
      btnAccessori.type = 'button';
      btnAccessori.className = 'btn-accessori-apri';
      btnAccessori.id = `btn-accessori-${i}`;
      btnAccessori.setAttribute('data-slot', String(i));
      btnAccessori.textContent = 'Aggiungi accessorio';

      const riepilogoAcc = document.createElement('p');
      riepilogoAcc.className = 'accessorio-riepilogo accessorio-riepilogo-vuoto';
      riepilogoAcc.id = `accessorio-riepilogo-${i}`;
      riepilogoAcc.textContent = 'Nessun accessorio selezionato';

      accessorioActions.appendChild(btnAccessori);
      accessorioItem.appendChild(accessorioActions);
      accessorioItem.appendChild(riepilogoAcc);
      slot.appendChild(accessorioItem);

      btnAccessori.addEventListener('click', () => apriModalAccessori(i));

      container.appendChild(slot);
    }

    /* Bottone "+ Aggiungi prodotto" */
    const btnAdd = document.createElement('button');
    btnAdd.type = 'button';
    btnAdd.id = 'btn-aggiungi-prodotto';
    btnAdd.className = 'btn btn-aggiungi-prodotto';
    btnAdd.textContent = '＋ Aggiungi prodotto';
    btnAdd.addEventListener('click', () => {
      const nextSlot = container.querySelector('.slot-prodotto[hidden]');
      if (nextSlot) {
        nextSlot.hidden = false;
        aggiornaValori();
      }
      if (!container.querySelector('.slot-prodotto[hidden]')) btnAdd.hidden = true;
    });
    container.appendChild(btnAdd);
  }

  function rimuoviProdotto(slot) {
    const slotEl = $(`.slot-prodotto[data-slot="${slot}"]`);
    if (!slotEl) return;
    
    const selectProdotto = $(`#input-prodotto-${slot}`);
    if (selectProdotto) selectProdotto.value = '';
    state.accessoriSelezioni[slot] = [];
    aggiornaRiepilogoAccessoriSlot(slot);
    
    slotEl.hidden = true;
    
    const btnAdd = $('#btn-aggiungi-prodotto');
    if (btnAdd) btnAdd.hidden = false;
    
    aggiornaValori();
    checkSubmitFn();
  }

  function aggiungiServizioPersonalizzato() {
    const container = $('#container-servizi-personalizzati');
    if (!container) return;

    serviziPersonalizzatiCounter++;
    const id = serviziPersonalizzatiCounter;

    const servizioItem = document.createElement('div');
    servizioItem.className = 'servizio-personalizzato-item';
    servizioItem.setAttribute('data-servizio-id', id);

    const header = document.createElement('div');
    header.className = 'servizio-personalizzato-header';

    const titolo = document.createElement('h4');
    titolo.className = 'servizio-personalizzato-titolo';
    titolo.textContent = `Servizio personalizzato #${id}`;

    const btnRimuovi = document.createElement('button');
    btnRimuovi.type = 'button';
    btnRimuovi.className = 'btn-rimuovi-servizio';
    btnRimuovi.textContent = '✕';
    btnRimuovi.title = 'Rimuovi servizio';
    btnRimuovi.addEventListener('click', () => rimuoviServizioPersonalizzato(id));

    header.appendChild(titolo);
    header.appendChild(btnRimuovi);
    servizioItem.appendChild(header);

    const body = document.createElement('div');
    body.className = 'servizio-personalizzato-body';

    const rowDescrizione = document.createElement('div');
    rowDescrizione.className = 'domanda';
    const labelDesc = document.createElement('label');
    labelDesc.setAttribute('for', `servizio-desc-${id}`);
    labelDesc.textContent = 'Descrizione servizio';
    const inputDesc = document.createElement('input');
    inputDesc.type = 'text';
    inputDesc.id = `servizio-desc-${id}`;
    inputDesc.name = `servizio_desc_${id}`;
    inputDesc.placeholder = 'Es. Trasporto speciale, Lavori extra, ecc.';
    inputDesc.addEventListener('input', aggiornaValori);
    rowDescrizione.appendChild(labelDesc);
    rowDescrizione.appendChild(inputDesc);
    body.appendChild(rowDescrizione);

    const rowCosto = document.createElement('div');
    rowCosto.className = 'domanda';
    const labelCosto = document.createElement('label');
    labelCosto.setAttribute('for', `servizio-costo-${id}`);
    labelCosto.textContent = 'Costo (€)';
    const inputCosto = document.createElement('input');
    inputCosto.type = 'number';
    inputCosto.id = `servizio-costo-${id}`;
    inputCosto.name = `servizio_costo_${id}`;
    inputCosto.min = 0;
    inputCosto.step = 0.01;
    inputCosto.placeholder = '0.00';
    inputCosto.addEventListener('input', aggiornaValori);
    rowCosto.appendChild(labelCosto);
    rowCosto.appendChild(inputCosto);
    body.appendChild(rowCosto);

    const rowNote = document.createElement('div');
    rowNote.className = 'domanda';
    const labelNote = document.createElement('label');
    labelNote.setAttribute('for', `servizio-note-${id}`);
    labelNote.textContent = 'Note aggiuntive (opzionale)';
    const textareaNote = document.createElement('textarea');
    textareaNote.id = `servizio-note-${id}`;
    textareaNote.name = `servizio_note_${id}`;
    textareaNote.rows = 2;
    textareaNote.placeholder = 'Dettagli o informazioni aggiuntive...';
    textareaNote.addEventListener('input', aggiornaValori);
    rowNote.appendChild(labelNote);
    rowNote.appendChild(textareaNote);
    body.appendChild(rowNote);

    servizioItem.appendChild(body);
    container.appendChild(servizioItem);

    state.serviziPersonalizzati.push({ id, descrizione: '', costo: 0, note: '' });
    aggiornaValori();
  }

  function rimuoviServizioPersonalizzato(id) {
    const servizioEl = $(`.servizio-personalizzato-item[data-servizio-id="${id}"]`);
    if (servizioEl) servizioEl.remove();

    const idx = state.serviziPersonalizzati.findIndex(s => s.id === id);
    if (idx !== -1) state.serviziPersonalizzati.splice(idx, 1);

    aggiornaValori();
  }

  function abilitaProdotti() {
    const container = $('#container-prodotti');
    if (container) container.hidden = false;
    const posti = $('#input-posti-auto');
    if (posti && !posti.value) posti.value = '2';
  }

  function aggiornaValori() {
    state.valori.indirizzo_cantiere = ($('#input-indirizzo')?.value || '').trim();
    state.valori.distanza_km = state.distanzaKm;
    state.valori.prodotti = [];
    state.valori.accessori = [];
    for (let i = 1; i <= 4; i++) {
      const selProdotto = $(`#input-prodotto-${i}`);
      const mod = selProdotto?.value || '';
      state.valori.prodotti.push(mod);
      const lista = state.accessoriSelezioni[i] || [];
      state.valori.accessori.push(
        lista.map((x) => ({ codice: x.codice, modalita: x.modalita === 'installato' ? 'installato' : 'fornito' }))
      );
    }
    const posti = $('#input-posti-auto');
    state.valori.numero_posti_auto = posti ? (parseInt(posti.value, 10) || 2) : 2;
    state.valori.tecnici_interni = parseInt($('#input-tecnici-interni')?.value, 10) || 0;
    state.valori.presenza_tecnici_interni_pct = parseInt($('#input-presenza-interni')?.value, 10) ?? 100;
    state.valori.tecnici_esterni = calcoloNumeroTecniciEsterni();
    state.valori.presenza_tecnici_esterni_pct = calcoloPresenzaEsterni();
    const mulActv = $('#toggle-muletto')?.checked;
    const scaActv = $('#toggle-scala')?.checked;
    const gruActv = $('#toggle-gru')?.checked;
    state.valori.giorni_noleggio_muletto = mulActv ? (parseInt($('#input-giorni-muletto')?.value, 10) || 7) : 0;
    state.valori.costo_noleggio_muletto  = mulActv ? calcoloCostoMuletto(state.valori.giorni_noleggio_muletto) : null;
    state.valori.giorni_noleggio_scala   = scaActv ? (parseInt($('#input-giorni-scala')?.value, 10) || 1) : 0;
    state.valori.costo_noleggio_scala    = scaActv ? calcoloCostoScala(state.valori.giorni_noleggio_scala) : null;
    state.valori.giorni_presenza_gru     = gruActv ? (parseInt($('#input-giorni-gru')?.value, 10) || 1) : 0;
    state.valori.costo_gru_trasporto     = gruActv ? getCostoGruPerDistanza(state.distanzaKm) : null;

    state.valori.servizi_personalizzati = [];
    state.serviziPersonalizzati.forEach(servizio => {
      const descInput = $(`#servizio-desc-${servizio.id}`);
      const costoInput = $(`#servizio-costo-${servizio.id}`);
      const noteInput = $(`#servizio-note-${servizio.id}`);
      
      const desc = descInput?.value.trim() || '';
      const costo = costoInput ? parseFloat(costoInput.value) || 0 : 0;
      const note = noteInput?.value.trim() || '';
      
      if (desc || costo > 0) {
        state.valori.servizi_personalizzati.push({
          id: servizio.id,
          descrizione: desc,
          costo: costo,
          note: note
        });
      }
    });

    state.valori.sicurezza_inclusa = $('#sicurezza-includi')?.checked === true;
    state.valori.sicurezza_importo_euro = Math.max(0, parseFloat($('#sicurezza-importo')?.value) || 0);
    state.valori.modalita_trasporto_merci = document.querySelector('input[name="trasporto_modalita_merci"]:checked')?.value || 'nostro_mezzo';
  }

  function prodottoSelezionato(slot) {
    const sel = $(`#input-prodotto-${slot == null ? 1 : slot}`);
    const mod = sel?.value;
    if (!mod || !state.prodotti.length) return null;
    return state.prodotti.find((p) => p.MODELLO_STRUTTURA === mod) || null;
  }

  /** Ore struttura da ORE_INSTALLAZIONE_{posti}PA (posti 1–20). */
  function getOreStrutturaProdotto(prodotto, posti) {
    const n = Math.min(Math.max(parseInt(String(posti), 10) || 1, 1), 20);
    const key = `ORE_INSTALLAZIONE_${n}PA`;
    let v = prodotto[key];
    if (v == null || Number.isNaN(Number(v))) v = prodotto.ORE_INSTALLAZIONE_1PA;
    return Number(v) || 0;
  }

  /** Ore accessorio da ORE_INSTALLAZIONE_{codice} sul prodotto. */
  function getOreAccessorioProdotto(prodotto, codice) {
    const key = `ORE_INSTALLAZIONE_${codice}`;
    const v = prodotto[key];
    return v != null && !Number.isNaN(Number(v)) ? Number(v) : 0;
  }

  function calcolaOreInstallazioneCantiere() {
    const posti = Math.min(Math.max(parseInt($('#input-posti-auto')?.value, 10) || 2, 1), 20);
    let totale = 0;
    const dettagli = [];

    for (let i = 1; i <= 4; i++) {
      const mod = $(`#input-prodotto-${i}`)?.value || '';
      if (!mod) continue;
      const p = state.prodotti.find((x) => x.MODELLO_STRUTTURA === mod);
      if (!p) continue;

      const oreStruttura = getOreStrutturaProdotto(p, posti);
      let oreAcc = 0;
      const accDet = [];
      const lista = state.accessoriSelezioni[i] || [];
      for (const a of lista) {
        if (a.modalita !== 'installato') continue;
        const o = getOreAccessorioProdotto(p, a.codice);
        oreAcc += o;
        accDet.push({ codice: a.codice, ore: o });
      }

      const oreSlotTot = oreStruttura + oreAcc;
      totale += oreSlotTot;
      dettagli.push({
        slot: i,
        modello: mod,
        oreStruttura,
        accessori: accDet,
        oreSlotTot,
      });
    }

    return { totale, dettagli, posti };
  }

  function calcolaTempoViaggioOre(distanzaKm) {
    const vel = getParametro('velocita_media_trasferta_kmh') ?? 60;
    if (distanzaKm == null || distanzaKm < 0 || vel <= 0) return { andata: null, ar: null };
    const andata = distanzaKm / vel;
    return { andata, ar: 2 * andata };
  }

  function getTrasfertaDefaultsEmbedded() {
    return {
      giornata_lavorativa: { ora_inizio: 7.5, ora_fine: 17.5, pausa_pranzo_ore: 1, pausa_ora_inizio: 12, pausa_ora_fine: 13 },
      premio_trasferta_euro_per_tecnico_per_giorno: 50,
      ore_minime_cantiere_stesso_giorno_trasferta: 3,
      ora_massima_rientro_casa: 18,
      rientro_weekend_default: true,
      premio_include_giorni_viaggio_default: true,
      mezzo_aziendale: { eur_litro_gasolio: 1.75, litri_100km: 8, usura_euro_km: 0.12, pedaggio_euro_km: 0.06 },
      treno: { costo_medio_andata_ritorno_per_persona: 90, taxi_stazione_cantiere_per_tratta: 45 },
      aereo: { costo_medio_andata_ritorno_per_persona: 220, taxi_aeroporto_cantiere_per_tratta: 55 },
      hotel_euro_per_notte: 75,
      costo_extra_generico_default: 0,
    };
  }

  function getTrasfertaCfg() {
    const t = state.trasfertaConfig;
    const def = getTrasfertaDefaultsEmbedded();
    if (!t || typeof t !== 'object') return def;
    return {
      ...def,
      ...t,
      giornata_lavorativa: { ...def.giornata_lavorativa, ...(t.giornata_lavorativa || {}) },
      mezzo_aziendale: { ...def.mezzo_aziendale, ...(t.mezzo_aziendale || {}) },
      treno: { ...def.treno, ...(t.treno || {}) },
      aereo: { ...def.aereo, ...(t.aereo || {}) },
    };
  }

  /** Ore disponibili per lavoro (cantiere) al giorno: fascia − pausa pranzo (stesso valore per interni ed esterni). */
  function getOreGiornataNetteLavoro() {
    const g = getTrasfertaCfg().giornata_lavorativa || {};
    const ini = Number(g.ora_inizio) >= 0 ? Number(g.ora_inizio) : 7.5;
    const fin = Number(g.ora_fine) > ini ? Number(g.ora_fine) : 17.5;
    const pz = Number(g.pausa_pranzo_ore) >= 0 ? Number(g.pausa_pranzo_ore) : 1;
    return Math.max(0, fin - ini - pz);
  }

  /** Ore lavorabili in [oraA, oraB] togliendo la sovrapposizione con la pausa pranzo. */
  function oreNetteInIntervallo(oraA, oraB, pausaInizio, pausaFine) {
    if (oraB <= oraA) return 0;
    let tot = oraB - oraA;
    const pi = Math.max(oraA, pausaInizio);
    const pf = Math.min(oraB, pausaFine);
    if (pf > pi) tot -= pf - pi;
    return Math.max(0, tot);
  }

  /** Lunedì: ore cantiere solo se ore nette − viaggio andata ≥ soglia minima. */
  function oreCantiereLunedi(oreNette, tV, oreMin) {
    const residuo = oreNette - tV;
    if (residuo + 1e-9 >= oreMin) return Math.max(0, residuo);
    return 0;
  }

  /** Venerdì: se rientro in weekend, partenza dal cantiere in tempo per essere a casa entro ora_max (meno ore viaggio). */
  function oreCantiereVenerdi(oraInizio, oraFine, pausaInizio, pausaFine, oraMaxRientro, tV, rientroWeekend, oreNetteGiornoIntero) {
    if (!rientroWeekend) return oreNetteGiornoIntero;
    const oraPartenza = oraMaxRientro - tV;
    if (oraPartenza <= oraInizio) return 0;
    const fineLavoro = Math.min(oraFine, oraPartenza);
    return oreNetteInIntervallo(oraInizio, fineLavoro, pausaInizio, pausaFine);
  }

  /**
   * Motore settimanale trasferta: distribuisce H_int sulle giornate (lun–ven o lun–dom se no rientro weekend).
   * Ritorna ore pagate = giorni pagati × N × ore nette giornaliera (ogni giorno in missione è pagato intero).
   */
  function simulaPianoTrasfertaInterni(opts) {
    const {
      H_int,
      N_int,
      oreNette,
      tV,
      oreMin,
      oraInizio,
      oraFine,
      pausaInizio,
      pausaFine,
      oraMaxRientro,
      rientroWeekend,
      c_int,
    } = opts;

    const oreCapLun = oreCantiereLunedi(oreNette, tV, oreMin);
    const oreCapVen = oreCantiereVenerdi(oraInizio, oraFine, pausaInizio, pausaFine, oraMaxRientro, tV, rientroWeekend, oreNette);
    const oreCapMid = oreNette;

    function notaGiorno(tipo, oreCapLunLoc, rientro) {
      if (tipo === 'lun') {
        if (oreCapLunLoc <= 1e-6) return 'Sotto le ore minime dopo l\'andata: nessun cantiere (giornata di viaggio).';
        return 'Andata in trasferta; ore cantiere = ore nette − tempo viaggio.';
      }
      if (tipo === 'ven') {
        if (!rientro) return 'Giornata in cantiere (rientro weekend disattivato).';
        return `Partenza anticipata per rientro entro le ${formatOraDecimaleIt(oraMaxRientro)} (viaggio ${fmtOre(tV)}).`;
      }
      if (tipo === 'sab' || tipo === 'dom') return 'Weekend in cantiere (opzione senza rientro).';
      return 'Giornata in cantiere.';
    }

    function viaggioOre(tipo, rientro) {
      if (tipo === 'lun') return tV;
      if (tipo === 'ven' && rientro) return tV;
      return null;
    }

    function giorniTemplate() {
      const base = [
        { tipo: 'lun', label: 'Lunedì', cap: oreCapLun },
        { tipo: 'mar', label: 'Martedì', cap: oreCapMid },
        { tipo: 'mer', label: 'Mercoledì', cap: oreCapMid },
        { tipo: 'gio', label: 'Giovedì', cap: oreCapMid },
        { tipo: 'ven', label: 'Venerdì', cap: oreCapVen },
      ];
      if (!rientroWeekend) {
        base.push(
          { tipo: 'sab', label: 'Sabato', cap: oreCapMid },
          { tipo: 'dom', label: 'Domenica', cap: oreCapMid },
        );
      }
      return base;
    }

    let remaining = H_int;
    const rows = [];
    let weekNum = 0;
    const maxWeeks = 260;
    const tpl = giorniTemplate();

    while (remaining > 1e-6 && weekNum < maxWeeks) {
      weekNum += 1;
      for (const d of tpl) {
        const capTeam = N_int * d.cap;
        const work = Math.min(remaining, capTeam);
        remaining -= work;
        const v = viaggioOre(d.tipo, rientroWeekend);
        rows.push({
          settimana: weekNum,
          giorno: d.label,
          tipo: d.tipo,
          ore_cantiere_squadra: Math.round(work * 1000) / 1000,
          ore_cantiere_max_squadra: Math.round(capTeam * 1000) / 1000,
          ore_viaggio: v,
          nota: notaGiorno(d.tipo, oreCapLun, rientroWeekend),
        });
        if (remaining <= 1e-6) break;
      }
    }

    const overflow = remaining > 1e-3;
    const paidDays = rows.length;
    const orePagateInt = paidDays * N_int * oreNette;
    const costoManodoperaInt = orePagateInt * c_int;

    return {
      rows,
      paidDays,
      orePagateInt,
      costoManodoperaInt,
      overflow,
      oreCapLun,
      oreCapVen,
    };
  }

  function formatOraDecimaleIt(h) {
    if (h == null || Number.isNaN(h)) return '—';
    const H = Math.floor(h);
    const m = Math.round((h - H) * 60);
    return `${H}:${String(m).padStart(2, '0')}`;
  }

  /**
   * Costo viaggio stimato in base alla modalità (solo stima contabile).
   * Mezzo: gasolio + usura + pedaggio su km A/R. Treno/Aereo: biglietto medio + taxi stazione/aeroporto (andata+ritorno).
   */
  function stimaCostoViaggioTrasferta(distanzaKm, N_int, tipo) {
    const cfg = getTrasfertaCfg();
    const d = distanzaKm;
    if (d == null || d <= 0 || N_int <= 0) return 0;
    const km = 2 * d;
    if (tipo === 'mezzo_aziendale') {
      const m = cfg.mezzo_aziendale || {};
      const lit = (m.litri_100km != null ? Number(m.litri_100km) : 8);
      const eL = (m.eur_litro_gasolio != null ? Number(m.eur_litro_gasolio) : 1.75);
      const gas = (km / 100) * lit * eL;
      const usura = km * (m.usura_euro_km != null ? Number(m.usura_euro_km) : 0.12);
      const ped = km * (m.pedaggio_euro_km != null ? Number(m.pedaggio_euro_km) : 0.06);
      return gas + usura + ped;
    }
    if (tipo === 'treno') {
      const t = cfg.treno || {};
      const big = (t.costo_medio_andata_ritorno_per_persona != null ? Number(t.costo_medio_andata_ritorno_per_persona) : 90);
      const taxi = (t.taxi_stazione_cantiere_per_tratta != null ? Number(t.taxi_stazione_cantiere_per_tratta) : 45);
      return N_int * big + 2 * N_int * taxi;
    }
    if (tipo === 'aereo') {
      const a = cfg.aereo || {};
      const big = (a.costo_medio_andata_ritorno_per_persona != null ? Number(a.costo_medio_andata_ritorno_per_persona) : 220);
      const taxi = (a.taxi_aeroporto_cantiere_per_tratta != null ? Number(a.taxi_aeroporto_cantiere_per_tratta) : 55);
      return N_int * big + 2 * N_int * taxi;
    }
    return 0;
  }

  function fmtOre(h) {
    if (h == null || Number.isNaN(h)) return '—';
    return `${Math.round(h * 100) / 100} h`;
  }

  function fmtEuro(n) {
    if (n == null || Number.isNaN(n)) return '—';
    return `€ ${Math.round(n * 100) / 100}`;
  }

  function aggiornaOreInstallazioneUI() {
    aggiornaValori();
    const sec = $('#sezione-installazione');
    if (!sec) return;

    const d = state.distanzaKm;
    const primo = state.valori.prodotti?.[0] || '';
    if (d == null || !primo) {
      sec.hidden = true;
      if (state.valori) delete state.valori.stima_installazione;
      return;
    }

    const { totale, dettagli, posti } = calcolaOreInstallazioneCantiere();
    const { andata, ar } = calcolaTempoViaggioOre(d);

    const soglia = getParametro('km_soglia_trasferta_interna') ?? 150;
    const cfgTr = getTrasfertaCfg();
    const gLav = cfgTr.giornata_lavorativa || {};
    const oraInizioG = Number(gLav.ora_inizio) >= 0 ? Number(gLav.ora_inizio) : 7.5;
    const oraFineG = Number(gLav.ora_fine) > oraInizioG ? Number(gLav.ora_fine) : 17.5;
    const pausaPranzo = Number(gLav.pausa_pranzo_ore) >= 0 ? Number(gLav.pausa_pranzo_ore) : 1;
    const oreNette = getOreGiornataNetteLavoro();
    const tV = andata != null ? andata : 0;
    const pausaInizio = Number(gLav.pausa_ora_inizio) >= 0 ? Number(gLav.pausa_ora_inizio) : 12;
    const pausaFine = Number(gLav.pausa_ora_fine) > pausaInizio ? Number(gLav.pausa_ora_fine) : 13;

    const elFascia = $('#testo-fascia-oraria');
    if (elFascia) elFascia.textContent = `${formatOraDecimaleIt(oraInizioG)}–${formatOraDecimaleIt(oraFineG)}`;
    const elPz = $('#testo-pausa-pranzo');
    if (elPz) elPz.textContent = String(pausaPranzo);
    const elOreNet = $('#valore-ore-giornata-nette');
    if (elOreNet) elOreNet.textContent = String(Math.round(oreNette * 100) / 100);

    const P = parseInt($('#input-presenza-interni')?.value, 10);
    const pInt = Number.isNaN(P) ? 100 : Math.max(0, Math.min(100, P));
    const N_int = parseInt($('#input-tecnici-interni')?.value, 10) || 0;
    const N_est = calcoloNumeroTecniciEsterni();

    const H = totale;
    const H_int = (H * pInt) / 100;
    const H_ext = (H * (100 - pInt)) / 100;

    const c_int = getParametro('costo_orario_interno') ?? 0;
    const c_ext = getParametro('costo_orario_esterno') ?? 0;
    const rimborso = getParametro('rimborso_giornaliero_esterno') ?? 0;

    const trasfertaAttiva = d > soglia && N_int > 0;
    const tipoTr = $('#trasferta-tipo-modalita')?.value || 'mezzo_aziendale';
    const premioInclViaggio = $('#trasferta-premio-giorni-viaggio')?.checked !== false;
    const rientroWeekend = $('#trasferta-rientro-weekend')?.checked !== false;
    const extraUtente = Math.max(0, parseFloat($('#trasferta-costo-extra')?.value) || 0);
    const oreMinCfg = cfgTr.ore_minime_cantiere_stesso_giorno_trasferta != null ? Number(cfgTr.ore_minime_cantiere_stesso_giorno_trasferta) : 3;
    const oraMaxRientro = cfgTr.ora_massima_rientro_casa != null ? Number(cfgTr.ora_massima_rientro_casa) : 18;

    let giorniInt = 0;
    let orePagateInt = 0;
    let costoManodoperaInt = 0;
    let pianoTrasferta = null;
    if (N_int > 0 && H_int > 0) {
      if (trasfertaAttiva) {
        pianoTrasferta = simulaPianoTrasfertaInterni({
          H_int,
          N_int,
          oreNette,
          tV,
          oreMin: oreMinCfg,
          oraInizio: oraInizioG,
          oraFine: oraFineG,
          pausaInizio,
          pausaFine,
          oraMaxRientro,
          rientroWeekend,
          c_int,
        });
        giorniInt = pianoTrasferta.paidDays;
        orePagateInt = pianoTrasferta.orePagateInt;
        costoManodoperaInt = pianoTrasferta.costoManodoperaInt;
      } else {
        giorniInt = Math.max(1, Math.ceil(H_int / (N_int * Math.max(oreNette, 0.01))));
        orePagateInt = N_int * giorniInt * oreNette;
        costoManodoperaInt = orePagateInt * c_int;
      }
    }

    const premioGiorno = cfgTr.premio_trasferta_euro_per_tecnico_per_giorno != null ? Number(cfgTr.premio_trasferta_euro_per_tecnico_per_giorno) : 50;
    const giorniPremioBase = trasfertaAttiva && giorniInt > 0 ? giorniInt : 0;
    const giorniPremio = trasfertaAttiva ? (premioInclViaggio ? giorniPremioBase : Math.max(0, giorniPremioBase - 2)) : 0;
    const premioTot = trasfertaAttiva ? giorniPremio * N_int * premioGiorno : 0;
    const costoViaggioStima = trasfertaAttiva ? stimaCostoViaggioTrasferta(d, N_int, tipoTr) : 0;
    const hotelNotte = cfgTr.hotel_euro_per_notte != null ? Number(cfgTr.hotel_euro_per_notte) : 75;
    const nottiHotel = trasfertaAttiva && giorniInt > 0 ? Math.max(0, giorniInt - 1) : 0;
    const hotelTot = trasfertaAttiva ? nottiHotel * hotelNotte : 0;
    const totaleVociTrasferta = trasfertaAttiva ? premioTot + costoViaggioStima + hotelTot + extraUtente : 0;
    const costoInterniComplessivo = costoManodoperaInt + totaleVociTrasferta;

    let giorniEst = 0;
    let costoEst = 0;
    if (H_ext > 0) {
      if (N_est > 0) {
        giorniEst = Math.max(1, Math.ceil(H_ext / Math.max(oreNette * N_est, 0.01)));
        costoEst = H_ext * c_ext + giorniEst * rimborso * N_est;
      } else {
        costoEst = H_ext * c_ext;
      }
    }

    const totaleMan = costoInterniComplessivo + costoEst;

    const bloccoUt = $('#blocco-trasferta-utente');
    if (bloccoUt) bloccoUt.hidden = !trasfertaAttiva;
    const bloccoEs = $('#blocco-trasferta-esito');
    if (bloccoEs) bloccoEs.hidden = !trasfertaAttiva;
    const rigaTotInt = $('#riga-totale-interni-complessivo');
    if (rigaTotInt) rigaTotInt.hidden = !trasfertaAttiva;

    const wrapPiano = $('#trasferta-piano-settimanale-wrapper');
    const tbodyPiano = $('#trasferta-tabella-giorni-body');
    if (wrapPiano) wrapPiano.hidden = !trasfertaAttiva || !pianoTrasferta?.rows?.length;
    if (tbodyPiano) {
      if (trasfertaAttiva && pianoTrasferta?.rows?.length) {
        tbodyPiano.innerHTML = '';
        pianoTrasferta.rows.forEach((r) => {
          const tr = document.createElement('tr');
          const vi = r.ore_viaggio != null ? fmtOre(r.ore_viaggio) : '—';
          tr.innerHTML = `<td>Sett. ${r.settimana} · ${r.giorno}</td><td>${fmtOre(r.ore_cantiere_squadra)}</td><td>${fmtOre(r.ore_cantiere_max_squadra)}</td><td>${vi}</td><td class="trasferta-cell-nota">${r.nota}</td>`;
          tbodyPiano.appendChild(tr);
        });
        if (pianoTrasferta.overflow) {
          const tr = document.createElement('tr');
          tr.className = 'trasferta-riga-warning';
          tr.innerHTML = '<td colspan="5">Attenzione: limite settimane superato; verifica ore o tecnici.</td>';
          tbodyPiano.appendChild(tr);
        }
      } else {
        tbodyPiano.innerHTML = '';
      }
    }

    if (trasfertaAttiva) {
      const elPr = $('#valore-premio-trasferta');
      const premioExtraTxt = !premioInclViaggio && giorniPremioBase > 0 ? ' (2 gg viaggio esclusi dal premio)' : '';
      if (elPr) elPr.textContent = `${fmtEuro(premioTot)} (${giorniPremio} gg × ${N_int} × ${premioGiorno} €)${premioExtraTxt}`;
      const elVg = $('#valore-costo-viaggio-modalita');
      if (elVg) elVg.textContent = `${fmtEuro(costoViaggioStima)} (${tipoTr.replace(/_/g, ' ')})`;
      const elHt = $('#valore-costo-hotel-trasferta');
      if (elHt) elHt.textContent = `${fmtEuro(hotelTot)} (${nottiHotel} notti × ${hotelNotte} €)`;
      const elEx = $('#valore-costo-extra-trasferta-linea');
      if (elEx) elEx.textContent = fmtEuro(extraUtente);
      const elVt = $('#valore-totale-voci-trasferta');
      if (elVt) elVt.textContent = fmtEuro(totaleVociTrasferta);
    }

    const elTot = $('#valore-ore-cantiere-totale');
    if (elTot) elTot.textContent = fmtOre(H);
    const elVa = $('#valore-viaggio-andata');
    if (elVa) elVa.textContent = andata != null ? fmtOre(andata) : '—';
    const elAr = $('#valore-viaggio-ar');
    if (elAr) elAr.textContent = ar != null ? fmtOre(ar) : '—';

    const ul = $('#lista-dettaglio-ore');
    if (ul) {
      ul.innerHTML = '';
      if (!dettagli.length) {
        const li = document.createElement('li');
        li.textContent = 'Nessun prodotto selezionato oltre il primo.';
        ul.appendChild(li);
      } else {
        dettagli.forEach((row) => {
          const li = document.createElement('li');
          const accTxt = row.accessori.length
            ? row.accessori.map((a) => `${a.codice}: ${fmtOre(a.ore)}`).join(', ')
            : 'nessun accessorio da installare';
          li.innerHTML = `<strong>Prodotto ${row.slot}</strong> (${row.modello}), ${posti} PA — struttura ${fmtOre(row.oreStruttura)}; accessori: ${accTxt} → <strong>totale slot ${fmtOre(row.oreSlotTot)}</strong>`;
          ul.appendChild(li);
        });
      }
    }

    const regime = d <= soglia ? `Giornata (≤ ${soglia} km)` : `Trasferta lunga (> ${soglia} km)`;
    const elReg = $('#valore-regime-distanza');
    if (elReg) elReg.textContent = regime;
    const elOpi = $('#valore-ore-pagate-interne');
    if (elOpi) elOpi.textContent = N_int > 0 && H_int > 0 ? fmtOre(orePagateInt) : '—';
    const elCi = $('#valore-costo-interni');
    if (elCi) elCi.textContent = H_int > 0 ? fmtEuro(costoManodoperaInt) : '—';
    const elCiTot = $('#valore-totale-interni-complessivo');
    if (elCiTot) elCiTot.textContent = H_int > 0 && trasfertaAttiva ? fmtEuro(costoInterniComplessivo) : (H_int > 0 ? fmtEuro(costoManodoperaInt) : '—');
    const elCe = $('#valore-costo-esterni');
    if (elCe) elCe.textContent = H_ext > 0 ? fmtEuro(costoEst) : '—';
    const elTm = $('#valore-totale-manodopera');
    if (elTm) elTm.textContent = H > 0 ? fmtEuro(totaleMan) : '—';

    state.valori.stima_installazione = {
      posti_auto: posti,
      ore_lavoro_cantiere_totale: H,
      ore_giornata_nette: oreNette,
      dettaglio_slot: dettagli,
      tempo_viaggio_andata_ore: andata,
      tempo_viaggio_ar_ore: ar,
      soglia_km: soglia,
      regime: d <= soglia ? 'giornata' : 'trasferta_lunga',
      presenza_interni_pct: pInt,
      tecnici_interni: N_int,
      tecnici_esterni: N_est,
      ore_pagate_interne_stimate: N_int > 0 ? orePagateInt : null,
      giorni_interni_stimati: giorniInt || null,
      giorni_esterni_stimati: giorniEst || null,
      piano_settimanale_interni: pianoTrasferta?.rows || null,
      overflow_trasferta_simulazione: pianoTrasferta?.overflow || false,
      costo_interni_manodopera_stimato: costoManodoperaInt,
      costo_esterni_stimato: costoEst,
      trasferta: trasfertaAttiva
        ? {
            tipo_modalita: tipoTr,
            premio_totale: premioTot,
            giorni_premio: giorniPremio,
            giorni_pagati_missione: giorniInt,
            costo_viaggio_stima: costoViaggioStima,
            hotel_notti: nottiHotel,
            hotel_totale: hotelTot,
            extra_utente: extraUtente,
            totale_voci_trasferta: totaleVociTrasferta,
            rientro_weekend: rientroWeekend,
            premio_include_giorni_viaggio: premioInclViaggio,
          }
        : null,
      costo_interni_totale_con_trasferta: costoInterniComplessivo,
      totale_manodopera_stimato: totaleMan,
    };

    sec.hidden = false;
  }

  function mostraNascondiDomande() {
    aggiornaValori();
    const domandaDistanza = $('#domanda-distanza');
    if (domandaDistanza) domandaDistanza.hidden = state.distanzaKm == null;
    abilitaProdotti();
    const secTecnici = $('#sezione-tecnici-noleggi');
    /* Stessa logica della domanda distanza: tecnici, trasporto struttura e riepilogo solo dopo km calcolati */
    if (secTecnici) secTecnici.hidden = state.distanzaKm == null;
    aggiornaCampiCalcolati();
  }

  /** Presenza tecnici esterni % = 100 − presenza interni % */
  function calcoloPresenzaEsterni() {
    const p = parseInt($('#input-presenza-interni')?.value, 10);
    return Number.isNaN(p) ? 0 : Math.max(0, Math.min(100, 100 - p));
  }

  /**
   * Numero tecnici esterni calcolato da interni N e presenza interni P%.
   * esterni / (interni + esterni) = (100 − P) / 100
   * → esterni = N × (100 − P) / P   (se P = 0 → 0)
   */
  function calcoloNumeroTecniciEsterni() {
    const n    = parseInt($('#input-tecnici-interni')?.value, 10) || 0;
    const pInt = parseInt($('#input-presenza-interni')?.value, 10);
    if (n <= 0 || Number.isNaN(pInt) || pInt <= 0) return 0;
    if (pInt >= 100) return 0;
    return Math.round(n * (100 - pInt) / pInt);
  }

  /** Noleggio muletto: usa state.parametri (modificabili in sessione) */
  function calcoloCostoMuletto(giorni) {
    const g = parseInt(giorni, 10) || 0;
    if (g <= 0) return null;
    const sette = getParametro('muletto_settimana') ?? 800;
    const mese = getParametro('muletto_mese') ?? 1200;
    const dueMesi = getParametro('muletto_2mesi') ?? 2300;
    if (g <= 7) return sette;
    if (g <= 30) return mese;
    if (g <= 60) return dueMesi;
    return dueMesi + Math.ceil((g - 60) / 30) * (mese - sette);
  }

  /** Noleggio scala: usa state.parametri */
  function calcoloCostoScala(giorni) {
    const g = parseInt(giorni, 10) || 0;
    if (g <= 0) return null;
    const primo = getParametro('scala_primo_giorno') ?? 600;
    const extra = getParametro('scala_giorno_extra') ?? 100;
    return primo + (g - 1) * extra;
  }

  /** Costo servizio gru: usa state.parametri.costo_km_gru (valorizzato da gru.json per distanza, modificabile) */
  function getCostoGruPerDistanza(distanzaKm) {
    const costoKm = getParametro('costo_km_gru');
    if (costoKm == null || distanzaKm == null) return null;
    return Math.round((costoKm * distanzaKm) * 100) / 100;
  }

  /** Tariffa €/km nostro mezzo = somma componenti variabili (costanti.json). */
  function getEurKmNostroMezzoSomma() {
    const b = getParametro('nostro_mezzo_eur_km_base') ?? 0.05;
    const p = getParametro('nostro_mezzo_eur_km_pedaggio') ?? 0;
    const c = getParametro('nostro_mezzo_eur_km_carburante') ?? 0;
    const u = getParametro('nostro_mezzo_eur_km_usura') ?? 0;
    return Math.max(0, (Number(b) || 0) + (Number(p) || 0) + (Number(c) || 0) + (Number(u) || 0));
  }

  /**
   * Trasporto struttura magazzino → cantiere: viaggi = ceil(posti/capacità da prodotto), costo = viaggi × 2d × €/km.
   * modalita: nostro_mezzo | bilico | camion_gru
   */
  function calcolaDettaglioTrasportoMerci(distanzaKm, posti, modalita, prodotto) {
    const labels = { nostro_mezzo: 'Nostro mezzo', bilico: 'Bilico', camion_gru: 'Mezzo con gru (trasporto)' };
    let cap = 0;
    if (modalita === 'nostro_mezzo') cap = Number(prodotto?.nostro_mezzo) || 0;
    else if (modalita === 'bilico') cap = Number(prodotto?.bilico_13mt) || 0;
    else cap = Number(prodotto?.camion_gru) || 0;

    let rateKm = 0;
    if (modalita === 'nostro_mezzo') rateKm = getEurKmNostroMezzoSomma();
    else if (modalita === 'bilico') rateKm = getParametro('bilico_eur_km') ?? 2.2;
    else rateKm = getParametro('camion_gru_eur_km') ?? 2;

    if (!distanzaKm || distanzaKm <= 0 || cap <= 0) {
      return {
        costo: 0,
        viaggi: 0,
        cap,
        kmTot: 0,
        rateKm,
        modalita,
        etichetta: labels[modalita] || modalita,
        avviso: cap <= 0 ? 'Capacità non definita per questo modello (prodotti.json: nostro_mezzo / bilico_13mt / camion_gru).' : null,
      };
    }

    const viaggi = Math.ceil((Number(posti) || 0) / cap);
    const kmAR = 2 * distanzaKm;
    const kmTot = viaggi * kmAR;
    const costo = Math.round(kmTot * rateKm * 100) / 100;
    return {
      costo,
      viaggi,
      cap,
      kmTot,
      kmAR,
      distanzaAndata: distanzaKm,
      rateKm,
      modalita,
      etichetta: labels[modalita] || modalita,
      avviso: null,
    };
  }

  function sommaServiziPersonalizzati() {
    let s = 0;
    (state.valori.servizi_personalizzati || []).forEach((x) => {
      s += Number(x.costo) || 0;
    });
    return Math.round(s * 100) / 100;
  }

  /** Aggiorna riepilogo costi installazione, trasporto struttura e sicurezza. */
  function aggiornaRiepilogoCostiInstallazione() {
    const bloccoTr = $('#blocco-trasporto-merci');
    const bloccoTot = $('#blocco-totale-installazione');
    const primo = state.valori.prodotti?.[0] || '';
    const vis = state.distanzaKm != null && !!primo;
    if (bloccoTr) bloccoTr.hidden = !vis;
    if (bloccoTot) bloccoTot.hidden = !vis;
    if (!vis) {
      state.valori.costi_installazione_riepilogo = null;
      return;
    }

    const posti = state.valori.numero_posti_auto || 2;
    const modalita = document.querySelector('input[name="trasporto_modalita_merci"]:checked')?.value || 'nostro_mezzo';
    const p1 = prodottoSelezionato(1);
    const det = calcolaDettaglioTrasportoMerci(state.distanzaKm, posti, modalita, p1);

    const elTesto = $('#valore-trasporto-merci-testo');
    const elHint = $('#hint-trasporto-merci-cap');
    const elAvviso = $('#avviso-trasporto-merci');
    if (det.avviso) {
      if (elTesto) elTesto.textContent = '—';
      if (elHint) elHint.textContent = '';
      if (elAvviso) {
        elAvviso.textContent = det.avviso;
        elAvviso.hidden = false;
      }
    } else {
      if (elAvviso) elAvviso.hidden = true;
      if (elTesto) {
        const r = Number(det.rateKm) || 0;
        elTesto.textContent = `${fmtEuro(det.costo)} — ${det.viaggi} viaggi, ${det.kmTot} km totali, €${r.toFixed(3)}/km (${det.etichetta})`;
      }
      if (elHint) {
        elHint.textContent = `${det.etichetta}: capacità ${det.cap} posti/viaggio, ${det.viaggi} viaggi, ${det.kmTot} km totali percorsi stimati.`;
      }
    }

    const st = state.valori.stima_installazione;
    const man = st?.totale_manodopera_stimato != null ? Number(st.totale_manodopera_stimato) : 0;

    const mulActv = $('#toggle-muletto')?.checked;
    const scaActv = $('#toggle-scala')?.checked;
    const gruActv = $('#toggle-gru')?.checked;
    const costoMul = mulActv ? calcoloCostoMuletto($('#input-giorni-muletto')?.value) : null;
    const costoSca = scaActv ? calcoloCostoScala($('#input-giorni-scala')?.value) : null;
    const giorniGru = parseInt($('#input-giorni-gru')?.value, 10) || 1;
    const costoGruUn = gruActv ? getCostoGruPerDistanza(state.distanzaKm) : null;
    const costoGruTot = costoGruUn != null && gruActv ? Math.round(costoGruUn * giorniGru * 100) / 100 : 0;

    const cMul = costoMul != null ? costoMul : 0;
    const cSca = costoSca != null ? costoSca : 0;
    const servPers = sommaServiziPersonalizzati();

    const subtotale = Math.round((man + det.costo + cMul + cSca + costoGruTot + servPers) * 100) / 100;

    const sicAtt = $('#sicurezza-includi')?.checked === true;
    let sicEuro = 0;
    if (sicAtt) sicEuro = Math.max(0, parseFloat($('#sicurezza-importo')?.value) || 0);
    const totaleFin = Math.round((subtotale + sicEuro) * 100) / 100;

    const pctSic = getParametro('sicurezza_percentuale_auto') ?? 5;
    const elTestoSic = $('#testo-sicurezza-finale');
    if (elTestoSic) {
      if (sicAtt && sicEuro > 0) {
        elTestoSic.textContent = `Costi sicurezza inclusi: ${fmtEuro(sicEuro)} (sommati al totale installazione).`;
        elTestoSic.hidden = false;
      } else {
        elTestoSic.hidden = true;
      }
    }

    const elRman = $('#riep-manodopera');
    if (elRman) elRman.textContent = fmtEuro(man);
    const elRt = $('#riep-trasporto-merci');
    if (elRt) elRt.textContent = det.avviso ? '— (vedi avviso)' : fmtEuro(det.costo);
    const elRm = $('#riep-muletto');
    if (elRm) elRm.textContent = mulActv && costoMul != null ? fmtEuro(costoMul) : '—';
    const elRs = $('#riep-scala');
    if (elRs) elRs.textContent = scaActv && costoSca != null ? fmtEuro(costoSca) : '—';
    const elRg = $('#riep-gru-servizio');
    if (elRg) elRg.textContent = gruActv && costoGruUn != null ? fmtEuro(costoGruTot) : '—';
    const elRp = $('#riep-servizi-pers');
    if (elRp) elRp.textContent = servPers > 0 ? fmtEuro(servPers) : '€ 0';
    const elSub = $('#riep-subtotale');
    if (elSub) elSub.textContent = fmtEuro(subtotale);
    const elTot = $('#valore-totale-finale-installazione');
    if (elTot) elTot.textContent = fmtEuro(totaleFin);

    const testoTrasporto = det.avviso
      ? det.avviso
      : `Trasporto struttura (${det.etichetta}): ${det.viaggi} viaggi, ${det.kmTot} km totali (A/R), tariffa €${(Number(det.rateKm) || 0).toFixed(3)}/km → ${fmtEuro(det.costo)}`;
    const testoSicurezza = sicAtt && sicEuro > 0
      ? `Costi sicurezza: ${fmtEuro(sicEuro)} (inclusi nel totale installazione; calcolo automatico = ${pctSic}% del subtotale).`
      : 'Costi sicurezza: non inclusi.';

    state.valori.costi_installazione_riepilogo = {
      manodopera_stimata: man,
      trasporto_struttura: det,
      costo_trasporto_struttura: det.costo,
      noleggio_muletto: mulActv ? cMul : null,
      noleggio_scala: scaActv ? cSca : null,
      servizio_gru_cantiere: gruActv ? costoGruTot : null,
      servizi_personalizzati: servPers,
      subtotale_senza_sicurezza: subtotale,
      sicurezza_inclusa: sicAtt,
      sicurezza_importo: sicEuro,
      totale_installazione: totaleFin,
      testo_trasporto_struttura: testoTrasporto,
      testo_costi_sicurezza: testoSicurezza,
    };

    state.valori.costo_trasporto_struttura_stimato = det.costo;
    state.valori.modalita_trasporto_merci = modalita;
  }

  function aggiornaCampiCalcolati() {
    aggiornaValori();
    const elEst = $('#valore-tecnici-esterni');
    if (elEst) elEst.textContent = String(calcoloNumeroTecniciEsterni());
    const elPres = $('#valore-presenza-esterni');
    if (elPres) elPres.textContent = `${calcoloPresenzaEsterni()}%`;

    const mulActv = $('#toggle-muletto')?.checked;
    const scaActv = $('#toggle-scala')?.checked;
    const gruActv = $('#toggle-gru')?.checked;

    const elMuletto = $('#valore-costo-muletto');
    if (elMuletto) {
      if (mulActv) {
        const costo = calcoloCostoMuletto($('#input-giorni-muletto')?.value);
        elMuletto.textContent = costo != null ? `€ ${costo}` : '—';
      } else {
        elMuletto.textContent = '—';
      }
    }

    const elScala = $('#valore-costo-scala');
    if (elScala) {
      if (scaActv) {
        const costo = calcoloCostoScala($('#input-giorni-scala')?.value);
        elScala.textContent = costo != null ? `€ ${costo}` : '—';
      } else {
        elScala.textContent = '—';
      }
    }

    const elGru = $('#valore-gru-trasporto');
    if (elGru) {
      if (gruActv) {
        const costoGru = getCostoGruPerDistanza(state.distanzaKm);
        const giorniGru = parseInt($('#input-giorni-gru')?.value, 10) || 1;
        if (costoGru != null) {
          const costoTotale = costoGru * giorniGru;
          elGru.textContent = `€ ${Math.round(costoTotale * 100) / 100}`;
        } else {
          elGru.textContent = '—';
        }
      } else {
        elGru.textContent = '—';
      }
    }

    aggiornaOreInstallazioneUI();
    aggiornaRiepilogoCostiInstallazione();
  }

  function aggiornaRiepilogo() {
    aggiornaCampiCalcolati();
    const out = $('#output-riepilogo');
    const sec = $('#riepilogo');
    if (!out || !sec) return;
    out.textContent = JSON.stringify(
      {
        ...state.valori,
        distanza_km: state.distanzaKm,
        parametri_sessione: state.parametri,
        costi_installazione: state.valori.costi_installazione_riepilogo || null,
      },
      null,
      2
    );
    sec.hidden = false;
  }

  function bindIndirizzoUI() {
    const btnGeocode  = $('#btn-geocode');
    const inputEl     = $('#input-indirizzo');
    const msgDist     = $('#msg-distanza');
    const msgErr      = $('#msg-errore-geocode');
    const tabDigita   = $('#tab-digita');
    const tabMappa    = $('#tab-mappa');
    const panelDigita = $('#panel-digita');
    const panelMappa  = $('#panel-mappa');
    const acList      = $('#autocomplete-list');
    if (!inputEl) return;

    let acTimer   = null;
    let mapInst   = null;
    let mapMarker = null;

    /* ── helper: imposta distanza da lat/lon già noti ── */
    function applicaDistanza(km, lat, lon) {
      state.distanzaKm   = km;
      state.coordCantiere = { lat, lon };
      msgDist.textContent = `Distanza: ${km} km`;
      msgDist.hidden      = false;
      msgErr.hidden       = true;
      const valDist = $('#valore-distanza');
      if (valDist) valDist.textContent = `${km} km`;
      abilitaProdotti();
      aggiornaParametriDaDistanza();
      mostraNascondiDomande();
      checkSubmitFn();
    }

    async function calcolaEApplicaDistanza(lat, lon) {
      refreshCoordinatePartenzaFromParametri();
      const partenza = getCoordinatePartenza();
      if (!partenza) {
        msgErr.textContent = 'Coordinate partenza non configurate (costanti.json).';
        msgErr.hidden = false;
        return;
      }
      const km = Math.round(window.GEOCODE.distanzaHaversine(partenza, { lat, lon }) * 10) / 10;
      applicaDistanza(km, lat, lon);
    }

    /* ── TAB switching ── */
    function switchTab(tab) {
      const isDigita = tab === 'digita';
      tabDigita.classList.toggle('active', isDigita);
      tabDigita.setAttribute('aria-selected', String(isDigita));
      tabMappa.classList.toggle('active', !isDigita);
      tabMappa.setAttribute('aria-selected', String(!isDigita));
      panelDigita.hidden = !isDigita;
      panelMappa.hidden  = isDigita;
      if (!isDigita) {
        if (!mapInst) initMap();
        else setTimeout(() => google.maps.event.trigger(mapInst, 'resize'), 50);
      }
    }

    tabDigita?.addEventListener('click', () => switchTab('digita'));
    tabMappa?.addEventListener('click',  () => switchTab('mappa'));

    /* ── AUTOCOMPLETE ── */
    function chiudiAc() {
      acList.hidden = true;
      acList.innerHTML = '';
      inputEl.setAttribute('aria-expanded', 'false');
    }

    function mostraAc(results) {
      acList.innerHTML = '';
      if (!results.length) { chiudiAc(); return; }
      results.forEach((r) => {
        const li = document.createElement('li');
        li.textContent = r.display_name;
        li.setAttribute('role', 'option');
        li.addEventListener('mousedown', async (e) => {
          e.preventDefault();
          inputEl.value = r.display_name;
          chiudiAc();
          msgDist.textContent = 'Calcolo distanza…';
          msgDist.hidden = false;
          msgErr.hidden = true;
          /* Usa place_id per ottenere le coordinate esatte */
          const coord = await window.GEOCODE.getPlaceCoords(r.place_id);
          if (!coord) {
            msgErr.textContent = 'Impossibile ottenere le coordinate del luogo selezionato.';
            msgErr.hidden = false;
            msgDist.hidden = true;
            return;
          }
          calcolaEApplicaDistanza(coord.lat, coord.lon);
        });
        acList.appendChild(li);
      });
      acList.hidden = false;
      inputEl.setAttribute('aria-expanded', 'true');
    }

    inputEl.addEventListener('input', () => {
      clearTimeout(acTimer);
      const q = inputEl.value;
      if (q.trim().length < 3) { chiudiAc(); return; }
      acTimer = setTimeout(async () => {
        const results = await window.GEOCODE.search(q);
        mostraAc(results);
      }, 350);
    });

    inputEl.addEventListener('blur', () => setTimeout(chiudiAc, 160));

    /* ── BOTTONE "Calcola distanza" (geocode manuale) ── */
    btnGeocode?.addEventListener('click', async () => {
      const indirizzo = inputEl.value.trim();
      msgErr.hidden  = true;
      msgDist.hidden = true;
      if (!indirizzo) {
        msgErr.textContent = 'Inserisci un indirizzo.';
        msgErr.hidden = false;
        return;
      }
      refreshCoordinatePartenzaFromParametri();
      const partenza = getCoordinatePartenza();
      if (!partenza) {
        msgErr.textContent = 'Coordinate partenza non configurate (costanti.json).';
        msgErr.hidden = false;
        return;
      }
      btnGeocode.disabled = true;
      msgDist.textContent = 'Calcolo in corso…';
      msgDist.hidden = false;
      try {
        const result = await window.GEOCODE.calcolaDistanza(indirizzo, partenza);
        if (!result) {
          msgErr.textContent = 'Indirizzo non trovato. Prova a essere più specifico (città, CAP).';
          msgErr.hidden = false;
          msgDist.hidden = true;
          state.distanzaKm = null;
        } else {
          applicaDistanza(result.km, result.coordinate.lat, result.coordinate.lon);
        }
      } catch {
        msgErr.textContent = 'Errore di rete o servizio. Riprova.';
        msgErr.hidden = false;
        msgDist.hidden = true;
        state.distanzaKm = null;
      }
      btnGeocode.disabled = false;
    });

    /* ── MAPPA Google Maps ── */
    function initMap() {
      const cp     = getCoordinatePartenza();
      const center = cp ? { lat: cp.lat, lng: cp.lon } : { lat: 44.0, lng: 11.5 };

      mapInst = new google.maps.Map(document.getElementById('mappa-cantiere'), {
        center,
        zoom: 7,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      /* Marker magazzino partenza */
      if (cp) {
        new google.maps.Marker({
          position: center,
          map: mapInst,
          title: 'Magazzino partenza',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: '#3d6b1f',
            fillOpacity: 0.9,
            strokeColor: '#2d5016',
            strokeWeight: 2,
          },
        });
      }

      mapInst.addListener('click', async (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        if (mapMarker) mapMarker.setPosition({ lat, lng });
        else mapMarker = new google.maps.Marker({ position: { lat, lng }, map: mapInst });

        msgDist.textContent = 'Calcolo indirizzo e distanza…';
        msgDist.hidden = false;
        msgErr.hidden  = true;

        const nome = await window.GEOCODE.reverseGeocode(lat, lng);
        inputEl.value = nome || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        await calcolaEApplicaDistanza(lat, lng);
      });
    }
  }

  function bindControlliGiorni() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('.btn-controllo')) {
        const targetId = e.target.getAttribute('data-target');
        const input = $(`#${targetId}`);
        if (!input) return;
        
        const min = parseInt(input.getAttribute('min'), 10) || 1;
        const max = parseInt(input.getAttribute('max'), 10) || 365;
        let val = parseInt(input.value, 10) || min;
        
        if (e.target.classList.contains('btn-piu')) {
          val = Math.min(val + 1, max);
        } else if (e.target.classList.contains('btn-meno')) {
          val = Math.max(val - 1, min);
        }
        
        input.value = val;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function bindServiziPersonalizzati() {
    const btnAggiungi = $('#btn-aggiungi-servizio');
    if (btnAggiungi) {
      btnAggiungi.addEventListener('click', aggiungiServizioPersonalizzato);
    }
  }

  function bindForm() {
    const form = $('#form-calcolo');
    const btnInvia = $('#btn-invia');
    const btnSicAuto = $('#btn-sicurezza-auto');
    if (btnSicAuto) {
      btnSicAuto.addEventListener('click', () => {
        aggiornaCampiCalcolati();
        const st = state.valori.stima_installazione;
        const man = st?.totale_manodopera_stimato != null ? Number(st.totale_manodopera_stimato) : 0;
        const posti = state.valori.numero_posti_auto || 2;
        const modalita = document.querySelector('input[name="trasporto_modalita_merci"]:checked')?.value || 'nostro_mezzo';
        const det = calcolaDettaglioTrasportoMerci(state.distanzaKm, posti, modalita, prodottoSelezionato(1));
        const mulActv = $('#toggle-muletto')?.checked;
        const scaActv = $('#toggle-scala')?.checked;
        const gruActv = $('#toggle-gru')?.checked;
        const cMul = mulActv ? (calcoloCostoMuletto($('#input-giorni-muletto')?.value) || 0) : 0;
        const cSca = scaActv ? (calcoloCostoScala($('#input-giorni-scala')?.value) || 0) : 0;
        const giorniGru = parseInt($('#input-giorni-gru')?.value, 10) || 1;
        const gu = gruActv ? getCostoGruPerDistanza(state.distanzaKm) : null;
        const cGru = gu != null && gruActv ? gu * giorniGru : 0;
        const servPers = sommaServiziPersonalizzati();
        const sub = man + det.costo + cMul + cSca + cGru + servPers;
        const pct = (getParametro('sicurezza_percentuale_auto') ?? 5) / 100;
        const importo = Math.round(sub * pct * 100) / 100;
        const chk = $('#sicurezza-includi');
        const inp = $('#sicurezza-importo');
        if (chk) chk.checked = true;
        if (inp) inp.value = String(importo);
        aggiornaCampiCalcolati();
      });
    }
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        aggiornaRiepilogo();
      });
    }
    $('#input-indirizzo')?.addEventListener('input', () => { aggiornaValori(); mostraNascondiDomande(); });
    document.getElementById('form-calcolo')?.addEventListener('change', (e) => {
      if (e.target.matches('select[name^="prodotto_"]')) {
        aggiornaValori();
        if (e.target.id === 'input-prodotto-1') aggiornaDopoModello(1);
        aggiornaCampiCalcolati();
      }
      if (e.target.matches('#input-tecnici-interni, #input-presenza-interni, #input-giorni-muletto, #input-giorni-scala, #input-giorni-gru')) {
        aggiornaValori();
        aggiornaCampiCalcolati();
      }
      if (e.target.id === 'input-posti-auto') aggiornaCampiCalcolati();
      /* Toggle noleggi: mostra/nasconde dettagli e ricalcola */
      if (e.target.matches('.noleggio-toggle')) {
        const dettagliId = e.target.id.replace('toggle-', 'dettagli-');
        const dettagli = document.getElementById(dettagliId);
        if (dettagli) dettagli.hidden = !e.target.checked;
        aggiornaValori();
        aggiornaCampiCalcolati();
      }
      if (e.target.matches('#trasferta-tipo-modalita, #trasferta-rientro-weekend, #trasferta-premio-giorni-viaggio, #trasferta-costo-extra')) {
        aggiornaCampiCalcolati();
      }
      if (e.target.matches('input[name="trasporto_modalita_merci"], #sicurezza-includi')) {
        aggiornaValori();
        aggiornaCampiCalcolati();
      }
    });
    document.getElementById('form-calcolo')?.addEventListener('input', (e) => {
      if (e.target.id === 'input-posti-auto') aggiornaCampiCalcolati();
      if (e.target.id === 'trasferta-costo-extra') aggiornaCampiCalcolati();
      if (e.target.id === 'sicurezza-importo') {
        aggiornaValori();
        aggiornaCampiCalcolati();
      }
      if (e.target.matches('#input-tecnici-interni, #input-presenza-interni, #input-giorni-muletto, #input-giorni-scala, #input-giorni-gru')) {
        aggiornaValori();
        aggiornaCampiCalcolati();
      }
    });
    // Abilita submit: distanza + almeno prodotto 1 selezionato
    function checkSubmit() {
      aggiornaValori();
      const primo = (state.valori.prodotti && state.valori.prodotti[0]) || '';
      const ok = state.distanzaKm != null && !!primo && state.valori.numero_posti_auto;
      if (btnInvia) btnInvia.disabled = !ok;
    }
    checkSubmitFn = checkSubmit;
    document.getElementById('form-calcolo')?.addEventListener('change', checkSubmit);
  }

  function aggiornaDopoModello(slot) {
    if (slot !== 1) return;
    const prodotto = prodottoSelezionato(1);
    const postiAuto = $('#input-posti-auto');
    if (postiAuto) {
      if (prodotto && prodotto['POSTI AUTO'] != null) {
        postiAuto.value = Math.min(Math.max(1, parseInt(prodotto['POSTI AUTO'], 10) || 2), 20);
      } else {
        postiAuto.value = 2;
      }
    }
  }

  function bindParametri() {
    initParametriFromDefaults();
  }

  async function init() {
    const ok = await initData();
    if (!ok) return;
    buildContainerProdotti();
    abilitaProdotti();
    bindParametri();
    bindControlliGiorni();
    bindServiziPersonalizzati();
    bindIndirizzoUI();
    bindForm();
    bindModalAccessori();
    mostraNascondiDomande();
    checkSubmitFn();
  }

  /* L'app parte solo dopo che Google Maps SDK è pronto (callback nel tag script) */
  window.onGoogleMapsReady = init;
})();
