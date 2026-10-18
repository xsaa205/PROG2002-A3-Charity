# Zhengzhou Charity Events — PROG2002 Assessment 3

A **dynamic website** for a charity / crowdfunding case study, built for
**PROG2002 Web Development II — Assessment 3**.

The system consists of two websites that share one RESTful API and one MySQL database:

- **Client-side website** — public site where visitors browse charity events and register for them.
- **Admin-side website** — staff interface for managing charity events.

> **Case study:** Zhengzhou Charity Events (Henan Province, China) — a platform that connects
> volunteers and donors with local charity organisations and their fundraising events.

---

## Project Status

| Part  | Description                                                                       | Status        |
| ----- | --------------------------------------------------------------------------------- | ------------- |
| **1** | **Database improvements** — registration table, geo-coordinates, sample data       | **Completed** |
| **2** | **RESTful API improvements** — full C.R.U.D. for events, registrations, 409 rule   | **Completed** |
| **3** | **Client-side website** — registration page, live guest list, weather API          | **Completed** |
| **4** | **Admin-side website** — event management (list / new / update / delete)           | **Completed** |

_This README documents Parts 1–4 (database, RESTful API, the client-side website and the admin-side website)._

---

## Tech Stack

| Layer    | Technology                                           |
| -------- | ---------------------------------------------------- |
| Server   | **Node.js**, **Express.js**                          |
| Database | **MySQL** (mysql2/promise, connection pool)          |
| Client   | **HTML**, **JavaScript**, **DOM**, Promises, `fetch` |

No other frameworks are used, as required by the assessment brief.

---

## Project Structure

```
charityevents-a3/
├── api/                          # Node.js + Express RESTful API
│   ├── app.js                    # Express app: middleware, routers, 404/405, error handler
│   ├── server.js                 # HTTP entry point (starts the app)
│   ├── event_db.js               # MySQL connection pool (shared by all routes)
│   ├── package.json
│   ├── .env.example              # Environment-variable template
│   ├── utils/
│   │   └── validate.js           # Shared validation helpers (date, time, e-mail, numbers)
│   └── routes/
│       ├── events.js             # /api/events/* endpoints (GET, POST, PUT, DELETE)
│       ├── registrations.js      # /api/registrations endpoints
│       ├── categories.js         # /api/categories endpoint
│       └── organisations.js      # /api/organisations endpoint (admin form dropdown)
├── clientside/                   # Public website (HTML + vanilla JS)
│   ├── index.html                # Home: hero, impact counters, event grid
│   ├── search.html               # Search: date / district / category filters
│   ├── event.html                # Event details + live guest list + weather
│   ├── registration.html         # NEW in A3: registration form and confirmation
│   ├── css/style.css             # One design system for all four pages
│   └── js/
│       ├── config.js             # API base URL (single place to change on deploy)
│       ├── common.js             # fetch wrapper, formatters, header/footer, card template,
│       │                        #   donate modal, page-transition + hover prefetch
│       ├── index.js              # Home page logic (coverflow, reveal, count-up)
│       ├── coverflow.js          # Home event carousel (drag / wheel / arrows)
│       ├── datepicker.js         # English date field + calendar popup (search filter)
│       ├── search.js             # Search + filter chips + shareable URL
│       ├── event.js              # Event detail, guest list, Open-Meteo forecast
│       └── registration.js       # Form validation, POST, 201/409/400 handling
├── adminside/                    # Admin console (HTML + vanilla JS) — NEW in A3 (Part 4)
│   ├── index.html                # List: all events (Active/Past/Suspended) + stats + delete
│   ├── new.html                  # New event form (POST /api/events)
│   ├── edit.html                 # Edit event form (PUT /api/events/:id) + registrations panel
│   ├── css/style.css             # Admin design system (forest-green dashboard)
│   └── js/
│       ├── config.js             # API base URL (single place to change on deploy)
│       ├── common.js             # fetch wrapper, sidebar nav, badges, toast, formatters
│       ├── list.js               # List page: load, filter, delete (409 guard)
│       └── form.js               # New/Edit shared logic: dropdowns, validate, submit
├── database/
│   └── charityevents_a3.sql      # Complete schema + data (single SQL file)
└── docs/
    ├── postman_collection.json       # 26 requests with assertions (Part 2)
    ├── postman_env_local.json        # Postman environment: localhost
    └── postman_env_production.json   # Postman environment: deployed server
```

