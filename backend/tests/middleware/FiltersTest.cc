#include <drogon/HttpRequest.h>
#include <drogon/HttpResponse.h>
#include <gtest/gtest.h>

#include <ctime>
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

std::string tokenFor(Role role, std::int64_t expiresAt = std::time(nullptr) + 600) {
  return security::issueSessionToken(SessionClaims{kUserId, role, expiresAt}, kSecret);
}

class FiltersTest : public ::testing::Test {
 protected:
  void SetUp() override {
    ASSERT_TRUE(security::initialise());
    AuthFilter::configure(kSecret, "sc_session");
  }
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
      security::issueSessionToken(SessionClaims{kUserId, Role::Reader, std::time(nullptr) + 600},
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
