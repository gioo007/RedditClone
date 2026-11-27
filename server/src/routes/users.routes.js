import { Router } from 'express';
import { getProfile, listComments, listPosts, updateMe } from '../controllers/users.controller.js';
// TODO(auth): requireAuth/optionalAuth belong to the auth owner (dev header works for now)
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import {
  cursorPaginationQuerySchema,
  postSortQuerySchema,
  validate,
  z,
} from '../middleware/validate.js';

const router = Router();

const usernameParams = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_]{3,30}$/, 'Invalid username'),
});


const imageUrl = z
  .string()
  .trim()
  .refine((v) => v === '' || /^https?:\/\/\S+$/.test(v), 'Must be an http(s) URL');

const updateProfileBody = z
  .object({
    displayName: z.string().trim().max(50),
    bio: z.string().trim().max(500),
    avatarUrl: imageUrl,
    bannerUrl: imageUrl,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

router.patch('/me', requireAuth, validate({ body: updateProfileBody }), updateMe);

router.get('/:username', validate({ params: usernameParams }), getProfile);

router.get(
  '/:username/posts',
  optionalAuth,
  validate({ params: usernameParams, query: postSortQuerySchema }),
  listPosts
);

router.get(
  '/:username/comments',
  optionalAuth,
  validate({ params: usernameParams, query: cursorPaginationQuerySchema }),
  listComments
);

export default router;