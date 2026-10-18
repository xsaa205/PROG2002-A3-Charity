/* ============================================================================
   form.js — Shared logic for the New and Edit event pages
   ----------------------------------------------------------------------------
   Detects the mode from the URL (?id= present => edit). Loads the category and
   organisation dropdowns, validates the required fields client-side, then calls
   POST /api/events (new) or PUT /api/events/:id (edit). In edit mode it also
   shows the event's registrations (Brief requirement) and supports deleting one.
   ========================================================================== */
'use strict';

const form = document.getElementById('event-form');
const alertHost = document.getElementById('alert-host');
const submitBtn = document.getElementById('submit-btn');
const pageTitle = document.getElementById('page-title');

const params = new URLSearchParams(window.location.search);
const EDIT_ID = params.get('id');
const isEdit = !!EDIT_ID && /^\d+$/.test(EDIT_ID);

const REQUIRED = ['org_id', 'category_id', 'name', 'event_date', 'location'];

/* ---------------------------------------------------------------------------
   Dropdown loading
   --------------------------------------------------------------------------- */
async function loadOptions() {
  const [cats, orgs] = await Promise.all([
    window.admin.api('/categories'),
    window.admin.api('/organisations')
  ]);
  fillSelect('category_id', (cats.data || []).map((c) => ({ value: c.category_id, label: c.name })));
  fillSelect('org_id', (orgs.data || []).map((o) => ({ value: o.org_id, label: o.name })));
}

