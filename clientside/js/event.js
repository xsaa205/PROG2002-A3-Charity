/* ============================================================================
   event.js — event detail page (A3 Part 3, requirement 1)
   ----------------------------------------------------------------------------
   Two API calls:
     GET /api/events/:id   -> event row + registrations[] + counts
                              (the API already sorts registrations newest first)
     GET api.open-meteo.com -> optional extra: forecast for the event day

   What this page must show, per the brief:
     * the full registration list for the event, newest purchase first
     * an updated "Register" action that links to the new registration page
     * the organiser, venue, time and fundraising progress
   ========================================================================== */
'use strict';

document.addEventListener('DOMContentLoaded', function () {
  renderSiteHeader('');
  renderSiteFooter();

  const eventId = getEventIdFromUrl();
  const container = document.getElementById('event-container');
  const alertBox = document.getElementById('alert-container');

  if (!eventId) {
    container.innerHTML = '';
    renderEmptyState(container, {
      icon: 'alert',
      title: 'No event selected',
      message: 'Open an event from the home page or the search results, and its details will appear here.',
      actionHtml: '<a class="btn btn-primary" href="search.html">Browse events</a>'
    });
    return;
  }

  loadEvent(eventId);
});

async function loadEvent(eventId) {
  const container = document.getElementById('event-container');
  const alertBox = document.getElementById('alert-container');

  container.innerHTML = '<div class="loading" style="margin-top:60px;">Loading event details…</div>';
  clearAlert(alertBox);

  try {
    const result = await apiRequest('/events/' + encodeURIComponent(eventId));
    const event = result && result.data;
    if (!event) throw Object.assign(new Error('Event not found.'), { status: 404 });

    document.title = event.name + ' | Zhengzhou Charity';
    container.innerHTML = renderEventDetail(event);

    // The weather card is an optional enhancement: it is requested after the
    // page has rendered, so a slow or blocked weather API never delays the
    // event itself.
    loadWeather(event);
  } catch (err) {
    console.error('[event] failed', err);
    container.innerHTML = '';

    if (err.status === 404) {
      renderEmptyState(container, {
        icon: 'search',
        title: 'That event could not be found',
        message: 'It may have been removed by the organiser. Browse the current events instead.',
        actionHtml: '<a class="btn btn-primary" href="search.html">Browse events</a>'
      });
      return;
    }

    renderErrorState(container, err.message, function () { loadEvent(eventId); });
    showAlert(alertBox, 'error', err.message);
  }
}

/* ---------------------------------------------------------------------------
   Page template
   ------------------------------------------------------------------------ */
