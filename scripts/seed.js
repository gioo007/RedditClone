import { connectDB, disconnectDB } from '../server/src/config/db.js';
import { User, Community, Membership, Post, Comment, Vote } from '../server/src/models/index.js';

/**
 * Phase 0 seed entry point (`npm run seed` inside `server/`).
 * Member A will populate realistic users, communities, memberships, posts, comments, and votes in Phase 1.
 */
async function runSeed() {
  const connected = await connectDB();
  if (!connected) {
    console.error('[seed] Cannot run seed script without an active MongoDB connection.');
    process.exitCode = 1;
    return;
  }

  const registeredModels = [User, Community, Membership, Post, Comment, Vote].map(
    (m) => m.modelName
  );
  console.log(`[seed] Models registered: ${registeredModels.join(', ')}`);
  console.log('[seed] Phase 0 skeleton ready. Full sample dataset will be added in Phase 1.');

  await disconnectDB();
}

runSeed().catch(async (err) => {
  console.error('[seed] Failed:', err);
  await disconnectDB();
  process.exit(1);
});
