/* ============================================================================
   config.js — where the API lives
   ----------------------------------------------------------------------------
   The whole client site reads the API base URL from window.APP_CONFIG, so the
   deployed copy only needs ONE line changed instead of editing every script.

   How the default is chosen:
     1. If API_ORIGIN below is filled in, that value wins (use this on cPanel
        when the Node app is served from a different host or sub-path).
     2. Opened from the file system or from localhost -> the local Node API on
        port 3000 (npm start in the api/ folder).
     3. Otherwise -> same origin as the page + /api, which is what happens when
        the static site and the API are deployed under one domain.
   ========================================================================== */
'use strict';

window.APP_CONFIG = (function () {
  // ── Deployment override ────────────────────────────────────────────────────
  // Leave empty for local development. Example for a deployed copy:
  //   var API_ORIGIN = 'https://your-cpanel-domain.example';
  var API_ORIGIN = '';

  var API_PATH = '/api';

  if (API_ORIGIN) {
    return { API_BASE: API_ORIGIN.replace(/\/+$/, '') + API_PATH };
  }

  var host = window.location.hostname;
  var isLocal =
    window.location.protocol === 'file:' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '';

  if (isLocal) {
    return { API_BASE: 'http://localhost:3000' + API_PATH };
  }

  return { API_BASE: window.location.origin + API_PATH };
})();
