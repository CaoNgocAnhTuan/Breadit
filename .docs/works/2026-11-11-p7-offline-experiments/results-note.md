# P7 results for the supervisor: the offline experiments

2026-11-12 · Direction A, Social-Graph-Aware Hybrid "For You" feed · Checkpoint P7

This note gives the results of the offline experiments E1 to E6 and E8. Every number comes from the results files in `.docs/results/p7-*/`. The tables are collected in `.docs/results/p7-report/results.md`, and the LaTeX tables and macros are in the same folder. The test split was run once, after the tuning was frozen.

## 1. What was run

- **Data.** Synthetic worlds at size M (1,000 users, 20,000 posts): W0 (no influence, no homophily), W1 (homophily only), and W2 at low, middle and high influence. Real data: Digg 2009.
- **Protocol.** Temporal leave-last-out with one global cut time. Each user's whole pool is ranked (posts of the last 7 days, at most 2,000), with no sampled negatives. Every feature is computed as of the item's time.
- **Tuning.** On the validation items only, each dataset on its own. Then the values were frozen, and the test split was run once.
- **Statistics.** A paired bootstrap 95% confidence interval and a paired randomization test (10,000 each), with Holm correction per dataset.

## 2. Two changes made before the test split

Both were decided after looking at validation results only. They are recorded in the plan's change log (super-plan 0.25).

- **The H0 gate.** On W0, the full hybrid beat BL2, almost only through the community term. This term counts the user's earlier likes in a community, and in our generator a community is a topic. So it carries topic interest even when there is no influence. This is not a leak. The H0 gate now tests H-follow (the follow part only) against BL2 on W0, because follows are random in W0.
- **The tuning grids.** The best α and β were at the top of the grid (16). The grid was widened to 1,024, and the baseline grids were widened past their edges. Many choices are still at 1,024, but on W2 (middle) the gain from 512 to 1,024 is only 0.5%. This is reported as a limitation.

## 3. Results

**H0 gate: passes.** On W0, H-follow − BL2 = 0.001 (95% CI −0.004 to 0.006).

**H1: fails on both co-primary tests.** NDCG@10, users with 0–4 earlier interactions:

| Dataset | Users | BL2 | H | Gain | 95% CI | p (Holm) |
|---|---|---|---|---|---|---|
| W2, middle influence | 174 | 0.012 | 0.035 | 0.023 | −0.002 to 0.051 | 0.680 |
| Digg 2009 | 20,644 | 0.029 | 0.029 | 0.0001 | 0.00002 to 0.0002 | 0.335 |

**All methods (E1), all users, NDCG@10:**

| Dataset | H | BL2 (production Explore) | Best other baseline |
|---|---|---|---|
| W2, middle influence | 0.054 | 0.009 | BL2t and BL6, 0.011 |
| Digg 2009 | 0.024 | 0.024 | BL5 (Hacker News), 0.199 |

What the other experiments show:
- **Who gains (E2).** On W2 (middle), H is about 6 times BL2 over all users. But the gain is largest for users with a long history (20 or more earlier interactions: +0.078, p (Holm) 0.002), not for new users. With only 174 new users, the test has low power.
- **Digg.** The social terms change almost nothing. Digg vote counts are large, so even α = 1,024 engagement points barely moves the order. The "hot" baselines BL4 and BL5 are about 8 times better than BL2: on Digg, time decay matters most.
- **Social density (E3).** On W2, the gain is already there for users with 0 followees (from the community term), and it does not grow steadily with the number of followees. H2 as written is not supported.
- **Which term (E4).** On W2 (middle), almost all of the gain comes from the community term (H-comm +0.043 of +0.045). The follow term alone adds +0.007. The prior strength `m` = 2 is a little better than the frozen `m` = 5 (+0.051 against +0.045).
- **Worlds (E5).** The gain grows with influence: W0 +0.012, W1 +0.029, W2 low, middle and high +0.035, +0.045 and +0.076. The W0 and W1 gains are the topic signal: prediction, not influence. With the timestamps shuffled inside each post, most of the gain stays (+0.042), so it does not depend much on who engaged first.
- **Ties (E6).** Reversing the tie-break changes NDCG@10 by at most 0.001.
- **Pool size (E8).** With the larger pool (14 days, 4,000 posts), H drops from 0.054 to 0.048 and stays far above BL2.
- **Reproducibility.** Every P7 run was made a second time from empty folders, and every file was byte-identical (the double run).

