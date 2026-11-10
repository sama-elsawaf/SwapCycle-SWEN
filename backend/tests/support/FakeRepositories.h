#pragma once

// In-memory repositories and helpers so service rules can be tested without a database.

#include <gtest/gtest.h>

#include <algorithm>
#include <map>
#include <optional>
#include <string>
#include <vector>

#include "common/ApiError.h"
#include "modules/accounts/AccountRepository.h"
#include "modules/catalog/CatalogRepository.h"
#include "modules/wishlist_search/WishlistSearchRepository.h"

namespace swapcycle::testing {

// Runs a service coroutine to completion and expects it to throw an ApiError with `code`.
template <typename Awaitable>
void expectApiError(Awaitable&& awaitable, common::ErrorCode code) {
    try {
        drogon::sync_wait(std::forward<Awaitable>(awaitable));
        ADD_FAILURE() << "expected an ApiError";
    } catch (const common::ApiError& error) {
        EXPECT_EQ(error.code(), code) << error.what();
    }
}

inline std::string fakeId(int n) {
    char text[37];
    std::snprintf(text, sizeof(text), "00000000-0000-4000-8000-%012d", n);
    return text;
}

class FakeAccountRepository : public accounts::AccountRepository {
public:
    std::map<std::string, accounts::User> users;  // By id.
    std::vector<accounts::MeetingArea> areas{{1, "Main Library"}, {2, "Student Union"}};
    struct ResetToken {
        std::string userId;
        bool used = false;
    };
    std::map<std::string, ResetToken> resetTokens;  // By hash.
    int nextId = 1;
    int sessionVersionLookups = 0;  // How often AuthFilter's check reached the "database".

    drogon::Task<std::optional<accounts::User>> findByEmail(std::string email) override {
        for (const auto& [id, user] : users) {
            if (user.email == email) co_return user;
        }
        co_return std::nullopt;
    }
    drogon::Task<std::optional<accounts::User>> findById(std::string userId) override {
        const auto it = users.find(userId);
        if (it == users.end()) co_return std::nullopt;
        co_return it->second;
    }
    drogon::Task<std::vector<accounts::User>> findByIds(std::vector<std::string> userIds) override {
        std::vector<accounts::User> found;
        for (const auto& id : userIds) {
            if (users.count(id)) found.push_back(users.at(id));
        }
        co_return found;
    }
    drogon::Task<std::optional<accounts::User>> insertUser(accounts::NewUser newUser) override {
        for (const auto& [id, user] : users) {
            if (user.email == newUser.email) co_return std::nullopt;
        }
        accounts::User user;
        user.id = fakeId(nextId++);
        user.email = newUser.email;
        user.passwordHash = newUser.passwordHash;
        user.displayName = newUser.displayName;
        user.createdAt = "2026-11-05T10:00:00Z";
        users[user.id] = user;
        co_return user;
    }
    drogon::Task<void> updateProfile(std::string userId, accounts::ProfileUpdate update) override {
        auto& user = users.at(userId);
        if (update.displayName) user.displayName = *update.displayName;
        if (update.meetingAreaId) {
            user.meetingArea.reset();
            for (const auto& area : areas) {
                if (*update.meetingAreaId && area.id == **update.meetingAreaId) user.meetingArea = area;
            }
        }
        if (update.interests) user.interests = *update.interests;
        if (update.privacy) user.privacy = *update.privacy;
        if (update.onboardingCompleted) user.onboardingCompleted = *update.onboardingCompleted;
        co_return;
    }
    drogon::Task<std::vector<accounts::MeetingArea>> listMeetingAreas() override { co_return areas; }
    drogon::Task<void> insertResetToken(std::string userId, std::string tokenHash, std::chrono::seconds) override {
        resetTokens[tokenHash] = {userId, false};
        co_return;
    }
    drogon::Task<std::optional<accounts::SessionRevocation>> consumeResetTokenAndSetPassword(
        std::string tokenHash, std::string newHash) override {
        const auto it = resetTokens.find(tokenHash);
        if (it == resetTokens.end() || it->second.used) co_return std::nullopt;
        it->second.used = true;
        auto& user = users.at(it->second.userId);
        user.passwordHash = newHash;
        co_return accounts::SessionRevocation{user.id, ++user.sessionVersion};
    }
    drogon::Task<std::optional<std::int64_t>> findSessionVersion(std::string userId) override {
        ++sessionVersionLookups;
        const auto it = users.find(userId);
        if (it == users.end()) co_return std::nullopt;
        co_return it->second.sessionVersion;
    }
    drogon::Task<std::optional<accounts::SessionRevocation>> revokeSessions(std::string userId,
                                                                            std::int64_t expectedVersion) override {
        const auto it = users.find(userId);
        if (it == users.end() || it->second.sessionVersion != expectedVersion) co_return std::nullopt;
        co_return accounts::SessionRevocation{userId, ++it->second.sessionVersion};
    }
};

class CapturingResetSender : public accounts::PasswordResetSender {
public:
    std::vector<std::string> tokens;
    void send(const accounts::User&, const std::string& token) override { tokens.push_back(token); }
};

class FakeCatalogRepository : public catalog::CatalogRepository {
public:
    std::map<std::string, catalog::BookCopy> copies;
    std::map<std::string, bool> deleted;
    std::vector<catalog::Photo> photos;
    std::vector<std::string> deletedPhotos;
    catalog::SearchFilters lastSearch;
    int nextId = 100;

