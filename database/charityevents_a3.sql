-- ============================================================================
-- PROG2002 Assessment 3 - Zhengzhou Charity Events Database
-- File          : charityevents_a3.sql   (schema + data in a single file)
-- Engine        : InnoDB (required for FOREIGN KEY support)
-- Charset       : utf8mb4 / utf8mb4_unicode_ci
--
-- WHAT THIS SCRIPT CONTAINS
--   Extends the Assessment 2 schema with:
--     * a new REGISTRATIONS table linked to EVENTS (Part 1 of A3)
--     * latitude / longitude on EVENTS (optional Open-Meteo weather API)
--     * 3 organisations, 6 categories, 10 events and 12 registrations
--
-- HOW TO IMPORT (local MySQL / XAMPP / WAMP)
--   1. Create the database once:
--        CREATE DATABASE charityevents_a3
--          CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   2. Select that database, then import this file
--      (phpMyAdmin > Import, or: mysql -u root -p charityevents_a3 < charityevents_a3.sql)
--
-- HOW TO IMPORT (SCU cPanel)
--   1. cPanel > MySQL Databases > create a database. cPanel prefixes the name,
--      e.g. "youruser_charityevents_a3".
--   2. phpMyAdmin > select that database > Import > upload this file.
--   The script deliberately does NOT run CREATE DATABASE / USE, because a cPanel
--   MySQL user is not allowed to create databases, and the real database name
--   contains the cPanel account prefix. Importing into the database you selected
--   therefore works both locally and on cPanel without editing this file.
-- ============================================================================

SET NAMES utf8mb4;

-- Allow the file to be re-imported safely: drop the child table first so the
-- foreign keys never block the drop.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS registrations;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS organisations;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- Table: organisations  (Charity Organisations)
-- ============================================================================
CREATE TABLE organisations (
  org_id        INT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(150) NOT NULL,
  mission       TEXT,
  contact_email VARCHAR(120),
  phone         VARCHAR(30),
  address       VARCHAR(255),
  logo_url      VARCHAR(500),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================================
-- Table: categories  (Event Categories)
-- ============================================================================
CREATE TABLE categories (
  category_id INT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255)
) ENGINE=InnoDB;

-- ============================================================================
-- Table: events  (Charity Events)
--   * latitude / longitude added for the optional Open-Meteo weather API.
--   * is_suspended keeps the soft-delete capability used in A2 (never shown
--     to the public client site, but still visible on the admin site).
-- ============================================================================
CREATE TABLE events (
  event_id          INT PRIMARY KEY AUTO_INCREMENT,
  org_id            INT NOT NULL,
  category_id       INT NOT NULL,
  name              VARCHAR(200) NOT NULL,
  short_description VARCHAR(255),
  full_description  TEXT,
  event_date        DATE NOT NULL,
  start_time        TIME,
  end_time          TIME,
  location          VARCHAR(150) NOT NULL,
  address           VARCHAR(255),
  latitude          DECIMAL(9,6),          -- geo latitude  (Open-Meteo)
  longitude         DECIMAL(9,6),          -- geo longitude (Open-Meteo)
  ticket_price      DECIMAL(10,2) DEFAULT 0.00,
  is_free           TINYINT(1) DEFAULT 0,
  goal_amount       DECIMAL(12,2) DEFAULT 0.00,
  raised_amount     DECIMAL(12,2) DEFAULT 0.00,
  image_url         VARCHAR(500),
  is_suspended      TINYINT(1) DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_events_org
    FOREIGN KEY (org_id) REFERENCES organisations(org_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_events_category
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
    ON DELETE RESTRICT,
  INDEX idx_event_date (event_date),
  INDEX idx_location (location),
  INDEX idx_category (category_id),
  INDEX idx_suspended (is_suspended)
) ENGINE=InnoDB;

-- ============================================================================
-- Table: registrations  (NEW in A3 - Event Registrations)
--   Business rules enforced at the database level:
--     * One registration row belongs to exactly one event (FK event_id).
--     * A user (identified by email) may register for MANY events, but only
--       ONCE per event  ->  UNIQUE (event_id, user_email).
--     * An event CANNOT be deleted while it has registrations
--       ->  FOREIGN KEY ... ON DELETE RESTRICT. This is what makes the
--       DELETE /api/events/:id endpoint correctly return HTTP 409.
--     * num_tickets must be a positive integer -> CHECK (num_tickets > 0).
-- ============================================================================
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
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT uq_registration_event_email
    UNIQUE (event_id, user_email),
  CONSTRAINT chk_registration_num_tickets
    CHECK (num_tickets > 0),
  INDEX idx_registrations_event (event_id),
  INDEX idx_registrations_date (registration_date)
) ENGINE=InnoDB;

