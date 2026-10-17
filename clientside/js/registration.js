/* ============================================================================
   registration.js — event registration page (A3 Part 3, requirement 2)
   ----------------------------------------------------------------------------
   1. ?eventId= is read from the URL, and GET /api/events/:id supplies the event
      summary shown in the right-hand card, so the visitor always sees exactly
      which event they are registering for.
   2. The form collects name, email, optional phone, registration date and the
      number of tickets — the same fields as the registrations table.
   3. Validation runs in the browser first (inline messages). Valid input is
      POSTed to /api/registrations as JSON.
   4. Every documented outcome has its own screen:
        201 -> confirmation with a booking reference
        409 -> "this email has already registered"
        400 -> the API's validation details, listed one by one
        other / network -> retry message, form content kept
   ========================================================================== */
'use strict';

const MAX_TICKETS = 10;
let currentEvent = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  renderSiteHeader('');
  renderSiteFooter();

  const container = document.getElementById('registration-container');
  const eventId = getEventIdFromUrl();

  if (!eventId) {
    container.innerHTML = '';
    renderEmptyState(container, {
      icon: 'alert',
      title: 'No event selected',
      message: 'Choose an event first, then press “Register for this event” on its detail page.',
      actionHtml: '<a class="btn btn-primary" href="search.html">Browse events</a>'
    });
    return;
  }

  try {
    const result = await apiRequest('/events/' + encodeURIComponent(eventId));
    currentEvent = result && result.data;
    if (!currentEvent) throw Object.assign(new Error('Event not found.'), { status: 404 });

    document.title = 'Register · ' + currentEvent.name + ' | Zhengzhou Charity';

    if (currentEvent.status === 'suspended' || currentEvent.status === 'past') {
      container.innerHTML = renderClosedState(currentEvent);
      return;
    }

    container.innerHTML = renderLayout(currentEvent);
    bindForm(currentEvent);
  } catch (err) {
    console.error('[registration] failed to load event', err);
    container.innerHTML = '';

    if (err.status === 404) {
      renderEmptyState(container, {
        icon: 'search',
        title: 'That event could not be found',
        message: 'The event may have been removed. Browse the current events instead.',
        actionHtml: '<a class="btn btn-primary" href="search.html">Browse events</a>'
      });
      return;
    }

    renderErrorState(container, err.message, init);
  }
}

/* ---------------------------------------------------------------------------
   Screens
   ------------------------------------------------------------------------ */

/** Event exists but cannot be registered for (past or suspended). */
function renderClosedState(event) {
  const past = event.status === 'past';
  return (
    '<div class="state-panel">' +
      '<div class="state-icon warn">' + icon('clock') + '</div>' +
      '<h2>' + (past ? 'Registration has closed' : 'This event is suspended') + '</h2>' +
      '<p>' +
        (past
          ? 'The event ' + escapeHtml(event.name) + ' took place on ' + escapeHtml(formatDate(event.event_date)) + '.'
          : 'The organiser has paused registrations for ' + escapeHtml(event.name) + '.') +
      '</p>' +
      '<div class="state-actions">' +
        '<a class="btn btn-primary" href="event.html?eventId=' + event.event_id + '">View the event</a>' +
        '<a class="btn btn-ghost" href="search.html">Find another event</a>' +
      '</div>' +
    '</div>'
  );
}

