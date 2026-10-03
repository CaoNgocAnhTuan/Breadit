# Demo Script — Breadit Social Network Platform

> **Thời gian demo khuyến nghị:** 15–20 phút  
> **Môi trường:** Local (Docker Compose) hoặc Production build  
> **Trình bày bằng:** 2 tab trình duyệt (User A + User B) + 1 tab Admin

---

## Chuẩn bị trước khi demo

### Khởi động hệ thống

```powershell
# Trong thư mục gốc dự án
docker compose up -d
```

Chờ khoảng 30 giây để tất cả service healthy, sau đó truy cập:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:4000/api

### Tài khoản demo

| Role | Username | Email | Password |
|------|----------|-------|----------|
| **Admin** | `admin` | `admin@breadit.com` | `Admin@123456` |
| **User A** | `john_doe` | `john@example.com` | `Password123` |
| **User B** | `jane_smith` | `jane@example.com` | `Password123` |

> **Tip:** Mở sẵn 2 cửa sổ trình duyệt (hoặc Chrome + Incognito) để demo tương tác real-time giữa 2 user.

---

## Phần 1 — Giới thiệu tổng quan (2 phút)

**Nói:** *"Breadit là một nền tảng mạng xã hội dạng Twitter/Reddit, được xây dựng với Next.js ở frontend và NestJS/Fastify ở backend, PostgreSQL làm database chính, Redis để caching và real-time, Socket.IO cho WebSocket."*

Mở trang chủ ở trạng thái **chưa đăng nhập (Guest)** → cho giảng viên thấy:
- Trang Explore hiển thị post trending công khai
- Không có nút tương tác (like, comment, repost)
- Điều hướng đến Sign In khi thử tương tác

---

## Phần 2 — Authentication (2 phút)

### 2.1 Đăng nhập User A

1. Truy cập `/sign-in` → đăng nhập bằng **User A** (`john_doe`)
2. **Điểm nhấn kỹ thuật:** JWT được lưu trong `httpOnly` cookie (`breadit_session`), không thể đọc từ JavaScript → bảo mật khỏi XSS
3. Sau login → redirect về trang Home Feed

### 2.2 (Tuỳ chọn) Đăng ký tài khoản mới

Nếu có thời gian, demo luồng:  
`/sign-up` → nhập thông tin → nhận **OTP 6 chữ số** qua email → xác thực → tự động đăng nhập

---

## Phần 3 — Feeds & Discovery (3 phút)

### 3.1 Home Feed (For You)

- Hiển thị các post từ người dùng mà User A đang **follow**
- Scroll xuống → **Infinite scroll** tự động tải thêm (cursor-based pagination)

### 3.2 Explore Feed (Trending)

- Chuyển sang tab **Explore** (`/`)
- Giải thích: post được xếp hạng theo **thuật toán time-decay scoring**:  
  `score = a×likes + b×comments + c×reposts − d×ageHours`
- Post hot sẽ nổi lên đầu, cũ dần sẽ tụt xuống

### 3.3 Tìm kiếm

- Gõ từ khóa vào thanh Search → **live dropdown** hiện ngay kết quả
- Kết quả tìm kiếm song song: Users, Posts, Hashtags, Communities
- Nhấn Enter → trang kết quả đầy đủ

### 3.4 Hashtag Feed

- Click vào một `#hashtag` trong bất kỳ post nào → trang feed chỉ chứa post có hashtag đó

---

## Phần 4 — Post Management (3 phút)

### 4.1 Tạo post mới

1. Click nút **Post** / compose box trên Home
2. Nhập nội dung có chứa `#hashtag` và `@mention`
3. Đính kèm **ảnh hoặc video** (upload lên Cloudinary)
4. Gửi → post xuất hiện ngay trên feed (optimistic update)

**Điểm kỹ thuật:** Hashtag tự động được parse và index vào DB. Media xử lý qua Cloudinary hoặc Sharp local.

### 4.2 Repost & Quote Repost

- Hover vào post → Click nút **Repost**
- Chọn **Plain repost** hoặc **Quote repost** (thêm bình luận cá nhân)

