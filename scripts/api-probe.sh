#!/usr/bin/env bash
# Abuse and edge-case probes: malformed and deeply nested JSON, control
# characters, oversized fields and uploads, fake images, path traversal,
# other users' data, SQL/LIKE injection in search, concurrent requests and
# rate limiting. Prints PASS/FAIL per check and exits non-zero on failure.
#
# Needs: bash, curl, python3, and a freshly started backend on an empty
# database (rate limits are in memory; it registers p1..p6@example.com).
#
#   API_URL=http://127.0.0.1:8080/api scripts/api-probe.sh
set -u
# Base URL of the API; the default matches `docker compose up`.
B="${API_URL:-http://127.0.0.1:8080/api}"
# Scratch files (cookies, response bodies, test images) live in a temp folder.
work=$(mktemp -d)
cd "$work" || exit 1
trap 'cd / && rm -f "$work"/* && rmdir "$work"' EXIT
J='Content-Type: application/json'
fails=0
check() { if [[ "$2" =~ ^($3)$ ]]; then echo "PASS $1"; else echo "FAIL $1 (expected $3, got $2)"; fails=$((fails+1)); fi; }
code() { curl -s -o pbody.json -w '%{http_code}' --max-time 20 "$@"; }
field() { python -c "import json,sys; d=json.load(open('pbody.json')); print(eval(sys.argv[1]))" "$1" 2>/dev/null; }

# Accounts
check "register p1" "$(code -c pj1 -H "$J" -d '{"email":"p1@example.com","password":"password123","displayName":"Probe One"}' $B/auth/register)" 201
check "register p2" "$(code -c pj2 -H "$J" -d '{"email":"p2@example.com","password":"password123","displayName":"Probe Two"}' $B/auth/register)" 201
check "malformed json 400" "$(code -H "$J" -d '{"email":' $B/auth/login)" 400
check "array body 400" "$(code -H "$J" -d '[1,2]' $B/auth/register)" 400
check "wrong types 400" "$(code -H "$J" -d '{"email":123,"password":true,"displayName":null}' $B/auth/register)" 400
check "text/plain body 400" "$(code -H 'Content-Type: text/plain' -d '{"email":"a@b.co","password":"password123","displayName":"Xx"}' $B/auth/register)" 400
check "no body 400" "$(code -X POST $B/auth/register)" 400
python -c "print('['*20000 + ']'*20000)" > deep.json
check "deeply nested json 400" "$(code -H "$J" --data-binary @deep.json $B/auth/password-reset/request)" 400
python -c "q=chr(34); print(('{'+q+'a'+q+':')*20000 + '1' + '}'*20000)" > deep2.json
check "deeply nested object 400" "$(code -b pj1 -H "$J" --data-binary @deep2.json $B/wishlist)" 400
check "server alive after deep json" "$(code $B/meeting-areas)" 200
check "control char name 400" "$(code -H "$J" -d '{"email":"p3@example.com","password":"password123","displayName":"Bad\u0007Name"}' $B/auth/register)" 400
check "emoji name ok" "$(code -H "$J" -d '{"email":"p4@example.com","password":"password123","displayName":"Noor 📚"}' $B/auth/register)" 201
check "null byte email 400" "$(code -H "$J" -d '{"email":"p5@exa\u0000mple.com","password":"password123","displayName":"Nul"}' $B/auth/register)" 400
check "null byte login refused" "$(code -H "$J" -d '{"email":"p1@example.com\u0000x","password":"password123"}' $B/auth/login)" 401
check "129-char password 400" "$(code -H "$J" -d "{\"email\":\"p6@example.com\",\"password\":\"$(python -c "print('a'*129)")\",\"displayName\":\"Long\"}" $B/auth/register)" 400
check "reset junk token 400" "$(code -H "$J" -d '{"token":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx","newPassword":"password123"}' $B/auth/password-reset/confirm)" 400
check "reset unknown email 202" "$(code -H "$J" -d '{"email":"nobody@example.com"}' $B/auth/password-reset/request)" 202
check "forged cookie 401" "$(code -b 'sc_session=v1.forged.token' $B/auth/me)" 401
check "profile bad interest 400" "$(code -b pj1 -X PATCH -H "$J" -d '{"interests":["HACKING"]}' $B/users/me)" 400
check "profile huge area id 400" "$(code -b pj1 -X PATCH -H "$J" -d '{"meetingAreaId":99999999999}' $B/users/me)" 400
check "profile role escalation ignored" "$(code -b pj1 -X PATCH -H "$J" -d '{"role":"MODERATOR"}' $B/users/me; field "d['data']['role']")" "200READER|400"
check "public profile bad uuid 404" "$(code -b pj1 $B/users/not-a-uuid)" "400|404"
check "public profile unknown 404" "$(code -b pj1 $B/users/00000000-0000-4000-8000-000000000999)" 404