function renderEventDetail(event) {
  const isPast = event.status === 'past';
  const isSuspended = event.status === 'suspended';
  const percent = progressPercent(event.raised_amount, event.goal_amount);
  const ticketCount = Number(event.registration_count) || 0;
  const ticketsSold = Number(event.tickets_sold) || 0;

  const registerAction = isSuspended
    ? '<button class="btn btn-ghost btn-block" type="button" disabled>Event suspended</button>'
    : isPast
      ? '<button class="btn btn-ghost btn-block" type="button" disabled>Registration closed — event ended</button>'
      : '<a class="btn btn-accent btn-block" href="registration.html?eventId=' + event.event_id + '">' +
        'Register for this event' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>' +
        '</a>';

  const priceBlock = isFreeEvent(event)
    ? '<div class="booking-price"><span class="amount">Free</span><span class="unit">no payment needed</span></div>'
    : '<div class="booking-price"><span class="amount">' + formatCurrency(event.ticket_price) +
      '</span><span class="unit">per ticket</span></div>';

  return (
    '<nav class="breadcrumb" aria-label="Breadcrumb">' +
      '<a href="index.html">Home</a>' + icon('chevronRight') +
      '<a href="search.html">Events</a>' + icon('chevronRight') +
      '<span aria-current="page">' + escapeHtml(event.name) + '</span>' +
    '</nav>' +

    '<header class="event-hero">' +
      '<img ' + imageAttrs(event, 'event-' + event.event_id, true) + '>' +
      '<div class="event-hero-body">' +
        '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
          statusBadge(event) +
          '<span class="badge badge-category">' + escapeHtml(event.category_name) + '</span>' +
          (isFreeEvent(event) ? '<span class="badge badge-free">Free entry</span>' : '') +
        '</div>' +
        '<h1>' + escapeHtml(event.name) + '</h1>' +
        '<div class="event-hero-meta">' +
          '<span>' + icon('calendar') + escapeHtml(formatDate(event.event_date)) +
            ' · ' + escapeHtml(formatWeekday(event.event_date)) + '</span>' +
          '<span>' + icon('clock') + escapeHtml(formatTime(event.start_time) || 'Time to be confirmed') +
            (event.end_time ? ' – ' + escapeHtml(formatTime(event.end_time)) : '') + '</span>' +
          '<span>' + icon('pin') + escapeHtml(event.location) + '</span>' +
        '</div>' +
      '</div>' +
    '</header>' +

    '<div class="detail-grid">' +
      /* ---------- left column ---------- */
      '<div>' +
        '<section class="detail-card" aria-labelledby="about-title">' +
          '<h2 id="about-title">' + icon('leaf') + 'About this event</h2>' +
          '<div class="prose">' +
            '<p>' + escapeHtml(event.full_description || event.short_description || 'No description has been provided yet.') + '</p>' +
          '</div>' +
        '</section>' +

        '<section class="detail-card" aria-labelledby="when-title">' +
          '<h2 id="when-title">' + icon('pin') + 'When &amp; where</h2>' +
          '<dl class="info-list">' +
            infoRow('Date', formatDate(event.event_date) + ' (' + formatWeekday(event.event_date) + ')') +
            infoRow('Time', (formatTime(event.start_time) || 'TBC') +
              (event.end_time ? ' – ' + formatTime(event.end_time) : '')) +
            infoRow('Venue', event.location) +
            infoRow('Address', event.address || '—') +
            infoRow('Category', event.category_name) +
          '</dl>' +
        '</section>' +

        '<section class="detail-card" aria-labelledby="org-title">' +
          '<h2 id="org-title">' + icon('users') + 'Organiser</h2>' +
          '<p class="prose" style="font-weight:600; color:var(--ink);">' + escapeHtml(event.org_name) + '</p>' +
          '<p class="prose" style="margin-top:6px;">' + escapeHtml(event.org_mission || '') + '</p>' +
          '<dl class="info-list" style="margin-top:16px;">' +
            infoRow('Email', event.contact_email || '—') +
            infoRow('Phone', event.phone || '—') +
          '</dl>' +
        '</section>' +
      '</div>' +

      /* ---------- right column ---------- */
      '<aside aria-label="Tickets and live information">' +
        '<div class="detail-card booking-card">' +
          '<span class="eyebrow">Tickets</span>' +
          priceBlock +
          '<p class="booking-note">' +
            (isPast
              ? 'This event has finished. The guest list below is kept for the record.'
              : isSuspended
                ? 'This event is currently suspended by the organiser.'
                : 'Choose how many seats you need on the next page. Takes about a minute.') +
          '</p>' +
          registerAction +
          '<div class="booking-stats">' +
            '<div class="mini-stat"><strong>' + ticketCount + '</strong><span>' +
              (ticketCount === 1 ? 'registration' : 'registrations') + '</span></div>' +
            '<div class="mini-stat"><strong>' + ticketsSold + '</strong><span>' +
              (ticketsSold === 1 ? 'ticket sold' : 'tickets sold') + '</span></div>' +
          '</div>' +
          '<div class="progress-wrap" style="margin-top:22px;">' +
            '<div class="progress-bar" role="progressbar" aria-valuenow="' + percent +
              '" aria-valuemin="0" aria-valuemax="100" aria-label="Fundraising progress">' +
              '<div class="progress-fill" style="width:' + percent + '%"></div>' +
            '</div>' +
            '<div class="progress-labels">' +
              '<span>Raised <strong>' + formatCurrency(event.raised_amount) + '</strong></span>' +
              '<span>Goal <strong>' + formatCurrency(event.goal_amount) + '</strong></span>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div id="weather-slot" style="margin-top:24px;"></div>' +
      '</aside>' +
    '</div>' +

    renderGuestList(event)
  );
}

function infoRow(label, value) {
  return '<div class="info-row"><dt>' + escapeHtml(label) + '</dt><dd>' +
    escapeHtml(value == null || value === '' ? '—' : value) + '</dd></div>';
}

/* ---------------------------------------------------------------------------
   Registration list — the main new requirement of Part 3
   The API sorts by registration_date DESC, so this is already newest-first;
   the page just renders the order it receives and labels the top row.
   ------------------------------------------------------------------------ */
