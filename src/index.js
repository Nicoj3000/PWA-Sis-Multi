// IndexedDB helpers
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('events-db', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('events')) {
                db.createObjectStore('events', { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
function getAllEvents() {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('events', 'readonly');
            const store = tx.objectStore('events');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    });
}
function addOrUpdateEvent(event) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('events', 'readwrite');
            const store = tx.objectStore('events');
            store.put(event);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    });
}
function deleteEvent(id) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('events', 'readwrite');
            const store = tx.objectStore('events');
            store.delete(id);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    });
}

// Estado global
let currentView = 'month'; // 'day', 'month', 'year'
let selectedYear, selectedMonth, selectedDay;
let events = [];

// Renderizado principal
async function renderCalendar(year, month = 0, day = 1) {
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';
    if (currentView === 'month') {
        // Vista MES
        const now = new Date();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Lunes = 0
        const daysInMonth = lastDay.getDate();

        // Header
        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.innerHTML = `
            <button id="prev-month">&lt;</button>
            <span>${firstDay.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <button id="next-month">&gt;</button>
        `;
        calendar.appendChild(header);

        // Días de la semana
        const daysRow = document.createElement('div');
        daysRow.className = 'calendar-grid';
        ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach(d => {
            const day = document.createElement('div');
            day.className = 'calendar-day';
            day.textContent = d;
            daysRow.appendChild(day);
        });
        calendar.appendChild(daysRow);

        // Celdas de días
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';

        // Espacios vacíos antes del primer día
        for (let i = 0; i < startDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-cell';
            grid.appendChild(empty);
        }

        // Días del mes
        for (let d = 1; d <= daysInMonth; d++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-cell';
            const cellDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            cell.dataset.date = cellDate;
            if (
                d === (now.getDate()) &&
                month === now.getMonth() &&
                year === now.getFullYear()
            ) {
                cell.classList.add('today');
            }
            cell.innerHTML = `<div>${d}</div>`;

            // Eventos en este día
            const dayEvents = events.filter(ev => ev.date === cellDate);
            if (dayEvents.length > 0) {
                cell.innerHTML += `<div class="event-list">${dayEvents.map(ev => `
                    <div class="event-item" data-id="${ev.id}" title="Haz clic para eliminar">
                        <span class="event-time">${ev.time}</span>
                        <span class="event-title">${ev.title}</span>
                    </div>
                `).join('')}</div>`;
            }

            // Click en día: abrir modal para agregar evento
            cell.addEventListener('click', (e) => {
                selectedYear = year;
                selectedMonth = month;
                selectedDay = d;
                selectedDate = cellDate;
                modalTitle.textContent = "Agregar evento";
                modalEventTitle.value = '';
                modalEventTime.value = '';
                modal.classList.remove('hidden');
                setTimeout(() => {
                    modalEventTitle.focus();
                    modalEventTitle.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
            });

            // Click en evento: eliminar
            cell.querySelectorAll('.event-item').forEach(item => {
                item.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = Number(item.dataset.id);
                    if (confirm("¿Seguro que quieres eliminar este evento?")) {
                        await deleteEvent(id);
                        events = await getAllEvents();
                        renderCalendar(year, month, d);
                        showToast("Evento eliminado");
                    }
                });
            });

            grid.appendChild(cell);
        }
        calendar.appendChild(grid);

        // Navegación adaptable
        const prevBtn = document.getElementById('prev-month');
        const nextBtn = document.getElementById('next-month');
        prevBtn.onclick = () => {
            let newMonth = month - 1;
            let newYear = year;
            if (newMonth < 0) {
                newMonth = 11;
                newYear--;
            }
            selectedYear = newYear;
            selectedMonth = newMonth;
            renderCalendar(newYear, newMonth, 1);
        };
        nextBtn.onclick = () => {
            let newMonth = month + 1;
            let newYear = year;
            if (newMonth > 11) {
                newMonth = 0;
                newYear++;
            }
            selectedYear = newYear;
            selectedMonth = newMonth;
            renderCalendar(newYear, newMonth, 1);
        };
    } else if (currentView === 'day') {
        // Vista DÍA
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = events.filter(ev => ev.date === dateStr);
        calendar.innerHTML = `
            <div class="calendar-header">
                <button id="prev-month">&lt;</button>
                <span>${new Date(year, month, day).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <button id="next-month">&gt;</button>
            </div>
        `;
        if (dayEvents.length === 0) {
            calendar.innerHTML += `<p>No hay eventos para este día.</p>`;
        } else {
            calendar.innerHTML += `<ul class="event-list">${dayEvents.map(ev => `
                <li class="event-item" data-id="${ev.id}" title="Haz clic para eliminar">
                    <span class="event-time">${ev.time}</span>
                    <span class="event-title">${ev.title}</span>
                </li>
            `).join('')}</ul>`;
        }
        // Eliminar evento en vista día
        calendar.querySelectorAll('.event-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                const id = Number(item.dataset.id);
                if (confirm("¿Seguro que quieres eliminar este evento?")) {
                    await deleteEvent(id);
                    events = await getAllEvents();
                    renderCalendar(year, month, day);
                    showToast("Evento eliminado");
                }
            });
        });

        // Navegación adaptable para día
        const prevBtn = document.getElementById('prev-month');
        const nextBtn = document.getElementById('next-month');
        prevBtn.onclick = () => {
            const date = new Date(year, month, day - 1);
            selectedYear = date.getFullYear();
            selectedMonth = date.getMonth();
            selectedDay = date.getDate();
            renderCalendar(selectedYear, selectedMonth, selectedDay);
        };
        nextBtn.onclick = () => {
            const date = new Date(year, month, day + 1);
            selectedYear = date.getFullYear();
            selectedMonth = date.getMonth();
            selectedDay = date.getDate();
            renderCalendar(selectedYear, selectedMonth, selectedDay);
        };
    } else if (currentView === 'year') {
        // Vista AÑO
        calendar.innerHTML = `<div class="calendar-header">
            <button id="prev-month">&lt;</button>
            <span>${year}</span>
            <button id="next-month">&gt;</button>
        </div>
        <div class="year-grid"></div>`;
        const yearGrid = calendar.querySelector('.year-grid');
        yearGrid.style.display = 'grid';
        yearGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
        for (let m = 0; m < 12; m++) {
            const monthDiv = document.createElement('div');
            monthDiv.className = 'mini-month';
            monthDiv.innerHTML = `<strong>${new Date(year, m).toLocaleString('default', { month: 'short' })}</strong>`;
            monthDiv.onclick = () => {
                currentView = 'month';
                updateViewButtons();
                selectedMonth = m;
                renderCalendar(year, m, 1);
            };
            yearGrid.appendChild(monthDiv);
        }
        // Navegación adaptable para año
        const prevBtn = document.getElementById('prev-month');
        const nextBtn = document.getElementById('next-month');
        prevBtn.onclick = () => {
            selectedYear = year - 1;
            renderCalendar(selectedYear, 0, 1);
        };
        nextBtn.onclick = () => {
            selectedYear = year + 1;
            renderCalendar(selectedYear, 0, 1);
        };
    }
}

