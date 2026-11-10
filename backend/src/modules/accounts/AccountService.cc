#include "AccountService.h"

#include <trantor/utils/Logger.h>

#include <algorithm>
#include <cctype>
#include <ctime>
#include <set>
#include <utility>

#include "AccountSecurity.h"
#include "common/ApiError.h"

namespace swapcycle::accounts {

namespace {

using common::ApiError;
using common::ErrorCode;

constexpr std::size_t kMaxEmailLength = 254;
constexpr std::size_t kMinDisplayName = 2;
constexpr std::size_t kMaxDisplayName = 40;
constexpr const char* kInvalidCredentials = "Invalid email or password";

[[noreturn]] void invalid(const std::string& message) {
    throw ApiError(ErrorCode::ValidationFailed, message);
}

std::string trim(std::string_view value) {
    const auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string_view::npos) return {};
    const auto last = value.find_last_not_of(" \t\r\n");
    return std::string(value.substr(first, last - first + 1));
}

std::size_t utf8Length(std::string_view value) {
    return static_cast<std::size_t>(
        std::count_if(value.begin(), value.end(), [](char c) { return (static_cast<unsigned char>(c) & 0xC0) != 0x80; }));
}

bool hasControlCharacters(std::string_view value) {
    return std::any_of(value.begin(), value.end(), [](char c) { return std::iscntrl(static_cast<unsigned char>(c)); });
}

// Deliberately simple: one "@", no spaces or control characters, a dot in
// the domain. The real check is that the reader can receive mail.
// Control characters matter: PostgreSQL text stops at "\0", so
// "sara@example.com\0x" would otherwise be stored or looked up as
// "sara@example.com" while being counted as a different address.
bool looksLikeEmail(std::string_view email) {
    if (hasControlCharacters(email)) return false;
    const auto at = email.find('@');
    if (at == std::string_view::npos || at == 0 || email.find('@', at + 1) != std::string_view::npos) return false;
    const auto domain = email.substr(at + 1);
    const auto dot = domain.find('.');
    if (dot == std::string_view::npos || dot == 0 || dot == domain.size() - 1) return false;
    return std::none_of(email.begin(), email.end(), [](char c) { return std::isspace(static_cast<unsigned char>(c)); });
}

void validatePassword(std::string_view password) {
    if (password.size() < AccountService::kMinPasswordLength) invalid("Password must be at least 8 characters.");
    if (password.size() > AccountService::kMaxPasswordLength) invalid("Password must be at most 128 characters.");
}

std::string validDisplayName(std::string_view raw) {
    auto name = trim(raw);
    const auto length = utf8Length(name);
    if (length < kMinDisplayName || length > kMaxDisplayName || hasControlCharacters(name)) {
        invalid("Display name must be 2 to 40 characters.");
    }
    return name;
}

std::string validEmail(std::string_view raw) {
    auto email = AccountService::normaliseEmail(raw);
    if (email.size() > kMaxEmailLength || !looksLikeEmail(email)) invalid("Enter a valid email address.");
    return email;
}

void validateInterests(const std::vector<std::string>& interests) {
    if (interests.size() > kInterestCategories.size()) invalid("Too many interests.");
    const std::set<std::string> unique(interests.begin(), interests.end());
    if (unique.size() != interests.size()) invalid("Interests must not repeat.");
    for (const auto& interest : interests) {
        if (!isInterestCategory(interest)) invalid("Unknown interest category.");
    }
}

}  // namespace

void LoggingResetSender::send(const User& user, const std::string& /*token*/) {
    LOG_INFO << "Password reset requested for user " << user.id << " (no mail sender configured)";
}

AccountService::AccountService(std::shared_ptr<AccountRepository> repository, AccountSettings settings,
                               std::shared_ptr<PasswordResetSender> resetSender)
    : repository_(std::move(repository)),
      settings_(std::move(settings)),
      resetSender_(std::move(resetSender)),
      dummyPasswordHash_(security::hashPassword(security::randomToken())),
      sessionVersions_(std::make_shared<SessionVersionCache>(settings_.sessionVersionCacheTtl)) {}

