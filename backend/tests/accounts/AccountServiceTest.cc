#include <gtest/gtest.h>

#include "modules/accounts/AccountSecurity.h"
#include "modules/accounts/AccountService.h"
#include "support/FakeRepositories.h"

namespace swapcycle::accounts {
namespace {

using common::ErrorCode;
using swapcycle::testing::expectApiError;

class AccountServiceTest : public ::testing::Test {
protected:
    void SetUp() override {
        ASSERT_TRUE(security::initialise());
        repository = std::make_shared<swapcycle::testing::FakeAccountRepository>();
        sender = std::make_shared<swapcycle::testing::CapturingResetSender>();
        service = std::make_shared<AccountService>(
            repository, AccountSettings{"test-secret-that-is-definitely-32-bytes-long"}, sender);
    }

    Session registerSara() {
        return drogon::sync_wait(service->registerUser("  Sara@Example.com ", "password123", " Sara "));
    }

    std::shared_ptr<swapcycle::testing::FakeAccountRepository> repository;
    std::shared_ptr<swapcycle::testing::CapturingResetSender> sender;
    std::shared_ptr<AccountService> service;
};

TEST_F(AccountServiceTest, RegisterNormalisesAndNeverStoresPlaintext) {
    const auto session = registerSara();
    EXPECT_EQ(session.user.email, "sara@example.com");
    EXPECT_EQ(session.user.displayName, "Sara");
    EXPECT_NE(session.user.passwordHash, "password123");
    EXPECT_TRUE(security::verifyPassword(session.user.passwordHash, "password123"));
    EXPECT_TRUE(service->verifySession(session.token));
}

TEST_F(AccountServiceTest, RegisterValidatesInput) {
    expectApiError(service->registerUser("not-an-email", "password123", "Sara"), ErrorCode::ValidationFailed);
    expectApiError(service->registerUser("sara@example.com", "short", "Sara"), ErrorCode::ValidationFailed);
    expectApiError(service->registerUser("sara@example.com", "password123", "S"), ErrorCode::ValidationFailed);
    expectApiError(service->registerUser("sara@example.com", std::string(129, 'x'), "Sara"),
                   ErrorCode::ValidationFailed);
}

TEST_F(AccountServiceTest, EmailsWithControlCharactersAreRejected) {
    // PostgreSQL text stops at "\0", so these would be stored or looked up as a different address.
    using namespace std::string_literals;
    expectApiError(service->registerUser("p5@exa\0mple.com"s, "password123", "Sara"), ErrorCode::ValidationFailed);
    expectApiError(service->registerUser("sara@example.com\0x"s, "password123", "Sara"), ErrorCode::ValidationFailed);
    expectApiError(service->registerUser("sara@exam\tple.com", "password123", "Sara"), ErrorCode::ValidationFailed);
    expectApiError(service->requestPasswordReset("sara@example.com\0x"s), ErrorCode::ValidationFailed);

    registerSara();
    // A suffix after "\0" must not reach the real account (or dodge the per-email login limit).
    expectApiError(service->login("sara@example.com\0x"s, "password123"), ErrorCode::Unauthorized);
}

TEST_F(AccountServiceTest, DuplicateEmailIsAGenericConflict) {
    registerSara();
    expectApiError(service->registerUser("sara@example.com", "password456", "Other"), ErrorCode::Conflict);
}

TEST_F(AccountServiceTest, LoginSucceedsWithCorrectPassword) {
    registerSara();
    const auto session = drogon::sync_wait(service->login("SARA@example.com", "password123"));
    EXPECT_EQ(session.user.displayName, "Sara");
}

TEST_F(AccountServiceTest, LoginFailuresUseTheSameMessage) {
    registerSara();
    std::string wrongPassword;
    std::string unknownEmail;
    try {
        drogon::sync_wait(service->login("sara@example.com", "wrong-password"));
    } catch (const common::ApiError& error) {
        EXPECT_EQ(error.code(), ErrorCode::Unauthorized);
        wrongPassword = error.what();
    }
    try {
        drogon::sync_wait(service->login("nobody@example.com", "password123"));
    } catch (const common::ApiError& error) {
        EXPECT_EQ(error.code(), ErrorCode::Unauthorized);
        unknownEmail = error.what();
    }
    EXPECT_EQ(wrongPassword, "Invalid email or password");
    EXPECT_EQ(unknownEmail, wrongPassword);
}

TEST_F(AccountServiceTest, UpdateProfileValidatesAreaAndInterests) {
    const auto id = registerSara().user.id;
    ProfileUpdate badArea;
    badArea.meetingAreaId = std::optional<int>{99};
    expectApiError(service->updateProfile(id, badArea), ErrorCode::ValidationFailed);

    ProfileUpdate badInterest;
    badInterest.interests = std::vector<std::string>{"FICTION", "COOKING"};
    expectApiError(service->updateProfile(id, badInterest), ErrorCode::ValidationFailed);

    ProfileUpdate repeated;
    repeated.interests = std::vector<std::string>{"FICTION", "FICTION"};
    expectApiError(service->updateProfile(id, repeated), ErrorCode::ValidationFailed);

    ProfileUpdate good;
    good.meetingAreaId = std::optional<int>{2};
    good.interests = std::vector<std::string>{"FICTION", "SCIENCE"};
    good.onboardingCompleted = true;
    const auto user = drogon::sync_wait(service->updateProfile(id, good));
    ASSERT_TRUE(user.meetingArea);
    EXPECT_EQ(user.meetingArea->name, "Student Union");
    EXPECT_EQ(user.interests.size(), 2u);
    EXPECT_TRUE(user.onboardingCompleted);
}

TEST_F(AccountServiceTest, PublicProfileRespectsPrivacyAndHidesEmail) {
    const auto id = registerSara().user.id;
    ProfileUpdate update;
    update.meetingAreaId = std::optional<int>{1};
    update.interests = std::vector<std::string>{"FICTION"};
    update.privacy = PrivacySettings{false, false};
    drogon::sync_wait(service->updateProfile(id, update));

    const auto profile = drogon::sync_wait(service->getPublicProfile(id));
    EXPECT_FALSE(profile.meetingArea);
    EXPECT_FALSE(profile.interests);
    const auto json = toJson(profile);
    EXPECT_FALSE(json.isMember("email"));
    EXPECT_FALSE(json.isMember("passwordHash"));
}

TEST_F(AccountServiceTest, CurrentUserJsonNeverContainsHash) {
    const auto json = toCurrentUserJson(registerSara().user);
    EXPECT_FALSE(json.isMember("passwordHash"));
    EXPECT_EQ(json["email"].asString(), "sara@example.com");
}

TEST_F(AccountServiceTest, PasswordResetTokenIsHashedAndSingleUse) {
    registerSara();
    drogon::sync_wait(service->requestPasswordReset("sara@example.com"));
    ASSERT_EQ(sender->tokens.size(), 1u);
    const auto token = sender->tokens[0];
    EXPECT_EQ(repository->resetTokens.count(token), 0u) << "plaintext token must not be stored";
    EXPECT_EQ(repository->resetTokens.count(security::sha256Hex(token)), 1u);

    drogon::sync_wait(service->confirmPasswordReset(token, "new-password-1"));
    drogon::sync_wait(service->login("sara@example.com", "new-password-1"));
    expectApiError(service->confirmPasswordReset(token, "another-password"), ErrorCode::ValidationFailed);
}

TEST_F(AccountServiceTest, PasswordResetForUnknownEmailIsSilent) {
    drogon::sync_wait(service->requestPasswordReset("nobody@example.com"));
    EXPECT_TRUE(sender->tokens.empty());
}

TEST_F(AccountServiceTest, OwnerSummariesContainOnlyDisplayNames) {
    const auto id = registerSara().user.id;
    const auto summaries = drogon::sync_wait(service->getOwnerSummaries({id, id, "missing"}));
    ASSERT_EQ(summaries.size(), 1u);
    EXPECT_EQ(summaries.at(id).displayName, "Sara");
}

}  // namespace
}  // namespace swapcycle::accounts
