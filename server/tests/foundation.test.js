import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import { requireAuth } from '../src/schemas/middleware/auth.js';
import {
  idParamSchema,
  postSortQuerySchema,
  validate,
  voteBodySchema,
  z,
} from '../src/schemas/middleware/validate.js';

import { Comment, Community, Membership, Post, User, Vote } from '../src/models/index.js';
import { asyncHandler } from '../src/utils/asyncHandler.js';
import { decodeCursor, encodeCursor } from '../src/utils/pagination.js';

describe('Phase 0 Backend Foundation', () => {
  let server;
  let baseUrl;

  before(async () => {
    const sampleBodySchema = z.object({
      displayName: z.string().trim().min(1).max(50),
      bio: z.string().trim().max(500).default(''),
    });

    const app = createApp({
      registerExtraRoutes(instance) {
        instance.get('/api/_test-auth', requireAuth, (req, res) => {
          res.status(200).json({ success: true, data: req.user });
        });

        instance.post(
          '/api/_test-validate/:id',
          validate({
            params: idParamSchema,
            query: postSortQuerySchema,
            body: sampleBodySchema,
          }),
          (req, res) => {
            res.status(200).json({
              success: true,
              data: {
                params: req.params,
                query: req.query,
                body: req.body,
              },
            });
          }
        );

        instance.post(
          '/api/_test-direct-zod',
          asyncHandler(async (req, res) => {
            const parsed = voteBodySchema.parse(req.body);
            res.status(200).json({ success: true, data: parsed });
          })
        );
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

  it('Zod validate middleware strips unknown keys, coerces queries, and formats 400 errors', async () => {
    const validId = new mongoose.Types.ObjectId().toString();

    const okRes = await fetch(`${baseUrl}/api/_test-validate/${validId}?limit=15&sort=top`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: '  Alice  ',
        karma: { post: 999999 },
        isAdmin: true,
      }),
    });
    assert.equal(okRes.status, 200);
    const okBody = await okRes.json();
    assert.equal(okBody.data.query.limit, 15);
    assert.equal(okBody.data.query.sort, 'top');
    assert.deepEqual(okBody.data.body, { displayName: 'Alice', bio: '' });
    assert.equal('karma' in okBody.data.body, false);
    assert.equal('isAdmin' in okBody.data.body, false);

    const badRes = await fetch(`${baseUrl}/api/_test-validate/not-an-id?limit=999`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '' }),
    });
    assert.equal(badRes.status, 400);
    const badBody = await badRes.json();
    assert.equal(badBody.success, false);
    assert.equal(badBody.error.code, 'VALIDATION_ERROR');
    assert.ok(badBody.error.details.some((d) => d.field === 'id'));
    assert.ok(badBody.error.details.some((d) => d.field === 'limit'));
    assert.ok(badBody.error.details.some((d) => d.field === 'displayName'));

    const directZodRes = await fetch(`${baseUrl}/api/_test-direct-zod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 5 }),
    });
    assert.equal(directZodRes.status, 400);
    const directZodBody = await directZodRes.json();
    assert.equal(directZodBody.error.code, 'VALIDATION_ERROR');
  });
});
