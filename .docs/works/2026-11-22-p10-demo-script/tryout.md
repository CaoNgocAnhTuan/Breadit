# Tryout of the demo script

Plan steps 4 and 5, run on 2026-11-22 by the Sonnet agent. Outputs are shortened. Node 22.23.4, Docker db and redis up. Before the tryout: Redis database 0 had 31 keys, database 3 had 0. `public` had 121 users and 930 posts, `eval_load` 1000 users and 22,212 posts, `it_test` 142 users and 162 posts.

## Step 4: start, users, stop

### `npm run demo:start` (exit 0, 40 s in all)

```
== load syn-W2M-M into eval_demo, rebased to 2026-11-22T07:09:33Z ==
User 1000 · Follow 12126 · Community 20 · CommunityMember 1773 · Post 22212 (20000 posts, 2212 reposts)
Like 16616 · Comment 3430 · shift 5641790 s · latest time 2026-11-22T07:09:33Z · run time 3.8 s
== admin account ==         added demo_admin (role ADMIN)
== Redis database 3: empty ==
== backend on :4000 ==      backend up on http://localhost:4000 (feed cache on)
== frontend on :3000 ==     frontend answers on /sign-in
== demo users ==
little history (1-4): u0000000787   history 2, follows 273
  chrono     19994 19992 19990 19984 19982 19978 19976 19969 19966 19964
  engagement 19981 19957 19821 19975 19954 19839 20000 19999 19998 19997
  social     19997 19930 19850 19820 19493 19440 19161 18964 19160 18743
  social shares 0 of 10 with chrono and 1 of 10 with engagement
long history (20 or more): u0000000064   history 28, follows 426
  chrono     19994 19992 19991 19987 19986 19985 19981 19980 19979 19977
  engagement 19981 19957 19821 19975 19954 19839 20000 19999 19998 19997
  social     19479 19445 19168 19381 18974 19185 19142 19192 18990 18733
  social shares 0 of 10 with chrono and 0 of 10 with engagement
== warm-up of the pages (first compile) ==
  /sign-in 200 0.0 s · / 200 15.6 s · /?feed=explore 200 4.7 s · /u0000000064 200 1.3 s
  /messages 200 0.4 s · /notifications 200 0.2 s · /admin-console 200 0.6 s · /admin-console/users 200 0.0 s
== the demo is up (start took 40 s) ==
rebase time : 2026-11-22T07:09:33Z
schema      : eval_demo   Redis database: 3
frontend    : http://localhost:3000     backend : http://localhost:4000
admin       : demo-admin@example.com (username demo_admin) / password
user, long history   (28, 426 follows)  : u0000000064@example.com / password
user, little history (2, 273 follows)   : u0000000787@example.com / password
```

- After start and the `users` runs: Redis database 0 still had 31 keys (DW4), database 3 had 13.
- `git status` after the run: only `package.json`, `scripts/demo/` and the task folder. `next dev` changed no tracked file.

### `npm run demo:users` twice

Both runs exit 0 and print the same two users (`u0000000787` with history 2 and 273 follows, `u0000000064` with history 28 and 426 follows) and the same ids for all three algos. The first candidate of each group passed, so each run made 2 logins and printed no "skipped" line. For each user the three lists are not all the same order (DW5).

### `npm run demo:stop`

```
bans: nothing to do
frontend: stopped (process group 5970)
backend: backend stopped
redis: database 3 emptied
eval_demo is kept; the next start empties it
```

Exit 0. `lsof` on :3000 and :4000 shows nothing, `run-safe.sh status` says "backend not running", Redis database 3 has 0 keys, and no `next` process is left.

### `npm run demo:stop` a second time

```
bans: nothing to do
frontend: nothing to do
backend: nothing to do
redis: database 3 emptied
```

Exit 0.

### Refusals (F1, F2, F14)

| Try | Result |
|---|---|
| a Node process listens on :4000, then `demo:start` | exit 1: `port 4000 is in use. The demo starts its own server and never reuses one ... Stop it (for example: bash .claude/hooks/run-safe.sh stop)` and the `lsof` line. Nothing loaded: `eval_demo."User"` still had 1001 rows (1000 and the admin), so it was not reloaded |
| a Node process listens on :3000, then `demo:start` | exit 1 with the same message for port 3000 and the `lsof` line |
| `docker` not on PATH, then `demo:start` | exit 1: `Docker does not answer. Start Docker, then: docker compose up db redis -d` |
| a Node process on :3000, then `demo:stop` | prints `port 3000 is still in use (F14)` with the `lsof` line, exits 1. Without the stranger it exits 0 |

The redis container was not stopped in this tryout (A2 of the plan does that in step 8). The test listeners were plain Node servers, not the backend of `run-safe.sh`, so `public` and Redis database 0 were never used.
