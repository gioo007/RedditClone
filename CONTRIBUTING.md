# Contributing Guide & Team Conventions

This document defines the shared engineering contract established in **Phase 0** so all four team members can build Phases 1–4 in parallel without blocking one another.

---

## 1. Local Development Setup

### Prerequisites

- **Node.js:** v20 or newer (`nvm use` reads `.nvmrc`)
- **npm:** v10 or newer
- **MongoDB:** Local MongoDB replica set (`mongodb://127.0.0.1:27017/reddit_clone`) or MongoDB Atlas URI
  - _Note:_ During early development, the Express server boots gracefully even if MongoDB is unreachable so API docs (`/api/docs`) and health checks (`/api/health`) can be inspected immediately.

### Quick Start

```bash
# 1. Backend (Terminal 1)
cd server
cp .env.example .env
npm install
npm run dev
# Express API: http://localhost:5000/api
# Swagger UI:  http://localhost:5000/api/docs

# 2. Frontend (Terminal 2)
cd client
cp .env.example .env
npm install
npm run dev
# React App:   http://localhost:5173
```

### Standard Scripts (`server/` and `client/`)

| Script                 | Description                                               |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Start dev server with hot reload                          |
| `npm test`             | Run automated test suite                                  |
| `npm run lint`         | Check code quality with ESLint                            |
| `npm run format`       | Format files with Prettier                                |
| `npm run format:check` | Verify formatting in CI / pre-PR                          |
| `npm run seed`         | _(server only)_ Populate MongoDB via `../scripts/seed.js` |

---

## 2. Git Workflow, Branching & Commits

- **Protected `main`:** `main` must always boot cleanly and pass `npm run lint` and `npm test`. Never push broken code directly to `main`.
- **Branch Naming:** `feature/<track>-<short-description>`, `fix/<track>-<short-description>`, or `chore/<short-description>`.
  - Track prefixes: `p1` (Data & Voting), `p2` (Identity & Communities), `p3` (Content & AI), `p4` (Frontend).
  - Examples: `feature/p1-atomic-vote-service`, `feature/p2-jwt-auth`, `feature/p3-post-summary`, `feature/p4-post-card`.
