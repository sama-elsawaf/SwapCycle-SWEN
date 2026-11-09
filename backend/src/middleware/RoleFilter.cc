#include "RoleFilter.h"

#include <string>

#include "AuthFilter.h"
#include "common/ApiError.h"

namespace {

using swapcycle::common::ApiError;
using swapcycle::common::ErrorCode;

}  // namespace

void RoleFilter::doFilter(const drogon::HttpRequestPtr &req,
                          drogon::FilterCallback &&reject,
                          drogon::FilterChainCallback &&next) {
  auto attributes = req->attributes();

  // Means someone forgot to put AuthFilter in front of this one.
  if (!attributes->find(kAuthRoleKey)) {
    reject(swapcycle::common::errorResponse(ApiError(ErrorCode::Unauthorized, "Please log in to continue.")));
    return;
  }

  if (attributes->get<std::string>(kAuthRoleKey) != "MODERATOR") {
    reject(swapcycle::common::errorResponse(
        ApiError(ErrorCode::Forbidden, "You do not have permission to do that.")));
    return;
  }
  next();
}
