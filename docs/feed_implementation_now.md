# Feed implementation plan (now) — Breadit

Mục tiêu của file này: **các việc có thể implement ngay trong codebase hiện tại** (không đi vào ML/offline training). Nội dung được tổng hợp từ:
- `docs/twitter_like_feed_plan.md` (phase-based, bám codebase)
- `docs/thesis_trending_recommendation_plan.md` (lọc ra phần “pre-thesis / production-ish”)

---

## 0) Baseline đã xác nhận trong codebase

- **Upload limits**: `apps/backend/src/main.ts` đang enforce:
  - `files: 10`
  - `fileSize: 500MB`
- **Upload parsing**: `apps/backend/src/posts/posts.controller.ts` + `apps/backend/src/comments/comments.controller.ts`
  - đã map `FST_REQ_FILE_TOO_LARGE`
  - **chưa** map “too many files”
- **Posts feed pagination**: `apps/backend/src/posts/posts.service.ts`
  - `LIMIT = 3`, `skip: (cursor-1)*LIMIT`, `count()` để tính `hasMore`
  - `nextCursor` hiện là `cursor+1` (page number)
- **Frontend infinite**:
  - `apps/frontend/src/components/InfiniteFeed.tsx`
  - `apps/frontend/src/components/ProfileTabFeed.tsx`
  - `apps/frontend/src/app/(board)/hashtag/[tag]/page.tsx`
  → đang dùng `getNextPageParam: pages.length + 1`

---

## Phase A — Attachment cap “end-to-end” (Backend UX) (S5) (0.5 ngày)

### Mục tiêu
Bypass FE upload > 10 files → backend trả lỗi business rõ ràng, thống nhất.

### Việc làm
- **Posts**: `apps/backend/src/posts/posts.controller.ts` (create + update)
- **Comments**: `apps/backend/src/comments/comments.controller.ts` (create + update)

Trong `catch (err)` khi duyệt `req.parts()`:
- giữ map `FST_REQ_FILE_TOO_LARGE` → 413
- thêm map “too many files”
  - ưu tiên `err.code === 'FST_REQ_FILES_LIMIT'`
  - fallback: message contains “files limit”

### Response chuẩn hoá
- Status: **400** (practical) hoặc 413 (nếu bạn muốn strict)
- Message: **`Too many files (max 10).`**

### Acceptance
- Upload 11 files (Postman/curl) → message đúng, FE hiển thị được.

---

## Phase B — Pagination contract & FE migrate (non-breaking) (0.5–1.5 ngày)

### Mục tiêu
FE dùng `nextCursor` thay vì tự tăng page number, nhưng backend chưa cần cursor “thật” ngay ở phase này.

### Backend (contract)
Chốt response cho lists (posts/hashtags/profile tabs):
- `{ posts, hasMore, nextCursor }`
- `nextCursor` có thể là `number|string|null`
- `null` = hết dữ liệu

### Frontend migrate
Update `getNextPageParam`:
- `InfiniteFeed.tsx`
- `ProfileTabFeed.tsx`
- `hashtag/[tag]/page.tsx`

Từ:
- `lastPage.hasMore ? pages.length + 1 : undefined`
Sang:
- `lastPage.nextCursor ?? undefined`

### Acceptance
- Scroll load-more vẫn chạy bình thường.
- Khi backend chuyển cursor thật ở phase sau, FE không phải sửa lại.

---

## Phase C — Backend: cursor thật cho feeds theo thời gian (1–2 ngày)

### Mục tiêu kỹ thuật
Bỏ `skip`, bỏ `count()`, dùng deterministic ordering + cursor predicate.

### Scope endpoints
Tập trung `GET /api/posts` trong `apps/backend/src/posts/posts.service.ts`:
- Home (default)
- Following
- Communities
- Community page (communityId)
- Profile feed (user param)

### Ordering & cursor
**Ordering**: `createdAt desc, id desc`

**Cursor token**: `"{createdAtMs}:{id}"`

**Predicate page>1**:
- `createdAt < cursorCreatedAt` OR (`createdAt = cursorCreatedAt` AND `id < cursorId`)

**HasMore**:
- query `take = LIMIT + 1`
- return `posts = rows.slice(0, LIMIT)`
- `nextCursor = lastItem ? token(lastItem) : null`

### Acceptance
- Load-more 5–10 lần không trùng/không nhảy.
- Không cần query `count()` cho pagination.

---

## Phase D — Explore trending (rule-based, thesis-friendly but “implement now”) (2–4 ngày)

### Mục tiêu
Explore nhìn khác Home: có time-decay + diversity + deterministic cursor.

### Candidate filters (giữ đúng policy)
- `deletedAt = null`
- `parentPostId = null`
- `communityId = null`
- exclude blocked peers

### Score (on-the-fly)
\[
score = a \cdot likes + b \cdot comments + c \cdot reposts - d \cdot ageHours
\]

Gợi ý hệ số:
- \(a=1\), \(b=2\), \(c=3\), \(d=0.25\)

### Cursor
- ordering: `score desc, id desc`
- cursor token: `"{scoreFixed}:{id}"`

### Diversity
- cap per-author trong top N (vd 50–100) hoặc cap consecutive.

### Acceptance
- Explore “hot” nổi lên rồi tụt theo thời gian.
- Scroll load-more ổn định (không lặp/nhảy).

---

## Phase E — Dataset để test đúng (0.5–2 ngày, làm song song)

### Mục tiêu
Có đủ data để thấy trending/pagination khác biệt.

### Cách làm
- Import demo UI: `datasets/humans_v1.sql` (khi cần)
- Seed scale: `apps/backend/prisma/seed.ts` (users/posts/likes/follows/hashtags)
  - likes nên lệch (power-law) để trending nổi bật.

### Acceptance
- Explore khác rõ ràng (không “nhạt” vì dataset nhỏ).

---

## Thứ tự khuyến nghị
1) Phase A (upload UX)
2) Phase B (FE migrate nextCursor)
3) Phase C (backend cursor thật time-based feeds)
4) Phase D (Explore trending)
5) Phase E (dataset) chạy song song khi cần test

