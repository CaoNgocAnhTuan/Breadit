# H1 thất bại: vì sao, và một hybrid score (điểm kết hợp nhiều tín hiệu) sửa đổi (Hv2)

Bản tiếng Việt của `h1-negative-result-and-hybrid-v2.md`. Bản tiếng Anh là bản chuẩn; nếu hai bản khác nhau, sửa bản tiếng Việt.

Ghi chú thảo luận cho buổi gặp thầy hướng dẫn ngày 2026-11-30 · viết ngày 2026-11-25 · task `.docs/works/2026-11-25-p9-negative-result-note/`

Cách đọc các số. `M:` là một key của `.docs/results/p7-report/macros.csv`. `R:` là một bảng của `.docs/results/p7-report/results.md`. `S:` là `.docs/super-plan.md`. `[n]` là số tham khảo trong mục 10 của `S:`. Mỗi số có nguồn của nó ở lần đầu tiên nó xuất hiện. Các từ trong `code font` là tên lấy từ repo.

## 1. Tóm tắt

Chúng em đã kiểm tra một câu hỏi: nếu thêm follow trust (độ tin cậy dành cho người mình follow) và community affinity (mức độ gắn bó với cộng đồng) vào điểm của Explore, người dùng có ít lịch sử có được lợi không? Giả thuyết là H1. Nó thất bại ở cả hai co-primary test (hai bài test chính, ngang hàng nhau).

- Trên Digg 2009, H (hybrid score) và BL2 (baseline: phương pháp gốc dùng để so sánh; ở đây là điểm của feed Explore hiện tại) có cùng NDCG@10 (thước đo xếp hạng: post cần tìm nằm càng cao trong danh sách thì điểm càng lớn), là 0.024 (M: `eOneDiggNdcgHTenAllValue`, `eOneDiggNdcgBLTwoTenAllValue`). Gain (mức tăng của H so với baseline) ở nhóm 0–4 (những người dùng có từ không đến bốn tương tác trước đó) là 0.000 (M: `eTwoDiggNdcgTenZeroFourGain`).
- Trên `syn-W2M-M`, H thắng BL2 khi tính trên tất cả người dùng, nhưng không thắng ở nhóm 0–4: gain là 0.023 và khoảng tin cậy 95% (interval) là −0.002 đến 0.051 (M: `eTwoWTwoMNdcgTenZeroFourGain`, `...CiLow`, `...CiHigh`).
- Gần như toàn bộ gain trên dữ liệu synthetic (dữ liệu tổng hợp, do bộ sinh dữ liệu tạo ra) đến từ community term (thành phần cộng đồng). Trong bộ sinh dữ liệu của chúng em, một cộng đồng là một chủ đề. Vì vậy H hoạt động ở đó như một tín hiệu chủ đề, không phải như một tín hiệu của follow graph (đồ thị follow).

Mục 5 nêu bốn nguyên nhân. Hai nguyên nhân đã được đo. Hai nguyên nhân là cách đọc của chúng em và chưa được kiểm tra. Mục 7 đề xuất một score sửa đổi, Hv2, chỉ chạy offline, như một vòng 2 được ghi rõ. Mục 9 xin thầy quyết định năm việc.

## 2. Điều đã được kiểm tra

**Câu hỏi nghiên cứu (Research question) 1** (`methodology.tex`, mục 3.1): "does adding social-graph signals (follow trust and community affinity) to the ranking improve the 'For You' feed over the current heuristic, especially for users with little history?" (dịch: "việc thêm các tín hiệu từ đồ thị xã hội (follow trust và community affinity) vào thuật toán xếp hạng có cải thiện feed 'For You' so với heuristic hiện tại không, đặc biệt với người dùng có ít lịch sử?")

**H1:** "For users with 0–4 earlier interactions, the hybrid score H has a higher NDCG@10 than BL2, the score of the current Explore feed. H1 has two co-primary tests: one on synthetic data (the middle-influence world) and one on real data (Digg 2009). Each test is judged on its own." (dịch: "Với người dùng có 0–4 tương tác trước đó, hybrid score H có NDCG@10 cao hơn BL2, điểm của feed Explore hiện tại. H1 có hai co-primary test: một trên dữ liệu synthetic (thế giới có mức ảnh hưởng trung bình) và một trên dữ liệu thật (Digg 2009). Mỗi bài test được đánh giá riêng.")

**H2:** "The gain over BL2 grows with social density (number of followees, amount of friend engagement in the pool). It is about zero when the user follows nobody and has no community." (dịch: "Gain so với BL2 tăng theo mật độ xã hội (số followee, tức người mình follow; lượng tương tác của bạn bè trong pool, tức tập các post được đem ra xếp hạng). Gain gần bằng không khi người dùng không follow ai và không có cộng đồng.")

**H0 (một sanity gate: cổng kiểm tra tính hợp lý, bắt buộc phải qua):** "In the null world W0, where follows are random, the follow part of the hybrid must not beat BL2." (dịch: "Trong thế giới null W0, nơi các follow là ngẫu nhiên, phần follow của hybrid không được thắng BL2.") Nếu thắng ở đó thì có nghĩa là có lỗi (bug) hoặc rò rỉ dữ liệu (leak).

**Hybrid score.** Các công thức này giống với `methodology.tex`, mục 3.2:

```
H(p,u,t)         = engagement(p,t) + α · social(p,u,t) + β · community(p,u,t)
engagement(p,t)  = likes + 2·comments + 3·reposts − 0.25·ageHours
social(p,u,t)    = 1[u follows author(p)] · trust(u, author(p), t)
                 + Σ trust(u,f,t)   over followees f of u who engaged with p before t
trust(u,f,t)     = (n_uf + m/|F_u|) / (N_u + m)
community(p,u,t) = (c_{u,c(p)} + m · 1[u is a member of c(p)] / |M_u|) / (N_u + m)
```

Ở đây `n_uf` là số positive (tương tác tích cực: like, comment, repost) trước đó của u trên các post của f. `N_u` là tất cả positive trước đó của u. `F_u` là tập những followee của u tại thời điểm t. `c_{u,c}` là số positive trước đó của u trong cộng đồng c. `M_u` là các cộng đồng của u tại t. Một post không thuộc cộng đồng nào có `community = 0`. Độ mạnh của prior (prior: giá trị giả định ban đầu, dùng khi chưa có dữ liệu) là `m = 5` (S: mục 7). Mỗi score được lưu dưới dạng `floor(score × 100)`.

**BL2** là score Explore đang chạy thật (production), chỉ gồm `engagement(p,t)`. Các baseline khác là BL0 (For You đang chạy thật), BL1 (mới nhất trước), BL2t (BL2 với trọng số tuổi đã được chỉnh), BL3 (số like), BL4 (Reddit "hot"), BL5 (Hacker News) và BL6 (H-follow với mọi trọng số trust bằng 1). BL2t, BL4, BL5, BL6 và H được chỉnh (tune) trên dữ liệu validation (validation split: phần dữ liệu dùng để chọn tham số).

