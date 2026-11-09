// SwapCycle backend entry point: reads configuration from the environment,
// wires repositories -> services -> controllers, and sets global HTTP policy
// (security headers, CORS, JSON 404s).

#include <drogon/drogon.h>

#include <cstddef>
#include <cstdlib>
#include <filesystem>
#include <iostream>
#include <memory>
#include <string>

#include "common/ApiError.h"
#include "common/Config.h"
#include "middleware/AuthFilter.h"
#include "modules/accounts/AccountController.h"
#include "modules/accounts/AccountSecurity.h"
#include "modules/catalog/CatalogController.h"
#include "modules/wishlist_search/WishlistSearchController.h"

namespace {

using namespace swapcycle;

void addCorsHeaders(const drogon::HttpRequestPtr& req, const drogon::HttpResponsePtr& resp,
                    const std::string& allowedOrigin) {
    if (allowedOrigin.empty() || req->getHeader("Origin") != allowedOrigin) return;
    resp->addHeader("Access-Control-Allow-Origin", allowedOrigin);
    resp->addHeader("Access-Control-Allow-Credentials", "true");
    resp->addHeader("Vary", "Origin");
}

void installHttpPolicy(const std::string& allowedOrigin) {
    auto& app = drogon::app();

    // CORS pre-flight, only for the known frontend origin.
    app.registerSyncAdvice([allowedOrigin](const drogon::HttpRequestPtr& req) -> drogon::HttpResponsePtr {
        if (req->method() != drogon::Options) return nullptr;
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k204NoContent);
        addCorsHeaders(req, resp, allowedOrigin);
        resp->addHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE");
        resp->addHeader("Access-Control-Allow-Headers", "Content-Type");
        return resp;
    });

    app.registerPostHandlingAdvice(
        [allowedOrigin](const drogon::HttpRequestPtr& req, const drogon::HttpResponsePtr& resp) {
            resp->addHeader("X-Content-Type-Options", "nosniff");
            resp->addHeader("X-Frame-Options", "DENY");
            resp->addHeader("Referrer-Policy", "strict-origin-when-cross-origin");
            resp->addHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
            addCorsHeaders(req, resp, allowedOrigin);
        });

    app.setCustom404Page(common::errorResponse(common::ApiError(common::ErrorCode::NotFound, "Not found.")));
}

}  // namespace

int main() {
    if (!accounts::security::initialise()) {
        std::cerr << "libsodium failed to initialise\n";
        return EXIT_FAILURE;
    }

    // Reads and checks every setting at once; never prints secret values.
    common::AppConfig config;
    try {
        config = common::loadAppConfig();
    } catch (const common::ConfigError& error) {
        std::cerr << error.what() << "\n(see .env.example)\n";
        return EXIT_FAILURE;
    }

    accounts::AccountSettings accountSettings;
    accountSettings.sessionSecret = config.sessionSecret;
    accounts::SessionCookieSettings cookie;
    cookie.secure = config.cookieSecure;
    // The filter verifies exactly the tokens and cookie the accounts module issues.
    AuthFilter::configure(config.sessionSecret, cookie.name);

    const auto db = drogon::orm::DbClient::newPgClient(config.databaseUrl, static_cast<size_t>(config.dbPoolSize));

    auto accountService = std::make_shared<accounts::AccountService>(
        std::make_shared<accounts::PostgresAccountRepository>(db), accountSettings);
    auto catalogService = std::make_shared<catalog::CatalogService>(
        std::make_shared<catalog::PostgresCatalogRepository>(db),
        std::make_shared<catalog::FilePhotoStore>(config.uploadDir + "/books"), accountService);
    auto wishlistService = std::make_shared<wishlist_search::WishlistSearchService>(
        std::make_shared<wishlist_search::PostgresWishlistSearchRepository>(db), catalogService);

    auto& app = drogon::app();
    if (std::filesystem::exists(config.drogonConfig)) {
        app.loadConfigFile(config.drogonConfig);
    } else {
        std::cerr << "Config file " << config.drogonConfig << " not found; using Drogon defaults\n";
    }
    app.registerController(std::make_shared<accounts::AccountController>(accountService, cookie));
    app.registerController(std::make_shared<catalog::CatalogController>(catalogService));
    app.registerController(std::make_shared<wishlist_search::WishlistSearchController>(wishlistService));

    installHttpPolicy(config.frontendOrigin);

    // Threads, body-size limits, logging and static-file policy come from config.json.
    app.addListener("0.0.0.0", static_cast<uint16_t>(config.port)).run();
    return EXIT_SUCCESS;
}
