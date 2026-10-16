document.addEventListener('DOMContentLoaded', () => {
  renderNav('home');
  loadHomeEvents();
});

async function loadHomeEvents() {
  const container = document.getElementById('events-container');
  const alertBox  = document.getElementById('alert-container');

  try {
    const result = await fetchJSON(`${API_BASE}/events/home`);
    const events = result.data || [];
    if (events.length === 0) {
      container.innerHTML = `<div class="empty">There are no upcoming events now, please check back later.</div>`;
      return;
    }
    container.innerHTML = events.map(eventCardHTML).join('');
  } catch (err) {
    console.error(err);
    container.innerHTML = '';
    showAlert(alertBox, 'error', `Failed to load events: ${err.message}`);
  }
}
