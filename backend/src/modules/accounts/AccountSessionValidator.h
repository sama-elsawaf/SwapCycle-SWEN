#pragma once

// Connects AuthFilter's SessionValidator hook to AccountService, so the filter
// can refuse revoked sessions without touching the database itself.
// Registered once in main.cc with AuthFilter::setSessionValidator(...).

#include <memory>

#include "AccountService.h"
#include "middleware/AuthFilter.h"

namespace swapcycle::accounts {

class AccountSessionValidator final : public SessionValidator {
public:
    explicit AccountSessionValidator(std::shared_ptr<AccountService> service);

    void check(const std::string& userId, std::int64_t sessionVersion,
               std::function<void(SessionCheck)> done) const override;

private:
    std::shared_ptr<AccountService> service_;
};

}  // namespace swapcycle::accounts
