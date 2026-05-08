# Feed thesis plan (later) — Trending + Recommendation model (Breadit)

Mục tiêu của file này: phần **thesis/research** (có model + metrics), làm **sau** khi các phase “implement now” đã ổn định (cursor/pagination/explore).

File này tổng hợp và chuẩn hoá lại từ:
- `docs/thesis_trending_recommendation_plan.md`
- `docs/twitter_like_feed_plan.md` (phần signals/dwell time/cursor)

---

## 0) Scope “Twitter-like but small” (thesis)
- Không làm streaming pipeline (Kafka), không online learning.
- Model offline (batch) chạy theo lịch (daily/weekly) hoặc chạy tay khi demo.
- Mục tiêu thesis: **giải thích được** + **đo được** (metrics), không cần scale như Twitter.

---

## 1) Thesis phases (đề xuất)

### Phase 1 — Instrumentation & dataset (1–3 ngày)

#### 1.1 Dataset
- Dùng seed scale (`apps/backend/prisma/seed.ts`) để tạo volume:
  - Users: 200–1000
  - Posts: 5k–30k
  - Likes: 30k–300k
  - Follows: 2k–20k

#### 1.2 Interaction signals (tối thiểu)
Dùng các bảng có sẵn:
- Like
- Comment
- Repost
- Follow

#### 1.3 Optional: view / click / dwell time
Nếu muốn recommend tốt hơn:
- Bảng tối thiểu: `PostView(userId, postId, createdAt, durationMs?)`
- Endpoint ghi nhận view:
  - `POST /api/posts/:id/view`
- FE capture bằng IntersectionObserver (cap duration để tránh spam)

**Deliverables**
- Dataset đủ để “nhìn thấy trending”
- (Optional) view log hoạt động

---

### Phase 2 — Trending algorithm (Explore) + write-up (2–5 ngày)
- Score rule-based + time-decay + diversity.
- Deterministic ordering + cursor encode theo sort key.

**Deliverables**
- Explore hoạt động ổn định, có giải thích thuật toán + độ phức tạp.

---

### Phase 3 — For you baseline heuristic (1–3 ngày)
Mục tiêu: trước khi có ML, For you vẫn “recommend-ish”.

Gợi ý:
- candidates = followees posts ∪ trending posts ∪ (optional) hashtag affinity
- ranking = recency + trending boost nhẹ
- exclude blocked peers
- optional: seen-set per session để tránh “lặp”

**Deliverables**
- For you không trống, hợp lý cho demo.

---

### Phase 4 — Offline recommendation model (5–14 ngày)

#### 4.1 Data for ML (implicit feedback)
- Positive: like, repost, comment (+ optional view/dwell)
- Negative sampling: random posts chưa tương tác

#### 4.2 Model options (chọn 1)
- Implicit Matrix Factorization
- LightFM (hybrid nếu muốn thêm features)
- Two-tower đơn giản (nếu bạn thoải mái deep learning)

#### 4.3 Metrics (không dùng “accuracy”)
Offline eval:
- Precision@K
- Recall@K
- NDCG@K

Split theo thời gian (train trước, test sau) để giống feed thực tế.

#### 4.4 Serving (offline → app)
Không cần inference service online:
- Job offline export topK/user ra:
  - JSON file, hoặc
  - table `UserRecommendation(userId, postId, rank, generatedAt)`
- Backend endpoint:
  - `GET /api/recommendations?cursor=...`
- FE For you: merge timeline + recommendations + guardrails

**Deliverables**
- Báo cáo metric + so sánh baseline vs model
- Endpoint recommend hoạt động trên UI

---

### Phase 5 — Thesis write-up & demo script (2–5 ngày)
Checklist nên có:
- Problem statement & goals
- Dataset & preprocessing
- Trending algorithm + complexity
- Recommend baseline + (optional) model + evaluation
- Integration points (API + UI)
- Limitations & future work (online learning, feature store, streaming)

---

## 2) Data management: seed vs SQL snapshot vs Kaggle
- **Seed**: tốt cho dev/thesis, reproducible với RNG seed.
- **SQL snapshot** (không phải migration): import nhanh dataset frozen cho demo.
- **Kaggle**: phù hợp train/eval, không nên đưa vào migrations.

---

## 3) Risks & mitigations (thesis)
- **Dataset mismatch vs business rules**: SQL import có thể không kích hoạt service logic (mentions/notifs).
  - Mitigation: tách demo dataset vs train/eval dataset.
- **Reproducibility**: cố định RNG seed + snapshot dataset frozen.
- **Determinism**: Explore/ForYou phải có tie-breaker để cursor ổn định.
- **Caching**: TTL cache làm kết quả trễ vài giây → dùng `ALGO_VERSION` hoặc bump version.