### 4.3 Edit & Delete

- Vào post của mình → chỉnh sửa nội dung hoặc xóa
- **Soft delete:** post bị ẩn khỏi feed nhưng dữ liệu vẫn còn trong DB (bảo toàn tính toàn vẹn tham chiếu)

---

## Phần 5 — Tương tác Real-time (3 phút)

> Mở cửa sổ trình duyệt thứ 2 với **User B** (`jane_smith`)

### 5.1 Like & Notification real-time

1. **User B** like một post của **User A**
2. Quay sang cửa sổ **User A** → thấy **badge thông báo** xuất hiện ngay **không cần F5**
3. Mở Notifications → thấy thông báo "jane_smith liked your post"

**Điểm kỹ thuật:** Socket.IO Gateway định danh socket theo `userId` từ JWT cookie, push event `NEW_NOTIFICATION` trực tiếp đến đúng user.

### 5.2 Comment (Threaded)

- **User B** comment vào post của **User A**
- **User A** nhận notification real-time
- Reply vào comment → cấu trúc **threaded comments** hiện ra

### 5.3 Direct Message

1. **User A** vào profile của **User B** → click **Message**
2. Gửi tin nhắn → **User B** thấy ngay trong hộp thư, badge unread cập nhật tức thì
3. **User B** reply → **User A** nhận ngay

---

## Phần 6 — User Relationships & Profile (2 phút)

### 6.1 Follow / Unfollow

- Vào profile của User B → click Follow
- Home Feed của User A sẽ bắt đầu hiển thị post của User B

### 6.2 Block

- Block một user → profile bị hạn chế, không thể DM, không hiện trong feed

### 6.3 Chỉnh sửa Profile

- Vào `/settings` → thay avatar, cover photo, bio, location, website
- Upload ảnh → crop trực tiếp trên trình duyệt

### 6.4 Tab Profile

Vào profile bất kỳ → 4 tab:
- **Posts** — bài đăng gốc
- **Replies** — bình luận
- **Media** — ảnh/video
- **Likes** — bài đã thích

---

## Phần 7 — Community (2 phút)

### 7.1 Tạo Community

1. Tạo community mới → User A trở thành **Owner/Moderator**
2. Đặt tên, mô tả, thiết lập rules

### 7.2 Join & Post trong Community

- **User B** join community → đăng bài
- Nếu community bật chế độ kiểm duyệt → bài vào **Pending Queue**

### 7.3 Moderator duyệt bài

- **User A** (Moderator) vào trang quản lý community
- Thấy bài của User B trong hàng đợi → **Approve** hoặc **Reject**
- Sau Approve → User B nhận thông báo, bài xuất hiện trong Community Feed

---

## Phần 8 — Admin Panel (2 phút)

> Đăng nhập bằng tài khoản **Admin** (`admin@breadit.com`)  
> Truy cập `/admin`

### 8.1 Quản lý người dùng

- Xem danh sách toàn bộ user đã đăng ký
- Tìm kiếm theo username/email
- **Ban user** → user bị cấm tương tác trên toàn trang
- **Unban** → khôi phục quyền

### 8.2 Xử lý Report

- Xem **Reports Queue** — danh sách post bị user báo cáo vi phạm
- Admin nhận **real-time notification** khi có report mới (Socket.IO)
- Chọn **Dismiss** (bỏ qua, giữ post) hoặc **Delete Post** (xóa vĩnh viễn)

---

## Tổng kết cuối demo (1 phút)

Tóm tắt lại các điểm kỹ thuật nổi bật cho giảng viên:

| Điểm mạnh | Chi tiết |
|---|---|
| **Kiến trúc** | Next.js SSR + NestJS/Fastify REST + Socket.IO WebSocket |
| **Database** | PostgreSQL (Prisma ORM) + Redis (caching, real-time adapter) |
| **Real-time** | Socket.IO đẩy notification & DM ngay lập tức, không polling |
| **Feed Algorithm** | Explore: time-decay scoring rule-based; Home: follow-based chronological |
| **Security** | JWT httpOnly cookie, bcrypt 10 rounds, RBAC, Rate limiting |
| **Media** | Cloudinary CDN hoặc local Sharp fallback |
| **Soft Delete** | Bảo toàn toàn vẹn referential khi xóa post |
| **Pagination** | Cursor-based (không offset) → hiệu năng ổn định với dữ liệu lớn |

