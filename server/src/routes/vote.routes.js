import express from 'express';
import { requireAuth } from '../middleware/auth.js';

import { validate, idParamSchema, voteBodySchema } from '../middleware/validate.js';

import { votePost, voteComment } from '../controllers/vote.controller.js';

const router = express.Router();

// Post voting endpoint
router.put(
  '/posts/:id/vote',
  requireAuth,
  validate({
    params: idParamSchema,
    body: voteBodySchema,
  }),
  votePost
);

// Comment voting endpoint
router.put(
  '/comments/:id/vote',
  requireAuth,
  validate({
    params: idParamSchema,
    body: voteBodySchema,
  }),
  voteComment
);

export default router;
