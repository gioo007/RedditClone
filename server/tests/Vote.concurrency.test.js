import assert from 'node:assert/strict';
import { before, after, beforeEach, describe, it } from 'node:test';

import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { Vote, Post, Comment } from '../src/models/index.js';

import { castPostVote, castCommentVote, getUserVotesMap } from '../src/services/vote.service.js';

let replSet;

// Start MongoDB replica set for transaction testing.
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
  },
  { timeout: 300000 }
);

// Clean up after all tests.
after(async () => {
  await mongoose.disconnect();

  if (replSet) {
    await replSet.stop();
  }
});

// Reset database before each test.
beforeEach(async () => {
  await Vote.deleteMany({});
  await Post.deleteMany({});
  await Comment.deleteMany({});
});

const newId = () => new mongoose.Types.ObjectId();

// Wait for every concurrent operation to finish.
async function runConcurrent(operations) {
  const results = await Promise.allSettled(operations);

  const failures = results.filter((result) => result.status === 'rejected');

  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      'One or more concurrent voting requests failed'
    );
  }

  return results.map((result) => result.value);
}

// Create a minimal post.
async function makePost() {
  const _id = newId();

  await Post.collection.insertOne({
    _id,
    score: 0,
    upvoteCount: 0,
    downvoteCount: 0,
  });

  return _id;
}

// Create a minimal comment.
async function makeComment() {
  const _id = newId();

  await Comment.collection.insertOne({
    _id,
    score: 0,
    upvoteCount: 0,
    downvoteCount: 0,
  });

  return _id;
}

// Verify database consistency.
async function expectConsistent(targetId, targetType = 'Post') {
  const TargetModel = targetType === 'Post' ? Post : Comment;

  const votes = await Vote.find({
    targetId,
    targetType,
  }).lean();

  const upvoteCount = votes.filter((vote) => vote.value === 1).length;

  const downvoteCount = votes.filter((vote) => vote.value === -1).length;

  const score = upvoteCount - downvoteCount;

  const target = await TargetModel.collection.findOne({
    _id: targetId,
  });

  assert.ok(target, 'Voting target must exist');

  assert.equal(target.score, score);
  assert.equal(target.upvoteCount, upvoteCount);
  assert.equal(target.downvoteCount, downvoteCount);

  const uniqueUsers = new Set(votes.map((vote) => String(vote.user)));

  assert.equal(uniqueUsers.size, votes.length);

  assert.ok(votes.every((vote) => [1, -1].includes(vote.value)));
}

