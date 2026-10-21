#!/usr/bin/env bash
#
# Replays the curl checks of the pre-thesis bug sweep against a RUNNING backend.
# Plan: .docs/works/21-10-bugs-sweep-pre-thesis.md
#
# Every FIX row asserts the behaviour we want AFTER the fix, so on the old code
# those rows print FAIL. The "still works" rows (W..) must PASS before and after.
#
# Needs: curl, jq, node, and Docker with the compose `db` container (to read the
# email codes and to ban a test user). Override with DB_CONTAINER / PSQL.
#
# START THE BACKEND SAFELY (the real .env has live SMTP and Cloudinary values):
#   cd apps/backend && npm run build
#   export DATABASE_URL=... REDIS_URL=... JWT_SECRET=... FRONTEND_URL=http://localhost:3000
#   export SMTP_HOST=127.0.0.1 SMTP_PORT=1 SMTP_USERNAME= SMTP_PASSWORD=   # no real email
#   export CLOUDINARY_CLOUD_NAME= UPLOAD_DIR=/tmp/breadit-uploads          # no Cloudinary
#   node dist/main.js
#
# Usage:  scripts/verify-bug-sweep.sh            (about 1 minute)
# Notes:  login, register and verify are limited to 10 per minute per IP. The script
#         uses 6 logins. If you run it twice in a row it waits for the limit to reset.
#         It leaves test users named sw_*_<run id> in the database (local data only).
#         Set SKIP_SOCKET=1 to skip the Socket.IO checks.

set -u

BASE_URL=${BASE_URL:-http://localhost:4000}
DB_CONTAINER=${DB_CONTAINER:-breadit-db-1}
PSQL=${PSQL:-docker exec -i $DB_CONTAINER psql -U breadit -d breadit -At}
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@breadit.dev}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-123456}
RUN=$(od -An -N3 -tx1 /dev/urandom | tr -d ' \n')
WORK=$(mktemp -d)
HERE=$(cd "$(dirname "$0")" && pwd)

PASS=0
FAIL=0
SKIP=0

cleanup() {
  # An evil avatar URL would crash pages for other users (finding N4), so always reset it.
  sql "update \"User\" set img = null where img like 'https://evil.example%'" >/dev/null 2>&1
  sql "update \"User\" set cover = null where cover like 'javascript:%'" >/dev/null 2>&1
  sql "update \"Community\" set img = null where img like 'https://evil.example%'" >/dev/null 2>&1
  rm -rf "$WORK"
}
trap cleanup EXIT

sql() { $PSQL -c "$1"; }

# ---------- helpers ----------

