/*************************************************
 * Chargement du mois depuis l’URL
 *************************************************/
const params = new URLSearchParams(window.location.search);
const monthParam = params.get("month") || "2025-01";

const monthLabel = new Date(monthParam + "-01")
    .toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

document.getElementById("monthName").textContent = monthLabel;

/*************************************************
 * Gestion des noms (names.json simulé localStorage)
 *************************************************/
let names = JSON.parse(localStorage.getItem("names")) || [];

const nameInput = document.getElementById("nameInput");
const nameAutocomplete = document.getElementById("nameAutocomplete");

function refreshAutocomplete() {
    nameAutocomplete.innerHTML = "";

    if (nameInput.value.length < 2) return;

    const fragment = document.createDocumentFragment();

    names
        .filter(n => n.name.toLowerCase().includes(nameInput.value.toLowerCase()))
        .forEach(entry => {
            const div = document.createElement("div");
            div.textContent = entry.name;
            div.className = "autocomplete-item";
            div.onclick = () => {
                nameInput.value = entry.name;
                nameAutocomplete.innerHTML = "";
                localStorage.setItem("lastName", entry.name);
            };
            fragment.appendChild(div);
        });

    nameAutocomplete.appendChild(fragment);
}

nameInput.addEventListener("input", refreshAutocomplete);

// Charger le dernier nom utilisé
const lastName = localStorage.getItem("lastName");
if (lastName) nameInput.value = lastName;

/*************************************************
 * Génération du calendrier
 *************************************************/
const grid = document.getElementById("calendarGrid");

// Récupération des dates du mois
const year = parseInt(monthParam.split("-")[0], 10);
const month = parseInt(monthParam.split("-")[1], 10) - 1;
const firstDay = new Date(year, month, 1);
const lastDay = new Date(year, month + 1, 0);

const today = new Date();

// réservation locale
let reservations = JSON.parse(localStorage.getItem("reservations-" + monthParam)) || {};

function createDayCell(date) {

    const d = date.getDate();
    const cell = document.createElement("div");
    cell.className = "day-cell";

    // Jour passé
    if (date < today) {
        cell.classList.add("day-disabled");
    }

    // Aujourd'hui : bouton impression
    if (
        date.toDateString() === today.toDateString() &&
        today.getHours() < 10
    ) {
        const printBtn = document.createElement("div");
        printBtn.className = "print-btn";
        printBtn.textContent = "🖨️";
        printBtn.onclick = () => alert("Impression des listes…");
        cell.appendChild(printBtn);
    }

    const vegeCount = reservations[d]?.vege?.length || 0;
    const h1145Count = reservations[d]?.h11?.length || 0;
    const h1230Count = reservations[d]?.h12?.length || 0;

    cell.innerHTML += `
        <div><strong>${d}</strong></div>

        <div class="vege" data-day="${d}">
            <span class="vege-btn">🥗 Végétarien</span>
            <span class="bubble vege-list-btn">${vegeCount}</span>
        </div>

        <div class="hours" data-day="${d}">
            <label>
                <input type="radio" name="h${d}" value="11:45">
                11h45
            </label>
            <span class="bubble hour-list-btn" data-hour="h11">${h1145Count}</span>

            <label>
                <input type="radio" name="h${d}" value="12:30">
                12h30
            </label>
            <span class="bubble hour-list-btn" data-hour="h12">${h1230Count}</span>
        </div>
    `;

    // Interaction : cliquer sur 🥗 change l'état
    cell.querySelector(".vege-btn").onclick = () => toggleVege(d, cell);

    // pop-up uniquement en cliquant sur la bulle
    cell.querySelector(".vege-list-btn").onclick = () =>
        showList("Végétariens", reservations[d]?.vege);

    // pop-up horaires
    cell.querySelectorAll(".hour-list-btn").forEach(btn => {
        btn.onclick = () => {
            const hourType = btn.dataset.hour;
            showList(
                hourType === "h11" ? "11h45" : "12h30",
                reservations[d]?.[hourType]
            );
        };
    });

    // Radio = sélection horaire
    cell.querySelectorAll("input[type=radio]").forEach(radio => {
        radio.addEventListener("change", () => toggleHour(d, radio.value, cell));
    });

    refreshSelectedVisuals(d, cell);

    return cell;
}

// Construction de la grille semaine par semaine
let cursor = new Date(firstDay);

while (cursor <= lastDay) {
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) {
        grid.appendChild(createDayCell(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
}

function toggleVege(day, cell) {
    const name = nameInput.value.trim();
    if (!name) return;

    reservations[day] = reservations[day] || { vege: [], h11: [], h12: [] };

    const list = reservations[day].vege;
    const index = list.indexOf(name);

    if (index === -1) list.push(name);
    else list.splice(index, 1);

    refreshSelectedVisuals(day, cell);
    markModified();
}

function toggleHour(day, value, cell) {
    const name = nameInput.value.trim();
    if (!name) return;

    reservations[day] = reservations[day] || { vege: [], h11: [], h12: [] };

    // reset
    reservations[day].h11 = reservations[day].h11.filter(n => n !== name);
    reservations[day].h12 = reservations[day].h12.filter(n => n !== name);

    if (value === "11:45") reservations[day].h11.push(name);
    else reservations[day].h12.push(name);

    refreshSelectedVisuals(day, cell);
    markModified();
}

function refreshSelectedVisuals(day, cell) {
    const name = nameInput.value.trim();

    const isVege = reservations[day]?.vege?.includes(name);
    cell.querySelector(".vege").classList.toggle("selected-vege", isVege);

    const is1145 = reservations[day]?.h11?.includes(name);
    const is1230 = reservations[day]?.h12?.includes(name);

    cell.querySelectorAll("label").forEach(l => {
        l.classList.remove("selected-hour");
        if (l.textContent.includes("11") && is1145)
            l.classList.add("selected-hour");
        if (l.textContent.includes("12") && is1230)
            l.classList.add("selected-hour");
    });

    // mettre à jour les compteurs
    cell.querySelector(".vege-list-btn").textContent =
        reservations[day]?.vege?.length ?? 0;

    const bubbles = cell.querySelectorAll(".hour-list-btn");
    bubbles[0].textContent = reservations[day]?.h11?.length ?? 0;
    bubbles[1].textContent = reservations[day]?.h12?.length ?? 0;
}

function showList(title, arr) {
    alert(`${title}\n\n${(arr || []).join("\n")}`);
}

/*************************************************
 * Enregistrement
 *************************************************/
const saveButton = document.getElementById("saveButton");
const statusMessage = document.getElementById("statusMessage");

let modified = false;

function markModified() {
    modified = true;
    statusMessage.textContent = "Modifications non enregistrées…";
}

saveButton.onclick = () => {
    const name = nameInput.value.trim();
    if (!name) {
        alert("Veuillez saisir un nom.");
        return;
    }

    // Ajouter le nom s'il n'existe pas
    if (!names.some(n => n.name === name)) {
        names.push({ id: crypto.randomUUID(), name });
        localStorage.setItem("names", JSON.stringify(names));
    }

    // Enregistrer les réservations
    localStorage.setItem("reservations-" + monthParam, JSON.stringify(reservations));

    modified = false;
    statusMessage.textContent = "Enregistré ✔";
};