describe('Voting System - Concurrency Tests', { timeout: 300000 }, () => {
  it('100 different users upvote concurrently', async () => {
    const postId = await makePost();

    await runConcurrent(Array.from({ length: 100 }, () => castPostVote(newId(), postId, 1)));

    const post = await Post.collection.findOne({
      _id: postId,
    });

    assert.equal(post.score, 100);
    assert.equal(post.upvoteCount, 100);
    assert.equal(post.downvoteCount, 0);

    await expectConsistent(postId);
  });

  it('Same user upvotes 20 times concurrently', async () => {
    const postId = await makePost();
    const userId = newId();

    await runConcurrent(Array.from({ length: 20 }, () => castPostVote(userId, postId, 1)));

    const post = await Post.collection.findOne({
      _id: postId,
    });

    assert.equal(post.score, 1);
    assert.equal(post.upvoteCount, 1);
    assert.equal(post.downvoteCount, 0);

    assert.equal(
      await Vote.countDocuments({
        user: userId,
        targetType: 'Post',
        targetId: postId,
      }),
      1
    );

    await expectConsistent(postId);
  });

  it('Switching and removing votes updates statistics', async () => {
    const postId = await makePost();
    const userId = newId();

    let result = await castPostVote(userId, postId, 1);

    assert.equal(result.score, 1);
    assert.equal(result.upvoteCount, 1);
    assert.equal(result.downvoteCount, 0);
    assert.equal(result.userVote, 1);

    result = await castPostVote(userId, postId, -1);

    assert.equal(result.score, -1);
    assert.equal(result.upvoteCount, 0);
    assert.equal(result.downvoteCount, 1);
    assert.equal(result.userVote, -1);

    result = await castPostVote(userId, postId, 1);

    assert.equal(result.score, 1);
    assert.equal(result.upvoteCount, 1);
    assert.equal(result.downvoteCount, 0);

    result = await castPostVote(userId, postId, 0);

    assert.equal(result.score, 0);
    assert.equal(result.upvoteCount, 0);
    assert.equal(result.downvoteCount, 0);
    assert.equal(result.userVote, 0);

    result = await castPostVote(userId, postId, 0);

    assert.equal(result.score, 0);

    assert.equal(
      await Vote.countDocuments({
        user: userId,
        targetType: 'Post',
        targetId: postId,
      }),
      0
    );

    await expectConsistent(postId);
  });

  it('Same user sends 30 mixed concurrent votes', async () => {
    const postId = await makePost();
    const userId = newId();

    const values = [1, -1, 0];

    await runConcurrent(
      Array.from({ length: 30 }, (_, index) =>
        castPostVote(userId, postId, values[index % values.length])
      )
    );

    const count = await Vote.countDocuments({
      user: userId,
      targetType: 'Post',
      targetId: postId,
    });

    assert.ok(count <= 1);

    await expectConsistent(postId);
  });

  it('20 users send 200 mixed concurrent votes', async () => {
    const postId = await makePost();

    const users = Array.from({ length: 20 }, () => newId());

    const values = [1, -1, 0];

    await runConcurrent(
      users.flatMap((userId, userIndex) =>
        Array.from({ length: 10 }, (_, index) =>
          castPostVote(userId, postId, values[(userIndex + index) % 3])
        )
      )
    );

    await expectConsistent(postId);
  });

  it('Concurrent upvotes and downvotes cancel correctly', async () => {
    const postId = await makePost();

    await runConcurrent([
      ...Array.from({ length: 25 }, () => castPostVote(newId(), postId, 1)),
      ...Array.from({ length: 25 }, () => castPostVote(newId(), postId, -1)),
    ]);

    const post = await Post.collection.findOne({
      _id: postId,
    });

    assert.equal(post.score, 0);
    assert.equal(post.upvoteCount, 25);
    assert.equal(post.downvoteCount, 25);

    await expectConsistent(postId);
  });

  it('Comment voting supports concurrent requests', async () => {
    const commentId = await makeComment();

    await runConcurrent(Array.from({ length: 20 }, () => castCommentVote(newId(), commentId, 1)));

    const comment = await Comment.collection.findOne({
      _id: commentId,
    });

    assert.equal(comment.score, 20);
    assert.equal(comment.upvoteCount, 20);
    assert.equal(comment.downvoteCount, 0);

    await expectConsistent(commentId, 'Comment');
  });

  it('Post and comment votes are independent', async () => {
    const postId = await makePost();
    const commentId = await makeComment();
    const userId = newId();

    await runConcurrent([castPostVote(userId, postId, 1), castCommentVote(userId, commentId, -1)]);

    assert.equal(await Vote.countDocuments({ user: userId }), 2);

    await expectConsistent(postId, 'Post');
    await expectConsistent(commentId, 'Comment');
  });

  it('Invalid vote values are rejected', async () => {
    const postId = await makePost();

    await assert.rejects(() => castPostVote(newId(), postId, 5));

    await expectConsistent(postId);
  });

  it('Voting on a nonexistent post is rejected', async () => {
    await assert.rejects(() => castPostVote(newId(), newId(), 1));

    assert.equal(await Vote.countDocuments({}), 0);
  });

  it('User votes are retrieved correctly', async () => {
    const userId = newId();

    const postA = await makePost();
    const postB = await makePost();
    const postC = await makePost();

    await castPostVote(userId, postA, 1);
    await castPostVote(userId, postB, -1);

    const votes = await getUserVotesMap({
      userId,
      targetType: 'Post',
      targetIds: [postA, postB, postC],
    });

    assert.equal(votes.get(String(postA)), 1);
    assert.equal(votes.get(String(postB)), -1);
    assert.equal(votes.get(String(postC)), 0);
  });

  it('Invalid target IDs are rejected', async () => {
    await assert.rejects(() => castPostVote(newId(), 'invalid-id', 1));

    assert.equal(await Vote.countDocuments({}), 0);
  });

  it('Guest vote lookup returns an empty map', async () => {
    const postId = await makePost();

    const votes = await getUserVotesMap({
      userId: null,
      targetType: 'Post',
      targetIds: [postId],
    });

    assert.equal(votes.size, 0);
  });
});

describe('Voting System - Transaction Rollback', () => {
  it('Rolls back vote creation when updating post statistics fails', async (t) => {
    const postId = await makePost();
    const userId = newId();

    const updateMock = t.mock.method(Post, 'findByIdAndUpdate', () => {
      throw new Error('Simulated database update failure');
    });

    try {
      await assert.rejects(
        () => castPostVote(userId, postId, 1),
        /Simulated database update failure/
      );

      assert.ok(updateMock.mock.callCount() > 0);

      // Verify that the vote document was rolled back.
      assert.equal(
        await Vote.countDocuments({
          user: userId,
          targetType: 'Post',
          targetId: postId,
        }),
        0
      );

      // Verify that post statistics remain unchanged.
      const post = await Post.collection.findOne({
        _id: postId,
      });

      assert.equal(post.score, 0);
      assert.equal(post.upvoteCount, 0);
      assert.equal(post.downvoteCount, 0);

      await expectConsistent(postId);
    } finally {
      updateMock.mock.restore();
    }

    // Verify that normal voting still works after the failure.
    const result = await castPostVote(userId, postId, 1);

    assert.equal(result.score, 1);
    assert.equal(result.upvoteCount, 1);
    assert.equal(result.userVote, 1);

    await expectConsistent(postId);
  });
});
