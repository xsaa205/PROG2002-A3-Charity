# Zhengzhou Charity Events — PROG2002 Assessment 3

A **dynamic website** for a charity / crowdfunding case study, built for
**PROG2002 Web Development II — Assessment 3**.

The system consists of two websites that share one RESTful API and one MySQL database:

- **Client-side website** — public site where visitors browse charity events.
- **Admin-side website** — staff interface for managing charity events.

> **Case study:** Zhengzhou Charity Events (Henan Province, China) — a platform that connects
> volunteers and donors with local charity organisations and their fundraising events.

---

## Project Status

| Part  | Description                                                                  | Status        |
| ----- | ---------------------------------------------------------------------------- | ------------- |
| **1** | **Database improvements** — registration table, geo-coordinates, sample data | **Completed** |

_This README documents Part 1 (database) only._

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
├── api/                     # Node.js + Express server
│   ├── event_db.js          # MySQL connection pool (shared by all routes)
│   ├── server.js            # Express entry point
│   ├── package.json
│   ├── .env.example         # Environment-variable template
│   └── routes/
│       ├── events.js        # /api/events/* endpoints
│       └── categories.js    # /api/categories endpoints
├── clientside/              # Public website (HTML + vanilla JS)
│   ├── index.html           # Home page
│   ├── search.html          # Search page
│   ├── event.html           # Event detail page
│   ├── css/style.css
│   └── js/                  # common.js, index.js, search.js, event.js
├── adminside/               # Reserved for the admin-side website
├── database/
│   └── charityevents_a3.sql # Complete schema + data (single SQL file)
└── docs/                    # Project documentation
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
  data integrity at the database level.
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

## Setup & Run (Local Development)

### 1. Prerequisites

- Node.js
- MySQL (e.g. XAMPP / WAMP / MySQL Workbench)

### 2. Import the database

Import the single SQL file `database/charityevents_a3.sql` via phpMyAdmin (**Import** tab) or the
command line:

```bash
mysql -u root -p < database/charityevents_a3.sql
```

The script creates the `charityevents_a3` database, all four tables and the sample data.

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

_Last updated: Part 1 completed (database)._
