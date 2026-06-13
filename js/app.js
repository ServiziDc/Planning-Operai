// ============================================================
// Planning Operai - Gama Service
// Solo gli ADMIN modificano; gli altri utenti vedono in lettura.
// NOTA: niente template literal annidati - solo concatenazione.
// ============================================================

var state = {
  user: null,
  isAdmin: false,
  operai: [],          // [{id, nome, gruppo}]
  cantieri: [],        // ["TELECOM", ...]
  mese: '',            // "YYYY-MM"
  celle: {},           // { opId_DD: "testo" }
  giorno: '',          // "YYYY-MM-DD" per vista giorno
  gruppoFiltro: 'TUTTI',
  unsubPlanning: null,
  editKey: null
};

var GRUPPI = ['PERSONALE', 'PRESIDIANTI', 'ARTIGIANI'];
var GIORNI_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
var MESI_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

// ---------------- Utility ----------------
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function oggiMese() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
function oggiData() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function giorniNelMese(mese) {
  var p = mese.split('-');
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10), 0).getDate();
}
function classeValore(v) {
  if (!v) return '';
  var t = v.trim().toUpperCase();
  if (t.indexOf('ASSENZA') === 0) return 'v-assenza';
  if (t.indexOf('PERMESSO') === 0) return 'v-permesso';
  if (t.indexOf('FERIE') === 0 || t.indexOf('VACANZ') === 0) return 'v-ferie';
  if (t === 'UFF' || t.indexOf('UFFICIO') === 0) return 'v-uff';
  if (t.indexOf('MALATTIA') === 0) return 'v-malattia';
  return '';
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function slugify(nome) {
  var s = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  return s || ('op_' + Date.now());
}

// ---------------- Auth ----------------
document.getElementById('btnLogin').addEventListener('click', doLogin);
document.getElementById('loginPassword').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
document.getElementById('btnLogout').addEventListener('click', function () { auth.signOut(); });

function doLogin() {
  var email = document.getElementById('loginEmail').value.trim();
  var pass = document.getElementById('loginPassword').value;
  var err = document.getElementById('loginError');
  err.textContent = '';
  auth.signInWithEmailAndPassword(email, pass).catch(function (e) {
    var msg;
    var code = e && e.code ? e.code : '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      msg = 'Email o password errati.';
    } else if (code === 'auth/invalid-email') {
      msg = 'Formato email non valido.';
    } else if (code === 'auth/too-many-requests') {
      msg = 'Troppi tentativi: riprova tra qualche minuto.';
    } else if (code === 'auth/network-request-failed') {
      msg = 'Problema di rete: controlla la connessione.';
    } else if (code.indexOf('api-key') !== -1 || code === 'auth/invalid-api-key') {
      msg = 'Configurazione Firebase non valida (controlla js/firebase-config.js).';
    } else if (code === 'auth/unauthorized-domain') {
      msg = 'Dominio non autorizzato: aggiungilo in Firebase Authentication > Settings > Authorized domains.';
    } else {
      msg = 'Errore: ' + (code || e.message);
    }
    err.textContent = msg;
    console.error(e);
  });
}

auth.onAuthStateChanged(function (user) {
  state.user = user;
  state.isAdmin = !!(user && ADMIN_EMAILS.indexOf((user.email || '').toLowerCase()) !== -1);
  if (user) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    document.body.classList.toggle('admin', state.isAdmin);
    var badge = document.getElementById('userBadge');
    badge.textContent = state.isAdmin ? 'ADMIN' : 'Sola lettura';
    badge.classList.toggle('is-admin', state.isAdmin);
    document.getElementById('tabPattern').style.display = state.isAdmin ? '' : 'none';
    document.getElementById('tabSettings').style.display = state.isAdmin ? '' : 'none';
    avviaApp();
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appScreen').style.display = 'none';
    if (state.unsubPlanning) { state.unsubPlanning(); state.unsubPlanning = null; }
  }
});

