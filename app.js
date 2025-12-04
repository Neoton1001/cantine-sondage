// app.js (module)
const MONTH_PARAM = 'month'; // attend format YYYY-MM (ex: 2025-12). Si absent => mois courant
const NAMES_FILE = './names.json';
const STORAGE_PREFIX = 'cantine_BOOKINGS_'; // + YYYY-MM
const NAMES_ADDED_KEY = 'cantine_NAMES_ADDED';
const LAST_NAME_KEY = 'cantine_LAST_NAME';

const monthsFR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const weekdaysFR = ["lundi","mardi","mercredi","jeudi","vendredi"];

const monthTitleEl = document.getElementById('monthTitle');
const weekdaysEl = document.getElementById('weekdays');
const gridWeeksEl = document.getElementById('gridWeeks');
const nameInput = document.getElementById('nameInput');
const autocompleteEl = document.getElementById('autocomplete');
const addNameBtn = document.getElementById('addNameBtn');
const validateBtn = document.getElementById('validateBtn');
const statusMsg = document.getElementById('statusMsg');
const modalRoot = document.getElementById('modalRoot');

let state = {
  year: null,
  month: null, // 1..12
  bookings: {}, // date (YYYY-MM-DD) -> { veg: [names], slots: { "11:45": [names], "12:30": [names] } }
  namesAll: [], // merged from names.json + local additions
  unsaved: false
};

// helpers
function qparams(){ return new URLSearchParams(location.search); }
function pad(n){ return n<10 ? '0'+n : ''+n; }
function yyyy_mm(year,month){ return `${year}-${pad(month)}`; }
function dateKey(d){ // Date -> YYYY-MM-DD
  return d.toISOString().split('T')[0];
}
function parseMonthParam(){
  const p = qparams().get(MONTH_PARAM);
  if(!p) {
    const now=new Date();
    return {year:now.getFullYear(), month:now.getMonth()+1};
  }
  // accept YYYY-MM or MM-YYYY
  const parts = p.split('-');
  if(parts.length===2){
    if(parts[0].length===4){
      const y = parseInt(parts[0],10);
      const m = parseInt(parts[1],10);
      if(!isNaN(y)&&!isNaN(m)) return {year:y, month:m};
    } else if(parts[1].length===4){
      const m = parseInt(parts[0],10);
      const y = parseInt(parts[1],10);
      if(!isNaN(y)&&!isNaN(m)) return {year:y, month:m};
    }
  }
  // fallback current month
  const now=new Date();
  return {year:now.getFullYear(), month:now.getMonth()+1};
}

function setStatus(text, saved=false){
  statusMsg.textContent = text;
  statusMsg.style.color = saved ? 'green' : 'orange';
}

// load initial names.json then init
async function loadInitialNames(){
  let baseNames = [];
  try{
    const res = await fetch(NAMES_FILE);
    if(res.ok){
      baseNames = await res.json();
    } else {
      console.warn('names.json non trouvé (status:', res.status, ')');
    }
  }catch(e){
    console.warn('Impossible de charger names.json :', e);
  }
  const added = JSON.parse(localStorage.getItem(NAMES_ADDED_KEY) || '[]');
  state.namesAll = Array.from(new Set([...(baseNames||[]), ...added]));
  state.namesAll.sort((a,b)=>a.localeCompare(b,'fr'));
}

