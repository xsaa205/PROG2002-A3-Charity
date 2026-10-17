// ============================================================================
// routes/categories.js
// ----------------------------------------------------------------------------
// Read-only endpoints for event CATEGORIES.
//
//   GET /api/categories  -> every category (used by the client search filter
//                           and by the admin New/Update forms)
//
// Categories are reference data and are not modified by the A3 requirements,
// so only a GET endpoint is provided.
// ============================================================================
'use strict';

const express = require('express');
const router = express.Router();
const db = require('../event_db');

// ----------------------------------------------------------------------------
// GET /api/categories
// ----------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT category_id, name, description FROM categories ORDER BY category_id ASC'
    );
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    console.error('[GET /api/categories]', err);
    res.status(500).json({ error: 'Failed to retrieve categories.' });
  }
});

module.exports = router;
