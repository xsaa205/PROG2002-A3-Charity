const express = require('express');
const cors = require('cors');
const eventsRouter = require('./routes/events');
const categoriesRouter = require('./routes/categories');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: 'Zhengzhou Charity Events API',
    version: '1.0.0',
    endpoints: [
      'GET /api/events/home',
      'GET /api/events/search?date=&location=&category=',
      'GET /api/events/:id',
      'GET /api/categories'
    ]
  });
});

app.use('/api/events', eventsRouter);
app.use('/api/categories', categoriesRouter);

app.use((req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Zhengzhou Charity Events API running at http://localhost:${PORT}`);
});
