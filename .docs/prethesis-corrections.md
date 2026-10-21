# Pre-thesis corrections

Everything that changed in the pre-thesis baseline, and every correction to pre-thesis text, in one place. The baseline is the tag `v1-prethesis` (commit `6f7b884`). The thesis phase starts from the branch `thesis`.

Super plan P0 adds four text corrections later (section 4). Section 1 to 3 are done.

---

## 1. Code fixes (bug sweep, 2026-10-21)

Plan: [works/21-10-bugs-sweep-pre-thesis.md](works/21-10-bugs-sweep-pre-thesis.md). Findings and evidence: [Pre-thesis check.md](Pre-thesis%20check.md).

| ID | Commit | What changed | Behavior change you can see |
|---|---|---|---|
| T7, B3, N1 | `c4d5d46` | Bad cursors and IDs give 400. Missing or deleted posts and comments give 404. Prisma errors map to 404, 409 or 400. Text limits (post 255, comment 1000) are checked. Empty posts and comments are refused. | Fewer 500 answers. A deleted post can no longer be liked, saved, reposted or commented. |
| T1, T2 | `e48a289` | One `engagementSelect()` defines the counts and the viewer flags for posts, profile tabs, search and hashtag pages. | **`_count.rePosts` and `_count.comments` drop deleted rows.** The Explore score reads them, so **BL2 changes only when soft-deleted reposts or comments exist**. |
| T5, T8, T9 | `db5a8f4` | No self-follow or self-block, unknown user gives 404. Recommendations and Connect rank by followers received, hide blocked peers and banned users. | **Recommendations change order and members.** Connect still shows `_count.followers`, now with the real number. |
| T10, S2, S3 | `53fb757` | Pending community posts are visible only to the author and the community owner or mods. The public profile has no email, `emailVerified` or `banned`. `BannedUserGuard` is on post create, comment create, uploads, community create and all DM routes. | Pending posts give 404 to everyone else. Banned users get 403 on those writes. |
| N4 | `91f0aea` | Avatar and cover (users and communities) must be an uploaded file name or an https URL on `res.cloudinary.com` or `picsum.photos`. | Other values give 400. The host list must match `next.config.ts` (a test checks it). |
| S1, S5 (socket) | `3b62928` | The server tells who a socket is from the login cookie (and the logout blacklist), joins it to its own room, checks conversation membership, and ignores the username a client sends. `sendNotification` is removed. | Logged-out tokens cannot connect. `newUser` no longer chooses the room. |
| B4 | `5db92b8` | `jsonOrThrow()` makes a 429 or 500 answer an error in the home feed, the hashtag page and the followers lists. | A rate-limited feed shows "Something went wrong!" and keeps the page, instead of the crash screen. |
| (setup) | `84e84a7` | Jest unit and integration tests, `app.setup.ts`, the two verify scripts. | None. |

Two points about the baseline numbers for the thesis:
- The thesis baselines BL0 to BL5 are computed from events by the harness. The fixes above change the **live** counts only when deleted rows exist, and the synthetic generator writes none. So the harness results do not change.
- The pre-thesis Explore numbers in the old report were measured with the buggy counts and with the old rate limit. They are not comparable with new runs anyway (see section 4).

### Before and after

The same script ran on the unfixed code and on the final code. Output: [works/21-10-bugs-sweep-before.txt](works/21-10-bugs-sweep-before.txt) and [works/21-10-bugs-sweep-after.txt](works/21-10-bugs-sweep-after.txt).

| | Passed | Failed |
|---|---|---|
| Before (`84e84a7`, unfixed code) | 42 | 53 |
| After (`5db92b8`, on a freshly seeded database) | 95 | 0 |

Backend tests on the final code: 99 unit tests and 108 integration tests, all passing. Browser checks (Chrome): B4, T1 and T8 were confirmed in the UI. The page sweep returned the expected status codes on all 26 checks.

---

## 2. Found during the sweep, not fixed

- **Comment reply count.** `_count.replies` in `comments.service.ts` also counts deleted replies, the same bug as T1. The UI only uses it at the nesting limit, so it was left alone.
- **Pending posts and comments.** Anyone can still read the comments of a pending post and like it by ID. The post itself is hidden now. P6 must add `isApproved = true` to `buildPool` when community posts enter the candidate pool.
- **Dependencies.** New dev dependencies must be installed with `npm install --legacy-peer-deps` (`@nestjs/core` 10 and `@nestjs/websockets` 11 conflict). This was already true before the sweep.

Everything else on the known-limits list (S4, S5 on HTTP routes, S6, B1, B2, B5 to B10, N2, N3, N5 to N10, T3, T4, T6) is unchanged. Where each one is handled is in the plan, section 9.

---

## 3. Documentation fixed

- `CLAUDE.md`: the seed makes `user1` to `user50` (it said `user1` to `user5`). The test commands, the verify scripts and the `--legacy-peer-deps` note are added, and "There is no test suite" is removed.

---

## 4. Still to write in P0 (pre-thesis text)

These stay as pre-thesis text and are only listed here, as the super plan says:

1. The LightFM sentence (`Latex/chapters/conclusion.tex:88`, `docs/chapter7_conclusion.md:64`).
2. The abstract numbers that do not match chapter 5.
3. The k6 failure explanation. New evidence: the rate limit is counted **per route** per IP, so a k6 run on one Explore route fails fast under the old limit of 120 per minute.
4. The NFR doc that still says 120 per minute.

Also found by the run, for the same list:
- `README.md` says `npm run dev:reset` for local work. It runs `db push --force-reset`, which skips the migrations.
- `README.md` calls Explore "trending by likes". The code uses the weighted score.
- `docs/testcase.md` says verify returns a session cookie. The code only returns `ok`.
- `docs/feed_implementation_now.md` says page size 3. The code uses 10.
