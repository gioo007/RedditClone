import { Router } from 'express';
import {
  createPostHandler,
  deletePostHandler,
  getPostByIdHandler,
  loadPostCommunity,
  removePostHandler,
  updatePostHandler,
} from '../controllers/post.controller.js';
import { optionalAuth, requireAuth, requireModerator } from '../schemas/middleware/auth.js';
import { validate } from '../schemas/middleware/validate.js';
import {
  communityNameParamSchema,
  createPostBodySchema,
  postIdParamSchema,
  removePostBodySchema,
  updatePostBodySchema,
} from '../schemas/validators/post.validator.js';

const router = Router();

router.get('/:id', optionalAuth, validate({ params: postIdParamSchema }), getPostByIdHandler);

router.patch(
  '/:id',
  requireAuth,
  validate({ params: postIdParamSchema, body: updatePostBodySchema }),
  updatePostHandler
);

router.delete('/:id', requireAuth, validate({ params: postIdParamSchema }), deletePostHandler);

router.post(
  '/:id/remove',
  requireAuth,
  validate({ params: postIdParamSchema, body: removePostBodySchema }),
  loadPostCommunity,
  requireModerator,
  removePostHandler
);

export const communityPostRoutes = Router();

communityPostRoutes.post(
  '/:name/posts',
  requireAuth,
  validate({ params: communityNameParamSchema, body: createPostBodySchema }),
  createPostHandler
);

export default router;
