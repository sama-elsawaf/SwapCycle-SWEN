#pragma once

// Data types for the accounts module.

#include <json/json.h>

#include <array>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace swapcycle::accounts {

// Matches the onboarding chips in the design and the user_interests CHECK constraint.
inline constexpr std::array<std::string_view, 8> kInterestCategories{
    "FICTION", "NON_FICTION", "SCIENCE", "TECHNOLOGY",
    "ART_DESIGN", "SELF_HELP", "BUSINESS", "OTHER"};

bool isInterestCategory(std::string_view value);

enum class Role { Reader, Moderator };

std::string_view toString(Role role);
std::optional<Role> roleFromString(std::string_view value);

struct MeetingArea {
    int id = 0;
    std::string name;
};

struct PrivacySettings {
    bool showMeetingArea = true;
    bool showInterests = true;
};

struct User {
    std::string id;
    std::string email;
    std::string passwordHash;  // Never serialised.
    std::string displayName;
    std::optional<MeetingArea> meetingArea;
    Role role = Role::Reader;
    PrivacySettings privacy;
    std::vector<std::string> interests;
    bool onboardingCompleted = false;
    std::string createdAt;  // ISO-8601 UTC.
    std::int64_t sessionVersion = 1;  // users.session_version; never serialised.
};

struct NewUser {
    std::string email;
    std::string passwordHash;
    std::string displayName;
};

// What another reader may see. Fields hidden by privacy settings are empty.
struct PublicProfile {
    std::string id;
    std::string displayName;
    std::optional<MeetingArea> meetingArea;
    std::optional<std::vector<std::string>> interests;
    std::string memberSince;
};

// The only owner details shown on public listings.
struct OwnerSummary {
    std::string id;
    std::string displayName;
};

// Every field is optional; only fields that are set are changed.
struct ProfileUpdate {
    std::optional<std::string> displayName;
    // Outer optional: "was the field sent"; inner: "set or clear the area".
    std::optional<std::optional<int>> meetingAreaId;
    std::optional<std::vector<std::string>> interests;
    std::optional<PrivacySettings> privacy;
    std::optional<bool> onboardingCompleted;
};

// A raised users.session_version: every older session of userId has ended.
struct SessionRevocation {
    std::string userId;
    std::int64_t newVersion = 0;
};

struct SessionClaims {
    std::string userId;
    Role role = Role::Reader;
    std::int64_t expiresAt = 0;  // Unix seconds.
    // users.session_version when the token was issued. Raising the stored
    // version ends the session. Empty only for legacy "v1" tokens issued
    // before revocation existed; those are accepted until they expire.
    std::optional<std::int64_t> sessionVersion;
};

PublicProfile toPublicProfile(const User& user);

Json::Value toJson(const MeetingArea& area);
Json::Value toJson(const PublicProfile& profile);
// The caller's own account. Never contains the password hash.
Json::Value toCurrentUserJson(const User& user);

// Parses a PATCH /users/me body. Throws common::ApiError (VALIDATION_FAILED)
// for wrong JSON types; value rules are checked by AccountService.
ProfileUpdate parseProfileUpdate(const Json::Value& body);

}  // namespace swapcycle::accounts
