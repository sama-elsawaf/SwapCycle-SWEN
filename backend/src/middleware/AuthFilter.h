#pragma once

// Verifies login token on protected routes.
//
// The token is issued by the accounts module (accounts::security::issueSessionToken)
// in the httpOnly "sc_session" cookie and checked here with
// accounts::security::verifySessionToken, so both sides share one format.

#include <drogon/HttpFilter.h>

#include <string>

// Keys under which AuthFilter stores the logged-in user on the request.
// Later filters and controllers read them with req->attributes()->get<...>(key).
//   kAuthUserIdKey -> std::string (the user's UUID)
//   kAuthRoleKey   -> std::string ("READER" or "MODERATOR", as in openapi.yaml)
inline constexpr const char *kAuthUserIdKey = "auth.userId";
inline constexpr const char *kAuthRoleKey = "auth.role";

class AuthFilter : public drogon::HttpFilter<AuthFilter> {
 public:
  // Call once at startup, before the server runs. Until then every request
  // is rejected, so a misconfigured server never lets anyone in.
  static void configure(std::string sessionSecret, std::string cookieName = "sc_session");

  void doFilter(const drogon::HttpRequestPtr &req,
                drogon::FilterCallback &&reject,
                drogon::FilterChainCallback &&next) override;
};