/** The form + live summary layout. */
function renderLayout(event) {
  const todayStr = toDateInputValue(new Date());
  const price = isFreeEvent(event) ? 'Free' : formatCurrency(event.ticket_price);
  const seats = Number(event.registration_count) || 0;

  return (
    '<div class="reg-layout">' +
      /* ---------------- form ---------------- */
      '<form class="reg-card" id="registration-form" novalidate>' +
        '<div class="reg-card-head">' +
          '<h2>Your details</h2>' +
          '<p>Fields marked <span class="field-required">*</span> are required. Your email can only be used once for this event.</p>' +
          '<a class="card-link" href="event.html?eventId=' + event.event_id + '" style="margin-top:12px;">' +
            icon('arrowLeft') + 'Back to event details' +
          '</a>' +
        '</div>' +
        '<div class="reg-card-body">' +
          '<div id="form-alert" aria-live="polite"></div>' +

          '<div class="form-section">' +
            '<div class="form-section-title">' + icon('users') + 'About you</div>' +

            '<div class="field" data-field="user_name">' +
              '<label for="user_name">Full name <span class="field-required">*</span></label>' +
              '<input id="user_name" name="user_name" type="text" maxlength="120" autocomplete="name" ' +
                'placeholder="e.g. Alice Chen" required aria-describedby="err-user_name" />' +
              '<span class="field-error" id="err-user_name"></span>' +
            '</div>' +

            '<div class="form-row" style="margin-top:18px;">' +
              '<div class="field" data-field="user_email">' +
                '<label for="user_email">Email <span class="field-required">*</span></label>' +
                '<input id="user_email" name="user_email" type="email" maxlength="150" autocomplete="email" ' +
                  'placeholder="you@example.com" required aria-describedby="err-user_email" />' +
                '<span class="field-error" id="err-user_email"></span>' +
              '</div>' +
              '<div class="field" data-field="user_phone">' +
                '<label for="user_phone">Phone <span class="field-hint" style="text-transform:none;letter-spacing:0;">(optional)</span></label>' +
                '<input id="user_phone" name="user_phone" type="tel" maxlength="30" autocomplete="tel" ' +
                  'placeholder="+86 138 0000 0000" aria-describedby="err-user_phone" />' +
                '<span class="field-error" id="err-user_phone"></span>' +
              '</div>' +
            '</div>' +

            '<div class="field" data-field="registration_date" style="margin-top:18px;">' +
              '<label for="registration_date">Registration date <span class="field-required">*</span></label>' +
              '<input id="registration_date" name="registration_date" type="date" value="' + todayStr + '" ' +
                'max="' + todayStr + '" required aria-describedby="err-registration_date" />' +
              '<span class="field-hint">Defaults to today and cannot be in the future.</span>' +
              '<span class="field-error" id="err-registration_date"></span>' +
            '</div>' +
          '</div>' +

          '<div class="form-section">' +
            '<div class="form-section-title">' + icon('ticket') + 'Tickets</div>' +
            '<div class="field" data-field="num_tickets">' +
              '<div class="ticket-picker">' +
                '<div>' +
                  '<div class="label">Number of tickets</div>' +
                  '<div class="sub">Up to ' + MAX_TICKETS + ' per registration · ' + escapeHtml(price) +
                    (isFreeEvent(event) ? '' : ' each') + '</div>' +
                '</div>' +
                '<div class="stepper">' +
                  '<button type="button" id="ticket-minus" aria-label="One ticket fewer">' + icon('minus') + '</button>' +
                  '<input id="num_tickets" name="num_tickets" type="number" min="1" max="' + MAX_TICKETS + '" ' +
                    'step="1" value="1" inputmode="numeric" aria-label="Number of tickets" aria-describedby="err-num_tickets" />' +
                  '<button type="button" id="ticket-plus" aria-label="One ticket more">' + icon('plus') + '</button>' +
                '</div>' +
              '</div>' +
              '<span class="field-error" id="err-num_tickets"></span>' +
            '</div>' +
          '</div>' +

          '<div class="reg-actions">' +
            '<p class="terms">By confirming you agree to the organiser contacting you about this event. ' +
              'No payment is collected online.</p>' +
            '<button class="btn btn-accent reg-submit" type="submit" id="submit-btn">' +
              'Confirm registration' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</form>' +

      /* ---------------- summary ---------------- */
      '<aside aria-label="Event summary">' +
        '<div class="summary-card">' +
          '<div class="summary-media">' +
            '<img ' + imageAttrs(event, 'event-' + event.event_id, true) + '>' +
            statusBadge(event) +
          '</div>' +
          '<div class="summary-body">' +
            '<span class="summary-label">You are registering for</span>' +
            '<h2 class="summary-title">' + escapeHtml(event.name) + '</h2>' +
            '<div class="summary-rows">' +
              '<div class="summary-row">' + icon('calendar') + '<span>' +
                escapeHtml(formatDate(event.event_date)) + ' · ' + escapeHtml(formatWeekday(event.event_date)) + '</span></div>' +
              '<div class="summary-row">' + icon('clock') + '<span>' +
                escapeHtml(formatTime(event.start_time) || 'Time to be confirmed') +
                (event.end_time ? ' – ' + escapeHtml(formatTime(event.end_time)) : '') + '</span></div>' +
              '<div class="summary-row">' + icon('pin') + '<span>' + escapeHtml(event.location) + '</span></div>' +
              '<div class="summary-row">' + icon('users') + '<span class="js-seat-count">' +
                (seats === 0 ? 'No one has registered yet' : seats + (seats === 1 ? ' guest registered' : ' guests registered')) +
                '</span></div>' +
            '</div>' +

            '<div class="summary-total">' +
              '<div class="summary-line"><span>Ticket price</span><span id="line-price">' + escapeHtml(price) +
                (isFreeEvent(event) ? '' : ' each') + '</span></div>' +
              '<div class="summary-line"><span>Tickets</span><span id="line-tickets">1</span></div>' +
              '<div class="summary-line total"><span>Total</span><span class="value" id="line-total">' +
                escapeHtml(price) + '</span></div>' +
            '</div>' +
          '</div>' +
          '<div class="summary-foot">' + icon('shield') +
            '<span>Your details go straight to the charity events API and appear on the public guest list ' +
            '(email partially hidden).</span>' +
          '</div>' +
        '</div>' +
      '</aside>' +
    '</div>'
  );
}

