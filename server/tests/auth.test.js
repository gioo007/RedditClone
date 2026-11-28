import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import argon2 from 'argon2';

import { RefreshToken } from '../src/models/RefreshToken.js';
import { User } from '../src/models/User.js';
import { getRefreshCookieOptions, verifyAccessToken } from '../src/services/auth.service.js';
import {
  isBreachedPassword,
  normalizePassword,
  validatePasswordLength,
  violatesPasswordContext,
} from '../src/utils/password.js';

describe('Authentication primitives', () => {
  it('normalizes passwords with NFKC without trimming or changing case', () => {
    assert.equal(normalizePassword('  ＡbcD!  '), '  AbcD!  ');
  });

  it('enforces the 12–128 codepoint password length bounds', () => {
    assert.equal(validatePasswordLength('a'.repeat(11)), false);
    assert.equal(validatePasswordLength('a'.repeat(12)), true);
    assert.equal(validatePasswordLength('a'.repeat(128)), true);
    assert.equal(validatePasswordLength('a'.repeat(129)), false);
    assert.equal(validatePasswordLength('😀'.repeat(12)), true);
  });

  it('rejects repeated, sequential, app-specific, and user-context passwords', () => {
    assert.equal(violatesPasswordContext('aaaaaaaaaaaa'), true);
    assert.equal(violatesPasswordContext('abc123456789'), true);
    assert.equal(violatesPasswordContext('MyRedditClonePassword'), true);
    assert.equal(
      violatesPasswordContext('violet-is-a-long-password', {
        username: 'violet',
        email: 'violet@example.com',
      }),
      true
    );
    assert.equal(violatesPasswordContext('copper orchid telescope 42'), false);
  });

  it('fails open on HIBP service failures and compares only returned suffixes', async () => {
    const unavailable = await isBreachedPassword('not-a-breached-password', async () => {
      throw new Error('network failure');
    });
    assert.equal(unavailable, false);

    let requestedUrl;
    const response = await isBreachedPassword('password', async (url, options) => {
      requestedUrl = url;
      assert.equal(options.headers['Add-Padding'], 'true');
      return {
        ok: true,
        text: async () => '1E4C9B93F3F0682250B6CF8331B7EE68FD8:100000',
      };
    });
    assert.equal(response, true);
    assert.match(requestedUrl, /\/range\/5BAA6$/);
  });

  it('requires authenticated tokens to have valid signature and configured claims', () => {
    assert.throws(() => verifyAccessToken('not-a-jwt'));
  });

  it('hashes passwords with Argon2id and verifies the normalized secret', async () => {
    const passwordHash = await argon2.hash(normalizePassword('  ＡbcD!  '), {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    assert.match(passwordHash, /^\$argon2id\$/);
    assert.equal(await argon2.verify(passwordHash, normalizePassword('  ＡbcD!  ')), true);
  });

  it('scopes refresh cookies to the auth API and marks them HttpOnly and SameSite=Lax', () => {
    const options = getRefreshCookieOptions();
    assert.equal(options.httpOnly, true);
    assert.equal(options.sameSite, 'lax');
    assert.equal(options.path, '/api/auth');
    assert.equal(options.domain, undefined);
  });

  it('enforces unique normalized account identities and hashed-token TTL indexes', () => {
    assert.equal(User.schema.path('username').options.unique, true);
    assert.equal(User.schema.path('username').options.lowercase, true);
    assert.equal(User.schema.path('email').options.unique, true);
    assert.equal(User.schema.path('email').options.lowercase, true);
    assert.equal(RefreshToken.schema.path('tokenHash').options.unique, true);
    assert.equal(RefreshToken.schema.path('expiresAt').options.index.expires, 0);
  });
});
