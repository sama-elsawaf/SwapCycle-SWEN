#pragma once

// HTTP endpoints for the wishlist_search module: /api/wishlist/*, /api/search/books.

#include <drogon/HttpController.h>

#include <memory>
#include <string>

#include "WishlistSearchService.h"

#ifndef SWAPCYCLE_UUID_RE
#define SWAPCYCLE_UUID_RE "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
#endif

namespace swapcycle::wishlist_search {

class WishlistSearchController final : public drogon::HttpController<WishlistSearchController, false> {
public:
    explicit WishlistSearchController(std::shared_ptr<WishlistSearchService> service);

    METHOD_LIST_BEGIN
    ADD_METHOD_TO(WishlistSearchController::list, "/api/wishlist", drogon::Get, "AuthFilter");
    ADD_METHOD_TO(WishlistSearchController::add, "/api/wishlist", drogon::Post, "AuthFilter");
    ADD_METHOD_VIA_REGEX(WishlistSearchController::remove, "/api/wishlist/(" SWAPCYCLE_UUID_RE ")", drogon::Delete,
                         "AuthFilter");
    ADD_METHOD_VIA_REGEX(WishlistSearchController::update, "/api/wishlist/(" SWAPCYCLE_UUID_RE ")", drogon::Patch,
                         "AuthFilter");
    ADD_METHOD_TO(WishlistSearchController::searchBooks, "/api/search/books", drogon::Get);
    METHOD_LIST_END

    drogon::Task<drogon::HttpResponsePtr> list(drogon::HttpRequestPtr req);
    drogon::Task<drogon::HttpResponsePtr> add(drogon::HttpRequestPtr req);
    drogon::Task<drogon::HttpResponsePtr> remove(drogon::HttpRequestPtr req, std::string wishItemId);
    drogon::Task<drogon::HttpResponsePtr> update(drogon::HttpRequestPtr req, std::string wishItemId);
    drogon::Task<drogon::HttpResponsePtr> searchBooks(drogon::HttpRequestPtr req);

private:
    std::shared_ptr<WishlistSearchService> service_;
};

}  // namespace swapcycle::wishlist_search
