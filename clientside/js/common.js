/* ============================================================================
   common.js — shared helpers for every public page
   ----------------------------------------------------------------------------
   Responsibilities
     * one place that talks to the REST API (fetch + JSON + error shape)
     * formatting helpers (dates, times, money, relative time)
     * the site header/footer, so all pages stay identical
     * the event card template used by the home and search pages
     * loading / empty / error state helpers

   Pages call these functions from their own script (index.js, search.js,
   event.js, registration.js). No framework is used: plain DOM + Promises.
   ========================================================================== */
'use strict';

const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || 'http://localhost:3000/api';

/* ---------------------------------------------------------------------------
   Inline SVG icons
   Kept as strings so templates stay readable and the page needs no icon font.
   ------------------------------------------------------------------------ */
const ICONS = {
  heart:
    '<path d="M12 20.5s-7.5-4.6-7.5-10A4.8 4.8 0 0 1 12 7.2a4.8 4.8 0 0 1 7.5 3.3c0 5.4-7.5 10-7.5 10Z" fill="currentColor" stroke="none"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  ticket:
    '<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z"/><path d="M14 6v12" stroke-dasharray="2 3"/>',
  users:
    '<path d="M16 19v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 17.5V19"/><circle cx="10" cy="7.5" r="3.5"/><path d="M20 19v-1.5a4 4 0 0 0-3-3.87"/><path d="M15.5 4.2a3.5 3.5 0 0 1 0 6.6"/>',
  arrowRight: '<path d="M5 12h13M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H6M11 18l-6-6 6-6"/>',
  check: '<path d="M4 12.5 9.5 18 20 6.5"/>',
  alert:
    '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  phone:
    '<path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z"/>',
  shield: '<path d="M12 3.5 5 6.5v5c0 4.4 3 8.2 7 9.5 4-1.3 7-5.1 7-9.5v-5l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  sparkle:
    '<path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9 12 3.5Z"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9.5 8h5M9.5 12h5"/>',
  leaf: '<path d="M20 4C10 4 4 9 4 16c0 1.5.4 2.8 1 4 1.2-5 4.8-8.6 10-10-4.4 2.2-7.3 5.8-8.2 10H9c7 0 11-5.5 11-16Z" fill="currentColor" stroke="none"/>',
  compass:
    '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>'
};

function icon(name, extraClass) {
  const body = ICONS[name] || ICONS.info;
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="' +
    (extraClass || '') +
    '">' +
    body +
    '</svg>'
  );
}

/* ---------------------------------------------------------------------------
   API layer
   ------------------------------------------------------------------------ */

/**
 * apiRequest('/events/1') -> Promise<parsed body>
 *
 * Wraps fetch so every page gets the same behaviour:
 *   * 12 s timeout (AbortController) instead of hanging forever
 *   * parses JSON defensively
 *   * throws an Error carrying .status and .details (the validation array the
 *     API returns with a 400), so callers can render precise messages
 */
