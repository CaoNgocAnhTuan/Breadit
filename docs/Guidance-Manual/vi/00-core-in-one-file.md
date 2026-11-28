# 00 · Nền tảng trong một file

[Guidance Manual](../Guidance-Manual.md) · [English](../en/00-core-in-one-file.md) · Tiếng Việt

**Đọc xong bạn có thể:** nói được trong dữ liệu có gì, năm thế giới synthetic là gì, chín phương pháp xếp hạng thế nào, một sự kiện thô biến thành Recall@K và NDCG@K ra sao, H được so với BL2 thế nào, và H0, H1, H2 thật sự cho thấy điều gì.

Đọc từ trên xuống: file đi theo **một mạch**, từ dòng dữ liệu thô đến kết luận. Các file khác đi sâu hơn, và mỗi mục có link tới chúng. Viết ngày 2026-11-28.

Nguồn của các con số: số kết quả nằm trong `.docs/results/p7-report/results.md` và các thư mục lần chạy trong `.docs/results/`. Số đếm dữ liệu nằm trong `eval/data/<datasetId>/manifest.json`. Điểm số của các ví dụ ở §4 và §6 được tính bằng code thật (`@breadit/ranking` và harness).

---

## 0. Cả thesis trong một hình

```
dữ liệu (6 bảng CSV)
  → mỗi user giấu một item: bài mới cuối cùng họ like, comment hoặc repost sau mốc cắt T
  → dựng lại những gì app biết ngay trước thời điểm đó (as-of)
  → dựng pool: các bài có thể được hiển thị
  → mỗi phương pháp chấm điểm từng bài, rồi sắp xếp
  → tìm hạng r của bài bị giấu
  → Recall@K, NDCG@K cho từng user, Coverage@K cho từng phương pháp
  → H trừ BL2, từng user một → gain → khoảng tin cậy, p-value, Holm
  → kết luận: H0 (có tin được không?), H1 (RQ1), H2 (RQ2)
```

## 1. Những từ cần biết trước

Các thuật ngữ khác nằm ở [09 Bảng thuật ngữ](09-glossary.md).

| Từ | Nghĩa |
|---|---|
| **Positive** | Một like, comment hoặc repost. Là phản hồi duy nhất được dùng. Không có dislike |
| **Followee** | User mà tôi follow |
| **Test item** | Bài bị giấu: positive cuối cùng của user sau T, trên một bài họ chưa từng đụng tới |
| **t_u** | Thời điểm của test item của user u. Mọi thứ về u được tính ngay trước đó |
| **As-of** | Chỉ tính các sự kiện trước t_u. Nhờ đó chặn **leakage** (dùng dữ liệu tương lai) |
| **Pool** | Các bài mà một phương pháp được phép xếp hạng cho user này tại thời điểm này |
| **Hạng r** | Vị trí của test item trong pool đã xếp. 1 là tốt nhất |
| **History** | Số positive của u trước t_u |
| **Cold start** | Ít lịch sử. Trong thesis: nhóm 0–4 |
| **Baseline** | Phương pháp dùng để so sánh |
| **Ablation** | H bị tắt một phần, để xem phần đó đóng góp gì |
| **Gain** | Trung bình trên các user của (điểm của H − điểm của BL2) |
| **Validation / test** | Tham số được chọn trên validation item. Test item chỉ chạy một lần, ở cuối |
| **Homophily** | Người giống nhau thì kết nối với nhau. Like của họ trùng nhau dù không ai ảnh hưởng ai |
| **Influence (ảnh hưởng)** | Việc followee làm khiến tôi dễ làm theo hơn |

## 2. Dữ liệu

### 2.1 Sáu bảng

Mọi dataset, synthetic hay thật, đều có cùng sáu bảng CSV. Đây là các dòng thật của `syn-W2M-M`.

```
users.csv          user_id,joined_at                              1,9615103
follows.csv        follower_id,followee_id,created_at             2,74,12335926
communities.csv    community_id,created_at                        1,0
memberships.csv    user_id,community_id,joined_at                 1,3,13802787
posts.csv          post_id,author_id,community_id,created_at      1,919,,15552198
                                                                  2,209,17,15552245
interactions.csv   event_id,user_id,post_id,type,created_at       1,483,2,like,15552328
```

Cách đọc:
- `follows`: user 2 follow user 74, từ thời điểm 12335926.
- `posts`: bài 1 không thuộc community nào (ô để trống). Bài 2 thuộc community 17.
- `interactions`: user 483 like bài 2. Các dòng này chính là positive.

Id là số nguyên. Thời gian là số giây nguyên. Trong dữ liệu synthetic, giây được đếm từ 2026-01-01 00:00 UTC; trong Digg là giây Unix. Sự kiện chỉ được thêm vào: không có unlike và unfollow. **Không có nội dung bài viết**: nghiên cứu không nhìn vào chữ.