**NDCG@10.** Mỗi người dùng có một test item (mục dùng để thử): post cuối cùng mà họ đã like, comment hoặc repost. NDCG@10 bằng `1/log2(rank + 1)` nếu post đó nằm trong top 10 của pool đã xếp hạng, và bằng 0 nếu không. Gain là trung bình trên các người dùng của hiệu số theo từng cặp H − BL2.

**Hai bộ dữ liệu.**
- `syn-W2M-M`: 1,000 người dùng và 20,000 post từ một bộ sinh dữ liệu có seed (seed: số khởi tạo của bộ sinh số ngẫu nhiên, để sinh lại đúng cùng một dữ liệu). Mức ảnh hưởng trung bình: social 2, community 2, homophily (xu hướng follow người giống mình) 0.7 (bảng các world trong `methodology.tex`, mục 3.4).
- `digg2009`: 336,047 người dùng, 3,553 story, 3,007,345 like và 1,729,983 follow có ngày (`methodology.tex`, mục 3.4). Dữ liệu này không có cộng đồng, nên β không có tác dụng ở đó.

**Quy tắc quyết định** (được cố định trước khi chạy test split; test split: phần dữ liệu để thử cuối cùng, chỉ chạy một lần). H1 chỉ đạt trên một bộ dữ liệu nếu, với NDCG@10 và nhóm 0–4, p đã hiệu chỉnh theo Holm (Holm p: giá trị p được chỉnh để tránh kết luận sai khi so sánh nhiều lần) nhỏ hơn 0.05 (mức Holm, `S:` mục 7) và đầu dưới của khoảng tin cậy 95% lớn hơn 0. **Quy tắc feed mặc định** được cố định cùng lúc: "For You" chỉ chuyển sang hybrid nếu H1 đạt trên cả hai bài test và H0 gate đạt.

**Đóng băng (Freeze).** Các giả thuyết, các grid (grid: danh sách các giá trị được thử khi chọn tham số) và các giá trị đã chỉnh đều đã bị đóng băng. Tác giả đã duyệt mười test config, và test split chỉ chạy một lần (`S:` mục 4, trạng thái P7). Ví dụ, `eval/config/runs/p7-main.json` có `"testApprovedBy": "author"`.

## 3. Hybrid score đến từ đâu

**Dạng công thức.** Thầy hướng dẫn đã gợi ý dạng này. Đó là Option A ("Hướng A") của `.docs/Thesis_Orientation.md`:

```
social_score(post, user) = engagement_score(post)
                         + α × Σ trust(user, friend)        # friends who liked or reposted the post
                         + β × community_weight(post, user)
trust(user, friend) = (times the user interacted with the friend's posts) / (all interactions of the user)
```

Với người dùng chưa có lịch sử (bài toán cold start: người dùng mới, chưa đủ dữ liệu để gợi ý), Orientation (bước 4, "Xử lý Cold-Start theo 3 phase") dùng ba phase: 0 tương tác (chỉ dùng việc tham gia cộng đồng), từ 5 trở lên (cộng đồng và follow trust), từ 20 trở lên (score đầy đủ).

Bản abstract mẫu của Orientation hy vọng có "the largest gains observed for cold-start users with fewer than five prior interactions" (dịch: "mức gain lớn nhất được thấy ở người dùng cold start có ít hơn năm tương tác trước đó"). Đó chỉ là một hy vọng khi chưa có dữ liệu nào. Trên dữ liệu synthetic, vòng 1 cho thấy thứ tự ngược lại (mục 4).

**P1 đã thêm gì.** P1 (bước đọc tài liệu) đã thêm ba điều vào dạng công thức này. Chúng nằm trong `S:` mục 6, và `.docs/literature.md` đối chiếu từng điều với các bài báo.
- **Prior `m`.** Nếu không có nó, `trust = n_uf / N_u` là 0/0 với người dùng chưa có lịch sử. Dạng đã làm mượt là m-estimate (cách làm mượt: trộn số đếm với một prior) của Cestnik [28][29]: `(count + m × prior) / (total + m)`. Một đường cong duy nhất thay cho ba phase. Trọng số của prior là `m / (N_u + m)`.
- **Author term (thành phần theo người viết post).** Orientation chỉ cộng trust trên những người bạn đã tương tác. Một post mới của followee mà chưa ai tương tác sẽ không nhận được điểm nào. Chúng em thêm author term, theo cách tương tự RealGraph [5] và code của Twitter [6][7] (claim 5 của `literature.md`).
- **Một bước (one hop).** Chỉ những tài khoản u follow trực tiếp được tính. Graph neural network (mạng nơ-ron đồ thị) nằm ngoài phạm vi (`S:` mục 9).

**Tài liệu không cho chúng em những gì.** Ba lựa chọn là thiết kế riêng của chúng em, và `literature.md` cũng nói như vậy: dùng m-estimate cho trust và cho community, và giá trị của `m` (claim 4); một bước (claim 6); dạng của community term (quyết định D3, độ mạnh "weak" (dịch: "yếu")). Author term chỉ theo RealGraph "in the spirit of" (dịch: "theo tinh thần của"): RealGraph [5] học xác suất của một tương tác trong tương lai bằng logistic regression, còn trust của chúng em là một số đếm đã làm mượt. Cùng ghi chú đó nói rằng [29] không đưa ra giá trị `m` nào được khuyến nghị.

**Lần tìm kiếm.** Lần tìm kiếm ngày 2026-10-24 không thấy bài báo nào từ 2022 trở đi thêm follow trust và community affinity vào engagement trong một feed score (claim 10). Điều này chỉ nói về lần tìm đó, không có nghĩa là chưa ai làm. Bài gần nhất tìm được là [33], một mô hình matrix factorization (phân rã ma trận) để dự đoán rating, chỉ biết qua abstract.

**Điều này có nghĩa là gì.** Dạng công thức này trước đây chưa được thử ở nơi khác. Vì vậy scale của nó (thang đo; engagement không có giới hạn trên, hai thành phần còn lại thì có) và prior của nó (một prior phẳng `1/|F_u|`) là lựa chọn riêng của chúng em, không có kết quả đã công bố nào để đối chiếu. Vòng 1 là lần thử đầu tiên của dạng này. Việc nó thất bại là thông tin về những lựa chọn đó.

**Một cái tên chưa chặt chẽ.** Orientation gọi Option A là "SoRec-style" (dịch: "kiểu SoRec"). SoRec [2] là một mô hình probabilistic matrix factorization (phân rã ma trận xác suất) để dự đoán rating (theo abstract; chưa đọc toàn văn). H là một công thức cố định, không có factor nào được học. Luận văn không gọi H là "SoRec-style".

## 4. Các kết quả

