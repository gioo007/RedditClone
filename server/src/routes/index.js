import { Router } from 'express';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

// Track mount points reserved by docs/openapi.yaml:
// Phase 2 (Member B): /users, /communities, /search
// Phase 3 (Member C): /feed, /posts, /comments

export default router;
