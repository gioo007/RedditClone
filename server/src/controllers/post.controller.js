import {
  createPost,
  deletePost,
  getPostById,
  getPostCommunityForModeration,
  moderateRemovePost,
  updatePost,
} from '../services/post.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createPostHandler = asyncHandler(async (req, res) => {
  const { title, type, content, linkUrl, imageUrl } = req.body;
  const post = await createPost({
    communityName: req.params.name,
    authorId: req.user._id,
    title,
    type,
    content,
    linkUrl,
    imageUrl,
  });

  res.status(201).json({
    success: true,
    data: post,
  });
});

export const getPostByIdHandler = asyncHandler(async (req, res) => {
  const post = await getPostById({
    postId: req.params.id,
    viewerId: req.user?._id ?? null,
  });

  res.status(200).json({
    success: true,
    data: post,
  });
});

export const updatePostHandler = asyncHandler(async (req, res) => {
  const post = await updatePost({
    postId: req.params.id,
    userId: req.user._id,
    updates: req.body,
  });

  res.status(200).json({
    success: true,
    data: post,
  });
});

export const deletePostHandler = asyncHandler(async (req, res) => {
  const result = await deletePost({
    postId: req.params.id,
    userId: req.user._id,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const loadPostCommunity = asyncHandler(async (req, _res, next) => {
  req.community = await getPostCommunityForModeration(req.params.id);
  next();
});

export const removePostHandler = asyncHandler(async (req, res) => {
  const post = await moderateRemovePost({
    postId: req.params.id,
    moderatorId: req.user._id,
    reason: req.body?.reason ?? null,
  });

  res.status(200).json({
    success: true,
    data: post,
  });
});