Mọi số đều là NDCG@10 tại K = 10, lấy từ lần chạy test duy nhất. Nguồn: các bảng `R:`, và các key `M:` cho những số chính.

**H1 trên cả hai bộ dữ liệu** (`R:` e2, họ (family) F1; các key `M:` có dạng `eTwo...`).

| | `syn-W2M-M` | `digg2009` |
|---|---:|---:|
| Số người dùng trong nhóm 0–4 | 174 | 20,644 |
| BL2 | 0.012 | 0.029 |
| H | 0.035 | 0.029 |
| Gain | 0.023 | 0.000 |
| Khoảng tin cậy 95% | −0.002 đến 0.051 | 0.000 đến 0.000 |
| Holm p | 0.680 | 0.335 |
| H1 | thất bại | thất bại |

Số người dùng là `M: eTwoWTwoMNdcgTenZeroFourN` và `M: eTwoDiggNdcgTenZeroFourN`. Các giá trị Holm p là `M: eTwoWTwoMNdcgTenZeroFourPHolm` và `M: eTwoDiggNdcgTenZeroFourPHolm`. Ở sáu chữ số thập phân, gain của Digg là 0.000117 và khoảng tin cậy của nó là 0.000015 đến 0.000225 (`M: eTwoDiggNdcgTenZeroFourGainFull`, `...CiLowFull`, `...CiHighFull`). Khoảng này nằm trên 0 một lượng rất nhỏ, nhưng Holm p không nhỏ hơn 0.05, nên H1 thất bại. Số người dùng test bị loại ra (post test không nằm trong pool): 49 trên 590 ở `syn-W2M-M` và 3,547 trên 68,120 ở Digg (`M: eOneWTwoMLeftOutAllN`, `eOneWTwoMTestUsersAllN`, `eOneDiggLeftOutAllN`, `eOneDiggTestUsersAllN`).

**Cách đọc.** Hai thất bại này khác loại nhau. Trên Digg, kết quả là một kết quả bằng không (zero) rất rõ ràng: khoảng tin cậy rất hẹp và nằm ở 0. Trên `syn-W2M-M`, kết quả không rõ: khoảng tin cậy chứa 0 và rộng, nên một gain từ khoảng 0 đến 0.051 đều phù hợp với dữ liệu. Loại thứ nhất là vấn đề của score. Loại thứ hai một phần là vấn đề về số người dùng chúng em có.

**Gain theo lượng lịch sử trên `syn-W2M-M`** (`R:` e2; `M: eTwoWTwoMNdcgTenZeroGain`, `...OneFourGain`, `...FiveNineteenGain`, `...TwentyPlusGain`):
- 0 tương tác trước đó: 0.027 (59 người dùng, khoảng tin cậy −0.029 đến 0.090).
- 1–4: 0.021 (115 người dùng).
- 5–19: 0.031 (177 người dùng, Holm p 0.378).
- 20 trở lên: 0.078 (190 người dùng, khoảng tin cậy 0.048 đến 0.112, Holm p 0.002). Đây là hàng duy nhất của F1 tại K = 10 mà cả hai điều kiện đều đúng.

Trên Digg, gain gần bằng 0 ở mọi nhóm (`R:` e2).

**Các metric thầy đề xuất trong Orientation** (bước 5: Recall@K và NDCG@K tại K = 5, 10 và 20, và Coverage). Tất cả đều đã được tính cho mọi phương pháp và mọi nhóm lịch sử (`.docs/results/p7-main/summary.csv` và `coverage.csv`). Luận văn trình bày NDCG@K tại cả ba giá trị K (Phụ lục B), và Recall@10 cùng Coverage@10 (E1).

**Phép so theo nhóm của thầy, với ranh giới của thầy** (5 tương tác trở xuống, so với hơn 20 tương tác). Bảng này là **khám phá** (exploratory). Nó được tính ngày 2026-11-25, sau lần chạy test, từ `eval/results/p7-main/per_user.csv` (SHA-256 của file có trong manifest của lần chạy), với khoảng tin cậy 95% bằng paired bootstrap, không có p-value và không hiệu chỉnh Holm. Script: `.docs/works/2026-11-25-p9-negative-result-note/recall-by-group.py` (kết quả: `recall-by-group.txt`). Cùng script cho ra hàng 0–4, khớp với `R:` e2, để kiểm tra.

| Nhóm | Bộ dữ liệu | Người dùng | Recall@10 H / BL2 | Gain Recall@10 (khoảng tin cậy) | Gain NDCG@10 (khoảng tin cậy) |
|---|---|---:|---:|---:|---:|
| ≤5 | `syn-W2M-M` | 194 | 0.0825 / 0.0206 | 0.0619 (0.0206 đến 0.1082) | 0.0383 (0.0110 đến 0.0683) |
| >20 | `syn-W2M-M` | 184 | 0.1467 / 0.0054 | 0.1413 (0.0924 đến 0.1957) | 0.0810 (0.0494 đến 0.1156) |
| 0–4 (nhóm của H1) | `syn-W2M-M` | 174 | 0.0632 / 0.0230 | 0.0402 (0.0000 đến 0.0862) | 0.0231 (−0.0029 đến 0.0511) |
| ≤5 | `digg2009` | 23,161 | 0.0548 / 0.0546 | 0.0002 (−0.0000 đến 0.0005) | 0.0001 (0.0000 đến 0.0002) |
| >20 | `digg2009` | 22,393 | 0.0489 / 0.0489 | −0.0000 (−0.0003 đến 0.0001) | −0.0000 (−0.0001 đến 0.0001) |

**Cách đọc.** Với ranh giới "5 trở xuống", khoảng tin cậy trên dữ liệu tổng hợp nằm trên 0 với cả hai metric. Nhóm này thêm 20 người dùng có đúng 5 tương tác vào 174 người dùng của nhóm 0–4. Vậy kết quả tổng hợp cho người dùng mới phụ thuộc vào chỗ đặt ranh giới, đó chính là nguyên nhân 3 (nhóm nhỏ). Nó không làm thay đổi H1: H1 đã được khóa với nhóm 0–4, NDCG@10 và Holm p (mục 2), còn bảng này không có p-value. Orientation đưa ra cả hai ranh giới: abstract mẫu viết "fewer than five prior interactions" (0–4), còn bước 5 viết "≤5". Người dùng có hơn 20 tương tác được gain nhiều nhất trên dữ liệu tổng hợp, ngược với kỳ vọng "tốt hơn ở cold start, không tệ hơn với người dùng cũ". Trên Digg, H gần bằng BL2 với mọi ranh giới.

**E1: mọi phương pháp, mọi người dùng** (`R:` e1; `M: eOne...`).

