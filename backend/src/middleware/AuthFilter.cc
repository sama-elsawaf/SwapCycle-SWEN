#include "AuthFilter.h"

#include <trantor/utils/Logger.h>

#include <chrono>
#include <cstdint>
#include <mutex>
#include <string>
#include <utility>

#include "common/ApiError.h"
#include "modules/accounts/AccountSecurity.h"

namespace {

struct Settings {
  std::string secret;
  std::string cookieName = "sc_session";
};

std::mutex settingsMutex;
Settings settings;

Settings currentSettings() {
  std::lock_guard<std::mutex> lock(settingsMutex);
  return settings;
}

std::int64_t nowSeconds() {
  using namespace std::chrono;
  return duration_cast<seconds>(system_clock::now().time_since_epoch()).count();
}

// Same generic message for every failure so nobody can tell why it failed.
void respondUnauthenticated(const drogon::FilterCallback &reject) {
  reject(swapcycle::common::errorResponse(swapcycle::common::ApiError(
      swapcycle::common::ErrorCode::Unauthorized, "Please log in to continue.")));
}

}  // namespace

void AuthFilter::configure(std::string sessionSecret, std::string cookieName) {
  std::lock_guard<std::mutex> lock(settingsMutex);
  settings.secret = std::move(sessionSecret);
  settings.cookieName = std::move(cookieName);
}

void AuthFilter::doFilter(const drogon::HttpRequestPtr &req,
                          drogon::FilterCallback &&reject,
                          drogon::FilterChainCallback &&next) {
  const auto current = currentSettings();
  if (current.secret.empty()) {
    LOG_ERROR << "AuthFilter used before AuthFilter::configure(); rejecting all logins";
    respondUnauthenticated(reject);
    return;
  }

  const std::string token = req->getCookie(current.cookieName);
  if (token.empty()) {
    respondUnauthenticated(reject);
    return;
  }

  // Checks the HMAC signature in constant time, the format and the expiry.
  const auto claims =
      swapcycle::accounts::security::verifySessionToken(token, current.secret, nowSeconds());
  if (!claims) {
    respondUnauthenticated(reject);
    return;
  }

  req->attributes()->insert(kAuthUserIdKey, claims->userId);
  req->attributes()->insert(kAuthRoleKey, std::string(swapcycle::accounts::toString(claims->role)));
  next();
}
