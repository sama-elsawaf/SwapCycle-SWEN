#include "AccountSessionValidator.h"

#include <drogon/utils/coroutine.h>
#include <trantor/utils/Logger.h>

#include <exception>
#include <utility>

namespace swapcycle::accounts {

AccountSessionValidator::AccountSessionValidator(std::shared_ptr<AccountService> service)
    : service_(std::move(service)) {}

void AccountSessionValidator::check(const std::string& userId, std::int64_t sessionVersion,
                                    std::function<void(SessionCheck)> done) const {
    drogon::async_run([service = service_, userId, sessionVersion, done = std::move(done)]() -> drogon::Task<> {
        SessionCheck result = SessionCheck::kError;
        try {
            result = co_await service->isSessionCurrent(userId, sessionVersion) ? SessionCheck::kCurrent
                                                                                : SessionCheck::kRevoked;
        } catch (const std::exception& error) {
            // Never log the token; the user id is enough to investigate.
            LOG_ERROR << "Session check failed for user " << userId << ": " << error.what();
        }
        done(result);
    });
}

}  // namespace swapcycle::accounts
