#pragma once

// Short-lived, in-memory copy of users.session_version so AuthFilter does not
// hit the database on every request.
//
// Correctness does not depend on the TTL for changes made by this server:
// logout and password reset store the new (higher) version here as soon as
// they commit. The TTL only bounds how long a change made elsewhere (for
// example a role change in SQL) takes to be noticed.

#include <chrono>
#include <cstddef>
#include <cstdint>
#include <mutex>
#include <optional>
#include <string>
#include <unordered_map>

namespace swapcycle::accounts {

class SessionVersionCache {
public:
    using Clock = std::chrono::steady_clock;

    explicit SessionVersionCache(std::chrono::seconds ttl = std::chrono::seconds(30),
                                 std::size_t maxEntries = 10'000);

    // The cached version, or nullopt if absent or older than the TTL.
    std::optional<std::int64_t> get(const std::string& userId, Clock::time_point now = Clock::now());

    // Versions only go up, so a lower version than the one cached is ignored.
    // That stops a slow lookup that read the old version from undoing a
    // revocation that finished after it. Returns the version now cached.
    std::int64_t put(const std::string& userId, std::int64_t version, Clock::time_point now = Clock::now());

private:
    struct Entry {
        std::int64_t version = 0;
        Clock::time_point storedAt;
    };

    std::chrono::seconds ttl_;
    std::size_t maxEntries_;
    std::mutex mutex_;
    std::unordered_map<std::string, Entry> entries_;
};

}  // namespace swapcycle::accounts