function renderGuestList(event) {
  const registrations = event.registrations || [];
  const registrationsCount = registrations.length;
  const tickets = registrations.reduce(function (sum, r) {
    return sum + Number(r.num_tickets || 0);
  }, 0);

  let body;

  if (registrationsCount === 0) {
    body =
      '<div class="empty-state" style="padding:44px 24px; border:0; background:transparent;">' +
        '<div class="empty-icon">' + icon('users') + '</div>' +
        '<h3>No registrations yet</h3>' +
        '<p>Be the first to reserve a place — your name will appear at the top of this list.</p>' +
        (event.status === 'upcoming'
          ? '<a class="btn btn-primary" href="registration.html?eventId=' + event.event_id + '">Register now</a>'
          : '') +
      '</div>';
  } else {
    body =
      '<div class="guest-list">' +
      registrations
        .map(function (r, index) {
          const isLatest = index === 0 && registrationsCount > 1;
          const count = Number(r.num_tickets) || 0;
          return (
            '<div class="guest">' +
              '<span class="avatar" aria-hidden="true">' + escapeHtml(initials(r.user_name)) + '</span>' +
              '<div>' +
                '<div class="guest-name">' + escapeHtml(r.user_name) +
                  (isLatest ? '<span class="tag-new">Latest</span>' : '') +
                '</div>' +
                '<div class="guest-email">' + escapeHtml(maskEmail(r.user_email)) + '</div>' +
              '</div>' +
              '<div class="guest-tickets">' + count + (count === 1 ? ' ticket' : ' tickets') + '</div>' +
              '<div class="guest-when">' +
                '<span class="date">' + escapeHtml(formatDateTime(r.registration_date)) + '</span>' +
                '<span class="rel">' + escapeHtml(relativeTime(r.registration_date)) + '</span>' +
              '</div>' +
            '</div>'
          );
        })
        .join('') +
      '</div>';
  }

  return (
    '<section class="detail-card" id="guest-list" style="margin-top:34px;" aria-labelledby="guests-title">' +
      '<div class="list-head">' +
        '<h2 id="guests-title" style="font-size:1.24rem; display:flex; align-items:center; gap:10px;">' +
          icon('users') + 'Who is coming' +
        '</h2>' +
        '<p class="list-note">' +
          registrationsCount + (registrationsCount === 1 ? ' registration' : ' registrations') +
          ' · ' + tickets + (tickets === 1 ? ' ticket' : ' tickets') +
          ' · newest first · email addresses partially hidden' +
        '</p>' +
      '</div>' +
      body +
    '</section>'
  );
}

/* ---------------------------------------------------------------------------
   Optional extra: Open-Meteo forecast for the event day
   Free, no key, no registration. Coordinates come from the events table
   (latitude / longitude added in Part 1).
   ------------------------------------------------------------------------ */
const WEATHER_CODES = {
  0: { label: 'Clear sky', icon: 'sun' },
  1: { label: 'Mainly clear', icon: 'partly' },
  2: { label: 'Partly cloudy', icon: 'partly' },
  3: { label: 'Overcast', icon: 'cloud' },
  45: { label: 'Fog', icon: 'fog' },
  48: { label: 'Depositing rime fog', icon: 'fog' },
  51: { label: 'Light drizzle', icon: 'drizzle' },
  53: { label: 'Moderate drizzle', icon: 'drizzle' },
  55: { label: 'Dense drizzle', icon: 'drizzle' },
  61: { label: 'Light rain', icon: 'rain' },
  63: { label: 'Moderate rain', icon: 'rain' },
  65: { label: 'Heavy rain', icon: 'rain' },
  66: { label: 'Freezing rain', icon: 'rain' },
  67: { label: 'Heavy freezing rain', icon: 'rain' },
  71: { label: 'Light snow', icon: 'snow' },
  73: { label: 'Moderate snow', icon: 'snow' },
  75: { label: 'Heavy snow', icon: 'snow' },
  77: { label: 'Snow grains', icon: 'snow' },
  80: { label: 'Light rain showers', icon: 'drizzle' },
  81: { label: 'Moderate rain showers', icon: 'rain' },
  82: { label: 'Violent rain showers', icon: 'rain' },
  85: { label: 'Snow showers', icon: 'snow' },
  86: { label: 'Heavy snow showers', icon: 'snow' },
  95: { label: 'Thunderstorm', icon: 'storm' },
  96: { label: 'Thunderstorm with hail', icon: 'storm' },
  99: { label: 'Severe thunderstorm with hail', icon: 'storm' }
};

