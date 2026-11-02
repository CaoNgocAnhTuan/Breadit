# Breadit “Twitter-like” plan (spec) — Phase-based (S5 + Pagination + Explore + Thesis)

File này là **bản plan hoàn chỉnh từ đầu**, viết theo đúng các phase bạn đang dùng (Phase 3/5/6/7/8) và **bám sát codebase hiện có** để sau này implement không bị lệch khi mất context.

---

## A) Baseline (đã check codebase hiện có)

### A.1 Upload limits (backend source of truth)
- Backend dùng Fastify multipart limits ở `apps/backend/src/main.ts`:
  - `files: 10`
  - `fileSize: 500MB`
- `apps/backend/src/posts/posts.controller.ts` và `apps/backend/src/comments/comments.controller.ts` đang parse `req.parts()` và:
  - đã map `FST_REQ_FILE_TOO_LARGE` → `413 PayloadTooLarge`
  - **chưa map** lỗi “too many files” (file-count limit)

### A.2 Feeds (posts)
- Backend: `apps/backend/src/posts/posts.service.ts`:
  - `LIMIT = 3`
  - feeds đang là **page-based**: `skip: (cursor-1)*LIMIT`
  - response: `{ posts, hasMore, nextCursor }` với `nextCursor = cursor+1` (page number)
  - Explore hiện tại: `orderBy = likes._count desc, createdAt desc` và filter `communityId: null`, `parentPostId: null`, `deletedAt: null`
- Frontend:
  - `apps/frontend/src/components/InfiniteFeed.tsx`: `getNextPageParam` dùng `pages.length+1`
  - `apps/frontend/src/app/(board)/hashtag/[tag]/page.tsx`: tương tự
  - `apps/frontend/src/components/ProfileTabFeed.tsx`: tương tự

### A.3 Notifications / Follow.notify
- Prisma enum `NotificationType` hiện có: `FOLLOW`, `COMMUNITY_NEW_POST`, … (không có “new post from followee”).
- `Follow` model có `notify Boolean`.
- `UsersService.toggleFollow()` đã lưu `notify` và emit notification type `FOLLOW`.

---

## B) Mục tiêu tổng (Twitter-like nhưng scope thesis)

- **Phase 5 (quan trọng nhất)**: infinite scroll ổn định (không trùng/không nhảy) bằng **cursor thật**, FE dùng `nextCursor` đúng nghĩa.
- **Phase 6**: Explore có trending “nhìn ra chất”: time-decay + diversity + deterministic ordering → cursor ổn định.
- **Phase 3**: upload attachment cap “end-to-end” (backend UX) để demo không bị fail kỹ thuật.
- **Phase 7 (optional)**: follow notify new post (persisted + realtime) có giới hạn fan-out cho thesis.
- **Phase 8**: dataset đủ lớn + đủ “lệch” (power-law) để trending/pagination test được.

---

## Phase 3 (S5) — Hoàn thiện Attachment cap “end-to-end” (Backend UX) (0.5 ngày)

### 3.1 Mục tiêu
Nếu user bypass FE và upload > 10 files:
- backend **không** trả lỗi kỹ thuật mơ hồ
- backend trả message business rõ: **“Too many files (max 10).”**

### 3.2 Việc làm (backend)
**Files cần sửa**
- `apps/backend/src/posts/posts.controller.ts` (create + update)
- `apps/backend/src/comments/comments.controller.ts` (create + update, vì comment cũng có upload)

**Cách làm**
- Ở `try/catch` quanh `for await (const part of req.parts())`:
  - giữ mapping `FST_REQ_FILE_TOO_LARGE`
  - thêm mapping “too many files”, theo hướng “defensive” vì code có thể khác theo adapter/version:
    - map theo `err.code` nếu có (ví dụ `FST_REQ_FILES_LIMIT`)
    - nếu không có code, fallback theo message contains “files limit”

**Status code**
- Khuyến nghị thực dụng: `400 BadRequest` với message business (consistent UX FE).
- (Có thể chọn `413`, nhưng 400 dễ unify với các validation errors khác.)