### 2.2 Có bao nhiêu dữ liệu

| | `syn-W0-M` | `syn-W1-M`, `syn-W2L-M`, `syn-W2M-M`, `syn-W2H-M` | `digg2009` |
|---|---:|---:|---:|
| User | 1,000 | 1,000 | 336,047 |
| Bài | 20,000 | 20,000 | 3,553 |
| Follow | 12,085 | 12,126 | 1,729,983 |
| Tương tác | 22,258 | 22,258 | 3,007,345 |
| Community / membership | 20 / 1,773 | 20 / 1,773 | 0 / 0 |
| Loại tương tác | like, comment, repost | like, comment, repost | chỉ like |

### 2.3 Synthetic so với Digg

| | Synthetic | Digg 2009 |
|---|---|---|
| Là gì | do một chương trình có seed sinh ra | lượt vote và follow thật của trang tin Digg, tháng 6/2009 |
| Một bài là | một bài được sinh ra | một tin lên trang nhất; tác giả là người vote đầu tiên |
| Điểm mạnh | mình điều khiển được hiệu ứng social; có community | không ai cài đặt hiệu ứng social |
| Điểm yếu | "kết quả được cài sẵn" | cũ, chỉ có tin nổi tiếng, không có community, khoảng 41% người vote không có trong bảng friend |
| Kiểm tra được | H0, H1 (test 1), H2, community term | H1 (test 2), các follow term |

**Một giới hạn rất dễ bỏ sót: một user follow bao nhiêu tài khoản.** Chúng em đếm các dòng của `follows.csv`.

| Tính trên cả file | `syn-W2M-M` | `digg2009` |
|---|---|---|
| User có ít nhất một followee | 496 trên 1,000 | 71,269 |
| Danh sách ngắn nhất / trung vị | 10 / 19 | 1 / 3 |
| Tỉ lệ trong số này follow 1–4 / 5–9 / từ 10 trở lên | 0% / 0% / 100% | 58.1% / 17.4% / 24.4% |

Vậy trong `syn-W2M-M`, một user **hoặc không follow ai (504 user), hoặc follow ít nhất 10 tài khoản**. Trên Digg, phần lớn danh sách đều ngắn.

- **Vì sao:** mỗi user có danh sách được 1 follow, cộng một phần của số còn lại, chia theo một trọng số ngẫu nhiên không bao giờ nhỏ hơn 1 (`eval/src/generator/follows.ts`). Với trung bình khoảng 19.4, danh sách ngắn nhất là 10.
- **Phần calibrate** đã khớp tỉ lệ user có danh sách (51.19%) và độ dài trung bình (24.26 trên Digg, 24.45 ở đây). Nó không khớp hình dạng phân bố. `.docs/datasets.md` ghi rằng các percentile trên những user có danh sách chưa được tính.
- **Ý nghĩa:** dữ liệu synthetic không kiểm tra được H2 ở mức follow thấp. Tại thời điểm test có một user nằm trong bin 1–4, vì một follow chỉ được tính nếu nó có trước t_u.
- Phát hiện ngày 2026-11-28. **Thesis chưa viết điều này.**

Xem thêm: [04 Dữ liệu](04-data.md).

## 3. Năm thế giới synthetic

### 3.1 Dữ liệu được sinh thế nào

Chương trình chạy năm bước, tất cả từ seed 20261014:
1. **User:** mỗi người có một chủ đề chính bị ẩn (20 chủ đề) và một mức độ hoạt động. Một số ít user hoạt động rất nhiều.
2. **Follow:** 51.19% user có danh sách follow. **Homophily** `h` khiến user ưu tiên followee có chủ đề giống mình.
3. **Community:** mỗi chủ đề một community, nên **một community chính là một chủ đề**. 30% user không vào community nào; số còn lại vào 1 đến 4.
4. **Bài:** mỗi bài có tác giả và chủ đề. 30% bài thuộc một community.
5. **Tương tác:** mỗi hành động chọn ngẫu nhiên một bài trong 7 ngày gần nhất, theo trọng số này:

```
trọng số = mức quan tâm chủ đề × độ mới × độ phổ biến × (1 + g_s · S) × (1 + g_c · member)
S = 1 nếu tôi follow tác giả, cộng số followee của tôi đã hành động trên bài đó
```

`g_s` là độ mạnh của **ảnh hưởng social**, `g_c` là của **ảnh hưởng community**. `member` bằng 1 nếu tôi thuộc community của bài, ngược lại bằng 0. Chương trình không hề dùng phương pháp xếp hạng nào, nên không phương pháp nào tự tạo ra dữ liệu test cho mình.

### 3.2 Các thế giới

"M" là cỡ dữ liệu: 1,000 user và 20,000 bài. Năm thế giới chỉ khác nhau ở ba con số.

