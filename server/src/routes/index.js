import { Router } from 'express';
import healthRoutes from './health.routes.js';
import usersRoutes from './users.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/users', usersRoutes);
// Track mount points reserved by docs/openapi.yaml:
// Phase 2 (Member B): /auth, /users, /communities, /search
// Phase 3 (Member C): /feed, /posts, /comments

export default router;
