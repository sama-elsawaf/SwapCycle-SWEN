#include "CatalogController.h"

#include <drogon/MultiPart.h>

#include <utility>

#include "common/ApiError.h"
#include "middleware/AuthFilter.h"

namespace swapcycle::catalog {

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

HttpResponsePtr noContent() {
    auto resp = drogon::HttpResponse::newHttpResponse();
    resp->setStatusCode(drogon::k204NoContent);
    return resp;
}

}  // namespace

CatalogController::CatalogController(std::shared_ptr<CatalogService> service) : service_(std::move(service)) {}

drogon::Task<HttpResponsePtr> CatalogController::create(HttpRequestPtr req) {
    try {
        const auto ownerId = currentUserId(req);
        const auto listing = co_await service_->createListing(ownerId, parseBookInput(jsonBody(req)));
        co_return common::dataResponse(toJson(listing), drogon::k201Created);
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> CatalogController::listMine(HttpRequestPtr req) {
    try {
        const auto ownerId = currentUserId(req);
        const int page = parseIntParam(req->getParameter("page"), 1, "page");
        const int pageSize = parseIntParam(req->getParameter("pageSize"), 20, "pageSize");
        const auto listings = co_await service_->listMine(ownerId, page, pageSize);
        co_return common::dataResponse(toJson(listings));
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> CatalogController::getMine(HttpRequestPtr req, std::string copyId) {
    try {
        const auto listing = co_await service_->getOwnListing(currentUserId(req), std::move(copyId));
        co_return common::dataResponse(toJson(listing));
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> CatalogController::get(HttpRequestPtr /*req*/, std::string copyId) {
    try {
        const auto listing = co_await service_->getPublicListing(std::move(copyId));
        co_return common::dataResponse(toJson(listing));
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> CatalogController::update(HttpRequestPtr req, std::string copyId) {
    try {
        const auto ownerId = currentUserId(req);
        const auto listing = co_await service_->updateListing(ownerId, std::move(copyId), parseBookInput(jsonBody(req)));
        co_return common::dataResponse(toJson(listing));
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> CatalogController::remove(HttpRequestPtr req, std::string copyId) {
    try {
        co_await service_->deleteListing(currentUserId(req), std::move(copyId));
        co_return noContent();
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> CatalogController::withdraw(HttpRequestPtr req, std::string copyId) {
    try {
        const auto listing = co_await service_->withdraw(currentUserId(req), std::move(copyId));
        co_return common::dataResponse(toJson(listing));
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> CatalogController::relist(HttpRequestPtr req, std::string copyId) {
    try {
        const auto listing = co_await service_->relist(currentUserId(req), std::move(copyId));
        co_return common::dataResponse(toJson(listing));
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> CatalogController::addPhoto(HttpRequestPtr req, std::string copyId) {
    try {
        const auto ownerId = currentUserId(req);
        drogon::MultiPartParser parser;
        if (parser.parse(req) != 0 || parser.getFiles().size() != 1 || parser.getFiles()[0].getItemName() != "photo") {
            throw ApiError(ErrorCode::ValidationFailed, "Send exactly one file in the 'photo' field.");
        }
        std::string bytes(parser.getFiles()[0].fileContent());
        const auto photo = co_await service_->addPhoto(ownerId, std::move(copyId), std::move(bytes));
        co_return common::dataResponse(toJson(photo), drogon::k201Created);
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> CatalogController::deletePhoto(HttpRequestPtr req, std::string copyId,
                                                             std::string photoId) {
    try {
        co_await service_->deletePhoto(currentUserId(req), std::move(copyId), std::move(photoId));
        co_return noContent();
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> CatalogController::photo(HttpRequestPtr /*req*/, std::string photoId) {
    try {
        const auto file = co_await service_->getPhotoFile(std::move(photoId));
        const auto type = file.contentType == "image/png" ? drogon::CT_IMAGE_PNG : drogon::CT_IMAGE_JPG;
        auto resp = drogon::HttpResponse::newFileResponse(file.path, "", type);
        resp->addHeader("Cache-Control", "private, max-age=3600");
        co_return resp;
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

}  // namespace swapcycle::catalog
