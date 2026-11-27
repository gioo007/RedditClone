import mongoose from 'mongoose';
import { Vote } from '../models/Vote.js';
import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { ApiError } from '../utils/ApiError.js';

const DUPLICATE_KEY_ERROR = 11000;
const MAX_RETRIES = 3;

/**
 * Returns the appropriate model based on the target type.
 */
function getTargetModel(targetType) {
  if (targetType === 'Post') {
    return Post;
  }

  if (targetType === 'Comment') {
    return Comment;
  }

  throw ApiError.badRequest('targetType must be Post or Comment');
}

/**
 * Validates the voting request.
 */
function validateVote(userId, targetId, targetType, value) {
  if (!userId || !targetId) {
    throw ApiError.badRequest('userId and targetId are required');
  }

  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(targetId)) {
    throw ApiError.badRequest('Invalid userId or targetId');
  }

  if (!['Post', 'Comment'].includes(targetType)) {
    throw ApiError.badRequest('targetType must be Post or Comment');
  }

  if (![1, -1, 0].includes(value)) {
    throw ApiError.badRequest('Vote value must be 1, -1, or 0', [
      {
        field: 'value',
        message: 'Expected 1 (upvote), -1 (downvote), or 0 (remove vote)',
      },
    ]);
  }
}

/**
 * Calculates changes to the score and vote counters.
 */
function calculateDeltas(previousValue, newValue) {
  return {
    score: newValue - previousValue,

    upvoteCount: (newValue === 1 ? 1 : 0) - (previousValue === 1 ? 1 : 0),

    downvoteCount: (newValue === -1 ? 1 : 0) - (previousValue === -1 ? 1 : 0),
  };
}

/**
 * Formats the voting response.
 */
function formatResponse(target, targetType, userVote) {
  return {
    targetId: String(target._id),
    targetType,
    score: target.score ?? 0,
    upvoteCount: target.upvoteCount ?? 0,
    downvoteCount: target.downvoteCount ?? 0,
    userVote,
  };
}

/**
 * Creates, switches, or removes a user's vote.
 *
 *  1 = Upvote
 * -1 = Downvote
 *  0 = Remove vote
 *
 * MongoDB transactions ensure that the vote record
 * and target statistics are updated together.
 */
export async function castVote({ userId, targetType = 'Post', targetId, value }) {
  validateVote(userId, targetId, targetType, value);

  const TargetModel = getTargetModel(targetType);

  const filter = {
    user: userId,
    targetType,
    targetId: targetId,
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const session = await mongoose.startSession();

    try {
      let result = null;

      await session.withTransaction(async () => {
        result = null;

        // 1. Check that the post or comment exists.
        const target = await TargetModel.findById(targetId)
          .select('score upvoteCount downvoteCount')
          .session(session);

        if (!target) {
          throw ApiError.notFound(`${targetType} not found`);
        }

        // 2. Retrieve the user's previous vote.
        const previousVote = await Vote.findOne(filter).session(session);

        const previousValue = previousVote ? previousVote.value : 0;

        // 3. Repeated identical requests make no changes.
        if (previousValue === value) {
          result = formatResponse(target, targetType, value);

          return;
        }

        // 4. Calculate the changes to voting statistics.
        const deltas = calculateDeltas(previousValue, value);

        // 5. Remove, create, or update the vote.
        if (value === 0) {
          await Vote.deleteOne(filter, { session });
        } else {
          await Vote.findOneAndUpdate(
            filter,
            {
              $set: { value },
            },
            {
              upsert: true,
              new: true,
              runValidators: true,
              session,
            }
          );
        }

        // 6. Atomically update the target statistics.
        const updatedTarget = await TargetModel.findByIdAndUpdate(
          targetId,
          {
            $inc: {
              score: deltas.score,
              upvoteCount: deltas.upvoteCount,
              downvoteCount: deltas.downvoteCount,
            },
          },
          {
            new: true,
            session,
          }
        ).select('score upvoteCount downvoteCount');

        if (!updatedTarget) {
          throw ApiError.notFound(`${targetType} not found`);
        }

        // 7. Prepare the response.
        result = formatResponse(updatedTarget, targetType, value);
      });

      return result;
    } catch (error) {
      // Retry duplicate-key conflicts caused by
      // concurrent first-time voting requests.
      if (error.code === DUPLICATE_KEY_ERROR && attempt < MAX_RETRIES - 1) {
        continue;
      }

      throw error;
    } finally {
      // Always release the database session.
      await session.endSession();
    }
  }
}

/**
 * Casts a vote on a post.
 */
export async function castPostVote(userId, postId, value) {
  return castVote({
    userId,
    targetType: 'Post',
    targetId: postId,
    value,
  });
}

/**
 * Casts a vote on a comment.
 */
export async function castCommentVote(userId, commentId, value) {
  return castVote({
    userId,
    targetType: 'Comment',
    targetId: commentId,
    value,
  });
}

/**
 * Retrieves a user's votes for multiple posts or comments.
 *
 * Returns a Map containing:
 * targetId -> vote value
 *
 * Targets without a vote receive a value of 0.
 */
export async function getUserVotesMap({ userId, targetType = 'Post', targetIds = [] }) {
  const result = new Map();

  if (!userId || targetIds.length === 0) {
    return result;
  }

  if (!['Post', 'Comment'].includes(targetType)) {
    throw ApiError.badRequest('targetType must be Post or Comment');
  }

  // Initialize every requested target with no vote.
  for (const id of targetIds) {
    result.set(String(id), 0);
  }

  // Retrieve all matching votes in one database query.
  const votes = await Vote.find({
    user: userId,
    targetType,
    targetId: { $in: targetIds },
  })
    .select('targetId value')
    .lean();

  // Replace the default values with actual user votes.
  for (const vote of votes) {
    result.set(String(vote.targetId), vote.value);
  }

  return result;
}
