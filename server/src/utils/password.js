import { createHash } from 'node:crypto';

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const HIBP_TIMEOUT_MS = 2500;

function characterLength(value) {
  return Array.from(value).length;
}

export function normalizePassword(password) {
  return password.normalize('NFKC');
}

export function validatePasswordLength(password) {
  const length = characterLength(password);
  return length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH;
}

function isWeakPattern(password) {
  const normalized = password.toLowerCase();
  const repeated = /^(.)\1{5,}$/u.test(normalized);
  const sequences = [
    'abcdefghijklmnopqrstuvwxyz',
    'zyxwvutsrqponmlkjihgfedcba',
    '0123456789',
    '9876543210',
    'qwertyuiop',
  ];

  return (
    repeated ||
    sequences.some((sequence) =>
      Array.from({ length: sequence.length - 5 }, (_, index) =>
        sequence.slice(index, index + 6)
      ).some((part) => normalized.includes(part))
    )
  );
}

export function violatesPasswordContext(password, { username = '', email = '' } = {}) {
  const normalized = password.toLowerCase();
  const usernamePart = username.toLowerCase();
  const emailPart = email.split('@')[0]?.toLowerCase() || '';
  const contextTerms = ['reddit', 'redditclone', usernamePart, emailPart].filter(
    (term) => term.length >= 3
  );

  return isWeakPattern(normalized) || contextTerms.some((term) => normalized.includes(term));
}

export async function isBreachedPassword(password, fetchImpl = fetch) {
  const digest = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${HIBP_RANGE_URL}${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error('Breach screening service returned an unsuccessful response');
    }

    const results = await response.text();
    return results.split(/\r?\n/).some((line) => line.split(':')[0]?.trim() === suffix);
  } catch {
    console.warn('[auth] Password breach screening unavailable; proceeding');
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