| Thế giới | h | g_s | g_c | Là gì | Social lift | Gain của H so với BL2, mọi user (khoảng 95%) |
|---|---:|---:|---:|---|---:|---:|
| **W0** | 0 | 0 | 0 | thế giới null: follow là ngẫu nhiên và không có tác dụng | 1.09 | 0.012 (0.000 đến 0.024) |
| **W1** | 0.7 | 0 | 0 | chỉ có homophily: người giống nhau follow nhau, không có ảnh hưởng | 1.57 | 0.029 (0.017 đến 0.041) |
| **W2L** | 0.7 | 0.5 | 0.5 | ảnh hưởng thấp | 2.24 | 0.035 (0.021 đến 0.051) |
| **W2M** | 0.7 | 2 | 2 | ảnh hưởng trung bình: **thế giới của H1** | 3.78 | 0.045 (0.028 đến 0.062) |
| **W2H** | 0.7 | 8 | 8 | ảnh hưởng cao | 7.64 | 0.076 (0.057 đến 0.095) |

**Social lift** đo xem user hành động trên những bài mà followee "chỉ cho" nhiều hơn ngẫu nhiên bao nhiêu lần. 1 nghĩa là không có tác dụng. Gain là NDCG@10, thí nghiệm E5, mỗi thế giới dùng α và β tune riêng. Đây là các thế giới 1,000 user, tính trên test item của chúng.

**Đọc cột cuối cẩn thận.** H vẫn có gain ở W0 và W1, nơi không có ảnh hưởng. Đây **không phải bug**. Community term đếm số like trước đó của tôi trong một community. Community là một chủ đề, nên term này tìm ra mối quan tâm theo chủ đề của tôi. Ta gọi nó là **tín hiệu chủ đề** (topic signal).

Vì vậy cổng H0 dùng **H-follow** (không có community term), không dùng H đầy đủ. Trên W0, H-follow − BL2 là 0.001 (khoảng −0.004 đến 0.006).

## 4. Chín phương pháp xếp hạng

### 4.1 Công thức

`age` là tuổi của bài tính bằng giờ tại thời điểm t. `likes`, `comments`, `reposts` được đếm trước t. Mọi phương pháp xếp hạng cùng một pool. Mỗi điểm được lưu thành `floor(score × 100)`; bài bằng điểm được xếp theo post id, id lớn hơn đứng trước.

| Id | Điểm | Giá trị đã tune: `syn-W2M-M` / `digg2009` | Vì sao có mặt |
|---|---|---|---|
| **BL0** | bài của followee trước, mới nhất trước; sau đó các bài còn lại, mới nhất trước | không có | "For You" hiện nay |
| **BL1** | mới nhất trước | không có | feed đơn giản nhất |
| **BL2** | `likes + 2·comments + 3·reposts − 0.25·age` | không có | điểm Explore hiện nay; **mốc so sánh của H1** |
| **BL2t** | BL2 với trọng số tuổi được tune thay cho 0.25 | 0.125 / 4 | BL2 được tune công sức ngang H |
| **BL3** | `likes` | không có | độ phổ biến thuần |
| **BL4** | `log10(max(likes, 1)) + (createdAt − t) / divisor` (giây) | divisor 720000 / 45000 | "hot" của Reddit, một công thức mạnh nổi tiếng |
| **BL5** | `0.8·ln(likes) − gravity·ln(age + 2)`; bài 0 like xếp cuối | gravity 0.6 / 1.5 | xếp hạng của Hacker News, công thức mạnh thứ hai |
| **BL6** | BL2 + `α · count`, với count = (1 nếu tôi follow tác giả) + (số followee đã hành động trên bài) | α 16 / 1024 | các follow term với mọi trust đặt bằng 1 |
| **H** | BL2 + `α·social + β·community` | α, β 1024, 1024 / 1024, 0 | **phương pháp của thesis** |

BL5 chính là công thức Hacker News `(P − 1)^0.8 / (age + 2)^gravity` với `P − 1 = likes`, viết bằng logarit. Thứ tự xếp hạng giống hệt.

### 4.2 Hai term của H

```
trust(f)      = (n_f + m / |F|) / (N + m)
social(p)     = [tôi follow tác giả của p] · trust(tác giả) + Σ trust(f) trên các followee f đã hành động trên p
community(p)  = (c + m · [tôi là thành viên community của p] / |M|) / (N + m)       bằng 0 nếu p không có community
```

| Ký hiệu | Nghĩa |
|---|---|
| `n_f` | số positive trước đó của tôi trên bài của followee f |
| `N` | tổng số positive trước đó của tôi |
| `\|F\|`, `\|M\|` | số tài khoản tôi follow, số community tôi đã vào |
| `c` | số positive trước đó của tôi trong community của p |
| `m` | độ mạnh của prior, đóng băng ở 5 |

Khi chưa có lịch sử (N = 0): `trust = 1/|F|` cho mọi followee, và mỗi community đã vào được `1/|M|`. Khi lịch sử dài, hành vi thật của tôi sẽ lấn át.