---

## Database Schema

Database name: **`charityevents_a3`** (charset `utf8mb4`, engine `InnoDB`).

The final schema is exported to a **single SQL file**, `database/charityevents_a3.sql`, containing
both the structure and the sample data so it can be imported in one step.

Four tables:

| Table           | Purpose                                                              |
| --------------- | -------------------------------------------------------------------- |
| `organisations` | Charity organisations that host events                               |
| `categories`    | Event categories (run, gala, auction, concert, food sale, cycling)   |
| `events`        | Charity events (includes `latitude` / `longitude` and `is_suspended`) |
| `registrations` | **NEW in A3** — event registrations                                  |

### Relationships

```
organisations (1) ──< events (N)
categories    (1) ──< events (N)
events        (1) ──< registrations (N)
```

### `registrations` table (added in Part 1)

```sql
CREATE TABLE registrations (
  registration_id   INT PRIMARY KEY AUTO_INCREMENT,
  event_id          INT NOT NULL,
  user_name         VARCHAR(120) NOT NULL,
  user_email        VARCHAR(150) NOT NULL,
  user_phone        VARCHAR(30),
  registration_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  num_tickets       INT NOT NULL DEFAULT 1,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_registrations_event
    FOREIGN KEY (event_id) REFERENCES events(event_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT uq_registration_event_email UNIQUE (event_id, user_email),
  CONSTRAINT chk_registration_num_tickets CHECK (num_tickets > 0),
  INDEX idx_registrations_event (event_id),
  INDEX idx_registrations_date  (registration_date)
) ENGINE=InnoDB;
```

**Key design decisions**

- `registration_id` is the **primary key**; `event_id` is a **foreign key** to `events`, giving the
  logical relationship between a registration and the event it belongs to.
- `ON DELETE RESTRICT` — an event **cannot be deleted while it has registrations**. This enforces
  data integrity at the database level and backs up the HTTP **409** rule in the API.
- `UNIQUE (event_id, user_email)` — a user may register for **many** events but only **once per event**.
- `CHECK (num_tickets > 0)` — the number of tickets must be a positive integer.
- `registration_date` is stored as a `DATETIME` (not just a `DATE`) so registrations can be ordered by
  the **latest purchase date/time** even when several occur on the same day.
- `latitude` / `longitude` were added to `events` to support location-aware features.

### Sample data

The export file contains:

- **3** organisations
- **6** categories
- **10** events (one of which is suspended)
- **12** registrations spread across **9** events

The registration data deliberately covers a range of cases: multiple registrations for a single event
(so an ordered list can be demonstrated) and the same user registering for several different events.

---

## RESTful API (Part 2)

Base URL (local): `http://localhost:3000/api`

Every response is JSON. The API is stateless, resource-oriented, and every write operation is
validated on the server before it reaches MySQL.

### Conventions

| Convention            | Detail                                                                       |
| --------------------- | ---------------------------------------------------------------------------- |
| Success envelope      | `{ "count": n, "total": n, "data": [...] }` for lists, `{ "data": {...} }` for a single resource, `{ "message": "...", "data": {...} }` for writes |
| Error envelope        | `{ "error": "message" }`, or `{ "error": "Validation failed.", "details": ["..."] }` for field-level failures |
| SQL safety            | All queries use **parameter placeholders (`?`)** — no string concatenation, so the API is not vulnerable to SQL injection |
| Status codes          | `200` read/update/delete success · `201` created (with `Location` header) · `400` validation error · `404` unknown resource · `405` method not allowed · `409` conflict (duplicate registration / event still has registrations) · `500` server error |
| Method safety         | `GET` is read-only; `POST`/`PUT`/`DELETE` are the only state-changing verbs |

### Endpoint overview

