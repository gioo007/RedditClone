import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import { Community, Post, User } from '../src/models/index.js';
import { formatPostDto } from '../src/services/post.service.js';
import { castPostVote, resetInMemoryVotes } from '../src/services/vote.service.js';

const TEST_DB_URI =
  process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/reddit_clone_posts_test';

function authHeaders(userId, username = 'test_user') {
  return {
    'Content-Type': 'application/json',
    'x-dev-user-id': String(userId),
    'x-dev-username': username,
  };
}

describe('Posts Component (#5)', () => {
  let server;
  let baseUrl;
  let dbConnected = false;

  before(async () => {
    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    try {
      await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 2000 });
      dbConnected = true;
    } catch {
      dbConnected = false;
    }
  });

  after(async () => {
    if (dbConnected) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('Validation, Auth Guards & DTO Formatting (Unit / HTTP)', () => {
    const fakeUserId = new mongoose.Types.ObjectId().toString();
    const fakePostId = new mongoose.Types.ObjectId().toString();

    it('formatPostDto masks deleted and moderator-removed posts cleanly', () => {
      const baseDoc = {
        _id: fakePostId,
        title: 'Sample',
        type: 'link',
        content: 'Original body',
        linkUrl: 'https://example.com',
        imageUrl: '',
        author: { _id: fakeUserId, username: 'alice', displayName: 'Alice', avatarUrl: '' },
        community: {
          _id: new mongoose.Types.ObjectId().toString(),
          name: 'webdev',
          title: 'Web Dev',
          iconUrl: '',
        },
        score: 5,
        upvoteCount: 5,
        downvoteCount: 0,
        commentCount: 2,
        isDeleted: false,
        isRemoved: false,
        removedReason: null,
        editedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const deletedDto = formatPostDto({ ...baseDoc, isDeleted: true }, 1);
      assert.equal(deletedDto.content, '[deleted]');
      assert.equal(deletedDto.linkUrl, '');
      assert.equal(deletedDto.userVote, 1);

      const removedDto = formatPostDto(
        { ...baseDoc, isDeleted: true, isRemoved: true, removedReason: 'Rule 1' },
        0
      );
      assert.equal(removedDto.content, '[removed by moderator]');
      assert.equal(removedDto.linkUrl, '');
      assert.equal(removedDto.removedReason, 'Rule 1');
    });

    it('POST /api/communities/:name/posts rejects unauthenticated requests (401)', async () => {
      const res = await fetch(`${baseUrl}/api/communities/webdev/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Hello', type: 'text', content: 'Body' }),
      });
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error.code, 'UNAUTHORIZED');
    });

    it('POST /api/communities/:name/posts enforces linkUrl, imageUrl, and safe http(s) URLs (400)', async () => {
      const missingLink = await fetch(`${baseUrl}/api/communities/webdev/posts`, {
        method: 'POST',
        headers: authHeaders(fakeUserId),
        body: JSON.stringify({ title: 'Link without URL', type: 'link' }),
      });
      assert.equal(missingLink.status, 400);
      const missingLinkBody = await missingLink.json();
      assert.equal(missingLinkBody.error.code, 'VALIDATION_ERROR');
      assert.ok(missingLinkBody.error.details.some((d) => d.field === 'linkUrl'));

      const missingImage = await fetch(`${baseUrl}/api/communities/webdev/posts`, {
        method: 'POST',
        headers: authHeaders(fakeUserId),
        body: JSON.stringify({ title: 'Image without URL', type: 'image' }),
      });
      assert.equal(missingImage.status, 400);
      const missingImageBody = await missingImage.json();
      assert.ok(missingImageBody.error.details.some((d) => d.field === 'imageUrl'));

      const xssUrl = await fetch(`${baseUrl}/api/communities/webdev/posts`, {
        method: 'POST',
        headers: authHeaders(fakeUserId),
        body: JSON.stringify({
          title: 'XSS attempt',
          type: 'link',
          linkUrl: 'javascript:alert(1)',
        }),
      });
      assert.equal(xssUrl.status, 400);
    });

    it('GET/PATCH/DELETE/remove validate ObjectId params and payloads', async () => {
      const badGet = await fetch(`${baseUrl}/api/posts/not-an-object-id`);
      assert.equal(badGet.status, 400);

      const unauthPatch = await fetch(`${baseUrl}/api/posts/${fakePostId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Updated' }),
      });
      assert.equal(unauthPatch.status, 401);

      const emptyPatch = await fetch(`${baseUrl}/api/posts/${fakePostId}`, {
        method: 'PATCH',
        headers: authHeaders(fakeUserId),
        body: JSON.stringify({}),
      });
      assert.equal(emptyPatch.status, 400);

      const unauthDelete = await fetch(`${baseUrl}/api/posts/${fakePostId}`, {
        method: 'DELETE',
      });
      assert.equal(unauthDelete.status, 401);

      const longReasonRemove = await fetch(`${baseUrl}/api/posts/${fakePostId}/remove`, {
        method: 'POST',
        headers: authHeaders(fakeUserId),
        body: JSON.stringify({ reason: 'x'.repeat(301) }),
      });
      assert.equal(longReasonRemove.status, 400);
    });
  });

  describe('Posts CRUD & Moderation Integration (MongoDB)', () => {
    let modUser;
    let authorUser;
    let otherUser;
    let community;
    let textPostId;
    let linkPostId;

    before(async () => {
      if (!dbConnected) return;

      await Promise.all([User.deleteMany({}), Community.deleteMany({}), Post.deleteMany({})]);
      resetInMemoryVotes();

      [modUser, authorUser, otherUser] = await User.create([
        {
          username: 'mod_alice',
          email: 'mod_alice@example.com',
          passwordHash: 'hashed_pw_1',
          displayName: 'Mod Alice',
        },
        {
          username: 'author_bob',
          email: 'author_bob@example.com',
          passwordHash: 'hashed_pw_2',
          displayName: 'Author Bob',
        },
        {
          username: 'other_carol',
          email: 'other_carol@example.com',
          passwordHash: 'hashed_pw_3',
          displayName: 'Other Carol',
        },
      ]);

      community = await Community.create({
        name: 'WebDev',
        title: 'Web Development',
        description: 'All things web',
        creator: modUser._id,
      });
    });

    it('POST /api/communities/:name/posts creates text, link, and image posts and increments postCount', async (t) => {
      if (!dbConnected) return t.skip('MongoDB is not reachable locally');

      const textRes = await fetch(`${baseUrl}/api/communities/webdev/posts`, {
        method: 'POST',
        headers: authHeaders(authorUser._id, authorUser.username),
        body: JSON.stringify({
          title: 'First Text Post',
          type: 'text',
          content: 'Hello from MongoDB integration test!',
          score: 9999,
          isRemoved: true,
        }),
      });
      assert.equal(textRes.status, 201);
      const textBody = await textRes.json();
      assert.equal(textBody.success, true);
      assert.equal(textBody.data.title, 'First Text Post');
      assert.equal(textBody.data.score, 0);
      assert.equal(textBody.data.isRemoved, false);
      assert.equal(textBody.data.author.username, 'author_bob');
      assert.equal(textBody.data.community.name, 'WebDev');
      textPostId = textBody.data._id;

      const linkRes = await fetch(`${baseUrl}/api/communities/WebDev/posts`, {
        method: 'POST',
        headers: authHeaders(authorUser._id, authorUser.username),
        body: JSON.stringify({
          title: 'Useful Docs',
          type: 'link',
          linkUrl: 'https://developer.mozilla.org',
        }),
      });
      assert.equal(linkRes.status, 201);
      const linkBody = await linkRes.json();
      assert.equal(linkBody.data.linkUrl, 'https://developer.mozilla.org');
      linkPostId = linkBody.data._id;

      const imageRes = await fetch(`${baseUrl}/api/communities/webdev/posts`, {
        method: 'POST',
        headers: authHeaders(authorUser._id, authorUser.username),
        body: JSON.stringify({
          title: 'Architecture Diagram',
          type: 'image',
          imageUrl: 'https://example.com/diagram.png',
        }),
      });
      assert.equal(imageRes.status, 201);

      const updatedCommunity = await Community.findById(community._id);
      assert.equal(updatedCommunity.postCount, 3);

      const missingCommunity = await fetch(`${baseUrl}/api/communities/does_not_exist/posts`, {
        method: 'POST',
        headers: authHeaders(authorUser._id, authorUser.username),
        body: JSON.stringify({ title: 'Orphan', type: 'text' }),
      });
      assert.equal(missingCommunity.status, 404);
    });

    it('GET /api/posts/:id returns populated post with viewer userVote and 404 for unknown id', async (t) => {
      if (!dbConnected) return t.skip('MongoDB is not reachable locally');

      await castPostVote(String(otherUser._id), textPostId, 1);

      const res = await fetch(`${baseUrl}/api/posts/${textPostId}`, {
        headers: authHeaders(otherUser._id, otherUser.username),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data._id, textPostId);
      assert.equal(body.data.userVote, 1);
      assert.equal(body.data.author.username, 'author_bob');
      assert.equal(body.data.community.name, 'WebDev');

      const missingId = new mongoose.Types.ObjectId().toString();
      const missingRes = await fetch(`${baseUrl}/api/posts/${missingId}`);
      assert.equal(missingRes.status, 404);
    });

    it('PATCH /api/posts/:id allows author edit, clears aiSummary, and blocks non-author (403)', async (t) => {
      if (!dbConnected) return t.skip('MongoDB is not reachable locally');

      await Post.updateOne(
        { _id: textPostId },
        {
          $set: {
            aiSummary: {
              text: 'Old cached summary',
              generatedAt: new Date(),
              model: 'gemini-2.5-flash',
            },
          },
        }
      );

      const forbiddenRes = await fetch(`${baseUrl}/api/posts/${textPostId}`, {
        method: 'PATCH',
        headers: authHeaders(otherUser._id, otherUser.username),
        body: JSON.stringify({ content: 'Hacked edit' }),
      });
      assert.equal(forbiddenRes.status, 403);

      const wrongFieldRes = await fetch(`${baseUrl}/api/posts/${textPostId}`, {
        method: 'PATCH',
        headers: authHeaders(authorUser._id, authorUser.username),
        body: JSON.stringify({ linkUrl: 'https://example.com' }),
      });
      assert.equal(wrongFieldRes.status, 400);

      const okRes = await fetch(`${baseUrl}/api/posts/${textPostId}`, {
        method: 'PATCH',
        headers: authHeaders(authorUser._id, authorUser.username),
        body: JSON.stringify({ content: 'Updated post body!' }),
      });
      assert.equal(okRes.status, 200);
      const okBody = await okRes.json();
      assert.equal(okBody.data.content, 'Updated post body!');
      assert.ok(okBody.data.editedAt);
      assert.equal(okBody.data.aiSummary, null);
    });

    it('DELETE /api/posts/:id soft-deletes author post, masks content, and decrements postCount once', async (t) => {
      if (!dbConnected) return t.skip('MongoDB is not reachable locally');

      const forbiddenRes = await fetch(`${baseUrl}/api/posts/${textPostId}`, {
        method: 'DELETE',
        headers: authHeaders(otherUser._id, otherUser.username),
      });
      assert.equal(forbiddenRes.status, 403);

      const deleteRes = await fetch(`${baseUrl}/api/posts/${textPostId}`, {
        method: 'DELETE',
        headers: authHeaders(authorUser._id, authorUser.username),
      });
      assert.equal(deleteRes.status, 200);
      const deleteBody = await deleteRes.json();
      assert.deepEqual(deleteBody.data, { _id: textPostId, isDeleted: true });

      const afterFirstDelete = await Community.findById(community._id);
      assert.equal(afterFirstDelete.postCount, 2);

      // Second delete should be idempotent and not decrement postCount again
      const secondDeleteRes = await fetch(`${baseUrl}/api/posts/${textPostId}`, {
        method: 'DELETE',
        headers: authHeaders(authorUser._id, authorUser.username),
      });
      assert.equal(secondDeleteRes.status, 200);
      const afterSecondDelete = await Community.findById(community._id);
      assert.equal(afterSecondDelete.postCount, 2);

      // GET masks deleted body
      const getDeleted = await fetch(`${baseUrl}/api/posts/${textPostId}`);
      assert.equal(getDeleted.status, 200);
      const deletedBody = await getDeleted.json();
      assert.equal(deletedBody.data.isDeleted, true);
      assert.equal(deletedBody.data.content, '[deleted]');

      // Editing a deleted post is rejected
      const editDeleted = await fetch(`${baseUrl}/api/posts/${textPostId}`, {
        method: 'PATCH',
        headers: authHeaders(authorUser._id, authorUser.username),
        body: JSON.stringify({ content: 'Cannot edit' }),
      });
      assert.equal(editDeleted.status, 400);
    });

    it('POST /api/posts/:id/remove allows community moderator only and masks post with reason', async (t) => {
      if (!dbConnected) return t.skip('MongoDB is not reachable locally');

      const nonModRes = await fetch(`${baseUrl}/api/posts/${linkPostId}/remove`, {
        method: 'POST',
        headers: authHeaders(authorUser._id, authorUser.username),
        body: JSON.stringify({ reason: 'Self-remove attempt' }),
      });
      assert.equal(nonModRes.status, 403);

      const modRes = await fetch(`${baseUrl}/api/posts/${linkPostId}/remove`, {
        method: 'POST',
        headers: authHeaders(modUser._id, modUser.username),
        body: JSON.stringify({ reason: 'Violates community rule 1' }),
      });
      assert.equal(modRes.status, 200);
      const modBody = await modRes.json();
      assert.equal(modBody.data.isRemoved, true);
      assert.equal(modBody.data.content, '[removed by moderator]');
      assert.equal(modBody.data.linkUrl, '');
      assert.equal(modBody.data.removedReason, 'Violates community rule 1');

      const updatedCommunity = await Community.findById(community._id);
      assert.equal(updatedCommunity.postCount, 1);
    });
  });
});