| Phương pháp | `syn-W2M-M` | `digg2009` |
|---|---:|---:|
| BL0 | 0.005 | 0.026 |
| BL1 | 0.003 | 0.025 |
| BL2 | 0.009 | 0.024 |
| BL2t | 0.011 | 0.027 |
| BL3 | 0.007 | 0.023 |
| BL4 | 0.009 | 0.197 |
| BL5 | 0.009 | 0.199 |
| BL6 | 0.011 | 0.025 |
| H | 0.054 | 0.024 |

Trên Digg, BL4 và BL5 gấp khoảng 8 lần BL2 (`S:` mục 4, trạng thái P7; 0.197 và 0.199 so với 0.024). Trên `syn-W2M-M`, H gấp khoảng 6 lần BL2 (0.054 so với 0.009).

**Cách đọc.** Trên `syn-W2M-M`, BL2 đến BL6 đều nằm giữa 0.007 và 0.011, và chỉ có H cao hơn hẳn. Trên Digg, H và các baseline khác không dựa trên thời gian nằm giữa 0.023 và 0.027, và chỉ hai baseline có time decay (suy giảm theo thời gian) cao hơn hẳn. Vì vậy chính dữ liệu quyết định phần nào của score là quan trọng.

**E4: thành phần nào quan trọng, `syn-W2M-M`** (`R:` e4; cột gain là `M: eFourWTwoM...`).

| Biến thể | Mọi người dùng | Nhóm 0–4 | Gain so với BL2 |
|---|---:|---:|---:|
| BL2 | 0.009 | 0.012 | |
| H (m = 5) | 0.054 | 0.035 | 0.045 |
| H-follow (β = 0) | 0.016 | 0.019 | 0.007 |
| H-comm (α = 0) | 0.052 | 0.024 | 0.043 |
| H-noauthor | 0.055 | 0.031 | 0.046 |
| H-noengager | 0.051 | 0.026 | 0.042 |
| H (m = 0) | 0.056 | 0.027 | 0.047 |
| H (m = 2) | 0.060 | 0.043 | 0.051 |
| H (m = 10) | 0.050 | 0.034 | 0.041 |

Trên Digg, mọi biến thể của E4 có gain bằng 0.000 (`M: eFourDiggNdcgHTenAllGain` và các key `eFourDigg...` khác).

**E3, mật độ xã hội** (`R:` e3). Trên `syn-W2M-M`, gain là 0.044 với người dùng có 0 followee và 0.030 với người có 20 trở lên (`M: eThreeWTwoMNdcgTenZeroGain`, `...TwentyPlusGain`). Gain không tăng theo số followee. Trên Digg nó là 0.000 ở mọi bin (nhóm chia theo khoảng giá trị). Vậy H2 không được ủng hộ.

**E5, gain có phải đã có sẵn trong dữ liệu không?** (`R:` e5). Gain so với BL2 tăng theo mức ảnh hưởng trong bộ sinh dữ liệu: 0.012 ở W0, 0.029 ở W1, 0.035, 0.045 và 0.076 ở các ô W2 thấp, trung bình và cao (`M: eFiveWZeroNdcgTenAllGain`, `eFiveWOneNdcgTenAllGain`, `eFiveWTwoLNdcgTenAllGain`, `eFiveWTwoMNdcgTenAllGain`, `eFiveWTwoHNdcgTenAllGain`). W0 và W1 không có ảnh hưởng, nhưng vẫn có gain. Các hàng khác của E5:
- H0 gate (H-follow trên W0): gain 0.001, khoảng tin cậy −0.004 đến 0.006. Gate đạt (`M: hZeroWZeroNdcgHFollowTenAllGain`, `...CiLow`, `...CiHigh`).
- H trên W0 với các giá trị của `syn-W2M-M` (hàng "topic signal" (dịch: "tín hiệu chủ đề")): 0.011, khoảng tin cậy −0.001 đến 0.023 (`M: eFiveWZeroTopicNdcgTenAllGain`, `...CiLow`, `...CiHigh`).
- `syn-W2M-M` với thời điểm tương tác bị xáo trộn (shuffle) bên trong mỗi post: 0.042, so với 0.045 khi không xáo trộn (`M: eFiveWTwoMShuffledNdcgTenAllGain`).

**Tuning (chọn tham số)** (`R:` tuning; `M: tuneWTwoMHChosen`, `tuneDiggHChosen`). α và β đã chọn nằm ở đầu trên của grid (1,024) trên cả hai bộ dữ liệu: 1024/1024 trên `syn-W2M-M` và 1024/0 trên Digg (β không có tác dụng trên Digg). Grid đã phải mở rộng một lần, trước test split, vì cùng lý do (`S:` change log 0.25).

## 5. Vì sao nó thất bại

Bốn nguyên nhân. Mỗi nguyên nhân có bằng chứng và một nhãn: **đã kiểm tra** (tested: có một kết quả đo cho thấy điều đó) hoặc **chưa kiểm tra (cách đọc của chúng em)** (khớp với các số, nhưng chưa có lần chạy nào tách riêng nó ra).

### Nguyên nhân 1. Scale của ba thành phần không khớp nhau

`engagement` không có giới hạn trên. Social term nhiều nhất là 2 (mỗi tổng trust nhiều nhất là 1, `discussion.tex`). Community term nhiều nhất là 1. H cộng chúng lại với các trọng số α và β.

- Bằng chứng: trên Digg, mọi biến thể của H đều bằng BL2 (gain 0.000), và α đã chọn nằm ở rìa của grid, 1,024. Trên `syn-W2M-M`, cả hai trọng số đều nằm ở rìa. NDCG@10 trên validation tại α = β = 512 là 0.048086 và tại 1,024 là 0.048342 (`M: tuneWTwoMHValNdcgTenFiveTwelveFull`, `tuneWTwoMHValNdcgTenTenTwentyFourFull`). Đường cong gần như phẳng ở phía trên. Cách đọc của chúng em: score tốt nhất muốn các thành phần social và community lấn át engagement, nên dạng cộng này đang ở sai scale. Các story của Digg có rất nhiều like (3,007,345 like trên 3,553 story).
- Một điểm yếu của cách đọc này: tại α = 1,024 social term có thể đạt 2,048 điểm (1,024 × 2). Con số đó không nhỏ so với hàng trăm like. Vì vậy riêng scale có thể chưa giải thích được một gain đúng bằng 0. Lý do thứ hai có thể là trên Digg có ít story trong pool nhận được social term khác không: 27,824 trong 64,573 người dùng test được giữ lại không follow ai (`R:` e3; 64,573 là 68,120 trừ 3,547), và chỉ khoảng 59% người vote có trong bảng friend (`S:` mục 8).
- Nhãn: **chưa kiểm tra (cách đọc của chúng em)**. `discussion.tex` cũng nói như vậy ("This reading was not tested" (dịch: "Cách đọc này chưa được kiểm tra")).
- Một phép kiểm tra rẻ, chưa chạy: trên validation split, đếm có bao nhiêu post trong pool nhận được social term khác không, và khoảng cách engagement giữa hạng 1 và hạng 10 lớn đến đâu.

