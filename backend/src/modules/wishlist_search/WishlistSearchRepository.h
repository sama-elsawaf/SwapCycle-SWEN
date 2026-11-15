#pragma once

// Database access for the wishlist_search module. The only code that touches
// the wish_items table. Book search goes through CatalogService instead.

#include <drogon/orm/DbClient.h>
#include <drogon/utils/coroutine.h>

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include "WishlistSearchTypes.h"

namespace swapcycle::wishlist_search {

class WishlistSearchRepository {
public:
    virtual ~WishlistSearchRepository() = default;

    // Entries still wanted first (HIGH, MEDIUM, LOW, then newest), then found ones (most recently found first).
    virtual drogon::Task<std::vector<WishItem>> listForUser(std::string userId) = 0;
    virtual drogon::Task<std::int64_t> countForUser(std::string userId) = 0;
    // Returns nullopt if the same entry is already on the user's list.
    virtual drogon::Task<std::optional<WishItem>> insert(std::string userId, WishItemInput input) = 0;
    // Only deletes the user's own entry. Returns false if there was none.
    virtual drogon::Task<bool> deleteForUser(std::string userId, std::string wishItemId) = 0;
    // Only updates the user's own entry. Returns nullopt if there was none.
    // Ticking an already-found entry keeps its original fulfilled time.
    virtual drogon::Task<std::optional<WishItem>> updateForUser(std::string userId, std::string wishItemId,
                                                                WishItemUpdate update) = 0;
};

class PostgresWishlistSearchRepository final : public WishlistSearchRepository {
public:
    explicit PostgresWishlistSearchRepository(drogon::orm::DbClientPtr db);

    drogon::Task<std::vector<WishItem>> listForUser(std::string userId) override;
    drogon::Task<std::int64_t> countForUser(std::string userId) override;
    drogon::Task<std::optional<WishItem>> insert(std::string userId, WishItemInput input) override;
    drogon::Task<bool> deleteForUser(std::string userId, std::string wishItemId) override;
    drogon::Task<std::optional<WishItem>> updateForUser(std::string userId, std::string wishItemId,
                                                        WishItemUpdate update) override;

private:
    drogon::orm::DbClientPtr db_;
};

}  // namespace swapcycle::wishlist_search
