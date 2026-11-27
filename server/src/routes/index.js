import { Router } from 'express';
import healthRoutes from './health.routes.js';
import postRoutes, { communityPostRoutes } from './post.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/posts', postRoutes);
router.use('/communities', communityPostRoutes);

// Remaining track mount points reserved by docs/openapi.yaml:
// /auth, /users, /communities (other routes), /search, /feed, /comments

export default router;
