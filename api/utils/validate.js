// ============================================================================
// utils/validate.js
// ----------------------------------------------------------------------------
// Small, dependency-free validation helpers shared by the A3 API routes.
// Keeping validation in one place makes the route handlers easier to read and
// guarantees that the client-side form rules match the server-side rules.
// ============================================================================
'use strict';

/**
 * True when the value is a positive integer (accepts number or numeric string).
 * Used for IDs such as event_id, org_id, category_id.
 */
function isPositiveInt(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

/**
 * True when the value is a real calendar date in YYYY-MM-DD format.
 * Uses local Date construction so there is no UTC timezone shift, and
 * rejects impossible dates such as 2026-02-31.
 */
function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** True when the value is a 24-hour time string: HH:MM or HH:MM:SS. */
function isValidTime(value) {
  return typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value);
}

/** Normalise "HH:MM" to "HH:MM:SS" so MySQL TIME columns accept it. */
function normalizeTime(value) {
  return value.length === 5 ? `${value}:00` : value;
}

/** Very small e-mail shape check (client and server use the same rule). */
function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** True when the value is a non-empty string within an optional max length. */
function isNonEmptyString(value, max = 255) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

/** Parse to a finite number, or NaN when it is not numeric. */
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

/** Parse a boolean-ish value into 0 or 1, or null when unrecognised. */
function toBool01(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return 1;
  if (value === false || value === 0 || value === '0' || value === 'false') return 0;
  return null;
}

module.exports = {
  isPositiveInt,
  isValidDate,
  isValidTime,
  normalizeTime,
  isEmail,
  isNonEmptyString,
  toNumber,
  toBool01
};
