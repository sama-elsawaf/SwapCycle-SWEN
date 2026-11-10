#include <drogon/HttpRequest.h>
#include <drogon/HttpResponse.h>
#include <gtest/gtest.h>
#include <sodium.h>

#include <array>
#include <ctime>
#include <functional>
#include <memory>
#include <optional>
#include <string>

#include "middleware/AuthFilter.h"
#include "middleware/ParticipantFilter.h"
#include "middleware/RoleFilter.h"
#include "modules/accounts/AccountSecurity.h"

namespace {

using swapcycle::accounts::Role;
using swapcycle::accounts::SessionClaims;
namespace security = swapcycle::accounts::security;

const std::string kSecret = "filter-test-secret-that-is-at-least-32-bytes";
const std::string kUserId = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const std::string kExchangeId = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

// Outcome of one filter run: either it called next(), or it rejected with a response.
struct Outcome {
  bool passed = false;
  drogon::HttpResponsePtr rejection;

  std::string errorCode() const {
    const auto json = rejection ? rejection->getJsonObject() : nullptr;
    return json ? (*json)["error"]["code"].asString() : "";
  }
};

template <typename Filter>
Outcome run(Filter &filter, const drogon::HttpRequestPtr &req) {
  Outcome outcome;
  filter.doFilter(
      req, [&](const drogon::HttpResponsePtr &resp) { outcome.rejection = resp; },
      [&] { outcome.passed = true; });
  return outcome;
}

drogon::HttpRequestPtr requestWithToken(const std::optional<std::string> &token,
                                        const std::string &path = "/api/auth/me") {
  auto req = drogon::HttpRequest::newHttpRequest();
  req->setPath(path);
  if (token) req->addCookie("sc_session", *token);
  return req;
}

std::string tokenFor(Role role, std::int64_t expiresAt = std::time(nullptr) + 600,
                     std::int64_t sessionVersion = 1) {
  return security::issueSessionToken(SessionClaims{kUserId, role, expiresAt, sessionVersion}, kSecret);
}

// A "v1|userId|ROLE|exp" token as issued before sessions became revocable.
std::string legacyToken(Role role, std::int64_t expiresAt) {
  const std::string payload =
      "v1|" + kUserId + "|" + std::string(swapcycle::accounts::toString(role)) + "|" + std::to_string(expiresAt);
  std::array<unsigned char, crypto_auth_hmacsha256_BYTES> mac{};
  crypto_auth_hmacsha256_state state;
  crypto_auth_hmacsha256_init(&state, reinterpret_cast<const unsigned char *>(kSecret.data()), kSecret.size());
  crypto_auth_hmacsha256_update(&state, reinterpret_cast<const unsigned char *>(payload.data()), payload.size());
  crypto_auth_hmacsha256_final(&state, mac.data());
  const auto encode = [](const unsigned char *data, std::size_t length) {
    std::string out(sodium_base64_encoded_len(length, sodium_base64_VARIANT_URLSAFE_NO_PADDING), '\0');
    sodium_bin2base64(out.data(), out.size(), data, length, sodium_base64_VARIANT_URLSAFE_NO_PADDING);
    out.resize(std::char_traits<char>::length(out.c_str()));
    return out;
  };
  return encode(reinterpret_cast<const unsigned char *>(payload.data()), payload.size()) + "." +
         encode(mac.data(), mac.size());
}

// Stands in for the accounts module: the user's current session version, or
// an error / no answer at all.
class FakeSessionValidator : public SessionValidator {
 public:
  std::int64_t currentVersion = 1;
  bool fail = false;
  mutable int calls = 0;
  mutable std::function<void(SessionCheck)> pending;  // Set when deferAnswer is true.
  bool deferAnswer = false;

  void check(const std::string &userId, std::int64_t sessionVersion,
             std::function<void(SessionCheck)> done) const override {
    ++calls;
    const auto result = fail ? SessionCheck::kError
                        : userId == kUserId && sessionVersion == currentVersion ? SessionCheck::kCurrent
                                                                                : SessionCheck::kRevoked;
    if (deferAnswer) {
      pending = [done = std::move(done), result](SessionCheck) { done(result); };
      return;
    }
    done(result);
  }
};

class FiltersTest : public ::testing::Test {
 protected:
  void SetUp() override {
    ASSERT_TRUE(security::initialise());
    AuthFilter::configure(kSecret, "sc_session");
    validator = std::make_shared<FakeSessionValidator>();
    AuthFilter::setSessionValidator(validator);
  }
  void TearDown() override { AuthFilter::setSessionValidator(nullptr); }

