import assert from 'node:assert/strict';
import { before, after, beforeEach, describe, it } from 'node:test';
import { once } from 'node:events';

import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { createApp } from '../src/app.js';
import { Vote, Post, Comment } from '../src/models/index.js';

let replSet;
let server;
let baseUrl;

const newId = () => new mongoose.Types.ObjectId();

before(
  async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: {
        count: 1,
        storageEngine: 'wiredTiger',
      },
    });

    await mongoose.connect(replSet.getUri());

    await Vote.init();
    await Post.init();
    await Comment.init();
    await Vote.createIndexes();

    const app = createApp();

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');

    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  },
  { timeout: 300000 }
);

after(async () => {
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  } finally {
    await mongoose.disconnect();

    if (replSet) {
      await replSet.stop();
    }
  }
});

beforeEach(async () => {
  await Vote.deleteMany({});
  await Post.deleteMany({});
  await Comment.deleteMany({});
});

async function makeTarget(Model) {
  const _id = newId();

  await Model.collection.insertOne({
    _id,
    score: 0,
    upvoteCount: 0,
    downvoteCount: 0,
  });

  return _id;
}

async function sendVote(path, value, userId) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (userId) {
    headers['x-dev-user-id'] = String(userId);
    headers['x-dev-username'] = 'voting_test_user';
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ value }),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

function expectVote(result, targetId, targetType, value) {
  assert.equal(result.status, 200);

  assert.deepEqual(result.body, {
    success: true,
    data: {
      targetId: String(targetId),
      targetType,
      score: value,
      upvoteCount: value === 1 ? 1 : 0,
      downvoteCount: value === -1 ? 1 : 0,
      userVote: value,
    },
  });
}

function expectError(result, status, code) {
  assert.equal(result.status, status);
  assert.equal(result.body.success, false);
  assert.equal(result.body.error.code, code);
  assert.equal(typeof result.body.error.message, 'string');
}

describe(
  'Voting System - HTTP Integration Tests',
  {
    timeout: 300000,
  },
  () => {
    it('Upvotes a post through the HTTP endpoint', async () => {
      const postId = await makeTarget(Post);
      const userId = newId();

      const result = await sendVote(`/posts/${postId}/vote`, 1, userId);

      expectVote(result, postId, 'Post', 1);
    });

    it('Repeated upvotes are idempotent', async () => {
      const postId = await makeTarget(Post);
      const userId = newId();

      await sendVote(`/posts/${postId}/vote`, 1, userId);

      const result = await sendVote(`/posts/${postId}/vote`, 1, userId);

      expectVote(result, postId, 'Post', 1);

      assert.equal(
        await Vote.countDocuments({
          user: userId,
          targetId: postId,
          targetType: 'Post',
        }),
        1
      );
    });

    it('Switches an upvote to a downvote', async () => {
      const postId = await makeTarget(Post);
      const userId = newId();

      await sendVote(`/posts/${postId}/vote`, 1, userId);

      const result = await sendVote(`/posts/${postId}/vote`, -1, userId);

      expectVote(result, postId, 'Post', -1);
    });

    it('Removes an existing vote', async () => {
      const postId = await makeTarget(Post);
      const userId = newId();

      await sendVote(`/posts/${postId}/vote`, 1, userId);

      const result = await sendVote(`/posts/${postId}/vote`, 0, userId);

      expectVote(result, postId, 'Post', 0);

      assert.equal(await Vote.countDocuments({ targetId: postId }), 0);
    });

    it('Votes on a comment through the HTTP endpoint', async () => {
      const commentId = await makeTarget(Comment);

      const result = await sendVote(`/comments/${commentId}/vote`, -1, newId());

      expectVote(result, commentId, 'Comment', -1);
    });

    it('Rejects unauthenticated voting requests', async () => {
      const postId = await makeTarget(Post);

      const result = await sendVote(`/posts/${postId}/vote`, 1);

      expectError(result, 401, 'UNAUTHORIZED');

      assert.equal(await Vote.countDocuments({}), 0);
    });

    it('Rejects invalid vote values', async () => {
      const postId = await makeTarget(Post);

      const result = await sendVote(`/posts/${postId}/vote`, 5, newId());

      expectError(result, 400, 'VALIDATION_ERROR');

      assert.equal(await Vote.countDocuments({}), 0);
    });

    it('Rejects invalid target IDs', async () => {
      const result = await sendVote('/posts/invalid-id/vote', 1, newId());

      expectError(result, 400, 'VALIDATION_ERROR');
    });

    it('Returns 404 for a nonexistent post', async () => {
      const result = await sendVote(`/posts/${newId()}/vote`, 1, newId());

      expectError(result, 404, 'NOT_FOUND');

      assert.equal(await Vote.countDocuments({}), 0);
    });

    it('Returns 404 for a nonexistent comment', async () => {
      const result = await sendVote(`/comments/${newId()}/vote`, 1, newId());

      expectError(result, 404, 'NOT_FOUND');

      assert.equal(await Vote.countDocuments({}), 0);
    });
  }
);
