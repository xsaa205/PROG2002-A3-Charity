const API_BASE = 'http://localhost:3000/api';

function renderNav(activePage) {
  const placeholder = document.getElementById('nav-placeholder');
  if (!placeholder) return;
  const link = (href, label, key) =>
    `<li><a href="${href}" class="${activePage === key ? 'active' : ''}">${label}</a></li>`;
  placeholder.innerHTML = `
    <nav class="navbar">
      <div class="nav-container">
        <a href="index.html" class="logo">🌟 Zhengzhou Charity</a>
        <ul class="nav-links">
          ${link('index.html', 'Home', 'home')}
          ${link('search.html', 'Search Events', 'search')}
        </ul>
      </div>
    </nav>
  `;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  let body = null;
  try { body = await res.json(); } catch (_) {}
  if (!res.ok) {
    const message = (body && body.error) || `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return body;
}

function formatCurrency(amount) {
  const n = Number(amount) || 0;
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function progressPercent(raised, goal) {
  const r = Number(raised) || 0;
  const g = Number(goal) || 0;
  if (g <= 0) return 0;
  return Math.min(100, Math.round((r / g) * 100));
}

function showAlert(container, type, message) {
  if (!container) return;
  container.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
}

function clearAlert(container) {
  if (container) container.innerHTML = '';
}

function eventCardHTML(event) {
  const badgeClass = event.status === 'upcoming' ? 'badge-upcoming' : 'badge-past';
  const badgeText  = event.status === 'upcoming' ? 'Upcoming' : 'Past';
  const priceText = event.is_free == 1 ? '<span class="badge badge-free">Free</span>' : formatCurrency(event.ticket_price);

  return `
    <article class="card">
      <img src="${escapeHtml(event.image_url || 'https://picsum.photos/seed/placeholder/800/500')}" alt="${escapeHtml(event.name)}" onerror="this.src='https://picsum.photos/seed/fallback/800/500'">
      <div class="card-body">
        <div class="card-meta">
          <span class="badge ${badgeClass}">${badgeText}</span>
          <span class="badge badge-category">${escapeHtml(event.category_name)}</span>
        </div>
        <h3>${escapeHtml(event.name)}</h3>
        <div class="card-meta">
          <span>📍 ${escapeHtml(event.location)}</span>
          <span>📅 ${escapeHtml(formatDate(event.event_date))}</span>
        </div>
        <p class="card-desc">${escapeHtml(event.short_description || '')}</p>
        <div class="card-meta"><strong>${priceText}</strong></div>
        <a class="btn btn-primary" href="event.html?id=${event.event_id}">View details →</a>
      </div>
    </article>
  `;
}