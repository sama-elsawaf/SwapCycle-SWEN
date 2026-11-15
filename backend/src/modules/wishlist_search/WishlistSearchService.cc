#include "WishlistSearchService.h"

#include <utility>

#include "common/ApiError.h"

namespace swapcycle::wishlist_search {

namespace {

using common::ApiError;
using common::ErrorCode;

[[noreturn]] void invalid(const std::string& message) {
    throw ApiError(ErrorCode::ValidationFailed, message);
}

}  // namespace

WishlistSearchService::WishlistSearchService(std::shared_ptr<WishlistSearchRepository> repository,
                                             std::shared_ptr<catalog::CatalogService> catalog)
    : repository_(std::move(repository)), catalog_(std::move(catalog)) {}

WishItemInput WishlistSearchService::validated(WishItemInput input) {
    if (input.kind == kind::kTitle) {
        if (!input.title) invalid("Enter the title you are looking for.");
        input.title = catalog::validText(*input.title, "Title", 1, 200);
        if (input.author) input.author = catalog::validText(*input.author, "Author", 1, 120);
    } else if (input.kind == kind::kInterest) {
        if (input.title || input.author) invalid("An interest entry has a genre, not a title or author.");
        if (!input.genre) invalid("Choose a genre.");
    } else {
        invalid("Kind must be TITLE or INTEREST.");
    }

    if (input.genre && !catalog::isGenre(*input.genre)) invalid("Unknown genre.");
    if (input.language && !catalog::isLanguageCode(*input.language)) {
        invalid("Language must be a two-letter code such as 'en'.");
    }
    if (input.minCondition && !catalog::conditionRank(*input.minCondition)) invalid("Unknown condition.");
    if (!isPriority(input.priority)) invalid("Priority must be HIGH, MEDIUM or LOW.");
    return input;
}

drogon::Task<std::vector<WishItem>> WishlistSearchService::listWishItems(std::string userId) {
    co_return co_await repository_->listForUser(std::move(userId));
}

drogon::Task<WishItem> WishlistSearchService::addWishItem(std::string userId, WishItemInput input) {
    auto valid = validated(std::move(input));
    const auto count = co_await repository_->countForUser(userId);
    if (count >= static_cast<std::int64_t>(kMaxWishItemsPerUser)) {
        throw ApiError(ErrorCode::Conflict, "Your wish list is full (100 entries). Remove one to add another.");
    }
    auto item = co_await repository_->insert(std::move(userId), std::move(valid));
    if (!item) throw ApiError(ErrorCode::Conflict, "This is already on your wish list.");
    co_return std::move(*item);
}

drogon::Task<void> WishlistSearchService::removeWishItem(std::string userId, std::string wishItemId) {
    const bool removed = co_await repository_->deleteForUser(std::move(userId), std::move(wishItemId));
    if (!removed) throw ApiError(ErrorCode::NotFound, "Wish list entry not found.");
}

drogon::Task<WishItem> WishlistSearchService::updateWishItem(std::string userId, std::string wishItemId,
                                                            WishItemUpdate update) {
    if (!update.priority && !update.fulfilled) invalid("Send a priority, fulfilled, or both.");
    if (update.priority && !isPriority(*update.priority)) invalid("Priority must be HIGH, MEDIUM or LOW.");
    auto item = co_await repository_->updateForUser(std::move(userId), std::move(wishItemId), std::move(update));
    if (!item) throw ApiError(ErrorCode::NotFound, "Wish list entry not found.");
    co_return std::move(*item);
}

drogon::Task<catalog::Page<catalog::ListingView>> WishlistSearchService::searchBooks(catalog::SearchFilters filters) {
    co_return co_await catalog_->search(std::move(filters));
}

}  // namespace swapcycle::wishlist_search