# http JAR METHOD PATH [curl args...]  ->  sets CODE and BODY. JAR "-" means no cookie.
http() {
  local jar=$1 method=$2 path=$3
  shift 3
  local args=(-s -X "$method" -w $'\n%{http_code}')
  if [ "$jar" != "-" ]; then args+=(-b "$WORK/$jar.jar" -c "$WORK/$jar.jar"); fi
  local out
  out=$(curl "${args[@]}" "$@" "$BASE_URL$path")
  CODE=${out##*$'\n'}
  BODY=${out%$'\n'*}
}

# jsend JAR METHOD PATH [json]
jsend() {
  local d=${4:-'{}'}
  http "$1" "$2" "$3" -H 'Content-Type: application/json' -d "$d"
}

check() { # check ID description expected actual
  if [ "$4" = "$3" ]; then
    PASS=$((PASS + 1)); printf 'PASS  %-4s %s\n' "$1" "$2"
  else
    FAIL=$((FAIL + 1)); printf 'FAIL  %-4s %s (expected %s, got %s)\n' "$1" "$2" "$3" "$4"
  fi
}

skip() { SKIP=$((SKIP + 1)); printf 'SKIP  %-4s %s\n' "$1" "$2"; }

token_of() { awk '$6=="breadit_session"{print $7}' "$WORK/$1.jar" | tail -1; }

# mkuser NAME -> register, read the email code from the database, verify, log in
mkuser() {
  local name="sw_$1_$RUN" email="sw_$1_$RUN@example.test" tries=0
  while :; do
    jsend - POST /api/auth/register "{\"username\":\"$name\",\"email\":\"$email\",\"password\":\"secret1\"}"
    if [ "$CODE" = "429" ] && [ $tries -lt 1 ]; then
      echo "  (rate limited, waiting 61 s)"; sleep 61; tries=$((tries + 1)); continue
    fi
    break
  done
  local code
  code=$(sql "select split_part(token, ':', 3) from \"VerificationToken\" where identifier='email-verify:$email'")
  jsend - POST /api/auth/verify "{\"email\":\"$email\",\"code\":\"$code\"}"
  rm -f "$WORK/$1.jar"
  jsend "$1" POST /api/auth/login "{\"email\":\"$email\",\"password\":\"secret1\"}"
  local id
  id=$(sql "select id from \"User\" where username='$name'")
  printf -v "${1}_NAME" '%s' "$name"
  printf -v "${1}_ID" '%s' "$id"
}

postid() { echo "$BODY" | jq -r '.id // empty'; }
long() { head -c "$1" /dev/zero | tr '\0' 'x'; }

# ---------- setup ----------

for tool in curl jq node; do
  command -v $tool >/dev/null || { echo "missing tool: $tool"; exit 2; }
done
http - GET /api/health
[ "$CODE" = "200" ] || { echo "backend not reachable at $BASE_URL (HTTP $CODE)"; exit 2; }

sql "select 1" >/dev/null 2>&1 || { echo "cannot run psql (container $DB_CONTAINER). Start it with: docker compose up db redis -d"; exit 2; }

echo "== setup (run $RUN)"
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' | base64 --decode > "$WORK/t.png"
for u in alice bob carol dave mod; do mkuser $u; done
HAVE_ADMIN=1
jsend admin POST /api/auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
[ "$CODE" = "200" ] || { HAVE_ADMIN=0; echo "  (no admin login, admin rows will be skipped)"; }

# ---------- W: still works (must PASS before and after) ----------

echo "== W: still works"
http - GET /api/posts
check W01 "guest feed returns 200 with 10 posts" "200 10" "$CODE $(echo "$BODY" | jq '.posts|length')"
http - GET "/api/posts?feed=explore"
check W02 "explore feed returns 200" "200" "$CODE"
http alice POST /api/posts -F "desc=hello sweep $RUN #sweep"
check W03 "create post" "201" "$CODE"; P=$(postid)
http alice GET "/api/posts/$P"
check W04 "get post by id" "200" "$CODE"
http bob PATCH "/api/posts/$P" -F "desc=hijack"
check W05 "other user cannot edit" "403" "$CODE"
http alice PATCH "/api/posts/$P" -F "desc=edited sweep $RUN"
check W06 "owner edits own post" "200" "$CODE"
jsend bob POST "/api/posts/$P/like"
check W07 "like toggles on" "true" "$(echo "$BODY" | jq -r .liked)"
jsend bob POST "/api/posts/$P/like" >/dev/null
jsend bob POST "/api/posts/$P/save"
check W08 "save works" "200" "$CODE"
jsend bob POST "/api/posts/$P/save" >/dev/null
http bob POST "/api/posts/$P/comments" -F "body=first comment"
check W09 "create comment" "201" "$CODE"; C1=$(postid)
http carol POST "/api/posts/$P/comments" -F "body=a reply" -F "parentCommentId=$C1"
check W10 "create reply" "201" "$CODE"
jsend alice POST "/api/users/$bob_ID/follow"
check W11 "follow" "true" "$(echo "$BODY" | jq -r .following)"
jsend alice POST "/api/users/$bob_ID/follow"
check W12 "unfollow" "false" "$(echo "$BODY" | jq -r .following)"
jsend alice POST "/api/users/$carol_ID/block"
check W13 "block" "true" "$(echo "$BODY" | jq -r .blocked)"
jsend alice POST "/api/users/$carol_ID/block" >/dev/null
jsend alice POST /api/conversations "{\"targetUserId\":\"$bob_ID\"}"
CV=$(echo "$BODY" | jq -r .id)
check W14 "create conversation" "201 true" "$CODE $([ "$CV" != null ] && echo true)"
jsend alice POST "/api/conversations/$CV/messages" '{"body":"hi bob"}'
check W15 "send message" "201" "$CODE"
http bob GET "/api/conversations/$CV/messages"
check W16 "read messages" "200 1" "$CODE $(echo "$BODY" | jq '.items|length')"
http alice POST /api/uploads -F "file=@$WORK/t.png;type=image/png"
check W17 "upload an image" "201" "$CODE"
http alice GET /api/auth/me
check W18 "me" "200" "$CODE"
http - GET "/api/search?q=sweep"
check W19 "search" "200" "$CODE"
http - GET /api/hashtags/trending
check W20 "trending" "200" "$CODE"
http - GET /api/communities
check W21 "list communities" "200" "$CODE"
http alice GET /api/notifications
check W22 "notifications" "200" "$CODE"
if [ $HAVE_ADMIN = 1 ]; then
  http admin GET /api/admin/users
  check W23 "admin user list" "200" "$CODE"
  http alice GET /api/admin/users
  check W24 "non-admin gets 403 on admin API" "403" "$CODE"
else skip W23 "admin user list"; skip W24 "admin 403"; fi
http alice POST /api/posts -F "desc=to delete"; DEL=$(postid)
http bob DELETE "/api/posts/$DEL"
check W25 "other user cannot delete" "403" "$CODE"
http alice DELETE "/api/posts/$DEL"
check W26 "owner deletes own post" "200" "$CODE"
http alice POST /api/posts -F "desc=$(long 255)"
check W27 "255-char post is accepted" "201" "$CODE"
http alice POST /api/posts -F "file=@$WORK/t.png;type=image/png"
check W28 "post with only an image is accepted" "201" "$CODE"
http alice POST /api/posts -F "rePostId=$P"
check W29 "plain repost via rePostId is accepted" "201" "$CODE"
jsend - POST /api/auth/verify "{\"email\":\"$alice_NAME@example.test\",\"code\":\"000000\"}"
check W30 "wrong email code" "400" "$CODE"

# ---------- T1, T2: counts ----------

echo "== T1, T2: counts"
http alice POST /api/posts -F "desc=count target $RUN"; PC=$(postid)
jsend bob POST "/api/posts/$PC/repost" >/dev/null
jsend bob POST "/api/posts/$PC/repost" >/dev/null
http bob GET "/api/posts/$PC"
check T1 "after un-repost: _count.rePosts" "0" "$(echo "$BODY" | jq '._count.rePosts')"
check T1 "after un-repost: my repost flag is empty" "0" "$(echo "$BODY" | jq '.rePosts|length')"
http alice POST "/api/posts/$PC/comments" -F "body=top"; CT=$(postid)
http bob POST "/api/posts/$PC/comments" -F "body=reply" -F "parentCommentId=$CT"; CR=$(postid)
http bob DELETE "/api/comments/$CR"
http bob GET "/api/posts/$PC"
check T2 "after deleting the reply: _count.comments" "1" "$(echo "$BODY" | jq '._count.comments')"

# ---------- T5: follow and block rules ----------

echo "== T5: follow and block rules"
jsend bob POST "/api/users/$bob_ID/follow"
check T5 "self-follow" "400" "$CODE"
jsend bob POST /api/users/no_such_user_id/follow
check T5 "follow unknown user" "404" "$CODE"
jsend bob POST "/api/users/$bob_ID/block"
check T5 "self-block" "400" "$CODE"
jsend bob POST /api/users/no_such_user_id/block
check T5 "block unknown user" "404" "$CODE"
# clean up if the old code accepted them
sql "delete from \"Follow\" where \"followerId\" = \"followingId\"" >/dev/null
sql "delete from \"Block\" where \"blockerId\" = \"blockedId\"" >/dev/null

# ---------- T7, B3, N1: input checks and error codes ----------

echo "== T7, B3, N1: input checks"
http - GET /api/posts/abc
check T7 "GET /api/posts/abc" "400" "$CODE"
http - GET /api/posts/99999999
check W31 "GET missing post is 404" "404" "$CODE"
jsend bob POST /api/posts/99999999/like
check T7 "like a missing post" "404" "$CODE"
jsend bob POST /api/posts/99999999/save
check T7 "save a missing post" "404" "$CODE"
jsend bob POST /api/posts/99999999/repost
check T7 "repost a missing post" "404" "$CODE"
http alice POST /api/posts -F "desc=doomed $RUN"; D=$(postid)
http alice DELETE "/api/posts/$D" >/dev/null
jsend bob POST "/api/posts/$D/like"
check T7 "like a deleted post" "404" "$CODE"
jsend bob POST "/api/posts/$D/save"
check T7 "save a deleted post" "404" "$CODE"
jsend bob POST "/api/posts/$D/repost"
check T7 "repost a deleted post" "404" "$CODE"
http bob POST "/api/posts/$D/comments" -F "body=ghost"
check T7 "comment on a deleted post" "404" "$CODE"
http bob POST "/api/posts/$P/comments" -F "body=will be deleted"; CD=$(postid)
http bob DELETE "/api/comments/$CD" >/dev/null
jsend alice POST "/api/comments/$CD/like"
check T7 "like a deleted comment" "404" "$CODE"
jsend bob POST "/api/posts/$P/report" '{}'
check T7 "report with no reason" "400" "$CODE"
jsend bob POST /api/posts/99999999/report '{"reason":"x"}'
check T7 "report a missing post" "404" "$CODE"
http bob POST /api/posts -F "rePostId=99999999"
check T7 "repost via rePostId of a missing post" "404" "$CODE"
http bob GET "/api/notifications?cursor=abc"
check T7 "notifications with cursor=abc" "400" "$CODE"
http - GET "/api/users/$alice_NAME/posts?tab=posts&cursor=abc"
check T7 "profile posts with cursor=abc" "400" "$CODE"
http - GET "/api/hashtags/sweep/posts?cursor=abc"
check T7 "hashtag posts with cursor=abc" "400" "$CODE"
if [ $HAVE_ADMIN = 1 ]; then
  http admin GET "/api/admin/users?cursor=abc"
  check T7 "admin users with cursor=abc" "400" "$CODE"
else skip T7 "admin users with cursor=abc"; fi
http bob POST /api/posts -F "desc=$(long 300)"
check B3 "300-char post" "400" "$CODE"
http bob POST "/api/posts/$P/comments" -F "body=$(long 1200)"
check B3 "1200-char comment" "400" "$CODE"
jsend bob POST "/api/posts/$P/repost" "{\"desc\":\"$(long 400)\"}"
check B3 "400-char quote repost" "400" "$CODE"
http bob POST /api/posts -F "isSensitive=false"
check N1 "empty post" "400" "$CODE"
http bob POST "/api/posts/$P/comments" -F "body="
check N1 "empty comment" "400" "$CODE"

# ---------- T8, T9: recommendations ----------

echo "== T8, T9: recommendations and connect"
EXPECT=$(sql "select u.username from \"User\" u where u.id <> '$carol_ID' and u.banned = false order by (select count(*) from \"Follow\" f where f.\"followingId\" = u.id) desc, u.id asc limit 3" | paste -sd, -)
http carol GET /api/users/recommendations
GOT=$(echo "$BODY" | jq -r '[.[].username]|join(",")')
check T8 "top 3 recommendations are the most followed users" "$EXPECT" "$GOT"
TOP=$(echo "$BODY" | jq -r '.[0].id')
TOPNAME=$(echo "$BODY" | jq -r '.[0].username')
jsend carol POST "/api/users/$TOP/block" >/dev/null
http carol GET /api/users/recommendations
check T9 "blocked user is not in recommendations" "false" "$(echo "$BODY" | jq --arg n "$TOPNAME" '[.[].username]|index($n) != null')"
sql "update \"User\" set banned = true where id = '$dave_ID'" >/dev/null
SEEN_BLOCKED=false; SEEN_BANNED=false; cur=1
while [ $cur -le 20 ]; do
  http carol GET "/api/users/connect?cursor=$cur"
  echo "$BODY" | jq -e --arg n "$TOPNAME" '[.users[].username]|index($n) != null' >/dev/null && SEEN_BLOCKED=true
  echo "$BODY" | jq -e --arg n "$dave_NAME" '[.users[].username]|index($n) != null' >/dev/null && SEEN_BANNED=true
  [ "$(echo "$BODY" | jq -r .hasMore)" = "true" ] || break
  cur=$((cur + 1))
done
check T9 "blocked user is not on any connect page" "false" "$SEEN_BLOCKED"
check T9 "banned user is not on any connect page" "false" "$SEEN_BANNED"
jsend carol POST "/api/users/$TOP/block" >/dev/null   # unblock again

# ---------- T10, S2, S3 ----------

echo "== T10, S2, S3: visibility, privacy, banned users"
SLUG="sw-$RUN"
jsend mod POST /api/communities "{\"name\":\"Sweep $RUN\",\"slug\":\"$SLUG\"}"
CID=$(echo "$BODY" | jq -r .id)
jsend bob POST "/api/communities/$CID/join" >/dev/null
http bob POST /api/posts -F "desc=pending $RUN" -F "communityId=$CID"; PP=$(postid)
check T10 "member post in a community is pending" "false" "$(sql "select \"isApproved\" from \"Post\" where id=$PP" | sed 's/f/false/;s/t/true/')"
http carol GET "/api/posts/$PP"
check T10 "outsider cannot open a pending post" "404" "$CODE"
http - GET "/api/posts/$PP"
check T10 "guest cannot open a pending post" "404" "$CODE"
http bob GET "/api/posts/$PP"
check T10 "the author can open it" "200" "$CODE"
http mod GET "/api/posts/$PP"
check T10 "the community owner can open it" "200" "$CODE"
jsend carol POST "/api/posts/$PP/like" >/dev/null
http - GET "/api/users/$carol_NAME/posts?tab=likes"
check T10 "Likes tab does not list a pending post" "false" "$(echo "$BODY" | jq --argjson p "$PP" '[.posts[].id]|index($p) != null')"

