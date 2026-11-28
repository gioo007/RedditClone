import argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import {
  isBreachedPassword,
  normalizePassword,
  validatePasswordLength,
  violatesPasswordContext,
} from '../utils/password.js';

const REFRESH_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_REUSE_GRACE_MS = 10 * 1000;
const AUTH_FAILURE = 'Invalid email/username or password';

function hashRefreshToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function issueAccessToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '15m',
    issuer: env.jwtIssuer,
    audience: env.jwtAudience,
  });
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.jwtSecret, {
    algorithms: ['HS256'],
    issuer: env.jwtIssuer,
    audience: env.jwtAudience,
  });
  if (
    typeof payload === 'string' ||
    typeof payload.sub !== 'string' ||
    !Number.isInteger(payload.iat) ||
    !Number.isInteger(payload.exp)
  ) {
    throw new Error('Invalid access token claims');
  }
  return payload;
}

function auditSuccess(event, userId) {
  console.info(
    JSON.stringify({
      event,
      userId: String(userId),
      timestamp: new Date().toISOString(),
    })
  );
}

function authPayload(user) {
  return {
    user: user.toJSON(),
    token: issueAccessToken(user._id),
  };
}

function passwordRejected() {
  return ApiError.badRequest('try a different password');
}

async function validateNewPassword(password, context) {
  if (!validatePasswordLength(password)) {
    throw passwordRejected();
  }

  const normalized = normalizePassword(password);
  if (!validatePasswordLength(normalized)) {
    throw passwordRejected();
  }
  const breached = await isBreachedPassword(normalized);
  if (breached || violatesPasswordContext(normalized, context)) {
    throw passwordRejected();
  }
  return normalized;
}

function duplicateAccountError(err) {
  if (err?.code !== 11000) return null;
  const fields = Object.keys(err.keyPattern || err.keyValue || {});
  const field = fields[0];
  if (field === 'username') {
    return ApiError.conflict('username taken', [{ field: 'username', message: 'username taken' }]);
  }
  if (field === 'email') {
    return ApiError.conflict('email already registered', [
      { field: 'email', message: 'email already registered' },
    ]);
  }
  return ApiError.conflict('Account already exists');
}

async function createRefreshToken(userId, familyId, expiresAt) {
  const token = randomBytes(32).toString('base64url');
  await RefreshToken.create({
    userId,
    tokenHash: hashRefreshToken(token),
    familyId,
    expiresAt,
  });
  return token;
}

export function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  };
}

export async function registerAccount(input) {
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  if (await User.exists({ username })) {
    throw ApiError.conflict('username taken', [{ field: 'username', message: 'username taken' }]);
  }
  if (await User.exists({ email })) {
    throw ApiError.conflict('email already registered', [
      { field: 'email', message: 'email already registered' },
    ]);
  }

  const password = await validateNewPassword(input.password, { username, email });
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  let user;
  try {
    user = await User.create({
      username,
      email,
      passwordHash,
      displayName: input.displayName?.trim() || '',
    });
  } catch (err) {
    const conflict = duplicateAccountError(err);
    if (conflict) throw conflict;
    throw err;
  }

  const expiresAt = new Date(Date.now() + REFRESH_LIFETIME_MS);
  const familyId = randomUUID();
  const refreshToken = await createRefreshToken(user._id, familyId, expiresAt);
  auditSuccess('auth.register.success', user._id);
  return { payload: authPayload(user), refreshToken, refreshExpiresAt: expiresAt };
}

export async function loginAccount(identifier, submittedPassword) {
  const normalizedPassword = normalizePassword(submittedPassword);
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
  }).select('+passwordHash');

  const passwordMatches = user
    ? await argon2.verify(user.passwordHash, normalizedPassword).catch(() => false)
    : false;
  if (!user || !passwordMatches) {
    throw ApiError.unauthorized(AUTH_FAILURE);
  }

  const expiresAt = new Date(Date.now() + REFRESH_LIFETIME_MS);
  const familyId = randomUUID();
  const refreshToken = await createRefreshToken(user._id, familyId, expiresAt);
  auditSuccess('auth.login.success', user._id);
  return { payload: authPayload(user), refreshToken, refreshExpiresAt: expiresAt };
}

export async function refreshSession(rawToken) {
  if (!rawToken || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
    throw ApiError.unauthorized();
  }

  const tokenHash = hashRefreshToken(rawToken);
  const now = new Date();
  const claimed = await RefreshToken.findOneAndUpdate(
    { tokenHash, usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { new: true }
  );

  if (!claimed) {
    const previous = await RefreshToken.findOne({ tokenHash });
    if (!previous) throw ApiError.unauthorized();

    const user = await User.findById(previous.userId);
    if (!user) {
      await RefreshToken.deleteMany({ familyId: previous.familyId });
      throw ApiError.unauthorized();
    }

    if (
      previous.expiresAt > now &&
      previous.usedAt &&
      now.getTime() - previous.usedAt.getTime() <= REFRESH_REUSE_GRACE_MS
    ) {
      auditSuccess('auth.refresh.race', user._id);
      return { payload: authPayload(user), refreshToken: null, refreshExpiresAt: null };
    }

    await RefreshToken.deleteMany({ familyId: previous.familyId });
    throw ApiError.unauthorized();
  }

  const user = await User.findById(claimed.userId);
  if (!user) {
    await RefreshToken.deleteMany({ familyId: claimed.familyId });
    throw ApiError.unauthorized();
  }

  const successorToken = randomBytes(32).toString('base64url');
  try {
    await RefreshToken.create({
      userId: claimed.userId,
      tokenHash: hashRefreshToken(successorToken),
      familyId: claimed.familyId,
      expiresAt: claimed.expiresAt,
    });
  } catch (err) {
    await RefreshToken.updateOne({ _id: claimed._id, usedAt: now }, { $set: { usedAt: null } });
    throw err;
  }

  auditSuccess('auth.refresh.success', user._id);
  return {
    payload: authPayload(user),
    refreshToken: successorToken,
    refreshExpiresAt: claimed.expiresAt,
  };
}

export async function logoutSession(rawToken) {
  if (!rawToken || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return;
  const current = await RefreshToken.findOne({ tokenHash: hashRefreshToken(rawToken) });
  if (current) await RefreshToken.deleteMany({ familyId: current.familyId });
}
