'use strict';

// Valid ticker characters: letters, digits, dots (exchange suffix), hyphens, carets (indices)
const VALID_TICKER_RE = /^[A-Z0-9.\-\^]+$/;

function parseInput(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { unique: [], duplicates: [], totalPasted: 0 };
  }

  const tokens = rawText
    .split(/[\n\r,;|\t\s]+/)
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0)
    .filter(t => VALID_TICKER_RE.test(t));

  const totalPasted = tokens.length;

  // Normalize: append .US if no exchange suffix present
  const normalized = tokens.map(t => (t.includes('.') ? t : t + '.US'));

  // Deduplicate — preserve first-seen order, track duplicates
  const seen = new Set();
  const unique = [];
  const duplicateSet = new Set();

  for (const ticker of normalized) {
    if (seen.has(ticker)) {
      duplicateSet.add(ticker);
    } else {
      seen.add(ticker);
      unique.push(ticker);
    }
  }

  return {
    unique,
    duplicates: Array.from(duplicateSet),
    totalPasted,
  };
}

module.exports = { parseInput };
