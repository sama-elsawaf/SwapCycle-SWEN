#include "AccountRepository.h"

#include <utility>

namespace swapcycle::accounts {

namespace {

using drogon::orm::Row;

// Static column list shared by every user query. Never contains user input.
constexpr const char* kUserSelect = R"SQL(
    SELECT u.id::text AS id, u.email::text AS email, u.password_hash, u.display_name, u.role,
           u.show_meeting_area, u.show_interests, u.onboarding_completed, u.session_version,
           to_char(u.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
           a.id AS area_id, a.name AS area_name,
           COALESCE((SELECT string_agg(i.category, ',' ORDER BY i.category)
                     FROM user_interests i WHERE i.user_id = u.id), '') AS interests
    FROM users u
    LEFT JOIN meeting_areas a ON a.id = u.meeting_area_id
)SQL";

std::vector<std::string> splitCsv(const std::string& csv) {
    std::vector<std::string> values;
    std::size_t start = 0;
    while (start < csv.size()) {
        const auto end = csv.find(',', start);
        values.push_back(csv.substr(start, end - start));
        if (end == std::string::npos) break;
        start = end + 1;
    }
    return values;
}

// Builds a Postgres array literal. Only used for values that are already
// validated (UUIDs from the database, enum categories), and always passed as
// a bound parameter.
std::string toArrayLiteral(const std::vector<std::string>& values) {
    std::string literal = "{";
    for (std::size_t i = 0; i < values.size(); ++i) {
        if (i > 0) literal += ',';
        literal += values[i];
    }
    return literal + "}";
}

User userFromRow(const Row& row) {
    User user;
    user.id = row["id"].as<std::string>();
    user.email = row["email"].as<std::string>();
    user.passwordHash = row["password_hash"].as<std::string>();
    user.displayName = row["display_name"].as<std::string>();
    user.role = roleFromString(row["role"].as<std::string>()).value_or(Role::Reader);
    user.privacy.showMeetingArea = row["show_meeting_area"].as<bool>();
    user.privacy.showInterests = row["show_interests"].as<bool>();
    user.onboardingCompleted = row["onboarding_completed"].as<bool>();
    user.createdAt = row["created_at"].as<std::string>();
    user.sessionVersion = row["session_version"].as<std::int64_t>();
    if (!row["area_id"].isNull()) {
        user.meetingArea = MeetingArea{row["area_id"].as<int>(), row["area_name"].as<std::string>()};
    }
    user.interests = splitCsv(row["interests"].as<std::string>());
    return user;
}

}  // namespace

PostgresAccountRepository::PostgresAccountRepository(drogon::orm::DbClientPtr db) : db_(std::move(db)) {}

drogon::Task<std::optional<User>> PostgresAccountRepository::findByEmail(std::string email) {
    const auto result = co_await db_->execSqlCoro(std::string(kUserSelect) + " WHERE u.email = $1", email);
    if (result.empty()) co_return std::nullopt;
    co_return userFromRow(result[0]);
}

drogon::Task<std::optional<User>> PostgresAccountRepository::findById(std::string userId) {
    const auto result = co_await db_->execSqlCoro(std::string(kUserSelect) + " WHERE u.id = $1::uuid", userId);
    if (result.empty()) co_return std::nullopt;
    co_return userFromRow(result[0]);
}

drogon::Task<std::vector<User>> PostgresAccountRepository::findByIds(std::vector<std::string> userIds) {
    std::vector<User> users;
    if (userIds.empty()) co_return users;
    const auto result = co_await db_->execSqlCoro(std::string(kUserSelect) + " WHERE u.id = ANY($1::uuid[])",
                                                  toArrayLiteral(userIds));
    for (const auto& row : result) users.push_back(userFromRow(row));
    co_return users;
}

drogon::Task<std::optional<User>> PostgresAccountRepository::insertUser(NewUser user) {
    const auto inserted = co_await db_->execSqlCoro(
        "INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) "
        "ON CONFLICT (email) DO NOTHING RETURNING id::text",
        user.email, user.passwordHash, user.displayName);
    if (inserted.empty()) co_return std::nullopt;
    co_return co_await findById(inserted[0]["id"].as<std::string>());
}

drogon::Task<void> PostgresAccountRepository::updateProfile(std::string userId, ProfileUpdate update) {
    const bool areaSent = update.meetingAreaId.has_value();
    const std::optional<int> areaId = areaSent ? *update.meetingAreaId : std::nullopt;
    std::optional<bool> showArea;
    std::optional<bool> showInterests;
    if (update.privacy) {
        showArea = update.privacy->showMeetingArea;
        showInterests = update.privacy->showInterests;
    }
    const bool interestsSent = update.interests.has_value();
    const auto interests = toArrayLiteral(update.interests.value_or(std::vector<std::string>{}));

    // One statement, so it is atomic and committed before anyone reads it.
    // (Drogon commits multi-statement transactions asynchronously.)
    co_await db_->execSqlCoro(
        R"SQL(
        WITH profile AS (
            UPDATE users SET
                display_name         = COALESCE($2, display_name),
                meeting_area_id      = CASE WHEN $3 THEN $4::int ELSE meeting_area_id END,
                show_meeting_area    = COALESCE($5, show_meeting_area),
                show_interests       = COALESCE($6, show_interests),
                onboarding_completed = COALESCE($7, onboarding_completed),
                updated_at           = now()
            WHERE id = $1::uuid
            RETURNING id
        ), removed AS (
            DELETE FROM user_interests
            WHERE $8 AND user_id = $1::uuid AND category <> ALL($9::text[])
        )
        INSERT INTO user_interests (user_id, category)
        SELECT profile.id, unnest($9::text[]) FROM profile WHERE $8
        ON CONFLICT DO NOTHING
        )SQL",
        userId, update.displayName, areaSent, areaId, showArea, showInterests, update.onboardingCompleted,
        interestsSent, interests);
}