---

## Phần 9 — Demo kỹ thuật (dành cho giảng viên chuyên sâu)

> Phần này chỉ demo khi giảng viên hỏi thêm về kỹ thuật, hoặc nếu còn thời gian.

### 9.1 Kiến trúc hệ thống — Docker Compose

Mở terminal, chạy:

```powershell
docker compose ps
```

Cho giảng viên thấy **4 service** đang chạy song song:

| Service | Port | Vai trò |
|---------|------|---------|
| `db` | 5433 | PostgreSQL 16 — lưu toàn bộ dữ liệu |
| `redis` | 6378 | Redis 7 — caching + Socket.IO adapter |
| `backend` | 4000 | NestJS/Fastify REST API + WebSocket Gateway |
| `app` | 3000 | Next.js App Router (SSR + CSR) |

**Điểm nhấn:** `restart: unless-stopped` — tất cả service tự khởi động lại nếu crash, ngay cả sau khi restart máy. Data lưu trong Docker named volume `postgres_data` (không mất khi restart).

---

### 9.2 REST API — Browser DevTools (Network Tab)

1. Mở **DevTools → Network** (F12)
2. Filter theo `Fetch/XHR`
3. Thực hiện một hành động trên UI (ví dụ: load feed, like post)

**Chỉ cho giảng viên xem:**

| Request | Endpoint | Ghi chú |
|---------|----------|---------|
| Load feed | `GET /api/posts?feed=explore&limit=10` | Cursor-based pagination |
| Like post | `POST /api/posts/:id/like` | Trả về updated like count |
| Search | `GET /api/search?q=hello` | Kết quả song song từ nhiều bảng |
| Notifications | `GET /api/notifications` | Danh sách, kèm `readAt` timestamp |

**Điểm nhấn:** Request header không có token Bearer — authentication hoàn toàn qua `Cookie: breadit_session=...` (httpOnly, không thể đọc từ JS).

---

### 9.3 Real-time WebSocket — DevTools

1. DevTools → **Network → WS** (filter WebSocket)
2. Click vào kết nối Socket.IO
3. Chuyển tab **Messages**

Từ cửa sổ User B: like một post của User A → quan sát frame đến trong tab WS của User A:

```json
{ "event": "NEW_NOTIFICATION", "data": { "type": "LIKE", "actor": "jane_smith", ... } }
```

**Điểm nhấn:** Server đẩy event trực tiếp đến đúng socket của User A mà không cần polling.

---

### 9.4 Cấu trúc code — Project Structure

Mở VS Code, chỉ cho giảng viên thấy monorepo layout:

```
apps/
├── backend/          # NestJS/Fastify
│   ├── src/
│   │   ├── auth/         # JWT, Guards, OTP
│   │   ├── posts/        # CRUD, feed algorithms
│   │   ├── notifications/ # Socket.IO Gateway
│   │   ├── admin/        # RBAC, report queue
│   │   └── communities/  # Moderator logic
│   └── prisma/
│       └── schema.prisma # 20+ models, quan hệ đầy đủ
└── frontend/         # Next.js App Router
    └── src/app/
        ├── (feed)/       # Home, Explore (SSR)
        ├── admin/        # Admin dashboard
        └── [username]/   # Dynamic profile pages
```

**Điểm nhấn:** Backend và Frontend hoàn toàn tách biệt, giao tiếp qua HTTP REST và WebSocket — đúng mô hình Client-Server decoupled.

---

### 9.5 Prisma Schema & Database

Mở file `apps/backend/prisma/schema.prisma`:

