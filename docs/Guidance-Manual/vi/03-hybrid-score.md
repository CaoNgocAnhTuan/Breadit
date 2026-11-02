# 03 · Điểm hybrid và các baseline

[Sổ tay hướng dẫn](../Guidance-Manual.md) · [English](../en/03-hybrid-score.md) · Tiếng Việt

**Đọc xong bạn sẽ:** viết được công thức mà không cần nhìn, giải thích mỗi term trong một câu, tự tính H cho một user mới và một user cũ, và nói được vì sao mỗi baseline có mặt.

Nguồn: super-plan §5 (các phương pháp) và §6 (điểm số); code ở `packages/ranking/src/scorers.ts`. Thuật ngữ: [09 Bảng thuật ngữ](09-glossary.md).

---

## 1. Ý tưởng trong một đoạn

Feed hiện tại xếp theo thời gian hoặc theo độ phổ biến. Độ phổ biến thì ai cũng như ai, nên không mang tính cá nhân. Hybrid giữ độ phổ biến làm nền (**engagement**) rồi cộng thêm hai khoản thưởng cá nhân: bài mà **những người bạn tin** đã viết hoặc đã tương tác (**social**), và bài trong **các community bạn quan tâm** (**community**). "Trust" được học từ chính hành vi trước đây của bạn. Khi bạn chưa có hành vi nào, trust được chia đều cho mọi người bạn follow. Đó là mẹo giúp một user mới tinh có feed cá nhân ngay từ ngày đầu.

## 2. Công thức

```
H(p, u, t) = engagement(p, t) + α · social(p, u, t) + β · community(p, u, t)

engagement(p, t)   = likes + 2·comments + 3·reposts − 0.25·ageHours
trust(u, f, t)     = (n_uf + m / |F_u|) / (N_u + m)
social(p, u, t)    = [u follows author(p)] · trust(u, author(p), t)
                   + Σ trust(u, f, t)  over followees f who engaged with p before t
community(p, u, t) = (c_u,c(p) + m · [u is a member of c(p)] / |M_u|) / (N_u + m)
```

| Ký hiệu | Nghĩa |
|---|---|
| p, u, t | bài viết, user, thời điểm ta xếp hạng (asOf) |
| `n_uf` | số positive trước đây (like, comment, repost) của u trên bài của f |
| `N_u` | tổng số positive trước đây của u |
| `F_u`, `|F_u|` | các followee của u tại t, và số lượng |
| `c_u,c` | số positive trước đây của u trên bài thuộc community c |
| `M_u`, `|M_u|` | các community của u tại t, và số lượng |
| m | prior strength, frozen bằng 5 |
| α, β | trọng số, tune trên lưới 0, 1, 2, 4, 8, 16 |
| `[x]` | 1 nếu x đúng, ngược lại 0 |

Mọi thứ được đếm **tại thời điểm t**: chỉ các sự kiện trước t (file 05).

Điểm cuối cùng là số nguyên `floor(H × 100)`, và các bài cùng điểm được xếp theo post id, lớn hơn đứng trước.

## 3. Từng term

**Engagement.** Điểm Explore của production, giữ nguyên. Một comment bằng 2 like, một repost bằng 3. Mỗi giờ tuổi bài trừ 0,25 điểm, nên sau 4 giờ bài mất tương đương 1 like. Đây cũng là baseline BL2. Giữ nó bên trong H nghĩa là H chỉ có thể cộng thêm vào điểm hiện tại, không bao giờ vứt nó đi.

**Trust.** "Bao nhiêu phần sự chú ý của u dành cho f?" Nếu không làm trơn (smoothing) thì nó là `n_uf / N_u`. Với user mới đó là 0/0, không xác định, và tín hiệu follow không giúp được đúng những user mà RQ1 nhắm tới. **m-estimate** sửa chuyện này: nó coi như u đã có thêm m tương tác, chia đều cho các followee. Khi đó:
- user mới (N_u = 0): trust = (m/|F_u|) / m = 1/|F_u|, bằng nhau cho mọi followee;
- user dùng nhiều (N_u lớn): trust ≈ n_uf / N_u, đúng hành vi thật của họ.

Trọng số của prior là `m / (N_u + m)`. Nó trượt mượt từ 1 xuống 0 khi lịch sử tăng lên. Điều này thay ba "giai đoạn" cold-start trong Orientation bằng một đường cong duy nhất.

**Social.** Gồm hai phần:
- **author term:** nếu u follow tác giả, cộng trust của tác giả. Không có phần này thì một bài mới của bạn bè mà chưa ai like sẽ không được gì.
- **engager term:** với mỗi followee đã tương tác với p trước t, cộng trust của họ. Đây là "bạn bè bạn đã thích bài này".

**Community.** Cùng cách làm trơn, áp cho community. Thành viên mới được chia đều prior cho mỗi community họ tham gia. Bài không thuộc community nào được 0.

## 4. Ví dụ tính tay (đã kiểm bằng code thật)

Thiết lập: α = 8, β = 2, m = 5 (giá trị ví dụ, không phải giá trị đã tune). Hai user. Cả hai đều follow A và B, và cùng là thành viên community C1.

- **User mới:** chưa có lịch sử, N_u = 0.
- **User cũ:** N_u = 45 positive, trong đó 40 trên bài của A, 5 trong C1, 0 trên bài của B.

Ba bài trong pool:

| Bài | Tác giả | Community | Like | Comment | Repost | Tuổi | Followee đã tương tác |
|---|---|---|---|---|---|---|---|
| p1 | A | — | 3 | 1 | 0 | 10 giờ | B đã like |
| p2 | X (người lạ) | C1 | 6 | 0 | 1 | 4 giờ | không ai |
| p3 | Y (người lạ) | — | 10 | 2 | 0 | 20 giờ | không ai |