# Books
BOOK='{"title":"Probe Book","author":"Tester","language":"en","genre":"MYSTERY","condition":"GOOD"}'
check "create book" "$(code -b pj1 -H "$J" -d "$BOOK" $B/books)" 201
CID=$(field "d['data']['id']")
check "create book anonymous 401" "$(code -H "$J" -d "$BOOK" $B/books)" 401
check "huge title 400" "$(code -b pj1 -H "$J" -d "{\"title\":\"$(python -c "print('t'*5000)")\",\"author\":\"A\",\"language\":\"en\",\"genre\":\"MYSTERY\",\"condition\":\"GOOD\"}" $B/books)" 400
check "bad genre 400" "$(code -b pj1 -H "$J" -d '{"title":"T","author":"A","language":"en","genre":"NOPE","condition":"GOOD"}' $B/books)" 400
check "bad language 400" "$(code -b pj1 -H "$J" -d '{"title":"T","author":"A","language":"english","genre":"MYSTERY","condition":"GOOD"}' $B/books)" 400
check "other user cannot edit 404" "$(code -b pj2 -X PATCH -H "$J" -d "$BOOK" $B/books/$CID)" "403|404"
check "other user cannot delete 404" "$(code -b pj2 -X DELETE $B/books/$CID)" "403|404"
check "other user cannot read own-view 404" "$(code -b pj2 $B/users/me/books/$CID)" "403|404"
check "other user cannot withdraw 404" "$(code -b pj2 -X POST $B/books/$CID/withdraw)" "403|404"
check "bad copy id 404" "$(code $B/books/abc)" "400|404"
check "sql-ish copy id 404" "$(code "$B/books/1%27%20OR%20%271%27=%271")" "400|404"
check "public book view" "$(code $B/books/$CID; field "('email' in json.dumps(d), 'passwordHash' in json.dumps(d))")" "200\(False, False\)"

# Photos
python - <<'EOF'
import struct, zlib
def png(w=1,h=1):
    raw=b'\x00'+b'\xff\x00\x00'*w
    def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw*h))+chunk(b'IEND',b'')