-- ============================================================================
-- Initial Data: Charity Organisations (Zhengzhou)
-- ============================================================================
INSERT INTO organisations (org_id, name, mission, contact_email, phone, address, logo_url) VALUES
(1, 'Zhengzhou Lvcheng Charity Foundation', 'Gather love from Green City, change lives through influential charity activities and build a warm Zhengzhou.', 'hello@zzcharity.org', '+86 371 5555 0101', 'No.100 Jianshe Road, Zhongyuan District, Zhengzhou City, Henan Province', 'https://picsum.photos/seed/zhengzhou1/200/200'),
(2, 'Zhongyuan Love Alliance', 'Committed to public welfare projects for children and teenagers education, physical and mental health, spreading great love in the Central Plains.', 'info@zhongyuanlove.org', '+86 371 5555 0202', 'No.88 Huayuan Road, Jinshui District, Zhengzhou City, Henan Province', 'https://picsum.photos/seed/zhengzhou2/200/200'),
(3, 'Yellow River Public Welfare Association', 'Protect our mother river and green homeland through community-driven environmental protection actions.', 'contact@huanghegreen.org', '+86 371 5555 0303', 'No.45 Huanghe Road, Huiji District, Zhengzhou City, Henan Province', 'https://picsum.photos/seed/zhengzhou3/200/200');

-- ============================================================================
-- Initial Data: Event Categories
-- ============================================================================
INSERT INTO categories (category_id, name, description) VALUES
(1, 'Charity Run', 'Community running and hiking activities suitable for all fitness levels'),
(2, 'Charity Gala Dinner', 'Elegant dinner with entertainment performances and fundraising sessions'),
(3, 'Charity Auction', 'Auction donated items to raise funds for charity'),
(4, 'Charity Concert', 'Live music performances supporting public welfare causes'),
(5, 'Food Charity Sale', 'Community food and beverage charity events'),
(6, 'Charity Cycling', 'Cycling activities to raise funds for charity');

-- ============================================================================
-- Initial Data: Charity Events
--   event_id is stated explicitly so that the registration rows below always
--   reference the intended event, whatever the AUTO_INCREMENT counter is.
--   latitude / longitude are approximate real coordinates of each venue in
--   Zhengzhou, Henan Province (used by the Open-Meteo weather lookup).
-- ============================================================================
INSERT INTO events
(event_id, org_id, category_id, name, short_description, full_description, event_date, start_time, end_time,
 location, address, latitude, longitude, ticket_price, is_free, goal_amount, raised_amount, image_url, is_suspended)
VALUES
(1, 1, 1, 'Zhengzhou Lvcheng Charity Run',
 'Run along the beautiful East Zhengzhou New Area with thousands of runners.',
 'The Zhengzhou Lvcheng Charity Run brings together runners, hikers and supporters for a 10-kilometre charity run along the lovely lakes of East Zhengzhou New Area. Every penny raised will go directly to the vulnerable family assistance programme of the Zhengzhou Lvcheng Charity Foundation. Whether you are an experienced marathon runner or a first-time participant, everyone is welcome. There will be live music, refreshment stations and a carnival at the finish line.',
 '2026-10-18', '07:00:00', '12:00:00',
 'East Zhengzhou New Area', 'Ruyi Lake Square, East Zhengzhou New Area',
 34.752200, 113.798000,
 45.00, 0, 50000.00, 18500.00,
 'https://picsum.photos/seed/zzrun/800/500', 0),

(2, 2, 2, 'Starlight Charity Gala Dinner',
 'An unforgettable evening featuring fine dining, auctions and live entertainment.',
 'Starlight Charity Gala Dinner is the flagship annual fundraising event of Zhongyuan Love Alliance. Guests will enjoy a five-course dinner prepared by award-winning chefs, listen to live jazz music and inspirational speeches from teenagers benefiting from our programmes. A silent auction offering luxury getaways and unique experiences will also be held in the evening. Dress code: formal wear.',
 '2026-11-08', '18:30:00', '23:00:00',
 'Jinshui District', 'Grand Ballroom, Hilton Zhengzhou Hotel',
 34.778000, 113.686000,
 250.00, 0, 200000.00, 87000.00,
 'https://picsum.photos/id/1060/800/500', 0),

