/* ============================================================================
   datepicker.js — one English date field for the search filters
   ----------------------------------------------------------------------------
   Why this file exists
     A native <input type="date"> borrows the wording of the *browser* locale,
     so on a Chinese-locale browser the empty field reads "yyyy/mm/日". The
     interface is English throughout, so the field has to be ours: a text input
     that shows "yyyy / mm / dd" plus a small calendar popup we render.

   Contract
     dateField = createDateField(input, { trigger: <button>, popup: <div> })
       dateField.getValue()  -> 'YYYY-MM-DD' when the text is a valid date,
                                '' when the field is empty,
                                null when the text cannot be parsed.
       dateField.setValue(iso)   fill the field from a 'YYYY-MM-DD' string
       dateField.clear()         empty the field
       dateField.refresh()       re-read the input after an outside reset (form.reset)

   Accepted typing: 2026/10/18 · 2026-10-18 · 20261018 · 18/10/2026
   Values are normalised to 'YYYY-MM-DD' (what /api/events/search expects) and
   displayed as 'YYYY / MM / DD' (what a reader of this site expects).
   ========================================================================== */
'use strict';

var DATE_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
var DATE_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Date -> 'YYYY-MM-DD' */
function toIsoDate(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

/** 'YYYY-MM-DD' -> 'YYYY / MM / DD' (display only) */
function toDisplayDate(iso) {
  return String(iso).slice(0, 10).split('-').join(' / ');
}

/**
 * Tolerant parser. Returns 'YYYY-MM-DD', '' for an empty field, or null when
 * the text is not a real calendar date (e.g. 31 February).
 */
function parseDateText(text) {
  var raw = String(text == null ? '' : text).trim();
  if (!raw) return '';

  var parts = raw.split(/[^\d]+/).filter(Boolean);
  var digits = raw.replace(/\D/g, '');
  var year, month, day;

  if (parts.length === 3) {
    if (parts[0].length === 4) {
      year = +parts[0];
      month = +parts[1];
      day = +parts[2];
    } else if (parts[2].length === 4) {
      day = +parts[0];
      month = +parts[1];
      year = +parts[2];
    }
  } else if (parts.length === 1 && digits.length === 8) {
    year = +digits.slice(0, 4);
    month = +digits.slice(4, 6);
    day = +digits.slice(6, 8);
  }

  if (!year || !month || !day) return null;

  // Rebuild the date and compare: this rejects 31 April and friends.
  var date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return toIsoDate(date);
}

/** Partial mask so typing "20261018" becomes "2026 / 10 / 18" as you go. */
function maskDateDigits(digits) {
  var out = digits.slice(0, 4);
  if (digits.length > 4) out += ' / ' + digits.slice(4, 6);
  if (digits.length > 6) out += ' / ' + digits.slice(6, 8);
  return out;
}

function createDateField(input, options) {
  var opts = options || {};
  var trigger = opts.trigger;
  var popup = opts.popup;
  if (!input || !trigger || !popup) {
    return {
      getValue: function () { return parseDateText(input && input.value); },
      setValue: function () {},
      clear: function () {},
      refresh: function () {}
    };
  }

  var todayIso = toIsoDate(new Date());
  var selectedIso = parseDateText(input.value) || '';
  var focusIso = selectedIso || todayIso;
  var viewYear = 0;
  var viewMonth = 0;
  var isOpen = false;

  trigger.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>';

  popup.innerHTML =
    '<div class="date-pop-head">' +
      '<span class="date-pop-title" id="date-pop-title"></span>' +
      '<span class="date-nav">' +
        '<button type="button" class="date-nav-btn" data-step="-1" aria-label="Previous month">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>' +
        '</button>' +
        '<button type="button" class="date-nav-btn" data-step="1" aria-label="Next month">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg>' +
        '</button>' +
      '</span>' +
    '</div>' +
    '<div class="date-week" aria-hidden="true">' +
      DATE_WEEKDAYS.map(function (d) { return '<span>' + d + '</span>'; }).join('') +
    '</div>' +
    '<div class="date-grid" role="grid" aria-labelledby="date-pop-title"></div>' +
    '<div class="date-foot">' +
      '<button type="button" data-date-today>Today</button>' +
      '<button type="button" data-date-clear>Clear</button>' +
    '</div>';

  var titleEl = popup.querySelector('#date-pop-title');
  var gridEl = popup.querySelector('.date-grid');

  /* --- rendering ------------------------------------------------------- */

  function syncState() {
    var iso = parseDateText(input.value);
    selectedIso = iso && iso !== '' ? iso : '';
    var field = input.closest('.field');
    if (field) field.classList.toggle('invalid', iso === null);
  }

  function render() {
    titleEl.textContent = DATE_MONTHS[viewMonth] + ' ' + viewYear;

    var first = new Date(viewYear, viewMonth, 1);
    var offset = (first.getDay() + 6) % 7; // Monday first
    var start = new Date(viewYear, viewMonth, 1 - offset);
    var html = '';

    for (var i = 0; i < 42; i++) {
      var day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      var iso = toIsoDate(day);
      var classes = ['date-day'];
      if (day.getMonth() !== viewMonth) classes.push('is-out');
      if (iso === todayIso) classes.push('is-today');
      if (iso === selectedIso) classes.push('is-selected');
      html +=
        '<button type="button" class="' + classes.join(' ') + '" data-iso="' + iso + '" ' +
        'role="gridcell" tabindex="' + (iso === focusIso ? '0' : '-1') + '" ' +
        'aria-selected="' + (iso === selectedIso ? 'true' : 'false') + '" ' +
        'aria-label="' + day.getDate() + ' ' + DATE_MONTHS[day.getMonth()] + ' ' + day.getFullYear() + '">' +
        day.getDate() +
        '</button>';
    }

    gridEl.innerHTML = html;
  }

  function focusDay(iso) {
    var target = gridEl.querySelector('[data-iso="' + iso + '"]');
    if (target) target.focus();
  }

  /* --- open / close ---------------------------------------------------- */

  function open() {
    if (isOpen) return;
    // 'YYYY-MM-DD' would be read as UTC by the Date constructor, so take the
    // month and year straight from the string instead.
    var parts = (selectedIso || todayIso).split('-');
    viewYear = +parts[0];
    viewMonth = +parts[1] - 1;
    focusIso = selectedIso || todayIso;

    popup.hidden = false;
    isOpen = true;
    trigger.setAttribute('aria-expanded', 'true');
    render();

    // Flip above the field when the calendar would run off the bottom edge.
    var rect = input.getBoundingClientRect();
    var spaceBelow = window.innerHeight - rect.bottom;
    var spaceAbove = rect.top;
    popup.classList.toggle(
      'is-up',
      spaceBelow < popup.offsetHeight + 28 && spaceAbove > spaceBelow
    );

    focusDay(focusIso);
  }

  function close() {
    if (!isOpen) return;
    popup.hidden = true;
    isOpen = false;
    trigger.setAttribute('aria-expanded', 'false');
  }

  function emitChange() {
    syncState();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function selectDay(iso) {
    selectedIso = iso;
    focusIso = iso;
    input.value = toDisplayDate(iso);
    close();
    emitChange();
  }

  /* --- events ---------------------------------------------------------- */

  trigger.addEventListener('click', function (event) {
    event.preventDefault();
    if (isOpen) {
      close();
      input.focus();
    } else {
      open();
    }
  });

  gridEl.addEventListener('click', function (event) {
    var cell = event.target.closest('[data-iso]');
    if (cell) selectDay(cell.getAttribute('data-iso'));
  });

  popup.addEventListener('click', function (event) {
    var nav = event.target.closest('[data-step]');
    if (nav) {
      var step = Number(nav.getAttribute('data-step'));
      var next = new Date(viewYear, viewMonth + step, 1);
      viewYear = next.getFullYear();
      viewMonth = next.getMonth();
      render();
      focusDay(focusIso);
      return;
    }
    if (event.target.closest('[data-date-today]')) {
      selectDay(todayIso);
      return;
    }
    if (event.target.closest('[data-date-clear]')) {
      input.value = '';
      selectedIso = '';
      close();
      emitChange();
      input.focus();
    }
  });

  // Roving focus: arrows walk the calendar, PageUp/PageDown change month.
  popup.addEventListener('keydown', function (event) {
    var steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (steps[event.key]) {
      event.preventDefault();
      var current = new Date(focusIso + 'T00:00:00');
      current.setDate(current.getDate() + steps[event.key]);
      focusIso = toIsoDate(current);
      if (current.getMonth() !== viewMonth || current.getFullYear() !== viewYear) {
        viewYear = current.getFullYear();
        viewMonth = current.getMonth();
        render();
      } else {
        Array.prototype.forEach.call(gridEl.children, function (cell) {
          cell.setAttribute('tabindex', cell.getAttribute('data-iso') === focusIso ? '0' : '-1');
        });
      }
      focusDay(focusIso);
      return;
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      var shift = event.key === 'PageUp' ? -1 : 1;
      var moved = new Date(viewYear, viewMonth + shift, 1);
      viewYear = moved.getFullYear();
      viewMonth = moved.getMonth();
      render();
      focusDay(focusIso);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      input.focus();
    }
  });

  // Typing: keep the "YYYY / MM / DD" shape when the caret sits at the end.
  input.addEventListener('input', function () {
    if (/^[\d\s\/-]*$/.test(input.value)) {
      var atEnd = input.selectionStart === input.value.length;
      var digits = input.value.replace(/\D/g, '').slice(0, 8);
      var masked = maskDateDigits(digits);
      if (masked !== input.value) {
        input.value = masked;
        if (atEnd) {
          try { input.setSelectionRange(masked.length, masked.length); } catch (_) { /* ignore */ }
        }
      }
    }
    syncState();
    if (isOpen) {
      var iso = parseDateText(input.value);
      if (iso) {
        selectedIso = iso;
        focusIso = iso;
        render();
      }
    }
  });

  input.addEventListener('blur', function () {
    var iso = parseDateText(input.value);
    if (iso) input.value = toDisplayDate(iso); // normalise after free typing
    syncState();
  });

  input.addEventListener('focus', function () {
    // Typing over a filled field is common on this page; select it all.
    input.select();
  });

  document.addEventListener('click', function (event) {
    if (!isOpen) return;
    if (popup.contains(event.target) || trigger.contains(event.target)) return;
    close();
  });

  document.addEventListener('keydown', function (event) {
    if (isOpen && event.key === 'Escape') {
      close();
      input.focus();
    }
  });

  /* --- public surface -------------------------------------------------- */

  return {
    getValue: function () {
      return parseDateText(input.value);
    },
    setValue: function (iso) {
      var parsed = parseDateText(iso);
      input.value = parsed ? toDisplayDate(parsed) : '';
      selectedIso = parsed || '';
      focusIso = selectedIso || todayIso;
      syncState();
    },
    clear: function () {
      input.value = '';
      selectedIso = '';
      syncState();
    },
    refresh: function () {
      var iso = parseDateText(input.value);
      selectedIso = iso || '';
      focusIso = selectedIso || todayIso;
      syncState();
    }
  };
}
