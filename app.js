// app.js (module)
const isSelected = btn1230.classList.contains('selected');
btn1145.classList.remove('selected'); btn1230.classList.remove('selected');
if(isSelected){ toggleReservation(dt,'t1230', selectedNameId, false);} else { btn1230.classList.add('selected'); toggleReservation(dt,'t1145', selectedNameId, false); toggleReservation(dt,'t1230', selectedNameId, true);}
p1145.querySelector('.count').textContent = getListFor(dt,'t1145').length;
p1230.querySelector('.count').textContent = getListFor(dt,'t1230').length;
markUnsaved(true);
//});


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