// ---------------- Avvio ----------------
function avviaApp() {
  if (!state.mese) state.mese = oggiMese();
  if (!state.giorno) state.giorno = oggiData();
  document.getElementById('dayPicker').value = state.giorno;
  if (state.isAdmin) { autoSeedPrimoAvvio(); seedPresidiFuturi(); }
  caricaConfig();
  ascoltaPlanning();
}

// Al primo avvio assoluto (nessun operaio in Firestore) carica
// automaticamente i 25 operai e il planning di giugno 2026 dall'Excel.
function autoSeedPrimoAvvio() {
  db.collection('po_config').doc('operai').get().then(function (snap) {
    if (snap.exists && snap.data().lista && snap.data().lista.length) return;
    var presetIniziali = ['TELECOM', 'ENI', "C/C BELPO'", 'TORRE DIAMANTE', 'BETA', 'MICRON VIMERCATE', 'BNL VOGHERA', 'BNL PAVIA', 'X DARIO', 'UFF'];
    var ops = [];
    ops.push(db.collection('po_config').doc('operai').set({ lista: SEED_GIUGNO.operai }));
    ops.push(db.collection('po_config').doc('cantieri').set({ lista: presetIniziali }, { merge: true }));
    ops.push(db.collection('po_planning').doc(SEED_GIUGNO.mese).set({ celle: SEED_GIUGNO.celle }, { merge: true }));
    return Promise.all(ops).then(function () {
      console.log('Primo avvio: importati ' + SEED_GIUGNO.operai.length + ' operai e planning giugno 2026.');
    });
  }).catch(function (e) {
    console.warn('Auto-seed non eseguito:', e);
  });
}

// Pre-imposta i presidi fissi dei presidianti per luglio-settembre 2026
// (solo se quei mesi sono ancora vuoti). Non sovrascrive nulla di esistente.
function seedPresidiFuturi(cb) {
  if (typeof SEED_PRESIDI === 'undefined') { if (cb) cb({ totale: 0, errore: 'File SEED_PRESIDI non caricato' }); return; }
  var mesi = Object.keys(SEED_PRESIDI);
  var totale = 0, fatti = 0, errore = null;
  mesi.forEach(function (mese) {
    db.collection('po_planning').doc(mese).get().then(function (snap) {
      var esistenti = (snap.exists && snap.data().celle) ? snap.data().celle : {};
      var nuove = {};
      var src = SEED_PRESIDI[mese];
      Object.keys(src).forEach(function (k) { if (!esistenti[k]) nuove[k] = src[k]; });
      var p = Object.keys(nuove).length
        ? db.collection('po_planning').doc(mese).set({ celle: nuove }, { merge: true })
        : Promise.resolve();
      return p.then(function () {
        totale += Object.keys(nuove).length;
        if (Object.keys(nuove).length) console.log('Presidi ' + mese + ': ' + Object.keys(nuove).length + ' celle scritte.');
      });
    }).catch(function (e) {
      errore = (e && e.code ? e.code : '') + ' ' + (e && e.message ? e.message : e);
      console.warn('Presidi ' + mese + ' ERRORE:', e);
    }).then(function () { fatti++; if (fatti === mesi.length && cb) cb({ totale: totale, errore: errore }); });
  });
}

function caricaConfig() {
  db.collection('po_config').doc('operai').onSnapshot(function (snap) {
    state.operai = (snap.exists && snap.data().lista) ? snap.data().lista : [];
    renderTutto();
  });
  db.collection('po_config').doc('cantieri').onSnapshot(function (snap) {
    state.cantieri = (snap.exists && snap.data().lista) ? snap.data().lista : [];
    renderDatalist();
    renderCantieriUI();
  });
}

function ascoltaPlanning() {
  if (state.unsubPlanning) state.unsubPlanning();
  state.unsubPlanning = db.collection('po_planning').doc(state.mese).onSnapshot(function (snap) {
    state.celle = (snap.exists && snap.data().celle) ? snap.data().celle : {};
    renderTutto();
  });
}

function renderTutto() {
  renderMonthLabel();
  renderGroupFilter();
  renderGrid();
  renderDay();
  renderOperaiUI();
  renderPatternOperai();
}