drogon::Task<std::vector<MeetingArea>> PostgresAccountRepository::listMeetingAreas() {
    const auto result = co_await db_->execSqlCoro("SELECT id, name FROM meeting_areas ORDER BY name");
    std::vector<MeetingArea> areas;
    for (const auto& row : result) areas.push_back({row["id"].as<int>(), row["name"].as<std::string>()});
    co_return areas;
}

drogon::Task<void> PostgresAccountRepository::insertResetToken(std::string userId, std::string tokenHash,
                                                               std::chrono::seconds ttl) {
    co_await db_->execSqlCoro(
        "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) "
        "VALUES ($1::uuid, $2, now() + $3::int * interval '1 second')",
        userId, tokenHash, static_cast<int>(ttl.count()));
}

drogon::Task<std::optional<SessionRevocation>> PostgresAccountRepository::consumeResetTokenAndSetPassword(
    std::string tokenHash, std::string newPasswordHash) {
    // One statement: the token is consumed, the user's other tokens are
    // invalidated, the password changes and existing sessions end together,
    // or not at all.
    const auto result = co_await db_->execSqlCoro(
        R"SQL(
        WITH consumed AS (
            UPDATE password_reset_tokens SET used_at = now()
            WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
            RETURNING user_id
        ), others AS (
            UPDATE password_reset_tokens SET used_at = now()
            WHERE user_id IN (SELECT user_id FROM consumed) AND used_at IS NULL AND token_hash <> $1
        ), changed AS (
            UPDATE users SET password_hash = $2, session_version = session_version + 1, updated_at = now()
            WHERE id IN (SELECT user_id FROM consumed)
            RETURNING id, session_version
        )
        SELECT id::text AS id, session_version FROM changed
        )SQL",
        tokenHash, newPasswordHash);
    if (result.size() != 1) co_return std::nullopt;
    co_return SessionRevocation{result[0]["id"].as<std::string>(), result[0]["session_version"].as<std::int64_t>()};
}

drogon::Task<std::optional<std::int64_t>> PostgresAccountRepository::findSessionVersion(std::string userId) {
    const auto result =
        co_await db_->execSqlCoro("SELECT session_version FROM users WHERE id = $1::uuid", userId);
    if (result.empty()) co_return std::nullopt;
    co_return result[0]["session_version"].as<std::int64_t>();
}

drogon::Task<std::optional<SessionRevocation>> PostgresAccountRepository::revokeSessions(
    std::string userId, std::int64_t expectedVersion) {
    const auto result = co_await db_->execSqlCoro(
        "UPDATE users SET session_version = session_version + 1, updated_at = now() "
        "WHERE id = $1::uuid AND session_version = $2::bigint RETURNING session_version",
        userId, expectedVersion);
    if (result.empty()) co_return std::nullopt;
    co_return SessionRevocation{std::move(userId), result[0]["session_version"].as<std::int64_t>()};
}

}  // namespace swapcycle::accounts
