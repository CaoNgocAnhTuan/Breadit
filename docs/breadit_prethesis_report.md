# Breadit — Pre‑Thesis Report (Draft, Markdown)

> **Note:** File này dùng **sườn bài tương tự** report mẫu trong `ITCSIU22194_HaMinhTri_PreThesis_Report.docx`, nhưng nội dung được **viết lại hoàn toàn** cho project **Breadit** (X/Twitter‑like + Communities) dựa trên codebase `d:/Fork/Breadit`.

---

## ACKNOWLEDGEMENT

*(Điền sau — tên GVHD, nhóm, bạn bè, nguồn tài liệu, v.v.)*

---

## TABLE OF CONTENTS

*(Markdown tự đóng vai TOC nếu cần; hoặc dùng heading structure của file này.)*

---

## LIST OF FIGURES

Gợi ý hình nên có cho Breadit:
- Hình kiến trúc tổng quan (Frontend/Backend/DB/Redis/SMTP)
- ERD (Prisma schema)
- Sequence diagram: Login/Verify OTP/Create Post/Realtime Notification
- Activity diagram: Create post + upload media + mention parse
- Feed pagination (cursor token flow)

---

## LIST OF TABLES

Gợi ý bảng nên có:
- Bảng FR theo use‑case / endpoint
- Bảng NFR (Security/Performance/Reliability/Scalability)
- MoSCoW scope (Must/Should/Could/Won’t)
- Test cases mapping theo UC

---

## ABSTRACT

Breadit là một ứng dụng mạng xã hội theo hướng **X (Twitter) clone** mở rộng thêm **Communities**, xây dựng theo kiến trúc client‑server với **Next.js (App Router)** ở frontend và **NestJS + Fastify** ở backend. Hệ thống sử dụng **PostgreSQL** làm nguồn dữ liệu chính và **Redis** cho khả năng mở rộng real‑time (Socket.IO adapter) và các tối ưu hiệu năng theo nhu cầu. Project tập trung vào các năng lực cốt lõi: xác thực người dùng bằng **JWT cookie** và **email OTP verification**, tạo bài viết kèm media, tương tác (like/repost/comment/bookmark), discovery (feed + search + hashtag), nhắn tin 1:1, thông báo realtime, và quản trị cộng đồng/admin. Báo cáo này mô tả bài toán, kiến trúc, lựa chọn công nghệ, yêu cầu chức năng/phi chức năng, triển khai chính, kiểm thử, và hướng phát triển tiếp theo (bao gồm trending/recommendation cho thesis).

---

## INTRODUCTION

### Background
Các nền tảng social hiện đại yêu cầu trải nghiệm “feed‑based” với tương tác realtime, khả năng moderation, và cơ chế bảo vệ (rate limit, verify email, blocking). Breadit được xây dựng nhằm mô phỏng một hệ thống “Twitter‑like” thu nhỏ nhưng đủ thành phần để nghiên cứu: feed pagination, discovery, realtime delivery, và mở rộng theo hướng recommendation/trending.

### Problem Statement
Thiết kế và triển khai một ứng dụng social dạng micro‑blogging có:
- Luồng xác thực an toàn (OTP verify, reset password, rate limit)
- Feed discovery (For you/Following/Explore/Communities) và tìm kiếm (users/hashtags/posts/communities)
- Realtime notifications và DMs
- Communities + moderation + admin console
đồng thời giữ UX ổn định khi dữ liệu tăng (pagination deterministic, attachment limits, caching/redis adapter).

### Objectives
- Xây dựng hệ thống full‑stack chạy được end‑to‑end bằng Docker Compose.
- Đảm bảo các use‑cases chính hoạt động ổn định.
- Định nghĩa rõ FR/NFR và bám sát codebase.
- Chuẩn bị nền tảng để phát triển thesis (trending/recommendation) mà không phá kiến trúc.

