// ============================================================================
// app.js
// ----------------------------------------------------------------------------
// Builds and configures the Express application for the A3 API
// (Zhengzhou Charity Events). The HTTP server itself is started in server.js,
// which imports this app - this split makes the app easy to test in isolation.
// ============================================================================
'use strict';

const express = require('express');
const cors = require('cors');

const eventsRouter = require('./routes/events');
const registrationsRouter = require('./routes/registrations');
const categoriesRouter = require('./routes/categories');
const organisationsRouter = require('./routes/organisations');

const app = express();

// ----------------------------------------------------------------------------
// Global middleware
// ----------------------------------------------------------------------------
// Allow the client-side and admin-side sites to call the API. In production the
// allowed origin can be locked down with CORS_ORIGIN (e.g. the cPanel domain);
// the default "*" keeps local development and the Postman tests working.
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// Parse JSON request bodies. The size limit protects the API from oversized
// payloads (a simple but effective denial-of-service guard).
app.use(express.json({ limit: '100kb' }));

// Security headers. These are set manually (instead of pulling in a framework)
// so the project stays inside the technologies allowed by the assessment brief.
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

// Minimal request logger: method, URL, status code and duration.
// Useful when demonstrating the request -> response flow in the video.
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(`[api] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt} ms)`);
  });
  next();
});

// ----------------------------------------------------------------------------
// Root: a small, self-documenting index of the available endpoints.
// ----------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.json({
    name: 'Zhengzhou Charity Events API',
    version: '2.0.0',
    assessment: 'PROG2002 Assessment 3',
    endpoints: {
      events: [
        'GET    /api/events',
        'GET    /api/events/home',
        'GET    /api/events/search?date=&location=&category=',
        'GET    /api/events/:id',
        'GET    /api/events/:id/registrations',
        'POST   /api/events',
        'PUT    /api/events/:id',
        'DELETE /api/events/:id'
      ],
      registrations: [
        'GET    /api/registrations',
        'GET    /api/registrations/:id',
        'POST   /api/registrations'
      ],
      categories: [
        'GET    /api/categories'
      ],
      organisations: [
        'GET    /api/organisations'
      ]
    }
  });
});

// ----------------------------------------------------------------------------
// Routers
// ----------------------------------------------------------------------------
app.use('/api/events', eventsRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/organisations', organisationsRouter);

// ----------------------------------------------------------------------------
// Optional static hosting for the client-side and admin-side sites.
// ----------------------------------------------------------------------------
// When the whole project is deployed as a SINGLE cPanel Node.js app, the app
// serves static assets from a "public" folder next to this file (the cPanel
// application root). This works WITHOUT any environment variable, which avoids
// cPanel env-var delivery problems. An explicit SERVE_STATIC_DIR value is still
// honoured when it points at an existing directory.
//
// It is a no-op during local development (no "public" folder sits next to the
// code), so it never interferes with the existing API behaviour.
// ----------------------------------------------------------------------------
const SERVE_STATIC_DIR =
  (process.env.SERVE_STATIC_DIR &&
    require('fs').existsSync(process.env.SERVE_STATIC_DIR))
    ? process.env.SERVE_STATIC_DIR
    : require('path').join(__dirname, 'public');
if (require('fs').existsSync(SERVE_STATIC_DIR)) {
  app.use(express.static(SERVE_STATIC_DIR, { extensions: ['html'] }));
}

// ----------------------------------------------------------------------------
// 404 - unknown endpoint / 405 - known resource but unsupported method
// ----------------------------------------------------------------------------
// Allowed methods per resource pattern, used to distinguish "unknown URL" (404)
// from "correct URL, wrong verb" (405 Method Not Allowed), as RESTful design
// expects.
const ROUTE_METHODS = [
  { pattern: /^\/api\/events\/?$/, methods: ['GET', 'POST'] },
  { pattern: /^\/api\/events\/(home|search)\/?$/, methods: ['GET'] },
  { pattern: /^\/api\/events\/\d+\/?$/, methods: ['GET', 'PUT', 'DELETE'] },
  { pattern: /^\/api\/events\/\d+\/registrations\/?$/, methods: ['GET'] },
  { pattern: /^\/api\/registrations\/?$/, methods: ['GET', 'POST'] },
  { pattern: /^\/api\/registrations\/(\d+)\/?$/, methods: ['GET', 'DELETE'] },
  { pattern: /^\/api\/categories\/?$/, methods: ['GET'] },
  { pattern: /^\/api\/organisations\/?$/, methods: ['GET'] }
];

app.use((req, res) => {
  const path = req.path.replace(/\/+$/, '') || '/';
  const match = ROUTE_METHODS.find((route) => route.pattern.test(path));

  if (match) {
    res.set('Allow', match.methods.join(', '));
    return res.status(405).json({
      error: `Method ${req.method} is not allowed on ${path}.`,
      allowed: match.methods
    });
  }

  res.status(404).json({ error: 'Endpoint not found.' });
});

// ----------------------------------------------------------------------------
// Central error handler
// ----------------------------------------------------------------------------
app.use((err, req, res, next) => {
  // Malformed JSON body -> the client sent a bad request, not a server fault.
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({ error: 'Malformed JSON in the request body.' });
  }
  // Body larger than the configured limit.
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }

  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

module.exports = app;
