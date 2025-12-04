/* ============================================================
   CONFIGURATION / STOCKAGE LOCAL
   ============================================================ */

// KEY du localStorage
const STORAGE_KEY = "reservationsCantine";

// Exemple de structure locale si vide
let data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
    names: ["Alice", "Bruno", "Céline"],
    reservations: {}
};

// Sauvegarde
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ============================================================
   1. RÉCUPÉRATION DU MOIS DANS L’URL
   ============================================================ */

const params = new URLSearchParams(window.location.search);
const monthArg = params.get("mois"); // ex: "2025-02"

let currentMonth = monthArg ? new Date(monthArg + "-01") : new Date();
document.getElementById("monthName").textContent =
    currentMonth.toLocaleDateString("fr-FR", { month:"long", year:"numeric" });

/* ============================================================
   2. GESTION LISTE DES NOMS + AUTOCOMPLÉTION
   ============================================================ */

const nameInput = document.getElementById("nameInput");
const autoList = document.getElementById("autoList");

// Charger dernier nom choisi
if (data.lastUsedName) nameInput.value = data.lastUsedName;

nameInput.addEventListener("input", () => {
    const val = nameInput.value.toLowerCase();
    autoList.innerHTML = "";
    if (!val || val.length < 2) { autoList.style.display = "none"; return; }

    const filtered = data.names.filter(n => n.toLowerCase().includes(val));
    if (filtered.length === 0) { autoList.style.display = "none"; return; }

    autoList.style.display = "block";

    filtered.forEach(n => {
        const div = document.createElement("div");
        div.textContent = n;
        div.style.padding = "5px";
        div.style.cursor = "pointer";
        div.onclick = () => { nameInput.value = n; autoList.style.display = "none"; };
        autoList.appendChild(div);
    });
});

/* ============================================================
   3. CONSTRUCTION DU CALENDRIER
   ============================================================ */

const calendarTable = document.getElementById("calendarTable");

const daysName = ["Lun", "Mar", "Mer", "Jeu", "Ven"];

// En-tête
let header = "<tr>";
daysName.forEach(d => header += `<th>${d}</th>`);
header += "</tr>";
calendarTable.innerHTML = header;

// Génération des jours du mois
const year = currentMonth.getFullYear();
const month = currentMonth.getMonth();

let d = new Date(year, month, 1);
let row = document.createElement("tr");

// Décalage début de mois
for (let i = 1; i < (d.getDay() || 7); i++) {
    row.appendChild(document.createElement("td"));
}

// Remplissage jours
while (d.getMonth() === month) {
    const cell = document.createElement("td");
    const day = d.getDate();

    const cellId = `${year}-${month+1}-${day}`;

    // Structure de stockage par jour
    data.reservations[cellId] = data.reservations[cellId] || {
        veg: [],
        h11: [],
        h12: []
    };

    let now = new Date();
    let isPast = d < new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let isToday = (d.toDateString() === now.toDateString());
    let editable = !isPast && !(isToday && now.getHours() >= 10);

    cell.innerHTML = `
        <div>${day}</div>

        <label>
            <input type="checkbox" data-type="veg" data-day="${cellId}" ${!editable?"disabled":""}>
            🌱 <span class="vegCount">${data.reservations[cellId].veg.length}</span>
        </label>

        <div>
            <label>
                <input type="radio" name="${cellId}" value="11" data-type="h11" data-day="${cellId}" ${!editable?"disabled":""}>
                11h45
            </label>
            👤 <span class="h11Count">${data.reservations[cellId].h11.length}</span>
        </div>

        <div>
            <label>
                <input type="radio" name="${cellId}" value="12" data-type="h12" data-day="${cellId}" ${!editable?"disabled":""}>
                12h30
            </label>
            👤 <span class="h12Count">${data.reservations[cellId].h12.length}</span>
        </div>

        ${isToday ? `<span class="printIcon">🖨️</span>` : ""}
    `;

    if (isPast) cell.classList.add("past");
    if (isToday) cell.classList.add("today");

    row.appendChild(cell);

    if (d.getDay() === 5) { // vendredi
        calendarTable.appendChild(row);
        row = document.createElement("tr");
    }

    d.setDate(day + 1);
}
calendarTable.appendChild(row);

/* ============================================================
   4. GESTION DES CLICS SUR LES ÉLÉMENTS DU CALENDRIER
   ============================================================ */

document.querySelectorAll("input[type=checkbox], input[type=radio]").forEach(input => {
    input.addEventListener("change", () => {
        const user = nameInput.value.trim();
        if (!user) { alert("Veuillez saisir votre nom"); input.checked = false; return; }

        data.lastUsedName = user;
        if (!data.names.includes(user)) data.names.push(user);

        const type = input.dataset.type;
        const day = input.dataset.day;

        // Réinitialisation
        ["veg","h11","h12"].forEach(t => {
            data.reservations[day][t] =
                data.reservations[day][t].filter(n => n !== user);
        });

        if (input.type === "checkbox" && input.checked)
            data.reservations[day].veg.push(user);

        if (input.type === "radio") {
            if (type === "h11") data.reservations[day].h11.push(user);
            if (type === "h12") data.reservations[day].h12.push(user);
        }

        updateCounts(day);
        modified = true;
        updateStatus();
    });
});

function updateCounts(day) {
    document.querySelector(`td input[data-day="${day}"][data-type="veg"]`)
        .parentNode.querySelector(".vegCount").textContent = data.reservations[day].veg.length;

    document.querySelector(`td input[data-day="${day}"][data-type="h11"]`)
        .parentNode.querySelector(".h11Count").textContent = data.reservations[day].h11.length;

    document.querySelector(`td input[data-day="${day}"][data-type="h12"]`)
        .parentNode.querySelector(".h12Count").textContent = data.reservations[day].h12.length;
}

/* ============================================================
   5. VALIDATION / ENREGISTREMENT LOCAL
   ============================================================ */

let modified = false;

function updateStatus() {
    document.getElementById("statusMessage").textContent =
        modified ? "Modifications non enregistrées..." : "Enregistré.";
}

document.getElementById("validateBtn").addEventListener("click", () => {
    saveData();
    modified = false;
    updateStatus();
});

updateStatus();