#### Vision Statement
Một nền tảng social “Twitter‑like but small” có communities và realtime, đủ để demo và làm nền cho nghiên cứu feed ranking.

#### Stakeholders
- Người dùng (guest/user)
- Moderator/Owner của community
- Admin
- Nhà phát triển (nghiên cứu/thesis)

#### Users
- Guest: đọc nội dung public
- User (verified email): post + interact + message + join community
- Mod/Owner: duyệt bài, quản lý member/rules/bans
- Admin: review report, ban user, quản trị

#### Risks
- Pagination không deterministic gây trùng/nhảy feed
- Dataset nhỏ khiến Explore “nhạt”
- Fan‑out notification lớn khi follow notify
- Upload media phát sinh lỗi khó hiểu nếu không map error rõ

#### Feature List (Prioritized)
Tóm tắt theo `docs/requirements_priority.md`:
- Must: auth + OTP verify + feeds + posts + interactions + search + hashtags + DMs + notifications + communities + admin
- Should (điển hình): attachment cap UX, follow notify “new post”, mention policy docs, consistency feed rules

#### Phased Scope
- Phase foundation: auth, posts, interactions, basic feed
- Phase extended: realtime notifications, DMs, discovery
- Phase communities/admin: moderation + roles + report pipeline
- Phase feed quality: cursor pagination + explore scoring (theo `docs/feed_implementation_now.md`)

#### Out-of-Scope
Không làm: online learning/streaming infra, ad system, monetization, federated protocol, native mobile app.

### Requirements

#### Functional Requirements
(Tóm tắt; chi tiết xem `docs/functional_requirements.md`.)

##### Authentication and User Management
- Register / login / logout (JWT cookie `breadit_session`)
- Email OTP verification trước write operations (EmailVerifiedGuard)
- Forgot/reset password qua email

##### Content & Social Features
- Create/read/soft-delete posts + media upload
- Like/repost/quote/bookmark/comment/reply thread
- Follow/blocking policy (lọc feed/search/notif/DM)

##### Search and Discovery
- Global search: users/posts/hashtags/communities
- Hashtag pages
- Feeds: For you, Explore, Following, Communities, Community feed

##### Communities & Admin
- Communities: join/post/rules/bans/mod queue
- Admin: reports queue, ban user

#### Non‑Functional Requirements
(Tóm tắt; chi tiết xem `docs/Non-Functional-Requirements.md`.)
- Security: JWT cookie, guards, validation, rate limiting
- Performance: pagination + infinite scroll, upload limits, caching strategy/Redis usage
- Reliability: exception filter + error UI
- Scalability: Redis Socket.IO adapter, stateless auth

### Assumption and Solution
Assumptions:
- Single region deployment (local/Docker); SMTP dùng provider hợp lệ.
- Dataset để demo được tạo bằng seed hoặc SQL snapshot.

Solution approach:
- Monorepo Next.js + NestJS.
- Prisma schema làm “single source of truth” cho DB.
- Redis cho realtime scaling và (tuỳ) caching.

### Significance of the Project
Breadit là nền tảng thực nghiệm phù hợp cho thesis về feed quality:
- deterministic pagination (cursor)
- explore trending scoring (time decay/diversity)
- instrumentation signals (view/dwell) cho recommendation (làm sau)

### Structure of Pre‑Thesis
Report gồm: literature review → methodology → implementation → test cases → demo → conclusion/future work.

---

## LITERATURE REVIEW

### Overview of Social Micro‑blogging Systems
- Feed‑based UX, interaction graphs (follow/block), moderation, và real‑time delivery.

### Frontend Development Technologies
#### Overview of Frontend Frameworks
So sánh nhanh: React/Next.js vs Vue/Nuxt vs Angular.

#### Rationale for Choosing Next.js (React)
Breadit dùng **Next.js 15 App Router**:
- SSR/Server Components cho initial load
- CSR + TanStack Query cho infinite scroll & optimistic UI
- Routing theo app directory

