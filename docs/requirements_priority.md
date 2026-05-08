# Requirements priority & scope — Breadit

This document classifies Breadit features with **Must / Should / Could / Won’t** (MoSCoW-style) and records **implementation status** against the current monorepo. Detailed behavior is in [functional_requirements.md](./functional_requirements.md).

**Status legend**

| Status | Meaning |
| :--- | :--- |
| **Done** | Implemented end-to-end for the main user path (API + UI where applicable). |
| **Partial** | Exists but incomplete, inconsistent UX, or behavior differs from ideal product spec. |
| **Not in codebase** | Not implemented (may appear only as idea or README wording). |

---

## Product phases (how this repo is framed)

| Phase | Scope (high level) | In this repo |
| :--- | :--- | :--- |
| **MVP (core X-like)** | Auth, post, feeds, follow, like, comment, basic profile, read content as guest where allowed | Largely covered plus more below. |
| **Extended** | Realtime notifications, DMs, search/hashtag, repost/bookmark, reports/admin | Implemented. |
| **Communities** | Groups, roles, mod queue, rules, bans | Implemented. |
| **Future / roadmap** | e.g. notification email digests, richer preferences | See root `README.md` roadmap and **Could / Won’t** below. |

---

## Must — required for Breadit to match its stated product (X-clone + communities)

| ID | Capability | Status | Notes |
| :--- | :--- | :--- | :--- |
| M1 | Register / login / logout; JWT `breadit_session` | **Done** | |
| M2 | Email verification (OTP) before posting | **Done** | |
| M3 | Password forgot / reset | **Done** | |
| M4 | Rate limiting on sensitive auth routes | **Done** | Throttler on auth + global limit. |
| M5 | Create / read / soft-delete posts; media (image/video) | **Done** | Cloudinary optional; else local disk. |
| M6 | Feeds: For you, Explore, Following, Communities aggregate | **Done** | Query params + tabs on home. |
| M7 | Hashtag discovery + hashtag page feed | **Done** | |
| M8 | Likes, reposts, quote-repost, bookmarks | **Done** | |
| M9 | Threaded comments (+ media where implemented) | **Done** | |
| M10 | Follow / unfollow; followers & following lists | **Done** | |
| M11 | **Blocking:** record + sever mutual follows; exclude from **feeds**, **search**, **notifications**; **restricted profile** + **403** timeline; **no DM**; **`GET /api/users/me/blocked`** + Settings UI | **Done** | Guests still see full public profiles. Conversation list excludes blocked peers via DB `notIn`. |
| M12 | Profiles: view + edit fields + avatar/cover + tabs (posts/replies/media/likes) | **Done** | Tabs hidden when `profileRestricted`. |
| M13 | Persisted notifications + Socket.IO realtime; mark read / mark all read | **Done** | Redis adapter when `REDIS_URL` set. |
| M14 | Global search (users, posts, hashtags) debounced / full page | **Done** | |
| M15 | DMs: conversations, messages, unread | **Done** | Typing signals via socket. |
| M16 | Communities: create, join, post, roles, rules, bans, approval queue | **Done** | |
| M17 | Reports + admin console (users ban, report queue) | **Done** | Admin `Role.ADMIN`. |

---

## Should — important for parity, polish, or stated intent; gaps hurt UX or trust

| ID | Capability | Status | Notes |
| :--- | :--- | :--- | :--- |
| S1 | **Full search results page** (`/search?q=`) shows **communities** like the header dropdown | **Partial** | Homepage/header `Search.tsx` **does** list communities from `/api/search`. The dedicated **`search/page.tsx`** only renders people, hashtags, and posts — types omit `communities`. |
| S2 | **Privacy consistency:** community posts vs hashtag feed | **Partial** | Explore + post search exclude communities; hashtag feed can still show community-tagged posts — decide product rule and align code + FR. |
| S3 | *(moved to M11)* Stricter blocking (profile shell, no timeline, no DM, blocked list) | **Done** | Implemented 2026-05 — see [functional_requirements.md §5](./functional_requirements.md). |
| S4 | **“Notify on new posts” from follow** (`Follow.notify`) | **Partial** | Stored in DB / API accepts concept; **no frontend `notify`** and **no** “new post from followee” notification pipeline. README “optional notify flag” oversells vs UI. |
| S5 | **Sensible caps** on attachments per post (e.g. max count + size communicated) | **Partial** | 500MB/file mentioned in errors; **no** max file count in API/composer. |
| S6 | Mentions behave like mainstream social (notify any valid user) | **Partial** | Only users **the author follows** get mention rows + notifications — intentional or not; document if you keep it. |