    drogon::Task<catalog::BookCopy> createListing(std::string ownerId, catalog::BookInput input) override {
        catalog::BookCopy copy;
        copy.id = fakeId(nextId++);
        copy.descriptionId = fakeId(nextId++);
        copy.ownerId = ownerId;
        apply(copy, input);
        copy.status = "AVAILABLE";
        copy.createdAt = "2026-11-05T10:00:00Z";
        copies[copy.id] = copy;
        co_return copy;
    }
    drogon::Task<std::optional<catalog::BookCopy>> findCopy(std::string copyId) override {
        const auto it = copies.find(copyId);
        if (it == copies.end() || deleted[copyId]) co_return std::nullopt;
        co_return it->second;
    }
    drogon::Task<bool> updateDetails(std::string copyId, catalog::BookInput input,
                                     std::vector<std::string> allowed) override {
        auto& copy = copies.at(copyId);
        if (!contains(allowed, copy.status)) co_return false;
        apply(copy, input);
        co_return true;
    }
    drogon::Task<bool> transitionStatus(std::string copyId, std::string from, std::string to) override {
        auto& copy = copies.at(copyId);
        if (copy.status != from) co_return false;
        copy.status = to;
        co_return true;
    }
    drogon::Task<bool> softDelete(std::string copyId, std::vector<std::string> allowed) override {
        if (!contains(allowed, copies.at(copyId).status)) co_return false;
        deleted[copyId] = true;
        co_return true;
    }
    drogon::Task<std::pair<std::vector<catalog::BookCopy>, std::int64_t>> listByOwner(std::string ownerId, int,
                                                                                     int) override {
        std::vector<catalog::BookCopy> mine;
        for (const auto& [id, copy] : copies) {
            if (copy.ownerId == ownerId && !deleted[id]) mine.push_back(copy);
        }
        const auto total = static_cast<std::int64_t>(mine.size());
        co_return std::make_pair(std::move(mine), total);
    }
    drogon::Task<std::pair<std::vector<catalog::BookCopy>, std::int64_t>> search(
        catalog::SearchFilters filters) override {
        lastSearch = filters;
        std::vector<catalog::BookCopy> found;
        for (const auto& [id, copy] : copies) {
            if (copy.status == "AVAILABLE" && !deleted[id]) found.push_back(copy);
        }
        const auto total = static_cast<std::int64_t>(found.size());
        co_return std::make_pair(std::move(found), total);
    }
    drogon::Task<std::vector<catalog::Photo>> listPhotos(std::vector<std::string> copyIds) override {
        std::vector<catalog::Photo> found;
        for (const auto& photo : photos) {
            if (contains(copyIds, photo.copyId) && !contains(deletedPhotos, photo.id)) found.push_back(photo);
        }
        co_return found;
    }
    drogon::Task<bool> insertPhoto(catalog::Photo photo, int maxPerCopy) override {
        const auto existing = std::count_if(photos.begin(), photos.end(), [&](const auto& p) {
            return p.copyId == photo.copyId && !contains(deletedPhotos, p.id);
        });
        if (existing >= maxPerCopy) co_return false;
        photos.push_back(photo);
        co_return true;
    }
    drogon::Task<std::optional<catalog::Photo>> findPhoto(std::string photoId) override {
        for (const auto& photo : photos) {
            if (photo.id == photoId && !contains(deletedPhotos, photoId)) co_return photo;
        }
        co_return std::nullopt;
    }
    drogon::Task<bool> softDeletePhoto(std::string photoId, std::string copyId) override {
        for (const auto& photo : photos) {
            if (photo.id == photoId && photo.copyId == copyId && !contains(deletedPhotos, photoId)) {
                deletedPhotos.push_back(photoId);
                co_return true;
            }
        }
        co_return false;
    }

private:
    static bool contains(const std::vector<std::string>& values, const std::string& value) {
        return std::find(values.begin(), values.end(), value) != values.end();
    }
    static void apply(catalog::BookCopy& copy, const catalog::BookInput& input) {
        copy.title = input.title;
        copy.author = input.author;
        copy.edition = input.edition;
        copy.language = input.language;
        copy.genre = input.genre;
        copy.condition = input.condition;
        copy.conditionNotes = input.conditionNotes;
        copy.exchangeAreaId = input.exchangeAreaId;
    }
};

class FakePhotoStore : public catalog::PhotoStore {
public:
    std::map<std::string, std::string> files;
    void save(const std::string& id, const std::string& bytes) override { files[id] = bytes; }
    void remove(const std::string& id) override { files.erase(id); }
    std::string pathFor(const std::string& id) const override { return "/uploads/" + id; }
};

class FakeWishlistRepository : public wishlist_search::WishlistSearchRepository {
public:
    std::vector<std::pair<std::string, wishlist_search::WishItem>> items;  // (userId, item)
    int nextId = 500;