/* ---------------------------------------------------------------------------
   Form behaviour + validation
   ------------------------------------------------------------------------ */
function bindForm(event) {
  const form = document.getElementById('registration-form');
  const nameInput = document.getElementById('user_name');
  const emailInput = document.getElementById('user_email');
  const phoneInput = document.getElementById('user_phone');
  const dateInput = document.getElementById('registration_date');
  const ticketsInput = document.getElementById('num_tickets');
  const minusBtn = document.getElementById('ticket-minus');
  const plusBtn = document.getElementById('ticket-plus');
  const submitBtn = document.getElementById('submit-btn');
  const formAlert = document.getElementById('form-alert');

  const todayStr = toDateInputValue(new Date());

  /* ---- ticket stepper + live summary ---- */
  function readTickets() {
    const n = parseInt(ticketsInput.value, 10);
    return isNaN(n) ? 1 : n;
  }

  function updateSummary() {
    const tickets = readTickets();
    document.getElementById('line-tickets').textContent = String(tickets);
    const total = document.getElementById('line-total');

    if (isFreeEvent(event)) {
      total.textContent = 'Free';
    } else {
      total.textContent = formatCurrency(Number(event.ticket_price) * tickets);
    }

    minusBtn.disabled = tickets <= 1;
    plusBtn.disabled = tickets >= MAX_TICKETS;
  }

  minusBtn.addEventListener('click', function () {
    ticketsInput.value = String(Math.max(1, readTickets() - 1));
    updateSummary();
    clearFieldError('num_tickets');
  });

  plusBtn.addEventListener('click', function () {
    ticketsInput.value = String(Math.min(MAX_TICKETS, readTickets() + 1));
    updateSummary();
    clearFieldError('num_tickets');
  });

  ticketsInput.addEventListener('input', function () {
    // Keep the box usable while typing, but normalise on blur.
    updateSummary();
  });

  ticketsInput.addEventListener('blur', function () {
    let n = readTickets();
    if (n < 1) n = 1;
    if (n > MAX_TICKETS) n = MAX_TICKETS;
    ticketsInput.value = String(n);
    updateSummary();
  });

  updateSummary();

  /* ---- validation ---- */
  const validators = {
    user_name: function (value) {
      if (!value.trim()) return 'Please enter your full name.';
      if (value.trim().length < 2) return 'Your name needs at least two characters.';
      if (value.trim().length > 120) return 'Your name is too long (120 characters maximum).';
      return '';
    },
    user_email: function (value) {
      if (!value.trim()) return 'Please enter your email address.';
      if (value.length > 150) return 'This email is too long (150 characters maximum).';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())) {
        return 'That does not look like a valid email address.';
      }
      return '';
    },
    user_phone: function (value) {
      if (!value.trim()) return ''; // optional
      if (value.trim().length > 30) return 'Phone numbers are limited to 30 characters.';
      if (!/^[0-9+()\-\s]{6,30}$/.test(value.trim())) {
        return 'Use digits, spaces and + ( ) - only.';
      }
      return '';
    },
    registration_date: function (value) {
      if (!value) return 'Please choose the registration date.';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Use the date picker (YYYY-MM-DD).';
      if (value > todayStr) return 'The registration date cannot be in the future.';
      return '';
    },
    num_tickets: function (value) {
      const n = parseInt(value, 10);
      if (isNaN(n) || !/^\d+$/.test(String(value).trim())) return 'Choose a whole number of tickets.';
      if (n < 1) return 'You need at least one ticket.';
      if (n > MAX_TICKETS) return 'A single registration is limited to ' + MAX_TICKETS + ' tickets.';
      return '';
    }
  };

  const inputs = {
    user_name: nameInput,
    user_email: emailInput,
    user_phone: phoneInput,
    registration_date: dateInput,
    num_tickets: ticketsInput
  };

  function showFieldError(field, message) {
    const wrapper = document.querySelector('[data-field="' + field + '"]');
    const errorEl = document.getElementById('err-' + field);
    if (!wrapper || !errorEl) return;
    wrapper.classList.remove('valid');
    wrapper.classList.toggle('invalid', Boolean(message));
    errorEl.textContent = message || '';
  }

  function clearFieldError(field) {
    showFieldError(field, '');
    const wrapper = document.querySelector('[data-field="' + field + '"]');
    if (wrapper) wrapper.classList.remove('invalid');
  }

  function validateField(field) {
    const message = validators[field](inputs[field].value);
    showFieldError(field, message);
    if (!message) {
      const wrapper = document.querySelector('[data-field="' + field + '"]');
      if (wrapper && inputs[field].value.trim()) wrapper.classList.add('valid');
    }
    return message;
  }

  // Validate on blur, clear the error as soon as the visitor fixes it.
  Object.keys(inputs).forEach(function (field) {
    inputs[field].addEventListener('blur', function () {
      validateField(field);
    });
    inputs[field].addEventListener('input', function () {
      const wrapper = document.querySelector('[data-field="' + field + '"]');
      if (wrapper && wrapper.classList.contains('invalid')) validateField(field);
    });
  });

  /* ---- submit ---- */
  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    clearAlert(formAlert);

    // Guard against a double click / double submit: the button is disabled for
    // the whole request and only re-enabled when a recoverable error comes back.
    if (submitBtn.disabled) return;

    const fields = Object.keys(validators);
    const errors = [];
    fields.forEach(function (field) {
      const message = validateField(field);
      if (message) errors.push({ field: field, message: message });
    });

    if (errors.length) {
      showAlert(
        formAlert,
        'error',
        errors.length === 1
          ? 'Please check one field before confirming.'
          : 'Please check ' + errors.length + ' fields before confirming.',
        errors.map(function (e) { return e.message; })
      );
      const first = document.querySelector('[data-field="' + errors[0].field + '"] input');
      if (first) first.focus();
      return;
    }

    const tickets = parseInt(ticketsInput.value, 10);
    const chosenDate = dateInput.value;

    const body = {
      event_id: Number(event.event_id),
      user_name: nameInput.value.trim(),
      user_email: emailInput.value.trim(),
      num_tickets: tickets
    };

    const phone = phoneInput.value.trim();
    if (phone) body.user_phone = phone;

    // If the visitor kept today's date, let MySQL stamp the exact time so the
    // guest list ordering stays precise. A deliberately back-dated entry is
    // sent as chosen.
    if (chosenDate && chosenDate !== todayStr) body.registration_date = chosenDate;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Reserving…';

    try {
      const result = await apiRequest('/registrations', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      renderSuccess(result && result.data, event, tickets);
    } catch (err) {
      console.error('[registration] submit failed', err);
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Confirm registration';

      if (err.status === 409) {
        renderDuplicate(emailInput.value.trim(), event);
        return;
      }

      if (err.status === 400) {
        showAlert(formAlert, 'error', err.details && err.details.length
          ? 'The server rejected the registration:'
          : (err.message || 'The registration could not be saved.'), err.details);
        return;
      }

      if (err.status === 404) {
        showAlert(formAlert, 'error', 'This event no longer exists, so the registration was not saved.');
        return;
      }

      showAlert(formAlert, 'error', err.message || 'The registration could not be saved. Please try again.');
    }
  });
}