| # | Method   | Endpoint                          | Purpose                                                        |
| - | -------- | --------------------------------- | -------------------------------------------------------------- |
| 1 | `GET`    | `/api/events`                     | List **all** events (upcoming, past, suspended) for the admin site |
| 2 | `GET`    | `/api/events/home`                | Upcoming-then-past list for the client home page (suspended excluded) |
| 3 | `GET`    | `/api/events/search`              | Filter by `date`, `location`, `category`                        |
| 4 | `GET`    | `/api/events/:id`                 | **Event + its complete registration list** (newest purchase first) |
| 5 | `GET`    | `/api/events/:id/registrations`   | Registrations of one event, with `tickets_sold`                 |
| 6 | `POST`   | `/api/events`                     | Create a new event                                              |
| 7 | `PUT`    | `/api/events/:id`                 | Update an existing event                                        |
| 8 | `DELETE` | `/api/events/:id`                 | Delete an event — **blocked with `409` if any registration exists** |
| 9 | `GET`    | `/api/registrations`              | List all registrations with their event name                    |
| 10 | `GET`   | `/api/registrations/:id`          | A single registration                                           |
| 11 | `POST`  | `/api/registrations`              | Create a registration                                           |
| 12 | `DELETE` | `/api/registrations/:id`         | Delete a registration (cancellation / test clean-up)            |
| 13 | `GET`   | `/api/categories`                 | List event categories                                           |
| 14 | `GET`   | `/api/organisations`              | List organisations (admin "New/Edit" form dropdown)             |

---

### 1. `GET /api/events`

Returns every event regardless of status. Query parameters are all optional:

| Parameter  | Values                                                        | Default |
| ---------- | ------------------------------------------------------------- | ------- |
| `status`   | `upcoming` · `past` · `suspended` · `active` · `all`           | `all`   |
| `category` | category id                                                   | —       |
| `location` | partial match on the location                                 | —       |
| `limit`    | page size                                                     | all rows |
| `offset`   | rows to skip (used with `limit`)                              | `0`     |

```http
GET /api/events?status=upcoming&limit=3&offset=0
```

```json
{
  "count": 3,
  "total": 7,
  "data": [
    {
      "event_id": 1,
      "name": "Zhengzhou Lvcheng Charity Run",
      "category_id": 1,
      "category_name": "Charity Run",
      "event_date": "2026-11-08",
      "location": "Zhengzhou Olympic Sports Centre",
      "ticket_price": "50.00",
      "is_free": 0,
      "is_suspended": 0,
      "status": "upcoming",
      "registration_count": 3,
      "tickets_sold": 7
    }
  ]
}
```

Status codes: `200` · `400` (invalid `status`, `category`, `limit` or `offset`) · `500`

---

### 2. `GET /api/events/home`

Public home page list: upcoming events first, then past events. Suspended events are never returned.

```json
{ "count": 9, "data": [ { "event_id": 1, "status": "upcoming", "...": "..." } ] }
```

Status codes: `200` · `500`

---

### 3. `GET /api/events/search`

| Parameter  | Format               | Notes                        |
| ---------- | -------------------- | ---------------------------- |
| `date`     | `YYYY-MM-DD`         | exact match on the event date |
| `location` | text                 | partial match (`LIKE`)       |
| `category` | integer              | category id                  |

```http
GET /api/events/search?date=2026-11-08&location=Jinshui&category=1
```

Status codes: `200` · `400` (invalid date format or category id) · `500`

---

### 4. `GET /api/events/:id` — improved in Part 2

This is the endpoint enhanced for Part 2: it returns **the event plus the complete list of
registrations for that event**, ordered by **`registration_date` descending** (latest purchase
first), so the client-side event detail page can display the ticket purchases directly.

