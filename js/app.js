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
      ricarico_generale_pct: 0,
      ricarico_ore_lavoro_pct: 0,
      ricarico_trasporti_pct: 0,
      ricarico_noleggi_pct: 0,
    },
  };
  let checkSubmitFn = () => {};
  let serviziPersonalizzatiCounter = 0;
  let modalAccessoriSlot = null;
  let modalAccessoriDraft = null;
  let saveDraftTimer = null;
  let isApplyingDraft = false;
  let isResetting = false;
  const DRAFT_STORAGE_KEY = 'calcoloPergo_preventivo_draft_v1';

  window.APP_STATE = state;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const LS_DATA_KEYS = {
    'costanti.json':  'calcoloPergo_data_costanti',
    'prodotti.json':  'calcoloPergo_data_prodotti',
    'trasferta.json': 'calcoloPergo_data_trasferta',
  };

  async function loadJson(path) {
    const lsKey = LS_DATA_KEYS[path];
    if (lsKey) {
      try {
        const stored = localStorage.getItem(lsKey);
        if (stored) return JSON.parse(stored);
      } catch (_) {}
    }
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Errore caricamento ${path}`);
    return res.json();
  }

  async function initData() {
    try {
      [state.costanti, state.prodotti, state.trasporti, state.accessori, state.trasfertaConfig] = await Promise.all([
        loadJson('costanti.json').catch(() => null),
        loadJson('prodotti.json').catch(() => []),
        loadJson('trasporti.json').catch(() => []),
        loadJson('acessori.json').catch(() => []),
        loadJson('trasferta.json').catch(() => null),
      ]);
      state.gru = [];
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
    state.parametri.gru_primo_giorno = 600;
    state.parametri.gru_giorno_extra = 100;
    const firstTrasporti = state.trasporti?.length && state.trasporti[0];
    state.parametri.costo_km_trasporto = firstTrasporti?.COSTO_KM != null ? firstTrasporti.COSTO_KM : null;

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

    const pr = state.costanti?.parametri_ricarichi || {};
    const defRic = {
      ricarico_generale_pct: 0,
      ricarico_ore_lavoro_pct: 0,
      ricarico_trasporti_pct: 0,
      ricarico_noleggi_pct: 0,
    };
    Object.keys(defRic).forEach((k) => {
      const v = pr[k] != null && pr[k] !== '' ? Number(pr[k]) : null;
      state.parametri[k] = v != null && !Number.isNaN(v) ? v : defRic[k];
    });
  }

  /** Aggiorna costo_km_trasporto dalla fascia corrispondente alla distanza (da JSON) */
  function aggiornaParametriDistanza(km) {
    if (km == null || !state.trasporti?.length) return;
    const rowTr = state.trasporti.find((r) => r.DISTANZA >= km) || state.trasporti[state.trasporti.length - 1];
    if (rowTr?.COSTO_KM != null) setParametro('costo_km_trasporto', rowTr.COSTO_KM);
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

  function getProdottoByModello(modello) {
    if (!modello || !state.prodotti.length) return null;
    return state.prodotti.find((p) => p.MODELLO_STRUTTURA === modello) || null;
  }

  function getAccessoriDisponibiliPerProdotto(prodotto) {
    if (!prodotto) return [];
    return (state.accessori || []).filter((acc) => {
      const codice = acc?.nome_prodotti;
      if (!codice) return false;
      const key = `ORE_INSTALLAZIONE_${codice}`;
      if (!Object.prototype.hasOwnProperty.call(prodotto, key)) return true;
      const val = prodotto[key];
      return val != null && !Number.isNaN(Number(val));
    });
  }

  function getAccessoriDisponibiliPerSlot(slot) {
    const mod = $(`#input-prodotto-${slot}`)?.value || '';
    const prodotto = getProdottoByModello(mod);
    return getAccessoriDisponibiliPerProdotto(prodotto);
  }

  function ripulisciAccessoriNonCompatibili(slot) {
    const disponibili = new Set(getAccessoriDisponibiliPerSlot(slot).map((a) => a.nome_prodotti));
    const correnti = state.accessoriSelezioni[slot] || [];
    const filtrati = correnti.filter((a) => disponibili.has(a.codice));
    if (filtrati.length !== correnti.length) {
      state.accessoriSelezioni[slot] = filtrati;
      aggiornaRiepilogoAccessoriSlot(slot);
    }
  }

  function getAccessorioMeta(codice) {
    return (state.accessori || []).find((a) => a.nome_prodotti === codice) || null;
  }

  function parseBooleanLoose(v, def = false) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const x = v.trim().toLowerCase();
      if (['true', '1', 'si', 's', 'yes', 'y'].includes(x)) return true;
      if (['false', '0', 'no', 'n'].includes(x)) return false;
    }
    return def;
  }

  function parseNumero(v, def = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }

  function getTipoCalcoloAccessorio(v) {
    const x = String(v || '').trim().toLowerCase();
    if (x === 'per_pz' || x === 'per_pezzo') return 'per_pz';
    return 'per_posto_auto';
  }

  function getPostiAutoCorrenti() {
    return Math.max(1, parseInt($('#input-posti-auto')?.value, 10) || 1);
  }

  function getAccessorioConfigProdotto(prodotto, codice) {
    const meta = getAccessorioMeta(codice) || {};
    const oreProd = parseNumero(prodotto?.[`ORE_INSTALLAZIONE_${codice}`], NaN);
    const oreMeta = parseNumero(meta?.ore_installazione_unita ?? meta?.ore_installazione, NaN);
    const pesoProd = parseNumero(prodotto?.[`PESO_ACCESSORIO_${codice}`], NaN);
    const pesoMeta = parseNumero(meta?.peso, NaN);

    const gestioneProd = prodotto?.[`ACCESSORIO_GESTIONE_CARICO_${codice}`];
    const gestioneLegacy = prodotto?.[`CONSEGNA_PERSONALIZZATA_${codice}`];
    const gestioneMeta = meta?.soggetto_gestione_carico;

    const tipoProd = prodotto?.[`ACCESSORIO_TIPO_CALCOLO_${codice}`];
    const tipoMeta = meta?.tipo_calcolo;

    const capBilico = parseNumero(prodotto?.[`ACCESSORIO_CAP_BILICO_${codice}`], parseNumero(meta?.cap_bilico, 0));
    const capNostro = parseNumero(prodotto?.[`ACCESSORIO_CAP_NOSTRO_MEZZO_${codice}`], parseNumero(meta?.cap_nostro_mezzo, 0));
    const capCamion = parseNumero(prodotto?.[`ACCESSORIO_CAP_CAMION_GRU_${codice}`], parseNumero(meta?.cap_camion_gru, 0));

    return {
      ore_installazione_unita: Number.isFinite(oreProd) ? oreProd : (Number.isFinite(oreMeta) ? oreMeta : 0),
      peso: Number.isFinite(pesoProd) ? pesoProd : (Number.isFinite(pesoMeta) ? pesoMeta : 0),
      soggetto_gestione_carico: parseBooleanLoose(gestioneProd, parseBooleanLoose(gestioneLegacy, parseBooleanLoose(gestioneMeta, false))),
      tipo_calcolo: getTipoCalcoloAccessorio(tipoProd || tipoMeta || 'per_posto_auto'),
      cap_bilico: Math.max(0, capBilico),
      cap_nostro_mezzo: Math.max(0, capNostro),
      cap_camion_gru: Math.max(0, capCamion),
    };
  }

  function getQuantitaEffettivaAccessorio(slot, codice, quantitaInput) {
    const prodotto = prodottoSelezionato(slot);
    const cfg = getAccessorioConfigProdotto(prodotto, codice);
    let sel = null;
    if (state.accessoriSelezioni && state.accessoriSelezioni[slot]) {
      sel = state.accessoriSelezioni[slot].find(a => a.codice === codice);
    }
    if (!sel && typeof modalAccessoriDraft !== 'undefined' && modalAccessoriDraft) {
      sel = modalAccessoriDraft.find(a => a.codice === codice);
    }
    if (cfg.tipo_calcolo === 'per_posto_auto' && !sel?.custom_qty) return getPostiAutoCorrenti();
    return Math.max(0, parseNumero(quantitaInput, 0));
  }

  function getQuantitaDefaultAccessorio(slot, codice) {
    const prodotto = prodottoSelezionato(slot);
    const cfg = getAccessorioConfigProdotto(prodotto, codice);
    return cfg.tipo_calcolo === 'per_posto_auto' ? getPostiAutoCorrenti() : 1;
  }

  function getRateKmTrasportoMerci(modalita) {
    if (modalita === 'nostro_mezzo') return getEurKmNostroMezzoSomma();
    if (modalita === 'bilico') return getParametro('bilico_eur_km') ?? 2.2;
    return getParametro('camion_gru_eur_km') ?? 2;
  }

  function getCapAccessorioByModalita(cfg, modalita) {
    if (!cfg) return 0;
    if (modalita === 'nostro_mezzo') return Math.max(0, parseNumero(cfg.cap_nostro_mezzo, 0));
    if (modalita === 'bilico') return Math.max(0, parseNumero(cfg.cap_bilico, 0));
    return Math.max(0, parseNumero(cfg.cap_camion_gru, 0));
  }

  function stimaTrasportoAccessorio(slot, codice, qtyEff) {
    const prodotto = prodottoSelezionato(slot);
    const cfg = getAccessorioConfigProdotto(prodotto, codice);
    if (!cfg.soggetto_gestione_carico || qtyEff <= 0) return null;

    const modalita = document.querySelector('input[name="trasporto_modalita_merci"]:checked')?.value || 'nostro_mezzo';
    const cap = getCapAccessorioByModalita(cfg, modalita);
    if (cap <= 0) return { viaggi: 0, costo: 0, cap: 0, modalita, warning: 'capacita non definita' };
    const viaggi = Math.ceil(qtyEff / cap);
    const kmAR = 2 * (state.distanzaKm || 0);
    const rateKm = getRateKmTrasportoMerci(modalita);
    const costo = Math.round(viaggi * kmAR * rateKm * 100) / 100;
    return { viaggi, costo, cap, modalita, warning: null };
  }

  function renderModalAccessoriRiepilogo() {
    const el = $('#modal-accessori-riepilogo');
    if (!el) return;
    if (modalAccessoriSlot == null || !Array.isArray(modalAccessoriDraft)) {
      el.hidden = true;
      el.textContent = '';
      return;
    }

    const selected = modalAccessoriDraft;
    if (!selected.length) {
      el.hidden = false;
      el.textContent = 'Riepilogo rapido: nessun accessorio selezionato.';
      return;
    }

    const prodotto = prodottoSelezionato(modalAccessoriSlot);
    const righe = [];
    let oreTot = 0;
    let viaggiTot = 0;
    let costoTot = 0;

    selected.forEach((x) => {
      const cfg = getAccessorioConfigProdotto(prodotto, x.codice);
      const qtyEff = getQuantitaEffettivaAccessorio(modalAccessoriSlot, x.codice, x.quantita);
      const oreUn = Math.max(0, parseNumero(cfg.ore_installazione_unita, 0));
      const ore = x.modalita === 'installato' ? Math.round(oreUn * qtyEff * 1000) / 1000 : 0;
      oreTot += ore;

      const tr = stimaTrasportoAccessorio(modalAccessoriSlot, x.codice, qtyEff);
      if (tr && !tr.warning) {
        viaggiTot += tr.viaggi;
        costoTot += tr.costo;
      }

      const nome = getAccessorioMeta(x.codice)?.nome || x.codice;
      const tipoTxt = cfg.tipo_calcolo === 'per_posto_auto' ? 'per PA' : 'per pz';
      let statusClass = 'modal-accessori-status--info';
      let statusLabel = 'INFO';
      const trTxt = tr
        ? (tr.warning ? `trasporto: ${tr.warning}` : `trasporto: ${tr.viaggi} viaggi, ${fmtEuro(tr.costo)}`)
        : 'trasporto: non soggetto a gestione carico';
      if (tr?.warning) {
        statusClass = 'modal-accessori-status--warn';
        statusLabel = 'WARNING';
      } else if (tr) {
        statusClass = 'modal-accessori-status--ok';
        statusLabel = 'OK';
      }
      righe.push(`<span class="modal-accessori-status ${statusClass}">${statusLabel}</span> <strong>${nome}</strong> -> qta effettiva ${qtyEff} (${tipoTxt}), ore ${fmtOre(ore)}, ${trTxt}`);
    });

    el.hidden = false;
    el.innerHTML = `<strong>Riepilogo rapido accessori</strong><br>${righe.join('<br>')}<br><strong>Totale accessori:</strong> ore ${fmtOre(oreTot)} · viaggi ${viaggiTot} · costo trasporto ${fmtEuro(costoTot)}`;
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
        const qEff = getQuantitaEffettivaAccessorio(slot, x.codice, x.quantita);
        const qTxt = qEff > 0 ? `, qta ${qEff}` : '';
        const modLabel = x.modalita === 'installato' ? 'fornito e installato' : 'solo fornito';
        return `${nome} (${modLabel}${qTxt})`;
      })
      .join(' · ');
  }

  function renderModalAccessoriLista() {
    const container = $('#modal-accessori-lista');
    if (!container) return;
    container.innerHTML = '';
    const catalog = modalAccessoriSlot != null ? getAccessoriDisponibiliPerSlot(modalAccessoriSlot) : [];
    if (modalAccessoriSlot != null) {
      const disponibili = new Set(catalog.map((a) => a.nome_prodotti));
      modalAccessoriDraft = (modalAccessoriDraft || []).filter((a) => disponibili.has(a.codice));
    }
    if (!catalog.length) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = 'Nessun accessorio disponibile per il prodotto selezionato.';
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
      const prodottoSlot = prodottoSelezionato(modalAccessoriSlot);
      const cfg = getAccessorioConfigProdotto(prodottoSlot, codice);
      if (sel && (!Number.isFinite(Number(sel.quantita)) || Number(sel.quantita) < 0)) {
        sel.quantita = getQuantitaDefaultAccessorio(modalAccessoriSlot, codice);
      }
      const isAuto = cfg.tipo_calcolo === 'per_posto_auto' && !sel?.custom_qty;
      const quantita = isAuto ? getPostiAutoCorrenti() : Math.max(0, parseNumero(sel?.quantita, getQuantitaDefaultAccessorio(modalAccessoriSlot, codice)));

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
      const info = document.createElement('div');
      info.className = 'modal-accessorio-desc';
      const tipoTxt = cfg.tipo_calcolo === 'per_posto_auto' ? 'calcolo per posto auto' : 'calcolo per pezzo';
      const caricoTxt = cfg.soggetto_gestione_carico ? 'soggetto a gestione carico' : 'non soggetto a gestione carico';
      info.textContent = `${tipoTxt}; ${caricoTxt}; cap B/N/CG: ${cfg.cap_bilico}/${cfg.cap_nostro_mezzo}/${cfg.cap_camion_gru}`;
      textCol.appendChild(info);

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

      const qtyWrap = document.createElement('div');
      qtyWrap.className = 'domanda';
      const qtyLabel = document.createElement('label');
      qtyLabel.textContent = 'Quantità accessorio';
      qtyLabel.setAttribute('for', `modal-acc-qta-${modalAccessoriSlot}-${codice}`);
      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '0';
      qtyInput.step = '1';
      qtyInput.value = String(quantita);
      qtyInput.id = `modal-acc-qta-${modalAccessoriSlot}-${codice}`;
      qtyInput.dataset.codice = codice;
      qtyInput.className = 'accessorio-input';
      qtyWrap.appendChild(qtyLabel);
      qtyWrap.appendChild(qtyInput);
      modCol.appendChild(qtyWrap);

      row.appendChild(checkCol);
      row.appendChild(iconWrap);
      row.appendChild(textCol);
      row.appendChild(modCol);
      container.appendChild(row);
    });

    renderModalAccessoriRiepilogo();
  }

  function apriModalAccessori(slot) {
    const mod = $(`#input-prodotto-${slot}`)?.value || '';
    if (!mod) {
      alert(`Seleziona prima il modello del prodotto ${slot}.`);
      return;
    }
    modalAccessoriSlot = slot;
    ripulisciAccessoriNonCompatibili(slot);
    const cur = state.accessoriSelezioni[slot] || [];
    modalAccessoriDraft = JSON.parse(JSON.stringify(cur));
    const sub = $('#modal-accessori-sottotitolo');
    if (sub) sub.textContent = `Prodotto ${slot} (${mod}): seleziona accessorio, quantità e modalità (solo fornitura o con installazione).`;
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
              modalAccessoriDraft.push({ codice, modalita: 'fornito', quantita: getQuantitaDefaultAccessorio(modalAccessoriSlot, codice) });
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
          return;
        }
        if (t.matches('input[type="number"]')) {
          const item = modalAccessoriDraft.find((x) => x.codice === codice);
          if (item) {
             item.quantita = Math.max(0, parseNumero(t.value, 0));
             item.custom_qty = true;
          }
          renderModalAccessoriRiepilogo();
        }
      });
    }

    document.addEventListener('change', (e) => {
      if (!modalAccessoriSlot) return;
      if (e.target?.matches('input[name="trasporto_modalita_merci"]')) {
        renderModalAccessoriRiepilogo();
      }
    });

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
        inputPosti.max = 100;
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

  function aggiungiServizioPersonalizzato(initialData) {
    const container = $('#container-servizi-personalizzati');
    if (!container) return;

    const hasInitial = initialData && typeof initialData === 'object';
    const id = hasInitial && Number.isFinite(Number(initialData.id))
      ? Number(initialData.id)
      : (serviziPersonalizzatiCounter + 1);
    serviziPersonalizzatiCounter = Math.max(serviziPersonalizzatiCounter, id);

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
    inputDesc.value = hasInitial ? (initialData.descrizione || '') : '';
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
    inputCosto.value = hasInitial && initialData.costo != null ? String(initialData.costo) : '';
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
    textareaNote.value = hasInitial ? (initialData.note || '') : '';
    textareaNote.addEventListener('input', aggiornaValori);
    rowNote.appendChild(labelNote);
    rowNote.appendChild(textareaNote);
    body.appendChild(rowNote);

    servizioItem.appendChild(body);
    container.appendChild(servizioItem);

    state.serviziPersonalizzati.push({
      id,
      descrizione: hasInitial ? (initialData.descrizione || '') : '',
      costo: hasInitial ? (Number(initialData.costo) || 0) : 0,
      note: hasInitial ? (initialData.note || '') : '',
    });
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

  function scheduleSaveDraft() {
    if (isApplyingDraft) return;
    if (saveDraftTimer) clearTimeout(saveDraftTimer);
    saveDraftTimer = setTimeout(() => salvaBozzaLocale(), 150);
  }

  function salvaBozzaLocale() {
    if (isApplyingDraft || isResetting) return;
    try {
      aggiornaValori();
      const form = $('#form-calcolo');
      if (!form) return;

      const fields = {};
      const radioValues = {};
      $$('input, select, textarea', form).forEach((el) => {
        if (el.type === 'radio') return;
        if (!el.id) return;
        if (el.type === 'checkbox') fields[el.id] = el.checked;
        else fields[el.id] = el.value;
      });
      $$('input[type="radio"]', form).forEach((el) => {
        if (!el.name) return;
        if (el.checked) radioValues[el.name] = el.value;
      });

      const visibleSlots = [1, 2, 3, 4].filter((slot) => {
        const el = $(`.slot-prodotto[data-slot="${slot}"]`);
        return !!el && !el.hidden;
      });

      const payload = {
        v: 1,
        ts: Date.now(),
        distanzaKm: state.distanzaKm,
        coordCantiere: state.coordCantiere,
        accessoriSelezioni: state.accessoriSelezioni,
        servizi: state.valori.servizi_personalizzati || [],
        fields,
        radioValues,
        visibleSlots,
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignora errori localStorage/quota
    }
  }

  function ripristinaBozzaLocale() {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return false;
      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== 'object') return false;

      isApplyingDraft = true;

      if (typeof draft.distanzaKm === 'number') state.distanzaKm = draft.distanzaKm;
      if (draft.coordCantiere && typeof draft.coordCantiere === 'object') state.coordCantiere = draft.coordCantiere;
      if (draft.accessoriSelezioni && typeof draft.accessoriSelezioni === 'object') {
        state.accessoriSelezioni = {
          1: Array.isArray(draft.accessoriSelezioni[1]) ? draft.accessoriSelezioni[1] : [],
          2: Array.isArray(draft.accessoriSelezioni[2]) ? draft.accessoriSelezioni[2] : [],
          3: Array.isArray(draft.accessoriSelezioni[3]) ? draft.accessoriSelezioni[3] : [],
          4: Array.isArray(draft.accessoriSelezioni[4]) ? draft.accessoriSelezioni[4] : [],
        };
      }

      const fields = draft.fields || {};
      let maxVisible = 1;
      for (let i = 2; i <= 4; i++) {
        if ((fields[`input-prodotto-${i}`] && String(fields[`input-prodotto-${i}`]).trim() !== '') || (draft.visibleSlots || []).includes(i)) {
          maxVisible = i;
        }
      }
      for (let i = 2; i <= 4; i++) {
        const slotEl = $(`.slot-prodotto[data-slot="${i}"]`);
        if (slotEl) slotEl.hidden = i > maxVisible;
      }
      const btnAdd = $('#btn-aggiungi-prodotto');
      if (btnAdd) btnAdd.hidden = maxVisible >= 4;

      Object.entries(fields).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = Boolean(val);
        else el.value = val != null ? String(val) : '';
      });

      Object.entries(draft.radioValues || {}).forEach(([name, value]) => {
        const el = document.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`);
        if (el) el.checked = true;
      });

      const serviziContainer = $('#container-servizi-personalizzati');
      if (serviziContainer) serviziContainer.innerHTML = '';
      state.serviziPersonalizzati = [];
      serviziPersonalizzatiCounter = 0;
      (Array.isArray(draft.servizi) ? draft.servizi : []).forEach((s) => aggiungiServizioPersonalizzato(s));

      for (let i = 1; i <= 4; i++) {
        ripulisciAccessoriNonCompatibili(i);
        aggiornaRiepilogoAccessoriSlot(i);
      }

      const valDist = $('#valore-distanza');
      if (valDist && state.distanzaKm != null) valDist.textContent = `${state.distanzaKm} km`;
      const msgDist = $('#msg-distanza');
      const msgErr = $('#msg-errore-geocode');
      if (msgDist && state.distanzaKm != null) {
        msgDist.textContent = `Distanza: ${state.distanzaKm} km`;
        msgDist.hidden = false;
      }
      if (msgErr) msgErr.hidden = true;

      aggiornaValori();
      mostraNascondiDomande();
      checkSubmitFn();

      isApplyingDraft = false;
      return true;
    } catch {
      isApplyingDraft = false;
      return false;
    }
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
        lista.map((x) => ({
          codice: x.codice,
          modalita: x.modalita === 'installato' ? 'installato' : 'fornito',
          quantita: Math.max(0, parseNumero(x.quantita, 0)),
        }))
      );
    }
    const posti = $('#input-posti-auto');
    state.valori.numero_posti_auto = posti ? (parseInt(posti.value, 10) || 2) : 2;
    const splitTecnici = getRipartizioneTecnici();
    state.valori.tecnici_totali = splitTecnici.totali;
    state.valori.tecnici_interni = splitTecnici.interni;
    state.valori.presenza_tecnici_interni_pct = splitTecnici.presenzaInterniPct;
    state.valori.tecnici_esterni = splitTecnici.esterni;
    state.valori.presenza_tecnici_esterni_pct = splitTecnici.presenzaEsterniPct;
    const mulActv = $('#toggle-muletto')?.checked;
    const scaActv = $('#toggle-scala')?.checked;
    const gruActv = $('#toggle-gru')?.checked;
    state.valori.giorni_noleggio_muletto = mulActv ? (parseInt($('#input-giorni-muletto')?.value, 10) || 7) : 0;
    state.valori.costo_noleggio_muletto  = mulActv ? calcoloCostoMuletto(state.valori.giorni_noleggio_muletto) : null;
    state.valori.giorni_noleggio_scala   = scaActv ? (parseInt($('#input-giorni-scala')?.value, 10) || 1) : 0;
    state.valori.costo_noleggio_scala    = scaActv ? calcoloCostoScala(state.valori.giorni_noleggio_scala) : null;
    state.valori.giorni_presenza_gru     = gruActv ? (parseInt($('#input-giorni-gru')?.value, 10) || 1) : 0;
    state.valori.costo_gru_totale        = gruActv ? getCostoGruTotale(state.valori.giorni_presenza_gru) : 0;

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
    return getProdottoByModello(mod);
  }

  function getPostiAutoStepPerOre(posti) {
    const n = Math.max(1, Math.min(100, parseInt(String(posti), 10) || 1));
    if (n <= 20) return n;
    return Math.min(100, Math.ceil(n / 10) * 10);
  }

  /** Ore struttura da ORE_INSTALLAZIONE_{posti}PA (1..20, poi 30..100 step 10). */
  function getOreStrutturaProdotto(prodotto, posti) {
    const n = getPostiAutoStepPerOre(posti);
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

  function getScaglioniScontoOreDefault() {
    return [
      { min: 1, max: 2, sconto_pct: 0.0 },
      { min: 3, max: 4, sconto_pct: 0.0 },
      { min: 5, max: 6, sconto_pct: 0.0 },
      { min: 7, max: 8, sconto_pct: 2.0 },
      { min: 9, max: 10, sconto_pct: 3.0 },
      { min: 11, max: 15, sconto_pct: 3.2 },
      { min: 16, max: 20, sconto_pct: 3.5 },
      { min: 21, max: 25, sconto_pct: 3.6 },
      { min: 26, max: 30, sconto_pct: 3.8 },
      { min: 31, max: 35, sconto_pct: 3.8 },
      { min: 36, max: 40, sconto_pct: 3.9 },
      { min: 41, max: 45, sconto_pct: 4.0 },
      { min: 46, max: 50, sconto_pct: 4.0 },
      { min: 51, max: 75, sconto_pct: 5.0 },
      { min: 76, max: 100, sconto_pct: 5.6 },
      { min: 101, max: 125, sconto_pct: 6.0 },
      { min: 126, max: 150, sconto_pct: 6.0 },
      { min: 151, max: 175, sconto_pct: 6.3 },
      { min: 176, max: 200, sconto_pct: 6.5 },
      { min: 201, max: 250, sconto_pct: 7.0 },
      { min: 251, max: 300, sconto_pct: 7.5 },
      { min: 301, max: 350, sconto_pct: 8.0 },
      { min: 351, max: 400, sconto_pct: 8.0 },
      { min: 401, max: 450, sconto_pct: 8.2 },
      { min: 451, max: 500, sconto_pct: 8.4 },
      { min: 501, max: 600, sconto_pct: 8.6 },
      { min: 601, max: 700, sconto_pct: 8.8 },
      { min: 701, max: 800, sconto_pct: 8.9 },
      { min: 801, max: 900, sconto_pct: 9.0 },
      { min: 901, max: 1000, sconto_pct: 9.5 },
    ];
  }

  function getScontoOrePctByPosti(prodotto, posti) {
    const scaglioniProdotto = Array.isArray(prodotto?.SCONTO_ORE_SCAGLIONI) ? prodotto.SCONTO_ORE_SCAGLIONI : null;
    const list = (scaglioniProdotto && scaglioniProdotto.length ? scaglioniProdotto : getScaglioniScontoOreDefault())
      .map((x) => ({
        min: Number(x?.min),
        max: Number(x?.max),
        sconto_pct: Number(x?.sconto_pct),
      }))
      .filter((x) => Number.isFinite(x.min) && Number.isFinite(x.max) && Number.isFinite(x.sconto_pct) && x.max >= x.min)
      .sort((a, b) => a.min - b.min);

    if (!list.length) return 0;
    const nPosti = Math.max(1, parseInt(String(posti), 10) || 1);
    const row = list.find((x) => nPosti >= x.min && nPosti <= x.max);
    if (row) return Math.max(0, row.sconto_pct);
    return nPosti > list[list.length - 1].max ? Math.max(0, list[list.length - 1].sconto_pct) : 0;
  }

  function applicaScontoOre(ore, scontoPct) {
    const base = Number(ore) || 0;
    const pct = Math.max(0, Number(scontoPct) || 0);
    return Math.round(base * (1 - (pct / 100)) * 1000) / 1000;
  }

  function calcolaOreInstallazioneCantiere() {
    const posti = Math.max(parseInt($('#input-posti-auto')?.value, 10) || 2, 1);
    let totale = 0;
    let totaleLordo = 0;
    let totaleScontoOre = 0;
    const dettagli = [];

    for (let i = 1; i <= 4; i++) {
      const mod = $(`#input-prodotto-${i}`)?.value || '';
      if (!mod) continue;
      const p = state.prodotti.find((x) => x.MODELLO_STRUTTURA === mod);
      if (!p) continue;

      const oreStrutturaBase = getOreStrutturaProdotto(p, posti);
      let oreAccBase = 0;
      const accDet = [];
      const lista = state.accessoriSelezioni[i] || [];
      for (const a of lista) {
        if (a.modalita !== 'installato') continue;
        const cfg = getAccessorioConfigProdotto(p, a.codice);
        const qEff = (cfg.tipo_calcolo === 'per_posto_auto' && !a.custom_qty) ? posti : Math.max(0, parseNumero(a.quantita, 0));
        if (qEff <= 0) continue;
        const oBase = Math.max(0, parseNumero(cfg.ore_installazione_unita, getOreAccessorioProdotto(p, a.codice))) * qEff;
        oreAccBase += oBase;
        accDet.push({ codice: a.codice, oreBase: oBase, quantita: qEff, tipo_calcolo: cfg.tipo_calcolo });
      }

      const scontoPct = getScontoOrePctByPosti(p, posti);
      const oreStruttura = applicaScontoOre(oreStrutturaBase, scontoPct);
      let oreAcc = 0;
      accDet.forEach((a) => {
        a.ore = applicaScontoOre(a.oreBase, scontoPct);
        oreAcc += a.ore;
      });

      const oreSlotLordo = oreStrutturaBase + oreAccBase;
      const oreSlotTot = oreStruttura + oreAcc;
      const oreSlotSconto = Math.max(0, oreSlotLordo - oreSlotTot);

      totaleLordo += oreSlotLordo;
      totaleScontoOre += oreSlotSconto;
      totale += oreSlotTot;
      dettagli.push({
        slot: i,
        modello: mod,
        sconto_pct: scontoPct,
        oreStrutturaBase,
        oreStruttura,
        accessori: accDet,
        oreSlotLordo,
        oreSlotSconto,
        oreSlotTot,
      });
    }

    return { totale, totaleLordo, totaleScontoOre, dettagli, posti };
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
      ora_inizio_giornata_viaggio: 7,
      ora_fine_giornata_viaggio: 19,
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

  /** Lunedì di trasferta: il viaggio usa la fascia "giornata viaggio". */
  function oreCantiereLunedi(oraInizioLavoro, oraFineLavoro, pausaInizio, pausaFine, oraInizioViaggio, tV, oreMin) {
    const oraArrivo = oraInizioViaggio + tV;
    const inizioLavoro = Math.max(oraInizioLavoro, oraArrivo);
    const residuo = oreNetteInIntervallo(inizioLavoro, oraFineLavoro, pausaInizio, pausaFine);
    if (residuo + 1e-9 >= oreMin) return Math.max(0, residuo);
    return 0;
  }

  /** Venerdì di trasferta: il viaggio usa la fascia "giornata viaggio" e rispetta l'ora massima rientro. */
  function oreCantiereVenerdi(oraInizio, oraFine, pausaInizio, pausaFine, oraFineViaggio, oraMaxRientro, tV, rientroWeekend, oreNetteGiornoIntero) {
    if (!rientroWeekend) return oreNetteGiornoIntero;
    const cutoffRientro = Math.min(oraFineViaggio, oraMaxRientro);
    const oraPartenza = cutoffRientro - tV;
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
      oraInizioViaggio,
      oraFineViaggio,
      oraMaxRientro,
      rientroWeekend,
      c_int,
    } = opts;

    const oreCapLun = oreCantiereLunedi(oraInizio, oraFine, pausaInizio, pausaFine, oraInizioViaggio, tV, oreMin);
    const oreCapVen = oreCantiereVenerdi(oraInizio, oraFine, pausaInizio, pausaFine, oraFineViaggio, oraMaxRientro, tV, rientroWeekend, oreNette);
    const oreCapMid = oreNette;

    function notaGiorno(tipo, oreCapLunLoc, rientro) {
      if (tipo === 'lun') {
        if (oreCapLunLoc <= 1e-6) return 'Sotto le ore minime dopo l\'andata: nessun cantiere (giornata di viaggio).';
        return 'Andata in trasferta; ore cantiere = ore nette − tempo viaggio.';
      }
      if (tipo === 'ven') {
        if (!rientro) return 'Giornata in cantiere (rientro weekend disattivato).';
        const cutoff = Math.min(oraFineViaggio, oraMaxRientro);
        return `Partenza anticipata per rientro entro le ${formatOraDecimaleIt(cutoff)} (viaggio ${fmtOre(tV)}).`;
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
    // Remove JS floating point inaccuracy but strip trailing zeroes if it's a whole number
    return `${parseFloat(Number(h).toFixed(2))} h`;
  }

  function fmtEuro(n) {
    if (n == null || Number.isNaN(n)) return '—';
    // Always show 2 decimals for Euro
    return `€ ${Number(n).toFixed(2)}`;
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

    const { totale, totaleLordo, totaleScontoOre, dettagli, posti } = calcolaOreInstallazioneCantiere();
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

    const splitTecnici = getRipartizioneTecnici();
    const pInt = splitTecnici.presenzaInterniPct;
    const N_int = splitTecnici.interni;
    const N_est = splitTecnici.esterni;

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
    const oraInizioViaggio = cfgTr.ora_inizio_giornata_viaggio != null ? Number(cfgTr.ora_inizio_giornata_viaggio) : 7;
    const oraFineViaggio = cfgTr.ora_fine_giornata_viaggio != null ? Number(cfgTr.ora_fine_giornata_viaggio) : 19;

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
          oraInizioViaggio,
          oraFineViaggio,
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
    const hotelTot = trasfertaAttiva ? nottiHotel * hotelNotte * N_int : 0;
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
      if (elHt) elHt.textContent = `${fmtEuro(hotelTot)} (${N_int} tecnici × ${nottiHotel} notti × ${hotelNotte} €)`;
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
            ? row.accessori.map((a) => `${a.codice} x${a.quantita}: ${fmtOre(a.ore)} (lordo ${fmtOre(a.oreBase)})`).join(', ')
            : 'nessun accessorio da installare';
          li.innerHTML = `<strong>Prodotto ${row.slot}</strong> (${row.modello}), ${posti} PA — sconto ore ${row.sconto_pct.toFixed(1)}%: struttura ${fmtOre(row.oreStruttura)} (lordo ${fmtOre(row.oreStrutturaBase)}); accessori: ${accTxt} → <strong>totale slot ${fmtOre(row.oreSlotTot)}</strong> (sconto ${fmtOre(row.oreSlotSconto)})`;
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
      ore_lavoro_cantiere_totale_lordo: totaleLordo,
      ore_lavoro_cantiere_sconto_totale: totaleScontoOre,
      ore_lavoro_cantiere_totale: H,
      ore_giornata_nette: oreNette,
      dettaglio_slot: dettagli,
      tempo_viaggio_andata_ore: andata,
      tempo_viaggio_ar_ore: ar,
      soglia_km: soglia,
      regime: d <= soglia ? 'giornata' : 'trasferta_lunga',
      presenza_interni_pct: pInt,
      tecnici_totali: splitTecnici.totali,
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
    return getRipartizioneTecnici().presenzaEsterniPct;
  }

  /**
   * Ripartizione squadra: tecnici totali + presenza interni (%).
   * Consente tre casi: solo interni, solo esterni, misto.
   */
  function getRipartizioneTecnici() {
    const interni = Math.max(0, parseInt($('#input-tecnici-interni')?.value, 10) || 0);
    const esterni = Math.max(0, parseInt($('#input-tecnici-esterni')?.value, 10) || 0);
    const totali = interni + esterni;
    const presenzaInterniPct = totali > 0 ? Math.round((interni / totali) * 100) : 100;
    return {
      totali,
      presenzaInterniPct,
      presenzaEsterniPct: Math.max(0, 100 - presenzaInterniPct),
      interni,
      esterni,
    };
  }

  function calcoloNumeroTecniciEsterni() {
    return getRipartizioneTecnici().esterni;
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

  /** Costo servizio gru: usa state.parametri (primo giorno + extra) */
  function getCostoGruTotale(giorni) {
    if (giorni <= 0) return 0;
    const primo = getParametro('gru_primo_giorno') ?? 600;
    const extra = getParametro('gru_giorno_extra') ?? 100;
    return primo + (giorni - 1) * extra;
  }

  /** Tariffa €/km nostro mezzo = somma componenti variabili (costanti.json). */
  function getEurKmNostroMezzoSomma() {
    const b = getParametro('nostro_mezzo_eur_km_base') ?? 0.05;
    const p = getParametro('nostro_mezzo_eur_km_pedaggio') ?? 0;
    const c = getParametro('nostro_mezzo_eur_km_carburante') ?? 0;
    const u = getParametro('nostro_mezzo_eur_km_usura') ?? 0;
    return Math.max(0, (Number(b) || 0) + (Number(p) || 0) + (Number(c) || 0) + (Number(u) || 0));
  }

  function prodottoHasZavorreSelezionate(slot) {
    const list = state.accessoriSelezioni?.[slot] || [];
    return list.some((x) => x?.codice === 'ZAVORRE');
  }

  /**
   * Trasporto struttura magazzino → cantiere: viaggi = ceil(posti/capacità da prodotto), costo = viaggi × 2d × €/km.
   * modalita: nostro_mezzo | bilico | camion_gru
   */
  function calcolaDettaglioTrasportoMerci(distanzaKm, posti, modalita, prodotto) {
    const labels = { nostro_mezzo: 'Nostro mezzo', bilico: 'Bilico', camion_gru: 'Mezzo con gru (trasporto)' };
    let cap = 0;
    if (modalita === 'nostro_mezzo') cap = Number(prodotto?.nostro_mezzo) || 0;
    else if (modalita === 'bilico') {
      const hasZavorre = prodottoHasZavorreSelezionate(1);
      const capCon = Number(prodotto?.bilico_13mt_con_zavorre);
      const capSenza = Number(prodotto?.bilico_13mt_senza_zavorre);
      if (hasZavorre && Number.isFinite(capCon) && capCon > 0) {
        cap = capCon;
      } else if (Number.isFinite(capSenza) && capSenza > 0) {
        cap = capSenza;
      } else {
        cap = Number(prodotto?.bilico_13mt) || 0;
      }
      if (hasZavorre) labels.bilico = 'Bilico (con zavorre)';
      else labels.bilico = 'Bilico (senza zavorre)';
    }
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
    const kmTotStruttura = viaggi * kmAR;
    const costoStruttura = Math.round(kmTotStruttura * rateKm * 100) / 100;

    const accSel = state.accessoriSelezioni?.[1] || [];
    let viaggiAccessori = 0;
    let kmTotAccessori = 0;
    let costoAccessori = 0;
    const dettagliAccessori = [];
    const avvisi = [];

    accSel.forEach((a) => {
      const cfg = getAccessorioConfigProdotto(prodotto, a.codice);
      if (!cfg.soggetto_gestione_carico) return;

      const qty = (cfg.tipo_calcolo === 'per_posto_auto' && !a.custom_qty) ? (Number(posti) || 0) : Math.max(0, parseNumero(a.quantita, 0));
      if (qty <= 0) return;

      let capAcc = 0;
      if (modalita === 'nostro_mezzo') capAcc = cfg.cap_nostro_mezzo;
      else if (modalita === 'bilico') capAcc = cfg.cap_bilico;
      else capAcc = cfg.cap_camion_gru;

      if (!capAcc || capAcc <= 0) {
        avvisi.push(`Accessorio ${a.codice}: capacità carico non definita per ${labels[modalita] || modalita}.`);
        return;
      }

      const viaggiAcc = Math.ceil(qty / capAcc);
      const kmAcc = viaggiAcc * kmAR;
      const costoAcc = Math.round(kmAcc * rateKm * 100) / 100;
      viaggiAccessori += viaggiAcc;
      kmTotAccessori += kmAcc;
      costoAccessori += costoAcc;
      dettagliAccessori.push({ codice: a.codice, qty, cap: capAcc, viaggi: viaggiAcc, kmTot: kmAcc, costo: costoAcc });
    });

    const kmTot = kmTotStruttura + kmTotAccessori;
    const costo = Math.round((costoStruttura + costoAccessori) * 100) / 100;
    return {
      costo,
      viaggi,
      viaggiAccessori,
      viaggiTotali: viaggi + viaggiAccessori,
      cap,
      kmTot,
      kmTotStruttura,
      kmTotAccessori,
      kmAR,
      distanzaAndata: distanzaKm,
      rateKm,
      modalita,
      etichetta: labels[modalita] || modalita,
      costoStruttura,
      costoAccessori: Math.round(costoAccessori * 100) / 100,
      accessoriDettaglio: dettagliAccessori,
      avviso: avvisi.length ? avvisi.join(' ') : null,
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
    if (elTesto) {
      const r = Number(det.rateKm) || 0;
      elTesto.textContent = `${fmtEuro(det.costo)} — ${det.viaggiTotali || det.viaggi} viaggi, ${det.kmTot} km totali, €${r.toFixed(3)}/km (${det.etichetta})`;
    }
    if (elHint) {
      const extra = det.viaggiAccessori > 0 ? ` + accessori: ${det.viaggiAccessori} viaggi (${fmtEuro(det.costoAccessori)})` : '';
      elHint.textContent = `${det.etichetta}: struttura ${det.viaggi} viaggi, ${det.kmTotStruttura || det.kmTot} km.${extra}`;
    }
    if (elAvviso) {
      if (det.avviso) {
        elAvviso.textContent = det.avviso;
        elAvviso.hidden = false;
      } else {
        elAvviso.hidden = true;
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
    const costoGruTot = gruActv ? getCostoGruTotale(giorniGru) : 0;

    const cMul = costoMul != null ? costoMul : 0;
    const cSca = costoSca != null ? costoSca : 0;
    const servPers = sommaServiziPersonalizzati();

    const trVoci = Math.max(0, Number(st?.trasferta?.totale_voci_trasferta) || 0);
    const manSolo = Math.max(0, man - trVoci);

    const baseOre = manSolo + servPers;
    const baseTrasporti = det.costo + trVoci;
    const baseNoleggi = cMul + cSca + costoGruTot;

    const pctRicGen = Math.max(0, getParametro('ricarico_generale_pct') ?? 0);
    const pctRicOre = Math.max(0, getParametro('ricarico_ore_lavoro_pct') ?? 0);
    const pctRicTrs = Math.max(0, getParametro('ricarico_trasporti_pct') ?? 0);
    const pctRicNol = Math.max(0, getParametro('ricarico_noleggi_pct') ?? 0);

    const calcRic = (base, pctSpec) => {
      const b = Math.max(0, Number(base) || 0);
      return Math.round((b * ((pctRicGen + pctSpec) / 100)) * 100) / 100;
    };

    const ricOre = calcRic(baseOre, pctRicOre);
    const ricTrasporti = calcRic(baseTrasporti, pctRicTrs);
    const ricNoleggi = calcRic(baseNoleggi, pctRicNol);
    const ricTot = Math.round((ricOre + ricTrasporti + ricNoleggi) * 100) / 100;

    const subtotale = Math.round((baseOre + baseTrasporti + baseNoleggi + ricTot) * 100) / 100;

    const sicAtt = $('#sicurezza-includi')?.checked === true;
    let sicEuro = 0;
    if (sicAtt) sicEuro = Math.max(0, parseFloat($('#sicurezza-importo')?.value) || 0);
    const ricSicurezza = sicAtt ? Math.round((sicEuro * (pctRicGen / 100)) * 100) / 100 : 0;
    const totaleFin = Math.round((subtotale + sicEuro + ricSicurezza) * 100) / 100;

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
    if (elRt) elRt.textContent = fmtEuro(det.costo);
    const elRm = $('#riep-muletto');
    if (elRm) elRm.textContent = mulActv && costoMul != null ? fmtEuro(costoMul) : '—';
    const elRs = $('#riep-scala');
    if (elRs) elRs.textContent = scaActv && costoSca != null ? fmtEuro(costoSca) : '—';
    const elRg = $('#riep-gru-servizio');
    if (elRg) elRg.textContent = gruActv ? fmtEuro(costoGruTot) : '-';
    const elRp = $('#riep-servizi-pers');
    if (elRp) elRp.textContent = servPers > 0 ? fmtEuro(servPers) : '€ 0';
    const elRr = $('#riep-ricarico-tot');
    if (elRr) elRr.textContent = fmtEuro(ricTot + ricSicurezza);
    const elSub = $('#riep-subtotale');
    if (elSub) elSub.textContent = fmtEuro(subtotale);
    const elTot = $('#valore-totale-finale-installazione');
    if (elTot) elTot.textContent = fmtEuro(totaleFin);

    const elPostoBox = $('#blocco-totale-per-posto');
    const elPostoVal = $('#valore-totale-per-posto');
    const postiCorrenti = getPostiAutoCorrenti();
    if (elPostoBox && elPostoVal) {
      if (postiCorrenti > 0 && totaleFin > 0) {
        elPostoBox.hidden = false;
        elPostoVal.textContent = fmtEuro(totaleFin / postiCorrenti);
      } else {
        elPostoBox.hidden = true;
      }
    }

    const testoTrasporto = det.avviso
      ? det.avviso
      : `Trasporto struttura + accessori (${det.etichetta}): ${det.viaggiTotali || det.viaggi} viaggi, ${det.kmTot} km totali (A/R), tariffa €${(Number(det.rateKm) || 0).toFixed(3)}/km → ${fmtEuro(det.costo)}${det.viaggiAccessori > 0 ? ` (accessori: ${fmtEuro(det.costoAccessori)})` : ''}`;
    const testoSicurezza = sicAtt && sicEuro > 0
      ? `Costi sicurezza: ${fmtEuro(sicEuro)} (inclusi nel totale installazione; calcolo automatico = ${pctSic}% del subtotale).`
      : 'Costi sicurezza: non inclusi.';

    state.valori.costi_installazione_riepilogo = {
      manodopera_stimata: man,
      base_ore_lavoro: baseOre,
      base_trasporti: baseTrasporti,
      base_noleggi: baseNoleggi,
      trasporto_struttura: det,
      costo_trasporto_struttura: det.costo,
      noleggio_muletto: mulActv ? cMul : null,
      noleggio_scala: scaActv ? cSca : null,
      servizio_gru_cantiere: gruActv ? costoGruTot : null,
      servizi_personalizzati: servPers,
      ricarichi_percentuali: {
        generale: pctRicGen,
        ore_lavoro: pctRicOre,
        trasporti: pctRicTrs,
        noleggi: pctRicNol,
      },
      ricarico_ore_lavoro: ricOre,
      ricarico_trasporti: ricTrasporti,
      ricarico_noleggi: ricNoleggi,
      ricarico_totale: ricTot,
      subtotale_senza_sicurezza: subtotale,
      sicurezza_inclusa: sicAtt,
      sicurezza_importo: sicEuro,
      ricarico_sicurezza: ricSicurezza,
      totale_installazione: totaleFin,
      testo_trasporto_struttura: testoTrasporto,
      testo_costi_sicurezza: testoSicurezza,
      /* totali per sezione (usati nell'esportazione PDF) */
      totale_sezione_installazione: Math.round((baseOre + ricOre) * 100) / 100,
      totale_sezione_trasporto: Math.round((baseTrasporti + ricTrasporti) * 100) / 100,
      totale_sezione_noleggi_sicurezza: Math.round((baseNoleggi + ricNoleggi + sicEuro + ricSicurezza) * 100) / 100,
    };

    state.valori.costo_trasporto_struttura_stimato = det.costo;
    state.valori.modalita_trasporto_merci = modalita;
  }

  function aggiornaCampiCalcolati() {
    aggiornaValori();

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
        const giorniGru = parseInt($('#input-giorni-gru')?.value, 10) || 1;
        const costoTotale = getCostoGruTotale(giorniGru);
        elGru.textContent = fmtEuro(costoTotale);
      } else {
        elGru.textContent = '-';
      }
    }

    aggiornaOreInstallazioneUI();
    aggiornaRiepilogoCostiInstallazione();
    scheduleSaveDraft();
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
      aggiornaParametriDistanza(state.distanzaKm);
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
        const sub = Number(state.valori?.costi_installazione_riepilogo?.subtotale_senza_sicurezza) || 0;
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
        const slot = parseInt(String(e.target.id).replace('input-prodotto-', ''), 10);
        if (!Number.isNaN(slot)) ripulisciAccessoriNonCompatibili(slot);
        aggiornaValori();
        if (!Number.isNaN(slot)) aggiornaDopoModello(slot);
        aggiornaCampiCalcolati();
      }
      if (e.target.matches('#input-tecnici-interni, #input-tecnici-esterni, #input-giorni-muletto, #input-giorni-scala, #input-giorni-gru')) {
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
      if (e.target.matches('#input-tecnici-interni, #input-tecnici-esterni, #input-giorni-muletto, #input-giorni-scala, #input-giorni-gru')) {
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

    const formEl = document.getElementById('form-calcolo');
    formEl?.addEventListener('input', scheduleSaveDraft);
    formEl?.addEventListener('change', scheduleSaveDraft);
  }

  function aggiornaDopoModello(slot) {
    if (slot == null) return;
    ripulisciAccessoriNonCompatibili(slot);
    if (slot !== 1) return;
    const prodotto = prodottoSelezionato(slot);
    const postiAuto = $('#input-posti-auto');
    if (postiAuto) {
      if (prodotto && prodotto['POSTI AUTO'] != null) {
        postiAuto.value = Math.min(Math.max(1, parseInt(prodotto['POSTI AUTO'], 10) || 2), 100);
      } else {
        postiAuto.value = 2;
      }
    }
  }

  function bindParametri() {
    initParametriFromDefaults();
  }

  /* ── Nuovo calcolo ── */
  function bindNuovoCalcolo() {
    const btn = $('#btn-nuovo-calcolo');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!confirm('Vuoi davvero azzerare il calcolo corrente? Tutti i dati inseriti andranno persi.')) return;
      try { sessionStorage.setItem('calcoloPergo_reset', '1'); } catch (_) {}
      window.location.reload();
    });
  }

  /* ── Esporta PDF ── */
  function bindEsportaPdf() {
    const btnApri   = $('#btn-esporta-pdf');
    const modal     = $('#modal-esporta-pdf');
    const overlay   = $('#modal-esporta-pdf-overlay');
    const btnChiudi = $('#btn-chiudi-modal-esporta-pdf');
    const btnAnnulla= $('#btn-annulla-esporta-pdf');
    const btnGenera = $('#btn-genera-pdf');
    const msgNessuna= $('#msg-esporta-pdf-nessuna');

    function apri() {
      if (modal) modal.hidden = false;
    }
    function chiudi() {
      if (modal) modal.hidden = true;
      if (msgNessuna) msgNessuna.hidden = true;
    }

    if (btnApri)    btnApri.addEventListener('click', apri);
    if (btnChiudi)  btnChiudi.addEventListener('click', chiudi);
    if (btnAnnulla) btnAnnulla.addEventListener('click', chiudi);
    if (overlay)    overlay.addEventListener('click', chiudi);

    if (btnGenera) {
      btnGenera.addEventListener('click', () => {
        const sezInst  = !!$('#esporta-sez-installazione')?.checked;
        const sezTrsp  = !!$('#esporta-sez-trasporto')?.checked;
        const sezNol   = !!$('#esporta-sez-noleggi')?.checked;

        if (!sezInst && !sezTrsp && !sezNol) {
          if (msgNessuna) msgNessuna.hidden = false;
          return;
        }
        if (msgNessuna) msgNessuna.hidden = true;
        generaReportPdf({ sezInst, sezTrsp, sezNol });
        chiudi();
      });
    }

    // ── Copia per CRM ──
    function testoSezionePerCrm(sez) {
      const indirizzo = (state.valori?.indirizzo_cantiere || '').trim() || '—';
      const comune    = estraiComuneDaIndirizzo(indirizzo) || indirizzo;

      if (sez === 'installazione') {
        return `Costi installazione pergole fotovoltaiche presso cantiere di ${comune} – ${indirizzo}\n\n` +
          `La voce comprende l'analisi e la quantificazione delle attività di montaggio delle strutture Pergosolar, sviluppata sulla base del numero di posti auto, della configurazione dei moduli e degli eventuali accessori previsti (con distinzione tra sola fornitura e fornitura con installazione).\n\n` +
          `Il calcolo è effettuato considerando esclusivamente le ore operative effettive in cantiere, determinate per singolo posto auto e integrate con le lavorazioni aggiuntive legate agli accessori installati. Le ore sono sempre considerate al netto dei tempi di trasferimento e delle pause, garantendo una stima realistica delle attività produttive. La valorizzazione include l'impiego di squadre interne e/o esterne, il costo orario del personale tecnico specializzato, eventuali indennità di trasferta ove applicabili e l'organizzazione delle fasi di montaggio.\n\n` +
          `Per cantieri oltre la distanza soglia, sono considerati anche i costi indiretti legati alla trasferta, quali logistica, pernottamenti e gestione del personale.`;
      }
      if (sez === 'trasporto') {
        return `Costi di trasporto materiali Pergosolar presso cantiere di ${comune} – ${indirizzo}\n\n` +
          `La voce comprende il trasporto delle strutture Pergosolar dal sito produttivo al cantiere, calcolato in funzione del numero di posti auto, del peso complessivo dei materiali e della tipologia di mezzo utilizzato. La modalità di trasporto viene determinata tra mezzo aziendale, mezzo con gru o bilico per grandi forniture, in funzione dell'ottimizzazione logistica della commessa.\n\n` +
          `Il calcolo include la tariffa chilometrica differenziata per tipologia di mezzo, i costi di carburante, pedaggi e usura, nonché l'ottimizzazione dei carichi in relazione alla capacità di trasporto.\n\n` +
          `La stima è sviluppata per garantire efficienza, sicurezza e corretta proporzione tra volumi trasportati e costi sostenuti.`;
      }
      if (sez === 'noleggi') {
        return `Costi noleggio attrezzature e sicurezza cantiere Pergosolar – ${comune}\n\n` +
          `La voce comprende il noleggio delle attrezzature necessarie per l'esecuzione in sicurezza delle operazioni di installazione, selezionate in funzione della configurazione della commessa e delle caratteristiche del cantiere. Sono inclusi servizi di sollevamento con gru, piattaforme elevabili, scale professionali e attrezzature specifiche per il montaggio in quota, oltre ai mezzi di supporto alle operazioni logistiche.\n\n` +
          `Il calcolo è effettuato sulla base dei giorni effettivi di utilizzo e delle reali esigenze operative, con possibilità di adattamento a condizioni particolari di cantiere. È inoltre inclusa una quota dedicata alla gestione della sicurezza relativa al personale direttamente impiegato nelle lavorazioni, sia interno sia esterno, purché operante sotto il coordinamento diretto e regolato da contratto di subappalto con Spazi Tecnologie d'Ombra Srl, comprensiva di dispositivi di protezione, formazione e coordinamento operativo.`;
      }
      return '';
    }

    $$('.btn-crm-copia').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sez = btn.dataset.sez;
        const testo = testoSezionePerCrm(sez);
        if (!testo) return;
        navigator.clipboard.writeText(testo).then(() => {
          const feedback = $('#msg-copia-crm-ok');
          if (feedback) {
            feedback.hidden = false;
            clearTimeout(feedback._t);
            feedback._t = setTimeout(() => { feedback.hidden = true; }, 2500);
          }
        }).catch(() => {
          alert('Impossibile copiare negli appunti. Prova a usare Ctrl+C dopo aver selezionato il testo.');
        });
      });
    });
  }

  function estraiComuneDaIndirizzo(indirizzo) {
    if (!indirizzo) return '';
    const parti = indirizzo.split(',').map(p => p.trim()).filter(Boolean);
    return parti.length >= 2 ? parti[1] : parti[0] || '';
  }

  function generaReportPdf({ sezInst, sezTrsp, sezNol }) {
    const riepilogo = state.valori.costi_installazione_riepilogo;
    if (!riepilogo) {
      alert('Calcola prima il preventivo prima di esportare il report.');
      return;
    }

    const indirizzo = (state.valori.indirizzo_cantiere || '').trim() || '—';
    const comune    = estraiComuneDaIndirizzo(indirizzo) || indirizzo;

    const fmtE = (v) => {
      if (v == null || isNaN(v)) return '—';
      return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
    };

    const oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

    let html = `<div class="pdf-page-header">
      <h1>PERGOSOLAR — Offerta tecnica</h1>
      <p>Data: ${oggi} &nbsp;|&nbsp; Cantiere: ${indirizzo}</p>
    </div>`;

    if (sezInst) {
      const totale = riepilogo.totale_sezione_installazione;
      html += `<div class="pdf-section">
        <h2>COSTI DI INSTALLAZIONE</h2>
        <h3>Costi installazione pergole fotovoltaiche presso cantiere di ${comune} \u2013 ${indirizzo}</h3>
        <p>La voce comprende l\u2019analisi e la quantificazione delle attivit\u00e0 di montaggio delle strutture Pergosolar, sviluppata sulla base del numero di posti auto, della configurazione dei moduli e degli eventuali accessori previsti (con distinzione tra sola fornitura e fornitura con installazione).</p>
        <p>Il calcolo \u00e8 effettuato considerando esclusivamente le ore operative effettive in cantiere, determinate per singolo posto auto e integrate con le lavorazioni aggiuntive legate agli accessori installati. Le ore sono sempre considerate al netto dei tempi di trasferimento e delle pause, garantendo una stima realistica delle attivit\u00e0 produttive. La valorizzazione include l\u2019impiego di squadre interne e/o esterne, il costo orario del personale tecnico specializzato, eventuali indennit\u00e0 di trasferta ove applicabili e l\u2019organizzazione delle fasi di montaggio.</p>
        <p>Per cantieri oltre la distanza soglia, sono considerati anche i costi indiretti legati alla trasferta, quali logistica, pernottamenti e gestione del personale.</p>
        <span class="pdf-importo">${fmtE(totale)}</span>
      </div>`;
    }

    if (sezTrsp) {
      const totale = riepilogo.totale_sezione_trasporto;
      html += `<div class="pdf-section">
        <h2>COSTI DI TRASPORTO / CONSEGNA</h2>
        <h3>Costi di trasporto materiali Pergosolar presso cantiere di ${comune} \u2013 ${indirizzo}</h3>
        <p>La voce comprende il trasporto delle strutture Pergosolar dal sito produttivo al cantiere, calcolato in funzione del numero di posti auto, del peso complessivo dei materiali e della tipologia di mezzo utilizzato. La modalit\u00e0 di trasporto viene determinata tra mezzo aziendale, mezzo con gru o bilico per grandi forniture, in funzione dell\u2019ottimizzazione logistica della commessa.</p>
        <p>Il calcolo include la tariffa chilometrica differenziata per tipologia di mezzo, i costi di carburante, pedaggi e usura, nonch\u00e9 l\u2019ottimizzazione dei carichi in relazione alla capacit\u00e0 di trasporto.</p>
        <p>La stima \u00e8 sviluppata per garantire efficienza, sicurezza e corretta proporzione tra volumi trasportati e costi sostenuti.</p>
        <span class="pdf-importo">${fmtE(totale)}</span>
      </div>`;
    }

    if (sezNol) {
      const totale   = riepilogo.totale_sezione_noleggi_sicurezza;
      const sicEuro  = riepilogo.sicurezza_inclusa ? (riepilogo.sicurezza_importo || 0) : 0;
      const subtNol  = Math.round((totale - sicEuro) * 100) / 100;
      html += `<div class="pdf-section">
        <h2>COSTI NOLEGGIO ATTREZZATURE E SICUREZZA</h2>
        <h3>Costi noleggio attrezzature e sicurezza cantiere Pergosolar \u2013 ${comune}</h3>
        <p>La voce comprende il noleggio delle attrezzature necessarie per l\u2019esecuzione in sicurezza delle operazioni di installazione, selezionate in funzione della configurazione della commessa e delle caratteristiche del cantiere. Sono inclusi servizi di sollevamento con gru, piattaforme elevabili, scale professionali e attrezzature specifiche per il montaggio in quota, oltre ai mezzi di supporto alle operazioni logistiche.</p>
        <p>Il calcolo \u00e8 effettuato sulla base dei giorni effettivi di utilizzo e delle reali esigenze operative, con possibilit\u00e0 di adattamento a condizioni particolari di cantiere. \u00c8 inoltre inclusa una quota dedicata alla gestione della sicurezza relativa al personale direttamente impiegato nelle lavorazioni, sia interno sia esterno, purch\u00e9 operante sotto il coordinamento diretto e regolato da contratto di subappalto con Spazi Tecnologie d\u2019Ombra Srl, comprensiva di dispositivi di protezione, formazione e coordinamento operativo.</p>
        <span class="pdf-importo">Importo totale servizio: ${fmtE(totale)}${riepilogo.sicurezza_inclusa && sicEuro > 0 ? ` (di cui costi per la sicurezza: ${fmtE(sicEuro)})` : ''}</span>
      </div>`;
    }

    const container = $('#pdf-report-print');
    if (!container) return;
    container.innerHTML = html;
    container.hidden = false;
    setTimeout(() => {
      window.print();
      container.hidden = true;
    }, 100);
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
    bindEsportaPdf();
    bindNuovoCalcolo();
    if (sessionStorage.getItem('calcoloPergo_reset') === '1') {
      try { localStorage.removeItem(DRAFT_STORAGE_KEY); sessionStorage.removeItem('calcoloPergo_reset'); } catch (_) {}
    } else {
      ripristinaBozzaLocale();
    }
    mostraNascondiDomande();
    checkSubmitFn();

    window.addEventListener('beforeunload', () => {
      salvaBozzaLocale();
    });
  }

  /* L'app parte solo dopo che Google Maps SDK è pronto (callback nel tag script) */
  window.onGoogleMapsReady = init;
})();
