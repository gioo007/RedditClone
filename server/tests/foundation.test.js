import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import { requireAuth } from '../src/middleware/auth.js';
import { Comment, Community, Membership, Post, User, Vote } from '../src/models/index.js';
import { castPostVote, resetInMemoryVotes } from '../src/services/vote.service.js';
import { decodeCursor, encodeCursor } from '../src/utils/pagination.js';

describe('Phase 0 Backend Foundation', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = createApp({
      registerExtraRoutes(instance) {
        instance.get('/api/_test-auth', requireAuth, (req, res) => {
          res.status(200).json({ success: true, data: req.user });
        });
      },
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET /api/health returns standardized success envelope', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'ok');
    assert.ok(['connected', 'connecting', 'disconnected'].includes(body.data.database));
  });

  it('GET /api/openapi.json serves parsed OpenAPI 3.0 contract', async () => {
    const res = await fetch(`${baseUrl}/api/openapi.json`);
    assert.equal(res.status, 200);
    const spec = await res.json();
    assert.equal(spec.openapi, '3.0.3');
    assert.ok(spec.paths['/posts/{id}/vote']);
    assert.ok(spec.paths['/posts/{id}/summary']);
    assert.ok(spec.paths['/comments/{id}/vote']);
  });

  it('Unknown routes return 404 with standardized error envelope', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  it('Stub requireAuth rejects unauthenticated calls and honors x-dev-user-id in non-prod', async () => {
    const unauth = await fetch(`${baseUrl}/api/_test-auth`);
    assert.equal(unauth.status, 401);

    const fakeId = new mongoose.Types.ObjectId().toString();
    const authed = await fetch(`${baseUrl}/api/_test-auth`, {
      headers: { 'x-dev-user-id': fakeId, 'x-dev-username': 'member_c' },
    });
    assert.equal(authed.status, 200);
    const body = await authed.json();
    assert.equal(body.data._id, fakeId);
    assert.equal(body.data.username, 'member_c');
  });

  it('Cursor pagination helper encodes and decodes compound cursors cleanly', () => {
    const id = new mongoose.Types.ObjectId().toString();
    const token = encodeCursor({ value: 42, id });
    const decoded = decodeCursor(token);
    assert.deepEqual(decoded, { v: 42, id });
  });

  it('In-memory voting stand-in computes accurate deltas for up, switch, and unvote', async () => {
    resetInMemoryVotes();
    const userId = new mongoose.Types.ObjectId().toString();
    const postId = new mongoose.Types.ObjectId().toString();

    const up = await castPostVote(userId, postId, 1);
    assert.equal(up.score, 1);
    assert.equal(up.upvoteCount, 1);
    assert.equal(up.downvoteCount, 0);

    const switched = await castPostVote(userId, postId, -1);
    assert.equal(switched.score, -1);
    assert.equal(switched.upvoteCount, 0);
    assert.equal(switched.downvoteCount, 1);

    const cleared = await castPostVote(userId, postId, 0);
    assert.equal(cleared.score, 0);
    assert.equal(cleared.upvoteCount, 0);
    assert.equal(cleared.downvoteCount, 0);
  });

  it('All 6 Mongoose schema skeletons validate required fields and relationships', () => {
    const user = new User({
      username: 'alice_dev',
      email: 'alice@example.com',
      passwordHash: 'hashed_secret',
    });
    assert.equal(user.validateSync(), undefined);
    assert.equal('passwordHash' in user.toJSON(), false);

    const community = new Community({
      name: 'WebDev',
      creator: user._id,
    });
    assert.equal(community.validateSync(), undefined);
    assert.equal(community.nameLower, 'webdev');
    assert.equal(community.moderators.length, 1);

    const membership = new Membership({
      user: user._id,
      community: community._id,
      role: 'moderator',
    });
    assert.equal(membership.validateSync(), undefined);

    const validPost = new Post({
      title: 'Hello Reddit Clone',
      type: 'text',
      content: 'Phase 0 schema test',
      author: user._id,
      community: community._id,
    });
    assert.equal(validPost.validateSync(), undefined);

    const invalidLinkPost = new Post({
      title: 'Missing URL',
      type: 'link',
      author: user._id,
      community: community._id,
    });
    const linkErr = invalidLinkPost.validateSync();
    assert.ok(linkErr?.errors?.linkUrl);

    const comment = new Comment({
      post: validPost._id,
      community: community._id,
      author: user._id,
      content: 'First nested-ready comment!',
      depth: 0,
    });
    assert.equal(comment.validateSync(), undefined);

    const vote = new Vote({
      user: user._id,
      targetType: 'Comment',
      targetId: comment._id,
      value: 1,
    });
    assert.equal(vote.validateSync(), undefined);
  });
});
