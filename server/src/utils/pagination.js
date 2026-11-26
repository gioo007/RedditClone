import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * Encode a compound cursor `{ v, id }` as an opaque base64url token.
 * `v` is the primary sort value (ISO timestamp ms or numeric score), `id` is the string ObjectId.
 */
export function encodeCursor({ value, id }) {
  const payload = JSON.stringify({
    v: value instanceof Date ? value.getTime() : value,
    id: String(id),
  });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/**
 * Decode an opaque base64url cursor token back into `{ v, id }`.
 */
export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(String(cursor), 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      parsed.v === undefined ||
      typeof parsed.id !== 'string' ||
      !mongoose.isValidObjectId(parsed.id)
    ) {
      throw new Error('Malformed cursor payload');
    }
    return parsed;
  } catch {
    throw ApiError.badRequest('Invalid pagination cursor', [
      { field: 'cursor', message: 'Cursor token is malformed or expired' },
    ]);
  }
}

/**
 * Parse and validate `limit` and `cursor` query parameters.
 */
export function parsePaginationParams(query = {}) {
  const rawLimit = query.limit !== undefined ? Number(query.limit) : DEFAULT_LIMIT;
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > MAX_LIMIT) {
    throw ApiError.badRequest('Invalid pagination limit', [
      { field: 'limit', message: `Limit must be an integer between 1 and ${MAX_LIMIT}` },
    ]);
  }
  const decodedCursor = query.cursor ? decodeCursor(query.cursor) : null;
  return { limit: rawLimit, cursor: decodedCursor };
}

/**
 * Build MongoDB sort object and cursor `$or` filter for `new` (`createdAt`) or `top` (`score`).
 */
export function buildCursorSortAndFilter({ sort = 'new', cursor = null } = {}) {
  const isTop = sort === 'top';
  const sortField = isTop ? 'score' : 'createdAt';
  const sortSpec = { [sortField]: -1, _id: -1 };

  if (!cursor) {
    return { sortSpec, cursorFilter: {} };
  }

  const primaryValue = isTop ? Number(cursor.v) : new Date(Number(cursor.v));
  const cursorObjectId = new mongoose.Types.ObjectId(cursor.id);

  const cursorFilter = {
    $or: [
      { [sortField]: { $lt: primaryValue } },
      { [sortField]: primaryValue, _id: { $lt: cursorObjectId } },
    ],
  };

  return { sortSpec, cursorFilter };
}
