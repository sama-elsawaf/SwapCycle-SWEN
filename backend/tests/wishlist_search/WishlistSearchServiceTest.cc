#include <gtest/gtest.h>

#include "modules/accounts/AccountSecurity.h"
#include "modules/wishlist_search/WishlistSearchService.h"
#include "support/FakeRepositories.h"

namespace swapcycle::wishlist_search {
namespace {

using common::ErrorCode;
using swapcycle::testing::expectApiError;

const std::string kUser = swapcycle::testing::fakeId(1);
const std::string kOther = swapcycle::testing::fakeId(2);

WishItemInput titleWish(const std::string& title) {
    WishItemInput input;
    input.kind = "TITLE";
    input.title = title;
    return input;
}

class WishlistSearchServiceTest : public ::testing::Test {
protected:
    void SetUp() override {
        ASSERT_TRUE(accounts::security::initialise());
        auto accounts = std::make_shared<accounts::AccountService>(
            std::make_shared<swapcycle::testing::FakeAccountRepository>(),
            accounts::AccountSettings{"test-secret-that-is-definitely-32-bytes-long"});
        auto catalog = std::make_shared<catalog::CatalogService>(
            std::make_shared<swapcycle::testing::FakeCatalogRepository>(),
            std::make_shared<swapcycle::testing::FakePhotoStore>(), accounts);
        repository = std::make_shared<swapcycle::testing::FakeWishlistRepository>();
        service = std::make_shared<WishlistSearchService>(repository, catalog);
    }

