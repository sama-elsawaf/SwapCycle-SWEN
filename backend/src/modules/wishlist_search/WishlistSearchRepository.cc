#include "WishlistSearchRepository.h"

#include <utility>

namespace swapcycle::wishlist_search {

namespace {

using drogon::orm::Row;

constexpr const char* kColumns =
    "id::text AS id, kind, title, author, genre, language, min_condition, priority, "
    "to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at, "
    "to_char(fulfilled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS fulfilled_at";

// Still wanted before found; then HIGH, MEDIUM, LOW; then newest. Found entries: most recently found first.
constexpr const char* kListOrder =
    " ORDER BY (fulfilled_at IS NOT NULL), "
    "CASE WHEN fulfilled_at IS NULL THEN CASE priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END END, "
    "fulfilled_at DESC NULLS LAST, created_at DESC, id";

std::optional<std::string> nullableString(const Row& row, const char* column) {
    if (row[column].isNull()) return std::nullopt;
    return row[column].as<std::string>();
}

WishItem itemFromRow(const Row& row) {
    WishItem item;
    item.id = row["id"].as<std::string>();
    item.details.kind = row["kind"].as<std::string>();
    item.details.title = nullableString(row, "title");
    item.details.author = nullableString(row, "author");
    item.details.genre = nullableString(row, "genre");
    item.details.language = nullableString(row, "language");
    item.details.minCondition = nullableString(row, "min_condition");
    item.details.priority = row["priority"].as<std::string>();
    item.createdAt = row["created_at"].as<std::string>();
    item.fulfilledAt = nullableString(row, "fulfilled_at");
    return item;
}

}  // namespace

PostgresWishlistSearchRepository::PostgresWishlistSearchRepository(drogon::orm::DbClientPtr db)
    : db_(std::move(db)) {}

drogon::Task<std::vector<WishItem>> PostgresWishlistSearchRepository::listForUser(std::string userId) {
    const auto result = co_await db_->execSqlCoro(
        std::string("SELECT ") + kColumns + " FROM wish_items WHERE user_id = $1::uuid" + kListOrder, userId);
    std::vector<WishItem> items;
    for (const auto& row : result) items.push_back(itemFromRow(row));
    co_return items;
}

drogon::Task<std::int64_t> PostgresWishlistSearchRepository::countForUser(std::string userId) {
    const auto result =
        co_await db_->execSqlCoro("SELECT count(*) AS total FROM wish_items WHERE user_id = $1::uuid", userId);
    co_return result[0]["total"].as<std::int64_t>();
}

drogon::Task<std::optional<WishItem>> PostgresWishlistSearchRepository::insert(std::string userId,
                                                                              WishItemInput input) {
    const auto result = co_await db_->execSqlCoro(
        std::string("INSERT INTO wish_items (user_id, kind, title, author, genre, language, min_condition, priority) "
                    "VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING RETURNING ") +
            kColumns,
        userId, input.kind, input.title, input.author, input.genre, input.language, input.minCondition,
        input.priority);
    if (result.empty()) co_return std::nullopt;
    co_return itemFromRow(result[0]);
}

drogon::Task<bool> PostgresWishlistSearchRepository::deleteForUser(std::string userId, std::string wishItemId) {
    const auto result = co_await db_->execSqlCoro(
        "DELETE FROM wish_items WHERE id = $1::uuid AND user_id = $2::uuid", wishItemId, userId);
    co_return result.affectedRows() == 1;
}

drogon::Task<std::optional<WishItem>> PostgresWishlistSearchRepository::updateForUser(std::string userId,
                                                                                     std::string wishItemId,
                                                                                     WishItemUpdate update) {
    // NULL parameters leave a field unchanged. "fulfilled" is sent as text so
    // no boolean binary binding is involved.
    std::optional<std::string> fulfilled;
    if (update.fulfilled) fulfilled = *update.fulfilled ? "true" : "false";
    const auto result = co_await db_->execSqlCoro(
        std::string("UPDATE wish_items SET "
                    "priority = COALESCE($3, priority), "
                    "fulfilled_at = CASE WHEN $4::text IS NULL THEN fulfilled_at "
                    "WHEN $4::text = 'true' THEN COALESCE(fulfilled_at, now()) ELSE NULL END "
                    "WHERE id = $1::uuid AND user_id = $2::uuid RETURNING ") +
            kColumns,
        wishItemId, userId, update.priority, fulfilled);
    if (result.empty()) co_return std::nullopt;
    co_return itemFromRow(result[0]);
}

}  // namespace swapcycle::wishlist_search
