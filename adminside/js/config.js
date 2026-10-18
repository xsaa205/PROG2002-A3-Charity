/* ============================================================================
   config.js — admin-side API origin
   ----------------------------------------------------------------------------
   The whole admin site reads the API base URL from window.APP_CONFIG, so the
   deployed copy needs little or no change.

   Resolution order (mirrors clientside/js/config.js):
     1. If an inline script sets window.APP_CONFIG.API_BASE before this file
        loads, that value wins. Example for a cross-origin API:
          <script>window.APP_CONFIG={API_BASE:'https://api.your-cpanel-domain/api'}</script>
     2. Opened from the file system or localhost -> the local Node API on :3000.
     3. Otherwise (deployed, same domain as the API) -> same origin + /api.
        This is the typical cPanel setup where the Node app also serves the
        admin static files, so no per-page edit is required.
   ========================================================================== */
'use strict';

window.APP_CONFIG = (function () {
  // If an override was already provided by an inline script, keep it.
  if (window.APP_CONFIG && window.APP_CONFIG.API_BASE) {
    return window.APP_CONFIG;
  }

  var API_PATH = '/api';

  var host = window.location.hostname;
  var isLocal =
    window.location.protocol === 'file:' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '';

  if (isLocal) {
    return { API_BASE: 'http://localhost:3000' + API_PATH };
  }

  // Deployed: assume the API is served from the same origin (e.g. the Node.js
  // app also hosts the admin static files). Override with an inline script if
  // the API lives on a different host/subdomain.
  return { API_BASE: window.location.origin + API_PATH };
})();
