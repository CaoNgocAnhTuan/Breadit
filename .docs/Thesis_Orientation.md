# Định Hướng Thesis — Cao Ngọc Anh Tuấn (ITCSIU21244)

## 1. PHÂN TÍCH REPORT PRE-THESIS

### Gap nghiêm trọng

**Gap 1 — "For You" feed không có cá nhân hóa:** For You hiện tại thực chất chỉ là chronological thuần — người A và người B thấy cùng một feed, chỉ khác thứ tự thời gian. Không có ML, không có personalization.

**Gap 2 — Mâu thuẫn nghiêm trọng trong report (phải fix trước khi bảo vệ):**

- Future Works (mục 7.3.2) viết: *"Extend the For You Feed offline pipeline (currently Matrix Factorization / LightFM)"*
- Nhưng toàn bộ Chapter 4 + mục 2.9 đều nói rõ: *"Breadit does not currently implement a machine learning-based recommendation engine."*

Pipeline MF/LightFM không tồn tại trong hệ thống. Đây là đoạn bị copy/paste từ template — nếu hội đồng hỏi đúng câu này sẽ rất khó trả lời.

**Gap 3 — Social graph bị bỏ phí:** Schema `Follow` và `CommunityMember` đã được thiết kế nhưng không được dùng trong bất kỳ ranking logic nào.

**Gap 4 — Thiếu evaluation chuẩn recommendation:** Hiện chỉ có system metric (latency, cache hit). Không có Recall@K, NDCG@K, hay bất kỳ metric nào đo chất lượng nội dung được gợi ý.

---

## 2. HAI HƯỚNG THESIS ĐỀ XUẤT

### HƯỚNG A: Social-Graph-Aware Hybrid "For You" Feed

#### Vấn đề đang giải quyết

"For You" của Breadit hiện tại = chronological thuần. Schema đã có `Follow` (A follow B) và `CommunityMember` (A join community X) — đây là social graph chưa được dùng đến.

#### Research Questions

- **RQ1:** Liệu tích hợp social graph signal (follow network và community membership) vào ranking pipeline có cải thiện chất lượng cá nhân hóa For You feed so với baseline heuristic hiện tại, đặc biệt với user có lịch sử tương tác thấp?
- **RQ2:** Mức độ tương tác xã hội giữa các user ảnh hưởng như thế nào đến chất lượng social-aware ranking — và ngưỡng interaction tối thiểu nào là đủ để social signal có ý nghĩa?

#### Contribution Framing (gợi ý viết Chapter 1)

**C1 (kế thừa từ pre-thesis):** Breadit hybrid social networking architecture — giữ nguyên.

**C2 (mới): Social-Graph-Aware Hybrid Ranking for Personalized Feed Discovery**

> We propose a hybrid ranking model that extends Breadit's existing deterministic engagement heuristic with two complementary social signals derived from the platform's native social graph:
>
> (1) **Follow-trust signal:** a weighted interaction frequency between users in the follow network, quantifying how much a follower historically engages with a followee's content.
>
> (2) **Community-affinity signal:** a normalized score reflecting alignment between a post's community and the communities the target user actively participates in.
>
> These signals are fused with the existing engagement score using a tunable linear combination, enabling cold-start users to receive personalized rankings via their social connections before sufficient self-interaction data is accumulated.
>
> Unlike opaque ML models, all three components of our hybrid score remain interpretable and auditable — preserving Breadit's core design principle of transparent content discovery.

**C3 (kế thừa):** Real-time WebSocket layer — giữ nguyên.

#### Cách làm cụ thể (theo thứ tự)

**Bước 1 — Xây dựng offline evaluation set (làm trước khi code model)**

```
Nếu platform đang có user thật:
  → Log interaction 3–4 tuần (like, comment, repost)
Nếu chưa có user thật:
  → Simulate theo phân phối Pareto (20% user tạo 80% tương tác)

Split protocol: Leave-one-out
  → Mỗi user giữ lại 1 interaction cuối cùng làm test set
  → Phần còn lại làm train set
```