### 3.3 Acceptance
- Upload 11 files (bằng Postman/curl) → response JSON message: `Too many files (max 10).`
- FE `Share.tsx` (đã chặn) vẫn ok; nếu bypass FE thì FE hiển thị đúng message.

### 3.4 Rủi ro & tránh
- **Rủi ro**: code error khác nhau giữa Fastify versions.
- **Tránh**: map theo nhiều dạng (code + message fallback) và log 1 lần khi gặp code lạ.

---

## Phase 5 — Pagination “chuẩn hóa thật” (cursor thật + FE migrate) (2–4 ngày)

### 5A — Chuẩn hoá contract (không breaking) (0.5–1 ngày)

**Mục tiêu**
- Tất cả list endpoints có chung “tinh thần”: `nextCursor` là token để lấy page kế tiếp.
- Trong giai đoạn chuyển tiếp, giữ compat:
  - `{ posts, hasMore, nextCursor }` cho posts/hashtags/profile
  - `nextCursor` trước mắt có thể vẫn là page number, nhưng ghi rõ “đang chuyển tiếp”.

**Tình trạng hiện tại**
- Posts/Hashtags: đã trả `nextCursor` nhưng thực tế là page number.
- FE chưa dùng `nextCursor`.

**Việc làm**
- Viết rõ contract ngay trong file này (để code theo), và (tuỳ bạn) sync ngắn vào docs requirements:
  - `nextCursor: string | number | null`
  - `null` nghĩa là hết dữ liệu

**Acceptance**
- Các endpoints list đều trả field `nextCursor` và semantics đồng nhất “cursor kế tiếp”.

### 5B — Backend: chuyển feeds posts sang cursor thật (1–2 ngày)

**Mục tiêu kỹ thuật**
- Bỏ `skip: (cursor-1)*LIMIT`
- Không cần `count()` để tính `hasMore` (tối ưu) → dùng `take = LIMIT+1`
- Deterministic ordering + cursor predicate đúng

**File chính**
- `apps/backend/src/posts/posts.service.ts` (hàm `findAll`)

#### 5B.1 Home / For you (timeline)
**Ordering**
- `createdAt desc, id desc`

**Cursor token**
- `"{createdAtMs}:{id}"` (string) hoặc `{ createdAt: ISO, id }` (nhưng string dễ dùng qua query).

**Predicate**
- page 1: không cursor
- page >1:
  - `createdAt < cursorCreatedAt`
  - hoặc `createdAt = cursorCreatedAt AND id < cursorId`

#### 5B.2 Following feed
Giống timeline, thêm filter `userId in followees` (không self theo policy hiện tại).

#### 5B.3 Communities feed
Giống timeline, filter:
- `communityId in myCommunityIds`
- `isApproved: true`
- `parentPostId: null`

#### 5B.4 Community page feed
Giống timeline, filter:
- `communityId = X`
- `isApproved: true`

#### 5B.5 Explore feed (Phase 5 scope: “cursor ổn định”, chưa cần time-decay)
**Baseline hiện tại**
- sort theo `likes._count desc, createdAt desc` (aggregate)

**Rủi ro**
- Cursor theo aggregate count có thể khó (Prisma + cursor predicate phức tạp).

**Khuyến nghị**
- Trong Phase 5B, ưu tiên:
  - hoặc giữ Explore page-based tạm (chấp nhận) nhưng migrate các feed time-based trước
  - hoặc chuyển Explore sang “recent window + compute score in memory” ở Phase 6 rồi mới cursor thật theo score/id

**Acceptance Phase 5B**
- Home/Following/Communities/Community page: load-more 5–10 lần không trùng/không nhảy.

### 5C — Frontend migrate sang `nextCursor` (0.5–1.5 ngày)

**Files**
- `apps/frontend/src/components/InfiniteFeed.tsx`
- `apps/frontend/src/app/(board)/hashtag/[tag]/page.tsx`
- `apps/frontend/src/components/ProfileTabFeed.tsx`

