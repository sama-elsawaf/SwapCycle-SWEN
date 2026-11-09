#include "ParticipantFilter.h"

#include <trantor/utils/Logger.h>

#include <mutex>
#include <optional>
#include <string>

#include "AuthFilter.h"
#include "common/ApiError.h"
#include "common/Uuid.h"

namespace {

using swapcycle::common::ApiError;
using swapcycle::common::ErrorCode;

std::mutex checkerMutex;
std::shared_ptr<const ExchangeParticipantChecker> registeredChecker;

std::shared_ptr<const ExchangeParticipantChecker> currentChecker() {
  std::lock_guard<std::mutex> lock(checkerMutex);
  return registeredChecker;
}

void respond(const drogon::FilterCallback &reject, ErrorCode code, const std::string &message) {
  reject(swapcycle::common::errorResponse(ApiError(code, message)));
}

// Non-participants get the same 404 as a missing exchange, so they cannot
// tell which exchanges exist.
void respondNotFound(const drogon::FilterCallback &reject) {
  respond(reject, ErrorCode::NotFound, "Exchange not found.");
}

// Pulls <id> out of /api/exchanges/<id>[/...]. Only a well-formed UUID is
// accepted, so nothing odd from the URL can reach the database.
std::optional<std::string> exchangeIdFromPath(const std::string &path) {
  const std::string prefix = "/api/exchanges/";
  if (path.rfind(prefix, 0) != 0) {
    return std::nullopt;
  }

  const auto end = path.find('/', prefix.size());
  std::string id = path.substr(prefix.size(), end == std::string::npos ? end : end - prefix.size());
  if (!swapcycle::common::isValidUuid(id)) {
    return std::nullopt;
  }
  return id;
}

}  // namespace

void ParticipantFilter::setChecker(
    std::shared_ptr<const ExchangeParticipantChecker> checker) {
  std::lock_guard<std::mutex> lock(checkerMutex);
  registeredChecker = std::move(checker);
}

void ParticipantFilter::doFilter(const drogon::HttpRequestPtr &req,
                                 drogon::FilterCallback &&reject,
                                 drogon::FilterChainCallback &&next) {
  auto attributes = req->attributes();

  // Means someone forgot to put AuthFilter in front of this one.
  if (!attributes->find(kAuthUserIdKey)) {
    respond(reject, ErrorCode::Unauthorized, "Please log in to continue.");
    return;
  }
  const auto userId = attributes->get<std::string>(kAuthUserIdKey);

  const auto exchangeId = exchangeIdFromPath(req->path());
  if (!exchangeId) {
    respondNotFound(reject);
    return;
  }

  const auto checker = currentChecker();
  if (!checker) {
    LOG_ERROR << "ParticipantFilter used before a checker was registered";
    respond(reject, ErrorCode::Internal, "Something went wrong. Please try again.");
    return;
  }

  // The answer may arrive later (async DB), so the callbacks move into it.
  checker->check(
      *exchangeId, userId,
      [reject = std::move(reject), next = std::move(next)](ParticipantCheck result) {
        switch (result) {
          case ParticipantCheck::kParticipant:
            next();
            return;
          case ParticipantCheck::kNotParticipant:
            respondNotFound(reject);
            return;
          case ParticipantCheck::kError:
            respond(reject, ErrorCode::Internal, "Something went wrong. Please try again.");
            return;
        }
      });
}