    std::shared_ptr<swapcycle::testing::FakeWishlistRepository> repository;
    std::shared_ptr<WishlistSearchService> service;
};

TEST_F(WishlistSearchServiceTest, AddsTitleAndInterestEntries) {
    const auto title = drogon::sync_wait(service->addWishItem(kUser, titleWish("  Dune ")));
    EXPECT_EQ(title.details.title, "Dune");

    WishItemInput interest;
    interest.kind = "INTEREST";
    interest.genre = "SCIENCE_FICTION";
    interest.language = "en";
    interest.minCondition = "GOOD";
    drogon::sync_wait(service->addWishItem(kUser, interest));

    EXPECT_EQ(drogon::sync_wait(service->listWishItems(kUser)).size(), 2u);
    EXPECT_TRUE(drogon::sync_wait(service->listWishItems(kOther)).empty());
}

TEST_F(WishlistSearchServiceTest, RejectsInvalidEntries) {
    WishItemInput noKind;
    expectApiError(service->addWishItem(kUser, noKind), ErrorCode::ValidationFailed);

    WishItemInput noTitle;
    noTitle.kind = "TITLE";
    expectApiError(service->addWishItem(kUser, noTitle), ErrorCode::ValidationFailed);

    WishItemInput interestWithTitle;
    interestWithTitle.kind = "INTEREST";
    interestWithTitle.genre = "FANTASY";
    interestWithTitle.title = "Dune";
    expectApiError(service->addWishItem(kUser, interestWithTitle), ErrorCode::ValidationFailed);

    WishItemInput badGenre;
    badGenre.kind = "INTEREST";
    badGenre.genre = "COOKING";
    expectApiError(service->addWishItem(kUser, badGenre), ErrorCode::ValidationFailed);

    auto badCondition = titleWish("Dune");
    badCondition.minCondition = "MINT";
    expectApiError(service->addWishItem(kUser, badCondition), ErrorCode::ValidationFailed);

    auto badLanguage = titleWish("Dune");
    badLanguage.language = "EN";
    expectApiError(service->addWishItem(kUser, badLanguage), ErrorCode::ValidationFailed);
}

TEST_F(WishlistSearchServiceTest, RejectsDuplicates) {
    drogon::sync_wait(service->addWishItem(kUser, titleWish("Dune")));
    expectApiError(service->addWishItem(kUser, titleWish("Dune")), ErrorCode::Conflict);
}

TEST_F(WishlistSearchServiceTest, EnforcesListLimit) {
    for (std::size_t i = 0; i < kMaxWishItemsPerUser; ++i) {
        drogon::sync_wait(service->addWishItem(kUser, titleWish("Book " + std::to_string(i))));
    }
    expectApiError(service->addWishItem(kUser, titleWish("One too many")), ErrorCode::Conflict);
}

TEST_F(WishlistSearchServiceTest, CannotRemoveSomeoneElsesEntry) {
    const auto item = drogon::sync_wait(service->addWishItem(kUser, titleWish("Dune")));
    expectApiError(service->removeWishItem(kOther, item.id), ErrorCode::NotFound);
    drogon::sync_wait(service->removeWishItem(kUser, item.id));
    EXPECT_TRUE(drogon::sync_wait(service->listWishItems(kUser)).empty());
}

TEST_F(WishlistSearchServiceTest, NewEntriesDefaultToMediumPriority) {
    const auto item = drogon::sync_wait(service->addWishItem(kUser, titleWish("Dune")));
    EXPECT_EQ(item.details.priority, "MEDIUM");
    EXPECT_FALSE(item.fulfilledAt);
    EXPECT_EQ(toJson(item)["fulfilled"].asBool(), false);

    auto urgent = titleWish("Emma");
    urgent.priority = "HIGH";
    EXPECT_EQ(drogon::sync_wait(service->addWishItem(kUser, urgent)).details.priority, "HIGH");

    auto bad = titleWish("Circe");
    bad.priority = "URGENT";
    expectApiError(service->addWishItem(kUser, bad), ErrorCode::ValidationFailed);
}

TEST_F(WishlistSearchServiceTest, ChangesPriorityAndTogglesGotIt) {
    const auto item = drogon::sync_wait(service->addWishItem(kUser, titleWish("Dune")));

    const auto ranked = drogon::sync_wait(service->updateWishItem(kUser, item.id, WishItemUpdate{"LOW", std::nullopt}));
    EXPECT_EQ(ranked.details.priority, "LOW");
    EXPECT_FALSE(ranked.fulfilledAt);

    const auto found = drogon::sync_wait(service->updateWishItem(kUser, item.id, WishItemUpdate{std::nullopt, true}));
    ASSERT_TRUE(found.fulfilledAt);
    EXPECT_EQ(found.details.priority, "LOW");
    EXPECT_TRUE(toJson(found)["fulfilled"].asBool());

    // Ticking again keeps the original time; unticking makes it wanted again.
    const auto again = drogon::sync_wait(service->updateWishItem(kUser, item.id, WishItemUpdate{std::nullopt, true}));
    EXPECT_EQ(again.fulfilledAt, found.fulfilledAt);
    const auto reopened =
        drogon::sync_wait(service->updateWishItem(kUser, item.id, WishItemUpdate{std::nullopt, false}));
    EXPECT_FALSE(reopened.fulfilledAt);
}

TEST_F(WishlistSearchServiceTest, RejectsBadUpdates) {
    const auto item = drogon::sync_wait(service->addWishItem(kUser, titleWish("Dune")));
    expectApiError(service->updateWishItem(kUser, item.id, WishItemUpdate{}), ErrorCode::ValidationFailed);
    expectApiError(service->updateWishItem(kUser, item.id, WishItemUpdate{"urgent", std::nullopt}),
                   ErrorCode::ValidationFailed);
    // Someone else's entry looks exactly like a missing one.
    expectApiError(service->updateWishItem(kOther, item.id, WishItemUpdate{std::nullopt, true}), ErrorCode::NotFound);
}

TEST(WishItemJson, ParsesUpdates) {
    Json::Value body;
    body["fulfilled"] = true;
    const auto update = parseWishItemUpdate(body);
    EXPECT_EQ(update.fulfilled, true);
    EXPECT_FALSE(update.priority);

    Json::Value wrongType;
    wrongType["fulfilled"] = "yes";
    EXPECT_THROW(parseWishItemUpdate(wrongType), common::ApiError);
    EXPECT_THROW(parseWishItemUpdate(Json::Value(Json::objectValue)), common::ApiError);
}

}  // namespace
}  // namespace swapcycle::wishlist_search