**Việc làm**
- Update `getNextPageParam` từ `pages.length+1` → `lastPage.nextCursor ?? undefined`
- Update types:
  - `nextCursor?: string | number | null`
  - tạm thời accept cả number/string trong transition.

**Acceptance**
- Khi backend chuyển cursor thật, FE vẫn chạy mà không phải sửa lại.

---

## Phase 6 — Explore trending “Twitter-like nhỏ” (time decay + diversity + cursor ổn định) (2–4 ngày)

### 6.1 Mục tiêu
Explore nhìn khác rõ so với Home timeline:
- bài “hot” nổi lên theo interactions
- bài cũ tụt theo thời gian
- không bị 1 author spam chiếm hết
- cursor ổn định (deterministic)

### 6.2 Candidate set (filter)
Giữ đúng policy hiện tại:
- `deletedAt = null`
- `parentPostId = null`
- `communityId = null`
- exclude blocked peers

### 6.3 Score function (thesis-friendly, compute on-the-fly)
\[
score = a \cdot likes + b \cdot comments + c \cdot reposts - d \cdot ageHours
\]

Gợi ý hệ số ban đầu:
- \(a=1\), \(b=2\), \(c=3\), \(d=0.25\)

**Triển khai**
- Query “recent window” (vd 7 ngày) + include `_count`
- compute `ageHours` từ `createdAt`
- sort in-memory theo `score desc, id desc`

### 6.4 Cursor
- `nextCursor = "{scoreFixed}:{id}"`
  - `scoreFixed` là score đã làm tròn (vd `Math.floor(score*100)`), để token ổn định.
- Page >1: lấy items với `(score,id) < (cursor.score,cursor.id)` theo ordering desc.

### 6.5 Diversity rule (tối thiểu)
Sau khi có top candidates (vd 100):
- cap per-author trong top N (vd `maxPerAuthor = 3`)
hoặc
- không cho xuất hiện liên tiếp quá `K2` (vd 2)

### 6.6 Acceptance
- Explore khác rõ Home trong dataset đủ lớn.
- Cursor load-more ổn định (không lặp/không nhảy).

---

## Phase 7 — Follow notify “new posts” (S4) (tuỳ chọn, 2–3 ngày)

### 7.1 Mục tiêu
Nếu `Follow.notify=true`:
- followee đăng post mới → follower nhận notification persisted + realtime.

### 7.2 DB / Prisma
- Thêm `NotificationType` mới, ví dụ `FOLLOWEE_NEW_POST`.
- Migration alter enum (Postgres).

### 7.3 Backend
Hook trong `PostsService.create()` sau khi tạo post:
- nếu post public theo policy (non-community hoặc rule tuỳ bạn)
- query followers với `notify=true`
- persist notifications + emit socket

**Fan-out cap (thesis)**
- giới hạn followers notify (vd max 500) hoặc batch.

### 7.4 Frontend
- UI toggle notify khi follow (đã có backend field `notify`).
- Render notification type mới.

### 7.5 Acceptance
- Bật notify, followee đăng bài → notification realtime + nằm trong list.

---

## Phase 8 — Dataset strategy (0.5–2 ngày, song song)

### 8.1 Mục tiêu
Có cả:
- “human content đẹp” để demo UI
- “scale đủ lớn” để trending/pagination thể hiện rõ

### 8.2 Cách làm
- Import `datasets/humans_v1.sql` khi cần demo.
- Seed scale bằng env vars (đã có `apps/backend/prisma/seed.ts`):
  - mục tiêu: tạo phân phối likes lệch (power-law) để trending nổi.

### 8.3 Acceptance
- Explore có “hot posts” rõ ràng.
- Cursor/pagination test được (load 10+ pages).

---

## Thứ tự khuyến nghị (tối ưu rủi ro demo)
1) **Phase 3** (upload error UX) — nhanh, giảm bug demo.
2) **Phase 5B + 5C** (cursor thật + FE migrate) — nền tảng ổn định.
3) **Phase 6** (Explore trending) — đạt mục tiêu Twitter-like.
4) **Phase 7** (optional) — nâng thesis.
5) **Phase 8** chạy song song khi cần test.
