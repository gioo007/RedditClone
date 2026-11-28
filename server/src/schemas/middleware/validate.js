import { z } from 'zod';
import { ApiError } from '../../utils/ApiError.js';

export { z };

export const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid 24-character hex ObjectId');

export const idParamSchema = z.object({
  id: objectIdSchema,
});

export const cursorPaginationQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const postSortQuerySchema = cursorPaginationQuerySchema.extend({
  sort: z.enum(['new', 'top']).default('new'),
});

export const voteBodySchema = z.object({
  value: z
    .number({ invalid_type_error: 'Vote value must be a number' })
    .int()
    .refine((v) => v === 1 || v === -1 || v === 0, {
      message: 'Vote value must be 1 (upvote), -1 (downvote), or 0 (remove vote)',
    }),
});

export function formatZodIssues(issues, prefix = '') {
  return issues.map((issue) => {
    const pathStr = issue.path.map(String).join('.');
    const field = pathStr || prefix || 'request';
    return {
      field,
      message: issue.message,
    };
  });
}

/**
 * Shared Express request validation middleware using Zod.
 * - Parses and validates `params`, `query`, and `body` schemas when provided.
 * - Replaces `req.params`, `req.query`, and `req.body` with parsed values (stripping
 *   unrecognized keys by default to prevent mass-assignment bugs and coercing query types).
 * - Forwards a standardized `400 VALIDATION_ERROR` (`ApiError`) on failure.
 */
export function validate({ params, query, body } = {}) {
  return function validateMiddleware(req, _res, next) {
    const details = [];

    if (params) {
      const parsed = params.safeParse(req.params);
      if (!parsed.success) {
        details.push(...formatZodIssues(parsed.error.issues, 'params'));
      } else {
        req.params = parsed.data;
      }
    }

    if (query) {
      const parsed = query.safeParse(req.query);
      if (!parsed.success) {
        details.push(...formatZodIssues(parsed.error.issues, 'query'));
      } else {
        req.query = parsed.data;
      }
    }

    if (body) {
      const parsed = body.safeParse(req.body ?? {});
      if (!parsed.success) {
        details.push(...formatZodIssues(parsed.error.issues, 'body'));
      } else {
        req.body = parsed.data;
      }
    }

    if (details.length > 0) {
      return next(ApiError.badRequest('Request validation failed', details));
    }

    return next();
  };
}
