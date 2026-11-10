#include <gtest/gtest.h>
#include <sodium.h>

#include <array>
#include <string>

#include "modules/accounts/AccountSecurity.h"
#include "modules/accounts/RateLimiter.h"

namespace swapcycle::accounts {
namespace {

const std::string kSecret = "test-secret-that-is-definitely-32-bytes-long";
constexpr std::int64_t kNow = 1'800'000'000;

class AccountSecurityTest : public ::testing::Test {
protected:
    void SetUp() override { ASSERT_TRUE(security::initialise()); }
};

TEST_F(AccountSecurityTest, HashesWithArgon2idAndVerifies) {
    const auto hash = security::hashPassword("correct horse");
    EXPECT_EQ(hash.rfind("$argon2id$", 0), 0u);
    EXPECT_EQ(hash.find("correct horse"), std::string::npos);
    EXPECT_TRUE(security::verifyPassword(hash, "correct horse"));
    EXPECT_FALSE(security::verifyPassword(hash, "wrong horse"));
}

TEST_F(AccountSecurityTest, SamePasswordGetsDifferentSalts) {
    EXPECT_NE(security::hashPassword("same password"), security::hashPassword("same password"));
}

TEST_F(AccountSecurityTest, SessionTokenRoundTrips) {
    const auto token = security::issueSessionToken({"user-1", Role::Moderator, kNow + 60, 1}, kSecret);
    const auto claims = security::verifySessionToken(token, kSecret, kNow);
    ASSERT_TRUE(claims);
    EXPECT_EQ(claims->userId, "user-1");
    EXPECT_EQ(claims->role, Role::Moderator);
}

TEST_F(AccountSecurityTest, SessionTokenCarriesSessionVersion) {
    const auto token = security::issueSessionToken({"user-1", Role::Reader, kNow + 60, 42}, kSecret);
    const auto claims = security::verifySessionToken(token, kSecret, kNow);
    ASSERT_TRUE(claims);
    EXPECT_EQ(claims->sessionVersion, std::optional<std::int64_t>{42});
}

TEST_F(AccountSecurityTest, RefusesToIssueTokenWithoutSessionVersion) {
    EXPECT_THROW(security::issueSessionToken({"user-1", Role::Reader, kNow + 60, std::nullopt}, kSecret),
                 std::invalid_argument);
    EXPECT_THROW(security::issueSessionToken({"user-1", Role::Reader, kNow + 60, 0}, kSecret), std::invalid_argument);
}

std::string toBase64Url(const unsigned char* data, std::size_t length) {
    std::string out(sodium_base64_encoded_len(length, sodium_base64_VARIANT_URLSAFE_NO_PADDING), '\0');
    sodium_bin2base64(out.data(), out.size(), data, length, sodium_base64_VARIANT_URLSAFE_NO_PADDING);
    out.resize(std::char_traits<char>::length(out.c_str()));
    return out;
}

// Signs an arbitrary payload the way the server does, to build legacy and malformed tokens.
std::string signPayload(const std::string& payload) {
    std::array<unsigned char, crypto_auth_hmacsha256_BYTES> mac{};
    crypto_auth_hmacsha256_state state;
    crypto_auth_hmacsha256_init(&state, reinterpret_cast<const unsigned char*>(kSecret.data()), kSecret.size());
    crypto_auth_hmacsha256_update(&state, reinterpret_cast<const unsigned char*>(payload.data()), payload.size());
    crypto_auth_hmacsha256_final(&state, mac.data());
    return toBase64Url(reinterpret_cast<const unsigned char*>(payload.data()), payload.size()) + "." +
           toBase64Url(mac.data(), mac.size());
}

TEST_F(AccountSecurityTest, AcceptsLegacyV1TokensUntilExpiryWithoutVersion) {
    const auto legacy = signPayload("v1|user-1|READER|" + std::to_string(kNow + 60));
    const auto claims = security::verifySessionToken(legacy, kSecret, kNow);
    ASSERT_TRUE(claims);
    EXPECT_EQ(claims->userId, "user-1");
    EXPECT_FALSE(claims->sessionVersion);
    EXPECT_FALSE(security::verifySessionToken(legacy, kSecret, kNow + 60));
}

TEST_F(AccountSecurityTest, RejectsSignedTokensWithBadVersionFields) {
    const auto exp = std::to_string(kNow + 60);
    for (const auto& payload : {"v2|user-1|READER|" + exp,    // v2 without a version
                                "v1|user-1|READER|3|" + exp,  // v1 with five fields
                                "v2|user-1|READER|0|" + exp,  // version must be >= 1
                                "v2|user-1|READER|-1|" + exp, "v2|user-1|READER|1x|" + exp,
                                "v2|user-1|READER||" + exp, "v3|user-1|READER|1|" + exp}) {
        EXPECT_FALSE(security::verifySessionToken(signPayload(payload), kSecret, kNow)) << payload;
    }
}

TEST_F(AccountSecurityTest, RejectsExpiredToken) {
    const auto token = security::issueSessionToken({"user-1", Role::Reader, kNow, 1}, kSecret);
    EXPECT_FALSE(security::verifySessionToken(token, kSecret, kNow));
}

TEST_F(AccountSecurityTest, RejectsWrongSecret) {
    const auto token = security::issueSessionToken({"user-1", Role::Reader, kNow + 60, 1}, kSecret);
    EXPECT_FALSE(security::verifySessionToken(token, kSecret + "x", kNow));
}

TEST_F(AccountSecurityTest, RejectsTamperedPayload) {
    // Forge a moderator payload but keep the reader token's signature.
    const auto reader = security::issueSessionToken({"user-1", Role::Reader, kNow + 60, 1}, kSecret);
    const auto moderator = security::issueSessionToken({"user-1", Role::Moderator, kNow + 60, 1}, kSecret);
    const auto forged = moderator.substr(0, moderator.find('.')) + reader.substr(reader.find('.'));
    EXPECT_FALSE(security::verifySessionToken(forged, kSecret, kNow));
}

TEST_F(AccountSecurityTest, RejectsMalformedTokens) {
    EXPECT_FALSE(security::verifySessionToken("", kSecret, kNow));
    EXPECT_FALSE(security::verifySessionToken("no-dot", kSecret, kNow));
    EXPECT_FALSE(security::verifySessionToken("a.b", kSecret, kNow));
}

TEST_F(AccountSecurityTest, RefusesShortSecret) {
    EXPECT_THROW(security::issueSessionToken({"user-1", Role::Reader, kNow + 60, 1}, "short"), std::invalid_argument);
}

TEST_F(AccountSecurityTest, RandomTokensAreUniqueAndHashIsStable) {
    const auto a = security::randomToken();
    EXPECT_NE(a, security::randomToken());
    EXPECT_GE(a.size(), 40u);
    EXPECT_EQ(security::sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
}

TEST(RateLimiterTest, BlocksAfterLimitUntilWindowEnds) {
    RateLimiter limiter(2, std::chrono::seconds(60));
    const auto start = RateLimiter::Clock::now();
    EXPECT_EQ(limiter.hit("ip", start).count(), 0);
    EXPECT_EQ(limiter.hit("ip", start).count(), 0);
    EXPECT_EQ(limiter.hit("ip", start + std::chrono::seconds(10)).count(), 50);
    EXPECT_EQ(limiter.hit("other", start).count(), 0);
    EXPECT_EQ(limiter.hit("ip", start + std::chrono::seconds(60)).count(), 0);
}

TEST(RateLimiterTest, ResetClearsKey) {
    RateLimiter limiter(1, std::chrono::seconds(60));
    EXPECT_EQ(limiter.hit("email").count(), 0);
    EXPECT_GT(limiter.hit("email").count(), 0);
    limiter.reset("email");
    EXPECT_EQ(limiter.hit("email").count(), 0);
}

}  // namespace
}  // namespace swapcycle::accounts