(3, 2, 3, 'Love Artwork Charity Auction',
 'Bid on fine art donated by local and international artists.',
 'The Love Artwork Charity Auction is a well-organised silent auction exhibiting more than 80 artworks generously donated by famous and emerging artists. All proceeds will support the art therapy programme for hospitalised children run by Zhongyuan Love Alliance. Wine and snacks will be served during the night, with chances to meet artists. Pre-registration is free, but bidding requires a registration badge.',
 '2026-11-22', '17:00:00', '21:30:00',
 'Erqi District', 'Erqi District Art Museum',
 34.723000, 113.641000,
 0.00, 1, 80000.00, 32000.00,
 'https://picsum.photos/seed/zzart/800/500', 0),

(4, 1, 4, 'Voices of Hope Charity Concert',
 'A night of live performances by top local musicians supporting public welfare.',
 'Voices of Hope brings together Henan''s most popular musicians for an incredible night of live performances. From indie folk to soulful jazz, the line-up celebrates diversity and community. All ticket revenue will go to the emergency relief fund of Zhengzhou Lvcheng Charity Foundation. Doors open at 18:30, opening performance starts at 19:00.',
 '2026-12-05', '19:00:00', '23:30:00',
 'Zhongyuan District', 'Zhengzhou Art Palace',
 34.748000, 113.612000,
 75.00, 0, 120000.00, 45000.00,
 'https://picsum.photos/seed/zzmusic/800/500', 0),

(5, 3, 5, 'Community Food Charity Festival',
 'Local food, culture and community celebration suitable for the whole family.',
 'The Community Food Charity Festival transforms the park into a vibrant market with local food stalls, cooking demonstrations, children''s activities and live entertainment. Admission is free. Every food purchase supports local merchants and the urban gardening project of the Yellow River Public Welfare Association. Come with an empty stomach and leave with joy while helping us build a greener city.',
 '2026-12-20', '10:00:00', '18:00:00',
 'Huiji District', 'Ancient Tree Garden Park, Huiji District',
 34.867000, 113.618000,
 0.00, 1, 40000.00, 12500.00,
 'https://picsum.photos/seed/zzfood/800/500', 0),

(6, 3, 6, 'Yellow River Riverside Charity Cycling',
 'Cycle 100 kilometres along the beautiful Yellow River riverside to support charity.',
 'Yellow River Riverside Charity Cycling offers three route options (30km, 60km and 100km) passing through the stunning riverside and rural scenery in Henan. Cyclists of all skill levels are welcome. Registration includes cycling jersey, support vehicles, supply stations and a post-ride celebration meal. Funds raised support the Yellow River ecological protection project of Yellow River Public Welfare Association.',
 '2027-02-14', '06:00:00', '15:00:00',
 'Huiji District', 'Yellow River Scenic Area',
 34.916000, 113.596000,
 60.00, 0, 90000.00, 21000.00,
 'https://picsum.photos/seed/zzride/800/500', 0),

(7, 1, 2, 'Warm Winter Charity Gala Dinner',
 'A cosy winter charity dinner raising funds for homeless people.',
 'Our Warm Winter Charity Gala Dinner is an intimate evening with warm food, live acoustic music and community stories. Each ticket provides one night of shelter and a hot meal for people in need. A live auction and lucky draw with rich prizes will be held on site.',
 '2026-06-15', '18:00:00', '22:30:00',
 'Jinshui District', 'Sofitel Zhengzhou International Hotel',
 34.782000, 113.689000,
 180.00, 0, 100000.00, 96000.00,
 'https://picsum.photos/seed/zzwinter/800/500', 0),

(8, 2, 1, '2026 Spring Charity Run',
 'A 5km family-friendly charity run through the park.',
 'The Spring Charity Run is an easy 5km activity perfect for families, beginner runners and anyone who wants to enjoy a lovely spring morning. The route winds through the park with entertainment performances alongside the way. All funds raised support after-school tutoring programmes run by Zhongyuan Love Alliance.',
 '2026-03-10', '08:00:00', '11:00:00',
 'Zhongyuan District', 'Bishagang Park',
 34.754000, 113.602000,
 25.00, 0, 30000.00, 28400.00,
 'https://picsum.photos/seed/zzspring/800/500', 0),