- **Conventional Commits:**
  - Format: `<type>(<scope>): <imperative summary>`
  - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`
  - Examples:
    - `feat(votes): implement atomic upsert and score delta update`
    - `feat(communities): add moderator authorization middleware`
    - `fix(feed): preserve tie-breaker _id in cursor pagination`
- **Pull Requests & Contract Rule:**
  - Every PR requires at least **1 review** from another teammate (this keeps everyone familiar with the codebase for the individual discussion).
  - **Contract-first rule:** Any change to a Mongoose field, endpoint path, query parameter, or response shape **must** update `docs/openapi.yaml` in the **same PR** and be announced in the team chat.

---

## 3. Codebase & Naming Conventions

- **Module System:** Native ES Modules (`"type": "module"`) across `server/`, `client/`, and `scripts/`. Always include `.js` / `.jsx` extensions in relative imports on the backend (e.g., `import User from '../models/User.js'`).
- **Backend Layering (`server/src/`):**
  - `routes/*.routes.js` — Express router definitions and middleware wiring only.
  - `controllers/*.controller.js` — Parse `req`, call service(s), send standardized JSON response (`200`, `201`, etc.); pass errors to `next(err)`.
  - `services/*.service.js` — Pure business logic and Mongoose queries (no `req`/`res` objects).
  - `models/*.js` — Mongoose schemas, indexes, and model exports.
  - `middleware/*.js` — Auth (`requireAuth`, `optionalAuth`), moderation (`requireModerator`), Zod request validation (`validate`), and error handling.
  - `utils/*.js` — Shared stateless helpers (`ApiError.js`, `asyncHandler.js`, `pagination.js`).
- **Frontend Layering (`client/src/`):**
  - `api/` — Centralized HTTP/mock client (`client.js`, `mockAdapter.js`). Components **never** hardcode `fetch('http://localhost:5000/...')`; always import methods from `src/api/`.
  - `pages/` — Route-level views (`PascalCase.jsx`).
  - `components/` — Reusable UI building blocks (`PascalCase.jsx`), styled with Tailwind CSS to closely match Reddit.
  - `hooks/` — Custom React hooks (`useCamelCase.js`).
  - `context/` — Global state providers (`AuthContext.jsx`, theme/modals).
- **Identifiers & Casing:**
  - JSON fields, variables, functions: `camelCase`
  - Mongoose models & React components: `PascalCase`
  - Constants & error codes: `UPPER_SNAKE_CASE`
  - Primary keys in JSON: `_id` (24-char MongoDB ObjectId string), keeping Mongoose documents and `.lean()` queries 100% consistent (`__v` and `passwordHash` are stripped at the schema level).

---

## 4. API Contract Conventions (`docs/openapi.yaml`)

### 4.1 Response Envelope

**Single resource / action response:**

```json
{
  "success": true,
  "data": { "_id": "65f1a2b3c4d5e6f7a8b9c0d1", "username": "spez" }
}
```

**Cursor-paginated collection response:**

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "nextCursor": "eyJ2IjoxNzA5ODUwMDAwMDAwLCJpZCI6IjY1ZjFhMmIzYzRkNWU2ZjdhOGI5YzBkMSJ9",
    "hasMore": true,
    "limit": 20
  }
}
```

**Standard error response (all `4xx` and `5xx`):**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [{ "field": "title", "message": "Title is required" }]
  }
}
```

Standard error codes:

- `VALIDATION_ERROR` (`400`)
- `UNAUTHORIZED` (`401`)
- `FORBIDDEN` (`403`)
- `NOT_FOUND` (`404`)
- `CONFLICT` (`409`)
- `RATE_LIMITED` (`429`)
- `AI_SERVICE_ERROR` (`502` / `503`)
- `INTERNAL_ERROR` (`500`)

### 4.1.1 Request Validation (`server/src/middleware/validate.js`)

Use the shared **Zod** `validate({ params, query, body })` middleware on routes in Phases 2 and 3. It coerces query parameters, strips unexpected body keys (preventing mass-assignment of fields like `karma` or `score`), and formats errors into `VALIDATION_ERROR` automatically:

```js
import { validate, z, idParamSchema } from '../middleware/validate.js';

const updatePostSchema = z.object({
  content: z.string().max(40000).optional(),
  linkUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
});

router.patch(
  '/:id',
  requireAuth,
  validate({ params: idParamSchema, body: updatePostSchema }),
  updatePost
);
```

### 4.2 Cursor Pagination Format

All feed, community post, user activity, and community browse endpoints use **cursor pagination** via `server/src/utils/pagination.js`:

- **Request query params:**
  - `limit`: integer `1..50` (default `20`)
  - `cursor`: opaque base64url token returned as `pagination.nextCursor` from the previous page
  - `sort`: `new` (sorts by `createdAt DESC, _id DESC`) or `top` (sorts by `score DESC, _id DESC`)
- **Why compound tie-breaking (`_id DESC`):** Multiple posts can share the same `score` or millisecond `createdAt`. Encoding `{ v: sortFieldValue, id: doc._id }` guarantees zero skipped or duplicated items even while new posts or votes arrive.

### 4.3 Voting & Soft-Delete Rules

- **Voting (`PUT /api/posts/:id/vote` and `PUT /api/comments/:id/vote`):**
  - Request body takes target state `{ "value": 1 | -1 | 0 }` (`1` = upvote, `-1` = downvote, `0` = remove vote).
  - Stored `Vote` documents in MongoDB hold `value: 1 | -1` with a unique compound index on `{ user: 1, targetType: 1, targetId: 1 }`. Passing `0` deletes the `Vote` document and adjusts `score` atomically.
- **Deletions vs. Moderator Removals:**
  - Author delete (`DELETE`) sets `isDeleted: true` and clears displayable body in responses (`"[deleted]"`) so nested comment reply trees never orphan child comments.
  - Moderator removal (`POST .../remove`) sets `isRemoved: true`, `removedBy`, and `removedReason` (`"[removed by moderator]"`). Only `community.creator` (and listed `moderators`) may remove content in that community.

---

## 5. Parallel Work Stubs & Track Handoff

To ensure Phases 1–4 start simultaneously without waiting on dependencies:

1. **Auth Middleware Stub (`server/src/middleware/auth.js`):**
   - Until Member B merges real JWT verification, `requireAuth` and `optionalAuth` accept an `x-dev-user-id` header (24-char hex ObjectId) in development mode and populate `req.user = { _id, username }`.
   - Member B will replace the token parsing inside `auth.js` while keeping the exact exports (`requireAuth`, `optionalAuth`, `requireModerator`).
2. **Voting Service Stand-In (`server/src/services/vote.service.js`):**
   - Exports `castVote({ userId, targetType, targetId, value })` and `getUserVotesMap({ userId, targetType, targetIds })` backed by an in-memory `Map` for Phase 0.
   - Member C calls this exact function signature in `posts` and `comments` controllers; Member A replaces the internals with the concurrency-safe MongoDB implementation.
3. **Frontend Mock Switch (`client/src/api/`):**
   - Setting `VITE_USE_MOCKS=true` in `client/.env` routes all `api.*` calls through `mockAdapter.js` returning realistic shapes matching `docs/openapi.yaml`.
   - Setting `VITE_USE_MOCKS=false` switches immediately to `VITE_API_URL` (`http://localhost:5000/api`).
4. **Planned Frontend Split (Once Backend Tracks Finish):**
   - **Member D (Frontend Lead):** Global Reddit layout (navbar, left navigation drawer, right community sidebar), routing, design tokens, home/popular feeds, and search UI.
   - **Member B (after Phase 2):** Login/Signup modals or pages, User Profile view/edit, Community creation & Community header/join/moderator UI.
   - **Member C (after Phase 3):** Create Post page, Post Detail page, Nested Comment Thread tree (reply/edit/delete/mod-remove), and "Summarize with AI" card.
   - **Member A (after Phase 1):** Vote button optimistic state & error rollback, seed data curation, and concurrency integration testing.
