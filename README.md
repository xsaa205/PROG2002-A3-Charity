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

_This README documents Parts 1 and 2 (database and RESTful API)._

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
│       └── categories.js         # /api/categories endpoint
├── clientside/                   # Public website (HTML + vanilla JS)
│   ├── index.html                # Home page
│   ├── search.html               # Search page
│   ├── event.html                # Event detail page
│   ├── css/style.css
│   └── js/                       # common.js, index.js, search.js, event.js
├── adminside/                    # Reserved for the admin-side website
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

Serve `clientside/` with any static server and open `index.html`.

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

| Student | Student ID | Contribution |
| ------- | ---------- | ------------ |
| _TBD_   | _TBD_      | _TBD_        |

---

_Last updated: Parts 1 and 2 completed (database and RESTful API)._