http - GET "/api/users/$bob_NAME"
check S2 "guest sees no email" "false" "$(echo "$BODY" | jq 'has("email") and .email != null')"
check S2 "guest sees no emailVerified" "false" "$(echo "$BODY" | jq 'has("emailVerified") and .emailVerified != null')"
check S2 "guest sees no banned flag" "false" "$(echo "$BODY" | jq 'has("banned")')"
http bob GET "/api/users/$bob_NAME"
check S2 "the user still sees their own email" "true" "$(echo "$BODY" | jq '.email != null')"

# bob makes a conversation with dave before dave is banned (dave is banned since the T9 step)
sql "update \"User\" set banned = false where id = '$dave_ID'" >/dev/null
jsend bob POST /api/conversations "{\"targetUserId\":\"$dave_ID\"}"; CVD=$(echo "$BODY" | jq -r .id)
sql "update \"User\" set banned = true where id = '$dave_ID'" >/dev/null
http dave POST /api/posts -F "desc=posted while banned"
check S3 "banned user: create post" "403" "$CODE"
http dave POST "/api/posts/$P/comments" -F "body=commented while banned"
check S3 "banned user: create comment" "403" "$CODE"
http dave POST /api/uploads -F "file=@$WORK/t.png;type=image/png"
check S3 "banned user: upload" "403" "$CODE"
jsend dave POST /api/communities "{\"name\":\"Banned $RUN\",\"slug\":\"banned-$RUN\"}"
check S3 "banned user: create community" "403" "$CODE"
jsend dave POST /api/conversations "{\"targetUserId\":\"$alice_ID\"}"
check S3 "banned user: create conversation" "403" "$CODE"
jsend dave POST "/api/conversations/$CVD/messages" '{"body":"dm while banned"}'
check S3 "banned user: send message" "403" "$CODE"