---

## Could — nice to have; not required to call the project complete at thesis / portfolio level

| ID | Capability | Status | Notes |
| :--- | :--- | :--- | :--- |
| C1 | Light / Dark / System theme + persistence | **Not in codebase** | Fixed dark-style UI today. |
| C2 | Notification preferences (per-type mute) + email digest | **Not in codebase** | README roadmap “phase 13” style. |
| C3 | Official mobile app / PWA offline | **Not in codebase** | |
| C4 | Rich media editing (stickers, filters beyond current editor) | **Not in codebase** | |
| C5 | Full-text / Elasticsearch search | **Not in codebase** | Current search is `contains` style on DB fields. |

---

## Won’t — explicitly out of scope for this repository (to avoid scope creep)

Examples (not exhaustive):

- **Ephemeral stories** (24h), **Spaces / live audio rooms**, **native Fleets-style** vertical video feed.
- **Polls / vote posts** as first-class post types.
- **Group DMs** (3+ people) or **Slack-style** workspace.
- **Algorithmic “For you”** with ML ranking (beyond current simple rules).
- **Federated protocol** (ActivityPub / Bluesky-style).
- **Monetization**: tips, subscriptions, ads marketplace.

---

## So với bảng trên: project **còn thiếu / chưa đủ** chỗ nào?

Nhóm theo mức độ:

### 1. **Should** chưa đạt **Done** (đáng ưu tiên nếu muốn “đóng” sản phẩm cho báo cáo / demo)

| Hạng mục | Việc cần (ý tưởng) |
| :--- | :--- |
| **S1 Communities on `/search` page** | Thêm section “Communities” trên `apps/frontend/src/app/(board)/search/page.tsx` (dropdown trong `Search.tsx` đã có). |
| **S2 Hashtag vs community** | Hoặc thêm `communityId: null` vào hashtag queries; hoặc sửa FR và chấp nhận community posts trên hashtag by design. |
| **S3 Stricter blocking** | ✅ Done — see functional requirements §5. |
| **S4 Follow notify** | UI toggle gửi `notify` khi follow + backend job/socket khi followee tạo bài (nếu muốn giống X). |
| **S5 Attachment cap** | Giới hạn số file trong `posts` controller + `Share` (ví dụ 10) và hiển thị lỗi rõ. |
| **S6 Mention policy** | Nếu muốn mention mọi user: bỏ filter `followingIds` trong post/comment mention logic; nếu giữ: ghi rõ trong FR là privacy feature. |

### 2. **Could** — không bắt buộc; thiếu là **đúng kỳ vọng** trừ khi bạn mở rộng đề tài

Theme hệ thống, notification preferences/email, PWA, search nâng cao, v.v.

### 3. **README vs code**

- Dòng **“Follow — toggle with optional notify flag”**: backend có field, **frontend không có toggle** và không có “báo bài mới” — coi là **S4** hoặc sửa README.

### 4. **Must**

**Blocking (M11)** includes strict profile + DM + settings list (2026-05).

---

## Document history

- **2026-05:** Initial MoSCoW + gap analysis aligned with repo and [functional_requirements.md](./functional_requirements.md).
- **2026-05:** Clarified blocking (M11 Done; S3 optional stricter hide); search communities (header vs `/search` page).
- **2026-05:** Implemented strict blocking end-to-end; S3 → Done; docs §5 policy table.
