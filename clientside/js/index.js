/* ============================================================================
   index.js — home page
   ----------------------------------------------------------------------------
   Calls GET /api/events/home once and derives four things from the same payload:
     * the three impact numbers in the hero
     * the "next event" card floating over the hero photo
     * the upcoming event grid
     * a short strip of past events (only shown when some exist)
   ========================================================================== */
'use strict';

document.addEventListener('DOMContentLoaded', function () {
  renderSiteHeader('home');
  renderSiteFooter();
  loadHomeEvents();
});

async function loadHomeEvents() {
  const container = document.getElementById('events-container');
  const alertBox = document.getElementById('alert-container');

  try {
    const result = await apiRequest('/events/home');
    const events = (result && result.data) || [];

    const upcoming = events.filter(function (e) { return e.status === 'upcoming'; });
    const past = events.filter(function (e) { return e.status === 'past'; });

    renderStats(upcoming, events);
    renderNextEventNote(upcoming[0]);

    if (upcoming.length === 0) {
      renderEmptyState(container, {
        icon: 'calendar',
        title: 'No upcoming events right now',
        message: 'New activities are published every week. In the meantime you can browse what we have already held.',
        actionHtml: '<a class="btn btn-primary" href="search.html">Search all events</a>'
      });
    } else {
      container.innerHTML = upcoming.map(eventCardHTML).join('');
    }

    if (past.length > 0) {
      const section = document.getElementById('past-section');
      const pastBox = document.getElementById('past-container');
      section.style.display = '';
      pastBox.innerHTML = past.slice(0, 3).map(eventCardHTML).join('');
    }
  } catch (err) {
    console.error('[home] failed to load events', err);
    container.innerHTML = '';
    renderErrorState(container, err.message, loadHomeEvents);
    showAlert(alertBox, 'error', err.message);
  }
}

/** Fill the three numbers in the hero strip. */
function renderStats(upcoming, allEvents) {
  const tickets = allEvents.reduce(function (sum, e) {
    return sum + Number(e.tickets_sold || 0);
  }, 0);
  const raised = allEvents.reduce(function (sum, e) {
    return sum + Number(e.raised_amount || 0);
  }, 0);

  document.getElementById('stat-upcoming').textContent = String(upcoming.length).padStart(2, '0');
  document.getElementById('stat-tickets').textContent = tickets.toLocaleString('en-AU');
  document.getElementById('stat-raised').textContent = compactMoney(raised);
}

/** "$12,480" instead of "$12,480.00" — the hero is a headline, not an invoice. */
function compactMoney(value) {
  const n = Number(value) || 0;
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  return '$' + Math.round(n).toLocaleString('en-AU');
}

/** Small floating card over the hero photograph. */
function renderNextEventNote(next) {
  const note = document.getElementById('next-event-note');
  if (!note) return;

  if (!next) {
    note.innerHTML =
      '<span class="note-icon">' + icon('heart') + '</span>' +
      '<span><strong>Thank you, Zhengzhou</strong>' +
      '<span>Every event so far is complete. New ones are on the way.</span></span>';
    return;
  }

  const seats = Number(next.registration_count) || 0;
  note.innerHTML =
    '<span class="note-icon">' + icon('calendar') + '</span>' +
    '<span><strong>Next up · ' + escapeHtml(next.name) + '</strong>' +
    '<span>' + escapeHtml(formatDate(next.event_date)) + ' · ' +
    escapeHtml(next.location) + ' · ' +
    (seats === 0 ? 'registration just opened' : seats + (seats === 1 ? ' guest registered' : ' guests registered')) +
    '</span></span>';
}
