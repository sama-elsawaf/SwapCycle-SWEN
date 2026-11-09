#include "AccountController.h"

#include <algorithm>
#include <utility>

#include "common/ApiError.h"
#include "middleware/AuthFilter.h"

namespace swapcycle::accounts {

namespace {

using common::ApiError;
using common::ErrorCode;
using drogon::HttpRequestPtr;
using drogon::HttpResponsePtr;

const Json::Value& jsonBody(const HttpRequestPtr& req) {
    const auto& json = req->getJsonObject();
    if (!json || !json->isObject()) throw ApiError(ErrorCode::ValidationFailed, "Expected a JSON object body.");
    return *json;
}

std::string stringField(const Json::Value& body, const char* field) {
    if (!body[field].isString()) {
        throw ApiError(ErrorCode::ValidationFailed, std::string("Field '") + field + "' is required.");
    }
    return body[field].asString();
}

// Set by AuthFilter after it verifies the session cookie.
std::string currentUserId(const HttpRequestPtr& req) {
    const auto& attributes = req->attributes();
    if (!attributes->find(kAuthUserIdKey)) throw ApiError(ErrorCode::Unauthorized, "Please log in.");
    return attributes->get<std::string>(kAuthUserIdKey);
}

void enforceLimit(RateLimiter& limiter, const std::string& key) {
    if (limiter.hit(key).count() > 0) {
        throw ApiError(ErrorCode::RateLimited, "Too many attempts. Please wait and try again.");
    }
}

HttpResponsePtr rateLimitAware(const std::exception& error, RateLimiter& limiter, const std::string& key) {
    auto resp = common::errorResponse(error);
    if (const auto* apiError = dynamic_cast<const ApiError*>(&error);
        apiError && apiError->code() == ErrorCode::RateLimited) {
        resp->addHeader("Retry-After", std::to_string(std::max<long long>(1, limiter.hit(key).count())));
    }
    return resp;
}

HttpResponsePtr noContent() {
    auto resp = drogon::HttpResponse::newHttpResponse();
    resp->setStatusCode(drogon::k204NoContent);
    return resp;
}

}  // namespace

AccountController::AccountController(std::shared_ptr<AccountService> service, SessionCookieSettings cookie)
    : service_(std::move(service)),
      cookie_(std::move(cookie)),
      registerPerIp_(10, std::chrono::hours(1)),
      loginPerIp_(30, std::chrono::minutes(15)),
      loginPerEmail_(5, std::chrono::minutes(15)),
      resetPerIp_(5, std::chrono::hours(1)) {}

void AccountController::setSessionCookie(const HttpResponsePtr& resp, const Session& session) const {
    drogon::Cookie cookie(cookie_.name, session.token);
    cookie.setHttpOnly(true);
    cookie.setSecure(cookie_.secure);
    cookie.setSameSite(drogon::Cookie::SameSite::kLax);
    cookie.setPath("/api");
    cookie.setMaxAge(static_cast<int>(session.ttl.count()));
    resp->addCookie(cookie);
}

drogon::Task<HttpResponsePtr> AccountController::registerUser(HttpRequestPtr req) {
    const auto ipKey = req->peerAddr().toIp();
    try {
        enforceLimit(registerPerIp_, ipKey);
        const auto& body = jsonBody(req);
        const auto session = co_await service_->registerUser(stringField(body, "email"), stringField(body, "password"),
                                                             stringField(body, "displayName"));
        auto resp = common::dataResponse(toCurrentUserJson(session.user), drogon::k201Created);
        setSessionCookie(resp, session);
        co_return resp;
    } catch (const std::exception& error) {
        co_return rateLimitAware(error, registerPerIp_, ipKey);
    }
}

drogon::Task<HttpResponsePtr> AccountController::login(HttpRequestPtr req) {
    const auto ipKey = req->peerAddr().toIp();
    std::string emailKey;
    try {
        enforceLimit(loginPerIp_, ipKey);
        const auto& body = jsonBody(req);
        const auto email = stringField(body, "email");
        emailKey = AccountService::normaliseEmail(email);
        enforceLimit(loginPerEmail_, emailKey);

        const auto session = co_await service_->login(email, stringField(body, "password"));
        loginPerEmail_.reset(emailKey);
        auto resp = common::dataResponse(toCurrentUserJson(session.user));
        setSessionCookie(resp, session);
        co_return resp;
    } catch (const std::exception& error) {
        co_return rateLimitAware(error, emailKey.empty() ? loginPerIp_ : loginPerEmail_,
                                 emailKey.empty() ? ipKey : emailKey);
    }
}

drogon::Task<HttpResponsePtr> AccountController::logout(HttpRequestPtr /*req*/) {
    auto resp = noContent();
    drogon::Cookie cookie(cookie_.name, "");
    cookie.setHttpOnly(true);
    cookie.setSecure(cookie_.secure);
    cookie.setSameSite(drogon::Cookie::SameSite::kLax);
    cookie.setPath("/api");
    cookie.setMaxAge(0);
    resp->addCookie(cookie);
    co_return resp;
}

drogon::Task<HttpResponsePtr> AccountController::me(HttpRequestPtr req) {
    try {
        const auto user = co_await service_->getCurrentUser(currentUserId(req));
        co_return common::dataResponse(toCurrentUserJson(user));
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> AccountController::requestPasswordReset(HttpRequestPtr req) {
    const auto ipKey = req->peerAddr().toIp();
    try {
        enforceLimit(resetPerIp_, ipKey);
        co_await service_->requestPasswordReset(stringField(jsonBody(req), "email"));
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k202Accepted);
        co_return resp;
    } catch (const std::exception& error) {
        co_return rateLimitAware(error, resetPerIp_, ipKey);
    }
}

drogon::Task<HttpResponsePtr> AccountController::confirmPasswordReset(HttpRequestPtr req) {
    const auto ipKey = req->peerAddr().toIp();
    try {
        enforceLimit(resetPerIp_, ipKey);
        const auto& body = jsonBody(req);
        co_await service_->confirmPasswordReset(stringField(body, "token"), stringField(body, "newPassword"));
        co_return noContent();
    } catch (const std::exception& error) {
        co_return rateLimitAware(error, resetPerIp_, ipKey);
    }
}

drogon::Task<HttpResponsePtr> AccountController::meetingAreas(HttpRequestPtr /*req*/) {
    try {
        const auto areas = co_await service_->listMeetingAreas();
        Json::Value data(Json::arrayValue);
        for (const auto& area : areas) data.append(toJson(area));
        co_return common::dataResponse(data);
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> AccountController::updateProfile(HttpRequestPtr req) {
    try {
        const auto userId = currentUserId(req);
        const auto user = co_await service_->updateProfile(userId, parseProfileUpdate(jsonBody(req)));
        co_return common::dataResponse(toCurrentUserJson(user));
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

drogon::Task<HttpResponsePtr> AccountController::publicProfile(HttpRequestPtr req, std::string userId) {
    try {
        currentUserId(req);
        const auto profile = co_await service_->getPublicProfile(std::move(userId));
        co_return common::dataResponse(toJson(profile));
    } catch (const std::exception& error) {
        co_return common::errorResponse(error);
    }
}

}  // namespace swapcycle::accounts
