// ---------------------
// CHARGEMENT URL & MOIS
// ---------------------
const urlParams = new URLSearchParams(window.location.search);
const monthParam = urlParams.get("month") || "2025-01";
document.getElementById("month-title").textContent = monthParam;

// ---------------------
// NOMS
// ---------------------
const nameInput = document.getElementById("name-input");
const autocomplete = document.getElementById("autocomplete-list");
let names = [];
let selectedNameId = null;

// Chargement JSON
async function loadNames() {
    const res = await fetch("names.json");
    names = await res.json();

    const last = localStorage.getItem("lastName");
    if (last) {
        const found = names.find(n => n.id === last);
        if (found) {
            nameInput.value = found.name;
            selectedNameId = found.id;
        }
    }
}

// Autocomplétion
nameInput.addEventListener("input", () => {
    const txt = nameInput.value.toLowerCase();
    autocomplete.innerHTML = "";
    if (txt.length < 3) {
        autocomplete.style.display = "none";
        return;
    }
    const results = names.filter(n => n.name.toLowerCase().includes(txt));
    results.forEach(r => {
        const div = document.createElement("div");
        div.textContent = r.name;
        div.onclick = () => {
            nameInput.value = r.name;
            selectedNameId = r.id;
            localStorage.setItem("lastName", r.id);
            autocomplete.style.display = "none";
        };
        autocomplete.appendChild(div);
    });
    autocomplete.style.display = results.length ? "block" : "none";
});

// Ajout de nom
async function ensureNameExists() {
    const entered = nameInput.value.trim();
    let existing = names.find(n => n.name.toLowerCase() === entered.toLowerCase());
    if (existing) return existing.id;

    const newId = "id-" + Date.now();
    names.push({ id: newId, name: entered });

    await fetch("names.json", {
        method: "PUT",
        body: JSON.stringify(names, null, 2)
    });

    return newId;
}

// ---------------------
// CALENDRIER
// ---------------------
const calendar = document.getElementById("calendar");
const today = new Date();
const thisMonth = new Date(monthParam + "-01");
const reservationsFile = `reservations-${monthParam}.json`;

let reservations = {};

// Charger réservations si fichier existe
async function loadReservations() {
    try {
        const res = await fetch(reservationsFile);
        reservations = await res.json();
    } catch {
        reservations = {};
    }
}