**Bước 2 — Thiết lập baseline (em đã có một phần)**

| Baseline | Cách tính | Trạng thái |
|---|---|---|
| Chronological | `ORDER BY createdAt DESC` | Đã có |
| Engagement heuristic | time-decay formula hiện tại | Đã có |
| Popularity | global like-count đơn thuần | Đã có |

**Bước 3 — Implement Social-Graph Component (contribution mới)**

*Option A (dễ hơn — SoRec-style, 1 tháng):*

```
social_score(post, user) =
    engagement_score(post)                # heuristic hiện có
  + α × Σ trust(user, friend)             # friends đã like/repost bài này
  + β × community_weight(post, user)      # user có join community của bài không

Trong đó:
  trust(user, friend) = (số lần user tương tác với post của friend)
                        / (tổng tương tác của user)
```

*Option B (khó hơn — DiffNet-style):*

Dùng social graph để "lan truyền" preference: nếu A follow B follow C, bài C cũng có điểm nhỏ trong feed A (influence propagation). Implement bằng graph convolution 1–2 layer trên Prisma schema hiện có.

**Bước 4 — Xử lý Cold-Start theo 3 phase (figure đẹp trong thesis)**

| Phase | Điều kiện | Cách ranking |
|---|---|---|
| Phase 1 | 0 interaction | Dùng community membership để infer preference |
| Phase 2 | ≥5 interactions | Blend community signal + follow-trust signal |
| Phase 3 | ≥20 interactions | Full hybrid (engagement + follow + community) |

**Bước 5 — Evaluation**

```
Metric chính:
  - Recall@K (K = 5, 10, 20)
  - NDCG@K (K = 5, 10, 20)
  - Coverage: % distinct posts surfaced across users

Phân tích thêm:
  - So sánh Recall@10 theo nhóm: ≤5 interactions vs >20 interactions
    → Thể hiện model tốt hơn ở cold-start, không tệ hơn ở existing users
```

#### Evaluation Design mẫu (Chapter 3)

```
Dataset:
  Breadit interaction log ([N] users, [M] posts, [K] interactions)
  Cold-start split: ≤5 interactions vs >20 interactions

Baselines:
  - BL1: Chronological (For You hiện tại)
  - BL2: Engagement heuristic (time-decay)
  - BL3: Popularity global (like-count)
  - PROPOSED: Social-Graph Hybrid (BL2 + follow-trust + community-affinity)

Protocol: Leave-one-out
```

#### Abstract mẫu

> Social networking platforms face a fundamental tension between content freshness and personalization relevance. Breadit addresses information overload through a deterministic time-decay engagement heuristic; however, its For You feed remains non-personalized, ranking content identically for all users regardless of their social connections. This thesis proposes a Social-Graph-Aware Hybrid Ranking model that extends Breadit's existing heuristic with follow-trust and community-affinity signals derived from the platform's native social graph. Experiments on Breadit interaction logs demonstrate that our approach improves Recall@10 by [X]% over the chronological baseline, with the largest gains observed for cold-start users with fewer than five prior interactions.

#### Paper cần đọc (theo thứ tự ưu tiên)

1. **Tang, Hu & Liu (2013)** — *Social Recommendation: A Review* — Social Network Analysis and Mining.
   → Đọc đầu tiên để có bức tranh tổng thể, tránh lạc hướng. Survey nhẹ, dễ đọc.
2. **Ma, Yang, Lyu & King (2008)** — *SoRec: Social Recommendation using Probabilistic Matrix Factorization* — CIKM 2008.
   → Bài gốc đặt nền móng social-rec, công thức tường minh, implement được trong 2–3 tuần.
3. **Wu, Sun, Fu, Hong et al. (2019)** — *DiffNet: A Neural Influence Diffusion Model for Social Recommendation* — SIGIR 2019.
   → Nếu muốn đi xa hơn SoRec, dùng graph convolution.
