// ============================================================================
// server.js
// ----------------------------------------------------------------------------
// HTTP entry point. It imports the configured Express app from ./app and
// starts listening. Keeping the app separate lets tools (e.g. Postman, tests)
// reuse it without opening a port.
// ============================================================================
'use strict';

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Zhengzhou Charity Events API running at http://localhost:${PORT}`);
});