### Nguyên nhân 2. Base (phần nền của score) BL2 yếu về mặt thời gian

BL2 trừ 0.25 điểm cho mỗi giờ tuổi của post (`methodology.tex`, mục 3.2). Cửa sổ là 7 ngày, 168 giờ (`S:` mục 7), nên age term nhiều nhất là 42 điểm (0.25 × 168). Trên Digg, con số đó nhỏ so với số like.

- Bằng chứng: trên Digg, BL4 và BL5 đạt 0.197 và 0.199 còn BL2 có 0.024 (`M: eOneDiggNdcgBLFourTenAllValue`, `eOneDiggNdcgBLFiveTenAllValue`, `eOneDiggNdcgBLTwoTenAllValue`). BL3 (chỉ dùng like) có 0.023 (`M: eOneDiggNdcgBLThreeTenAllValue`), nên BL2 gần giống độ phổ biến thuần túy (plain popularity). BL2t với trọng số tuổi ở đầu trên của grid (4) chỉ đạt 0.027 (`M: tuneDiggBLTwoTChosen`, `eOneDiggNdcgBLTwoTTenAllValue`). Việc một post già đi nhanh thế nào quan trọng hơn nhiều so với việc người dùng follow ai.
- Trên `syn-W2M-M`, base không yếu về thời gian: BL4 và BL5 có 0.009, bằng BL2, và các giá trị đã chọn của chúng nằm ở rìa suy giảm yếu của grid (divisor 720,000, gravity 0.6; `M: tuneWTwoMBLFourChosen`, `tuneWTwoMBLFiveChosen`). Vì vậy nguyên nhân này chỉ áp dụng cho Digg.
- Nhãn: **đã kiểm tra** (một so sánh trực tiếp, E1 và E6). **Chưa kiểm tra (cách đọc của chúng em):** việc H trên một base tốt hơn sẽ cho thấy gain từ social.

### Nguyên nhân 3. Cold start: prior phẳng, và nhóm 0–4 nhỏ

Khi `N_u = 0`, `trust(u,f,t) = (0 + m/|F_u|) / (0 + m) = 1/|F_u|` với mọi followee. Mọi cộng đồng đã tham gia nhận `1/|M_u|`. Social term có thể nói "post này của người bạn follow", nhưng không nói được người dùng thích followee nào hơn. Điều này xảy ra đúng với những người dùng của H1.

- Bằng chứng: gain trên `syn-W2M-M` tăng theo lịch sử: 0.027 ở nhóm 0 và 0.078 ở nhóm 20 trở lên (mục 4). Nhóm 0–4 chỉ có 174 người dùng, nên khoảng tin cậy rộng (−0.002 đến 0.051). Với chừng này người dùng, không thể phân biệt một gain thật nhưng nhỏ với 0. Độ mạnh của prior thay đổi nhóm 0–4 không theo một đường rõ ràng: 0.027 khi m = 0, 0.043 khi m = 2, 0.035 khi m = 5 và 0.034 khi m = 10, so với 0.012 của BL2 (`R:` e4; một bộ dữ liệu, không có khoảng tin cậy).
- Nhãn: **chưa kiểm tra (cách đọc của chúng em)**. Xu hướng theo lịch sử khớp với cách đọc này. Chưa có lần chạy nào thay prior phẳng bằng một prior khác.
- Khoảng tin cậy rộng là một vấn đề riêng, về power (power: khả năng của bài test phát hiện một gain nhỏ nhưng có thật). Vòng 2 không nên lặp lại nó (mục 8).
- Kết quả cũng nhạy với ranh giới của nhóm: với "5 trở xuống" thay cho 0–4 (thêm 20 người dùng), khoảng tin cậy trên dữ liệu tổng hợp nằm trên 0 (mục 4, bảng khám phá).

### Nguyên nhân 4. Gain là tín hiệu chủ đề, không phải follow graph

- Bằng chứng: H-comm có gain 0.043 và H-follow có gain 0.007, trên tổng 0.045 của H đầy đủ (mục 4). Bỏ author term hoặc engager term chỉ làm gain thay đổi rất ít (0.046 và 0.042). W0 và W1 không có ảnh hưởng, nhưng vẫn có gain (0.012 và 0.029). Việc xáo trộn thời điểm tương tác vẫn giữ lại phần lớn gain (0.042). Gain ở 0 followee (0.044) lớn hơn ở 20 trở lên (0.030). Trong bộ sinh dữ liệu, "one community per topic" (dịch: "mỗi chủ đề một cộng đồng"), nên community term đếm các like trước đó của người dùng trên chủ đề đó.
- Cách đọc E5 của chúng em: gain đến từ tương quan (người dùng thích những chủ đề họ đã thích trước đó), không phải từ ảnh hưởng (người dùng thích những gì followee của họ thích trước). Tách hai điều này ra là một bài toán khó đã được biết đến [23], và các test của chúng em không giải quyết được nó (`discussion.tex`).
- Hai gợi ý từ tài liệu, đều chỉ lấy từ abstract, nên chỉ là gợi ý chứ không phải kết luận: [37] nói rằng các rating của item có ảnh hưởng lớn hơn trust graph trong collaborative filtering (lọc cộng tác), và [9] báo cáo mức tăng tới 3 lần của Facebook page like so với ba baseline, trong đó một baseline dựa trên bạn bè Facebook, không có số riêng cho baseline đó (`literature.md`, D2).
- Nhãn: **đã kiểm tra** cho nhận định "gain đến từ community term, không phải phần follow" (E4, E5, E3). **Chưa kiểm tra** trên dữ liệu thật: Digg không có cộng đồng, và phép kiểm tra Hive đã thất bại (`S:` mục 4, trạng thái P7). Việc một cộng đồng trên một nền tảng thật có phải là một chủ đề hay không vẫn còn bỏ ngỏ.

### Bốn nguyên nhân nói gì khi đặt cạnh nhau

Nguyên nhân 1 đến 3 nói về score. Chúng em có thể thay đổi một score, nên chúng dẫn đến Hv2. Nguyên nhân 4 nói về những gì dữ liệu thưởng. Trên dữ liệu synthetic, dữ liệu thưởng cho các chủ đề trước đó của người dùng. Một scale hay một base tốt hơn không thay đổi điều đó. Vì vậy Hv2 không thể biến kết quả synthetic thành kết quả của follow graph. Nó chỉ có thể cho thấy, với một scale công bằng và cùng một base, phần follow có thêm được gì không.

## 6. Điều gì có thể thay đổi và điều gì không

