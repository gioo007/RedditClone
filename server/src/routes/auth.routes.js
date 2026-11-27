import { Router } from 'express';
import { z } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { login, logout, me, refresh, register } from '../controllers/auth.controller.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

const passwordSchema = z.string().min(1).max(1024);
const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/),
    email: z.string().trim().email().max(254),
    password: passwordSchema,
    displayName: z.string().trim().max(50).optional(),
  })
  .strict();
const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).max(254),
    password: passwordSchema,
  })
  .strict();

function requireTrustedOrigin(req, _res, next) {
  const origin = req.get('origin');
  if (!origin) return next();

  try {
    if (new URL(origin).origin === new URL(env.clientUrl).origin) return next();
  } catch {
    return next(ApiError.forbidden('Origin is not allowed'));
  }
  return next(ApiError.forbidden('Origin is not allowed'));
}

router.post('/register', requireTrustedOrigin, validate({ body: registerSchema }), register);
router.post('/login', requireTrustedOrigin, validate({ body: loginSchema }), login);
router.post('/refresh', requireTrustedOrigin, refresh);
router.post('/logout', requireTrustedOrigin, logout);
router.get('/me', requireAuth, me);

export default router;
