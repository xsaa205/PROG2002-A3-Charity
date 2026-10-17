// ============================================================================
// routes/events.js
// ----------------------------------------------------------------------------
// RESTful endpoints for the charity EVENTS resource (PROG2002 A3, Part 2).
//
//   GET    /api/events                    -> list events (admin: all statuses)
//   GET    /api/events/home               -> public home page list
//   GET    /api/events/search             -> public search with filters
//   GET    /api/events/:id                -> single event + its registrations
//   GET    /api/events/:id/registrations  -> registrations for one event
//   POST   /api/events                    -> create a new event
//   PUT    /api/events/:id                -> update an existing event
//   DELETE /api/events/:id                -> delete an event (409 if it has
//                                            any registrations)
//
// All handlers use the shared promise-based MySQL pool (../event_db) and the
// validation helpers in ../utils/validate.
// ============================================================================
'use strict';

const express = require('express');
const router = express.Router();
const db = require('../event_db');
const v = require('../utils/validate');

// ----------------------------------------------------------------------------
// Reusable SELECT fragments
// ----------------------------------------------------------------------------

// Public list (home / search): only non-suspended events, status = upcoming|past.
const PUBLIC_LIST_SELECT = `
  SELECT
    e.event_id, e.org_id, e.category_id, e.name, e.short_description, e.event_date,
    e.start_time, e.location, e.ticket_price, e.is_free, e.goal_amount, e.raised_amount,
    e.image_url, c.name AS category_name, o.name AS org_name,
    CASE WHEN e.event_date >= CURDATE() THEN 'upcoming' ELSE 'past' END AS status,
    (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.event_id) AS registration_count,
    (SELECT COALESCE(SUM(r.num_tickets), 0) FROM registrations r WHERE r.event_id = e.event_id) AS tickets_sold
  FROM events e
  JOIN categories c ON e.category_id = c.category_id
  JOIN organisations o ON e.org_id = o.org_id
  WHERE e.is_suspended = 0
`;

// Admin list: ALL events regardless of status (Active, Past, Suspended) plus
// registration counts so the admin List page has everything it needs.
const ADMIN_LIST_SELECT = `
  SELECT
    e.event_id, e.org_id, e.category_id, e.name, e.short_description, e.event_date,
    e.start_time, e.end_time, e.location, e.address, e.latitude, e.longitude,
    e.ticket_price, e.is_free, e.goal_amount, e.raised_amount, e.image_url,
    e.is_suspended, c.name AS category_name, o.name AS org_name,
    CASE
      WHEN e.is_suspended = 1 THEN 'suspended'
      WHEN e.event_date >= CURDATE() THEN 'upcoming'
      ELSE 'past'
    END AS status,
    (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.event_id) AS registration_count,
    (SELECT COALESCE(SUM(r.num_tickets), 0) FROM registrations r WHERE r.event_id = e.event_id) AS tickets_sold
  FROM events e
  JOIN categories c ON e.category_id = c.category_id
  JOIN organisations o ON e.org_id = o.org_id
`;

// Full detail for one event (includes suspended so the admin Update page works).
const DETAIL_SELECT = `
  SELECT
    e.event_id, e.org_id, e.category_id, e.name, e.short_description, e.full_description,
    e.event_date, e.start_time, e.end_time, e.location, e.address, e.latitude, e.longitude,
    e.ticket_price, e.is_free, e.goal_amount, e.raised_amount, e.image_url,
    e.is_suspended, e.created_at,
    c.name AS category_name,
    o.name AS org_name, o.mission AS org_mission, o.contact_email, o.phone,
    CASE
      WHEN e.is_suspended = 1 THEN 'suspended'
      WHEN e.event_date >= CURDATE() THEN 'upcoming'
      ELSE 'past'
    END AS status
  FROM events e
  JOIN categories c ON e.category_id = c.category_id
  JOIN organisations o ON e.org_id = o.org_id
  WHERE e.event_id = ?
`;

