# 05 · Giao thức đánh giá

[Sổ tay hướng dẫn](../Guidance-Manual.md) · [English](../en/05-evaluation-protocol.md) · Tiếng Việt

**Đọc xong bạn sẽ:** giải thích được một con số trong bảng kết quả được tạo ra thế nào, từ sự kiện thô tới kết luận H1; tự tính Recall và NDCG; và giải thích vì sao giao thức không thể nhìn thấy tương lai.

Nguồn: super-plan §5 (giao thức) và §7 (giá trị frozen); implementation-plan §3 (cut time T, Holm families, cách đọc H1). Code: `eval/src/harness/`, `eval/src/metrics.ts`, `eval/src/stats.ts`. Thuật ngữ: [09 Bảng thuật ngữ](09-glossary.md).

---

## 1. Câu hỏi mà giao thức trả lời

"Nếu ngay trước lúc user hành động, ta cho họ xem một feed xếp theo phương pháp X, thì bài họ thật sự chọn sẽ nằm ở vị trí cao tới đâu?"

Ta không thể hỏi user thật (không có pilot, super-plan §9). Nên ta **tua lại quá khứ**: quay về khoảnh khắc ngay trước mỗi hành động của user, dựng lại những gì app biết lúc đó, xếp hạng, rồi xem lựa chọn thật rơi vào đâu. Phương pháp nào đặt lựa chọn thật gần đầu danh sách thì tốt hơn.

## 2. Toàn cảnh pipeline

```
events ─▶ cut time T ─▶ one held-out item per user ─▶ pool at t_u ─▶ rank with each method
       ─▶ rank r of the held-out post ─▶ Recall@K, NDCG@K ─▶ paired difference per user
       ─▶ bootstrap CI + randomization p ─▶ Holm ─▶ verdict
```

## 3. Bước 1: cut time T

Mọi positive (like, comment, repost) của một dataset được sắp theo thời gian. T là thời điểm của sự kiện ở vị trí `ceil(q · n)`, với n là số positive và q = 0,8 (frozen). Vậy 80% hoạt động nằm trước hoặc tại T, và 20% nằm sau.

- **Item validation** nằm tại hoặc trước T. Dùng để tune.
- **Item test** nằm sau T. Dùng một lần duy nhất, ở cuối.

**Ví dụ.** 10 sự kiện ở các thời điểm 1, 2, 3, 5, 8, 9, 12, 13, 15, 20. `ceil(0,8 · 10)` = 8, nên T = 13 (thời điểm thứ 8). Sự kiện tại 13 là validation; tại 15 hoặc 20 là test.

**Vì sao dùng một T chung, không phải "item cuối của từng user"?** Một mốc cắt chung bảo đảm việc tune không bao giờ thấy gì từ giai đoạn test, với bất kỳ user nào. Nếu cắt theo từng user, giai đoạn test của user A có thể là giai đoạn train của user B, và thông tin bị rò giữa các user (Meng và cộng sự 2020 so sánh các cách cắt này).

Giá trị frozen của T: 21393508 cho các dataset cỡ S và 21412417 cho các dataset cỡ M (số giây tính từ 2026-01-01), và 1246068297 cho `digg2009` (giây Unix, 2009-06-27 02:04:57 UTC).

## 4. Bước 2: mỗi user một item được giữ lại

Với mỗi user, **item test** là positive cuối cùng của họ sau T **trên một bài họ chưa từng tương tác**. Thích lại một bài cũ không phải là khám phá mới, nên không tính. User không có positive như vậy sau T thì không có item test và không nằm trong phép đếm.

Thời điểm của nó là `t_u`. Từ đây, mọi thứ về user u được tính **tại t_u**.

## 5. Bước 3: as-of rule (không được nhìn trộm)

Một sự kiện nhìn thấy được tại t_u nếu:
- thời điểm của nó trước t_u, hoặc
- thời điểm của nó bằng t_u và event id nhỏ hơn event id của sự kiện test.

Follow và membership không có event id, nên chỉ được tính khi xảy ra hẳn trước t_u.

