/* ============================================================================
   common.js — shared helpers for the admin-side site
   ----------------------------------------------------------------------------
   Responsibilities
     * one place that talks to the REST API (fetch + JSON + error shape)
     * the staff sidebar navigation, rendered on every page
     * status badges (Active / Past / Suspended)
     * toast + inline alert helpers
     * formatting helpers (dates, times, money, numbers)
     * inline SVG icons (shared visual language with the client site)

   Pages (list.js, form.js) call these functions; no framework is used.
   ========================================================================== */
'use strict';

const ADMIN_API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || 'http://localhost:3000/api';

/* ---------------------------------------------------------------------------
   Inline SVG icons
   ------------------------------------------------------------------------ */
const ADMIN_ICONS = {
  heart: '<path d="M12 20.5s-7.5-4.6-7.5-10A4.8 4.8 0 0 1 12 7.2a4.8 4.8 0 0 1 7.5 3.3c0 5.4-7.5 10-7.5 10Z" fill="currentColor" stroke="none"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  ticket: '<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z"/><path d="M14 6v12" stroke-dasharray="2 3"/>',
  users: '<path d="M16 19v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 17.5V19"/><circle cx="10" cy="7.5" r="3.5"/><path d="M20 19v-1.5a4 4 0 0 0-3-3.87"/><path d="M15.5 4.2a3.5 3.5 0 0 1 0 6.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9a2 2 0 0 0-3-3L5 17v3Z"/><path d="m14 7 3 3"/>',
  trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
  arrowRight: '<path d="M5 12h13M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H6M11 18l-6-6 6-6"/>',
  check: '<path d="M4 12.5 9.5 18 20 6.5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  sparkle: '<path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9 12 3.5Z"/>',
  shield: '<path d="M12 3.5 5 6.5v5c0 4.4 3 8.2 7 9.5 4-1.3 7-5.1 7-9.5v-5l-7-3Z"/><path d="m9 12 2 2 4-4"/>'
};

function adminIcon(name, extraClass) {
  const body = ADMIN_ICONS[name] || ADMIN_ICONS.info;
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="' +
    (extraClass || '') + '">' + body + '</svg>'
  );
}

/* ---------------------------------------------------------------------------
   API layer
   ------------------------------------------------------------------------ */