/* ---------------------------------------------------------------------------
   Result screens
   ------------------------------------------------------------------------ */
function renderSuccess(created, event, tickets) {
  const container = document.getElementById('registration-container');
  const pageHead = document.getElementById('page-head');
  if (pageHead) pageHead.style.display = 'none';

  if (!created) {
    renderDuplicate('', event);
    return;
  }

  const reference = 'REG-' + String(created.registration_id).padStart(6, '0');
  const total = isFreeEvent(event)
    ? 'Free'
    : formatCurrency(Number(event.ticket_price) * Number(created.num_tickets || tickets));

  container.innerHTML =
    '<div class="state-panel" role="status">' +
      '<div class="state-icon success">' + icon('check') + '</div>' +
      '<h2 tabindex="-1" id="success-title">You are registered</h2>' +
      '<p>' + escapeHtml(created.user_name) + ', your place at <strong>' +
        escapeHtml(event.name) + '</strong> is confirmed. ' +
        'Show this reference to the organiser when you arrive.</p>' +

      '<div class="receipt">' +
        '<div class="receipt-row"><span>Reference</span><span class="receipt-id">' + escapeHtml(reference) + '</span></div>' +
        '<div class="receipt-row"><span>Event</span><span>' + escapeHtml(event.name) + '</span></div>' +
        '<div class="receipt-row"><span>Date</span><span>' +
          escapeHtml(formatDate(event.event_date)) + ' · ' +
          escapeHtml(formatTime(event.start_time) || 'TBC') + '</span></div>' +
        '<div class="receipt-row"><span>Venue</span><span>' + escapeHtml(event.location) + '</span></div>' +
        '<div class="receipt-row"><span>Name</span><span>' + escapeHtml(created.user_name) + '</span></div>' +
        '<div class="receipt-row"><span>Email</span><span>' + escapeHtml(created.user_email) + '</span></div>' +
        '<div class="receipt-row"><span>Tickets</span><span>' + Number(created.num_tickets) + '</span></div>' +
        '<div class="receipt-row"><span>Total</span><span>' + escapeHtml(total) + '</span></div>' +
        '<div class="receipt-row"><span>Registered</span><span>' +
          escapeHtml(formatDateTime(created.registration_date)) + '</span></div>' +
      '</div>' +

      '<div class="state-actions">' +
        '<a class="btn btn-primary" href="event.html?eventId=' + event.event_id + '">' +
          'See yourself on the guest list' + icon('arrowRight') + '</a>' +
        '<a class="btn btn-ghost" href="index.html">Back to home</a>' +
      '</div>' +
    '</div>';

  const title = document.getElementById('success-title');
  if (title) title.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Keep the summary card consistent if the visitor goes back.
  const seats = document.querySelector('.js-seat-count');
  if (seats) seats.textContent = 'Your registration is confirmed';

  document.title = 'Registration confirmed | Zhengzhou Charity';
}

