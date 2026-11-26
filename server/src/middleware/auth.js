import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Extract user identity from either a Bearer JWT or (in non-production) the `x-dev-user-id`
 * stub header so Phases 1-3 can develop in parallel before Phase 2 auth is merged.
 */
function resolveRequestUser(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (!token) {
      throw ApiError.unauthorized('Empty bearer token');
    }
    try {
      const payload = jwt.verify(token, env.jwtSecret);
      return {
        _id: String(payload.sub || payload._id || payload.id),
        username: payload.username || '',
      };
    } catch {
      throw ApiError.unauthorized('Invalid or expired authentication token');
    }
  }

  if (env.nodeEnv !== 'production') {
    const devUserId = req.headers['x-dev-user-id'];
    if (devUserId) {
      if (!mongoose.isValidObjectId(devUserId)) {
        throw ApiError.badRequest('x-dev-user-id must be a valid 24-character hex ObjectId', [
          { field: 'x-dev-user-id', message: 'Expected 24-character hex ObjectId' },
        ]);
      }
      return {
        _id: String(devUserId),
        username: String(req.headers['x-dev-username'] || 'dev_user'),
        isDevStub: true,
      };
    }
  }

  return null;
}

export function optionalAuth(req, _res, next) {
  try {
    req.user = resolveRequestUser(req);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req, _res, next) {
  try {
    const user = resolveRequestUser(req);
    if (!user) {
      throw ApiError.unauthorized('Authentication required');
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Phase 0 stub for community moderator checks (to be finalized in Phase 2 by Member B).
 * Expects `req.community` (populated upstream) or checks `creator` / `moderators` against `req.user._id`.
 */
export function requireModerator(req, _res, next) {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  const community = req.community;
  if (!community) {
    return next(
      ApiError.internal('requireModerator expects req.community to be loaded before invocation')
    );
  }

  const userId = String(req.user._id);
  const isCreator = String(community.creator?._id || community.creator) === userId;
  const isListedMod = Array.isArray(community.moderators)
    ? community.moderators.some((mod) => String(mod?._id || mod) === userId)
    : false;

  if (!isCreator && !isListedMod) {
    return next(ApiError.forbidden('Only the community moderator can perform this action'));
  }

  return next();
}