### Backend Development Technologies
#### Overview of Backend Frameworks
So sánh: NestJS, Express/Fastify, Django/FastAPI, Spring.

#### Rationale for Choosing NestJS + Fastify
- Modular architecture (controllers/services/guards)
- Decorator + DI + testability
- Fastify multipart performance + limits enforcement

### Database Technologies
#### Overview of Relational vs NoSQL
Relational phù hợp consistency (users/posts/relations); NoSQL phù hợp logs/analytics (nếu mở rộng thesis).

#### Rationale for Choosing PostgreSQL
Phù hợp:
- relational constraints
- query flexibility
- migration management qua Prisma

#### (Optional) Rationale for a separate store for analytics
Nếu làm thesis model lớn: có thể dùng table riêng hoặc export dataset; không cần MongoDB trong scope hiện tại.

---

## METHODOLOGY

### Overview
Phương pháp: thiết kế kiến trúc → mô hình dữ liệu → triển khai API/FE → test → demo.

### Development Process
Phát triển theo incremental phases (MVP → extended → communities/admin → feed quality).

### Architecture Design
(Tham khảo `docs/System_Architecture.md`.)

#### Summary Use Case
Các nhóm use case chính:
- Auth & account security
- Post & interactions
- Discovery (feeds/search/hashtags)
- Messaging & notifications
- Communities & admin

#### Use Cases (ví dụ tiêu biểu)
- Register + verify OTP
- Login/logout
- Create post + upload media + parse hashtag/mentions
- Like/repost/comment
- Search + open hashtag page
- Join community + create community post + approval workflow
- DM + realtime delivery

#### Activity Diagram (gợi ý vẽ)
- User registration / login / OTP verify
- Create post + upload
- Community post approval

#### Entity Relationship Diagram
Nguồn: `apps/backend/prisma/schema.prisma` (User/Post/Follow/Like/Comment/Community/Notification/Message…).

#### Class Diagram
NestJS modules/services:
- AuthService, PostsService, UsersService, CommunitiesService, NotificationsService, MessagesService…

#### Sequence Diagram (gợi ý vẽ)
- Login flow
- Register + OTP verify
- Create post + upload
- Notification emit + Socket.IO delivery

### (Optional) Feed ranking methodology (pre‑thesis)
Trong scope “implement now”:
- Cursor pagination deterministic
- Explore score rule‑based (time decay/diversity)
(Chi tiết: `docs/feed_implementation_now.md`.)

### User Requirement Analysis
Tổng hợp từ MoSCoW:
- Must: hệ thống chạy end‑to‑end, core social features
- Should: consistent UX (attachment caps, pagination stability)

### Technology Summary
#### Front‑end: Next.js 15
- Architectural role: UI/SSR/CSR
- Key mechanisms: Server Components, TanStack Query, optimistic updates, websocket client
- Justification: DX + SSR + routing + ecosystem

#### Back‑end: NestJS + Fastify
- Architectural role: REST API + realtime gateway
- Key mechanisms: Guards, DTO validation, exception filter, multipart limits, Prisma integration
- Justification: modular + testable + performance

#### Database: PostgreSQL + Prisma
- Applied features: constraints/indexes, relational consistency, migrations

#### Cache/PubSub: Redis
- Role hiện tại: Socket.IO adapter; mở rộng: caching/rate limiting nếu cần

#### Deployment (local/dev)
- Docker compose stack (db/redis/backend/frontend)

---

## IMPLEMENTATION

### Project Structure Overview
(Xem `README.md`.)
- `apps/frontend`: Next.js
- `apps/backend`: NestJS
- `packages/shared`: types dùng chung
- `docs`: tài liệu FR/NFR/architecture/plans

### Backend Implementation
#### Database Models
Trích từ Prisma schema:
- User, Post, PostMedia, Follow, Like, Comment, Community, Notification, Conversation/Message, Block, Report…

