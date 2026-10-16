const express = require('express');
const router = express.Router();
const db = require('../event_db');

const SUMMARY_SELECT = `
  SELECT
    e.event_id, e.name, e.short_description, e.event_date, e.start_time,
    e.location, e.ticket_price, e.is_free, e.goal_amount, e.raised_amount,
    e.image_url, c.category_id, c.name AS category_name, o.name AS org_name,
    CASE WHEN e.event_date >= CURDATE() THEN 'upcoming' ELSE 'past' END AS status
  FROM events e
  JOIN categories c ON e.category_id = c.category_id
  JOIN organisations o ON e.org_id = o.org_id
  WHERE e.is_suspended = 0
`;

// GET /api/events/home
router.get('/home', async (req, res) => {
  try {
    const sql = `
      ${SUMMARY_SELECT}
      ORDER BY
        CASE WHEN e.event_date >= CURDATE() THEN 0 ELSE 1 END,
        e.event_date ASC
    `;
    const [rows] = await db.query(sql);
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    console.error('[GET /api/events/home]', err);
    res.status(500).json({ error: '获取首页活动失败' });
  }
});

// GET /api/events/search
router.get('/search', async (req, res) => {
  const { date, location, category } = req.query;

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: '日期格式无效，请使用 YYYY-MM-DD。' });
  }
  if (category && !/^\d+$/.test(category)) {
    return res.status(400).json({ error: '分类 ID 无效。' });
  }

  let sql = SUMMARY_SELECT;
  const params = [];

  if (date) { sql += ' AND e.event_date = ?'; params.push(date); }
  if (location && location.trim() !== '') { sql += ' AND e.location LIKE ?'; params.push(`%${location.trim()}%`); }
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
    res.status(500).json({ error: '搜索活动失败' });
  }
});

// GET /api/events/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: '活动 ID 无效。' });

  try {
    const [rows] = await db.query(
      `
      SELECT
        e.event_id, e.name, e.short_description, e.full_description,
        e.event_date, e.start_time, e.end_time, e.location, e.address,
        e.ticket_price, e.is_free, e.goal_amount, e.raised_amount, e.image_url,
        c.category_id, c.name AS category_name,
        o.org_id, o.name AS org_name, o.mission AS org_mission,
        o.contact_email, o.phone,
        CASE WHEN e.event_date >= CURDATE() THEN 'upcoming' ELSE 'past' END AS status
      FROM events e
      JOIN categories c ON e.category_id = c.category_id
      JOIN organisations o ON e.org_id = o.org_id
      WHERE e.event_id = ? AND e.is_suspended = 0
      `,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: '未找到该活动。' });
    res.json({ data: rows[0] });
  } catch (err) {
    console.error('[GET /api/events/:id]', err);
    res.status(500).json({ error: '获取活动详情失败' });
  }
});

module.exports = router;