```json
{
  "data": {
    "event_id": 1,
    "name": "Zhengzhou Lvcheng Charity Run",
    "full_description": "...",
    "event_date": "2026-11-08",
    "start_time": "07:30:00",
    "location": "Zhengzhou Olympic Sports Centre",
    "latitude": "34.746500",
    "longitude": "113.660200",
    "ticket_price": "50.00",
    "goal_amount": "50000.00",
    "raised_amount": "32000.00",
    "is_suspended": 0,
    "status": "upcoming",
    "category_name": "Charity Run",
    "org_name": "Zhengzhou Charity Foundation",
    "registration_count": 3,
    "tickets_sold": 7,
    "registrations": [
      {
        "registration_id": 3,
        "event_id": 1,
        "user_name": "Chen Wei",
        "user_email": "chen@example.com",
        "user_phone": "+86 138 0000 0003",
        "registration_date": "2026-09-25 09:05:00",
        "num_tickets": 4
      },
      {
        "registration_id": 2,
        "user_name": "Bob Li",
        "registration_date": "2026-09-22 14:30:00",
        "num_tickets": 2
      },
      {
        "registration_id": 1,
        "user_name": "Alice Zhang",
        "registration_date": "2026-09-20 10:15:00",
        "num_tickets": 1
      }
    ]
  }
}
```

`registration_count` and `tickets_sold` are derived values, so the page does not have to compute them.

Status codes: `200` · `400` (invalid id) · `404` (event not found) · `500`

---

### 5. `GET /api/events/:id/registrations`

```json
{
  "event_id": 1,
  "count": 3,
  "tickets_sold": 7,
  "data": [ { "registration_id": 3, "registration_date": "2026-09-25 09:05:00", "...": "..." } ]
}
```

Status codes: `200` · `400` · `404` · `500`

---

### 6. `POST /api/events`

Creates a new event. Required: `org_id`, `category_id`, `name`, `event_date`, `location`.
Optional: `short_description`, `full_description`, `start_time`, `end_time`, `address`,
`latitude`, `longitude`, `ticket_price`, `is_free`, `goal_amount`, `raised_amount`, `image_url`,
`is_suspended`.

```http
POST /api/events
Content-Type: application/json

{
  "org_id": 1,
  "category_id": 1,
  "name": "Zhengzhou Winter Charity Walk",
  "short_description": "A 5 km walk to raise funds for rural schools.",
  "event_date": "2027-01-16",
  "start_time": "09:00",
  "end_time": "12:00",
  "location": "Zhengzhou People's Park",
  "address": "No. 1 Jinshui Road, Zhengzhou",
  "latitude": 34.7621,
  "longitude": 113.6654,
  "ticket_price": 20,
  "is_free": 0,
  "goal_amount": 10000
}
```

Response — `201 Created`, with `Location: /api/events/13`:

```json
{
  "message": "Event created successfully.",
  "data": { "event_id": 13, "name": "Zhengzhou Winter Charity Walk", "...": "..." }
}
```

Validation performed: required fields, field lengths, `YYYY-MM-DD` date format, `HH:MM[:SS]` time
format, `end_time` later than `start_time`, non-negative amounts, `0/1` flags, and that `org_id` /
`category_id` actually exist.

Status codes: `201` · `400` · `500`

---

### 7. `PUT /api/events/:id`

Updates an existing event. **Partial updates are supported**: any field you omit keeps its current
value (the incoming body is merged onto the stored record and the merged record is then validated).

```http
PUT /api/events/13
Content-Type: application/json

{ "name": "Zhengzhou Winter Charity Walk (Updated)", "ticket_price": 35.5 }
```

Response — `200 OK` with the updated record (including its registrations).

Status codes: `200` · `400` · `404` · `500`

---

### 8. `DELETE /api/events/:id`

The endpoint upholds **data integrity**: an event that already has registrations must not be
removed. The handler counts the registrations first and aborts with `409 Conflict`:

```http
DELETE /api/events/1
```

```json
HTTP/1.1 409 Conflict

{
  "error": "Cannot delete event with existing registrations",
  "registration_count": 3
}
```

If the event has no registrations the row is deleted and the API answers `200`:

```json
{ "message": "Event 13 deleted successfully." }
```

There is a second safety net at the database level: `FOREIGN KEY ... ON DELETE RESTRICT` would also
reject the delete (MySQL error `1451`), which the API translates into the same `409` response.

Status codes: `200` · `400` · `404` · `409` · `500`

---

### 9–12. Registrations

`GET /api/registrations` — every registration joined with its event name (admin convenience):

