/* ---------------------- app.js ----------------------
Copiez ce bloc dans le fichier app.js à la racine du repo.
*/

// app.js (module)
const ROOT = document.getElementById('app');
const monthTitle = document.getElementById('monthTitle');
const nameInput = document.getElementById('nameInput');
const suggestBox = document.getElementById('suggestBox');
const addNameBtn = document.getElementById('addNameBtn');
const weekdaysRow = document.getElementById('weekdaysRow');
const calendarGrid = document.getElementById('calendarGrid');
const statusText = document.getElementById('statusText');
const saveBtn = document.getElementById('saveBtn');
const modalRoot = document.getElementById('modalRoot');
const modalTitle = document.getElementById('modalTitle');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');

// Config
const NAMES_JSON = 'names.json'; // placé dans le repo
const WORK_DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi'];

// State
let names = []; // {id, name}
let reservations = {}; // per-month structure loaded from localStorage or fetched
let currentMonth; // YYYY-MM
let selectedNameId = null;
let unsaved = false;

// Utility
const uid = ()=>crypto.randomUUID();
const today = new Date();
const now = new Date();

function formatMonthKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`}
function monthLabel(date){return date.toLocaleString('fr-FR',{month:'long', year:'numeric'})}

// Init
async function init(){
  // read month from URL ?m=2025-12 or ?m=2025-12-01
  const url = new URL(location.href);
  const mArg = url.searchParams.get('m');
  let baseDate = mArg ? new Date(mArg) : new Date();
  if(isNaN(baseDate)) baseDate = new Date();
  currentMonth = formatMonthKey(baseDate);
  monthTitle.textContent = monthLabel(baseDate);

  // load names
  await loadNames();
  setupNameInput();

  // load reservations
  loadReservations();

  // render weekdays header
  renderWeekDays();
  renderCalendar(baseDate);

  // restore last selected name
  const last = localStorage.getItem('cantine.lastNameId');
  if(last && names.find(n=>n.id===last)){
    selectNameById(last);
  }

  updateStatus('Chargé');
}

async function loadNames(){
  // try fetch from repo (names.json)
  try{
    const res = await fetch(NAMES_JSON);
    if(res.ok){
      names = await res.json();
      return;
    }
  }catch(e){console.warn('Impossible de charger names.json', e)}
  // fallback: try from localStorage
  const local = localStorage.getItem('cantine.names');
  if(local) names = JSON.parse(local);
  else names = [];
}

function persistNames(){
  localStorage.setItem('cantine.names', JSON.stringify(names));
}

function setupNameInput(){
  nameInput.addEventListener('input', onNameInput);
  nameInput.addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){
      const v = nameInput.value.trim(); if(!v) return;
      const existing = names.find(n=>n.name.toLowerCase()===v.toLowerCase());
      if(existing) selectNameById(existing.id); else addName(v);
    }
  });
  addNameBtn.addEventListener('click', ()=>{
    const v = nameInput.value.trim(); if(!v) return; addName(v);
  });
}

function onNameInput(e){
  const q = e.target.value.trim().toLowerCase();
  if(q.length<1){suggestBox.style.display='none'; return}
  const list = names.filter(n=>n.name.toLowerCase().includes(q)).slice(0,20);
  if(list.length===0){suggestBox.style.display='none'; return}
  suggestBox.innerHTML='';
  list.forEach(n=>{
    const btn = document.createElement('button'); btn.textContent = n.name;
    btn.addEventListener('click', ()=>selectNameById(n.id));
    suggestBox.appendChild(btn);
  });
  suggestBox.style.display='block';
}

function selectNameById(id){
  const n = names.find(x=>x.id===id); if(!n) return;
  selectedNameId = id; nameInput.value = n.name; suggestBox.style.display='none';
  localStorage.setItem('cantine.lastNameId', id);
}

function addName(label){
  const newOne = {id:uid(), name:label};
  names.push(newOne); persistNames(); selectNameById(newOne.id);
  markUnsaved(true);
  updateStatus('Nom ajouté (non synchronisé)');
}

function loadReservations(){
  const key = `cantine.res.${currentMonth}`;
  const raw = localStorage.getItem(key);
  if(raw) reservations = JSON.parse(raw);
  else reservations = {month: currentMonth, entries:{}};
}

function saveReservations(){
  const key = `cantine.res.${currentMonth}`;
  localStorage.setItem(key, JSON.stringify(reservations));
  markUnsaved(false);
  updateStatus('Enregistré');
}

function markUnsaved(v){ unsaved = v; statusText.textContent = v ? 'Modifications non enregistrées' : 'Toutes les modifications enregistrées'; }
function updateStatus(msg){ statusText.textContent = msg }

function renderWeekDays(){
  weekdaysRow.innerHTML='';
  WORK_DAYS.forEach(d=>{
    const el = document.createElement('div'); el.className='cell'; el.style.textAlign='center'; el.style.fontWeight='600'; el.textContent=d;
    weekdaysRow.appendChild(el);
  });
}

function renderCalendar(baseDate){
  calendarGrid.innerHTML='';
  // get first day of month and number of days
  const year = baseDate.getFullYear(); const month = baseDate.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month+1, 0);
  const daysInMonth = last.getDate();

  // We want a grid Monday-Friday. We will iterate days and create cells for weekdays only.
  for(let d=1; d<=daysInMonth; d++){
    const dt = new Date(year, month, d);
    const dayOfWeek = dt.getDay(); // 0 Sun, 1 Mon ...
    if(dayOfWeek===0 || dayOfWeek===6) continue; // skip weekend
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell = makeCell(dt, key);
    calendarGrid.appendChild(cell);
  }
}

function makeCell(dt, key){
  const cell = document.createElement('div'); cell.className='cell';
  const dayNum = document.createElement('div'); dayNum.className='day-num'; dayNum.textContent = dt.getDate();
  cell.appendChild(dayNum);

  // top-right printer if today
  const tr = document.createElement('div'); tr.className='top-right';
  if(isSameDay(dt, today)){
    const pr = document.createElement('span'); pr.className='printer'; pr.title='Imprimer les inscrits'; pr.innerHTML='🖨️';
    pr.addEventListener('click', ()=>printDayList(keyForDate(dt)));
    tr.appendChild(pr);
  }
  cell.appendChild(tr);

  // veg row
  const vegRow = document.createElement('div'); vegRow.className='veg-row';
  const vegToggleWrap = document.createElement('div'); vegToggleWrap.className='veg-toggle';
  const vegSwitch = document.createElement('div'); vegSwitch.className='switch';
  const knob = document.createElement('div'); knob.className='knob'; vegSwitch.appendChild(knob);
  const vegCountBtn = document.createElement('div'); vegCountBtn.className='person-btn'; vegCountBtn.innerHTML = '<span class="dot">👤</span><span class="count">0</span>';
  vegCountBtn.addEventListener('click', ()=>openListModal('Végétarien ' + keyForDate(dt), getListFor(dt,'veg')));
  vegToggleWrap.appendChild(vegSwitch); vegToggleWrap.appendChild(vegCountBtn);

  // time row
  const timeRow = document.createElement('div'); timeRow.className='time-row';
  const t1145 = document.createElement('div'); t1145.className='radio-wrap';
  const btn1145 = document.createElement('div'); btn1145.className='radio-btn'; btn1145.textContent='11 h 45';
  const p1145 = document.createElement('div'); p1145.className='person-btn'; p1145.innerHTML='<span class="dot">👤</span><span class="count">0</span>';
  p1145.addEventListener('click', ()=>openListModal('11:45 ' + keyForDate(dt), getListFor(dt,'t1145')));
  t1145.appendChild(btn1145); t1145.appendChild(p1145);

  const t1230 = document.createElement('div'); t1230.className='radio-wrap';
  const btn1230 = document.createElement('div'); btn1230.className='radio-btn'; btn1230.textContent='12 h 30';
  const p1230 = document.createElement('div'); p1230.className='person-btn'; p1230.innerHTML='<span class="dot">👤</span><span class="count">0</span>';
  p1230.addEventListener('click', ()=>openListModal('12:30 ' + keyForDate(dt), getListFor(dt,'t1230')));
  t1230.appendChild(btn1230); t1230.appendChild(p1230);

  timeRow.appendChild(t1145); timeRow.appendChild(t1230);
  cell.appendChild(vegRow);
  cell.appendChild(timeRow);

  // handle disabled days
  if(isBeforeToday(dt) || (isSameDay(dt, today) && now.getHours()>=10)){
    cell.classList.add('disabled');
  }

  // restore state if exists
  const entry = reservations.entries?.[keyForDate(dt)];
  if(entry){
    if(entry.veg && entry.veg.includes(selectedNameId)) vegSwitch.classList.add('on');
    if(entry.t=== 't1145') btn1145.classList.add('selected');
    if(entry.t=== 't1230') btn1230.classList.add('selected');
    // counts
    p1145.querySelector('.count').textContent = (entry.t1145 || []).length;
    p1230.querySelector('.count').textContent = (entry.t1230 || []).length;
    vegCountBtn.querySelector('.count').textContent = (entry.veg || []).length;
  }

  // interactions
  vegSwitch.addEventListener('click', ()=>{
    if(!selectedNameId){ alert('Sélectionnez votre nom avant'); return }
    vegSwitch.classList.toggle('on');
    const on = vegSwitch.classList.contains('on');
    toggleReservation(dt, 'veg', selectedNameId, on);
    vegCountBtn.querySelector('.count').textContent = getListFor(dt,'veg').length;
    markUnsaved(true);
  });

  btn1145.addEventListener('click', ()=>{
    if(!selectedNameId){ alert('Sélectionnez votre nom avant'); return }
    // toggle radio
    const isSelected = btn1145.classList.contains('selected');
    // clear both
    btn1145.classList.remove('selected'); btn1230.classList.remove('selected');
    if(isSelected){ // unselect
      toggleReservation(dt, 't1145', selectedNameId, false);
    } else {
      btn1145.classList.add('selected');
      // remove from other time
      toggleReservation(dt,'t1230', selectedNameId, false);
      toggleReservation(dt,'t1145', selectedNameId, true);
    }
    p1145.querySelector('.count').textContent = getListFor(dt,'t1145').length;
    p1230.querySelector('.count').textContent = getListFor(dt,'t1230').length;
    markUnsaved(true);
  });

  btn1230.addEventListener('click', ()=>{
    if(!selectedNameId){ alert('Sélectionnez votre nom avant'); return }
    const isSelected = btn1230.classList.contains('selected');
    btn1145.classList.remove('selected'); btn1230.classList.remove('selected');
    if(isSelected){ toggleReservation(dt,'t1230', selectedNameId, false);} else { btn1230.classList.add('selected'); toggleReservation(dt,'t1145', selectedNameId, false); toggleReservation(dt,'t1230', selectedNameId, true);} 
    p1145.querySelector('.count').textContent = getListFor(dt,'t1145').length;
    p1230.querySelector('.count').textContent = getListFor(dt,'t1230').length;
    markUnsaved(true);
  });

  return cell;
}

function keyForDate(dt){return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`}