const WEATHER_ICONS = {
  sun:
    '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/>',
  partly:
    '<circle cx="8.5" cy="8.8" r="3.2"/><path d="M8.5 3.4v1.4M3.9 8.8H2.5M5.1 5.4 4.1 4.4M11.9 5.4l1-1M3.3 12.1l1.4.8"/><path d="M9 19h8.4a3.1 3.1 0 0 0 .2-6.2A4.4 4.4 0 0 0 9.3 14 2.6 2.6 0 0 0 9 19Z"/>',
  cloud:
    '<path d="M7 18h10.2a3.6 3.6 0 0 0 .2-7.2A5.2 5.2 0 0 0 7.4 12 3 3 0 0 0 7 18Z"/>',
  fog:
    '<path d="M7 14h10.2a3.4 3.4 0 0 0 .2-6.8A5 5 0 0 0 7.4 8.5 2.9 2.9 0 0 0 7 14Z"/><path d="M5 17.5h13M7 20h9"/>',
  drizzle:
    '<path d="M7 14h10.2a3.4 3.4 0 0 0 .2-6.8A5 5 0 0 0 7.4 8.5 2.9 2.9 0 0 0 7 14Z"/><path d="M9 17.5v1.6M13 17.5v1.6M17 17.5v1.6"/>',
  rain:
    '<path d="M7 14h10.2a3.4 3.4 0 0 0 .2-6.8A5 5 0 0 0 7.4 8.5 2.9 2.9 0 0 0 7 14Z"/><path d="M8.5 17 7.5 20M12.5 17l-1 3M16.5 17l-1 3"/>',
  snow:
    '<path d="M7 14h10.2a3.4 3.4 0 0 0 .2-6.8A5 5 0 0 0 7.4 8.5 2.9 2.9 0 0 0 7 14Z"/><path d="M9 17.5h.01M12 19.5h.01M15 17.5h.01M14 21h.01M8 20.5h.01"/>',
  storm:
    '<path d="M7 14h10.2a3.4 3.4 0 0 0 .2-6.8A5 5 0 0 0 7.4 8.5 2.9 2.9 0 0 0 7 14Z"/><path d="m13 15.5-3 4h3l-1 3 4-4.5h-3l1-2.5Z"/>'
};

async function loadWeather(event) {
  const slot = document.getElementById('weather-slot');
  if (!slot) return;

  const lat = event.latitude;
  const lon = event.longitude;
  if (lat == null || lon == null) return;

  // Open-Meteo publishes a 16-day forecast; past events have no forecast.
  const eventDate = parseDateOnly(event.event_date);
  if (!eventDate) return;
  const diffDays = Math.round((eventDate - new Date(new Date().toDateString())) / 86400000);
  if (diffDays < 0 || diffDays > 15) return;

  const dateStr = String(event.event_date).slice(0, 10);
  const url =
    'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(lat) +
    '&longitude=' + encodeURIComponent(lon) +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
    '&timezone=Asia%2FShanghai&start_date=' + dateStr + '&end_date=' + dateStr;

  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const daily = data && data.daily;
    if (!daily || !daily.time || daily.time.length === 0) return;

    const index = daily.time.indexOf(dateStr);
    if (index === -1) return;

    const code = Number(daily.weather_code[index]);
    const meta = WEATHER_CODES[code] || { label: 'Forecast unavailable', icon: 'cloud' };
    const high = Math.round(Number(daily.temperature_2m_max[index]));
    const low = Math.round(Number(daily.temperature_2m_min[index]));

    slot.innerHTML =
      '<div class="weather-card">' +
        '<div class="weather-top">' +
          '<span class="weather-place">Forecast · ' + escapeHtml(event.location) + '</span>' +
          '<span class="badge badge-soft">Live</span>' +
        '</div>' +
        '<div class="weather-main">' +
          '<svg class="weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
            'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            (WEATHER_ICONS[meta.icon] || WEATHER_ICONS.cloud) +
          '</svg>' +
          '<div>' +
            '<div class="weather-temp">' + high + '°</div>' +
            '<div class="weather-desc">' + escapeHtml(meta.label) + '</div>' +
            '<div class="weather-range">High ' + high + '° · Low ' + low + '°</div>' +
          '</div>' +
        '</div>' +
        '<div class="weather-foot">' +
          '<span>On ' + escapeHtml(formatDate(event.event_date)) + '</span>' +
          '<span>Open-Meteo</span>' +
        '</div>' +
      '</div>';
  } catch (err) {
    // Silent by design: the forecast is a bonus, never a blocker.
    console.warn('[weather] forecast unavailable', err);
  }
}