// build calendar grid
function buildCalendar(){
  monthTitleEl.textContent = `${monthsFR[state.month-1]} ${state.year}`;
  // weekdays
  weekdaysEl.innerHTML = '';
  for(const d of weekdaysFR){
    const w = document.createElement('div');
    w.textContent = d;
    weekdaysEl.appendChild(w);
  }

  // compute first Monday on or before 1st of month, and last Friday on or after last day
  const firstOfMonth = new Date(state.year, state.month-1, 1);
  // find first Monday >= 1? We want rows containing days of month but only Mon-Fri columns.
  // We'll iterate days from 1..lastDay and place them into grid with columns Mon..Fri.
  const lastDay = new Date(state.year, state.month, 0).getDate();

  // Build cells array in order Monday->Friday by week.
  const cells = [];
  // Determine weekday index of first day (0=Sun..6=Sat). We need Monday=1.
  for(let d=1; d<=lastDay; d++){
    const dt = new Date(state.year, state.month-1, d);
    const dayOfWeek = dt.getDay(); // Sun=0
    if(dayOfWeek === 0 || dayOfWeek === 6){
      // weekend: ignore but keep placeholder empty cell? Spec: calendar shows only Mon-Fri columns and "nombre de lignes nécessaire".
      // So skip weekends entirely.
      continue;
    }
    cells.push({date: dt, day: d});
  }

  // how many rows? rows = ceil(cells.length / 5) but weekdays can have holes at start/end; simpler: render cells sequentially into grid with 5 columns
  const rows = Math.ceil(cells.length / 5);
  gridWeeksEl.innerHTML = '';
  // create exactly rows*5 slots; fill with cells or empty placeholders
  const totalSlots = rows*5;
  let idx = 0;
  for(let s=0; s<totalSlots; s++){
    const slot = document.createElement('div');
    if(cells[idx]){
      const {date, day} = cells[idx];
      slot.className = 'day-cell';
      slot.dataset.date = dateKey(date);
      buildDayCell(slot, date, day);
      idx++;
    } else {
      slot.className = 'day-cell disabled';
      slot.innerHTML = '';
    }
    gridWeeksEl.appendChild(slot);
  }
}

// build one day cell DOM
function buildDayCell(el, date, dayNumber){
  const ymd = dateKey(date);
  // header
  const header = document.createElement('div');
  header.className = 'day-header';
  const left = document.createElement('div');
  left.innerHTML = `<div class="day-number">${dayNumber}</div>`;
  const right = document.createElement('div');
  const printBtn = document.createElement('button');
  printBtn.className = 'print-btn';
  printBtn.title = 'Imprimer les listes pour ce jour';
  printBtn.innerHTML = '&#128424;'; // printer emoji
  printBtn.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    openPrintWindowForDate(ymd);
  });
  right.appendChild(printBtn);
  header.appendChild(left);
  header.appendChild(right);
  el.appendChild(header);

  // Vegetarian line
  const vegLine = document.createElement('div');
  vegLine.className = 'veg-line';
  const vegLeft = document.createElement('div');
  vegLeft.className = 'veg-left';

  const vegCheckbox = document.createElement('input');
  vegCheckbox.type = 'checkbox';
  vegCheckbox.dataset.type = 'veg';
  vegCheckbox.dataset.date = ymd;

  const vegLabel = document.createElement('label');
  vegLabel.textContent = 'Menu végétarien';

  vegLeft.appendChild(vegCheckbox);
  vegLeft.appendChild(vegLabel);

  const vegRight = document.createElement('div');
  vegRight.className = 'counts';
  const vegPersonBtn = document.createElement('button');
  vegPersonBtn.className = 'person-btn';
  vegPersonBtn.title = 'Voir la liste des inscrits végétariens';
  vegPersonBtn.innerHTML = `<span>👤</span><span class="count" data-count-for="${ymd}-veg">0</span>`;
  vegPersonBtn.addEventListener('click', ()=> openListModal(ymd, 'veg'));
  vegRight.appendChild(vegPersonBtn);

  vegLine.appendChild(vegLeft);
  vegLine.appendChild(vegRight);
  el.appendChild(vegLine);

  // slots lines (two radio options and person button each)
  const slots = ["11:45","12:30"];
  const slotsContainer = document.createElement('div');
  slotsContainer.style.display = 'grid';
  slotsContainer.style.gridTemplateColumns = '1fr 1fr';
  slotsContainer.style.gap = '6px';

  slots.forEach(slotTime=>{
    const slotDiv = document.createElement('div');
    slotDiv.className = 'slot-line';
    slotDiv.style.justifyContent = 'space-between';

    // left: radio + label
    const left = document.createElement('div');
    const r = document.createElement('input');
    r.type = 'radio';
    r.name = `slot-${ymd}`; // same name to ensure single selection per day
    r.dataset.slot = slotTime;
    r.dataset.date = ymd;
    left.appendChild(r);
    const lab = document.createElement('label');
    lab.textContent = slotTime;
    left.appendChild(lab);

    // right: person button with count
    const right = document.createElement('div');
    const personBtn = document.createElement('button');
    personBtn.className = 'person-btn';
    personBtn.innerHTML = `<span>👤</span><span class="count" data-count-for="${ymd}-${slotTime}">0</span>`;
    personBtn.addEventListener('click', ()=> openListModal(ymd, slotTime));
    right.appendChild(personBtn);

    slotDiv.appendChild(left);
    slotDiv.appendChild(right);
    slotsContainer.appendChild(slotDiv);

    // add change listeners
    r.addEventListener('change', (e)=>{
      handleSlotToggle(ymd, slotTime, e.target.checked);
    });
  });

  el.appendChild(slotsContainer);

  // disabled logic for past dates / today after 10:00
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const isPast = target < today;
  let isDisabled = isPast;
  if(!isPast){
    // today: if after 10:00, disable
    if(target.getTime() === today.getTime()){
      const hour = now.getHours();
      const minute = now.getMinutes();
      if(hour > 10 || (hour === 10 && minute >= 0)){
        isDisabled = true;
      }
    }
  }
  if(isDisabled){
    el.classList.add('disabled');
  }

  // set states (checkboxes, counts) from bookings
  refreshCellState(ymd);

  // attach event for veg checkbox
  vegCheckbox.addEventListener('change', (e)=>{
    const checked = e.target.checked;
    handleVegToggle(ymd, checked);
  });
}

