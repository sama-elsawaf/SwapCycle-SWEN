#!/usr/bin/env bash
# End-to-end checks of the Sprint 1 API: accounts, listings, photos, search,
# wish list, CORS and rate limiting. Prints PASS/FAIL per check and exits
# non-zero if anything fails.
#
# Needs: bash, curl, python3, and a running backend on an EMPTY database
# (it registers sara@example.com and ali@example.com). Rate limits are kept in
# memory, so restart the backend before running this again or before
# scripts/api-probe.sh.
#
#   API_URL=http://127.0.0.1:8080/api scripts/api-smoke.sh
set -u
# Base URL of the API; the default matches `docker compose up`.
B="${API_URL:-http://127.0.0.1:8080/api}"
# Scratch files (cookies, response bodies, test images) live in a temp folder.
work=$(mktemp -d)
cd "$work" || exit 1
trap 'cd / && rm -f "$work"/* && rmdir "$work"' EXIT
J='Content-Type: application/json'
fails=0
check() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (expected $3, got $2)"; fails=$((fails+1)); fi; }
code() { curl -s -o body.json -w '%{http_code}' --max-time 10 "$@"; }
field() { python -c "import json,sys; d=json.load(open('body.json')); print(eval(sys.argv[1]))" "$1"; }

check "register" "$(code -c jar1 -H "$J" -d '{"email":"Sara@Example.com","password":"password123","displayName":"Sara"}' $B/auth/register)" 201
check "email normalised" "$(field "d['data']['email']")" "sara@example.com"
check "cookie HttpOnly" "$(grep -c '#HttpOnly_.*sc_session' jar1)" 1
check "register ali" "$(code -c jar2 -H "$J" -d '{"email":"ali@example.com","password":"password123","displayName":"Ali"}' $B/auth/register)" 201
check "duplicate email 409" "$(code -H "$J" -d '{"email":"sara@example.com","password":"password123","displayName":"S2"}' $B/auth/register)" 409
check "short password 400" "$(code -H "$J" -d '{"email":"x@example.com","password":"short","displayName":"Xy"}' $B/auth/register)" 400
check "wrong password 401" "$(code -H "$J" -d '{"email":"sara@example.com","password":"nope-nope"}' $B/auth/login)" 401
m1=$(field "d['error']['message']")
check "unknown email 401" "$(code -H "$J" -d '{"email":"nobody@example.com","password":"nope-nope"}' $B/auth/login)" 401
check "same message" "$(field "d['error']['message']")" "$m1"
check "me without cookie 401" "$(code $B/auth/me)" 401
check "me" "$(code -b jar1 $B/auth/me)" 200
SARA=$(field "d['data']['id']")
check "profile update" "$(code -b jar1 -X PATCH -H "$J" -d '{"meetingAreaId":1,"interests":["FICTION","SCIENCE"],"privacy":{"showMeetingArea":true,"showInterests":false},"onboardingCompleted":true}' $B/users/me)" 200
check "profile reflects update" "$(field "(d['data']['meetingArea']['id'], sorted(d['data']['interests']), d['data']['onboardingCompleted'])")" "(1, ['FICTION', 'SCIENCE'], True)"
check "interests replaced" "$(code -b jar1 -X PATCH -H "$J" -d '{"interests":["SCIENCE","BUSINESS"]}' $B/users/me; field "sorted(d['data']['interests'])")" "200['BUSINESS', 'SCIENCE']"
check "bad area 400" "$(code -b jar1 -X PATCH -H "$J" -d '{"meetingAreaId":99}' $B/users/me)" 400
check "public profile hides interests" "$(code -b jar2 $B/users/$SARA; field "(d['data']['interests'], 'email' in d['data'])")" "200(None, False)"
check "create book" "$(code -b jar1 -H "$J" -d '{"title":"The Hound of the Baskervilles","author":"Arthur Conan Doyle","language":"en","genre":"MYSTERY","condition":"GOOD","conditionNotes":"Spine creased"}' $B/books)" 201
ID=$(field "d['data']['id']")
check "defaults to owner area" "$(field "d['data']['exchangeArea']['name']")" "Main Library"
check "immediate public get" "$(code $B/books/$ID)" 200
check "bad genre 400" "$(code -b jar1 -H "$J" -d '{"title":"x","author":"y","language":"en","genre":"COOKING","condition":"GOOD"}' $B/books)" 400
check "no auth create 401" "$(code -H "$J" -d '{}' $B/books)" 401
check "ali edits sara book 404" "$(code -b jar2 -X PATCH -H "$J" -d '{"title":"x","author":"y","language":"en","genre":"MYSTERY","condition":"GOOD"}' $B/books/$ID)" 404
check "ali deletes sara book 404" "$(code -b jar2 -X DELETE $B/books/$ID)" 404
check "edit own" "$(code -b jar1 -X PATCH -H "$J" -d '{"title":"The Hound of the Baskervilles","author":"Arthur Conan Doyle","edition":"2nd","language":"en","genre":"MYSTERY","condition":"FAIR","exchangeAreaId":3}' $B/books/$ID; field "(d['data']['edition'], d['data']['condition'], d['data']['exchangeArea']['id'])")" "200('2nd', 'FAIR', 3)"
check "search q" "$(code "$B/search/books?q=HOUND"; field "d['data']['total']")" "2001"
check "search filters" "$(code "$B/search/books?author=doyle&genre=MYSTERY&language=en&areaId=3&minCondition=FAIR&page=1&pageSize=5"; field "d['data']['total']")" "2001"
check "search min condition excludes" "$(code "$B/search/books?q=hound&minCondition=GOOD"; field "d['data']['total']")" "2000"
check "search injection literal" "$(code "$B/search/books?q=%25%27%20OR%201=1--"; field "d['data']['total']")" "2000"
check "search wildcard literal" "$(code "$B/search/books?q=%25"; field "d['data']['total']")" "2000"
check "search bad pageSize 400" "$(code "$B/search/books?pageSize=500")" 400
check "search bad page 400" "$(code "$B/search/books?page=abc")" 400
printf '\x89PNG\r\n\x1a\n0000fakepng' > p.png
printf 'GIF89a....' > g.gif
printf '\xff\xd8\xff\xe0jpeg' > j.jpg
check "png upload (declared jpeg)" "$(code -b jar1 -F "photo=@p.png;type=image/jpeg" $B/books/$ID/photos)" 201
PID=$(field "d['data']['id']")
check "gif rejected 415" "$(code -b jar1 -F "photo=@g.gif;filename=x.png;type=image/png" $B/books/$ID/photos)" 415
check "ali uploads to sara 404" "$(code -b jar2 -F "photo=@j.jpg" $B/books/$ID/photos)" 404
check "photo served as png" "$(curl -s -o /dev/null -w '%{http_code} %{content_type}' $B/photos/$PID)" "200 image/png"
check "photo nosniff" "$(curl -s -D - -o /dev/null $B/photos/$PID | grep -ci 'x-content-type-options: nosniff')" 1
for i in 2 3 4 5; do code -b jar1 -F "photo=@j.jpg" $B/books/$ID/photos >/dev/null; done
check "sixth photo 409" "$(code -b jar1 -F "photo=@j.jpg" $B/books/$ID/photos)" 409
check "listing has 5 photos" "$(code $B/books/$ID; field "len(d['data']['photos'])")" "2005"
check "delete photo" "$(code -b jar1 -X DELETE $B/books/$ID/photos/$PID)" 204
check "deleted photo 404" "$(code $B/photos/$PID)" 404
check "withdraw" "$(code -b jar1 -X POST $B/books/$ID/withdraw; field "d['data']['status']")" "200WITHDRAWN"
check "withdrawn hidden" "$(code $B/books/$ID)" 404
check "withdrawn not in search" "$(code "$B/search/books?q=hound"; field "d['data']['total']")" "2000"
check "my books shows withdrawn" "$(code -b jar1 "$B/users/me/books"; field "(d['data']['total'], d['data']['items'][0]['status'])")" "200(1, 'WITHDRAWN')"
check "relist" "$(code -b jar1 -X POST $B/books/$ID/relist; field "d['data']['status']")" "200AVAILABLE"
check "relist again 409" "$(code -b jar1 -X POST $B/books/$ID/relist)" 409
check "wish title" "$(code -b jar1 -H "$J" -d '{"kind":"TITLE","title":"Dune","language":"en","minCondition":"GOOD"}' $B/wishlist)" 201
WID=$(field "d['data']['id']")
check "wish duplicate 409" "$(code -b jar1 -H "$J" -d '{"kind":"TITLE","title":" DUNE ","language":"en"}' $B/wishlist)" 409
check "wish interest" "$(code -b jar1 -H "$J" -d '{"kind":"INTEREST","genre":"TRAVEL"}' $B/wishlist)" 201
check "wish bad 400" "$(code -b jar1 -H "$J" -d '{"kind":"INTEREST","title":"x"}' $B/wishlist)" 400
check "wish list" "$(code -b jar1 $B/wishlist; field "len(d['data'])")" "2002"
check "ali cannot delete sara wish" "$(code -b jar2 -X DELETE $B/wishlist/$WID)" 404
check "delete wish" "$(code -b jar1 -X DELETE $B/wishlist/$WID)" 204
check "delete book" "$(code -b jar1 -X DELETE $B/books/$ID)" 204
check "deleted book 404" "$(code $B/books/$ID)" 404
check "json 404" "$(code $B/nope; field "d['error']['code']")" "404NOT_FOUND"
check "malformed id 404" "$(code $B/books/not-a-uuid)" 404
check "non-json body 400" "$(code -b jar1 -X PATCH -d 'displayName=x' $B/users/me)" 400
check "cors allowed origin" "$(curl -s -D - -o /dev/null -H 'Origin: http://localhost:5173' $B/meeting-areas | grep -ci 'access-control-allow-origin: http://localhost:5173')" 1
check "cors other origin" "$(curl -s -D - -o /dev/null -H 'Origin: https://evil.example' $B/meeting-areas | grep -ci 'access-control-allow-origin')" 0
check "reset request 202" "$(code -H "$J" -d '{"email":"sara@example.com"}' $B/auth/password-reset/request)" 202
check "reset unknown 202" "$(code -H "$J" -d '{"email":"nobody@example.com"}' $B/auth/password-reset/request)" 202
check "reset bad token 400" "$(code -H "$J" -d '{"token":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","newPassword":"password999"}' $B/auth/password-reset/confirm)" 400
check "logout clears cookie" "$(curl -s -D - -o /dev/null -b jar1 -X POST $B/auth/logout | grep -ci 'set-cookie: sc_session=; Max-Age=0')" 1
for i in 1 2 3 4 5; do code -H "$J" -d '{"email":"ali@example.com","password":"wrong-wrong"}' $B/auth/login >/dev/null; done
check "login rate limited 429" "$(code -H "$J" -d '{"email":"ali@example.com","password":"password123"}' $B/auth/login)" 429
check "retry-after header" "$(curl -s -D - -o /dev/null -H "$J" -d '{"email":"ali@example.com","password":"password123"}' $B/auth/login | grep -ci 'retry-after')" 1
echo "failures: $fails"
[ "$fails" -eq 0 ]