async function adminApi(path, options) {
  const opts = options || {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  const headers = Object.assign({}, opts.headers || {});
  if (opts.body) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetch(ADMIN_API_BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body,
      signal: controller.signal
    });
    const text = await res.text();
    let payload = null;
    if (text) { try { payload = JSON.parse(text); } catch (_) { payload = null; } }

    if (!res.ok) {
      const err = new Error((payload && payload.error) || 'The server returned HTTP ' + res.status + '.');
      err.status = res.status;
      err.details = (payload && payload.details) || [];
      err.payload = payload;
      throw err;
    }
    return payload;
  } catch (err) {
    if (err && err.name === 'AbortError') {
      const t = new Error('The request took too long. Please try again.'); t.status = 0; throw t;
    }
    if (err instanceof TypeError) {
      const o = new Error('Could not reach the server. Please check your connection and try again.'); o.status = 0; throw o;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------------------
   Formatting helpers
   ------------------------------------------------------------------------ */
function adminEscapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function adminParseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const p = String(value).slice(0, 10).split('-').map(Number);
  if (p.length !== 3 || p.some(isNaN)) return null;
  return new Date(p[0], p[1] - 1, p[2]);
}

function adminFormatDate(value) {
  const d = adminParseDate(value);
  return d ? d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

function adminFormatTime(value) {
  if (!value) return '';
  const parts = String(value).split(':');
  const h = Number(parts[0]); const m = Number(parts[1] || 0);
  if (isNaN(h)) return '';
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
}

function adminFormatCurrency(value) {
  const n = Number(value) || 0;
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function adminIsFree(event) {
  return Number(event.is_free) === 1 || Number(event.ticket_price) === 0;
}

function adminPriceLabel(event) {
  return adminIsFree(event) ? 'Free' : adminFormatCurrency(event.ticket_price);
}

/** Status badge meta for the admin site (Active = upcoming & not suspended). */
function adminStatusMeta(event) {
  if (Number(event.is_suspended) === 1) return { cls: 'badge-suspended', label: 'Suspended' };
  if (event.status === 'past' || (event.event_date && adminParseDate(event.event_date) < new Date(new Date().toDateString()))) {
    return { cls: 'badge-past', label: 'Past' };
  }
  return { cls: 'badge-upcoming', label: 'Active' };
}

function adminStatusBadge(event) {
  const meta = adminStatusMeta(event);
  return '<span class="badge ' + meta.cls + '">' + meta.label + '</span>';
}

/* ---------------------------------------------------------------------------
   Sidebar navigation (rendered on every admin page)
   ------------------------------------------------------------------------ */
function renderAdminSidebar(activePage) {
  const host = document.getElementById('sidebar-nav');
  if (!host) return;

  const item = (href, label, key, iconName) =>
    '<li><a href="' + href + '" class="' + (activePage === key ? 'active' : '') +
    '"' + (activePage === key ? ' aria-current="page"' : '') + '>' +
    adminIcon(iconName) + '<span>' + label + '</span></a></li>';

  host.innerHTML =
    '<div class="brand">' +
      '<span class="brand-mark">' + adminIcon('heart') + '</span>' +
      '<span class="brand-text">' +
        '<span class="brand-name">Zhengzhou Charity</span>' +
        '<span class="brand-sub">Admin Console</span>' +
      '</span>' +
    '</div>' +
    '<nav aria-label="Admin">' +
      '<ul class="nav-list">' +
        item('index.html', 'All events', 'list', 'list') +
        item('new.html', 'Add event', 'new', 'plus') +
      '</ul>' +
    '</nav>' +
    '<div class="sidebar-foot">' +
      '<a class="ghost-link" href="../clientside/index.html" target="_blank" rel="noopener">' +
        adminIcon('arrowRight') + ' View public site</a>' +
    '</div>';

  // Mobile top bar toggle (sidebar collapses into a drawer on small screens).
  const toggle = document.getElementById('sidebar-toggle');
  const layout = document.getElementById('admin-layout');
  if (toggle && layout) {
    toggle.addEventListener('click', () => layout.classList.toggle('sidebar-open'));
  }
}

/* ---------------------------------------------------------------------------
   Toast + inline alerts
   ------------------------------------------------------------------------ */
function showAdminToast(message, type) {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast toast-' + (type || 'info');
  el.innerHTML = adminIcon(type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info') + '<span>' + adminEscapeHtml(message) + '</span>';
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 300);
  }, 3600);
}

function showAdminAlert(container, type, message, details) {
  if (!container) return;
  const iconName = type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info';
  let body = '<div>' + adminEscapeHtml(message);
  if (details && details.length) {
    body += '<ul>' + details.map((d) => '<li>' + adminEscapeHtml(d) + '</li>').join('') + '</ul>';
  }
  body += '</div>';
  container.innerHTML = '<div class="alert alert-' + type + '" role="alert">' + adminIcon(iconName) + body + '</div>';
}

function clearAdminAlert(container) {
  if (container) container.innerHTML = '';
}

/* ---------------------------------------------------------------------------
   Empty / error / loading states
   ------------------------------------------------------------------------ */
function renderAdminEmpty(container, opts) {
  const o = opts || {};
  container.innerHTML =
    '<div class="empty-state">' +
      '<div class="empty-icon">' + adminIcon(o.icon || 'search') + '</div>' +
      '<h3>' + adminEscapeHtml(o.title || 'Nothing here yet') + '</h3>' +
      '<p>' + adminEscapeHtml(o.message || '') + '</p>' +
      (o.actionHtml || '') +
    '</div>';
}

function renderAdminError(container, message, onRetry) {
  container.innerHTML =
    '<div class="empty-state">' +
      '<div class="empty-icon">' + adminIcon('alert') + '</div>' +
      '<h3>Something went wrong</h3>' +
      '<p>' + adminEscapeHtml(message) + '</p>' +
      '<button class="btn btn-ghost" type="button" id="retry-btn">' + adminIcon('refresh') + 'Try again</button>' +
    '</div>';
  const btn = document.getElementById('retry-btn');
  if (btn && typeof onRetry === 'function') btn.addEventListener('click', onRetry);
}

function adminSkeletonRows(count) {
  let html = '';
  for (let i = 0; i < (count || 4); i++) {
    html += '<tr class="skeleton-row"><td colspan="6"><div class="skeleton s-line"></div></td></tr>';
  }
  return html;
}

/* Expose helpers to the page scripts (kept in global scope for simplicity,
   matching the client site's approach — no bundler/framework). */
window.admin = {
  icon: adminIcon,
  api: adminApi,
  escapeHtml: adminEscapeHtml,
  formatDate: adminFormatDate,
  formatTime: adminFormatTime,
  formatCurrency: adminFormatCurrency,
  priceLabel: adminPriceLabel,
  isFree: adminIsFree,
  statusMeta: adminStatusMeta,
  statusBadge: adminStatusBadge,
  renderSidebar: renderAdminSidebar,
  toast: showAdminToast,
  showAlert: showAdminAlert,
  clearAlert: clearAdminAlert,
  renderEmpty: renderAdminEmpty,
  renderError: renderAdminError,
  skeletonRows: adminSkeletonRows
};