// load bookings from localStorage for current month
function loadBookings(){
  const key = STORAGE_PREFIX + yyyy_mm(state.year,state.month);
  const raw = localStorage.getItem(key);
  if(raw){
    try{
      state.bookings = JSON.parse(raw);
    }catch(e){ state.bookings = {}; }
  }else{
    state.bookings = {};
  }
}

// save bookings to storage
function saveBookings(){
  const key = STORAGE_PREFIX + yyyy_mm(state.year,state.month);
  localStorage.setItem(key, JSON.stringify(state.bookings));
  state.unsaved = false;
  setStatus('Enregistré', true);
  // persist last name if present
  const name = nameInput.value.trim();
  if(name) localStorage.setItem(LAST_NAME_KEY, name);
}

// refresh counts and check/radio states for a cell
function refreshCellState(ymd){
  // find cell element
  const el = gridWeeksEl.querySelector(`[data-date="${ymd}"]`);
  if(!el) return;
  // data object
  const data = state.bookings[ymd] || { veg: [], slots: {"11:45":[], "12:30":[] } };

  // veg checkbox and count
  const vegCb = el.querySelector('input[type="checkbox"][data-type="veg"]');
  const vegCountSpan = el.querySelector(`[data-count-for="${ymd}-veg"]`);
  const userName = nameInput.value.trim();
  if(vegCb) vegCb.checked = data.veg.includes(userName);
  if(vegCountSpan) vegCountSpan.textContent = data.veg.length;

  // radios & counts
  ["11:45","12:30"].forEach(slot=>{
    const radio = el.querySelector(`input[type="radio"][data-slot="${slot}"]`);
    if(radio){
      radio.checked = (data.slots && data.slots[slot] && data.slots[slot].includes(userName));
    }
    const span = el.querySelector(`[data-count-for="${ymd}-${slot}"]`);
    if(span) span.textContent = (data.slots && data.slots[slot]) ? data.slots[slot].length : 0;
  });
}

// toggle veg for current user
function handleVegToggle(ymd, checked){
  const name = nameInput.value.trim();
  if(!name) { alert('Sélectionne un nom d\'abord'); // small guard
    // revert UI by refreshing
    refreshCellState(ymd);
    return;
  }
  if(!state.bookings[ymd]) state.bookings[ymd] = { veg: [], slots: {"11:45":[], "12:30":[] } };
  const arr = state.bookings[ymd].veg;
  const idx = arr.indexOf(name);
  if(checked){
    if(idx === -1) arr.push(name);
  } else {
    if(idx !== -1) arr.splice(idx,1);
  }
  markUnsaved();
  refreshCellState(ymd);
}