# ---------- N4: avatar URLs ----------

echo "== N4: avatar and cover URLs"
jsend bob PATCH /api/users/me '{"img":"https://evil.example/x.png"}'
check N4 "avatar on an unknown host" "400" "$CODE"
sql "update \"User\" set img = null where img like 'https://evil.example%'" >/dev/null
jsend bob PATCH /api/users/me '{"cover":"javascript:alert(1)"}'
check N4 "cover with a javascript: URL" "400" "$CODE"
jsend bob PATCH /api/users/me '{"img":"abc123.jpg"}'
check N4 "avatar as an uploaded file name" "200" "$CODE"
jsend bob PATCH /api/users/me '{"img":"https://picsum.photos/seed/a/200/200"}'
check N4 "avatar on an allowed host" "200" "$CODE"
jsend mod PATCH "/api/communities/$CID" '{"img":"https://evil.example/x.png"}'
check N4 "community image on an unknown host" "400" "$CODE"
sql "update \"User\" set img = null, cover = null where username = '$bob_NAME'" >/dev/null
echo "  B4 (feed crash on HTTP 429): manual browser check, see the plan, section 8."

# ---------- S1: sockets ----------

if [ "${SKIP_SOCKET:-0}" = "1" ]; then
  skip S1 "socket checks (SKIP_SOCKET=1)"
