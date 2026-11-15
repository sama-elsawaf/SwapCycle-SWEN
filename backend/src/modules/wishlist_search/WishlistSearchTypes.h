#pragma once

// Data types for the wishlist_search module.

#include <json/json.h>

#include <optional>
#include <string>
#include <string_view>

namespace swapcycle::wishlist_search {

namespace kind {
inline constexpr std::string_view kTitle = "TITLE";        // A specific book.
inline constexpr std::string_view kInterest = "INTEREST";  // A broader interest (genre).
}  // namespace kind

namespace priority_level {
inline constexpr std::string_view kHigh = "HIGH";
inline constexpr std::string_view kMedium = "MEDIUM";  // Default for new and existing entries.
inline constexpr std::string_view kLow = "LOW";
}  // namespace priority_level

bool isPriority(std::string_view value);

inline constexpr std::size_t kMaxWishItemsPerUser = 100;

struct WishItemInput {
    std::string kind;
    std::optional<std::string> title;
    std::optional<std::string> author;
    std::optional<std::string> genre;
    std::optional<std::string> language;
    std::optional<std::string> minCondition;
    std::string priority{priority_level::kMedium};
};

// PATCH /wishlist/{id}: change the priority and/or tick "Got it". At least one is set.
struct WishItemUpdate {
    std::optional<std::string> priority;
    std::optional<bool> fulfilled;
};

struct WishItem {
    std::string id;
    WishItemInput details;
    std::string createdAt;
    // Set when the reader marked the entry "Got it"; empty while still looking.
    std::optional<std::string> fulfilledAt;
};

Json::Value toJson(const WishItem& item);

// Parses a POST /wishlist body. Throws common::ApiError for wrong JSON types;
// value rules are checked by WishlistSearchService.
WishItemInput parseWishItemInput(const Json::Value& body);

// Parses a PATCH /wishlist/{id} body ({ "priority"?, "fulfilled"? }). Throws
// common::ApiError for wrong JSON types or an empty update.
WishItemUpdate parseWishItemUpdate(const Json::Value& body);

}  // namespace swapcycle::wishlist_search
