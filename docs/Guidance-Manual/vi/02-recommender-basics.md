# 02 · Kiến thức nền về recommender

[Sổ tay hướng dẫn](../Guidance-Manual.md) · [English](../en/02-recommender-basics.md) · Tiếng Việt

**Đọc xong bạn sẽ:** giải thích được bằng lời đơn giản các ý tưởng mà thesis dựa vào, trước khi gặp chúng trong công thức: xếp hạng, ứng viên, implicit feedback, cold start, tín hiệu social, offline evaluation và leakage.

Không cần biết trước gì về recommender system. Thuật ngữ: [09 Bảng thuật ngữ](09-glossary.md).

---

## 1. Feed là một bài toán xếp hạng

Ở mọi thời điểm, số bài viết luôn nhiều hơn rất nhiều so với số bài user sẽ đọc. Feed phải **sắp thứ tự** chúng để những bài user muốn xem nằm trên đầu. Vậy câu hỏi không bao giờ là "bài này có hay không?" mà là "bài này có tốt hơn các bài khác **với user này, vào lúc này** không?"

Hầu hết hệ thống thật chia việc này làm hai bước:
1. **Candidate generation** (tạo ứng viên): chọn một tập vừa phải (ở đây: các bài trong 7 ngày gần nhất, tối đa 2.000). Đây là **candidate pool**.
2. **Ranking** (xếp hạng): chấm điểm từng ứng viên rồi sắp xếp.

Thesis thay đổi bước 2 (điểm số), còn bước 1 giữ đơn giản và dùng chung.

## 2. Các loại phương pháp xếp hạng

| Loại | Ý tưởng | Ví dụ trong thesis |
|---|---|---|
| Theo thời gian | mới nhất trước | BL0, BL1 |
| Độ phổ biến | nhiều like nhất trước, có thể giảm dần theo thời gian | BL2 (Explore), BL3, BL4 (Reddit), BL5 (Hacker News) |
| Social | bài liên quan tới người bạn quen | social term và community term của H |
| Hybrid | trộn các loại trên trong một điểm | H, BL6 |
| Có học (không có trong thesis) | một mô hình học từ lịch sử: matrix factorization, LightFM, graph neural network | related work và future work |

**Heuristic** nghĩa là một luật viết tay thay vì một mô hình học. Heuristic minh bạch: bạn thấy được vì sao một bài xếp cao, và tắt được từng phần để đo.

## 3. Phản hồi: explicit và implicit

- **Explicit feedback:** user chấm điểm (5 sao, bấm không thích).
- **Implicit feedback:** user hành động (like, comment, repost, click).

Breadit chỉ có implicit feedback, và chỉ có loại tích cực. Thesis gọi một like, comment hoặc repost là một **positive**. Không có "dislike", và việc không like một bài không có nghĩa là user không thích nó; có thể họ chưa từng thấy nó.

## 4. Bài toán cold-start

Một **user cold-start** có ít hoặc chưa có lịch sử. Các phương pháp học từ lịch sử của bạn (collaborative filtering) không có gì để học. Độ phổ biến thì vẫn chạy nhưng ai cũng như ai.

Thứ mà user mới thường *có* ngay ngày đầu: vài lượt follow và có thể một community. Thesis dùng đúng điều đó. Mẹo khiến nó hoạt động là **làm trơn** (file 03): khi chưa có lịch sử, trust được chia đều cho những người bạn follow, và khi lịch sử tăng lên, nó dịch dần sang những người bạn thật sự tương tác.

## 5. Tín hiệu social: influence và homophily

Vì sao lượt like của bạn bè lại dự đoán được lượt like của bạn? Có hai lý do, và rất khó tách chúng ra:
- **Influence** (ảnh hưởng): bạn thấy bạn mình thích bài đó, nên bạn cũng xem.
- **Homophily** (đồng sở thích): bạn và bạn mình có gu giống nhau, nên đằng nào bạn cũng thích.

Cả hai đều khiến "bạn bè thích cùng những bài". Với việc dự đoán, cả hai đều giúp ích. Nhưng người đọc có thể nói "dữ liệu của bạn được dựng để bạn bè đồng ý với nhau". Vì vậy dữ liệu synthetic có thế giới W0 không có hiệu ứng social, thế giới W1 chỉ có homophily, và ba thế giới có mức ảnh hưởng tăng dần (file 04).

## 6. Offline evaluation

**Online evaluation** (A/B test) cho user thật xem hai feed và đo họ làm gì. Thesis không có user thật, nên dùng **offline evaluation**: tua lại lịch sử đã ghi và kiểm xem một phương pháp có đặt lựa chọn thật tiếp theo của user gần đầu danh sách không.

Cách làm chuẩn là **leave-one-out**: giấu một tương tác thật của mỗi user (gọi là "held-out item"), xếp hạng, rồi tìm vị trí của item bị giấu. Thesis giấu tương tác cuối cùng của user sau một cut time T chung (file 05).

## 7. Metric trên một danh sách xếp hạng

Với một item bị giấu ở vị trí r:
- **HitRate@K / Recall@K:** nó có nằm trong top K không? (1 hoặc 0)
- **NDCG@K:** giống HitRate, nhưng vị trí cao được tính nhiều hơn: `1 / log2(r + 1)`. Vị trí 1 được 1, vị trí 3 được 0,5.
- **Coverage@K:** trên mọi user, có bao nhiêu bài khác nhau xuất hiện trong các danh sách top K? Phương pháp cho mọi người xem cùng 10 bài thì coverage thấp.

Bảng kết quả báo cáo trung bình trên các user. File 05 có ví dụ tính tay.

## 8. Leakage

**Leakage** (rò rỉ) xảy ra khi phần đánh giá cho phép một phương pháp dùng thông tin từ sau thời điểm mà nó phải dự đoán. Ví dụ: xếp một bài theo số like *hôm nay*, trong khi lựa chọn của user xảy ra tuần trước. Phương pháp trông thông minh vì nó biết trước tương lai.

Leakage là vấn đề phổ biến và đã được ghi nhận trong evaluation của recommender. Thesis chặn nó bằng **as-of rule**: mọi con số chỉ được tính từ các sự kiện trước thời điểm dự đoán. Một test chứng minh điều đó: đổi mọi sự kiện về sau không được làm đổi kết quả.

## 9. Baseline và so sánh công bằng

**Baseline** là phương pháp để so sánh. Một phương pháp mới nên thắng các baseline **mạnh**, không chỉ baseline yếu; một nghiên cứu tổng kết đã thấy nhiều phương pháp được công bố không thắng nổi các phương pháp đơn giản được tune kỹ (Ferrari Dacrema và cộng sự 2019). Vì vậy thesis cũng tune các baseline (BL2t, BL4, BL5, BL6), trên cùng dữ liệu validation và theo cùng luật như H.

## 10. Ý nghĩa thống kê trong một đoạn

Nếu H thắng BL2 0,01 trên 200 user, đó là thật hay may? Thống kê trả lời câu này. Thesis so hai phương pháp **từng user một** (ghép cặp), ước lượng khoảng tin cậy cho hiệu trung bình (bootstrap), tính p-value (randomization test), và điều chỉnh vì chạy nhiều kiểm định (Holm). File 06 giải thích từng bước.

## 11. Tự kiểm tra

1. Candidate generation khác ranking ở chỗ nào?
2. Vì sao "user không like bài này" không có nghĩa là "user không thích bài này"?
3. Cho một ví dụ về influence và một ví dụ về homophily.
4. Vì sao leakage có thể làm một phương pháp yếu trông mạnh?
5. Vì sao baseline cũng phải được tune?
