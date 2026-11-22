# Demo rehearsal (task p10-demo-script, plan step 7)

2026-11-22, by Opus. `npm run demo:start` at 07:16:50Z (rebase time), 17 s. Schema `eval_demo`, Redis database 3. Demo users: long `u0000000064` (history 28, 426 follows), little `u0000000787` (history 2, 273 follows), admin `demo_admin`.

**How it was played.** One Chrome tab (Claude in Chrome) is window A. Window B is `peer.mjs` (the extension has one cookie jar). For the ban step the roles swap: the tab signs in as the little user and `peer.mjs demo_admin ban u0000000787 --force` is the admin; the admin UI path was walked in the tab before that (6a).

**How clicked.** Steps 1–5 with real mouse clicks of the extension. From step 6a on, the extension's mouse events stopped reaching the page (a capture `mousedown` listener on `document` counted 0 after a click; `document.activeElement` stayed `BODY`), the same tool problem as in `p9-bug-quick-wins`. From there the tab was driven with JavaScript clicks and the native value setter. This is the tool, not the app: the Admin Console link that "did nothing" with the mouse navigated at once with a JavaScript click.

**Before** (counts for A4 and A9): `public` 121 users, 930 posts; `eval_load` 1000 users, 22,212 posts (newest post 2026-09-17, so loaded without `--rebase-to`); Redis database 0: 31 keys, key-list MD5 `52fad79f…`.

| Step | What was done | Expected | Result | Evidence |
|---|---|---|---|---|
| 0 | `npm run demo:start` | exit 0, URLs and logins printed, 8 warm-up lines `ok` | PASS | 17 s; all 8 warm-up lines `ok` (0.0–0.9 s) |
| 1 | tab: `/sign-in` as `u0000000064@example.com` (mouse, typing) | lands on For You with posts | PASS | `/`, first post "Post 19994" by User 811, 18 minutes ago |
| 2 | tab: Chronological, Engagement, Social (mouse) | the order changes each time | PASS | `?algo=chrono` 19994, 19992, 19991, 19987, 19986…; `?algo=engagement` 19981, 19957, 19821, 19975…; `?algo=social` 19479, 19445, 19168, 19381… All three equal the `demo:users` output. Little user: the three lists from `demo:users` (API) differ too (social shares 0/10 with chrono, 1/10 with engagement). Screenshot `screenshot-1795331925761-0.jpg` (Social) |
| 3 | tab: Explore in the left bar (mouse) | 10 posts, newest within the last day | PASS | `/?feed=explore`, 10 posts, newest "2 minutes ago" (Post 20000). Screenshot `screenshot-1795331941146-1.jpg` |
| 4 | B: `dm u0000000064` (creates conversation 1); tab opens `/messages/1`; B: `typing 1`, then `dm 1 "Live message from B"` | typing dots, then the message, no reload | PASS | `MutationObserver`: message at 9.2 s after arming (the B call ran in between); typing dots (3 animated elements) at 1.4 s on a second `typing 1`; 1 navigation entry (no reload). Screenshot `screenshot-1795331965380-2.jpg` |
| 5 | B: `like 19988` (a post of the long user); tab watches the Notifications link | count goes up without a reload; list says "User 787 liked your post" | PASS | link text "Notifications" → "1 Notifications" at 4.4 s, 1 navigation entry; `/notifications` shows "User 787 liked your post · just now". Screenshot `screenshot-1795331993853-3.jpg` |
| 6a | tab: account menu → Logout (mouse); sign in as `demo-admin@example.com`; Admin Console; search `u0000000787`; Ban; then Unban (JavaScript clicks) | the row shows BANNED | PASS | Logout → `/sign-in`; admin lands on `/` with the "Admin Console" link; `/admin-console/users?q=u0000000787` gives one row; after Ban: "User 787 BANNED … Unban"; after Unban: "… Ban". The admin's own Ban button is greyed out. Screenshot `screenshot-1795332083595-4.jpg` |
| 6b | tab: sign in as `u0000000787@example.com`, stay on `/`; B (admin): `ban u0000000787 --force` | the tab is logged out at once, `/sign-in?banned=true`, "Your account has been suspended." | PASS | ban answered 200; 4.6 s after arming (the admin login and ban ran in between) the tab was on `/sign-in?banned=true` with the red text, no manual reload. Screenshot `screenshot-1795332121367-5.jpg` |
| 7 | `npm run demo:stop` | ban lifted, frontend and backend stopped, Redis database 3 empty | PASS | "bans: lifted for u0000000787", "frontend: stopped (process group 17044)", "backend stopped", "redis: database 3 emptied"; :3000 and :4000 free; `run-safe.sh status`: not running |

Screenshots are in the Chrome extension's temp folder (`claude-chrome-screenshots-Q4GDhJ`), not in the repo; row 23 takes its own screenshots.

**After.** `public` 121 / 930, `eval_load` 1000 / 22,212 (unchanged). Redis database 0: 31 keys, the same MD5. `eval_demo`: 0 banned users. Redis database 3: 0 keys.

**Findings.** No new app bug. Two notes for the checklist (added there):
- The admin's For You is empty ("All posts loaded!"), because `demo_admin` follows nobody. Do not show it; go straight to the Admin Console.
- The browser tool problem above does not affect a person with a real mouse; the author's two-window pass before 2026-11-30 checks that.
