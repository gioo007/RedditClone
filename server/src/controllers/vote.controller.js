import { castPostVote, castCommentVote } from '../services/vote.service.js';

/**
 * PUT /api/posts/:id/vote
 *
 * Creates, switches, or removes a post vote.
 */
export async function votePost(req, res, next) {
  try {
    const postId = req.params.id;
    const { value } = req.body ?? {};
    const userId = req.user?._id ?? req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: [],
        },
      });
    }

    const result = await castPostVote(userId, postId, value);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PUT /api/comments/:id/vote
 *
 * Creates, switches, or removes a comment vote.
 */
export async function voteComment(req, res, next) {
  try {
    const commentId = req.params.id;
    const { value } = req.body ?? {};
    const userId = req.user?._id ?? req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: [],
        },
      });
    }

    const result = await castCommentVote(userId, commentId, value);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}
