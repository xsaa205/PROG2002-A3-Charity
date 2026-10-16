document.addEventListener('DOMContentLoaded', () => {
  renderNav('search');
  loadCategories();
  bindFormEvents();
  runSearch();
});

const searchForm      = document.getElementById('search-form');
const clearBtn        = document.getElementById('clear-btn');
const dateInput       = document.getElementById('filter-date');
const locationInput   = document.getElementById('filter-location');
const categorySelect  = document.getElementById('filter-category');
const resultsBox      = document.getElementById('results-container');
const alertBox        = document.getElementById('alert-container');
const resultCountEl   = document.getElementById('result-count');

async function loadCategories() {
  try {
    const result = await fetchJSON(`${API_BASE}/categories`);
    const categories = result.data || [];
    categorySelect.innerHTML =
      `<option value="">All Categories</option>` +
      categories.map(c => `<option value="${c.category_id}">${escapeHtml(c.name)}</option>`).join('');
  } catch (err) {
    console.error('Failed to load categories', err);
    showAlert(alertBox, 'error', `Failed to load categories: ${err.message}`);
  }
}

function bindFormEvents() {
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    runSearch();
  });

  clearBtn.addEventListener('click', () => {
    searchForm.reset();
    clearAlert(alertBox);
    resultCountEl.textContent = '';
    runSearch();
  });
}

async function runSearch() {
  clearAlert(alertBox);
  resultsBox.innerHTML = `<div class="loading">Searching…</div>`;

  const params = new URLSearchParams();
  const date     = dateInput.value.trim();
  const location = locationInput.value.trim();
  const category = categorySelect.value.trim();

  if (date)
    params.append('date', date);
  if (location) params.append('location', location);
  if (category) params.append('category', category);

  if (date && isNaN(new Date(date).getTime())) {
    resultsBox.innerHTML = '';
    showAlert(alertBox, 'error', 'Please enter a valid date.');
    return;
  }

  try {
    const result = await fetchJSON(`${API_BASE}/events/search?${params.toString()}`);
    const events = result.data || [];

    if (events.length === 0) {
      resultsBox.innerHTML = '';
      resultCountEl.textContent = '0 events found';
      showAlert(alertBox, 'info', 'No events match your search criteria, please try different filters.');
      return;
    }

    resultCountEl.textContent = `${events.length} events found`;
    resultsBox.innerHTML = events.map(eventCardHTML).join('');
  } catch (err) {
    console.error(err);
    resultsBox.innerHTML = '';
    resultCountEl.textContent = '';
    showAlert(alertBox, 'error', `Search failed: ${err.message}`);
  }
}