### 4.3 Cùng ba bài, xếp bởi mọi phương pháp

Hai user cùng follow A và B và cùng là thành viên community C1. User **mới** chưa có lịch sử. User **cũ** có 45 positive: 40 trên bài của A, 5 trong C1, không có cái nào trên bài của B.

| Bài | Tác giả | Community | Likes | Comments | Reposts | Tuổi | Followee đã hành động |
|---|---|---|---:|---:|---:|---:|---|
| p1 | A (đã follow) | không | 3 | 1 | 0 | 10 giờ | B |
| p2 | X | C1 | 6 | 0 | 1 | 4 giờ | không ai |
| p3 | Y | không | 10 | 2 | 0 | 20 giờ | không ai |

**Tham số ví dụ, không phải giá trị đã tune:** BL2t trọng số tuổi 1; BL4 divisor 45000; BL5 gravity 1.8; BL6 α 8; H α 8, β 2, m 5.

| Phương pháp | p1 | p2 | p3 | Thứ tự | Điều quyết định |
|---|---:|---:|---:|---|---|
| BL0 | followee | | | p1, p2, p3 | follow, rồi thời gian |
| BL1 | | | | p2, p1, p3 | chỉ thời gian |
| BL2 | 2.50 | 8.00 | 9.00 | p3, p2, p1 | độ phổ biến, trừ nhẹ theo tuổi |
| BL2t | −5.00 | 5.00 | −6.00 | p2, p1, p3 | phạt tuổi mạnh hơn |
| BL3 | 3.00 | 6.00 | 10.00 | p3, p2, p1 | chỉ số like |
| BL4 | −0.33 | 0.45 | −0.61 | p2, p1, p3 | like theo thang log, và thời gian |
| BL5 | −3.60 | −1.80 | −3.73 | p2, p1, p3 | like so với tuổi |
| BL6 | 18.50 | 8.00 | 9.00 | p1, p3, p2 | độ phổ biến + số followee |
| H, user mới | 10.50 | 10.00 | 9.00 | p1, p2, p3 | trust chia đều, community C1 |
| H, user cũ | 9.69 | 8.40 | 9.00 | p1, p3, p2 | trust với A cao, C1 thấp |

Từ BL0 đến BL6 cho **cùng một** kết quả với user mới và user cũ, vì chúng bỏ qua lịch sử. Chỉ H thay đổi.

### 4.4 Ablation (H bị tắt một phần)

| Tên | Phần bị tắt |
|---|---|
| H-follow | community term (β = 0) |
| H-comm | social term (α = 0) |
| H-noauthor | phần "tôi follow tác giả" |
| H-noengager | phần "followee của tôi đã hành động trên bài" |
| H với m = 0, 2, 10 | đổi độ mạnh của prior |

**BL6 là H-follow với mọi trust đặt bằng 1.** Vì vậy, câu hỏi công bằng "trọng số trust thêm được gì?" phải so **H-follow với BL6**, không phải H với BL6. Trên `syn-W2M-M` (NDCG@10, mọi user), H-follow đạt 0.016 và BL6 đạt 0.011. Cặp này chưa được tính khoảng tin cậy, và mỗi bên dùng α riêng (1024 cho H-follow, lấy từ H, và 16 cho BL6). H đạt 0.054 chủ yếu nhờ community term: riêng H-comm đã đạt 0.052.

Xem thêm: [03 Điểm hybrid](03-hybrid-score.md).

## 5. Từ một bảng xếp hạng đến một con số

### 5.1 Các bước

1. **Mốc cắt T.** Mỗi dataset một mốc: 80% số positive nằm tại hoặc trước T. T là 21412417 với các dataset synthetic cỡ M, và 1246068297 với Digg.
2. **Test item.** Với mỗi user, là positive cuối cùng sau T trên một bài mới. Mỗi user một cái.
3. **Pool.** Các bài gốc trong 7 ngày trước t_u, tối đa 2,000 bài mới nhất, bỏ bài của chính tôi và bài tôi đã đụng tới.
4. **Left out (bị loại).** Nếu bài test không nằm trong pool thì user đó không được tính. `syn-W2M-M`: 49 trên 590. `digg2009`: 3,547 trên 68,120.
5. **Xếp hạng.** Mỗi phương pháp xếp cả pool. Không lấy mẫu ngẫu nhiên các bài "sai".
6. **Nhóm** theo lịch sử: 0, 1–4, 5–19, từ 20 trở lên, và 0–4 (nhóm của H1).

| User test được giữ lại | 0 | 1–4 | 0–4 | 5–19 | 20+ | tất cả |
|---|---:|---:|---:|---:|---:|---:|
| `syn-W2M-M` | 59 | 115 | 174 | 177 | 190 | 541 |
| `digg2009` | 6,638 | 14,006 | 20,644 | 20,787 | 23,142 | 64,573 |

### 5.2 Ba metric