Luật này áp dụng cho **mọi** feature: số like, số comment, tuổi bài, ai follow ai, thành viên community và trust. Vậy số like của một bài là số like tại t_u, không phải số like hôm nay.

**Ví dụ.** u like bài 7 tại t_u = 100. Bài 7 có 5 like trước thời điểm 100, và thêm 20 like sau đó. Lần xếp hạng tại t_u thấy **5**. Nếu nó thấy 25, bài 7 sẽ trông phổ biến hơn thực tế, và phương pháp được thưởng vì biết trước tương lai. Đó là **leakage**, một vấn đề đã biết trong evaluation của recommender (Ji và cộng sự 2023).

**Làm sao biết nó hoạt động.** Leakage test sửa hoặc xoá mọi sự kiện sau t_u, và kết quả của u không được đổi dù một byte. Test này pass (P5).

## 6. Bước 4: candidate pool

`buildPool` quyết định bài nào được xếp hạng cho u tại t_u. Một bài nằm trong pool nếu nó:
- là bài gốc (không phải trả lời), đã được duyệt, chưa bị xoá;
- được tạo trong cửa sổ `t_u − W ≤ created_at < t_u`, với W = 7 ngày;
- không phải của người mà u đã block (dữ liệu synthetic và Digg không có block);
- không phải bài của chính u, và không phải bài u đã tương tác trước t_u.

Sau đó chỉ giữ N_max = 2.000 bài mới nhất.

Nếu bài held-out **không** nằm trong pool (ví dụ vì quá cũ), user đó bị **loại** (left out). Số user bị loại được đếm theo bucket trong `leftout.csv`, để người đọc thấy ai bị bỏ ra. E8 chạy lại phép so sánh chính với pool lớn hơn (14 ngày, 4.000 bài) để kiểm rằng kích thước pool không quyết định kết quả.

**Full ranking.** Phương pháp xếp hạng toàn bộ pool (hàng trăm bài). Nhiều bài báo chỉ xếp item held-out so với 100 "negative" ngẫu nhiên. Cách đó nhanh hơn, nhưng có thể đổi phương pháp trông như thắng (Krichene và Rendle 2020), nên ta không làm vậy.

App dùng **cùng** hàm `buildPool`. Điều này quan trọng: nếu pool khi đánh giá khác pool thật, các con số sẽ mô tả một hệ thống khác.

## 7. Bước 5: xếp hạng và tìm r

Mọi phương pháp chấm điểm mọi bài trong pool rồi sắp theo `(scoreFixed desc, postId desc)`. r là vị trí của bài held-out, bắt đầu từ 1.

## 8. Bước 6: các metric

Với một item held-out ở vị trí r:

| Metric | Công thức | r = 1 | r = 3 | r = 7 | r = 15 |
|---|---|---|---|---|---|
| Recall@10 (= HitRate@10) | 1 nếu r ≤ 10 | 1 | 1 | 1 | 0 |
| NDCG@10 | 1 / log2(r + 1) nếu r ≤ 10 | 1 | 0,5 | 0,333 | 0 |

Vậy NDCG cho điểm tối đa với vị trí đầu, một nửa với vị trí thứ ba, và không gì cả nếu quá K. Bảng báo cáo **trung bình trên các user**.

**Ví dụ.** Bốn user có rank 1, 3, 7, 15 → Recall@10 = 3/4 = 0,75, NDCG@10 = (1 + 0,5 + 0,333 + 0) / 4 = 0,458.

Ở đây Recall@K bằng HitRate@K vì mỗi user có đúng một item liên quan. Thesis nói điều này một lần.

**Coverage@K** = số bài khác nhau xuất hiện trong top K của bất kỳ user nào ÷ số bài khác nhau trong mọi pool. Một phương pháp theo độ phổ biến cho mọi người xem cùng vài bài nên có coverage thấp. Một phương pháp cá nhân hoá nên trải rộng hơn.

K là 5, 10 và 20. Metric chính là **NDCG@10**.

## 9. Bước 7: history bucket