4. **Sharma et al. (2024)** — *A Survey of Graph Neural Networks for Social Recommender Systems* — ACM Computing Surveys.
   → Dùng làm reference cho Related Work chapter, không cần đọc hết.

#### Thông tin nhanh

| Tiêu chí | Đánh giá |
|---|---|
| Độ khó | Trung bình |
| Tiềm năng publish | Khá cao |
| Venue phù hợp | KSE/SoICT (an toàn), IEEE Access (nếu kết quả tốt) |
| Điểm mạnh | Không cần data ngoài, story nhất quán với pre-thesis |
| Rủi ro chính | Cần đủ tương tác thật để eval có ý nghĩa |

---

### HƯỚNG B: LLM-Generated User Profile cho Cold-Start

#### Vấn đề đang giải quyết

Breadit tự nhận cold-start là Limitation 7.2.1. User mới chưa có interaction → "For You" không có gì để cá nhân hóa. CF truyền thống cần đủ data. Hướng B trả lời:

> "Khi user chưa có interaction, dùng LLM để sinh một 'user profile' dạng text đọc được từ những gì user đã làm (bio, community đã join, hashtag đã dùng) — rồi dùng profile đó để rank content phù hợp."

#### Research Questions

- **RQ1:** LLM-generated natural language user profiles (sinh từ bio, community membership, và hashtag history) có thể cải thiện content recommendation cho cold-start users so với non-personalized baseline không?
- **RQ2:** Profile chất lượng cao (sinh từ nhiều signal hơn) có tương quan với Recall@K cao hơn không — hay LLM profile đạt plateau nhanh với lượng input tối thiểu?

#### Contribution Framing (gợi ý viết Chapter 1)

**C1 (kế thừa):** Breadit hybrid architecture — giữ nguyên.

**C2 (mới): BLIP — Breadit LLM Interest Profile**

> We propose BLIP (Breadit LLM Interest Profile), a cold-start personalization framework that addresses the interaction-data scarcity problem without requiring a machine learning training pipeline.
>
> BLIP operates in two stages:
>
> (1) **Profile Generation:** An LLM synthesizes a compact, human-readable interest profile for each user from available non-interaction signals — specifically, user biography text, community membership history, and self-authored hashtags.
>
> (2) **Semantic Ranking:** Post content is embedded using a pre-trained text embedding model. Posts are re-ranked by blending semantic similarity between the user's BLIP profile embedding and each post's content embedding with Breadit's existing engagement heuristic score.
>
> BLIP inherently produces explainable recommendations: the text profile that drives ranking is human-readable, enabling users to inspect and understand why specific content is surfaced — a property absent from conventional latent-factor models, and fully consistent with Breadit's design principle of transparent content discovery.

**C3 (kế thừa):** Real-time WebSocket — giữ nguyên.

#### Cách làm cụ thể (theo thứ tự)

**Bước 1 — Profile Generation**

Input (tất cả đã có trong Breadit schema):

- `User.bio` (text field)
- `CommunityMember` table → community names/descriptions user đã join
- Hashtag đã dùng trong Post (tổng hợp từ `Post` table)

Prompt mẫu:

```
System: You are a user interest analyzer for a social networking platform.

User: Given this user's profile information:
  Bio: [user.bio]
  Communities joined: [community1, community2, ...]
  Hashtags frequently used: [#tag1, #tag2, ...]

Generate a concise interest profile (3–5 sentences) describing this user's
likely content preferences and topics of interest. Be specific. Output only
the profile, no preamble.
```

Example output:

```
"This user is interested in technology news, specifically web development
and AI tools. They actively participate in programming communities and engage
with content about startups and software engineering career advice. Topics
like React, TypeScript, and system design are likely to resonate."
```

**Bước 2 — Content Scoring**

