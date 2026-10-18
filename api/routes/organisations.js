// ============================================================================
// routes/organisations.js
// ----------------------------------------------------------------------------
// Read-only endpoints for ORGANISATIONS (the charities that host events).
//
//   GET /api/organisations  -> every organisation (used by the admin New/Update
//                              forms as the org_id dropdown source)
//
// Organisations are reference data and are not modified by the A3 requirements,
// so only a GET endpoint is provided. It mirrors the structure of
// routes/categories.js.
// ============================================================================
'use strict';

const express = require('express');
const router = express.Router();
const db = require('../event_db');

// ----------------------------------------------------------------------------
// GET /api/organisations
// ----------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT org_id, name, mission, contact_email, phone FROM organisations ORDER BY org_id ASC'
    );
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    console.error('[GET /api/organisations]', err);
    res.status(500).json({ error: 'Failed to retrieve organisations.' });
  }
});

module.exports = router;
