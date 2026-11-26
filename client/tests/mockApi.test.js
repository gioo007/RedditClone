import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { handleMockRequest, resetMockState } from '../src/api/mockAdapter.js';

describe('Phase 0 Frontend Mock API Adapter', () => {
  beforeEach(() => {
    resetMockState();
  });

  it('GET /health returns OpenAPI-compliant status envelope', async () => {
    const res = await handleMockRequest('/health');
    assert.equal(res.success, true);
    assert.equal(res.data.status, 'ok');
  });

  it('GET /feed returns cursor-paginated posts', async () => {
    const page1 = await handleMockRequest('/feed?limit=1&sort=new');
    assert.equal(page1.success, true);
    assert.equal(page1.data.length, 1);
    assert.equal(page1.pagination.hasMore, true);
    assert.ok(page1.pagination.nextCursor);

    const page2 = await handleMockRequest(
      `/feed?limit=1&sort=new&cursor=${page1.pagination.nextCursor}`
    );
    assert.equal(page2.data.length, 1);
    assert.notEqual(page2.data[0]._id, page1.data[0]._id);
  });

  it('PUT /posts/:id/vote updates score and userVote idempotently', async () => {
    const postId = '65f1a2b3c4d5e6f7a8b9c202';
    const upvoted = await handleMockRequest(`/posts/${postId}/vote`, {
      method: 'PUT',
      body: { value: 1 },
    });
    assert.equal(upvoted.data.score, 28);
    assert.equal(upvoted.data.userVote, 1);

    const cleared = await handleMockRequest(`/posts/${postId}/vote`, {
      method: 'PUT',
      body: { value: 0 },
    });
    assert.equal(cleared.data.score, 27);
    assert.equal(cleared.data.userVote, 0);
  });

  it('POST /posts/:id/summary generates and caches AI summary', async () => {
    const postId = '65f1a2b3c4d5e6f7a8b9c201';
    const first = await handleMockRequest(`/posts/${postId}/summary`, { method: 'POST' });
    assert.equal(first.data.cached, false);
    assert.ok(first.data.summary.length > 10);

    const second = await handleMockRequest(`/posts/${postId}/summary`, { method: 'POST' });
    assert.equal(second.data.cached, true);
  });
});
