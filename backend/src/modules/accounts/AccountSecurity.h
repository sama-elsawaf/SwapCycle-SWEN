#pragma once

// Password hashing (argon2id), signed session tokens and reset tokens.
// Built on libsodium; call initialise() once at start-up.

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>

#include "AccountTypes.h"

namespace swapcycle::accounts::security {

// Returns false if libsodium could not be initialised.
bool initialise();

std::string hashPassword(std::string_view password);
bool verifyPassword(std::string_view hash, std::string_view password);

// Token = base64url(payload) "." base64url(HMAC-SHA256(secret, payload)),
// payload = "v2|userId|ROLE|sessionVersion|expiresAt".
// The secret must be at least 32 bytes and claims.sessionVersion must be set (>= 1).
std::string issueSessionToken(const SessionClaims& claims, std::string_view secret);

// Checks the signature (constant time), format and expiry. AuthFilter uses this.
// Also accepts legacy "v1|userId|ROLE|expiresAt" tokens until they expire; their
// claims have no sessionVersion. Whether the version is still current is checked
// separately (AuthFilter's SessionValidator), because that needs the database.
std::optional<SessionClaims> verifySessionToken(std::string_view token, std::string_view secret,
                                                std::int64_t nowUnixSeconds);

// 32 random bytes, base64url encoded. Used for password-reset links.
std::string randomToken();

// Reset tokens are stored only as this hash.
std::string sha256Hex(std::string_view value);

}  // namespace swapcycle::accounts::security
