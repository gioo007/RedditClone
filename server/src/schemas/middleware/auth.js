import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../services/auth.service.js';

async function resolveRequestUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) throw ApiError.unauthorized('Invalid or expired authentication token');
  const token = match[1].trim();
  if (!token) throw ApiError.unauthorized('Empty bearer token');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired authentication token');
  }

  const user = await User.findById(payload.sub).select('_id username');
  if (!user) throw ApiError.unauthorized('Invalid or expired authentication token');
  return { _id: String(user._id), username: user.username };
}

export async function optionalAuth(req, _res, next) {
  try {
    req.user = await resolveRequestUser(req);
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireAuth(req, _res, next) {
  try {
    const user = await resolveRequestUser(req);
    if (!user) throw ApiError.unauthorized('Authentication required');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

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