```json
{
  "count": 12,
  "data": [
    { "registration_id": 12, "event_id": 9, "event_name": "Zhengzhou Charity Gala Night",
      "user_name": "Jack Ma", "user_email": "jack@example.com",
      "registration_date": "2026-09-29 15:30:00", "num_tickets": 1 }
  ]
}
```

`POST /api/registrations` — creates a registration (used by the client-side registration page):

```http
POST /api/registrations
Content-Type: application/json

{
  "event_id": 3,
  "user_name": "Li Na",
  "user_email": "lina@example.com",
  "user_phone": "+86 139 0000 0000",
  "num_tickets": 2
}
```

Response — `201 Created`, with `Location: /api/registrations/13`:

```json
{
  "message": "Registration created successfully.",
  "data": {
    "registration_id": 13,
    "event_id": 3,
    "user_name": "Li Na",
    "user_email": "lina@example.com",
    "user_phone": "+86 139 0000 0000",
    "registration_date": "2026-10-17 14:08:07",
    "num_tickets": 2
  }
}
```

Business rules enforced:

| Situation                                          | Response |
| -------------------------------------------------- | -------- |
| Missing / invalid `user_name`, `user_email`, `num_tickets <= 0` | `400` with a `details` array |
| `event_id` does not exist                          | `404`    |
| Same e-mail already registered for the same event  | `409` — `"This email has already registered for this event."` |
| `registration_date` omitted                        | defaults to `CURRENT_TIMESTAMP` |

`registration_date` accepts either `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS`.

`DELETE /api/registrations/:id` — removes one registration (a visitor cancelling a
ticket, or the admin cleaning up test data). Deleting a registration never affects
the event row, because the `ON DELETE RESTRICT` rule only protects **events** that
still have registrations:

```http
DELETE /api/registrations/13
```

```json
{ "message": "Registration 13 deleted successfully." }
```

Status codes: `200` · `400` · `404` · `500`

---

### 13. `GET /api/categories`

```json
{ "count": 6, "data": [ { "category_id": 1, "name": "Charity Run", "description": "..." } ] }
```

---

### 14. `GET /api/organisations`

Read-only list of the charities that host events. Used to populate the organisation
dropdown on the admin **New** and **Edit** forms (the API validates that `org_id`
exists before it will create or update an event).

```json
{ "count": 3, "data": [ { "org_id": 1, "name": "Zhengzhou Lvcheng Charity Foundation", "mission": "..." } ] }
```

---

### API-level behaviour

- **Unsupported verb** on a known resource returns `405 Method Not Allowed` with an `Allow` header
  (e.g. `PATCH /api/events/1` → `Allow: GET, PUT, DELETE`).
- **Unknown URL** returns `404 Endpoint not found.`
- **Malformed JSON** body returns `400 Malformed JSON in the request body.`
- **Oversized** body (> 100 kb) returns `413`.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) are set on every
  response, and request bodies are limited, so the endpoints are hardened against the most common
  injection and payload attacks.
- Every request is logged to the console as `METHOD URL -> status (ms)`, which makes the
  request → response data flow easy to observe.

### Testing with Postman

`docs/postman_collection.json` is a ready-to-use Postman v2.1 collection with **26 requests** in
6 folders (Read → Create → Update → Delete → Registrations → Error handling). Each request contains
assertions (**47 in total**), so the Postman runner turns green when the API behaves as specified.

Two environments are provided so the same collection can be pointed at a different server without
editing any request:

| File | `baseUrl` |
| ---- | --------- |
| `docs/postman_env_local.json` | `http://localhost:3000` |
| `docs/postman_env_production.json` | the deployed cPanel domain (edit one value) |

**In the Postman app**

1. **Import** → select `docs/postman_collection.json`, then import one of the environment files.
2. Pick the environment in the top-right selector.
3. Start the API (`npm start`) and run a folder, or the whole collection with **Run collection**.
   `newEventId` and `registrationId` are filled automatically by the create requests.

**From the command line (Newman)**

```bash
npx newman run docs/postman_collection.json -e docs/postman_env_local.json
```

The collection is **repeat-safe**: it generates a unique e-mail on every run (so the
`UNIQUE(event_id, user_email)` rule is not tripped by a previous run) and deletes the registration
it created at the end, so running it twice leaves the database exactly as it was
(10 events, 12 registrations). That makes it safe to demo live during the video.