**Điều có thể thay đổi.** Phần thiết kế. P1 vẫn còn mở: phần "Done when" (dịch: "Hoàn thành khi") của nó là thầy hướng dẫn xác nhận các câu hỏi nghiên cứu, dữ liệu và các quyết định thiết kế (`S:` mục 4). Công thức của H, các baseline và kế hoạch cho vòng 2 đều còn mở để thầy quyết định. Một giá trị đã đóng băng (`S:` mục 7: các grid, `m`, master seed 20261014, các mốc thời gian chia dữ liệu) chỉ thay đổi khi tác giả yêu cầu, kèm một dòng có ngày trong change log của super-plan. Một giả thuyết thay đổi theo cách tương tự (`S:` mục 1).

**Điều không thể thay đổi.** Test split đã bị nhìn thấy. Chúng em đã thấy H trên đó, và đã thấy BL4 và BL5 thắng BL2 trên Digg. Một score mới chạy trên cùng test split là **post-hoc** (làm sau khi đã thấy kết quả). Nó phải được báo cáo là post-hoc, không được nhận là một test confirmatory (kiểm chứng: giả thuyết được đặt trước khi xem dữ liệu). Mọi nguyên nhân ở mục 5 đều được tìm ra sau khi có kết quả test, nên chúng là cách đọc, không phải dự đoán.

**Vòng 1 vẫn ở lại trong luận văn.** H1 thất bại ở cả hai co-primary test. Khi đó quy tắc feed mặc định đã quyết định cho app: "For You" giữ nguyên như hiện tại (`FEED_DEFAULT_ALGO` để trống). Hv2 sẽ là vòng thứ hai, trong một mục riêng, với nhãn riêng. Nó không thay thế vòng 1 và không biến thất bại thành thành công. Trong luận văn, điều này có nghĩa là:
- vòng 1 và vòng 2 có bảng riêng và macro riêng;
- mọi số Digg của vòng 2 đều mang chữ "post-hoc";
- lời văn của H1 và câu trả lời cho RQ1 của vòng 1 không thay đổi.

Quy tắc feed mặc định đã được hỏi thầy vào ngày 2026-11-12 (`S:` mục 11, ý 7), và P1 vẫn đang chờ câu trả lời của thầy.

## 7. Các đề xuất

Mọi đề xuất chỉ thay đổi score. Chúng không thay đổi dữ liệu, quy trình (protocol) hay các metric. Tất cả dùng một method id mới trong `@breadit/ranking`. `H`, feed `social` đang chạy thật và app vẫn giữ nguyên. Các chi phí ước lượng là do em ước tính, chưa đo.

Mỗi phần của Hv2 trả lời một nguyên nhân ở mục 5:

| Nguyên nhân | Nhãn | Phần của Hv2 |
|---|---|---|
| 1. Scale | chưa kiểm tra (cách đọc của chúng em) | A, và B (base dùng log) |
| 2. Base yếu | đã kiểm tra (trên Digg) | B |
| 3. Cold start | chưa kiểm tra (cách đọc của chúng em) | C, dạng đơn giản |
| 4. Tín hiệu chủ đề | đã kiểm tra (trên dữ liệu synthetic) | không có; Hv2 đo phần follow so với cùng một base |

Các file mà mọi đề xuất đều động đến (chỉ offline):
- `packages/ranking/src/types.ts`: id mới trong `MethodId`.
- `packages/ranking/src/scorers.ts`: một case mới trong `scorer()`.
- `packages/ranking/src/scorers.spec.ts`: unit test.
- `eval/src/harness/config.ts` (`REQUIRED_PARAMS` là `Record<MethodId, ...>`, nên compiler sẽ đòi id mới), `eval/src/metrics.ts` (`METHOD_ORDER`), `eval/src/harness/freeze.ts` (tuning), `eval/src/report/tables.ts` và `eval/src/report/macros.ts` (các hàng và tên macro).
- Một run config mới trong `eval/config/runs/`. Grid của α và β nằm trong `eval/config/frozen-v1.json`; một grid mới là một giá trị đóng băng mới.

### A. Một scale chung cho ba thành phần

- **Công thức.** Đưa engagement về thang log, để nó có độ lớn gần với các thành phần khác. Dạng A1: `Hv2_A = ln(1 + eng0) + α·social + β·community`, với `eng0 = likes + 2·comments + 3·reposts` (engagement không có age term). Dạng A2 là một boost nhân: `(1 + eng0) · (1 + α·social + β·community)`. Khi lấy log, A2 là `ln(1 + eng0) + ln(1 + α·social + β·community)`, nên A1 và A2 chỉ khác nhau ở chỗ phần boost có bị nén thêm hay không.
- **Giải quyết.** Nguyên nhân 1.
- **Dữ liệu.** Không cần gì mới: số đếm của các post trong pool đã có trong `PostFeatures`.
- **File.** Chỉ các file chung ở trên.
- **Chi phí.** Khoảng nửa ngày (test, grid mới, một lần chạy validation).
- **Rủi ro.** Grid α, β mới có thể lại đặt giá trị tốt nhất ở rìa. Quy tắc phải được đặt trước khi chạy: mở rộng đến đâu, và dừng khi nào. Dạng A2 không nâng được một post có `eng0 = 0`, nên nó làm yếu author term, vốn có nhiệm vụ nâng các post mới của followee. A1 không có vấn đề này. Nếu không có B, A không có time term, nên trên Digg không thể kỳ vọng nó đạt tới BL4 (chưa kiểm tra).

### B. Một base có suy giảm theo thời gian, so sánh với chính base đó

- **Công thức.** Dùng dạng của BL4 làm base: `base(p,t) = log10(max(likes, 1)) + (createdAt − t) / divisor`. Sau đó `Hv2_B = base(p,t) + α·social + β·community`. Một đơn vị của base tương đương hệ số 10 về số like, hoặc `divisor` giây tuổi. Khi `α = β = 0`, Hv2 chính xác là BL4, nên phần social có thể được đo riêng so với cùng một base đã chọn tham số.
- **Giải quyết.** Nguyên nhân 2, và đồng thời nguyên nhân 1: dạng BL4 vốn đã là log, nên social term (nhiều nhất 2) và community term (nhiều nhất 1) cùng scale với `log10(likes)` (khoảng 3 với 1,000 like). Vì vậy ở dạng này B cũng mang ý tưởng một scale chung của A.
- **Dữ liệu.** Không có gì mới: số like và `createdAt`.
- **File.** Chỉ các file chung ở trên. Dạng BL4 đã có sẵn trong `scorers.ts` (`case 'BL4'`), nên code ít.
- **Chi phí.** Khoảng nửa ngày, làm cùng A.
- **Rủi ro.** Có hai. Thứ nhất, trên Digg một base có suy giảm theo thời gian (BL4 hoặc BL5) đã thắng BL2 một mình (0.197 và 0.199 so với 0.024), nên câu "Hv2 thắng BL2 trên Digg" không chứng minh được gì về phần social. Mốc so sánh phải là cùng base đó (BL4 đã chọn tham số). Thứ hai, trên `syn-W2M-M` BL4 và BL5 đã chọn tham số bằng BL2 (0.009), nên B sẽ không làm thay đổi kết quả synthetic. Dạng BL4 cũng là dạng nhạy nhất với các điểm bằng nhau (ties): NDCG@10 của nó trên `syn-W2M-M` đi từ 0.009075 xuống 0.007869 khi đảo tie-break (tie-break: cách xếp thứ tự khi hai post bằng điểm) (`M: eOneWTwoMNdcgBLFourTenAllValueFull`, `eSixWTwoMNdcgBLFourTenAllValueFull`). Em dùng dạng BL4, không dùng dạng BL5. Scorer BL5 xếp post có 0 like vào nhóm điểm thấp nhất (lowest band), nên author term không nâng nó lên được.