function renderDuplicate(email, event) {
  const container = document.getElementById('registration-container');
  const pageHead = document.getElementById('page-head');
  if (pageHead) pageHead.style.display = 'none';

  container.innerHTML =
    '<div class="state-panel" role="alert">' +
      '<div class="state-icon warn">' + icon('alert') + '</div>' +
      '<h2 tabindex="-1" id="duplicate-title">You are already on the list</h2>' +
      '<p>' + (email
        ? '<strong>' + escapeHtml(email) + '</strong> has already registered for this event. '
        : 'This email has already registered for this event. ') +
        'Each email address can only register once per event, so the earlier booking stands.</p>' +
      '<div class="state-actions">' +
        '<a class="btn btn-primary" href="event.html?eventId=' + event.event_id + '">' +
          'View the guest list</a>' +
        '<a class="btn btn-ghost" href="search.html">Find another event</a>' +
      '</div>' +
      '<p style="margin-top:22px; font-size:0.82rem;">Need extra tickets? Contact the organiser at ' +
        (event.contact_email
          ? '<a href="mailto:' + escapeHtml(event.contact_email) + '">' + escapeHtml(event.contact_email) + '</a>'
          : 'the organiser') +
        ' and they can amend your booking.</p>' +
    '</div>';

  const title = document.getElementById('duplicate-title');
  if (title) title.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------------------------------------------------------------------------
   Small helpers
   ------------------------------------------------------------------------ */

/** Date -> "YYYY-MM-DD" in the visitor's local timezone (not UTC). */
function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}
