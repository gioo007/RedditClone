import { Community, Post } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { getUserVotesMap } from './vote.service.js';

const AUTHOR_SELECT = '_id username displayName avatarUrl';
const COMMUNITY_SELECT = '_id name title iconUrl';

export function formatPostDto(postDoc, userVote = 0) {
  const raw = typeof postDoc.toObject === 'function' ? postDoc.toObject() : postDoc;

  const isRemoved = Boolean(raw.isRemoved);
  const isDeleted = Boolean(raw.isDeleted);

  let content = raw.content ?? '';
  let linkUrl = raw.linkUrl ?? '';
  let imageUrl = raw.imageUrl ?? '';

  if (isRemoved) {
    content = '[removed by moderator]';
    linkUrl = '';
    imageUrl = '';
  } else if (isDeleted) {
    content = '[deleted]';
    linkUrl = '';
    imageUrl = '';
  }

  const author =
    raw.author && typeof raw.author === 'object' && '_id' in raw.author
      ? {
          _id: String(raw.author._id),
          username: raw.author.username,
          displayName: raw.author.displayName ?? '',
          avatarUrl: raw.author.avatarUrl ?? '',
        }
      : {
          _id: String(raw.author),
          username: '[unknown]',
          displayName: '',
          avatarUrl: '',
        };

  const community =
    raw.community && typeof raw.community === 'object' && '_id' in raw.community
      ? {
          _id: String(raw.community._id),
          name: raw.community.name,
          title: raw.community.title || raw.community.name,
          iconUrl: raw.community.iconUrl ?? '',
        }
      : {
          _id: String(raw.community),
          name: '',
          title: '',
          iconUrl: '',
        };

  return {
    _id: String(raw._id),
    title: raw.title,
    type: raw.type,
    content,
    linkUrl,
    imageUrl,
    author,
    community,
    score: raw.score ?? 0,
    upvoteCount: raw.upvoteCount ?? 0,
    downvoteCount: raw.downvoteCount ?? 0,
    commentCount: raw.commentCount ?? 0,
    userVote,
    aiSummary: raw.aiSummary ?? null,
    isDeleted,
    isRemoved,
    removedReason: raw.removedReason ?? null,
    editedAt: raw.editedAt ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

async function getViewerVote(viewerId, postId) {
  if (!viewerId) return 0;
  const votesMap = await getUserVotesMap({
    userId: viewerId,
    targetType: 'Post',
    targetIds: [postId],
  });
  return votesMap.get(String(postId)) || 0;
}

export async function createPost({
  communityName,
  authorId,
  title,
  type = 'text',
  content = '',
  linkUrl = '',
  imageUrl = '',
}) {
  const community = await Community.findOne({ nameLower: communityName.toLowerCase() });
  if (!community) {
    throw ApiError.notFound(`Community r/${communityName} not found`);
  }

  const post = await Post.create({
    title,
    type,
    content,
    linkUrl: type === 'link' ? linkUrl : '',
    imageUrl: type === 'image' ? imageUrl : '',
    author: authorId,
    community: community._id,
  });

  await Community.updateOne({ _id: community._id }, { $inc: { postCount: 1 } });

  await post.populate([
    { path: 'author', select: AUTHOR_SELECT },
    { path: 'community', select: COMMUNITY_SELECT },
  ]);

  return formatPostDto(post, 0);
}

export async function getPostById({ postId, viewerId = null }) {
  const post = await Post.findById(postId)
    .populate('author', AUTHOR_SELECT)
    .populate('community', COMMUNITY_SELECT);

  if (!post) {
    throw ApiError.notFound('Post not found');
  }

  const userVote = await getViewerVote(viewerId, post._id);
  return formatPostDto(post, userVote);
}

export async function updatePost({ postId, userId, updates = {} }) {
  const post = await Post.findById(postId);
  if (!post) {
    throw ApiError.notFound('Post not found');
  }

  if (String(post.author) !== String(userId)) {
    throw ApiError.forbidden('Only the post author can edit this post');
  }

  if (post.isDeleted || post.isRemoved) {
    throw ApiError.badRequest('Cannot edit a deleted or removed post');
  }

  let bodyChanged = false;

  if (updates.content !== undefined && updates.content !== post.content) {
    post.content = updates.content;
    bodyChanged = true;
  }

  if (updates.linkUrl !== undefined) {
    if (post.type !== 'link') {
      throw ApiError.badRequest('linkUrl can only be updated on link posts', [
        { field: 'linkUrl', message: 'Post type is not link' },
      ]);
    }
    if (updates.linkUrl !== post.linkUrl) {
      post.linkUrl = updates.linkUrl;
      bodyChanged = true;
    }
  }

  if (updates.imageUrl !== undefined) {
    if (post.type !== 'image') {
      throw ApiError.badRequest('imageUrl can only be updated on image posts', [
        { field: 'imageUrl', message: 'Post type is not image' },
      ]);
    }
    if (updates.imageUrl !== post.imageUrl) {
      post.imageUrl = updates.imageUrl;
      bodyChanged = true;
    }
  }

  post.editedAt = new Date();
  if (bodyChanged) {
    post.aiSummary = null;
  }

  await post.save();
  await post.populate([
    { path: 'author', select: AUTHOR_SELECT },
    { path: 'community', select: COMMUNITY_SELECT },
  ]);

  const userVote = await getViewerVote(userId, post._id);
  return formatPostDto(post, userVote);
}

export async function deletePost({ postId, userId }) {
  const post = await Post.findById(postId);
  if (!post) {
    throw ApiError.notFound('Post not found');
  }

  if (String(post.author) !== String(userId)) {
    throw ApiError.forbidden('Only the post author can delete this post');
  }

  const wasActive = !post.isDeleted && !post.isRemoved;

  if (!post.isDeleted) {
    post.isDeleted = true;
    await post.save();
  }

  if (wasActive) {
    await Community.updateOne(
      { _id: post.community, postCount: { $gt: 0 } },
      { $inc: { postCount: -1 } }
    );
  }

  return {
    _id: String(post._id),
    isDeleted: true,
  };
}

export async function getPostCommunityForModeration(postId) {
  const post = await Post.findById(postId).select('community');
  if (!post) {
    throw ApiError.notFound('Post not found');
  }

  const community = await Community.findById(post.community);
  if (!community) {
    throw ApiError.notFound('Community not found');
  }

  return community;
}

export async function moderateRemovePost({ postId, moderatorId, reason = null }) {
  const post = await Post.findById(postId);
  if (!post) {
    throw ApiError.notFound('Post not found');
  }

  const wasActive = !post.isDeleted && !post.isRemoved;

  post.isRemoved = true;
  post.removedBy = moderatorId;
  post.removedReason = reason && reason.trim() ? reason.trim() : null;

  await post.save();

  if (wasActive) {
    await Community.updateOne(
      { _id: post.community, postCount: { $gt: 0 } },
      { $inc: { postCount: -1 } }
    );
  }

  await post.populate([
    { path: 'author', select: AUTHOR_SELECT },
    { path: 'community', select: COMMUNITY_SELECT },
  ]);

  const userVote = await getViewerVote(moderatorId, post._id);
  return formatPostDto(post, userVote);
}