### C. Một prior lấy từ hành vi của tất cả người dùng

- **Công thức (dạng đơn giản).** Thay `1/|F_u|` phẳng bằng tỷ lệ positive của đám đông. Gọi `P_f` là số positive (của tất cả người dùng, trước t) trên các post trong pool của f. Khi đó `w_f = P_f / Σ_{g in F_u} P_g`, và `trust_C(u,f,t) = (n_uf + m · w_f) / (N_u + m)`. Nếu tổng bằng 0, dùng `1/|F_u|`. Tương tự cho community term: `w_c = P_c / Σ_{c' in M_u} P_c'` thay cho `1/|M_u|`. Các trọng số vẫn có tổng bằng 1, nên giới hạn "trust nhiều nhất 1" vẫn giữ. Cách này gần hơn với m-estimate của [29], vốn có prior được ước lượng từ dữ liệu, còn prior của chúng em là chia đều và không được ước lượng (`literature.md`, D2, bảng ánh xạ (mapping table)).
- **Giải quyết.** Nguyên nhân 3, cho người dùng có `N_u` gần 0.
- **Dữ liệu.** Dạng đơn giản cần các positive trên các post trong pool, tác giả và cộng đồng của các post trong pool. `FeedService` đã tải sẵn chúng (bước 5 của `rank()` trong `apps/backend/src/feed/feed.service.ts`), và harness dựng chúng theo từng post trong pool (`fastPostFeatures`). Dạng đầy đủ cần nhiều hơn: positive trên các post cũ hơn cửa sổ của pool, hoặc positive của những người dùng giống u. Điều đó có nghĩa là thêm query mới và nhiều dòng hơn cho mỗi request, và cũng làm thay đổi chi phí đã đo ở E7. Em không đề xuất dạng đầy đủ cho vòng 2.
- **File.** Các file chung ở trên, cộng thêm `packages/ranking/src/features.ts` (một builder thuần (pure: không có database, đồng hồ hay ngẫu nhiên) tính `w_f` và `w_c` từ các post trong pool và features của chúng), `packages/ranking/src/types.ts` (một field tùy chọn trong `ScoreContext`, vì một scorer mỗi lần chỉ thấy một post) và `eval/src/harness/run.ts` (nơi dựng context, dòng `const ctx = ...`). `features.spec.ts` chứa các test.
- **Chi phí.** Khoảng một ngày.
- **Rủi ro.** `P_f` cũng là một tín hiệu độ phổ biến, mà base đã tính độ phổ biến rồi. C có thể tính nó hai lần. Vì vậy C cần một ablation riêng (ablation: thử bỏ hoặc tắt từng phần của score để xem phần đó có ích không): Hv2 với prior phẳng so với Hv2 với C.

### Các hybrid score khác từ tài liệu

Chỉ dùng các tài liệu tham khảo được đánh dấu "verified" (dịch: "đã xác minh") trong `S:` mục 10. Em chỉ nói những gì `S:` mục 10 và `literature.md` nói về chúng.
- **Làm mờ dần các tương tác cũ (RealGraph [5], toàn văn).** RealGraph làm giảm trọng số các tương tác cũ (mục 2.1) và có một feature là số đếm theo ngày, giảm dần theo hàm mũ (mục 2.1.1). Tác giả đã chọn "no fade" (dịch: "không làm mờ dần") vào ngày 2026-10-24 (PC2), để tránh thêm một tham số mới. **Ngoài vòng 2:** làm mờ dần thay đổi cách lịch sử được tính, mà người dùng của H1 gần như không có lịch sử. Có thể làm thêm như một ablation sau này.
- **Hai bước (DiffNet [3], toàn văn).** Trong [3], hai layer tốt hơn một layer 2.50% (Yelp) và 2.96% (Flickr) trên HR@10. Đó là một mô hình embedding được học, nên chỉ là gợi ý cho một phép đếm. Không nguồn nào đưa ra quy tắc cho trust của bạn của bạn (`literature.md`, D4). Đồ thị của Digg không đầy đủ: khoảng 59% người vote có trong bảng friend (`S:` mục 8). **Ngoài vòng 2:** nó không gắn với nguyên nhân nào ở mục 5, và nó cần các follow của followee.
- **Độ mạnh tương tác và các thước đo trust ([33] và [35], chỉ có abstract).** [33] định nghĩa một độ mạnh tương tác giữa các người dùng và gắn nó với việc tham gia nhóm, trong một mô hình matrix factorization để dự đoán rating. [35] đề xuất một thước đo tương đồng bất đối xứng cho trust xã hội, cũng nằm trong một mô hình matrix factorization. Cả hai đều là mô hình được học, và kết luận chỉ lấy từ abstract thì không được trích dẫn (`S:` mục 10). **Loại:** chỉ là ý tưởng. Các mô hình được học nằm ngoài phạm vi (`S:` mục 9).

### Khuyến nghị

**A + B + dạng đơn giản của C, chỉ offline.** Một method id mới (một cái tên như `Hv2`), `H` không đổi, khoảng 2 ngày code và chạy, cộng với phần văn bản luận văn và các tài liệu (quy tắc của `CLAUDE.md` yêu cầu cập nhật `docs/System_Architecture.md` và Guidance Manual, cả hai ngôn ngữ).

```
base(p,t)          = log10(max(likes, 1)) + (createdAt − t) / divisor
Hv2(p,u,t)         = base(p,t) + α · social_C(p,u,t) + β · community_C(p,u,t)
social_C, community_C: the terms of H with the prior of C instead of 1/|F_u| and 1/|M_u|
```

Hv2 với `α = β = 0` chính là BL4. Với `divisor` rất lớn, time term gần bằng 0: một base log không có thời gian. Với prior phẳng, C bị tắt. Vì vậy mỗi phần đều có một công tắc cho các ablation ở mục 8.

Em dự đoán như sau, và có thể em sai.
- Trên `syn-W2M-M`, gain vẫn chủ yếu đến từ community term. Không phần nào trong A, B hay C thay đổi nguyên nhân 4.
- Ở nhóm 0–4 của `syn-W2M-M`, khoảng tin cậy vẫn có thể chứa 0, vì số người dùng vẫn ít.
- Trên Digg, base sẽ gấp khoảng 8 lần BL2. Câu hỏi còn mở là các follow term có thêm được gì trên nền đó không.