---

## Client-Side Website (Part 3)

The public website is four HTML pages sharing one stylesheet and one JavaScript helper file. No
framework is used — plain **HTML, CSS, JavaScript, DOM and Promises**, as the brief requires.

| Page                | Purpose                                                              | API calls                                      |
| ------------------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| `index.html`        | Hero, live impact counters, upcoming events, short past-events strip | `GET /api/events/home`                         |
| `search.html`       | Filter by date, district/venue and category; shareable URL           | `GET /api/events/search`, `GET /api/categories` |
| `event.html`        | Event details, fundraising progress, **full guest list**, forecast   | `GET /api/events/:id`, Open-Meteo forecast     |
| `registration.html` | Event summary + registration form + confirmation                     | `GET /api/events/:id`, `POST /api/registrations` |

### Requirement mapping

| Requirement in the brief                                                        | Where it is implemented                                                |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Event page displays all registrations for that event, latest purchase first      | `js/event.js` → `renderGuestList()`; the API returns `registration_date DESC` |
| "Register" button now links to the new registration page                        | `js/event.js` → `renderEventDetail()` builds `registration.html?eventId=<id>` |
| Registration page shows the selected event's information                        | `js/registration.js` → summary card filled from `GET /api/events/:id`   |
| Form collects user details, registration date, contact details, number of tickets | `registration.html` + `renderLayout()`                                 |
| Client-side validation with an appropriate alert                                 | `bindForm()` → per-field validators + summary alert + inline messages   |
| Finalise button inserts the record through the Part 2 endpoint                   | `POST /api/registrations` (JSON)                                        |
| Confirmation message and navigation after success                                | Receipt panel with reference, "see the guest list" / "back to home"     |
| Event ID passed between pages                                                    | URL query string `?eventId=`                                           |

### Data flow

1. `js/config.js` resolves the API base URL once (`window.APP_CONFIG.API_BASE`).
2. A page calls `apiRequest('/events/1')` in `js/common.js`, which wraps `fetch` with a 12-second
   timeout, JSON parsing and a uniform error object (`status`, `details`).
3. The parsed JSON is passed to a template function that returns an escaped HTML string, which is
   assigned to a container — DOM rendering happens in one place per page.
4. Anything the API rejects (400/404/409/network) becomes a visible state: an inline alert, an empty
   state with a call to action, or a retry panel.

### Registration outcomes

| Response / event        | What the visitor sees                                                             |
| ----------------------- | --------------------------------------------------------------------------------- |
| `201 Created`           | Confirmation screen with reference `REG-0000xx`, tickets, total and next actions   |
| `400 Validation failed` | Alert listing the API's `details[]` messages                                       |
| `409 Conflict`          | "You are already on the list" screen, with the duplicate e-mail and a guest-list link |
| `404 Not found`         | "This event no longer exists" message inside the form                              |
| Network failure / timeout | Retry message; the form keeps the typed values                                  |

### Validation rules (client side)

| Field               | Rule                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| Full name           | Required, 2–120 characters                                           |
| Email               | Required, single `@`, valid domain, ≤ 150 characters                 |
| Phone               | Optional, digits/space/`+`/`(`/`)`/`-` only, 6–30 characters         |
| Registration date   | Required, `YYYY-MM-DD`, cannot be in the future                      |
| Number of tickets   | Whole number, 1–10 (stepper keeps the value in range)                |

Errors appear under the field, the field turns red, the summary alert lists every problem and focus
moves to the first invalid input. Server-side rules remain authoritative: `UNIQUE(event_id,
user_email)` and `CHECK (num_tickets > 0)` are enforced by MySQL as well.

### Guest list

- Sorted by the API (`registration_date DESC, registration_id DESC`), so the newest registration is
  always first and is labelled **Latest**.
- Shows name, partially hidden e-mail (`a•••e@example.com`), ticket count, full timestamp and a
  relative time ("2 days ago").
- Empty events show a "be the first to register" state instead of a blank card.

### Extra: Open-Meteo weather forecast