## 4. What this means

H1 is not supported. This is a negative result with a clean protocol: the hypotheses and the tuning were frozen before the test split, and the H0 gate passed. My reading: on these data, the follow graph adds little, and the community term works mainly as a topic-interest signal. On real Digg data, a stronger time decay (BL4, BL5) matters far more than any social signal.

## 5. Questions for you

1. **Default feed rule** (planned since 2026-11-02). "For You" switches to the social feed only if H1 passes on both tests and the H0 gate passes. H1 failed, so "For You" stays as it is today. Do you agree?
2. **Framing.** Is it acceptable to present the community term as a topic-interest signal, and to report H1 and H2 as not supported, with these numbers?

---

# Bản tiếng Việt

# Kết quả P7 gửi thầy: các thí nghiệm offline

2026-11-12 · Hướng A, Social-Graph-Aware Hybrid "For You" feed · Checkpoint P7

Ghi chú này trình bày kết quả các thí nghiệm offline E1 đến E6 và E8. Mọi con số đều lấy từ các file kết quả trong `.docs/results/p7-*/`. Các bảng được gom trong `.docs/results/p7-report/results.md`, và bảng LaTeX cùng macro nằm trong cùng thư mục. Test split chỉ chạy một lần, sau khi tuning đã được freeze.

## 1. Những gì đã chạy

- **Dữ liệu.** Các world synthetic cỡ M (1,000 user, 20,000 post): W0 (không influence, không homophily), W1 (chỉ homophily), và W2 với influence thấp, vừa và cao. Dữ liệu thật: Digg 2009.
- **Protocol.** Temporal leave-last-out với một cut time chung. Xếp hạng toàn bộ pool của mỗi user (post trong 7 ngày gần nhất, tối đa 2,000), không lấy mẫu negative. Mọi feature tính tại thời điểm của item.
- **Tuning.** Chỉ trên item validation, mỗi dataset tune riêng. Sau đó freeze các giá trị, rồi chạy test split một lần.
- **Thống kê.** Paired bootstrap 95% CI và paired randomization test (mỗi loại 10,000 lần), hiệu chỉnh Holm theo từng dataset.

## 2. Hai thay đổi trước khi chạy test split

Cả hai đều được quyết định sau khi chỉ xem kết quả validation. Chúng được ghi trong change log của kế hoạch (super-plan 0.25).

- **H0 gate.** Trên W0, hybrid đầy đủ thắng BL2, gần như chỉ nhờ community term. Term này đếm các like trước đó của user trong một community, mà trong generator của chúng tôi mỗi community là một topic. Vì vậy nó mang tín hiệu sở thích topic ngay cả khi không có influence. Đây không phải leak. H0 gate bây giờ kiểm tra H-follow (chỉ phần follow) so với BL2 trên W0, vì follow trong W0 là ngẫu nhiên.
- **Lưới tuning.** α và β tốt nhất nằm ở đỉnh lưới (16). Lưới được mở rộng tới 1,024, và lưới của các baseline được mở rộng qua mép. Nhiều giá trị vẫn được chọn ở 1,024, nhưng trên W2 (vừa) phần tăng từ 512 lên 1,024 chỉ là 0.5%. Điều này được báo cáo như một limitation.

## 3. Kết quả

**H0 gate: pass.** Trên W0, H-follow − BL2 = 0.001 (95% CI −0.004 đến 0.006).

**H1: fail trên cả hai test co-primary.** NDCG@10, user có 0–4 interaction trước đó:

| Dataset | User | BL2 | H | Chênh lệch | 95% CI | p (Holm) |
|---|---|---|---|---|---|---|
| W2, influence vừa | 174 | 0.012 | 0.035 | 0.023 | −0.002 đến 0.051 | 0.680 |
| Digg 2009 | 20,644 | 0.029 | 0.029 | 0.0001 | 0.00002 đến 0.0002 | 0.335 |

**Mọi phương pháp (E1), tất cả user, NDCG@10:**

| Dataset | H | BL2 (Explore hiện tại) | Baseline khác tốt nhất |
|---|---|---|---|
| W2, influence vừa | 0.054 | 0.009 | BL2t và BL6, 0.011 |
| Digg 2009 | 0.024 | 0.024 | BL5 (Hacker News), 0.199 |

Các thí nghiệm khác cho thấy:
- **Ai được lợi (E2).** Trên W2 (vừa), H gấp khoảng 6 lần BL2 trên tất cả user. Nhưng phần tăng lớn nhất ở user có nhiều lịch sử (20 interaction trở lên: +0.078, p (Holm) 0.002), không phải user mới. Chỉ có 174 user mới nên test có power thấp.
- **Digg.** Các social term gần như không thay đổi gì. Số vote trên Digg lớn, nên ngay cả α = 1,024 điểm engagement cũng hầu như không đổi được thứ tự. Các baseline "hot" BL4 và BL5 tốt hơn BL2 khoảng 8 lần: trên Digg, time decay quan trọng nhất.
- **Mật độ social (E3).** Trên W2, phần tăng đã có ở user có 0 followee (nhờ community term), và không tăng đều theo số followee. H2 như đang viết không được ủng hộ.
- **Term nào (E4).** Trên W2 (vừa), gần như toàn bộ phần tăng đến từ community term (H-comm +0.043 trên tổng +0.045). Riêng follow term chỉ thêm +0.007. Prior strength `m` = 2 tốt hơn một chút so với `m` = 5 đã freeze (+0.051 so với +0.045).
- **Các world (E5).** Phần tăng lớn dần theo influence: W0 +0.012, W1 +0.029, W2 thấp, vừa và cao +0.035, +0.045 và +0.076. Phần tăng ở W0 và W1 là tín hiệu topic: dự đoán, không phải influence. Khi xáo thời gian bên trong mỗi post, phần lớn phần tăng vẫn còn (+0.042), nên nó không phụ thuộc nhiều vào việc ai tương tác trước.
- **Hòa điểm (E6).** Đảo tie-break làm NDCG@10 thay đổi nhiều nhất 0.001.
- **Kích thước pool (E8).** Với pool lớn hơn (14 ngày, 4,000 post), H giảm từ 0.054 xuống 0.048 và vẫn cao hơn BL2 rất nhiều.
- **Tính tái lập.** Mọi run của P7 được chạy lại lần thứ hai từ thư mục trống, và mọi file đều giống hệt từng byte (double run).

## 4. Ý nghĩa

H1 không được ủng hộ. Đây là kết quả âm với protocol sạch: giả thuyết và tuning đã được freeze trước test split, và H0 gate đã pass. Cách hiểu của tôi: trên các dữ liệu này, follow graph đóng góp ít, còn community term chủ yếu hoạt động như tín hiệu sở thích topic. Trên dữ liệu Digg thật, time decay mạnh hơn (BL4, BL5) quan trọng hơn mọi tín hiệu social.

## 5. Câu hỏi cho thầy

1. **Quy tắc feed mặc định** (đã đặt từ 2026-11-02). "For You" chỉ chuyển sang social feed nếu H1 pass trên cả hai test và H0 gate pass. H1 đã fail, nên "For You" giữ như hiện tại. Thầy có đồng ý không?
2. **Cách trình bày.** Trình bày community term như một tín hiệu sở thích topic, và báo cáo H1, H2 là không được ủng hộ với các con số này, có được không ạ?