// Registrations for one event, newest purchase first (required by A3 Part 3).
const REGISTRATIONS_SELECT = `
  SELECT registration_id, event_id, user_name, user_email, user_phone,
         registration_date, num_tickets, created_at
  FROM registrations
  WHERE event_id = ?
  ORDER BY registration_date DESC, registration_id DESC
`;

// ----------------------------------------------------------------------------
// Event column list + defaults, used for both INSERT and UPDATE.
// ----------------------------------------------------------------------------
const EVENT_COLUMNS = [
  'org_id', 'category_id', 'name', 'short_description', 'full_description',
  'event_date', 'start_time', 'end_time', 'location', 'address',
  'latitude', 'longitude', 'ticket_price', 'is_free',
  'goal_amount', 'raised_amount', 'image_url', 'is_suspended'
];

// Defaults used for POST (required fields left undefined so they are caught).
const EVENT_DEFAULTS = {
  org_id: undefined,
  category_id: undefined,
  name: undefined,
  short_description: null,
  full_description: null,
  event_date: undefined,
  start_time: null,
  end_time: null,
  location: undefined,
  address: null,
  latitude: null,
  longitude: null,
  ticket_price: 0,
  is_free: 0,
  goal_amount: 0,
  raised_amount: 0,
  image_url: null,
  is_suspended: 0
};

// ----------------------------------------------------------------------------
// assembleEvent()
//   Merge the request body onto a base record (the defaults for POST or the
//   existing row for PUT), normalising and validating every field.
//   Returns { values, errors }.
// ----------------------------------------------------------------------------
function assembleEvent(input, base) {
  const errors = [];
  const out = { ...base };
  const has = (key) => Object.prototype.hasOwnProperty.call(input, key);

  // --- required integer references ---
  if (has('org_id')) {
    if (!v.isPositiveInt(input.org_id)) errors.push('org_id must be a positive integer.');
    else out.org_id = Number(input.org_id);
  }
  if (has('category_id')) {
    if (!v.isPositiveInt(input.category_id)) errors.push('category_id must be a positive integer.');
    else out.category_id = Number(input.category_id);
  }

  // --- required text ---
  if (has('name')) {
    if (!v.isNonEmptyString(input.name, 200)) errors.push('name is required and must be at most 200 characters.');
    else out.name = input.name.trim();
  }
  if (has('location')) {
    if (!v.isNonEmptyString(input.location, 150)) errors.push('location is required and must be at most 150 characters.');
    else out.location = input.location.trim();
  }

  // --- required date ---
  if (has('event_date')) {
    if (!v.isValidDate(input.event_date)) errors.push('event_date must be a valid date in YYYY-MM-DD format.');
    else out.event_date = input.event_date;
  }

  // --- optional free-text fields ---
  const optionalStrings = [
    ['short_description', 255], ['full_description', null],
    ['address', 255], ['image_url', 500]
  ];
  for (const [key, max] of optionalStrings) {
    if (!has(key)) continue;
    if (input[key] === null || input[key] === '') { out[key] = null; continue; }
    if (typeof input[key] !== 'string') { errors.push(`${key} must be a string.`); continue; }
    if (max && input[key].length > max) { errors.push(`${key} must be at most ${max} characters.`); continue; }
    out[key] = input[key].trim();
  }

  // --- optional TIME fields ---
  for (const key of ['start_time', 'end_time']) {
    if (!has(key)) continue;
    if (input[key] === null || input[key] === '') { out[key] = null; continue; }
    if (!v.isValidTime(input[key])) { errors.push(`${key} must be in HH:MM or HH:MM:SS format.`); continue; }
    out[key] = v.normalizeTime(input[key]);
  }

  // --- optional money fields ---
  for (const key of ['ticket_price', 'goal_amount', 'raised_amount']) {
    if (!has(key)) continue;
    const n = (input[key] === null || input[key] === '') ? 0 : v.toNumber(input[key]);
    if (Number.isNaN(n) || n < 0) { errors.push(`${key} must be a number greater than or equal to 0.`); continue; }
    out[key] = n;
  }

  // --- optional geo coordinates ---
  for (const key of ['latitude', 'longitude']) {
    if (!has(key)) continue;
    if (input[key] === null || input[key] === '') { out[key] = null; continue; }
    const n = v.toNumber(input[key]);
    if (Number.isNaN(n)) { errors.push(`${key} must be a number.`); continue; }
    out[key] = n;
  }

  // --- optional 0/1 flags ---
  for (const key of ['is_free', 'is_suspended']) {
    if (!has(key)) continue;
    const b = v.toBool01(input[key]);
    if (b === null) { errors.push(`${key} must be 0 or 1.`); continue; }
    out[key] = b;
  }

  // --- chronological consistency: the event must not end before it starts ---
  if (out.start_time && out.end_time && out.end_time <= out.start_time) {
    errors.push('end_time must be later than start_time.');
  }

  // --- final required check (covers POST where nothing was supplied) ---
  if (out.org_id == null) errors.push('org_id is required.');
  if (out.category_id == null) errors.push('category_id is required.');
  if (!out.name) errors.push('name is required.');
  if (!out.event_date) errors.push('event_date is required.');
  if (!out.location) errors.push('location is required.');

  return { values: out, errors };
}

