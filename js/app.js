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
    valori: {},
    distanzaKm: null,
    /** Parametri e costi modificabili in sessione (default da JSON/hardcoded, non si salvano sui file) */
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
    },
  };
  let checkSubmitFn = () => {};

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  async function loadJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Errore caricamento ${path}`);
    return res.json();
  }

  async function initData() {
    try {
      [state.costanti, state.prodotti, state.trasporti, state.accessori, state.gru] = await Promise.all([
        loadJson('costanti.json'),
        loadJson('prodotti.json'),
        loadJson('trasporti.json'),
        loadJson('acessori.json').catch(() => []),
        loadJson('gru.json').catch(() => []),
      ]);
    } catch (e) {
      console.error(e);
      alert('Errore nel caricamento dei dati. Verifica che costanti.json, prodotti.json e trasporti.json siano presenti.');
      return false;
    }
    return true;
  }

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

  /** Scrive state.parametri negli input del pannello */
  function syncParametriToInputs() {
    Object.keys(state.parametri).forEach((key) => {
      const el = $(`[data-param="${key}"]`);
      if (el && el.tagName === 'INPUT') {
        const v = state.parametri[key];
        el.value = v != null && v !== '' ? String(v) : '';
      }
    });
  }

  /** Legge gli input del pannello e aggiorna state.parametri */
  function syncInputsToParametri() {
    $$('[data-param]').forEach((el) => {
      if (el.tagName !== 'INPUT') return;
      const key = el.getAttribute('data-param');
      const raw = el.value.trim();
      const num = raw === '' ? null : parseFloat(raw);
      state.parametri[key] = num != null && !Number.isNaN(num) ? num : null;
    });
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

  function buildAccessoriSelect() {
    const frag = document.createDocumentFragment();
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = 'Nessuno';
    frag.appendChild(opt0);
    (state.accessori || []).forEach((acc) => {
      const mod = acc.MODELLO_STRUTTURA;
      if (!mod) return;
      const opt = document.createElement('option');
      opt.value = mod;
      opt.textContent = mod;
      frag.appendChild(opt);
    });
    return frag;
  }

  function buildContainerProdotti() {
    const container = $('#container-slot-prodotti');
    const schema = window.DOMANDE_SCHEMA;
    const n = (schema?.numeroProdotti) || 4;
    if (!container) return;

    container.innerHTML = '';
    for (let i = 1; i <= n; i++) {
      const obbligatorio = i === 1 && schema?.primoObbligatorio;
      const slot = document.createElement('div');
      slot.className = 'slot-prodotto';
      slot.setAttribute('data-slot', i);

      const titolo = document.createElement('h3');
      titolo.className = 'slot-prodotto-titolo';
      titolo.textContent = `Prodotto ${i}${obbligatorio ? ' (obbligatorio)' : ' (opzionale)'}`;
      slot.appendChild(titolo);

      const rowModello = document.createElement('div');
      rowModello.className = 'domanda';
      const labelModello = document.createElement('label');
      labelModello.setAttribute('for', `input-prodotto-${i}`);
      labelModello.textContent = 'Modello prodotto';
      const selectModello = document.createElement('select');
      selectModello.id = `input-prodotto-${i}`;
      selectModello.name = `prodotto_${i}`;
      selectModello.disabled = true;
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
        inputPosti.value = 1;
        inputPosti.disabled = true;
        rowPosti.appendChild(labelPosti);
        rowPosti.appendChild(inputPosti);
        slot.appendChild(rowPosti);
      }

      const rowAccessorio = document.createElement('div');
      rowAccessorio.className = 'domanda';
      const labelAcc = document.createElement('label');
      labelAcc.setAttribute('for', `input-accessorio-${i}`);
      labelAcc.textContent = 'Accessorio';
      const selectAcc = document.createElement('select');
      selectAcc.id = `input-accessorio-${i}`;
      selectAcc.name = `accessorio_${i}`;
      selectAcc.disabled = true;
      selectAcc.appendChild(buildAccessoriSelect());
      rowAccessorio.appendChild(labelAcc);
      rowAccessorio.appendChild(selectAcc);
      slot.appendChild(rowAccessorio);

      container.appendChild(slot);
    }
  }

  function abilitaProdotti() {
    const hasDistance = state.distanzaKm != null;
    const container = $('#container-prodotti');
    if (container) container.hidden = !hasDistance;
    $$('.slot-prodotto select, .slot-prodotto input').forEach((el) => {
      el.disabled = !hasDistance;
      if (!hasDistance && el.tagName === 'SELECT') el.value = '';
    });
    if (hasDistance) {
      const posti = $('#input-posti-auto');
      if (posti) posti.value = posti.value || '1';
    }
  }

  function aggiornaValori() {
    state.valori.indirizzo_cantiere = ($('#input-indirizzo')?.value || '').trim();
    state.valori.distanza_km = state.distanzaKm;
    state.valori.prodotti = [];
    state.valori.accessori = [];
    for (let i = 1; i <= 4; i++) {
      const selProdotto = $(`#input-prodotto-${i}`);
      const selAcc = $(`#input-accessorio-${i}`);
      const mod = selProdotto?.value || '';
      const acc = selAcc?.value || '';
      state.valori.prodotti.push(mod);
      state.valori.accessori.push(acc);
    }
    const posti = $('#input-posti-auto');
    state.valori.numero_posti_auto = posti ? (posti.value ? parseInt(posti.value, 10) : 1) : 1;
    state.valori.tecnici_interni = parseInt($('#input-tecnici-interni')?.value, 10) || 1;
    state.valori.presenza_tecnici_interni_pct = parseInt($('#input-presenza-interni')?.value, 10) ?? 100;
    state.valori.tecnici_esterni = calcoloNumeroTecniciEsterni();
    state.valori.presenza_tecnici_esterni_pct = calcoloPresenzaEsterni();
    state.valori.giorni_noleggio_muletto = parseInt($('#input-giorni-muletto')?.value, 10) || 7;
    state.valori.costo_noleggio_muletto = calcoloCostoMuletto(state.valori.giorni_noleggio_muletto);
    state.valori.giorni_noleggio_scala = parseInt($('#input-giorni-scala')?.value, 10) || 1;
    state.valori.costo_noleggio_scala = calcoloCostoScala(state.valori.giorni_noleggio_scala);
    state.valori.giorni_presenza_gru = parseInt($('#input-giorni-gru')?.value, 10) || 0;
    state.valori.costo_gru_trasporto = getCostoGruPerDistanza(state.distanzaKm);
  }

  function prodottoSelezionato(slot) {
    const sel = $(`#input-prodotto-${slot == null ? 1 : slot}`);
    const mod = sel?.value;
    if (!mod || !state.prodotti.length) return null;
    return state.prodotti.find((p) => p.MODELLO_STRUTTURA === mod) || null;
  }

  function mostraNascondiDomande() {
    const domandaDistanza = $('#domanda-distanza');
    if (domandaDistanza) domandaDistanza.hidden = state.distanzaKm == null;
    abilitaProdotti();
    const secTecnici = $('#sezione-tecnici-noleggi');
    if (secTecnici) secTecnici.hidden = state.distanzaKm == null;
    aggiornaCampiCalcolati();
  }

  /** Presenza tecnici esterni % = 100 - presenza interni % */
  function calcoloPresenzaEsterni() {
    const p = parseInt($('#input-presenza-interni')?.value, 10);
    return Number.isNaN(p) ? 0 : Math.max(0, Math.min(100, 100 - p));
  }

  /**
   * Numero tecnici esterni: da interni N e presenza interni P_int % si ricava
   * presenza esterni = 100 - P_int; numero_esterni tale che esterni/(interni+esterni) = presenza_esterni/100
   * => numero_esterni = N * (100 - P_int) / P_int  (arrotondato). Se P_int = 0 si restituisce 0.
   */
  function calcoloNumeroTecniciEsterni() {
    const n = parseInt($('#input-tecnici-interni')?.value, 10) || 0;
    const pInt = parseInt($('#input-presenza-interni')?.value, 10);
    if (n <= 0 || Number.isNaN(pInt) || pInt <= 0) return 0;
    if (pInt >= 100) return 0;
    const pEst = 100 - Math.min(100, Math.max(0, pInt));
    return Math.round((n * pEst) / pInt);
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

  function aggiornaCampiCalcolati() {
    const numeroEst = calcoloNumeroTecniciEsterni();
    const presenzaEst = calcoloPresenzaEsterni();
    const elTecniciEst = $('#valore-tecnici-esterni');
    if (elTecniciEst) elTecniciEst.textContent = String(numeroEst);
    const elPresenzaEst = $('#valore-presenza-esterni');
    if (elPresenzaEst) elPresenzaEst.textContent = `${presenzaEst}%`;

    const giorniMuletto = $('#input-giorni-muletto')?.value;
    const costoMuletto = calcoloCostoMuletto(giorniMuletto);
    const elMuletto = $('#valore-costo-muletto');
    if (elMuletto) elMuletto.textContent = costoMuletto != null ? `${costoMuletto} €` : '—';

    const giorniScala = $('#input-giorni-scala')?.value;
    const costoScala = calcoloCostoScala(giorniScala);
    const elScala = $('#valore-costo-scala');
    if (elScala) elScala.textContent = costoScala != null ? `${costoScala} €` : '—';

    const costoGru = getCostoGruPerDistanza(state.distanzaKm);
    const giorniGru = parseInt($('#input-giorni-gru')?.value, 10) || 0;
    const elGru = $('#valore-gru-trasporto');
    if (elGru) {
      if (costoGru != null && giorniGru > 0) elGru.textContent = `${costoGru} € (× ${giorniGru} giorni)`;
      else if (costoGru != null) elGru.textContent = `${costoGru} €`;
      else elGru.textContent = '—';
    }
  }

  function aggiornaRiepilogo() {
    aggiornaValori();
    syncInputsToParametri();
    const out = $('#output-riepilogo');
    const sec = $('#riepilogo');
    if (!out || !sec) return;
    out.textContent = JSON.stringify(
      { ...state.valori, distanza_km: state.distanzaKm, parametri_sessione: state.parametri },
      null,
      2
    );
    sec.hidden = false;
  }

  function bindGeocode() {
    const btn = $('#btn-geocode');
    const input = $('#input-indirizzo');
    const msgDist = $('#msg-distanza');
    const msgErr = $('#msg-errore-geocode');
    if (!btn || !input) return;

    btn.addEventListener('click', async () => {
      const indirizzo = input.value.trim();
      msgErr.hidden = true;
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
      btn.disabled = true;
      msgDist.textContent = 'Calcolo in corso…';
      msgDist.hidden = false;
      try {
        const result = await window.GEOCODE.calcolaDistanza(indirizzo, partenza);
        if (!result) {
          msgErr.textContent = 'Indirizzo non trovato. Prova a essere più specifico (città, CAP).';
          msgErr.hidden = false;
          state.distanzaKm = null;
        } else {
          state.distanzaKm = result.km;
          msgDist.textContent = `Distanza: ${result.km} km`;
          msgDist.hidden = false;
          msgErr.hidden = true;
          const valDist = $('#valore-distanza');
          if (valDist) valDist.textContent = `${result.km} km`;
          abilitaProdotti();
          aggiornaParametriDaDistanza();
          syncParametriToInputs();
          mostraNascondiDomande();
          checkSubmitFn();
        }
      } catch (e) {
        msgErr.textContent = 'Errore di rete o servizio. Riprova.';
        msgErr.hidden = false;
        state.distanzaKm = null;
      }
      btn.disabled = false;
    });
  }

  function bindForm() {
    const form = $('#form-calcolo');
    const btnInvia = $('#btn-invia');
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
      }
      if (e.target.matches('select[name^="accessorio_"]') || e.target.id === 'input-posti-auto') aggiornaValori();
      if (e.target.matches('#input-presenza-interni, #input-giorni-muletto, #input-giorni-scala, #input-giorni-gru')) {
        aggiornaValori();
        aggiornaCampiCalcolati();
      }
    });
    document.getElementById('form-calcolo')?.addEventListener('input', (e) => {
      if (e.target.id === 'input-posti-auto') aggiornaValori();
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
    if (postiAuto && prodotto && prodotto['POSTI AUTO'] != null) {
      const n = Math.max(1, parseInt(prodotto['POSTI AUTO'], 10) || 1);
      postiAuto.value = Math.min(n, 20);
    }
  }

  function bindParametri() {
    initParametriFromDefaults();
    syncParametriToInputs();
    document.getElementById('panel-parametri')?.addEventListener('input', () => {
      syncInputsToParametri();
      aggiornaCampiCalcolati();
    });
    document.getElementById('panel-parametri')?.addEventListener('change', () => {
      syncInputsToParametri();
      aggiornaCampiCalcolati();
    });
  }

  async function init() {
    const ok = await initData();
    if (!ok) return;
    buildContainerProdotti();
    abilitaProdotti();
    bindParametri();
    bindGeocode();
    bindForm();
    mostraNascondiDomande();
    checkSubmitFn();
  }

  init();
})();
