/* ============================================================================
   list.js — Admin "All events" page
   ----------------------------------------------------------------------------
   Loads every event via GET /api/events (all statuses), renders summary stats,
   a searchable/filterable table, and per-row Edit / Delete actions. Deletion
   calls DELETE /api/events/:id and gracefully handles the 409 guard (event has
   registrations) with a clear message.
   ========================================================================== */
'use strict';

const listBody = document.getElementById('events-body');
const statGrid = document.getElementById('stat-grid');
const alertHost = document.getElementById('alert-host');
const searchInput = document.getElementById('search');
const statusFilter = document.getElementById('status-filter');

let allEvents = [];

/* ---------------------------------------------------------------------------
   Rendering
   ------------------------------------------------------------------------ */
function renderStats(events) {
  const upcoming = events.filter((e) => window.admin.statusMeta(e).label === 'Active').length;
  const past = events.filter((e) => window.admin.statusMeta(e).label === 'Past').length;
  const suspended = events.filter((e) => window.admin.statusMeta(e).label === 'Suspended').length;
  const regs = events.reduce((sum, e) => sum + (Number(e.registration_count) || 0), 0);

  statGrid.innerHTML = [
    statCard('accent-total', 'list', 'Total events', events.length),
    statCard('accent-upcoming', 'check', 'Active', upcoming),
    statCard('accent-past', 'clock', 'Past', past),
    statCard('accent-suspended', 'alert', 'Suspended', suspended),
    statCard('accent-upcoming', 'users', 'Registrations', regs)
  ].join('');
}

function statCard(accent, iconName, label, value) {
  return (
    '<div class="stat-card ' + accent + '">' +
      '<div class="stat-value">' + value + '</div>' +
      '<div class="stat-label">' + window.admin.icon(iconName) + label + '</div>' +
    '</div>'
  );
}

function rowHtml(e) {
  const meta = window.admin.statusMeta(e);
  const regCount = Number(e.registration_count) || 0;
  const dateStr = window.admin.formatDate(e.event_date) || '—';

  return (
    '<tr>' +
      '<td data-label="Event">' +
        '<div class="cell-name">' + window.admin.escapeHtml(e.name) + '</div>' +
        '<div class="cell-sub">' + window.admin.escapeHtml(e.org_name || '') + ' · ' +
          window.admin.escapeHtml(e.category_name || '') + '</div>' +
      '</td>' +
      '<td data-label="Date">' + window.admin.escapeHtml(dateStr) + '</td>' +
      '<td data-label="Status">' + window.admin.statusBadge(e) + '</td>' +
      '<td data-label="Registrations">' +
        '<strong>' + regCount + '</strong> ' +
        '<span class="cell-sub">' + (regCount === 1 ? 'guest' : 'guests') + '</span>' +
      '</td>' +
      '<td data-label="Actions" class="cell-actions">' +
        '<a class="btn btn-ghost btn-sm" href="edit.html?id=' + e.event_id + '">' +
          window.admin.icon('edit') + 'Edit</a>' +
        '<button class="btn btn-danger btn-sm" data-delete="' + e.event_id + '" type="button">' +
          window.admin.icon('trash') + 'Delete</button>' +
      '</td>' +
    '</tr>'
  );
}

function renderTable(events) {
  if (!events.length) {
    listBody.innerHTML = '';
    const card = document.querySelector('.table-card');
    window.admin.renderEmpty(card, {
      icon: 'search',
      title: 'No events match',
      message: 'Try a different search term or status filter.'
    });
    return;
  }
  listBody.innerHTML = events.map(rowHtml).join('');
}

function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const filtered = allEvents.filter((e) => {
    const meta = window.admin.statusMeta(e);
    if (status !== 'all' && meta.label.toLowerCase() !== status) return false;
    if (!q) return true;
    const hay = [e.name, e.location, e.org_name, e.category_name].join(' ').toLowerCase();
    return hay.includes(q);
  });
  renderTable(filtered);
}

/* ---------------------------------------------------------------------------
   Data loading
   ------------------------------------------------------------------------ */
async function loadEvents() {
  listBody.innerHTML = window.admin.skeletonRows(5);
  statGrid.innerHTML = '';
  try {
    const res = await window.admin.api('/events');
    allEvents = (res && res.data) || [];
    renderStats(allEvents);
    applyFilters();
  } catch (err) {
    window.admin.renderError(document.querySelector('.table-card'), err.message || 'Failed to load events.', loadEvents);
  }
}

/* ---------------------------------------------------------------------------
   Delete with 409 guard
   ------------------------------------------------------------------------ */
async function deleteEvent(id) {
  const ev = allEvents.find((e) => e.event_id === Number(id));
  if (!ev) return;
  const regCount = Number(ev.registration_count) || 0;
  const confirmMsg = regCount > 0
    ? 'Delete "' + ev.name + '"?\n\nThis event has ' + regCount + ' registration(s). The server will block deletion to protect that data.'
    : 'Delete "' + ev.name + '"? This cannot be undone.';
  if (!window.confirm(confirmMsg)) return;

  try {
    await window.admin.api('/events/' + id, { method: 'DELETE' });
    window.admin.toast('Event deleted successfully.', 'success');
    await loadEvents();
  } catch (err) {
    if (err.status === 409) {
      const count = (err.payload && err.payload.registration_count) || regCount;
      window.admin.showAlert(alertHost, 'error',
        'Cannot delete "' + ev.name + '" — it has ' + count + ' registration(s). Remove the registrations first (or keep the event).',
        err.details);
    } else {
      window.admin.showAlert(alertHost, 'error', err.message || 'Failed to delete event.', err.details);
    }
  }
}

/* ---------------------------------------------------------------------------
   Wire up
   ------------------------------------------------------------------------ */
listBody.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-delete]');
  if (btn) deleteEvent(btn.getAttribute('data-delete'));
});
searchInput.addEventListener('input', applyFilters);
statusFilter.addEventListener('change', applyFilters);

window.admin.renderSidebar('list');
loadEvents();
