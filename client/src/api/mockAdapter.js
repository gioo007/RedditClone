import { MOCK_COMMENTS, MOCK_COMMUNITIES, MOCK_POSTS, MOCK_USERS } from './mockData.js';

let postsState = structuredClone(MOCK_POSTS);
let commentsState = structuredClone(MOCK_COMMENTS);
let communitiesState = structuredClone(MOCK_COMMUNITIES);
let currentUser = structuredClone(MOCK_USERS[0]);

export function resetMockState() {
  postsState = structuredClone(MOCK_POSTS);
  commentsState = structuredClone(MOCK_COMMENTS);
  communitiesState = structuredClone(MOCK_COMMUNITIES);
  currentUser = structuredClone(MOCK_USERS[0]);
}

function paginateItems(items, urlObj) {
  const limit = Math.min(50, Math.max(1, Number(urlObj.searchParams.get('limit')) || 20));
  const cursor = urlObj.searchParams.get('cursor');
  let startIndex = 0;
  if (cursor) {
    const idx = items.findIndex((item) => item._id === cursor);
    if (idx !== -1) startIndex = idx + 1;
  }
  const slice = items.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < items.length;
  const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1]._id : null;

  return {
    success: true,
    data: slice,
    pagination: { nextCursor, hasMore, limit },
  };
}

function sortPosts(items, sortParam) {
  const list = [...items];
  if (sortParam === 'top') {
    list.sort((a, b) => b.score - a.score);
  } else {
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  return list;
}

function applyVoteMutation(target, targetType, value) {
  const prev = target.userVote || 0;
  const delta = value - prev;
  const upDelta = (value === 1 ? 1 : 0) - (prev === 1 ? 1 : 0);
  const downDelta = (value === -1 ? 1 : 0) - (prev === -1 ? 1 : 0);

  target.score += delta;
  target.upvoteCount = Math.max(0, target.upvoteCount + upDelta);
  target.downvoteCount = Math.max(0, target.downvoteCount + downDelta);
  target.userVote = value;

  return {
    success: true,
    data: {
      targetId: target._id,
      targetType,
      score: target.score,
      upvoteCount: target.upvoteCount,
      downvoteCount: target.downvoteCount,
      userVote: target.userVote,
    },
  };
}

function mockNotFound(message = 'Resource not found') {
  const err = new Error(message);
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  throw err;
}

/**
 * Lightweight mock router matching `docs/openapi.yaml` shapes when `VITE_USE_MOCKS=true`.
 */
export async function handleMockRequest(path, { method = 'GET', body } = {}) {
  const normalizedMethod = method.toUpperCase();
  const urlObj = new URL(path.startsWith('http') ? path : `http://mock.local${path}`);
  const pathname = urlObj.pathname.replace(/^\/api/, '') || '/';

  if (normalizedMethod === 'GET' && pathname === '/health') {
    return {
      success: true,
      data: {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      },
    };
  }

  if (
    normalizedMethod === 'POST' &&
    (pathname === '/auth/login' || pathname === '/auth/register')
  ) {
    return {
      success: true,
      data: {
        user: currentUser,
        token: 'mock-jwt-token-phase-0',
      },
    };
  }

  if (normalizedMethod === 'GET' && pathname === '/auth/me') {
    return { success: true, data: currentUser };
  }

  if (normalizedMethod === 'GET' && (pathname === '/feed' || pathname === '/posts')) {
    const sorted = sortPosts(postsState, urlObj.searchParams.get('sort') || 'new');
    return paginateItems(sorted, urlObj);
  }

  if (normalizedMethod === 'GET' && pathname === '/communities') {
    return paginateItems(communitiesState, urlObj);
  }

  const communityPostsMatch = pathname.match(/^\/communities\/([^/]+)\/posts$/);
  if (communityPostsMatch && normalizedMethod === 'GET') {
    const name = communityPostsMatch[1].toLowerCase();
    const filtered = postsState.filter((p) => p.community.name.toLowerCase() === name);
    const sorted = sortPosts(filtered, urlObj.searchParams.get('sort') || 'new');
    return paginateItems(sorted, urlObj);
  }

  const communityDetailMatch = pathname.match(/^\/communities\/([^/]+)$/);
  if (communityDetailMatch && normalizedMethod === 'GET') {
    const name = communityDetailMatch[1].toLowerCase();
    const found = communitiesState.find((c) => c.name.toLowerCase() === name);
    if (!found) mockNotFound(`Community r/${communityDetailMatch[1]} not found`);
    return { success: true, data: found };
  }

  const postDetailMatch = pathname.match(/^\/posts\/([^/]+)$/);
  if (postDetailMatch && normalizedMethod === 'GET') {
    const post = postsState.find((p) => p._id === postDetailMatch[1]);
    if (!post) mockNotFound('Post not found');
    return { success: true, data: post };
  }

  const postVoteMatch = pathname.match(/^\/posts\/([^/]+)\/vote$/);
  if (postVoteMatch && normalizedMethod === 'PUT') {
    const post = postsState.find((p) => p._id === postVoteMatch[1]);
    if (!post) mockNotFound('Post not found');
    return applyVoteMutation(post, 'Post', Number(body?.value ?? 0));
  }

  const postSummaryMatch = pathname.match(/^\/posts\/([^/]+)\/summary$/);
  if (postSummaryMatch && normalizedMethod === 'POST') {
    const post = postsState.find((p) => p._id === postSummaryMatch[1]);
    if (!post) mockNotFound('Post not found');
    const cached = Boolean(post.aiSummary?.text);
    if (!cached) {
      post.aiSummary = {
        text: `Summary of "${post.title}": ${post.content.slice(0, 140)}...`,
        generatedAt: new Date().toISOString(),
        model: 'mock-ai-v1',
      };
    }
    return {
      success: true,
      data: {
        postId: post._id,
        summary: post.aiSummary.text,
        model: post.aiSummary.model,
        generatedAt: post.aiSummary.generatedAt,
        cached,
      },
    };
  }

  const postCommentsMatch = pathname.match(/^\/posts\/([^/]+)\/comments$/);
  if (postCommentsMatch && normalizedMethod === 'GET') {
    const list = commentsState.filter((c) => c.post === postCommentsMatch[1]);
    return { success: true, data: list };
  }

  const commentVoteMatch = pathname.match(/^\/comments\/([^/]+)\/vote$/);
  if (commentVoteMatch && normalizedMethod === 'PUT') {
    const comment = commentsState.find((c) => c._id === commentVoteMatch[1]);
    if (!comment) mockNotFound('Comment not found');
    return applyVoteMutation(comment, 'Comment', Number(body?.value ?? 0));
  }

  if (normalizedMethod === 'GET' && pathname === '/search') {
    const q = (urlObj.searchParams.get('q') || '').trim().toLowerCase();
    const communities = communitiesState.filter(
      (c) => c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
    );
    const users = MOCK_USERS.filter(
      (u) => u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)
    );
    return {
      success: true,
      data: { communities, users },
      pagination: { nextCursor: null, hasMore: false, limit: 20 },
    };
  }

  mockNotFound(`No mock handler registered for ${normalizedMethod} ${pathname}`);
}