Mỗi user có một bài test ở hạng r.

| Metric | Với một user | Với một nhóm |
|---|---|---|
| **Recall@K** | 1 nếu r ≤ K, ngược lại 0 | tỉ lệ user có bài test nằm trong top K |
| **NDCG@K** | `1 / log2(r + 1)` nếu r ≤ K, ngược lại 0 | lấy trung bình |
| **Coverage@K** | (không tính theo từng user) | số bài khác nhau xuất hiện trong các top K ÷ số bài khác nhau trong các pool |

- Ở đây **Recall@K = HitRate@K**, vì mỗi user chỉ có một bài đúng.
- **NDCG** còn xét vị trí. Hạng 1 được 1.000, hạng 2 được 0.631, hạng 3 được 0.500, hạng 9 được 0.301, hạng 10 được 0.289; ở K = 10, hạng 11 trở xuống được 0.
- **Coverage** không cho biết bài có đúng hay không. Nó cho biết phương pháp hiển thị nhiều bài khác nhau hay cứ vài bài đó. Hãy đọc nó cạnh NDCG.
- K là 5, 10 và 20. Metric chính là **NDCG@10**.

**Ví dụ.** Năm user có hạng 1, 3, 8, 14 và 40:
- Recall@10 = 3 trên 5 = 0.600.
- NDCG@10 = (1.000 + 0.500 + 0.315 + 0 + 0) / 5 = 0.363.

**Ví dụ Coverage.** Ba user, K = 3, các pool có 10 bài khác nhau. Nếu ba danh sách top 3 chỉ gồm 4 bài khác nhau thì Coverage@3 = 0.4. Nếu gồm 9 bài thì là 0.9.

Xem thêm: [05 Giao thức](05-evaluation-protocol.md).

## 6. Một user thật, từ dòng dữ liệu thô đến metric

User **844** của `syn-W2M-M`, nhóm lịch sử 1–4.

**Những gì ta biết trước thời điểm test** (t_u = 21447443):
- Một positive trước đó: dòng `4938,844,3942,comment,17448185`. Bài 3942 của user 787 và không thuộc community nào. Vậy N = 1.
- 13 followee: 45, 46, 49, 170, 314, 339, 374, 390, 409, 604, 691, 695, 750. User 787 **không** nằm trong số đó.
- 4 community: 1, 7, 12 và 16.

**Sự kiện test:** dòng `17930,844,15863,like,21447443`. Bài test là `15863,967,16,21431292`: tác giả 967 (chưa follow), community 16 (844 là thành viên).

**Những gì thuật toán được thấy về bài 15863:** 0 like, 0 comment, 0 repost, và tuổi 4.49 giờ. Chính lượt like của user 844 thì không được thấy: đó là thứ cần dự đoán.

**Pool** có 1,991 bài.

**Điểm BL2:** `0 + 0 + 0 − 0.25 × 4.49 = −1.12`.

**Điểm H**, với α = β = 1024 và m = 5:

```
social      = 0        (chưa follow tác giả, không followee nào hành động trên bài)
community   = (c + m / |M|) / (N + m) = (0 + 5/4) / (1 + 5) = 0.2083
H           = −1.12 + 1024 × 0 + 1024 × 0.2083 = 212.21
```

**Phần đầu của hai bảng xếp hạng**

| | Bài | Vì sao đứng cao | Điểm |
|---|---|---|---:|
| BL2, hạng 1 | 15880 | 2 comment, mới 3.6 giờ | 3.11 |
| H, hạng 1 | 15617 | tác giả đã follow (390), thuộc community đã vào: social 0.0641, community 0.2083 | 272.89 |
| H, hạng 3 | 15881 | thuộc community đã vào | 213.45 |
| H, hạng 9 | **15863 (bài test)** | thuộc community đã vào | 212.21 |

Với một followee chưa có lịch sử, trust = (0 + 5/13) / (1 + 5) = 0.0641.

**Với các bài nêu ở đây,** social term cộng khoảng 66 điểm và community term khoảng 213 điểm, còn engagement chỉ nằm trong khoảng −21 đến 3. Vì vậy ở đây engagement chủ yếu xếp thứ tự giữa những bài được cộng điểm social và community giống nhau.

**Mọi phương pháp trên user này**

| Phương pháp | Hạng của 15863 | Recall@10 | NDCG@10 |
|---|---:|---:|---:|
| BL0 | 84 | 0 | 0 |
| BL1 | 62 | 0 | 0 |
| BL2 | 67 | 0 | 0 |
| BL2t | 84 | 0 | 0 |
| BL3 | 713 | 0 | 0 |
| BL4 | 142 | 0 | 0 |
| BL5 | 713 | 0 | 0 |
| BL6 | 78 | 0 | 0 |
| **H** | **9** | **1** | **1 / log2(10) = 0.301** |
| H-follow (không thuộc lần chạy E1) | 98 | 0 | 0 |
| H-comm (không thuộc lần chạy E1) | 7 | 1 | 1 / log2(8) = 0.333 |

