const express = require('express');
const router = express.Router();
const db = require('../event_db');

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT category_id, name, description FROM categories ORDER BY category_id ASC'
    );
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    console.error('[GET /api/categories]', err);
    res.status(500).json({ error: '获取分类失败' });
  }
});

module.exports = router;