function buildCalendar() {
    calendar.innerHTML = "";

    const month = new Date(monthParam + "-01");
    const year = month.getFullYear();
    const m = month.getMonth();

    const firstDay = new Date(year, m, 1).getDay() || 7;
    const daysInMonth = new Date(year, m + 1, 0).getDate();

    // Ligne d'en-tête
    const header = document.createElement("div");
    header.className = "week-row";
    ["Lun","Mar","Mer","Jeu","Ven"].forEach(d => {
        const cell = document.createElement("div");
        cell.className = "day-cell";
        cell.textContent = d;
        header.appendChild(cell);
    });
    calendar.appendChild(header);

    let row = document.createElement("div");
    row.className = "week-row";

    // Jours vides avant le 1
    for (let i=1; i<firstDay; i++) {
        const empty = document.createElement("div");
        empty.className = "day-cell";
        row.appendChild(empty);
    }

    for (let day=1; day<=daysInMonth; day++) {
        const cell = document.createElement("div");
        cell.className = "day-cell";

        const date = new Date(year, m, day);

        // Désactivation jour passé ou après 10h pour aujourd'hui
        if (date < new Date(today.getFullYear(), today.getMonth(), today.getDate()) ||
            (date.toDateString() === today.toDateString() && today.getHours() >= 10)) {
            cell.classList.add("disabled");
        }

        // Jour aujourd’hui = surligné + bouton impression
        if (date.toDateString() === today.toDateString()) {
            cell.style.background = "#fff7d9";
            const print = document.createElement("div");
            print.className = "print-btn";
            print.textContent = "🖨️";
            print.style.display = "block";
            print.onclick = () => printLists(day);
            cell.appendChild(print);
        }

        // Numéro du jour
        const number = document.createElement("div");
        number.textContent = day;
        number.style.fontWeight = "bold";
        cell.appendChild(number);

        // VÉGÉTARIEN
        const veg = document.createElement("div");
        veg.className = "clickable";
        veg.innerHTML = "🥗 Végétarien ";
        const vegCount = document.createElement("span");
        vegCount.className = "counter";

        let vegList = reservations[day]?.veg || [];
        vegCount.textContent = vegList.length;

        const vegPicto = document.createElement("span");
        vegPicto.className = "picto";
        vegPicto.textContent = "👤";

        // ajout visuel si inscrit
        function refreshVeg() {
            veg.classList.toggle("selected", vegList.includes(selectedNameId));
            vegCount.textContent = vegList.length;
        }

        veg.onclick = () => {
            if (!selectedNameId) return;
            if (vegList.includes(selectedNameId)) {
                vegList = vegList.filter(x => x !== selectedNameId);
            } else {
                vegList.push(selectedNameId);
            }
            reservations[day] = reservations[day] || {};
            reservations[day].veg = vegList;
            refreshVeg();
            edited();
        };

        vegPicto.onclick = (e) => {
            e.stopPropagation();
            alert("Végétariens inscrits :\n" + vegList.map(id => names.find(n=>n.id===id)?.name).join("\n"));
        };

        veg.appendChild(vegCount);
        veg.appendChild(vegPicto);
        cell.appendChild(veg);
        refreshVeg();

        // HORAIRES
        ["11:45","12:30"].forEach(time => {
            const wrap = document.createElement("div");
            wrap.className = "time-option";

            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "time-" + day;
            radio.value = time;

            if (reservations[day]?.time === time && reservations[day]?.id === selectedNameId) {
                wrap.classList.add("selected");
                radio.checked = true;
            }

            radio.onclick = () => {
                reservations[day] = reservations[day] || {};
                reservations[day].time = time;
                reservations[day].id = selectedNameId;
                updateTimeVisual(day, time);
                edited();
            };

            const timeLabel = document.createElement("span");
            timeLabel.textContent = time;

            const picto = document.createElement("span");
            picto.className = "picto";
            picto.textContent = "👤";

            const count = document.createElement("span");
            count.className = "counter";

            function refreshCount() {
                const all = Object.values(reservations).filter(r => r.time === time);
                count.textContent = all.length;
            }
            refreshCount();

            picto.onclick = (e) => {
                e.stopPropagation();
                const list = Object.entries(reservations)
                    .filter(([d,r]) => r.time === time)
                    .map(([d,r]) => names.find(n=>n.id===r.id)?.name);

                alert(`Réservés à ${time} :\n${list.join("\n")}`);
            };

            wrap.appendChild(radio);
            wrap.appendChild(timeLabel);
            wrap.appendChild(count);
            wrap.appendChild(picto);
            cell.appendChild(wrap);
        });

        row.appendChild(cell);

        if (row.children.length === 5) {
            calendar.appendChild(row);
            row = document.createElement("div");
            row.className = "week-row";
        }
    }

    // Dernière ligne
    if (row.children.length > 0)
        calendar.appendChild(row);
}

// Met en surbrillance la ligne horaire sélectionnée
function updateTimeVisual(day, time) {
    const rows = document.querySelectorAll(`[name="time-${day}"]`);
    rows.forEach(r => r.parentElement.classList.remove("selected"));
    const selected = document.querySelector(`[name="time-${day}"][value="${time}"]`);
    if (selected) selected.parentElement.classList.add("selected");
}

// ---------------------
// SAUVEGARDE
// ---------------------
let savedHash = "";
function edited() {
    document.getElementById("save-status").textContent = "Modifications non enregistrées";
}

async function save() {
    if (!selectedNameId) selectedNameId = await ensureNameExists();

    await fetch(reservationsFile, {
        method: "PUT",
        body: JSON.stringify(reservations, null, 2)
    });

    document.getElementById("save-status").textContent = "Enregistré ✔️";
}

document.getElementById("validate-btn").onclick = save;

// Impression
function printLists(day) {
    const veg = reservations[day]?.veg || [];
    const t1145 = Object.entries(reservations).filter(([d,r]) => r.time === "11:45");
    const t1230 = Object.entries(reservations).filter(([d,r]) => r.time === "12:30");

    const text =
`Jour ${day}
---
Végétariens :
${veg.map(id=>names.find(n=>n.id===id)?.name).join("\n")}

11:45 :
${t1145.map(([d,r])=>names.find(n=>n.id===r.id)?.name).join("\n")}

12:30 :
${t1230.map(([d,r])=>names.find(n=>n.id===r.id)?.name).join("\n")}
`;

    const w = window.open("");
    w.document.write("<pre>" + text + "</pre>");
    w.print();
    w.close();
}

// ---------------------
// INIT
// ---------------------
(async function() {
    await loadNames();
    await loadReservations();
    buildCalendar();
})();
