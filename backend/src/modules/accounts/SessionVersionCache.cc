#include "SessionVersionCache.h"

namespace swapcycle::accounts {

SessionVersionCache::SessionVersionCache(std::chrono::seconds ttl, std::size_t maxEntries)
    : ttl_(ttl), maxEntries_(maxEntries) {}

std::optional<std::int64_t> SessionVersionCache::get(const std::string& userId, Clock::time_point now) {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto it = entries_.find(userId);
    if (it == entries_.end() || now - it->second.storedAt >= ttl_) return std::nullopt;
    return it->second.version;
}

std::int64_t SessionVersionCache::put(const std::string& userId, std::int64_t version, Clock::time_point now) {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto it = entries_.find(userId);
    if (it != entries_.end()) {
        if (version < it->second.version) return it->second.version;
        it->second = {version, now};
        return version;
    }
    // Bounded memory: drop expired entries, and if that is not enough, start over.
    if (entries_.size() >= maxEntries_) {
        std::erase_if(entries_, [&](const auto& item) { return now - item.second.storedAt >= ttl_; });
        if (entries_.size() >= maxEntries_) entries_.clear();
    }
    entries_.emplace(userId, Entry{version, now});
    return version;
}

}  // namespace swapcycle::accounts