async function apiRequest(path, options) {
  const opts = options || {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  const headers = Object.assign({}, opts.headers || {});
  if (opts.body) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetch(API_BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body,
      signal: controller.signal
    });

    const text = await res.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (_) {
        payload = null;
      }
    }

    if (!res.ok) {
      const err = new Error(
        (payload && payload.error) || 'The server returned HTTP ' + res.status + '.'
      );
      err.status = res.status;
      err.details = (payload && payload.details) || [];
      err.payload = payload;
      throw err;
    }

    return payload;
  } catch (err) {
    // Network failures and aborts surface as generic TypeError / AbortError;
    // turn them into messages a visitor can understand.
    if (err && err.name === 'AbortError') {
      const timeout = new Error('The request took too long. Please try again.');
      timeout.status = 0;
      throw timeout;
    }
    if (err instanceof TypeError) {
      const offline = new Error('Could not reach the server. Please check your connection and try again.');
      offline.status = 0;
      throw offline;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------------------
   Formatting helpers
   ------------------------------------------------------------------------ */

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 'YYYY-MM-DD' -> Date, parsed as a local date (no UTC off-by-one). */
function parseDateOnly(value) {
  if (!value) return null;
  // The pool is configured with dateStrings, but accept a Date object too so
  // the helpers keep working if that setting ever changes.
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const datePart = String(value).slice(0, 10);
  const parts = datePart.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

/** 'YYYY-MM-DD HH:MM:SS' (MySQL DATETIME) -> Date, treated as local time. */
function parseDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value).replace(' ', 'T');
  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  const d = parseDateOnly(value);
  if (!d) return '';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(value) {
  const d = parseDateOnly(value);
  if (!d) return '';
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatWeekday(value) {
  const d = parseDateOnly(value);
  if (!d) return '';
  return d.toLocaleDateString('en-AU', { weekday: 'long' });
}

function formatTime(value) {
  if (!value) return '';
  const parts = String(value).split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] || 0);
  if (isNaN(h)) return '';
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(value) {
  const d = parseDateTime(value);
  if (!d) return '';
  return (
    d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  );
}

/** "3 days ago" / "today" for a registration timestamp. */
function relativeTime(value) {
  const d = parseDateTime(value);
  if (!d) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) {
    const hours = Math.max(0, Math.floor((Date.now() - d.getTime()) / 3600000));
    if (hours <= 0) {
      const mins = Math.max(1, Math.floor((Date.now() - d.getTime()) / 60000));
      return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
    }
    return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  }
  if (days === 1) return 'yesterday';
  if (days < 30) return days + ' days ago';
  const months = Math.floor(days / 30);
  return months + (months === 1 ? ' month ago' : ' months ago');
}

function formatCurrency(value) {
  const n = Number(value) || 0;
  return (
    '$' +
    n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

function isFreeEvent(event) {
  return Number(event.is_free) === 1 || Number(event.ticket_price) === 0;
}

function priceLabel(event) {
  return isFreeEvent(event) ? 'Free' : formatCurrency(event.ticket_price);
}

function progressPercent(raised, goal) {
  const r = Number(raised) || 0;
  const g = Number(goal) || 0;
  if (g <= 0) return 0;
  return Math.min(100, Math.round((r / g) * 100));
}

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  if (!parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Partially hide an address: "alice@example.com" -> "a•••e@example.com". */
function maskEmail(email) {
  const text = String(email || '');
  const at = text.indexOf('@');
  if (at <= 0) return text;
  const local = text.slice(0, at);
  const domain = text.slice(at);
  if (local.length <= 2) return local[0] + '•••' + domain;
  return local[0] + '•••' + local[local.length - 1] + domain;
}

function statusMeta(event) {
  if (event.status === 'suspended') return { cls: 'badge-suspended', label: 'Suspended' };
  if (event.status === 'past') return { cls: 'badge-past', label: 'Past' };
  return { cls: 'badge-upcoming', label: 'Upcoming' };
}

function statusBadge(event) {
  const meta = statusMeta(event);
  return '<span class="badge ' + meta.cls + '">' + meta.label + '</span>';
}

/* ---------------------------------------------------------------------------
   Site header / footer
   ------------------------------------------------------------------------ */
function renderSiteHeader(activePage) {
  const host = document.getElementById('site-header');
  if (!host) return;

  const link = (href, label, key) =>
    '<li><a href="' +
    href +
    '" class="' +
    (activePage === key ? 'active' : '') +
    '"' +
    (activePage === key ? ' aria-current="page"' : '') +
    '>' +
    label +
    '</a></li>';

  host.className = 'site-header';
  host.innerHTML =
    '<div class="container navbar">' +
      '<a class="brand" href="index.html" aria-label="Zhengzhou Charity home">' +
        '<span class="brand-mark">' + icon('heart') + '</span>' +
        '<span class="brand-text">' +
          '<span class="brand-name">Zhengzhou Charity</span>' +
          '<span class="brand-sub">Green City · Warm Hearts</span>' +
        '</span>' +
      '</a>' +
      '<nav aria-label="Primary">' +
        '<ul class="nav-links">' +
          link('index.html', 'Home', 'home') +
          link('search.html', 'Find an event', 'search') +
        '</ul>' +
      '</nav>' +
      '<div class="nav-actions">' +
        '<a class="btn btn-primary btn-sm" href="search.html">Donate your time</a>' +
        '<button class="nav-toggle" id="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-drawer" aria-label="Open menu">' +
          icon('menu') +
        '</button>' +
      '</div>' +
    '</div>' +
    '<div class="nav-drawer" id="nav-drawer">' +
      '<a href="index.html" class="' + (activePage === 'home' ? 'active' : '') + '">Home</a>' +
      '<a href="search.html" class="' + (activePage === 'search' ? 'active' : '') + '">Find an event</a>' +
      '<a class="btn btn-primary btn-block" href="search.html">Browse events</a>' +
    '</div>';

  const toggle = document.getElementById('nav-toggle');
  const drawer = document.getElementById('nav-drawer');
  toggle.addEventListener('click', function () {
    const open = drawer.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.innerHTML = icon(open ? 'close' : 'menu');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });

  const onScroll = function () {
    host.classList.toggle('is-stuck', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function renderSiteFooter() {
  const host = document.getElementById('site-footer');
  if (!host) return;

  host.className = 'site-footer';
  host.innerHTML =
    '<div class="container">' +
      '<div class="footer-grid">' +
        '<div class="footer-brand">' +
          '<a class="brand" href="index.html">' +
            '<span class="brand-mark">' + icon('heart') + '</span>' +
            '<span class="brand-text">' +
              '<span class="brand-name">Zhengzhou Charity</span>' +
              '<span class="brand-sub">Green City · Warm Hearts</span>' +
            '</span>' +
          '</a>' +
          '<p>Connecting every act of kindness with a cause that needs it. ' +
          'Every ticket registered here turns into a meal, a book, or a warmer winter for someone in Zhengzhou.</p>' +
        '</div>' +
        '<div>' +
          '<h4>Explore</h4>' +
          '<ul class="footer-list">' +
            '<li><a href="index.html">Home</a></li>' +
            '<li><a href="search.html">Find an event</a></li>' +
            '<li><a href="search.html">Browse by category</a></li>' +
          '</ul>' +
        '</div>' +
        '<div>' +
          '<h4>Contact</h4>' +
          '<ul class="footer-list">' +
            '<li><a href="mailto:hello@zzcharity.org">hello@zzcharity.org</a></li>' +
            '<li><a href="tel:+8637155550101">+86 371 5555 0101</a></li>' +
            '<li>No.100 Jianshe Road,<br>Zhongyuan District, Zhengzhou</li>' +
          '</ul>' +
        '</div>' +
      '</div>' +
      '<div class="footer-bottom">' +
        '<span>© 2026 Zhengzhou Charity — PROG2002 Assessment 3</span>' +
        '<span>Built with Node.js, Express, MySQL and vanilla JavaScript</span>' +
      '</div>' +
    '</div>';
}

/* ---------------------------------------------------------------------------
   Shared UI blocks
   ------------------------------------------------------------------------ */

/** Fallback chain for event artwork: API image -> stable placeholder. */
function imageAttrs(event, seed, eager) {
  const fallback =
    'https://picsum.photos/seed/' + encodeURIComponent(seed || 'charity') + '/800/500';
  const src = event.image_url ? event.image_url : fallback;
  return (
    'src="' + escapeHtml(src) + '" alt="' + escapeHtml(event.name || 'Charity event') + '" ' +
    (eager ? 'fetchpriority="high"' : 'loading="lazy"') + ' ' +
    'onerror="this.onerror=null;this.src=\'' + fallback + '\'"'
  );
}

function eventCardHTML(event) {
  const meta = statusMeta(event);
  const isPast = event.status === 'past';
  const dateLine = isPast
    ? 'Held on ' + formatDate(event.event_date)
    : formatDate(event.event_date) + ' · ' + formatWeekday(event.event_date);
  const seats =
    Number(event.registration_count) > 0
      ? Number(event.registration_count) +
        (Number(event.registration_count) === 1 ? ' guest' : ' guests')
      : 'Be the first to join';

  return (
    '<article class="card">' +
      '<a class="card-media" href="event.html?eventId=' + event.event_id + '" tabindex="-1" aria-hidden="true">' +
        '<img ' + imageAttrs(event, 'event-' + event.event_id) + '>' +
        '<span class="badge ' + meta.cls + '">' + meta.label + '</span>' +
        '<span class="badge badge-category">' + escapeHtml(event.category_name) + '</span>' +
      '</a>' +
      '<div class="card-body">' +
        '<span class="card-date">' + icon('calendar') + escapeHtml(dateLine) + '</span>' +
        '<h3><a href="event.html?eventId=' + event.event_id + '">' + escapeHtml(event.name) + '</a></h3>' +
        '<p class="card-desc">' + escapeHtml(event.short_description || '') + '</p>' +
        '<div class="card-meta">' +
          '<span class="meta-item">' + icon('pin') + escapeHtml(event.location) + '</span>' +
          '<span class="meta-item">' + icon('users') + escapeHtml(seats) + '</span>' +
        '</div>' +
        '<div class="card-foot">' +
          '<span class="price">' + escapeHtml(priceLabel(event)) +
            (isFreeEvent(event) ? '' : '<small>per ticket</small>') +
          '</span>' +
          '<a class="card-link" href="event.html?eventId=' + event.event_id + '">' +
            (isPast ? 'View recap' : 'View & register') + icon('arrowRight') +
          '</a>' +
        '</div>' +
      '</div>' +
    '</article>'
  );
}

function skeletonCards(count) {
  let html = '';
  for (let i = 0; i < (count || 3); i++) {
    html +=
      '<div class="skeleton-card" aria-hidden="true">' +
        '<div class="skeleton s-media"></div>' +
        '<div class="skeleton s-line short"></div>' +
        '<div class="skeleton s-line"></div>' +
        '<div class="skeleton s-line"></div>' +
      '</div>';
  }
  return html;
}

/** Show an alert inside a container. Pass a string, or {message, details[]}. */
function showAlert(container, type, message, details) {
  if (!container) return;
  const iconName = type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info';
  let body = '<div>' + escapeHtml(message);
  if (details && details.length) {
    body += '<ul>' + details.map((d) => '<li>' + escapeHtml(d) + '</li>').join('') + '</ul>';
  }
  body += '</div>';
  container.innerHTML =
    '<div class="alert alert-' + type + '" role="alert">' + icon(iconName) + body + '</div>';
}

function clearAlert(container) {
  if (container) container.innerHTML = '';
}

function renderEmptyState(container, options) {
  if (!container) return;
  const opts = options || {};
  container.innerHTML =
    '<div class="empty-state">' +
      '<div class="empty-icon">' + icon(opts.icon || 'search') + '</div>' +
      '<h3>' + escapeHtml(opts.title || 'Nothing here yet') + '</h3>' +
      '<p>' + escapeHtml(opts.message || '') + '</p>' +
      (opts.actionHtml || '') +
    '</div>';
}

/** Replace a container with an error panel that offers a retry button. */
function renderErrorState(container, message, onRetry) {
  if (!container) return;
  container.innerHTML =
    '<div class="empty-state">' +
      '<div class="empty-icon">' + icon('alert') + '</div>' +
      '<h3>Something went wrong</h3>' +
      '<p>' + escapeHtml(message) + '</p>' +
      '<button class="btn btn-ghost" type="button" id="retry-btn">' + icon('refresh') + 'Try again</button>' +
    '</div>';
  const retry = document.getElementById('retry-btn');
  if (retry && typeof onRetry === 'function') retry.addEventListener('click', onRetry);
}

/** Read ?eventId= (the A3 parameter) and validate it. */
function getEventIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('eventId') || params.get('id');
  return raw && /^\d+$/.test(raw) ? raw : null;
}
