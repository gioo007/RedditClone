import { Router } from 'express';
import healthRoutes from './health.routes.js';

const router = Router();

router.use('/health', healthRoutes);

// Track mount points reserved by docs/openapi.yaml:
// Phase 2 (Member B): /auth, /users, /communities, /search
// Phase 3 (Member C): /feed, /posts, /comments

export default router;
