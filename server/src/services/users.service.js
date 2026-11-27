import { Comment, Post, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import {
  buildCursorSortAndFilter,
  encodeCursor,
  parsePaginationParams,
} from '../utils/pagination.js';
// TODO(voting): getUserVotesMap is still the voting owner's in-memory stand-in
import { getUserVotesMap } from './vote.service.js';


// TODO(auth): registration must reject usernames that differ only by case
const CASE_INSENSITIVE = { locale: 'en', strength: 2 };
const AUTHOR_FIELDS = 'username displayName avatarUrl';

async function findUser(username) {
  const user = await User.findOne({ username }).collation(CASE_INSENSITIVE).select('-email').lean();
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function getProfile(username) {
  return findUser(username);
}

export async function updateProfile(userId, changes) {
  const user = await User.findByIdAndUpdate(userId, changes, {
    new: true,
    runValidators: true,
  }).lean();
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

// Shared by posts and comments: one page of a user's visible items
async function paginateByAuthor(Model, { authorId, sort, query, populate }) {
  const { limit, cursor } = parsePaginationParams(query);
  const { sortSpec, cursorFilter } = buildCursorSortAndFilter({ sort, cursor });

  // Fetch one extra item to know whether there is a next page
  const docs = await Model.find({
    author: authorId,
    isDeleted: false,
    isRemoved: false,
    ...cursorFilter,
  })
    .sort(sortSpec)
    .limit(limit + 1)
    .select('-removedBy')
    .populate(populate)
    .lean();

  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit);
  const last = items[items.length - 1];
  const sortField = sort === 'top' ? 'score' : 'createdAt';
  const nextCursor = hasMore ? encodeCursor({ value: last[sortField], id: last._id }) : null;

  return { items, pagination: { nextCursor, hasMore, limit } };
}

// Adds the viewer's own vote (0 for guests) to each item
async function withUserVotes(items, viewerId, targetType) {
  const votes = await getUserVotesMap({
    userId: viewerId,
    targetType,
    targetIds: items.map((item) => String(item._id)),
  });
  return items.map((item) => ({ ...item, userVote: votes.get(String(item._id)) || 0 }));
}

export async function listUserPosts(username, query, viewerId) {
  const user = await findUser(username);
  // TODO(posts): if the posts owner adds a shared post formatter, use it here
  // TODO(communities): populate relies on the Community model
  const { items, pagination } = await paginateByAuthor(Post, {
    authorId: user._id,
    sort: query.sort,
    query,
    populate: [
      { path: 'author', select: AUTHOR_FIELDS },
      { path: 'community', select: 'name title iconUrl' },
    ],
  });

  return { items: await withUserVotes(items, viewerId, 'Post'), pagination };
}

export async function listUserComments(username, query, viewerId) {
  const user = await findUser(username);
  // TODO(comments): if the comments owner adds a shared formatter, use it here
  const { items, pagination } = await paginateByAuthor(Comment, {
    authorId: user._id,
    sort: 'new',
    query,
    populate: [
      { path: 'author', select: AUTHOR_FIELDS },
      { path: 'post', select: 'title community', populate: { path: 'community', select: 'name' } },
    ],
  });


  const shaped = items.map(({ post, ...comment }) => ({
    ...comment,
    post: post?._id ?? null,
    postInfo: { title: post?.title ?? '', communityName: post?.community?.name ?? '' },
  }));

  return { items: await withUserVotes(shaped, viewerId, 'Comment'), pagination };
}