Với user này, hiệu số theo cặp là `d = 0.301 − 0 = 0.301`.

Một user này cho thấy:
- Một bài mới chưa có like thì không thể tìm ra bằng độ phổ biến (BL3: hạng 713).
- Gain đến từ **community** term (H-comm: hạng 7). Chỉ dùng các follow term thì bài ở hạng 98.
- Đây là **một ví dụ**, được chọn vì H có ích ở đây. Nó không chứng minh điều gì. Kết quả là trung bình trên mọi user (§7).

**Tự chạy lại** (đầu ra là các post id theo thứ tự hạng; 15863 nằm ở dòng 9):

```bash
npm run rank -w @breadit/eval -- --dataset syn-W2M-M --method H --user 844 --asof 21447443 --before-event 17930 --param alpha=1024 --param beta=1024 --param m=5 --top 10
```

Với BL2, dùng `--method BL2`, không có `--param`, và `--top 70` (15863 nằm ở dòng 67). Hạng của chín phương pháp trong E1 khớp với các dòng của user 844 trong `eval/results/p7-main/per_user.csv`.

## 7. H so với BL2 trên mọi user

**Vì sao BL2 là mốc so sánh.** H là BL2 cộng hai term. Vì vậy H − BL2 đo đúng phần mà hai tín hiệu social thêm vào. "For You hiện nay" là BL0; nó cũng được so (E1 và family F2).

### 7.1 Bốn bước

1. **Ghép cặp theo user:** `d = NDCG@10 của H − NDCG@10 của BL2`.
2. **Gain:** trung bình của mọi d.
3. **Khoảng 95% (bootstrap):** rút lại các user có hoàn lại, 10,000 lần, mỗi lần lấy trung bình. 95% ở giữa là khoảng tin cậy.
4. **p-value (randomization test):** nếu H và BL2 như nhau thì dấu của mỗi d là ngẫu nhiên. Lật dấu ngẫu nhiên 10,000 lần và đếm xem bao nhiêu lần kết quả lớn ít nhất bằng kết quả thật.

**Ví dụ tự đặt, sáu user.** Hạng của H: 1, 2, 15, 4, 30, 3. Hạng của BL2: 3, 2, 12, 9, 30, 10.
- d = 0.500, 0, 0, 0.130, 0, 0.211.
- Gain 0.140, khoảng 0.022 đến 0.307, p = 0.247.
- Khoảng nằm trên 0 nhưng p lớn. Chỉ có 3 user khác nhau. Vì vậy quy tắc cần **cả hai** điều kiện.

### 7.2 Hiệu chỉnh Holm

Thesis chạy nhiều phép test: test nhiều thì sẽ có cái trông tốt do may mắn. **Family F1** gồm 15 phép test H − BL2 trên một dataset (3 giá trị K × 5 nhóm). Holm sắp 15 p-value từ nhỏ đến lớn. p nhỏ nhất được nhân với 15, p kế tiếp nhân 14, cứ thế tiếp. Một kết quả không bao giờ được nhỏ hơn kết quả đứng trước nó, và tối đa bằng 1.

| Dòng H1 (NDCG@10, nhóm 0–4) | `syn-W2M-M` | `digg2009` |
|---|---|---|
| p trước hiệu chỉnh | 0.097 | 0.030 |
| Vị trí trong 15 | nhỏ thứ 9 | nhỏ thứ 5 |
| Hệ số nhân | 15 − 9 + 1 = 7 | 15 − 5 + 1 = 11 |
| Holm p | 0.680 | 0.335 |

### 7.3 Kết quả

**H1 chỉ đậu trên một dataset khi đạt cả hai:** Holm p nhỏ hơn 0.05 **và** đầu dưới của khoảng tin cậy lớn hơn 0.

| Nhóm 0–4, NDCG@10 | `syn-W2M-M` | `digg2009` |
|---|---|---|
| Số user | 174 | 20,644 |
| BL2 → H | 0.012 → 0.035 | 0.029 → 0.029 |
| Gain | 0.023 | 0.000117 |
| Khoảng 95% | −0.002 đến 0.051 | 0.000015 đến 0.000225 |
| Holm p | 0.680 | 0.335 |
| Kết luận | **rớt** | **rớt** |

**Cùng kết quả đó, đếm theo số user** (Recall@10 × số user, `syn-W2M-M`):

| Nhóm | H đưa bài test vào top 10 | BL2 đưa bài test vào top 10 |
|---|---:|---:|
| Cả 541 user | 51 | 9 |
| 174 user nhóm 0–4 | 11 | 4 |

### 7.4 Mọi phương pháp trên test split (mọi user, K = 10)