// toggle slot selection (radio)
function handleSlotToggle(ymd, slotTime, isChecked){
  const name = nameInput.value.trim();
  if(!name) { alert('Sélectionne un nom d\'abord'); // revert
    // find radio and uncheck
    setTimeout(()=>refreshCellState(ymd), 10);
    return;
  }
  if(!state.bookings[ymd]) state.bookings[ymd] = { veg: [], slots: {"11:45":[], "12:30":[] } };
  // remove from both slots first (ensure single)
  ["11:45","12:30"].forEach(s=>{
    const idx = state.bookings[ymd].slots[s].indexOf(name);
    if(idx !== -1) state.bookings[ymd].slots[s].splice(idx,1);
  });
  if(isChecked){
    // add to selected
    state.bookings[ymd].slots[slotTime].push(name);
  }
  markUnsaved();
  refreshCellState(ymd);
}

// mark unsaved and update status
function markUnsaved(){
  state.unsaved = true;
  setStatus('Modifications non enregistrées', false);
}

// open modal listing names for a date and category
function openListModal(ymd, category){
  const data = state.bookings[ymd] || { veg: [], slots: {"11:45":[], "12:30":[] } };
  let list = [];
  let title = '';
  if(category === 'veg'){
    list = data.veg || [];
    title = `Inscrits menu végétarien - ${ymd}`;
  } else {
    list = (data.slots && data.slots[category]) || [];
    title = `Inscrits ${category} - ${ymd}`;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong>${title}</strong>
        <button id="closeModalBtn">Fermer</button>
      </div>
      <div id="modalListArea">
        ${list.length ? `<ol>${list.map(n=>`<li>${escapeHtml(n)}</li>`).join('')}</ol>` : '<em>Aucun inscrit</em>'}
      </div>
    </div>
  `;
  modalRoot.innerHTML = '';
  modalRoot.style.display = 'block';
  modalRoot.appendChild(modal);

  document.getElementById('closeModalBtn').addEventListener('click', ()=> closeModal());
  modal.addEventListener('click', (e)=>{ if(e.target === modal) closeModal(); });
}

function closeModal(){
  modalRoot.innerHTML = '';
  modalRoot.style.display = 'none';
}

// print lists for a date: veg, 11:45, 12:30 as three sections
function openPrintWindowForDate(ymd){
  const data = state.bookings[ymd] || { veg: [], slots: {"11:45":[], "12:30":[] } };
  const html = `
    <html><head><title>Listes ${ymd}</title>
      <meta charset="utf-8" />
      <style>body{font-family:Arial,Helvetica,sans-serif;padding:20px} h2{margin-top:18px}</style>
    </head>
    <body>
      <h1>Listes d'inscrits - ${ymd}</h1>
      <h2>Menu végétarien (${data.veg.length})</h2>
      ${data.veg.length? '<ol>' + data.veg.map(n=>`<li>${escapeHtml(n)}</li>`).join('') + '</ol>' : '<em>Aucun inscrit</em>'}
      <h2>11:45 (${(data.slots["11:45"]||[]).length})</h2>
      ${(data.slots["11:45"]||[]).length ? '<ol>' + (data.slots["11:45"]||[]).map(n=>`<li>${escapeHtml(n)}</li>`).join('') + '</ol>' : '<em>Aucun inscrit</em>'}
      <h2>12:30 (${(data.slots["12:30"]||[]).length})</h2>
      ${(data.slots["12:30"]||[]).length ? '<ol>' + (data.slots["12:30"]||[]).map(n=>`<li>${escapeHtml(n)}</li>`).join('') + '</ol>' : '<em>Aucun inscrit</em>'}
    </body></html>
  `;
  const w = window.open('', '_blank');
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.print();
}

// escape helper
function escapeHtml(s){
  return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

// autocomplete behavior
function showAutocompleteFor(prefix){
  const p = prefix.trim().toLowerCase();
  if(p.length < 3){
    autocompleteEl.style.display = 'none';
    return;
  }
  const matches = state.namesAll.filter(n => n.toLowerCase().includes(p)).slice(0,50);
  if(matches.length === 0) {
    autocompleteEl.style.display = 'none';
    return;
  }
  autocompleteEl.innerHTML = '';
  matches.forEach(m=>{
    const div = document.createElement('div');
    div.textContent = m;
    div.addEventListener('click', ()=> {
      nameInput.value = m;
      autocompleteEl.style.display = 'none';
      onNameChanged();
    });
    autocompleteEl.appendChild(div);
  });
  autocompleteEl.style.display = 'block';
}

// when selected/typed name changes
function onNameChanged(){
  const last = nameInput.value.trim();
  if(last) localStorage.setItem(LAST_NAME_KEY, last);
  // refresh all cells check/radio according to this user
  gridWeeksEl.querySelectorAll('.day-cell').forEach(cell=>{
    const ymd = cell.dataset.date;
    refreshCellState(ymd);
  });
}

// Add name button: if text not found, add to local storage list
function handleAddName(){
  const name = nameInput.value.trim();
  if(!name) return;
  // if not present, add to NAMES_ADDED
  if(!state.namesAll.includes(name)){
    const added = JSON.parse(localStorage.getItem(NAMES_ADDED_KEY) || '[]');
    added.push(name);
    localStorage.setItem(NAMES_ADDED_KEY, JSON.stringify(Array.from(new Set(added))));
    state.namesAll.push(name);
    state.namesAll.sort((a,b)=>a.localeCompare(b,'fr'));
  }
  onNameChanged();
}

// init
async function init(){
  const m = parseMonthParam();
  state.year = m.year; state.month = m.month;
  await loadInitialNames();
  // restore last selected name
  const last = localStorage.getItem(LAST_NAME_KEY);
  if(last) nameInput.value = last;

  loadBookings();
  buildCalendar();
  // hide autocomplete when clicking outside
  document.addEventListener('click', (e)=>{
    if(!autocompleteEl.contains(e.target) && e.target !== nameInput) autocompleteEl.style.display = 'none';
  });

  // name input listeners
  nameInput.addEventListener('input', (e)=> {
    showAutocompleteFor(e.target.value);
  });
  nameInput.addEventListener('change', onNameChanged);
  addNameBtn.addEventListener('click', ()=> {
    handleAddName();
    setTimeout(()=>{ autocompleteEl.style.display='none'; }, 100);
  });

  // validate button
  validateBtn.addEventListener('click', ()=>{
    // when validating, we also persist newly added name if not already present
    const name = nameInput.value.trim();
    if(name && !state.namesAll.includes(name)){
      const added = JSON.parse(localStorage.getItem(NAMES_ADDED_KEY) || '[]');
      added.push(name);
      localStorage.setItem(NAMES_ADDED_KEY, JSON.stringify(Array.from(new Set(added))));
      state.namesAll.push(name);
      state.namesAll.sort((a,b)=>a.localeCompare(b,'fr'));
    }
    saveBookings();
  });

  // when we change month via URL (rare), could re-init; but keeping simple
  setStatus('Chargé', true);
}

// when name changes (typing) refresh counts etc
nameInput.addEventListener('blur', ()=> setTimeout(()=>{ autocompleteEl.style.display='none'; }, 150));
nameInput.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){
    e.preventDefault();
    handleAddName();
  }
});

// on beforeunload warn if unsaved
window.addEventListener('beforeunload', (e)=>{
  if(state.unsaved){
    e.preventDefault();
    e.returnValue = '';
  }
});

// when bookings change externally in localStorage (multi-tab), reload
window.addEventListener('storage', (e)=>{
  if(e.key === (STORAGE_PREFIX + yyyy_mm(state.year,state.month))){
    loadBookings();
    // refresh cells
    gridWeeksEl.querySelectorAll('.day-cell').forEach(cell=>{
      refreshCellState(cell.dataset.date);
    });
  }
});

init();
