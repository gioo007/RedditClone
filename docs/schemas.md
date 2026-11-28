# Database & API Data Schemas

This document summarizes the **MongoDB / Mongoose database schemas** (`server/src/models/`) and the **REST API wire schemas** (`docs/openapi.yaml`).

---

## 1. Database Schema Overview (MongoDB / Mongoose)

The database uses **6 normalized collections** exported from `server/src/models/index.js`. All schemas disable `__v` (`versionKey: false`) and enable `timestamps: true` (`createdAt`, `updatedAt`), keeping `_id` consistent across both Mongoose documents and `.lean()` queries.

```text
User (1) ──────< Membership >────── (1) Community
 │  │                                    ▲  │
 │  └────── (creator / moderators) ──────┘  │
 │                                          │
 ├──────< Post >────────────────────────────┘
 │         │  ▲
 │         │  └────── Vote (targetType='Post' | 'Comment')
 │         ▼                ▲
 └──────< Comment >─────────┘
           │
           └──── parentComment (self-reference, depth 0..10)
```

### 1.1 `users` (`server/src/models/User.js`)

Stores account credentials and public profile metadata.

- **Fields:**
  - `username`: `String` (required, unique, `3–30` chars, `[a-zA-Z0-9_]+`)
  - `email`: `String` (required, unique, lowercase)
  - `passwordHash`: `String` (required, `select: false` + stripped in `toJSON` so hashes never leak)
  - `displayName` (max `50`), `bio` (max `500`), `avatarUrl`, `bannerUrl`: `String`
  - `karma`: `{ post: Number, comment: Number }` (defaults to `0`)
- **Indexes:** Unique on `username`; unique on `email`.

### 1.2 `communities` (`server/src/models/Community.js`)

Represents `r/<name>` communities and their moderation ownership.

- **Fields:**
  - `name`: `String` (required, unique, `3–21` chars, `[a-zA-Z0-9_]+`)
  - `nameLower`: `String` (unique, auto-derived lowercase `name` to prevent case collisions like `r/WebDev` vs. `r/webdev`)
  - `title` (max `100`, defaults to `name`), `description` (max `500`), `iconUrl`, `bannerUrl`
  - `rules`: Array of embedded `{ title, description }` subdocuments (`_id: false`)
  - `creator`: `ObjectId -> User` (required; community creator is moderator per Requirement 14)
  - `moderators`: `[ObjectId -> User]` (defaults to `[creator]`)
  - `memberCount` (default `1`), `postCount` (default `0`): Denormalized counters
- **Indexes:** Unique `name`, unique `nameLower`, `creator`, `{ memberCount: -1, _id: -1 }`, `{ createdAt: -1, _id: -1 }`.

### 1.3 `memberships` (`server/src/models/Membership.js`)

Many-to-many join collection between users and communities (prevents unbounded arrays on `User` or `Community` documents).

- **Fields:**
  - `user`: `ObjectId -> User` (required)
  - `community`: `ObjectId -> Community` (required)
  - `role`: `'member' | 'moderator'` (default `'member'`)
- **Indexes:** Unique compound `{ user: 1, community: 1 }` (prevents double-joining and powers home feed queries); `{ community: 1, createdAt: -1 }`.

### 1.4 `posts` (`server/src/models/Post.js`)

Stores community posts, denormalized vote/comment counts, and cached AI summaries.

- **Fields:**
  - `title`: `String` (required, `1–300` chars)
  - `type`: `'text' | 'link' | 'image'` (required, default `'text'`)
  - `content` (max `40,000`), `linkUrl` (required if `type === 'link'`), `imageUrl` (required if `type === 'image'`)
  - `author`: `ObjectId -> User` (required)
  - `community`: `ObjectId -> Community` (required)
  - `score`, `upvoteCount`, `downvoteCount`, `commentCount`: Denormalized integers updated via atomic `$inc`
  - `aiSummary`: `{ text, generatedAt, model } | null` (caches generative AI output; invalidated on body edit)
  - **Soft-delete & moderation:** `isDeleted` (author deleted), `isRemoved` (mod removed), `removedBy` (`ObjectId -> User`), `removedReason` (max `300`), `editedAt`
- **Indexes (compound cursor pagination):**
  - `{ community: 1, createdAt: -1, _id: -1 }` and `{ community: 1, score: -1, _id: -1 }`
  - `{ createdAt: -1, _id: -1 }` and `{ score: -1, _id: -1 }`
  - Single-field indexes on `author` and `community`

### 1.5 `comments` (`server/src/models/Comment.js`)

Uses an **adjacency list (`parentComment`) + bounded `depth`** (`MAX_COMMENT_DEPTH = 10`) so all comments for a post load in one flat query and assemble into a nested tree on the client in `O(n)`.