```python
# Pseudo-code
embedding_model = "bge-m3"  # free, chạy local với Ollama

user_vec = embed(blip_profile_text)

for post in candidate_posts:
    post_vec = embed(post.title + " " + post.content + " " + post.hashtags)
    semantic_score = cosine_similarity(user_vec, post_vec)
    final_score = λ × semantic_score + (1-λ) × engagement_score(post)

# λ là hyperparameter cần tune (thử λ = 0.3, 0.5, 0.7)
```

**Bước 3 — Ablation Study (dễ viết thành bảng trong thesis)**

| Variant | Input cho LLM | Mục đích |
|---|---|---|
| BLIP-Bio | Bio only | Baseline của BLIP |
| BLIP-Comm | Bio + Community | Thêm community signal |
| BLIP-Full | Bio + Community + Hashtag | Full input |

So sánh Recall@10 của 3 variant → trả lời RQ2.

**Bước 4 — Điểm thú vị: Explainability tự nhiên**

Vì profile là text đọc được, có thể hiển thị cho user:

> "Chúng tôi gợi ý bài này vì profile của bạn cho thấy bạn quan tâm đến web development và AI — bài này thuộc cộng đồng #programming và #react."

→ Đây là second contribution không tốn thêm engineering effort lớn, giữ đúng triết lý "transparent" của Breadit.

#### Evaluation Design mẫu (Chapter 3)

```
Tập trung vào: NEW USERS (≤5 interactions) — cohort BLIP được thiết kế cho

Baselines:
  - BL1: Chronological (For You hiện tại)
  - BL2: Engagement heuristic
  - BL3: Content-Based Filtering (embedding only, không có LLM profile)
  - BLIP-Bio: profile từ bio only
  - BLIP-Full: profile từ bio + community + hashtag

Metrics:
  - Recall@K (K = 5, 10, 20)
  - NDCG@K
  - Profile Quality Score (manual eval, 2 người review blind)
    → tăng credibility cho phần định tính

Protocol: Leave-one-out trên NEW USERS cohort
```

#### Abstract mẫu

> Cold-start users — those with insufficient interaction history — remain underserved by conventional collaborative filtering approaches. This thesis proposes BLIP (Breadit LLM Interest Profile), a framework that generates compact, human-readable user interest profiles from non-interaction signals (biography, community membership, hashtag history) using a large language model, and leverages semantic embedding similarity to re-rank content for cold-start users on the Breadit social platform. Unlike latent-factor models, BLIP profiles are fully interpretable, preserving Breadit's design principle of transparent content discovery. Evaluation on cold-start user cohorts shows Recall@10 improves by [X]% over the non-personalized baseline.

#### Paper cần đọc (theo thứ tự ưu tiên)

1. **Zhou, Dai & Joachims (2024)** — *Language-Based User Profiles for Recommendation* — arXiv:2402.15623.
   → Đọc đầu tiên, bắt buộc — gần như đúng idea của Hướng B, có baseline vs matrix factorization, code có thể adapt.
2. **Bang & Lee (2025)** — *LLM-based User Profile Management for Recommender System (PURE)* — arXiv:2502.14541.
   → Cách build và update profile liên tục từ review text.
3. **Subbaraman et al. (2025)** — *Selecting User Histories to Generate LLM Users for Cold-Start Item Recommendation* — arXiv:2511.21989.
   → Cách chọn history nào cho LLM để tránh noise.
4. **Sarwar et al. (2001)** — *Item-based Collaborative Filtering Recommendation Algorithms* — WWW 2001.
   → SV đã cite rồi, đọc lại để hiểu rõ baseline mình đang vượt qua.

#### Thông tin nhanh

| Tiêu chí | Đánh giá |
|---|---|
| Độ khó | Trung bình |
| Tiềm năng publish | Cao (LLM4Rec là hot topic 2024–2026) |
| Venue phù hợp | Workshop RecSys, IEEE Access |
| Điểm mạnh | Hot topic, không cần GPU/infra nặng, story rất "kể được" |
| Rủi ro chính | Eval design phải cẩn thận — dễ bị hội đồng hỏi về methodology |