// Botones de vista
function updateViewButtons() {
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('view-' + currentView).classList.add('active');
}

document.addEventListener('DOMContentLoaded', async () => {
    // Elementos
    window.modal = document.getElementById('event-modal');
    window.closeModal = document.getElementById('close-modal');
    window.modalForm = document.getElementById('modal-form');
    window.modalTitle = document.getElementById('modal-title');
    window.modalEventTitle = document.getElementById('modal-event-title');
    window.modalEventTime = document.getElementById('modal-event-time');

    // Fecha actual
    const today = new Date();
    selectedYear = today.getFullYear();
    selectedMonth = today.getMonth();
    selectedDay = today.getDate();
    events = await getAllEvents();

    // Render inicial
    renderCalendar(selectedYear, selectedMonth, selectedDay);

    // Botones de vista
    document.getElementById('today-btn').onclick = () => {
    const today = new Date();
    selectedYear = today.getFullYear();
    selectedMonth = today.getMonth();
    selectedDay = today.getDate();
    currentView = 'month';
    updateViewButtons();
    renderCalendar(selectedYear, selectedMonth, selectedDay);
    };
    document.getElementById('view-day').onclick = () => {
        currentView = 'day';
        updateViewButtons();
        renderCalendar(selectedYear, selectedMonth, selectedDay);
    };
    document.getElementById('view-month').onclick = () => {
        currentView = 'month';
        updateViewButtons();
        renderCalendar(selectedYear, selectedMonth, selectedDay);
    };
    document.getElementById('view-year').onclick = () => {
        currentView = 'year';
        updateViewButtons();
        renderCalendar(selectedYear, selectedMonth, selectedDay);
    };

    // Modal cerrar
    closeModal.onclick = () => modal.classList.add('hidden');

    // Modal submit
    modalForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!selectedYear || selectedMonth === undefined || !selectedDay) return;
        const title = modalEventTitle.value.trim();
        const time = modalEventTime.value;
        if (!title || !time) return;
        const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
        await addOrUpdateEvent({
            id: Date.now(),
            title,
            date: dateStr,
            time
        });
        events = await getAllEvents();
        modal.classList.add('hidden');
        showToast(`Evento "${title}" guardado`);
        renderCalendar(selectedYear, selectedMonth, selectedDay);
    };
});

// Toast
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}