- **Fields:**
  - `post`: `ObjectId -> Post` (required)
  - `community`: `ObjectId -> Community` (required; denormalized for fast moderator authorization checks)
  - `author`: `ObjectId -> User` (required)
  - `parentComment`: `ObjectId -> Comment | null` (`null` = top-level comment)
  - `depth`: `Number` (`0..10`)
  - `content`: `String` (required, `1–10,000` chars)
  - `score`, `upvoteCount`, `downvoteCount`: Denormalized vote counters
  - **Soft-delete & moderation:** `isDeleted`, `isRemoved`, `removedBy`, `removedReason`, `editedAt` (keeps child reply threads intact as `[deleted]` / `[removed]`)
- **Indexes:** `{ post: 1, score: -1, _id: -1 }`, `{ post: 1, createdAt: 1, _id: 1 }`, plus `author`, `community`, `parentComment`.

### 1.6 `votes` (`server/src/models/Vote.js`)

Polymorphic vote records enforcing the concurrency-critical one-vote-per-user rule at the database engine level.

- **Fields:**
  - `user`: `ObjectId -> User` (required)
  - `targetType`: `'Post' | 'Comment'` (required, `refPath`)
  - `targetId`: `ObjectId` (required; references `Post` or `Comment`)
  - `value`: `1 | -1` (required; submitting `0` to the API deletes the `Vote` document and applies `-oldValue` via `$inc`)
- **Indexes:** **Unique compound `{ user: 1, targetType: 1, targetId: 1 }`**; lookup `{ targetType: 1, targetId: 1 }`.

---

## 2. API / Wire Data Schemas (`docs/openapi.yaml`)

The REST API enriches raw MongoDB documents with populated references and viewer-specific state before returning JSON.

### 2.1 Envelopes & Pagination

| Schema             | Shape                                                                          | Purpose                                                                                  |
| ------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Success (single)   | `{ success: true, data: T }`                                                   | Standard response wrapper                                                                |
| Success (list)     | `{ success: true, data: T[], pagination: CursorPagination }`                   | Paginated endpoints (`/feed`, `/posts`, `/communities`, etc.)                            |
| `CursorPagination` | `{ nextCursor: string \| null, hasMore: boolean, limit: number }`              | `nextCursor` is base64url `{ v: sortValue, id: _id }` (`server/src/utils/pagination.js`) |
| `ErrorResponse`    | `{ success: false, error: { code, message, details?: [{ field, message }] } }` | Uniform `4xx`/`5xx` error shape (`server/src/schemas/middleware/error.js`)               |

### 2.2 Resource DTOs vs. DB Models

| OpenAPI Schema               | Key Differences from Raw Mongoose Document                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UserSummary`                | Lightweight `{ _id, username, displayName, avatarUrl }` embedded inside posts, comments, and moderator lists                                      |
| `UserProfile`                | Extends `UserSummary` with `bio`, `bannerUrl`, `karma`, `createdAt` (`email` included only on `/auth/me` & `/users/me`)                           |
| `AuthPayload`                | `{ user: UserProfile, token: string }` returned on register/login                                                                                 |
| `CommunitySummary`           | Public card fields + viewer-computed `isMember: boolean`                                                                                          |
| `CommunityDetail`            | Extends `CommunitySummary` with `rules`, `bannerUrl`, populated `creator` & `moderators`, `postCount`, and viewer-computed `isModerator: boolean` |
| `Post`                       | Populates `author` (`UserSummary`) and `community` (`{ _id, name, title, iconUrl }`), plus viewer-computed `userVote` (`1 \| -1 \| 0`)            |
| `Comment`                    | Populates `author` (`UserSummary`) and adds viewer-computed `userVote` (`1 \| -1 \| 0`)                                                           |
| `VoteRequest` / `VoteResult` | Request `{ value: 1 \| -1 \| 0 }` -> Response `{ targetId, targetType, score, upvoteCount, downvoteCount, userVote }`                             |
| `AiSummaryResult`            | `{ postId, summary, model, generatedAt, cached }` returned by `POST /posts/{id}/summary`                                                          |

### 2.3 HTTP Input Validation (`server/src/schemas/middleware/validate.js`)

Incoming `req.params`, `req.query`, and `req.body` payloads are validated at the route boundary with **Zod** (`validate({ params, query, body })`), while Mongoose enforces storage-level constraints on MongoDB documents:

- **Shared primitives included in Phase 0:** `objectIdSchema`, `idParamSchema`, `cursorPaginationQuerySchema`, `postSortQuerySchema`, and `voteBodySchema`.
- **Automatic protections:** Unknown keys are stripped from `req.body` before controllers run (preventing mass-assignment of internal fields like `score` or `karma`), query strings like `?limit=20` are coerced to typed values, and any `ZodError` is formatted into the standard `400 VALIDATION_ERROR` envelope by `server/src/schemas/middleware/error.js`.
