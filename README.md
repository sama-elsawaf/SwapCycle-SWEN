# SwapCycle-SWEN

A community platform where student readers exchange physical books through direct two-way swaps and three-person exchange cycles, so that everyone receives a book they actually want.

Course: SWEN360 – Software Design & Engineering

## Project vision

Readers accumulate books they no longer use while buying others that someone nearby already owns. Direct swaps often fail because two people do not want each other's books. SwapCycle solves this by matching readers into two-way and three-way cycles.

Example: Sara offers a mystery novel, Ali offers a travel book, and Noor offers a biography. No direct swap works between any two of them, but a three-person cycle gives each reader a book they want.

SwapCycle makes matching, agreement, and handover visible to everyone involved.

## Current stage: Phase 2, core implementation

| Area | Status |
|---|---|
| Accounts: register, log in/out, password reset, onboarding, profile, privacy | Done (backend + frontend) |
| Book listings: create, edit, withdraw/relist, delete, photos | Done |
| Wish lists and search with filters | Done |
| Local storage: recent searches, remembered filters, form drafts | Done (cleared on logout) |
| Direct offers, matching (2- and 3-way cycles), reservations | Planned (Sprint 2) |
| Handover, messaging, notifications, reviews, disputes, moderation | Planned (Sprints 2–3) |

Modules and pages for the planned features exist as placeholders (`backend/src/modules/*`, `frontend/src/pages/*`, migrations `004`–`007`).

## Tech stack

- **Backend:** C++20, Drogon, PostgreSQL 16, libsodium (argon2id passwords, signed session tokens), CMake, GoogleTest, Docker
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, Vitest
- **API contract:** [`docs/api/openapi.yaml`](docs/api/openapi.yaml) is the source of truth
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) runs hygiene checks, migrations, the backend build and tests, and the frontend tests, typecheck, build and `npm audit` on every pull request

## Getting started

Needs Docker Desktop and Node.js 20.19+ or 22.12+ (CI uses 22).

```bash
cp .env.example .env           # then set SESSION_SECRET (required) and the database password
docker compose up --build      # PostgreSQL 16 + migrations + backend on http://localhost:8080
cd frontend
npm install
npm run dev                    # http://localhost:5173, /api is proxied to the backend
```

## Testing

```bash
cd frontend && npm run check                                  # typecheck + Vitest + build
cd frontend && npm audit                                      # dependency vulnerabilities
docker build backend -f backend/DockerFile --target build \
  --build-arg WARNINGS_AS_ERRORS=ON                           # compile + GoogleTest
scripts/api-smoke.sh                                          # end-to-end API checks (running backend, empty DB)
scripts/api-probe.sh                                          # abuse and edge-case probes
```

See [`docs/testing.md`](docs/testing.md) for the full test plan, including the sanitizer build.

## Repository layout

```
backend/     Drogon API (src/common, src/middleware, src/modules/*, src/jobs, tests)
frontend/    React app (src/api, components, context, hooks, pages, utils)
database/    Numbered SQL migrations (never edit a merged one; add a new number)
docs/        API spec, requirements, design system, architecture, sprints, minutes
scripts/     API smoke and probe scripts
```

## Team rules

- Work on a feature branch and open a pull request; never push to `main`.
- PR titles start with the author's name and student ID.
- Only change files in your own area; explain any change to a shared file in the PR.
- Never commit secrets or `.env` files. Configuration comes from the environment.

## Key design decisions

1. Book descriptions are modelled separately from physical copies, so different editions and conditions match correctly.
2. Matching searches only cycles of length two or three and avoids duplicate proposals.
3. Reservations use database transactions and expiry, so one copy cannot join two confirmed exchanges.
4. Each physical transfer is recorded separately, because handing over books cannot be atomic.
5. Contact and meeting details are visible only to exchange participants.
6. Matching is explainable, and new readers are never penalised for having no history.
