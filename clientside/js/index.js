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
  initReveal();
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
      buildCoverflow(container, upcoming);
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

/** Fill the three numbers in the hero strip, then count them up from zero. */
function renderStats(upcoming, allEvents) {
  const tickets = allEvents.reduce(function (sum, e) {
    return sum + Number(e.tickets_sold || 0);
  }, 0);
  const raised = allEvents.reduce(function (sum, e) {
    return sum + Number(e.raised_amount || 0);
  }, 0);

  // Keep each figure's display format (zero-padded / grouped / compact $).
  const formatters = {
    'stat-upcoming': function (v) { return String(Math.round(v)).padStart(2, '0'); },
    'stat-tickets': function (v) { return Math.round(v).toLocaleString('en-AU'); },
    'stat-raised': function (v) { return compactMoney(v); }
  };
  const targets = {
    'stat-upcoming': upcoming.length,
    'stat-tickets': tickets,
    'stat-raised': raised
  };

  Object.keys(targets).forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.target = targets[id];
    el.textContent = formatters[id](0); // start at zero; count-up fills it
  });

  const strip = document.querySelector('.stats-strip');
  if (strip) {
    strip.dataset.countReady = 'true';
    // Count up on load when the strip is already on screen (the usual desktop
    // case); on shorter viewports it starts the moment it scrolls into view,
    // so the roll is always seen and the figures are never left at zero.
    if (strip.getBoundingClientRect().top < window.innerHeight) {
      startCountUp(strip);
    }
  }
}

/** Animate the three hero figures from zero to their target value. */
function startCountUp(strip) {
  if (strip.dataset.counted === 'true') return;
  strip.dataset.counted = 'true';

  const ids = ['stat-upcoming', 'stat-tickets', 'stat-raised'];
  const els = ids.map(function (id) { return document.getElementById(id); });
  const targets = els.map(function (el) { return parseFloat(el.dataset.target) || 0; });
  const formatters = [
    function (v) { return String(Math.round(v)).padStart(2, '0'); },
    function (v) { return Math.round(v).toLocaleString('en-AU'); },
    function (v) { return compactMoney(v); }
  ];

  const reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    els.forEach(function (el, i) { el.textContent = formatters[i](targets[i]); });
    return;
  }

  const duration = 1500;
  let startTs = null;
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function frame(now) {
    if (startTs === null) startTs = now;
    const p = Math.min(1, (now - startTs) / duration);
    const eased = easeOutCubic(p);
    els.forEach(function (el, i) { el.textContent = formatters[i](targets[i] * eased); });
    if (p < 1) {
      requestAnimationFrame(frame);
    } else {
      els.forEach(function (el, i) { el.textContent = formatters[i](targets[i]); });
    }
  }
  requestAnimationFrame(frame);
}

/** Fade-and-lift elements as they enter the viewport (scroll reveal). */
function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      if (entry.target.classList.contains('stats-strip') &&
          entry.target.dataset.countReady === 'true') {
        startCountUp(entry.target);
      }
      io.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  items.forEach(function (el) { io.observe(el); });
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