function isSameDay(a,b){return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()}
function isBeforeToday(dt){ const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()); return dt < t }

function toggleReservation(dt, field, nameId, add){
  const key = keyForDate(dt);
  reservations.entries = reservations.entries || {};
  reservations.entries[key] = reservations.entries[key] || {veg:[], t1145:[], t1230:[]};
  const arr = field==='veg' ? reservations.entries[key].veg : reservations.entries[key][field];
  if(add){ if(!arr.includes(nameId)) arr.push(nameId); }
  else { const i = arr.indexOf(nameId); if(i>=0) arr.splice(i,1); }
}

function getListFor(dt, field){
  const key = keyForDate(dt);
  const e = reservations.entries?.[key]; if(!e) return [];
  const ids = field==='veg' ? (e.veg||[]) : (e[field]||[]);
  return ids.map(id=>names.find(n=>n.id===id)?.name || id);
}

function openListModal(title, list){
  modalTitle.textContent = title;
  modalContent.innerHTML = list.length ? list.map(n=>`<div style="padding:6px 0">${n}</div>`).join('') : '<div style="color:var(--muted)">Aucun inscrit</div>';
  modalRoot.style.display='flex';
}
modalClose.addEventListener('click', ()=>modalRoot.style.display='none');
modalRoot.addEventListener('click',(e)=>{ if(e.target===modalRoot) modalRoot.style.display='none' });

function printDayList(key){
  const e = reservations.entries?.[key]; if(!e){ alert('Aucun inscrit'); return }
  const veg = (e.veg||[]).map(id=>names.find(n=>n.id===id)?.name).join('\n');
  const t1 = (e.t1145||[]).map(id=>names.find(n=>n.id===id)?.name).join('\n');
  const t2 = (e.t1230||[]).map(id=>names.find(n=>n.id===id)?.name).join('\n');
  const win = window.open('', '_blank');
  win.document.write(`<pre>Végétarien (${(e.veg||[]).length}):\n${veg}\n\n11:45 (${(e.t1145||[]).length}):\n${t1}\n\n12:30 (${(e.t1230||[]).length}):\n${t2}</pre>`);
  win.print();
}

saveBtn.addEventListener('click', ()=>{
  saveReservations();
});

// Simple init call
init();

// Accessibility / extra: close suggestions on click outside
document.addEventListener('click', (e)=>{ if(!e.target.closest('.combobox')) suggestBox.style.display='none' });
