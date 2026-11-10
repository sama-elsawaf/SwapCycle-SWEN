# Testing

How SwapCycle is tested, from fast unit tests to abuse probes against a running server. CI runs the first three
layers on every pull request. Run the rest before a release or after touching security-sensitive code.

## 1. Frontend unit and page tests (Vitest)

```bash
cd frontend
npm run check        # tsc --noEmit + vitest run + vite build
npm audit            # CI fails on high or critical advisories
```

The tests cover the API client, auth context, form validation, search parameters, local storage (recent searches,
saved filters, drafts) and page flows for auth, listings, the wish list and search. API calls are mocked; components
are real.

## 2. Backend unit tests (GoogleTest)

```bash
docker build backend -f backend/DockerFile --target build --build-arg WARNINGS_AS_ERRORS=ON
```

This compiles with `-Wall -Wextra -Werror` and runs `swapcycle_tests`: config loading, JSON helpers, UUIDs, errors,
password hashing and session tokens (including legacy `v1` tokens and revocation), the session-version cache, the rate limiter, the account, catalog and wish-list services (with in-memory
repositories), and the auth, role and participant filters. Lines such as `ERROR Unhandled ... duplicate key` in the
output come from tests that check error handling. They are expected.

## 3. Database migrations

CI applies `database/migrations/*.sql` in order to an empty PostgreSQL 16, then the dev seed. To do the same locally:

```bash
docker compose up db     # migrations run automatically on an empty volume
```

## 4. API smoke and probe scripts

Both scripts need bash, curl and python3. Run them against a freshly started backend with an empty database:
login and registration limits are kept in memory, and the scripts register fixed test accounts.

```bash
docker compose up --build
API_URL=http://127.0.0.1:8080/api scripts/api-smoke.sh    # about 78 end-to-end checks
docker compose restart backend
API_URL=http://127.0.0.1:8080/api scripts/api-probe.sh    # about 80 abuse and edge-case checks
```

- **`api-smoke.sh`** walks the Sprint 1 features end to end: registration and login, profile and privacy, listings,
  photos, withdraw and relist, search filters, the wish list, CORS, password reset, logout and rate limiting. It also
  checks that sessions are revoked: an old cookie gets 401 after logout (on every device) and after a password reset.
  Because reset tokens are only sent by e-mail, it plants one through `psql` in the compose `db` service; set `PSQL`
  to another command that runs SQL from stdin if your database is elsewhere.
- **`api-probe.sh`** tries to break things: malformed, mistyped and deeply nested JSON; control characters and null bytes;
  oversized fields, bodies and uploads; files that only pretend to be images; path traversal; reading or changing
  other users' data; SQL and `LIKE` wildcards in search; concurrent uploads and duplicate wish items; and the
  login lockout. It also checks that error bodies never contain SQL, file paths or stack traces.

## 5. Sanitizer build (memory and undefined-behaviour bugs)

Builds the tests and the server with AddressSanitizer and UndefinedBehaviorSanitizer. Keep `-j` modest: a sanitizer
build needs a lot of memory.

```bash
docker build backend -f backend/DockerFile --target build --build-arg RUN_TESTS=OFF -t sc-build
docker run --rm -v "$PWD/backend:/work:ro" sc-build bash -c '
  cp -r /work/CMakeLists.txt /work/src /work/tests /tmp/ && cd /tmp &&
  cmake -S . -B asan -DCMAKE_BUILD_TYPE=Debug -DSWAPCYCLE_WARNINGS_AS_ERRORS=ON \
    -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined -fno-omit-frame-pointer -fno-sanitize-recover=undefined" \
    -DCMAKE_EXE_LINKER_FLAGS="-fsanitize=address,undefined" &&
  cmake --build asan -j6 &&
  ASAN_OPTIONS=detect_container_overflow=0 ./asan/swapcycle_tests --gtest_brief=1'
```

To probe the sanitized server, run `/tmp/asan/swapcycle` in the same container with the usual environment variables,
point `scripts/api-probe.sh` at it, and check the container log for `AddressSanitizer` or `runtime error`.
(`detect_container_overflow=0` is needed because Drogon itself is not built with ASan.)

## Results on 10 November 2026

| Check | Result |
|---|---|
| Frontend typecheck, tests, build, audit | 0 errors, all tests pass, builds, 0 vulnerabilities |
| Backend `-Werror` build and GoogleTest | Passes |
| Backend tests under ASan and UBSan | Pass, no reports |
| Migrations 001–008 and seed on PostgreSQL 16 | Apply cleanly |
| `api-smoke.sh` / `api-probe.sh` against the sanitized server | All checks pass, no sanitizer reports |