```prisma
model Post {
  id          String    @id @default(cuid())
  description String    @db.VarChar(255)
  deletedAt   DateTime?          // Soft delete
  rePostId    String?            // Self-referential (Repost)
  communityId String?            // Community post
  parentPostId String?           // Threaded comment
  ...
}
```

**Các điểm kỹ thuật đáng chú ý trong schema:**
- `deletedAt` — soft delete pattern
- `rePostId` — self-referential để hỗ trợ repost/quote mà không cần bảng riêng
- `role` enum (`USER` | `ADMIN`) — RBAC đơn giản nhưng hiệu quả
- `banned Boolean` — platform-wide ban, kiểm tra tại Guard level
- Tất cả ID dùng `cuid()` thay vì auto-increment integer → không đoán được, an toàn hơn trong URL

---

### 9.6 Security Layer — NestJS Guards

Chỉ cho giảng viên thấy cơ chế bảo vệ route trong backend:

```
Request → JwtAuthGuard (xác thực cookie) 
        → RolesGuard (kiểm tra ADMIN role) 
        → ThrottlerGuard (rate limiting)
        → Controller Handler
```

- `JwtAuthGuard`: giải mã `breadit_session` cookie, gắn `user` vào request context
- `RolesGuard`: kiểm tra `user.role === 'ADMIN'` trước khi vào admin routes
- `ThrottlerGuard`: giới hạn 10 request/60s cho auth endpoints (chống brute-force)
- `BannedGuard`: kiểm tra `user.banned === true` → trả về 403 cho write operations

---

## Tổng kết cuối demo (1 phút)

Tóm tắt lại các điểm kỹ thuật nổi bật cho giảng viên:

| Điểm mạnh | Chi tiết |
|---|---|
| **Kiến trúc** | Next.js SSR + NestJS/Fastify REST + Socket.IO WebSocket |
| **Database** | PostgreSQL (Prisma ORM) + Redis (caching, real-time adapter) |
| **Real-time** | Socket.IO đẩy notification & DM ngay lập tức, không polling |
| **Feed Algorithm** | Explore: time-decay scoring rule-based; Home: follow-based chronological |
| **Security** | JWT httpOnly cookie, bcrypt 10 rounds, RBAC, Rate limiting |
| **Media** | Cloudinary CDN hoặc local Sharp fallback |
| **Soft Delete** | Bảo toàn toàn vẹn referential khi xóa post |
| **Pagination** | Cursor-based (không offset) → hiệu năng ổn định với dữ liệu lớn |

---

## Câu hỏi thường gặp từ giảng viên

**Q: Tại sao dùng NestJS thay vì Express thuần?**  
A: NestJS cung cấp kiến trúc module rõ ràng, Dependency Injection, decorator-based Guards/Interceptors giúp code dễ bảo trì và scale. Đồng thời tích hợp sẵn Fastify để tăng throughput so với Express.

**Q: Redis dùng để làm gì?**  
A: 2 mục đích chính: (1) Cache kết quả search và trending feed để giảm tải PostgreSQL, (2) Làm Pub/Sub adapter cho Socket.IO để hỗ trợ horizontal scaling.

**Q: Làm sao đảm bảo real-time notification đến đúng người?**  
A: Khi user kết nối WebSocket, Gateway xác thực `breadit_session` cookie và lưu mapping `userId → socketId`. Khi có event mới (like, comment...), server tra mapping và `emit` đến đúng socket.

**Q: Soft delete là gì và tại sao cần?**  
A: Thay vì xóa hẳn record khỏi DB, chỉ đặt `deletedAt = now()`. Post bị ẩn khỏi tất cả feed nhưng vẫn tồn tại trong DB để các comment, like, repost liên kết đến nó không bị lỗi foreign key constraint.

**Q: Cursor-based pagination khác gì offset?**  
A: Offset pagination (`LIMIT 10 OFFSET 100`) phải scan qua 100 row trước mới lấy được 10 row cần → chậm dần khi dữ liệu lớn. Cursor pagination dùng ID/timestamp của item cuối cùng làm "con trỏ" → `WHERE id < cursor LIMIT 10` luôn nhanh bất kể vị trí.