`js/event.js` requests
`https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia/Shanghai`
using the `latitude` / `longitude` columns added in Part 1.

- The card appears only for upcoming events within the 16-day forecast window.
- Weather codes are translated to plain English (clear sky, drizzle, rain, thunderstorm …) with an
  inline SVG icon.
- If the request fails or the event has no coordinates, the card is simply not rendered — the event
  page never depends on a third-party service.

### Interaction details

- Loading skeletons while events are fetched, explicit empty states, and retry buttons on failure.
- Search filters are written into the URL (`search.html?location=Jinshui`), so a result can be shared.
- Filter chips let the visitor remove one filter at a time.
- Sticky booking/summary panels on desktop; single-column layout on phones; labelled form controls,
  visible focus rings, `aria-live` result counts and `prefers-reduced-motion` support.

---

## Admin-Side Website (Part 4)

A dedicated staff console for managing charity events through the full C.R.U.D. cycle. It is built
with the same technologies as the public site — **HTML, JavaScript, DOM and Promises** — no framework,
and authentication is intentionally not required (the brief says to assume this). The admin site shares
the public site's forest-green + cream visual language but is presented as an internal dashboard
(sidebar navigation, dense tables, status badges).

| Page             | Purpose                                                                     | API calls                                                        |
| ---------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `index.html`     | List **all** events (Active / Past / Suspended) with summary stats + delete  | `GET /api/events`, `DELETE /api/events/:id`                        |
| `new.html`       | Form to create a new event                                                  | `GET /api/categories`, `GET /api/organisations`, `POST /api/events` |
| `edit.html?id=N` | Form to edit an event + view its registrations                             | `GET /api/events/:id`, `PUT /api/events/:id`                      |

### Requirement mapping (Brief §4)

| Requirement in the brief                                                       | Where it is implemented                                                                 |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| List **all** events regardless of status, retrieved via the API                | `js/list.js` → `GET /api/events` (default `status=all`, returns Active+Past+Suspended)  |
| Key administrative details on each row                                          | name, organisation, category, date, status badge, registration count                     |
| New event form with a Save button that calls the Part 2 endpoint              | `js/form.js` → `POST /api/events`                                                       |
| Validation of required fields before sending                                  | `validate()` in `form.js` (inline errors + summary alert)                                |
| Update form that also shows the event's registrations                        | `edit.html` + `renderRegistrations()` using `GET /api/events/:id` → `registrations[]`    |
| Delete button next to each event that calls the endpoint                     | `js/list.js` → `DELETE /api/events/:id`                                                 |
| Clear feedback when deletion is blocked by existing registrations             | `409` → alert "Cannot delete … it has N registration(s)"                                |
| Navigation menu present on **all** pages                                      | `renderAdminSidebar()` injected into `#sidebar-nav` on every page                        |

### Status codes handled

| Response            | What the staff member sees                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `200 / 201`         | Toast "Event created / updated successfully." (new → redirected to the edit page)          |
| `400 Validation`    | Inline field errors mapped back from the API `details[]`, plus a summary alert             |
| `404 Not found`     | Error panel on the edit page ("Event not found")                                           |
| `409 Conflict`      | Delete blocked → alert naming the registration count that prevents deletion                 |
| Network / timeout   | Retry panel on the list, toast "Could not reach the server" on submit                      |

### Form fields & validation

The form mirrors the `events` table columns. Client-side validation guards the same rules the API
enforces (`api/routes/events.js → assembleEvent()`):

| Field             | Rule                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| Organisation       | Required, must be a positive integer that exists in `organisations`    |
| Category           | Required, must be a positive integer that exists in `categories`        |
| Name               | Required, 1–200 characters                                            |
| Event date         | Required, `YYYY-MM-DD`                                                |
| Location           | Required, 1–150 characters                                            |
| Start / End time   | Optional `HH:MM`; end must be later than start                        |
| Ticket price / goal / raised | Optional number ≥ 0                                        |
| Latitude / Longitude | Optional decimal (also powers the weather card)                    |
| Is free / Suspended | 0/1 toggle                                                         |

### Deploying the admin site

