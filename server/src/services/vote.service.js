import { ApiError } from '../utils/ApiError.js';

/**
 * Phase 0 in-memory stand-in for the voting service so Member C can wire post/comment vote
 * endpoints immediately. Member A will replace the internals in Phase 1 with concurrency-safe
 * MongoDB transactions / atomic operations while preserving these exact function signatures.
 */
const inMemoryVotes = new Map();
const inMemoryTally = new Map();

function voteKey(userId, targetType, targetId) {
  return `${userId}:${targetType}:${targetId}`;
}

function tallyKey(targetType, targetId) {
  return `${targetType}:${targetId}`;
}

export async function castVote({ userId, targetType = 'Post', targetId, value }) {
  if (!userId || !targetId) {
    throw ApiError.badRequest('userId and targetId are required');
  }
  if (!['Post', 'Comment'].includes(targetType)) {
    throw ApiError.badRequest('targetType must be Post or Comment');
  }
  if (![1, -1, 0].includes(value)) {
    throw ApiError.badRequest('Vote value must be 1, -1, or 0', [
      { field: 'value', message: 'Expected 1 (upvote), -1 (downvote), or 0 (remove vote)' },
    ]);
  }

  const vKey = voteKey(userId, targetType, targetId);
  const tKey = tallyKey(targetType, targetId);

  const prevValue = inMemoryVotes.get(vKey) || 0;
  const current = inMemoryTally.get(tKey) || { score: 0, upvoteCount: 0, downvoteCount: 0 };

  if (prevValue === value) {
    return {
      targetId: String(targetId),
      targetType,
      ...current,
      userVote: value,
    };
  }

  const delta = value - prevValue;
  const upvoteDelta = (value === 1 ? 1 : 0) - (prevValue === 1 ? 1 : 0);
  const downvoteDelta = (value === -1 ? 1 : 0) - (prevValue === -1 ? 1 : 0);

  const nextTally = {
    score: current.score + delta,
    upvoteCount: Math.max(0, current.upvoteCount + upvoteDelta),
    downvoteCount: Math.max(0, current.downvoteCount + downvoteDelta),
  };

  inMemoryTally.set(tKey, nextTally);
  if (value === 0) {
    inMemoryVotes.delete(vKey);
  } else {
    inMemoryVotes.set(vKey, value);
  }

  return {
    targetId: String(targetId),
    targetType,
    ...nextTally,
    userVote: value,
  };
}

export async function castPostVote(userId, postId, value) {
  return castVote({ userId, targetType: 'Post', targetId: postId, value });
}

export async function castCommentVote(userId, commentId, value) {
  return castVote({ userId, targetType: 'Comment', targetId: commentId, value });
}

export async function getUserVotesMap({ userId, targetType = 'Post', targetIds = [] }) {
  const result = new Map();
  if (!userId) return result;
  for (const id of targetIds) {
    const val = inMemoryVotes.get(voteKey(userId, targetType, id)) || 0;
    result.set(String(id), val);
  }
  return result;
}

export function resetInMemoryVotes() {
  inMemoryVotes.clear();
  inMemoryTally.clear();
}
