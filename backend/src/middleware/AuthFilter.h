#pragma once

// Verifies login token on protected routes.
//
// The token is issued by the accounts module (accounts::security::issueSessionToken)
// in the httpOnly "sc_session" cookie and checked here with
// accounts::security::verifySessionToken, so both sides share one format.

#include <drogon/HttpFilter.h>

#include <cstdint>
#include <functional>
#include <memory>
#include <string>

// Keys under which AuthFilter stores the logged-in user on the request.
// Later filters and controllers read them with req->attributes()->get<...>(key).
//   kAuthUserIdKey -> std::string (the user's UUID)
//   kAuthRoleKey   -> std::string ("READER" or "MODERATOR", as in openapi.yaml)
inline constexpr const char *kAuthUserIdKey = "auth.userId";
inline constexpr const char *kAuthRoleKey = "auth.role";

// Answers "is this session still current?" for a token whose signature and
// expiry are already valid. Sessions are revoked by raising the user's
// session version (logout, password reset, role change), so a token that
// carries an older version must be refused.
enum class SessionCheck {
  kCurrent,
  kRevoked,  // also used when the user no longer exists
  kError     // the lookup itself failed
};

// Same pattern as ExchangeParticipantChecker: the filter never touches the
// database. The accounts module implements this and registers it once at
// startup with AuthFilter::setSessionValidator(...).
class SessionValidator {
 public:
  virtual ~SessionValidator() = default;

  // Calls done exactly once. May call it from another thread (async DB).
  virtual void check(const std::string &userId, std::int64_t sessionVersion,
                     std::function<void(SessionCheck)> done) const = 0;
};

class AuthFilter : public drogon::HttpFilter<AuthFilter> {
 public:
  // Call once at startup, before the server runs. Until then every request
  // is rejected, so a misconfigured server never lets anyone in.
  static void configure(std::string sessionSecret, std::string cookieName = "sc_session");

  // Call once at startup. Until a validator is registered, versioned tokens
  // are rejected (fail closed). Legacy "v1" tokens carry no version and are
  // accepted on signature and expiry alone until they expire.
  static void setSessionValidator(std::shared_ptr<const SessionValidator> validator);

  void doFilter(const drogon::HttpRequestPtr &req,
                drogon::FilterCallback &&reject,
                drogon::FilterChainCallback &&next) override;
};
