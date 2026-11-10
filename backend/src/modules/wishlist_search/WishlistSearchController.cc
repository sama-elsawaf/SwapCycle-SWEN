#include "WishlistSearchController.h"

#include <utility>

#include "common/ApiError.h"
#include "middleware/AuthFilter.h"

namespace swapcycle::wishlist_search {

namespace {

using common::ApiError;
using common::ErrorCode;
using drogon::HttpRequestPtr;
using drogon::HttpResponsePtr;

// Set by AuthFilter after it verifies the session cookie.
std::string currentUserId(const HttpRequestPtr& req) {
    const auto& attributes = req->attributes();
    if (!attributes->find(kAuthUserIdKey)) throw ApiError(ErrorCode::Unauthorized, "Please log in.");
    return attributes->get<std::string>(kAuthUserIdKey);
}

catalog::SearchFilters filtersFrom(const HttpRequestPtr& req) {
    catalog::SearchFilters filters;
    filters.query = req->getParameter("q");
    filters.title = req->getParameter("title");
    filters.author = req->getParameter("author");
    filters.genre = req->getParameter("genre");
    filters.language = req->getParameter("language");
    const auto minCondition = req->getParameter("minCondition");
    if (!minCondition.empty()) {
        const auto rank = catalog::conditionRank(minCondition);
        if (!rank) throw ApiError(ErrorCode::ValidationFailed, "Unknown condition.");
        filters.minConditionRank = *rank;
    }
    filters.areaId = catalog::parseIntParam(req->getParameter("areaId"), 0, "areaId");
    filters.page = catalog::parseIntParam(req->getParameter("page"), 1, "page");
    filters.pageSize = catalog::parseIntParam(req->getParameter("pageSize"), 20, "pageSize");
    return filters;
}

// jsoncpp throws when input is nested deeper than its stack limit; that is bad
// input (400), not a server fault (500).
const Json::Value& jsonBody(const HttpRequestPtr& req) {
    const Json::Value* json = nullptr;
    try {
        json = req->getJsonObject().get();
    } catch (const Json::Exception&) {
        json = nullptr;
    }
    if (!json || !json->isObject()) throw ApiError(ErrorCode::ValidationFailed, "Expected a JSON object body.");
    return *json;
}

}  // namespace

WishlistSearchController::WishlistSearchController(std::shared_ptr<WishlistSearchService> service)
    : service_(std::move(service)) {}

drogon::Task<HttpResponsePtr> WishlistSearchController::list(HttpRequestPtr req) {
    try {
        const auto items = co_await service_->listWishItems(currentUserId(req));
        Json::Value data(Json::arrayValue);
        for (const auto& item : items) data.append(toJson(item));
        co_return common::dataResponse(data);
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> WishlistSearchController::add(HttpRequestPtr req) {
    try {
        const auto userId = currentUserId(req);
        const auto item = co_await service_->addWishItem(userId, parseWishItemInput(jsonBody(req)));
        co_return common::dataResponse(toJson(item), drogon::k201Created);
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> WishlistSearchController::remove(HttpRequestPtr req, std::string wishItemId) {
    try {
        co_await service_->removeWishItem(currentUserId(req), std::move(wishItemId));
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k204NoContent);
        co_return resp;
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> WishlistSearchController::searchBooks(HttpRequestPtr req) {
    try {
        const auto results = co_await service_->searchBooks(filtersFrom(req));
        co_return common::dataResponse(catalog::toJson(results));
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

}  // namespace swapcycle::wishlist_search