| Phương pháp | `syn-W2M-M` NDCG | Recall | Coverage | `digg2009` NDCG | Recall | Coverage |
|---|---:|---:|---:|---:|---:|---:|
| BL0 | 0.005 | 0.009 | 0.447 | 0.026 | 0.050 | 0.835 |
| BL1 | 0.003 | 0.007 | 0.423 | 0.025 | 0.050 | 0.433 |
| BL2 | 0.009 | 0.017 | 0.250 | 0.024 | 0.050 | 0.144 |
| BL2t | 0.011 | 0.024 | 0.042 | 0.027 | 0.059 | 0.137 |
| BL3 | 0.007 | 0.013 | 0.013 | 0.023 | 0.050 | 0.145 |
| BL4 | 0.009 | 0.022 | 0.021 | 0.197 | 0.333 | 0.218 |
| BL5 | 0.009 | 0.020 | 0.052 | 0.199 | 0.337 | 0.192 |
| BL6 | 0.011 | 0.022 | 0.357 | 0.025 | 0.053 | 0.526 |
| H | 0.054 | 0.094 | 0.210 | 0.024 | 0.050 | 0.144 |

**Cách đọc:**
- Trên dữ liệu synthetic, H cao hơn hẳn mọi baseline.
- Trên Digg, H bằng BL2 ở ba chữ số thập phân, còn BL4 và BL5 cao hơn khoảng 8 lần. Ở đó độ mới của tin là quan trọng nhất.
- Các giá trị nhỏ vì mỗi user chỉ có một bài đúng trong tối đa 2,000 bài. Hãy so các phương pháp với nhau, không so với các bài báo chỉ xếp hạng cùng 100 bài ngẫu nhiên.

Xem thêm: [06 Thống kê](06-statistics.md), [11 Thí nghiệm](11-experiments-and-results.md).

## 8. H0, H1, H2

| | Câu hỏi nó trả lời | RQ |
|---|---|---|
| **H0** | Phép đo có tin được không? | không có |
| **H1** | Hybrid có giúp user ít lịch sử không? | RQ1 |
| **H2** | Nó có giúp nhiều hơn khi user có nhiều quan hệ social hơn không? | RQ2 |

H0 ở đây **không phải** "null hypothesis" của thống kê. Null hypothesis của phép test H1 là "H và BL2 bằng nhau".

**RQ1** (nguyên văn tiếng Anh): "Does adding social-graph signals (follow trust and community affinity) to the ranking improve the 'For You' feed over the current heuristic, especially for users with little history?" Nghĩa là: thêm tín hiệu social graph vào xếp hạng có cải thiện For You so với heuristic hiện tại không, nhất là với user ít lịch sử?

**RQ2** (nguyên văn tiếng Anh): "How does the level of social interaction between users change the ranking quality? What is the minimum level where the social signal starts to help?" Nghĩa là: mức tương tác social giữa các user làm chất lượng xếp hạng thay đổi thế nào? Mức tối thiểu nào thì tín hiệu social bắt đầu có ích?

### 8.1 H0, cổng kiểm tra tính hợp lý

- **Nội dung:** trong thế giới null W0, nơi follow là ngẫu nhiên, phần follow của hybrid không được thắng BL2.
- **Cách test:** H-follow so với BL2 trên `syn-W0-M`, dùng α chọn trên `syn-W2M-M`. Rớt nếu cả khoảng tin cậy nằm trên 0.
- **Kết quả:** 0.001, khoảng −0.004 đến 0.006. **Đậu.**
- **Nên nói:** "chúng em không thấy dấu hiệu bug hay leak". Đừng nói "điều này chứng minh không có bug". Còn có một leakage test riêng kiểm tra code.
- **Câu hỏi khó: "Em đổi cổng sau khi nó rớt à?"** Trả lời thật: đúng. Ban đầu cổng dùng H đầy đủ. Trên **validation item**, H đầy đủ thắng BL2 ở W0, chủ yếu nhờ community term, vốn mang theo sự quan tâm theo chủ đề. Chúng em đổi ngày 2026-11-11, **trước mọi lần chạy test**, và có ghi lại. Thesis vẫn báo cáo H trên W0 với giá trị của W2M: 0.011 (−0.001 đến 0.023).

### 8.2 H1 (RQ1)

- **Nội dung:** với user có 0–4 tương tác trước đó, H có NDCG@10 cao hơn BL2. Hai test co-primary, `syn-W2M-M` và `digg2009`, mỗi cái được xét riêng.
- **Kết quả:** rớt cả hai (§7.3).
- **Hai lần rớt khác nhau.** Synthetic: khoảng tin cậy rộng và chứa 0, nên dữ liệu không quyết định được; kể cả không dùng Holm thì p vẫn trên 0.05. Digg: gain gần như bằng 0. Không dùng Holm thì dòng Digg sẽ đậu, nhưng quy tắc được chốt trước khi test, và 0.000117 quá nhỏ để có ý nghĩa.
- **Nên nói:** "chúng em chưa chứng minh được H giúp user mới". Đừng nói "chúng em chứng minh được nó không có tác dụng".
- **Cũng đúng:** trên `syn-W2M-M`, user có từ 20 tương tác trở lên được gain 0.078 (Holm p 0.002). Đây không phải H1.

