#pragma once

// Only exchange participants can see contact and meeting details.
//
// This filter never touches the database. The Exchange module implements
// ExchangeParticipantChecker (using its own repository/service) and registers
// it once at startup with ParticipantFilter::setChecker(...).
// Attach AFTER AuthFilter, on routes shaped like /api/exchanges/<uuid>/...

#include <drogon/HttpFilter.h>

#include <functional>
#include <memory>
#include <string>

enum class ParticipantCheck {
  kParticipant,
  kNotParticipant,  // also used when the exchange doesn't exist
  kError            // the lookup itself failed
};

class ExchangeParticipantChecker {
 public:
  virtual ~ExchangeParticipantChecker() = default;

  // Both ids are UUIDs (exchangeId is already validated by the filter).
  // Calls done exactly once. May call it from another thread (async DB).
  virtual void check(const std::string &exchangeId, const std::string &userId,
                     std::function<void(ParticipantCheck)> done) const = 0;
};

class ParticipantFilter : public drogon::HttpFilter<ParticipantFilter> {
 public:
  static void setChecker(std::shared_ptr<const ExchangeParticipantChecker> checker);

  void doFilter(const drogon::HttpRequestPtr &req,
                drogon::FilterCallback &&reject,
                drogon::FilterChainCallback &&next) override;
};
