#include "WishlistSearchTypes.h"

#include "common/ApiError.h"

namespace swapcycle::wishlist_search {

namespace {

using common::ApiError;
using common::ErrorCode;

std::optional<std::string> optionalString(const Json::Value& body, const char* field) {
    if (!body.isMember(field) || body[field].isNull()) return std::nullopt;
    if (!body[field].isString()) {
        throw ApiError(ErrorCode::ValidationFailed, std::string("Field '") + field + "' must be text.");
    }
    return body[field].asString();
}

Json::Value toJson(const std::optional<std::string>& value) {
    return value ? Json::Value(*value) : Json::Value(Json::nullValue);
}

}  // namespace

bool isPriority(std::string_view value) {
    return value == priority_level::kHigh || value == priority_level::kMedium || value == priority_level::kLow;
}

Json::Value toJson(const WishItem& item) {
    Json::Value json;
    json["id"] = item.id;
    json["kind"] = item.details.kind;
    json["title"] = toJson(item.details.title);
    json["author"] = toJson(item.details.author);
    json["genre"] = toJson(item.details.genre);
    json["language"] = toJson(item.details.language);
    json["minCondition"] = toJson(item.details.minCondition);
    json["priority"] = item.details.priority;
    json["fulfilled"] = item.fulfilledAt.has_value();
    json["fulfilledAt"] = toJson(item.fulfilledAt);
    json["createdAt"] = item.createdAt;
    return json;
}

WishItemInput parseWishItemInput(const Json::Value& body) {
    if (!body.isObject()) throw ApiError(ErrorCode::ValidationFailed, "Expected a JSON object body.");
    WishItemInput input;
    input.kind = optionalString(body, "kind").value_or("");
    input.title = optionalString(body, "title");
    input.author = optionalString(body, "author");
    input.genre = optionalString(body, "genre");
    input.language = optionalString(body, "language");
    input.minCondition = optionalString(body, "minCondition");
    input.priority = optionalString(body, "priority").value_or(std::string(priority_level::kMedium));
    return input;
}

WishItemUpdate parseWishItemUpdate(const Json::Value& body) {
    if (!body.isObject()) throw ApiError(ErrorCode::ValidationFailed, "Expected a JSON object body.");
    WishItemUpdate update;
    update.priority = optionalString(body, "priority");
    if (body.isMember("fulfilled") && !body["fulfilled"].isNull()) {
        if (!body["fulfilled"].isBool()) {
            throw ApiError(ErrorCode::ValidationFailed, "Field 'fulfilled' must be true or false.");
        }
        update.fulfilled = body["fulfilled"].asBool();
    }
    if (!update.priority && !update.fulfilled) {
        throw ApiError(ErrorCode::ValidationFailed, "Send a priority, fulfilled, or both.");
    }
    return update;
}

}  // namespace swapcycle::wishlist_search
