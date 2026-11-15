#pragma once

// Business rules for the wishlist_search module: wish list entries and book search.

#include <drogon/utils/coroutine.h>

#include <memory>
#include <string>
#include <vector>

#include "WishlistSearchRepository.h"
#include "WishlistSearchTypes.h"
#include "modules/catalog/CatalogService.h"

namespace swapcycle::wishlist_search {

class WishlistSearchService {
public:
    WishlistSearchService(std::shared_ptr<WishlistSearchRepository> repository,
                          std::shared_ptr<catalog::CatalogService> catalog);

    drogon::Task<std::vector<WishItem>> listWishItems(std::string userId);
    drogon::Task<WishItem> addWishItem(std::string userId, WishItemInput input);
    drogon::Task<void> removeWishItem(std::string userId, std::string wishItemId);
    // Change the priority and/or mark the entry found ("Got it") or still wanted.
    drogon::Task<WishItem> updateWishItem(std::string userId, std::string wishItemId, WishItemUpdate update);

    // Search reads listings through CatalogService, never the catalog tables.
    drogon::Task<catalog::Page<catalog::ListingView>> searchBooks(catalog::SearchFilters filters);

    // Throws common::ApiError (VALIDATION_FAILED) if the entry breaks a rule.
    static WishItemInput validated(WishItemInput input);

private:
    std::shared_ptr<WishlistSearchRepository> repository_;
    std::shared_ptr<catalog::CatalogService> catalog_;
};

}  // namespace swapcycle::wishlist_search