// ---------------- Navigazione mese/giorno ----------------
document.getElementById('btnPrevMonth').addEventListener('click', function () { cambiaMese(-1); });
document.getElementById('btnNextMonth').addEventListener('click', function () { cambiaMese(1); });

function cambiaMese(delta) {
  var p = state.mese.split('-');
  var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1 + delta, 1);
  state.mese = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  ascoltaPlanning();
  renderMonthLabel();
}

function renderMonthLabel() {
  var p = state.mese.split('-');
  document.getElementById('monthLabel').textContent = MESI_IT[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

document.getElementById('btnPrevDay').addEventListener('click', function () { cambiaGiorno(-1); });
document.getElementById('btnNextDay').addEventListener('click', function () { cambiaGiorno(1); });
document.getElementById('dayPicker').addEventListener('change', function () {
  state.giorno = this.value;
  sincronizzaMeseDaGiorno();
});

function cambiaGiorno(delta) {
  var d = new Date(state.giorno + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  state.giorno = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  document.getElementById('dayPicker').value = state.giorno;
  sincronizzaMeseDaGiorno();
}

function sincronizzaMeseDaGiorno() {
  var m = state.giorno.substring(0, 7);
  if (m !== state.mese) { state.mese = m; ascoltaPlanning(); renderMonthLabel(); }
  else renderDay();
}

// ---------------- Tabs ----------------
var tabs = document.querySelectorAll('.tab');
for (var ti = 0; ti < tabs.length; ti++) {
  tabs[ti].addEventListener('click', function () {
    for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
    this.classList.add('active');
    var v = this.getAttribute('data-view');
    document.getElementById('viewGrid').style.display = (v === 'grid') ? '' : 'none';
    document.getElementById('viewDay').style.display = (v === 'day') ? '' : 'none';
    document.getElementById('viewPattern').style.display = (v === 'pattern') ? '' : 'none';
    document.getElementById('viewSettings').style.display = (v === 'settings') ? '' : 'none';
  });
}

// ---------------- Filtro gruppi ----------------
function renderGroupFilter() {
  var el = document.getElementById('groupFilter');
  var html = '';
  var opzioni = ['TUTTI'].concat(GRUPPI);
  for (var i = 0; i < opzioni.length; i++) {
    var g = opzioni[i];
    html += '<button class="gf-chip' + (state.gruppoFiltro === g ? ' active' : '') + '" data-g="' + g + '">' + g + '</button>';
  }
  el.innerHTML = html;
  var chips = el.querySelectorAll('.gf-chip');
  for (var c = 0; c < chips.length; c++) {
    chips[c].addEventListener('click', function () {
      state.gruppoFiltro = this.getAttribute('data-g');
      renderGroupFilter();
      renderGrid();
    });
  }
}

function operaiVisibili() {
  var out = [];
  for (var g = 0; g < GRUPPI.length; g++) {
    if (state.gruppoFiltro !== 'TUTTI' && state.gruppoFiltro !== GRUPPI[g]) continue;
    for (var i = 0; i < state.operai.length; i++) {
      if (state.operai[i].gruppo === GRUPPI[g]) out.push(state.operai[i]);
    }
  }
  return out;
}

// ---------------- Vista MESE ----------------
function renderGrid() {
  var ops = operaiVisibili();
  var nd = giorniNelMese(state.mese);
  var p = state.mese.split('-');
  var anno = parseInt(p[0], 10), mm = parseInt(p[1], 10);
  var oggi = oggiData();

  var html = '<table class="pgrid"><thead><tr class="grow"><th class="datecell">GRUPPO</th>';
  var prevG = '';
  for (var i = 0; i < ops.length; i++) {
    var sep = (ops[i].gruppo !== prevG && i > 0) ? ' gsep' : '';
    html += '<th class="' + sep + '">' + esc(ops[i].gruppo) + '</th>';
    prevG = ops[i].gruppo;
  }
  html += '</tr><tr class="nrow"><th class="datecell">DATA</th>';
  prevG = '';
  for (i = 0; i < ops.length; i++) {
    sep = (ops[i].gruppo !== prevG && i > 0) ? ' gsep' : '';
    html += '<th class="' + sep + '">' + esc(ops[i].nome) + '</th>';
    prevG = ops[i].gruppo;
  }
  html += '</tr></thead><tbody>';

  for (var d = 1; d <= nd; d++) {
    var data = new Date(anno, mm - 1, d);
    var dow = data.getDay();
    var iso = state.mese + '-' + pad2(d);
    var cls = (dow === 0 || dow === 6) ? ' weekend' : '';
    if (iso === oggi) cls += ' today';
    html += '<tr class="' + cls.trim() + '"><td class="datecell">' + GIORNI_IT[dow] + ' ' + pad2(d) + '</td>';
    prevG = '';
    for (i = 0; i < ops.length; i++) {
      var key = ops[i].id + '_' + pad2(d);
      var v = state.celle[key] || '';
      sep = (ops[i].gruppo !== prevG && i > 0) ? ' gsep' : '';
      html += '<td class="cell ' + classeValore(v) + sep + '" data-key="' + key + '" data-op="' + ops[i].id + '" data-day="' + pad2(d) + '">' + esc(v) + '</td>';
      prevG = ops[i].gruppo;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  document.getElementById('gridWrap').innerHTML = html;

  if (state.isAdmin) {
    var cells = document.querySelectorAll('#gridWrap td.cell');
    for (var ci = 0; ci < cells.length; ci++) {
      cells[ci].addEventListener('click', function () {
        apriModal(this.getAttribute('data-op'), this.getAttribute('data-day'));
      });
    }
  }
}

// ---------------- Vista GIORNO ----------------
function renderDay() {
  var el = document.getElementById('dayList');
  if (!state.giorno) return;
  var day = state.giorno.substring(8, 10);
  var html = '';
  for (var g = 0; g < GRUPPI.length; g++) {
    var gruppo = GRUPPI[g];
    var righe = '';
    for (var i = 0; i < state.operai.length; i++) {
      var op = state.operai[i];
      if (op.gruppo !== gruppo) continue;
      var v = state.celle[op.id + '_' + day] || '';
      righe += '<div class="day-row" data-op="' + op.id + '" data-day="' + day + '">' +
        '<div class="day-name">' + esc(op.nome) + '</div>' +
        '<div class="day-val ' + classeValore(v) + '">' + (v ? esc(v) : '—') + '</div></div>';
    }
    if (righe) html += '<div class="day-group-title">' + gruppo + '</div>' + righe;
  }
  el.innerHTML = html || '<div class="card">Nessun operaio configurato.</div>';

  if (state.isAdmin) {
    var rows = el.querySelectorAll('.day-row');
    for (var r = 0; r < rows.length; r++) {
      rows[r].addEventListener('click', function () {
        apriModal(this.getAttribute('data-op'), this.getAttribute('data-day'));
      });
    }
  }
}

// ---------------- Modal cella ----------------
function apriModal(opId, day) {
  var op = null;
  for (var i = 0; i < state.operai.length; i++) if (state.operai[i].id === opId) op = state.operai[i];
  if (!op) return;
  state.editKey = opId + '_' + day;
  var p = state.mese.split('-');
  var data = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(day, 10));
  document.getElementById('modalOperaio').textContent = op.nome;
  document.getElementById('modalData').textContent = GIORNI_IT[data.getDay()] + ' ' + day + ' ' + MESI_IT[data.getMonth()] + ' ' + data.getFullYear();
  document.getElementById('modalText').value = state.celle[state.editKey] || '';
  renderPresetChips();
  document.getElementById('cellModal').style.display = 'flex';
}

function renderPresetChips() {
  var el = document.getElementById('presetChips');
  var html = '';
  for (var i = 0; i < state.cantieri.length; i++) {
    html += '<button class="chip" data-val="' + esc(state.cantieri[i]) + '">' + esc(state.cantieri[i]) + '</button>';
  }
  el.innerHTML = html;
  collegaChips(el);
}

function collegaChips(container) {
  var chips = container.querySelectorAll('.chip');
  for (var i = 0; i < chips.length; i++) {
    chips[i].addEventListener('click', function () {
      document.getElementById('modalText').value = this.getAttribute('data-val');
    });
  }
}
collegaChips(document.querySelector('.quick-chips'));

document.getElementById('btnCloseModal').addEventListener('click', chiudiModal);
document.getElementById('cellModal').addEventListener('click', function (e) { if (e.target === this) chiudiModal(); });
function chiudiModal() { document.getElementById('cellModal').style.display = 'none'; state.editKey = null; }

document.getElementById('btnSaveCell').addEventListener('click', function () {
  var v = document.getElementById('modalText').value.trim();
  salvaCella(state.editKey, v).then(chiudiModal);
});
document.getElementById('btnClearCell').addEventListener('click', function () {
  salvaCella(state.editKey, '').then(chiudiModal);
});

function salvaCella(key, valore) {
  if (!key || !state.isAdmin) return Promise.resolve();
  var ref = db.collection('po_planning').doc(state.mese);
  var update = {};
  if (valore) {
    update['celle.' + key] = valore;
  } else {
    update['celle.' + key] = firebase.firestore.FieldValue.delete();
  }
  return ref.update(update).catch(function () {
    var doc = { celle: {} };
    if (valore) doc.celle[key] = valore;
    return ref.set(doc, { merge: true });
  });
}

// ---------------- Pattern ----------------
function renderPatternOperai() {
  if (!state.isAdmin) return;
  var el = document.getElementById('patternOperai');
  var html = '';
  for (var g = 0; g < GRUPPI.length; g++) {
    for (var i = 0; i < state.operai.length; i++) {
      var op = state.operai[i];
      if (op.gruppo !== GRUPPI[g]) continue;
      html += '<label><input type="checkbox" value="' + op.id + '"> ' + esc(op.nome) + ' <span style="color:#9ca3af;font-size:10px;">(' + op.gruppo.substring(0, 4) + ')</span></label>';
    }
  }
  el.innerHTML = html;
}

document.getElementById('btnApplyPattern').addEventListener('click', function () {
  var res = document.getElementById('patternResult');
  res.className = 'result-msg';
  var checked = document.querySelectorAll('#patternOperai input:checked');
  var cantiere = document.getElementById('patternCantiere').value.trim();
  var dal = document.getElementById('patternDal').value;
  var al = document.getElementById('patternAl').value;
  var soloFeriali = document.getElementById('patternFeriali').checked;
  var sovrascrivi = document.getElementById('patternSovrascrivi').checked;

  if (!checked.length || !cantiere || !dal || !al || dal > al) {
    res.textContent = 'Compila operai, cantiere e date valide.';
    res.classList.add('err');
    return;
  }

  var ops = [];
  for (var i = 0; i < checked.length; i++) ops.push(checked[i].value);

  var perMese = {}; // "YYYY-MM" -> {key: valore}
  var d = new Date(dal + 'T12:00:00');
  var fine = new Date(al + 'T12:00:00');
  while (d <= fine) {
    var dow = d.getDay();
    if (!soloFeriali || (dow >= 1 && dow <= 5)) {
      var m = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
      var dd = pad2(d.getDate());
      if (!perMese[m]) perMese[m] = {};
      for (var o = 0; o < ops.length; o++) {
        perMese[m][ops[o] + '_' + dd] = cantiere;
      }
    }
    d.setDate(d.getDate() + 1);
  }

  var promesse = [];
  var totale = 0;
  Object.keys(perMese).forEach(function (mese) {
    var ref = db.collection('po_planning').doc(mese);
    promesse.push(ref.get().then(function (snap) {
      var esistenti = (snap.exists && snap.data().celle) ? snap.data().celle : {};
      var nuove = {};
      Object.keys(perMese[mese]).forEach(function (k) {
        if (sovrascrivi || !esistenti[k]) { nuove[k] = perMese[mese][k]; totale++; }
      });
      if (!Object.keys(nuove).length) return;
      return ref.set({ celle: nuove }, { merge: true });
    }));
  });

  Promise.all(promesse).then(function () {
    res.textContent = 'Pattern applicato: ' + totale + ' celle compilate.';
    res.classList.add('ok');
  }).catch(function (e) {
    res.textContent = 'Errore: ' + e.message;
    res.classList.add('err');
  });
});

// ---------------- Gestione operai ----------------
function renderOperaiUI() {
  if (!state.isAdmin) return;
  var el = document.getElementById('operaiList');
  var html = '';
  for (var g = 0; g < GRUPPI.length; g++) {
    for (var i = 0; i < state.operai.length; i++) {
      var op = state.operai[i];
      if (op.gruppo !== GRUPPI[g]) continue;
      html += '<div class="item-row"><span>' + esc(op.nome) + '</span>' +
        '<span class="grp">' + op.gruppo + '</span>' +
        '<button class="btn btn-danger" data-del="' + op.id + '">Elimina</button></div>';
    }
  }
  el.innerHTML = html || '<p class="hint">Nessun operaio. Aggiungine uno o importa i dati di giugno.</p>';
  var btns = el.querySelectorAll('[data-del]');
  for (var b = 0; b < btns.length; b++) {
    btns[b].addEventListener('click', function () {
      var id = this.getAttribute('data-del');
      if (!confirm('Eliminare questo operaio dall\'elenco? Le assegnazioni passate restano nello storico.')) return;
      var lista = state.operai.filter(function (o) { return o.id !== id; });
      db.collection('po_config').doc('operai').set({ lista: lista });
    });
  }
}

document.getElementById('btnAddOperaio').addEventListener('click', function () {
  var nome = document.getElementById('newOperaioNome').value.trim().toUpperCase();
  var gruppo = document.getElementById('newOperaioGruppo').value;
  if (!nome) return;
  var id = slugify(nome);
  for (var i = 0; i < state.operai.length; i++) {
    if (state.operai[i].id === id) { alert('Operaio già presente.'); return; }
  }
  var lista = state.operai.concat([{ id: id, nome: nome, gruppo: gruppo }]);
  db.collection('po_config').doc('operai').set({ lista: lista }).then(function () {
    document.getElementById('newOperaioNome').value = '';
  });
});

// ---------------- Gestione cantieri preset ----------------
function renderCantieriUI() {
  if (!state.isAdmin) return;
  var el = document.getElementById('cantieriListUI');
  var html = '';
  for (var i = 0; i < state.cantieri.length; i++) {
    html += '<div class="item-row"><span>' + esc(state.cantieri[i]) + '</span>' +
      '<button class="btn btn-danger" data-delc="' + i + '">Elimina</button></div>';
  }
  el.innerHTML = html || '<p class="hint">Nessun preset.</p>';
  var btns = el.querySelectorAll('[data-delc]');
  for (var b = 0; b < btns.length; b++) {
    btns[b].addEventListener('click', function () {
      var idx = parseInt(this.getAttribute('data-delc'), 10);
      var lista = state.cantieri.slice();
      lista.splice(idx, 1);
      db.collection('po_config').doc('cantieri').set({ lista: lista });
    });
  }
}

document.getElementById('btnAddCantiere').addEventListener('click', function () {
  var nome = document.getElementById('newCantiere').value.trim().toUpperCase();
  if (!nome) return;
  if (state.cantieri.indexOf(nome) !== -1) return;
  db.collection('po_config').doc('cantieri').set({ lista: state.cantieri.concat([nome]) }).then(function () {
    document.getElementById('newCantiere').value = '';
  });
});

function renderDatalist() {
  var dl = document.getElementById('cantieriList');
  var html = '';
  for (var i = 0; i < state.cantieri.length; i++) {
    html += '<option value="' + esc(state.cantieri[i]) + '">';
  }
  dl.innerHTML = html;
}

// ---------------- Seed giugno 2026 ----------------
document.getElementById('btnSeed').addEventListener('click', function () {
  var res = document.getElementById('seedResult');
  res.className = 'result-msg';
  if (!confirm('Importare operai e planning di GIUGNO 2026 dal foglio Excel? I dati esistenti verranno uniti.')) return;
  var presetIniziali = ['TELECOM', 'ENI', "C/C BELPO'", 'TORRE DIAMANTE', 'BETA', 'MICRON VIMERCATE', 'BNL VOGHERA', 'BNL PAVIA', 'X DARIO', 'UFF'];
  var batch = [];
  batch.push(db.collection('po_config').doc('operai').set({ lista: SEED_GIUGNO.operai }));
  batch.push(db.collection('po_config').doc('cantieri').set({ lista: presetIniziali }, { merge: true }));
  batch.push(db.collection('po_planning').doc(SEED_GIUGNO.mese).set({ celle: SEED_GIUGNO.celle }, { merge: true }));
  Promise.all(batch).then(function () {
    res.textContent = 'Importazione completata: ' + SEED_GIUGNO.operai.length + ' operai e ' + Object.keys(SEED_GIUGNO.celle).length + ' assegnazioni.';
    res.classList.add('ok');
  }).catch(function (e) {
    res.textContent = 'Errore: ' + e.message;
    res.classList.add('err');
  });
});

// ---------------- Export Excel ----------------
document.getElementById('btnSeedPresidi').addEventListener('click', function () {
  var res = document.getElementById('seedResult');
  res.className = 'result-msg';
  res.textContent = 'Caricamento presidi in corso...';
  seedPresidiFuturi(function (r) {
    if (r.errore) {
      res.className = 'result-msg err';
      if (r.errore.indexOf('permission') !== -1 || r.errore.indexOf('insufficient') !== -1) {
        res.textContent = '⛔ SCRITTURA BLOCCATA dalle regole Firestore. Devi pubblicare le regole aggiornate (blocco po_planning) nella Console Firebase. Dettaglio: ' + r.errore;
      } else {
        res.textContent = '⚠️ Errore: ' + r.errore;
      }
    } else if (r.totale > 0) {
      res.className = 'result-msg ok';
      res.textContent = '✅ Presidi pre-impostati: ' + r.totale + ' celle su luglio-settembre. Naviga con ▶ per vederli.';
    } else {
      res.className = 'result-msg ok';
      res.textContent = 'Presidi gia presenti: nessuna cella nuova da aggiungere.';
    }
  });
});

document.getElementById('btnExport').addEventListener('click', function () {
  var nd = giorniNelMese(state.mese);
  var p = state.mese.split('-');
  var anno = parseInt(p[0], 10), mm = parseInt(p[1], 10);
  var nomeMese = MESI_IT[mm - 1].toUpperCase();

  // Ordina operai per gruppo come nel foglio originale
  var ops = [];
  for (var g = 0; g < GRUPPI.length; g++) {
    for (var i = 0; i < state.operai.length; i++) {
      if (state.operai[i].gruppo === GRUPPI[g]) ops.push(state.operai[i]);
    }
  }

  var aoa = [];
  var r1 = ['DATA'];
  var r2 = ['MESE'];
  for (i = 0; i < ops.length; i++) { r1.push(ops[i].gruppo); r2.push(ops[i].nome); }
  aoa.push(r1); aoa.push(r2);

  for (var d = 1; d <= nd; d++) {
    var data = new Date(anno, mm - 1, d);
    var riga = [pad2(d) + '/' + pad2(mm) + '/' + anno + ' ' + GIORNI_IT[data.getDay()]];
    for (i = 0; i < ops.length; i++) {
      riga.push(state.celle[ops[i].id + '_' + pad2(d)] || '');
    }
    aoa.push(riga);
  }

  var ws = XLSX.utils.aoa_to_sheet(aoa);
  var cols = [{ wch: 14 }];
  for (i = 0; i < ops.length; i++) cols.push({ wch: 22 });
  ws['!cols'] = cols;
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nomeMese);
  XLSX.writeFile(wb, 'FOGLIO_PRESENZE_' + nomeMese + '_' + anno + '.xlsx');
});