**Bước 1, engagement** (giống nhau cho cả hai user):
- p1: 3 + 2·1 + 0 − 0,25·10 = **2,5**
- p2: 6 + 0 + 3·1 − 0,25·4 = **8**
- p3: 10 + 2·2 + 0 − 0,25·20 = **9**

Vậy BL2 xếp **p3, p2, p1** cho mọi người.

**Bước 2, user mới** (N_u = 0, |F_u| = 2, |M_u| = 1):
- trust(A) = (0 + 5/2) / (0 + 5) = **0,5**, trust(B) = **0,5**
- community(C1) = (0 + 5·1/1) / (0 + 5) = **1**
- p1: social = 0,5 (A là tác giả) + 0,5 (B đã tương tác) = 1 → H = 2,5 + 8·1 = **10,5**
- p2: community = 1 → H = 8 + 2·1 = **10**
- p3: không có gì cá nhân → H = **9**

H xếp **p1, p2, p3**. Bài của bạn bè từ cuối lên đầu, và bài trong community cũng được đẩy lên, dù user này chưa từng bấm vào thứ gì.

**Bước 3, user cũ** (N_u = 45):
- trust(A) = (40 + 2,5) / 50 = **0,85**, trust(B) = (0 + 2,5) / 50 = **0,05**
- community(C1) = (5 + 5) / 50 = **0,2**
- p1: social = 0,85 + 0,05 = 0,9 → H = 2,5 + 8·0,9 = **9,7**
- p2: H = 8 + 2·0,2 = **8,4**
- p3: H = **9**

H xếp **p1, p3, p2**. Cùng danh sách follow và cùng community với user mới, nhưng thứ tự khác, vì giờ hành vi thật của user cũ chiếm ưu thế. Họ quan tâm A rất nhiều, B rất ít, và C1 chỉ một chút.

**Bước làm tròn số nguyên.** Code cho scoreFixed 969 với p1 của user cũ, không phải 970. Với số thực dấu phẩy động, 2,5 + 8·0,9 thành 9,6999…, và `floor` cắt phần lẻ. Điều này không sao: app và evaluation chạy cùng một code, nên cùng ra 969. Nó cho thấy vì sao điểm được cố định thành số nguyên và vì sao tie-break phải toàn phần.

Bạn có thể tự kiểm mọi con số: `scorer('H')` trong `@breadit/ranking` cho 1050, 1000, 900 (user mới) và 969, 840, 900 (user cũ).

## 5. Các baseline và vì sao có mặt

| Id | Luật | Vì sao có trong nghiên cứu |
|---|---|---|
| BL0 | followee trước, mới nhất trước | "For You" hiện tại |
| BL1 | mới nhất trước | feed đơn giản nhất |
| BL2 | engagement | Explore hiện tại; **tham chiếu cho H1**, vì câu hỏi là "có tốt hơn cái app đang làm không" |
| BL2t | engagement với trọng số tuổi được tune | để H không phải là phương pháp duy nhất được tune |
| BL3 | nhiều like nhất | mức sàn của độ phổ biến thuần |
| BL4 | "hot" của Reddit (có tune) | một heuristic mạnh, nổi tiếng |
| BL5 | Hacker News (có tune) | một heuristic mạnh, nổi tiếng; mạnh nhất trong bảng P5 |
| BL6 | engagement + α × số followee có liên quan | H không có trọng số trust: cho thấy trust thêm được gì so với việc chỉ đếm |

Trong ví dụ, BL6 cho p1 = 2,5 + 8·2 = 18,5 với cả hai user. Nó không phân biệt được user mới với user cũ, vì nó bỏ qua lịch sử. H thì phân biệt được.

Các baseline mạnh và có tune (BL4, BL5) được đưa vào có chủ đích. Một vấn đề đã biết trong nghiên cứu recommender là các phương pháp mới chỉ thắng được baseline yếu (Ferrari Dacrema và cộng sự 2019).

## 6. Các ablation

Mỗi ablation tắt một phần và hỏi "phần đó đóng góp bao nhiêu?" (thí nghiệm E4).

| Ablation | Tắt phần nào | Ví dụ, user mới |
|---|---|---|
| H-follow | community term | p1 10,5, p3 9, p2 8 → p1, p3, p2 |
| H-comm | social term | p2 10, p3 9, p1 2,5 → p2, p3, p1 |
| H-noauthor | phần author | p1 mất 0,5 của A |
| H-noengager | phần engager | p1 mất 0,5 của B |
| H với m = 0, 2, 5, 10 | độ mạnh prior | m = 0 bỏ prior: user mới không được thưởng social chút nào |

## 7. Các giới hạn cần biết

- Các trọng số 1, 2, 3 và 0,25 trong engagement là giá trị production. Chúng không được tune (BL2t chỉ tune trọng số tuổi bài).
- Digg không có community, nên β không có tác dụng ở đó, và community term chỉ được kiểm trên dữ liệu synthetic.
- Trên Digg, 55% user cold-start được giữ lại không follow ai. Với họ H bằng BL2, nên mọi mức cải thiện phải đến từ 45% còn lại (implementation-plan §3.7).
- Trust chỉ đếm positive. Nó không thấy được dislike, ẩn bài hay thời gian xem.

## 8. Tự kiểm tra

1. Vì sao trust của user mới không thành 0/0?
2. Trọng số prior của một user có N_u = 15 và m = 5 là bao nhiêu? *(5/20 = 0,25)*
3. Vì sao cần author term?
4. Trong ví dụ, vì sao user cũ xếp p3 trên p2, còn user mới xếp p2 trên p3?
5. Vì sao tham chiếu là BL2 mà không phải BL5, baseline mạnh nhất?