User được chia nhóm theo lịch sử (số positive trước t_u): **0**, **1–4**, **5–19**, **20+**. Nhóm cold-start của H1 là **0–4**, hợp của hai nhóm đầu. Bucket chỉ dùng để báo cáo; bản thân điểm số không có giai đoạn nào (file 03).

Kích thước bucket tại q = 0,8 (user test được giữ lại): `syn-W2M-M` có 174 user trong 0–4 (59 trong 0); `digg2009` có 20.644 user trong 0–4. Luật yêu cầu ít nhất 100, được cố định trước khi đếm Digg.

## 10. Bước 8: tune, rồi chạy test một lần

1. Chỉ trên item validation, thử mọi α, β trong {0, 1, 2, 4, 8, 16} cho H, và lưới của từng baseline.
2. Chọn giá trị có NDCG@10 tốt nhất. Nếu hoà, chọn giá trị nhỏ hơn.
3. Cố định (freeze) các lựa chọn.
4. Chạy item test **một lần**. Split test chỉ chạy khi run config ghi `"testApprovedBy": "author"`.

Tune trên split test giống như ôn thi bằng đáp án đề thi.

## 11. Bước 9: thống kê và kết luận

Với mỗi user i: `d_i = NDCG@10(H) − NDCG@10(BL2)`. Ghép cặp theo user loại bỏ các khác biệt lớn giữa các user.

- **Paired bootstrap** (lấy mẫu lại user 10.000 lần): cho khoảng tin cậy 95% của trung bình d.
- **Randomization test** (đổi dấu 10.000 lần): cho p-value hai phía. Nếu H và BL2 như nhau, đổi dấu từng d_i sẽ không ảnh hưởng gì.
- **Holm correction** trên family F1 (H − BL2 cho 3 giá trị K × 5 nhóm = 15 kiểm định mỗi dataset), vì nhiều kiểm định thì dễ có những lần thắng do may mắn.

**H1 pass trên một dataset** khi, với NDCG@10 và nhóm 0–4, p sau Holm < 0,05 **và** đầu dưới của CI > 0. Kiểm trên `syn-W2M-M` và trên `digg2009`, mỗi cái riêng.

**Cổng H0 trước tiên.** Trên thế giới null `syn-W0-M`, CI của H − BL2 (NDCG@10, mọi user) **không được** nằm hẳn trên 0. Trong W0 follow không có ảnh hưởng, nên nếu H "thắng" ở đó thì có gì đó sai (bug hoặc leak). Khi đó ta dừng lại và sửa trước khi tin bất kỳ kết quả nào khác.

Chi tiết, kèm ví dụ tính tay, nằm trong [06 Thống kê](06-statistics.md).

## 12. Vì sao có thể tin các con số

| Rủi ro | Cách phòng |
|---|---|
| nhìn thấy tương lai | as-of rule + leakage test |
| pool khác với app | cùng `buildPool` + parity test (task 8) |
| lấy mẫu negative | full ranking |
| baseline yếu | BL2t, BL4, BL5, BL6 có tune |
| tune trên test | T chung, split test chạy một lần với sự đồng ý của tác giả |
| thắng do may mắn | kiểm định ghép cặp + Holm |
| "kết quả đã được cài sẵn vào dữ liệu" | W0, W1, ba ô W2, xáo thời gian (E5), và dữ liệu Digg thật |
| kết quả bị trôi | Class D: file giống hệt từng byte và manifest SHA-256, double-run test |

## 13. Tự kiểm tra

1. Positive cuối cùng sau T của một user là một comment trên bài họ đã like trước T. Đó có phải item test không? *(Không: phải là bài họ chưa từng tương tác. Item test là positive cuối cùng sau T trên một bài mới.)*
2. Rank 2, 2, 11 với K = 10: Recall và NDCG bằng bao nhiêu? *(Recall 2/3 = 0,667; NDCG (0,631 + 0,631 + 0) / 3 = 0,421.)*
3. Vì sao pool bỏ các bài user đã tương tác?
4. Nếu H thắng BL2 trong W0 thì nghĩa là gì?
5. Vì sao split test chỉ chạy một lần?