std::string AccountService::normaliseEmail(std::string_view email) {
    auto normalised = trim(email);
    std::transform(normalised.begin(), normalised.end(), normalised.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return normalised;
}

Session AccountService::startSession(User user) const {
    const auto expiresAt = static_cast<std::int64_t>(std::time(nullptr)) + settings_.sessionTtl.count();
    auto token = security::issueSessionToken({user.id, user.role, expiresAt, user.sessionVersion},
                                             settings_.sessionSecret);
    return Session{std::move(user), std::move(token), settings_.sessionTtl};
}

drogon::Task<Session> AccountService::registerUser(std::string email, std::string password,
                                                   std::string displayName) {
    NewUser newUser{validEmail(email), "", validDisplayName(displayName)};
    validatePassword(password);
    newUser.passwordHash = security::hashPassword(password);

    auto user = co_await repository_->insertUser(std::move(newUser));
    if (!user) throw ApiError(ErrorCode::Conflict, "An account could not be created with these details.");
    co_return startSession(std::move(*user));
}

drogon::Task<Session> AccountService::login(std::string email, std::string password) {
    const auto normalised = normaliseEmail(email);
    if (normalised.empty() || password.empty() || normalised.size() > kMaxEmailLength ||
        password.size() > kMaxPasswordLength || !looksLikeEmail(normalised)) {
        throw ApiError(ErrorCode::Unauthorized, kInvalidCredentials);
    }

    auto user = co_await repository_->findByEmail(normalised);
    // Hash against a dummy when the email is unknown so response time does
    // not reveal which emails have accounts.
    const bool passwordOk = security::verifyPassword(user ? user->passwordHash : dummyPasswordHash_, password);
    if (!user || !passwordOk) throw ApiError(ErrorCode::Unauthorized, kInvalidCredentials);
    co_return startSession(std::move(*user));
}

drogon::Task<User> AccountService::getCurrentUser(std::string userId) {
    auto user = co_await repository_->findById(std::move(userId));
    if (!user) throw ApiError(ErrorCode::Unauthorized, "Please log in again.");
    co_return std::move(*user);
}

drogon::Task<User> AccountService::updateProfile(std::string userId, ProfileUpdate update) {
    if (update.displayName) update.displayName = validDisplayName(*update.displayName);
    if (update.interests) validateInterests(*update.interests);
    if (update.meetingAreaId && *update.meetingAreaId) {
        const auto area = co_await findMeetingArea(**update.meetingAreaId);
        if (!area) invalid("Unknown meeting area.");
    }

    co_await repository_->updateProfile(userId, std::move(update));
    co_return co_await getCurrentUser(std::move(userId));
}

drogon::Task<PublicProfile> AccountService::getPublicProfile(std::string userId) {
    auto user = co_await repository_->findById(std::move(userId));
    if (!user) throw ApiError(ErrorCode::NotFound, "Reader not found.");
    co_return toPublicProfile(*user);
}

drogon::Task<std::unordered_map<std::string, OwnerSummary>> AccountService::getOwnerSummaries(
    std::vector<std::string> userIds) {
    std::sort(userIds.begin(), userIds.end());
    userIds.erase(std::unique(userIds.begin(), userIds.end()), userIds.end());

    std::unordered_map<std::string, OwnerSummary> summaries;
    const auto users = co_await repository_->findByIds(std::move(userIds));
    for (const auto& user : users) {
        summaries.emplace(user.id, OwnerSummary{user.id, user.displayName});
    }
    co_return summaries;
}

drogon::Task<std::vector<MeetingArea>> AccountService::listMeetingAreas() {
    co_return co_await repository_->listMeetingAreas();
}

drogon::Task<std::optional<MeetingArea>> AccountService::findMeetingArea(int areaId) {
    const auto areas = co_await repository_->listMeetingAreas();
    for (const auto& area : areas) {
        if (area.id == areaId) co_return area;
    }
    co_return std::nullopt;
}

drogon::Task<void> AccountService::requestPasswordReset(std::string email) {
    const auto normalised = validEmail(email);
    const auto user = co_await repository_->findByEmail(normalised);
    if (!user) co_return;

    const auto token = security::randomToken();
    co_await repository_->insertResetToken(user->id, security::sha256Hex(token), settings_.resetTokenTtl);
    resetSender_->send(*user, token);
}

drogon::Task<void> AccountService::confirmPasswordReset(std::string token, std::string newPassword) {
    if (token.size() < 20 || token.size() > 128) invalid("This reset link is invalid or has expired.");
    validatePassword(newPassword);

    const auto revoked = co_await repository_->consumeResetTokenAndSetPassword(security::sha256Hex(token),
                                                                              security::hashPassword(newPassword));
    if (!revoked) invalid("This reset link is invalid or has expired.");
    sessionVersions_->put(revoked->userId, revoked->newVersion);
}

drogon::Task<void> AccountService::logout(std::string token) {
    const auto claims = verifySession(token);
    // Legacy v1 tokens carry no version; they simply expire.
    if (!claims || !claims->sessionVersion) co_return;
    const auto revoked = co_await repository_->revokeSessions(claims->userId, *claims->sessionVersion);
    if (revoked) sessionVersions_->put(revoked->userId, revoked->newVersion);
}

std::optional<SessionClaims> AccountService::verifySession(std::string_view token) const {
    return security::verifySessionToken(token, settings_.sessionSecret, static_cast<std::int64_t>(std::time(nullptr)));
}

drogon::Task<bool> AccountService::isSessionCurrent(std::string userId, std::int64_t sessionVersion) {
    if (const auto cached = sessionVersions_->get(userId)) co_return *cached == sessionVersion;
    const auto stored = co_await repository_->findSessionVersion(userId);
    if (!stored) co_return false;  // The account no longer exists.
    // put() keeps whichever is newer: this lookup or a revocation that finished meanwhile.
    co_return sessionVersions_->put(userId, *stored) == sessionVersion;
}

}  // namespace swapcycle::accounts
