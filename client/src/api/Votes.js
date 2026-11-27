import { api } from './index.js';

async function sendVote(request, value) {
  if (![1, -1, 0].includes(value)) {
    throw new Error('Vote value must be 1, -1, or 0');
  }

  try {
    const response = await request();

    // Support wrapped and direct API responses.
    return response.data ?? response;
  } catch (error) {
    error.status = error.statusCode ?? error.status;
    throw error;
  }
}

export async function votePost(postId, value) {
  return sendVote(() => api.posts.vote(postId, value), value);
}

export async function voteComment(commentId, value) {
  return sendVote(() => api.comments.vote(commentId, value), value);
}