#### User Authentication & Registration
- Register, verify OTP, login/logout, forgot/reset password
- Guards: JwtAuthGuard, OptionalJwtAuthGuard, EmailVerifiedGuard, BannedUserGuard, RolesGuard
- Rate limiting: Throttler (global + auth endpoints)

#### Posts / Feeds / Discovery
- Create post + media upload (Fastify multipart + UploadsService)
- Feed endpoints: `GET /api/posts?feed=...` + pagination
- Hashtag endpoint: `GET /api/hashtags/:tag/posts`
- Search endpoint: `GET /api/search?q=...`

#### Realtime notifications & DMs
- Persist notification + emit Socket.IO event
- Conversations/messages + typing indicators

#### Communities & Admin
- Community roles, bans, approval queue
- Admin report queue + user ban

### Frontend Implementation
Các màn hình chính (tên có thể khác so với report mẫu vì domain khác):
- Sign up / verify / sign in / forgot password
- Home feeds (For you/Explore/Following/Communities)
- Post detail + comments thread
- Search dropdown + search page + hashtag page
- Profile tabs (posts/replies/media/likes)
- Notifications + Messages
- Communities (about/rules/mod queue)
- Admin pages

### Feed quality implementation (non‑thesis)
Tham chiếu `docs/feed_implementation_now.md`:
- Attachment cap UX (backend error mapping)
- Cursor pagination (time‑based)
- Explore trending rule‑based (recent window + score + diversity)

---

## TEST CASES

### Detailed Cases (đề xuất khung)
Bạn có thể mapping theo `UC-*` trong `docs/functional_requirements.md`.

#### Authentication & Authorization
- Register → verify OTP → create post allowed
- Login fail/pass + throttle
- Forgot/reset password

#### Posts & Interactions
- Create post (text only / multi-media)
- Upload > 10 files → message rõ
- Like/repost/comment

#### Discovery
- Home feed load-more (cursor)
- Explore feed ranking + cursor
- Search users/posts/hashtags/communities
- Hashtag page feed

#### Safety & Moderation
- Blocking: bị lọc khỏi feed/search/notif/DM
- Community bans/mod approval
- Report → admin action

---

## DEMONSTRATION

### Customer‑facing features
Script demo đề xuất:
- Sign up → verify OTP
- Create post + upload 1–2 media
- Like/repost/comment
- Explore feed + load more
- Search + open hashtag
- Notifications realtime
- DM + typing
- Join community + post (approval) + notification

### Administrative features
- Admin: report queue + ban/unban
- Community mod: approve post, manage bans/rules

---

## CONCLUSION & FUTURE WORKS

### Deployment
Hiện tại: Docker Compose local; có thể triển khai cloud (tuỳ thesis scope) với tách services và managed DB.

### Multi‑Platform Integration
Tương lai: mobile app/PWA (out‑of‑scope hiện tại).

### Recommendation Module
Cho thesis sau này:
- instrumentation view/dwell
- offline model evaluation + serving
(Tham chiếu `docs/feed_thesis_later.md`.)

### Enhanced AI Capabilities
- For you recommendation model + metrics
- Explore explainability (score breakdown)

### API and Integration
- Chuẩn hoá pagination contract toàn bộ endpoints list
- Tách feed services nếu cần

### Performance Optimization
- Indexing theo query patterns
- Redis caching có versioning keys

### Security Enhancements
- CSRF token (nếu dùng cookie auth ngoài localhost)
- Helmet/CSP headers

---

## REFERENCES

*(Điền tài liệu tham khảo: NestJS/Next.js/Prisma/Postgres/Redis/Socket.IO, bài báo về ranking/recommendation, v.v.)*

---

## APPENDIX

Gợi ý phụ lục:
- ERD export
- OpenAPI/endpoint list
- Env var list
- Demo dataset instructions (seed vs SQL snapshot)