  std::shared_ptr<FakeSessionValidator> validator;
};

TEST_F(FiltersTest, AuthFilterAcceptsTokenFromAccountsModule) {
  AuthFilter filter;
  auto req = requestWithToken(tokenFor(Role::Moderator));
  const auto outcome = run(filter, req);
  ASSERT_TRUE(outcome.passed);
  EXPECT_EQ(req->attributes()->get<std::string>(kAuthUserIdKey), kUserId);
  EXPECT_EQ(req->attributes()->get<std::string>(kAuthRoleKey), "MODERATOR");
}

TEST_F(FiltersTest, AuthFilterRejectsMissingExpiredForgedOrForeignTokens) {
  AuthFilter filter;
  const auto expired = tokenFor(Role::Reader, std::time(nullptr) - 1);
  const auto otherSecret =
      security::issueSessionToken(SessionClaims{kUserId, Role::Reader, std::time(nullptr) + 600, 1},
                                  kSecret + "-different");
  auto forged = tokenFor(Role::Reader);
  forged.back() = forged.back() == 'A' ? 'B' : 'A';

  for (const auto &token : {std::optional<std::string>{}, std::optional<std::string>{expired},
                            std::optional<std::string>{otherSecret}, std::optional<std::string>{forged},
                            std::optional<std::string>{"garbage"}}) {
    const auto outcome = run(filter, requestWithToken(token));
    EXPECT_FALSE(outcome.passed);
    ASSERT_TRUE(outcome.rejection);
    EXPECT_EQ(outcome.rejection->statusCode(), drogon::k401Unauthorized);
    EXPECT_EQ(outcome.errorCode(), "UNAUTHORIZED");
  }
}

TEST_F(FiltersTest, AuthFilterRejectsRevokedSessions) {
  AuthFilter filter;
  const auto token = tokenFor(Role::Reader, std::time(nullptr) + 600, 1);
  ASSERT_TRUE(run(filter, requestWithToken(token)).passed);

  validator->currentVersion = 2;  // Logout, password reset or role change.
  auto req = requestWithToken(token);
  const auto outcome = run(filter, req);
  EXPECT_FALSE(outcome.passed);
  ASSERT_TRUE(outcome.rejection);
  EXPECT_EQ(outcome.rejection->statusCode(), drogon::k401Unauthorized);
  EXPECT_EQ(outcome.errorCode(), "UNAUTHORIZED");
  EXPECT_FALSE(req->attributes()->find(kAuthUserIdKey)) << "a revoked session must not set the user";

  EXPECT_TRUE(run(filter, requestWithToken(tokenFor(Role::Reader, std::time(nullptr) + 600, 2))).passed);
}

TEST_F(FiltersTest, AuthFilterFailsClosedWhenTheCheckFails) {
  AuthFilter filter;
  validator->fail = true;
  const auto outcome = run(filter, requestWithToken(tokenFor(Role::Reader)));
  EXPECT_FALSE(outcome.passed);
  ASSERT_TRUE(outcome.rejection);
  EXPECT_EQ(outcome.rejection->statusCode(), drogon::k500InternalServerError);
  EXPECT_EQ(outcome.errorCode(), "INTERNAL");
}

TEST_F(FiltersTest, AuthFilterWaitsForAnAsyncAnswer) {
  AuthFilter filter;
  validator->deferAnswer = true;
  auto req = requestWithToken(tokenFor(Role::Moderator));
  bool passed = false;
  bool rejected = false;
  filter.doFilter(req, [&](const drogon::HttpResponsePtr &) { rejected = true; }, [&] { passed = true; });
  EXPECT_FALSE(passed || rejected) << "nothing may happen before the check answers";
  ASSERT_TRUE(validator->pending);

  validator->pending(SessionCheck::kCurrent);
  EXPECT_TRUE(passed);
  EXPECT_FALSE(rejected);
  EXPECT_EQ(req->attributes()->get<std::string>(kAuthRoleKey), "MODERATOR");
}

TEST_F(FiltersTest, AuthFilterRejectsVersionedTokensWithoutAValidator) {
  AuthFilter::setSessionValidator(nullptr);
  AuthFilter filter;
  const auto outcome = run(filter, requestWithToken(tokenFor(Role::Reader)));
  EXPECT_FALSE(outcome.passed);
  ASSERT_TRUE(outcome.rejection);
  EXPECT_EQ(outcome.rejection->statusCode(), drogon::k401Unauthorized);
}

TEST_F(FiltersTest, AuthFilterAcceptsLegacyV1TokensWithoutAVersionCheck) {
  AuthFilter filter;
  validator->currentVersion = 99;
  auto req = requestWithToken(legacyToken(Role::Moderator, std::time(nullptr) + 600));
  ASSERT_TRUE(run(filter, req).passed);
  EXPECT_EQ(validator->calls, 0);
  EXPECT_EQ(req->attributes()->get<std::string>(kAuthUserIdKey), kUserId);
  EXPECT_FALSE(run(filter, requestWithToken(legacyToken(Role::Reader, std::time(nullptr) - 1))).passed);
}

TEST_F(FiltersTest, AuthFilterRejectsEverythingWhenNotConfigured) {
  AuthFilter::configure("", "sc_session");
  AuthFilter filter;
  EXPECT_FALSE(run(filter, requestWithToken(tokenFor(Role::Reader))).passed);
}

TEST_F(FiltersTest, RoleFilterAllowsOnlyModerators) {
  RoleFilter filter;
  auto reader = requestWithToken(std::nullopt);
  reader->attributes()->insert(kAuthRoleKey, std::string("READER"));
  const auto denied = run(filter, reader);
  EXPECT_FALSE(denied.passed);
  EXPECT_EQ(denied.rejection->statusCode(), drogon::k403Forbidden);
  EXPECT_EQ(denied.errorCode(), "FORBIDDEN");

  auto moderator = requestWithToken(std::nullopt);
  moderator->attributes()->insert(kAuthRoleKey, std::string("MODERATOR"));
  EXPECT_TRUE(run(filter, moderator).passed);

  const auto anonymous = run(filter, requestWithToken(std::nullopt));
  EXPECT_EQ(anonymous.rejection->statusCode(), drogon::k401Unauthorized);
}

class FakeChecker : public ExchangeParticipantChecker {
 public:
  void check(const std::string &exchangeId, const std::string &userId,
             std::function<void(ParticipantCheck)> done) const override {
    done(exchangeId == kExchangeId && userId == kUserId ? ParticipantCheck::kParticipant
                                                        : ParticipantCheck::kNotParticipant);
  }
};

TEST_F(FiltersTest, ParticipantFilterLetsOnlyParticipantsThrough) {
  ParticipantFilter::setChecker(std::make_shared<FakeChecker>());
  ParticipantFilter filter;

  auto participant = requestWithToken(std::nullopt, "/api/exchanges/" + kExchangeId + "/chat");
  participant->attributes()->insert(kAuthUserIdKey, kUserId);
  EXPECT_TRUE(run(filter, participant).passed);

  auto outsider = requestWithToken(std::nullopt, "/api/exchanges/" + kExchangeId + "/chat");
  outsider->attributes()->insert(kAuthUserIdKey, std::string("11111111-2222-4333-8444-555555555555"));
  const auto hidden = run(filter, outsider);
  EXPECT_FALSE(hidden.passed);
  EXPECT_EQ(hidden.rejection->statusCode(), drogon::k404NotFound);
  EXPECT_EQ(hidden.errorCode(), "NOT_FOUND");

  for (const auto *path : {"/api/exchanges/123/chat", "/api/exchanges/../users", "/api/other"}) {
    auto malformed = requestWithToken(std::nullopt, path);
    malformed->attributes()->insert(kAuthUserIdKey, kUserId);
    EXPECT_EQ(run(filter, malformed).rejection->statusCode(), drogon::k404NotFound) << path;
  }
  ParticipantFilter::setChecker(nullptr);
}

}  // namespace