### 8.3 H2 (RQ2)

- **Nội dung, hai vế:** (a) gain so với BL2 tăng theo mật độ social (số followee, lượng tương tác của bạn bè trong pool); (b) gain gần bằng 0 khi user không follow ai và không có community.
- **Kết quả theo số followee tại thời điểm test (`syn-W2M-M`):** 0: 0.044 (280 user); 1–4: 1 user, không đọc; 5–19: 0.056 (159); từ 20 trở lên: 0.030 (101). Trên Digg mọi bin là 0.000.
- **Vế (a) không được ủng hộ:** gain không tăng.
- **Vế (b) đúng theo cách xây dựng công thức:** không có followee và không có tín hiệu community thì cả hai term bằng 0, nên H = BL2. Bin "0 followee" còn chứa cả những user có community. Một lần kiểm tra ngày 2026-11-28 trên các hạng đã lưu đã tách 280 người này: 261 người có tín hiệu community (gain 0.047) và 19 người không có (gain 0.000, hạng giữ nguyên). Hai con số này không phải số của thesis.
- **Chữ trong thesis viết "neither part holds" (cả hai vế đều không đúng). Với vế (b) câu đó sai, và chưa được sửa.**
- **Giới hạn:** H2 không có quy tắc đậu bằng số và không có p-value; tương tác của bạn bè trong pool chưa được đo; dữ liệu synthetic gần như không có user follow 1–9 tài khoản (§2.3). Vì vậy câu hỏi "mức tối thiểu" của RQ2 chưa được trả lời.

### 8.4 H0, H1, H2 dẫn tới điều gì

Quy tắc được chốt trước khi test: "For You" chỉ chuyển sang hybrid khi **H1 đậu trên cả hai dataset và H0 đậu**. H1 rớt, nên "For You" giữ nguyên. H2 không nằm trong quy tắc này.

## 9. Những con số chính cần nhớ

| Điều | Con số |
|---|---|
| Cổng H0 | H-follow − BL2 trên W0: 0.001 |
| H1 | synthetic 0.023 (Holm p 0.680); Digg 0.000117 (Holm p 0.335) |
| Mọi user, `syn-W2M-M` | H 0.054, BL2 0.009 |
| Mọi user, Digg | H 0.024, BL2 0.024, BL4 0.197, BL5 0.199 |
| Term nào tạo ra gain (E4) | H − BL2 0.045; H-comm − BL2 0.043; H-follow − BL2 0.007 |
| Độ mạnh prior (E4) | gain với m = 0, 2, 5, 10: 0.047, 0.051, 0.045, 0.041 |
| Gain theo thế giới (E5) | W0 0.012, W1 0.029, W2L 0.035, W2M 0.045, W2H 0.076 |
| Xáo trộn thời gian (E5) | 0.042 |
| Pool lớn hơn (E8) | NDCG@10 của H đi từ 0.054 xuống 0.048; của BL2 từ 0.009 xuống 0.008 |
| Chi phí trang 1 (E7, một máy) | median khoảng 36 ms cho `chrono`, `engagement` và `social` |
| α, β đã tune | nằm ở đỉnh của grid (1,024) |

**Phát hiện chính trong một câu:** trên các dữ liệu này, follow graph thêm được rất ít, và phần lớn gain trên synthetic đến từ community term, vốn hoạt động như một tín hiệu chủ đề.

## 10. Tự kiểm tra

1. Vì sao không được dùng số like của hôm nay khi xếp hạng tại t_u?
2. Bài test ở hạng 4. Recall@5, NDCG@5 và NDCG@3 là bao nhiêu?
3. Vì sao H có gain ở W0, và vì sao điều đó không có nghĩa là H0 rớt?
4. BL6 và H-follow khác nhau ở đâu?
5. Holm: một p-value nhỏ thứ 3 trong 15. Nó được nhân với bao nhiêu?
6. Vì sao dữ liệu synthetic không cho biết gain thay đổi thế nào giữa 0 và 10 followee?

**Đáp án.** 1: như vậy là dùng dữ liệu tương lai (leakage). 2: Recall@5 = 1, NDCG@5 = 1/log2(5) = 0.431, NDCG@3 = 0. 3: community term tìm ra mối quan tâm theo chủ đề; cổng H0 test H-follow, vốn không có community term. 4: BL6 đặt mọi trust bằng 1; cả hai đều không có community term. 5: nhân với 13 (sau đó nó không được nhỏ hơn giá trị đã hiệu chỉnh đứng trước). 6: trong cả file không user nào có danh sách follow từ 1 đến 9 tài khoản; tại thời điểm test rất ít user có danh sách ngắn.
