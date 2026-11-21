# Reddit Clone (MERN)

A minimal Reddit clone built for the Web Development Fall 26 course project. Users can create accounts, join or create communities, post, comment, vote, and summarize posts with generative AI. The UI should match the real Reddit UI as closely as possible.

**Stack:** MongoDB, Express, React, Node.js (MERN)
**Team size:** 4

---

## Table of Contents

1. [Project Description](#project-description)
2. [Requirements](#requirements)
3. [Tech Stack and Architecture](#tech-stack-and-architecture)
4. [Development Phases](#development-phases)
5. [Team Workflow](#team-workflow)
6. [Getting Started](#getting-started)
7. [Project Structure](#project-structure)
8. [Deliverables Checklist](#deliverables-checklist)
9. [Team Contributions](#team-contributions)

---

## Project Description

Reddit is a social platform organized around communities. People join communities, share posts, discuss in nested comment threads, and vote content up or down so the best material rises. This project recreates the core of that experience:

* Join or create communities
* Create posts inside communities
* Comment, reply, and vote
* Browse a personalized feed and per-community pages with sorting and pagination
* Moderate communities (the creator is the moderator)
* Summarize any post using generative AI

Extra features beyond the basics earn bonus marks, so the architecture should leave room to grow.

---

## Requirements

### Basic Requirements

| # | Requirement |
|---|-------------|
| 1 | Account creation and login |
| 2 | Viewing and editing the user's profile |
| 3 | Creating a community |
| 4 | Joining and leaving a community |
| 5 | Creating a post in a community |
| 6 | Viewing the posts of a community |
| 7 | Viewing the feed page |
| 8 | Upvoting and downvoting posts |
| 9 | Commenting on posts |
| 10 | Searching for communities and users |
| 11 | Replying to comments (nested comment threads) |
| 12 | Sorting posts (for example New and Top) with paginated loading on the feed and community pages |
| 13 | Editing and deleting your own posts and comments |
| 14 | Community moderation: the creator is the moderator and can remove posts and comments in that community |

### Voting Rule (assessed on backend design)

Each user can have **at most one vote per post**. Switching or removing a vote must update the score correctly, **even when several votes are submitted at the same time.** Our design must be safe under concurrency (see the voting design notes in Phase 1).

### AI Integration Feature

Users can choose to summarize a post using generative AI.

### UI Requirement

The interface must match the actual Reddit UI as closely as possible.

### Bonus Items

| Bonus | Weight |
|-------|--------|
| Chatting feature | 5% |
| Deployment (accessible from any device, anywhere) | 5% |
| Any other extra feature | 2 extra marks each |

The team grade including bonus is capped at 80% of the project mark.

### Grading Overview

| Item | Weight |
|------|--------|
| Basic requirements | 25% |
| AI integration | 10% |
| UI | 15% |
| Database design | 5% |
| API design and documentation (Swagger, Postman, or similar) | 10% |
| Clean code | 5% |
| Individual discussion | 30% |

> Every contributor must be able to explain their own code in the discussion. Generative AI tools are allowed, but only code we fully understand should be committed. Copying someone else's code is prohibited.

---

## Tech Stack and Architecture

| Layer | Technology | Notes |
|-------|------------|-------|
| Database | MongoDB with Mongoose | Replica set needed if we use multi-document transactions |
| Backend | Node.js and Express | REST API, JWT authentication |
| Frontend | React | Component based UI matching Reddit |
| API docs | Swagger (OpenAPI) | Written contract first, kept in `docs/openapi.yaml` |
| AI | Generative AI provider API | Called from the backend only, never from the browser |

**Architecture rule:** the frontend never talks to MongoDB directly. Everything goes through the REST API defined in `docs/openapi.yaml`. This contract is what lets all four of us work at the same time.

---

## Development Phases

### How the phases enable parallel work

Phase 0 is short and done **together**. It produces a shared contract: the data models and the API spec. After that, Phases 1 to 4 are four independent tracks, one per teammate. Each track depends only on the Phase 0 contract, not on another teammate's finished code. Phase 5 merges everything.

```
Phase 0: Foundation and Contract (everyone, 1 to 2 days)
        |
        +--> Phase 1: Data layer and voting engine     (Member A)
        +--> Phase 2: Identity and communities backend (Member B)
        +--> Phase 3: Content backend and AI           (Member C)
        +--> Phase 4: Frontend                         (Member D)
        |
Phase 5: Integration and Hardening (everyone)
        |
Phase 6: Extras, Documentation, Deployment (everyone)
```

---

### Phase 0: Foundation and Contract (everyone, together)

**Goal:** Remove every future blocker before splitting up.

**Tasks**

* Create the repo, branch strategy, linting, and formatting setup
* Scaffold `server/` (Express) and `client/` (React) with working "hello world" apps
* Agree on the data models: collections, fields, and relationships (Mongoose schema skeletons committed)
* Write the first version of `docs/openapi.yaml`: every endpoint, request body, response shape, error format, and auth rule
* Agree on conventions: error response format, pagination format (cursor or page based), naming, folder layout
* Create `.env.example` and a shared local setup guide

**Deliverables**

* Repo with both apps booting
* Mongoose schema skeletons in `server/src/models/`
* `docs/openapi.yaml` v1 approved by all four members
* `CONTRIBUTING.md` with conventions

**Done when:** all four members can run the project locally and agree the contract is complete enough to build against.

---

### Phase 1: Data Layer and Voting Engine (Member A)

**Goal:** Own the database design and the concurrency critical voting logic.

**Tasks**

* Finalize Mongoose schemas for User, Community, Membership, Post, Comment, Vote
* Add validation, timestamps, and soft delete or removal flags where needed
* Design indexes for the hot paths: feed queries, community post listing, sort by new and top, username and community name search, unique vote constraint
* Implement the voting service (see design notes below)
* Write a concurrency test that fires many simultaneous votes and asserts the final score is correct
* Write a seed script that generates realistic users, communities, posts, comments, and votes
* Produce the database schema diagram

**Voting design notes (proposed approach)**

* Store votes in a separate `votes` collection with a **unique compound index on `(user, post)`**. The database itself then guarantees one vote per user per post.
* Keep a denormalized `score` on the post and update it with an atomic `$inc` by the computed delta (for example switching up to down is a delta of -2, removing an upvote is -1).
* Make "read old vote, write new vote, adjust score" a single atomic unit, either with a MongoDB transaction or with an atomic `findOneAndUpdate` and upsert pattern. Never read then write in two separate steps in application code.
* Votes on comments can reuse the same service if we choose to support them.

**Deliverables**

* Final models in `server/src/models/`
* Voting service with unit and concurrency tests
* `scripts/seed.js`
* Database schema diagram in `docs/schema-diagram.png` (plus source file)
* Short design write up in `docs/voting-design.md`

**Done when:** the concurrency test passes reliably, and Members B and C can import the models and voting service.

**Independence note:** Members B and C code against the Phase 0 schema skeletons. If Member A changes a field, it is announced and the OpenAPI spec is updated in the same pull request.

---

### Phase 2: Identity and Communities Backend (Member B)

**Goal:** Everything about who users are and the communities they belong to.

**Requirements covered:** 1, 2, 3, 4, 10, 14 (community side)

**Tasks**

* Registration and login with hashed passwords (bcrypt) and JWT
* Auth middleware, reusable by all other routes
* Profile endpoints: view any profile, edit your own
* Community endpoints: create, view, update, list
* Join and leave a community; membership checks
* Moderator authorization middleware: only the community creator can moderate that community
* Search endpoint for communities and users
* Input validation and consistent error handling

**Deliverables**

* Routes, controllers, and services under `server/src/` for `auth`, `users`, `communities`, `search`
* Reusable `requireAuth` and `requireModerator` middleware
* Postman collection or Swagger examples for these endpoints
* API tests

**Done when:** every endpoint matches `docs/openapi.yaml` and the auth middleware is merged for others to use.

**Independence note:** Member C needs `requireAuth` early. To avoid waiting, a stub middleware that reads a fake user header is provided in Phase 0 and swapped for the real one when merged.

---

### Phase 3: Content Backend and AI (Member C)

**Goal:** Posts, comments, feeds, and the AI summary feature.

**Requirements covered:** 5, 6, 7, 8 (API layer), 9, 11, 12, 13, 14 (content removal), AI integration

**Tasks**

* Post endpoints: create, view, edit, delete
* Comment endpoints: create, nested replies, edit, delete (decide on tree strategy, for example parent reference with a depth limit and flattened loading)
* Community post listing and the home feed (posts from joined communities)
* Sorting (New, Top, optionally Hot) with pagination
* Endpoints that expose voting by calling Member A's voting service
* Moderator removal of posts and comments in the moderator's community
* AI summary endpoint, for example `POST /api/posts/:id/summary`:
  * API key stored server side in environment variables
  * Handle empty, very long, or failing requests gracefully
  * Consider caching the summary on the post so repeated clicks do not cost extra calls
  * Basic rate limiting per user

**Deliverables**

* Routes, controllers, and services for `posts`, `comments`, `feed`, `ai`
* Postman collection or Swagger examples for these endpoints
* API tests

**Done when:** feed and community listings paginate correctly under every sort mode, nested comments load correctly, and the AI summary works end to end.

**Independence note:** until Member A's voting service is merged, use a thin interface (`castVote(userId, postId, value)`) with an in-memory stand in, then swap it.

---

### Phase 4: Frontend (Member D)

**Goal:** Build the full React UI against the API contract, without waiting for the real backend.

**Requirements covered:** the UI side of all 14 requirements plus the AI summary button

**Tasks**

* Set up routing, global layout (navbar, sidebar), theme, and an API client layer
* Use **mock API responses** generated from `docs/openapi.yaml` (for example with MSW or a mock server) so development does not depend on the backend
* Pages and components:
  * Login and signup
  * Profile view and edit
  * Create community, community page with join and leave
  * Create post, post cards, vote buttons
  * Home feed with sort tabs and infinite scroll or pagination
  * Post detail page with nested comment threads, reply, edit, delete
  * Search results for communities and users
  * Moderator controls (remove post or comment)
  * "Summarize with AI" button and result display
* Loading, empty, and error states
* Responsive layout

**Deliverables**

* `client/` with all pages and reusable components
* Shared API client in `client/src/api/` that can switch between mock and real backend with one environment variable
* UI screenshots in `docs/screenshots/`

**Done when:** the whole app is usable against mocks and switching to the real API requires only changing configuration.

**Load note:** the frontend is the largest track. Members A, B, and C will likely finish their backend tracks earlier and should then take over specific frontend pages (for example Member B takes auth and profile pages, Member C takes the post and comment pages). Agree on this split at the end of Phase 0.

---

### Phase 5: Integration and Hardening (everyone)

**Goal:** Connect the pieces and make everything work together reliably.

**Tasks**

* Switch the frontend from mocks to the real API
* Fix contract mismatches (update the OpenAPI spec when the code is right)
* End to end testing of every basic requirement
* Test the voting rule under concurrent load from the real UI and the API
* Security pass: authorization on every write route, input validation, password handling, rate limits, CORS, secrets out of the repo
* Performance pass: check indexes against real query patterns, pagination behavior with the seeded data
* Pixel level UI polish against Reddit

**Deliverables**

* Passing end to end checklist covering all 14 requirements and the AI feature
* Bug list closed out
* Updated OpenAPI spec that matches the real behavior

---

### Phase 6: Extras, Documentation, and Deployment (everyone)

**Goal:** Earn bonus marks and finish every deliverable.

**Tasks**

* Bonus features (pick early, assign by member): real time chat, saved posts, awards, notifications, image posts, markdown comments, and others
* Final API documentation (Swagger UI hosted by the server)
* Final database diagram
* Clean code pass: remove dead code, consistent naming, comments where logic is not obvious
* Deploy: MongoDB Atlas, backend host, frontend host, with environment variables configured
* Fill in the contributions table below
* Rehearse the discussion: each member walks through their own code

**Deliverables**

* Live deployed URL
* Final docs in `docs/`
* Completed contributions section

---

## Team Workflow

* **Branching:** `main` is always deployable. Work happens on `feature/<track>-<short-name>` branches and merges through pull requests.
* **Reviews:** every pull request is reviewed by at least one other member. This also helps everyone learn the whole codebase for the discussion.
* **Contract changes:** any change to a model or endpoint updates `docs/openapi.yaml` in the same pull request and is announced in the team chat.
* **Commits:** small and descriptive (`feat(posts): add top sort with pagination`).
* **Sync:** short check in at least twice a week to unblock each other and track progress.

---

## Getting Started

### Prerequisites

* Node.js 20 or newer
* MongoDB (local replica set or a MongoDB Atlas cluster)
* npm

### Setup

```bash
# 1. Clone
git clone <repo-url>
cd <repo-name>

# 2. Backend
cd server
cp .env.example .env     # fill in values
npm install
npm run dev

# 3. Frontend (new terminal)
cd client
cp .env.example .env
npm install
npm run dev
```

### Environment Variables

**server/.env**

```
PORT=5000
MONGODB_URI=
JWT_SECRET=
JWT_EXPIRES_IN=7d
AI_API_KEY=
CLIENT_URL=http://localhost:5173
```

**client/.env**

```
VITE_API_URL=http://localhost:5000/api
VITE_USE_MOCKS=false
```

### Useful Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start in development mode |
| `npm test` | Run tests |
| `npm run seed` | Fill the database with sample data (server) |
| `npm run lint` | Lint the code |

---

## Project Structure

```
.
├── client/                  # React app
│   └── src/
│       ├── api/             # API client and mocks
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── context/
├── server/                  # Express API
│   └── src/
│       ├── models/          # Mongoose schemas
│       ├── routes/
│       ├── controllers/
│       ├── services/        # Business logic (voting, AI, feed)
│       ├── middleware/      # Auth, moderation, validation, errors
│       └── config/
├── docs/
│   ├── openapi.yaml         # API contract
│   ├── schema-diagram.png   # Database diagram
│   ├── voting-design.md
│   └── screenshots/
├── scripts/
│   └── seed.js
├── CONTRIBUTING.md
└── README.md
```

---

## Deliverables Checklist

* [ ] Codebase on GitHub
* [ ] Database schema diagram
* [ ] API documentation (Swagger or Postman)
* [ ] Contributions of each team member
* [ ] All 14 basic requirements working
* [ ] Voting rule verified under concurrency
* [ ] AI summary feature
* [ ] UI matching Reddit
* [ ] Bonus: chat feature
* [ ] Bonus: deployment
* [ ] Bonus: other extra features

---

## Team Contributions

Every point listed under your name is something you will be asked about in the discussion.

| Member | Track | Contributions |
|--------|-------|---------------|
| Member A | Phase 1: Data layer and voting | TBD |
| Member B | Phase 2: Identity and communities | TBD |
| Member C | Phase 3: Content backend and AI | TBD |
| Member D | Phase 4: Frontend | TBD |

Shared work (Phase 0, 5, 6) is listed here once finished.