Nếu các follow term không thêm được gì trên Digg ở một scale công bằng, đó là một negative result (kết quả âm tính: kết quả không ủng hộ giả thuyết) mạnh hơn vòng 1. Điều đó đáng được báo cáo.

## 8. Hv2 sẽ được kiểm tra trung thực như thế nào

1. **Ghi ra trước.** Trước mọi lần chạy: công thức, các grid, quy tắc quyết định, mốc so sánh (reference) và danh sách các ablation, trong một dòng có ngày của change log super-plan. Tác giả đóng băng và duyệt các test config, như ở vòng 1 (`"testApprovedBy": "author"`).
2. **Chỉ chọn tham số trên validation.** α, β và `divisor` được chọn trên validation split của từng bộ dữ liệu, với một grid mới theo lũy thừa của 2 đủ rộng để giá trị tốt nhất không nằm ở rìa. Giới hạn mở rộng được cố định ở bước 1.
3. **Một seed synthetic mới cho test confirmatory.** Sinh lại `syn-W2M-M` với cùng tham số và một master seed mới. Master seed 20261014 là một giá trị đóng băng (`S:` mục 7), nên seed mới được thêm bên cạnh và không thay thế nó. Các file của vòng 1 giữ nguyên từng byte, và `npm run thesis:repro` vẫn đạt. Chọn tham số trên validation split của seed mới. Test một lần trên test split của nó. Mỗi seed mới cho một nhóm 0–4 khác có cỡ gần bằng vòng 1 (174 người dùng), nên power vẫn thấp. Hai seed, hoặc cỡ L đã bị cắt bỏ (`S:` mục 9), sẽ giúp ích. Đây là một câu hỏi dành cho thầy.
4. **Các ablation** (mỗi cái là một cách đặt tham số của Hv2, nên không cần thêm code): chỉ base (`α = β = 0`, giống BL4); chỉ follow (`β = 0`); chỉ community (`α = 0`); không có thời gian (`divisor` rất lớn); prior phẳng so với C. Mỗi cái đi kèm một khoảng tin cậy và không có p-value, như ở E4.
5. **Quy tắc quyết định.** Cùng dạng với H1: NDCG@10, nhóm 0–4, Holm p nhỏ hơn 0.05 và đầu dưới của khoảng tin cậy lớn hơn 0. Mốc so sánh chính là cùng base đó (BL4 đã chọn tham số). So sánh với BL2 và với H được báo cáo bên cạnh. H0 gate chạy lại: Hv2 với β = 0 không được thắng base của nó trên W0 của seed mới.
6. **Digg là post-hoc.** Test split của nó đã bị nhìn thấy. Chọn tham số trên validation split của nó, chạy test split, và báo cáo kết quả là **post-hoc**, cạnh vòng 1, kèm khoảng tin cậy và không nhận là confirmatory. Một bộ dữ liệu thật mới hoàn toàn sẽ làm cho test trên dữ liệu thật trở thành confirmatory. Flickr WWW 2009 [46] đã được giữ lại làm bộ dữ liệu thật thứ hai, nhưng các favorite của nó chỉ có thứ tự, không có thời gian, nên cần một adapter mới và một quy tắc as-of mới (as-of: chỉ dùng dữ liệu có trước một thời điểm) (`.docs/supervisor-note.md`, mục 4). Em không đề xuất nó cho vòng 2.
7. **App.** App giữ nguyên feed của nó. Quy tắc feed mặc định là cách duy nhất để thay đổi, và nó đòi hỏi H1 đạt ở cả hai co-primary test. Với một test Digg post-hoc, thậm chí một kết quả đạt cũng không thể thỏa quy tắc như đang được viết. Vì vậy hoặc app giữ nguyên bất kể Hv2 cho thấy điều gì, hoặc thầy đổi quy tắc trước khi chạy, kèm một dòng change-log.

**Cách đọc các kết quả của vòng 2.**
- Hv2 đạt trên seed synthetic mới, và trên Digg nó cộng thêm được vào base của nó: scale và base là một phần của vấn đề.
- Hv2 chỉ đạt trên seed synthetic mới: gain lại là một tín hiệu chủ đề từ community term, và follow graph không thêm được gì trên dữ liệu thật.
- Hv2 thất bại ở cả hai: câu trả lời cho RQ1 là "không" hai lần, và lần thứ hai với một scale công bằng và một base công bằng. Đó là một negative result mạnh hơn.

**Điều gì giữ nguyên trong kiến trúc.** `@breadit/ranking` là pure và dùng chung. Một scorer mới chỉ động đến `packages/ranking` và `eval/`. `apps/backend/src/feed/feed.constants.ts` vẫn ánh xạ `social` sang `H`, nên parity test (thứ tự live bằng thứ tự của harness) không bị ảnh hưởng. Nếu Hv2 có lúc nào đó chạy thật, A và B không cần dữ liệu mới, C cần builder ở mức pool trong `FeedService.rank`, và parity test cùng E7 phải được chạy lại.

## 9. Câu hỏi cho thầy hướng dẫn

1. **Kết quả chính.** Thầy có chấp nhận rằng H1 thất bại ở cả hai co-primary test, và luận văn báo cáo đúng như vậy (vòng 1 không đổi), cùng với phát hiện rằng gain trên dữ liệu synthetic là một tín hiệu chủ đề từ community term không?
2. **Vòng 2 hay future work.** Hv2 nên chạy như một vòng hai được đánh dấu rõ (khoảng 2 ngày code và chạy, cộng với phần văn bản của các Chương 3, 6, 7 và 9), hay chỉ được viết như future work (hướng phát triển sau) ở Chương 9?
3. **Thay đổi nào.** Nếu làm vòng 2: A + B + dạng đơn giản của C, như em khuyến nghị? Và một gain đến từ community term (một tín hiệu chủ đề) có phải là câu trả lời chấp nhận được cho RQ1 không, hay phần follow phải thêm được điều gì đó so với cùng base?
4. **Digg post-hoc và app.** Một kết quả Digg post-hoc có chấp nhận được không, đặt cạnh một kết quả confirmatory trên một seed synthetic mới? Quy tắc feed mặc định nên giữ như đã viết (khi đó app giữ nguyên), hay đổi trước khi chạy? Và thầy có muốn thêm power không: một seed thứ hai hay cỡ L?
5. **Ngày tháng.** Ngày kiểm tra bản nháp đầy đủ, ngày nộp và ngày bảo vệ là khi nào? Chúng em chưa biết các ngày này (`S:` đoạn mở đầu, và mục 11, ý 1), và chúng quyết định vòng 2 có kịp hay không.