#### Tool/Model khuyên dùng (miễn phí, không phụ thuộc OpenAI)

| Mục đích | Tool khuyên dùng |
|---|---|
| Profile generation (LLM) | Ollama + Llama 3.1 8B (local, free) |
| Text embedding | bge-m3 qua Ollama hoặc HuggingFace |
| Thử nhanh | OpenAI text-embedding-3-small (rẻ, khoảng $0.02/1M tokens) |

---

## 3. SO SÁNH 2 HƯỚNG

| | Hướng A — Social Graph | Hướng B — LLM Profile |
|---|---|---|
| Kỹ năng chính cần | Graph algorithm, backend | Prompt engineering, embedding |
| Infra cần thêm | Không (dùng DB sẵn) | LLM API / Ollama local |
| Thời gian implement | Dài hơn | Ngắn hơn |
| Tiềm năng publish | Khá cao | Cao hơn |
| Dễ bảo vệ hơn | Story tự nhiên với pre-thesis | Cần justify eval design kỹ |
| Phù hợp nếu SV muốn | Build system + ML nhẹ | Thử AI mới, viết paper |

---

## 4. MILESTONE ĐỀ XUẤT (3 tháng)

### Hướng A — Social-Graph Hybrid

| Tháng | Mục tiêu | Output cần nộp GV |
|---|---|---|
| T1 | Lit review (8–10 paper social-rec) + chốt RQ + fix mâu thuẫn LightFM trong report cũ | Survey 3–4 trang + RQ được GV confirm |
| T1 | Thu thập/chuẩn bị data + thiết lập baseline (3 baseline đã có) | Bảng kết quả baseline với Recall@K, NDCG@K |
| T2 | Implement follow-trust + community-affinity + hybrid scoring + tune λ | Bảng so sánh proposed vs baseline, phân tích cold-start group |
| T3 | Writing — ưu tiên Chapter 2 (Related Work) và Chapter 4 (Results) | Draft 2 chapter này |
| T3 | Finalize + chuẩn bị bảo vệ | Thesis hoàn chỉnh + slide |

### Hướng B — BLIP

| Tháng | Mục tiêu | Output cần nộp GV |
|---|---|---|
| T1 | Đọc 2 paper bắt buộc + thiết kế eval set + chốt eval protocol | Eval design document được GV confirm — **không code trước bước này** |
| T1 | Implement BLIP pipeline (profile gen + embedding + scoring) + baseline | BLIP-Bio và BLIP-Full chạy được, kết quả baseline |
| T2 | Ablation study (Bio vs Bio+Comm vs Full) + tune λ + phân tích lỗi | Bảng ablation + phân tích case study |
| T3 | Writing — ưu tiên Chapter 2 (Related Work bổ sung cold-start/LLM4Rec) và Chapter 4 | Draft 2 chapter |
| T3 | Finalize + bảo vệ | Thesis hoàn chỉnh + slide |

---

## 6. CHECKLIST TUẦN 0

- [ ] **Bước 1:** Đọc 2 paper bắt buộc cho hướng đã chọn
  - Hướng A → Tang et al. (2013) + Ma et al. (2008) - SoRec
  - Hướng B → Zhou et al. (2024) - arXiv:2402.15623 + Bang et al. (2025) - arXiv:2502.14541
- [ ] **Bước 2:** Viết 1 trang (tối đa) trả lời 3 câu:
  - Em chọn Hướng A hay B? Tại sao?
  - Contribution C2 mới của em là gì, khác pre-thesis ở điểm nào?
  - Em sẽ đo "tốt hơn" bằng metric gì?
- [ ] **Bước 3:** Fix mâu thuẫn LightFM/chronological trong report pre-thesis
  - Viết 1 đoạn giải thích
- [ ] **Bước 4:** Kiểm tra platform có user thật chưa, log interaction có sẵn không
  - Báo cáo GV: có bao nhiêu user, bao nhiêu interaction đã có