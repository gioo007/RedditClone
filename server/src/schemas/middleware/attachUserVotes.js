import { getUserVotesMap } from '../../services/vote.service.js';

/**
 * Adds userVote (1, -1, or 0) to each post or comment
 * so the frontend can highlight the voting arrows.
 *
 * Uses a single database query for all targets,
 * avoiding the N+1 query problem.
 */
export async function attachUserVotes(items, userId, targetType = 'Post') {
  const plain = items.map((item) => (typeof item.toObject === 'function' ? item.toObject() : item));

  // Guests and empty results require no database query.
  if (!userId || plain.length === 0) {
    return plain.map((item) => ({
      ...item,
      userVote: 0,
    }));
  }

  // Retrieve all user votes in one database query.
  const votesMap = await getUserVotesMap({
    userId,
    targetType,
    targetIds: plain.map((item) => item._id),
  });

  // Attach the user's vote to each item.
  return plain.map((item) => ({
    ...item,
    userVote: votesMap.get(String(item._id)) ?? 0,
  }));
}

export default attachUserVotes;
