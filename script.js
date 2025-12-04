/* script.js
   Réservation Cantine - front JS
   - Chargement names.json depuis /data/names.json si présent
   - Autocomplétion + ajout
   - Calendrier Lundi-Vendredi pour le mois passé en param ?month=YYYY-MM
   - Sauvegarde locale (localStorage) par défaut sous clé reservations-YYYY-MM
   - Option: pushToGitHub pour écrire un fichier JSON dans un repo (nécessite token)
*/

/* ---------- config ---------- */
const CONFIG = {
  namesUrl: '/data/names.json', // optionnel dans repo
  storagePrefix: 'cantine-reservations-', // + YYYY-MM
  namesStorageKey: 'cantine-names', // fallback store
  github: {
    enabled: false,          // mettre true pour activer la fonction push (attention token)
    owner: 'TON_USER',       // remplacer
    repo: 'TON_REPO',        // remplacer
    branch: 'main',
    // token must be provided by user at runtime (do NOT hardcode in public repo)
    // see pushToGitHub usage below
  },
  lockTodayAfterHour: 10 // 10 => aujourd'hui non éditable à partir de 10:00
};

/* ---------- utils ---------- */
function getParamMonth() {
  // attend ?month=YYYY-MM ou ?month=YYYY-MM-DD ; on récupère YYYY-MM
  const url = new URL(location.href);
  const m = url.searchParams.get('month');
  if (!m) {
    // fallback to current month
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }
  const parts = m.split('-');
  return `${parts[0]}-${String(parts[1]||'01').padStart(2,'0')}`;
}
function monthLabel(yyyymm){
  const [y,m] = yyyymm.split('-').map(Number);
  return new Date(y,m-1,1).toLocaleString('fr-FR',{month:'long', year:'numeric'});
}
function isSameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function yyyy_mm_dd(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

/* ---------- state ---------- */
let state = {
  month: getParamMonth(),          // "YYYY-MM"
  names: [],                       // {id, name}
  selectedNameId: null,            // id
  reservations: {},                // map date -> { userId -> { veg:bool, time: '11:45'|'12:30'|null } }
  dirty: false
};

/* ---------- DOM refs ---------- */
const monthTitle = document.getElementById('monthTitle');
const calendarGrid = document.getElementById('calendarGrid');
const weekdaysRow = document.getElementById('weekdaysRow');
const nameInput = document.getElementById('nameInput');
const addNameBtn = document.getElementById('addNameBtn');
const acList = document.getElementById('acList');
const lastNameSpan = document.getElementById('lastName');
const saveBtn = document.getElementById('saveBtn');
const statusText = document.getElementById('statusText');
const modalBack = document.getElementById('modalBack');
const modalContent = document.getElementById('modalContent');

/* ---------- init ---------- */
(async function init(){
  monthTitle.textContent = monthLabel(state.month);
  loadWeekdays();
  await loadNames();
  loadLastSelectedName();
  loadReservationsFromStorage();
  renderCalendar();
  wireEvents();
  updateStatus();
})();

/* ---------- load names ---------- */
async function loadNames(){
  // Try fetching names.json; fallback to localStorage
  try {
    const r = await fetch(CONFIG.namesUrl, {cache:'no-store'});
    if (!r.ok) throw new Error('no names.json on server');
    const data = await r.json();
    if (Array.isArray(data)) state.names = data;
    else state.names = [];
  } catch(e){
    // fallback
    const local = localStorage.getItem(CONFIG.namesStorageKey);
    if (local) state.names = JSON.parse(local);
    else {
      // seed sample
      state.names = [
        {id: 'u-1', name: 'Dupont Alice'},
        {id: 'u-2', name: 'Martin Paul'},
        {id: 'u-3', name: 'Nguyen Lea'}
      ];
      localStorage.setItem(CONFIG.namesStorageKey, JSON.stringify(state.names));
    }
  }
}

/* ---------- persist names if we add one ---------- */
function saveNamesToLocal(){
  localStorage.setItem(CONFIG.namesStorageKey, JSON.stringify(state.names));
}

/* ---------- last selected name ---------- */
function loadLastSelectedName(){
  const last = localStorage.getItem('cantine-last-name-id');
  if (last) {
    state.selectedNameId = last;
    const n = state.names.find(x=>x.id===last);
    if (n) {
      nameInput.value = n.name;
      lastNameSpan.textContent = n.name;
    }
  } else lastNameSpan.textContent = '—';
}

/* ---------- reservations storage per month ---------- */
function reservationsKey() { return CONFIG.storagePrefix + state.month; }

function loadReservationsFromStorage(){
  const raw = localStorage.getItem(reservationsKey());
  if (raw) {
    try { state.reservations = JSON.parse(raw); } catch(e){ state.reservations = {} }
  } else {
    state.reservations = {};
  }
}

function saveReservationsToStorage(){
  localStorage.setItem(reservationsKey(), JSON.stringify(state.reservations));
  state.dirty = false;
  updateStatus();
}

/* ---------- render weekdays ---------- */
function loadWeekdays(){
  const days = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi'];
  weekdaysRow.innerHTML = '';
  for (let d of days){
    const el = document.createElement('div'); el.className='weekday'; el.textContent = d;
    weekdaysRow.appendChild(el);
  }
}

/* ---------- build calendar grid (only mon-fri) ---------- */
function renderCalendar(){
  calendarGrid.innerHTML = '';
  const [y,m] = state.month.split('-').map(Number);
  const first = new Date(y,m-1,1);
  const last = new Date(y,m,0); // last day
  // compute first Monday or if first day is weekend we skip weekend days
  // We'll iterate from day=1..last.getDate() but only render Monday->Friday positions.
  // Fill grid with only weekdays, rows as necessary.
  const days = [];
  for (let d=1; d<=last.getDate(); d++){
    const date = new Date(y,m-1,d);
    const weekday = date.getDay(); // 0 Sun .. 6 Sat
    if (weekday >= 1 && weekday <= 5) days.push(date);
  }

  // For visual grid, we just append cards in sequence; grid CSS handles rows
  for (let date of days){
    const dStr = yyyy_mm_dd(date);
    const card = createDayCard(date, dStr);
    calendarGrid.appendChild(card);
  }
}

/* ---------- create day card ---------- */
function createDayCard(date, dStr){
  const card = document.createElement('div');
  card.className = 'day-card';
  // highlight today?
  const today = new Date();
  if (isSameDay(date,today)) card.classList.add('highlight');

  // disable editing rules
  const now = new Date();
  let editable = true;
  if (date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) editable = false;
  if (isSameDay(date, now) && now.getHours() >= CONFIG.lockTodayAfterHour) editable = false;

  if (!editable) card.classList.add('dimmed');

  // header
  const head = document.createElement('div'); head.className='day-head';
  const num = document.createElement('div'); num.className='day-number'; num.textContent = date.getDate();
  const printer = document.createElement('div'); printer.className='printer'; printer.title='Imprimer listes';
  printer.innerHTML = '🖨️';
  printer.addEventListener('click', (e)=> openPrintMenu(dStr));
  head.appendChild(num); head.appendChild(printer);

  // controls
  const controls = document.createElement('div'); controls.className='day-controls';

  // vegetarian toggle
  const vegWrap = document.createElement('label'); vegWrap.className='veg';
  const vegInput = document.createElement('input'); vegInput.type='checkbox'; vegInput.dataset.date = dStr;
  vegInput.checked = getUserChoice(dStr)?.veg || false;
  const vegBox = document.createElement('div'); vegBox.className='veg-box'; vegBox.innerHTML = '🥦';
  const vegCountBtn = document.createElement('button'); vegCountBtn.className='icon-button'; vegCountBtn.title='Liste végétarien';
  vegCountBtn.innerHTML = `<span>👤</span><span class="count">${countFor(dStr,'veg')}</span>`;
  vegCountBtn.addEventListener('click', ()=> openListModal(dStr,'veg'));

  vegInput.addEventListener('change', (e)=>{
    if (!editable) { vegInput.checked = !vegInput.checked; return; }
    setUserChoice(dStr, { veg: vegInput.checked, time: getUserChoice(dStr)?.time || null });
    vegCountBtn.querySelector('.count').textContent = countFor(dStr,'veg');
  });

  vegWrap.appendChild(vegInput);
  vegWrap.appendChild(vegBox);
  vegWrap.appendChild(document.createTextNode(' Végétarien'));
  vegWrap.appendChild(vegCountBtn);

  // times radio group
  const timeGroup = document.createElement('div'); timeGroup.className='time-group';
  ['11:45','12:30'].forEach(t=>{
    const opt = document.createElement('label'); opt.className='time-option';
    opt.dataset.date = dStr; opt.dataset.time = t;
    const r = document.createElement('input'); r.type='radio'; r.name = 'time-'+dStr; r.dataset.date=dStr; r.dataset.time=t;
    r.checked = getUserChoice(dStr)?.time === t;
    const radio = document.createElement('span'); radio.className='radio';
    const timeText = document.createElement('div'); timeText.textContent = t; timeText.style.flex='1';
    const iconBtn = document.createElement('button'); iconBtn.className='icon-button'; iconBtn.innerHTML = `<span>👤</span><span class="count">${countFor(dStr,t)}</span>`;
    iconBtn.addEventListener('click', ()=> openListModal(dStr,t));
    opt.appendChild(radio); opt.appendChild(timeText); opt.appendChild(iconBtn);

    // select radio when clicking
    opt.addEventListener('click', (e)=>{
      if (!editable) return;
      // update radio states
      const prev = document.querySelectorAll(`input[name="time-${dStr}"]`);
      prev.forEach(i=>i.checked = false);
      r.checked = true;
      setUserChoice(dStr, { veg: getUserChoice(dStr)?.veg || false, time: t });
      // update counts for both times (re-render counts)
      refreshCountsForDay(dStr);
    });

    timeGroup.appendChild(opt);
  });

  // assemble
  card.appendChild(head);
  controls.appendChild(vegWrap);
  controls.appendChild(timeGroup);
  card.appendChild(controls);

  // store editable attr to possibly style later
  if (!editable) {
    // ensure inputs disabled visually as well
    card.querySelectorAll('input, button, label').forEach(el=>{
      el.setAttribute('disabled','true');
      el.style.pointerEvents = 'none';
    });
  }

  return card;
}

/* ---------- helper: getUserChoice / setUserChoice ---------- */
function getCurrentUserId(){
  if (!state.selectedNameId) return null;
  return state.selectedNameId;
}

function getUserChoice(dStr){
  const userId = getCurrentUserId();
  if (!userId) return null;
  if (!state.reservations[dStr]) return null;
  return state.reservations[dStr][userId] || null;
}

function setUserChoice(dStr, choice){
  if (!state.selectedNameId){
    alert("Sélectionne d'abord ton nom (ou ajoute-toi).");
    return;
  }
  const uid = state.selectedNameId;
  if (!state.reservations[dStr]) state.reservations[dStr] = {};
  if (!choice || (choice.time === null && !choice.veg)) {
    // remove if nothing selected
    delete state.reservations[dStr][uid];
    if (Object.keys(state.reservations[dStr]).length===0) delete state.reservations[dStr];
  } else {
    state.reservations[dStr][uid] = { veg: !!choice.veg, time: choice.time || null };
  }
  state.dirty = true;
  updateStatus();
  // update counts on UI
  refreshCountsForDay(dStr);
}

/* ---------- counts & list retrieval ---------- */
function countFor(dStr, type){
  // type: 'veg' or '11:45' or '12:30'
  const map = state.reservations[dStr] || {};
  let count = 0;
  for (let uid in map){
    const c = map[uid];
    if (type==='veg'){ if (c.veg) count++ }
    else { if (c.time === type) count++ }
  }
  return count;
}
function listFor(dStr, type){
  const map = state.reservations[dStr] || {};
  const list = [];
  for (let uid in map){
    const c = map[uid];
    if (type==='veg' && c.veg) list.push(uidName(uid));
    if (type!=='veg' && c.time===type) list.push(uidName(uid));
  }
  return list;
}
function uidName(uid){
  const u = state.names.find(n=>n.id===uid);
  return u ? u.name : uid;
}
function refreshCountsForDay(dStr){
  // update veg count
  const vegBtns = document.querySelectorAll(`[data-date="${dStr}"]`);
  vegBtns.forEach(el=>{
    if (el.classList && el.classList.contains('icon-button')){
      // button for counts
      const parent = el.closest('.day-card');
      if (!parent) return;
      const vegCountEl = parent.querySelector('.veg .icon-button .count');
      if (vegCountEl) vegCountEl.textContent = countFor(dStr,'veg');
      // time counts
      const times = ['11:45','12:30'];
      times.forEach(t=>{
        const btn = parent.querySelector(`.time-option[data-time="${t}"] .icon-button .count`);
        if (btn) btn.textContent = countFor(dStr,t);
      });
    }
  });
  // simpler: refresh the entire grid for counts
  const allCards = document.querySelectorAll('.day-card');
  allCards.forEach(card=>{
    const dateData = card.querySelector('.time-option')?.dataset.date || null;
    if (!dateData) {
      // find first input
      const ip = card.querySelector('input');
      if (ip) dateData = ip.dataset.date;
    }
    if (!dateData) return;
    // veg
    const vegCountEl = card.querySelector('.veg .icon-button .count');
    if (vegCountEl) vegCountEl.textContent = countFor(dateData,'veg');
    // times
    ['11:45','12:30'].forEach(t=>{
      const c = card.querySelector(`.time-option[data-time="${t}"] .icon-button .count`);
      if (c) c.textContent = countFor(dateData,t);
    });
  });
}

/* ---------- modal + printing ---------- */
function openListModal(dStr, type){
  const title = type==='veg' ? `Végétarien - ${dStr}` : `${type} - ${dStr}`;
  const list = listFor(dStr,type);
  modalContent.innerHTML = `<h3>${title}</h3>
    <div style="margin-bottom:12px">${list.length} inscrit(s)</div>
    <ul>${list.map(n=>`<li>${n}</li>`).join('')}</ul>
    <div style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end;">
      <button id="modalPrintBtn">Imprimer</button>
      <button id="modalCloseBtn">Fermer</button>
    </div>`;
  modalBack.style.display = 'flex';
  document.getElementById('modalCloseBtn').addEventListener('click', ()=> modalBack.style.display='none');
  document.getElementById('modalPrintBtn').addEventListener('click', ()=> {
    const w = window.open('','_blank','width=700,height=800');
    w.document.write(`<pre>${title}\n\n${list.join('\n')}</pre>`);
    w.print();
  });
}

function openPrintMenu(dStr){
  // simple popup proposant les 3 impressions
  modalContent.innerHTML = `<h3>Imprimer - ${dStr}</h3>
    <div style="display:flex;gap:8px;flex-direction:column">
      <button id="pveg">Végétarien (${countFor(dStr,'veg')})</button>
      <button id="p1">11:45 (${countFor(dStr,'11:45')})</button>
      <button id="p2">12:30 (${countFor(dStr,'12:30')})</button>
    </div>
    <div style="margin-top:12px; display:flex; justify-content:flex-end">
      <button id="pClose">Fermer</button>
    </div>`;
  modalBack.style.display='flex';
  document.getElementById('pveg').addEventListener('click',()=>{ modalBack.style.display='none'; openListModal(dStr,'veg') });
  document.getElementById('p1').addEventListener('click',()=>{ modalBack.style.display='none'; openListModal(dStr,'11:45') });
  document.getElementById('p2').addEventListener('click',()=>{ modalBack.style.display='none'; openListModal(dStr,'12:30') });
  document.getElementById('pClose').addEventListener('click', ()=> modalBack.style.display='none');
}

/* ---------- events ---------- */
function wireEvents(){
  // autocomplete
  nameInput.addEventListener('input', onNameInput);
  nameInput.addEventListener('focus', onNameInput);
  addNameBtn.addEventListener('click', ()=> {
    const val = nameInput.value.trim();
    if (!val) return alert('Nom vide');
    const existing = state.names.find(n => n.name.toLowerCase() === val.toLowerCase());
    if (existing){
      selectName(existing.id);
      return;
    }
    // create id
    const id = 'u-' + Date.now();
    const obj = { id, name: val };
    state.names.push(obj);
    saveNamesToLocal();
    selectName(id);
    alert('Nom ajouté localement.');
  });

  saveBtn.addEventListener('click', async ()=>{
    // save locally
    saveReservationsToStorage();
    // optionally push to GitHub
    if (CONFIG.github.enabled){
      const token = prompt('Token GitHub (utiliser un token personnel avec repo:contents scope). Ne rien mettre pour ignorer.');
      if (token){
        try {
          await pushReservationsToGitHub(token);
          alert('Fichier poussé sur GitHub.');
        } catch(e){
          alert('Erreur push GitHub: ' + e.message);
        }
      }
    }
  });

  // close modal on click outside
  modalBack.addEventListener('click', (e)=>{ if (e.target === modalBack) modalBack.style.display='none'; });
}

/* ---------- autocomplete UI ---------- */
function onNameInput(){
  const q = nameInput.value.trim().toLowerCase();
  if (!q || q.length < 1) {
    renderAc([]);
    return;
  }
  const hits = state.names.filter(n => n.name.toLowerCase().includes(q)).slice(0,30);
  renderAc(hits);
}
function renderAc(list){
  if (!list || list.length===0){ acList.style.display='none'; acList.innerHTML=''; return; }
  acList.style.display='block';
  acList.innerHTML = list.map(n=>`<div class="ac-item" data-id="${n.id}">${n.name}</div>`).join('');
  Array.from(acList.querySelectorAll('.ac-item')).forEach(el=>{
    el.addEventListener('click', ()=> {
      selectName(el.dataset.id);
      acList.style.display='none';
    });
  });
}
function selectName(id){
  const user = state.names.find(n=>n.id===id);
  if (!user) return;
  state.selectedNameId = id;
  nameInput.value = user.name;
  localStorage.setItem('cantine-last-name-id', id);
  lastNameSpan.textContent = user.name;
}

/* ---------- push to GitHub (optionnel) ---------- */
async function pushReservationsToGitHub(token){
  // prepare content
  const path = `data/reservations-${state.month}.json`;
  const content = JSON.stringify(state.reservations, null, 2);
  // get existing file to obtain sha
  const url = `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/contents/${path}`;
  const headers = { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' };

  // check existing
  let sha = null;
  try {
    const r = await fetch(url + `?ref=${CONFIG.github.branch}`, { headers });
    if (r.ok){
      const js = await r.json();
      sha = js.sha;
    }
  } catch(e){ /* ignore */ }

  // create/update
  const body = {
    message: `Mise à jour réservations ${state.month}`,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: CONFIG.github.branch
  };
  if (sha) body.sha = sha;
  const resp = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!resp.ok) throw new Error('GitHub API error: ' + resp.status);
  return await resp.json();
}

/* ---------- helper: push generic file (not used directly) ---------- */
async function pushToGitHubFile(token, path, content, commitMessage='update file'){
  // same idea as above
  const url = `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/contents/${path}`;
  const headers = { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' };
  let sha = null;
  try {
    const r = await fetch(url + `?ref=${CONFIG.github.branch}`, { headers });
    if (r.ok){
      const js = await r.json();
      sha = js.sha;
    }
  } catch(e){}
  const body = { message: commitMessage, content: btoa(unescape(encodeURIComponent(content))), branch: CONFIG.github.branch };
  if (sha) body.sha = sha;
  const resp = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!resp.ok) throw new Error('GitHub API error: ' + resp.status);
  return await resp.json();
}

/* ---------- update status text ---------- */
function updateStatus(){
  if (state.dirty) {
    statusText.textContent = 'Modifications non enregistrées';
    statusText.style.color = 'var(--danger)';
  } else {
    statusText.textContent = 'Enregistré';
    statusText.style.color = 'var(--muted)';
  }
}

/* ---------- utility: get user by name input (on blur maybe) ---------- */
// when the user presses Enter in nameInput, try to select
nameInput.addEventListener('keydown', (e)=>{
  if (e.key === 'Enter'){
    const val = nameInput.value.trim();
    const existing = state.names.find(n => n.name.toLowerCase() === val.toLowerCase());
    if (existing) selectName(existing.id);
    else {
      // create
      const id = 'u-' + Date.now();
      const obj = { id, name: val };
      state.names.push(obj);
      saveNamesToLocal();
      selectName(id);
      alert('Nom ajouté localement.');
    }
    acList.style.display='none';
  }
});

// On load, set last name into selection if any
// Also handle clicking outside to close acList
document.addEventListener('click', (e)=>{
  if (!e.target.closest('.name-select')) acList.style.display='none';
});
