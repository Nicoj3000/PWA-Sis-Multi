// IndexedDB helpers (igual que antes)
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

// Calendario
document.addEventListener('DOMContentLoaded', async () => {
    const calendar = document.getElementById('calendar');
    const modal = document.getElementById('event-modal');
    const closeModal = document.getElementById('close-modal');
    const modalForm = document.getElementById('modal-form');
    const modalTitle = document.getElementById('modal-title');
    const modalEventTitle = document.getElementById('modal-event-title');
    const modalEventTime = document.getElementById('modal-event-time');

    let selectedDate = null;
    let editingEventId = null;
    let events = await getAllEvents();

    function renderCalendar(year, month) {
        calendar.innerHTML = '';
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
                d === now.getDate() &&
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

            cell.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-btn')) return;
                selectedDate = cellDate;
                editingEventId = null;
                modalTitle.textContent = "Agregar evento";
                modalEventTitle.value = '';
                modalEventTime.value = '';
                modal.classList.remove('hidden');
                // Enfoca el input y hace scroll al modal
                setTimeout(() => {
                    modalEventTitle.focus();
                    modalEventTitle.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
            });

            // Eliminar evento
            cell.querySelectorAll('.event-item').forEach(item => {
                item.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = Number(item.dataset.id);
                    if (confirm("¿Seguro que quieres eliminar este evento?")) {
                        await deleteEvent(id);
                        events = await getAllEvents();
                        renderCalendar(year, month);
                        showToast("Evento eliminado");
                    }
                });
            });

            grid.appendChild(cell);
        }
        calendar.appendChild(grid);

        // Navegación
        document.getElementById('prev-month').onclick = () => renderCalendar(year, month - 1 < 0 ? 11 : month - 1, month - 1 < 0 ? year - 1 : year);
        document.getElementById('next-month').onclick = () => renderCalendar(year, month + 1 > 11 ? 0 : month + 1, month + 1 > 11 ? year + 1 : year);
    }

    // Inicializar calendario
    const today = new Date();
    renderCalendar(today.getFullYear(), today.getMonth());

    // Modal cerrar
    closeModal.onclick = () => modal.classList.add('hidden');

    // Modal submit
    modalForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!selectedDate) return;
        const title = modalEventTitle.value.trim();
        const time = modalEventTime.value;
        if (!title || !time) return;
        await addOrUpdateEvent({
            id: editingEventId || Date.now(),
            title,
            date: selectedDate,
            time
        });
        events = await getAllEvents();
        modal.classList.add('hidden');
        showToast(`Evento "${title}" guardado`);
        renderCalendar(new Date(selectedDate).getFullYear(), new Date(selectedDate).getMonth());
    };
});

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}