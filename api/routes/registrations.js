// ============================================================================
// routes/registrations.js
// ----------------------------------------------------------------------------
// RESTful endpoints for the charity EVENT REGISTRATIONS resource (A3, Part 2).
//
//   GET  /api/registrations        -> list all registrations (admin convenience)
//   GET  /api/registrations/:id    -> a single registration
//   POST /api/registrations        -> create a new registration
//   DELETE /api/registrations/:id  -> remove a registration (cancellation)
//
// Business rules enforced here:
//   * The referenced event must exist -> otherwise 404.
//   * A user (email) may register for many events but only ONCE per event.
//     A duplicate (event_id, user_email) is rejected with HTTP 409.
//   * num_tickets must be a positive integer.
// ============================================================================
'use strict';

const express = require('express');
const router = express.Router();
const db = require('../event_db');
const v = require('../utils/validate');

const REGISTRATION_SELECT = `
  SELECT registration_id, event_id, user_name, user_email, user_phone,
         registration_date, num_tickets, created_at
  FROM registrations
`;

// ============================================================================
// GET /api/registrations
//   Optional admin convenience endpoint: every registration with its event name.
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT r.registration_id, r.event_id, e.name AS event_name,
             r.user_name, r.user_email, r.user_phone,
             r.registration_date, r.num_tickets, r.created_at
      FROM registrations r
      JOIN events e ON r.event_id = e.event_id
      ORDER BY r.registration_date DESC, r.registration_id DESC
    `);
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    console.error('[GET /api/registrations]', err);
    res.status(500).json({ error: 'Failed to retrieve registrations.' });
  }
});

// ============================================================================
// GET /api/registrations/:id
//   A single registration (keeps the Location header returned by POST valid).
// ============================================================================
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!v.isPositiveInt(id)) return res.status(400).json({ error: 'Invalid registration ID.' });

  try {
    const [[registration]] = await db.query(
      `${REGISTRATION_SELECT} WHERE registration_id = ?`,
      [id]
    );
    if (!registration) return res.status(404).json({ error: 'Registration not found.' });
    res.json({ data: registration });
  } catch (err) {
    console.error('[GET /api/registrations/:id]', err);
    res.status(500).json({ error: 'Failed to retrieve registration.' });
  }
});

// ============================================================================
// POST /api/registrations
//   Create a new registration for an event.
//   Body: { event_id, user_name, user_email, user_phone?, registration_date?, num_tickets? }
// ============================================================================
router.post('/', async (req, res) => {
  const body = req.body || {};
  const errors = [];

  // --- event_id (required + must exist) ---
  if (!v.isPositiveInt(body.event_id)) {
    errors.push('event_id is required and must be a positive integer.');
  }

  // --- user_name (required) ---
  if (!v.isNonEmptyString(body.user_name, 120)) {
    errors.push('user_name is required and must be at most 120 characters.');
  }

  // --- user_email (required + valid) ---
  if (!v.isEmail(body.user_email)) {
    errors.push('user_email is required and must be a valid e-mail address.');
  }

  // --- user_phone (optional) ---
  if (body.user_phone != null && body.user_phone !== '' &&
      (typeof body.user_phone !== 'string' || body.user_phone.length > 30)) {
    errors.push('user_phone must be a string of at most 30 characters.');
  }

  // --- num_tickets (optional, defaults to 1, must be a positive integer) ---
  let numTickets = 1;
  if (body.num_tickets != null && body.num_tickets !== '') {
    if (!/^\d+$/.test(String(body.num_tickets)) || Number(body.num_tickets) <= 0) {
      errors.push('num_tickets must be a positive integer.');
    } else {
      numTickets = Number(body.num_tickets);
    }
  }

  // --- registration_date (optional; accepts YYYY-MM-DD or YYYY-MM-DD HH:MM[:SS]) ---
  let registrationDate = null;
  if (body.registration_date != null && body.registration_date !== '') {
    const value = String(body.registration_date).trim();
    const datePart = value.slice(0, 10);
    const timePart = value.length > 10 ? value.slice(11) : null;
    if (!v.isValidDate(datePart) || (timePart && !/^\d{2}:\d{2}(:\d{2})?$/.test(timePart))) {
      errors.push('registration_date must be a valid date (YYYY-MM-DD) or datetime (YYYY-MM-DD HH:MM:SS).');
    } else {
      registrationDate = timePart ? `${datePart} ${v.normalizeTime(timePart)}` : `${datePart} 00:00:00`;
    }
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed.', details: errors });
  }

  try {
    // The event must exist before a registration can reference it.
    const [[event]] = await db.query('SELECT event_id FROM events WHERE event_id = ?', [body.event_id]);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const [result] = await db.query(
      `INSERT INTO registrations
         (event_id, user_name, user_email, user_phone, registration_date, num_tickets)
       VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?)`,
      [
        Number(body.event_id),
        body.user_name.trim(),
        body.user_email.trim(),
        (body.user_phone && String(body.user_phone).trim()) || null,
        registrationDate,
        numTickets
      ]
    );

    const [[created]] = await db.query(
      `${REGISTRATION_SELECT} WHERE registration_id = ?`,
      [result.insertId]
    );

    // 201 Created + Location header so the client knows the new resource URL.
    res.location(`/api/registrations/${result.insertId}`);
    res.status(201).json({
      message: 'Registration created successfully.',
      data: created
    });
  } catch (err) {
    // UNIQUE (event_id, user_email) -> the same user cannot register twice.
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'This email has already registered for this event.'
      });
    }
    console.error('[POST /api/registrations]', err);
    res.status(500).json({ error: 'Failed to create registration.' });
  }
});

// ============================================================================
// DELETE /api/registrations/:id
//   Removes a single registration (a visitor cancelling, or admin cleanup).
//   Deleting a registration never touches the event row, so it is always safe
//   with respect to the FK on events: the FK only blocks deleting EVENTS.
// ============================================================================
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!v.isPositiveInt(id)) return res.status(400).json({ error: 'Invalid registration ID.' });

  try {
    const [result] = await db.query('DELETE FROM registrations WHERE registration_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Registration not found.' });
    res.json({ message: `Registration ${id} deleted successfully.` });
  } catch (err) {
    console.error('[DELETE /api/registrations/:id]', err);
    res.status(500).json({ error: 'Failed to delete registration.' });
  }
});

module.exports = router;