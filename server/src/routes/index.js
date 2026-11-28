import { Router } from 'express';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import postRoutes, { communityPostRoutes } from './post.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/posts', postRoutes);
router.use('/communities', communityPostRoutes);

// Remaining track mount points reserved by docs/openapi.yaml:
// /auth, /users, /communities (other routes), /search, /feed, /comments
router.use('/auth', authRoutes);

// Track mount points reserved by docs/openapi.yaml:
// Phase 2 (Member B): /users, /communities, /search
// Phase 3 (Member C): /feed, /posts, /comments

export default router;
