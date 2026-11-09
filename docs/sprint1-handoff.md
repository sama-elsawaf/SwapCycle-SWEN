# Sprint 1 handoff: accounts, catalog, wish list & search

Branch: `feature/sprint1-accounts-catalog-wishlist`

## What is built

**Backend** (`backend/src/modules/{accounts,catalog,wishlist_search}`):
argon2id passwords (libsodium), HMAC-signed session token in an httpOnly,
SameSite=Lax cookie `sc_session`, generic login errors with a dummy hash for
unknown emails, rate limits (register, login per IP and per email, password
reset), single-use hashed reset tokens (30 min), profile, interests and privacy,
BookDescription vs BookCopy, owner-only edits, status guards (RESERVED/TRANSFERRED
copies are locked), soft delete, photo uploads (JPEG/PNG by magic bytes, 5 MB,
5 per copy, UUID file names outside the web root), wish list (title or interest,
max 100, duplicates rejected) and paginated, LIKE-escaped search.

**Frontend** (`frontend/src/{context,hooks,pages,utils}`): AuthContext (no
tokens in JS storage), hooks, auth/home/listings/wishlist/profile pages, and
utils (validation mirroring the server, labels, safe redirects, error mapping,
URL-synced search filters).

Contract: `docs/api/openapi.yaml`. Schema: `database/migrations/001-003`.

## Integration contract (as implemented)

All shared pieces now exist; this is how they fit together.

- **Errors:** `common/ApiError.h`. Throw `common::ApiError(ErrorCode, message)`, return
  `common::dataResponse(...)` / `common::errorResponse(error)`. Codes are exactly those in `openapi.yaml`.
- **Sessions:** the accounts module issues an HMAC-signed token in the httpOnly `sc_session` cookie.
  `AuthFilter` verifies it with `accounts::security::verifySessionToken`, using the secret passed to
  `AuthFilter::configure(...)` in `main.cc`, and stores `auth.userId` (UUID string) and `auth.role`
  (`READER`/`MODERATOR`) under `kAuthUserIdKey` / `kAuthRoleKey`. Failures are 401 `UNAUTHORIZED`.
- **Moderators:** put `RoleFilter` after `AuthFilter`; it allows only `MODERATOR` (403 `FORBIDDEN` otherwise).
- **Exchange participants:** put `ParticipantFilter` after `AuthFilter` on `/api/exchanges/<uuid>/...`
  routes. The exchange module must register an `ExchangeParticipantChecker` (string UUIDs) at startup.
  Non-participants get the same 404 as a missing exchange.
- **Configuration:** `common::loadAppConfig()` validates every variable at startup (`main.cc`).
- **Frontend types:** `api/types.ts` mirrors the spec and `types/index.ts` re-exports it. Do not add a
  second copy of an API type anywhere else.
- **Frontend API:** functions in `api/auth.ts`, `api/books.ts`, `api/wishlist.ts` (see `api/README.md`).
  Photo URLs must go through `assetUrl()`. `AuthContext` registers `setUnauthorizedHandler`, so any 401
  logs the reader out.
- **UI:** `components/ui` (`Button`, `Input`, `Chip`, `Card`, `Badge`, `Alert`), `components/books`
  (`BookCard`, `BookForm`, `PhotoUploader`, `ConditionBadge`), `components/layout` (`NavBar`, `Footer`,
  `PageShell`, `LeafDecoration`). Use only the colour tokens in `tailwind.config.ts`.

## How to run

```bash
cp .env.example .env        # then set real values
docker compose up --build   # postgres:16 + migrations + backend on :8080
cd frontend && npm install && npm run dev   # http://localhost:5173, /api proxied
```

## How to test

```bash
docker build backend -f backend/DockerFile --target build   # compiles and runs GoogleTest
cd frontend && npm test                                      # Vitest
cd frontend && npm run check                                 # typecheck + tests + build
cd frontend && npm audit                                     # 0 vulnerabilities at time of writing
```

The frontend tests mock the teammate-owned modules, so `npm test` already passes.
`npm run typecheck`/`build` and the backend build need the interfaces above.

## CI (`.github/workflows/ci.yml`)

Runs on every PR and on pushes to `main`:

- **Repository hygiene:** fails if an `.env` file, a private key or uploaded files are committed.
- **Migrations:** applies every migration (and the dev seed) to PostgreSQL 16.
- **Backend:** builds the Docker image with `-Werror` and runs GoogleTest.
- **Frontend:** `npm ci`, `npm audit --audit-level=high`, Vitest, typecheck and production build.

## Backend runtime

`backend/config.json` holds the non-secret Drogon settings (threads, 6 MB body
limit, logging, no sessions, no server header, and no static files served from
disk). Secrets and per-environment values come from the environment. The image
is multi-stage: build + tests in the pinned Drogon image, then only the binary on
Ubuntu 22.04, running as an unprivileged user.

## Notes for the team

- **Drogon commits transactions asynchronously** when the last reference is dropped.
  A read on another connection right after can miss the change. Multi-statement
  writes here are single CTE statements, or await `CommitAwaiter`
  (`CatalogRepository.cc`). The exchange/reservation code will need the same.
- Integer SQL parameters need `::int` casts (Drogon binds binary int4).
- Avoid structured bindings across `co_await` (GCC 11 miscompiles them).
- Password-reset e-mail is not sent yet: `LoggingResetSender` only logs that a
  reset was requested. A mail sender is needed (notifications work).
- Sessions are stateless: changing a password does not end existing sessions
  (they expire within 2 hours).
- Contrast: white on deep rose (#D9708F) is 3.2:1 and deep-rose links on blush
  are 3.0:1. That's fine for large/bold text (buttons should be at least 19px bold) but
  below WCAG AA for small text such as "Forgot Password?" (design decision pending).
