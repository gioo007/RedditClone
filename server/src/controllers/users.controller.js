import * as usersService from '../services/users.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getProfile = asyncHandler(async (req, res) => {
  const user = await usersService.getProfile(req.params.username);
  res.status(200).json({ success: true, data: user });
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await usersService.updateProfile(req.user._id, req.body);
  res.status(200).json({ success: true, data: user });
});

export const listPosts = asyncHandler(async (req, res) => {
  const { items, pagination } = await usersService.listUserPosts(
    req.params.username,
    req.query,
    req.user?._id
  );
  res.status(200).json({ success: true, data: items, pagination });
});

export const listComments = asyncHandler(async (req, res) => {
  const { items, pagination } = await usersService.listUserComments(
    req.params.username,
    req.query,
    req.user?._id
  );
  res.status(200).json({ success: true, data: items, pagination });
});