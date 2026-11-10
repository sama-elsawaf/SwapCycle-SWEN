#pragma once

// Business rules for the accounts module: registration, login, sessions,
// profiles, privacy and password resets.

#include <drogon/utils/coroutine.h>

#include <chrono>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

#include "AccountRepository.h"
#include "AccountTypes.h"
#include "SessionVersionCache.h"

namespace swapcycle::accounts {

struct AccountSettings {
    std::string sessionSecret;  // At least 32 bytes, from SESSION_SECRET.
    std::chrono::seconds sessionTtl = std::chrono::hours(2);
    std::chrono::seconds resetTokenTtl = std::chrono::minutes(30);
    // How long a looked-up session version is trusted. Bounds how long a
    // change made outside this server (e.g. a role change in SQL) takes to
    // end old sessions; logout and reset here take effect immediately.
    std::chrono::seconds sessionVersionCacheTtl = std::chrono::seconds(30);
};

// Delivers password-reset links. The real e-mail sender belongs to the
// notifications work; until then LoggingResetSender records only that a reset
// was requested (never the token).
class PasswordResetSender {
public:
    virtual ~PasswordResetSender() = default;
    virtual void send(const User& user, const std::string& token) = 0;
};

class LoggingResetSender final : public PasswordResetSender {
public:
    void send(const User& user, const std::string& token) override;
};

struct Session {
    User user;
    std::string token;
    std::chrono::seconds ttl;
};

class AccountService {
public:
    static constexpr std::size_t kMinPasswordLength = 8;
    static constexpr std::size_t kMaxPasswordLength = 128;

    AccountService(std::shared_ptr<AccountRepository> repository, AccountSettings settings,
                   std::shared_ptr<PasswordResetSender> resetSender = std::make_shared<LoggingResetSender>());

    drogon::Task<Session> registerUser(std::string email, std::string password, std::string displayName);
    // Every failure throws the same UNAUTHORIZED "Invalid email or password".
    drogon::Task<Session> login(std::string email, std::string password);

    drogon::Task<User> getCurrentUser(std::string userId);
    drogon::Task<User> updateProfile(std::string userId, ProfileUpdate update);
    drogon::Task<PublicProfile> getPublicProfile(std::string userId);

    // Used by other modules (e.g. catalog listings) to show owner names only.
    drogon::Task<std::unordered_map<std::string, OwnerSummary>> getOwnerSummaries(std::vector<std::string> userIds);

    drogon::Task<std::vector<MeetingArea>> listMeetingAreas();
    drogon::Task<std::optional<MeetingArea>> findMeetingArea(int areaId);

    // Never reveals whether the email exists.
    drogon::Task<void> requestPasswordReset(std::string email);
    // Also ends every existing session of the account.
    drogon::Task<void> confirmPasswordReset(std::string token, std::string newPassword);

    // Ends every session of the token's account (all devices). Does nothing
    // for a missing, invalid, expired or already-revoked token, so logging
    // out never fails.
    drogon::Task<void> logout(std::string token);

    // Signature, format and expiry only.
    std::optional<SessionClaims> verifySession(std::string_view token) const;

    // True if sessionVersion is still the user's current version. Used by
    // AuthFilter (through AccountSessionValidator) on every protected request.
    drogon::Task<bool> isSessionCurrent(std::string userId, std::int64_t sessionVersion);

    static std::string normaliseEmail(std::string_view email);

private:
    Session startSession(User user) const;

    std::shared_ptr<AccountRepository> repository_;
    AccountSettings settings_;
    std::shared_ptr<PasswordResetSender> resetSender_;
    std::string dummyPasswordHash_;  // Keeps login timing equal for unknown emails.
    std::shared_ptr<SessionVersionCache> sessionVersions_;
};

}  // namespace swapcycle::accounts
