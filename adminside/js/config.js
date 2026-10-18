/* ============================================================================
   config.js — admin-side API origin
   ----------------------------------------------------------------------------
   The API base URL. On the local machine the admin site is served by a static
   server and the Node API runs on :3000, so the default points there.

   To deploy, set window.APP_CONFIG.API_BASE in a small inline script in each
   page BEFORE this file loads, e.g.:
     <script>window.APP_CONFIG={API_BASE:'https://your-cpanel-domain/api'}</script>
   Or, if the admin site and API share one domain behind a proxy, use '/api'.
   ========================================================================== */
'use strict';

window.APP_CONFIG = window.APP_CONFIG || {};
window.APP_CONFIG.API_BASE = window.APP_CONFIG.API_BASE || 'http://localhost:3000/api';