else
  echo "== S1: sockets"
  jsend bob POST /api/conversations "{\"targetUserId\":\"$carol_ID\"}"; CVS=$(echo "$BODY" | jq -r .id)
  STALE=$(token_of carol)                          # logout clears the cookie jar, so read it first
  jsend carol POST /api/auth/logout >/dev/null     # carol's token is now blacklisted
  jsend carol POST /api/auth/login "{\"email\":\"$carol_NAME@example.test\",\"password\":\"secret1\"}"
  OUT=$(BASE_URL=$BASE_URL ALICE_TOKEN=$(token_of alice) BOB_TOKEN=$(token_of bob) CAROL_TOKEN=$(token_of carol) \
        STALE_TOKEN=$STALE CONV_ID=$CVS BOB_ID=$bob_ID BOB_NAME=$bob_NAME CAROL_NAME=$carol_NAME \
        node "$HERE/verify-socket.cjs" 2>&1)
  echo "$OUT"
  P_N=$(echo "$OUT" | grep -c '^PASS'); F_N=$(echo "$OUT" | grep -c '^FAIL')
  PASS=$((PASS + P_N)); FAIL=$((FAIL + F_N))
fi

# ---------- summary ----------

echo
echo "== $PASS passed, $FAIL failed, $SKIP skipped"
[ "$FAIL" = "0" ]
