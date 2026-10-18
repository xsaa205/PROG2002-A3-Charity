/* ============================================================================
   search.js — search page
   ----------------------------------------------------------------------------
   The filter form is deliberately thin: it only builds a query string and hands
   it to GET /api/events/search, whose parameters are
       ?date=YYYY-MM-DD&location=<text>&category=<id>
   Everything the API rejects (bad date, non-numeric category) comes back as a
   400 with a readable message, which is rendered in the alert box.

   The current filters are also written into the page URL, so a search result
   can be bookmarked or shared.
   ========================================================================== */
'use strict';

const searchForm = document.getElementById('search-form');
const searchBtn = document.getElementById('search-btn');
const clearBtn = document.getElementById('clear-btn');
const dateInput = document.getElementById('filter-date');
const locationInput = document.getElementById('filter-location');
const categorySelect = document.getElementById('filter-category');
const resultsBox = document.getElementById('results-container');
const alertBox = document.getElementById('alert-container');
const resultCountEl = document.getElementById('result-count');
const activeFiltersEl = document.getElementById('active-filters');

// The date control is a custom English field (see datepicker.js) — a native
// <input type="date"> shows "yyyy/mm/日" on a Chinese-locale browser.
const dateField = createDateField(dateInput, {
  trigger: document.getElementById('date-open'),
  popup: document.getElementById('date-pop')
});

document.addEventListener('DOMContentLoaded', init);

async function init() {
  renderSiteHeader('search');
  renderSiteFooter();
  bindEvents();

  // Categories first: the select must exist before a ?category= value can be
  // applied to it. A failure here must not block the event search itself.
  await loadCategories();
  applyFiltersFromUrl();
  runSearch();
}

function bindEvents() {
  searchForm.addEventListener('submit', function (event) {
    event.preventDefault();
    runSearch();
  });

  clearBtn.addEventListener('click', clearAllFilters);

  // Chips: clicking one removes that single filter.
  activeFiltersEl.addEventListener('click', function (event) {
    const chip = event.target.closest('[data-clear-filter]');
    if (!chip) return;
    const which = chip.getAttribute('data-clear-filter');
    if (which === 'date') dateField.clear();
    if (which === 'location') locationInput.value = '';
    if (which === 'category') categorySelect.value = '';
    runSearch();
  });
}

/** Reset every filter, including the custom date field's internal state. */
function clearAllFilters() {
  searchForm.reset();
  dateField.refresh();
  runSearch();
}

async function loadCategories() {
  try {
    const result = await apiRequest('/categories');
    const categories = (result && result.data) || [];
    categorySelect.innerHTML =
      '<option value="">All categories</option>' +
      categories
        .map(function (c) {
          return '<option value="' + c.category_id + '">' + escapeHtml(c.name) + '</option>';
        })
        .join('');
  } catch (err) {
    console.error('[search] categories failed', err);
    // Non-fatal: the visitor can still search by date and location.
    categorySelect.innerHTML = '<option value="">All categories</option>';
  }
}

function applyFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('date') && /^\d{4}-\d{2}-\d{2}$/.test(params.get('date'))) {
    dateField.setValue(params.get('date'));
  }
  if (params.get('location')) locationInput.value = params.get('location').slice(0, 100);
  if (params.get('category') && /^\d+$/.test(params.get('category'))) {
    categorySelect.value = params.get('category');
  }
}

/** Sync the address bar with the filters (no page reload, no history spam). */
function syncUrl(params) {
  const qs = params.toString();
  const url = window.location.pathname + (qs ? '?' + qs : '');
  try {
    window.history.replaceState(null, '', url);
  } catch (_) {
    /* file:// in some browsers refuses replaceState — harmless */
  }
}

async function runSearch() {
  clearAlert(alertBox);

  // getValue() returns '' for an empty field and null for text that is not a
  // real calendar date, which keeps the "type anything" field honest.
  const date = dateField.getValue();
  const location = locationInput.value.trim();
  const category = categorySelect.value.trim();

  if (date === null) {
    showAlert(alertBox, 'error', 'Please enter the date as yyyy / mm / dd — for example 2026 / 11 / 08.');
    dateInput.focus();
    return;
  }

  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (location) params.append('location', location);
  if (category) params.append('category', category);
  syncUrl(params);

  renderActiveFilters(date, location, category);
  resultsBox.innerHTML = skeletonCards(3);
  resultCountEl.textContent = 'Searching…';
  searchBtn.disabled = true;

  try {
    const query = params.toString();
    const result = await apiRequest('/events/search' + (query ? '?' + query : ''));
    const events = (result && result.data) || [];

    resultCountEl.innerHTML =
      '<strong>' + events.length + '</strong> ' +
      (events.length === 1 ? 'event matches' : 'events match') +
      (query ? ' your filters' : ' your search') + '.';

    if (events.length === 0) {
      resultsBox.innerHTML = '';
      renderEmptyState(resultsBox, {
        icon: 'search',
        title: 'No events match those filters',
        message: 'Try a wider date range, a different district, or clear the filters to see everything that is on.',
        actionHtml: '<button class="btn btn-primary" type="button" id="empty-clear">Clear all filters</button>'
      });
      const emptyClear = document.getElementById('empty-clear');
      if (emptyClear) {
        emptyClear.addEventListener('click', clearAllFilters);
      }
      return;
    }

    resultsBox.innerHTML = events.map(eventCardHTML).join('');
  } catch (err) {
    console.error('[search] failed', err);
    resultCountEl.textContent = '';
    resultsBox.innerHTML = '';
    renderErrorState(resultsBox, err.message, runSearch);
    showAlert(alertBox, 'error', err.message, err.details);
  } finally {
    searchBtn.disabled = false;
  }
}

function renderActiveFilters(date, location, category) {
  const chips = [];

  if (date) {
    chips.push(chipHTML('date', icon('calendar') + escapeHtml(formatDate(date))));
  }
  if (location) {
    chips.push(chipHTML('location', icon('pin') + escapeHtml(location)));
  }
  if (category) {
    const option = categorySelect.options[categorySelect.selectedIndex];
    const label = option ? option.textContent : 'Category';
    chips.push(chipHTML('category', icon('ticket') + escapeHtml(label)));
  }

  activeFiltersEl.innerHTML = chips.join('');
}

function chipHTML(key, label) {
  return (
    '<button class="chip" type="button" data-clear-filter="' + key + '" ' +
    'aria-label="Remove this filter">' +
    label +
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>' +
    '</button>'
  );
}