function fillSelect(id, items) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const current = sel.value;
  items.forEach((it) => {
    const opt = document.createElement('option');
    opt.value = it.value;
    opt.textContent = it.label;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

/* ---------------------------------------------------------------------------
   Populate form in edit mode
   --------------------------------------------------------------------------- */
async function loadEventForEdit() {
  const res = await window.admin.api('/events/' + EDIT_ID);
  const e = res.data;
  if (!e) throw new Error('Event not found.');

  pageTitle.textContent = 'Edit: ' + e.name;
  document.title = 'Edit ' + e.name + ' · Admin Console';

  setVal('org_id', e.org_id);
  setVal('category_id', e.category_id);
  setVal('name', e.name);
  setVal('short_description', e.short_description);
  setVal('full_description', e.full_description);
  setVal('event_date', e.event_date ? String(e.event_date).slice(0, 10) : '');
  setVal('start_time', e.start_time ? String(e.start_time).slice(0, 5) : '');
  setVal('end_time', e.end_time ? String(e.end_time).slice(0, 5) : '');
  setVal('location', e.location);
  setVal('address', e.address);
  setVal('latitude', e.latitude);
  setVal('longitude', e.longitude);
  setVal('ticket_price', e.ticket_price);
  setVal('goal_amount', e.goal_amount);
  setVal('raised_amount', e.raised_amount);
  setVal('image_url', e.image_url);
  setChecked('is_free', Number(e.is_free) === 1);
  setChecked('is_suspended', Number(e.is_suspended) === 1);

  renderRegistrations(e.registrations || []);
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el && v !== null && v !== undefined) el.value = v;
}
function setChecked(id, v) {
  const el = document.getElementById(id);
  if (el) el.checked = !!v;
}

/* ---------------------------------------------------------------------------
   Registrations panel (edit mode)
   --------------------------------------------------------------------------- */
function renderRegistrations(regs) {
  const card = document.getElementById('regs-card');
  const host = document.getElementById('regs-host');
  if (!card || !host) return;
  card.hidden = false;

  if (!regs.length) {
    window.admin.renderEmpty(host, {
      icon: 'users', title: 'No registrations yet', message: 'Nobody has registered for this event.'
    });
    return;
  }

  host.innerHTML =
    '<table class="data"><thead><tr>' +
      '<th>Name</th><th>Email</th><th>Phone</th><th>Date</th><th>Tickets</th>' +
    '</tr></thead><tbody>' +
    regs.map((r) => (
      '<tr>' +
        '<td data-label="Name">' + window.admin.escapeHtml(r.user_name) + '</td>' +
        '<td data-label="Email">' + window.admin.escapeHtml(r.user_email) + '</td>' +
        '<td data-label="Phone">' + window.admin.escapeHtml(r.user_phone || '—') + '</td>' +
        '<td data-label="Date">' + window.admin.escapeHtml(window.admin.formatDate(r.registration_date)) + '</td>' +
        '<td data-label="Tickets"><strong>' + Number(r.num_tickets) + '</strong></td>' +
      '</tr>'
    )).join('') +
    '</tbody></table>';
}

/* ---------------------------------------------------------------------------
   Validation
   --------------------------------------------------------------------------- */
function validate() {
  let ok = true;
  let firstInvalid = null;
  const errors = [];

  REQUIRED.forEach((id) => {
    const el = document.getElementById(id);
    const field = el.closest('.field');
    const val = (el.value || '').trim();
    if (!val) {
      ok = false;
      if (field) { field.classList.add('invalid'); field.querySelector('.err-msg').textContent = 'This field is required.'; }
      errors.push((el.previousElementSibling ? el.previousElementSibling.textContent.replace('*', '').trim() : id) + ' is required.');
      if (!firstInvalid) firstInvalid = el;
    } else if (field) {
      field.classList.remove('invalid');
      field.querySelector('.err-msg').textContent = '';
    }
  });

  // end_time must be after start_time
  const start = document.getElementById('start_time').value;
  const end = document.getElementById('end_time').value;
  if (start && end && end <= start) {
    ok = false;
    const field = document.getElementById('end_time').closest('.field');
    field.classList.add('invalid');
    field.querySelector('.err-msg').textContent = 'End time must be after start time.';
    errors.push('End time must be after start time.');
  }

  return { ok, errors, firstInvalid };
}

function clearFieldErrors() {
  document.querySelectorAll('.field.invalid').forEach((f) => {
    f.classList.remove('invalid');
    const m = f.querySelector('.err-msg'); if (m) m.textContent = '';
  });
}

/* ---------------------------------------------------------------------------
   Build payload
   --------------------------------------------------------------------------- */
function buildPayload() {
  const num = (id) => {
    const v = document.getElementById(id).value;
    if (v === '' || v === null) return 0;
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  };
  const str = (id) => {
    const v = document.getElementById(id).value;
    return v === '' ? null : v.trim();
  };

  return {
    org_id: Number(document.getElementById('org_id').value),
    category_id: Number(document.getElementById('category_id').value),
    name: document.getElementById('name').value.trim(),
    short_description: str('short_description'),
    full_description: str('full_description'),
    event_date: document.getElementById('event_date').value,
    start_time: str('start_time'),
    end_time: str('end_time'),
    location: document.getElementById('location').value.trim(),
    address: str('address'),
    latitude: str('latitude'),
    longitude: str('longitude'),
    ticket_price: num('ticket_price'),
    goal_amount: num('goal_amount'),
    raised_amount: num('raised_amount'),
    image_url: str('image_url'),
    is_free: document.getElementById('is_free').checked ? 1 : 0,
    is_suspended: document.getElementById('is_suspended').checked ? 1 : 0
  };
}

/* ---------------------------------------------------------------------------
   Submit
   --------------------------------------------------------------------------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  window.admin.clearAlert(alertHost);
  clearFieldErrors();

  const { ok, errors, firstInvalid } = validate();
  if (!ok) {
    window.admin.showAlert(alertHost, 'error', 'Please fix the highlighted fields before saving.', errors);
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  const payload = buildPayload();
  submitBtn.disabled = true;
  submitBtn.textContent = isEdit ? 'Saving…' : 'Creating…';

  try {
    if (isEdit) {
      await window.admin.api('/events/' + EDIT_ID, { method: 'PUT', body: JSON.stringify(payload) });
      window.admin.toast('Event updated successfully.', 'success');
    } else {
      const res = await window.admin.api('/events', { method: 'POST', body: JSON.stringify(payload) });
      window.admin.toast('Event created successfully.', 'success');
      if (res && res.data && res.data.event_id) {
        window.location.href = 'edit.html?id=' + res.data.event_id;
        return;
      }
    }
    await loadEventForEditSafe();
  } catch (err) {
    if (err.status === 400 && err.details && err.details.length) {
      window.admin.showAlert(alertHost, 'error', 'The server rejected the submission:', err.details);
      mapServerErrors(err.details);
    } else {
      window.admin.showAlert(alertHost, 'error', err.message || 'Failed to save event.', err.details);
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = isEdit ? 'Save changes' : 'Save event';
  }
});

/** Map API field errors back onto the form fields when possible. */
function mapServerErrors(details) {
  details.forEach((msg) => {
    const m = /^(\w+) (.+)$/.exec(msg);
    const known = ['org_id', 'category_id', 'name', 'location', 'event_date', 'start_time', 'end_time'];
    const key = known.find((k) => msg.indexOf(k) === 0);
    if (key) {
      const field = document.querySelector('[data-field="' + key + '"]');
      if (field) {
        field.classList.add('invalid');
        field.querySelector('.err-msg').textContent = msg;
      }
    }
  });
}

async function loadEventForEditSafe() {
  if (!isEdit) return;
  try { await loadEventForEdit(); } catch (_) { /* keep current values */ }
}

/* ---------------------------------------------------------------------------
   Init
   --------------------------------------------------------------------------- */
window.admin.renderSidebar(isEdit ? 'list' : 'new');

(async () => {
  try {
    await loadOptions();
    if (isEdit) await loadEventForEdit();
  } catch (err) {
    window.admin.showAlert(alertHost, 'error', err.message || 'Failed to load data.', null);
  }
})();
