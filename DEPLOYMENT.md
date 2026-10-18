# Deployment Guide — PROG2002 A3 (Charity Events)

How to deploy the **API**, **client-side** and **admin-side** sites to SCU cPanel.
This guide follows the standard cPanel **"Setup Node.js App"** flow shown in the
unit's deployment video (`video to deploy API`).

> The project is already deployment-ready:
> - `api/package.json` has a `start` script (`node server.js`) and `engines.node >= 18`.
> - `api/server.js` listens on `process.env.PORT || 3000` (cPanel supplies `PORT`).
> - `clientside/js/config.js` and `adminside/js/config.js` auto-detect the API
>   origin: opened locally → `localhost:3000/api`; deployed on the same domain →
>   `same-origin + /api`. No per-page edits are needed for a same-domain deploy.
> - `api/.env.example` documents the production environment variables.

---

## 0. Prerequisites

1. Your SCU cPanel login (the same account you use for SCU Online).
2. A MySQL database + user created in cPanel.
3. Node.js 18+ available in cPanel (use the version picker in *Setup Node.js App*).
4. The `database/charityevents_a3.sql` file (the single schema + sample-data dump).
5. **Each student deploys their OWN copy** (the brief requires this). Use a unique
   DB name / DB user per person so the two deployments do not collide.

---

## 1. Database (MySQL)

1. In cPanel open **Databases → MySQL® Databases**.
2. Create a database, e.g. `youruser_charityevents_a3`.
3. Create a user, e.g. `youruser_zzcharity`, and **Add User To Database** with
   **ALL PRIVILEGES**.
4. Open **phpMyAdmin**, select the new database, go to the **Import** tab and
   upload `database/charityevents_a3.sql`. This creates the `events` and
   `registrations` tables and inserts the ≥10 sample events / ≥10 registrations.
5. Note the exact **database name, username and password** — you need them in
   step 2.

---

## 2. API — Setup Node.js App (the part the video demonstrates)

1. In cPanel open **Software → Setup Node.js App** and click **CREATE APPLICATION**.
2. Fill in:
   - **Node.js version:** 18.x (or the newest 18+ offered).
   - **Application mode:** Production.
   - **Application root:** a folder for the API, e.g. `api` (or `prog2002-a3/api`).
   - **Application URL:** choose a subdomain/path, e.g. `youruser.scu.edu.au`
     or `youruser.scu.edu.au/api`.
   - **Application startup file:** `server.js`.
3. Click **CREATE**. cPanel generates a `PORT` and shows the **Environment
   variables** editor.
4. Add / edit these environment variables (copy from `api/.env.example`):

   | Name | Value (example) |
   |---|---|
   | `DB_HOST` | `localhost` |
   | `DB_PORT` | `3306` |
   | `DB_USER` | `youruser_zzcharity` |
   | `DB_PASSWORD` | `<the password you set in step 1.3>` |
   | `DB_NAME` | `youruser_charityevents_a3` |
   | `PORT` | *(leave as cPanel assigned, or set if required)* |
   | `CORS_ORIGIN` | `https://youruser.scu.edu.au` (lock down to your site) |

   > The API reads these in `api/event_db.js` / `api/app.js` via `process.env`.
   > Never commit a real `.env` — it is git-ignored.

5. Upload the contents of the **`api/`** folder (everything **except**
   `node_modules`) to the application root. Then back in *Setup Node.js App*,
   open the app and click **RUN NPM INSTALL** (or run it via the integrated
   terminal: `cd <app root> && npm install`).
6. Click **RESTART** to start the app.
7. Visit the application URL in a browser — you should see the API's JSON
   endpoint index (`Zhengzhou Charity Events API`). Test
   `https://<your-url>/api/events` returns the event list.

---

## 3. Client-side + Admin-side hosting

You have two options. **Option A is recommended** because it keeps the API and
the sites on the same origin, so the auto-detect config needs no edits.

### Option A — Single Node.js app serves everything (recommended)

1. In the same application root used in step 2, place the static sites so a
   `public` (or the repo root) folder contains `clientside/` and `adminside/`.
   ```
   <app root>/
     server.js
     app.js
     ... (api code)
     public/
       clientside/   (index.html, js/, css/ ...)
       adminside/    (index.html, js/, css/ ...)
   ```
2. Add one more environment variable:
   - `SERVE_STATIC_DIR` = absolute path to that `public` folder
     (e.g. `/home/youruser/api/public`).
3. **RESTART** the app. Now:
   - `https://<your-url>/clientside/index.html` → the public client site.
   - `https://<your-url>/adminside/index.html` → the admin site.
   - Both call the API at the **same origin** `/api` automatically.

> `api/app.js` only enables static serving when `SERVE_STATIC_DIR` is set AND
> the directory exists, so local development is unaffected.

### Option B — Static hosting in public_html (separate from the API)

1. Upload `clientside/` and `adminside/` into `public_html/` (or subfolders)
   via cPanel **File Manager**.
2. Because the API is on a different origin here, set the API base in each site:
   - **Client:** edit `clientside/js/config.js`, set
     `var API_ORIGIN = 'https://<your-api-url>';`
   - **Admin:** add an inline script at the top of each `adminside/*.html`
     `<head>`:
     ```html
     <script>window.APP_CONFIG = { API_BASE: 'https://<your-api-url>/api' };</script>
     ```
3. Set `CORS_ORIGIN` on the API to your static site's domain so the browser
   allows the cross-origin calls.

---

## 4. Verify the deployment

1. Open the client site → the home page should load events, stats and (if a
   future date) the weather widget.
2. Open an event → the guest list renders (emails partially masked).
3. Submit a registration → it appears in the guest list; submitting the same
   email twice returns a `409`.
4. Open the admin site → the event list shows all events with status badges;
   **New / Edit / Delete** work; deleting an event that has registrations
   returns `409` with the registration count.
5. Import the Postman **production** environment
   (`docs/postman_env_production.json`, `baseUrl = https://youruser.scu.edu.au`)
   and run `docs/postman_collection.json` against the live API.

---

## 5. Each student deploys their own copy

The brief requires **every student to deploy to their own cPanel**. To avoid
collisions:

- Use a **distinct database name and database user** per deployment.
- Use a **distinct application URL / subdomain** (or distinct cPanel account).
- Keep the two GitHub accounts / contributions as recorded in `README.md`
  (Wu Yitong = xsaa205 → Parts 1/2/4 + deploy; Yang Jiacheng = client Part 3).

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| API URL shows 503 / "Application not running" | In *Setup Node.js App* click **RESTART**; check the app **Log** for stack traces. |
| `GET /api/events` returns 500 | Wrong `DB_*` env vars or the DB/user not granted privileges. Re-check step 1. |
| Client/admin show no data | `CORS_ORIGIN` too strict, or `API_BASE` points at the wrong URL. Use Option A when possible. |
| Static pages 404 | `SERVE_STATIC_DIR` path wrong or folder structure differs from section 3A. |
| `npm install` fails | Node version < 18, or `package-lock.json` drift. Recreate lock or bump engines. |

---

## 7. Note on the unit deployment video

This guide was written from the project's existing deployment-ready structure
and the standard cPanel *Setup Node.js App* flow. If the unit video shows
SCU-specific menu names, a different Node version default, or an extra step
(e.g. a specific `passenger`/`nodemon` setting), follow the video for those
details and keep the environment-variable and file-layout steps above.
