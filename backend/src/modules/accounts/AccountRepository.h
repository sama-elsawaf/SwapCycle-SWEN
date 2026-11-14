#pragma once

// Database access for the accounts module. The only code that touches the
// users, user_interests, meeting_areas and password_reset_tokens tables.

#include <drogon/orm/DbClient.h>
#include <drogon/utils/coroutine.h>

#include <chrono>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "AccountTypes.h"

namespace swapcycle::accounts {

class AccountRepository {
public:
    virtual ~AccountRepository() = default;

    virtual drogon::Task<std::optional<User>> findByEmail(std::string email) = 0;
    virtual drogon::Task<std::optional<User>> findById(std::string userId) = 0;
    virtual drogon::Task<std::vector<User>> findByIds(std::vector<std::string> userIds) = 0;

    // Returns nullopt if the email is already registered.
    virtual drogon::Task<std::optional<User>> insertUser(NewUser user) = 0;

    // Applies the update (profile fields and interests) in one transaction.
    virtual drogon::Task<void> updateProfile(std::string userId, ProfileUpdate update) = 0;

    virtual drogon::Task<std::vector<MeetingArea>> listMeetingAreas() = 0;

    virtual drogon::Task<void> insertResetToken(std::string userId, std::string tokenHash,
                                                std::chrono::seconds ttl) = 0;

    // In one transaction: marks the token used if it is unused and unexpired,
    // invalidates the user's other reset tokens, stores the new hash and
    // raises the session version (ending every existing session).
    // Returns nullopt if the token was not valid.
    virtual drogon::Task<std::optional<SessionRevocation>> consumeResetTokenAndSetPassword(
        std::string tokenHash, std::string newPasswordHash) = 0;

    // users.session_version, or nullopt if the user does not exist.
    virtual drogon::Task<std::optional<std::int64_t>> findSessionVersion(std::string userId) = 0;

    // Raises the session version only if it still equals expectedVersion, so
    // a token that is already revoked cannot end newer sessions.
    // Returns nullopt if nothing changed.
    virtual drogon::Task<std::optional<SessionRevocation>> revokeSessions(std::string userId,
                                                                          std::int64_t expectedVersion) = 0;
};

class PostgresAccountRepository final : public AccountRepository {
public:
    explicit PostgresAccountRepository(drogon::orm::DbClientPtr db);

    drogon::Task<std::optional<User>> findByEmail(std::string email) override;
    drogon::Task<std::optional<User>> findById(std::string userId) override;
    drogon::Task<std::vector<User>> findByIds(std::vector<std::string> userIds) override;
    drogon::Task<std::optional<User>> insertUser(NewUser user) override;
    drogon::Task<void> updateProfile(std::string userId, ProfileUpdate update) override;
    drogon::Task<std::vector<MeetingArea>> listMeetingAreas() override;
    drogon::Task<void> insertResetToken(std::string userId, std::string tokenHash,
                                        std::chrono::seconds ttl) override;
    drogon::Task<std::optional<SessionRevocation>> consumeResetTokenAndSetPassword(
        std::string tokenHash, std::string newPasswordHash) override;
    drogon::Task<std::optional<std::int64_t>> findSessionVersion(std::string userId) override;
    drogon::Task<std::optional<SessionRevocation>> revokeSessions(std::string userId,
                                                                  std::int64_t expectedVersion) override;

private:
    drogon::orm::DbClientPtr db_;
};

}  // namespace swapcycle::accounts