(9, 3, 4, 'Charity Music Night',
 'An intimate acoustic music night supporting environmental education.',
 'Charity Music Night is a cosy acoustic concert where local artists perform in a warm venue. All proceeds support school education programmes of Yellow River Public Welfare Association. There will be a lucky draw and opportunities to meet performers during the night.',
 '2026-07-25', '19:30:00', '22:00:00',
 'Jinshui District', 'Zhengzhou 7LIVEHOUSE',
 34.776000, 113.669000,
 50.00, 0, 25000.00, 24800.00,
 'https://picsum.photos/seed/zznight/800/500', 0),

-- Suspended event: must NOT appear on the public home / search pages, but must
-- still be visible on the admin-side website (Active / Past / Suspended).
(10, 1, 1, 'Uncertified Charity Sprint',
 'This event has been suspended due to policy review.',
 'This event has been suspended for policy violations and should not be displayed on public websites.',
 '2026-11-01', '09:00:00', '12:00:00',
 'Zhongyuan District', 'To be confirmed',
 34.748000, 113.610000,
 30.00, 0, 15000.00, 0.00,
 'https://picsum.photos/seed/zzsuspended/800/500', 1);

-- ============================================================================
-- Initial Data: Registrations (12 registrations across 9 different events)
--   Demonstrates:
--     * multiple tickets per registration
--     * several registrations for a single event (event_id = 1) so the
--       "sorted by latest registration date" requirement can be shown
--     * the SAME user (alice@example.com) registering for MULTIPLE events,
--       while the UNIQUE(event_id, user_email) rule prevents a duplicate
--   NOTE: the suspended event (event_id = 10) intentionally has no
--         registrations, so it can be safely deleted on the admin site.
-- ============================================================================
INSERT INTO registrations
(registration_id, event_id, user_name, user_email, user_phone, registration_date, num_tickets)
VALUES
(1,  1, 'Alice Zhang',  'alice@example.com',  '+86 138 0000 0001', '2026-09-20 10:15:00', 2),
(2,  1, 'Bob Li',       'bob@example.com',    '+86 138 0000 0002', '2026-09-22 14:30:00', 1),
(3,  1, 'Chen Wei',     'chen@example.com',   '+86 138 0000 0003', '2026-09-25 09:05:00', 4),
(4,  2, 'Diana Sun',    'diana@example.com',  '+86 138 0000 0004', '2026-09-18 20:00:00', 2),
(5,  2, 'Alice Zhang',  'alice@example.com',  '+86 138 0000 0001', '2026-09-19 11:45:00', 1),
(6,  3, 'Ethan Wang',   'ethan@example.com',  '+86 138 0000 0006', '2026-09-21 16:20:00', 3),
(7,  4, 'Fiona Guo',    'fiona@example.com',  '+86 138 0000 0007', '2026-09-23 19:10:00', 2),
(8,  5, 'George Zhou',  'george@example.com', '+86 138 0000 0008', '2026-09-24 12:00:00', 1),
(9,  6, 'Hana Liu',     'hana@example.com',   '+86 138 0000 0009', '2026-09-26 08:40:00', 2),
(10, 7, 'Ivan Xu',      'ivan@example.com',   '+86 138 0000 0010', '2026-09-27 18:55:00', 5),
(11, 8, 'Alice Zhang',  'alice@example.com',  '+86 138 0000 0001', '2026-09-28 10:00:00', 2),
(12, 9, 'Jack Ma',      'jack@example.com',   '+86 138 0000 0012', '2026-09-29 15:30:00', 1);

-- ============================================================================
-- End of script.
-- Quick sanity checks you can run after import:
--   SELECT COUNT(*) FROM organisations;                     -- expect 3
--   SELECT COUNT(*) FROM categories;                        -- expect 6
--   SELECT COUNT(*) FROM events;                            -- expect 10
--   SELECT COUNT(*) FROM registrations;                     -- expect 12
--   SELECT COUNT(DISTINCT event_id) FROM registrations;      -- expect 9
--   SELECT * FROM registrations WHERE event_id = 1 ORDER BY registration_date DESC;
-- ============================================================================
