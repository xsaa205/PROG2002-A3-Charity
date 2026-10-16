document.addEventListener('DOMContentLoaded', () => {
  renderNav('');
  const id = getEventIdFromUrl();
  if (!id) {
    showAlert(document.getElementById('alert-container'), 'error', 'No event selected. Please select an event from home or search page.');
    document.getElementById('event-container').innerHTML = '';
    return;
  }
  loadEvent(id);
  bindModal();
});

function getEventIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  return id && /^\d+$/.test(id) ? id : null;
}

async function loadEvent(id) {
  const container = document.getElementById('event-container');
  const alertBox  = document.getElementById('alert-container');

  try {
    const result = await fetchJSON(`${API_BASE}/events/${id}`);
    const event  = result.data;
    if (!event) throw new Error('Event not found.');
    container.innerHTML = renderEventDetail(event);
  } catch (err) {
    console.error(err);
    container.innerHTML = '';
    showAlert(alertBox, 'error', `Failed to load event: ${err.message}`);
  }
}

function renderEventDetail(e) {
  const statusBadge = e.status === 'upcoming' ? '<span class="badge badge-upcoming">Upcoming</span>' : '<span class="badge badge-past">Ended</span>';
  const priceText = e.is_free == 1 ? '<span class="badge badge-free">Free Admission</span>' : formatCurrency(e.ticket_price);
  const percent = progressPercent(e.raised_amount, e.goal_amount);

  return `
    <div class="event-hero">
      <img src="${escapeHtml(e.image_url)}" alt="${escapeHtml(e.name)}" onerror="this.src='https://picsum.photos/seed/fallback/1200/600'">
      <div class="event-hero-overlay">
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          ${statusBadge}
          <span class="badge badge-category">${escapeHtml(e.category_name)}</span>
        </div>
        <h1>${escapeHtml(e.name)}</h1>
        <div class="meta">📍 ${escapeHtml(e.location)} &nbsp;·&nbsp; 📅 ${escapeHtml(formatDate(e.event_date))} &nbsp;·&nbsp; 🕒 ${escapeHtml(formatTime(e.start_time))} – ${escapeHtml(formatTime(e.end_time))}</div>
      </div>
    </div>

    <div class="detail-grid">
      <div>
        <div class="detail-card">
          <h2>About This Event</h2>
          <p>${escapeHtml(e.full_description || e.short_description || '')}</p>
        </div>
        <div class="detail-card">
          <h2>Date & Location</h2>
          <div class="info-row"><span>Date</span><span>${escapeHtml(formatDate(e.event_date))}</span></div>
          <div class="info-row"><span>Time</span><span>${escapeHtml(formatTime(e.start_time))} – ${escapeHtml(formatTime(e.end_time))}</span></div>
          <div class="info-row"><span>Location</span><span>${escapeHtml(e.location)}</span></div>
          <div class="info-row"><span>Address</span><span>${escapeHtml(e.address || '—')}</span></div>
          <div class="info-row"><span>Category</span><span>${escapeHtml(e.category_name)}</span></div>
        </div>
        <div class="detail-card">
          <h2>Organiser</h2>
          <p><strong>${escapeHtml(e.org_name)}</strong></p>
          <p>${escapeHtml(e.org_mission || '')}</p>
          <div class="info-row"><span>Contact Email</span><span>${escapeHtml(e.contact_email || '—')}</span></div>
          <div class="info-row"><span>Phone</span><span>${escapeHtml(e.phone || '—')}</span></div>
        </div>
      </div>

      <aside>
        <div class="detail-card">
          <h2>Ticket Information</h2>
          <p style="font-size:1.4rem;font-weight:700;">${priceText}</p>
          <button class="btn btn-primary" id="register-btn" style="width:100%;margin-top:10px;">Register to Join</button>
        </div>
        <div class="detail-card">
          <h2>Fundraising Progress</h2>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${percent}%"></div>
          </div>
          <div class="progress-labels">
            <span>Raised: ${formatCurrency(e.raised_amount)}</span>
            <span>Goal: ${formatCurrency(e.goal_amount)}</span>
          </div>
          <p style="margin-top:8px;font-size:0.9rem;color:#6B7280;">${percent}% of target completed</p>
        </div>
      </aside>
    </div>
  `;
}

function bindModal() {
  const modal    = document.getElementById('register-modal');
  const closeBtn = document.getElementById('modal-close');

  document.body.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'register-btn') {
      modal.classList.add('show');
    }
  });

  closeBtn.addEventListener('click', () => modal.classList.remove('show'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('show');
  });
}
     