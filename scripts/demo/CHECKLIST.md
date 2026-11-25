# Demo checklist

For the presenter. The demo runs on the generated dataset `syn-W2M-M` in the Postgres schema `eval_demo` and Redis database 3. Nothing in `public`, `eval_load` or Redis database 0 is touched.

Two browser windows, so the live parts are real:

- **Window A**: a normal Chrome window.
- **Window B**: a private (incognito) Chrome window. It has its own cookies, so it can be a second user.

Names used below. `npm run demo:start` prints them. For this dataset they are always the same:

- **Long user** (history 20 or more, many follows): `u0000000064`, `u0000000064@example.com`. Plays window A.
- **Little user** (history 1 to 4): `u0000000787`, `u0000000787@example.com`. Plays window B.
- **Admin**: `demo-admin@example.com`, username `demo_admin`.
- The password of all three is `password`.

If `start` prints other users, use those. The steps are the same.

## Before: the day of the demo

0. Run `nvm use`, then `docker compose up db redis -d` if they are not up. Run `npm run demo:start` close to the demo, not the evening before: the newest post is dated at the start time, and Explore shows 7 days.
   - Expected: it takes about 40 s and ends with "the demo is up". It prints the rebase time, `eval_demo`, Redis database 3, `http://localhost:3000`, `http://localhost:4000`, the admin login and the two user logins. All eight warm-up lines say `ok`.
   - If it stops with "port 3000 (or 4000) is in use", stop that server first (`npm run demo:stop` if it is a demo one) and run start again.
   - Never run `npm run load:check` on `eval_demo`: the demo admin is an extra row, so it shows a difference. That is expected, not an error.

## The demo

1. **Sign in.** In A, open `http://localhost:3000/sign-in` and sign in as the long user. In B, open the same page and sign in as the little user.
   - Expected: both land on For You with posts. The sign-in answers at once.
   - If a sign-in says "too many requests": the limit is 10 logins per minute per IP. Wait one minute.

2. **The three algo, side by side.** In A, on For You, click **Chronological**, then **Engagement**, then **Social**. Do the same in B.
   - Expected: the order of the first posts changes with each click. Chronological shows the newest posts first. Engagement shows the same top posts for both users. Social differs for the two users, because it uses who each user follows. In the tryout of 2026-11-22 the Social list shared 0 of 10 posts with Chronological, and 0 or 1 of 10 with Engagement.
   - `npm run demo:users` prints the first 10 post ids of each algo for both users, if you want the numbers.

3. **Explore.** In A, click **Explore** in the left bar.
   - Expected: 10 posts, the newest dated within the last day (the data is rebased to the start time).

4. **A live direct message.** In B, open the profile of the long user (`http://localhost:3000/u0000000064`) and click the message icon. B opens the new conversation. In A, open **Messages**: the conversation is in the list. Open it. In B, type a few letters, then send the text.
   - Expected: in A the typing dots show while B types, and the message shows without a reload.

5. **A live notification.** In B, on the profile of the long user, click the heart of the first post. Watch the **Notifications** item in A's left bar.
   - Expected: the notification count in A goes up without a reload. The list in A (`/notifications`) shows "User 787 liked your post".

6. **An admin ban logs the user out.** In A, click the account menu (the dots at the bottom of the left bar) and **Logout**. Sign in as the admin. The admin's For You is empty (the admin follows nobody), so do not show it. Click **Admin Console** in the left bar: it opens **Manage Users**. Search `u0000000787`, click **Ban**.
   - Expected: the row shows BANNED. In B, which stays on any page, the user is logged out at once and lands on `/sign-in?banned=true` with "Your account has been suspended."
   - Ban only the little user. Do not ban `demo_admin`: since task `p10-security-fixes` an admin cannot ban their own account or another admin (400).

7. **Cleanup.** In a terminal, run `npm run demo:stop`.
   - Expected: it prints "bans: lifted for u0000000787" (the ban is lifted by SQL), then stops the frontend and the backend and empties Redis database 3. Ports 3000 and 4000 are free, and `bash .claude/hooks/run-safe.sh status` says "backend not running".
   - The schema `eval_demo` stays. The next `demo:start` loads it again.

## Notes

- Run `npm run demo:stop` also when `start` failed half way. It says "nothing to do" for what is not running.
- The posts say `Post 123` and users have no picture. That is the generated data.
- The first page of each feed is cached for 10 s. After a click, wait a moment if the same list shows twice.
- If the demo is run again on the same day, run `npm run demo:stop` and `npm run demo:start` again. This also resets the login counters.