// ----------------------------------------------------------------------------
// fetchEventDetail()
//   Load one event plus its registration list (newest first) and summary counts.
// ----------------------------------------------------------------------------
async function fetchEventDetail(id) {
  const [[event]] = await db.query(DETAIL_SELECT, [id]);
  if (!event) return null;

  const [registrations] = await db.query(REGISTRATIONS_SELECT, [id]);
  const ticketsSold = registrations.reduce((sum, r) => sum + Number(r.num_tickets || 0), 0);

  return {
    ...event,
    registrations,
    registration_count: registrations.length,
    tickets_sold: ticketsSold
  };
}

// ============================================================================
// GET /api/events
//   List events. By default returns EVERY event (the admin List page needs
//   Active + Past + Suspended). Optional filters keep the endpoint flexible:
//     ?status=upcoming|past|suspended|active|all   (default: all)
//     ?category=<category_id>   ?location=<text>
// ============================================================================
router.get('/', async (req, res) => {
  const { status = 'all', category, location, limit, offset } = req.query;

  if (category && !v.isPositiveInt(category)) {
    return res.status(400).json({ error: 'Invalid category ID.' });
  }
  if (limit !== undefined && !/^\d+$/.test(String(limit))) {
    return res.status(400).json({ error: 'Invalid limit. Use a non-negative integer.' });
  }
  if (offset !== undefined && !/^\d+$/.test(String(offset))) {
    return res.status(400).json({ error: 'Invalid offset. Use a non-negative integer.' });
  }

  // Filters are collected once so the data query and the count query always
  // agree on which rows are in scope.
  const filters = [];
  const params = [];

  if (status === 'upcoming') filters.push('e.is_suspended = 0 AND e.event_date >= CURDATE()');
  else if (status === 'past') filters.push('e.is_suspended = 0 AND e.event_date < CURDATE()');
  else if (status === 'suspended') filters.push('e.is_suspended = 1');
  else if (status === 'active') filters.push('e.is_suspended = 0');
  else if (status !== 'all') {
    return res.status(400).json({ error: 'Invalid status filter. Use upcoming, past, suspended, active or all.' });
  }

  if (category) { filters.push('e.category_id = ?'); params.push(category); }
  if (location && String(location).trim() !== '') {
    filters.push('e.location LIKE ?'); params.push(`%${String(location).trim()}%`);
  }

  const whereSql = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';

  let sql = `${ADMIN_LIST_SELECT}${whereSql} ORDER BY e.event_date ASC, e.event_id ASC`;
  const dataParams = [...params];

  // Optional pagination (?limit=&offset=). Without them every matching event is
  // returned, which is what the admin List page needs for this dataset size.
  if (limit !== undefined) {
    sql += ' LIMIT ? OFFSET ?';
    dataParams.push(Number(limit), Number(offset || 0));
  }

  try {
    const [rows] = await db.query(sql, dataParams);

    // Total number of matching rows, independent of pagination.
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM events e${whereSql}`,
      params
    );

    res.json({ count: rows.length, total, data: rows });
  } catch (err) {
    console.error('[GET /api/events]', err);
    res.status(500).json({ error: 'Failed to retrieve events.' });
  }
});

// ============================================================================
// GET /api/events/home
//   Public home page list (upcoming first, then past; suspended excluded).
// ============================================================================
router.get('/home', async (req, res) => {
  try {
    const sql = `
      ${PUBLIC_LIST_SELECT}
      ORDER BY
        CASE WHEN e.event_date >= CURDATE() THEN 0 ELSE 1 END,
        e.event_date ASC
    `;
    const [rows] = await db.query(sql);
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    console.error('[GET /api/events/home]', err);
    res.status(500).json({ error: 'Failed to retrieve home events.' });
  }
});

// ============================================================================
// GET /api/events/search?date=&location=&category=
//   Public search with optional filters and format validation.
// ============================================================================
router.get('/search', async (req, res) => {
  const { date, location, category } = req.query;

  if (date && !v.isValidDate(date)) {
    return res.status(400).json({ error: 'Invalid date format, please use YYYY-MM-DD.' });
  }
  if (category && !v.isPositiveInt(category)) {
    return res.status(400).json({ error: 'Invalid category ID.' });
  }

  let sql = PUBLIC_LIST_SELECT;
  const params = [];

  if (date) { sql += ' AND e.event_date = ?'; params.push(date); }
  if (location && String(location).trim() !== '') {
    sql += ' AND e.location LIKE ?'; params.push(`%${String(location).trim()}%`);
  }
  if (category) { sql += ' AND e.category_id = ?'; params.push(category); }

  sql += `
    ORDER BY
      CASE WHEN e.event_date >= CURDATE() THEN 0 ELSE 1 END,
      e.event_date ASC
  `;

  try {
    const [rows] = await db.query(sql, params);
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    console.error('[GET /api/events/search]', err);
    res.status(500).json({ error: 'Failed to search events.' });
  }
});

// ============================================================================
// GET /api/events/:id/registrations
//   Registrations for a single event, newest purchase first.
// ============================================================================
router.get('/:id/registrations', async (req, res) => {
  const { id } = req.params;
  if (!v.isPositiveInt(id)) return res.status(400).json({ error: 'Invalid event ID.' });

  try {
    const [[event]] = await db.query('SELECT event_id FROM events WHERE event_id = ?', [id]);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const [rows] = await db.query(REGISTRATIONS_SELECT, [id]);
    const ticketsSold = rows.reduce((sum, r) => sum + Number(r.num_tickets || 0), 0);
    res.json({ event_id: Number(id), count: rows.length, tickets_sold: ticketsSold, data: rows });
  } catch (err) {
    console.error('[GET /api/events/:id/registrations]', err);
    res.status(500).json({ error: 'Failed to retrieve registrations.' });
  }
});

// ============================================================================
// GET /api/events/:id
//   Single event + its registration list (sorted by registration_date DESC).
// ============================================================================
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!v.isPositiveInt(id)) return res.status(400).json({ error: 'Invalid event ID.' });

  try {
    const event = await fetchEventDetail(id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.json({ data: event });
  } catch (err) {
    console.error('[GET /api/events/:id]', err);
    res.status(500).json({ error: 'Failed to retrieve event details.' });
  }
});

// ============================================================================
// POST /api/events
//   Create a new event (admin "New" page).
// ============================================================================
router.post('/', async (req, res) => {
  const body = req.body || {};
  const { values, errors } = assembleEvent(body, EVENT_DEFAULTS);

  try {
    // Verify the referenced organisation and category actually exist, so the
    // API returns a helpful 400 instead of a raw foreign-key error.
    if (!errors.length) {
      const [[org]] = await db.query('SELECT org_id FROM organisations WHERE org_id = ?', [values.org_id]);
      if (!org) errors.push(`org_id ${values.org_id} does not exist.`);
      const [[cat]] = await db.query('SELECT category_id FROM categories WHERE category_id = ?', [values.category_id]);
      if (!cat) errors.push(`category_id ${values.category_id} does not exist.`);
    }

    if (errors.length) {
      return res.status(400).json({ error: 'Validation failed.', details: errors });
    }

    const placeholders = EVENT_COLUMNS.map(() => '?').join(', ');
    const params = EVENT_COLUMNS.map((c) => (values[c] === undefined ? null : values[c]));
    const [result] = await db.query(
      `INSERT INTO events (${EVENT_COLUMNS.join(', ')}) VALUES (${placeholders})`,
      params
    );

    // 201 Created + Location header pointing at the new resource (RESTful
    // best practice: the client learns the URL of what it just created).
    const created = await fetchEventDetail(result.insertId);
    res.location(`/api/events/${result.insertId}`);
    res.status(201).json({ message: 'Event created successfully.', data: created });
  } catch (err) {
    console.error('[POST /api/events]', err);
    res.status(500).json({ error: 'Failed to create event.' });
  }
});

// ============================================================================
// PUT /api/events/:id
//   Update an existing event. Any field may be supplied; missing fields keep
//   their current value. The merged record is fully validated before saving.
// ============================================================================
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  if (!v.isPositiveInt(id)) return res.status(400).json({ error: 'Invalid event ID.' });

  try {
    const [[existing]] = await db.query('SELECT * FROM events WHERE event_id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Event not found.' });

    const body = req.body || {};
    const { values, errors } = assembleEvent(body, existing);

    // Only re-check the references when they are actually being changed.
    if (!errors.length && values.org_id !== existing.org_id) {
      const [[org]] = await db.query('SELECT org_id FROM organisations WHERE org_id = ?', [values.org_id]);
      if (!org) errors.push(`org_id ${values.org_id} does not exist.`);
    }
    if (!errors.length && values.category_id !== existing.category_id) {
      const [[cat]] = await db.query('SELECT category_id FROM categories WHERE category_id = ?', [values.category_id]);
      if (!cat) errors.push(`category_id ${values.category_id} does not exist.`);
    }

    if (errors.length) {
      return res.status(400).json({ error: 'Validation failed.', details: errors });
    }

    const assignments = EVENT_COLUMNS.map((c) => `${c} = ?`).join(', ');
    const params = EVENT_COLUMNS.map((c) => (values[c] === undefined ? null : values[c]));
    params.push(id);

    await db.query(`UPDATE events SET ${assignments} WHERE event_id = ?`, params);

    const updated = await fetchEventDetail(id);
    res.json({ message: 'Event updated successfully.', data: updated });
  } catch (err) {
    console.error('[PUT /api/events/:id]', err);
    res.status(500).json({ error: 'Failed to update event.' });
  }
});

// ============================================================================
// DELETE /api/events/:id
//   Delete an event ONLY when it has no registrations (data integrity).
//   Blocked deletion returns HTTP 409 with a clear error message.
// ============================================================================
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!v.isPositiveInt(id)) return res.status(400).json({ error: 'Invalid event ID.' });

  try {
    const [[event]] = await db.query('SELECT event_id FROM events WHERE event_id = ?', [id]);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    // Guard: refuse to delete when registrations exist.
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) AS total FROM registrations WHERE event_id = ?',
      [id]
    );
    if (total > 0) {
      return res.status(409).json({
        error: 'Cannot delete event with existing registrations',
        registration_count: total
      });
    }

    await db.query('DELETE FROM events WHERE event_id = ?', [id]);
    res.json({ message: `Event ${id} deleted successfully.` });
  } catch (err) {
    // The FOREIGN KEY ... ON DELETE RESTRICT is a second safety net.
    if (err && (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451)) {
      return res.status(409).json({ error: 'Cannot delete event with existing registrations' });
    }
    console.error('[DELETE /api/events/:id]', err);
    res.status(500).json({ error: 'Failed to delete event.' });
  }
});

module.exports = router;