    drogon::Task<std::vector<wishlist_search::WishItem>> listForUser(std::string userId) override {
        std::vector<wishlist_search::WishItem> mine;
        for (const auto& [owner, item] : items) {
            if (owner == userId) mine.push_back(item);
        }
        co_return mine;
    }
    drogon::Task<std::int64_t> countForUser(std::string userId) override {
        co_return static_cast<std::int64_t>(
            std::count_if(items.begin(), items.end(), [&](const auto& entry) { return entry.first == userId; }));
    }
    drogon::Task<std::optional<wishlist_search::WishItem>> insert(std::string userId,
                                                                 wishlist_search::WishItemInput input) override {
        for (const auto& [owner, item] : items) {
            const auto& d = item.details;
            if (owner == userId && d.kind == input.kind && d.title == input.title && d.author == input.author &&
                d.genre == input.genre && d.language == input.language) {
                co_return std::nullopt;
            }
        }
        wishlist_search::WishItem item{fakeId(nextId++), input, "2026-11-05T10:00:00Z"};
        items.emplace_back(userId, item);
        co_return item;
    }
    drogon::Task<bool> deleteForUser(std::string userId, std::string wishItemId) override {
        const auto it = std::find_if(items.begin(), items.end(), [&](const auto& entry) {
            return entry.first == userId && entry.second.id == wishItemId;
        });
        if (it == items.end()) co_return false;
        items.erase(it);
        co_return true;
    }
};

}  // namespace swapcycle::testing