open('ok.png','wb').write(png())
open('fake.jpg','wb').write(b'<?php echo 1; ?>')
open('gif.gif','wb').write(b'GIF89a\x01\x00\x01\x00\x00\x00\x00;')
open('big.png','wb').write(png()+b'\x00'*(5*1024*1024+10))
open('svg.png','wb').write(b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
EOF
check "upload png 201" "$(code -b pj1 -F photo=@ok.png $B/books/$CID/photos)" 201
PID=$(field "d['data']['id']")
check "upload text as jpg 400" "$(code -b pj1 -F 'photo=@fake.jpg;type=image/jpeg' $B/books/$CID/photos)" "400|415"
check "upload gif 400" "$(code -b pj1 -F 'photo=@gif.gif;type=image/png' $B/books/$CID/photos)" "400|415"
check "upload svg-as-png 400" "$(code -b pj1 -F 'photo=@svg.png;type=image/png' $B/books/$CID/photos)" "400|415"
check "upload >5MB rejected" "$(code -b pj1 -F 'photo=@big.png;type=image/png' $B/books/$CID/photos)" "400|413"
check "upload wrong field 400" "$(code -b pj1 -F 'file=@ok.png' $B/books/$CID/photos)" 400
check "upload two files 400" "$(code -b pj1 -F 'photo=@ok.png' -F 'photo=@ok.png' $B/books/$CID/photos)" 400
check "upload by other user 404" "$(code -b pj2 -F 'photo=@ok.png' $B/books/$CID/photos)" "403|404"
check "upload anonymous 401" "$(code -F 'photo=@ok.png' $B/books/$CID/photos)" 401
for i in 2 3 4 5; do code -b pj1 -F photo=@ok.png $B/books/$CID/photos >/dev/null; done
check "6th photo rejected" "$(code -b pj1 -F photo=@ok.png $B/books/$CID/photos)" "400|409"
check "photo traversal 404" "$(code "$B/photos/..%2F..%2Fetc%2Fpasswd")" "400|404"
check "photo traversal 2 404" "$(code --path-as-is "$B/photos/../../etc/passwd")" "400|404"
check "photo served" "$(curl -s -o /dev/null -w '%{http_code}' $B/photos/$PID)" 200
check "other user cannot delete photo" "$(code -b pj2 -X DELETE $B/books/$CID/photos/$PID)" "403|404"
check "photo of other copy id 404" "$(code -b pj1 -X DELETE $B/books/00000000-0000-4000-8000-000000000999/photos/$PID)" "403|404"

# Search
check "search sql injection safe" "$(code "$B/search/books?q=%27%20OR%201%3D1%20--"; field "d['data']['total']")" "2000"
check "search percent not wildcard" "$(code "$B/search/books?q=%25"; field "d['data']['total']")" "2000"
check "search underscore not wildcard" "$(code "$B/search/books?q=_"; field "d['data']['total']")" "2000"
check "search finds book" "$(code "$B/search/books?q=probe"; field "d['data']['total']")" "2001"
check "search page=0 400" "$(code "$B/search/books?page=0")" 400
check "search pageSize huge 400" "$(code "$B/search/books?pageSize=1000000")" "400"
check "search page=abc 400" "$(code "$B/search/books?page=abc")" 400
check "search page overflow 400" "$(code "$B/search/books?page=99999999999999999999")" 400
check "search long q 400" "$(code "$B/search/books?q=$(python -c "print('a'*500)")")" 400
check "search bad genre 400" "$(code "$B/search/books?genre=NOPE")" 400
check "search bad areaId 400" "$(code "$B/search/books?areaId=-1")" 400
check "search unicode ok" "$(code "$B/search/books?q=%D9%83%D8%AA%D8%A7%D8%A8")" 200

# Wishlist
check "wish add" "$(code -b pj1 -H "$J" -d '{"kind":"TITLE","title":"Emma"}' $B/wishlist)" 201
WID=$(field "d['data']['id']")
check "wish duplicate 409" "$(code -b pj1 -H "$J" -d '{"kind":"TITLE","title":"  emma "}' $B/wishlist)" 409
check "wish mixed fields 400" "$(code -b pj1 -H "$J" -d '{"kind":"TITLE","title":"X","genre":"MYSTERY"}' $B/wishlist)" "400|201"
check "wish bad kind 400" "$(code -b pj1 -H "$J" -d '{"kind":"EVIL","title":"X"}' $B/wishlist)" 400
check "wish delete by other 404" "$(code -b pj2 -X DELETE $B/wishlist/$WID)" "403|404"
check "wish list isolated" "$(code -b pj2 $B/wishlist; field "len(d['data'])")" "2000"

# Concurrency
check "create race book" "$(code -b pj1 -H "$J" -d "$BOOK" $B/books)" 201
RID=$(field "d['data']['id']")
for i in $(seq 1 10); do curl -s -o /dev/null -w '%{http_code}
' -b pj1 -F photo=@ok.png $B/books/$RID/photos & done > race.txt; wait
check "parallel uploads capped at 5" "$(grep -c 201 race.txt)" 5
for i in $(seq 1 5); do curl -s -o /dev/null -w '%{http_code}
' -b pj2 -H "$J" -d '{"kind":"INTEREST","genre":"POETRY"}' $B/wishlist & done > race.txt; wait
check "parallel duplicate wishes: one wins" "$(grep -c 201 race.txt)" 1
check "parallel duplicate wishes: rest 409" "$(grep -c 409 race.txt)" 4

# HTTP policy
check "unknown route json 404" "$(code $B/nope; field "d['error']['code']")" "404NOT_FOUND"
check "wrong method" "$(code -X PUT $B/books)" "404|405"
check "body over limit 413" "$(python -c "print('{\"a\":\"' + 'x'*7000000 + '\"}')" > huge.json; code -H "$J" --data-binary @huge.json $B/auth/register)" "413|400"
check "server alive at end" "$(code $B/meeting-areas)" 200
check "no stack traces or SQL in errors" "$(grep -ciE 'select |insert |exception|\.cc|/src/' pbody.json)" 0

# Rate limiting last, since it locks the IP
for i in 1 2 3 4 5; do code -H "$J" -d '{"email":"p1@example.com","password":"wrong-pass"}' $B/auth/login >/dev/null; done
check "login per-email limit 429" "$(code -H "$J" -d '{"email":"p1@example.com","password":"wrong-pass"}' $B/auth/login)" 429
check "Retry-After present" "$(curl -s -D - -o /dev/null -H "$J" -d '{"email":"p1@example.com","password":"x"}' $B/auth/login | grep -ci retry-after)" 1

echo "failures: $fails"
[ "$fails" -eq 0 ]