`adminside/` is a **static** site. On cPanel upload it next to the public `clientside/` folder and set
each page's API origin by editing `js/config.js` (or defining `window.APP_CONFIG.API_BASE` in an inline
script). For a single-domain deployment, point it at the same-origin `/api` path served by the Node app.

### Pointing the website at the API

`clientside/js/config.js` holds the only hard-coded address. Locally it resolves to
`http://localhost:3000/api` automatically; after deployment either leave it empty (same origin) or set:

```js
var API_ORIGIN = 'https://your-cpanel-domain.example';
```

---

## Setup & Run (Local Development)

### 1. Prerequisites

- Node.js
- MySQL (e.g. XAMPP / WAMP / MySQL Workbench)

### 2. Import the database

Create the database once, then import the single SQL file into it:

```sql
CREATE DATABASE charityevents_a3 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
mysql -u root -p charityevents_a3 < database/charityevents_a3.sql
```

or via phpMyAdmin: select the database → **Import** → upload `database/charityevents_a3.sql`.

The script creates the four tables and inserts the sample data. It deliberately contains **no
`CREATE DATABASE` / `USE` statement**, so the same file also imports cleanly on the SCU cPanel,
where the database name is prefixed with the cPanel account (e.g. `youruser_charityevents_a3`) and
the MySQL user is not allowed to create databases. Re-running the file is safe: it drops and
recreates the four tables.

### 3. Configure the connection

Connection settings are read from environment variables so credentials are not hard-coded. Copy the
template and fill in your own values:

```bash
cd api
cp .env.example .env
```

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=charityevents_a3
PORT=3000
CORS_ORIGIN=*
```

### 4. Install dependencies and start the server

```bash
cd api
npm install
npm start
```

The startup self-check confirms the database and the new table are reachable:

```
[event_db] Connected to MySQL database: charityevents_a3
[event_db] Schema check -> tables found: events, registrations
Zhengzhou Charity Events API running at http://localhost:3000
```

### 5. Open the client website

Keep the API running, then serve the `clientside/` folder with any static server:

```bash
cd clientside
npx serve .          # or: python -m http.server 5500
```

| Page                | URL                                                |
| ------------------- | -------------------------------------------------- |
| Home                | `/index.html`                                       |
| Search              | `/search.html`                                      |
| Event details       | `/event.html?eventId=1`                             |
| Registration        | `/registration.html?eventId=1`                      |

> The API runs on port 3000, so serve the static site on a different port (for example
> `http://localhost:5500/index.html`). With `npx serve .` the address is printed in the terminal.
> `js/config.js` already points local pages at `http://localhost:3000/api`; see
> [Pointing the website at the API](#pointing-the-website-at-the-api) for deployment.

---

## Repository & Team

- **GitHub repository:** <https://github.com/xsaa205/PROG2002-A3-Charity>
- **Branch:** `main`
- Both team members work on the same repository and commit incrementally, so the commit history
  reflects the development progress of each part (database → API → client site → admin site →
  deployment).
- Commit messages follow a short conventional prefix (`feat`, `fix`, `docs`, `refactor`) and describe
  **what changed and why**, and each part of the assessment has its own commit.

---

## GenAI Use Declaration (Level 2)

> I acknowledge that I have used GenAI tools to complete this assessment. I used Doubao
> (an AI assistant) to brainstorm and ideate, check grammar, paraphrase and edit the tone and clarity
> of the written documentation, format the documentation, and design documentation layout templates,
> within the parameters outlined in the Assessment Brief and by the Unit Assessor.

---

## Authors

PROG2002 Assessment 3 — Group project (2 students).

| Student | Student ID | GitHub | Responsible for |
| ------- | ---------- | ------ | --------------- |
| Yitong Wu (吴益同)   | 24832863 | `xsaa205` | Database and RESTful API (Parts 1–2), admin-side website (Part 4), deployment, video and final packaging |
| Jiacheng Yang (杨佳程) | 24832986 | `Yjc891`  | Client-side website and the registration flow (Part 3), Open-Meteo weather integration, design system |

---

_Last updated: Parts 1–4 completed (database, RESTful API, client-side website and admin-side website).
Deployment (Part 5) is the remaining step._
