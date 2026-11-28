import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import {
  getRefreshCookieOptions,
  loginAccount,
  logoutSession,
  refreshSession,
  registerAccount,
} from '../services/auth.service.js';

function getRefreshToken(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookieName = env.refreshTokenCookieName;
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  return cookie ? cookie.slice(cookieName.length + 1) : null;
}

function sendAuthResponse(res, result, statusCode = 200) {
  const cookieOptions = getRefreshCookieOptions();
  if (result.refreshToken) {
    res.cookie(env.refreshTokenCookieName, result.refreshToken, {
      ...cookieOptions,
      maxAge: Math.max(0, result.refreshExpiresAt.getTime() - Date.now()),
    });
  }
  res.set('Cache-Control', 'no-store');
  return res.status(statusCode).json({ success: true, data: result.payload });
}

export const register = asyncHandler(async (req, res) => {
  const result = await registerAccount(req.body);
  return sendAuthResponse(res, result, 201);
});

export const login = asyncHandler(async (req, res) => {
  const result = await loginAccount(req.body.identifier, req.body.password);
  return sendAuthResponse(res, result);
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await refreshSession(getRefreshToken(req));
  return sendAuthResponse(res, result);
});

export const logout = asyncHandler(async (req, res) => {
  await logoutSession(getRefreshToken(req));
  res.clearCookie(env.refreshTokenCookieName, getRefreshCookieOptions());
  res.set('Cache-Control', 'no-store');
  return res.status(200).json({ success: true, data: { loggedOut: true } });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw ApiError.unauthorized();
  res.set('Cache-Control', 'no-store');
  return res.status(200).json({ success: true, data: user.toJSON() });
});
